import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TestRunDialogService } from './test-run-dialog.service';
import { FirebaseService, TestPlan } from '../../core/firebase.service';
import { cfRepos, DEFAULT_CF_REPO, DEFAULT_CF_BRANCH } from '../../core/repos';

/**
 * The Test Run confirmation dialog (master plan 2026-07-02, L4/L5): shows the LOCKED suites with
 * the reason each is locked (the matched glob — planTestRun), the optional catalogue as add-ons,
 * and the CF source picker (repo from the registry + branch, default development). The Angular
 * ref is FIXED to the card's branch — shown, never editable (L4). No evidence toggle: report
 * mode with failure-only capture is always on (L7).
 *
 * Mounted once in the shell (rc-test-run-host), like the confirm/toast hosts.
 */
@Component({
  selector: 'rc-test-run-host',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './test-run-dialog.component.html',
  styleUrl: './test-run-dialog.component.css',
  host: {
    '(document:keydown.escape)': 'cancel()',
  },
})
export class TestRunDialogComponent {
  readonly dialog = inject(TestRunDialogService);
  private readonly fb = inject(FirebaseService);

  readonly cfRepoOptions = cfRepos();

  readonly plan = signal<TestPlan | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Optional suites the user ticked (mandatory ones are locked-checked, not in this set). */
  readonly selected = signal<Set<string>>(new Set());

  cfRepo = DEFAULT_CF_REPO;
  cfBranch = DEFAULT_CF_BRANCH;

  constructor() {
    // Load the plan whenever a request opens (repo/branch change ⇒ fresh plan).
    effect(() => {
      const p = this.dialog.pending();
      if (!p) {
        this.plan.set(null);
        return;
      }
      this.selected.set(new Set());
      this.cfRepo = DEFAULT_CF_REPO;
      this.cfBranch = DEFAULT_CF_BRANCH;
      this.error.set(null);
      this.loading.set(true);
      this.fb
        .planTestRun(p.repo, p.branch)
        .then((plan) => this.plan.set(plan))
        .catch((e: unknown) => this.error.set(e instanceof Error ? e.message : String(e)))
        .finally(() => this.loading.set(false));
    });
  }

  toggle(suite: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(suite)) next.delete(suite);
      else next.add(suite);
      return next;
    });
  }

  suiteCount(): number {
    return (this.plan()?.mandatory.length ?? 0) + this.selected().size;
  }

  confirm(): void {
    const plan = this.plan();
    if (!plan) return;
    const suites = [...plan.mandatory.map((m) => m.suite), ...this.selected()];
    if (suites.length === 0) return; // nothing to run — keep the dialog open
    this.dialog.settle({
      suites,
      cfRepo: this.cfRepo || DEFAULT_CF_REPO,
      cfBranch: (this.cfBranch || DEFAULT_CF_BRANCH).trim(),
    });
  }

  cancel(): void {
    this.dialog.settle(null);
  }
}
