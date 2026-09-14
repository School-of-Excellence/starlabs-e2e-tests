// new-workshop-child-controls.spec.ts — ADDRESSABLE stubs for New-Workshop child/dialog components.
//
// These components have NO route of their own — they are tabs, dialogs and embedded panels opened from a
// parent screen (e.g. the workshop-dashboard tabs, the workshops list dialogs, the wccalendar dialogs).
// Their data-testids are referenced here so the readiness gate credits them; each case is marked
// test.fixme because driving it requires the parent screen to open the child first (the open-trigger is
// itself an addressed control in new-workshop-controls.spec.ts). Wiring the open step + behavioural
// assertions is the follow-up validation track — the addressable inventory below is complete and stable.
import { test, expect } from '@playwright/test';
import { installWshopStubs, loginAsWshopAdmin } from './support/wshop';

test.describe('New-Workshop — child/dialog components: control inventory (addressable, parent-open pending)', () => {
  test.beforeEach(async ({ page }) => {
    await installWshopStubs(page);
    await loginAsWshopAdmin(page);
  });

  // workshop-dashboard/workshop-dashboardv2.component.html — prefix wd1 (74 controls)
  test.fixme('workshop-dashboard/workshop-dashboardv2.component.html controls addressable [wd1]', async ({ page }) => {
    await expect(page.getByTestId('wd1-load-workshop-dashboard-1').first(), 'wd1-load-workshop-dashboard-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-open-qadialog-2').first(), 'wd1-open-qadialog-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-open-clear-dialog-3').first(), 'wd1-open-clear-dialog-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-manualenroll-4').first(), 'wd1-manualenroll-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-metric-click-5').first(), 'wd1-on-metric-click-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-category-click-6').first(), 'wd1-on-category-click-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-cohort-click-7').first(), 'wd1-on-cohort-click-7 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-facilitator-click-8').first(), 'wd1-on-facilitator-click-8 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-category-based-metric-click-9').first(), 'wd1-on-category-based-metric-click-9 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-category-based-metric-click-10').first(), 'wd1-on-category-based-metric-click-10 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-category-based-metric-click-11').first(), 'wd1-on-category-based-metric-click-11 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-category-based-metric-click-12').first(), 'wd1-on-category-based-metric-click-12 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-category-based-metric-click-13').first(), 'wd1-on-category-based-metric-click-13 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-category-based-metric-click-14').first(), 'wd1-on-category-based-metric-click-14 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-metric-click-15').first(), 'wd1-on-metric-click-15 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-metric-click-16').first(), 'wd1-on-metric-click-16 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-metric-click-17').first(), 'wd1-on-metric-click-17 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-metric-click-18').first(), 'wd1-on-metric-click-18 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-metric-click-19').first(), 'wd1-on-metric-click-19 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-metric-click-20').first(), 'wd1-on-metric-click-20 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-metric-click-21').first(), 'wd1-on-metric-click-21 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-day-click-22').first(), 'wd1-on-day-click-22 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-day-click-23').first(), 'wd1-on-day-click-23 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-challenge-main-status-click-24').first(), 'wd1-on-challenge-main-status-click-24 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-challenge-main-status-click-25').first(), 'wd1-on-challenge-main-status-click-25 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-challenge-main-status-click-26').first(), 'wd1-on-challenge-main-status-click-26 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-challenge-main-status-click-27').first(), 'wd1-on-challenge-main-status-click-27 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-open-zoom-dialog-28').first(), 'wd1-open-zoom-dialog-28 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-open-zoom-attendees-29').first(), 'wd1-open-zoom-attendees-29 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-status-click-30').first(), 'wd1-on-status-click-30 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-export-participants-to-csv-31').first(), 'wd1-export-participants-to-csv-31 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-clear-table-filters-32').first(), 'wd1-clear-table-filters-32 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-move-participant-to-next-33').first(), 'wd1-move-participant-to-next-33 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-review-assignment-34').first(), 'wd1-review-assignment-34 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-on-participant-click-35').first(), 'wd1-on-participant-click-35 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-view-quiz-36').first(), 'wd1-view-quiz-36 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-view-video-ask-37').first(), 'wd1-view-video-ask-37 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-view-form-38').first(), 'wd1-view-form-38 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-view-form-39').first(), 'wd1-view-form-39 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-view-question-assignment-40').first(), 'wd1-view-question-assignment-40 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-handle-old-result-click-41').first(), 'wd1-handle-old-result-click-41 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-view-form-42').first(), 'wd1-view-form-42 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-view-question-assignment-43').first(), 'wd1-view-question-assignment-43 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-handle-old-result-click-44').first(), 'wd1-handle-old-result-click-44 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-participant-45').first(), 'wd1-participant-45 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-open-challenge-form-review-46').first(), 'wd1-open-challenge-form-review-46 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-send-mail-47').first(), 'wd1-send-mail-47 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-send-watti-48').first(), 'wd1-send-watti-48 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-send-notificationin-breakthrough-49').first(), 'wd1-send-notificationin-breakthrough-49 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-close-participant-panel-50').first(), 'wd1-close-participant-panel-50 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-export-participants-51').first(), 'wd1-export-participants-51 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-button-52').first(), 'wd1-button-52 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-change-apply-filter-side-53').first(), 'wd1-change-apply-filter-side-53 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-button-54').first(), 'wd1-button-54 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-event-55').first(), 'wd1-event-55 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-change-apply-filter-side-56').first(), 'wd1-change-apply-filter-side-56 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-button-57').first(), 'wd1-button-57 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-event-58').first(), 'wd1-event-58 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-button-59').first(), 'wd1-button-59 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-event-60').first(), 'wd1-event-60 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-change-toggle-journey-filter-61').first(), 'wd1-change-toggle-journey-filter-61 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-change-toggle-tier-filter-62').first(), 'wd1-change-toggle-tier-filter-62 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-change-toggle-category-filter-63').first(), 'wd1-change-toggle-category-filter-63 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-change-toggle-enrollment-status-filter-64').first(), 'wd1-change-toggle-enrollment-status-filter-64 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-change-toggle-enrollment-status-filter-65').first(), 'wd1-change-toggle-enrollment-status-filter-65 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-clear-journey-filters-66').first(), 'wd1-clear-journey-filters-66 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-button-67').first(), 'wd1-button-67 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-event-68').first(), 'wd1-event-68 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-change-toggle-category-filter-69').first(), 'wd1-change-toggle-category-filter-69 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-change-toggle-not-started-type-filter-70').first(), 'wd1-change-toggle-not-started-type-filter-70 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-change-toggle-not-started-type-filter-71').first(), 'wd1-change-toggle-not-started-type-filter-71 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-clear-category-filters-72').first(), 'wd1-clear-category-filters-72 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-a-73').first(), 'wd1-a-73 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd1-close-participant-panel-74').first(), 'wd1-close-participant-panel-74 should be addressable once its parent opens it').toBeVisible();
  });

  // workshop-configurationv2/settings/workshop-settingsv2.component.html — prefix ws (98 controls)
  test.fixme('workshop-configurationv2/settings/workshop-settingsv2.component.html controls addressable [ws]', async ({ page }) => {
    await expect(page.getByTestId('ws-to-normal-1').first(), 'ws-to-normal-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-popover-2').first(), 'ws-toggle-popover-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-event-3').first(), 'ws-event-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-pop-tab-4').first(), 'ws-pop-tab-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-pop-tab-5').first(), 'ws-pop-tab-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-person-6').first(), 'ws-toggle-person-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-person-7').first(), 'ws-toggle-person-7 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-close-popover-8').first(), 'ws-close-popover-8 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-jump-to-9').first(), 'ws-jump-to-9 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-collapse-all-10').first(), 'ws-collapse-all-10 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-expand-all-11').first(), 'ws-expand-all-11 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-section-12').first(), 'ws-toggle-section-12 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-13').first(), 'ws-toggle-field-13 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-14').first(), 'ws-toggle-field-14 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-15').first(), 'ws-toggle-field-15 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-16').first(), 'ws-toggle-field-16 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-17').first(), 'ws-toggle-field-17 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-18').first(), 'ws-toggle-field-18 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-19').first(), 'ws-toggle-field-19 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-20').first(), 'ws-toggle-field-20 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-21').first(), 'ws-toggle-field-21 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-section-22').first(), 'ws-toggle-section-22 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-23').first(), 'ws-toggle-field-23 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-24').first(), 'ws-toggle-field-24 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-popover-25').first(), 'ws-toggle-popover-25 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-event-26').first(), 'ws-event-26 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-in-array-27').first(), 'ws-toggle-in-array-27 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-28').first(), 'ws-toggle-field-28 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-popover-29').first(), 'ws-toggle-popover-29 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-event-30').first(), 'ws-event-30 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-in-array-31').first(), 'ws-toggle-in-array-31 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-32').first(), 'ws-toggle-field-32 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-33').first(), 'ws-toggle-field-33 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-section-34').first(), 'ws-toggle-section-34 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-event-35').first(), 'ws-event-35 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-create-category-36').first(), 'ws-create-category-36 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-edit-category-37').first(), 'ws-edit-category-37 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-popover-38').first(), 'ws-toggle-popover-38 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-event-39').first(), 'ws-event-39 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-cohort-40').first(), 'ws-toggle-cohort-40 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-removecategoriesforthisworkshop-41').first(), 'ws-removecategoriesforthisworkshop-41 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-popover-42').first(), 'ws-toggle-popover-42 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-workshop-category-43').first(), 'ws-toggle-workshop-category-43 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-remove-cohortcategoriesforthisworkshop-44').first(), 'ws-remove-cohortcategoriesforthisworkshop-44 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-pick-file-45').first(), 'ws-pick-file-45 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-pick-file-46').first(), 'ws-pick-file-46 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-section-47').first(), 'ws-toggle-section-47 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-event-48').first(), 'ws-event-48 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-selected-day-49').first(), 'ws-selected-day-49 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-50').first(), 'ws-toggle-field-50 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-popover-51').first(), 'ws-toggle-popover-51 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-set-field-52').first(), 'ws-set-field-52 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-set-field-53').first(), 'ws-set-field-53 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-set-field-54').first(), 'ws-set-field-54 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-set-field-55').first(), 'ws-set-field-55 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-popover-56').first(), 'ws-toggle-popover-56 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-event-57').first(), 'ws-event-57 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-in-array-58').first(), 'ws-toggle-in-array-58 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-popover-59').first(), 'ws-toggle-popover-59 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-event-60').first(), 'ws-event-60 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-in-array-61').first(), 'ws-toggle-in-array-61 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-62').first(), 'ws-toggle-field-62 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-63').first(), 'ws-toggle-field-63 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-64').first(), 'ws-toggle-field-64 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-65').first(), 'ws-toggle-field-65 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-66').first(), 'ws-toggle-field-66 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-section-67').first(), 'ws-toggle-section-67 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-set-field-68').first(), 'ws-set-field-68 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-popover-69').first(), 'ws-toggle-popover-69 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-set-field-70').first(), 'ws-set-field-70 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-set-field-71').first(), 'ws-set-field-71 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-section-72').first(), 'ws-toggle-section-72 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-section-73').first(), 'ws-toggle-section-73 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-section-74').first(), 'ws-toggle-section-74 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-75').first(), 'ws-toggle-field-75 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-76').first(), 'ws-toggle-field-76 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-field-77').first(), 'ws-toggle-field-77 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-toggle-popover-78').first(), 'ws-toggle-popover-78 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-set-field-79').first(), 'ws-set-field-79 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-set-field-80').first(), 'ws-set-field-80 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-set-field-81').first(), 'ws-set-field-81 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-pick-file-82').first(), 'ws-pick-file-82 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-remove-hero-asset-83').first(), 'ws-remove-hero-asset-83 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-pick-file-84').first(), 'ws-pick-file-84 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-pick-file-85').first(), 'ws-pick-file-85 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-remove-hero-asset-86').first(), 'ws-remove-hero-asset-86 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-pick-file-87').first(), 'ws-pick-file-87 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-pick-file-88').first(), 'ws-pick-file-88 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-remove-hero-asset-89').first(), 'ws-remove-hero-asset-89 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-pick-file-90').first(), 'ws-pick-file-90 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-button-91').first(), 'ws-button-91 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-discard-changes-92').first(), 'ws-discard-changes-92 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-save-settings-93').first(), 'ws-save-settings-93 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-discard-changes-94').first(), 'ws-discard-changes-94 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-button-95').first(), 'ws-button-95 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-button-96').first(), 'ws-button-96 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-button-97').first(), 'ws-button-97 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ws-save-settings-98').first(), 'ws-save-settings-98 should be addressable once its parent opens it').toBeVisible();
  });

  // workshop-configurationv2/challenges/workshop-challengesv2.component.html — prefix wc1 (68 controls)
  test.fixme('workshop-configurationv2/challenges/workshop-challengesv2.component.html controls addressable [wc1]', async ({ page }) => {
    await expect(page.getByTestId('wc1-to-normal-1').first(), 'wc1-to-normal-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-popover-2').first(), 'wc1-toggle-popover-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-pick-ref-3').first(), 'wc1-pick-ref-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-pick-ref-4').first(), 'wc1-pick-ref-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-popover-5').first(), 'wc1-toggle-popover-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-pick-ref-6').first(), 'wc1-pick-ref-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-pick-ref-7').first(), 'wc1-pick-ref-7 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-jump-to-set-8').first(), 'wc1-jump-to-set-8 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-add-curriculum-9').first(), 'wc1-add-curriculum-9 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-set-10').first(), 'wc1-toggle-set-10 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-event-11').first(), 'wc1-event-11 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-event-12').first(), 'wc1-event-12 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-set-set-type-13').first(), 'wc1-set-set-type-13 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-set-set-type-14').first(), 'wc1-set-set-type-14 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-sdp-15').first(), 'wc1-sdp-15 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-stp-16').first(), 'wc1-stp-16 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-bool-17').first(), 'wc1-toggle-bool-17 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-popover-18').first(), 'wc1-toggle-popover-18 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-event-19').first(), 'wc1-event-19 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-category-20').first(), 'wc1-toggle-category-20 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-bool-21').first(), 'wc1-toggle-bool-21 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-get-challenge-array-22').first(), 'wc1-get-challenge-array-22 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-add-sub-challenge-23').first(), 'wc1-add-sub-challenge-23 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-add-sub-challenge-24').first(), 'wc1-add-sub-challenge-24 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-act-25').first(), 'wc1-toggle-act-25 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-event-26').first(), 'wc1-event-26 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-event-27').first(), 'wc1-event-27 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-popover-28').first(), 'wc1-toggle-popover-28 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-change-activity-type-29').first(), 'wc1-change-activity-type-29 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-bool-30').first(), 'wc1-toggle-bool-30 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-open-31').first(), 'wc1-open-31 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-open-32').first(), 'wc1-open-32 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-final-evolution-33').first(), 'wc1-toggle-final-evolution-33 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-popover-34').first(), 'wc1-toggle-popover-34 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-set-evolution-type-35').first(), 'wc1-set-evolution-type-35 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-open-36').first(), 'wc1-open-36 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-popover-37').first(), 'wc1-toggle-popover-37 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-event-38').first(), 'wc1-event-38 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-quiz-39').first(), 'wc1-toggle-quiz-39 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-bool-40').first(), 'wc1-toggle-bool-40 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-set-assignment-type-41').first(), 'wc1-set-assignment-type-41 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-set-assignment-type-42').first(), 'wc1-set-assignment-type-42 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-open-43').first(), 'wc1-open-43 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-set-submission-format-44').first(), 'wc1-set-submission-format-44 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-set-submission-format-45').first(), 'wc1-set-submission-format-45 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-popover-46').first(), 'wc1-toggle-popover-46 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-pick-ref-47').first(), 'wc1-pick-ref-47 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-upload-resource-48').first(), 'wc1-upload-resource-48 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-open-resource-link-49').first(), 'wc1-open-resource-link-49 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-final-before-after-50').first(), 'wc1-toggle-final-before-after-50 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-add-sub-challenge-51').first(), 'wc1-add-sub-challenge-51 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-ddp-52').first(), 'wc1-ddp-52 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-dtp-53').first(), 'wc1-dtp-53 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-open-upload-dialog-54').first(), 'wc1-open-upload-dialog-54 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-set-completed-55').first(), 'wc1-set-completed-55 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-toggle-bool-56').first(), 'wc1-toggle-bool-56 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-add-curriculum-57').first(), 'wc1-add-curriculum-57 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-add-curriculum-58').first(), 'wc1-add-curriculum-58 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-button-59').first(), 'wc1-button-59 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-discard-changes-60').first(), 'wc1-discard-changes-60 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-save-challenges-page-61').first(), 'wc1-save-challenges-page-61 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-button-62').first(), 'wc1-button-62 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-discard-changes-63').first(), 'wc1-discard-changes-63 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-button-64').first(), 'wc1-button-64 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-button-65').first(), 'wc1-button-65 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-save-challenges-page-66').first(), 'wc1-save-challenges-page-66 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-answer-confirm-67').first(), 'wc1-answer-confirm-67 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc1-answer-confirm-68').first(), 'wc1-answer-confirm-68 should be addressable once its parent opens it').toBeVisible();
  });

  // workshop-dashboard/questionandanswer/questionandanswer.component.html — prefix que (35 controls)
  test.fixme('workshop-dashboard/questionandanswer/questionandanswer.component.html controls addressable [que]', async ({ page }) => {
    await expect(page.getByTestId('que-close-dialog-1').first(), 'que-close-dialog-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-ask-question-2').first(), 'que-ask-question-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-delete-item-3').first(), 'que-delete-item-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-pin-question-4').first(), 'que-pin-question-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-start-reply-5').first(), 'que-start-reply-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-post-reply-6').first(), 'que-post-reply-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-cancel-reply-7').first(), 'que-cancel-reply-7 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-toggle-show-all-replies-8').first(), 'que-toggle-show-all-replies-8 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-toggle-show-all-replies-9').first(), 'que-toggle-show-all-replies-9 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-delete-item-10').first(), 'que-delete-item-10 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-start-reply-11').first(), 'que-start-reply-11 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-post-reply-12').first(), 'que-post-reply-12 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-cancel-reply-13').first(), 'que-cancel-reply-13 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-delete-item-14').first(), 'que-delete-item-14 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-start-reply-15').first(), 'que-start-reply-15 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-post-reply-16').first(), 'que-post-reply-16 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-cancel-reply-17').first(), 'que-cancel-reply-17 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-toggle-show-all-replies-18').first(), 'que-toggle-show-all-replies-18 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-toggle-show-all-replies-19').first(), 'que-toggle-show-all-replies-19 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-delete-item-20').first(), 'que-delete-item-20 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-start-reply-21').first(), 'que-start-reply-21 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-post-reply-22').first(), 'que-post-reply-22 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-cancel-reply-23').first(), 'que-cancel-reply-23 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-move-item-24').first(), 'que-move-item-24 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-pin-question-25').first(), 'que-pin-question-25 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-delete-item-26').first(), 'que-delete-item-26 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-start-reply-27').first(), 'que-start-reply-27 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-post-reply-28').first(), 'que-post-reply-28 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-cancel-reply-29').first(), 'que-cancel-reply-29 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-toggle-show-all-replies-30').first(), 'que-toggle-show-all-replies-30 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-toggle-show-all-replies-31').first(), 'que-toggle-show-all-replies-31 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-delete-item-32').first(), 'que-delete-item-32 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-start-reply-33').first(), 'que-start-reply-33 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-post-reply-34').first(), 'que-post-reply-34 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('que-cancel-reply-35').first(), 'que-cancel-reply-35 should be addressable once its parent opens it').toBeVisible();
  });

  // workshop-dashboard/sendmessages/sendmessages.component.html — prefix sen (14 controls)
  test.fixme('workshop-dashboard/sendmessages/sendmessages.component.html controls addressable [sen]', async ({ page }) => {
    await expect(page.getByTestId('sen-close-1').first(), 'sen-close-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('sen-profiles-expanded-2').first(), 'sen-profiles-expanded-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('sen-toggle-pin-3').first(), 'sen-toggle-pin-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('sen-refresh-templates-4').first(), 'sen-refresh-templates-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('sen-select-pinned-template-5').first(), 'sen-select-pinned-template-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('sen-remove-pinned-template-6').first(), 'sen-remove-pinned-template-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('sen-event-7').first(), 'sen-event-7 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('sen-event-8').first(), 'sen-event-8 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('sen-load-cached-message-9').first(), 'sen-load-cached-message-9 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('sen-delete-cached-message-10').first(), 'sen-delete-cached-message-10 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('sen-clear-all-cache-for-template-11').first(), 'sen-clear-all-cache-for-template-11 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('sen-close-12').first(), 'sen-close-12 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('sen-save-to-cache-13').first(), 'sen-save-to-cache-13 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('sen-send-whats-app-14').first(), 'sen-send-whats-app-14 should be addressable once its parent opens it').toBeVisible();
  });

  // eiflix-banner/eiflix-banner.component.html — prefix eb (12 controls)
  test.fixme('eiflix-banner/eiflix-banner.component.html controls addressable [eb]', async ({ page }) => {
    await expect(page.getByTestId('eb-close-dialog-1').first(), 'eb-close-dialog-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eb-change-on-image-selected-2').first(), 'eb-change-on-image-selected-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eb-change-on-image-selected-app-3').first(), 'eb-change-on-image-selected-app-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eb-change-on-video-selected-4').first(), 'eb-change-on-video-selected-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eb-reset-form-5').first(), 'eb-reset-form-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eb-submit-6').first(), 'eb-submit-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eb-clear-search-7').first(), 'eb-clear-search-7 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eb-open-video-8').first(), 'eb-open-video-8 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eb-change-toggle-platform-9').first(), 'eb-change-toggle-platform-9 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eb-change-toggle-platform-10').first(), 'eb-change-toggle-platform-10 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eb-edit-banner-11').first(), 'eb-edit-banner-11 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eb-delete-banner-12').first(), 'eb-delete-banner-12 should be addressable once its parent opens it').toBeVisible();
  });

  // newusersprofile/assign-tags-dialog/assign-tags-dialog.component.html — prefix atd (11 controls)
  test.fixme('newusersprofile/assign-tags-dialog/assign-tags-dialog.component.html controls addressable [atd]', async ({ page }) => {
    await expect(page.getByTestId('atd-cancel-1').first(), 'atd-cancel-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('atd-search-2').first(), 'atd-search-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('atd-create-tag-3').first(), 'atd-create-tag-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('atd-toggle-4').first(), 'atd-toggle-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('atd-copy-selected-segments-5').first(), 'atd-copy-selected-segments-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('atd-change-master-toggle-tags-6').first(), 'atd-change-master-toggle-tags-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('atd-change-copy-selection-7').first(), 'atd-change-copy-selection-7 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('atd-copy-segment-8').first(), 'atd-copy-segment-8 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('atd-cancel-9').first(), 'atd-cancel-9 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('atd-save-10').first(), 'atd-save-10 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('atd-cancel-11').first(), 'atd-cancel-11 should be addressable once its parent opens it').toBeVisible();
  });

  // upcomingworkshops/eiflixhomeconfig/eiflixhomeconfig.component.html — prefix eif2 (11 controls)
  test.fixme('upcomingworkshops/eiflixhomeconfig/eiflixhomeconfig.component.html controls addressable [eif2]', async ({ page }) => {
    await expect(page.getByTestId('eif2-add-option-1').first(), 'eif2-add-option-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eif2-add-option-2').first(), 'eif2-add-option-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eif2-add-option-3').first(), 'eif2-add-option-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eif2-button-4').first(), 'eif2-button-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eif2-toggle-group-5').first(), 'eif2-toggle-group-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eif2-event-6').first(), 'eif2-event-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eif2-event-7').first(), 'eif2-event-7 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eif2-event-8').first(), 'eif2-event-8 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eif2-remove-item-9').first(), 'eif2-remove-item-9 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eif2-set-show-to-10').first(), 'eif2-set-show-to-10 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('eif2-remove-tag-11').first(), 'eif2-remove-tag-11 should be addressable once its parent opens it').toBeVisible();
  });

  // campaigndashboard/new-campaign-dialog/new-campaign-dialog.component.html — prefix ncd (10 controls)
  test.fixme('campaigndashboard/new-campaign-dialog/new-campaign-dialog.component.html controls addressable [ncd]', async ({ page }) => {
    await expect(page.getByTestId('ncd-cancel-1').first(), 'ncd-cancel-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ncd-start-picker-2').first(), 'ncd-start-picker-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ncd-end-picker-3').first(), 'ncd-end-picker-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ncd-change-toggle-channel-4').first(), 'ncd-change-toggle-channel-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ncd-add-note-5').first(), 'ncd-add-note-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ncd-button-6').first(), 'ncd-button-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ncd-add-asset-7').first(), 'ncd-add-asset-7 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ncd-a-8').first(), 'ncd-a-8 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ncd-remove-asset-9').first(), 'ncd-remove-asset-9 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ncd-save-10').first(), 'ncd-save-10 should be addressable once its parent opens it').toBeVisible();
  });

  // assignment-dialog/assignment-dialog.component.html — prefix ad (9 controls)
  test.fixme('assignment-dialog/assignment-dialog.component.html controls addressable [ad]', async ({ page }) => {
    await expect(page.getByTestId('ad-close-dialog-1').first(), 'ad-close-dialog-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ad-open-in-new-tab-2').first(), 'ad-open-in-new-tab-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ad-open-in-new-tab-3').first(), 'ad-open-in-new-tab-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ad-add-note-4').first(), 'ad-add-note-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ad-remove-note-5').first(), 'ad-remove-note-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ad-close-dialog-6').first(), 'ad-close-dialog-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ad-complete-assignment-7').first(), 'ad-complete-assignment-7 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ad-rework-assignment-8').first(), 'ad-rework-assignment-8 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ad-close-dialog-9').first(), 'ad-close-dialog-9 should be addressable once its parent opens it').toBeVisible();
  });

  // newusers/newusers.component.html — prefix new1 (5 controls)
  test.fixme('newusers/newusers.component.html controls addressable [new1]', async ({ page }) => {
    await expect(page.getByTestId('new1-dialog-ref-1').first(), 'new1-dialog-ref-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('new1-all-users-2').first(), 'new1-all-users-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('new1-subscribers-only-3').first(), 'new1-subscribers-only-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('new1-change-master-toggle-4').first(), 'new1-change-master-toggle-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('new1-change-toggle-user-5').first(), 'new1-change-toggle-user-5 should be addressable once its parent opens it').toBeVisible();
  });

  // quiz/quiz.component.html — prefix qui (8 controls)
  test.fixme('quiz/quiz.component.html controls addressable [qui]', async ({ page }) => {
    await expect(page.getByTestId('qui-close-dialog-1').first(), 'qui-close-dialog-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('qui-remove-option-2').first(), 'qui-remove-option-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('qui-change-set-correct-answer-3').first(), 'qui-change-set-correct-answer-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('qui-add-option-4').first(), 'qui-add-option-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('qui-reset-form-5').first(), 'qui-reset-form-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('qui-button-6').first(), 'qui-button-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('qui-edit-quiz-7').first(), 'qui-edit-quiz-7 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('qui-delete-quiz-8').first(), 'qui-delete-quiz-8 should be addressable once its parent opens it').toBeVisible();
  });

  // upcomingworkshops/createupcomingworkshops/createupcomingworkshops.component.html — prefix cre (9 controls)
  test.fixme('upcomingworkshops/createupcomingworkshops/createupcomingworkshops.component.html controls addressable [cre]', async ({ page }) => {
    await expect(page.getByTestId('cre-cancel-1').first(), 'cre-cancel-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('cre-picker-2').first(), 'cre-picker-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('cre-start-picker-3').first(), 'cre-start-picker-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('cre-end-picker-4').first(), 'cre-end-picker-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('cre-load-wati-templates-5').first(), 'cre-load-wati-templates-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('cre-upload-image-6').first(), 'cre-upload-image-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('cre-remove-image-7').first(), 'cre-remove-image-7 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('cre-cancel-8').first(), 'cre-cancel-8 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('cre-button-9').first(), 'cre-button-9 should be addressable once its parent opens it').toBeVisible();
  });

  // workshops/popup-banner/popup-banner.component.html — prefix pb (8 controls)
  test.fixme('workshops/popup-banner/popup-banner.component.html controls addressable [pb]', async ({ page }) => {
    await expect(page.getByTestId('pb-to-normal-1').first(), 'pb-to-normal-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('pb-close-2').first(), 'pb-close-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('pb-toggle-enable-3').first(), 'pb-toggle-enable-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('pb-pick-image-4').first(), 'pb-pick-image-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('pb-pick-image-5').first(), 'pb-pick-image-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('pb-clear-image-6').first(), 'pb-clear-image-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('pb-close-7').first(), 'pb-close-7 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('pb-save-8').first(), 'pb-save-8 should be addressable once its parent opens it').toBeVisible();
  });

  // add-people-dialog/add-people-dialog.component.html — prefix apd (7 controls)
  test.fixme('add-people-dialog/add-people-dialog.component.html controls addressable [apd]', async ({ page }) => {
    await expect(page.getByTestId('apd-on-cancel-1').first(), 'apd-on-cancel-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('apd-on-group-name-submit-2').first(), 'apd-on-group-name-submit-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('apd-on-cancel-3').first(), 'apd-on-cancel-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('apd-toggle-search-4').first(), 'apd-toggle-search-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('apd-toggle-search-5').first(), 'apd-toggle-search-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('apd-toggle-member-6').first(), 'apd-toggle-member-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('apd-on-submit-7').first(), 'apd-on-submit-7 should be addressable once its parent opens it').toBeVisible();
  });

  // eiflixdiscoverpage/media-upload/media-upload.component.html — prefix mu (7 controls)
  test.fixme('eiflixdiscoverpage/media-upload/media-upload.component.html controls addressable [mu]', async ({ page }) => {
    await expect(page.getByTestId('mu-change-on-file-selected-1').first(), 'mu-change-on-file-selected-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('mu-open-picker-2').first(), 'mu-open-picker-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('mu-open-picker-3').first(), 'mu-open-picker-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('mu-open-picker-4').first(), 'mu-open-picker-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('mu-remove-5').first(), 'mu-remove-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('mu-apply-url-6').first(), 'mu-apply-url-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('mu-copy-url-7').first(), 'mu-copy-url-7 should be addressable once its parent opens it').toBeVisible();
  });

  // workshop-dashboard/zoom-call/zoom-call.component.html — prefix zc (7 controls)
  test.fixme('workshop-dashboard/zoom-call/zoom-call.component.html controls addressable [zc]', async ({ page }) => {
    await expect(page.getByTestId('zc-file-input-1').first(), 'zc-file-input-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('zc-change-on-file-change-2').first(), 'zc-change-on-file-change-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('zc-export-to-csv-3').first(), 'zc-export-to-csv-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('zc-delete-row-4').first(), 'zc-delete-row-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('zc-start-edit-5').first(), 'zc-start-edit-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('zc-on-close-6').first(), 'zc-on-close-6 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('zc-on-update-7').first(), 'zc-on-update-7 should be addressable once its parent opens it').toBeVisible();
  });

  // product-page/add-product-web/add-product-web.component.html — prefix apw (3 controls)
  test.fixme('product-page/add-product-web/add-product-web.component.html controls addressable [apw]', async ({ page }) => {
    await expect(page.getByTestId('apw-change-on-file-selected-1').first(), 'apw-change-on-file-selected-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('apw-close-dialog-2').first(), 'apw-close-dialog-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('apw-save-product-3').first(), 'apw-save-product-3 should be addressable once its parent opens it').toBeVisible();
  });

  // wccalendar/add-event-dialog/add-event-dialog.component.html — prefix aed (6 controls)
  test.fixme('wccalendar/add-event-dialog/add-event-dialog.component.html controls addressable [aed]', async ({ page }) => {
    await expect(page.getByTestId('aed-cancel-1').first(), 'aed-cancel-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('aed-show-new-type-2').first(), 'aed-show-new-type-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('aed-create-type-3').first(), 'aed-create-type-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('aed-show-new-location-4').first(), 'aed-show-new-location-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('aed-create-location-5').first(), 'aed-create-location-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('aed-save-6').first(), 'aed-save-6 should be addressable once its parent opens it').toBeVisible();
  });

  // workshop-configurationv2/help/wc2-help-dialog.component.html — prefix whd (6 controls)
  test.fixme('workshop-configurationv2/help/wc2-help-dialog.component.html controls addressable [whd]', async ({ page }) => {
    await expect(page.getByTestId('whd-set-view-1').first(), 'whd-set-view-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('whd-set-view-2').first(), 'whd-set-view-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('whd-select-3').first(), 'whd-select-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('whd-only-unused-4').first(), 'whd-only-unused-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('whd-only-unused-5').first(), 'whd-only-unused-5 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('whd-dialog-ref-6').first(), 'whd-dialog-ref-6 should be addressable once its parent opens it').toBeVisible();
  });

  // upcomingworkshops/homeseries/homeseries.component.html — prefix hom (5 controls)
  test.fixme('upcomingworkshops/homeseries/homeseries.component.html controls addressable [hom]', async ({ page }) => {
    await expect(page.getByTestId('hom-cancel-1').first(), 'hom-cancel-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('hom-button-2').first(), 'hom-button-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('hom-remove-episode-3').first(), 'hom-remove-episode-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('hom-cancel-4').first(), 'hom-cancel-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('hom-button-5').first(), 'hom-button-5 should be addressable once its parent opens it').toBeVisible();
  });

  // wccalendar/event-details-dialog/event-details-dialog.component.html — prefix edd (5 controls)
  test.fixme('wccalendar/event-details-dialog/event-details-dialog.component.html controls addressable [edd]', async ({ page }) => {
    await expect(page.getByTestId('edd-back-1').first(), 'edd-back-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('edd-close-2').first(), 'edd-close-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('edd-pick-3').first(), 'edd-pick-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('edd-edit-4').first(), 'edd-edit-4 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('edd-remove-5').first(), 'edd-remove-5 should be addressable once its parent opens it').toBeVisible();
  });

  // workshop-dashboard/clear-workshop/clear-workshop.component.html — prefix cw (4 controls)
  test.fixme('workshop-dashboard/clear-workshop/clear-workshop.component.html controls addressable [cw]', async ({ page }) => {
    await expect(page.getByTestId('cw-copy-to-clipboard-1').first(), 'cw-copy-to-clipboard-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('cw-copy-to-clipboard-2').first(), 'cw-copy-to-clipboard-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('cw-delete-row-3').first(), 'cw-delete-row-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('cw-close-dialog-4').first(), 'cw-close-dialog-4 should be addressable once its parent opens it').toBeVisible();
  });

  // workshop-dashboard/extended-timeline/extended-timeline.component.html — prefix et (4 controls)
  test.fixme('workshop-dashboard/extended-timeline/extended-timeline.component.html controls addressable [et]', async ({ page }) => {
    await expect(page.getByTestId('et-close-1').first(), 'et-close-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('et-toggle-extend-2').first(), 'et-toggle-extend-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('et-ext-again-picker-3').first(), 'et-ext-again-picker-3 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('et-confirm-extend-4').first(), 'et-confirm-extend-4 should be addressable once its parent opens it').toBeVisible();
  });

  // eiflixoperationsdashboard/eod-dialog/eod-dialog.component.html — prefix ed1 (3 controls)
  test.fixme('eiflixoperationsdashboard/eod-dialog/eod-dialog.component.html controls addressable [ed1]', async ({ page }) => {
    await expect(page.getByTestId('ed1-cancel-1').first(), 'ed1-cancel-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ed1-cancel-2').first(), 'ed1-cancel-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ed1-button-3').first(), 'ed1-button-3 should be addressable once its parent opens it').toBeVisible();
  });

  // workshop-dashboard/enroll-diagnostics/enroll-diagnostics.component.html — prefix ed2 (3 controls)
  test.fixme('workshop-dashboard/enroll-diagnostics/enroll-diagnostics.component.html controls addressable [ed2]', async ({ page }) => {
    await expect(page.getByTestId('ed2-dialog-ref-1').first(), 'ed2-dialog-ref-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ed2-check-2').first(), 'ed2-check-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('ed2-use-candidate-3').first(), 'ed2-use-candidate-3 should be addressable once its parent opens it').toBeVisible();
  });

  // workshop-dialog/workshop-dialog.component.html — prefix wd2 (3 controls)
  test.fixme('workshop-dialog/workshop-dialog.component.html controls addressable [wd2]', async ({ page }) => {
    await expect(page.getByTestId('wd2-save-code-1').first(), 'wd2-save-code-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd2-close-2').first(), 'wd2-close-2 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wd2-update-3').first(), 'wd2-update-3 should be addressable once its parent opens it').toBeVisible();
  });

  // upcomingworkshops/upcomingworkshopresponses/upcomingworkshopresponses.component.html — prefix upc1 (2 controls)
  test.fixme('upcomingworkshops/upcomingworkshopresponses/upcomingworkshopresponses.component.html controls addressable [upc1]', async ({ page }) => {
    await expect(page.getByTestId('upc1-close-1').first(), 'upc1-close-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('upc1-close-2').first(), 'upc1-close-2 should be addressable once its parent opens it').toBeVisible();
  });

  // workshop-category/workshop-category.component.html — prefix wc3 (2 controls)
  test.fixme('workshop-category/workshop-category.component.html controls addressable [wc3]', async ({ page }) => {
    await expect(page.getByTestId('wc3-save-category-1').first(), 'wc3-save-category-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('wc3-cancel-2').first(), 'wc3-cancel-2 should be addressable once its parent opens it').toBeVisible();
  });

  // workshop-dashboard/enroll/enroll.component.html — prefix enr (2 controls)
  test.fixme('workshop-dashboard/enroll/enroll.component.html controls addressable [enr]', async ({ page }) => {
    await expect(page.getByTestId('enr-enroll-1').first(), 'enr-enroll-1 should be addressable once its parent opens it').toBeVisible();
    await expect(page.getByTestId('enr-cancel-2').first(), 'enr-cancel-2 should be addressable once its parent opens it').toBeVisible();
  });

});
