import { RcStatus } from '../core/release-candidate.model';

/** Human label + CSS-variable color token for each status chip. */
export const STATUS_META: Record<RcStatus, { label: string; varName: string }> = {
  NO_ACTION: { label: 'No action', varName: '--st-no-action' },
  OK_TO_RELEASE: { label: 'OK to release', varName: '--st-ok' },
  PR_TO_DEV: { label: 'PR → dev', varName: '--st-pr-dev' },
  DEV_MERGED: { label: 'Dev merged', varName: '--st-dev-merged' },
  PR_TO_PROD: { label: 'PR → prod', varName: '--st-pr-prod' },
  PROD_MERGED: { label: 'Prod merged', varName: '--st-prod-merged' },
};

/**
 * Per-action enablement BY STATUS (the workflow gate). The role gate (approver allowlist)
 * is applied separately in the card component via AuthService — both must pass.
 *
 *  - Mark OK to Release: only from NO_ACTION (the team's manual sign-off).
 *  - Create PR → dev:    only once OK_TO_RELEASE.
 *  - Create PR → prod:   only once DEV_MERGED.
 *  - Approve & Merge:    only while a PR is open (PR_TO_DEV or PR_TO_PROD); approver-only.
 */
export const ACTION_ENABLED_FROM: Record<
  'markOkToRelease' | 'createPrToDev' | 'createPrToProd' | 'approveAndMerge',
  RcStatus[]
> = {
  markOkToRelease: ['NO_ACTION'],
  createPrToDev: ['OK_TO_RELEASE'],
  createPrToProd: ['DEV_MERGED'],
  approveAndMerge: ['PR_TO_DEV', 'PR_TO_PROD'],
};

/** Whether an action is permitted by status alone (role check is layered on top). */
export function allowedByStatus(
  action: keyof typeof ACTION_ENABLED_FROM,
  status: RcStatus,
): boolean {
  return ACTION_ENABLED_FROM[action].includes(status);
}

/** Approve & Merge is the only approver-gated action. */
export function requiresApprover(action: keyof typeof ACTION_ENABLED_FROM): boolean {
  return action === 'approveAndMerge';
}
