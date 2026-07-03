# 2026-07-02 — Test Orchestration + CF Rollout — MASTER PLAN (locked, ready to implement)

**Status:** LOCKED — implementation starts from this doc. **Author:** session (operator: appexperience@soexcellence.com).
**Companions:**
- [2026-07-02-in-console-test-report-plan.md](../journals/2026-07-02-in-console-test-report-plan.md) (report fold-in — locked in a parallel session; this plan extends it for multi-suite)
- [2026-06-29-preview-time-gate.md](../journals/2026-06-29-preview-time-gate.md) (the gate this plan evolves)
- [2026-07-02-flutter-rollout-plan.md](2026-07-02-flutter-rollout-plan.md) (Flutter — PARKED, parallel session)
- Session journal: [2026-07-02-test-orchestration-cf-rollout-session.md](../journals/2026-07-02-test-orchestration-cf-rollout-session.md) (WHY each decision landed)

---

## 1. Goal

One release console where:
- **Angular** developers deploy a working branch **with or without tests**, choosing extra suites and the
  **CF branch** the emulator uses; testers see the preview + the **full test report in-console** and sign off;
  admins can run system tests on `development`/`production` at any time.
- **Cloud Functions** developers keep deploying manually (`firebase deploy`), but a **local Playwright
  loop-guard** gates every deploy, every deploy is **visible** in a per-function Dev/Prod matrix (including
  "deployed but not pushed"), and PRs to development are opened from a dedicated **CF Board** screen.
- **Which suites run** is decided by ONE manifest in the hub (git = truth), mirrored one-way into Firestore
  so the console reads it natively. The user always sees, before confirming, exactly which suites will run
  and why — plus every other suite they can add.
- **Every CI run** produces a machine-readable `report.json` + failure-only artifacts, browsable on an
  in-console Report screen with per-suite tabs and a failure drawer (error, screenshot, video, trace).

CF and Flutter are **independent** rollout tracks. Flutter is parked (see companion plan).

---

## 2. Locked decisions (with the one-line WHY)

