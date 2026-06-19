// Domain model for the release console.
// Source of truth is GitHub; Firestore `release-candidates/{branch}` is a projection kept in
// sync by the webhookReceiver Cloud Function (see docs/ARCHITECTURE.md §7).

/**
 * Release-candidate status lifecycle (ARCHITECTURE.md §7):
 *
 *   NO_ACTION → OK_TO_RELEASE → PR_TO_DEV → DEV_MERGED → PR_TO_PROD → PROD_MERGED
 *    (auto on    (team sets      (dev opens   (after       (dev opens   (after
 *     preview)    after review)   the PR)      merge)        the PR)      merge)
 *
 * OK_TO_RELEASE is the ONLY manually-set status (the team's sign-off). Every other
 * status is DERIVED from GitHub webhook events, so the board can't drift.
 */
export type RcStatus =
  | 'NO_ACTION'
  | 'OK_TO_RELEASE'
  | 'PR_TO_DEV'
  | 'DEV_MERGED'
  | 'PR_TO_PROD'
  | 'PROD_MERGED';

export const RC_STATUS_ORDER: RcStatus[] = [
  'NO_ACTION',
  'OK_TO_RELEASE',
  'PR_TO_DEV',
  'DEV_MERGED',
  'PR_TO_PROD',
  'PROD_MERGED',
];

/** A QA / review note attached to a candidate. */
export interface RcNote {
  by: string;
  at: string; // ISO timestamp
  text: string;
}

/**
 * `release-candidates/{branch}` document shape.
 * (ARCHITECTURE.md §7 — Data model.)
 */
export interface ReleaseCandidate {
  /** Firestore doc id — `${repo}__${branch}` (double underscore). */
  id: string;
  repo: string;
  branch: string;
  status: RcStatus;
  /** Per-branch preview channel URL on starlabs-test. */
  previewUrl?: string;
  /** Links to a doc in the `cicd-audit` history collection (the e2e report). */
  reportRunId?: string;
  prDevUrl?: string;
  /** GitHub PR number into development (required by approveAndMerge). */
  prDevNumber?: number;
  prProdUrl?: string;
  /** GitHub PR number into production (required by approveAndMerge). */
  prProdNumber?: number;
  notes?: RcNote[];
  /** Email/handle of whoever set OK_TO_RELEASE. */
  okToReleaseBy?: string;
  updatedAt?: string; // ISO timestamp
}

/** The four orchestration actions the board can trigger (each → a Cloud Function). */
export type RcAction =
  | 'markOkToRelease'
  | 'createPrToDev'
  | 'createPrToProd'
  | 'approveAndMerge';
