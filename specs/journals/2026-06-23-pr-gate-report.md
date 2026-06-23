# Journal — PR gate report in Working Branches + cleanup

**Date:** 2026-06-23
**Plan:** extends `specs/plans/2026-06-22-console-v2-architecture.md`

## Firestore cleanup (starlabs-cicd `(default)`)
Deleted the git-mirror collections for a clean start: `release-candidates`,
`activity-log`, and the legacy `console-config/allowlists` doc. Preserved
`console-config/members/items` (login config) and `cicd-audit` (test history).
The new backend repopulates the mirror from webhooks.

## New feature — e2e gate report on the open PR
**Goal:** when a PR is open, show in Working Branches whether the e2e gate is
running/passed/failed + a report link, so a developer knows if it's safe to merge.

**Decision:** report link → cicd-audit dashboard, deep-linked by `githubRunId`
(user choice). Gate cutover deferred — `queue-e2e.yml` stays on cicd-dev/cicd-prod.

**Implemented:**
- Model (frontend + backend): `GateStatus` + `GateRunFacet` { stage, status,
  runId, runUrl, reportRunId, at } + `gateRun?` on ReleaseCandidate.
- Backend `handleWorkflowRun` (index.ts): the gate lane now sets `gateRun`
  (queued→QUEUED, in_progress→RUNNING, completed→PASSED/FAILED), with the GitHub
  run id + run URL; stage derived from the open PR. testSummary still set on completion.
- Frontend: `FirebaseService.reportUrlFor(rc)` → cicd-audit dashboard by githubRunId
  when `environment.historyDashboardUrl` is set, else the GitHub run page (always works).
- Working Branches UI: a "Test suite running…/passed/failed" row with pass count,
  a safe-to-merge / do-not-merge verdict, and a "View report ↗" link.
- mock-data: gateRun on two PR_TO_DEV candidates (PASSED + RUNNING).
- Hub: `record-run.cjs` now stores `githubRunId`; `web-e2e.yml` passes
  `GITHUB_RUN_ID` so the dashboard can resolve the console's run id.

**Verified (mock mode):** both builds green; DOM confirms cf-triggers → "passed
60/60 safe to merge", rate-limiter → "running…", links resolve to the GitHub run
page (dashboard URL unset). Zero console errors.

## Follow-ups
- Set `environment.historyDashboardUrl` to the deployed cicd-audit dashboard URL.
- Add `?githubRunId=` lookup support to the dashboard (dashboard/index.html) so the
  deep-link resolves to the rich Playwright report.
- Apply the same `GITHUB_RUN_ID` env to `cf-e2e.yml` / `flutter-e2e.yml` when those
  repos are onboarded.
- `environment.useMock` is currently `true` (left on for interactive validation) —
  flip to `false` for live.
