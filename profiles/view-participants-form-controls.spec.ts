// view-participants-form-controls.spec.ts — ADDRESSABLE + SMOKE for /view-participants-form.
// Prefix: vpf. Interactive-control coverage (plan 2026-09-14). Static data-testids added add-only.
// Per-row table controls (vpf-row-select-*, vpf-notes-*, vpf-like-*, vpf-flag-*, vpf-opp-*, vpf-view-*,
// vpf-preview-*, vpf-rowdownload-*) and my-form chips (vpf-myform-*) carry [attr.data-testid] and are
// dynamic — intentionally NOT referenced here. Bulk-action bar, overlay, notes and import-summary
// modals are conditional (need a selection / an opened panel) and are soft-asserted.
import { test, expect } from '@playwright/test';
import { installProfileStubs, loginAsProfileAdmin } from './support/profiles';

test.describe('View Participants Form (/view-participants-form) — controls addressable', () => {
  test.beforeEach(async ({ page }) => {
    await installProfileStubs(page);
    await loginAsProfileAdmin(page);
  });

  test('top-bar filter/action controls are addressable on load', async ({ page }) => {
    await page.goto('/view-participants-form', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/view-participants-form/, { timeout: 30_000 });

    await expect(page.getByTestId('vpf-import-file')).toBeAttached(); // hidden file input
    await expect.soft(page.getByTestId('vpf-fetch')).toBeVisible({ timeout: 30_000 });
    await expect.soft(page.getByTestId('vpf-filter-participant')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-filter-queue')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-filter-workshop')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-filter-form')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-import-emails')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-filter-liked')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-filter-flagged')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-save-myforms')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-clear-filters')).toBeVisible();
  });

  test('conditional bulk / overlay / notes / import-summary controls are addressable', async ({ page }) => {
    await page.goto('/view-participants-form', { waitUntil: 'domcontentloaded' });
    await expect.soft(page.getByTestId('vpf-fetch')).toBeVisible({ timeout: 30_000 });

    // My-forms bar (only when saved forms exist).
    await expect.soft(page.getByTestId('vpf-clear-myforms')).toBeVisible();
    // Imported-emails filter bar.
    await expect.soft(page.getByTestId('vpf-import-matched')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-import-notfound')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-clear-import')).toBeVisible();
    // Bulk-actions bar (only when a row is selected).
    await expect.soft(page.getByTestId('vpf-view-merged')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-download-menu')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-download-excel')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-download-merged-pdf')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-download-individual-pdf')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-clear-selection')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-select-all')).toBeVisible();
    // Form-view overlay.
    await expect.soft(page.getByTestId('vpf-overlay-newtab')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-overlay-close')).toBeVisible();
    // Notes overlay.
    await expect.soft(page.getByTestId('vpf-notes-close')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-notes-text')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-notes-cancel')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-notes-save')).toBeVisible();
    // Import-summary modal.
    await expect.soft(page.getByTestId('vpf-import-summary-close')).toBeVisible();
    await expect.soft(page.getByTestId('vpf-import-summary-done')).toBeVisible();
  });
});
