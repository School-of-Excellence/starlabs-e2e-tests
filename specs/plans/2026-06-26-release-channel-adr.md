# ADR-001: Release Channel admin cockpit + workflow refinements

**Status:** ACCEPTED (operator signed off D1/D2/D3 on 2026-06-26)
**Date:** 2026-06-26
**Deciders:** Operator (Vignesh)

## Locked decisions
- **D1 — Promotion authority:** `CREATE_PR_DEV` = developer (+admin), fired from Working Branches.
  `CREATE_PR_PROD` = **admin only**, fired from the Release Channel. Remove `CREATE_PR_PROD` from the
  `developer` role.
- **D2 — Batch:** the promotion batch = feature PRs **merged to `development` since the last
  production release** (in dev, not yet in prod). Cleared on `prod_merged`.
- **D3 — Environment URLs:** **fixed/configured** URLs for development and production (operator
  provides both); shown on the entries. Not derived from webhook payloads.
**Companion:** specs/plans/2026-06-24-promotion-chain-architecture.md, journals 2026-06-24/25

## Context
The promotion-chain console works (feature→dev, tester gate, dev→prod). Live use surfaced friction:
confusing PR errors, a `NO_ACTION` status bug on environment entries, and the admin lacking a
batch-oriented cockpit to review dev PRs and promote. Four refinements proposed. This ADR verifies
each is feasible, an optimization (not a constraint), and free of new loopholes.

## Decision (4 changes)
1. Keep "sync with development before pushing"; **rewrite the empty-diff PR error** to be clear.
2. **Fix the backend** so `development`/`production` derive a correct, current status.
3. New **admin-only "Release Channel"** screen: Development section (all dev PRs + test suites +
   batch + Create-PR-to-prod) and Production section (promotion PR state). Status/URL/last-deploy in both.
4. **Preview Channels**: show the development deploy URL for testers; collapse release notes to the
   latest (with time) + a "log" button → right drawer with full timestamped history.

## Feasibility & risk per item

| # | Feasible? | Optimization or constraint? | Loophole risk |
|---|---|---|---|
| 1 | ✅ trivial (rewrite GitHub's "No commits between…" in `createPullRequest` catch, or pre-check `compareCommits`) | Pure UX clarity; no downside | Apply the SAME friendly handling to the dev→prod PR (empty-diff possible there too) |
| 2 | ✅ ~5-line backend | Bug fix (status is currently wrong), not an optimization | Must not regress feature-branch head-awareness — fix is isolated to env candidates |
| 3 | ✅ all data exists in facets (incoming PRs, test suites, deploy, promotion PR) | Optimization — consolidates the admin's review→merge→promote loop; additive (new screen) | **3 decisions below** must be locked or it mis-leads |
| 4 | ✅ activity drawer already exists; dev URL needs a source | Optimization — declutter | Define what "release notes" = (activity log vs gate notes); dev URL source |

## 3 decisions to LOCK (these are the only places a new loophole could creep in)

**D1 — Promotion authority.** The matrix currently grants `CREATE_PR_PROD` to **developer AND admin**,
but Release Channel is admin-only. If promotion UI is admin-only while the capability stays on
developers, a developer could still promote via the callable directly (UI/permission mismatch).
→ **Recommend: make `CREATE_PR_PROD` admin-only** (drop from `developer`) so UI = capability = backend.

**D2 — Batch composition** ("these branches get merged when the prod PR is accepted"). Must be defined
as: feature PRs **merged to `development` after the last `prod_merged`** (i.e., what's in `development`
but not yet in `production`). Anchor on the last production-merge event / dev-vs-prod diff — NOT "all
merged PRs ever" (which would mislead).

**D3 — Development deploy URL source.** The dev environment URL (starlabs-test) is fixed/known, unlike
the random per-feature preview hashes. → capture `environment_url` from the `deployment_status`
payload, or set a configured constant. (Pick one; both are simple.)

## Consequences
- **Easier:** admin reviews + promotes from one cockpit; testers get a cleaner Preview screen +
  the dev URL; developers get actionable errors. The review→merge→promote loop accelerates.
- **Harder/changed:** promotion becomes admin-gated (D1) — intended; Working Branches becomes
  feature-only (dev/prod cockpit moves to Release Channel).
- **Revisit:** batch boundary (D2) once multiple repos promote independently.
- **Preserved invariants:** console never merges (admin merges on GH CLI; screen links out); GitHub
  is source of truth; tester double-gate (preview→dev, dev-deploy→promote) intact.

## No regressions / no missed loopholes (sweep)
- Console-merge principle (D3 from prior ADR) preserved — Release Channel links to GitHub, doesn't merge. ✅
- Status correctness (item 2) is a prerequisite for the Release Channel to display truthfully. ✅
- Empty-diff handling extended to BOTH dev and prod PRs (item 1). ✅
- Promotion authority aligned across UI/capability/backend (D1). ✅

## Action items (plan)
1. [ ] Confirm D1, D2, D3 with operator (alignment gate).
2. [ ] Backend: fix env-candidate status (item 2) + track/derive its head + deploy URL (D3).
3. [ ] Backend: friendly empty-diff message for dev & prod PRs (item 1).
4. [ ] Backend: align `CREATE_PR_PROD` to admin (D1, if chosen).
5. [ ] Frontend: build admin-only **Release Channel** route+nav (gate on `isAdmin`); Development +
       Production sections; move the promotion control here; Working Branches → feature-only.
6. [ ] Frontend: Preview Channels — dev URL + latest-note + log drawer (item 4).
7. [ ] Mock test the full matrix + the new screen; update the test report.
