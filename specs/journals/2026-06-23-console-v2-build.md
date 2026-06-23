# Journal — Console v2 build (foundation + fan-out)

**Date:** 2026-06-23
**Plan:** `specs/plans/2026-06-22-console-v2-architecture.md` (12 locked decisions)
**Outcome:** Console v2 implemented end-to-end; both builds green; all 4 screens verified in-browser (mock mode).

## What was done

Foundation (built sequentially, by hand — safety-critical):
- `src/app/core/roles.ts` (new) — Role/Capability matrix, Member, helpers (D1).
- `src/app/core/release-candidate.model.ts` — facet model, 10 statuses, activity-log + reconcile types, staleness helpers (D6/D7/D8).
- `functions/src/model.ts` — backend mirror.
- `firestore.rules` (new) + `firebase.json` wire — domain + active-member + role rules; all workflow writes server-only (D2).
- `src/app/core/auth.service.ts` — 3-check login gate + capability helpers; mock-mode auto-authorizes a full-capability member for offline clickability.

Fan-out (4 parallel agents, disjoint ownership):
- **Backend** — `functions/src/index.ts` rewrite + `projection.ts`, `candidate.ts`, `activity.ts`. webhookReceiver (HMAC, dedupe by delivery-id, eventTime ordering, facet mutation, projection, reconcile taxonomy, PR `synchronize`, push no-op fix); callables `deployPreview`/`signoff`/`createPullRequest`(+server state check)/`setMember`/`reconcileDecision`; `onMembersWrite`→allowlists; scheduled `reconcilePoll` stub. **approveAndMerge removed (D3).**
- **Frontend core** — `firebase.service.ts` (facet reads + activity-log + callables, mock-aware), `action-gating.ts`, `status-meta.ts`, `mock-data.ts` (11 candidates + activity + members).
- **UI/shell** — routed shell with role-gated nav + login gate; Overview / Working Branches / Preview Channels / Settings; shared filter bar + status chip + toast. Old `board/` deleted.
- **Angular repo** — `preview.yml` push trigger disabled, `workflow_dispatch` (ref input) added (C1/D5).

Integration pass (by hand): standardized the members path on the only valid form
`console-config/members/items/{email}` (the plan's literal 3-segment path is an invalid
Firestore doc path) across auth.service, firebase.service, firestore.rules; added 5 facet
status CSS tokens to `styles.css`.

## Verification
- `ng build` ✓ (4 lazy screens), `functions tsc` ✓.
- Ran dev server in mock mode: Overview (mission control, funnel, deploy health, activity),
  Working Branches (facet badges + correct action gating — Deploy preview enabled, Create PR
  disabled until state/freshness allow), Settings (members + role checkboxes), all render with
  zero console errors. "503/5 tests" is a correct sum across branches, not a bug.
- Restored `environment.useMock = false` after verification.

## Surprised / notes
- The plan's `console-config/members/{email}` path is invalid in Firestore — corrected to
  `…/members/items/{email}`. Update the operator seed step accordingly.
- Backend detects the e2e gate via a `name.includes('e2e')` heuristic on workflow_run —
  confirm the real gate workflow name (`queue-e2e.yml`) and tighten.
- `reconcilePoll` is a scheduled stub (TODO: GitHub backfill) — risk #3 mitigation is wired
  but not implemented.

## Pending (operator / next session)
- Operator: register GitHub App (push, pull_request incl synchronize, workflow_run); seed
  `console-config/members/items/*`; deploy firestore.rules + composite indexes; fill
  `firebase.config.ts`; set function secrets/env.
- Angular C2 cutover (queue-e2e branches cicd-* → development/production) at go-live.
- Branch protection: PAUSED (free plan, D11) — enable on paid upgrade.
- Implement `reconcilePoll` backfill; tighten gate-workflow detection.
