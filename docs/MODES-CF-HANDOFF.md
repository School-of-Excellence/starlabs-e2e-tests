# Modes #7 — CF-side-effect failures: HANDOFF / RESUME

> ✅ **RESOLVED 2026-07-01 — all 9 CF-side-effect tests PASS** (verified 9/9 in AUTO + SEQUENTIAL(=CI)).
> Root causes + fixes are in `specs/journals/2026-07-01-modes-cf-emulator-gate.md`. CF fixes pushed to
> `cicd-modes-emulator-fix` (`58be36e`). TL;DR of the three real causes (all invisible in test output —
> found by tracing the runtime): (1) firebase-tools' admin proxy `bind()`s `admin.firestore` → strips
> `FieldValue` in the emulator (fix: modular `firebase-admin/firestore` import); (2) `productsdata_to_pmd`
> uncaught deref on delete/null-create starves the sequential runtime (fix: null-safety); (3) co-trigger
> external Watson/CRM `axios.post` hangs ~60s and starves the cascade (fix: skip when
> `FUNCTIONS_EMULATOR`, NOT when `!production` — else it would break the real dev mirror). Remaining:
> modes CI gate (PR #25) green → flip caller `@main` → promote to `cicd-dev`; CF team merges branch →
> `development`. The diagnostic narrative below is kept for the record.

> Self-contained resume point. Companion to `docs/SYSTEMS-ROLLOUT-STATUS.md`.
> Goal for next session: **for each failing modes CF test, classify the cause by LAYER (in order) before fixing.**

## The diagnostic roadmap (operator directive — DO THIS, in order, per failing test)
For EACH of the 9 failing CF-side-effect tests, decide which layer the failure is in, **in this order**, and only then fix at that layer:
1. **SETUP / infra** — emulator config, functions-runtime mode, seed data missing/wrong, CF not deployed, index missing, clock/`Atestdate` wrong.
2. **WRONG TEST CASE** — test bug: bad precondition (doesn't fully reset), wrong assertion vs the CF's actual contract, shared-subject race, insufficient wait for the CF cascade to settle.
3. **CORRECT TEST, CODE BUG** — the test is right but the code is wrong, in either:
   - the **Cloud Function** (`starlabs-cloud-function/functions/components/participantmode.js`), or
   - **Angular** (unlikely for these — they are CF-side-effect tests with `void page`, no UI).

Do NOT skip tests. Skipping is explicitly off the table. Find the real cause + fix.

## State (what is TRUE right now)
- **Modes port is DONE and correct** (config-only, mirrors evomap). **15 non-CF tests PASS**, 1 skips (wishlist-form), **9 CF-side-effect tests FAIL**.
- Ported files on hub `systems-emulator` (commit **`bf30ff7`**): `playwright.modes.emulator.config.ts`, `playwright.modes.emulator.evidence.config.ts`, `modes/support/emulator-global-setup.ts` + `-teardown.ts`, `modes/seed-modes.js` (uses shared `initAdminAuto`).
- Caller: **PR #25** `modes-caller → cicd-dev` (app repo), `.github/workflows/modes-e2e.yml`, report-only. `cf_branch` pinned to `cicd-modes-emulator-fix` (see below), `e2e_ref: systems-emulator`.

## The 9 failing tests
- `modes/cf-mode.spec.ts` → **PM-10/11** (completion → `participant mode checklist` doc + `profile_data.participantmode = "Integration Mode"`).
- `modes/engine.spec.ts` → **PM-ARC-PERF, PM-ARC-EXT, PM-ARC-AFTER** (post-completion arc rungs), **PM-ROLLUP-MULTI, PM-ROLLUP-EXPLORE** (headline rollup), **PM-SEED** (new product → seeded mode), **PM-CANCEL** (cancel → nulls), **PM-RAMP** (tentative ≥30d → Early Preparation).
- All assert the side-effects of the CF **`calculateParticipantMode`** (`participantmode.js`, `onDocumentWritten` on `participantsproduct`).

## What is ALREADY fixed / verified (do not re-litigate)
1. **Tooling — FIXED.** Local `firebase-tools` was **14.4.0**, which **cannot load any `firebase-functions@7` CF**: `firebase-tools/lib/emulator/functionsEmulatorRuntime.js:456/458` unconditionally calls the **removed** `functions.config()` → every CF "Failed to load function". Upgraded global to **15.22.4** (matches CI `firebase-tools@latest`; 15.x removed that call). This is a SETUP-layer fix that was masking everything. **CI already uses 15.x**, so CI never had this.
2. **CF bug #1 (delete guard) — FOUND + landed on a feature branch.** `calculateParticipantMode` dereferences `afterData.productref.path` on a **delete** (no `after` snapshot) → throws. Cloud tolerates it (isolated per-invocation runtimes); the **emulator runs all invocations in ONE shared runtime**, so the crash **starves the next (completion) invocation** and its side-effect never lands. Fix = `if (!change.after.exists) { return null; }` right after `afterData` is computed. Committed as **`6930637`** on CF feature branch **`cicd-modes-emulator-fix`** (pushed to `origin` of `starlabs-cloud-function`; **NOT** on protected `development`). `modes-e2e.yml` `cf_branch` points at it (modes-caller commit **`def8519`**).

## Evidence matrix (what each config produced locally / CI)
| Functions runtime | CF | Result |
|---|---|---|
| Sequential (default), clean CF | clean | **0/9** — CF crashes on delete, starves shared runtime |
| Sequential, **delete guard** (clean reboot) | +guard | **0/9 pass** but CF now RUNS (sets `mode:"Integration Mode"`); remaining failures are cascade/state-leakage |
| **AUTO** (`FB_EMU_FN_SEQUENTIAL=0`), clean CF | clean | **2/9 pass** — isolated runtimes help, not enough |
| CI (sequential) + delete-guard branch | +guard | **FAILED** — run `28494938560` (sha `def8519`); exact per-test tally NOT yet parsed. Report downloaded → `C:\Users\meena\Downloads\playwright-report (4).zip`, extracted to `C:\Users\meena\Downloads\_pm` (index.html has gzip-embedded results; re-read the CI log's `ISOLATED SUITE SUMMARY` for the clean count). |

**AUTO + delete-guard together = the untested "best case"** — RUN THIS FIRST next session.

## The two failure CLASSES observed (start your layer-classification here)
- **CLASS A — cascade / shared-subject state-leakage** (PM-CANCEL, PM-ARC*, PM-ROLLUP*, PM-RAMP): all reuse `modeIds.PP1`. The CF re-fires itself many times per trigger (each `change.after.ref.update(...)` re-triggers `onDocumentWritten`); in the slow shared emulator runtime the cascade from test N leaks into test N+1. Example: PM-CANCEL's doc showed leftover `mode:"Integration Mode"` + `statusdate.completed` from a prior test. **Likely LAYER 2 (test) or LAYER 1 (runtime mode).** Candidate fixes: (a) each engine test uses its OWN `participantsproduct` docid (isolate subjects) instead of shared `PP1`; (b) after each reset, poll until the cascade settles before triggering (cf-mode.spec already does this); (c) AUTO runtime so re-fires are isolated. `resetSubject` (engine.spec.ts:44) clears `statusdate` via `FieldValue.delete()`, but **PM-CANCEL's precondition (engine.spec.ts:188) does a raw `.set()` that does NOT clear `statusdate`** — a concrete LAYER-2 candidate.
- **CLASS B — isolated single-trigger, still fails: PM-SEED.** PM-SEED uses its OWN subjects (`PPN`/`PPP`), so it is **NOT** cross-test leakage. A local manual probe (create `participantsproduct` with `status:null` + valid `productref` → expect CF seed branch `participantmode.js:36-49` to set `mode:"Journey Planning Mode"`) showed **mode NEVER set** and no CF logs (note: CF-edit hot-reload is FLAKY — reboot the emulator after editing the CF, don't trust hot-reload). This is the CLEANEST case to root-cause: it isolates whether the CF **seed branch** actually fires+works in the emulator on a create. **Likely LAYER 1 (create-trigger/setup) or LAYER 3 (CF code).** START HERE — it's the smallest reproduction.

## Environment / how to run
- **Hub** (engine + specs): `C:\Users\meena\angular-projects\starlabs-e2e-tests` — branch `systems-emulator`.
- **CF repo** (symlink in hub): `starlabs-cloud-function` — on `development`; fix branch `cicd-modes-emulator-fix`. ⚠️ **Local working tree `functions/components/participantmode.js` has UNCOMMITTED `PMDBG-*` debug logs** — run `git -C starlabs-cloud-function checkout functions/components/participantmode.js` to clean (the committed guard is safe on the feature branch). `functions/package.json` shows `M` = transient emulator `main`-swap (restored on emulator exit).
- **App under test**: `C:\Users\meena\angular-projects\CI\CD` (branch `cicd`). **`ng serve` on :4200 is currently DOWN** — restart: `cd /c/Users/meena/angular-projects/CI/CD && npm run start:emulator`.
- **Callers**: `C:\Users\meena\angular-projects\starlabs-development` (origin `starlabs-angular`).
- **Global `firebase-tools` = 15.22.4** (already upgraded — matches CI).
- Boot emulator (Git Bash): `bash ~/boot.sh` → wait `All emulators ready`. For **AUTO functions mode**: `FB_EMU_FN_SEQUENTIAL=0 bash ~/boot.sh`.
- Run a spec: `export JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.11.10-hotspot"; export PATH="$JAVA_HOME/bin:$PATH"; cd <hub>; EMU_REUSE=1 EMU_REUSE_APP=1 npx playwright test --config=playwright.modes.emulator.config.ts modes/cf-mode.spec.ts modes/engine.spec.ts --reporter=line`.
- **Direct CF probe (no app needed)**: write to `participantsproduct` via a node script requiring `./fixtures/seed-test-project` (`initAdmin()` with `FIRESTORE_EMULATOR_HOST=localhost:8080`), then read the doc + grep `firebase-debug.log` for `PMDBG-*` / `Mode Sequence` / errors. **Reboot the emulator after any CF edit** (hot-reload is unreliable and corrupts the trigger).
- **Emulator hygiene**: reboot fresh per session (Auth/Functions degrade on long idle / under contention — see memory `cicd-emulator-degrades-under-contention`). Kill only the `firebase emulators:start` process tree, keep `ng serve`.
- CI: `gh` NOT installed → GitHub web UI via the **signed-in** Chrome (deviceId `84a12a90`, meena-as). Modes gate log search box is flaky; prefer downloading the `playwright-report` artifact and reading the CI log's `ISOLATED SUITE SUMMARY`.

## Hard rules (unchanged)
Never break/push to protected branches (`main`/`development`/`production`/`cicd-*`). `cicd-modes-emulator-fix` (CF) + `modes-caller` (app) are OUR branches — OK to push. New callers report-only. ATC OFF-LIMITS. project id `starlabs-cicd`. The CF delete-guard on `cicd-modes-emulator-fix` must NOT be assumed on `development`; the final home for a real fix is the CF team merging it to `development`.

## NOT part of this — already DONE (don't touch)
comms **CN-14** is resolved (green; self-skips because `/onewaytemplates` is an app-branch divergence — on `cicd`, not `cicd-dev`). See `docs/SYSTEMS-ROLLOUT-STATUS.md` + memory `cn14-app-branch-divergence`. authroles/business/content/comms/workshops/evomap all green.

## Cleanup pending
- Revert the CF debug logs (above). Restart `ng serve`. Remove `C:\Users\meena\Downloads\playwright-report*.zip` + `_pm`/`_pr*` extracts. `_wt-evomap-caller` worktree still attached (evomap leftover).
