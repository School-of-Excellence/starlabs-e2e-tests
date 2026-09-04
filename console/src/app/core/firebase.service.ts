import { Injectable, signal, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, of, map } from 'rxjs';
import {
  Firestore,
  collection,
  query,
  orderBy,
  where,
  collectionData,
  doc,
  docData,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  deleteField,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Storage, ref, getDownloadURL } from '@angular/fire/storage';
import { getDocs } from '@angular/fire/firestore';
import {
  ReleaseCandidate,
  RcStatus,
  ActivityLogEntry,
  GateVerdict,
  UserPrefs,
  toMillis,
  isProtectedBranch,
  MobilePlatform,
  MobileDeliveryFacet,
  mobileAggregateVerdict,
} from './release-candidate.model';
import { Member } from './roles';
import { AuthService } from './auth.service';
import { CfFunctionDoc, CfBranchInfo } from './cf-board.model';
import { CicdAuditRun, ReportJson } from './cicd-audit.model';
import { DEFAULT_CF_REPO, DEFAULT_CF_BRANCH } from './repos';
import {
  MOCK_RELEASE_CANDIDATES,
  MOCK_ACTIVITY,
  MOCK_MEMBERS,
  MOCK_USER_PREFS,
  MOCK_SUITES_MANIFEST,
  MOCK_CF_FUNCTIONS,
  MOCK_CF_BRANCHES,
  MOCK_AUDIT_RUNS,
  MOCK_REPORT_JSONS,
} from './mock-data';
import { environment } from '../../environments/environment';

/** Empty prefs — the default when a user has no `user-prefs/{email}` doc yet. */
const EMPTY_PREFS: UserPrefs = { pinnedBranchIds: [] };

/** Result of an action call (Cloud Function callable response, normalized). */
export interface ActionResult {
  ok: boolean;
  message: string;
}

/** One suite entry in the Test Run dialog (planTestRun response; master plan L5). */
export interface PlannedSuite {
  suite: string;
  title: string;
  description: string;
  /** Mandatory entries only: WHY it's locked — the matched file + glob. */
  reason?: string;
}

/** The Test Run dialog's plan: locked suites (with reasons) + the optional catalogue. */
export interface TestPlan {
  mandatory: PlannedSuite[];
  optional: PlannedSuite[];
  crossCutting: boolean;
  changedFileCount: number;
}

/** What the Test Run dialog resolves with on Confirm (plan L4/L5). */
export interface TestRunChoice {
  suites: string[];
  cfRepo: string;
  cfBranch: string;
}

/** Options for deployPreview — "with tests" carries the dialog's choice (plan L5). */
export interface DeployOptions {
  runTests: boolean;
  suites?: string[];
  cfRepo?: string;
  cfBranch?: string;
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
  private readonly auth = inject(AuthService);
  private readonly store = inject(Storage);

  /** Local facet store used by mock mode so optimistic mutations are visible. */
  private readonly mockStore = signal<ReleaseCandidate[]>(
    structuredClone(MOCK_RELEASE_CANDIDATES),
  );
  /** Local activity + member stores for mock mode. */
  private readonly mockActivity = signal<ActivityLogEntry[]>(
    structuredClone(MOCK_ACTIVITY),
  );
  private readonly mockMembers = signal<Member[]>(structuredClone(MOCK_MEMBERS));
  /** Per-user prefs (pins) for mock mode — hydrated from localStorage so pins persist a reload. */
  private readonly mockPrefs = signal<UserPrefs>(this.loadMockPrefs());
  private readonly mockPrefs$ = toObservable(this.mockPrefs);
  /** CF Board fixtures (mock mode) — matrix stream + branch list, mutable for optimistic PRs. */
  private readonly mockCfFns = signal<CfFunctionDoc[]>(structuredClone(MOCK_CF_FUNCTIONS));
  private readonly mockCfFunctions$ = toObservable(this.mockCfFns);
  private readonly mockCfBranches = signal<CfBranchInfo[]>(structuredClone(MOCK_CF_BRANCHES));
  private readonly mockCfBranches$ = toObservable(this.mockCfBranches);

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

