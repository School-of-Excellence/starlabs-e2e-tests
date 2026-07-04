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
    // Working Branches = developer workspace (dev/admin). Preview Channels = tester workspace
    // (tester/admin) — testers sign off there. Role split, usability plan 2026-07-02.
    {
      path: 'branches',
      label: 'Working Branches',
      icon: '⎇',
      visible: () => this.auth.isDeveloper() || this.auth.isAdmin(),
    },
    {
      path: 'previews',
      label: 'Preview Channels',
      icon: '◷',
      visible: () => this.auth.isTester() || this.auth.isAdmin(),
    },
    { path: 'release-channel', label: 'Release Channel', icon: '🚀', visible: () => this.auth.isAdmin() },
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
