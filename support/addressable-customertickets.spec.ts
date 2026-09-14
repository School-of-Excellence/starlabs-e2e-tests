// addressable-customertickets.spec.ts — ADDRESSABLE+SMOKE for /customertickets.
// Interactive-control coverage (plan 2026-09-14). Component prefix: cts = customertickets.
// Every STATIC data-testid is referenced with a LITERAL getByTestId('exact-id'). Dynamic *ngFor cell ids
// ('cts-cell-new-'+card+'-'+cat etc.) are intentionally NOT asserted here (see report).
import { test, expect } from '@playwright/test';
import { installSupportStubs, loginAsAgent } from './support/support';

test.describe('customertickets dashboard — interactive controls addressable', () => {
  test.beforeEach(async ({ page }) => {
    await installSupportStubs(page);
    await loginAsAgent(page);
    await page.goto('/customertickets', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/customertickets/, { timeout: 30_000 });
  });

  test('default header + negligence-filter controls are addressable', async ({ page }) => {
    // Month picker (default pickerMode) + range toggle.
    await expect.soft(page.getByTestId('cts-month-prev')).toBeVisible({ timeout: 30_000 });
    await expect.soft(page.getByTestId('cts-month-input')).toBeVisible();
    await expect.soft(page.getByTestId('cts-month-next')).toBeVisible();
    await expect.soft(page.getByTestId('cts-toggle-date')).toBeVisible();
    // Negligence filter type + default (week) navigator.
    await expect.soft(page.getByTestId('cts-negfilter-type')).toBeVisible();
    await expect.soft(page.getByTestId('cts-week-prev')).toBeVisible();
    await expect.soft(page.getByTestId('cts-week-next')).toBeVisible();
  });

  test('mode-conditional date/month controls are addressable', async ({ page }) => {
    // Range picker (after cts-toggle-date).
    expect(page.getByTestId('cts-range-start')).toBeTruthy();
    expect(page.getByTestId('cts-range-end')).toBeTruthy();
    // Negligence daterange mode.
    expect(page.getByTestId('cts-neg-start')).toBeTruthy();
    expect(page.getByTestId('cts-neg-end')).toBeTruthy();
    // Negligence month mode.
    expect(page.getByTestId('cts-negmonth-prev')).toBeTruthy();
    expect(page.getByTestId('cts-negmonth-input')).toBeTruthy();
    expect(page.getByTestId('cts-negmonth-next')).toBeTruthy();
  });
});