| # | Decision | Why |
|---|---|---|
| L1 | Suites manifest lives in **hub git @ main**; **one-way mirror** → Firestore `console-config/suites`; console READ-ONLY | Manifest data is code-coupled (spec dirs, globs); git keeps it atomic with the code. Firestore mirror = easy console reads. Same "GitHub is truth, Firestore mirrors" principle as the whole console |
| L2 | Suite list per run = **JSON-array `workflow_dispatch` input** (not stored); audit copy in `activity-log` | Transport, not state. `fromJson(inputs.suites)` drives the matrix directly |
| L3 | Multi-suite = **parallel matrix jobs**, `fail-fast:false`, one report per suite | Wall-clock, per-suite visibility, zero changes to `run-isolated.sh` |
| L4 | **Angular ref is never chosen** — always the card's own branch. Only the **CF source (repo+branch)** is user-selectable (default `development`) | Removes a foot-gun; CF branch choice is the real cross-repo need |
| L5 | Deploy menu: **without tests** (preview only) / **with tests** (dialog). Dialog shows **locked suites + reason** (matched globs) + optional suites + CF picker | Tester trust requires knowing what was and wasn't tested |
| L6 | `[Run tests…]` button on Working Branches (dev), Preview Channels (tester), Release Channel dev+prod (admin) — same dialog, test-only dispatch | One mechanism, four entry points — "test the system at any given point" |
| L7 | **Evidence = failure-only** (screenshots/video/trace only for failed tests); `report.json` lists ALL tests. **No evidence toggle in the dialog** — report mode always on for console-dispatched runs | Operator-locked 2026-07-02 (report-plan journal). Cheap metadata always; heavy artifacts only where needed |
| L8 | Report viewing = **in-console** `/report/:githubRunId` (fold-in locked by parallel journal); **suite tabs** added for matrix runs (D1) | Same origin/auth/project; dashboard superseded |
| L9 | **D1**: `cicd-audit` doc id = `<runId>__<suite>`; Storage prefix = `cicd-reports-development/<repo>/<runId>/<suite>/`; report screen queries `where('githubRunId'==)` → tabs | Matrix runs share one GitHub run id; keys must be per (run, suite) or uploads collide |
| L10 | **D2**: candidate keeps the single overall `gateRun` badge; **per-suite chips** on cards come from a `cicd-audit` query keyed by `gateRun.reportRunId` | `workflow_run` webhook fires once per run (not per job); per-suite truth lives in the ledger the console now reads anyway |
| L11 | **D3**: manifest carries per-suite **`capture: 'failure-only' \| 'all'`** (default failure-only) | Resolves the report-plan's open queue/journey question without a fork |
| L12 | Manifest supports **`alwaysRun`** baseline suites (invariants/self-tests) and optional per-suite **`areas`** (sub-routing with `only` subsets) | Preserves the existing preview-gate behaviors (baseline always; studio/operator/big area routing) |
| L13 | CF: **no console deploy button; no PR-time CI gate**. The ONLY CF quality gate = **local predeploy Playwright loop-guard** (replaces `predeploy-check.js`) | Matches how CF devs actually work (deploy to starlabs-test first, then push). Operator design |
| L14 | CF predeploy v1 = ONE generic test: **no-retrigger-loop guard** — seed each Firestore-trigger path, assert bounded invocations (threshold, not zero-tolerance) | The production disaster is unbounded self-retriggering (quota/billing). Manifest-driven ⇒ future functions covered automatically |
| L15 | CF deploy visibility: **postdeploy hook → `recordCfDeploy`** (primary — fires on EVERY deploy incl. manual "deployed but not pushed"); **`reconcilePoll` CF-Admin-API check** (healer); `workflow_run` (bonus) | The git-anchored signals miss manual laptop deploys — the exact case the operator flagged |
| L16 | Env map: `starlabs-test` = **Dev**, `fir-sample-aae4a` = **Prod**. CF prod deploy = manual dev deploy too (same hooks) | Consistent with "developers deploy CF" |
| L17 | **CF Board** screen (dev + admin only): Branches tab + per-function Dev/Prod matrix tab. **No report links** — the CF gate runs locally, never in CI | The matrix answers "all CF: both or only one?" at a glance |
| L18 | `createPullRequest` precondition for CF-type repos: **branch pushed + not merged** (no sign-off/status gate) | CF flow has no tester-gate stage; quality gate already ran at predeploy |
| L19 | Δfunctions = `compare(production...branch)` file diff mapped via a committed **`functions-manifest.json`** (name/type/file); counts shown as `~N` (honest approximation) | GitHub diffs files, not functions; the manifest gives names + trigger types for the expandable panel |
| L20 | Repo registry (`core/repos.ts` + config) drives all repo/branch pickers | Future Angular/CF repos = registry entries, no redesign |
| L21 | `web-e2e.yml` gains **`cf_repo`** input (next to existing `cf_branch`) | Future CF repos |
| L22 | CF repo gets a ~15-line **manifest-freshness** CI check (regenerate + `git diff --exit-code`) | Keeps CF Board data trustworthy |
| L23 | **Option A (locked 2026-07-03):** `cf-functions` docs carry SERVER-DERIVED `state` (`both/dev-only/prod-only/none`) + `drift`, written by recordCfDeploy + the reconcile healer; clients read, never re-derive (fallback only for pre-A docs). Option B (`envs` map keyed by project id) parked until a 3rd Firebase project exists | Board filters/chips become plain queries; enables future drift alerting; one derivation source (`computeCfMatrixState`) |

---

## 3. The Suites Manifest (keystone)

**File:** `suites-manifest.json` (hub repo root). **Mirror:** `console-config/suites` (Firestore, read-only).

```jsonc
{
  "version": 1,
  "suites": {
    "queue": {
      "title": "Queue lifecycle",
      "description": "ATC queue create/join/serve/close — the core product flow.",
      "config": "playwright.queue.emulator.config.ts",
      "specDir": "queue/",
      "appPaths": ["src/app/queue/**", "src/app/atc/**"],   // app-repo globs → MANDATORY when matched
      "cfPaths":  ["functions/components/queue*.js"],        // CF-repo globs (CF change ⇒ mandatory)
      "areas": { "studio": ["queue/studio*.spec.ts"], "operator": ["queue/operator*.spec.ts"] }, // optional sub-routing
      "capture": "all",            // L11 — queue/journey may keep per-pass screenshots
      "ciReady": true
    },
    "invariants": { "alwaysRun": true, "capture": "failure-only", "...": "..." },
    "journey": { "...": "..." }, "business": { "...": "..." }, "comms": { "...": "..." },
    "content": { "...": "..." }, "evomap": { "...": "..." }, "modes": { "...": "..." },
    "authroles": { "...": "..." }, "workshops": { "...": "..." },
    "appointments": { "ciReady": false, "note": "local-only — no emulator config yet" }
  },
  "cfPredeploy": {
    "description": "Specs the CF predeploy hook runs locally before firebase deploy",
    "specs": ["cf-guards/no-retrigger-loop.spec.ts"]
  }
}
```

