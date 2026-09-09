import { Routes, Router, RouterStateSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { filter, take, map } from 'rxjs';
import { AuthService } from './core/auth.service';

/**
 * Role guards mirroring the nav visibility (usability plan 2026-07-02) — nav hiding alone doesn't
 * stop a deep-link, so these enforce the same fence at the route.
 *  - Settings / Release Channel → admin
 *  - Working Branches / CF Board → developer/admin
 *  - Preview Channels → tester/admin
 *
 * CRITICAL: auth resolves ASYNCHRONOUSLY (authState → member fetch), but a hard page load (deep
 * link, or a `target=_blank` new tab) runs the guard immediately. Deciding on not-yet-loaded roles
 * used to reject every guarded route and bounce to Overview (the `/release-channel → /` bug). So
 * each guard WAITS for `authReady` before deciding. When an UNauthenticated visitor is turned away
 * we stash `returnUrl` so the post-sign-in redirect (app.component) lands them back on target.
 */
function roleGuard(allow: (a: AuthService) => boolean) {
  return (_route: unknown, state: RouterStateSnapshot) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.authReady$.pipe(
      filter(Boolean),
      take(1),
      map(() => {
        if (allow(auth)) return true;
        // Signed in but wrong role → Overview. Signed out → Overview + returnUrl (restored on login).
        return auth.user()
          ? router.createUrlTree([''])
          : router.createUrlTree([''], { queryParams: { returnUrl: state.url } });
      }),
    );
  };
}

const adminGuard = roleGuard((a) => a.isAdmin());
const devOrAdminGuard = roleGuard((a) => a.isDeveloper() || a.isAdmin());
const testerOrAdminGuard = roleGuard((a) => a.isTester() || a.isAdmin());
/** Any assigned role. Membership itself is enforced upstream by the auth gate. */
const anyMemberGuard = roleGuard((a) => a.isDeveloper() || a.isTester() || a.isAdmin());

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./screens/overview/overview.component').then((m) => m.OverviewComponent),
    title: 'Overview · Release Console',
  },
  {
    // CUTOVER 2026-09-10 — every role, not just dev/admin. This is the ONE screen the new flow runs
    // on, and it carries the TESTER's only action (Approve for rollout). Under the old guard a pure
    // tester was bounced to Overview and could not do their job at all.
    // Widening the ROUTE grants no ACTION: each button is still gated by its capability
    // (APPROVE_ROLLOUT / BYPASS_SUITE_STATUS) and every callable re-checks server-side.
    path: 'branches',
    canActivate: [anyMemberGuard],
    loadComponent: () =>
      import('./screens/working-branches/working-branches.component').then((m) => m.WorkingBranchesComponent),
    title: 'Working Branches · Release Console',
  },
  {
    // NOT IN THE SIDE NAV as of 2026-09-10 (app.component.ts), and superseded by the Working
    // Branches card. Route deliberately KEPT so the screen stays reachable by URL and nothing is
    // deleted — remove it only once the old flow is retired for good.
    path: 'previews',
    canActivate: [testerOrAdminGuard],
    loadComponent: () =>
      import('./screens/preview-channels/preview-channels.component').then((m) => m.PreviewChannelsComponent),
    title: 'Preview Channels · Release Console',
  },
  {
    // READ-ONLY and open to EVERY role as of 2026-09-10 (was adminGuard). Its actions are gone —
    // ensureDevToProdPr opens the development → production PR automatically — so what remains is
    // information every role needs: the dev/prod deploy links and which branches are in the batch.
    // Working Branches filters protected branches out, so this is the only place that shows them.
    path: 'release-channel',
    canActivate: [anyMemberGuard],
    loadComponent: () =>
      import('./screens/release-channel/release-channel.component').then((m) => m.ReleaseChannelComponent),
    title: 'Release Channel · Release Console',
  },
  {
    // Test Suites (operator flow 2026-07-03) — read-only view of the suites-manifest mirror.
    // Any active member (the shell's member gate is the fence, like Overview).
    path: 'suites',
    loadComponent: () =>
      import('./screens/suites/suites.component').then((m) => m.SuitesComponent),
    title: 'Test Suites · Release Console',
  },
  {
    // CF Board (master plan 2026-07-02, L17) — CF branches + the Dev/Prod function matrix.
    // Developer/admin only, same fence as Working Branches.
    path: 'cf-board',
    canActivate: [devOrAdminGuard],
    loadComponent: () =>
      import('./screens/cf-board/cf-board.component').then((m) => m.CfBoardComponent),
    title: 'CF Board · Release Console',
  },
  {
    // In-console Test Report (report plan LOCKED 2026-07-02; suite tabs = D1). Any active member
    // may read reports (the shell's member gate is the fence — same visibility as Overview).
    path: 'report/:githubRunId',
    loadComponent: () =>
      import('./screens/report/report.component').then((m) => m.ReportComponent),
    title: 'Test Report · Release Console',
  },
  {
    path: 'settings',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./screens/settings/settings.component').then((m) => m.SettingsComponent),
    title: 'Settings · Release Console',
  },
  { path: '**', redirectTo: '' },
];
