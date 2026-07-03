import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './core/auth.service';

/** Route guard: only admins may reach Settings; everyone else is redirected to Overview. */
const adminGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAdmin() ? true : router.createUrlTree(['']);
};

/**
 * Role guards mirroring the nav visibility (usability plan 2026-07-02) — nav hiding alone
 * doesn't stop a deep-link, so these enforce the same fence at the route.
 *  - Working Branches → developer/admin
 *  - Preview Channels → tester/admin
 * Unauthorized users are redirected to Overview (visible to everyone).
 */
const devOrAdminGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isDeveloper() || auth.isAdmin() ? true : router.createUrlTree(['']);
};
const testerOrAdminGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isTester() || auth.isAdmin() ? true : router.createUrlTree(['']);
};

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
