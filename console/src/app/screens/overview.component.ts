import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FirebaseService } from '../core/firebase.service';
import {
  ReleaseCandidate,
  RcStatus,
  RC_STATUS_RANK,
  previewStale,
  signoffStale,
  toMillis,
} from '../core/release-candidate.model';
import { STATUS_META } from '../core/status-meta';

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
  template: `
    <header class="head">
      <h2>Mission Control</h2>
      <p class="muted">Live state of every tracked branch across the release pipeline.</p>
    </header>

    <!-- Stat cards -->
    <section class="stats">
      <a class="stat" routerLink="/branches">
        <div class="n">{{ rcs().length }}</div>
        <div class="l">Branches tracked</div>
      </a>
      <a class="stat" routerLink="/previews">
        <div class="n">{{ previewsLive() }}</div>
        <div class="l">Previews live</div>
      </a>
      <a class="stat" routerLink="/branches">
        <div class="n">{{ prsOpen() }}</div>
        <div class="l">PRs open</div>
      </a>
      <a class="stat warn" routerLink="/branches" [class.muted-card]="staleCount() === 0">
        <div class="n">{{ staleCount() }}</div>
        <div class="l">Stale / drifted</div>
      </a>
      <div class="stat">
        <div class="n">
          <span class="ok">{{ testsPassed() }}</span
          ><span class="sep">/</span><span class="bad">{{ testsFailed() }}</span>
        </div>
        <div class="l">Tests pass / fail</div>
      </div>
    </section>

    <div class="grid">
      <!-- Pipeline funnel -->
      <section class="panel">
        <h3>Pipeline funnel</h3>
        <div class="funnel">
          @for (row of funnel(); track row.status) {
            <div class="frow">
              <div class="flabel" [style.--c]="'var(' + row.varName + ')'">{{ row.label }}</div>
              <div class="ftrack">
                <div class="fbar" [style.width.%]="row.pct" [style.--c]="'var(' + row.varName + ')'"></div>
              </div>
              <div class="fcount">{{ row.count }}</div>
            </div>
          }
        </div>
      </section>

      <!-- Deploy health -->
      <section class="panel">
        <h3>Deploy health</h3>
        <div class="health">
          <div class="hrow">
            <span class="hlabel">starlabs-test (dev)</span>
            <span class="hbadge ok">{{ devDeploys() }} merged → deployed</span>
          </div>
          <div class="hrow">
            <span class="hlabel">fir-sample (prod)</span>
            <span class="hbadge prod">{{ prodDeploys() }} shipped</span>
          </div>
          <div class="hrow">
            <span class="hlabel">Preview builds failing</span>
            <span class="hbadge" [class.bad]="previewsFailed() > 0" [class.ok]="previewsFailed() === 0">
              {{ previewsFailed() }}
            </span>
          </div>
          <div class="hrow">
            <span class="hlabel">Needs a human decision</span>
            <span class="hbadge" [class.bad]="needsDecision() > 0" [class.ok]="needsDecision() === 0">
              {{ needsDecision() }}
            </span>
          </div>
        </div>
      </section>

      <!-- Activity feed -->
      <section class="panel feed">
        <h3>Live activity</h3>
        <ul>
          @for (item of feed(); track item.rc.id + item.at) {
            <li>
              <span class="evt">{{ pretty(item.type) }}</span>
              <span class="branch">{{ item.rc.repo }}/{{ item.rc.branch }}</span>
              <span class="meta muted">
                {{ item.actor }} · {{ item.at | date: 'MMM d, HH:mm' }}
              </span>
            </li>
          } @empty {
            <li class="muted">No activity yet.</li>
          }
        </ul>
      </section>
    </div>
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
        margin: 0 0 20px;
        font-size: 13px;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 14px;
        margin-bottom: 22px;
      }
      .stat {
        display: block;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 16px 18px;
        color: var(--fg);
        transition: border-color 0.15s, transform 0.15s;
      }
      a.stat:hover {
        border-color: var(--accent);
        transform: translateY(-1px);
        text-decoration: none;
      }
      .stat .n {
        font-size: 30px;
        font-weight: 700;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .stat .l {
        margin-top: 6px;
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .stat.warn .n {
        color: var(--st-pr-prod);
      }
      .stat.muted-card .n {
        color: var(--muted);
      }
      .ok {
        color: var(--st-ok);
      }
      .bad {
        color: var(--danger);
      }
      .sep {
        color: var(--muted);
        margin: 0 4px;
      }
      .grid {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 16px;
      }
      .feed {
        grid-column: 1 / -1;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 16px 18px;
      }
      .panel h3 {
        margin: 0 0 14px;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--muted);
      }
      .funnel {
        display: flex;
        flex-direction: column;
        gap: 9px;
      }
      .frow {
        display: grid;
        grid-template-columns: 130px 1fr 28px;
        align-items: center;
        gap: 10px;
        font-size: 12px;
      }
      .flabel {
        color: var(--c);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ftrack {
        height: 8px;
        background: var(--panel-2);
        border-radius: 999px;
        overflow: hidden;
      }
      .fbar {
        height: 100%;
        min-width: 2px;
        background: var(--c);
        border-radius: 999px;
        transition: width 0.3s ease;
      }
      .fcount {
        text-align: right;
        font-variant-numeric: tabular-nums;
        color: var(--muted);
      }
      .health {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .hrow {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
      }
      .hbadge {
        font-size: 12px;
        padding: 2px 9px;
        border-radius: 999px;
        border: 1px solid var(--border);
        color: var(--muted);
      }
      .hbadge.ok {
        color: var(--st-ok);
        border-color: color-mix(in srgb, var(--st-ok) 45%, transparent);
      }
      .hbadge.prod {
        color: var(--st-prod-merged);
        border-color: color-mix(in srgb, var(--st-prod-merged) 45%, transparent);
      }
      .hbadge.bad {
        color: var(--danger);
        border-color: color-mix(in srgb, var(--danger) 45%, transparent);
      }
      .feed ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      .feed li {
        display: flex;
        align-items: baseline;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid var(--border);
        font-size: 13px;
      }
      .feed li:last-child {
        border-bottom: none;
      }
      .evt {
        font-weight: 600;
        color: var(--accent);
        min-width: 120px;
      }
      .branch {
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 12px;
      }
      .feed .meta {
        margin-left: auto;
        font-size: 12px;
      }
      @media (max-width: 860px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
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
