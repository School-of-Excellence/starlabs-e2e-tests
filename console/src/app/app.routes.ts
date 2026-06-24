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

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./screens/overview/overview.component').then((m) => m.OverviewComponent),
    title: 'Overview · Release Console',
  },
  {
    path: 'branches',
    loadComponent: () =>
      import('./screens/working-branches/working-branches.component').then((m) => m.WorkingBranchesComponent),
    title: 'Working Branches · Release Console',
  },
  {
    path: 'previews',
    loadComponent: () =>
      import('./screens/preview-channels/preview-channels.component').then((m) => m.PreviewChannelsComponent),
    title: 'Preview Channels · Release Console',
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
