import { Component, computed, effect, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/auth.service';
import { FirebaseService } from './core/firebase.service';
import { Role } from './core/roles';
import { ToastHostComponent } from './shared/toast-host/toast-host.component';
import { ConfirmHostComponent } from './shared/confirm-host/confirm-host.component';
import { TestRunDialogComponent } from './shared/test-run-dialog/test-run-dialog.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  visible: () => boolean;
}

/**
 * Console shell (plan §6): left side-nav (role-gated) + header (user + role chips +
 * sign-out) + a router-outlet main area. When signed out, a centered login gate.
 *
 * The :host block also defines the extended `--st-*` status tokens the facet model's
 * status-meta.ts references (preview-building/live/failed, ok-dev, ok-prod), layering
 * on top of the base palette in styles.css.
 */
@Component({
  selector: 'rc-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHostComponent, ConfirmHostComponent, TestRunDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly fb = inject(FirebaseService);
  private readonly router = inject(Router);

  readonly roles = computed<Role[]>(() => this.auth.roles());

  constructor() {
    // Deep-link through sign-in: a signed-out visitor to a guarded route was redirected to Overview
    // with ?returnUrl=…; once they sign in (user() becomes set), send them back to the target.
    effect(() => {
      if (!this.auth.user()) return;
      const ret = new URL(window.location.href).searchParams.get('returnUrl');
      if (ret) void this.router.navigateByUrl(ret);
    });
  }

  readonly nav: NavItem[] = [
    { path: '', label: 'Overview', icon: '◎', visible: () => true },
    // CUTOVER 2026-09-10 — Working Branches is now the ONE screen the whole flow runs on, so every
    // role sees it: a developer views + rechecks, a tester approves for rollout, an admin bypasses.
    // The buttons on the card are still capability-gated and the server re-checks each one, so
    // widening this entry grants nobody an action they did not already hold.
    {
      path: 'branches',
      label: 'Working Branches',
      icon: '⎇',
      visible: () => this.auth.isDeveloper() || this.auth.isTester() || this.auth.isAdmin(),
    },
    // Release Channel is READ-ONLY as of 2026-09-10 and visible to EVERY role: it is the only view
    // of the development/production lanes — which Working Branches filters out
    // (!isProtectedBranch) — so it is where anyone goes to see the dev/prod deploy links and which
    // branches actually made it into the current release batch. It drives nothing: the
    // development → production PR is opened automatically by ensureDevToProdPr.
    {
      path: 'release-channel',
      label: 'Release Channel',
      icon: '🚀',
      visible: () => this.auth.isDeveloper() || this.auth.isTester() || this.auth.isAdmin(),
    },
    // REMOVED FROM THE NAV (not deleted — route and component are intact and reachable by URL):
    //   'previews'  Preview Channels — fully superseded by the card's stage ① / ④, and its URL
    //               fallback previewUrlFor() builds a link that cannot resolve.
    // CF Board (master plan 2026-07-02, L17): CF branches + Dev/Prod function matrix — dev/admin.
    {
      path: 'cf-board',
      label: 'CF Board',
      icon: 'ƒ',
      visible: () => this.auth.isDeveloper() || this.auth.isAdmin(),
    },
    // Test Suites (operator flow 2026-07-03): read-only routing-map viewer — everyone.
    { path: 'suites', label: 'Test Suites', icon: '▦', visible: () => true },
    { path: 'settings', label: 'Settings', icon: '⚙', visible: () => this.auth.isAdmin() },
  ];
}
