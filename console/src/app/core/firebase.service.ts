import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ReleaseCandidate, RcStatus } from './release-candidate.model';
import { MOCK_RELEASE_CANDIDATES } from './mock-data';
import { environment } from '../../environments/environment';

/** Result of an action call (Cloud Function callable response, normalized). */
export interface ActionResult {
  ok: boolean;
  message: string;
  /** New status the board should expect once GitHub webhooks land (optimistic hint). */
  nextStatus?: RcStatus;
}

/**
 * Single typed gateway to the starlabs-cicd backend:
 *  - reads `release-candidates` (Firestore, kept in sync from GitHub webhooks), and
 *  - calls the four orchestration Cloud Functions (callable).
 *
 * MOCK-DATA MODE (environment.useMock=true): reads come from in-memory fixtures and the
 * action calls mutate the local copy + log, so the board renders & is clickable offline
 * with no Firebase project wired up.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly useMock = environment.useMock;

  /** Local copy used by mock mode so optimistic mutations are visible. */
  private mockStore = signal<ReleaseCandidate[]>(structuredClone(MOCK_RELEASE_CANDIDATES));

  // TODO(firebase): inject Firestore + Functions once providers are wired in app.config.ts.
  //   constructor(private fs: Firestore, private fns: Functions) {}

  /**
   * Stream of release candidates, newest-updated first.
   * MOCK: returns fixtures. LIVE: collectionData(query(release-candidates, orderBy updatedAt desc)).
   */
  releaseCandidates(): Observable<ReleaseCandidate[]> {
    if (this.useMock) {
      const sorted = [...this.mockStore()].sort(
        (a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
      );
      return of(sorted);
    }
    // TODO(firebase): live read
    //   const col = collection(this.fs, 'release-candidates');
    //   return collectionData(query(col, orderBy('updatedAt', 'desc')), { idField: 'id' })
    //     as Observable<ReleaseCandidate[]>;
    throw new Error('Live Firestore read not wired — set environment.useMock=true or wire app.config.ts');
  }

  /** Build the history-dashboard deep link for a report run (cicd-audit). */
  reportUrl(reportRunId?: string): string | null {
    if (!reportRunId) return null;
    // TODO(report): point at the deployed history dashboard route for this run id.
    // The hub dashboard lists `cicd-audit` docs; link to its detail view by run id.
    return `/history#run=${encodeURIComponent(reportRunId)}`;
  }

  // --- Orchestration actions (each → a callable Cloud Function on starlabs-cicd) -----------
  // The server re-checks the approver allowlist (ARCHITECTURE.md §8). These methods only
  // marshal the call; AuthService gates the buttons client-side for UX.

  /** Team sign-off: the only manually-set status. → callable `markOkToRelease`. */
  markOkToRelease(rc: ReleaseCandidate, by: string): Promise<ActionResult> {
    return this.invoke('markOkToRelease', { branch: rc.branch, by }, 'OK_TO_RELEASE');
  }

  /** Open the PR feature → development. → callable `createPrToDev`. */
  createPrToDev(rc: ReleaseCandidate): Promise<ActionResult> {
    return this.invoke('createPrToDev', { branch: rc.branch }, 'PR_TO_DEV');
  }

  /** Open the PR development → production. → callable `createPrToProd`. */
  createPrToProd(rc: ReleaseCandidate): Promise<ActionResult> {
    return this.invoke('createPrToProd', { branch: rc.branch }, 'PR_TO_PROD');
  }

  /**
   * Approve + merge the open PR (approver-only). Derives DEV_MERGED or PROD_MERGED
   * depending on the candidate's current stage. → callable `approveAndMerge`.
   */
  approveAndMerge(rc: ReleaseCandidate): Promise<ActionResult> {
    const next: RcStatus = rc.status === 'PR_TO_PROD' ? 'PROD_MERGED' : 'DEV_MERGED';
    return this.invoke('approveAndMerge', { branch: rc.branch, stage: rc.status }, next);
  }

  // ----------------------------------------------------------------------------------------

  /** Shared call path: mock-logs or invokes the named callable. */
  private async invoke(
    name: string,
    payload: Record<string, unknown>,
    optimisticNext: RcStatus,
  ): Promise<ActionResult> {
    if (this.useMock) {
      // eslint-disable-next-line no-console
      console.info(`[mock] would call Cloud Function "${name}"`, payload);
      this.applyMock(payload['branch'] as string, optimisticNext, payload['by'] as string | undefined);
      return { ok: true, message: `(mock) ${name} → ${optimisticNext}`, nextStatus: optimisticNext };
    }

    // TODO(firebase): wire the real callable.
    //   const callable = httpsCallable<typeof payload, ActionResult>(this.fns, name);
    //   const res = await callable(payload);
    //   return res.data;
    throw new Error(`Callable "${name}" not wired — set environment.useMock=true or wire app.config.ts`);
  }

  /** Optimistic local mutation so mock-mode buttons visibly advance the board. */
  private applyMock(branch: string, next: RcStatus, by?: string): void {
    this.mockStore.update((list) =>
      list.map((rc) =>
        rc.branch === branch
          ? {
              ...rc,
              status: next,
              okToReleaseBy: next === 'OK_TO_RELEASE' ? by ?? rc.okToReleaseBy : rc.okToReleaseBy,
              updatedAt: new Date().toISOString(),
            }
          : rc,
      ),
    );
  }
}
