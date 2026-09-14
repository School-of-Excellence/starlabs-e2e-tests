# Systems Rollout — STATUS / RESUME (2026-06-30)

> Resume point for the next session. Companion to `docs/SYSTEMS-ROLLOUT-HANDOFF.md` (the original recipe).
> Goal unchanged: wire the 10 remaining e2e systems behind the hermetic emulator CI gate, like queue/journey.

## 👉 NEXT SESSION — START HERE
**#6 evomap is DONE — locally GREEN + CI gate GREEN.** 2x full local runs (13p/1skip EM-02 fixme); on
`systems-emulator` (`6d92be3` port + `ecefdc9` EM-07/EM-03 race fixes). Report-only caller **PR #24** opened
(evomap-caller `c2cdfa5` → cicd-dev), **gate green run #1 (Success, 4m34s; only a benign Node-20 runner
deprecation warning)**. Worktree cleaned up. See `specs/journals/2026-06-30-evomap-emulator-gate.md`.
**Then start #7 modes** (config-only + the bundled CF-in-emulator task), then HOLD #8/#9/#10 for their infra.
**Do NOT work on comms** — CN-14 is the operator's separate session (CN-14 v3 `287274b`: `/onewaytemplates`
is an app-branch divergence, only on app `cicd` not `cicd-dev`; do not touch `comms/templates.spec.ts`).

