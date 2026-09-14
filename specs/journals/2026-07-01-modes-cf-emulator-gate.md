# Modes #7 — CF-side-effect suite made green in the emulator (root-cause chain)

> Session 2026-07-01. Companion to `docs/MODES-CF-HANDOFF.md` + `docs/SYSTEMS-ROLLOUT-STATUS.md`.
> Outcome: **all 9 modes CF-side-effect tests pass** (were 0/9→2/9 flaky). Verified 9/9 in BOTH emulator
> worker modes: AUTO (`FB_EMU_FN_SEQUENTIAL=0`) and SEQUENTIAL (`--inspect-functions`, = CI). Fixes pushed
> to CF branch `cicd-modes-emulator-fix` (`58be36e`). Modes CI gate (PR #25) re-run to validate.

## What was wrong — four layered root causes (found by tracing real CF execution, not guessing)

### RC1 (tooling / LAYER-1) — firebase-tools strips `admin.firestore.FieldValue` in the emulator
The Functions emulator proxies the `firebase-admin` module and returns `admin.firestore` via
`Proxied.getOriginal → value.bind(target)` (firebase-tools `functionsEmulatorRuntime.js`). Because
`admin.firestore` is a function with **no `.prototype`**, firebase-tools' `isConstructor()` returns false,
so it `.bind()`s it — and `Function.prototype.bind` produces a NEW function that **drops all static
members**. Result: `admin.firestore.FieldValue` is `undefined` **in the emulator only**, so every
`admin.firestore.FieldValue.serverTimestamp()` threw and killed the trigger *before it wrote the mode*.
- This is why arc/cancel tests failed (they hit `serverTimestamp()` before their mode write) while the
  ROLLUP tests passed (simple-completion writes `mode` via `currentDate`, landing before the later crash).
- **This bug was already known** — `queue/cf-sideeffects.spec.ts:114` literally `test.skip`s CF-01/02 in the
  emulator with the reason *"admin FieldValue undefined in that runtime"*. Prior work skipped around it; we
  fixed it.
- **Fix:** import `{ FieldValue }` from the modular `firebase-admin/firestore` subpath (NOT proxied) and use
  `FieldValue.serverTimestamp()`. **Byte-identical in production** (same class); `service.js` already uses
  this subpath for `Timestamp`. Moved the suite 2/9 → 5/9.

### RC2 (CF code / LAYER-3) — `productsdata_to_pmd` crashed uncaught on create/delete
`participantmetadata.js` read `newdoc['profileid']` (line ~476) and `olddoc["packageref"]`/`newdoc[...]`
(line ~495) **unconditionally**, before the onCreate/onDelete branches. On a DELETE (`newdoc` undefined)
and on a status:null CREATE (the PM-SEED shape, where the status-unchanged short-circuit falls through to
the `packageref` compare) these threw uncaught. In SEQUENTIAL mode (ONE shared runtime) that crash starves
the next invocation — which is exactly why "SEQUENTIAL + delete-guard" was still 0/9.
- **Fix:** null-safe `profileid`/`packageref` mirroring the file's own `eventparticipationdata_to_pmd`
  pattern. This is a genuine production bug (crashes in prod too), so it belongs in dev/prod.

### RC3 (env / the real last-mile blocker) — co-trigger external `axios.post` hangs ~60s in the emulator
`profiledata_to_participantmetadata` (and `journey_to_pmd`, `productsdata_to_pmd`) `axios.post` to external
Watson/CRM webhooks (`watson-test-19`, `salescrm-test-19`). In the emulator these **hang ~60s per call**
(no prod-firewall on server-side CF HTTP) and time out. The pile-up backs up the functions runtime and
delays `calculateParticipantMode`'s self-cascade past the specs' 60s polls. **The CF logic was correct — it
was just too slow.** Proof (clean PM-10 trace): the checklist + Integration rollup DID get created, but only
at log line 207 *after* several `"function timed out after ~60s"` events, long past the poll window.
Attribution was exact: `profiledata_to_participantmetadata` began 7×, **finished 1×** (6 hung 60s each);
`calculateParticipantMode` began 7× / finished 7× (never hangs — it makes no external calls).
- **Fix:** skip the 4 external `axios.post` mirrors **only under the emulator**, keyed on
  `process.env.FUNCTIONS_EMULATOR === "true"` (firebase-tools sets this in every runtime it spawns).
- **WHY NOT `commonService.production`:** `production = PRODUCTION_PROJECTS.includes(projectId)` is *false*
  in the emulator AND in the real `development` deploy (`starlabs-test`). Gating on `production` would have
  **silently disabled the test-Watson/CRM mirror in the live development environment** (which the code
  deliberately targets via its `else`→test-URL branch). `FUNCTIONS_EMULATOR` is unset in every real deploy,
  so dev+prod keep mirroring; only the emulator skips. This is the correction that makes the fix safe to
  merge to development AND production.

### RC4 (config observation, not a code fix) — SEQUENTIAL `--inspect-functions` is fragile
CI boots SEQUENTIAL (`deploy-cf-emulator.sh` default = `--inspect-functions`, ONE reused runtime). Any
uncaught crash OR a disrupted boot starves everything after it → catastrophic 9/9 fail. Once RC1–RC3 removed
the hangs/crashes, SEQUENTIAL passes 9/9. (Residual fast co-trigger derefs — `dateofbirth`/`status` — still
crash but *don't* starve because they're synchronous/instant; noted below.) AUTO isolates runtimes and is
inherently more forgiving. Both are green now.

## Evidence matrix (this session)
| Config | Fixes | Result |
|---|---|---|
| AUTO | none (baseline) | 7 failed / 2 passed |
| AUTO | +RC1 (FieldValue) | 4 failed / 5 passed |
| AUTO | +RC1+RC2+RC3 | **9 passed** (39s, 33s — 2×) |
| SEQUENTIAL (CI) | +RC1+RC2+RC3 | **9 passed** (46s, 1.2m — clean boot) |
| queue `big-core` (regression) | +RC1+RC2+RC3 | 12 passed / 1 skip — **no regression** |
| queue `cf-sideeffects` (regression) | +RC1+RC2+RC3 | 2 skipped (pre-existing emulator skip) |

## Files changed (CF branch `cicd-modes-emulator-fix`, commit `58be36e`)
- `functions/components/participantmode.js` — modular `FieldValue` import + 9 call-site swaps. (Delete-guard
  was already committed `6930637` from a prior session.)
- `functions/components/participantmetadata.js` — RC2 null-safety + RC3 `FUNCTIONS_EMULATOR`-gated skips.

## Production-safety of each change (all safe to merge dev→prod)
- **FieldValue swap** — not *needed* for prod correctness (`admin.firestore.FieldValue` works fine off the
  emulator); it's byte-identical there. Needed only so the emulator/CI works. Ship it so CI can eventually
  run off `development` instead of pinning the feature branch forever.
- **null-safety** — real prod bug fix.
- **axios `FUNCTIONS_EMULATOR` gate** — prod + real-dev mirror unchanged; only the emulator skips.

## Residual / handed to CF team
- `service.js` `updateParticipantTouchPoint` still uses `admin.firestore.FieldValue` (serverTimestamp +
  arrayUnion) → fails under the emulator, but it's inside try/catch ("Touch Point Update Issue") so it's
  non-fatal and unasserted. Same one-line modular-import fix would clean it up.
- `profiledata_to_participantmetadata` / `productsdata_to_pmd` have a few more unguarded `dateofbirth`/
  `status` derefs that crash on edge writes — fast crashes, non-blocking here, but latent SEQUENTIAL
  fragility and real prod-edge bugs. Same null-safety pattern would harden them.

## Rollout state after this session
- Modes **locally green** (the blocker), CF fixes **committed + pushed** to `cicd-modes-emulator-fix` (`58be36e`).
- Regression: queue `big-core` green against our CF branch (12p/1skip; no cross-suite regression). queue
  `cf-sideeffects` skips in the emulator (pre-existing FieldValue limitation — validates the root cause).
- **CI gate GREEN ×2** (report-only, PR #25, actor meena-as):
  - run #2 `@systems-emulator` — Success 5m50s (was 21m FAIL pre-fix)
  - run #3 `@main` — Success 6m1s
- **Caller flipped `@systems-emulator → @main`** on `modes-caller` (`ec3296a`, pushed) — `uses` + `e2e_ref`
  now `main` (modes engine verified byte-identical between `main` and `systems-emulator`). `cf_branch` stays
  `cicd-modes-emulator-fix`.

### PENDING — two operator/CF-team merges (NOT done: both are PROTECTED branches; agent does not push `cicd-*`/`development`)
1. **App:** promote PR #25 (`modes-caller`) → **`cicd-dev`** — https://github.com/School-of-Excellence/starlabs-angular/pull/25 . Green ×2, ready to merge. Operator-approved merge (like #1–#6).
2. **CF:** merge `cicd-modes-emulator-fix` → CF **`development`** (NOT `cicd-dev` — the CF repo has no such
   branch; its integration branch is `development`). Compare:
   https://github.com/School-of-Excellence/starlabs-cloud-function/compare/development...cicd-modes-emulator-fix .
   **CF-team + cross-gate CI check required** — queue/journey clone CF `development`, so this merge is where
   the shared-`participantmetadata.js` changes reach them. After it merges, flip `cf_branch` in
   `modes-e2e.yml` from `cicd-modes-emulator-fix` → `development`.
   (2026-07-01: operator asked to send "both to cicd-dev"; corrected the CF target to `development` and left
   both merges to the operator/CF team per the protected-branch rule. No PRs opened — awaiting explicit go.)

## General lesson
When a CF-side-effect test fails only in the emulator: trace the actual runtime (began-vs-finished counts,
the CF's own console logs, `firebase-debug`/emu-boot log) BEFORE theorizing. The three real causes here
(FieldValue stripped by the tool, uncaught deref on create/delete, external HTTP hanging 60s) were all
invisible to the test output and only obvious from the runtime trace. Mirrors the CN-14 lesson (diff the
real environment before theorizing).
