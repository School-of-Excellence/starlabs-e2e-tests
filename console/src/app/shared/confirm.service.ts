import { Injectable, signal } from '@angular/core';

/**
 * Visual tier for a confirmation (usability plan 2026-07-02):
 *  - `default` — most mutating actions (deploy, create PR → dev, sign-off, reject, mute).
 *  - `prod`    — production-facing, highest-stakes (OK to promote, Create PR → prod).
 *  - `danger`  — destructive / access-changing (member role changes).
 */
export type ConfirmTone = 'default' | 'prod' | 'danger';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** Optional heading above the details list, e.g. "Promoting 3 branches to production:". */
  detailsHeading?: string;
  /** Optional highlighted lines — the batch branches, a role restatement, or a note to review. */
  details?: string[];
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

/**
 * App-wide confirmation dialog. One instance; `ask()` returns a Promise<boolean> that resolves
 * true on confirm, false on cancel/escape. Mirrors the ToastService / ToastHostComponent pattern
 * so every screen shares one consistent dialog rather than bespoke per-button modals.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<PendingConfirm | null>(null);

  ask(req: ConfirmRequest): Promise<boolean> {
    // If a dialog is somehow already open, resolve it false before opening the new one.
    this.pending()?.resolve(false);
    return new Promise<boolean>((resolve) => this.pending.set({ ...req, resolve }));
  }

  private settle(ok: boolean): void {
    const p = this.pending();
    if (!p) return;
    this.pending.set(null);
    p.resolve(ok);
  }
  confirm(): void {
    this.settle(true);
  }
  cancel(): void {
    this.settle(false);
  }
}
