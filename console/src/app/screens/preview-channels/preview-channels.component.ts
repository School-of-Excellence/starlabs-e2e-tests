import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FirebaseService } from '../../core/firebase.service';
import { AuthService } from '../../core/auth.service';
import {
  ReleaseCandidate,
  GateFacet,
  RcNote,
  previewStale,
  signoffStale,
  toMillis,
  isProtectedBranch,
} from '../../core/release-candidate.model';
import { StatusChipComponent } from '../../shared/status-chip/status-chip.component';
import { ActivityDrawerComponent } from '../../shared/activity-drawer/activity-drawer.component';
import {
  FilterBarComponent,
  RcFilter,
  EMPTY_FILTER,
  applyFilter,
} from '../../shared/filter-bar/filter-bar.component';
import { ToastService } from '../../shared/toast.service';
import { environment } from '../../../environments/environment';

/**
 * Previews & Deploys (promotion-chain, tester-gate revision 2026-06-25). Testers validate here:
 *  - FEATURE previews → the DEV gate ("OK for dev").
 *  - the DEVELOPMENT deploy (starlabs-test) → "OK to promote" (validates the dev deploy → enables
 *    Create PR → prod on the development entry).
 *  - the PRODUCTION deploy (fir-sample) → "Validated" (release-validation record; gates nothing).
 *
 * "After every deploy, tester says okay": a new successful dev deploy clears the prior validation
 * (server-side), so the tester must re-approve the current deploy.
 */
@Component({
  selector: 'rc-preview-channels',
  standalone: true,
  imports: [DatePipe, StatusChipComponent, FilterBarComponent, ActivityDrawerComponent],
  templateUrl: './preview-channels.component.html',
  styleUrl: './preview-channels.component.css',
})
export class PreviewChannelsComponent {
  private readonly fb = inject(FirebaseService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly rcs = toSignal(this.fb.releaseCandidates(), { initialValue: [] as ReleaseCandidate[] });
  readonly filter = signal<RcFilter>(EMPTY_FILTER);
  readonly busy = signal<string | null>(null);
  readonly devNote = signal('');
  readonly prodNote = signal('');
  /** Branch whose activity drawer (full release-note history) is open, or null. */
  readonly selected = signal<{ id: string; label: string } | null>(null);

  /** The most recent note on a gate (the rest live in the activity-log drawer). */
  latestNote(gate: GateFacet): RcNote | null {
    const notes = gate?.notes;
    return notes && notes.length ? notes[notes.length - 1] : null;
  }
  /** Fixed environment deploy URL (D3). */
  envUrl(branch: string): string | null {
    return environment.environmentUrls?.[branch] ?? null;
  }
  openLog(rc: ReleaseCandidate): void {
    this.selected.set({ id: rc.id, label: rc.branch });
  }

  readonly previewStale = previewStale;
  readonly signoffStale = signoffStale;

  /** Feature candidates with a preview channel (the dev-gate cards). */
  readonly withPreview = computed(() =>
    this.rcs().filter((r) => r.preview && r.preview.buildState !== 'NONE'),
  );
  readonly filtered = computed(() =>
    applyFilter(this.withPreview(), this.filter(), this.auth.user()?.email ?? null)
      .filter((rc) => !isProtectedBranch(rc.branch))
      .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)),
  );

  /**
   * Development deploys only — the tester validates these to allow promotion. Production is NOT
   * listed: once code is in production there's nothing left to approve (operator, 2026-06-25).
   */
  readonly envEntries = computed(() =>
    this.rcs()
      .filter((rc) => rc.branch === 'development')
      .sort((a, b) => a.repo.localeCompare(b.repo)),
  );

  short(sha?: string): string {
    return sha ? sha.slice(0, 7) : '—';
  }
  asValue(e: Event): string {
    return (e.target as HTMLTextAreaElement).value;
  }
  isProd(rc: ReleaseCandidate): boolean {
    return rc.branch === 'production';
  }

  previewUrl(rc: ReleaseCandidate): string | null {
    return rc.preview.url ?? this.fb.previewUrlFor(rc.repo, rc.branch);
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

  /** Deploy-status pill for an environment entry. */
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

  /** True when the dev gate's OK verdict is for the CURRENT preview (no re-approval needed). */
  devSignedCurrent(rc: ReleaseCandidate): boolean {
    return rc.devGate.verdict === 'OK' && !signoffStale(rc.devGate, rc.headSha);
  }

  /** Disabled reason for the FEATURE dev gate, or null when the tester may (re-)approve. */
  devReason(rc: ReleaseCandidate): string | null {
    if (!this.auth.hasCapability('SIGNOFF_PREVIEW_DEV'))
      return 'Your role does not grant dev sign-off.';
    if (rc.preview.buildState !== 'LIVE' || previewStale(rc))
      return 'Deploy a fresh preview for the current commit before signing off.';
    if (this.devSignedCurrent(rc)) return 'Signed off for the current preview.';
    return null;
  }

  /** Disabled reason for an ENVIRONMENT deploy validation, or null when the tester may approve. */
  envReason(rc: ReleaseCandidate): string | null {
    if (!this.auth.hasCapability('SIGNOFF_DEV_PROD'))
      return 'Your role does not grant deploy sign-off.';
    if (rc.lastDeploymentState !== 'success')
      return 'Waiting for the deploy to finish (or it failed).';
    if (rc.prodGate.verdict === 'OK') return 'Validated for the current deploy.';
    return null;
  }

  async signDev(rc: ReleaseCandidate, verdict: 'OK' | 'REJECTED'): Promise<void> {
    this.busy.set(rc.id);
    try {
      const res = await this.fb.signoffDev(rc, verdict, this.devNote().trim() || undefined);
      this.toast.show(res.ok, res.message);
      this.devNote.set('');
    } finally {
      this.busy.set(null);
    }
  }

  async signEnv(rc: ReleaseCandidate, verdict: 'OK' | 'REJECTED'): Promise<void> {
    this.busy.set(rc.id);
    try {
      const res = await this.fb.signoffProd(rc, verdict, this.prodNote().trim() || undefined);
      this.toast.show(res.ok, res.message);
      this.prodNote.set('');
    } finally {
      this.busy.set(null);
    }
  }
}
