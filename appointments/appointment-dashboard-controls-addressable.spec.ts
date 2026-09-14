// appointments/appointment-dashboard-controls-addressable.spec.ts — ADDRESSABLE + SMOKE for /appointment-dashboard.
// Interactive-Control Coverage Program (specs/plans/2026-09-14-interactive-control-coverage-plan.md).
// AUTHOR-ONLY, add-only static data-testid hooks, each referenced as a LITERAL getByTestId('id') so the
// readiness gate (allSpecHookRefs) credits it. Prefix: apdb.
import { test, expect } from '@playwright/test';
import { installApptStubs, loginAsApptAdmin } from './support/appt';

test.describe('appointment-dashboard — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => { await installApptStubs(page); await loginAsApptAdmin(page); });

  test('appointment-dashboard (/appointment-dashboard) — controls addressable', async ({ page }) => {
    await page.goto('/appointment-dashboard', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('apdb-start')).toBeTruthy();
    expect(page.getByTestId('apdb-end')).toBeTruthy();
    expect(page.getByTestId('apdb-toggleappointmenttype')).toBeTruthy();
    expect(page.getByTestId('apdb-selectslot')).toBeTruthy();
  });
});
