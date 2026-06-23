# Journal — Console v2 backend rewrite (facets + activity log + reconciliation)

> 2026-06-23. Implements the LOCKED plan `specs/plans/2026-06-22-console-v2-architecture.md`
> §3-7. Scope: `console/functions/src/` only. Build verified with `tsc` (npm run build).

## What was done

Rewrote `console/functions/src/index.ts` and added three helper modules:
- `projection.ts` — pure `project(facets) → { derivedStatus, reconcile }`.
- `candidate.ts` — facet defaults, deterministic preview URL, read-modify-recompute-write.
- `activity.ts` — flat activity-log writes with delivery-id dedupe + undefined-stripping.

Functions exported now: `webhookReceiver`, `deployPreview`, `signoff`,
`createPullRequest`, `setMember`, `reconcileDecision`, `onMembersWrite` (Firestore
trigger), `reconcilePoll` (scheduled stub). `approveAndMerge` + approver allowlist
usage REMOVED (D3).

## WHY each non-obvious thing landed

- **Members path is `console-config/members/items/{email}`, not `console-config/members/{email}`.**
  Firestore segments must alternate collection/doc; the plan's literal path is
  invalid (collection `console-config` → doc `members` → needs a collection before
  `{email}`). Chose an `items` subcollection. The frontend MUST read the same path.
  Flagged because the plan text (§3.3) reads as if `{email}` is a direct doc.

- **The mutate callback owns ONLY facets + headSha.** `derivedStatus`, `reconcile`
  and `lastActivity` are recomputed inside `mutateCandidate`, so no caller can write
  an inconsistent (status, reconcile) pair. Honors D8 "status is derived".

- **Dedupe is the FIRST side effect (D9/risk #2).** Every webhook handler builds its
  activity entry, writes it via `appendWebhookActivity(deliveryId)` using Firestore
  `create()` (atomic ALREADY_EXISTS = duplicate), and only mutates facets if the write
  WON. A replayed delivery is a complete no-op.

- **`synchronize` updates the PR facet headSha (NEW).** This is the PR-drift signal the
  scaffold ignored. The projection compares `prDev.headSha` vs `devGate.sha`; a mismatch
  on an OK gate → NEEDS_DECISION (open PR now holds unreviewed code, §5).

- **Feature pushes are no longer no-op'd (plan §7 fix).** Old code skipped existing
  feature pushes, hiding new commits. Now every push refreshes headSha + headCommit and
  re-projects, which is what raises staleness against a prior sign-off.

- **createPullRequest enforces state SERVER-SIDE.** dev PR requires derivedStatus
  OK_FOR_DEV + non-stale dev gate; prod PR requires DEV_MERGED + prodGate OK + non-stale.
  UI gating is decoration; this is the fence.

- **ANOMALY vs advance (projection).** `isSkipAhead` detects a merge with no tracked PR
  and no sign-off (out-of-band GitHub merge, expected under D11) → ANOMALY rather than a
  silent advance to DEV_MERGED/PROD_MERGED.

## Type added to model.ts

- `ReleaseCandidate.lastDeploymentState?: string` — needed to record deploy_19.yml /
  deployment_status health. Nothing else in model.ts changed.

## Pending / follow-ups

- `reconcilePoll` is a wired STUB (schedule every 30 min). Real backfill logic
  (open-PR list, workflow-run list, anomaly sweep, heartbeat) is TODO(reconcile) in code.
- E2E gate detection uses a `name.includes('e2e')` heuristic; confirm the actual gate
  workflow name and tighten if needed.
- Frontend must read members from `console-config/members/items/{email}`.
- testSummary only records `{conclusion, at}` from workflow_run; passed/failed/total
  would need the run's check output or the cicd-audit doc (not available in the webhook).
