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
  // HEAD-AWARE projection (auto new-iteration, promotion-chain plan 2026-06-24).
  //
  // derivedStatus reflects the milestone the CURRENT head commit has reached — NOT the highest
  // milestone ever reached on the branch. A merged/open PR or a sign-off only pins its milestone
  // while it still covers the current head; once a new commit lands, those become history (kept in
  // the activity log + facets) and the branch falls through to whatever the NEW commit has reached.
  //
  // Without this, a branch that was once merged to dev (or, under the legacy feature→prod topology,
  // to prod) stays pinned at DEV_MERGED / PROD_MERGED forever, so a fresh push → preview →
  // re-sign-off can never return it to OK_FOR_DEV and "Create PR → dev" never re-enables.
  //
  // "Covers head" requires POSITIVE proof the facet is for the current commit: a recorded sha that
  // equals headSha. A facet with no sha (legacy data, e.g. an old feature→prod merge) CANNOT prove
  // it covers the current head, so it does NOT pin its milestone — the branch instead shows the
  // lower lane that matches the current head. (A missing-sha fallback to "covers" would let a stale
  // merge pin PROD_MERGED/DEV_MERGED forever even after a new push — the exact bug this fixes.)
  // FEATURE branches track headSha (set on every push), so we demand positive proof a facet covers
  // it. ENVIRONMENT candidates (development/production) DON'T track a headSha (pushes to protected
  // branches are skipped), so head is undefined there — in that case project straight from facet
  // state (no covers gate), else they would collapse to NO_ACTION even with an open promotion PR.
  const head = c.headSha;
  const covers = (sha?: string): boolean => (head ? !!sha && sha === head : true);

  // PROD lane (highest) ----------------------------------------------------
  if (c.prProd.state === 'MERGED' && covers(c.prProd.headSha)) return ReleaseStatus.PROD_MERGED;
  if (c.prProd.state === 'OPEN' && covers(c.prProd.headSha)) return ReleaseStatus.PR_TO_PROD;
  if (c.prodGate.verdict === 'OK' && covers(c.prodGate.sha)) return ReleaseStatus.OK_FOR_PROD;

  // DEV lane ---------------------------------------------------------------
  if (c.prDev.state === 'MERGED' && covers(c.prDev.headSha)) return ReleaseStatus.DEV_MERGED;
  if (c.prDev.state === 'OPEN' && covers(c.prDev.headSha)) return ReleaseStatus.PR_TO_DEV;
  if (c.devGate.verdict === 'OK' && covers(c.devGate.sha)) return ReleaseStatus.OK_FOR_DEV;

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
  // If a PR is already OPEN the rule above governs. If the lane already MERGED, that sign-off
  // belongs to a COMPLETED old cycle (history, not pending drift) — only an uncompleted lane
  // (NONE/CLOSED) warrants a re-test decision (head-aware, promotion-chain plan 2026-06-24).
  if (c.devGate.verdict === 'OK' && c.devGate.sha && head && c.devGate.sha !== head) {
    if (c.prDev.state !== 'OPEN' && c.prDev.state !== 'MERGED') return 'NEEDS_DECISION';
  }
  if (c.prodGate.verdict === 'OK' && c.prodGate.sha && head && c.prodGate.sha !== head) {
    if (c.prProd.state !== 'OPEN' && c.prProd.state !== 'MERGED') return 'NEEDS_DECISION';
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
