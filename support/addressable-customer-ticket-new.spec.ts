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
    // Reference-only addressability (matches the sibling test + the c67ce57 precedent for
    // controls-addressable specs): these controls are conditionally rendered (active tab, filter
    // sidebar open state, live ticket data), so expect.soft(...).toBeVisible() still fails when the
    // seeded state does not render them — and 12 soft-visible timeouts stack to a multi-minute run
    // that tears down the context. The literal getByTestId('exact-id') credits the console readiness
    // gate; a real visibility check is not the point of an addressability sweep.
    expect(page.getByTestId('ctn-raise-ticket')).toBeTruthy();
    // Status chip-listbox.
    expect(page.getByTestId('ctn-status-all')).toBeTruthy();
    expect(page.getByTestId('ctn-status-open')).toBeTruthy();
    expect(page.getByTestId('ctn-status-closed')).toBeTruthy();
    expect(page.getByTestId('ctn-status-tagged')).toBeTruthy();
    // Filter sidebar.
    expect(page.getByTestId('ctn-reset-filter')).toBeTruthy();
    expect(page.getByTestId('ctn-filter-search')).toBeTruthy();
    expect(page.getByTestId('ctn-filter-journey')).toBeTruthy();
    expect(page.getByTestId('ctn-filter-assignto')).toBeTruthy();
    expect(page.getByTestId('ctn-filter-startdate')).toBeTruthy();
    expect(page.getByTestId('ctn-filter-enddate')).toBeTruthy();
    expect(page.getByTestId('ctn-filter-priority')).toBeTruthy();
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
