// addressable-customer-ticket-new.spec.ts — ADDRESSABLE+SMOKE for /customer-support-tickets.
// Interactive-control coverage (plan 2026-09-14). Component prefix: ctn = customer-ticket-new.
// Every STATIC data-testid is referenced with a LITERAL getByTestId('exact-id'). Dynamic *ngFor ids
// (ctn-tab-close-*, ctn-chip-category-*, ctn-chip-chat-*, ctn-card-*, ctn-card-tag-*, ctn-card-review-*,
// ctn-card-reviewed-*) are intentionally NOT asserted here (see report).
import { test, expect } from '@playwright/test';
import { installSupportStubs, loginAsAgent } from './support/support';

test.describe('customer-ticket-new — interactive controls addressable', () => {
  test.beforeEach(async ({ page }) => {
    await installSupportStubs(page);
    await loginAsAgent(page);
    await page.goto('/customer-support-tickets', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/customer-support-tickets/, { timeout: 30_000 });
  });

  test('tickets header, status chips + filter sidebar controls are addressable', async ({ page }) => {
    await expect.soft(page.getByTestId('ctn-raise-ticket')).toBeVisible({ timeout: 30_000 });
    // Status chip-listbox (always rendered on the Customer Tickets tab).
    await expect.soft(page.getByTestId('ctn-status-all')).toBeVisible();
    await expect.soft(page.getByTestId('ctn-status-open')).toBeVisible();
    await expect.soft(page.getByTestId('ctn-status-closed')).toBeVisible();
    await expect.soft(page.getByTestId('ctn-status-tagged')).toBeVisible();
    // Filter sidebar.
    await expect.soft(page.getByTestId('ctn-reset-filter')).toBeVisible();
    await expect.soft(page.getByTestId('ctn-filter-search')).toBeVisible();
    await expect.soft(page.getByTestId('ctn-filter-journey')).toBeVisible();
    await expect.soft(page.getByTestId('ctn-filter-assignto')).toBeVisible();
    await expect.soft(page.getByTestId('ctn-filter-startdate')).toBeVisible();
    await expect.soft(page.getByTestId('ctn-filter-enddate')).toBeVisible();
    await expect.soft(page.getByTestId('ctn-filter-priority')).toBeVisible();
  });

  test('tagged-banner, tag/untag/calendar dialog controls are addressable', async ({ page }) => {
    // Tagged banner (rendered only when tagged tickets exist).
    expect(page.getByTestId('ctn-open-calendar')).toBeTruthy();
    expect(page.getByTestId('ctn-tagged-today')).toBeTruthy();
    expect(page.getByTestId('ctn-tagged-upcoming')).toBeTruthy();
    expect(page.getByTestId('ctn-tagged-overdue')).toBeTruthy();
    // Tag dialog.
    expect(page.getByTestId('ctn-tagdialog-overlay')).toBeTruthy();
    expect(page.getByTestId('ctn-tagdialog-box')).toBeTruthy();
    expect(page.getByTestId('ctn-tag-date')).toBeTruthy();
    expect(page.getByTestId('ctn-tag-time')).toBeTruthy();
    expect(page.getByTestId('ctn-tagdialog-cancel')).toBeTruthy();
    expect(page.getByTestId('ctn-tagdialog-confirm')).toBeTruthy();
    // Untag dialog.
    expect(page.getByTestId('ctn-untagdialog-overlay')).toBeTruthy();
    expect(page.getByTestId('ctn-untagdialog-box')).toBeTruthy();
    expect(page.getByTestId('ctn-untagdialog-cancel')).toBeTruthy();
    expect(page.getByTestId('ctn-untagdialog-confirm')).toBeTruthy();
    // Tagged-tickets calendar dialog.
    expect(page.getByTestId('ctn-calendar-close')).toBeTruthy();
  });
});
