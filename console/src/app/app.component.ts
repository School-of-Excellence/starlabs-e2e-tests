import { Component, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/auth.service';
import { FirebaseService } from './core/firebase.service';
import { Role } from './core/roles';
import { ToastHostComponent } from './shared/toast-host.component';

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
  template: `
    @if (auth.user(); as u) {
      <div class="shell">
        <!-- Side nav -->
        <aside class="nav">
          <div class="brand">
            <span class="logo">◆</span>
            <span class="title">Release Console</span>
          </div>
          <nav>
            @for (item of nav; track item.path) {
              @if (item.visible()) {
                <a
                  [routerLink]="item.path"
                  routerLinkActive="active"
                  [routerLinkActiveOptions]="{ exact: item.path === '' }"
                >
                  <span class="ic">{{ item.icon }}</span>
                  {{ item.label }}
                </a>
              }
            }
          </nav>
          <div class="nav-foot">
            @if (fb.useMock) {
              <span class="env mock">mock data</span>
            } @else {
              <span class="env live">live · starlabs-cicd</span>
            }
          </div>
        </aside>

        <!-- Header + main -->
        <div class="body">
          <header class="topbar">
            <div class="who">
              <span class="email">{{ u.displayName || u.email }}</span>
              <span class="roles">
                @for (r of roles(); track r) {
                  <span class="role" [attr.data-role]="r">{{ r }}</span>
                }
                @if (roles().length === 0) {
                  <span class="role" data-role="none">no roles</span>
                }
              </span>
            </div>
            <button (click)="auth.signOut()">Sign out</button>
          </header>

          <main>
            <router-outlet />
          </main>
        </div>
      </div>
      <rc-toast-host />
    } @else {
      <!-- Login gate -->
      <div class="gate">
        <div class="gate-card">
          <span class="logo">◆</span>
          <h1>Release Console</h1>
          <p class="muted">School of Excellence · CI/CD mission control</p>

          @if (auth.checking()) {
            <div class="spinner" aria-label="Checking access"></div>
            <p class="muted">Verifying your access…</p>
          } @else {
            <button class="primary signin" (click)="auth.signIn()">
              Sign in with Google
            </button>
            <p class="hint muted">Use your &#64;soexcellence.com account.</p>
          }

          @if (auth.signInError(); as err) {
            <div class="error">{{ err }}</div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        /* Extended status tokens for the facet model (base palette is in styles.css). */
        --st-preview-building: #58a6ff;
        --st-preview-live: #3fb950;
        --st-preview-failed: #f85149;
        --st-ok-dev: #3fb950;
        --st-ok-prod: #2ea043;
        display: block;
        min-height: 100vh;
      }

      .shell {
        display: grid;
        grid-template-columns: 232px 1fr;
        min-height: 100vh;
      }

      /* --- Side nav --- */
      .nav {
        background: var(--panel);
        border-right: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        padding: 18px 14px;
        position: sticky;
        top: 0;
        height: 100vh;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 0 8px 18px;
        font-weight: 700;
      }
      .brand .logo {
        color: var(--accent);
        font-size: 18px;
      }
      .brand .title {
        font-size: 14px;
        letter-spacing: 0.2px;
      }
      nav {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      nav a {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 11px;
        border-radius: 7px;
        color: var(--muted);
        font-size: 13.5px;
        font-weight: 500;
      }
      nav a:hover {
        background: var(--panel-2);
        color: var(--fg);
        text-decoration: none;
      }
      nav a.active {
        background: color-mix(in srgb, var(--accent) 18%, transparent);
        color: var(--accent);
      }
      nav a .ic {
        width: 18px;
        text-align: center;
        font-size: 14px;
      }
      .nav-foot {
        margin-top: auto;
        padding: 8px;
      }
      .env {
        font-size: 11px;
        padding: 3px 9px;
        border-radius: 999px;
        border: 1px solid var(--border);
      }
      .env.mock {
        color: var(--st-pr-prod);
        border-color: color-mix(in srgb, var(--st-pr-prod) 45%, transparent);
      }
      .env.live {
        color: var(--st-ok);
        border-color: color-mix(in srgb, var(--st-ok) 45%, transparent);
      }

      /* --- Header + main --- */
      .body {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .topbar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 14px;
        padding: 12px 26px;
        border-bottom: 1px solid var(--border);
        background: var(--panel);
        position: sticky;
        top: 0;
        z-index: 10;
      }
      .who {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-right: auto;
      }
      .email {
        font-size: 13px;
        font-weight: 500;
      }
      .roles {
        display: inline-flex;
        gap: 6px;
      }
      .role {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        padding: 2px 7px;
        border-radius: 999px;
        border: 1px solid var(--border);
        color: var(--muted);
      }
      .role[data-role='developer'] {
        color: var(--st-pr-dev);
        border-color: color-mix(in srgb, var(--st-pr-dev) 45%, transparent);
      }
      .role[data-role='tester'] {
        color: var(--st-ok);
        border-color: color-mix(in srgb, var(--st-ok) 45%, transparent);
      }
      .role[data-role='admin'] {
        color: var(--st-prod-merged);
        border-color: color-mix(in srgb, var(--st-prod-merged) 45%, transparent);
      }
      main {
        padding: 26px;
        max-width: 1200px;
        width: 100%;
      }

      /* --- Login gate --- */
      .gate {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
      }
      .gate-card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 40px 44px;
        text-align: center;
        max-width: 380px;
        width: 100%;
      }
      .gate-card .logo {
        color: var(--accent);
        font-size: 34px;
      }
      .gate-card h1 {
        font-size: 20px;
        margin: 10px 0 4px;
      }
      .gate-card p {
        margin: 4px 0;
        font-size: 13px;
      }
      .signin {
        margin: 22px 0 6px;
        width: 100%;
        padding: 10px;
      }
      .hint {
        font-size: 12px;
      }
      .error {
        margin-top: 16px;
        padding: 10px 12px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--danger) 14%, transparent);
        border: 1px solid color-mix(in srgb, var(--danger) 45%, transparent);
        color: var(--danger);
        font-size: 12.5px;
      }
      .spinner {
        width: 26px;
        height: 26px;
        margin: 22px auto 10px;
        border: 3px solid var(--border);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 720px) {
        .shell {
          grid-template-columns: 1fr;
        }
        .nav {
          position: static;
          height: auto;
          flex-direction: row;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }
        .nav nav {
          flex-direction: row;
          flex-wrap: wrap;
        }
        .nav-foot {
          margin: 0;
        }
      }
    `,
  ],
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
