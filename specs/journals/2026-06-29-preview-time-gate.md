# 2026-06-29 — Preview-time test gate (E2E moves from PR-creation to preview/build)

**Status:** Implemented. **Author:** session (operator: appexperience@soexcellence.com).
**Companion ADR:** ADR-001 (this session). Plans tell WHAT; this tells WHY.

## Problem

The tester's "OK for dev" sign-off happens on the **Preview Channel** card — which is *before*
any PR exists. But the only E2E gate ran on **PR creation** (`queue-e2e.yml`, `on: pull_request`).
So the tester signed off with **no test report in front of them**. The report arrived later, on the
PR, after the human decision it was supposed to inform.

## Decision

Run the same hermetic suite at **preview/build time**, attach the report to the branch (SHA-stamped),
and surface it on all three console screens so the tester reads it at sign-off.

### Why hermetic (not against the live preview URL)
The gate boots a Firebase **emulator** + real CF triggers and runs against `localhost:4200`
(`web-e2e.yml`). The preview URL is a live `breakthroughs-test` channel. We test the **branch's code
for a SHA**, not the deployed channel — keeping the per-spec reseed/isolation `run-isolated.sh`
depends on. The preview URL and the report describe the **same SHA** but are **different artifacts**.

### Why DEPLOY-triggered (NOT push) — corrected
A first cut triggered the gate `on: push` (to get native `paths:` filtering). **The operator rejected
this:** the test must run on the deliberate **preview deploy**, not on every push. Corrected design
(locked 2026-06-29): `preview-e2e.yml` triggers on **`workflow_dispatch`**, fired by the console's
`deployPreview` callable — the SAME callable that dispatches `preview.yml`. **One deploy ⇒ two runs**
(`preview.yml` builds the channel + `preview-e2e.yml` runs the gate). Backend: `deployPreview` now
makes a second, best-effort `createWorkflowDispatch` for `preview-e2e.yml` (a gate-dispatch hiccup
must never fail the build). Native `paths:` filtering is irrelevant here because routing is done by
`dorny/paths-filter` against `base: development` (below), not by the trigger.

> Process note: the push trigger was an **unrequested improvisation**. Going forward, stick to agreed
> decisions and confirm any deviation before locking it (saved to memory: `confirm-before-improvising`).

### Paths: run/skip gate AND (revision) area routing
Initially: paths decided only **whether** to run; a match ran the FULL suite.

**Revision (same day, operator request):** route by path to a per-area suite. `preview-e2e.yml` now
has a `dorny/paths-filter` `changes` job → per-area caller jobs (`studio` / `operator` / `big`), each
calling `web-e2e.yml` with that area's `only` subset. The filter diffs **`base: development`** (the
full feature-branch diff vs its merge-base), NOT the last push — a preview deploy ships the cumulative
branch, so routing must see every area the branch touched since it forked (regardless of how many
commits/pushes). **Narrow map, broad fallback** keeps sign-off
honest: we skip a suite only when confident the change can't affect it; a CROSS-CUTTING change
(guard, `package.json`, `angular.json`, queue-system root `*.ts`, the workflow) OR a queue change in
an UNMAPPED sub-area runs the FULL suite. The cheap logic self-tests (invariants/loop-bound/oracle)
run with EVERY area as a baseline. Manual dispatch = deliberate full (or explicit `only`).
The area→spec map lives in `preview-e2e.yml` and must be kept in sync as queue sub-dirs are added —
if a new sub-dir isn't mapped, A6's fallback runs the full suite (safe, just slower).

### Why reuse `gateRun` instead of new `preview.gate` fields
`handleWorkflowRun`'s `isGate` path already writes `c.gateRun`; Working Branches already renders it.
Adding parallel facets was redundant. Changes made instead:
- `GateRunFacet.stage` gained `'preview'`; a gate with **no open PR** is now stamped `stage:'preview'`
  (it *is* the preview-time gate) rather than `undefined`.
- `GateRunFacet.sha` added — ties the report to the build; UI flags it stale when `sha ≠ headSha`.
- The protected-branch early-return in `handleWorkflowRun` was relaxed from `!isDeploy` to
  `!isDeploy && !isGate`, so a gate on `development` (the dev→prod batch) records on the development
  candidate → shown on the **Release Channel**. Preview runs on protected branches are still skipped.

### Requirement "new build ⇒ block Create PR even if previously approved" — already enforced
`signoff` binds `gate.sha = headSha`; `createPullRequest` rejects when `devGate.sha ≠ headSha`
("Dev sign-off is stale"). A new push advances `headSha`, so the server fence already blocks it. No
new gating logic was needed — only the UI now shows the stale state (Preview Channels `gateStale`).

## Surfaces touched
- `starlabs-angular/.github/workflows/preview-e2e.yml` — NEW thin caller (push + paths, full suite).
- hub `web-e2e.yml` — new `stage` input → `record-run.cjs STAGE` (`gate` vs `preview-gate`).
- `console/functions/model.ts` — `GateRunFacet.stage += 'preview'`, `+ sha`.
- `console/functions/index.ts` — preview-stage + sha stamping; protected gate recorded.
- frontend `release-candidate.model.ts` — mirror.
- frontend Preview Channels (.ts/.html/.css) — Test suite block above the DEV gate + stale flag.
- frontend Release Channel (.html) — batch test-suite badge + report link on the development entry.
- `mock-data.ts` — preview-stage gate runs so all three screens demo in mock mode.

## Verified
- `tsc --noEmit` on `console/functions` → clean.
- `ng serve` → clean build; Preview Channels renders the Test suite block (PASSED + "View report ↗")
  directly above "OK for dev"; Release Channel shows "test suite passed" + report on the dev entry.
  (Verified in `useMock:true`, then reverted to `useMock:false` — live config untouched.)

## Pending / watch
- **Merge guard is off.** `queue-e2e.yml` was set to `branches: []` (operator) → the PR gate is
  dormant; the preview gate is the only gate. Safe *as long as* a new push invalidates the sign-off
  (it does). Re-enable by un-emptying `branches:` if a belt-and-suspenders merge check is wanted.
- **CI minutes.** Full suite per push (path-gated). If it bites, shard via an `only`-matrix in the
  caller, or move to SHA-reuse (ADR-001 Option C).
- `preview-e2e.yml` lives in the `starlabs-angular` repo — commit/push it there to activate.
