import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FirebaseService } from '../../core/firebase.service';
import { AuthService } from '../../core/auth.service';
import {
  ReleaseCandidate,
  ActivityType,
  previewStale,
  signoffStale,
  prHasUnreviewed,
  toMillis,
  isProtectedBranch,
} from '../../core/release-candidate.model';
import {
  RcAction,
  requiredCapability,
  allowedByStatus,
  isFresh,
  gateReason,
} from '../../core/action-gating';
import { StatusChipComponent } from '../../shared/status-chip/status-chip.component';
import { ActivityDrawerComponent, ACTIVITY_LABEL } from '../../shared/activity-drawer/activity-drawer.component';
import {
  FilterBarComponent,
  RcFilter,
  EMPTY_FILTER,
  applyFilter,
} from '../../shared/filter-bar/filter-bar.component';
import { ToastService } from '../../shared/toast.service';

/** A reconcile decision option (plan §5). */
interface ReconcileOption {
  decision: string;
  label: string;
}

const RECONCILE_OPTIONS: ReconcileOption[] = [
  { decision: 're_request_qa', label: 'Re-request QA' },
  { decision: 'close_pr', label: 'Close PR & restart' },
  { decision: 'accept', label: 'Accept / override' },
  { decision: 'investigate', label: 'Investigate' },
];

/**
 * Working Branches (plan §6.2). Viewable by all; act = dev/admin. List sorted by
 * updatedAt desc, each card shows facet badges, a reconcile banner when drift, and
 * the gated Deploy / Create-PR action buttons.
 */
