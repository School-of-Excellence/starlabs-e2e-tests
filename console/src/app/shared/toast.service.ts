import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  ok: boolean;
  message: string;
}

/** Lightweight toast queue for action results (createPr / signoff / setMember …). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(ok: boolean, message: string): void {
    const id = ++this.seq;
    this.toasts.update((t) => [...t, { id, ok, message }]);
    setTimeout(() => this.dismiss(id), 4200);
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
