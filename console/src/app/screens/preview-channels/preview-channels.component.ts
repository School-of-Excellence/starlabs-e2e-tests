import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FirebaseService } from '../../core/firebase.service';
import { AuthService } from '../../core/auth.service';
import {
  ReleaseCandidate,
  previewStale,
  signoffStale,
  toMillis,
  isProtectedBranch,
} from '../../core/release-candidate.model';
import { allowedByStatus, isFresh, gateReason } from '../../core/action-gating';
import { StatusChipComponent } from '../../shared/status-chip/status-chip.component';
import {
  FilterBarComponent,
  RcFilter,
  EMPTY_FILTER,
  applyFilter,
} from '../../shared/filter-bar/filter-bar.component';
import { ToastService } from '../../shared/toast.service';

/**
 * Preview Channels (plan §6.3). For candidates that have a preview: the channel link,
 * a DEV gate (tester OK for dev / Has issues) and — for DEV_MERGED candidates — a PROD
 * gate (Safe for prod / Hold). Gated by SIGNOFF_PREVIEW_DEV / SIGNOFF_DEV_PROD.
 */
@Component({
  selector: 'rc-preview-channels',
  standalone: true,
  imports: [DatePipe, StatusChipComponent, FilterBarComponent],
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

  readonly previewStale = previewStale;
  readonly signoffStale = signoffStale;

  /** Only candidates that have (or had) a preview channel appear on this screen. */
  readonly withPreview = computed(() =>
    this.rcs().filter((r) => r.preview && r.preview.buildState !== 'NONE'),
  );

  readonly filtered = computed(() =>
    applyFilter(this.withPreview(), this.filter(), this.auth.user()?.email ?? null)
      .filter((rc) => !isProtectedBranch(rc.branch))
      .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)),
  );

  short(sha?: string): string {
    return sha ? sha.slice(0, 7) : '—';
  }
  asValue(e: Event): string {
    return (e.target as HTMLTextAreaElement).value;
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

  showProdGate(rc: ReleaseCandidate): boolean {
    return (
      rc.derivedStatus === 'DEV_MERGED' ||
      rc.derivedStatus === 'OK_FOR_PROD' ||
      rc.derivedStatus === 'PR_TO_PROD' ||
      rc.derivedStatus === 'PROD_MERGED'
    );
  }

  /** Disabled reason for the DEV gate, or null when the tester may act. */
  devReason(rc: ReleaseCandidate): string | null {
    if (!this.auth.hasCapability('SIGNOFF_PREVIEW_DEV'))
      return 'Your role does not grant dev sign-off.';
    if (!allowedByStatus('signoffDev', rc.derivedStatus) || !isFresh('signoffDev', rc))
      return gateReason('signoffDev', rc);
    return null;
  }

  prodReason(rc: ReleaseCandidate): string | null {
    if (!this.auth.hasCapability('SIGNOFF_DEV_PROD'))
      return 'Your role does not grant prod sign-off.';
    if (!allowedByStatus('signoffProd', rc.derivedStatus) || !isFresh('signoffProd', rc))
      return gateReason('signoffProd', rc);
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

  async signProd(rc: ReleaseCandidate, verdict: 'OK' | 'REJECTED'): Promise<void> {
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
