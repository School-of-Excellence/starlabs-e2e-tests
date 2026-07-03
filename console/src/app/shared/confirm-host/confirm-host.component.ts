import { Component, inject } from '@angular/core';
import { ConfirmService } from '../confirm.service';

/**
 * Renders the app-wide confirmation dialog when a request is pending. Mounted once in the shell
 * (like the toast host). Escape cancels; clicking the backdrop cancels (usability plan 2026-07-02).
 */
@Component({
  selector: 'rc-confirm-host',
  standalone: true,
  templateUrl: './confirm-host.component.html',
  styleUrl: './confirm-host.component.css',
  host: {
    '(document:keydown.escape)': 'confirm.cancel()',
  },
})
export class ConfirmHostComponent {
  readonly confirm = inject(ConfirmService);
}
