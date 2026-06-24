import { Component, computed, input } from '@angular/core';
import { RcStatus } from '../../core/release-candidate.model';
import { STATUS_META } from '../../core/status-meta';

/** A single derived-status chip, colored from STATUS_META's CSS variable token. */
@Component({
  selector: 'rc-status-chip',
  standalone: true,
  templateUrl: './status-chip.component.html',
  styleUrl: './status-chip.component.css',
})
export class StatusChipComponent {
  readonly status = input.required<RcStatus>();
  readonly meta = computed(() => STATUS_META[this.status()]);
  readonly color = computed(() => `var(${this.meta().varName})`);
}