@Component({
  selector: 'rc-working-branches',
  standalone: true,
  imports: [DatePipe, StatusChipComponent, FilterBarComponent, ActivityDrawerComponent],
  templateUrl: './working-branches.component.html',
  styleUrl: './working-branches.component.css',
})
export class WorkingBranchesComponent {
  private readonly fb = inject(FirebaseService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly rcs = toSignal(this.fb.releaseCandidates(), { initialValue: [] as ReleaseCandidate[] });
  readonly filter = signal<RcFilter>(EMPTY_FILTER);
  readonly busy = signal<string | null>(null);
  /** Branch whose activity drawer is open, or null. */
  readonly selected = signal<{ id: string; label: string } | null>(null);

  readonly reconcileOptions = RECONCILE_OPTIONS;

  // Re-export pure helpers to the template.
  readonly previewStale = previewStale;
  readonly signoffStale = signoffStale;
  readonly prHasUnreviewed = prHasUnreviewed;

  readonly filtered = computed(() =>
    applyFilter(this.rcs(), this.filter(), this.auth.user()?.email ?? null)
      .filter((rc) => !isProtectedBranch(rc.branch))
      .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)),
  );

  /** Developers/admins may run reconcile decisions. */
  canAct(): boolean {
    return this.auth.isDeveloper() || this.auth.isAdmin();
  }

  /** The dev-side actions surfaced on this screen, with full gating resolved. */
  actionsFor(rc: ReleaseCandidate): {
    action: RcAction;
    label: string;
    enabled: boolean;
    reason: string | null;
  }[] {
    const defs: { action: RcAction; label: string }[] = [
      { action: 'deployPreview', label: 'Deploy preview' },
      { action: 'createPrToDev', label: 'Create PR → dev' },
      { action: 'createPrToProd', label: 'Create PR → prod' },
    ];
    return defs.map(({ action, label }) => {
      const hasCap = this.auth.hasCapability(requiredCapability(action));
      const byStatus = allowedByStatus(action, rc.derivedStatus);
      const fresh = isFresh(action, rc);
      const enabled = hasCap && byStatus && fresh;
      let reason: string | null = null;
      if (!hasCap) reason = 'Your role does not grant this action.';
      else reason = gateReason(action, rc);
      // Once a preview exists, the deploy action is a re-deploy (for a new commit).
      const finalLabel =
        action === 'deployPreview' && rc.preview.buildState !== 'NONE' ? 'Redeploy preview' : label;
      return { action, label: finalLabel, enabled, reason };
    });
  }

  short(sha?: string): string {
    return sha ? sha.slice(0, 7) : '—';
  }

  buildTone(rc: ReleaseCandidate): string {
    switch (rc.preview.buildState) {
      case 'LIVE':
        return 'ok';
      case 'BUILDING':
        return 'active';
      case 'FAILED':
        return 'bad';
      default:
        return 'none';
    }
  }
  gateTone(v: string): string {
    return v === 'OK' ? 'ok' : v === 'REJECTED' ? 'bad' : 'none';
  }
  prTone(state: string): string {
    return state === 'OPEN' ? 'active' : state === 'MERGED' ? 'merged' : state === 'CLOSED' ? 'bad' : 'none';
  }

  openPrUrl(rc: ReleaseCandidate): string | null {
    if (rc.prProd.state === 'OPEN' && rc.prProd.url) return rc.prProd.url;
    if (rc.prDev.state === 'OPEN' && rc.prDev.url) return rc.prDev.url;
    return null;
  }

  /** Open the right-side activity-log drawer for this branch. */
  openLog(rc: ReleaseCandidate): void {
    this.selected.set({ id: rc.id, label: rc.branch });
  }
  actLabel(t?: string): string {
    return t ? (ACTIVITY_LABEL[t as ActivityType] ?? t) : '—';
  }

  /**
   * Per-state guidance for the card — including the "already in dev/prod, no PR
   * needed" cases the operator asked for.
   */
  stateMessage(rc: ReleaseCandidate): { text: string; tone: string } {
    switch (rc.derivedStatus) {
      case 'NO_ACTION':
        return { text: 'Deploy a preview to start.', tone: 'muted' };
      case 'PREVIEW_BUILDING':
        return { text: 'Preview build running…', tone: 'active' };
      case 'PREVIEW_FAILED':
        return { text: 'Preview build failed — redeploy.', tone: 'bad' };
      case 'PREVIEW_LIVE':
        return this.previewStale(rc)
          ? { text: 'Preview is live, but a newer commit exists — redeploy to update it.', tone: 'active' }
          : { text: 'Preview live & up to date — awaiting tester sign-off for dev.', tone: 'muted' };
      case 'OK_FOR_DEV':
        return { text: 'Signed off — open the PR → development.', tone: 'ok' };
      case 'PR_TO_DEV':
        return { text: 'PR → dev is open — review & merge on GitHub.', tone: 'active' };
      case 'DEV_MERGED':
        return { text: 'Already in development — no PR to dev needed. Awaiting prod sign-off.', tone: 'ok' };
      case 'OK_FOR_PROD':
        return { text: 'Signed off for prod — open the PR → production.', tone: 'ok' };
      case 'PR_TO_PROD':
        return { text: 'PR → prod is open — review & merge on GitHub.', tone: 'active' };
      case 'PROD_MERGED':
        return { text: 'Shipped to production — no PR needed, nothing more to do.', tone: 'ok' };
      default:
        return { text: '', tone: 'muted' };
    }
  }

  /** "View report" deep-link for the gate run (cicd-audit dashboard or run page). */
  reportUrl(rc: ReleaseCandidate): string | null {
    return this.fb.reportUrlFor(rc);
  }
  gateRunLabel(s: string): string {
    return s === 'RUNNING' ? 'running…' : s === 'QUEUED' ? 'queued' : s === 'PASSED' ? 'passed' : 'failed';
  }
  gateRunTone(s: string): string {
    return s === 'PASSED' ? 'ok' : s === 'FAILED' ? 'bad' : 'active';
  }

  reconcileTitle(r: string): string {
    return r === 'ANOMALY'
      ? '🔴 Anomaly — out-of-band change'
      : r === 'NEEDS_DECISION'
        ? '⚠ Needs a decision'
        : 'ℹ Benign drift';
  }
  reconcileDesc(r: string): string {
    return r === 'ANOMALY'
      ? 'An event skipped required milestones. Investigate and record a decision.'
      : r === 'NEEDS_DECISION'
        ? 'Code moved past a sign-off or PR. The open PR may ship unreviewed code.'
        : 'New content landed but gates are intact.';
  }

  async run(rc: ReleaseCandidate, action: RcAction): Promise<void> {
    this.busy.set(rc.id);
    try {
      const res =
        action === 'deployPreview'
          ? await this.fb.deployPreview(rc)
          : action === 'createPrToDev'
            ? await this.fb.createPrToDev(rc)
            : await this.fb.createPrToProd(rc);
      this.toast.show(res.ok, res.message);
    } finally {
      this.busy.set(null);
    }
  }

  async decide(rc: ReleaseCandidate, decision: string): Promise<void> {
    this.busy.set(rc.id);
    try {
      const res = await this.fb.reconcileDecision(rc, decision);
      this.toast.show(res.ok, res.message);
    } finally {
      this.busy.set(null);
    }
  }
}
