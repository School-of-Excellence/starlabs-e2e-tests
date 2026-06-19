import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth.service';
import { FirebaseService } from './core/firebase.service';
import { BoardComponent } from './board/board.component';

/** Console shell: header (project pill, user, sign-out) + the board. */
@Component({
  selector: 'rc-root',
  standalone: true,
  imports: [CommonModule, BoardComponent],
  template: `
    <header class="topbar">
      <h1>StarLabs · Release Console</h1>
      <span class="pill">release-candidates · starlabs-cicd</span>
      <span class="pill mock" *ngIf="fb.useMock">mock data</span>
      <span class="sp"></span>
      <ng-container *ngIf="auth.user() as u; else signedOut">
        <span class="user">
          {{ u.displayName || u.email }}
          <span class="role" *ngIf="auth.isApprover()" title="On approver allowlist">approver</span>
        </span>
        <button (click)="auth.signOut()">Sign out</button>
      </ng-container>
      <ng-template #signedOut>
        <button class="primary" (click)="auth.signIn()">Sign in</button>
        <span *ngIf="auth.signInError() as err" style="color:#f87171;font-size:12px;max-width:300px">{{ err }}</span>
      </ng-template>
    </header>

    <rc-board *ngIf="auth.user(); else needsAuth" />
    <ng-template #needsAuth>
      <div class="gate muted">Sign in with your team Google account to view the board.</div>
    </ng-template>
  `,
  styles: [
    `
      .topbar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 20px;
        border-bottom: 1px solid var(--border);
        background: var(--panel);
        position: sticky;
        top: 0;
        z-index: 10;
      }
      h1 { font-size: 15px; margin: 0; font-weight: 600; letter-spacing: 0.2px; }
      .pill {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--border);
        color: var(--muted);
      }
      .pill.mock { color: var(--st-pr-prod); border-color: var(--st-pr-prod); }
      .sp { flex: 1; }
      .user { font-size: 13px; display: inline-flex; align-items: center; gap: 8px; }
      .role {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        padding: 1px 6px;
        border-radius: 999px;
        border: 1px solid var(--st-ok);
        color: var(--st-ok);
      }
      .gate { padding: 60px; text-align: center; }
    `,
  ],
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly fb = inject(FirebaseService);
}
