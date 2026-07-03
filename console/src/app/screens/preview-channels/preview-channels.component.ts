import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FirebaseService } from '../../core/firebase.service';
import { AuthService } from '../../core/auth.service';
import {
  ReleaseCandidate,
  RcStatus,
  GateFacet,
  RcNote,
  previewStale,
  signoffStale,
  shippingBadge,
  toMillis,
  isProtectedBranch,
} from '../../core/release-candidate.model';
import { StatusChipComponent } from '../../shared/status-chip/status-chip.component';
import { ActivityDrawerComponent } from '../../shared/activity-drawer/activity-drawer.component';
import {
  FilterBarComponent,
  RcFilter,
  EMPTY_FILTER,
  applyFilter,
} from '../../shared/filter-bar/filter-bar.component';
import { ToastService } from '../../shared/toast.service';
import { ConfirmService } from '../../shared/confirm.service';
import { TestRunDialogService } from '../../shared/test-run-dialog/test-run-dialog.service';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Previews & Deploys (promotion-chain, tester-gate revision 2026-06-25). Testers validate here:
 *  - FEATURE previews → the DEV gate ("OK for dev").
 *  - the DEVELOPMENT deploy (starlabs-test) → "OK to promote" (validates the dev deploy → enables
 *    Create PR → prod on the development entry).
 *  - the PRODUCTION deploy (fir-sample) → "Validated" (release-validation record; gates nothing).
 *
 * "After every deploy, tester says okay": a new successful dev deploy clears the prior validation
 * (server-side), so the tester must re-approve the current deploy.
 */
