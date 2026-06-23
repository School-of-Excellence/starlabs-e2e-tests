// Status presentation map for the facet projection (plan §4, 2026-06-22).
//
// One label + CSS-variable token per derived milestone. The `--st-*` token style is
// reused from the old board/status.ts so existing stylesheets keep working; new
// milestones (PREVIEW_*, OK_FOR_DEV/PROD) extend the same family.

import { RcStatus } from './release-candidate.model';

/** Human label + CSS-variable color token for each derived-status chip. */
export const STATUS_META: Record<RcStatus, { label: string; varName: string }> = {
  NO_ACTION: { label: 'No action', varName: '--st-no-action' },
  PREVIEW_BUILDING: { label: 'Preview building', varName: '--st-preview-building' },
  PREVIEW_LIVE: { label: 'Preview live', varName: '--st-preview-live' },
  PREVIEW_FAILED: { label: 'Preview failed', varName: '--st-preview-failed' },
  OK_FOR_DEV: { label: 'OK for dev', varName: '--st-ok-dev' },
  PR_TO_DEV: { label: 'PR → dev', varName: '--st-pr-dev' },
  DEV_MERGED: { label: 'Dev merged', varName: '--st-dev-merged' },
  OK_FOR_PROD: { label: 'OK for prod', varName: '--st-ok-prod' },
  PR_TO_PROD: { label: 'PR → prod', varName: '--st-pr-prod' },
  PROD_MERGED: { label: 'Prod merged', varName: '--st-prod-merged' },
};
