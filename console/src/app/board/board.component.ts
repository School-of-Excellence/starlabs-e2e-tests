import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirebaseService } from '../core/firebase.service';
import { AuthService } from '../core/auth.service';
import { ReleaseCandidate, RcStatus, RC_STATUS_ORDER } from '../core/release-candidate.model';
import { STATUS_META } from './status';
import { ReleaseCardComponent, ActionEvent } from './release-card.component';

/**
 * The board: lists release candidates as cards, with a status filter and a small toast
 * for action results. Data comes from FirebaseService (mock or live).
 */
@Component({
  selector: 'rc-board',
  standalone: true,
  imports: [CommonModule, ReleaseCardComponent],
  template: `
    <section class="board">
      <div class="toolbar">
        <div class="filters">
          <button [class.active]="filter() === null" (click)="filter.set(null)">All</button>
          <button
            *ngFor="let s of statuses"
            [class.active]="filter() === s"
            (click)="filter.set(s)"
            [style.borderColor]="filter() === s ? 'var(' + statusMeta[s].varName + ')' : null"
          >
            {{ statusMeta[s].label }}
          </button>
        </div>
        <span class="muted count">{{ visible().length }} candidate(s)</span>
      </div>

      <div class="grid" *ngIf="visible().length; else empty">
        <rc-release-card *ngFor="let rc of visible()" [rc]="rc" (actioned)="onAction($event)" />
      </div>
      <ng-template #empty>
        <div class="empty muted">No release candidates{{ filter() ? ' for this status' : '' }}.</div>
      </ng-template>

      <div class="toast" *ngIf="toast() as t" [class.err]="!t.ok">{{ t.message }}</div>
    </section>
  `,
  styles: [
    `
      .board { padding: 18px 20px; }
      .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
      .filters { display: flex; gap: 6px; flex-wrap: wrap; }
      .filters button.active { border-color: var(--accent); color: var(--fg); }
      .count { margin-left: auto; }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
        gap: 16px;
        align-items: start;
      }
      .empty { padding: 40px; text-align: center; border: 1px dashed var(--border); border-radius: 10px; }
      .toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--panel-2);
        border: 1px solid var(--st-ok);
        color: var(--fg);
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      }
      .toast.err { border-color: var(--danger); }
    `,
  ],
})
export class BoardComponent {
  private readonly fb = inject(FirebaseService);
  private readonly auth = inject(AuthService);

  readonly statuses: RcStatus[] = RC_STATUS_ORDER;
  readonly statusMeta = STATUS_META;

  private readonly candidates = toSignal(this.fb.releaseCandidates(), {
    initialValue: [] as ReleaseCandidate[],
  });

  readonly filter = signal<RcStatus | null>(null);
  readonly toast = signal<ActionEvent | null>(null);

  readonly visible = computed(() => {
    const f = this.filter();
    const all = this.candidates();
    return f ? all.filter((c) => c.status === f) : all;
  });

  onAction(e: ActionEvent): void {
    this.toast.set(e);
    setTimeout(() => this.toast.set(null), 4000);
    // In mock mode FirebaseService mutates its store; live mode relies on the Firestore
    // stream re-emitting after the webhook updates the doc.
  }
}
