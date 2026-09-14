# Journal — 2026-07-04: Release Console "Gate Runs" view + gate cutover audit

> Two workstreams resumed in a fresh context. **A** = surface the saved CI reports in the Release
> Console frontend (DONE, code landed). **B** = audit the gate + plan the cutover to
> development/production (AUDITED; cutover itself is operator-gated and NOT executed this session).
> First act was to **verify current state from git** rather than trust the docs — which paid off:
> the state is well ahead of `docs/SYSTEMS-ROLLOUT-STATUS.md` (2026-06-30, now stale).

---

## 0. Verified state (git, both repos, 2026-07-04) — CORRECTS the stale STATUS doc

`git fetch --all` on both repos, then read logs/branches. Findings that differ from the 06-30 doc:

- **Hub `starlabs-e2e-tests`: `systems-emulator` is FULLY MERGED into `main`.** `origin/main..origin/systems-emulator` = 0 commits; main is 13 ahead. Merges #3–#7 landed (appointments, profiles, events v1/v2 skip, modes index) plus new **"Integrate CF"** work (`ca1ee62`). So **all 10 systems' engines are on hub `main`.** (My local hub checkout was on `systems-emulator`, behind origin — origin/main is the truth.)
- **App `starlabs-angular`: `feature/cicd-rollout` is the team's INTEGRATION branch**, not a pure CI-config branch. It = `development` + all the caller work + product features (sales-numbers, eiflix-telemetry, workshop-config…). It flows into `development` via operator PRs (saw "Release: feature/cicd-rollout → development (#35)"). It lives on the **app** origin only (not the hub).
- **All 11 callers (queue + 10 systems) are already pinned `@main`** (`uses:` + `e2e_ref: main`) on every relevant branch (cicd-dev, feature/cicd-rollout, development, production). **Nothing left to flip off `@systems-emulator`** — Workstream B step 1's "flip any still on @systems-emulator" is already done by prior sessions.
- Callers currently trigger `on.pull_request.branches: [cicd-dev, cicd-prod]` (report-only). `queue-e2e.yml` on the integration/protected branches shows an anomalous `branches: []`.

**Net:** all 10 systems ported + engines on main + callers on `@main`. The one remaining thing is the **cutover** (below). Memory updated: `cicd-rollout-state-2026-07-04`.

---

## Workstream A — "Gate Runs" read-only view (DONE)

**Goal:** list recent gate runs from Firestore `cicd-audit` (repo, suite, branch, result, author, time)
and link each to its browsable Playwright report in Cloud Storage. Read-only; no writes.

### Schema first (matched the recorder, not assumptions)
Read `scripts/history/record-run.cjs` + the `web-e2e.yml` "Record run in append-only history" step +
`docs/2026-06-29-screenshot-reports-to-firestore-storage.md`. The `cicd-audit/<runId>` doc is:
```
{ runId, repo, suite, stage, branch, sha, author, source(ci|local), result(pass|fail|unknown),
  githubRunId, createdAt(ISO string), runUrl,
  storage: { base:'gs://<bucket>/<prefix>/<repo>/<runId>', report:[gs://…], attachments:[gs://…] } }
```
where in CI `bucket = starlabs-cicd.firebasestorage.app`, `prefix = cicd-reports-development`.
**Important reality check:** the recorder persists a single pass/fail **verdict** (`result`), NOT
per-spec pass/fail **counts** — those live inside the Playwright report. The view surfaces the verdict
and links to the report for the breakdown (documented in the UI + component doc).

### Files
- `console/src/app/core/gate-run.model.ts` (NEW) — `GateRun` interface mirroring the doc + helpers:
  `shortRepo`, `shortSha`, `resultTone`, and **`reportIndexUrl(run)`**.
  - **Report browsability decision:** use the **path-style** `https://storage.googleapis.com/<bucket>/<object>/report/index.html`, NOT the firebasestorage download API (`/o/<url-encoded>?alt=media`). Playwright's HTML report references screenshots/traces via **relative** `data/…` paths, which only resolve at a real directory URL; the download API flattens the path and breaks them. Path-style requires the report objects to be publicly readable — if they're not, the link 403s and the row still offers the GitHub **run ↗** link (always available). Returns null when `storage.report` is empty (Storage-upload-failed / Firestore-only record) → row shows "no report".
- `console/src/app/core/firebase.service.ts` — added `gateRuns(max=100)`: LIVE = `collectionData(query(collection('cicd-audit'), orderBy('createdAt','desc'), limit(max)), {idField:'id'})`; MOCK = sorted fixtures. Reuses the existing `Firestore` injection + `useMock` pattern (no new providers). Imported `limit`.
- `console/src/app/core/mock-data.ts` — added `MOCK_GATE_RUNS` (8 realistic runs incl. a fail and a Firestore-only/no-report row) using the real bucket/prefix so `reportIndexUrl` is exercised. Deterministic (no `Math.random`).
- `console/src/app/screens/gate-runs/gate-runs.component.{ts,html,css}` (NEW) — read-only table: result pill, suite, repo, branch, commit, author, time, and **report ↗ / run ↗** links. Client-side filters (repo/suite/result) over the loaded page + a pass/fail summary strip. Standalone component, `DatePipe` only.
- `console/src/app/app.routes.ts` — added lazy `gate-runs` route.
- `console/src/app/app.component.ts` — added a `Gate Runs` nav item (visible to all signed-in users).

