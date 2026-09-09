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

  // ── NEW FLOW metrics (cutover 2026-09-10) ─────────────────────────────────────────────────────
  // Every figure below reads previewStatus / testSuiteStatus / rollout. The OLD counters read
  // preview.buildState, devGate, prodGate, testSummary and derivedStatus — none of which the new
  // flow writes, so they reported zeros while the pipeline was running and passing.

  /** Only feature branches move through the pipeline; development/production are lanes, not work. */
  private readonly feats = computed(() =>
    this.rcs().filter((r) => r.branch !== 'development' && r.branch !== 'production'),
  );

  /** Both channels published from the same push. A half-built pair is not "live". */
  readonly channelsLive = computed(
    () =>
      this.feats().filter(
        (r) => r.previewStatus?.dev?.status === 'SUCCESS' && r.previewStatus?.prod?.status === 'SUCCESS',
      ).length,
  );

  /** Blocked by the suite check — the number that says how much of the backlog is biting today. */
  readonly checkBlocked = computed(
    () => this.feats().filter((r) => r.testSuiteStatus && !r.testSuiteStatus.canProceed).length,
  );

  readonly runsPassed = computed(
    () => this.feats().filter((r) => r.testSuiteStatus?.run?.state === 'PASSED').length,
  );
  readonly runsFailed = computed(
    () => this.feats().filter((r) => r.testSuiteStatus?.run?.state === 'FAILED').length,
  );

  /** Green, fresh, and nobody has approved it yet — the tester's actual queue. */
  readonly awaitingApproval = computed(
    () =>
      this.feats().filter((r) => {
        const run = r.testSuiteStatus?.run;
        return (
          run?.state === 'PASSED' &&
          !!run.sha &&
          run.sha === r.headSha &&
          r.rollout?.state !== 'APPROVED'
        );
      }).length,
  );

  /** Feature branches whose dev PR merged — i.e. deployed to starlabs-test by deploy_19.yml. */
  readonly devDeploys = computed(
    () => this.feats().filter((r) => r.prDev?.state === 'MERGED').length,
  );

  /** Batches shipped: a development→production PR that reached MERGED. */
  readonly prodDeploys = computed(
    () => this.rcs().filter((r) => r.branch === 'development' && r.prProd?.state === 'MERGED').length,
  );

  /** Either channel failed on the last push — the build is broken for that branch. */
  readonly channelsFailed = computed(
    () =>
      this.feats().filter(
        (r) => r.previewStatus?.dev?.status === 'FAILED' || r.previewStatus?.prod?.status === 'FAILED',
      ).length,
  );

  readonly prsOpen = computed(
    () => this.rcs().filter((r) => r.prDev?.state === 'OPEN' || r.prProd?.state === 'OPEN').length,
  );

  /** Approved against a commit that is no longer HEAD — someone pushed after sign-off. */
  readonly staleCount = computed(
    () =>
      this.feats().filter((r) => {
        const run = r.testSuiteStatus?.run;
        const runStale = run?.state === 'PASSED' && !!run.sha && !!r.headSha && run.sha !== r.headSha;
        const appStale =
          r.rollout?.state === 'APPROVED' && !!r.rollout.sha && !!r.headSha && r.rollout.sha !== r.headSha;
        return runStale || appStale;
      }).length,
  );

  /** Approved with the suite status overridden. Should be rare; if it is not, that is the signal. */
  readonly bypassed = computed(() => this.feats().filter((r) => !!r.rollout?.bypass).length);

  /**
   * How far branches get. Each row counts branches that reached AT LEAST that stage, so the bars
   * shrink left-to-right and the biggest drop names the flow's real bottleneck.
   */
  readonly funnel = computed<FunnelRow[]>(() => {
    const f = this.feats();
    const fresh = (r: ReleaseCandidate) => {
      const run = r.testSuiteStatus?.run;
      return run?.state === 'PASSED' && !!run.sha && run.sha === r.headSha;
    };
    const rows = [
      { label: 'Pushed', varName: '--st-no-action', count: f.length },
      { label: 'Channels live', varName: '--st-preview-live', count: this.channelsLive() },
      {
        label: 'Suite check passed',
        varName: '--st-pr-dev',
        count: f.filter((r) => r.testSuiteStatus?.canProceed).length,
      },
      { label: 'Suites passed', varName: '--st-ok', count: this.runsPassed() },
      {
        label: 'Approved for rollout',
        varName: '--st-ok-dev',
        count: f.filter((r) => r.rollout?.state === 'APPROVED').length,
      },
      {
        label: 'Merged to development',
        varName: '--st-dev-merged',
        count: f.filter((r) => r.prDev?.state === 'MERGED').length,
      },
    ];
    void fresh;
    const max = Math.max(1, ...rows.map((r) => r.count));
    return rows.map((r) => ({ ...r, pct: (r.count / max) * 100 }));
  });

  /** Live activity feed — the most recent lastActivity per branch, newest first. */
  readonly feed = computed<FeedItem[]>(() =>
    this.rcs()
      .filter((r) => !!r.lastActivity)
      .map((rc) => ({
        rc,
        type: rc.lastActivity!.type,
        actor: rc.lastActivity!.actor,
        at: rc.lastActivity!.at,
      }))
      .sort((a, b) => toMillis(b.at) - toMillis(a.at))
      .slice(0, 12),
  );

  /** activity type → human label. */
  pretty(type: string): string {
    return type.replace(/_/g, ' ');
  }
}
