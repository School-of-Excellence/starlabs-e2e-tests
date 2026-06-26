/**
 * Data model for the StarLabs release console — FACET-BASED (plan D6, 2026-06-22).
 *
 * GitHub is the source of truth; these Firestore documents MIRROR GitHub state (via
 * the webhook receiver) and layer the human workflow (tester gates, role allowlists)
 * on top. The candidate is a SET OF FACETS, not a single linear status; `derivedStatus`
 * is a projection computed from the activity log (plan D8). See
 * specs/plans/2026-06-22-console-v2-architecture.md.
 *
 * BACKEND copy. Keep structurally in sync with the frontend
 * (console/src/app/core/release-candidate.model.ts + roles.ts).
 *
 * NOTE: index.ts must be rewritten against this model (new statuses, facets, activity
 * log, removed approveAndMerge) — that is a fan-out task per the build sequence.
 */

/** Lifecycle milestones (the projection collapses facets to one of these). */
export enum ReleaseStatus {
  NO_ACTION = 'NO_ACTION',
  PREVIEW_BUILDING = 'PREVIEW_BUILDING',
  PREVIEW_LIVE = 'PREVIEW_LIVE',
  PREVIEW_FAILED = 'PREVIEW_FAILED',
  /** Tester signed off the preview → a dev may open a PR → development. */
  OK_FOR_DEV = 'OK_FOR_DEV',
  PR_TO_DEV = 'PR_TO_DEV',
  /** Dev merged on GitHub (not the console) → auto-deploys to starlabs-test. */
  DEV_MERGED = 'DEV_MERGED',
  /** Tester signed off the development deploy → a dev may open a PR → production. */
  OK_FOR_PROD = 'OK_FOR_PROD',
  PR_TO_PROD = 'PR_TO_PROD',
  /** Dev merged on GitHub → auto-deploys to fir-sample-aae4a. */
  PROD_MERGED = 'PROD_MERGED',
}

/** Milestone rank for the projection (legal transitions advance; jumps = ANOMALY). */
export const STATUS_RANK: Record<ReleaseStatus, number> = {
  [ReleaseStatus.NO_ACTION]: 0,
  [ReleaseStatus.PREVIEW_BUILDING]: 1,
  [ReleaseStatus.PREVIEW_LIVE]: 1,
  [ReleaseStatus.PREVIEW_FAILED]: 1,
  [ReleaseStatus.OK_FOR_DEV]: 2,
  [ReleaseStatus.PR_TO_DEV]: 3,
  [ReleaseStatus.DEV_MERGED]: 4,
  [ReleaseStatus.OK_FOR_PROD]: 5,
  [ReleaseStatus.PR_TO_PROD]: 6,
  [ReleaseStatus.PROD_MERGED]: 7,
};

/** The protected branches feature work funnels into. */
export type TargetBranch = 'development' | 'production';

export type BuildState = 'NONE' | 'BUILDING' | 'LIVE' | 'FAILED';
export type GateVerdict = 'NONE' | 'OK' | 'REJECTED';
export type PrState = 'NONE' | 'OPEN' | 'MERGED' | 'CLOSED';
export type Reconcile = 'IN_SYNC' | 'DRIFT_BENIGN' | 'NEEDS_DECISION' | 'ANOMALY';

export interface ReleaseNote {
  authorUid?: string;
  authorLabel: string;
  text: string;
  at: number;
}

export interface PreviewFacet {
  sha?: string;
  url?: string;
  buildState: BuildState;
  builtAt?: number;
}

export interface GateFacet {
  verdict: GateVerdict;
  sha?: string;
  by?: string;
  at?: number;
  notes?: ReleaseNote[];
}

export interface PrFacet {
  number?: number;
  url?: string;
  state: PrState;
  headSha?: string;
  mergeable?: boolean;
  checksState?: string;
}

export interface TestSummary {
  conclusion?: string;
  passed?: number;
  failed?: number;
  total?: number;
  at?: number;
}

/** Lifecycle of the e2e gate that runs on an open PR (shown in Working Branches). */
export type GateStatus = 'NONE' | 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED';

/** The e2e gate run attached to the branch's open PR (from gate workflow_run events). */
export interface GateRunFacet {
  stage?: 'dev' | 'prod';
  status: GateStatus;
  runId?: string;
  runUrl?: string;
  /** GitHub run id used to resolve the rich report in the cicd-audit dashboard. */
  reportRunId?: string;
  at?: number;
}

export interface LastActivity {
  type: string;
  sha?: string;
  actor?: string;
  at?: number;
}

/** Firestore `release-candidates/{repo__branch}` — facet model (plan §3.1). */
export interface ReleaseCandidate {
  repo: string;
  branch: string;
  headSha?: string;
  headCommit?: { msg?: string; author?: string; at?: number };

  preview: PreviewFacet;
  devGate: GateFacet;
  prDev: PrFacet;
  prodGate: GateFacet;
  prProd: PrFacet;

