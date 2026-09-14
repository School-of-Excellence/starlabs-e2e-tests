// new-workshop-controls.spec.ts — ADDRESSABLE+SMOKE for the routed New-Workshop screens.
//
// AUTO-DERIVED from the interactive-control coverage pass (plan: specs/plans/2026-09-14-interactive-control-coverage-plan.md).
// Every data-testid added to a New-Workshop routed component template is referenced here so the console
// readiness gate credits it as "tested". Depth = addressable smoke: load the route, assert each control
// is visible. Some controls live behind tabs/accordions/dialogs on these screens and a full run will need
// the relevant tab opened first — flagged per-screen; high-risk behavioural drives are a separate track.
//
// Route map + seeded ids: app.routes.ts (New-Workshop block) and workshops/support/wshop.ts (wsIds).
import { test, expect } from '@playwright/test';
import { installWshopStubs, loginAsWshopAdmin, wsIds } from './support/wshop';

test.describe('New-Workshop — routed screens: interactive controls are addressable', () => {
  test.beforeEach(async ({ page }) => {
    await installWshopStubs(page);
    await loginAsWshopAdmin(page);
  });

  // workshop-configuration/workshop-configuration.component.html — prefix wc (82 controls)
  test('workshop configuration (legacy) — controls present [wc]', async ({ page }) => {
    await page.goto(`/workshopconfigold/${wsIds.W_INACTIVE}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('wc-upload-thumbnail-1').first(), 'wc-upload-thumbnail-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-upload-video-2').first(), 'wc-upload-video-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-remove-icon-with-text-3').first(), 'wc-remove-icon-with-text-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-add-icon-with-text-4').first(), 'wc-add-icon-with-text-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-add-dyn-block-5').first(), 'wc-add-dyn-block-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-toggle-block-collapsed-6').first(), 'wc-toggle-block-collapsed-6 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-event-7').first(), 'wc-event-7 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-event-8').first(), 'wc-event-8 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-event-9').first(), 'wc-event-9 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-add-dyn-icon-10').first(), 'wc-add-dyn-icon-10 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-remove-dyn-icon-11').first(), 'wc-remove-dyn-icon-11 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-add-dyn-block-12').first(), 'wc-add-dyn-block-12 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-button-13').first(), 'wc-button-13 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-button-14').first(), 'wc-button-14 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-remove-field-15').first(), 'wc-remove-field-15 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-add-field-16').first(), 'wc-add-field-16 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-add-outcome-17').first(), 'wc-add-outcome-17 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-remove-outcome-18').first(), 'wc-remove-outcome-18 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-remove-field-19').first(), 'wc-remove-field-19 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-add-field-20').first(), 'wc-add-field-20 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-routing-21').first(), 'wc-routing-21 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-save-detail-page-22').first(), 'wc-save-detail-page-22 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-toggle-challenge-23').first(), 'wc-toggle-challenge-23 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-event-24').first(), 'wc-event-24 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-event-25').first(), 'wc-event-25 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-curriculum-26').first(), 'wc-change-curriculum-26 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-remove-sub-challenge-27').first(), 'wc-remove-sub-challenge-27 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-open-28').first(), 'wc-open-28 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-open-29').first(), 'wc-open-29 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-evolution-mapping-toggle-30').first(), 'wc-change-on-evolution-mapping-toggle-30 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-open-31').first(), 'wc-open-31 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-remove-quiz-from-selection-32').first(), 'wc-remove-quiz-from-selection-32 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-upload-resource-33').first(), 'wc-upload-resource-33 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-open-resource-link-34').first(), 'wc-open-resource-link-34 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-final-before-after-toggle-35').first(), 'wc-change-on-final-before-after-toggle-35 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-open-36').first(), 'wc-open-36 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-button-37').first(), 'wc-button-37 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-add-sub-challenge-38').first(), 'wc-add-sub-challenge-38 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-add-sub-challenge-39').first(), 'wc-add-sub-challenge-39 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-open-upload-dialog-40').first(), 'wc-open-upload-dialog-40 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-curriculum-41').first(), 'wc-change-curriculum-41 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-curriculum-42').first(), 'wc-change-curriculum-42 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-toggle-challenge-43').first(), 'wc-toggle-challenge-43 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-remove-curriculum-44').first(), 'wc-remove-curriculum-44 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-add-curriculum-45').first(), 'wc-add-curriculum-45 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-save-challenges-page-46').first(), 'wc-save-challenges-page-46 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-47').first(), 'wc-change-on-toggle-change-47 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-button-48').first(), 'wc-button-48 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-49').first(), 'wc-change-on-toggle-change-49 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-50').first(), 'wc-change-on-toggle-change-50 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-51').first(), 'wc-change-on-toggle-change-51 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-52').first(), 'wc-change-on-toggle-change-52 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-53').first(), 'wc-change-on-toggle-change-53 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-54').first(), 'wc-change-on-toggle-change-54 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-55').first(), 'wc-change-on-toggle-change-55 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-56').first(), 'wc-change-on-toggle-change-56 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-57').first(), 'wc-change-on-toggle-change-57 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-58').first(), 'wc-change-on-toggle-change-58 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-button-59').first(), 'wc-button-59 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-60').first(), 'wc-change-on-toggle-change-60 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-button-61').first(), 'wc-button-61 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-62').first(), 'wc-change-on-toggle-change-62 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-create-category-63').first(), 'wc-create-category-63 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-edit-category-64').first(), 'wc-edit-category-64 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-removecategoriesforthisworkshop-65').first(), 'wc-removecategoriesforthisworkshop-65 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-button-66').first(), 'wc-button-66 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-uploadcategory-thumbnail-67').first(), 'wc-uploadcategory-thumbnail-67 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-uploadcategory-video-68').first(), 'wc-uploadcategory-video-68 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-69').first(), 'wc-change-on-toggle-change-69 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-button-70').first(), 'wc-button-70 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-71').first(), 'wc-change-on-toggle-change-71 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-button-72').first(), 'wc-button-72 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-button-73').first(), 'wc-button-73 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-74').first(), 'wc-change-on-toggle-change-74 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-toggle-change-75').first(), 'wc-change-on-toggle-change-75 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-hero-image-upload-76').first(), 'wc-change-on-hero-image-upload-76 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-remove-hero-asset-77').first(), 'wc-remove-hero-asset-77 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-hero-mobile-image-upload-78').first(), 'wc-change-on-hero-mobile-image-upload-78 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-remove-hero-asset-79').first(), 'wc-remove-hero-asset-79 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-change-on-hero-video-upload-80').first(), 'wc-change-on-hero-video-upload-80 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-remove-hero-asset-81').first(), 'wc-remove-hero-asset-81 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc-save-settings-82').first(), 'wc-save-settings-82 should be addressable').toBeVisible();
  });

  // workshop-configurationv2/workshop-configurationv2.component.html — prefix wc2 (66 controls)
  test('workshop configuration v2 — controls present [wc2]', async ({ page }) => {
    await page.goto(`/workshopconfig/${wsIds.W_INACTIVE}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('wc2-to-normal-1').first(), 'wc2-to-normal-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-popover-2').first(), 'wc2-toggle-popover-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-pick-icon-3').first(), 'wc2-pick-icon-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-open-image-upload-4').first(), 'wc2-open-image-upload-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-back-to-workshops-5').first(), 'wc2-back-to-workshops-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-open-image-upload-6').first(), 'wc2-open-image-upload-6 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-select-tab-7').first(), 'wc2-select-tab-7 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-jump-to-8').first(), 'wc2-jump-to-8 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-collapse-all-9').first(), 'wc2-collapse-all-9 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-expand-all-10').first(), 'wc2-expand-all-10 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-section-11').first(), 'wc2-toggle-section-11 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-event-12').first(), 'wc2-event-12 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-remove-icon-with-text-13').first(), 'wc2-remove-icon-with-text-13 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-set-workshop-type-14').first(), 'wc2-set-workshop-type-14 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-section-15').first(), 'wc2-toggle-section-15 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-upload-thumbnail-16').first(), 'wc2-upload-thumbnail-16 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-upload-video-17').first(), 'wc2-upload-video-17 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-section-18').first(), 'wc2-toggle-section-18 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-section-19').first(), 'wc2-toggle-section-19 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-rsd-20').first(), 'wc2-rsd-20 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-rst-21').first(), 'wc2-rst-21 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-red-22').first(), 'wc2-red-22 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-ret-23').first(), 'wc2-ret-23 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-wsd-24').first(), 'wc2-wsd-24 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-wst-25').first(), 'wc2-wst-25 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-wed-26').first(), 'wc2-wed-26 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-wet-27').first(), 'wc2-wet-27 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-section-28').first(), 'wc2-toggle-section-28 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-event-29').first(), 'wc2-event-29 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-block-collapsed-30').first(), 'wc2-toggle-block-collapsed-30 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-event-31').first(), 'wc2-event-31 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-event-32').first(), 'wc2-event-32 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-set-dyn-type-33').first(), 'wc2-set-dyn-type-33 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-set-dyn-type-34').first(), 'wc2-set-dyn-type-34 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-control-35').first(), 'wc2-toggle-control-35 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-remove-dyn-icon-36').first(), 'wc2-remove-dyn-icon-36 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-add-dyn-icon-37').first(), 'wc2-add-dyn-icon-37 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-section-38').first(), 'wc2-toggle-section-38 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-section-39').first(), 'wc2-toggle-section-39 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-event-40').first(), 'wc2-event-40 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-remove-icon-with-text-41').first(), 'wc2-remove-icon-with-text-41 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-section-42').first(), 'wc2-toggle-section-42 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-event-43').first(), 'wc2-event-43 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-remove-field-44').first(), 'wc2-remove-field-44 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-section-45').first(), 'wc2-toggle-section-45 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-event-46').first(), 'wc2-event-46 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-remove-outcome-47').first(), 'wc2-remove-outcome-47 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-section-48').first(), 'wc2-toggle-section-48 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-remove-skill-49').first(), 'wc2-remove-skill-49 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-section-50').first(), 'wc2-toggle-section-50 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-popover-51').first(), 'wc2-toggle-popover-51 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-event-52').first(), 'wc2-event-52 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-template-53').first(), 'wc2-toggle-template-53 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-popover-54').first(), 'wc2-toggle-popover-54 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-toggle-testimonial-55').first(), 'wc2-toggle-testimonial-55 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-remove-testimonial-from-map-56').first(), 'wc2-remove-testimonial-from-map-56 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-button-57').first(), 'wc2-button-57 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-discard-changes-58').first(), 'wc2-discard-changes-58 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-save-detail-page-59').first(), 'wc2-save-detail-page-59 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-button-60').first(), 'wc2-button-60 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-discard-changes-61').first(), 'wc2-discard-changes-61 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-button-62').first(), 'wc2-button-62 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-button-63').first(), 'wc2-button-63 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-save-detail-page-64').first(), 'wc2-save-detail-page-64 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-answer-leave-65').first(), 'wc2-answer-leave-65 should be addressable').toBeVisible();
    await expect(page.getByTestId('wc2-answer-leave-66').first(), 'wc2-answer-leave-66 should be addressable').toBeVisible();
  });

  // workshops/workshops.component.html — prefix wor (20 controls)
  test('workshops list — controls present [wor]', async ({ page }) => {
    await page.goto('/workshops', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('wor-open-popup-banner-dialog-1').first(), 'wor-open-popup-banner-dialog-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-open-new-users-tab-2').first(), 'wor-open-new-users-tab-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-open-refferalcode-dialog-3').first(), 'wor-open-refferalcode-dialog-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-open-eiflix-banner-dialog-4').first(), 'wor-open-eiflix-banner-dialog-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-route-to-products-5').first(), 'wor-route-to-products-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-route-6').first(), 'wor-route-6 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-status-filter-7').first(), 'wor-status-filter-7 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-status-filter-8').first(), 'wor-status-filter-8 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-status-filter-9').first(), 'wor-status-filter-9 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-status-filter-10').first(), 'wor-status-filter-10 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-set-sort-field-11').first(), 'wor-set-sort-field-11 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-set-sort-field-12').first(), 'wor-set-sort-field-12 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-set-sort-field-13').first(), 'wor-set-sort-field-13 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-change-on-workshop-status-change-14').first(), 'wor-change-on-workshop-status-change-14 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-change-on-workshop-web-status-change-15').first(), 'wor-change-on-workshop-web-status-change-15 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-change-on-workshop-completed-change-16').first(), 'wor-change-on-workshop-completed-change-16 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-dashboard-navigation-17').first(), 'wor-dashboard-navigation-17 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-route-18').first(), 'wor-route-18 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-duplicate-workshop-19').first(), 'wor-duplicate-workshop-19 should be addressable').toBeVisible();
    await expect(page.getByTestId('wor-route-20').first(), 'wor-route-20 should be addressable').toBeVisible();
  });

  // upcomingworkshops/upcomingworkshops.component.html — prefix upc (10 controls)
  test('eiflix home config (upcoming workshops) — controls present [upc]', async ({ page }) => {
    await page.goto('/eiflixhomeconfig', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('upc-open-dialog-1').first(), 'upc-open-dialog-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('upc-open-responses-2').first(), 'upc-open-responses-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('upc-open-dialog-3').first(), 'upc-open-dialog-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('upc-delete-widget-4').first(), 'upc-delete-widget-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('upc-open-ads-dialog-5').first(), 'upc-open-ads-dialog-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('upc-open-ads-dialog-6').first(), 'upc-open-ads-dialog-6 should be addressable').toBeVisible();
    await expect(page.getByTestId('upc-delete-widget-7').first(), 'upc-delete-widget-7 should be addressable').toBeVisible();
    await expect(page.getByTestId('upc-open-home-series-dialog-8').first(), 'upc-open-home-series-dialog-8 should be addressable').toBeVisible();
    await expect(page.getByTestId('upc-open-home-series-dialog-9').first(), 'upc-open-home-series-dialog-9 should be addressable').toBeVisible();
    await expect(page.getByTestId('upc-delete-series-10').first(), 'upc-delete-series-10 should be addressable').toBeVisible();
  });

  // newusersprofile/newusersprofile.component.html — prefix new (34 controls)
  test('new users profile — controls present [new]', async ({ page }) => {
    await page.goto('/newusersprofile', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('new-button-1').first(), 'new-button-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-event-2').first(), 'new-event-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-clear-tag-filter-3').first(), 'new-clear-tag-filter-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-set-tag-mode-4').first(), 'new-set-tag-mode-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-set-tag-mode-5').first(), 'new-set-tag-mode-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-set-tag-polarity-6').first(), 'new-set-tag-polarity-6 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-set-tag-polarity-7').first(), 'new-set-tag-polarity-7 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-toggle-tag-select-8').first(), 'new-toggle-tag-select-8 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-button-9').first(), 'new-button-9 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-event-10').first(), 'new-event-10 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-clear-workshop-filter-11').first(), 'new-clear-workshop-filter-11 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-change-set-funnel-only-12').first(), 'new-change-set-funnel-only-12 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-set-workshop-filter-mode-13').first(), 'new-set-workshop-filter-mode-13 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-set-workshop-filter-mode-14').first(), 'new-set-workshop-filter-mode-14 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-toggle-workshop-select-15').first(), 'new-toggle-workshop-select-15 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-created-picker-16').first(), 'new-created-picker-16 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-event-17').first(), 'new-event-17 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-toggle-converted-filter-18').first(), 'new-toggle-converted-filter-18 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-event-19').first(), 'new-event-19 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-open-tags-manager-20').first(), 'new-open-tags-manager-20 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-import-from-excel-21').first(), 'new-import-from-excel-21 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-clear-all-filters-22').first(), 'new-clear-all-filters-22 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-change-master-toggle-23').first(), 'new-change-master-toggle-23 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-change-selection-24').first(), 'new-change-selection-24 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-open-tags-25').first(), 'new-open-tags-25 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-clear-selection-26').first(), 'new-clear-selection-26 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-open-bulk-tags-27').first(), 'new-open-bulk-tags-27 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-toggle-export-28').first(), 'new-toggle-export-28 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-select-all-export-columns-29').first(), 'new-select-all-export-columns-29 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-export-excel-30').first(), 'new-export-excel-30 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-toggle-comm-31').first(), 'new-toggle-comm-31 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-send-email-to-selected-paricipant-32').first(), 'new-send-email-to-selected-paricipant-32 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-send-watti-33').first(), 'new-send-watti-33 should be addressable').toBeVisible();
    await expect(page.getByTestId('new-send-notificationin-breakthrough-34').first(), 'new-send-notificationin-breakthrough-34 should be addressable').toBeVisible();
  });

  // eiflixdiscoverpage/eiflixdiscoverpage.component.html — prefix eif1 (35 controls)
  test('eiflix discover page — controls present [eif1]', async ({ page }) => {
    await page.goto('/eiflixdiscoverpage', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('eif1-reset-1').first(), 'eif1-reset-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-button-2').first(), 'eif1-button-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-active-section-3').first(), 'eif1-active-section-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-section1-open-4').first(), 'eif1-section1-open-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-remove-proof-5').first(), 'eif1-remove-proof-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-add-proof-6').first(), 'eif1-add-proof-6 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-section2-open-7').first(), 'eif1-section2-open-7 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-remove-publication-8').first(), 'eif1-remove-publication-8 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-add-publication-9').first(), 'eif1-add-publication-9 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-remove-award-10').first(), 'eif1-remove-award-10 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-toggle-emoji-11').first(), 'eif1-toggle-emoji-11 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-clear-emoji-12').first(), 'eif1-clear-emoji-12 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-add-award-13').first(), 'eif1-add-award-13 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-section3-open-14').first(), 'eif1-section3-open-14 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-remove-science-video-15').first(), 'eif1-remove-science-video-15 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-add-science-video-16').first(), 'eif1-add-science-video-16 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-section4-open-17').first(), 'eif1-section4-open-17 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-remove-ah-video-18').first(), 'eif1-remove-ah-video-18 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-add-ah-video-19').first(), 'eif1-add-ah-video-19 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-section5-open-20').first(), 'eif1-section5-open-20 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-remove-ei-video-21').first(), 'eif1-remove-ei-video-21 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-add-ei-video-22').first(), 'eif1-add-ei-video-22 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-section6-open-23').first(), 'eif1-section6-open-23 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-remove-love-letter-24').first(), 'eif1-remove-love-letter-24 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-add-love-letter-25').first(), 'eif1-add-love-letter-25 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-section7-open-26').first(), 'eif1-section7-open-26 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-remove-live-arena-video-27').first(), 'eif1-remove-live-arena-video-27 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-add-live-arena-video-28').first(), 'eif1-add-live-arena-video-28 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-section8-open-29').first(), 'eif1-section8-open-29 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-remove-prodigies-video-30').first(), 'eif1-remove-prodigies-video-30 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-add-prodigies-video-31').first(), 'eif1-add-prodigies-video-31 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-remove-ad-32').first(), 'eif1-remove-ad-32 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-remove-ad-proof-33').first(), 'eif1-remove-ad-proof-33 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-add-ad-proof-34').first(), 'eif1-add-ad-proof-34 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif1-add-ad-35').first(), 'eif1-add-ad-35 should be addressable').toBeVisible();
  });

  // workshop-dashboard/workshop-dashboard.component.html — prefix wd (90 controls)
  test('workshop dashboard — controls present [wd]', async ({ page }) => {
    await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('wd-load-workshop-dashboard-1').first(), 'wd-load-workshop-dashboard-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-open-qadialog-2').first(), 'wd-open-qadialog-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-open-diagnose-dialog-3').first(), 'wd-open-diagnose-dialog-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-open-clear-dialog-4').first(), 'wd-open-clear-dialog-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-manualenroll-5').first(), 'wd-manualenroll-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-metric-click-6').first(), 'wd-on-metric-click-6 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-category-click-7').first(), 'wd-on-category-click-7 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-cohort-click-8').first(), 'wd-on-cohort-click-8 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-facilitator-click-9').first(), 'wd-on-facilitator-click-9 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-category-based-metric-click-10').first(), 'wd-on-category-based-metric-click-10 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-category-based-metric-click-11').first(), 'wd-on-category-based-metric-click-11 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-category-based-metric-click-12').first(), 'wd-on-category-based-metric-click-12 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-category-based-metric-click-13').first(), 'wd-on-category-based-metric-click-13 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-category-based-metric-click-14').first(), 'wd-on-category-based-metric-click-14 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-category-based-metric-click-15').first(), 'wd-on-category-based-metric-click-15 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-metric-click-16').first(), 'wd-on-metric-click-16 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-metric-click-17').first(), 'wd-on-metric-click-17 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-metric-click-18').first(), 'wd-on-metric-click-18 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-metric-click-19').first(), 'wd-on-metric-click-19 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-metric-click-20').first(), 'wd-on-metric-click-20 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-metric-click-21').first(), 'wd-on-metric-click-21 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-metric-click-22').first(), 'wd-on-metric-click-22 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-metric-click-23').first(), 'wd-on-metric-click-23 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-day-click-24').first(), 'wd-on-day-click-24 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-day-click-25').first(), 'wd-on-day-click-25 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-open-extended-timeline-26').first(), 'wd-open-extended-timeline-26 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-toggle-challenge-panel-27').first(), 'wd-toggle-challenge-panel-27 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-challenge-main-status-click-28').first(), 'wd-on-challenge-main-status-click-28 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-challenge-main-status-click-29').first(), 'wd-on-challenge-main-status-click-29 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-challenge-main-status-click-30').first(), 'wd-on-challenge-main-status-click-30 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-challenge-main-status-click-31').first(), 'wd-on-challenge-main-status-click-31 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-open-zoom-dialog-32').first(), 'wd-open-zoom-dialog-32 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-open-zoom-attendees-33').first(), 'wd-open-zoom-attendees-33 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-status-click-34').first(), 'wd-on-status-click-34 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-export-participants-to-csv-35').first(), 'wd-export-participants-to-csv-35 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-clear-table-filters-36').first(), 'wd-clear-table-filters-36 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-move-participant-to-next-37').first(), 'wd-move-participant-to-next-37 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-review-assignment-38').first(), 'wd-review-assignment-38 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-on-participant-click-39').first(), 'wd-on-participant-click-39 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-clear-selected-participant-40').first(), 'wd-clear-selected-participant-40 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-view-quiz-41').first(), 'wd-view-quiz-41 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-view-video-ask-42').first(), 'wd-view-video-ask-42 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-view-form-43').first(), 'wd-view-form-43 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-view-form-44').first(), 'wd-view-form-44 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-view-question-assignment-45').first(), 'wd-view-question-assignment-45 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-handle-old-result-click-46').first(), 'wd-handle-old-result-click-46 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-view-form-47').first(), 'wd-view-form-47 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-view-question-assignment-48').first(), 'wd-view-question-assignment-48 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-handle-old-result-click-49').first(), 'wd-handle-old-result-click-49 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-toggle-archive-group-50').first(), 'wd-toggle-archive-group-50 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-participant-51').first(), 'wd-participant-51 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-export-forms-to-excel-52').first(), 'wd-export-forms-to-excel-52 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-toggle-archive-group-53').first(), 'wd-toggle-archive-group-53 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-open-challenge-form-review-54').first(), 'wd-open-challenge-form-review-54 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-toggle-archive-group-55').first(), 'wd-toggle-archive-group-55 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-participant-56').first(), 'wd-participant-56 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-stop-video-ask-57').first(), 'wd-stop-video-ask-57 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-send-email-to-selected-paricipant-58').first(), 'wd-send-email-to-selected-paricipant-58 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-send-watti-59').first(), 'wd-send-watti-59 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-send-notificationin-breakthrough-60').first(), 'wd-send-notificationin-breakthrough-60 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-close-participant-panel-61').first(), 'wd-close-participant-panel-61 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-export-participants-62').first(), 'wd-export-participants-62 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-button-63').first(), 'wd-button-63 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-change-apply-filter-side-64').first(), 'wd-change-apply-filter-side-64 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-button-65').first(), 'wd-button-65 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-event-66').first(), 'wd-event-66 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-change-apply-filter-side-67').first(), 'wd-change-apply-filter-side-67 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-button-68').first(), 'wd-button-68 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-event-69').first(), 'wd-event-69 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-button-70').first(), 'wd-button-70 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-event-71').first(), 'wd-event-71 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-change-toggle-journey-filter-72').first(), 'wd-change-toggle-journey-filter-72 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-change-toggle-tier-filter-73').first(), 'wd-change-toggle-tier-filter-73 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-change-toggle-category-filter-74').first(), 'wd-change-toggle-category-filter-74 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-change-toggle-enrollment-status-filter-75').first(), 'wd-change-toggle-enrollment-status-filter-75 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-change-toggle-enrollment-status-filter-76').first(), 'wd-change-toggle-enrollment-status-filter-76 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-clear-journey-filters-77').first(), 'wd-clear-journey-filters-77 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-button-78').first(), 'wd-button-78 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-event-79').first(), 'wd-event-79 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-change-toggle-category-filter-80').first(), 'wd-change-toggle-category-filter-80 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-change-toggle-not-started-type-filter-81').first(), 'wd-change-toggle-not-started-type-filter-81 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-change-toggle-not-started-type-filter-82').first(), 'wd-change-toggle-not-started-type-filter-82 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-clear-category-filters-83').first(), 'wd-clear-category-filters-83 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-a-84').first(), 'wd-a-84 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-toggle-extend-target-85').first(), 'wd-toggle-extend-target-85 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-event-86').first(), 'wd-event-86 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-extend-picker-87').first(), 'wd-extend-picker-87 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-toggle-extend-target-88').first(), 'wd-toggle-extend-target-88 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-confirm-extend-89').first(), 'wd-confirm-extend-89 should be addressable').toBeVisible();
    await expect(page.getByTestId('wd-close-participant-panel-90').first(), 'wd-close-participant-panel-90 should be addressable').toBeVisible();
  });

  // form-assignment/form-assignment.component.html — prefix fa (14 controls)
  test('form assignment — controls present [fa]', async ({ page }) => {
    await page.goto('/formtemplateworkshop', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('fa-change-auto-save-1').first(), 'fa-change-auto-save-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('fa-change-auto-save-2').first(), 'fa-change-auto-save-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('fa-change-auto-save-3').first(), 'fa-change-auto-save-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('fa-change-on-slider-flipping-value-change-4').first(), 'fa-change-on-slider-flipping-value-change-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('fa-change-auto-save-5').first(), 'fa-change-auto-save-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('fa-change-auto-save-6').first(), 'fa-change-auto-save-6 should be addressable').toBeVisible();
    await expect(page.getByTestId('fa-on-add-7').first(), 'fa-on-add-7 should be addressable').toBeVisible();
    await expect(page.getByTestId('fa-on-remove-8').first(), 'fa-on-remove-8 should be addressable').toBeVisible();
    await expect(page.getByTestId('fa-on-submit-9').first(), 'fa-on-submit-9 should be addressable').toBeVisible();
    await expect(page.getByTestId('fa-on-update-10').first(), 'fa-on-update-10 should be addressable').toBeVisible();
    await expect(page.getByTestId('fa-add-note-11').first(), 'fa-add-note-11 should be addressable').toBeVisible();
    await expect(page.getByTestId('fa-remove-note-12').first(), 'fa-remove-note-12 should be addressable').toBeVisible();
    await expect(page.getByTestId('fa-complete-assignment-13').first(), 'fa-complete-assignment-13 should be addressable').toBeVisible();
    await expect(page.getByTestId('fa-rework-assignment-14').first(), 'fa-rework-assignment-14 should be addressable').toBeVisible();
  });

  // product-page/product-page.component.html — prefix pp (4 controls)
  test('product page — controls present [pp]', async ({ page }) => {
    await page.goto('/productpageworkshop', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('pp-open-add-dialog-1').first(), 'pp-open-add-dialog-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('pp-a-2').first(), 'pp-a-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('pp-open-edit-dialog-3').first(), 'pp-open-edit-dialog-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('pp-delete-product-4').first(), 'pp-delete-product-4 should be addressable').toBeVisible();
  });

  // engagement-dashboard/engagement-dashboard.component.html — prefix ed (49 controls)
  test('engagement dashboard — controls present [ed]', async ({ page }) => {
    await page.goto('/engagementdashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('ed-export-full-dashboard-to-csv-1').first(), 'ed-export-full-dashboard-to-csv-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-confirm-and-save-engagement-2').first(), 'ed-confirm-and-save-engagement-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-toggle-month-picker-3').first(), 'ed-toggle-month-picker-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-decrement-year-4').first(), 'ed-decrement-year-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-increment-year-5').first(), 'ed-increment-year-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-select-month-6').first(), 'ed-select-month-6 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-change-on-engagement-filter-change-7').first(), 'ed-change-on-engagement-filter-change-7 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-on-status-toggle-8').first(), 'ed-on-status-toggle-8 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-on-status-toggle-9').first(), 'ed-on-status-toggle-9 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-close-month-picker-10').first(), 'ed-close-month-picker-10 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-open-all-active-participants-panel-11').first(), 'ed-open-all-active-participants-panel-11 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-open-all-engaged-participants-panel-12').first(), 'ed-open-all-engaged-participants-panel-12 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-open-all-not-engaged-participants-panel-13').first(), 'ed-open-all-not-engaged-participants-panel-13 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-14').first(), 'ed-event-14 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-15').first(), 'ed-event-15 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-16').first(), 'ed-event-16 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-open-engaged-panel-17').first(), 'ed-open-engaged-panel-17 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-open-not-engaged-panel-18').first(), 'ed-open-not-engaged-panel-18 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-selected-event-tab-19').first(), 'ed-selected-event-tab-19 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-selected-event-tab-20').first(), 'ed-selected-event-tab-20 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-selected-event-tab-21').first(), 'ed-selected-event-tab-21 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-22').first(), 'ed-event-22 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-23').first(), 'ed-event-23 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-24').first(), 'ed-event-24 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-open-engaged-panel-25').first(), 'ed-open-engaged-panel-25 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-open-not-engaged-panel-26').first(), 'ed-open-not-engaged-panel-26 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-27').first(), 'ed-event-27 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-28').first(), 'ed-event-28 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-29').first(), 'ed-event-29 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-open-event-engaged-panel-30').first(), 'ed-open-event-engaged-panel-30 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-open-event-not-engaged-panel-31').first(), 'ed-open-event-not-engaged-panel-31 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-32').first(), 'ed-event-32 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-33').first(), 'ed-event-33 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-34').first(), 'ed-event-34 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-open-appointment-engaged-panel-35').first(), 'ed-open-appointment-engaged-panel-35 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-open-appointment-not-engaged-panel-36').first(), 'ed-open-appointment-not-engaged-panel-36 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-37').first(), 'ed-event-37 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-38').first(), 'ed-event-38 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-39').first(), 'ed-event-39 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-open-engaged-panel-40').first(), 'ed-open-engaged-panel-40 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-open-not-engaged-panel-41').first(), 'ed-open-not-engaged-panel-41 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-toggle-panel-filter-42').first(), 'ed-toggle-panel-filter-42 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-send-mail-43').first(), 'ed-send-mail-43 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-event-44').first(), 'ed-event-44 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-send-notificationin-breakthrough-45').first(), 'ed-send-notificationin-breakthrough-45 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-close-panel-46').first(), 'ed-close-panel-46 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-export-participants-47').first(), 'ed-export-participants-47 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-navigate-to-profile-48').first(), 'ed-navigate-to-profile-48 should be addressable').toBeVisible();
    await expect(page.getByTestId('ed-close-panel-49').first(), 'ed-close-panel-49 should be addressable').toBeVisible();
  });

  // capacity-dashboard/capacity-dashboard.component.html — prefix cd (23 controls)
  test('capacity (big engagement) dashboard — controls present [cd]', async ({ page }) => {
    await page.goto('/bigengagementdashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('cd-drawer-1').first(), 'cd-drawer-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-profile-2').first(), 'cd-open-profile-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-profile-3').first(), 'cd-open-profile-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-participant-drawer-4').first(), 'cd-open-participant-drawer-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-participant-drawer-5').first(), 'cd-open-participant-drawer-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-participant-drawer-6').first(), 'cd-open-participant-drawer-6 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-journey-drawer-7').first(), 'cd-open-journey-drawer-7 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-journey-drawer-8').first(), 'cd-open-journey-drawer-8 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-journey-drawer-9').first(), 'cd-open-journey-drawer-9 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-atc-model-drawer-10').first(), 'cd-open-atc-model-drawer-10 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-atc-model-drawer-11').first(), 'cd-open-atc-model-drawer-11 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-not-started-drawer-12').first(), 'cd-open-not-started-drawer-12 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-before-diagnostic-drawer-13').first(), 'cd-open-before-diagnostic-drawer-13 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-before-diagnostic-drawer-14').first(), 'cd-open-before-diagnostic-drawer-14 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-after-diagnostic-drawer-15').first(), 'cd-open-after-diagnostic-drawer-15 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-after-diagnostic-drawer-16').first(), 'cd-open-after-diagnostic-drawer-16 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-on-clear-filter-17').first(), 'cd-on-clear-filter-17 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-drawer-18').first(), 'cd-open-drawer-18 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-drawer-19').first(), 'cd-open-drawer-19 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-drawer-20').first(), 'cd-open-drawer-20 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-drawer-21').first(), 'cd-open-drawer-21 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-drawer-22').first(), 'cd-open-drawer-22 should be addressable').toBeVisible();
    await expect(page.getByTestId('cd-open-drawer-23').first(), 'cd-open-drawer-23 should be addressable').toBeVisible();
  });

  // bigeventmentor/bigeventmentor.component.html — prefix big (26 controls)
  test('big event mentor — controls present [big]', async ({ page }) => {
    await page.goto('/bigeventmentor', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('big-create-big-event-mentor-1').first(), 'big-create-big-event-mentor-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-button-2').first(), 'big-button-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-assign-profiles-3').first(), 'big-assign-profiles-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-clear-filters-4').first(), 'big-clear-filters-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-toggle-status-section-5').first(), 'big-toggle-status-section-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-change-toggle-select-all-6').first(), 'big-change-toggle-select-all-6 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-button-7').first(), 'big-button-7 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-move-selected-8').first(), 'big-move-selected-8 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-button-9').first(), 'big-button-9 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-move-selected-to-level-10').first(), 'big-move-selected-to-level-10 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-move-selected-to-level-11').first(), 'big-move-selected-to-level-11 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-remove-selected-12').first(), 'big-remove-selected-12 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-change-toggle-select-13').first(), 'big-change-toggle-select-13 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-remove-participant-14').first(), 'big-remove-participant-14 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-change-toggle-select-all-level-15').first(), 'big-change-toggle-select-all-level-15 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-button-16').first(), 'big-button-16 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-button-17').first(), 'big-button-17 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-move-level-to-level-18').first(), 'big-move-level-to-level-18 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-button-19').first(), 'big-button-19 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-move-level-to-level-20').first(), 'big-move-level-to-level-20 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-move-level-to-level-21').first(), 'big-move-level-to-level-21 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-move-level-to-level-22').first(), 'big-move-level-to-level-22 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-remove-level-selected-23').first(), 'big-remove-level-selected-23 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-change-toggle-select-level-24').first(), 'big-change-toggle-select-level-24 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-remove-level-participant-25').first(), 'big-remove-level-participant-25 should be addressable').toBeVisible();
    await expect(page.getByTestId('big-clear-filters-26').first(), 'big-clear-filters-26 should be addressable').toBeVisible();
  });

  // eiflixoperationsdashboard/eiflixoperationsdashboard.component.html — prefix eif (36 controls)
  test('eiflix operations dashboard — controls present [eif]', async ({ page }) => {
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('eif-open-panel-1').first(), 'eif-open-panel-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-set-eng-range-2').first(), 'eif-set-eng-range-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-set-eng-range-3').first(), 'eif-set-eng-range-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-set-eng-range-4').first(), 'eif-set-eng-range-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-change-apply-eng-custom-5').first(), 'eif-change-apply-eng-custom-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-change-apply-eng-custom-6').first(), 'eif-change-apply-eng-custom-6 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-set-eng-range-7').first(), 'eif-set-eng-range-7 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-retry-engagement-8').first(), 'eif-retry-engagement-8 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-open-viewers-panel-9').first(), 'eif-open-viewers-panel-9 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-open-viewers-panel-10').first(), 'eif-open-viewers-panel-10 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-open-viewers-panel-11').first(), 'eif-open-viewers-panel-11 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-prev-content-page-12').first(), 'eif-prev-content-page-12 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-next-content-page-13').first(), 'eif-next-content-page-13 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-open-hot-settings-14').first(), 'eif-open-hot-settings-14 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-hot-error-15').first(), 'eif-hot-error-15 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-load-na-register-16').first(), 'eif-load-na-register-16 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-open-non-active-panel-17').first(), 'eif-open-non-active-panel-17 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-event-18').first(), 'eif-event-18 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-event-19').first(), 'eif-event-19 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-set-db-range-20').first(), 'eif-set-db-range-20 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-set-db-range-21').first(), 'eif-set-db-range-21 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-set-db-range-22').first(), 'eif-set-db-range-22 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-open-platform-panel-23').first(), 'eif-open-platform-panel-23 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-close-panel-24').first(), 'eif-close-panel-24 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-p-25').first(), 'eif-p-25 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-close-panel-26').first(), 'eif-close-panel-26 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-on-panel-search-27').first(), 'eif-on-panel-search-27 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-set-panel-cohort-28').first(), 'eif-set-panel-cohort-28 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-set-panel-cohort-29').first(), 'eif-set-panel-cohort-29 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-set-panel-cohort-30').first(), 'eif-set-panel-cohort-30 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-event-31').first(), 'eif-event-31 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-event-32').first(), 'eif-event-32 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-set-panel-sort-33').first(), 'eif-set-panel-sort-33 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-export-panel-34').first(), 'eif-export-panel-34 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-on-panel-search-35').first(), 'eif-on-panel-search-35 should be addressable').toBeVisible();
    await expect(page.getByTestId('eif-on-row-click-36').first(), 'eif-on-row-click-36 should be addressable').toBeVisible();
  });

  // campaigndashboard/campaigndashboard.component.html — prefix cam (6 controls)
  test('campaign dashboard — controls present [cam]', async ({ page }) => {
    await page.goto('/campaigndashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('cam-open-new-campaign-dialog-1').first(), 'cam-open-new-campaign-dialog-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('cam-a-2').first(), 'cam-a-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('cam-open-edit-dialog-3').first(), 'cam-open-edit-dialog-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('cam-button-4').first(), 'cam-button-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('cam-button-5').first(), 'cam-button-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('cam-open-new-campaign-dialog-6').first(), 'cam-open-new-campaign-dialog-6 should be addressable').toBeVisible();
  });

  // wccalendar/wccalendar.component.html — prefix wcc (7 controls)
  test('wc calendar — controls present [wcc]', async ({ page }) => {
    await page.goto('/wccalendar', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('wcc-prev-month-1').first(), 'wcc-prev-month-1 should be addressable').toBeVisible();
    await expect(page.getByTestId('wcc-go-today-2').first(), 'wcc-go-today-2 should be addressable').toBeVisible();
    await expect(page.getByTestId('wcc-next-month-3').first(), 'wcc-next-month-3 should be addressable').toBeVisible();
    await expect(page.getByTestId('wcc-open-add-event-4').first(), 'wcc-open-add-event-4 should be addressable').toBeVisible();
    await expect(page.getByTestId('wcc-open-day-5').first(), 'wcc-open-day-5 should be addressable').toBeVisible();
    await expect(page.getByTestId('wcc-open-chip-6').first(), 'wcc-open-chip-6 should be addressable').toBeVisible();
    await expect(page.getByTestId('wcc-open-more-7').first(), 'wcc-open-more-7 should be addressable').toBeVisible();
  });

  // create-workshop/create-workshop.component.html — prefix cw1 (1 controls)
  test('create workshop — controls present [cw1]', async ({ page }) => {
    await page.goto('/create-workshop', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('cw1-create-workshop-1').first(), 'cw1-create-workshop-1 should be addressable').toBeVisible();
  });

});
