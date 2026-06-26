import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FirebaseService } from '../../core/firebase.service';
import { AuthService } from '../../core/auth.service';
import {
  ReleaseCandidate,
  RcStatus,
  ActivityType,
  previewStale,
  signoffStale,
  prHasUnreviewed,
  toMillis,
  isProtectedBranch,
} from '../../core/release-candidate.model';
import { STATUS_META } from '../../core/status-meta';
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

/** Which lane a candidate belongs to (promotion-chain architecture, 2026-06-24). */
type BranchKind = 'feature' | 'development' | 'production';

/**
 * Working Branches (promotion-chain architecture, plan 2026-06-24).
 *
 * Three sections:
 *  - Feature branches — per-feature dev lane (Deploy preview → Create PR → dev). Terminal DEV_MERGED.
 *  - Development — lists incoming feature→development PRs + their gate reports; the only action is
 *    Create PR → production (the promotion, head='development').
 *  - Production — shows the incoming development→production PR + its report. No action (terminal).
 *
 * The console never merges (D3): it issues PR-create intents; humans accept/deny on GitHub and the
 * webhook mirrors the result back here.
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

  // Re-export pure helpers to the template.
  readonly previewStale = previewStale;
  readonly signoffStale = signoffStale;
  readonly prHasUnreviewed = prHasUnreviewed;

  /** Feature cards: every non-protected branch (the per-feature dev lane). */
  readonly features = computed(() =>
    applyFilter(this.rcs(), this.filter(), this.auth.user()?.email ?? null)
      .filter((rc) => !isProtectedBranch(rc.branch))
      .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)),
  );

  /** Development entries (one per repo) — the promotion hub. */
  readonly devEntries = computed(() =>
    this.rcs()
      .filter((rc) => rc.branch === 'development')
      .sort((a, b) => a.repo.localeCompare(b.repo)),
  );

  /** Production entries (one per repo) — terminal receiver. */
  readonly prodEntries = computed(() =>
    this.rcs()
      .filter((rc) => rc.branch === 'production')
      .sort((a, b) => a.repo.localeCompare(b.repo)),
  );

  /** Incoming feature→development PRs for a development entry's repo (any open/merged/closed PR). */
  incomingPrs(devRc: ReleaseCandidate): ReleaseCandidate[] {
    return this.rcs()
      .filter(
        (rc) => rc.repo === devRc.repo && !isProtectedBranch(rc.branch) && rc.prDev.state !== 'NONE',
      )
      .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
  }

  kind(rc: ReleaseCandidate): BranchKind {
    return rc.branch === 'development' ? 'development' : rc.branch === 'production' ? 'production' : 'feature';
  }

  /** Developers/admins may act. */
  canAct(): boolean {
    return this.auth.isDeveloper() || this.auth.isAdmin();
  }

  /**
   * The gated actions for a card. Feature cards: Deploy preview + Create PR → dev.
   * Development entries: Create PR → production (the promotion). Production: none.
   */
  actionsFor(rc: ReleaseCandidate): {
    action: RcAction;
    label: string;
    enabled: boolean;
    reason: string | null;
  }[] {
    // Development entry: the promotion button is gated on `promotable` (unreleased changes +
    // a successful dev deploy), NOT the feature projection. promotion-chain plan 2026-06-24.
    if (this.kind(rc) === 'development') {
      const hasCap = this.auth.hasCapability(requiredCapability('createPrToProd'));
      const open = rc.prProd.state === 'OPEN';
      const enabled = hasCap && !!rc.promotable && !open;
      let reason: string | null = null;
      if (!hasCap) reason = 'Your role does not grant this action.';
      else if (open) reason = 'A promotion PR → production is already open.';
      else if (!rc.promotable)
        reason =
          rc.lastDeploymentState !== 'success'
            ? 'Waiting for the development deploy to finish.'
            : 'Awaiting tester validation of the dev deploy (Preview Channels).';
      return [{ action: 'createPrToProd', label: 'Create PR → prod', enabled, reason }];
    }
    if (this.kind(rc) === 'production') return [];

    const defs: { action: RcAction; label: string }[] = [
      { action: 'deployPreview', label: 'Deploy preview' },
      { action: 'createPrToDev', label: 'Create PR → dev' },
    ];
    return defs.map(({ action, label }) => {
      const hasCap = this.auth.hasCapability(requiredCapability(action));
      const byStatus = allowedByStatus(action, rc.derivedStatus);
      const fresh = isFresh(action, rc);
      const enabled = hasCap && byStatus && fresh;
      let reason: string | null = null;
      if (!hasCap) reason = 'Your role does not grant this action.';
      else reason = gateReason(action, rc);
      const finalLabel =
        action === 'deployPreview' && rc.preview.buildState !== 'NONE' ? 'Redeploy preview' : label;
      return { action, label: finalLabel, enabled, reason };
    });
  }

  short(sha?: string): string {
    return sha ? sha.slice(0, 7) : '—';
  }

  /** The feature lifecycle in order (prod lane lives on the development entry now). */
  private readonly FEATURE_ORDER: RcStatus[] = [
    'NO_ACTION',
    'PREVIEW_LIVE',
    'OK_FOR_DEV',
    'PR_TO_DEV',
    'DEV_MERGED',
  ];

  /**
   * The last (up to) 3 lifecycle statuses ending at the current one — a progression
   * breadcrumb so the card reads as a path, not a flat pile of badges. The current
   * status (last item) is also shown as the top-right chip.
   */
  recentStatuses(rc: ReleaseCandidate): RcStatus[] {
    const cur = rc.derivedStatus;
    if (cur === 'PREVIEW_BUILDING' || cur === 'PREVIEW_FAILED' || cur === 'PREVIEW_LIVE') {
      return (['NO_ACTION', cur] as RcStatus[]).slice(-3);
    }
    const idx = this.FEATURE_ORDER.indexOf(cur);
    if (idx < 0) {
      // A prod-lane status on a feature (legacy backend) — anchor the trail at the dev lane.
      return (['PR_TO_DEV', 'DEV_MERGED', cur] as RcStatus[]).slice(-3);
    }
    return this.FEATURE_ORDER.slice(0, idx + 1).slice(-3);
  }

  statusLabel(s: RcStatus): string {
    return STATUS_META[s].label;
  }
  statusColor(s: RcStatus): string {
    return `var(${STATUS_META[s].varName})`;
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

  /** Per-state guidance for a FEATURE card (dev lane only — terminal DEV_MERGED). */
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
        return { text: 'PR → dev is open — a reviewer accepts/denies it on GitHub.', tone: 'active' };
      case 'DEV_MERGED':
        return { text: 'Merged into development — done. It ships to prod with the next promotion.', tone: 'ok' };
      default:
        return { text: '', tone: 'muted' };
    }
  }

  /** Promotion guidance for a DEVELOPMENT entry (tracks deploy + promotable state). */
  devMessage(rc: ReleaseCandidate): { text: string; tone: string } {
    if (rc.prProd.state === 'OPEN') {
      return { text: 'Promotion PR → production is open — a reviewer accepts/denies it on GitHub.', tone: 'active' };
    }
    if (rc.promotable) {
      return { text: 'Development deployed & validated — ready to promote. Open a PR → production.', tone: 'ok' };
    }
    if (rc.lastDeploymentState === 'success') {
      return { text: 'Deployed to dev — awaiting tester validation (Preview Channels) before promoting.', tone: 'active' };
    }
    if (rc.lastDeploymentState) {
      return { text: 'Deploying to dev — promote after the deploy succeeds and a tester validates it.', tone: 'active' };
    }
    return { text: 'Awaiting a dev deploy — promote after it deploys and a tester validates it.', tone: 'muted' };
  }

  /** Deploy-status pill for the development / production environment entries. */
  deployLabel(rc: ReleaseCandidate): string | null {
    const s = (rc.lastDeploymentState ?? '').toLowerCase();
    if (!s) return null;
    if (s === 'success') return 'deployed';
    if (s === 'failure' || s === 'error') return 'deploy failed';
    if (s === 'in_progress' || s === 'queued' || s === 'pending') return 'deploying…';
    return s;
  }
  deployTone(rc: ReleaseCandidate): string {
    const s = (rc.lastDeploymentState ?? '').toLowerCase();
    if (s === 'success') return 'ok';
    if (s === 'failure' || s === 'error') return 'bad';
    if (s === 'in_progress' || s === 'queued' || s === 'pending') return 'active';
    return 'none';
  }

  prLabel(rc: ReleaseCandidate): string {
    return rc.prDev.state === 'MERGED'
      ? 'accepted'
      : rc.prDev.state === 'CLOSED'
        ? 'denied'
        : rc.prDev.state === 'OPEN'
          ? 'awaiting review'
          : '—';
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
}
