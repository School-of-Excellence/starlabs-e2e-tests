import { Injectable, signal } from '@angular/core';
import { TestRunChoice } from '../../core/firebase.service';

/**
 * App-wide Test Run dialog (master plan 2026-07-02, L4/L5/L6). ONE dialog, four entry points:
 * Deploy-with-tests (Working Branches) and [Run tests…] on Working Branches / Preview Channels /
 * Release Channel. `open()` resolves with the confirmed choice (suites + CF source) or null on
 * cancel. Mirrors the ConfirmService pattern; the host component does the plan loading + UI.
 */

export interface TestRunRequest {
  repo: string;
  branch: string;
  /** 'deploy' = confirm ALSO deploys the preview; 'test-only' = gate dispatch only. */
  mode: 'deploy' | 'test-only';
}

interface PendingTestRun extends TestRunRequest {
  resolve: (choice: TestRunChoice | null) => void;
}

@Injectable({ providedIn: 'root' })
export class TestRunDialogService {
  readonly pending = signal<PendingTestRun | null>(null);

  open(req: TestRunRequest): Promise<TestRunChoice | null> {
    this.pending()?.resolve(null);
    return new Promise<TestRunChoice | null>((resolve) => this.pending.set({ ...req, resolve }));
  }

  settle(choice: TestRunChoice | null): void {
    const p = this.pending();
    if (!p) return;
    this.pending.set(null);
    p.resolve(choice);
  }
}