### Convention note
CLAUDE.md says scaffold components via `ng generate`. `console/node_modules` was absent (offline), so
the CLI couldn't run without a full install first. The new component is hand-created but **matches the
schematic output + existing `screens/*` convention exactly**: folder-per-component, separate
`.ts`/`.html`/`.css` (`templateUrl`/`styleUrl`, no inline template/styles), `css`, no `.spec.ts`,
`rc-`-prefixed selector. Build verification: ran `npm install --legacy-peer-deps` then a production
build — see "Build check" below.

---

## Workstream B — gate audit + cutover plan (AUDITED; cutover NOT executed — operator-gated)

### Trigger chain (end-to-end, hub `main`)
1. App caller `<sys>-e2e.yml` fires on `pull_request` (base ∈ its `branches:` filter) + path filter,
   skipping draft PRs unless labeled `run-e2e`.
2. It calls `uses: School-of-Excellence/starlabs-e2e-tests/.github/workflows/web-e2e.yml@main` with
   `secrets: inherit` (needs `REPO_PAT`; `STARLABS_CICD_SA` optional for history).
3. `web-e2e.yml` (reusable) assembles 3 repos (app @ root, hub → `./e2e`, cloud-function →
   `./starlabs-cloud-function`), overlays emulator config, boots emulator+CF, serves the app on :4200,
   runs `scripts/run-isolated.sh` (exit code = # failing spec files = **the gate**), uploads the
   report artifact, and records the run to `cicd-audit` + Storage (best-effort, never reds the gate).

### Confirmed
- **All callers pinned `@main`** (verified across cicd-dev / feature-cicd-rollout / development / production). No `@systems-emulator` pins remain.
- **All report-only** (non-required) today; triggers `[cicd-dev, cicd-prod]`.

### THE CUTOVER (remaining goal — operator-gated, NOT done this session)
Per-caller diff (identical shape for all 11), to land on **`development` + `production`** (a
`pull_request` gate runs the **base branch's** copy of the workflow, so the trigger edit must exist on
the branches being protected):
```diff
 on:
   pull_request:
-    branches: [cicd-dev, cicd-prod]   # sudo branches …
+    branches: [development, production]
```
Then: keep green **N runs** report-only on real dev/prod PRs → promote to **REQUIRED** status checks on
`development` + `production` (joint cutover with queue/journey, which are the reference live gates).

**Why I did not execute it:** hard rules — protected branches (`development`/`production`/`cicd-*`)
take **operator-approved PRs only**, no direct pushes; `gh` CLI is not installed (GitHub web UI via
Chrome MCP only). Opening the report-only test PRs and the cutover PRs is an interactive, operator-
gated step. Prepared the exact diffs above; awaiting operator go-ahead on sequencing.

**Rollback:** revert the caller's `branches:` back to `[cicd-dev, cicd-prod]` (or drop the required
status check in branch protection) — the gate returns to report-only with no engine change, since the
engine on `@main` is unchanged by the cutover. The history recorder is best-effort and can't red a gate.

### Open items / anomalies to resolve before cutover
- `queue-e2e.yml` shows `branches: []` on feature-cicd-rollout/development/production (empty ⇒ the
  pull_request trigger matches nothing there). Confirm whether queue is genuinely live on
  `development` via another mechanism, or if this `[]` is a half-applied edit to fix during cutover.
- `branch-guard.yml` exists on `cicd-dev` but not on `feature/cicd-rollout` — governance divergence to
  reconcile with the team's branch strategy.

---

## Build check — PASSED
`npm install --legacy-peer-deps` in `console/` (node_modules was absent), then `npm run build`
(`ng build`, production). **Exit 0 — clean**, emitting a new lazy `gate-runs-component` chunk
(~9.9 kB raw). Two errors surfaced and were fixed first:
1. A JSDoc comment in `gate-run.model.ts` contained the literal `--st-*/`, whose `*/` closed the block
   comment early → parser error. Reworded to avoid `*/` inside a comment.
2. `src/environments/firebase.config.ts` (gitignored, operator-supplied) was absent, which breaks ANY
   build here — pre-existing, unrelated to this change. Temporarily copied the example to typecheck,
   then **removed it** to restore the exact working-tree state. Nothing gitignored was committed.

Left the working tree as: 4 modified + 2 new (component folder + model) under `console/`, plus this
journal. `node_modules/` and `dist/` are gitignored / removed.

## Pending / next session
- Operator decision on cutover sequencing; then open report-only PRs (Chrome MCP) → prove green N runs
  → promote to required (joint with queue/journey).
- Resolve the `queue-e2e.yml branches: []` anomaly + branch-guard divergence.
- Optional: set `environment.historyDashboardUrl` if the Gate Runs screen gets a stable deployed URL
  (the existing `reportUrlFor` deep-links there by `githubRunId`).
- Per-suite `ATTACH` for the recorder (currently queue fixtures, best-effort).
