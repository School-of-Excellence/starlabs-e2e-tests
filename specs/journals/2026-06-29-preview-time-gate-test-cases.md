# 2026-06-29 — Preview-time gate: test cases (manual)

How to validate the preview-time test gate. Two layers: **A. CI trigger/path behavior** (GitHub
Actions, needs a push to `starlabs-angular`) and **B. console report + sign-off** (UI, runnable in
`useMock:true` locally). Companion: [2026-06-29-preview-time-gate.md](2026-06-29-preview-time-gate.md).

Legend: **Given / When / Then**.

---

## A. Deploy trigger & PATH ROUTING (run in `starlabs-angular`)

> **Trigger = console "Deploy preview"** (NOT push). One deploy fires TWO runs: `preview.yml` (build)
> + `preview-e2e.yml` (gate). The gate's `changes` job diffs the **whole branch vs `development`**
> (`base: development`), then routes to per-area suites. Watch which JOBS run in the `preview-e2e` run
> (`studio` / `operator` / `big` / `full`). Setup: commit `preview-e2e.yml`; allow `dorny/paths-filter`
> in org Actions settings; deploy a preview from the console for the test branch.

### A1 — Studio-only branch → STUDIO suite only
- **Given** a branch whose only diff vs `development` is under `src/app/queue system/dynamic-studio/**`.
- **When** you Deploy preview from the console.
- **Then** `preview-e2e` runs; only the `studio` job runs (`studio-core`, `studio-session` +
  self-tests); `operator`, `big`, `full` are **skipped**. `cicd-audit` records `stage: preview-gate`.

### A2 — Operator-only branch → OPERATOR suite only
- **Given** the branch's only diff is under `src/app/queue system/dynamic-queue-manager/**`.
- **Then** only the `operator` job runs (`operator`, `selfmovable-gate`, `watch-videos`,
  `actors-health`, `authoring`, `cf-sideeffects` + self-tests).

### A3 — BIG-only branch → BIG suite only
- **Given** the branch's only diff is under `src/app/queue system/big-planner/**`.
- **Then** only the `big` job runs (`big-analytics`, `cross-db-lowerbound` + self-tests).

### A4 — Branch touches TWO areas → BOTH area suites run
- **Given** the branch diff vs `development` includes both `dynamic-studio/**` and `big-planner/**`.
- **Then** the `studio` AND `big` jobs run; `operator` and `full` skipped. The `preview-e2e` run is
  green only if both pass (so the console gate reflects both).

### A5 — Multi-commit / multi-developer branch → routes on the CUMULATIVE diff
- **Given** the branch has 3 commits from different developers: commit 1 touched `dynamic-studio/**`,
  commit 2 touched `big-planner/**`, commit 3 touched `queue-list/**` (operator).
