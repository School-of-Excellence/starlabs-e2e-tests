# Journey Pipeline — Session Handoff (RESUME FROM HERE)

> **Self-contained.** A new session (or you) can resume cold from THIS file alone.
> Goal: put the **`journey`** system behind the hermetic CI gate, mirroring how **`queue`** was done.
> Broader platform context: `docs/CICD-JOURNAL.md` (the team's master journal). Journey is **system #2** (queue was #1).

---

## ⏩ LATEST STATE (2026-06-26) — READ THIS FIRST (supersedes everything below)
Journey is on the team's **reusable-caller** pattern (thin caller → hub `web-e2e.yml`).
Recipe + gotchas: **`docs/REUSABLE-GATE-RECIPE.md`**. Plan: `docs/journey-caller-drafts/LANDING-PLAN.md`.

**3 PRs open (all code done + pushed):**
- `starlabs-e2e-tests#1` — hub `journey-reusable → main` (web-e2e `config`/`suite` + journey engine). **For vignesh; NOT merged.** Hub `main` moved to newer console work (`70b3b6c`, 06-26), still no `config` input. Acceptance + shared-`environment.emulator.ts` flag in the PR body.
- `starlabs-angular#8` — `journey-caller → cicd-dev` (journey validation, pinned `@journey-reusable`).
- `starlabs-angular#9` — `queue-recheck → cicd-dev` (queue backward-compat, pinned `@journey-reusable`). **TEMP — close after green.**

**✅ Billing: RESOLVED** (was the Free-plan Actions cap; fixed ~06-26 — runs execute normally now; verified by vignesh's green deploys #18/#17/#13 at 2m+).

**🛑 CURRENT BLOCKER: reusable-workflow ACCESS — `web-e2e.yml@journey-reusable` "workflow not found".**
With billing fixed, re-running #8 (run `27936113137`) surfaced a REAL error: GitHub can't resolve the hub's PRIVATE reusable workflow from the caller. **NOT our code** — the branch + file exist and are valid (`workflow_call` + the `config`/`suite` inputs intact; #1 unmerged; branch not deleted). It's the **hub's Settings → Actions → Access** (must allow org repos to call its reusable workflows at this ref) and/or an org Actions allowed-actions policy. **vignesh's domain;** this operator account 404s on hub settings, so it can't be fixed from here. Same access mechanism queue's `@main` caller relies on.

**RESUME — pick A or B to get #8 green (open decision):**
- **A (real fix):** vignesh confirms the hub's *Actions → Access* allows org repos to use its reusable workflows (incl. the `@journey-reusable` ref / any allowed-actions policy). Then **Re-run jobs** on #8 + #9 → green. Validates the real reusable pattern (needed for ALL future systems).
- **B (green now, no access dep):** repoint `journey-caller`'s gate to a **standalone** job that clones `hub@journey-reusable` via `REPO_PAT` and runs `cd e2e && CONFIG=playwright.journey.emulator.config.ts SUITE_DIR=journey EMU_REUSE=1 EMU_REUSE_APP=1 TESTRUNID=run1 bash scripts/run-isolated.sh` **inline**. Push `journey-caller`, re-run → green. Proves the flow + engine change; skips the literal `uses:` wrapper.

**THEN (after #8 green):** vignesh merges `#1` → engine on `main` → flip caller `uses:`/`e2e_ref` `@journey-reusable → @main` + close `#9` → land delivery fixes `e53657b`+`16b578a` into `development` (already cherry-picked on journey-caller) → cutover jointly with queue (triggers → `[development]`, make required).

> **Force-push rule (operator):** ONLY on our test branches (`journey-caller`, `queue-recheck`, `journey-reusable`) — NEVER on `cicd-*`/`feature/cicd-rollout`/`main`/`development`/`production`/`journey-gate`. Touch those only as PR targets.
> **Browser:** Chrome MCP, Windows deviceId `84a12a90-ba48-4872-af97-4101050c36a7` (meena-as GitHub session). `gh` CLI is NOT installed — PRs/re-runs via the web UI.

---

## ⏪ (SUPERSEDED 2026-06-21) — earlier state, kept for history
Journey moved **past** the standalone gate to the team's **reusable-caller** pattern (thin caller → hub `web-e2e.yml`).
Full recipe + gotchas: **`docs/REUSABLE-GATE-RECIPE.md`**. Plan/acceptance/rollback: `docs/journey-caller-drafts/LANDING-PLAN.md`.

**All code is done + pushed — 3 PRs open:**
- `starlabs-e2e-tests#1` — hub: `journey-reusable → main` (web-e2e `config`/`suite` + journey engine). **For vignesh**; backward-compat + acceptance in the PR body. ⚠️ flags the shared `environment.emulator.ts` null change.
- `starlabs-angular#8` — `journey-caller → cicd-dev` (journey validation, pinned `@journey-reusable`).
- `starlabs-angular#9` — `queue-recheck → cicd-dev` (queue backward-compat, pinned `@journey-reusable`). **TEMP — close after green.**

**🛑 ONLY BLOCKER: org GitHub Actions quota** (Free plan ~2,000 min/mo exhausted; $0 spend limit → ALL Actions blocked).
Both gate runs died in ~3s *at startup* — **not a code issue** (verified annotation: *"payments failed / spending limit"*).
Resumes at the **next monthly billing reset**, or by raising the Actions spending limit (paid). Nothing code-side is pending.

**RESUME (once quota is back), in order:**
1. **Re-run jobs** on `#8` + `#9` → confirm journey **16/16** + queue **green**.
2. vignesh reviews `#1` → acceptance passes → **merge engine to `main`**.
3. Flip caller `uses:`/`e2e_ref` `@journey-reusable → @main`; **close `#9`** (revert `queue-recheck`).
4. Land delivery fixes **`e53657b` + `16b578a` into `development`** (real bug) → journey green on a *real* dev PR.
5. Merge `journey-e2e.yml` caller into `development` (beside `queue-e2e.yml`), report-only.
6. **Cutover jointly with queue** (Phase 1B): triggers `[cicd-dev, cicd-prod] → [development]`, make required.

> Force-push rule (operator): only on OUR test branches (`journey-caller`, `queue-recheck`, `journey-reusable`) — never on `cicd-*`/`feature/cicd-rollout`/`main`/`development`/`production`/`journey-gate`.

---

## 0. TL;DR — where we are RIGHT NOW (updated 2026-06-20)
- Built + proved the **journey** emulator e2e suite → 16/16 green **locally against the `CI/CD` clone (branch `cicd`)** — but see ⚠️ below: that clone carries app fixes `development` never got.
- Created the gate workflow **`journey-e2e.yml`** (in the app repo).
- Both repos are on a **`journey-gate`** branch, **pushed** to origin.
- **Phase 3 ran for real in CI.** Validation PR **#7** (`journey-gate → development`) is open. Two config blockers were found & fixed during validation:
  1. PR #7 was mistakenly opened into **`main`** (gate only triggers on `development`) → **retargeted to `development`**.
  2. Gate referenced secret **`CICD_PAT`**, which **does not exist** on `starlabs-angular`; the real maintained PAT is **`REPO_PAT`** → workflow repointed (commit `2aff682`).
- **Gate run #1 = RED, but the pipeline is PROVEN** — it triggered, cloned all 3 repos via `REPO_PAT`, booted emulator+CF+app, ran the suite, and **correctly caught a real regression**: 14/16 passed, **JP-PD + JP-EDIT failed** because **`development` is missing two 2026-06-10 app fixes** (`e53657b` product-delivery list, `16b578a` delivery-sequence null-guard) that live only on the local `cicd` branch.
- **Ported both fixes onto `journey-gate`** (commits `25e40d8`, `4d53507`, pushed) → **gate run #2 = GREEN, 16/16 in CI** (5m 49s; run `27844449961`). ✅ **Phase 3 COMPLETE.** ⚠️ PR #7 is no-merge, so **`development` itself still needs these two fixes** (see §4 bug 6).
- **Nothing is on `main` / `development` yet** — all changes live on `journey-gate` branches.

## 1. The pattern (why journey was easy)
Journey = the **queue recipe MINUS the testid port**. Journey specs locate elements by **role/text** (0 `data-testid`), so the painful part of queue (porting 28 testid files into the app) **did not apply**. The real work was: emulator config + emulator seed + 2 small bug fixes.

## 2. Repos, paths, branches
| Role | Path | Branch | Pushed |
|---|---|---|---|
| **Hub** (Playwright engine) `starlabs-e2e-tests` | `C:\Users\meena\angular-projects\starlabs-e2e-tests` | `journey-gate` | ✅ |
| **App** `starlabs-angular` (dev clone) | `C:\Users\meena\angular-projects\starlabs-development` | `journey-gate` | ✅ |
| App `cicd` clone (the one served locally) | `C:\Users\meena\angular-projects\CI\CD` | `cicd` | — (local app under test) |
| CF repo (cloned for the emulator) | `starlabs-e2e-tests\starlabs-cloud-function` | `development` | gitignored, local |

## 3. Every file built / changed
**Hub (`starlabs-e2e-tests`, on `journey-gate`):**
- `playwright.journey.emulator.config.ts` — **NEW** — emulator Playwright config for `journey/`
- `journey/support/emulator-global-setup.ts` — **NEW** — attaches to emulator + seeds journey
- `journey/support/emulator-global-teardown.ts` — **NEW**
- `journey/seed-journey.js` — **EDIT** — `initAdminAuto()` (emulator-aware admin when `FIRESTORE_EMULATOR_HOST` set)
- `ci/overlay/environment.emulator.ts` — **EDIT** — `watson/salescrm: null` (was `{}`) ⚠️ **SHARED file (also used by queue — safe, but coordinate)**
- `journey/journey-deep.spec.ts` — **EDIT** — JP-09 email-template dropdown re-trigger (async-load timing)

**App (`starlabs-angular` / `starlabs-development`, on `journey-gate`):**
- `.github/workflows/journey-e2e.yml` — **NEW** — the gate. ⚠️ **`ref: journey-gate` is TEMPORARY** (validation); flip to `main` in Phase 4.

## 4. Bugs found + fixes (the WHY)
1. **Half-dead emulator** — after long idle, Auth(9099)+Functions(5001) crash while Firestore(8080) stays up (ports linger, HTTP returns `000`). First seed hit `ECONNREFUSED`. **Fix:** kill stale java/node on the emulator ports, reboot. *Don't let the emulator idle for hours.*
2. **JP-05/06/10** — `watson/salescrm: {}` → app calls `initializeApp({})` → `"projectId" not provided` fatal console error → console guard fails. **Fix:** `null` (falsy → app SKIPS the secondary Watson/SalesCRM app init; matches cloud test env).
3. **JP-09** — email-template dropdown empty. Data was fine (verified via emulator query). Root cause: `loadAllTemplates()` resolves AFTER the test fills the search box, and the custom dropdown's open-state recomputes only on an input event → stays closed. **Fix:** re-trigger the search in a `toPass` loop.
4. **JP-04** — `mat-select` panel intermittently doesn't open on click. **Handled by `--retries 1`** (not a code bug).
5. **project-id rule** — must be **`starlabs-cicd`** everywhere (app `environment.emulator.ts` + emulator boot `FIREBASE_PROJECT` + seed) or **auth silently fails**.
6. **⚠️ local/CI clone divergence (caught by gate run #1)** — "16/16 local" was run against the **`CI/CD` clone (branch `cicd`)**, but CI checks out **`starlabs-angular` `journey-gate`** (off `development`). The `cicd` clone carries two 2026-06-10 app fixes `development` never received, so JP-PD + JP-EDIT pass locally but failed in CI:
   - **`e53657b` fix(product-delivery)** — `src/app/Product Designer/product-delivery/product-delivery.component.ts`: build a *fresh per-emit view-model* instead of mutating the live `collectionSnapshots` snapshot (the in-place `['path']` mutation threw `undefined.length` on the 2nd emit → 0 rows). Fixes **JP-PD**.
   - **`16b578a` fix(delivery-sequence)** — `src/app/Product Designer/delivery-sequence/delivery-sequence.component.ts`: null-guard the edit-path `getDoc` ref→path walk (seeded `jny_PDS1` has a delivery option with no `deliverysequence` → `undefined.length` threw inside `.then()`, tripping the fatal-console guard). Fixes **JP-EDIT**.
   - Ported both onto `journey-gate` (`25e40d8`, `4d53507`). **`development` still needs them** — they should land via a real fix PR into `development` (journals: `CI/CD/specs/journals/2026-06-10-product-delivery-list-mutation-fix.md` + `…-delivery-sequence-edit-null-guard.md`).
   - **Lesson for the next system:** seed/run CI-side against the *same branch CI checks out*, or these clone-divergence gaps stay invisible locally.

## 5. How to RUN journey locally (3 Git Bash windows)
> Use **Git Bash** (`.sh` scripts need it). Paste with **Shift+Insert**. Java isn't on PATH in fresh shells — export it where shown.

**Window 1 — boot the emulator** (uses the helper script in your home):
```
bash boot.sh
```
*(boot.sh = java export + `cd hub` + `APP_PATH=CI/CD bash ci/setup-emulator-config.sh` + `FIREBASE_PROJECT=starlabs-cicd bash scripts/deploy-cf-emulator.sh`)*. Wait for **`All emulators ready`**.

**Window 2 — serve the app:**
```
cd /c/Users/meena/angular-projects/CI/CD
npm run start:emulator
```
Wait for **`Local: http://localhost:4200/`**.

**Window 3 — run the journey suite** (globalSetup auto-seeds journey; no separate seed step):
```
export JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.11.10-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"
cd /c/Users/meena/angular-projects/starlabs-e2e-tests
EMU_REUSE=1 EMU_REUSE_APP=1 npx playwright test --config=playwright.journey.emulator.config.ts
```
Add `journey/catalog.spec.ts` or `--grep "JP-01"` to scope. Add `--headed` to watch.
- **Login (manual):** `admin+jny@example.com` / `Test!1234` (journey run id = `jny`)
- **Emulator UI / Firestore:** http://localhost:4001
- JDK: `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`

## 6. ACTIVATION — 4 phases + current status
- **Phase 1 — hub engine → `journey-gate` branch:** ✅ **DONE** (committed + pushed)
- **Phase 2 — app gate → `journey-gate` branch:** ✅ **DONE** (committed + pushed); `journey-e2e.yml` ref flipped to `journey-gate`
- **Phase 3 — validate in real CI:** ✅ **DONE — gate GREEN 16/16 in CI** (run #2, 5m 49s):
  - [x] ref change committed + pushed on app `journey-gate` (commit `e1d90a5`)
  - [x] secret check → **`CICD_PAT` does NOT exist**; repo has **`REPO_PAT`** → workflow repointed (commit `2aff682`)
  - [x] READY PR opened: **#7** — was wrongly into `main`, **retargeted to `development`** (⚠️ still **do NOT merge** — validation only)
  - [x] gate run #1 → RED, caught a real regression (JP-PD + JP-EDIT; see §4 bug 6)
  - [x] ported the two missing app fixes onto `journey-gate` (`25e40d8`, `4d53507`)
  - [x] gate run #2 → **GREEN, 16/16 in CI** (5m 49s) ✅
- **Phase 4 — promote (only after Phase 3 green):**
  - [ ] hub: open PR `journey-gate → main` for **vignesh-027** to review (⚠️ flag the shared `ci/overlay/environment.emulator.ts` change — also affects queue), merge
  - [ ] app: flip `journey-e2e.yml` `ref: journey-gate` → `ref: main`, push
  - [ ] app: merge `journey-e2e.yml` to `development`; **mark `journey-e2e` a required check**
  - [ ] close the validation PR

## 7. Gotchas / watch
- **`journey-e2e.yml` ref is `journey-gate` (TEMP)** — MUST flip to `main` in Phase 4, else CI keeps cloning the feature branch.
- **`ci/overlay/environment.emulator.ts` is SHARED** (queue uses it too) — the env fix is safe for queue, but the hub PR touches the team's engine → review with vignesh.
- **Hub is vignesh-027's active repo** — Phase 4 hub change = a reviewed PR, not a solo push to `main`.
- **Emulator longevity** — reboot fresh per session (Auth/Functions crash on long idle).
- **Draft PRs skip the gate** — use a ready PR or add the `run-e2e` label.
- `gh` CLI is NOT installed — all PRs via the GitHub **web UI**.

## 8. Key facts
- **Journey screens/routes:** `/addjourney` `/addproduct` `/journeyproductmap` `/deliverysequence` `/productdelivery` `/salesleads`
- **Journey app folders:** `src/app/Journey Onboarding/**`, `src/app/journey-onboarding-detail/**`
- **Journey specs (16 tests):** `journey/catalog.spec.ts`, `purchase.spec.ts`, `journey-deep.spec.ts`, `journey.spec.ts`
- **Gate path filter:** journey folders + `**.guard.ts` + `angular.json` + `package.json` + the workflow file
- **Home helper scripts** (`~/boot.sh seed.sh serve.sh test.sh`) were for **queue**; journey uses the raw Window-3 command above (its globalSetup seeds itself).

## 9. The repeatable recipe (for the next system after journey)
1. Add `data-testid` hooks to the app **only if** the specs use them (journey didn't — check first).
2. Create `playwright.<sys>.emulator.config.ts` + `<sys>/support/emulator-global-setup.ts` (mirror journey's).
3. Make the system's seeder emulator-aware (`initAdminAuto` pattern).
4. Get it green locally on the emulator (iterate on env/timing).
5. Add `<sys>-e2e.yml` gate (mirror `journey-e2e.yml`: `starlabs-cicd` project, CF in `e2e/`, `APP_PATH` set).
6. Validate on a `journey-gate`-style branch → promote to main + required.