  gateRun?: GateRunFacet;
  testSummary?: TestSummary;

  /** Latest deploy health from the deploy workflow_run / deployment_status (D10). */
  lastDeploymentState?: string;

  // --- Promotion lane (the `development` candidate; promotion-chain plan 2026-06-24) ---
  /** `development` has feature(s) merged in but not yet promoted to production. */
  hasUnreleased?: boolean;
  /** `development` is ready to promote: hasUnreleased AND its dev deploy succeeded. */
  promotable?: boolean;
  /**
   * FEATURE candidate: its PR merged to `development` but is NOT yet shipped to production — i.e.
   * part of the current promotion BATCH (D2, 2026-06-26). Set on the feature→dev merge; cleared on
   * the development→production merge (the whole batch releases together).
   */
  unreleased?: boolean;

  derivedStatus: ReleaseStatus;
  lastActivity?: LastActivity;
  reconcile: Reconcile;

  updatedAt: number;
}

// --- Activity log (single flat collection, plan D7) -----------------------------

export type ActivityType =
  | 'push'
  | 'preview_dispatch'
  | 'preview_build'
  | 'signoff_dev'
  | 'signoff_prod'
  | 'pr_to_dev'
  | 'pr_to_prod'
  | 'dev_merged'
  | 'prod_merged'
  | 'deploy_status'
  | 'gate_run'
  | 'reconcile_decision'
  | 'member_change';

export type ActivitySource = 'webhook' | 'console' | 'reconcile';

/** `activity-log/{deliveryId}` (plan §3.2). Doc id = X-GitHub-Delivery for dedupe (D9). */
export interface ActivityLogEntry {
  branchId: string; // `${repo}__${branch}`
  type: ActivityType;
  sha?: string;
  actor?: string;
  source: ActivitySource;
  confirmed: boolean;
  eventTime: number; // epoch millis — order by this (D9)
  receivedTime: number;
  detail?: Record<string, unknown>;
}

// --- Roles / members (plan D1, mirror of frontend roles.ts) ---------------------

export type Role = 'developer' | 'tester' | 'admin';

export type Capability =
  | 'DEPLOY_PREVIEW'
  | 'SIGNOFF_PREVIEW_DEV'
  | 'SIGNOFF_DEV_PROD'
  | 'CREATE_PR_DEV'
  | 'CREATE_PR_PROD'
  | 'MANAGE_MEMBERS';

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  // Promotion to production is ADMIN-ONLY (D1, 2026-06-26). The server enforces this too via
  // requireCapability(CREATE_PR_PROD) in createPullRequest, so a developer cannot promote by API.
  developer: ['DEPLOY_PREVIEW', 'CREATE_PR_DEV'],
  tester: ['SIGNOFF_PREVIEW_DEV', 'SIGNOFF_DEV_PROD'],
  admin: [
    'DEPLOY_PREVIEW',
    'CREATE_PR_DEV',
    'CREATE_PR_PROD',
    'SIGNOFF_PREVIEW_DEV',
    'SIGNOFF_DEV_PROD',
    'MANAGE_MEMBERS',
  ],
};

export const ALLOWED_DOMAIN = 'soexcellence.com';

/** Firestore `CICD-Users/{email}` — one doc per member. Doc id = lowercased email. */
export interface Member {
  email: string;
  displayName?: string;
  roles: Role[];
  active: boolean;
  addedBy?: string;
  addedAt?: number;
}

export function hasCapability(roles: readonly Role[], cap: Capability): boolean {
  for (const r of roles) if ((ROLE_CAPABILITIES[r] ?? []).includes(cap)) return true;
  return false;
}

export function isAllowedDomain(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith('@' + ALLOWED_DOMAIN);
}

/**
 * LEGACY `console-config/allowlists` (single doc). Retained for migration only — a
 * Firestore onWrite(members) trigger recomputes it. New code reads `members` + roles.
 */
export interface AllowlistConfig {
  okToRelease: string[];
  approvers: Record<TargetBranch, string[]>;
}

/** Firestore collection / doc paths, centralised. */
export const PATHS = {
  releaseCandidates: 'release-candidates',
  activityLog: 'activity-log',
  consoleConfig: 'console-config',
  /** Top-level members collection — one doc per member, id = lowercased email. */
  usersCol: 'CICD-Users',
  allowlistDoc: 'allowlists',
} as const;

/**
 * Deterministic `release-candidates` doc id (also the activity-log `branchId`).
 * Slashes in branch names (e.g. `feature/x`) are replaced with `-` because Firestore
 * treats `/` in a document id as a path separator. The real branch name is preserved
 * in the candidate's `branch` field, so PR/dispatch calls still use the true branch.
 */
export function candidateId(repo: string, branch: string): string {
  return `${repo}__${branch.replace(/\//g, '-')}`;
}
