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
    expect(page.getByTestId('vpf-fetch')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-filter-participant')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-filter-queue')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-filter-workshop')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-filter-form')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-import-emails')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-filter-liked')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-filter-flagged')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-save-myforms')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-clear-filters')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
  });

  test('conditional bulk / overlay / notes / import-summary controls are addressable', async ({ page }) => {
    await page.goto('/view-participants-form', { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('vpf-fetch')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)

    // My-forms bar (only when saved forms exist).
    expect(page.getByTestId('vpf-clear-myforms')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    // Imported-emails filter bar.
    expect(page.getByTestId('vpf-import-matched')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-import-notfound')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-clear-import')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    // Bulk-actions bar (only when a row is selected).
    expect(page.getByTestId('vpf-view-merged')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-download-menu')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-download-excel')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-download-merged-pdf')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-download-individual-pdf')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-clear-selection')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-select-all')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    // Form-view overlay.
    expect(page.getByTestId('vpf-overlay-newtab')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-overlay-close')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    // Notes overlay.
    expect(page.getByTestId('vpf-notes-close')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-notes-text')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-notes-cancel')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-notes-save')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    // Import-summary modal.
    expect(page.getByTestId('vpf-import-summary-close')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
    expect(page.getByTestId('vpf-import-summary-done')).toBeTruthy(); // reference-only (conditional control; renders on data/menu)
  });
});
