import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReleaseCandidate, RcAction } from '../core/release-candidate.model';
import { AuthService } from '../core/auth.service';
import { FirebaseService } from '../core/firebase.service';
import { STATUS_META, allowedByStatus, requiresApprover } from './status';

/** Emitted when an action button is clicked and resolves (or fails). */
export interface ActionEvent {
  action: RcAction;
  branch: string;
  ok: boolean;
  message: string;
}

/**
 * One release-candidate card: repo, branch, status chip, preview URL, e2e report link,
 * QA notes, and the four action buttons. Buttons are disabled by status AND by role.
 */
@Component({
  selector: 'rc-release-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="card">
      <header class="card-head">
        <div class="ident">
          <span class="repo">{{ rc.repo }}</span>
          <code class="branch">{{ rc.branch }}</code>
        </div>
        <span
          class="chip"
          [style.color]="'var(' + meta.varName + ')'"
          [style.borderColor]="'var(' + meta.varName + ')'"
        >
          <span class="dot" [style.background]="'var(' + meta.varName + ')'"></span>
          {{ meta.label }}
        </span>
      </header>

      <div class="links">
        <a *ngIf="rc.previewUrl" [href]="rc.previewUrl" target="_blank" rel="noopener">▶ Preview</a>
        <a *ngIf="reportUrl" [href]="reportUrl" target="_blank" rel="noopener">e2e report</a>
        <a *ngIf="rc.prDevUrl" [href]="rc.prDevUrl" target="_blank" rel="noopener">PR → dev</a>
        <a *ngIf="rc.prProdUrl" [href]="rc.prProdUrl" target="_blank" rel="noopener">PR → prod</a>
        <span *ngIf="rc.okToReleaseBy" class="muted">OK’d by {{ rc.okToReleaseBy }}</span>
      </div>

      <div class="notes" *ngIf="rc.notes?.length">
        <div class="notes-title">QA notes</div>
        <ul>
          <li *ngFor="let n of rc.notes">
            <span class="muted">{{ n.by }}:</span> {{ n.text }}
          </li>
        </ul>
      </div>

      <footer class="actions">
        <button
          [disabled]="busy() || !can('markOkToRelease')"
          (click)="run('markOkToRelease')"
          [title]="reason('markOkToRelease')"
        >
          Mark OK to Release
        </button>
        <button
          [disabled]="busy() || !can('createPrToDev')"
          (click)="run('createPrToDev')"
          [title]="reason('createPrToDev')"
        >
          Create PR → dev
        </button>
        <button
          [disabled]="busy() || !can('createPrToProd')"
          (click)="run('createPrToProd')"
          [title]="reason('createPrToProd')"
        >
          Create PR → prod
        </button>
        <button
          class="primary"
          [disabled]="busy() || !can('approveAndMerge')"
          (click)="run('approveAndMerge')"
          [title]="reason('approveAndMerge')"
        >
          Approve &amp; Merge
        </button>
      </footer>
    </article>
  `,
  styles: [
    `
      .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .card-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }
      .ident { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .repo { font-weight: 600; }
      .branch { font-size: 12px; align-self: flex-start; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 10px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--chip);
        font-size: 12px;
        white-space: nowrap;
      }
      .dot { width: 8px; height: 8px; border-radius: 50%; }
      .links { display: flex; flex-wrap: wrap; gap: 14px; font-size: 13px; }
      .notes { border-top: 1px solid var(--border); padding-top: 8px; }
      .notes-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--muted); margin-bottom: 4px; }
      .notes ul { margin: 0; padding-left: 16px; }
      .notes li { margin: 2px 0; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; border-top: 1px solid var(--border); padding-top: 12px; }
    `,
  ],
})
export class ReleaseCardComponent {
  @Input({ required: true }) rc!: ReleaseCandidate;
  @Output() actioned = new EventEmitter<ActionEvent>();

  private readonly auth = inject(AuthService);
  private readonly fb = inject(FirebaseService);

  readonly busy = signal(false);

  get meta() {
    return STATUS_META[this.rc.status];
  }

  get reportUrl(): string | null {
    return this.fb.reportUrl(this.rc.reportRunId);
  }

  /** Button enabled only if BOTH the status gate and the role gate pass. */
  can(action: RcAction): boolean {
    if (!allowedByStatus(action, this.rc.status)) return false;
    if (requiresApprover(action) && !this.auth.isApprover()) return false;
    return true;
  }

  /** Tooltip explaining why a button is disabled (status vs role). */
  reason(action: RcAction): string {
    if (!allowedByStatus(action, this.rc.status)) return `Not available from status ${this.rc.status}`;
    if (requiresApprover(action) && !this.auth.isApprover()) return 'Requires an approver (allowlist)';
    return '';
  }

  async run(action: RcAction): Promise<void> {
    if (!this.can(action) || this.busy()) return;
    this.busy.set(true);
    try {
      const by = this.auth.user()?.email ?? 'unknown';
      const res =
        action === 'markOkToRelease'
          ? await this.fb.markOkToRelease(this.rc, by)
          : action === 'createPrToDev'
            ? await this.fb.createPrToDev(this.rc)
            : action === 'createPrToProd'
              ? await this.fb.createPrToProd(this.rc)
              : await this.fb.approveAndMerge(this.rc);
      this.actioned.emit({ action, branch: this.rc.branch, ok: res.ok, message: res.message });
    } catch (e) {
      this.actioned.emit({ action, branch: this.rc.branch, ok: false, message: String(e) });
    } finally {
      this.busy.set(false);
    }
  }
}
