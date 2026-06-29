// Domain model for the release console — FACET-BASED (plan D6, 2026-06-22).
//
// A branch is NOT a single linear status. It has several facets that move
// independently (preview build, tester gates, open PRs), each tagged with the SHA
// it applies to. `derivedStatus` is a PROJECTION computed from the activity log
// (plan D8); the raw facets + headSha are the source of truth for staleness/drift.
//
// Source of truth for code/merge state is GitHub; Firestore mirrors it via the
// webhook receiver. This is the FRONTEND copy; functions/src/model.ts mirrors it.

/** Lifecycle milestones (the projection collapses the facets to one of these). */
export type RcStatus =
  | 'NO_ACTION'
  | 'PREVIEW_BUILDING'
  | 'PREVIEW_LIVE'
  | 'PREVIEW_FAILED'
  | 'OK_FOR_DEV'      // tester signed off the preview → dev may open PR
  | 'PR_TO_DEV'
  | 'DEV_MERGED'      // dev merged on GitHub → auto-deploy starlabs-test
  | 'OK_FOR_PROD'     // tester signed off the dev deploy → dev may open prod PR
  | 'PR_TO_PROD'
  | 'PROD_MERGED';    // dev merged on GitHub → auto-deploy fir-sample-aae4a

/** Milestone rank for the projection (legal transitions advance; jumps = ANOMALY). */
export const RC_STATUS_RANK: Record<RcStatus, number> = {
  NO_ACTION: 0,
  PREVIEW_BUILDING: 1,
  PREVIEW_LIVE: 1,
  PREVIEW_FAILED: 1,
  OK_FOR_DEV: 2,
  PR_TO_DEV: 3,
  DEV_MERGED: 4,
  OK_FOR_PROD: 5,
  PR_TO_PROD: 6,
  PROD_MERGED: 7,
};

export type BuildState = 'NONE' | 'BUILDING' | 'LIVE' | 'FAILED';
export type GateVerdict = 'NONE' | 'OK' | 'REJECTED';
export type PrState = 'NONE' | 'OPEN' | 'MERGED' | 'CLOSED';

/** Reconciliation verdict between derivedStatus and lastActivity (plan §5). */
export type Reconcile = 'IN_SYNC' | 'DRIFT_BENIGN' | 'NEEDS_DECISION' | 'ANOMALY';

/** A QA / review note attached to a gate. */
export interface RcNote {
  by: string;
  at: string; // ISO timestamp
  text: string;
}

/** The manual preview build facet (deploy is a manual button, plan D5). */
export interface PreviewFacet {
  sha?: string;
  url?: string;
  buildState: BuildState;
  builtAt?: string;
}

/** A tester sign-off gate (dev gate or prod gate). */
export interface GateFacet {
  verdict: GateVerdict;
  /** The SHA the verdict was made against (drift = sha ≠ headSha). */
  sha?: string;
  by?: string;
  at?: string;
  notes?: RcNote[];
}

/** An open/merged PR facet. The console opens it; the developer merges on GitHub (D3). */
export interface PrFacet {
  number?: number;
  url?: string;
  state: PrState;
  /** The SHA the PR currently points at (GitHub auto-advances on new pushes). */
  headSha?: string;
  mergeable?: boolean;
  checksState?: string; // e.g. 'success' | 'failure' | 'pending'
}

/** A summary of the e2e gate run, for the Overview dashboard (plan D10). */
export interface TestSummary {
  conclusion?: string; // 'success' | 'failure' | ...
  passed?: number;
  failed?: number;
  total?: number;
  at?: string;
}

/** Lifecycle of the e2e gate that runs on an open PR (shown in Working Branches). */
export type GateStatus = 'NONE' | 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED';

/**
 * The e2e gate run attached to the branch's open PR. Populated from the gate
 * workflow's `workflow_run` events so a developer sees running/passed/failed and a
 * link to the report BEFORE merging on GitHub.
 */
export interface GateRunFacet {
  /**
   * Which lane the gate ran against. 'preview' = the preview-time gate (preview-e2e.yml, runs before
   * any PR — the report the tester reads at sign-off). 'dev'/'prod' = a gate on the open PR.
   */
  stage?: 'preview' | 'dev' | 'prod';
  status: GateStatus;
  /** GitHub workflow run id (numeric, as string). */
  runId?: string;
  /** GitHub Actions run page — always-available fallback link. */
  runUrl?: string;
  /** GitHub run id used to resolve the rich report in the cicd-audit dashboard. */
  reportRunId?: string;
  /** The SHA this gate ran against — lets the UI tie the report to a build / flag staleness. */
  sha?: string;
  at?: string;
}

