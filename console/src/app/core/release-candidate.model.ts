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

// ── THE NEW BRANCH-CHANNELS FLOW (2026-08-19) ────────────────────────────────────────────────────
// Written by branch-channels.yml through the `readiness` functions codebase. Read-only here, and
// deliberately NOT read by the projection — neither field can move a status or change a button.
// The OLD flow keeps sole ownership of `preview` above; the two must never fight over one field.

export type ChannelStatus = 'BUILDING' | 'SUCCESS' | 'FAILED';

/** One hosting channel built from a branch commit. */
export interface ChannelFacet {
  status: ChannelStatus;
  /** The REAL channel URL captured from the CLI — never reconstructed. Absent when FAILED. */
  url?: string | null;
  project?: string | null;
  site?: string | null;
  deployedAt?: number | null;
  expiresAt?: number | null;
}

/** Both channels built from one commit, plus the git/run context they came from. */
export interface PreviewStatusFacet {
  dev?: ChannelFacet;
  prod?: ChannelFacet;
  sha?: string | null;
  commitMsg?: string | null;
  author?: string | null;
  runId?: string | null;
  runUrl?: string | null;
  updatedAt?: number | null;
}

/**
 * One chip covering both phases — the alignment CHECK, then the suite RUN:
 *   CHECKING → SUITES_MISSING | NEEDS_UPDATE | MISSING_TEST_CASES | NO_COVERAGE_POSSIBLE   stop
 *   CHECKING → MATCHED | NOT_APPLICABLE → RUNNING → PASSED | FAILED                        go
 */
export type SuiteState =
  | 'CHECKING'
  | 'MATCHED'
  | 'SUITES_MISSING'
  | 'NEEDS_UPDATE'
  | 'MISSING_TEST_CASES'
  | 'NO_COVERAGE_POSSIBLE'
  | 'NOT_APPLICABLE'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED';

export interface SuiteStatusDetails {
  /** Changed files no suite covers at all. */
  uncovered?: string[];
  /** Changed files in a permanently untestable area (ATC). */
  fenced?: string[];
  /** Selectors a spec drives that the app no longer declares. */
  drift?: { id: string; usedBy: string[] }[];
  /** New elements this diff added that no spec references. */
  missingTestCases?: { component: string; hooks: string[] }[];
  /** New interactive elements with no data-testid — a test could not address them. */
  unhookedElements?: { component: string; count: number }[];
  /** Changed components where nothing at all is exercised by a spec. */
  untestedComponents?: string[];
  newComponents?: string[];
}