## TL;DR
- **Shared lib extracted** → new systems are **config-only** (4 tiny files + a 1-line seeder swap).
- **5 systems ported**: authroles, business, content, comms, workshops.
- **CI green: authroles, business, content, comms, workshops.** comms fully green — CN-14 now self-skips on `cicd-dev` (route absent; see below).
- **On hub `main`** (merged via hub PR #2): authroles + business + **the shared lib**.
- **On hub branch `systems-emulator`** (ahead of main, NOT yet merged): content, comms, workshops + the
  shared `console-guard.ts` allowlist fix (WS-02).
- **CN-14 RESOLVED** (`287274b`, comms gate green): real cause was an app-branch divergence — `/onewaytemplates` is on `cicd` but not `cicd-dev`; CN-14 self-skips when the route is absent. workshops **WS-02 FIXED** `ee5397b`.

## The shared lib (already on `main`)
- `lib/seed-common.js` → exports `initAdminAuto()` (emulator-pinned admin when `FIRESTORE_EMULATOR_HOST` set, else cloud `seed.initAdmin()`).
- `lib/emulator-global.ts` → `makeEmulatorGlobalSetup({ seedScript, runidEnv, runidDefault })` + `emulatorGlobalTeardown`.
- `lib/emulator-playwright-config.ts` → `makeEmulatorConfig({ suite })` + `makeEmulatorEvidenceConfig(base)`.

**Per-system recipe (config-only):** create `playwright.<sys>.emulator.config.ts` + `.evidence.config.ts` (1-line factory calls), `<sys>/support/emulator-global-setup.ts` + `-teardown.ts` (2-line shims), and add `initAdminAuto` to the destructure in `seed-<sys>.js` (swap both `seed.initAdmin()` → `initAdminAuto()`). Then: seed + run locally green → `<sys>-e2e.yml` caller PR → validate in CI.

## Per-system status
| # | System | Local | CI gate | Caller PR | uses/e2e_ref | Notes |
|---|---|---|---|---|---|---|
| 1 | authroles | ✅ 18p/3skip | ✅ **MERGED to cicd-dev** (active, `0cb5487`) | #19 merged | **@main** | done + PROMOTED (caller now on cicd-dev like queue) |
| 2 | business | ✅ 21p/0/0 | ✅ **MERGED to cicd-dev** (active, `1e5c499`) | #20 merged | **@main** | done + PROMOTED; fixed touchpoint stock-baseline + filter-open; un-deferred BM-TP-DELAY |
| 3 | content | ✅ 11p/0/8skip | ✅ **MERGED to cicd-dev** (active) | #21 merged | **@main** | PROMOTED; 4 fixme + 4 CF-gated skips (all legit) |
| 4 | comms | ✅ locally (CN-14 runs) | ✅ **MERGED to cicd-dev** (active) | #22 merged | **@main** | PROMOTED; CN-14 RESOLVED `287274b`: `/onewaytemplates` absent from `cicd-dev` (app divergence) → self-skips when route missing; runs once feature merges to cicd-dev |
| 5 | workshops | ✅ 14p/0/4skip | ✅ **MERGED to cicd-dev** (active) | #23 merged | **@main** | PROMOTED; WS-02 fixed `ee5397b` (allowlist benign "No such document!" first-emission) |
| 6 | evomap | ✅ 13p/0/1skip | ✅ **MERGED to cicd-dev** (active) | #24 merged | **@main** | PROMOTED; EM-07 + EM-03 cold-start race fixes (`ecefdc9`); EM-02 fixme; aux Last-Video index flagged-not-asserted |
| 7 | modes | ✅ **9/9 CF + non-CF** (2026-07-01) | ✅ **GREEN ×2** (run #2 @systems-emulator 5m50s, run #3 @main 6m1s; was 21m FAIL pre-fix) | #25 (report-only) | **@main** (flipped `ec3296a`) | CF-side-effect suite made GREEN. CF fixes on `cicd-modes-emulator-fix` (`58be36e`): modular `FieldValue` import, `productsdata_to_pmd` null-safety, `FUNCTIONS_EMULATOR`-gated external webhook skips. Verified 9/9 in AUTO + SEQUENTIAL(=CI) locally + CI; queue `big-core` regression clean. Caller flipped `@systems-emulator → @main`. See `specs/journals/2026-07-01-modes-cf-emulator-gate.md`. **Pending: PROMOTE PR #25 → cicd-dev; CF team merges `cicd-modes-emulator-fix` → `development` (then flip cf_branch → development)** |
| 8 | appointments | ✅ 18p/0/1skip (2x) | ✅ **MERGED to cicd-dev** (active); green @systems-emulator 5m40s + @main 4m39s | #29 merged | **@main** | **PROMOTED** — engine merged to main (hub PR #4 `845a3dc`); caller flipped `@main` (`78ae9f6`); PR #29 → cicd-dev. **UNBLOCKED** (3 indexes already in `ci/overlay/firestore.indexes.json`). Fixes: route-mount networkidle→bounded (`b208e19`); **CI-only studio crash `b2ae06d`** — seed writes `participant metadata/{p0,p1}` (studio reads it un-guarded; prod CF creates it, emulator seed must — every sibling suite does; appointments' seed had omitted it → passed only on dirty local emulator). APPT-03 fixme |
| 9 | events | ✅ **15/15 (2×)** (2026-07-01, ~3.3m) | ⏳ caller not opened | on `systems-emulator` (`3bfc712`) | @systems-emulator | Config-only port (initAdminAuto swap + 4 factory files). **EVT-03/04 root-caused (Layer-2 test, not setup/code):** event mat-select opened before the async `collectionData` option stream populated + `click({force:true})` didn't toggle the CDK overlay → 120s timeout; verified LIVE that app/data/query are correct (`eventList`=Array(2), option renders on a normal click); fixed with a `toPass` retry-open. No CF-side-effect cases (cf_branch → `development`). See `specs/journals/2026-07-01-events-emulator-gate.md`. Next: open `events-e2e.yml` caller PR |
| 10 | profiles | ✅ **20p/3skip (2×)** (2026-07-01) | ⏳ caller not opened | on `systems-emulator` (`85603bb`) | @systems-emulator | Config-only port (`24c507d`). **Both "blockers" resolved:** CF-in-emulator done (modes work) → PA-CF-01..05 PASS for real; firestore-forms named DB served on-demand. Two honest handling fixes (`85603bb`): (a) WATSON — analytics `getApp("watson")` app/no-app is a by-design env limit (external app never wired) → allowlist in TOLERATE, same as journey; (b) FORMS-DB PA-13/14 — the Firestore **emulator does NOT support named-DB rules** ("does not support multiple databases yet"), so client reads/writes of `firestore-forms` default to DENY → `test.skip` on emulator (run on cloud config). PA-FT-FILT fixme. ⚠️ `ci/overlay/firebase.emulator.json` got a doc-comment (do-not-use-array-form); current running emulator is on the transient allow-all state, next boot restores single-object |

**Hub `systems-emulator → main` MERGED** (hub PR #3, `11b13ce`) — content/comms/workshops/evomap engines (+ WS-02/CN-14 fixes + modes engine, inert) now on `main`. The 4 callers flipped `@systems-emulator → @main` and **re-validated GREEN against `@main`** (content #21 7m54s, comms #22 3m59s, workshops #23 4m24s, evomap #24 4m2s). modes caller stays `@systems-emulator` until proven.

**#8 appointments PORTED + 2x local GREEN** (on `systems-emulator` `b208e19`) — was infra-blocked but the 3 composite indexes turned out to be ALREADY in `ci/overlay/firestore.indexes.json`, so it's a plain config-only port. Caller PR not yet opened (pin `@systems-emulator`).

**🎉 ALL 10 SYSTEMS PORTED** (authroles → profiles). Nothing left to port. Remaining work is caller PRs + promotion to cicd-dev for the last few (modes #25, events, profiles) and the loose ends below (journey product-fix review; branch-guard governance).

## ✅ RESOLVED — comms CN-14 (real root cause: app-branch DIVERGENCE; fix `287274b`, comms gate GREEN)
**The earlier "authGuard dashboard-grant race + heaviest-chunk delay" theory was WRONG** — every
timing fix built on it (retry-`goto`; warm `/communication`/`/email-templates` + in-app nav; preload +
retry) chased a phantom and stayed red in CI. Verified by downloading the failing run's Playwright **trace**
artifact and reading the guard's own console + network:
- The in-app nav resolved **deterministically** to the `**` catch-all (`ExceptionalroutingComponent`, which
  redirects to `/EISDashboard` after 1.5s) — the authGuard **never ran** for `/onewaytemplates` (no
  `this uid`/`rolesArray`/`has access` logs) and the onewaytemplates chunk was **never fetched**.
- A `git` diff then nailed it: **`/onewaytemplates` (route AND `OnewayTemplatesComponent` — the component
  file does not exist) is ABSENT from `cicd-dev`**, the branch the gate builds. It lives only on the app's
  `cicd` branch (added in app commit `1feca08 "one way app communication"`), which is what we serve LOCALLY
  — so CN-14 passes locally and can never pass in CI. **App-branch divergence, not a flake.** (Asymmetry
  check: `/email-templates` IS on `cicd-dev` → CN-02 passes in CI; `/onewaytemplates` is not.)

**Fix (`287274b`, comms-caller `925b472` → comms gate GREEN in 4m54s):** CN-14 reads the live Angular Router
config via the dev-build `ng` debug API and `test.skip`s when the `onewaytemplates` route is **absent** from
the app under test (mirrors the CF-gated comms skips). **Self-heals:** runs for real the moment the
OneWayAppCommunication feature merges into `cicd-dev`. Green locally (route present → CN-14 runs + passes).

**⚠️ Operator note — cicd↔cicd-dev divergence:** the comms suite was authored/validated against `cicd`, but
the gate runs `cicd-dev`. To make CN-14 run for real, the OneWayAppCommunication feature must land in
`cicd-dev`. This is **not a clean automated push**: `cicd` vs `cicd-dev` is a 158/118-commit fork; a full
merge conflicts massively, and a cherry-pick of `1feca08` conflicts in `src/app/app.routes.ts` + 3
`queue-planning-review` files (and risks a `cicd-dev` build break). Needs a manual app-team merge + build
check. Until then CN-14 honestly self-skips (gate is report-only anyway). See memory
`cn14-app-branch-divergence`. **General lesson:** when a system test fails ONLY in CI, FIRST diff the
route/feature between local `cicd` and the gate's `cicd-dev` before theorizing about timing.

## ✅ FIXED — workshops WS-02 (commit `ee5397b`; CI gate green run #2)
> Resolved: anchored `/No such document!/` added to `queue/support/console-guard.ts` IGNORABLE (benign
> live-stream first-emission; the doc exists — WS-02's getDoc poll passes). Kept below for the record.

### Original finding
**Symptom:** `WS-02 create-workshop writes a new workshopconfiguration doc and navigates to its config page`
passes its FUNCTIONAL assertions but **fails in CI** via the `afterEach` console guard
(`assertNoFatal`, "workshops deep (create/config): no fatal console errors / pageerrors"). 13 passed · 1
failed · 4 skipped (locally 14 passed).

**Root cause:** the workshop-configuration page logs `console.error('No such document!')` at
`CI/CD/src/app/New-Workshop/workshop-configuration/workshop-configuration.component.ts:1107` — a `getDoc`
that returns a non-existent doc during the create→navigate→config-load flow (CI timing surfaces it; local
doesn't). This string is **not** in the console-guard IGNORABLE allowlist (`queue/support/console-guard.ts`),
so the guard treats it as fatal. WS-02's create + navigation worked — it's an incidental log, same class as
the already-allowlisted benign ones (Scroll container, incomplete key).

**Fix (next session):** confirm WHICH getDoc at component.ts:1107 logs it and that it's benign (the config
page mounts + the test's functional assertions pass — it appears so). Then either (a) add an anchored
`/No such document!/` (or tighter) entry to `console-guard.ts` IGNORABLE with a documented reason, OR (b) if
it's reading a genuinely-required precondition doc that the seed omits, seed that doc. Confirm benign before
allowlisting — do not blindly suppress. Report-only gate, so not blocking.

## Branches & PRs (all our test branches — no protected-branch pushes; no force pushes)
- **Hub** (`School-of-Excellence/starlabs-e2e-tests`): `main` (has #1/#2 + lib) · `systems-emulator` (has #3/#4/#5 engine, ahead of main). Merge `systems-emulator → main` when ready (was clean fast-forward last time), then flip the #21/#22/#23 callers to `@main`.
- **App** (`School-of-Excellence/starlabs-angular`): caller branches `authroles-caller`(@main), `business-caller`(@main), `content-caller`, `comms-caller`, `workshops-caller` → report-only PRs #19–#23 to `cicd-dev`.

## Standing constraints (unchanged)
- Never break/push to protected branches (`main`/`development`/`production`/`cicd-*`) — only our test branches. Hub `main` merges are operator-approved PRs (last one: hub PR #2). **No force pushes.**
- New callers **report-only** until proven green N times. `gh` CLI not installed → use the GitHub web UI (Chrome MCP, meena-as).
- **ATC OFF-LIMITS.** Project id `starlabs-cicd` everywhere. `ci/overlay/environment.emulator.ts` is shared (coordinate w/ vignesh).
- Each suite: **run locally green, show failures, don't hack tests to pass** (fixes must be honest + root-caused, like the business filter-open and the comms CN-14 root-cause work).

## CF-in-emulator (deferred infra task — do once, bundled at modes #7)
Content/comms/modes/profiles have CF-dependent cases that **self-skip** (CFs not in the emulator deploy set). This is the one real coverage gap vs queue/journey. Plan: add those systems' CFs to `scripts/deploy-cf-emulator.sh` **once**, and verify queue/journey's existing CF tests still pass (no regression). Hold #8 appointments (3 composite indexes) and #10 profiles (CF + `firestore-forms` named DB) until their infra lands.

**UPDATE 2026-07-01 (modes #7):** modes' CF (`calculateParticipantMode` + upstream `*_to_pmd` co-triggers) was ALREADY in the filtered emulator entry (`starlabs-cloud-function/functions/index.emulator.js`), so no `deploy-cf-emulator.sh` change was needed — the gap was that the CF **crashed/hung** in the emulator, not that it was absent. Three root-caused fixes on `cicd-modes-emulator-fix` (`58be36e`) make it run: (1) modular `FieldValue` import (firebase-tools' admin proxy `bind()`s `admin.firestore`, dropping its statics → `admin.firestore.FieldValue` undefined in the emulator — a KNOWN limitation, see `queue/cf-sideeffects.spec.ts:114` skip); (2) `productsdata_to_pmd` null-safety (uncaught deref on delete/null-create starved the sequential runtime); (3) `FUNCTIONS_EMULATOR`-gated skip of external Watson/CRM `axios.post` (they hang ~60s in the emulator and starve the cascade; NOT gated on `production` so real dev+prod still mirror). Regression: queue `big-core` clean against the branch. Journal: `specs/journals/2026-07-01-modes-cf-emulator-gate.md`. **This is a per-trigger robustness pattern, not a deploy-set change** — the same `FieldValue`/null-safety fixes will likely be needed when #10 profiles' CFs are exercised in the emulator.

## Local run recipe (reminder)
3 windows: (1) `bash ~/boot.sh` → wait `All emulators ready`; (2) `cd /c/Users/meena/angular-projects/CI/CD && npm run start:emulator` → wait `Local: http://localhost:4200/`; (3) `export JAVA_HOME=...; export PATH=...; cd <hub>; EMU_REUSE=1 EMU_REUSE_APP=1 npx playwright test --config=playwright.<sys>.emulator.config.ts`.