  // --- Pin (per-user prefs) & Mute (global) — usability plan 2026-07-02 -----------------------

  private prefsKey(): string {
    return `rc-user-prefs:${(this.auth.user()?.email ?? 'mock').toLowerCase()}`;
  }
  /** Hydrate mock pins from localStorage, falling back to the seeded fixture. */
  private loadMockPrefs(): UserPrefs {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this.prefsKey()) : null;
      if (raw) return { ...EMPTY_PREFS, ...(JSON.parse(raw) as UserPrefs) };
    } catch {
      /* ignore malformed cache */
    }
    return structuredClone(MOCK_USER_PREFS);
  }

  /**
   * Stream of the signed-in user's prefs (pins). MOCK: signal-backed (re-emits on toggle).
   * LIVE: docData(user-prefs/{email}); emits EMPTY_PREFS until the doc exists.
   */
  userPrefs(): Observable<UserPrefs> {
    if (this.useMock) return this.mockPrefs$;
    const email = this.auth.user()?.email?.toLowerCase();
    if (!email) return of(EMPTY_PREFS);
    const ref = doc(this.fs, 'user-prefs', email);
    return docData(ref).pipe(map((p) => ({ ...EMPTY_PREFS, ...(p as UserPrefs) })));
  }

  /**
   * Pin / unpin a branch for the signed-in developer (private prefs). MOCK: signal + localStorage.
   * LIVE: setDoc(user-prefs/{email}, arrayUnion|arrayRemove, merge). No confirmation (frictionless).
   */
  async setPin(branchId: string, pinned: boolean): Promise<void> {
    if (this.useMock) {
      this.mockPrefs.update((p) => {
        const set = new Set(p.pinnedBranchIds);
        if (pinned) set.add(branchId);
        else set.delete(branchId);
        const next = { ...p, pinnedBranchIds: [...set] };
        try {
          localStorage.setItem(this.prefsKey(), JSON.stringify(next));
        } catch {
          /* ignore quota / private-mode */
        }
        return next;
      });
      return;
    }
    const email = this.auth.user()?.email?.toLowerCase();
    if (!email) return;
    const ref = doc(this.fs, 'user-prefs', email);
    await setDoc(
      ref,
      { pinnedBranchIds: pinned ? arrayUnion(branchId) : arrayRemove(branchId) },
      { merge: true },
    );
  }

  /**
   * Mute / unmute a branch GLOBALLY (Working Branches). MOCK: mutate the store. LIVE: patch ONLY
   * the three mute fields on the release-candidate doc (`mutedAt` as a Firestore Timestamp via
   * serverTimestamp — never an ISO string). The narrow field-level rule in firestore.rules is what
   * permits this client write while all other RC writes stay server-only.
   */
  async setMute(rc: ReleaseCandidate, muted: boolean): Promise<void> {
    const email = this.auth.user()?.email ?? '(unknown)';
    if (this.useMock) {
      this.mockStore.update((list) =>
        list.map((x) =>
          x.id === rc.id
            ? muted
              ? { ...x, mutedSha: x.headSha, mutedBy: email, mutedAt: new Date().toISOString() }
              : { ...x, mutedSha: undefined, mutedBy: undefined, mutedAt: undefined }
            : x,
        ),
      );
      return;
    }
    const ref = doc(this.fs, 'release-candidates', rc.id);
    await updateDoc(
      ref,
      muted
        ? { mutedSha: rc.headSha, mutedBy: email, mutedAt: serverTimestamp() }
        : { mutedSha: deleteField(), mutedBy: deleteField(), mutedAt: deleteField() },
    );
  }

  /**
   * Deterministic preview-channel URL for a branch (plan D10).
   * slug = branch lowercased, `/`→`-`, strip non `[a-z0-9-]`, cap 40 chars.
   */
  previewUrlFor(repo: string, branch: string): string {
    const branchId = branch
      .toLowerCase()
      .replace(/\//g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 40);
    return `https://breakthroughs-test-${branchId}.web.app`;
  }

  /**
   * "View report" target for a gate run (in-console report plan, LOCKED 2026-07-02): the
   * IN-APP route `/report/:githubRunId` when a report run id exists — the Report screen
   * resolves the per-suite `cicd-audit` docs from there. Falls back to the GitHub Actions
   * run page (external) only when no run id was ever recorded. The standalone dashboard
   * (`historyDashboardUrl`) is superseded and no longer used.
   * Convention: a return value starting with '/' is an internal route (use routerLink);
   * anything else is an external href.
   */
  reportUrlFor(rc: ReleaseCandidate): string | null {
    const g = rc.gateRun;
    if (!g) return null;
    if (g.reportRunId) return `/report/${encodeURIComponent(g.reportRunId)}`;
    return g.runUrl ?? null;
  }

  // --- Test orchestration (master plan 2026-07-02, L2/L4/L5/L6) -------------------------------

  /**
   * The suites catalogue — ONE DOC PER SUITE in `test-suites/{key}` (lane-1 lock, 2026-07-03),
   * mirrored one-way from hub suites-manifest.json. Read-only stream for the Test Suites screen.
   */
  testSuites(): Observable<Record<string, unknown>[]> {
    if (this.useMock) {
      const suites = MOCK_SUITES_MANIFEST.suites as Record<string, unknown>;
      return of(Object.entries(suites).map(([key, s]) => ({ key, ...(s as object) })));
    }
    const col = collection(this.fs, 'test-suites');
    return collectionData(query(col, orderBy('key'))) as Observable<Record<string, unknown>[]>;
  }

  /** The slim mirror meta doc: version, crossCutting, cfPredeploy, mirroredAt, source. */
  suitesMeta(): Observable<{
    version?: number;
    crossCutting?: { appPaths?: string[]; cfPaths?: string[] } | null;
    cfPredeploy?: { description?: string; specs?: string[]; config?: string } | null;
    mirroredAt?: number;
    source?: string;
  } | null> {
    if (this.useMock) {
      return of({
        version: 1,
        crossCutting: MOCK_SUITES_MANIFEST.crossCutting,
        cfPredeploy: null,
        mirroredAt: Date.now() - 3600_000,
        source: 'hub@main (mock)',
      });
    }
    const refDoc = doc(this.fs, 'console-config', 'suites');
    return docData(refDoc).pipe(map((d) => (d ?? null))) as Observable<{
      version?: number;
      crossCutting?: { appPaths?: string[]; cfPaths?: string[] } | null;
      cfPredeploy?: { description?: string; specs?: string[]; config?: string } | null;
      mirroredAt?: number;
      source?: string;
    } | null>;
  }

  /** Live stream of the push-mirrored CF branch records (Branches tab; operator flow 2026-07-03). */
  cfBranches(): Observable<CfBranchInfo[]> {
    if (this.useMock) return this.mockCfBranches$;
    const col = collection(this.fs, 'cf-branches');
    // The stored doc keys the branch name as `branch` (CfBranchDoc); the frontend model + template
    // read `name`. Without this remap every row has name===undefined → track collisions, a blank
    // branch label, and `expanded().has(undefined)` true for ALL rows (expand-one-expands-all).
    return (collectionData(query(col, orderBy('updatedAt', 'desc'))) as Observable<any[]>).pipe(
      map((docs) => docs.map((d) => ({ ...d, name: d.name ?? d.branch })) as CfBranchInfo[]),
    );
  }

  /** Ask the backend which suites MUST run for this branch (+ why) and which are optional. */
  async planTestRun(repo: string, branch: string): Promise<TestPlan> {
    if (this.useMock) {
      const suites = (MOCK_SUITES_MANIFEST.suites ?? {}) as Record<
        string,
        { title?: string; description?: string; ciReady?: boolean }
      >;
      const entries = Object.entries(suites).filter(([, s]) => s.ciReady);
      return {
        mandatory: entries
          .filter(([k]) => k === 'queue' || k === 'journey')
          .map(([k, s]) => ({
            suite: k,
            title: s.title ?? k,
            description: s.description ?? '',
            reason: `src/app/${k === 'queue' ? 'queue system' : 'Journey Onboarding'}/… matched (mock)`,
          })),
        optional: entries
          .filter(([k]) => k !== 'queue' && k !== 'journey')
          .map(([k, s]) => ({ suite: k, title: s.title ?? k, description: s.description ?? '' })),
        crossCutting: false,
        changedFileCount: 7,
      };
    }
    const callable = httpsCallable<{ repo: string; branch: string }, TestPlan & { ok: boolean }>(
      this.fns,
      'planTestRun',
    );
    const res = await callable({ repo, branch });
    return res.data;
  }

  /** Test-only gate dispatch — the [Run tests…] button on any card (L6). */
  runTests(
    rc: ReleaseCandidate,
    choice: TestRunChoice,
  ): Promise<ActionResult> {
    return this.invoke(
      'runTests',
      { repo: rc.repo, branch: rc.branch, suites: choice.suites, cfRepo: choice.cfRepo, cfBranch: choice.cfBranch },
      () => this.applyGateQueued(rc.id),
      `run tests [${choice.suites.join(', ')}] on ${rc.branch}`,
    );
  }

  // --- CF Board (master plan L15–L19) ----------------------------------------------------------

  /** Live stream of the per-function Dev/Prod deploy matrix (Functions tab). */
  cfFunctions(): Observable<CfFunctionDoc[]> {
    if (this.useMock) return this.mockCfFunctions$;
    const col = collection(this.fs, 'cf-functions');
    return collectionData(query(col, orderBy('name'))) as Observable<CfFunctionDoc[]>;
  }

  /** GitHub-derived branch list for the Branches tab (on-demand — refresh button). */
  async listCfBranches(repo = DEFAULT_CF_REPO): Promise<CfBranchInfo[]> {
    if (this.useMock) return structuredClone(this.mockCfBranches());
    const callable = httpsCallable<{ repo: string }, { ok: boolean; branches: CfBranchInfo[] }>(
      this.fns,
      'listCfBranches',
    );
    const res = await callable({ repo });
    return res.data.branches ?? [];
  }

  /** Create PR → development for a CF branch (precondition = pushed + not merged, plan L18). */
  createCfPr(repo: string, branch: string): Promise<ActionResult> {
    return this.invoke(
      'createPullRequest',
      { repo, head: branch, base: 'development' },
      () => this.applyMockCfPr(branch),
      `open PR → dev for ${repo}/${branch}`,
    );
  }

  // --- Report screen data (in-console report plan 2026-07-02 + D1/D2) --------------------------

  /** All per-suite audit docs of one workflow run (matrix: one doc per suite). */
  async auditRunsFor(githubRunId: string): Promise<CicdAuditRun[]> {
    if (this.useMock) {
      return MOCK_AUDIT_RUNS.filter((r) => r.githubRunId === githubRunId);
    }
    const col = collection(this.fs, 'cicd-audit');
    const snap = await getDocs(query(col, where('githubRunId', '==', githubRunId)));
    return snap.docs
      .map((d) => d.data() as CicdAuditRun)
      .sort((a, b) => (a.suite ?? '').localeCompare(b.suite ?? ''));
  }

  /** Fetch + parse the machine-readable per-test report for one suite run. */
  async reportJson(run: CicdAuditRun): Promise<ReportJson | null> {
    const ptr = run.storage?.reportJson;
    if (!ptr) return null;
    if (this.useMock) return MOCK_REPORT_JSONS[ptr] ?? null;
    try {
      const url = await getDownloadURL(ref(this.store, ptr));
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return (await resp.json()) as ReportJson;
    } catch {
      return null;
    }
  }

  /** Resolve a gs:// artifact (failure screenshot / video) to a tokened download URL. */
  async artifactUrl(gsPath: string): Promise<string | null> {
    if (this.useMock) return null;
    try {
      return await getDownloadURL(ref(this.store, gsPath));
    } catch {
      return null;
    }
  }

  // --- Actions (each → a callable Cloud Function on starlabs-cicd) ---------------------------
  // The server re-checks capability + workflow state (plan §7). These methods marshal the
  // call; action-gating.ts + AuthService gate the buttons client-side for UX.

  /**
   * Fire the manual preview build → `workflow_dispatch` on preview.yml (D5). → `deployPreview`.
   * With `opts` (plan L5): runTests=false → preview only ("Deploy without tests");
   * runTests=true + suites/CF source → the gate matrix runs alongside the build.
   * No opts (legacy callers) → old behavior: build + fallback-routed gate.
   */
  deployPreview(rc: ReleaseCandidate, opts?: DeployOptions): Promise<ActionResult> {
    const payload: Record<string, unknown> = { repo: rc.repo, branch: rc.branch };
    if (opts) {
      payload['runTests'] = opts.runTests;
      if (opts.runTests) {
        if (opts.suites?.length) payload['suites'] = opts.suites;
        payload['cfRepo'] = opts.cfRepo ?? DEFAULT_CF_REPO;
        payload['cfBranch'] = opts.cfBranch ?? DEFAULT_CF_BRANCH;
      }
    }
    const label =
      opts?.runTests === false
        ? `deploy preview (no tests) for ${rc.branch}`
        : opts?.suites?.length
          ? `deploy preview + tests [${opts.suites.join(', ')}] for ${rc.branch}`
          : `deploy preview for ${rc.branch}`;
    return this.invoke(
      'deployPreview',
      payload,
      () => this.applyPreviewBuilding(rc.id),
      label,
    );
  }

  /** Tester sign-off on the preview channel (OK for dev, D4). → `signoff` stage=dev.
   *  FLUTTER: pass `platform` — sign-off is per-platform; the aggregate gate turns OK when every
   *  delivered platform is signed off (plan 2026-07-14). */
  signoffDev(
    rc: ReleaseCandidate,
    verdict: 'OK' | 'REJECTED',
    note?: string,
    platform?: MobilePlatform,
  ): Promise<ActionResult> {
    return this.invoke(
      'signoff',
      { repo: rc.repo, branch: rc.branch, stage: 'dev', verdict, note, ...(platform ? { platform } : {}) },
      () =>
        platform
          ? this.applyMobileSignoff(rc.id, 'dev', verdict, platform, note)
          : this.applyGate(rc.id, 'dev', verdict, note),
      `sign-off dev (${verdict}${platform ? '/' + platform : ''}) for ${rc.branch}`,
    );
  }

  /** Tester sign-off on the dev deploy (safe for prod, D4). → `signoff` stage=prod. */
  signoffProd(
    rc: ReleaseCandidate,
    verdict: 'OK' | 'REJECTED',
    note?: string,
    platform?: MobilePlatform,
  ): Promise<ActionResult> {
    return this.invoke(
      'signoff',
      { repo: rc.repo, branch: rc.branch, stage: 'prod', verdict, note, ...(platform ? { platform } : {}) },
      () =>
        platform
          ? this.applyMobileSignoff(rc.id, 'prod', verdict, platform, note)
          : this.applyGate(rc.id, 'prod', verdict, note),
      `sign-off prod (${verdict}${platform ? '/' + platform : ''}) for ${rc.branch}`,
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

  /**
   * ADMIN SHORTCUT (2026-07-04) — "Promote & Create PR → prod": the admin self-validates the dev
   * deploy (prod sign-off) AND opens the development → production PR in one action, instead of
   * waiting for a separate tester validation. Reuses the callables the admin is already authorized
   * for (SIGNOFF_DEV_PROD + CREATE_PR_PROD); the self-sign-off is written to the audit log. STOP-ON-
   * ERROR: if the sign-off fails we never open the PR; if the PR fails the sign-off remains
   * (promotable = true) so the normal "Create PR → prod" button finishes it.
   */
  async promoteAndPrToProd(devRc: ReleaseCandidate): Promise<ActionResult> {
    const signoff = await this.signoffProd(devRc, 'OK');
    if (!signoff.ok) return signoff;
    return this.createPrToProd(devRc);
  }

  /**
   * ADMIN SHORTCUT (2026-07-04) — "Deploy & create PR → Dev": self-sign-off for dev + open the
   * feature → development PR, then fire the preview build (with tests, for the record). Reuses
   * SIGNOFF_PREVIEW_DEV + CREATE_PR_DEV + DEPLOY_PREVIEW (all admin-held). Order sign-off → PR →
   * deploy so the build's PREVIEW_BUILDING status can't race the PR's OK_FOR_DEV precondition.
   * STOP-ON-ERROR at each step; a failed final deploy leaves the PR open (retry via the Deploy menu).
   */
  async deployAndPrToDev(rc: ReleaseCandidate, opts: DeployOptions): Promise<ActionResult> {
    const signoff = await this.signoffDev(rc, 'OK');
    if (!signoff.ok) return signoff;
    const pr = await this.createPrToDev(rc);
    if (!pr.ok) return pr;
    return this.deployPreview(rc, opts);
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

  /**
   * TEST/MOCK ONLY — simulate a reviewer MERGING the open PR on GitHub (the webhook event the
   * console can never fire itself, since D3: the console never merges). This faithfully replicates
   * the backend `handlePullRequest` MERGE path so the post-merge state can be tested end-to-end:
   *  - feature→dev merge  → prDev MERGED · feature.unreleased=true · development.hasUnreleased=true
   *  - dev→prod merge     → prProd MERGED · clear development hasUnreleased/promotable/prodGate ·
   *                         clear `unreleased` on every feature of the repo (batch shipped)
   */
  mockMerge(id: string): void {
    if (!this.useMock) return;
    const now = new Date().toISOString();
    this.mockStore.update((list) => {
      const target = list.find((rc) => rc.id === id);
      if (!target) return list;
      const isProdMerge = target.prProd?.state === 'OPEN';
      const isDevMerge = !isProdMerge && target.prDev?.state === 'OPEN';
      let next = list.map((rc) => {
        if (rc.id !== id) return rc;
        if (isProdMerge) {
          return {
            ...rc,
            prProd: { ...rc.prProd, state: 'MERGED' as const },
            hasUnreleased: false,
            promotable: false,
            prodGate: { verdict: 'NONE' as GateVerdict },
            derivedStatus: 'PROD_MERGED' as RcStatus,
            lastDeploymentState: rc.lastDeploymentState,
            updatedAt: now,
          };
        }
        if (isDevMerge) {
          return {
            ...rc,
            prDev: { ...rc.prDev, state: 'MERGED' as const },
            unreleased: true,
            derivedStatus: 'DEV_MERGED' as RcStatus,
            updatedAt: now,
          };
        }
        return rc;
      });
      if (isProdMerge) {
        next = next.map((rc) =>
          rc.repo === target.repo && !isProtectedBranch(rc.branch) && rc.unreleased
            ? { ...rc, unreleased: false, updatedAt: now }
            : rc,
        );
      }
      if (isDevMerge) {
        next = next.map((rc) =>
          rc.repo === target.repo && rc.branch === 'development'
            ? { ...rc, hasUnreleased: true, updatedAt: now }
            : rc,
        );
      }
      return next;
    });
  }

  private applyPreviewBuilding(id: string): void {
    this.patch(id, (rc) => ({
      ...rc,
      preview: { ...rc.preview, sha: rc.headSha, buildState: 'BUILDING' },
      derivedStatus: 'PREVIEW_BUILDING',
      lastActivity: { type: 'preview_dispatch', sha: rc.headSha, at: new Date().toISOString() },
    }));
    // MOCK ONLY: simulate CI finishing the preview build so the feature lane is fully clickable.
    setTimeout(() => {
      this.patch(id, (rc) =>
        rc.preview.buildState !== 'BUILDING'
          ? rc
          : {
              ...rc,
              preview: {
                ...rc.preview,
                sha: rc.headSha,
                url: this.previewUrlFor(rc.repo, rc.branch),
                buildState: 'LIVE',
                builtAt: new Date().toISOString(),
              },
              derivedStatus: rc.derivedStatus === 'PREVIEW_BUILDING' ? 'PREVIEW_LIVE' : rc.derivedStatus,
              lastActivity: { type: 'preview_build', sha: rc.headSha, at: new Date().toISOString(), actor: 'github-actions' },
            },
      );
    }, 1200);
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
        // Mirror the backend's computePromotable: a tester OK on a SUCCESSFUL dev deploy makes the
        // development candidate promotable → Create PR → prod enables.
        promotable: verdict === 'OK' && rc.lastDeploymentState === 'success' && !!rc.hasUnreleased,
        derivedStatus: verdict === 'OK' ? 'OK_FOR_PROD' : rc.derivedStatus,
        lastActivity: { type: 'signoff_prod', sha: rc.headSha, at },
      };
    });
  }

  /** MOCK optimistic per-platform sign-off (flutter): record the platform verdict, recompute the
   *  aggregate gate + derivedStatus exactly like the backend. */
  private applyMobileSignoff(
    id: string,
    stage: 'dev' | 'prod',
    verdict: GateVerdict,
    platform: MobilePlatform,
    note?: string,
  ): void {
    this.patch(id, (rc) => {
      const at = new Date().toISOString();
      const md: MobileDeliveryFacet = {
        ...(rc.mobileDelivery ?? {}),
        [platform]: {
          ...(rc.mobileDelivery?.[platform] ?? {}),
          [stage === 'dev' ? 'devSignoff' : 'prodSignoff']: {
            verdict,
            sha: rc.headSha,
            by: '(me)',
            at,
          },
        },
      };
      const aggregate = mobileAggregateVerdict(md, stage, rc.headSha);
      const gateKey = stage === 'dev' ? 'devGate' : 'prodGate';
      const derivedStatus: RcStatus =
        aggregate === 'OK' ? (stage === 'dev' ? 'OK_FOR_DEV' : 'OK_FOR_PROD') : rc.derivedStatus;
      return {
        ...rc,
        mobileDelivery: md,
        [gateKey]: { ...rc[gateKey], verdict: aggregate, sha: rc.headSha, at },
        ...(stage === 'prod'
          ? {
              promotable:
                aggregate === 'OK' && rc.lastDeploymentState === 'success' && !!rc.hasUnreleased,
            }
          : {}),
        derivedStatus,
        lastActivity: { type: stage === 'dev' ? 'signoff_dev' : 'signoff_prod', sha: rc.headSha, at },
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

  /** MOCK: a dispatched test run — gateRun QUEUED → RUNNING → PASSED with a demo report id. */
  private applyGateQueued(id: string): void {
    const at = new Date().toISOString();
    this.patch(id, (rc) => ({
      ...rc,
      gateRun: { ...(rc.gateRun ?? {}), status: 'QUEUED', at, sha: rc.headSha },
      lastActivity: { type: 'gate_run', sha: rc.headSha, at, actor: '(me)' },
    }));
    setTimeout(() => this.patch(id, (rc) =>
      rc.gateRun?.status === 'QUEUED'
        ? { ...rc, gateRun: { ...rc.gateRun, status: 'RUNNING' } }
        : rc,
    ), 1000);
    setTimeout(() => this.patch(id, (rc) =>
      rc.gateRun?.status === 'RUNNING'
        ? {
            ...rc,
            gateRun: {
              ...rc.gateRun,
              status: 'PASSED',
              runId: '7050',
              reportRunId: '7050',
              runUrl: `https://github.com/School-of-Excellence/${rc.repo}/actions/runs/7050`,
              at: new Date().toISOString(),
            },
            testSummary: { conclusion: 'success', at: new Date().toISOString() },
          }
        : rc,
    ), 3500);
  }

  /** MOCK: reflect a just-created CF PR on the Branches tab fixture. */
  private applyMockCfPr(branch: string): void {
    const number = Math.floor(1000 + Math.random() * 9000);
    this.mockCfBranches.update((list) =>
      list.map((b) =>
        b.name === branch
          ? { ...b, pr: { number, url: `https://github.com/School-of-Excellence/starlabs-cloud-function/pull/${number}` } }
          : b,
      ),
    );
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