**Consumers:** ① console `planTestRun` (compare + globs → `{mandatory[+reasons], optional}` for the dialog);
② the gate workflow (explicit `suites` input from dispatch; **fallback self-routing** via the same manifest
when triggered without input); ③ CF predeploy hook (`cfPredeploy.specs`).
**Doc:** `scripts/gen-suites-doc.mjs` → `SUITES.md` (generated, never hand-edited).
**Mirror:** `.github/workflows/mirror-suites.yml` (hub, on push-to-main) → POST `recordSuitesManifest`
(`CONSOLE_INGEST_TOKEN` bearer, same pattern as `recordPreviewUrl`). One-way: rules allow member READ, write false
(only Admin SDK writes).

---

## 4. Work breakdown per system

### 4.1 HUB — `starlabs-e2e-tests` @ `main` (local: `/Users/m1/Documents/starlabs-e2e-tests`)

**Engine + manifest**
- `suites-manifest.json` (NEW — §3) · `scripts/gen-suites-doc.mjs` → `SUITES.md` (NEW)
- `.github/workflows/mirror-suites.yml` (NEW — L1)
- `.github/workflows/web-e2e.yml` — add `cf_repo` input (L21); report-mode env
- `scripts/run-isolated.sh` — produce **`report.json`** (second `merge-reports --reporter=json` over blobs; report-plan Phase 0)
- `scripts/history/record-run.cjs` — doc id `<runId>__<suite>`, Storage prefix `<repo>/<runId>/<suite>/`, upload `report.json` (L9)
- Emulator report configs — failure-only capture variants per manifest `capture` (L7/L11)
- `cf-guards/no-retrigger-loop.spec.ts` (NEW — L14) + `scripts/cf-predeploy.sh` + `scripts/cf-postdeploy-report.sh` (NEW — called by the CF repo's hooks)

**Console backend (`console/functions/src/`)**
- NEW callables/ingest: `planTestRun` · `runTests` · `recordSuitesManifest` · `recordCfDeploy` · `listCfBranches`
- `deployPreview` → accepts `{runTests, suites[], cfRepo, cfBranch}`; with-tests path dispatches the gate with JSON suites (L2/L5)
- `createPullRequest` — repo-type-aware precondition (L18)
- `reconcilePoll` — CF-Admin-API matrix healer (L15)
- `model.ts` — activity types `cf_deploy`, new collections `cf-functions/{name}`, `console-config/suites`
- `console/firestore.rules` — `console-config/suites` (member read / write false), `cf-functions` (member read / write false); `cicd-audit` rule exists from 2026-07-01 (deploy pending)
- `console/storage.rules` — exists from 2026-07-01 (deploy pending)

**Console frontend (`console/src/app/`)** — all components via `ng g c` (repo convention)
- `shared/test-run-dialog/` (+ service, `confirm.service` pattern) — L4/L5/L7 (no evidence toggle)
- `screens/report/` + route `/report/:githubRunId` — suite tabs (L8/L9), summary bar, spec-file tree, failure drawer (error/screenshot/video/trace); `reportUrlFor` → internal route; `historyDashboardUrl` removed
- `screens/cf-board/` — Branches tab + Functions matrix tab (L17/L19), role-gated dev+admin
- Working Branches: `Deploy ▾` split menu + `[Run tests…]`; Preview Channels: `[Run tests…]` + report block; Release Channel: `[Run tests…]` on dev+prod; ALL cards: per-suite chips (L10) + `[▶ View report]` + "No test done on this build" / stale states
- Overview: same `gateRun` badge + View report (passive)
- `core/repos.ts` registry (L20) · `core/firebase.service.ts` — `auditRun(githubRunId)` (query), `reportJson(run)`, `artifactUrl(gsPath)`
- `mock-data.ts` — cf-functions fixtures, multi-suite audit fixtures, report.json fixture
- `CLAUDE.md` refresh (still documents the old `board/` layout)

### 4.2 ANGULAR — `starlabs-angular` @ `development` (NOT checked out — add before Phase 4)
- `preview-e2e.yml` EVOLVES (not replaced): keep `workflow_dispatch` (fired by `deployPreview`); add `suites` (JSON array) + `cf_repo`/`cf_branch` inputs → matrix `fromJson(inputs.suites)`; move the embedded area→spec map into the hub manifest; keep dorny/paths-filter **as the fallback** when `suites` is empty; keep baseline `alwaysRun` behavior (L12)
- `E2E.md` — the folder-layout ↔ manifest-glob contract

### 4.3 CF — `starlabs-cloud-function` @ `development` (NOT checked out — add before Phase 5)
- `firebase.json`: `predeploy` → hub `scripts/cf-predeploy.sh` (loop-guard; replaces `predeploy-check.js`); `postdeploy` → hub `scripts/cf-postdeploy-report.sh` (POST `recordCfDeploy`; token from gitignored `.env.local`)
- `npm run manifest` — exports scanner → `functions-manifest.json` (committed; auto-regenerated inside predeploy) (L19)
- `.github/workflows/manifest-check.yml` — freshness check (L22)

### 4.4 FIRESTORE / STORAGE — `starlabs-cicd` (deployed from hub)
- Collections: `console-config/suites` (mirror) · `cf-functions/{name}` (matrix) · `cicd-audit/<runId>__<suite>` (ledger)
- Storage: `cicd-reports-development/<repo>/<runId>/<suite>/` — `report.json` + failure artifacts
- Deploy: `firebase deploy --only firestore:rules,storage,functions --project starlabs-cicd` (operator)

---

## 5. Scenarios (acceptance walkthroughs)

- **S1** Deploy w/o tests → preview only; card + tester see "⚠ No test done on this build".
- **S2** Deploy with tests → dialog (locked suites + reasons, optional adds, CF picker) → `preview.yml` + gate matrix → per-suite chips + `[View report]`.
- **S3** Tester: preview link + report → `OK for dev` / `Has issues` (+note).
- **S4** Tester/dev manual `[Run tests…]` → same dialog, test-only dispatch.
- **S5** Admin system test on development/production (ref fixed to the entry; CF chosen).
- **S6** CF dev: local deploy → predeploy guard ✋/✅ → postdeploy → matrix DEV ✓ → push → Branches tab (~N fns, expandable names+types) → `Create PR → Dev` → merge → prod deploy → DEV ✓ PROD ✓ (+DRIFT/ORPHANED honesty badges).
- **S7** Manifest edit → hub PR → merge → mirror → dialog catalogue refreshes everywhere.
- **S8** Any `[View report]` → `/report/:runId` → suite tabs → full test list (`report.json`) → failure drawer (screenshot/video/trace).

ASCII wireframes for every screen + the architecture "building" diagram: captured in chat 2026-07-02 and summarized in the session journal.

---

## 6. Build order (phases; 1–3 are hub-local and immediately startable)

| Phase | What | Depends on |
|---|---|---|
| **1 — Manifest + producer (hub)** | `suites-manifest.json` + `SUITES.md` gen; `report.json` producer; per-(run,suite) keys in `record-run.cjs`; failure-only capture configs; `mirror-suites.yml`; loop-guard spec + CF hook scripts | nothing |
| **2 — Console backend (hub)** | New callables/ingest; `deployPreview` params; CF PR precondition; model/rules; `reconcilePoll` healer | Phase 1 (manifest shape) |
| **3 — Console frontend (hub)** | Dialog; Report screen; CF Board; buttons/chips/badges; repos.ts; mocks (mock-mode first — testable without live backend) | Phase 2 (models), mocks earlier |
| **4 — Angular repo** | `preview-e2e.yml` evolution; `E2E.md` | repo access; Phases 1–2 |
| **5 — CF repo** | hooks; manifest generator; freshness check | repo access; Phase 1 |
| **6 — Operator + go-live** | deploy rules+functions; token distribution; `appPaths` sanity check; end-to-end proof (S1–S8) | all |

## 7. Operator checklist (cannot be automated)
1. Add `starlabs-angular` + `starlabs-cloud-function` checkouts/access for Phases 4–5.
2. Distribute `CONSOLE_INGEST_TOKEN` to CF developers' `.env.local`.
3. Deploy rules + new functions to `starlabs-cicd` (incl. the 2026-07-01 rule files).
4. Sanity-check drafted `appPaths` globs per suite (one review pass).
5. GCP read credentials for `reconcilePoll`'s CF-Admin-API check (both projects).
6. (When defined) supply additional CF predeploy test cases beyond the loop-guard.

## 8. Deferred / out of scope
- **Flutter** — parked in its own plan (parallel session).
- **CF selective deploy** (changed/deleted-only reconcile) — v2; v1 is whatever the dev deploys.
- **Phase 4 of the report plan** (publish raw Playwright HTML to Hosting) — later, native screen first.
- Flutter production path; CF deploy CI credentials (moot while CF deploys stay manual).