/** The newest event observed for the branch (the "last activity" clock). */
export interface LastActivity {
  type: string;
  sha?: string;
  actor?: string;
  at?: string | number;
}

/**
 * `release-candidates/{repo__branch}` — the facet model (plan §3.1).
 */
export interface ReleaseCandidate {
  /** Firestore doc id — `${repo}__${branch}`. */
  id: string;
  repo: string;
  branch: string;

  /** Latest pushed commit on the branch. */
  headSha?: string;
  headCommit?: { msg?: string; author?: string; at?: string };

  preview: PreviewFacet;
  devGate: GateFacet;
  prDev: PrFacet;
  prodGate: GateFacet;
  prProd: PrFacet;

  /** The e2e gate run on the open PR (running/passed/failed + report link). */
  gateRun?: GateRunFacet;
  testSummary?: TestSummary;

  /** Latest deploy health (dev → starlabs-test, prod → fir-sample). */
  lastDeploymentState?: string;
  // --- Promotion lane (the `development` candidate; promotion-chain plan 2026-06-24) ---
  /** `development` has feature(s) merged in but not yet promoted. */
  hasUnreleased?: boolean;
  /** `development` is ready to promote: hasUnreleased AND its dev deploy succeeded. */
  promotable?: boolean;
  /** FEATURE candidate: merged to development, not yet shipped to production (in the batch, D2). */
  unreleased?: boolean;

  /** Projection: the milestone derived from the activity log (plan D8). */
  derivedStatus: RcStatus;
  /** The newest event, regardless of type. */
  lastActivity?: LastActivity;
  /** Reconciliation verdict — IN_SYNC unless status and lastActivity disagree. */
  reconcile: Reconcile;

  updatedAt?: string | number; // epoch millis (live) or ISO string (mock)
}

// --- Activity log (single flat collection, plan D7) -----------------------------

/** Event kinds appended to `activity-log`. */
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

/** Where an event originated. GitHub-confirmed (webhook) events win over intents (D8/D9). */
export type ActivitySource = 'webhook' | 'console' | 'reconcile';

/**
 * `activity-log/{deliveryId}` (plan §3.2). Flat collection queried by `branchId`.
 * Doc id = GitHub X-GitHub-Delivery for webhook events (idempotent dedupe, D9).
 */
export interface ActivityLogEntry {
  /** `${repo}__${branch}` — the query key. */
  branchId: string;
  type: ActivityType;
  sha?: string;
  actor?: string;
  source: ActivitySource;
  /** false for optimistic console intents until a matching webhook confirms (risk #5). */
  confirmed: boolean;
  /** GitHub's event timestamp — ORDER BY THIS, not arrival time (D9). */
  eventTime: string | number; // epoch millis (live) or ISO string (mock)
  receivedTime: string | number;
  /** Free-form detail (PR number, reconcile choice + reason, etc.). */
  detail?: Record<string, unknown>;
}

// --- UI-computed staleness (NOT stored) -----------------------------------------

/**
 * development / production are deployment ENVIRONMENTS (auto-deployed by deploy_19.yml),
 * not feature candidates — the feature screens exclude them; their deploy status shows
 * on Overview. A candidate for one of these only exists to hold deploy health.
 */
export function isProtectedBranch(branch: string): boolean {
  return branch === 'development' || branch === 'production';
}

/**
 * Coerce a timestamp to epoch millis for sorting. Backend writes numbers (epoch);
 * mock fixtures use ISO strings — handle both, and undefined/null → 0.
 */
export function toMillis(v?: string | number | null): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Date.parse(v) || 0;
  return 0;
}

/** Preview built from an older commit than HEAD. */
export function previewStale(rc: ReleaseCandidate): boolean {
  return !!rc.headSha && !!rc.preview?.sha && rc.preview.sha !== rc.headSha;
}

/** A tester sign-off that no longer matches HEAD (new code landed after sign-off). */
export function signoffStale(gate: GateFacet, headSha?: string): boolean {
  return gate?.verdict === 'OK' && !!headSha && !!gate.sha && gate.sha !== headSha;
}

/** An open PR whose tip moved past the tester sign-off (ships unreviewed code). */
export function prHasUnreviewed(pr: PrFacet, gate: GateFacet): boolean {
  return pr?.state === 'OPEN' && !!pr.headSha && !!gate?.sha && pr.headSha !== gate.sha;
}
