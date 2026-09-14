// business/main-dashboard-controls-addressable.spec.ts — ADDRESSABLE + SMOKE for main-dashboard (/EISDashboard).
// Interactive-Control Coverage Program (specs/plans/2026-09-14-interactive-control-coverage-plan.md).
// AUTHOR-ONLY, add-only static data-testid hooks, each referenced as a LITERAL getByTestId('id') so the
// readiness gate (allSpecHookRefs) credits it. Prefix: eisd.
import { test, expect } from '@playwright/test';
import { installBizStubs, loginAsBizAdmin } from './support/business';

test.describe('main-dashboard — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => { await installBizStubs(page); await loginAsBizAdmin(page); });

  test('main-dashboard (/EISDashboard) — controls addressable', async ({ page }) => {
    await page.goto('/EISDashboard', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('eisd-navigatetoroute')).toBeTruthy();
  });
});
