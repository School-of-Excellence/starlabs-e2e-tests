import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirebaseService } from '../../core/firebase.service';
import { ConfirmService } from '../../shared/confirm.service';
import { ToastService } from '../../shared/toast.service';
import { CfBranchInfo, CfFunctionDoc, cfDrift, cfStateOf } from '../../core/cf-board.model';
import { cfRepos, DEFAULT_CF_REPO } from '../../core/repos';

type MatrixFilter = 'all' | 'dev-only' | 'prod-only' | 'drift' | 'orphaned';
type BranchFilter = 'all' | 'unmerged' | 'merged';

/**
 * CF Board (master plan 2026-07-02, L15–L19) — developer/admin only (route-guarded).
 *
 * BRANCHES tab: GitHub-derived (listCfBranches callable, ↻ on demand) — every CF branch with its
 * last commit, ~changed functions vs production (expandable names+types — approximation, L19),
 * and the merge state (Create PR → Dev / PR open / ✔ Merged). NO CI gate runs on the PR (L13):
 * the CF quality gate already ran locally at predeploy.
 *
 * FUNCTIONS tab: the live Dev/Prod deploy matrix (cf-functions stream) — "at any given moment,
 * which functions are deployed in both or only one" — with DRIFT (dev sha ≠ prod sha) and
 * ORPHANED (deployed but gone from the repo) honesty badges. NO report links here by design:
 * the CF gate runs on the laptop, never in CI.
 */
@Component({
  selector: 'rc-cf-board',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './cf-board.component.html',
  styleUrl: './cf-board.component.css',
})
export class CfBoardComponent {
  private readonly fb = inject(FirebaseService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly repoOptions = cfRepos();
  readonly repo = signal(DEFAULT_CF_REPO);
  readonly tab = signal<'branches' | 'functions'>('branches');

  // --- Branches tab ---------------------------------------------------------------------------
  // LIVE STREAM of the push-mirrored cf-branches records (operator flow 2026-07-03) — the webhook
  // keeps them current; ↻ Refresh triggers the GitHub heal/backfill (listCfBranches) which writes
  // back into the same collection, so the stream updates by itself.
  readonly branches = toSignal(this.fb.cfBranches(), { initialValue: [] as CfBranchInfo[] });
  readonly branchesLoading = signal(false);
  readonly branchesError = signal<string | null>(null);
  readonly branchFilter = signal<BranchFilter>('all');
  readonly expanded = signal<Set<string>>(new Set());
  readonly prBusy = signal<string | null>(null);

  readonly visibleBranches = computed(() => {
    const f = this.branchFilter();
    return this.branches()
      .filter((b) => (f === 'all' ? true : f === 'merged' ? !!b.mergedToDev : !b.mergedToDev))
      .sort((a, b) => (b.lastCommit?.at ?? 0) - (a.lastCommit?.at ?? 0));
  });

  // --- Functions (matrix) tab -------------------------------------------------------------------
  private readonly fns = toSignal(this.fb.cfFunctions(), { initialValue: [] as CfFunctionDoc[] });
  readonly matrixFilter = signal<MatrixFilter>('all');

  // Filters/chips read the SERVER-DERIVED state/drift (Option A, 2026-07-03) via the stored-first
  // helpers — the client never re-invents the collapse logic.
  readonly matrix = computed(() => {
    const list = this.fns();
    const f = this.matrixFilter();
    return list.filter((x) => {
      switch (f) {
        case 'dev-only': return cfStateOf(x) === 'dev-only';
        case 'prod-only': return cfStateOf(x) === 'prod-only';
        case 'drift': return cfDrift(x);
        case 'orphaned': return !!x.orphaned;
        default: return true;
      }
    });
  });

  readonly counts = computed(() => {
    const list = this.fns();
    return {
      both: list.filter((x) => cfStateOf(x) === 'both').length,
      devOnly: list.filter((x) => cfStateOf(x) === 'dev-only').length,
      prodOnly: list.filter((x) => cfStateOf(x) === 'prod-only').length,
      drift: list.filter((x) => cfDrift(x)).length,
      orphaned: list.filter((x) => x.orphaned).length,
    };
  });

  readonly drift = cfDrift;

  constructor() {
    this.refreshBranches();
  }

  /** GitHub heal/backfill — the callable recomputes + rewrites cf-branches; the stream re-emits. */
  async refreshBranches(): Promise<void> {
    this.branchesLoading.set(true);
    this.branchesError.set(null);
    try {
      await this.fb.listCfBranches(this.repo());
    } catch (e: unknown) {
      this.branchesError.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.branchesLoading.set(false);
    }
  }

  toggleExpand(name: string): void {
    this.expanded.update((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async createPr(b: CfBranchInfo): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Create PR → development',
      message: `Open a pull request ${b.name} → development on ${this.repo()}? The console never merges — review and merge on GitHub.`,
      confirmLabel: 'Create PR',
      details: (b.changedFunctions ?? []).map((f) => `${f.change}: ${f.name} (${f.type})`),
      detailsHeading: 'Functions in this branch:',
    });
    if (!ok) return;
    this.prBusy.set(b.name);
    try {
      const res = await this.fb.createCfPr(this.repo(), b.name);
      this.toast.show(res.ok, res.ok ? `PR opened for ${b.name}` : res.message);
      if (res.ok) await this.refreshBranches();
    } finally {
      this.prBusy.set(null);
    }
  }
}
