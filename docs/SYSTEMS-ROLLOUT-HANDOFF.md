# Systems Rollout — Session Handoff (RESUME FROM HERE)

> **Self-contained.** A new session can resume cold from THIS file alone.
> **Goal:** wire the **10 remaining e2e systems** behind the hermetic emulator CI gate, the same way **queue** and **journey** already are. Incremental, one system at a time, **verified** — never autonomous, never breaking `main`/`development`.

---

## ✅ What's already done (foundation is live)
- The **reusable engine** `web-e2e.yml` (parameterized by `config`/`suite`) + the **journey engine** + **report-to-Storage** are all merged to **hub `main`** (merge `b27a874`, 2026-06-29).
- **queue** gate: live on `development`/`cicd-dev`, green. **journey** gate: validated green against `@main` (caller flipped, commit `c9010a8`); cutover to `development` still pending.
- **Playwright reports + screenshots** now persist to **`gs://starlabs-cicd.firebasestorage.app/cicd-reports-development/…`** and are indexed in **Firestore `cicd-audit/<runId>`** (best-effort; can't red a gate). See `docs/2026-06-29-screenshot-reports-to-firestore-storage.md`.
- So **every remaining system is purely additive**: a config + an emulator-aware seeder + a thin caller. No engine changes.

## Key finding from the 10-system analysis
- **All 10 suites locate by role/text — ZERO `data-testid`.** → **No app-side testid port needed** for any of them.
- **ATC is OFF-LIMITS** and already respected everywhere (products seeded `atcmodel:null`, no `atc_*` writes). Keep it that way.

---

## The per-system recipe (mirror journey)
For each system `<sys>`:
1. **`playwright.<sys>.emulator.config.ts`** — copy `playwright.journey.emulator.config.ts`; change `testDir: './<sys>'`, `globalSetup`/`globalTeardown` to `./<sys>/support/emulator-*.ts`, `metadata.suite: '<sys>'`.
2. **`<sys>/support/emulator-global-setup.ts`** — mirror `journey/support/emulator-global-setup.ts`; swap the seed script + `RUNID` env.
3. **`<sys>/support/emulator-global-teardown.ts`** — copy journey's verbatim.
4. **`<sys>/seed-<sys>.js`** — add `initAdminAuto()` (copy `journey/seed-journey.js` ~lines 43–51: if `FIRESTORE_EMULATOR_HOST` set → emulator-pinned admin; else cloud) and use it instead of `seed.initAdmin()`.
5. **Get it green locally** on the emulator (the real work — iterate on seeding/timing/app bugs).
6. **`.github/workflows/<sys>-e2e.yml`** (app repo) — copy `journey-e2e.yml`; swap `config`/`suite`, path filters, name. `uses: …web-e2e.yml@main`, `e2e_ref: main`, `secrets: inherit`.
7. **Validate** on a `<sys>-caller` branch (PR to `cicd-dev`), report-only → then promote.

Recipe references: `docs/REUSABLE-GATE-RECIPE.md`, `docs/JOURNEY-PIPELINE-HANDOFF.md` §9, and the journey files above as the gold template.

---

## 🥇 Recommended rollout order (start at #1)
| # | System | Tests | Effort/Risk | Notes |
|---|---|---|---|---|
| 1 | **authroles** | 19 | **S / low** | Near-verbatim journey mirror, simplest seed — **START HERE**, proves the recipe |
| 2 | business | 16 | M / med | No CF/ATC; only date-collision precondition cleanup to watch |
| 3 | content | 22 | M / med | Publitio/HLS CF cases already skip-guarded |
| 4 | comms | 16 | M / med | All CF side-effects skip gracefully on emulator |
| 5 | workshops | 16 | M / med | ATC-safe, self-contained (no shared-file edits); 4 deferrable `fixme`s |
| 6 | evomap | 8 | M / med | Smallest; one aux composite index missing (flagged, not asserted) |
| 7 | modes | 26 | M / med | CF-written checklist swept per run; PM-09/15 self-skip without CF/index |
| 8 | appointments | 17 | M / med | ⚠️ **3 BLOCKING composite indexes** must be deployed to the emulator first |
| 9 | events | 16 | **L** / med | 16 screens × 30+ collections, QR component injection — highest surface |
| 10 | profiles | 23 | M / **high** | ⚠️ Needs **CF-in-emulator** + **`firestore-forms` named DB** seeded |

**Do ranks 1–5 first** (pure mirrors, no hard blockers) → cutover with queue/journey. Then 6–7 (one infra item each). Hold 8–10 until their blockers clear.

## 🔑 Biggest leverage — refactor BEFORE porting suite #3
The analysis strongly recommends: after the first 1–2 ports, extract the boilerplate so suites 3–10 become **config-only**:
- `initAdminAuto()` → one shared `lib/seed-test-project` (needed in all 10 seeders; don't copy-paste 10×).
- `emulator-global-setup/teardown.ts` → one shared module parameterized by `{suiteDir, RUNID}` (near-identical across all suites).
- `playwright.<sys>.emulator.config.ts` + `<sys>-e2e.yml` → a small generator/template taking `{suite, testDir, RUNID}`.

## ⚠️ Hard blockers (ranks 8–10) — decide once
- **Composite indexes**: appointments needs **3** (blocking); evomap/modes/comms/profiles have aux gaps. **Policy: deploy `firestore.indexes.json` to the test project**, not per-suite `createIndex()`. Decide + document once.
- **CF execution in emulator**: profiles (5 `PA-CF-*`) and modes need the emulator to run Cloud Functions (queue/journey already do via `deploy-cf-emulator.sh` — confirm those systems' CFs are in the set).
- **`firestore-forms` named DB**: profiles `PA-13/14` read/write it — must be provisioned + seeded in the emulator.

---

## Per-system cheat sheet (seed + watch-outs)
- **authroles** (19, S/low): seed 3 auth actors (admin[admin,ah], eis[eis], participant) + `profile_data`/`users_roles`/`dashboard` route ACLs + `classify/AHCRM_dashboard_access` key. Login: admin super-role. Watch: IndexedDB stale-nav (nav filters twice); AHCRM singleton doc → seed+render only, surgical `FieldValue.delete` on teardown. `AR-15` skip-guarded (CF not deployed).
- **business** (16, M): 13 client-side collections (expenseplanning, adsinvestment+logs, event/zones, 3minuteshpc, quiz/quizbyclients, participant touchpoint, …). Watch: date-collision precondition cleanup (`clearAppCreatedExpensesByName/Ads`); 17k stock touchpoint rows → bury seeds in run-unique type; `BM-TP-DELAY` fixme.
- **content** (22, M): solar-voice audios/playlists/series/episodes/category/tiers/etc. 4 `fixme` + 3 CF-gated skips (Publitio). Pure render+write port.
- **comms** (16, M): templates/group-chat/zoom dashboards/notification logs. CF onCreate/onUpdate cases skip-graceful on emulator; `CN-16` collection-group index self-skips; `CN-15/03/04b` fixme.
- **workshops** (16, M): workshopconfiguration/enrollment/dashboard. Self-contained (no shared-file edits). 4 `fixme` (WS-06/08/10/13); hardcoded mover `profileid 3LVxKXuyxldYoRDEpx5s`.
- **evomap** (8, M): evolutionmappingvideo/liveevolutionmapping/participant videos + queue/token. `EM-02` fixme; aux index for Last-Video column missing.
- **modes** (26, M): product modes lifecycle; CF-written `participant mode checklist` + `evolution log` swept per run; `PM-09`(CF)/`PM-15`(index) self-skip.
- **appointments** (17, M): availability/booking/studio/offtime. **3 composite indexes BLOCKING**; `APPT-03` fixme; Material `force:true` clicks.
- **events** (16, L): create-event/QR-scanner/e-ticket/arena/initiate-event-product. QR via Angular component injection (`qrEval`); dev-build-only `page.evaluate`; many external stubs.
- **profiles** (23, M/high): userprofile/analytics/form-tracker. 5 `PA-CF-*` need CF-in-emulator; `PA-13/14` need `firestore-forms` named DB; native `alert()` on `PA-03` (auto-accept dialog).

---

## Environment, paths, constraints
- **Hub** (engine + suites): `C:\Users\meena\angular-projects\starlabs-e2e-tests` — branch **`main`** (origin `School-of-Excellence/starlabs-e2e-tests`, **public**).
- **App** (callers): `C:\Users\meena\angular-projects\starlabs-development` — origin `School-of-Excellence/starlabs-angular` (**public**). Caller workflows live in `.github/workflows/`.
- **App served locally** (under test): `C:\Users\meena\angular-projects\CI\CD` (branch `cicd`).
- **Run locally (3 Git Bash windows):**
  1. boot emulator: `bash ~/boot.sh` (java export + `APP_PATH=CI/CD bash ci/setup-emulator-config.sh` + `FIREBASE_PROJECT=starlabs-cicd bash scripts/deploy-cf-emulator.sh`) → wait `All emulators ready`.
  2. serve app: `cd /c/Users/meena/angular-projects/CI/CD && npm run start:emulator` → wait `Local: http://localhost:4200/`.
  3. run suite: `export JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.11.10-hotspot"; export PATH="$JAVA_HOME/bin:$PATH"; cd <hub>; EMU_REUSE=1 EMU_REUSE_APP=1 npx playwright test --config=playwright.<sys>.emulator.config.ts`
  - CI-mimic per-file isolation: `cd e2e && CONFIG=playwright.<sys>.emulator.config.ts SUITE_DIR=<sys> EMU_REUSE=1 EMU_REUSE_APP=1 TESTRUNID=run1 bash scripts/run-isolated.sh`
- **Emulator longevity:** reboot fresh per session (Auth/Functions crash on long idle). Don't let it idle for hours.
- **project id MUST be `starlabs-cicd`** everywhere (seed + app `environment.emulator.ts` + emulator boot) or auth silently fails.
- **`ci/overlay/environment.emulator.ts` is SHARED** (queue+journey set `watson:null, salescrm:null`). Any edit → flag + coordinate with vignesh.
- **ATC OFF-LIMITS** (`atc_*`, `big assignment_*`, `src/app/ATC/**`). Verify per system: `grep -irE 'atc|triple' <sys>/ seed-<sys>.js` should be clean.
- **Force-push rule:** only on OUR test branches (`<sys>-caller`, etc.) — never on `main`/`development`/`production`/`cicd-*`.
- `gh` CLI is NOT installed — PRs/re-runs via the GitHub **web UI** (Chrome MCP, meena-as session).

## Safety nets (so nothing breaks)
- Each system lands **additive** to hub `main` (new files only; the only shared file is `environment.emulator.ts` — already set, don't re-edit).
- New callers are **report-only** (non-required) until proven green N times; promote to required per-system. An unfinished system can never block a merge.
- The history **recorder is best-effort** (`HISTORY_STRICT` unset → exits 0) — can't red a gate.
- Validate each on a `<sys>-caller` PR to `cicd-dev` (pin `uses:` to a hub feature branch until merged, then flip to `@main`) + keep a queue-recheck green to prove backward-compat.

## Reference: the full 10-system analysis
Per-system wire-up plans (seedNeeds, appAreas, risks, blockers, recommendedSteps) + synthesis live in the workflow output:
`C:\Users\meena\AppData\Local\Temp\claude\…\tasks\w478500un.output` (run `wf_fe145223-808`). If gone, re-run the analysis workflow `e2e-systems-analysis`.

---

## 👉 START HERE (next session)
1. **Port `authroles`** (rank 1) end-to-end, **sequentially + verified** (not autonomous): create the 4 files (config + setup + teardown + `initAdminAuto`), get it **green locally** on the emulator, then add `authroles-e2e.yml` and validate in CI.
2. **Then extract the shared lib** (`initAdminAuto` + setup/teardown + config/yaml template) before porting suite #3, so ranks 3–10 become config-only.
3. Proceed down the order; **hold 8–10** until their infra blockers (indexes / CF-in-emulator / named DB) are resolved.
