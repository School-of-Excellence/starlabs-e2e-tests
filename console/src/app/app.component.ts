import { Component, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/auth.service';
import { FirebaseService } from './core/firebase.service';
import { Role } from './core/roles';
import { ToastHostComponent } from './shared/toast-host/toast-host.component';

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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHostComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly fb = inject(FirebaseService);

  readonly roles = computed<Role[]>(() => this.auth.roles());

  readonly nav: NavItem[] = [
    { path: '', label: 'Overview', icon: '◎', visible: () => true },
    { path: 'branches', label: 'Working Branches', icon: '⎇', visible: () => true },
    {
      path: 'previews',
      label: 'Preview Channels',
      icon: '◷',
      visible: () => this.auth.isDeveloper() || this.auth.isTester() || this.auth.isAdmin(),
    },
    { path: 'settings', label: 'Settings', icon: '⚙', visible: () => this.auth.isAdmin() },
  ];
}
