// participant-screens-controls.spec.ts — ADDRESSABLE + SMOKE for four Participants-Profile screens:
//   /participant-form-tracker   (ParticipantFormTracker)      prefix: pft
//   /app-flow-breaks            (AppFlowBreaks)                prefix: afb
//   /participantproduct         (ParticipantProduct)          prefix: pp
//   /participantdeliverysequence/:pid (ParticipantDeliverySequence) prefix: pds
// Interactive-control coverage (plan 2026-09-14). Static data-testids added add-only. Dynamic ids
// (afb-type-*, afb-page-*, pft-row-select-*, pp-missing-*, pp-edit-*, pp-save-*, pp-cancel-*,
// pds-product-select-*, pds-delivery-*) carry [attr.data-testid] and are intentionally NOT referenced.
import { test, expect } from '@playwright/test';
import { installProfileStubs, loginAsProfileAdmin, profProfileIds } from './support/profiles';

test.describe('Participant Form Tracker (/participant-form-tracker) — controls addressable', () => {
  test('filter + action controls are addressable', async ({ page }) => {
    await installProfileStubs(page);
    await loginAsProfileAdmin(page);
    await page.goto('/participant-form-tracker', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/participant-form-tracker/, { timeout: 30_000 });

    await expect(page.getByTestId('pft-participant-select')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('pft-apply')).toBeVisible();
    await expect(page.getByTestId('pft-clear')).toBeVisible();
    // Conditional: bulk / table / overlay controls.
    await expect.soft(page.getByTestId('pft-view-merged')).toBeVisible();
    await expect.soft(page.getByTestId('pft-select-all')).toBeVisible();
    await expect.soft(page.getByTestId('pft-overlay-close')).toBeVisible();
  });
});

test.describe('App Flow Breaks (/app-flow-breaks) — controls addressable', () => {
  test('search + pagination controls are addressable', async ({ page }) => {
    await installProfileStubs(page);
    await loginAsProfileAdmin(page);
    await page.goto('/app-flow-breaks', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/app-flow-breaks/, { timeout: 30_000 });

    await expect(page.getByTestId('afb-search-name')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('afb-search-email')).toBeVisible();
    await expect(page.getByTestId('afb-search-phone')).toBeVisible();
    // Conditional: filter-clear + pagination controls (present with data / active filters).
    await expect.soft(page.getByTestId('afb-clear-all-filters')).toBeVisible();
    await expect.soft(page.getByTestId('afb-clear-types')).toBeVisible();
    await expect.soft(page.getByTestId('afb-page-prev')).toBeVisible();
    await expect.soft(page.getByTestId('afb-page-next')).toBeVisible();
    await expect.soft(page.getByTestId('afb-page-first')).toBeVisible();
    await expect.soft(page.getByTestId('afb-page-last')).toBeVisible();
    await expect.soft(page.getByTestId('afb-page-size')).toBeVisible();
  });
});

test.describe('Participant Product (/participantproduct) — controls addressable', () => {
  test('filter controls are addressable', async ({ page }) => {
    await installProfileStubs(page);
    await loginAsProfileAdmin(page);
    await page.goto('/participantproduct', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/participantproduct/, { timeout: 30_000 });

    await expect(page.getByTestId('pp-filter-participant')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('pp-filter-product')).toBeVisible();
    await expect(page.getByTestId('pp-filter-table')).toBeVisible();
    // Conditional: reset/clear buttons (only with an active filter / missing-product summary).
    await expect.soft(page.getByTestId('pp-reset-missing-filter')).toBeVisible();
    await expect.soft(page.getByTestId('pp-clear-filters')).toBeVisible();
  });
});

test.describe('Participant Delivery Sequence (/participantdeliverysequence/:pid) — controls addressable', () => {
  test('profile picker + data-status controls are addressable', async ({ page }) => {
    await installProfileStubs(page);
    await loginAsProfileAdmin(page);
    await page.goto(`/participantdeliverysequence/${profProfileIds.p0}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/participantdeliverysequence/, { timeout: 30_000 });

    await expect(page.getByTestId('pds-profile-select')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('pds-seq-changed')).toBeVisible();
    await expect(page.getByTestId('pds-migration-required')).toBeVisible();
    // Conditional: shown once participant products load / a product+delivery is selected.
    await expect.soft(page.getByTestId('pds-reset')).toBeVisible();
    await expect.soft(page.getByTestId('pds-submit')).toBeVisible();
    await expect.soft(page.getByTestId('pds-product-status')).toBeVisible();
    await expect.soft(page.getByTestId('pds-new-delivery')).toBeVisible();
    await expect.soft(page.getByTestId('pds-add-delivery')).toBeVisible();
    await expect.soft(page.getByTestId('pds-delivery-status')).toBeVisible();
    await expect.soft(page.getByTestId('pds-map-appointments')).toBeVisible();
  });
});
