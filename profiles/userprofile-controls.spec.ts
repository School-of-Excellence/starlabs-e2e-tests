// userprofile-controls.spec.ts — ADDRESSABLE + SMOKE for /userprofile/:id (UserprofileComponent) and
// /profilesummary/:profileid (ProfileSummaryComponent).
// Prefixes: up (userprofile), ps (profile-summary). Interactive-control coverage (plan 2026-09-14).
// Static data-testids added add-only. Dynamic tab buttons (up-tab-*), per-journey toggles
// (up-journey-*), form/report rows (up-form-row-*, up-report-row-*), touchpoint checkboxes
// (up-touchpoint-*) and profile-summary per-row edit buttons (ps-fulfillment-edit-*, ps-cs-edit*)
// carry [attr.data-testid] and are dynamic — intentionally NOT referenced here.
// NOTE: ps-view-atc opens an ATC screen — it is hooked add-only but deliberately never driven here.
import { test, expect } from '@playwright/test';
import { installProfileStubs, loginAsProfileAdmin, profProfileIds } from './support/profiles';

test.describe('User Profile (/userprofile/:id) — controls addressable', () => {
  test.beforeEach(async ({ page }) => {
    await installProfileStubs(page);
    await loginAsProfileAdmin(page);
  });

  test('profile info + status editor + product toggles are addressable', async ({ page }) => {
    await page.goto(`/userprofile/${profProfileIds.p0}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/userprofile/, { timeout: 30_000 });

    // Financial/Customer-status edit affix is always present in the profile card.
    await expect(page.getByTestId('up-status-edit')).toBeVisible({ timeout: 30_000 });

    // Products (all-products) section toggle in the Journey tab.
    await expect.soft(page.getByTestId('up-products-toggle')).toBeVisible();

    // Open the status editor overlay and assert its controls.
    await page.getByTestId('up-status-edit').click();
    await expect.soft(page.getByTestId('up-status-close')).toBeVisible();
    await expect.soft(page.getByTestId('up-status-select')).toBeVisible();
    await expect.soft(page.getByTestId('up-status-cancel')).toBeVisible();
    await expect.soft(page.getByTestId('up-status-update')).toBeVisible();
  });

  test('events sub-tab controls are addressable (Events tab)', async ({ page }) => {
    await page.goto(`/userprofile/${profProfileIds.p0}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('up-status-edit')).toBeVisible({ timeout: 30_000 });
    // Event sub-tabs only render inside the "Events" activity tab.
    await expect.soft(page.getByTestId('up-eventtab-all')).toBeVisible();
    await expect.soft(page.getByTestId('up-eventtab-attended')).toBeVisible();
    await expect.soft(page.getByTestId('up-eventtab-notattended')).toBeVisible();
    await expect.soft(page.getByTestId('up-eventtab-upcoming')).toBeVisible();
  });
});

test.describe('Profile Summary (/profilesummary/:profileid) — controls addressable', () => {
  test.beforeEach(async ({ page }) => {
    await installProfileStubs(page);
    await loginAsProfileAdmin(page);
  });

  test('summary action controls are addressable', async ({ page }) => {
    await page.goto(`/profilesummary/${profProfileIds.p0}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/profilesummary/, { timeout: 30_000 });

    // The two table filter inputs + the two "add" buttons render with the fulfillment / customer-support
    // sections (present once the summary body loads).
    await expect(page.getByTestId('ps-fulfillment-filter')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ps-add-fulfillment')).toBeVisible();
    await expect(page.getByTestId('ps-cs-filter')).toBeVisible();
    await expect(page.getByTestId('ps-add-cs-issue')).toBeVisible();
    await expect(page.getByTestId('ps-add-general-notes')).toBeVisible();
    await expect(page.getByTestId('ps-add-private-notes')).toBeVisible();
    // View ATC is hooked (add-only) but never driven — it opens an ATC reader.
    await expect(page.getByTestId('ps-view-atc')).toBeVisible();

    // The autocomplete profile search only shows in offset mode.
    await expect.soft(page.getByTestId('ps-search-input')).toBeVisible();
    await expect.soft(page.getByTestId('ps-search-btn')).toBeVisible();
    // The "Navigate To" buttons only render when a profile is selected.
    await expect.soft(page.getByTestId('ps-nav-purchase')).toBeVisible();
    await expect.soft(page.getByTestId('ps-nav-journey-support')).toBeVisible();
    await expect.soft(page.getByTestId('ps-nav-delivery-seq')).toBeVisible();
    await expect.soft(page.getByTestId('ps-nav-full-profile')).toBeVisible();
  });
});
