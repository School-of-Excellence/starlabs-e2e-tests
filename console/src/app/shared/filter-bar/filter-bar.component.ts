import { Component, computed, input, output, signal } from '@angular/core';
import { ReleaseCandidate, RcStatus } from '../../core/release-candidate.model';
import { STATUS_META } from '../../core/status-meta';

/** The filter model emitted by the bar and consumed by the list screens. */
export interface RcFilter {
  repo: string; // '' = all
  status: string; // '' = all (RcStatus value)
  search: string;
  mineOnly: boolean;
}

export const EMPTY_FILTER: RcFilter = { repo: '', status: '', search: '', mineOnly: false };

/**
 * Apply an RcFilter to a list of candidates. `mine` is the signed-in user's email
 * (matched against headCommit.author); when null, mine-only is a no-op.
 */
export function applyFilter(
  list: ReleaseCandidate[],
  f: RcFilter,
  mine: string | null,
): ReleaseCandidate[] {
  const q = f.search.trim().toLowerCase();
  return list.filter((rc) => {
    if (f.repo && rc.repo !== f.repo) return false;
    if (f.status && rc.derivedStatus !== f.status) return false;
    if (f.mineOnly && mine && rc.headCommit?.author?.toLowerCase() !== mine.toLowerCase())
      return false;
    if (q) {
      const hay = `${rc.repo} ${rc.branch} ${rc.headCommit?.msg ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Shared filter bar used on Working Branches and Preview Channels (plan §6).
 * Inputs: the full candidate list (to derive the repo dropdown). Emits an RcFilter.
 */
@Component({
  selector: 'rc-filter-bar',
  standalone: true,
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.css',
})
export class FilterBarComponent {
  /** The full candidate set — used to populate the repo dropdown. */
  readonly candidates = input<ReleaseCandidate[]>([]);
  /** An initial filter value (e.g. deep-linked from a stat card). */
  readonly initial = input<RcFilter>(EMPTY_FILTER);

  readonly changed = output<RcFilter>();

  readonly f = signal<RcFilter>(EMPTY_FILTER);

  readonly repos = computed(() =>
    Array.from(new Set(this.candidates().map((c) => c.repo))).sort(),
  );

  readonly statuses = (Object.keys(STATUS_META) as RcStatus[]).map((value) => ({
    value,
    label: STATUS_META[value].label,
  }));

  readonly dirty = computed(() => {
    const f = this.f();
    return !!(f.repo || f.status || f.search || f.mineOnly);
  });

  constructor() {
    // Seed from any provided initial filter once.
    queueMicrotask(() => {
      const init = this.initial();
      if (init && init !== EMPTY_FILTER) {
        this.f.set({ ...EMPTY_FILTER, ...init });
        this.changed.emit(this.f());
      }
    });
  }

  patch(part: Partial<RcFilter>): void {
    this.f.update((cur) => ({ ...cur, ...part }));
    this.changed.emit(this.f());
  }

  reset(): void {
    this.f.set({ ...EMPTY_FILTER });
    this.changed.emit(this.f());
  }

  asValue(e: Event): string {
    return (e.target as HTMLInputElement | HTMLSelectElement).value;
  }
  asChecked(e: Event): boolean {
    return (e.target as HTMLInputElement).checked;
  }
}
