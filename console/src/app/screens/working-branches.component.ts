import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FirebaseService } from '../core/firebase.service';
import { AuthService } from '../core/auth.service';
import {
  ReleaseCandidate,
  ActivityType,
  previewStale,
  signoffStale,
  prHasUnreviewed,
  toMillis,
  isProtectedBranch,
} from '../core/release-candidate.model';
import {
  RcAction,
  requiredCapability,
  allowedByStatus,
  isFresh,
  gateReason,
} from '../core/action-gating';
import { StatusChipComponent } from '../shared/status-chip.component';
import { ActivityDrawerComponent, ACTIVITY_LABEL } from '../shared/activity-drawer.component';
import {
  FilterBarComponent,
  RcFilter,
  EMPTY_FILTER,
  applyFilter,
} from '../shared/filter-bar.component';
import { ToastService } from '../shared/toast.service';

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
  template: `
    <header class="head">
      <h2>Working Branches</h2>
      <p class="muted">Every tracked branch and what it's waiting on. Developers act here.</p>
    </header>

    <rc-filter-bar [candidates]="rcs()" (changed)="filter.set($event)" />

    <div class="list">
      @for (rc of filtered(); track rc.id) {
        <article class="card" [class.drift]="rc.reconcile !== 'IN_SYNC'">
          <!-- Top row: identity + status -->
          <div class="top">
            <div class="ident">
              <div class="branch">{{ rc.branch }}</div>
              <div class="sub muted">
                {{ rc.repo }} · <code>{{ short(rc.headSha) }}</code>
                @if (rc.headCommit?.msg) {
                  · {{ rc.headCommit?.msg }}
                }
              </div>
            </div>
            <rc-status-chip [status]="rc.derivedStatus" />
          </div>

          <!-- Per-state guidance: what's next, or why nothing is needed -->
          <div class="statemsg" [attr.data-tone]="stateMessage(rc).tone">{{ stateMessage(rc).text }}</div>

          <!-- Facet badges -->
          <div class="facets">
            <span class="badge" [attr.data-tone]="buildTone(rc)">
              preview: {{ rc.preview.buildState }}
              @if (previewStale(rc)) { <em class="stale">stale</em> }
            </span>
            <span class="badge" [attr.data-tone]="gateTone(rc.devGate.verdict)">
              dev gate: {{ rc.devGate.verdict }}
              @if (signoffStale(rc.devGate, rc.headSha)) { <em class="stale">stale</em> }
            </span>
            @if (rc.prDev.state !== 'NONE') {
              <span class="badge" [attr.data-tone]="prTone(rc.prDev.state)">
                PR→dev #{{ rc.prDev.number }}: {{ rc.prDev.state }}
                @if (rc.prDev.mergeable === false) { · not mergeable }
                @if (rc.prDev.checksState) { · checks {{ rc.prDev.checksState }} }
                @if (prHasUnreviewed(rc.prDev, rc.devGate)) { <em class="stale">unreviewed</em> }
              </span>
            }
            <span class="badge" [attr.data-tone]="gateTone(rc.prodGate.verdict)">
              prod gate: {{ rc.prodGate.verdict }}
              @if (signoffStale(rc.prodGate, rc.headSha)) { <em class="stale">stale</em> }
            </span>
            @if (rc.prProd.state !== 'NONE') {
              <span class="badge" [attr.data-tone]="prTone(rc.prProd.state)">
                PR→prod #{{ rc.prProd.number }}: {{ rc.prProd.state }}
                @if (rc.prProd.mergeable === false) { · not mergeable }
                @if (rc.prProd.checksState) { · checks {{ rc.prProd.checksState }} }
              </span>
            }
          </div>

          <!-- Last activity + history drawer trigger -->
          @if (rc.lastActivity; as la) {
            <div class="lastact">
              <span class="la-label muted">Last activity</span>
              <span class="la-text">{{ actLabel(la.type) }} · {{ la.actor || '—' }} · {{ la.at | date: 'MMM d, HH:mm' }}</span>
              <button class="histbtn" title="View full activity log" (click)="openLog(rc)">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4">
                  <circle cx="8" cy="8" r="6.2" />
                  <path d="M8 4.5V8l2.4 1.5" stroke-linecap="round" />
                </svg>
                log
              </button>
            </div>
          }

          <!-- e2e gate report (on the open PR) -->
          @if (rc.gateRun && rc.gateRun.status !== 'NONE') {
            <div class="gate" [attr.data-tone]="gateRunTone(rc.gateRun.status)">
              <span class="gdot"></span>
              <strong>Test suite</strong>
              <span>{{ gateRunLabel(rc.gateRun.status) }}</span>
              @if (rc.testSummary && (rc.gateRun.status === 'PASSED' || rc.gateRun.status === 'FAILED')) {
                <span class="muted">· {{ rc.testSummary.passed ?? 0 }}/{{ rc.testSummary.total ?? 0 }} passed</span>
              }
              @if (rc.gateRun.status === 'PASSED') { <span class="verdict ok">safe to merge</span> }
              @if (rc.gateRun.status === 'FAILED') { <span class="verdict bad">do not merge</span> }
              @if (reportUrl(rc); as url) {
                <a class="ghlink sm" [href]="url" target="_blank" rel="noopener">View report ↗</a>
              }
            </div>
          }

          <!-- Reconcile banner -->
          @if (rc.reconcile !== 'IN_SYNC') {
            <div class="recon" [attr.data-level]="rc.reconcile">
              <div class="recon-head">
                <strong>{{ reconcileTitle(rc.reconcile) }}</strong>
                <span class="muted">{{ reconcileDesc(rc.reconcile) }}</span>
              </div>
              @if (rc.reconcile === 'NEEDS_DECISION' || rc.reconcile === 'ANOMALY') {
                <div class="recon-actions">
                  @for (opt of reconcileOptions; track opt.decision) {
                    <button
                      class="recon-btn"
                      [disabled]="!canAct() || busy() === rc.id"
                      (click)="decide(rc, opt.decision)"
                    >
                      {{ opt.label }}
                    </button>
                  }
                </div>
              }
            </div>
          }

          <!-- Action buttons -->
          <div class="actions">
            @for (a of actionsFor(rc); track a.action) {
              <button
                [class.primary]="a.enabled && a.action !== 'deployPreview'"
                [disabled]="!a.enabled || busy() === rc.id"
                [title]="a.reason || a.label"
                (click)="run(rc, a.action)"
              >
                {{ a.label }}
              </button>
            }
            @if (openPrUrl(rc); as url) {
              <a class="ghlink" [href]="url" target="_blank" rel="noopener">
                Open PR on GitHub ↗
              </a>
            }
            <span class="ts muted">updated {{ rc.updatedAt | date: 'MMM d, HH:mm' }}</span>
          </div>
        </article>
      } @empty {
        <div class="empty muted">No branches match the current filter.</div>
      }
    </div>

    @if (selected(); as s) {
      <rc-activity-drawer [branchId]="s.id" [label]="s.label" (closed)="selected.set(null)" />
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .head h2 {
        margin: 0 0 4px;
        font-size: 20px;
      }
      .head p {
        margin: 0;
        font-size: 13px;
      }
      .list {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 16px 18px;
      }
      .card.drift {
        border-color: color-mix(in srgb, var(--st-pr-prod) 50%, var(--border));
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 14px;
      }
      .branch {
        font-size: 15px;
        font-weight: 600;
        font-family: ui-monospace, SFMono-Regular, monospace;
      }
      .sub {
        font-size: 12px;
        margin-top: 3px;
      }
      .facets {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 14px 0 4px;
      }
      .badge {
        font-size: 11px;
        padding: 3px 9px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--panel-2);
        color: var(--muted);
        white-space: nowrap;
      }
      .badge[data-tone='ok'] {
        color: var(--st-ok);
        border-color: color-mix(in srgb, var(--st-ok) 40%, transparent);
      }
      .badge[data-tone='active'] {
        color: var(--accent);
        border-color: color-mix(in srgb, var(--accent) 40%, transparent);
      }
      .badge[data-tone='bad'] {
        color: var(--danger);
        border-color: color-mix(in srgb, var(--danger) 40%, transparent);
      }
      .badge[data-tone='merged'] {
        color: var(--st-prod-merged);
        border-color: color-mix(in srgb, var(--st-prod-merged) 40%, transparent);
      }
      .stale {
        margin-left: 5px;
        font-style: normal;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: var(--st-pr-prod);
        border: 1px solid color-mix(in srgb, var(--st-pr-prod) 50%, transparent);
        border-radius: 4px;
        padding: 0 4px;
      }
      .statemsg {
        font-size: 12.5px;
        margin: 12px 0 2px;
        padding: 7px 11px;
        border-radius: 6px;
        background: var(--panel-2);
        border-left: 3px solid var(--border);
        color: var(--fg);
      }
      .statemsg[data-tone='ok'] { border-left-color: var(--st-ok); }
      .statemsg[data-tone='active'] { border-left-color: var(--accent); }
      .statemsg[data-tone='bad'] { border-left-color: var(--danger); }
      .lastact {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 10px 0 2px;
        font-size: 12px;
      }
      .la-label { text-transform: uppercase; letter-spacing: 0.4px; font-size: 10px; }
      .la-text { color: var(--fg); }
      .histbtn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: auto;
        font-size: 11px;
        padding: 3px 9px;
        background: var(--panel-2);
        border: 1px solid var(--border);
        border-radius: 6px;
        color: var(--muted);
        cursor: pointer;
      }
      .histbtn:hover { color: var(--fg); border-color: var(--accent); }
      .recon {
        margin: 12px 0 4px;
        padding: 10px 12px;
        border-radius: 8px;
        background: var(--panel-2);
        border-left: 3px solid var(--st-pr-prod);
      }
      .recon[data-level='ANOMALY'] {
        border-left-color: var(--danger);
      }
      .recon[data-level='DRIFT_BENIGN'] {
        border-left-color: var(--accent);
      }
      .recon-head {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 13px;
      }
      .recon-head .muted {
        font-size: 12px;
      }
      .recon-actions {
        display: flex;
        gap: 8px;
        margin-top: 10px;
        flex-wrap: wrap;
      }
      .recon-btn {
        font-size: 12px;
        padding: 4px 10px;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--border);
      }
      .gate {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 10px 0 2px;
        font-size: 12px;
        color: var(--fg);
      }
      .gate .gdot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--muted);
      }
      .gate[data-tone='ok'] .gdot { background: var(--st-ok); }
      .gate[data-tone='bad'] .gdot { background: var(--danger); }
      .gate[data-tone='active'] .gdot {
        background: var(--accent);
        animation: pulse 1.2s ease-in-out infinite;
      }
      @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      .verdict {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        padding: 1px 6px;
        border-radius: 4px;
      }
      .verdict.ok { color: var(--st-ok); border: 1px solid color-mix(in srgb, var(--st-ok) 45%, transparent); }
      .verdict.bad { color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 45%, transparent); }
      .ghlink {
        font-size: 13px;
        padding: 6px 10px;
        border: 1px solid var(--border);
        border-radius: 6px;
      }
      .ghlink.sm {
        font-size: 12px;
        padding: 2px 8px;
      }
      .ghlink:hover {
        border-color: var(--accent);
        text-decoration: none;
      }
      .ts {
        margin-left: auto;
        font-size: 12px;
      }
      .empty {
        padding: 40px;
        text-align: center;
      }
    `,
  ],
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
