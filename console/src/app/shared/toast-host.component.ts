import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

/** Renders the toast queue in a fixed bottom-right stack. Mounted once in the shell. */
@Component({
  selector: 'rc-toast-host',
  standalone: true,
  template: `
    <div class="stack">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class.err]="!t.ok" (click)="toast.dismiss(t.id)">
          <span class="dot"></span>
          <span class="msg">{{ t.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .stack {
        position: fixed;
        right: 18px;
        bottom: 18px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 1000;
        max-width: 380px;
      }
      .toast {
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--panel-2);
        border: 1px solid var(--border);
        border-left: 3px solid var(--st-ok);
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 13px;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        animation: slide 0.18s ease-out;
      }
      .toast.err {
        border-left-color: var(--danger);
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--st-ok);
        flex: none;
      }
      .toast.err .dot {
        background: var(--danger);
      }
      @keyframes slide {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
      }
    `,
  ],
})
export class ToastHostComponent {
  readonly toast = inject(ToastService);
}
