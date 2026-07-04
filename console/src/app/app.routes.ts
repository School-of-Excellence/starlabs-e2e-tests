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

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./screens/overview/overview.component').then((m) => m.OverviewComponent),
    title: 'Overview · Release Console',
  },
  {
    path: 'branches',
    canActivate: [devOrAdminGuard],
    loadComponent: () =>
      import('./screens/working-branches/working-branches.component').then((m) => m.WorkingBranchesComponent),
    title: 'Working Branches · Release Console',
  },
  {
    path: 'previews',
    canActivate: [testerOrAdminGuard],
    loadComponent: () =>
      import('./screens/preview-channels/preview-channels.component').then((m) => m.PreviewChannelsComponent),
    title: 'Preview Channels · Release Console',
  },
  {
    path: 'release-channel',
    canActivate: [adminGuard],
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
