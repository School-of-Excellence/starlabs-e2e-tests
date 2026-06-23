import { Injectable, signal, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';
import {
  Firestore,
  collection,
  query,
  orderBy,
  where,
  collectionData,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import {
  ReleaseCandidate,
  RcStatus,
  ActivityLogEntry,
  GateVerdict,
  toMillis,
} from './release-candidate.model';
import { Member } from './roles';
import {
  MOCK_RELEASE_CANDIDATES,
  MOCK_ACTIVITY,
  MOCK_MEMBERS,
} from './mock-data';
import { environment } from '../../environments/environment';

/** Result of an action call (Cloud Function callable response, normalized). */
export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Single typed gateway to the starlabs-cicd backend (facet model, plan §3/§7, 2026-06-22):
 *  - reads `release-candidates`, `activity-log`, and `console-config/members` (Firestore,
 *    kept in sync from GitHub webhooks), and
 *  - calls the orchestration Cloud Functions (callable): deployPreview, signoff,
 *    createPullRequest, setMember, reconcileDecision. The console NEVER merges (D3).
 *
 * MOCK-DATA MODE (environment.useMock=true): reads come from in-memory fixtures held in a
 * signal, and action calls log + optimistically mutate the local facet store so the board
 * visibly advances offline with no Firebase project wired up.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly useMock = environment.useMock;

  private readonly fs = inject(Firestore);
  private readonly fns = inject(Functions);

  /** Local facet store used by mock mode so optimistic mutations are visible. */
  private readonly mockStore = signal<ReleaseCandidate[]>(
    structuredClone(MOCK_RELEASE_CANDIDATES),
  );
  /** Local activity + member stores for mock mode. */
  private readonly mockActivity = signal<ActivityLogEntry[]>(
    structuredClone(MOCK_ACTIVITY),
  );
  private readonly mockMembers = signal<Member[]>(structuredClone(MOCK_MEMBERS));

  /** Reactive sorted stream for mock mode — re-emits on every applyMock() call. */
  private readonly mockCandidates$ = toObservable(
    computed(() =>
      [...this.mockStore()].sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)),
    ),
  );

  // --- Reads --------------------------------------------------------------------------------

  /**
   * Stream of release candidates, newest `updatedAt` first.
   * MOCK: a live signal-backed stream so optimistic mutations re-render the board.
   * LIVE: collectionData(query(release-candidates, orderBy updatedAt desc)).
   */
  releaseCandidates(): Observable<ReleaseCandidate[]> {
    if (this.useMock) {
      return this.mockCandidates$;
    }
    const col = collection(this.fs, 'release-candidates');
    return collectionData(query(col, orderBy('updatedAt', 'desc')), {
      idField: 'id',
    }) as Observable<ReleaseCandidate[]>;
  }

  /**
   * Stream of the activity timeline for one branch, eventTime ascending (plan §3.2 / D9).
   * MOCK: filters the in-memory log. LIVE: query(activity-log, where branchId==, orderBy eventTime).
   */
  activityForBranch(branchId: string): Observable<ActivityLogEntry[]> {
    if (this.useMock) {
      return of(
        this.mockActivity()
          .filter((e) => e.branchId === branchId)
          .sort((a, b) => toMillis(a.eventTime) - toMillis(b.eventTime)),
      );
    }
    const col = collection(this.fs, 'activity-log');
    return collectionData(
      query(col, where('branchId', '==', branchId), orderBy('eventTime', 'asc')),
    ) as Observable<ActivityLogEntry[]>;
  }

  /** Stream of console members (for Settings). MOCK: in-memory roster. LIVE: members collection. */
  members(): Observable<Member[]> {
    if (this.useMock) {
      return of(this.mockMembers());
    }
    // Members live one-per-doc in the top-level CICD-Users collection.
    const col = collection(this.fs, 'CICD-Users');
    return collectionData(col) as Observable<Member[]>;
  }

  /**
   * Deterministic preview-channel URL for a branch (plan D10).
   * slug = branch lowercased, `/`→`-`, strip non `[a-z0-9-]`, cap 40 chars.
   */
  previewUrlFor(repo: string, branch: string): string {
    const slug = branch
      .toLowerCase()
      .replace(/\//g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 40);
    return `https://${slug}---breakthroughs-test.web.app`;
  }

  /**
   * "View report" link for the e2e gate run shown on a PR card. Deep-links the
   * cicd-audit history dashboard by githubRunId when configured; otherwise falls
   * back to the GitHub Actions run page (always available).
   */
  reportUrlFor(rc: ReleaseCandidate): string | null {
    const g = rc.gateRun;
    if (!g) return null;
    if (environment.historyDashboardUrl && g.reportRunId) {
      return `${environment.historyDashboardUrl}?githubRunId=${encodeURIComponent(g.reportRunId)}`;
    }
    return g.runUrl ?? null;
  }

  // --- Actions (each → a callable Cloud Function on starlabs-cicd) ---------------------------
  // The server re-checks capability + workflow state (plan §7). These methods marshal the
  // call; action-gating.ts + AuthService gate the buttons client-side for UX.

  /** Fire the manual preview build → `workflow_dispatch` on preview.yml (D5). → `deployPreview`. */
  deployPreview(rc: ReleaseCandidate): Promise<ActionResult> {
    return this.invoke(
      'deployPreview',
      { repo: rc.repo, branch: rc.branch },
      () => this.applyPreviewBuilding(rc.id),
      `deploy preview for ${rc.branch}`,
    );
  }

  /** Tester sign-off on the preview channel (OK for dev, D4). → `signoff` stage=dev. */
  signoffDev(
    rc: ReleaseCandidate,
    verdict: 'OK' | 'REJECTED',
    note?: string,
  ): Promise<ActionResult> {
    return this.invoke(
      'signoff',
      { repo: rc.repo, branch: rc.branch, stage: 'dev', verdict, note },
      () => this.applyGate(rc.id, 'dev', verdict, note),
      `sign-off dev (${verdict}) for ${rc.branch}`,
    );
  }

  /** Tester sign-off on the dev deploy (safe for prod, D4). → `signoff` stage=prod. */
  signoffProd(
    rc: ReleaseCandidate,
    verdict: 'OK' | 'REJECTED',
    note?: string,
  ): Promise<ActionResult> {
    return this.invoke(
      'signoff',
      { repo: rc.repo, branch: rc.branch, stage: 'prod', verdict, note },
      () => this.applyGate(rc.id, 'prod', verdict, note),
      `sign-off prod (${verdict}) for ${rc.branch}`,
    );
  }

  /** Open the PR feature → development (dev merges later on GitHub, D3). → `createPullRequest`. */
  createPrToDev(rc: ReleaseCandidate): Promise<ActionResult> {
    return this.invoke(
      'createPullRequest',
      { repo: rc.repo, head: rc.branch, base: 'development' },
      () => this.applyPr(rc.id, 'dev'),
      `open PR → dev for ${rc.branch}`,
    );
  }

  /** Open the PR development → production. → `createPullRequest`. */
  createPrToProd(rc: ReleaseCandidate): Promise<ActionResult> {
    return this.invoke(
      'createPullRequest',
      { repo: rc.repo, head: rc.branch, base: 'production' },
      () => this.applyPr(rc.id, 'prod'),
      `open PR → prod for ${rc.branch}`,
    );
  }

  /** Admin: add / update a console member (Settings, D1). → `setMember`. */
  setMember(m: Member): Promise<ActionResult> {
    return this.invoke(
      'setMember',
      { ...m },
      () => this.applyMember(m),
      `set member ${m.email}`,
    );
  }

  /** Record a developer's reconciliation decision (plan §5). → `reconcileDecision`. */
  reconcileDecision(
    rc: ReleaseCandidate,
    decision: string,
    reason?: string,
  ): Promise<ActionResult> {
    return this.invoke(
      'reconcileDecision',
      { repo: rc.repo, branch: rc.branch, decision, reason },
      () => this.applyReconcile(rc.id),
      `reconcile ${rc.branch} (${decision})`,
    );
  }

  // --- Call path ----------------------------------------------------------------------------

  /**
   * Shared call path. MOCK: log + run the optimistic local mutation. LIVE: invoke the named
   * callable and normalize its `{ ok, message }` payload (defaults on a bare/empty response).
   */
  private async invoke(
    name: string,
    payload: Record<string, unknown>,
    optimistic: () => void,
    label: string,
  ): Promise<ActionResult> {
    if (this.useMock) {
      // eslint-disable-next-line no-console
      console.info(`[mock] would call Cloud Function "${name}"`, payload);
      optimistic();
      return { ok: true, message: `(mock) ${label}` };
    }

    try {
      const callable = httpsCallable<Record<string, unknown>, Partial<ActionResult>>(
        this.fns,
        name,
      );
      const res = await callable(payload);
      const data = res.data ?? {};
      return { ok: data.ok ?? true, message: data.message ?? `${label} ok` };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, message };
    }
  }

  // --- Optimistic mock mutations (facet store) ----------------------------------------------

  private patch(id: string, fn: (rc: ReleaseCandidate) => ReleaseCandidate): void {
    const now = new Date().toISOString();
    this.mockStore.update((list) =>
      list.map((rc) => (rc.id === id ? { ...fn(rc), updatedAt: now } : rc)),
    );
  }

  private applyPreviewBuilding(id: string): void {
    this.patch(id, (rc) => ({
      ...rc,
      preview: { ...rc.preview, sha: rc.headSha, buildState: 'BUILDING' },
      derivedStatus: 'PREVIEW_BUILDING',
      lastActivity: { type: 'preview_dispatch', sha: rc.headSha, at: new Date().toISOString() },
    }));
  }

  private applyGate(
    id: string,
    stage: 'dev' | 'prod',
    verdict: GateVerdict,
    note?: string,
  ): void {
    this.patch(id, (rc) => {
      const at = new Date().toISOString();
      const gate = {
        verdict,
        sha: rc.headSha,
        at,
        notes: note ? [{ by: '(me)', at, text: note }] : undefined,
      };
      if (stage === 'dev') {
        return {
          ...rc,
          devGate: { ...rc.devGate, ...gate },
          derivedStatus: verdict === 'OK' ? 'OK_FOR_DEV' : rc.derivedStatus,
          lastActivity: { type: 'signoff_dev', sha: rc.headSha, at },
        };
      }
      return {
        ...rc,
        prodGate: { ...rc.prodGate, ...gate },
        derivedStatus: verdict === 'OK' ? 'OK_FOR_PROD' : rc.derivedStatus,
        lastActivity: { type: 'signoff_prod', sha: rc.headSha, at },
      };
    });
  }

  private applyPr(id: string, stage: 'dev' | 'prod'): void {
    this.patch(id, (rc) => {
      const at = new Date().toISOString();
      const number = Math.floor(1000 + Math.random() * 9000);
      const base = stage === 'dev' ? 'development' : 'production';
      const url = `https://github.com/School-of-Excellence/${rc.repo}/pull/${number}`;
      const pr = {
        number,
        url,
        state: 'OPEN' as const,
        headSha: rc.headSha,
        mergeable: true,
        checksState: 'pending',
      };
      if (stage === 'dev') {
        return {
          ...rc,
          prDev: { ...rc.prDev, ...pr },
          derivedStatus: 'PR_TO_DEV',
          lastActivity: { type: 'pr_to_dev', sha: rc.headSha, at, actor: '(me)' },
        };
      }
      return {
        ...rc,
        prProd: { ...rc.prProd, ...pr },
        derivedStatus: 'PR_TO_PROD',
        lastActivity: { type: 'pr_to_prod', sha: rc.headSha, at, actor: '(me)' },
      };
    });
  }

  private applyReconcile(id: string): void {
    this.patch(id, (rc) => ({ ...rc, reconcile: 'IN_SYNC' }));
  }

  private applyMember(m: Member): void {
    this.mockMembers.update((list) => {
      const idx = list.findIndex((x) => x.email.toLowerCase() === m.email.toLowerCase());
      if (idx === -1) return [...list, m];
      const next = [...list];
      next[idx] = { ...next[idx], ...m };
      return next;
    });
  }
}
