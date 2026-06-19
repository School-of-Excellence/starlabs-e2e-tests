import { Injectable, signal, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { Firestore, collection, query, orderBy, collectionData } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
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

  private readonly fs = inject(Firestore);
  private readonly fns = inject(Functions);

  /** Local copy used by mock mode so optimistic mutations are visible. */
  private readonly mockStore = signal<ReleaseCandidate[]>(structuredClone(MOCK_RELEASE_CANDIDATES));

  /** Reactive sorted stream for mock mode — re-emits on every applyMock() call. */
  private readonly mockCandidates$ = toObservable(
    computed(() =>
      [...this.mockStore()].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    ),
  );

  /**
   * Stream of release candidates, newest-updated first.
   * MOCK: returns a live signal-backed stream so optimistic mutations re-render the board.
   * LIVE: collectionData(query(release-candidates, orderBy updatedAt desc)).
   */
  releaseCandidates(): Observable<ReleaseCandidate[]> {
    if (this.useMock) {
      return this.mockCandidates$;
    }
    const col = collection(this.fs, 'release-candidates');
    return collectionData(query(col, orderBy('updatedAt', 'desc')), { idField: 'id' }) as Observable<ReleaseCandidate[]>;
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

  /** Team sign-off: the only manually-set status. → callable `setOkToRelease`. */
  markOkToRelease(rc: ReleaseCandidate, by: string): Promise<ActionResult> {
    return this.invoke('setOkToRelease', rc, { repo: rc.repo, branch: rc.branch }, 'OK_TO_RELEASE', by);
  }

  /** Open the PR feature → development. → callable `createPullRequest`. */
  createPrToDev(rc: ReleaseCandidate): Promise<ActionResult> {
    return this.invoke('createPullRequest', rc, { repo: rc.repo, head: rc.branch, base: 'development' }, 'PR_TO_DEV');
  }

  /** Open the PR development → production. → callable `createPullRequest`. */
  createPrToProd(rc: ReleaseCandidate): Promise<ActionResult> {
    return this.invoke('createPullRequest', rc, { repo: rc.repo, head: rc.branch, base: 'production' }, 'PR_TO_PROD');
  }

  /**
   * Approve + merge the open PR (approver-only). Derives DEV_MERGED or PROD_MERGED
   * depending on the candidate's current stage. → callable `approveAndMerge`.
   */
  approveAndMerge(rc: ReleaseCandidate): Promise<ActionResult> {
    const next: RcStatus = rc.status === 'PR_TO_PROD' ? 'PROD_MERGED' : 'DEV_MERGED';
    const base = rc.status === 'PR_TO_PROD' ? 'production' : 'development';
    const prNumber = rc.status === 'PR_TO_PROD' ? rc.prProdNumber : rc.prDevNumber;
    return this.invoke('approveAndMerge', rc, { repo: rc.repo, base, prNumber }, next);
  }

  // ----------------------------------------------------------------------------------------

  /** Shared call path: mock-logs or invokes the named callable. */
  private async invoke(
    name: string,
    rc: ReleaseCandidate,
    payload: Record<string, unknown>,
    optimisticNext: RcStatus,
    okToReleaseBy?: string,
  ): Promise<ActionResult> {
    if (this.useMock) {
      // eslint-disable-next-line no-console
      console.info(`[mock] would call Cloud Function "${name}"`, payload);
      this.applyMock(rc.id, optimisticNext, okToReleaseBy);
      return { ok: true, message: `(mock) ${name} → ${optimisticNext}`, nextStatus: optimisticNext };
    }

    const callable = httpsCallable<typeof payload, ActionResult>(this.fns, name);
    const res = await callable(payload);
    return res.data;
  }

  /** Optimistic local mutation so mock-mode buttons visibly advance the board. */
  private applyMock(id: string, next: RcStatus, okToReleaseBy?: string): void {
    this.mockStore.update((list) =>
      list.map((rc) =>
        rc.id === id
          ? {
              ...rc,
              status: next,
              okToReleaseBy: next === 'OK_TO_RELEASE' ? okToReleaseBy ?? rc.okToReleaseBy : rc.okToReleaseBy,
              updatedAt: new Date().toISOString(),
            }
          : rc,
      ),
    );
  }
}
