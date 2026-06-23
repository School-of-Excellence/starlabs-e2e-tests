// Action gating — the workflow + capability + freshness fence (plan §2 / §4, 2026-06-22).
//
// An action button is enabled only when ALL of these pass (plan §2):
//   (1) signed-in active member on the allowed domain  — AuthService
//   (2) the user's roles grant the capability           — requiredCapability + roles.ts
//   (3) the candidate's workflow state allows the action — allowedByStatus
//   (4) the candidate is not stale (no unreviewed drift) — isFresh
//
// This file owns (2)'s mapping, (3), and (4). (1) lives in AuthService. The UI combines
// them; gateReason() produces the human "why disabled" string for (3)+(4).

import { Capability } from './roles';
import {
  ReleaseCandidate,
  RcStatus,
  previewStale,
  signoffStale,
  prHasUnreviewed,
} from './release-candidate.model';

/** The five gated actions a developer/tester can fire from the board. */
export type RcAction =
  | 'deployPreview'
  | 'signoffDev'
  | 'signoffProd'
  | 'createPrToDev'
  | 'createPrToProd';

/** The capability each action requires (plan §2 capability table). */
const ACTION_CAPABILITY: Record<RcAction, Capability> = {
  deployPreview: 'DEPLOY_PREVIEW',
  signoffDev: 'SIGNOFF_PREVIEW_DEV',
  signoffProd: 'SIGNOFF_DEV_PROD',
  createPrToDev: 'CREATE_PR_DEV',
  createPrToProd: 'CREATE_PR_PROD',
};

/**
 * Per-action enablement BY STATUS (the workflow gate, plan §4):
 *  - deployPreview:  from NO_ACTION or any PREVIEW_* (re-deploy after build/live/fail).
 *  - signoffDev:     from PREVIEW_LIVE (tester validates the live preview channel).
 *  - createPrToDev:  from OK_FOR_DEV (and must be fresh).
 *  - signoffProd:    from DEV_MERGED (tester validates the dev deploy).
 *  - createPrToProd: from OK_FOR_PROD (and must be fresh).
 */
const ACTION_ALLOWED_FROM: Record<RcAction, RcStatus[]> = {
  deployPreview: ['NO_ACTION', 'PREVIEW_BUILDING', 'PREVIEW_LIVE', 'PREVIEW_FAILED'],
  signoffDev: ['PREVIEW_LIVE'],
  createPrToDev: ['OK_FOR_DEV'],
  signoffProd: ['DEV_MERGED'],
  createPrToProd: ['OK_FOR_PROD'],
};

/** The capability an action requires. */
export function requiredCapability(action: RcAction): Capability {
  return ACTION_CAPABILITY[action];
}

/** Whether an action is permitted by the candidate's status alone. */
export function allowedByStatus(action: RcAction, status: RcStatus): boolean {
  return ACTION_ALLOWED_FROM[action].includes(status);
}

/**
 * Freshness gate (plan §4 "any new commit at any stage → raise STALE").
 * Uses the model's pure staleness helpers:
 *  - deployPreview:  always fresh (deploy is what re-syncs the preview to HEAD).
 *  - signoffDev:     blocked if the preview built from an older commit than HEAD.
 *  - signoffProd:    blocked if the dev gate sign-off is stale vs HEAD.
 *  - createPrToDev:  blocked if the dev gate is stale OR the open PR ships unreviewed code.
 *  - createPrToProd: blocked if the prod gate is stale OR the open PR ships unreviewed code.
 */
export function isFresh(action: RcAction, rc: ReleaseCandidate): boolean {
  switch (action) {
    case 'deployPreview':
      // Deploy is only useful when there's something new to publish:
      //  • building  → disabled (a build is already in flight)
      //  • live      → only if a newer commit landed (previewStale) — "new preview available"
      //  • none/failed → enabled (deploy / retry)
      if (rc.preview.buildState === 'BUILDING') return false;
      if (rc.preview.buildState === 'LIVE') return previewStale(rc);
      return true;
    case 'signoffDev':
      return !previewStale(rc);
    case 'signoffProd':
      return !signoffStale(rc.devGate, rc.headSha);
    case 'createPrToDev':
      return !signoffStale(rc.devGate, rc.headSha) && !prHasUnreviewed(rc.prDev, rc.devGate);
    case 'createPrToProd':
      return !signoffStale(rc.prodGate, rc.headSha) && !prHasUnreviewed(rc.prProd, rc.prodGate);
  }
}

/** Human-readable disabled-state labels per action (for the not-allowed-by-status case). */
const STATUS_REASON: Record<RcAction, string> = {
  deployPreview: 'Preview can only be deployed before a PR is open.',
  signoffDev: 'Sign-off for dev needs a live preview channel first.',
  signoffProd: 'Sign-off for prod needs the dev deploy merged first.',
  createPrToDev: 'Open the PR → dev only after a tester signs off for dev.',
  createPrToProd: 'Open the PR → prod only after a tester signs off for prod.',
};

/**
 * The human reason a button is disabled by STATUS or FRESHNESS, or `null` when the
 * action is enabled by those two gates (capability/auth are layered on by the UI).
 */
export function gateReason(action: RcAction, rc: ReleaseCandidate): string | null {
  if (!allowedByStatus(action, rc.derivedStatus)) {
    return STATUS_REASON[action];
  }
  if (action === 'deployPreview' && !isFresh(action, rc)) {
    if (rc.preview.buildState === 'BUILDING') return 'Preview build in progress…';
    if (rc.preview.buildState === 'LIVE') return 'Preview is live and up to date — no new commit to deploy.';
    return 'Nothing new to deploy.';
  }
  if (!isFresh(action, rc)) {
    return 'New code landed after the last sign-off — re-test before continuing.';
  }
  return null;
}