- **When** you Deploy preview (regardless of how/when the commits were pushed).
- **Then** because `base: development` diffs the **whole branch**, all three areas are detected →
  `studio`, `big`, AND `operator` jobs all run. (This is the fix for "does it see 3 commits or just
  the latest" — it sees the full branch, not a single push.)

### A6 — Cross-cutting change → FULL suite (safety fallback)
- **Given** the branch changes ONLY `src/app/**.guard.ts` (or `package.json`, `angular.json`, a
  `queue system/*.ts` root file, or `preview-e2e.yml`).
- **Then** the `full` job runs the WHOLE suite; area jobs skipped. Cross-cutting changes affect all.

### A7 — Queue change in an UNMAPPED sub-area → FULL suite
- **Given** the branch changes a queue sub-area not in any filter, e.g. `queue-notes/**`,
  `queue-venue/**`, `zoom-account/**`.
- **Then** the `full` job runs (the `queue==true`, no-area-matched fallback) — never a silent skip.

### A8 — Deploy of a branch with NO queue-relevant diff → no suite runs
- **Given** the branch's only diff vs `development` is `README.md`.
- **When** you Deploy preview.
- **Then** `preview-e2e` dispatches but every suite job is skipped (nothing to test). KNOWN EDGE: the
  run is trivially green, so the console may show the gate `PASSED` with zero tests. (Acceptable —
  nothing queue changed; flag if you want a "no-op → N/A" state instead.)

### A9 — Manual debug dispatch with an explicit `only` skips routing
- **When** you **Run workflow** on `preview-e2e` with `only = queue/operator.spec.ts`.
- **Then** the `manual` job runs exactly that subset; `changes`/area/`full` jobs are skipped.

### A10 — Push alone does NOT run the gate
- **When** you push commits but do NOT deploy a preview.
- **Then** `preview-e2e` does **not** run (it's deploy-triggered, not push-triggered).

---

## B. Console report + sign-off (run in `useMock:true`, `npm start`)

> Flip `environment.useMock` to `true` for local UI testing, then revert to `false`. Mock data ships
> preview-stage gate runs on `feature/booking-redesign` and `development`.

### B1 — Report shows on the Preview Channel BEFORE sign-off
- **Given** Preview Channels, card `feature/booking-redesign` (PREVIEW LIVE).
- **Then** a **Test suite** row appears **above** the DEV gate: green dot, `passed`,
  `ALL CHECKS PASSED`, and a **View report ↗** link. (This is the report the tester reads at
  sign-off — the core goal.)

### B2 — FAIL renders as "do not sign off"
- **Given** a candidate whose `gateRun.status = 'FAILED'` (edit a mock entry, or a real failed run).
- **Then** the row shows a red dot, `failed`, and `CHECKS FAILED`. The tester can still see the
  report link to inspect.

### B3 — RUNNING state
- **Given** `gateRun.status = 'RUNNING'` (mock `feature/rate-limiter`).
- **Then** the row shows a pulsing dot + `running…` (no verdict pill yet).

### B4 — New build invalidates a prior sign-off (requirement #3)
- **Given** the tester clicked **OK for dev** on the current preview (devGate.sha == headSha).
- **When** a new commit is pushed (headSha advances; in mock, set `headSha` ≠ `devGate.sha`).
- **Then** (a) Preview Channels shows the DEV gate badge **stale vs HEAD**, and the Test suite row
  shows **stale — ran on `<sha>`**; (b) the **Create PR → dev** action is blocked. Server fence:
  `createPullRequest` throws *"Dev sign-off is stale (new commits since sign-off)."*

### B5 — Report is reachable on all THREE screens
- **Working Branches** — the `feature/cf-triggers` card shows the Test suite block (pre-existing).
- **Preview Channels** — `feature/booking-redesign` shows it above the DEV gate (B1).
- **Release Channel** — the **development** entry shows a `test suite passed` badge + `report ↗`
  (the dev→prod batch gate, now recorded on the protected candidate).

### B6 — Report link resolution
- **When** `environment.historyDashboardUrl` is unset.
- **Then** **View report ↗** points at the GitHub Actions run page (`…/actions/runs/<id>`).
- **When** it IS set → the link points at the cicd-audit dashboard by `reportRunId`.

---

## C. Backend webhook (integration, real or emulated payloads)

### C1 — Pre-PR gate is stamped `stage: 'preview'` and SHA-stamped
- **Given** a `workflow_run` event for a gate run on a feature branch with **no open PR**.
- **Then** `handleWorkflowRun` writes `gateRun.stage = 'preview'`, `gateRun.sha = head_sha`,
  `gateRun.status` per conclusion, and `gateRun.reportRunId = run.id`.

### C2 — Gate WITH an open PR still stamps `dev`/`prod`
- **Given** a gate run while `prDev.state === 'OPEN'`.
- **Then** `gateRun.stage = 'dev'` (regression guard — the PR-gate path is unchanged).

### C3 — Gate on `development` is now recorded (Release Channel)
- **Given** a `workflow_run` gate event on branch `development`.
- **Then** it is **not** dropped by the protected-branch early-return; `gateRun` is written on the
  `development` candidate. (Preview events on protected branches are still dropped.)
