import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirebaseService } from '../../core/firebase.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../shared/toast.service';
import { ReleaseCandidate, isProtectedBranch, toMillis } from '../../core/release-candidate.model';
import { StatusChipComponent } from '../../shared/status-chip/status-chip.component';
import { ActivityDrawerComponent } from '../../shared/activity-drawer/activity-drawer.component';
import { environment } from '../../../environments/environment';

/**
 * Release Channel (ADR-001, 2026-06-26) — ADMIN-ONLY cockpit.
 *  • Development section: every incoming feature→development PR + test suite (review/merge on GH CLI);
 *    the promotion BATCH (features merged since the last prod release); the single Create PR → prod.
 *  • Production section: the development→production promotion PR + prod deploy.
 * Console never merges — rows link to GitHub. Promotion is admin-only (D1).
 */
@Component({
  selector: 'rc-release-channel',
  standalone: true,
  imports: [DatePipe, StatusChipComponent, ActivityDrawerComponent],
  templateUrl: './release-channel.component.html',
  styleUrl: './release-channel.component.css',
})
export class ReleaseChannelComponent {
  private readonly fb = inject(FirebaseService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly rcs = toSignal(this.fb.releaseCandidates(), { initialValue: [] as ReleaseCandidate[] });
  readonly busy = signal<string | null>(null);
  readonly selected = signal<{ id: string; label: string } | null>(null);

  readonly isAdmin = computed(() => this.auth.isAdmin());

  readonly devEntries = computed(() =>
    this.rcs().filter((rc) => rc.branch === 'development').sort((a, b) => a.repo.localeCompare(b.repo)),
  );
  readonly prodEntries = computed(() =>
    this.rcs().filter((rc) => rc.branch === 'production').sort((a, b) => a.repo.localeCompare(b.repo)),
  );

  /** Every incoming feature→development PR for this repo (open/merged/denied). */
  incomingPrs(devRc: ReleaseCandidate): ReleaseCandidate[] {
    return this.rcs()
      .filter((rc) => rc.repo === devRc.repo && !isProtectedBranch(rc.branch) && rc.prDev.state !== 'NONE')
      .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
  }

  /**
   * The promotion BATCH (D2): feature PRs merged to development since the last prod release.
   * Gated on the development candidate being ahead of production (`hasUnreleased`), so stale feature
   * flags never show an already-shipped batch after a release.
   */
  batch(devRc: ReleaseCandidate): ReleaseCandidate[] {
    if (!devRc.hasUnreleased) return [];
    return this.rcs()
      .filter((rc) => rc.repo === devRc.repo && !isProtectedBranch(rc.branch) && rc.unreleased)
      .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
  }

  /** True when production is up to date with development (nothing to promote). */
  releasedUpToDate(devRc: ReleaseCandidate): boolean {
    return !devRc.hasUnreleased && devRc.prProd.state !== 'OPEN';
  }

  envUrl(branch: string): string | null {
    return environment.environmentUrls?.[branch] ?? null;
  }

  short(sha?: string): string {
    return sha ? sha.slice(0, 7) : '—';
  }
  prTone(s: string): string {
    return s === 'OPEN' ? 'active' : s === 'MERGED' ? 'merged' : s === 'CLOSED' ? 'bad' : 'none';
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
  gateRunLabel(s: string): string {
    return s === 'RUNNING' ? 'running…' : s === 'QUEUED' ? 'queued' : s === 'PASSED' ? 'passed' : 'failed';
  }
  gateRunTone(s: string): string {
    return s === 'PASSED' ? 'ok' : s === 'FAILED' ? 'bad' : 'active';
  }
  reportUrl(rc: ReleaseCandidate): string | null {
    return this.fb.reportUrlFor(rc);
  }

  /** Disabled reason for Create PR → prod, or null when the admin may promote. */
  promoteReason(devRc: ReleaseCandidate): string | null {
    if (!this.auth.hasCapability('CREATE_PR_PROD')) return 'Only an admin can promote to production.';
    if (devRc.prProd.state === 'OPEN') return 'A promotion PR → production is already open.';
    if (!devRc.hasUnreleased) return 'Nothing to promote — production is up to date with development.';
    if (!devRc.promotable)
      return devRc.lastDeploymentState === 'success'
        ? 'Awaiting tester validation of the dev deploy (Preview Channels).'
        : 'Waiting for the development deploy to finish.';
    return null;
  }
  canPromote(devRc: ReleaseCandidate): boolean {
    return this.promoteReason(devRc) === null;
  }

  async promote(devRc: ReleaseCandidate): Promise<void> {
    this.busy.set(devRc.id);
    try {
      const res = await this.fb.createPrToProd(devRc);
      this.toast.show(res.ok, res.message);
    } finally {
      this.busy.set(null);
    }
  }

  openLog(rc: ReleaseCandidate): void {
    this.selected.set({ id: rc.id, label: rc.branch });
  }
}
