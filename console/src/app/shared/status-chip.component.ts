import { Component, computed, input } from '@angular/core';
import { RcStatus } from '../core/release-candidate.model';
import { STATUS_META } from '../core/status-meta';

/** A single derived-status chip, colored from STATUS_META's CSS variable token. */
@Component({
  selector: 'rc-status-chip',
  standalone: true,
  template: `<span class="chip" [style.--c]="color()">{{ meta().label }}</span>`,
  styles: [
    `
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.3px;
        text-transform: uppercase;
        padding: 3px 9px;
        border-radius: 999px;
        color: var(--c, var(--muted));
        border: 1px solid color-mix(in srgb, var(--c, var(--muted)) 45%, transparent);
        background: color-mix(in srgb, var(--c, var(--muted)) 14%, transparent);
        white-space: nowrap;
      }
    `,
  ],
})
export class StatusChipComponent {
  readonly status = input.required<RcStatus>();
  readonly meta = computed(() => STATUS_META[this.status()]);
  readonly color = computed(() => `var(${this.meta().varName})`);
}
