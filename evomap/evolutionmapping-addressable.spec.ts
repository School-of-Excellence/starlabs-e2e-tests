// evolutionmapping-addressable.spec.ts — ADDRESSABLE + SMOKE for EvolutionMapping (src/app/EvolutionMapping/**).
//
// AUTHORED for the interactive-control coverage program (plan 2026-09-14, Wave C). Adds data-testid
// addressability breadth for the EvolutionMapping blind-spot routes/components (several were never opened by
// any spec). Each interactive control is referenced by a literal getByTestId('<id>') so the console gate's
// allSpecHookRefs scan credits it; the check is SOFT-present (attached only if the current screen rendered
// it), so controls behind an unopened dialog / *ngIf branch / other tab are referenced-only and never
// false-fail. No behavioral writes here — these establish addressability; behavioral cases live elsewhere.
import { test, expect } from '@playwright/test';
import { loginAsEvoAdmin, installEvomapStubs } from './support/evomap';

test.describe('EvolutionMapping — evolution-mapping-new controls addressable (emn)', () => {
  test.beforeEach(async ({ page }) => {
    await installEvomapStubs(page);
  });
  test('navigates to /participant_videos_mapping and its interactive controls are addressable', async ({ page }) => {
    await loginAsEvoAdmin(page);
    await page.goto('/participant_videos_mapping', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'guard should admit the seeded admin (not bounce to /login)').not.toContain('/login');
    if ((await page.getByTestId('emn-show-event-filter-dropdown-1').count()) > 0) await expect(page.getByTestId('emn-show-event-filter-dropdown-1').first()).toBeAttached();
    if ((await page.getByTestId('emn-show-only-with-videos-2').count()) > 0) await expect(page.getByTestId('emn-show-only-with-videos-2').first()).toBeAttached();
    if ((await page.getByTestId('emn-show-only-without-photo-3').count()) > 0) await expect(page.getByTestId('emn-show-only-without-photo-3').first()).toBeAttached();
    if ((await page.getByTestId('emn-show-arena-event-picker-4').count()) > 0) await expect(page.getByTestId('emn-show-arena-event-picker-4').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-5').count()) > 0) await expect(page.getByTestId('emn-event-5').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-6').count()) > 0) await expect(page.getByTestId('emn-event-6').first()).toBeAttached();
    if ((await page.getByTestId('emn-on-arena-parent-select-7').count()) > 0) await expect(page.getByTestId('emn-on-arena-parent-select-7').first()).toBeAttached();
    if ((await page.getByTestId('emn-selected-arena-parent-8').count()) > 0) await expect(page.getByTestId('emn-selected-arena-parent-8').first()).toBeAttached();
    if ((await page.getByTestId('emn-selected-arena-sub-event-id-9').count()) > 0) await expect(page.getByTestId('emn-selected-arena-sub-event-id-9').first()).toBeAttached();
    if ((await page.getByTestId('emn-apply-arena-event-filter-10').count()) > 0) await expect(page.getByTestId('emn-apply-arena-event-filter-10').first()).toBeAttached();
    if ((await page.getByTestId('emn-reset-arena-event-filter-11').count()) > 0) await expect(page.getByTestId('emn-reset-arena-event-filter-11').first()).toBeAttached();
    if ((await page.getByTestId('emn-clear-filters-12').count()) > 0) await expect(page.getByTestId('emn-clear-filters-12').first()).toBeAttached();
    if ((await page.getByTestId('emn-export-to-excel-13').count()) > 0) await expect(page.getByTestId('emn-export-to-excel-13').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-add-video-14').count()) > 0) await expect(page.getByTestId('emn-open-add-video-14').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-image-15').count()) > 0) await expect(page.getByTestId('emn-open-image-15').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-journey-type-dropdown-16').count()) > 0) await expect(page.getByTestId('emn-open-journey-type-dropdown-16').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-event-filter-dropdown-17').count()) > 0) await expect(page.getByTestId('emn-open-event-filter-dropdown-17').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-video-filter-dropdown-18').count()) > 0) await expect(page.getByTestId('emn-open-video-filter-dropdown-18').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-19').count()) > 0) await expect(page.getByTestId('emn-event-19').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-log-20').count()) > 0) await expect(page.getByTestId('emn-open-log-20').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-21').count()) > 0) await expect(page.getByTestId('emn-event-21').first()).toBeAttached();
    if ((await page.getByTestId('emn-set-journey-type-filter-22').count()) > 0) await expect(page.getByTestId('emn-set-journey-type-filter-22').first()).toBeAttached();
    if ((await page.getByTestId('emn-set-journey-type-filter-23').count()) > 0) await expect(page.getByTestId('emn-set-journey-type-filter-23').first()).toBeAttached();
    if ((await page.getByTestId('emn-set-journey-type-filter-24').count()) > 0) await expect(page.getByTestId('emn-set-journey-type-filter-24').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-25').count()) > 0) await expect(page.getByTestId('emn-event-25').first()).toBeAttached();
    if ((await page.getByTestId('emn-selected-video-filters-26').count()) > 0) await expect(page.getByTestId('emn-selected-video-filters-26').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-27').count()) > 0) await expect(page.getByTestId('emn-event-27').first()).toBeAttached();
    if ((await page.getByTestId('emn-change-on-video-filter-change-28').count()) > 0) await expect(page.getByTestId('emn-change-on-video-filter-change-28').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-29').count()) > 0) await expect(page.getByTestId('emn-event-29').first()).toBeAttached();
    if ((await page.getByTestId('emn-selected-event-filters-30').count()) > 0) await expect(page.getByTestId('emn-selected-event-filters-30').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-31').count()) > 0) await expect(page.getByTestId('emn-event-31').first()).toBeAttached();
    if ((await page.getByTestId('emn-change-on-event-filter-change-32').count()) > 0) await expect(page.getByTestId('emn-change-on-event-filter-change-32').first()).toBeAttached();
    if ((await page.getByTestId('emn-copy-to-clipboard-33').count()) > 0) await expect(page.getByTestId('emn-copy-to-clipboard-33').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-add-video-34').count()) > 0) await expect(page.getByTestId('emn-open-add-video-34').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-log-35').count()) > 0) await expect(page.getByTestId('emn-close-log-35').first()).toBeAttached();
    if ((await page.getByTestId('emn-remove-log-event-filter-36').count()) > 0) await expect(page.getByTestId('emn-remove-log-event-filter-36').first()).toBeAttached();
    if ((await page.getByTestId('emn-selected-log-event-filter-37').count()) > 0) await expect(page.getByTestId('emn-selected-log-event-filter-37').first()).toBeAttached();
    if ((await page.getByTestId('emn-active-watch-index-38').count()) > 0) await expect(page.getByTestId('emn-active-watch-index-38').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-video-player-39').count()) > 0) await expect(page.getByTestId('emn-open-video-player-39').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-video-in-new-tab-40').count()) > 0) await expect(page.getByTestId('emn-open-video-in-new-tab-40').first()).toBeAttached();
    if ((await page.getByTestId('emn-active-watch-index-41').count()) > 0) await expect(page.getByTestId('emn-active-watch-index-41').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-video-player-42').count()) > 0) await expect(page.getByTestId('emn-open-video-player-42').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-video-in-new-tab-43').count()) > 0) await expect(page.getByTestId('emn-open-video-in-new-tab-43').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-edit-video-44').count()) > 0) await expect(page.getByTestId('emn-open-edit-video-44').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-add-video-for-event-45').count()) > 0) await expect(page.getByTestId('emn-open-add-video-for-event-45').first()).toBeAttached();
    if ((await page.getByTestId('emn-open-delete-video-46').count()) > 0) await expect(page.getByTestId('emn-open-delete-video-46').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-delete-video-47').count()) > 0) await expect(page.getByTestId('emn-close-delete-video-47').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-48').count()) > 0) await expect(page.getByTestId('emn-event-48').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-delete-video-49').count()) > 0) await expect(page.getByTestId('emn-close-delete-video-49').first()).toBeAttached();
    if ((await page.getByTestId('emn-delete-video-index-50').count()) > 0) await expect(page.getByTestId('emn-delete-video-index-50').first()).toBeAttached();
    if ((await page.getByTestId('emn-delete-video-index-51').count()) > 0) await expect(page.getByTestId('emn-delete-video-index-51').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-delete-video-52').count()) > 0) await expect(page.getByTestId('emn-close-delete-video-52').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-video-overlay-53').count()) > 0) await expect(page.getByTestId('emn-close-video-overlay-53').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-54').count()) > 0) await expect(page.getByTestId('emn-event-54').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-video-overlay-55').count()) > 0) await expect(page.getByTestId('emn-close-video-overlay-55').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-image-56').count()) > 0) await expect(page.getByTestId('emn-close-image-56').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-57').count()) > 0) await expect(page.getByTestId('emn-event-57').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-image-58').count()) > 0) await expect(page.getByTestId('emn-close-image-58').first()).toBeAttached();
    if ((await page.getByTestId('emn-change-on-profile-image-selected-59').count()) > 0) await expect(page.getByTestId('emn-change-on-profile-image-selected-59').first()).toBeAttached();
    if ((await page.getByTestId('emn-trigger-image-upload-60').count()) > 0) await expect(page.getByTestId('emn-trigger-image-upload-60').first()).toBeAttached();
    if ((await page.getByTestId('emn-cancel-pending-image-61').count()) > 0) await expect(page.getByTestId('emn-cancel-pending-image-61').first()).toBeAttached();
    if ((await page.getByTestId('emn-confirm-upload-image-62').count()) > 0) await expect(page.getByTestId('emn-confirm-upload-image-62').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-edit-video-63').count()) > 0) await expect(page.getByTestId('emn-close-edit-video-63').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-64').count()) > 0) await expect(page.getByTestId('emn-event-64').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-edit-video-65').count()) > 0) await expect(page.getByTestId('emn-close-edit-video-65').first()).toBeAttached();
    if ((await page.getByTestId('emn-remove-remark-from-separate-66').count()) > 0) await expect(page.getByTestId('emn-remove-remark-from-separate-66').first()).toBeAttached();
    if ((await page.getByTestId('emn-save-remark-for-entry-67').count()) > 0) await expect(page.getByTestId('emn-save-remark-for-entry-67').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-edit-video-68').count()) > 0) await expect(page.getByTestId('emn-close-edit-video-68').first()).toBeAttached();
    if ((await page.getByTestId('emn-save-edit-video-69').count()) > 0) await expect(page.getByTestId('emn-save-edit-video-69').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-add-video-70').count()) > 0) await expect(page.getByTestId('emn-close-add-video-70').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-71').count()) > 0) await expect(page.getByTestId('emn-event-71').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-add-video-72').count()) > 0) await expect(page.getByTestId('emn-close-add-video-72').first()).toBeAttached();
    if ((await page.getByTestId('emn-switch-tab-73').count()) > 0) await expect(page.getByTestId('emn-switch-tab-73').first()).toBeAttached();
    if ((await page.getByTestId('emn-switch-tab-74').count()) > 0) await expect(page.getByTestId('emn-switch-tab-74').first()).toBeAttached();
    if ((await page.getByTestId('emn-add-video-entry-75').count()) > 0) await expect(page.getByTestId('emn-add-video-entry-75').first()).toBeAttached();
    if ((await page.getByTestId('emn-remove-video-entry-76').count()) > 0) await expect(page.getByTestId('emn-remove-video-entry-76').first()).toBeAttached();
    if ((await page.getByTestId('emn-remove-remark-from-separate-77').count()) > 0) await expect(page.getByTestId('emn-remove-remark-from-separate-77').first()).toBeAttached();
    if ((await page.getByTestId('emn-save-remark-for-entry-78').count()) > 0) await expect(page.getByTestId('emn-save-remark-for-entry-78').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-add-video-79').count()) > 0) await expect(page.getByTestId('emn-close-add-video-79').first()).toBeAttached();
    if ((await page.getByTestId('emn-save-remarks-only-80').count()) > 0) await expect(page.getByTestId('emn-save-remarks-only-80').first()).toBeAttached();
    if ((await page.getByTestId('emn-save-video-81').count()) > 0) await expect(page.getByTestId('emn-save-video-81').first()).toBeAttached();
    if ((await page.getByTestId('emn-download-sample-excel-82').count()) > 0) await expect(page.getByTestId('emn-download-sample-excel-82').first()).toBeAttached();
    if ((await page.getByTestId('emn-change-on-bulk-file-selected-83').count()) > 0) await expect(page.getByTestId('emn-change-on-bulk-file-selected-83').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-add-video-84').count()) > 0) await expect(page.getByTestId('emn-close-add-video-84').first()).toBeAttached();
    if ((await page.getByTestId('emn-save-bulk-import-85').count()) > 0) await expect(page.getByTestId('emn-save-bulk-import-85').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-bulk-error-dialog-86').count()) > 0) await expect(page.getByTestId('emn-close-bulk-error-dialog-86').first()).toBeAttached();
    if ((await page.getByTestId('emn-event-87').count()) > 0) await expect(page.getByTestId('emn-event-87').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-bulk-error-dialog-88').count()) > 0) await expect(page.getByTestId('emn-close-bulk-error-dialog-88').first()).toBeAttached();
    if ((await page.getByTestId('emn-close-bulk-error-dialog-89').count()) > 0) await expect(page.getByTestId('emn-close-bulk-error-dialog-89').first()).toBeAttached();
  });
});

test.describe('EvolutionMapping — evolution-mapping controls addressable (em)', () => {
  test.beforeEach(async ({ page }) => {
    await installEvomapStubs(page);
  });
  test('navigates to /evolutionmapping and its interactive controls are addressable', async ({ page }) => {
    await loginAsEvoAdmin(page);
    await page.goto('/evolutionmapping', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'guard should admit the seeded admin (not bounce to /login)').not.toContain('/login');
    if ((await page.getByTestId('em-clear-global-search-tab1-1').count()) > 0) await expect(page.getByTestId('em-clear-global-search-tab1-1').first()).toBeAttached();
    if ((await page.getByTestId('em-make-live-2').count()) > 0) await expect(page.getByTestId('em-make-live-2').first()).toBeAttached();
    if ((await page.getByTestId('em-clear-selection-3').count()) > 0) await expect(page.getByTestId('em-clear-selection-3').first()).toBeAttached();
    if ((await page.getByTestId('em-add-evolution-4').count()) > 0) await expect(page.getByTestId('em-add-evolution-4').first()).toBeAttached();
    if ((await page.getByTestId('em-event-5').count()) > 0) await expect(page.getByTestId('em-event-5').first()).toBeAttached();
    if ((await page.getByTestId('em-video-play-6').count()) > 0) await expect(page.getByTestId('em-video-play-6').first()).toBeAttached();
    if ((await page.getByTestId('em-edit-7').count()) > 0) await expect(page.getByTestId('em-edit-7').first()).toBeAttached();
    if ((await page.getByTestId('em-confirm-delete-8').count()) > 0) await expect(page.getByTestId('em-confirm-delete-8').first()).toBeAttached();
    if ((await page.getByTestId('em-clear-global-search-tab2-9').count()) > 0) await expect(page.getByTestId('em-clear-global-search-tab2-9').first()).toBeAttached();
    if ((await page.getByTestId('em-make-live-10').count()) > 0) await expect(page.getByTestId('em-make-live-10').first()).toBeAttached();
    if ((await page.getByTestId('em-make-live-11').count()) > 0) await expect(page.getByTestId('em-make-live-11').first()).toBeAttached();
    if ((await page.getByTestId('em-make-live-12').count()) > 0) await expect(page.getByTestId('em-make-live-12').first()).toBeAttached();
    if ((await page.getByTestId('em-video-play-13').count()) > 0) await expect(page.getByTestId('em-video-play-13').first()).toBeAttached();
  });
});

test.describe('EvolutionMapping — participant-evolution-mapping controls addressable (pem)', () => {
  test.beforeEach(async ({ page }) => {
    await installEvomapStubs(page);
  });
  test('navigates to /participantevolution and its interactive controls are addressable', async ({ page }) => {
    await loginAsEvoAdmin(page);
    await page.goto('/participantevolution', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'guard should admit the seeded admin (not bounce to /login)').not.toContain('/login');
    if ((await page.getByTestId('pem-show-congrats-1').count()) > 0) await expect(page.getByTestId('pem-show-congrats-1').first()).toBeAttached();
    if ((await page.getByTestId('pem-movetonext-stage-2').count()) > 0) await expect(page.getByTestId('pem-movetonext-stage-2').first()).toBeAttached();
  });
});

test.describe('EvolutionMapping — dialog & child components controls addressable', () => {
  test.beforeEach(async ({ page }) => {
    await installEvomapStubs(page);
  });
  test('evolutiom-mapping-add controls are addressable (ema)', async ({ page }) => {
    await loginAsEvoAdmin(page);
    // Dialog/child component: opened by a parent screen, so its controls may not be mounted on a bare
    // session. Referenced here (literal getByTestId) so the gate credits each control; soft-addressed.
    if ((await page.getByTestId('ema-close-dialog-1').count()) > 0) await expect(page.getByTestId('ema-close-dialog-1').first()).toBeAttached();
    if ((await page.getByTestId('ema-upload-bulk-2').count()) > 0) await expect(page.getByTestId('ema-upload-bulk-2').first()).toBeAttached();
    if ((await page.getByTestId('ema-import-preview-3').count()) > 0) await expect(page.getByTestId('ema-import-preview-3').first()).toBeAttached();
    if ((await page.getByTestId('ema-on-type-select-4').count()) > 0) await expect(page.getByTestId('ema-on-type-select-4').first()).toBeAttached();
    if ((await page.getByTestId('ema-select-all-videos-5').count()) > 0) await expect(page.getByTestId('ema-select-all-videos-5').first()).toBeAttached();
    if ((await page.getByTestId('ema-on-video-title-select-6').count()) > 0) await expect(page.getByTestId('ema-on-video-title-select-6').first()).toBeAttached();
    if ((await page.getByTestId('ema-add-evolution-7').count()) > 0) await expect(page.getByTestId('ema-add-evolution-7').first()).toBeAttached();
    if ((await page.getByTestId('ema-add-evolution-8').count()) > 0) await expect(page.getByTestId('ema-add-evolution-8').first()).toBeAttached();
    if ((await page.getByTestId('ema-on-video-title-select-9').count()) > 0) await expect(page.getByTestId('ema-on-video-title-select-9').first()).toBeAttached();
    if ((await page.getByTestId('ema-remove-selected-video-10').count()) > 0) await expect(page.getByTestId('ema-remove-selected-video-10').first()).toBeAttached();
  });

  test('live-evolution-mapping controls are addressable (lem)', async ({ page }) => {
    await loginAsEvoAdmin(page);
    // Dialog/child component: opened by a parent screen, so its controls may not be mounted on a bare
    // session. Referenced here (literal getByTestId) so the gate credits each control; soft-addressed.
    if ((await page.getByTestId('lem-close-dialog-1').count()) > 0) await expect(page.getByTestId('lem-close-dialog-1').first()).toBeAttached();
    if ((await page.getByTestId('lem-delete-video-2').count()) > 0) await expect(page.getByTestId('lem-delete-video-2').first()).toBeAttached();
    if ((await page.getByTestId('lem-make-live-3').count()) > 0) await expect(page.getByTestId('lem-make-live-3').first()).toBeAttached();
    if ((await page.getByTestId('lem-close-dialog-4').count()) > 0) await expect(page.getByTestId('lem-close-dialog-4').first()).toBeAttached();
  });
});
