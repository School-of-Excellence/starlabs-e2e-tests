/**
 * Data model for the StarLabs release console.
 *
 * GitHub is the source of truth; these Firestore documents MIRROR GitHub state
 * (via the webhook receiver) and layer the human workflow (OK-to-Release,
 * approver allowlists) on top. See docs/ARCHITECTURE.md §7 and docs/GOAL.md §4.
 */

/**
 * The release status lifecycle.
 *
 *   NO_ACTION → OK_TO_RELEASE → PR_TO_DEV → DEV_MERGED → PR_TO_PROD → PROD_MERGED
 *
 * Only OK_TO_RELEASE is set manually (the team's sign-off in the console). Every
 * other status is DERIVED from GitHub webhook events, so the board cannot drift.
 */
export enum ReleaseStatus {
  /** Default. A preview exists but the team has not signed off yet. */
  NO_ACTION = 'NO_ACTION',
  /** MANUAL: the team reviewed the preview and a dev may now open a PR → development. */
  OK_TO_RELEASE = 'OK_TO_RELEASE',
  /** Derived: a PR feature → development is open. */
  PR_TO_DEV = 'PR_TO_DEV',
  /** Derived: the PR into development was merged (auto-deploys to starlabs-test). */
  DEV_MERGED = 'DEV_MERGED',
  /** Derived: a PR development → production is open. */
  PR_TO_PROD = 'PR_TO_PROD',
  /** Derived: the PR into production was merged (auto-deploys to fir-sample-aae4a). */
  PROD_MERGED = 'PROD_MERGED',
}

/**
 * The branches the console understands. Feature branches funnel into `development`,
 * then `development` is promoted into `production`.
 */
export type TargetBranch = 'development' | 'production';

/** A free-form QA/review note attached to a release candidate. */
export interface ReleaseNote {
  /** Firebase Auth uid of the author. */
  authorUid: string;
  /** Display name / email captured at write time (denormalised for the board UI). */
  authorLabel: string;
  /** The note body. */
  text: string;
  /** Epoch millis. */
  at: number;
}

/**
 * Firestore `release-candidates/{repo__branch}`.
 *
 * Document id convention: `${repo}__${branch}` (double underscore) so a single
 * repo can have multiple in-flight candidates (one per feature branch) without
 * id collisions. `repo` is the short repo name (e.g. `starlabs-angular`).
 */
export interface ReleaseCandidate {
  /** Short repo name, e.g. `starlabs-angular`. */
  repo: string;
  /** The feature/source branch this candidate tracks, e.g. `feature/login`. */
  branch: string;
  /** Per-branch Firebase Hosting preview URL (set by the push/workflow_run event). */
  previewUrl?: string;
  /** Current lifecycle status. */
  status: ReleaseStatus;
  /** Links back to the immutable e2e run in `cicd-audit` (Cloud Storage + index doc). */
  reportRunId?: string;
  /** GitHub URL of the open/merged PR into development. */
  prDevUrl?: string;
  /** GitHub PR number into development (used by approveAndMerge). */
  prDevNumber?: number;
  /** GitHub URL of the open/merged PR into production. */
  prProdUrl?: string;
  /** GitHub PR number into production (used by approveAndMerge). */
  prProdNumber?: number;
  /** QA / review notes. */
  notes: ReleaseNote[];
  /** Firebase Auth uid (or email label) of whoever set OK_TO_RELEASE. */
  okToReleaseBy?: string;
  /** Epoch millis of the last update (from any source). */
  updatedAt: number;
  /** Last GitHub deployment_status state seen, for the board (e.g. `success`). */
  lastDeploymentState?: string;
}

/**
 * Firestore `console-config/allowlists` (single document).
 *
 * Two independent identity checks the console enforces BEFORE calling GitHub:
 *  - `okToRelease`: who may set OK_TO_RELEASE / open PRs.
 *  - `approvers`: per-base-branch merge approvers. Production may be stricter
 *    than development (mirrors CODEOWNERS-per-base-branch, but enforced by us
 *    too — defence in depth, see docs/GOAL.md §3).
 *
 * Values are Firebase Auth uids OR email addresses; the callables accept either
 * (uid match first, email fallback) so the doc can be authored before uids exist.
 */
export interface AllowlistConfig {
  /** Who may sign off (OK_TO_RELEASE) and open PRs via the console. */
  okToRelease: string[];
  /** Per-base-branch approver allowlist for approveAndMerge. */
  approvers: Record<TargetBranch, string[]>;
}

/** The Firestore collection / doc paths, centralised. */
export const PATHS = {
  releaseCandidates: 'release-candidates',
  consoleConfig: 'console-config',
  allowlistDoc: 'allowlists',
} as const;

/** Build the deterministic `release-candidates` doc id for a repo+branch. */
export function candidateId(repo: string, branch: string): string {
  return `${repo}__${branch}`;
}
