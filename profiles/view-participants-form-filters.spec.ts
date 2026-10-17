// view-participants-form-filters.spec.ts — /view-participants-form: the server-side filter panel added in
// starlabs-angular 6f3d83b6 (active-filter count, "changes not applied" pill, result count, Opportunity toggle,
// fetch spinner / progress / overlay / notice).
//
// Prefix: vpf (shared with view-participants-form-controls.spec.ts, which owns the older controls; this file
// adds only the hooks 6f3d83b6 introduced and never re-asserts that file's cases).
//
// Reference: starlabs-angular specs/journals/2026-09-24-view-participants-form-server-filters.md.
//
// LANES: the fetch reads `formsByClient` from the firestore-forms NAMED db. Since 2026-10-17 the emulator build
// connects that db (src/main.ts) — the old "multi-db unsupported → read denied" note was a misdiagnosis — so:
//   VPF-F01  both lanes (no fetch involved: the active count is pure panel state)
//   VPF-F02  both lanes (needs a successful fetch to set the applied snapshot)
//   VPF-F03  both lanes — the read failure is now FORCED (failFormsDbReads aborts the browser's requests to
//            the firestore-forms database only), instead of relying on the unconnected handle being denied
//
// SEEDED WORLD: none of its own — the profiles seed's admin + the /view-participants-form grant. These cases
// assert the panel's own state machine, not form data: toggles are query filters that only take effect on
// the next Fetch, so the app must (a) count them as active and (b) flag the panel as pending until Fetch.
//
// ANTI-CIRCULARITY: the test only clicks; the "N active" text, the pending pill and its clearing are all
// computed by the component (activeFilterCount / hasPendingChanges vs the last-applied snapshot). The
// negative control is the round-trip: toggling back to the applied state must remove the pill without a
// fetch — proving the pill compares against the snapshot rather than latching on any click.
import { test, expect, Page } from '@playwright/test';
import { installProfileStubs, loginAsProfileAdmin } from './support/profiles';

/** Abort the browser's requests to the firestore-forms database ONLY (default-db traffic is untouched), so the
 *  screen's formsByClient read fails deterministically on either lane. */
async function failFormsDbReads(page: Page) {
  await page.route((url) => /databases(%2F|\/)firestore-forms/i.test(url.toString()), (r) => r.abort());
}

test.describe('View Participants Form — filter panel (active count, pending changes, fetch)', () => {
  test.beforeEach(async ({ page }) => {
    await installProfileStubs(page);
    if (test.info().title.startsWith('VPF-F03')) await failFormsDbReads(page); // before the on-load fetch
    await loginAsProfileAdmin(page);
    await page.goto('/view-participants-form', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('vpf-filter-panel'), 'the filter panel must render').toBeVisible({ timeout: 30_000 });
    // The screen fetches on load; wait for that fetch to settle (success or failure) before clicking.
    await expect(page.getByTestId('vpf-fetch-overlay')).toHaveCount(0, { timeout: 60_000 });
  });

  test('VPF-F01 a query toggle counts as an active filter, and toggling it back removes it', async ({ page }) => {
    const opp = page.getByTestId('vpf-filter-opportunity');
    await expect(page.getByTestId('vpf-active-filter-count'), 'VPF-F01: nothing active by default').toHaveCount(0);
    await opp.click();
    await expect(opp).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('vpf-active-filter-count')).toHaveText('1 active');
    await opp.click();
    await expect(opp).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('vpf-active-filter-count')).toHaveCount(0);
  });

  test('VPF-F02 a toggle is pending until Fetch applies it; toggling back needs no fetch', async ({ page }) => {
    await expect(page.getByTestId('vpf-result-count'), 'the initial fetch must succeed').toBeVisible({ timeout: 60_000 });
    const opp = page.getByTestId('vpf-filter-opportunity');
    await expect(page.getByTestId('vpf-pending-changes')).toHaveCount(0);

    await opp.click();
    await expect(page.getByTestId('vpf-pending-changes'), 'VPF-F02: a query toggle waits for Fetch').toBeVisible();
    await opp.click();
    await expect(page.getByTestId('vpf-pending-changes'), 'VPF-F02: back to the applied state → nothing pending').toHaveCount(0);

    await opp.click();
    await page.getByTestId('vpf-fetch').click();
    await expect(page.getByTestId('vpf-pending-changes'), 'VPF-F02: applied → no longer pending').toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByTestId('vpf-result-count'), 'VPF-F02: the fetch completes').toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('vpf-active-filter-count'), 'VPF-F02: the toggle stays active').toHaveText('1 active');
  });

  test('VPF-F03 a failed read surfaces the fetch notice and leaves nothing pending', async ({ page }) => {
    await expect(page.getByTestId('vpf-fetch-notice')).toHaveText(/Could not fetch forms/);
    await expect(page.getByTestId('vpf-result-count'), 'VPF-F03: no applied snapshot → no result count').toHaveCount(0);
    await page.getByTestId('vpf-filter-opportunity').click();
    await expect(page.getByTestId('vpf-pending-changes'), 'VPF-F03: nothing was ever applied, so nothing is pending').toHaveCount(0);
  });

  // Registered, not driven: the spinner / progress bar live only for the length of a fetch — too short to
  // assert reliably.
  test.fixme('VPF-ADDR1 transient fetch hooks addressable (deferred behavioral)', async ({ page }) => {
    await page.goto('/view-participants-form', { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('vpf-fetch-spinner')).toBeTruthy();
    expect(page.getByTestId('vpf-fetch-progress')).toBeTruthy();
  });
});
