import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FirebaseService } from '../core/firebase.service';
import { AuthService } from '../core/auth.service';
import {
  ReleaseCandidate,
  previewStale,
  signoffStale,
  toMillis,
  isProtectedBranch,
} from '../core/release-candidate.model';
import { allowedByStatus, isFresh, gateReason } from '../core/action-gating';
import { StatusChipComponent } from '../shared/status-chip.component';
import {
  FilterBarComponent,
  RcFilter,
  EMPTY_FILTER,
  applyFilter,
} from '../shared/filter-bar.component';
import { ToastService } from '../shared/toast.service';

/**
 * Preview Channels (plan §6.3). For candidates that have a preview: the channel link,
 * a DEV gate (tester OK for dev / Has issues) and — for DEV_MERGED candidates — a PROD
 * gate (Safe for prod / Hold). Gated by SIGNOFF_PREVIEW_DEV / SIGNOFF_DEV_PROD.
 */
@Component({
  selector: 'rc-preview-channels',
  standalone: true,
  imports: [DatePipe, StatusChipComponent, FilterBarComponent],
  template: `
    <header class="head">
      <h2>Preview Channels</h2>
      <p class="muted">Validate preview channels and dev deploys. Testers sign off here.</p>
    </header>

    <rc-filter-bar [candidates]="withPreview()" (changed)="filter.set($event)" />

    <div class="list">
      @for (rc of filtered(); track rc.id) {
        <article class="card">
          <div class="top">
            <div class="ident">
              <div class="branch">{{ rc.branch }}</div>
              <div class="sub muted">{{ rc.repo }} · <code>{{ short(rc.headSha) }}</code></div>
            </div>
            <rc-status-chip [status]="rc.derivedStatus" />
          </div>

          <!-- Preview link -->
          <div class="preview">
            <span class="lbl">Preview channel</span>
            @if (previewUrl(rc); as url) {
              <a [href]="url" target="_blank" rel="noopener">{{ url }} ↗</a>
            } @else {
              <span class="muted">No preview built yet.</span>
            }
            <span class="pstate" [attr.data-tone]="buildTone(rc)">{{ rc.preview.buildState }}</span>
            @if (previewStale(rc)) {
              <span class="warn">⚠ Preview built from an older commit than HEAD — redeploy before sign-off.</span>
            }
          </div>

          <!-- DEV gate -->
          <section class="gate">
            <div class="gate-head">
              <strong>DEV gate</strong>
              <span class="muted">validate the preview → OK for dev</span>
              <span class="verdict" [attr.data-tone]="gateTone(rc.devGate.verdict)">
                {{ rc.devGate.verdict }}
              </span>
            </div>
            @if (rc.devGate.by) {
              <div class="by muted">
                {{ rc.devGate.by }} · {{ rc.devGate.at | date: 'MMM d, HH:mm' }}
                @if (signoffStale(rc.devGate, rc.headSha)) { <span class="warn">stale vs HEAD</span> }
              </div>
            }
            @for (n of rc.devGate.notes ?? []; track n.at) {
              <div class="note">“{{ n.text }}” — {{ n.by }}</div>
            }
            @if (devReason(rc); as reason) {
              <div class="disabled muted">{{ reason }}</div>
            } @else {
              <div class="gate-actions">
                <textarea
                  rows="2"
                  placeholder="Optional QA note…"
                  [value]="devNote()"
                  (input)="devNote.set(asValue($event))"
                ></textarea>
                <div class="btns">
                  <button class="primary" [disabled]="busy() === rc.id" (click)="signDev(rc, 'OK')">
                    OK for dev
                  </button>
                  <button class="reject" [disabled]="busy() === rc.id" (click)="signDev(rc, 'REJECTED')">
                    Has issues
                  </button>
                </div>
              </div>
            }
          </section>

          <!-- PROD gate (only when dev-merged or beyond) -->
          @if (showProdGate(rc)) {
            <section class="gate prod">
              <div class="gate-head">
                <strong>PROD gate</strong>
                <span class="muted">validate the dev deploy → safe for prod</span>
                <span class="verdict" [attr.data-tone]="gateTone(rc.prodGate.verdict)">
                  {{ rc.prodGate.verdict }}
                </span>
              </div>
              @if (rc.prodGate.by) {
                <div class="by muted">
                  {{ rc.prodGate.by }} · {{ rc.prodGate.at | date: 'MMM d, HH:mm' }}
                  @if (signoffStale(rc.prodGate, rc.headSha)) { <span class="warn">stale vs HEAD</span> }
                </div>
              }
              @for (n of rc.prodGate.notes ?? []; track n.at) {
                <div class="note">“{{ n.text }}” — {{ n.by }}</div>
              }
              @if (prodReason(rc); as reason) {
                <div class="disabled muted">{{ reason }}</div>
              } @else {
                <div class="gate-actions">
                  <textarea
                    rows="2"
                    placeholder="Optional QA note…"
                    [value]="prodNote()"
                    (input)="prodNote.set(asValue($event))"
                  ></textarea>
                  <div class="btns">
                    <button class="primary" [disabled]="busy() === rc.id" (click)="signProd(rc, 'OK')">
                      Safe for prod
                    </button>
                    <button class="reject" [disabled]="busy() === rc.id" (click)="signProd(rc, 'REJECTED')">
                      Hold
                    </button>
                  </div>
                </div>
              }
            </section>
          }
        </article>
      } @empty {
        <div class="empty muted">No preview channels match the current filter.</div>
      }
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
      .preview {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin: 14px 0;
        font-size: 13px;
      }
      .preview .lbl {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .pstate {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--border);
        color: var(--muted);
      }
      .pstate[data-tone='ok'] {
        color: var(--st-ok);
        border-color: color-mix(in srgb, var(--st-ok) 45%, transparent);
      }
      .pstate[data-tone='active'] {
        color: var(--accent);
      }
      .pstate[data-tone='bad'] {
        color: var(--danger);
        border-color: color-mix(in srgb, var(--danger) 45%, transparent);
      }
      .warn {
        color: var(--st-pr-prod);
        font-size: 12px;
      }
      .gate {
        margin-top: 12px;
        padding: 12px 14px;
        border-radius: 8px;
        background: var(--panel-2);
        border: 1px solid var(--border);
      }
      .gate.prod {
        border-color: color-mix(in srgb, var(--st-prod-merged) 35%, var(--border));
      }
      .gate-head {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      }
      .gate-head .muted {
        font-size: 12px;
      }
      .verdict {
        margin-left: auto;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 9px;
        border-radius: 999px;
        border: 1px solid var(--border);
        color: var(--muted);
      }
      .verdict[data-tone='ok'] {
        color: var(--st-ok);
        border-color: color-mix(in srgb, var(--st-ok) 45%, transparent);
      }
      .verdict[data-tone='bad'] {
        color: var(--danger);
        border-color: color-mix(in srgb, var(--danger) 45%, transparent);
      }
      .by {
        font-size: 12px;
        margin-top: 6px;
      }
      .note {
        font-size: 12px;
        margin-top: 6px;
        color: var(--fg);
        font-style: italic;
      }
      .gate-actions {
        margin-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      textarea {
        background: var(--bg);
        border: 1px solid var(--border);
        color: var(--fg);
        border-radius: 6px;
        padding: 7px 10px;
        font: inherit;
        font-size: 13px;
        resize: vertical;
      }
      textarea:focus {
        outline: none;
        border-color: var(--accent);
      }
      .btns {
        display: flex;
        gap: 8px;
      }
      .reject {
        border-color: color-mix(in srgb, var(--danger) 50%, var(--border));
        color: var(--danger);
      }
      .reject:hover:not(:disabled) {
        border-color: var(--danger);
      }
      .disabled {
        margin-top: 10px;
        font-size: 12px;
      }
      .empty {
        padding: 40px;
        text-align: center;
      }
    `,
  ],
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
