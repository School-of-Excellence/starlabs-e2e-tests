/**
 * Candidate read/write helpers (facet model). Centralises default facets, the
 * read-modify-recompute-write cycle, and the deterministic preview URL so both
 * the webhook receiver and the callables stay consistent.
 */

import { getFirestore } from 'firebase-admin/firestore';
import {
  ReleaseCandidate,
  ReleaseStatus,
  PATHS,
  candidateId,
  LastActivity,
} from './model';
import { projectCandidate } from './projection';

/** A blank facet-shaped candidate (everything NONE / NO_ACTION). */
export function emptyCandidate(repo: string, branch: string): ReleaseCandidate {
  return {
    repo,
    branch,
    preview: { buildState: 'NONE' },
    devGate: { verdict: 'NONE' },
    prDev: { state: 'NONE' },
    prodGate: { verdict: 'NONE' },
    prProd: { state: 'NONE' },
    derivedStatus: ReleaseStatus.NO_ACTION,
    reconcile: 'IN_SYNC',
    updatedAt: Date.now(),
  };
}

/**
 * Deterministic preview URL (plan D10): `https://<slug>---breakthroughs-test.web.app`.
 * slug = branch lowercased, `/`→`-`, strip non `[a-z0-9-]`, cap 40 chars.
 */
export function previewUrl(branch: string): string {
  const slug = branch
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);
  return `https://${slug}---breakthroughs-test.web.app`;
}

/**
 * Read-modify-write a candidate: load (or synthesize) the doc, apply `mutate`
 * to its facets in place, recompute the projection (derivedStatus + reconcile),
 * stamp lastActivity, and persist. Returns the written candidate.
 *
 * The mutate callback owns ONLY the facets + headSha — derivedStatus/reconcile/
 * lastActivity are recomputed here so no caller can write an inconsistent pair.
 */
export async function mutateCandidate(
  repo: string,
  branch: string,
  lastActivity: LastActivity,
  mutate: (c: ReleaseCandidate) => void,
): Promise<ReleaseCandidate> {
  const db = getFirestore();
  const ref = db.collection(PATHS.releaseCandidates).doc(candidateId(repo, branch));

  const snap = await ref.get();
  const candidate: ReleaseCandidate = snap.exists
    ? (snap.data() as ReleaseCandidate)
    : emptyCandidate(repo, branch);

  // Guarantee the facet shape even on legacy/partial docs.
  candidate.repo = repo;
  candidate.branch = branch;
  candidate.preview ??= { buildState: 'NONE' };
  candidate.devGate ??= { verdict: 'NONE' };
  candidate.prDev ??= { state: 'NONE' };
  candidate.prodGate ??= { verdict: 'NONE' };
  candidate.prProd ??= { state: 'NONE' };

  mutate(candidate);

  candidate.lastActivity = lastActivity;
  const { derivedStatus, reconcile } = projectCandidate(candidate);
  candidate.derivedStatus = derivedStatus;
  candidate.reconcile = reconcile;
  candidate.updatedAt = Date.now();

  await ref.set(candidate, { merge: true });
  return candidate;
}
