# Journal — Release Channel + workflow refinements (session wrap)

**Date:** 2026-06-26
**Repo:** starlabs-e2e-tests (console)
**Plan/ADR:** specs/plans/2026-06-26-release-channel-adr.md (ACCEPTED)
**Test reports:** specs/journals/2026-06-26-release-channel-test-report.md (Rounds 1 & 2)
**Outcome:** Implemented, mock-tested (incl. a faithful merge simulation), and **DEPLOYED** to
`starlabs-cicd` (functions + hosting → https://cicdconsole.web.app).

## What was done
- **Release Channel** (new, admin-only screen, scaffolded via `ng g c`): batch cockpit — incoming
  feature→dev PRs + test suites (review/merge on GitHub), the promotion BATCH (D2), and the single
  Create-PR-to-prod. Working Branches trimmed to feature-only.
- **D1** — `CREATE_PR_PROD` made admin-only (roles.ts + model.ts); promotion lives only on the
  Release Channel. Enforced at 4 layers (nav · route guard · component · backend capability).
- **D2** — promotion batch = feature PRs merged since the last prod release, via an `unreleased`
  flag, with `hasUnreleased` kept authoritative by a reconcilePoll GitHub `production…development`
  diff backfill.
- **D3** — fixed environment URLs in `environment.ts`: development `https://breakthroughs-test.web.app/`,
  production `https://breakthroughs.app/`.
- **Env-status bug** fixed: `covers()` projects environment candidates straight from facet state
  (they don't track a headSha), so dev/prod no longer collapse to NO_ACTION; feature auto-iterate kept.
- **Preview URL** fixed to `https://breakthroughs-test-<branchid>.web.app` (3 helpers) and now recorded
  from the preview `workflow_run: completed` webhook.
- **"Create PR → prod keeps coming"** fixed: `computePromotable = hasUnreleased && deploy✓ && tester✓`
  (was missing the "anything to promote" term, so it re-derived true after a release); prod-merge
  handler clears the flags + resets prodGate. Release Channel shows "✓ up to date — nothing to promote".
- **Preview Channels**: dev URL shown; release notes collapsed to latest + a "log" drawer.
- Removed the broken **"Mine only"** filter.
- Friendly **empty-diff** PR error (dev & prod).

## What was found / surprised
- The Round-1 report honestly flagged that webhook merges can't run in mock, but that left the
  POST-MERGE state untested — exactly where the "keeps coming" bug lived. Lesson: simulate the merge.
  Added `FirebaseService.mockMerge()` (mock-only) replicating the backend `handlePullRequest` MERGE
  path, so the full cycle (promote → merge → released → new merge → re-validate) is now driven in-browser.
- `mutateCandidate` recomputes `promotable` on every write, which silently overrode the handler's
  `promotable=false` — the root of the reappearing button. Deriving the gate from `hasUnreleased`
  (kept current from the GitHub diff) makes it self-healing.

## Verification (all green, zero console errors)
- Backend unit: env-status, auto-iterate preserved, D1 capability, promotable matrix incl. the
  prod-merge case (true→false), URL pattern. UI mock: nav/role-gating, Release Channel batch,
  promotion flow with a **simulated GitHub merge** → "nothing to promote" + batch cleared → re-cycle.
- `ng build` + functions `tsc` green. Deployed functions + hosting to starlabs-cicd.

## Pending (operator / next session)
- Confirm the live cycle once a real feature→dev→prod round runs against the deployed functions.
- `reconcilePoll` ramps `hasUnreleased` from the GitHub diff every 30 min — a stuck flag self-heals
  within a tick.
- `mockMerge` is mock-guarded and inert in production (test scaffolding only).
