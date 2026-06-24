import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FirebaseService } from '../../core/firebase.service';
import {
  ReleaseCandidate,
  RcStatus,
  RC_STATUS_RANK,
  previewStale,
  signoffStale,
  toMillis,
} from '../../core/release-candidate.model';
import { STATUS_META } from '../../core/status-meta';

interface FunnelRow {
  status: RcStatus;
  label: string;
  varName: string;
  count: number;
  pct: number;
}

interface FeedItem {
  rc: ReleaseCandidate;
  type: string;
  actor?: string;
  at?: string | number;
}

/**
 * Overview — mission-control read-only dashboard (plan §6.1).
 * Stat cards (deep-linking to filtered screens), a pipeline funnel ordered by
 * RC_STATUS_RANK, a live activity feed and deploy health.
 */
@Component({
  selector: 'rc-overview',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.css',
})
export class OverviewComponent {
  private readonly fb = inject(FirebaseService);

  readonly rcs = toSignal(this.fb.releaseCandidates(), { initialValue: [] as ReleaseCandidate[] });

  readonly previewsLive = computed(
    () => this.rcs().filter((r) => r.preview?.buildState === 'LIVE').length,
  );
  readonly previewsFailed = computed(
    () => this.rcs().filter((r) => r.preview?.buildState === 'FAILED').length,
  );
  readonly prsOpen = computed(
    () => this.rcs().filter((r) => r.prDev?.state === 'OPEN' || r.prProd?.state === 'OPEN').length,
  );
  readonly staleCount = computed(
    () =>
      this.rcs().filter(
        (r) =>
          r.reconcile !== 'IN_SYNC' ||
          previewStale(r) ||
          signoffStale(r.devGate, r.headSha) ||
          signoffStale(r.prodGate, r.headSha),
      ).length,
  );
  readonly needsDecision = computed(
    () =>
      this.rcs().filter((r) => r.reconcile === 'NEEDS_DECISION' || r.reconcile === 'ANOMALY').length,
  );
  readonly testsPassed = computed(() =>
    this.rcs().reduce((s, r) => s + (r.testSummary?.passed ?? 0), 0),
  );
  readonly testsFailed = computed(() =>
    this.rcs().reduce((s, r) => s + (r.testSummary?.failed ?? 0), 0),
  );
  readonly devDeploys = computed(
    () =>
      this.rcs().filter((r) => RC_STATUS_RANK[r.derivedStatus] >= RC_STATUS_RANK.DEV_MERGED).length,
  );
  readonly prodDeploys = computed(
    () => this.rcs().filter((r) => r.derivedStatus === 'PROD_MERGED').length,
  );

  readonly funnel = computed<FunnelRow[]>(() => {
    const rcs = this.rcs();
    const order = (Object.keys(STATUS_META) as RcStatus[]).sort(
      (a, b) => RC_STATUS_RANK[a] - RC_STATUS_RANK[b],
    );
    const counts = new Map<RcStatus, number>();
    for (const r of rcs) counts.set(r.derivedStatus, (counts.get(r.derivedStatus) ?? 0) + 1);
    const max = Math.max(1, ...order.map((s) => counts.get(s) ?? 0));
    return order.map((status) => {
      const count = counts.get(status) ?? 0;
      return {
        status,
        label: STATUS_META[status].label,
        varName: STATUS_META[status].varName,
        count,
        pct: (count / max) * 100,
      };
    });
  });

  readonly feed = computed<FeedItem[]>(() =>
    [...this.rcs()]
      .filter((r) => r.lastActivity)
      .sort((a, b) => toMillis(b.lastActivity?.at) - toMillis(a.lastActivity?.at))
      .slice(0, 12)
      .map((rc) => ({
        rc,
        type: rc.lastActivity!.type,
        actor: rc.lastActivity!.actor,
        at: rc.lastActivity!.at,
      })),
  );

  pretty(type: string): string {
    return type.replace(/_/g, ' ');
  }
}
