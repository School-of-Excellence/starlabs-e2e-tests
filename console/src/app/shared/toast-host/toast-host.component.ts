import { Component, inject } from '@angular/core';
import { ToastService } from '../toast.service';

/** Renders the toast queue in a fixed bottom-right stack. Mounted once in the shell. */
@Component({
  selector: 'rc-toast-host',
  standalone: true,
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.css',
})
export class ToastHostComponent {
  readonly toast = inject(ToastService);
}