@Component({
  selector: 'rc-preview-channels',
  standalone: true,
  imports: [DatePipe, StatusChipComponent, FilterBarComponent, ActivityDrawerComponent, RouterLink],
  templateUrl: './preview-channels.component.html',
  styleUrl: './preview-channels.component.css',
})
export class PreviewChannelsComponent {
  private readonly fb = inject(FirebaseService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly testDialog = inject(TestRunDialogService);

  readonly rcs = toSignal(this.fb.releaseCandidates(), { initialValue: [] as ReleaseCandidate[] });
  readonly filter = signal<RcFilter>(EMPTY_FILTER);
  readonly busy = signal<string | null>(null);
  readonly devNote = signal('');
  readonly prodNote = signal('');
  /** Branch whose activity drawer (full release-note history) is open, or null. */
  readonly selected = signal<{ id: string; label: string } | null>(null);

  /** The most recent note on a gate (the rest live in the activity-log drawer). */
  latestNote(gate: GateFacet): RcNote | null {
    const notes = gate?.notes;
    return notes && notes.length ? notes[notes.length - 1] : null;
  }
  /** Fixed environment deploy URL (D3). */
  envUrl(branch: string): string | null {
    return environment.environmentUrls?.[branch] ?? null;
  }
  openLog(rc: ReleaseCandidate): void {
    this.selected.set({ id: rc.id, label: rc.branch });
  }

  readonly previewStale = previewStale;
  readonly signoffStale = signoffStale;

  /** Feature candidates with a preview channel (the dev-gate cards). */
  readonly withPreview = computed(() =>
    this.rcs().filter((r) => r.preview && r.preview.buildState !== 'NONE'),
  );

  /**
   * A branch that is READY TO TEST and still awaiting the tester's "OK for dev": a current live
   * preview (fresh vs HEAD) that has not been signed off. These get the tester's attention first
   * (usability plan 2026-07-02).
   */
  awaitingDevSignoff(rc: ReleaseCandidate): boolean {
    return (
      rc.preview.buildState === 'LIVE' && !previewStale(rc) && rc.devGate.verdict !== 'OK'
    );
  }

  /**
   * Feature preview cards. Sorted READY-TO-TEST first (awaiting OK for dev), then by updatedAt desc
   * so testers focus on what needs sign-off (usability plan 2026-07-02).
   */
  readonly filtered = computed(() =>
    applyFilter(this.withPreview(), this.filter(), this.auth.user()?.email ?? null)
      .filter((rc) => !isProtectedBranch(rc.branch))
      .sort((a, b) => {
        const wa = this.awaitingDevSignoff(a) ? 1 : 0;
        const wb = this.awaitingDevSignoff(b) ? 1 : 0;
        if (wa !== wb) return wb - wa;
        return toMillis(b.updatedAt) - toMillis(a.updatedAt);
      }),
  );

  /** Count of branches awaiting "OK for dev" — shown in the filter bar. */
  readonly pendingDevCount = computed(
    () => this.withPreview().filter((rc) => !isProtectedBranch(rc.branch) && this.awaitingDevSignoff(rc)).length,
  );

  /**
   * Development deploys only — the tester validates these to allow promotion. Production is NOT
   * listed: once code is in production there's nothing left to approve (operator, 2026-06-25).
   */
  readonly envEntries = computed(() =>
    this.rcs()
      .filter((rc) => rc.branch === 'development')
      .sort((a, b) => a.repo.localeCompare(b.repo)),
  );

  short(sha?: string): string {
    return sha ? sha.slice(0, 7) : '—';
  }
  asValue(e: Event): string {
    return (e.target as HTMLTextAreaElement).value;
  }
  isProd(rc: ReleaseCandidate): boolean {
    return rc.branch === 'production';
  }

  previewUrl(rc: ReleaseCandidate): string | null {
    return rc.preview.url ?? this.fb.previewUrlFor(rc.repo, rc.branch);
  }

  buildTone(rc: ReleaseCandidate): string {
    switch (rc.preview.buildState) {
      case 'LIVE':
        return 'ok';
      case 'BUILDING':
        return 'active';
      case 'FAILED':
        return 'bad';
      default:
        return 'none';
    }
  }
  gateTone(v: string): string {
    return v === 'OK' ? 'ok' : v === 'REJECTED' ? 'bad' : 'none';
  }

  // --- Preview-time test-suite gate (preview-e2e.yml report, shown at sign-off) ---------------
  gateRunLabel(s: string): string {
    return s === 'RUNNING' ? 'running…' : s === 'QUEUED' ? 'queued' : s === 'PASSED' ? 'passed' : 'failed';
  }
  gateRunTone(s: string): string {
    return s === 'PASSED' ? 'ok' : s === 'FAILED' ? 'bad' : 'active';
  }
  /** "View report" deep-link for the gate run (cicd-audit dashboard or run page). */
  reportUrl(rc: ReleaseCandidate): string | null {
    return this.fb.reportUrlFor(rc);
  }
  /** The test report ran against an older build than HEAD — re-test before trusting it. */
  gateStale(rc: ReleaseCandidate): boolean {
    return !!rc.gateRun?.sha && !!rc.headSha && rc.gateRun.sha !== rc.headSha;
  }
  /** Internal /report/… route vs external GitHub href (service contract). */
  reportIsRoute(url: string): boolean {
    return url.startsWith('/');
  }
  /** No gate ever ran for this build — the tester must know they're approving untested code. */
  noTestOnBuild(rc: ReleaseCandidate): boolean {
    if (rc.preview.buildState !== 'LIVE') return false;
    const g = rc.gateRun;
    return !g || g.status === 'NONE';
  }

  /** [Run tests…] — tester re-runs suites on this branch (ref fixed to the card, L4/L6). */
  async runTestsFor(rc: ReleaseCandidate): Promise<void> {
    const choice = await this.testDialog.open({ repo: rc.repo, branch: rc.branch, mode: 'test-only' });
    if (!choice) return;
    this.busy.set(rc.id);
    try {
      const res = await this.fb.runTests(rc, choice);
      this.toast.show(res.ok, res.message);
    } finally {
      this.busy.set(null);
    }
  }

  /** Deploy-status pill for an environment entry. */
  deployLabel(rc: ReleaseCandidate): string | null {
    const s = (rc.lastDeploymentState ?? '').toLowerCase();
    if (!s) return null;
    if (s === 'success') return 'deployed';
    if (s === 'failure' || s === 'error') return 'deploy failed';
    if (s === 'in_progress' || s === 'queued' || s === 'pending') return 'deploying…';
    return s;
  }
  deployTone(rc: ReleaseCandidate): string {
    const s = (rc.lastDeploymentState ?? '').toLowerCase();
    if (s === 'success') return 'ok';
    if (s === 'failure' || s === 'error') return 'bad';
    if (s === 'in_progress' || s === 'queued' || s === 'pending') return 'active';
    return 'none';
  }

  /** True when the dev gate's OK verdict is for the CURRENT preview (no re-approval needed). */
  devSignedCurrent(rc: ReleaseCandidate): boolean {
    return rc.devGate.verdict === 'OK' && !signoffStale(rc.devGate, rc.headSha);
  }

  /** Disabled reason for the FEATURE dev gate, or null when the tester may (re-)approve. */
  devReason(rc: ReleaseCandidate): string | null {
    if (!this.auth.hasCapability('SIGNOFF_PREVIEW_DEV'))
      return 'Your role does not grant dev sign-off.';
    if (rc.preview.buildState !== 'LIVE' || previewStale(rc))
      return 'Deploy a fresh preview for the current commit before signing off.';
    if (this.devSignedCurrent(rc)) return 'Signed off for the current preview.';
    return null;
  }

  /** Disabled reason for an ENVIRONMENT deploy validation, or null when the tester may approve. */
  envReason(rc: ReleaseCandidate): string | null {
    if (!this.auth.hasCapability('SIGNOFF_DEV_PROD'))
      return 'Your role does not grant deploy sign-off.';
    if (rc.lastDeploymentState !== 'success')
      return 'Waiting for the deploy to finish (or it failed).';
    if (rc.prodGate.verdict === 'OK') return 'Validated for the current deploy.';
    return null;
  }

  // --- Derived shipping badge + promotion batch (usability plan 2026-07-02) ------------------

  private devEntryFor(repo: string): ReleaseCandidate | undefined {
    return this.rcs().find((rc) => rc.repo === repo && rc.branch === 'development');
  }
  /** The per-feature PROD-lane badge (OK for prod / PR → prod / Prod merged), or null. */
  shipping(rc: ReleaseCandidate): RcStatus | null {
    return shippingBadge(rc, this.devEntryFor(rc.repo));
  }

  /** The unreleased feature branches for a repo — the batch an "OK to promote" covers. */
  batch(repo: string): ReleaseCandidate[] {
    return this.rcs()
      .filter((rc) => rc.repo === repo && !isProtectedBranch(rc.branch) && rc.unreleased)
      .sort((a, b) => a.branch.localeCompare(b.branch));
  }
  /** "branch — latest OK-for-dev note" lines for the batch (inline list + confirm dialog). */
  batchLines(repo: string): string[] {
    return this.batch(repo).map((rc) => {
      const n = this.latestNote(rc.devGate);
      return n ? `${rc.branch} — “${n.text}”` : rc.branch;
    });
  }

  async signDev(rc: ReleaseCandidate, verdict: 'OK' | 'REJECTED'): Promise<void> {
    const note = this.devNote().trim();
    const ok =
      verdict === 'OK'
        ? await this.confirm.ask({
            title: 'Sign off “OK for dev”?',
            message: `This records your sign-off for ${rc.branch} (${rc.repo}) and lets the developer open a PR → development.`,
            confirmLabel: 'OK for dev',
            detailsHeading: note ? 'Your note:' : undefined,
            details: note ? [note] : undefined,
          })
        : await this.confirm.ask({
            title: 'Reject this preview?',
            message: `This records a rejection for ${rc.branch} (${rc.repo}). The developer will need to address it and redeploy.`,
            confirmLabel: 'Report issues',
            tone: 'danger',
            detailsHeading: note ? 'Your note:' : undefined,
            details: note ? [note] : undefined,
          });
    if (!ok) return;
    this.busy.set(rc.id);
    try {
      const res = await this.fb.signoffDev(rc, verdict, note || undefined);
      this.toast.show(res.ok, res.message);
      this.devNote.set('');
    } finally {
      this.busy.set(null);
    }
  }

  async signEnv(rc: ReleaseCandidate, verdict: 'OK' | 'REJECTED'): Promise<void> {
    const note = this.prodNote().trim();
    const lines = this.batchLines(rc.branch === 'development' ? rc.repo : '');
    const ok =
      verdict === 'OK'
        ? await this.confirm.ask({
            title: this.isProd(rc) ? 'Validate this production release?' : 'OK to promote?',
            message: this.isProd(rc)
              ? `This records production validation for ${rc.repo}.`
              : `This validates the development deploy for ${rc.repo} and enables the promotion (Create PR → production). The following branches will be included:`,
            confirmLabel: this.isProd(rc) ? 'Validated' : 'OK to promote',
            tone: 'prod',
            detailsHeading: !this.isProd(rc) && lines.length ? `${lines.length} branch${lines.length === 1 ? '' : 'es'} in this promotion:` : note ? 'Your note:' : undefined,
            details: !this.isProd(rc) && lines.length ? lines : note ? [note] : undefined,
          })
        : await this.confirm.ask({
            title: this.isProd(rc) ? 'Flag a production issue?' : 'Hold this promotion?',
            message: `This records a hold/issue for ${rc.repo}'s ${rc.branch} deploy.`,
            confirmLabel: this.isProd(rc) ? 'Flag issue' : 'Hold',
            tone: 'danger',
            detailsHeading: note ? 'Your note:' : undefined,
            details: note ? [note] : undefined,
          });
    if (!ok) return;
    this.busy.set(rc.id);
    try {
      const res = await this.fb.signoffProd(rc, verdict, note || undefined);
      this.toast.show(res.ok, res.message);
      this.prodNote.set('');
    } finally {
      this.busy.set(null);
    }
  }
}
