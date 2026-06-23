import { Component, inject, input, output, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import { FirebaseService } from '../core/firebase.service';
import { ActivityLogEntry, ActivityType } from '../core/release-candidate.model';

/** Human labels for activity types — reused by the Working Branches "last activity" line. */
export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  push: 'Pushed',
  preview_dispatch: 'Preview requested',
  preview_build: 'Preview build',
  signoff_dev: 'Signed off · dev',
  signoff_prod: 'Signed off · prod',
  pr_to_dev: 'PR → development',
  pr_to_prod: 'PR → production',
  dev_merged: 'Merged to development',
  prod_merged: 'Merged to production',
  deploy_status: 'Deploy',
  gate_run: 'e2e gate',
  reconcile_decision: 'Reconcile decision',
  member_change: 'Member change',
};

/**
 * Right-side drawer listing the full activity-log timeline for one branch (plan D7/D8).
 * Opened from a card's history icon; reads `activity-log` by branchId, newest first.
 */
@Component({
  selector: 'rc-activity-drawer',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <aside class="drawer" role="dialog" aria-label="Activity log">
      <header>
        <div>
          <div class="title">Activity log</div>
          <div class="sub muted">{{ label() }}</div>
        </div>
        <button class="x" (click)="closed.emit()" title="Close">✕</button>
      </header>
      <div class="body">
        @for (e of ordered(); track $index) {
          <div class="row" [attr.data-type]="e.type">
            <span class="dot"></span>
            <div class="content">
              <div class="rtop">
                <span class="type">{{ labelFor(e.type) }}</span>
                <span class="time muted">{{ e.eventTime | date: 'MMM d, HH:mm' }}</span>
              </div>
              <div class="meta muted">
                {{ e.actor || '—' }}
                @if (short(e.sha)) { · <code>{{ short(e.sha) }}</code> }
                · <span class="src" [attr.data-src]="e.source">{{ e.source }}</span>
                @if (!e.confirmed) { · <em class="pending">pending</em> }
              </div>
            </div>
          </div>
        } @empty {
          <div class="empty muted">No activity recorded for this branch yet.</div>
        }
      </div>
    </aside>
  `,
  styles: [
    `
      :host { position: fixed; inset: 0; z-index: 50; }
      .backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.5); }
      .drawer {
        position: absolute;
        top: 0; right: 0; bottom: 0;
        width: 400px; max-width: 92vw;
        background: var(--panel);
        border-left: 1px solid var(--border);
        display: flex; flex-direction: column;
        box-shadow: -16px 0 40px rgba(0, 0, 0, 0.4);
        animation: slide 0.18s ease-out;
      }
      @keyframes slide { from { transform: translateX(24px); opacity: 0.4; } to { transform: none; opacity: 1; } }
      header {
        display: flex; justify-content: space-between; align-items: flex-start;
        padding: 16px 18px; border-bottom: 1px solid var(--border);
      }
      .title { font-size: 14px; font-weight: 600; }
      .sub { font-size: 12px; margin-top: 2px; font-family: ui-monospace, monospace; }
      .x { background: none; border: none; color: var(--muted); font-size: 14px; cursor: pointer; }
      .x:hover { color: var(--fg); }
      .body { overflow-y: auto; padding: 8px 0; }
      .row { display: flex; gap: 10px; padding: 10px 18px; }
      .dot {
        width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex: none;
        background: var(--muted);
      }
      .row[data-type='dev_merged'] .dot, .row[data-type='prod_merged'] .dot { background: var(--st-prod-merged); }
      .row[data-type='signoff_dev'] .dot, .row[data-type='signoff_prod'] .dot { background: var(--st-ok); }
      .row[data-type='pr_to_dev'] .dot, .row[data-type='pr_to_prod'] .dot { background: var(--accent); }
      .row[data-type='push'] .dot, .row[data-type='preview_build'] .dot, .row[data-type='preview_dispatch'] .dot { background: var(--st-pr-dev); }
      .content { flex: 1; min-width: 0; }
      .rtop { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
      .type { font-weight: 500; }
      .time { font-size: 11px; white-space: nowrap; }
      .meta { font-size: 11px; margin-top: 2px; }
      .src { text-transform: uppercase; letter-spacing: 0.3px; }
      .src[data-src='webhook'] { color: var(--st-ok); }
      .src[data-src='console'] { color: var(--accent); }
      .src[data-src='reconcile'] { color: var(--st-pr-prod); }
      .pending { color: var(--st-pr-prod); font-style: normal; }
      .empty { padding: 40px 18px; text-align: center; font-size: 13px; }
      code { background: var(--chip); padding: 0 4px; border-radius: 4px; }
    `,
  ],
})
export class ActivityDrawerComponent {
  private readonly fb = inject(FirebaseService);

  readonly branchId = input<string | null>(null);
  readonly label = input<string>('');
  readonly closed = output<void>();

  private readonly entries$: Observable<ActivityLogEntry[]> = toObservable(this.branchId).pipe(
    switchMap((id) => (id ? this.fb.activityForBranch(id) : of([] as ActivityLogEntry[]))),
  );
  readonly entries = toSignal(this.entries$, { initialValue: [] as ActivityLogEntry[] });
  /** Newest-first for the timeline (the stream comes back eventTime ascending). */
  readonly ordered = computed(() => [...this.entries()].reverse());

  labelFor(t: ActivityType): string {
    return ACTIVITY_LABEL[t] ?? t;
  }
  short(sha?: string): string {
    return sha ? sha.slice(0, 7) : '';
  }
}
