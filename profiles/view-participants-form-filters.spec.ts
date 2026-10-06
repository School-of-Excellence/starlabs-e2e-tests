// view-participants-form-filters.spec.ts — /view-participants-form: the server-side filter panel added in
// starlabs-angular 6f3d83b6 (active-filter count, "changes not applied" pill, result count, Opportunity toggle,
// fetch spinner / progress / overlay / notice).
//
// Prefix: vpf (shared with view-participants-form-controls.spec.ts, which owns the older controls; this file
// adds only the hooks 6f3d83b6 introduced and never re-asserts that file's cases).
//
// Reference: starlabs-angular specs/journals/2026-09-24-view-participants-form-server-filters.md.
//
// LANES: the fetch reads `formsByClient` from the firestore-forms NAMED db. The emulator has no rules for a
// named db (multi-db unsupported) so that client read is DENIED there — same limitation as PA-13/PA-14.
//   VPF-F01  both lanes (no fetch involved: the active count is pure panel state)
//   VPF-F02  cloud only (needs a successful fetch to set the applied snapshot)
//   VPF-F03  emulator only (the denied read is a real read failure → the error notice path)
//
// SEEDED WORLD: none of its own — the profiles seed's admin + the /view-participants-form grant. These cases
// assert the panel's own state machine, not form data: toggles are query filters that only take effect on
// the next Fetch, so the app must (a) count them as active and (b) flag the panel as pending until Fetch.
//
// ANTI-CIRCULARITY: the test only clicks; the "N active" text, the pending pill and its clearing are all
// computed by the component (activeFilterCount / hasPendingChanges vs the last-applied snapshot). The
// negative control is the round-trip: toggling back to the applied state must remove the pill without a
// fetch — proving the pill compares against the snapshot rather than latching on any click.
import { test, expect } from '@playwright/test';
import { installProfileStubs, loginAsProfileAdmin } from './support/profiles';

const EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const FORMS_SKIP = 'EMULATOR LIMITATION: firestore-forms named DB has no rules in the emulator (multi-db unsupported) → client read denied; runs on the cloud config.';

test.describe('View Participants Form — filter panel (active count, pending changes, fetch)', () => {
  test.beforeEach(async ({ page }) => {
    await installProfileStubs(page);
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
    test.skip(EMULATOR, FORMS_SKIP);
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
    test.skip(!EMULATOR, 'Needs a denied formsByClient read — only the emulator lane produces one deterministically.');
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
