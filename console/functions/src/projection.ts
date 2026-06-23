/**
 * Projection + reconciliation engine (plan §4 lifecycle, §5 taxonomy, D8).
 *
 * Pure functions: given a candidate's FACETS, derive the single `derivedStatus`
 * milestone (the highest LEGAL milestone reached) and a `reconcile` verdict
 * describing how the latest activity relates to that milestone.
 *
 * Determinism (D9 / risk #7): the projection reads only the facets + the last
 * activity. It never reads wall-clock time and never advances on a skip-ahead
 * event — an illegal jump produces ANOMALY, not a silent advance.
 */

import {
  ReleaseStatus,
  STATUS_RANK,
  ReleaseCandidate,
  LastActivity,
  Reconcile,
  PreviewFacet,
  GateFacet,
  PrFacet,
} from './model';

/** The slice of a candidate the projection needs (facets + head + last activity). */
export interface ProjectionInput {
  headSha?: string;
  preview: PreviewFacet;
  devGate: GateFacet;
  prDev: PrFacet;
  prodGate: GateFacet;
  prProd: PrFacet;
  lastActivity?: LastActivity;
}

export interface ProjectionResult {
  derivedStatus: ReleaseStatus;
  reconcile: Reconcile;
}

/**
 * Highest LEGAL milestone the facets prove was reached. We compute every
 * milestone the facets independently support, then collapse to the max rank
 * that is reachable WITHOUT skipping a required predecessor. A facet that
 * implies a high milestone with no support for the milestones below it is the
 * ANOMALY signal handled in `reconcileVerdict`.
 */
function deriveStatus(c: ProjectionInput): ReleaseStatus {
  // PROD lane (highest) ----------------------------------------------------
  if (c.prProd.state === 'MERGED') return ReleaseStatus.PROD_MERGED;
  if (c.prProd.state === 'OPEN') return ReleaseStatus.PR_TO_PROD;
  if (c.prodGate.verdict === 'OK') return ReleaseStatus.OK_FOR_PROD;

  // DEV lane ---------------------------------------------------------------
  if (c.prDev.state === 'MERGED') return ReleaseStatus.DEV_MERGED;
  if (c.prDev.state === 'OPEN') return ReleaseStatus.PR_TO_DEV;
  if (c.devGate.verdict === 'OK') return ReleaseStatus.OK_FOR_DEV;

  // PREVIEW lane -----------------------------------------------------------
  if (c.preview.buildState === 'LIVE') return ReleaseStatus.PREVIEW_LIVE;
  if (c.preview.buildState === 'BUILDING') return ReleaseStatus.PREVIEW_BUILDING;
  if (c.preview.buildState === 'FAILED') return ReleaseStatus.PREVIEW_FAILED;

  return ReleaseStatus.NO_ACTION;
}

/**
 * Does a milestone require a predecessor the facets cannot prove? If a high
 * milestone is asserted (e.g. prDev MERGED) with NO supporting lower facet
 * (e.g. no PR was ever tracked, or the merge skipped the open state AND no
 * sign-off exists), that is an out-of-band action — ANOMALY (plan §5, D11).
 */
function isSkipAhead(c: ProjectionInput, status: ReleaseStatus): boolean {
  switch (status) {
    case ReleaseStatus.DEV_MERGED:
      // A dev merge with no PR ever opened/tracked AND no dev sign-off is an
      // out-of-band GitHub merge (expected under D3/D11). Flag it.
      return c.prDev.number === undefined && c.devGate.verdict !== 'OK';
    case ReleaseStatus.PROD_MERGED:
      return c.prProd.number === undefined && c.prodGate.verdict !== 'OK';
    case ReleaseStatus.PR_TO_PROD:
      // Opening a prod PR legally requires the dev lane to have merged first.
      return c.prDev.state !== 'MERGED';
    case ReleaseStatus.PR_TO_DEV:
      // Opening a dev PR legally requires a dev sign-off (OK_FOR_DEV) first.
      return c.devGate.verdict !== 'OK';
    default:
      return false;
  }
}

/**
 * Map the last activity to the reconcile verdict relative to the derived status
 * (plan §5). The four-way taxonomy:
 *   IN_SYNC        last activity is the expected next step
 *   DRIFT_BENIGN   same-stage content change, gates still intact
 *   NEEDS_DECISION content moved PAST a sign-off / an open PR now holds
 *                  unreviewed code (sha drift vs the gate sha)
 *   ANOMALY        an event implies a milestone that skips required ones
 */
function reconcileVerdict(c: ProjectionInput, status: ReleaseStatus): Reconcile {
  if (isSkipAhead(c, status)) return ReleaseStatus.NO_ACTION === status ? 'IN_SYNC' : 'ANOMALY';

  const head = c.headSha;

  // An OPEN dev PR whose head moved past the dev sign-off sha → unreviewed code.
  if (c.prDev.state === 'OPEN' && c.devGate.verdict === 'OK') {
    if (c.devGate.sha && c.prDev.headSha && c.devGate.sha !== c.prDev.headSha) {
      return 'NEEDS_DECISION';
    }
  }
  // An OPEN prod PR whose head moved past the prod sign-off sha → unreviewed code.
  if (c.prProd.state === 'OPEN' && c.prodGate.verdict === 'OK') {
    if (c.prodGate.sha && c.prProd.headSha && c.prodGate.sha !== c.prProd.headSha) {
      return 'NEEDS_DECISION';
    }
  }

  // A dev sign-off exists but new commits landed on the branch past the signed sha.
  if (c.devGate.verdict === 'OK' && c.devGate.sha && head && c.devGate.sha !== head) {
    // If a PR is already open the rule above governs; otherwise the sign-off is
    // stale relative to fresh content — a decision (re-test) is warranted.
    if (c.prDev.state !== 'OPEN') return 'NEEDS_DECISION';
  }
  if (c.prodGate.verdict === 'OK' && c.prodGate.sha && head && c.prodGate.sha !== head) {
    if (c.prProd.state !== 'OPEN') return 'NEEDS_DECISION';
  }

  // A push arrived before any sign-off (gates intact) → benign new content.
  if (c.lastActivity?.type === 'push') {
    const noGatesYet = c.devGate.verdict !== 'OK' && c.prodGate.verdict !== 'OK';
    if (noGatesYet && status !== ReleaseStatus.NO_ACTION) return 'DRIFT_BENIGN';
  }

  // A preview rebuild while a sign-off already exists is benign new content.
  if (
    (c.lastActivity?.type === 'preview_build' || c.lastActivity?.type === 'preview_dispatch') &&
    c.preview.buildState === 'BUILDING'
  ) {
    return 'DRIFT_BENIGN';
  }

  return 'IN_SYNC';
}

/** Pure projection: facets → { derivedStatus, reconcile }. */
export function project(c: ProjectionInput): ProjectionResult {
  const derivedStatus = deriveStatus(c);
  const reconcile = reconcileVerdict(c, derivedStatus);
  return { derivedStatus, reconcile };
}

/** Convenience: project from a (possibly partial) candidate snapshot. */
export function projectCandidate(c: ReleaseCandidate): ProjectionResult {
  return project({
    headSha: c.headSha,
    preview: c.preview,
    devGate: c.devGate,
    prDev: c.prDev,
    prodGate: c.prodGate,
    prProd: c.prProd,
    lastActivity: c.lastActivity,
  });
}

/** Rank helper re-exported for callables that need a state-gate comparison. */
export function rankOf(status: ReleaseStatus): number {
  return STATUS_RANK[status];
}