export interface TestSuiteStatusFacet {
  state: SuiteState;
  /** The single flag the future Approve button reads — the UI never re-derives the rules. */
  canProceed: boolean;
  sha?: string | null;
  checkedAt?: number | null;
  runId?: string | null;
  runUrl?: string | null;
  suites?: string[];
  crossCutting?: string | null;
  details?: SuiteStatusDetails;
  /** Populated only once the suites actually execute. */
  run?: {
    state: 'RUNNING' | 'PASSED' | 'FAILED';
    passed?: number;
    failed?: number;
    skipped?: number;
    startedAt?: number;
    finishedAt?: number;
    reportRunId?: string;
  };
  /** Set by the console's Recheck button; re-dispatches the workflow for this ref. */
  recheck?: { requestedBy?: string; requestedAt?: number; count?: number };
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

// --- Flutter native delivery (repoType 'flutter'; plan 2026-07-14-flutter-rollout-plan-v2) ------
//
// Flutter has NO web preview. A flutter candidate carries a `mobileDelivery` facet instead: the
// per-platform build/upload/distribution state PLUS the per-platform tester sign-offs (the locked
// per-platform gate model). Sign-offs are colocated with each platform so the UI reads iOS/Android
// independently and the stage gate advances only when BOTH platforms are OK. The console tracks up
// to DEV_MERGED only — there is NO store-release state here (store release is manual, off-console).

/** Build/distribution state for ONE (platform, env). android:SENT (App Dist) / UPLOADED (Play
 *  internal); ios:UPLOADED (ad-hoc App Dist / TestFlight). */
export type MobileDeliveryStatus = 'NONE' | 'BUILDING' | 'SENT' | 'UPLOADED' | 'FAILED';

/** One (platform, environment) delivery. `env` = which Firebase project the build is wired to:
 *  test = starlabs-test, prod = fir-sample-aae4a. Feature stage delivers BOTH envs to App
 *  Distribution; dev-merge delivers prod-env to the store track (trackRef). */
export interface MobileEnvDelivery {
  status: MobileDeliveryStatus;
  /** Firebase App Distribution install link (feature stage). */
  distUrl?: string;
  /** Dev-merge track ref: iOS TestFlight build no. / Android Play Internal version. */
  trackRef?: string;
  at?: string | number;
}

/** A per-platform tester sign-off (reuses GateVerdict; SHA-bound for freshness like GateFacet).
 *  Sign-off is PER-PLATFORM (locked 2026-07-14), NOT per-env — a tester OKs android / ios once. */
export interface MobileSignoff {
  verdict: GateVerdict;
  /** The SHA the verdict was made against (drift = sha ≠ headSha). */
  sha?: string;
  by?: string;
  at?: string | number;
}

/** One platform's per-env delivery + per-stage sign-off inside `mobileDelivery`. */
export interface MobilePlatformFacet {
  test?: MobileEnvDelivery;
  prod?: MobileEnvDelivery;
  /** Feature-stage "OK for dev" sign-off for THIS platform. */
  devSignoff?: MobileSignoff;
  /** Dev-merge "OK to promote" sign-off for THIS platform. */
  prodSignoff?: MobileSignoff;
}

/** Native-delivery facet for flutter candidates (replaces the web `preview` facet). */
export interface MobileDeliveryFacet {
  android?: MobilePlatformFacet;
  ios?: MobilePlatformFacet;
}

export type MobilePlatform = 'android' | 'ios';
export type MobileEnv = 'test' | 'prod';

/** Effective build lifecycle for a flutter candidate, derived from `mobileDelivery` (mirror of the
 *  backend). LIVE once any (platform,env) delivered; BUILDING while any building; else FAILED/NONE. */
export function mobileBuildState(md?: MobileDeliveryFacet): BuildState {
  if (!md) return 'NONE';
  const envs: MobileEnvDelivery[] = [];
  for (const p of ['android', 'ios'] as MobilePlatform[]) {
    const pf = md[p];
    if (pf?.test) envs.push(pf.test);
    if (pf?.prod) envs.push(pf.prod);
  }
  if (envs.length === 0) return 'NONE';
  if (envs.some((e) => e.status === 'SENT' || e.status === 'UPLOADED')) return 'LIVE';
  if (envs.some((e) => e.status === 'BUILDING')) return 'BUILDING';
  if (envs.some((e) => e.status === 'FAILED')) return 'FAILED';
  return 'NONE';
}

/** Platforms with at least one non-NONE delivery (used by the per-platform gate + UI). */
export function deliveredPlatforms(md?: MobileDeliveryFacet): MobilePlatform[] {
  if (!md) return [];
  return (['android', 'ios'] as MobilePlatform[]).filter((p) => {
    const pf = md[p];
    const ok = (e?: MobileEnvDelivery) => !!e && e.status !== 'NONE';
    return !!pf && (ok(pf.test) || ok(pf.prod));
  });
}

/** Aggregate per-platform sign-offs into ONE stage verdict (mirror of the backend): OK iff EVERY
 *  delivered platform has a fresh OK for the stage; REJECTED if any rejected; else NONE. */
export function mobileAggregateVerdict(
  md: MobileDeliveryFacet | undefined,
  stage: 'dev' | 'prod',
  headSha?: string,
): GateVerdict {
  const delivered = deliveredPlatforms(md);
  if (delivered.length === 0) return 'NONE';
  const key = stage === 'dev' ? 'devSignoff' : 'prodSignoff';
  const verdicts = delivered.map((p) => {
    const s = md![p]![key];
    if (!s || s.verdict !== 'OK') return s?.verdict ?? 'NONE';
    if (headSha && s.sha && s.sha !== headSha) return 'NONE';
    return 'OK' as GateVerdict;
  });
  if (verdicts.some((v) => v === 'REJECTED')) return 'REJECTED';
  if (verdicts.every((v) => v === 'OK')) return 'OK';
  return 'NONE';
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

  /**
   * Flutter native delivery (repoType 'flutter' only) — replaces the web `preview` facet. Holds the
   * per-platform build/distribution state + per-platform tester sign-offs. Absent for web/CF repos.
   */
  mobileDelivery?: MobileDeliveryFacet;

  /** The e2e gate run on the open PR (running/passed/failed + report link). */
  gateRun?: GateRunFacet;
  testSummary?: TestSummary;

  // --- NEW branch-channels flow (2026-08-19) — informational, never gates anything today ---
  /** Both hosting channels (dev + prod) built from the last push, with the commit they came from. */
  previewStatus?: PreviewStatusFacet;
  /** Whether the hub's suites cover this diff, and — later — how the run went. */
  testSuiteStatus?: TestSuiteStatusFacet;

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

  // --- Mute (GLOBAL, Working Branches; usability plan 2026-07-02) -----------------
  // Muting hides a branch from the Working Branches list for EVERYONE until the next push.
  // The unmute logic is intentionally pure/frontend: a branch counts as muted only while
  // `mutedSha === headSha`; a new commit advances headSha, breaks the match, and the branch
  // reappears with no server action. `mutedAt` is a Firestore Timestamp on live writes.
  /** The headSha captured when the branch was muted (the match key for isMuted). */
  mutedSha?: string;
  /** Who muted it (email) — mute is global, so this records the actor for the muted panel. */
  mutedBy?: string;
  /** When it was muted. Firestore Timestamp (live) / epoch millis | ISO string (mock). */
  mutedAt?: string | number;
}

/**
 * Per-developer console preferences (`console-config/user-prefs/{email}`, usability plan
 * 2026-07-02). PRIVATE per user (unlike the global mute). Currently just pinned branches.
 */
export interface UserPrefs {
  /** Release-candidate ids (`${repo}__${branch}`) the developer pinned to the top. */
  pinnedBranchIds: string[];
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
  | 'member_change'
  | 'mobile_release';  // flutter native delivery reported by recordMobileRelease (plan 2026-07-14)

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

/**
 * A branch counts as muted only while the muted SHA still matches HEAD (usability plan
 * 2026-07-02). Pure/frontend: a push advances headSha, the match breaks, and the branch
 * un-mutes on its own — no server action, and all other activity is ignored.
 */
export function isMuted(rc: ReleaseCandidate): boolean {
  return !!rc.mutedSha && rc.mutedSha === rc.headSha;
}

/**
 * The per-feature PROD-lane badge (status-gap fix, usability plan 2026-07-02).
 *
 * In the promotion-chain design a feature's own lifecycle is terminal at DEV_MERGED; the prod
 * lane lives on the aggregate `development` entry. This DERIVES a feature's shipping state from
 * that development entry + the feature's `unreleased` flag, so a feature card can show
 * OK for prod / PR → prod / Prod merged instead of being frozen at "Dev merged". Returns an
 * RcStatus (reusing STATUS_META for label/color), or null when there is nothing extra to show.
 */
export function shippingBadge(
  feature: ReleaseCandidate,
  devEntry?: ReleaseCandidate,
): RcStatus | null {
  if (feature.derivedStatus !== 'DEV_MERGED') return null;
  // Explicitly shipped: merged to dev and no longer in the unreleased batch → rode a prod release.
  // (Only `=== false` — an undefined flag is legacy/unknown and gets no badge.)
  if (feature.unreleased === false) return 'PROD_MERGED';
  // Still in the batch: mirror where the development promotion lane currently is.
  if (feature.unreleased) {
    if (devEntry?.prProd?.state === 'OPEN') return 'PR_TO_PROD';
    if (devEntry?.promotable) return 'OK_FOR_PROD';
  }
  return null;
}
