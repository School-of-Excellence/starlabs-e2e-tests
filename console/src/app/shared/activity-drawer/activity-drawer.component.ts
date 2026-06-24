import { Component, inject, input, output, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import { FirebaseService } from '../../core/firebase.service';
import { ActivityLogEntry, ActivityType } from '../../core/release-candidate.model';

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
  templateUrl: './activity-drawer.component.html',
  styleUrl: './activity-drawer.component.css',
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
