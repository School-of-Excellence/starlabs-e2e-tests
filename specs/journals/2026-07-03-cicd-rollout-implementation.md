# 2026-07-03 — Test orchestration + CF rollout: IMPLEMENTED (all 6 phases)

**Status:** Implemented + verified (builds green, mock-mode UI walked in a live browser).
**Author:** session (operator: appexperience@soexcellence.com).
**Plan executed:** [../plans/2026-07-02-test-orchestration-cf-rollout-architecture.md](../plans/2026-07-02-test-orchestration-cf-rollout-architecture.md) — every L-decision honored; deltas below.

## What was built, per system

### HUB (`starlabs-e2e-tests` @ main worktree)
- **`suites-manifest.json`** (NEW, keystone L1) — 12 suites (9 CI-ready) with appPaths/cfPaths globs,
  per-suite `capture` (queue/journey = `all`, rest failure-only, L11), queue `areas` migrated verbatim
  from preview-e2e.yml, `crossCutting` globs, `cfPredeploy` set. + `scripts/gen-suites-doc.mjs` →
  generated `SUITES.md`.
- **`mirror-suites.yml`** (NEW) — one-way push-on-merge mirror → `recordSuitesManifest`.
- **Report producer (report-plan Phase 0):** `run-isolated.sh` emits `playwright-report/report.json`
  (second `merge-reports --reporter=json`, best-effort); `record-run.cjs` gains suite-in-runId (D1),
  `cfRepo`/`cfBranch` meta, and a `storage.reportJson` pointer. `makeEmulatorReportConfig` factory +
  7 `playwright.<s>.emulator.report.config.ts` (failure-only capture, L7).
- **`web-e2e.yml`** — `cf_repo` input (L21) + CF meta into the history record.
- **CF guard (L14):** `cf-guards/no-retrigger-loop.spec.ts` (generic, manifest-driven; growth +
  bound checks, threshold not zero-tolerance; logs NO-COVERAGE for triggers the filtered
  `index.emulator.js` doesn't load) + `playwright.cf-guards.config.ts` + `scripts/cf-predeploy.sh`
  (fresh-emulator boot via CF_PATH override; restarts any warm emulator ON PURPOSE — stale triggers
  must not pass the gate).

### Console backend (`console/functions/src/`)
- NEW: `suites.ts` (manifest types + glob→regex + planSuites), `planTestRun`, `runTests`,
  `recordSuitesManifest`, `recordCfDeploy`, `listCfBranches` (30-branch cap, per-branch
  compare×2 + commit + branch-manifest fetch, partial-failure tolerant).
- CHANGED: `deployPreview` accepts `{runTests, suites[], cfRepo, cfBranch}` (bare-retry fallback if
  the target ref's workflow predates the inputs); `createPullRequest` — CF-type repos exempt from the
  OK_FOR_DEV fence (L18: pushed + not merged; no candidate doc needed); `reconcilePoll` — CF-matrix
  heal via the Cloud Functions v2 API with the admin credential (skips gracefully on 403);
  `model.ts` — `cf_deploy`/`test_dispatch`/`suites_mirror` activity types, `CfFunctionDoc`,
  `REPO_TYPES`, `CF_ENV_BY_PROJECT` (L16).
- `firestore.rules`: `console-config/suites` (member read / write false — one-way mirror) +
  `cf-functions` (developer/admin read / write false).

### Console frontend (`console/src/app/`)
- NEW (all `ng g c`): `shared/test-run-dialog` (+service, confirm-service pattern; NO evidence
  toggle, L7), `screens/report` (`/report/:githubRunId`, suite tabs D1, failed-first tree, failure
  drawer with error + artifact gallery), `screens/cf-board` (Branches + Functions matrix tabs).
- NEW core: `repos.ts` registry (L20), `cf-board.model.ts` (+`cfDrift`), `cicd-audit.model.ts`
  (+`flattenReport`).
- Service: `planTestRun`/`runTests`/`suitesManifest`/`cfFunctions`/`listCfBranches`/`createCfPr`/
  `auditRunsFor`/`reportJson`/`artifactUrl`; `deployPreview(rc, opts)`; **`reportUrlFor` → internal
  `/report/<id>` route** (dashboard superseded; `historyDashboardUrl` no longer consulted).
  `provideStorage` added to app.config.
- Screens: Working Branches — `Deploy ▾` split (without tests → confirm; with tests… → dialog),
  `Run tests…`, per-build "⚠ No test done on this build" + stale-report flag; Preview Channels —
  same warning + `Run tests…` in the gate block; Release Channel — `Run tests…` on development AND
  production entries + last-system-test badge on production. All report links route-aware.
- Mock fixtures: suites manifest, CF matrix (both/dev-only/DRIFT/ORPHANED), CF branches
  (unmerged/PR-open/merged), 3-suite audit run #7050 + report.jsons.
- `CLAUDE.md` refreshed (dead `board/` layout replaced; stale "fix seams first" marked historical).

### ANGULAR (`…/Starlabs 19` @ **feature/cicd-rollout**)
- `preview-e2e.yml` EVOLVED (not replaced): new `suites` (JSON array) / `cf_repo` / `cf_branch`
  inputs → `resolve` job (checks out hub, maps names→configs from the manifest) → `suite` matrix
  (`fail-fast:false`, evidence '1' always — config decides capture). Dorny area-routing kept
  verbatim as the no-input fallback; all fallback legs now pass `cf_repo`/`cf_branch` through.
- `E2E.md` (NEW) — the folder-layout ↔ manifest-glob contract table + "update the manifest in the
  same change set" rule.

### CF (`…/Starlabs Functions` @ **cicd-rollout**)
- `scripts/cicd/generate-manifest.js` (NEW) — reuses the proven predeploy-check/loopDetector parsing;
  extracts type + Firestore trigger path (v2 string/object forms + v1 `.document()`) + named
  `database` + `emulatorLoaded` flag; deterministic output. **Verified against the real repo:
  137 functions, 84 Firestore triggers, 16 emulator-loaded** (incl. firestore-atc DB triggers).
- `scripts/cicd/predeploy.js` (NEW) — regenerates the manifest, then runs the hub loop-guard;
  fail-closed with setup instructions when `E2E_HUB_PATH` is missing. **Replaces the
  `loopDetector.js` static predeploy** in `firebase.json` (file kept; hook swapped, L13/L14).
- `scripts/cicd/postdeploy.js` (NEW) — POSTs {repo, project(GCLOUD_PROJECT), branch, sha, by,
  functions[]} → `recordCfDeploy`. ALWAYS exits 0 (deploy already happened; reconcilePoll heals).
- `firebase.json`: predeploy/postdeploy swapped in. `.env.cicd.example` (NEW; `.env.cicd`
  gitignored). `manifest-check.yml` freshness CI (L22).
- **Gotcha fixed:** the repo's `.gitignore` ignored `/scripts` entirely — added
  `!/scripts/cicd/**` negation or the hooks would never be committed.

## Verification (all green)
- `console/functions` `tsc --noEmit` clean; `ng build` clean (all new lazy chunks emitted).
- `bash -n` on both shell scripts; `node --check` on record-run + all 3 CF hook scripts;
  `js-yaml` on all 4 workflows; `playwright --list` compiles the guard spec.
- Manifest generator ran against the REAL CF repo (numbers above).
- **Live browser (mock mode, then REVERTED to `useMock:false`):** CF Board Branches tab (3 merge
  states, Δfns chips) ✓ · Functions matrix (chips, DRIFT, ORPHANED, per-cell branch@sha/by/at) ✓ ·
  `/report/7050` (3 suite tabs, failed-suite auto-selected, failed-first tree, failure drawer with
  error text) ✓ · Working Branches (Deploy ▾ menu with both options, Run tests…, "No test done on
  this build") ✓ · Test Run dialog (locked suites WITH reasons, 7 optional, CF picker defaults,
  suite counter) ✓ — pixel-matches the approved wireframes.

## Deltas / notes vs the plan
- Failure-drawer artifacts are a **run-level gallery** (all failure images/videos of that suite run),
  not per-test-mapped: the merged JSON's attachment paths reference CI-local dirs that aren't
  uploaded. Honest label in the UI; per-test mapping is a v2 refinement (needs attachment-path
  rewriting in the producer).
- Overview untouched: it aggregates totals and has no per-candidate gate rows, so "View report" there
  had nothing to attach to. The three action screens carry it.
- The dialog's CF-branch picker is free-text (default `development`) rather than a fetched dropdown —
  `listCfBranches` is dev/admin-gated so testers couldn't populate it. v2: a relaxed branch-name
  endpoint.
- Deploy-menu closes between separate browser-eval calls (backdrop) — cosmetic test-harness artifact,
  not a product bug (single-interaction flows verified fine).

## Operator runbook (the ONLY remaining steps — nothing else is pending)
1. **Commit + push** the three repos (hub main worktree changes; Angular `feature/cicd-rollout`;
   CF `cicd-rollout`). Merge Angular/CF branches → `development` when ready (the evolved
   preview-e2e.yml must exist on any ref the console dispatches against).
2. **Deploy backend:** `cd console && firebase deploy --only functions,firestore:rules,storage --project starlabs-cicd`
   (includes the 2026-07-01 report-access rules; new fns: planTestRun, runTests, recordSuitesManifest,
   recordCfDeploy, listCfBranches).
3. **Hosting:** `cd console && npm run build && firebase deploy --only hosting --project starlabs-cicd`.
4. **Mirror bootstrap:** set repo secret `CONSOLE_INGEST_TOKEN` on the hub → run the
   `mirror-suites` workflow once (manual dispatch) to populate `console-config/suites`.
5. **CF devs:** `cp .env.cicd.example .env.cicd` (hub path + ingest token) — one time each.
6. **Review pass:** the `reviewNote`-flagged appPaths/cfPaths globs in `suites-manifest.json`
   (drafted from the real folder layout; journey/business/evomap/modes marked as guesses).
7. **GCP:** grant the starlabs-cicd functions SA Cloud-Functions viewer on starlabs-test +
   fir-sample-aae4a (reconcilePoll matrix heal; it skips gracefully until then).
8. **Prove it end-to-end** (plan §5 scenarios S1–S8) once deployed.
