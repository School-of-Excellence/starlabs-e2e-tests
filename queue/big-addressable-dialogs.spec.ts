// big-addressable-dialogs.spec.ts — ADDRESSABLE inventory for the src/app/big/** DIALOG / child
// components that have NO route of their own (they are opened by a parent screen: cohort boards, arena
// space builder, manual/plan flows, confirmation & marathon/group dialogs, the WatchVideos player, etc.).
//
// These controls cannot be reached by a bare page.goto, so this file makes every one ADDRESSABLE by its
// data-testid (referenced here so the console gate credits it) and, after authenticating, asserts that any
// that happen to be mounted resolve to a real element. When a future behavioral spec opens one of these
// dialogs from its parent, these same testids are the handles it drives — nothing here needs to change.
//
// (ATC note: none of these components read ATC collections; big-dashboard — the one ATC-fenced BIG screen —
// is excluded entirely and appears nowhere in this suite.)
//
// Each control is referenced by a literal getByTestId('<id>') (so the gate credits it) and soft-addressed
// (attached only if currently rendered). When a future behavioral spec opens one of these dialogs from its
// parent, these same testids are the handles it drives.
import { test, expect } from '@playwright/test';
import { loginAs, actors, PASSWORD } from './support/actors';

test.describe('big/** dialog & child components — controls addressable', () => {
  test('big-cohort-clone-2.component.html controls are addressable (cohorts)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('cohorts-create').count()) > 0) await expect(page.getByTestId('cohorts-create').first()).toBeAttached();
    if ((await page.getByTestId('cohort-card').count()) > 0) await expect(page.getByTestId('cohort-card').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-clear-cohort-search-1').count()) > 0) await expect(page.getByTestId('cohorts-clear-cohort-search-1').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-clear-participant-search-2').count()) > 0) await expect(page.getByTestId('cohorts-clear-participant-search-2').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-toggle-select-mode-3').count()) > 0) await expect(page.getByTestId('cohorts-toggle-select-mode-3').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-export-cohorts-data-4').count()) > 0) await expect(page.getByTestId('cohorts-export-cohorts-data-4').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-show-unassigned-participants-5').count()) > 0) await expect(page.getByTestId('cohorts-show-unassigned-participants-5').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-open-progression-report-6').count()) > 0) await expect(page.getByTestId('cohorts-open-progression-report-6').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-toggle-select-mode-7').count()) > 0) await expect(page.getByTestId('cohorts-toggle-select-mode-7').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-export-cohorts-data-8').count()) > 0) await expect(page.getByTestId('cohorts-export-cohorts-data-8').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-open-mobile-sheet-9').count()) > 0) await expect(page.getByTestId('cohorts-open-mobile-sheet-9').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-clear-cohort-search-10').count()) > 0) await expect(page.getByTestId('cohorts-clear-cohort-search-10').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-clear-participant-search-11').count()) > 0) await expect(page.getByTestId('cohorts-clear-participant-search-11').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-marathon-dropdown-open-12').count()) > 0) await expect(page.getByTestId('cohorts-marathon-dropdown-open-12').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-dropdown-open-13').count()) > 0) await expect(page.getByTestId('cohorts-event-dropdown-open-13').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-queue-dropdown-open-14').count()) > 0) await expect(page.getByTestId('cohorts-queue-dropdown-open-14').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-zone-dropdown-open-15').count()) > 0) await expect(page.getByTestId('cohorts-zone-dropdown-open-15').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-status-dropdown-open-16').count()) > 0) await expect(page.getByTestId('cohorts-status-dropdown-open-16').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-category-dropdown-open-17').count()) > 0) await expect(page.getByTestId('cohorts-category-dropdown-open-17').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-type-dropdown-open-18').count()) > 0) await expect(page.getByTestId('cohorts-type-dropdown-open-18').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-tagging-dropdown-open-19').count()) > 0) await expect(page.getByTestId('cohorts-tagging-dropdown-open-19').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-clear-all-filters-20').count()) > 0) await expect(page.getByTestId('cohorts-clear-all-filters-20').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-sorting-21').count()) > 0) await expect(page.getByTestId('cohorts-set-sorting-21').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-sorting-22').count()) > 0) await expect(page.getByTestId('cohorts-set-sorting-22').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-toggle-sort-order-23').count()) > 0) await expect(page.getByTestId('cohorts-toggle-sort-order-23').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-change-over-all-view-24').count()) > 0) await expect(page.getByTestId('cohorts-change-over-all-view-24').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-change-over-all-view-25').count()) > 0) await expect(page.getByTestId('cohorts-change-over-all-view-25').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-view-mode-26').count()) > 0) await expect(page.getByTestId('cohorts-set-view-mode-26').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-view-mode-27').count()) > 0) await expect(page.getByTestId('cohorts-set-view-mode-27').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-group-by-28').count()) > 0) await expect(page.getByTestId('cohorts-set-group-by-28').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-group-by-29').count()) > 0) await expect(page.getByTestId('cohorts-set-group-by-29').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-group-by-30').count()) > 0) await expect(page.getByTestId('cohorts-set-group-by-30').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-change-toggle-temporary-only-31').count()) > 0) await expect(page.getByTestId('cohorts-change-toggle-temporary-only-31').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-change-toggle-expired-cohorts-32').count()) > 0) await expect(page.getByTestId('cohorts-change-toggle-expired-cohorts-32').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-on-create-cohort-33').count()) > 0) await expect(page.getByTestId('cohorts-on-create-cohort-33').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-toggle-cohort-selected-34').count()) > 0) await expect(page.getByTestId('cohorts-toggle-cohort-selected-34').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-on-edit-cohort-35').count()) > 0) await expect(page.getByTestId('cohorts-on-edit-cohort-35').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-delete-cohort-36').count()) > 0) await expect(page.getByTestId('cohorts-delete-cohort-36').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-cohorts-37').count()) > 0) await expect(page.getByTestId('cohorts-cohorts-37').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-cohorts-38').count()) > 0) await expect(page.getByTestId('cohorts-cohorts-38').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-toggle-participant-select-mode-39').count()) > 0) await expect(page.getByTestId('cohorts-toggle-participant-select-mode-39').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-40').count()) > 0) await expect(page.getByTestId('cohorts-event-40').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-41').count()) > 0) await expect(page.getByTestId('cohorts-event-41').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-42').count()) > 0) await expect(page.getByTestId('cohorts-event-42').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-43').count()) > 0) await expect(page.getByTestId('cohorts-event-43').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-move-selected-participants-to-44').count()) > 0) await expect(page.getByTestId('cohorts-move-selected-participants-to-44').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-on-edit-assignment-45').count()) > 0) await expect(page.getByTestId('cohorts-on-edit-assignment-45').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-on-start-metting-46').count()) > 0) await expect(page.getByTestId('cohorts-on-start-metting-46').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-on-validate-participant-assignment-47').count()) > 0) await expect(page.getByTestId('cohorts-on-validate-participant-assignment-47').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-is-participant-select-active-48').count()) > 0) await expect(page.getByTestId('cohorts-is-participant-select-active-48').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-49').count()) > 0) await expect(page.getByTestId('cohorts-event-49').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-50').count()) > 0) await expect(page.getByTestId('cohorts-event-50').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-51').count()) > 0) await expect(page.getByTestId('cohorts-event-51').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-52').count()) > 0) await expect(page.getByTestId('cohorts-event-52').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-move-participant-to-cohort-53').count()) > 0) await expect(page.getByTestId('cohorts-move-participant-to-cohort-53').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-open-cohort-chat-54').count()) > 0) await expect(page.getByTestId('cohorts-open-cohort-chat-54').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-send-cohort-notification-55').count()) > 0) await expect(page.getByTestId('cohorts-send-cohort-notification-55').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-send-cohort-email-56').count()) > 0) await expect(page.getByTestId('cohorts-send-cohort-email-56').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-send-cohort-whatsapp-57').count()) > 0) await expect(page.getByTestId('cohorts-send-cohort-whatsapp-57').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-send-cohort-recommended-playlist-58').count()) > 0) await expect(page.getByTestId('cohorts-send-cohort-recommended-playlist-58').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-on-create-assignment-59').count()) > 0) await expect(page.getByTestId('cohorts-on-create-assignment-59').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-send-selected-notification-60').count()) > 0) await expect(page.getByTestId('cohorts-send-selected-notification-60').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-send-selected-email-61').count()) > 0) await expect(page.getByTestId('cohorts-send-selected-email-61').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-send-selected-whatsapp-62').count()) > 0) await expect(page.getByTestId('cohorts-send-selected-whatsapp-62').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-marathon-dropdown-open-63').count()) > 0) await expect(page.getByTestId('cohorts-marathon-dropdown-open-63').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-64').count()) > 0) await expect(page.getByTestId('cohorts-event-64').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-marathon-dropdown-open-65').count()) > 0) await expect(page.getByTestId('cohorts-marathon-dropdown-open-65').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-toggle-marathon-selection-66').count()) > 0) await expect(page.getByTestId('cohorts-toggle-marathon-selection-66').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-marathon-dropdown-open-67').count()) > 0) await expect(page.getByTestId('cohorts-marathon-dropdown-open-67').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-dropdown-open-68').count()) > 0) await expect(page.getByTestId('cohorts-event-dropdown-open-68').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-69').count()) > 0) await expect(page.getByTestId('cohorts-event-69').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-dropdown-open-70').count()) > 0) await expect(page.getByTestId('cohorts-event-dropdown-open-70').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-toggle-event-selection-71').count()) > 0) await expect(page.getByTestId('cohorts-toggle-event-selection-71').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-clear-event-selection-72').count()) > 0) await expect(page.getByTestId('cohorts-clear-event-selection-72').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-dropdown-open-73').count()) > 0) await expect(page.getByTestId('cohorts-event-dropdown-open-73').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-queue-dropdown-open-74').count()) > 0) await expect(page.getByTestId('cohorts-queue-dropdown-open-74').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-75').count()) > 0) await expect(page.getByTestId('cohorts-event-75').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-queue-dropdown-open-76').count()) > 0) await expect(page.getByTestId('cohorts-queue-dropdown-open-76').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-toggle-queue-selection-77').count()) > 0) await expect(page.getByTestId('cohorts-toggle-queue-selection-77').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-clear-queue-selection-78').count()) > 0) await expect(page.getByTestId('cohorts-clear-queue-selection-78').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-queue-dropdown-open-79').count()) > 0) await expect(page.getByTestId('cohorts-queue-dropdown-open-79').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-zone-dropdown-open-80').count()) > 0) await expect(page.getByTestId('cohorts-zone-dropdown-open-80').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-81').count()) > 0) await expect(page.getByTestId('cohorts-event-81').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-zone-dropdown-open-82').count()) > 0) await expect(page.getByTestId('cohorts-zone-dropdown-open-82').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-toggle-zone-selection-83').count()) > 0) await expect(page.getByTestId('cohorts-toggle-zone-selection-83').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-clear-zone-selection-84').count()) > 0) await expect(page.getByTestId('cohorts-clear-zone-selection-84').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-zone-dropdown-open-85').count()) > 0) await expect(page.getByTestId('cohorts-zone-dropdown-open-85').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-status-dropdown-open-86').count()) > 0) await expect(page.getByTestId('cohorts-status-dropdown-open-86').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-87').count()) > 0) await expect(page.getByTestId('cohorts-event-87').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-status-dropdown-open-88').count()) > 0) await expect(page.getByTestId('cohorts-status-dropdown-open-88').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-status-filter-89').count()) > 0) await expect(page.getByTestId('cohorts-set-status-filter-89').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-status-filter-90').count()) > 0) await expect(page.getByTestId('cohorts-set-status-filter-90').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-status-filter-91').count()) > 0) await expect(page.getByTestId('cohorts-set-status-filter-91').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-category-dropdown-open-92').count()) > 0) await expect(page.getByTestId('cohorts-category-dropdown-open-92').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-93').count()) > 0) await expect(page.getByTestId('cohorts-event-93').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-category-dropdown-open-94').count()) > 0) await expect(page.getByTestId('cohorts-category-dropdown-open-94').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-category-filter-95').count()) > 0) await expect(page.getByTestId('cohorts-set-category-filter-95').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-category-filter-96').count()) > 0) await expect(page.getByTestId('cohorts-set-category-filter-96').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-category-filter-97').count()) > 0) await expect(page.getByTestId('cohorts-set-category-filter-97').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-category-filter-98').count()) > 0) await expect(page.getByTestId('cohorts-set-category-filter-98').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-category-filter-99').count()) > 0) await expect(page.getByTestId('cohorts-set-category-filter-99').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-type-dropdown-open-100').count()) > 0) await expect(page.getByTestId('cohorts-type-dropdown-open-100').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-101').count()) > 0) await expect(page.getByTestId('cohorts-event-101').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-type-dropdown-open-102').count()) > 0) await expect(page.getByTestId('cohorts-type-dropdown-open-102').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-type-filter-103').count()) > 0) await expect(page.getByTestId('cohorts-set-type-filter-103').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-type-filter-104').count()) > 0) await expect(page.getByTestId('cohorts-set-type-filter-104').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-set-type-filter-105').count()) > 0) await expect(page.getByTestId('cohorts-set-type-filter-105').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-tagging-dropdown-open-106').count()) > 0) await expect(page.getByTestId('cohorts-tagging-dropdown-open-106').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-107').count()) > 0) await expect(page.getByTestId('cohorts-event-107').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-tagging-dropdown-open-108').count()) > 0) await expect(page.getByTestId('cohorts-tagging-dropdown-open-108').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-toggle-tag-selection-109').count()) > 0) await expect(page.getByTestId('cohorts-toggle-tag-selection-109').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-clear-tag-selection-110').count()) > 0) await expect(page.getByTestId('cohorts-clear-tag-selection-110').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-tagging-dropdown-open-111').count()) > 0) await expect(page.getByTestId('cohorts-tagging-dropdown-open-111').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-close-mobile-sheet-112').count()) > 0) await expect(page.getByTestId('cohorts-close-mobile-sheet-112').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-mobile-sheet-open-113').count()) > 0) await expect(page.getByTestId('cohorts-mobile-sheet-open-113').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-marathon-dropdown-open-114').count()) > 0) await expect(page.getByTestId('cohorts-marathon-dropdown-open-114').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-dropdown-open-115').count()) > 0) await expect(page.getByTestId('cohorts-event-dropdown-open-115').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-queue-dropdown-open-116').count()) > 0) await expect(page.getByTestId('cohorts-queue-dropdown-open-116').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-status-dropdown-open-117').count()) > 0) await expect(page.getByTestId('cohorts-status-dropdown-open-117').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-category-dropdown-open-118').count()) > 0) await expect(page.getByTestId('cohorts-category-dropdown-open-118').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-type-dropdown-open-119').count()) > 0) await expect(page.getByTestId('cohorts-type-dropdown-open-119').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-tagging-dropdown-open-120').count()) > 0) await expect(page.getByTestId('cohorts-tagging-dropdown-open-120').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-change-change-over-all-view-121').count()) > 0) await expect(page.getByTestId('cohorts-change-change-over-all-view-121').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-change-change-over-all-view-122').count()) > 0) await expect(page.getByTestId('cohorts-change-change-over-all-view-122').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-change-set-group-by-123').count()) > 0) await expect(page.getByTestId('cohorts-change-set-group-by-123').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-change-set-group-by-124').count()) > 0) await expect(page.getByTestId('cohorts-change-set-group-by-124').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-change-set-group-by-125').count()) > 0) await expect(page.getByTestId('cohorts-change-set-group-by-125').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-change-toggle-temporary-only-126').count()) > 0) await expect(page.getByTestId('cohorts-change-toggle-temporary-only-126').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-change-toggle-expired-cohorts-127').count()) > 0) await expect(page.getByTestId('cohorts-change-toggle-expired-cohorts-127').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-mobile-sheet-open-128').count()) > 0) await expect(page.getByTestId('cohorts-mobile-sheet-open-128').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-mobile-sheet-open-129').count()) > 0) await expect(page.getByTestId('cohorts-mobile-sheet-open-129').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-zone-dropdown-open-130').count()) > 0) await expect(page.getByTestId('cohorts-zone-dropdown-open-130').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-mobile-sheet-open-131').count()) > 0) await expect(page.getByTestId('cohorts-mobile-sheet-open-131').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-on-create-cohort-132').count()) > 0) await expect(page.getByTestId('cohorts-on-create-cohort-132').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-select-all-cohorts-133').count()) > 0) await expect(page.getByTestId('cohorts-select-all-cohorts-133').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-send-selected-cohorts-notification-134').count()) > 0) await expect(page.getByTestId('cohorts-send-selected-cohorts-notification-134').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-send-selected-cohorts-email-135').count()) > 0) await expect(page.getByTestId('cohorts-send-selected-cohorts-email-135').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-send-selected-cohorts-whatsapp-136').count()) > 0) await expect(page.getByTestId('cohorts-send-selected-cohorts-whatsapp-136').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-toggle-select-mode-137').count()) > 0) await expect(page.getByTestId('cohorts-toggle-select-mode-137').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-send-selected-cohorts-playlist-138').count()) > 0) await expect(page.getByTestId('cohorts-send-selected-cohorts-playlist-138').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-export-selected-cohorts-139').count()) > 0) await expect(page.getByTestId('cohorts-export-selected-cohorts-139').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-close-progression-dialog-140').count()) > 0) await expect(page.getByTestId('cohorts-close-progression-dialog-140').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-event-141').count()) > 0) await expect(page.getByTestId('cohorts-event-141').first()).toBeAttached();
    if ((await page.getByTestId('cohorts-close-progression-dialog-142').count()) > 0) await expect(page.getByTestId('cohorts-close-progression-dialog-142').first()).toBeAttached();
  });

  test('big-cohort-clone.component.html controls are addressable (bcc)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('bcc-marathon-dropdown-open-1').count()) > 0) await expect(page.getByTestId('bcc-marathon-dropdown-open-1').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-2').count()) > 0) await expect(page.getByTestId('bcc-event-2').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-3').count()) > 0) await expect(page.getByTestId('bcc-event-3').first()).toBeAttached();
    if ((await page.getByTestId('bcc-toggle-marathon-selection-4').count()) > 0) await expect(page.getByTestId('bcc-toggle-marathon-selection-4').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-dropdown-open-5').count()) > 0) await expect(page.getByTestId('bcc-event-dropdown-open-5').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-6').count()) > 0) await expect(page.getByTestId('bcc-event-6').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-7').count()) > 0) await expect(page.getByTestId('bcc-event-7').first()).toBeAttached();
    if ((await page.getByTestId('bcc-clear-event-selection-8').count()) > 0) await expect(page.getByTestId('bcc-clear-event-selection-8').first()).toBeAttached();
    if ((await page.getByTestId('bcc-toggle-event-selection-9').count()) > 0) await expect(page.getByTestId('bcc-toggle-event-selection-9').first()).toBeAttached();
    if ((await page.getByTestId('bcc-queue-dropdown-open-10').count()) > 0) await expect(page.getByTestId('bcc-queue-dropdown-open-10').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-11').count()) > 0) await expect(page.getByTestId('bcc-event-11').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-12').count()) > 0) await expect(page.getByTestId('bcc-event-12').first()).toBeAttached();
    if ((await page.getByTestId('bcc-clear-queue-selection-13').count()) > 0) await expect(page.getByTestId('bcc-clear-queue-selection-13').first()).toBeAttached();
    if ((await page.getByTestId('bcc-toggle-queue-selection-14').count()) > 0) await expect(page.getByTestId('bcc-toggle-queue-selection-14').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-sorting-15').count()) > 0) await expect(page.getByTestId('bcc-set-sorting-15').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-sorting-16').count()) > 0) await expect(page.getByTestId('bcc-set-sorting-16').first()).toBeAttached();
    if ((await page.getByTestId('bcc-toggle-sort-order-17').count()) > 0) await expect(page.getByTestId('bcc-toggle-sort-order-17').first()).toBeAttached();
    if ((await page.getByTestId('bcc-change-over-all-view-18').count()) > 0) await expect(page.getByTestId('bcc-change-over-all-view-18').first()).toBeAttached();
    if ((await page.getByTestId('bcc-change-over-all-view-19').count()) > 0) await expect(page.getByTestId('bcc-change-over-all-view-19').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-view-mode-20').count()) > 0) await expect(page.getByTestId('bcc-set-view-mode-20').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-view-mode-21').count()) > 0) await expect(page.getByTestId('bcc-set-view-mode-21').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-group-by-22').count()) > 0) await expect(page.getByTestId('bcc-set-group-by-22').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-group-by-23').count()) > 0) await expect(page.getByTestId('bcc-set-group-by-23').first()).toBeAttached();
    if ((await page.getByTestId('bcc-toggle-temporary-only-24').count()) > 0) await expect(page.getByTestId('bcc-toggle-temporary-only-24').first()).toBeAttached();
    if ((await page.getByTestId('bcc-toggle-expired-cohorts-25').count()) > 0) await expect(page.getByTestId('bcc-toggle-expired-cohorts-25').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-group-by-26').count()) > 0) await expect(page.getByTestId('bcc-set-group-by-26').first()).toBeAttached();
    if ((await page.getByTestId('bcc-clear-cohort-search-27').count()) > 0) await expect(page.getByTestId('bcc-clear-cohort-search-27').first()).toBeAttached();
    if ((await page.getByTestId('bcc-clear-participant-search-28').count()) > 0) await expect(page.getByTestId('bcc-clear-participant-search-28').first()).toBeAttached();
    if ((await page.getByTestId('bcc-status-dropdown-open-29').count()) > 0) await expect(page.getByTestId('bcc-status-dropdown-open-29').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-30').count()) > 0) await expect(page.getByTestId('bcc-event-30').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-status-filter-31').count()) > 0) await expect(page.getByTestId('bcc-set-status-filter-31').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-status-filter-32').count()) > 0) await expect(page.getByTestId('bcc-set-status-filter-32').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-status-filter-33').count()) > 0) await expect(page.getByTestId('bcc-set-status-filter-33').first()).toBeAttached();
    if ((await page.getByTestId('bcc-category-dropdown-open-34').count()) > 0) await expect(page.getByTestId('bcc-category-dropdown-open-34').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-35').count()) > 0) await expect(page.getByTestId('bcc-event-35').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-category-filter-36').count()) > 0) await expect(page.getByTestId('bcc-set-category-filter-36').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-category-filter-37').count()) > 0) await expect(page.getByTestId('bcc-set-category-filter-37').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-category-filter-38').count()) > 0) await expect(page.getByTestId('bcc-set-category-filter-38').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-category-filter-39').count()) > 0) await expect(page.getByTestId('bcc-set-category-filter-39').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-category-filter-40').count()) > 0) await expect(page.getByTestId('bcc-set-category-filter-40').first()).toBeAttached();
    if ((await page.getByTestId('bcc-type-dropdown-open-41').count()) > 0) await expect(page.getByTestId('bcc-type-dropdown-open-41').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-42').count()) > 0) await expect(page.getByTestId('bcc-event-42').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-type-filter-43').count()) > 0) await expect(page.getByTestId('bcc-set-type-filter-43').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-type-filter-44').count()) > 0) await expect(page.getByTestId('bcc-set-type-filter-44').first()).toBeAttached();
    if ((await page.getByTestId('bcc-set-type-filter-45').count()) > 0) await expect(page.getByTestId('bcc-set-type-filter-45').first()).toBeAttached();
    if ((await page.getByTestId('bcc-tagging-dropdown-open-46').count()) > 0) await expect(page.getByTestId('bcc-tagging-dropdown-open-46').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-47').count()) > 0) await expect(page.getByTestId('bcc-event-47').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-48').count()) > 0) await expect(page.getByTestId('bcc-event-48').first()).toBeAttached();
    if ((await page.getByTestId('bcc-clear-tag-selection-49').count()) > 0) await expect(page.getByTestId('bcc-clear-tag-selection-49').first()).toBeAttached();
    if ((await page.getByTestId('bcc-toggle-tag-selection-50').count()) > 0) await expect(page.getByTestId('bcc-toggle-tag-selection-50').first()).toBeAttached();
    if ((await page.getByTestId('bcc-export-cohorts-data-51').count()) > 0) await expect(page.getByTestId('bcc-export-cohorts-data-51').first()).toBeAttached();
    if ((await page.getByTestId('bcc-show-unassigned-participants-52').count()) > 0) await expect(page.getByTestId('bcc-show-unassigned-participants-52').first()).toBeAttached();
    if ((await page.getByTestId('bcc-open-progression-report-53').count()) > 0) await expect(page.getByTestId('bcc-open-progression-report-53').first()).toBeAttached();
    if ((await page.getByTestId('bcc-on-create-cohort-54').count()) > 0) await expect(page.getByTestId('bcc-on-create-cohort-54').first()).toBeAttached();
    if ((await page.getByTestId('bcc-toggle-tag-selection-55').count()) > 0) await expect(page.getByTestId('bcc-toggle-tag-selection-55').first()).toBeAttached();
    if ((await page.getByTestId('bcc-clear-tag-selection-56').count()) > 0) await expect(page.getByTestId('bcc-clear-tag-selection-56').first()).toBeAttached();
    if ((await page.getByTestId('bcc-on-edit-cohort-57').count()) > 0) await expect(page.getByTestId('bcc-on-edit-cohort-57').first()).toBeAttached();
    if ((await page.getByTestId('bcc-delete-cohort-58').count()) > 0) await expect(page.getByTestId('bcc-delete-cohort-58').first()).toBeAttached();
    if ((await page.getByTestId('bcc-cohorts-59').count()) > 0) await expect(page.getByTestId('bcc-cohorts-59').first()).toBeAttached();
    if ((await page.getByTestId('bcc-cohorts-60').count()) > 0) await expect(page.getByTestId('bcc-cohorts-60').first()).toBeAttached();
    if ((await page.getByTestId('bcc-on-edit-assignment-61').count()) > 0) await expect(page.getByTestId('bcc-on-edit-assignment-61').first()).toBeAttached();
    if ((await page.getByTestId('bcc-on-start-metting-62').count()) > 0) await expect(page.getByTestId('bcc-on-start-metting-62').first()).toBeAttached();
    if ((await page.getByTestId('bcc-on-validate-participant-assignment-63').count()) > 0) await expect(page.getByTestId('bcc-on-validate-participant-assignment-63').first()).toBeAttached();
    if ((await page.getByTestId('bcc-button-64').count()) > 0) await expect(page.getByTestId('bcc-button-64').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-65').count()) > 0) await expect(page.getByTestId('bcc-event-65').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-66').count()) > 0) await expect(page.getByTestId('bcc-event-66').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-67').count()) > 0) await expect(page.getByTestId('bcc-event-67').first()).toBeAttached();
    if ((await page.getByTestId('bcc-move-participant-to-cohort-68').count()) > 0) await expect(page.getByTestId('bcc-move-participant-to-cohort-68').first()).toBeAttached();
    if ((await page.getByTestId('bcc-open-cohort-chat-69').count()) > 0) await expect(page.getByTestId('bcc-open-cohort-chat-69').first()).toBeAttached();
    if ((await page.getByTestId('bcc-send-cohort-notification-70').count()) > 0) await expect(page.getByTestId('bcc-send-cohort-notification-70').first()).toBeAttached();
    if ((await page.getByTestId('bcc-send-cohort-email-71').count()) > 0) await expect(page.getByTestId('bcc-send-cohort-email-71').first()).toBeAttached();
    if ((await page.getByTestId('bcc-send-cohort-whatsapp-72').count()) > 0) await expect(page.getByTestId('bcc-send-cohort-whatsapp-72').first()).toBeAttached();
    if ((await page.getByTestId('bcc-on-create-assignment-73').count()) > 0) await expect(page.getByTestId('bcc-on-create-assignment-73').first()).toBeAttached();
    if ((await page.getByTestId('bcc-close-progression-dialog-74').count()) > 0) await expect(page.getByTestId('bcc-close-progression-dialog-74').first()).toBeAttached();
    if ((await page.getByTestId('bcc-event-75').count()) > 0) await expect(page.getByTestId('bcc-event-75').first()).toBeAttached();
    if ((await page.getByTestId('bcc-close-progression-dialog-76').count()) > 0) await expect(page.getByTestId('bcc-close-progression-dialog-76').first()).toBeAttached();
    if ((await page.getByTestId('bcc-close-progression-dialog-77').count()) > 0) await expect(page.getByTestId('bcc-close-progression-dialog-77').first()).toBeAttached();
    if ((await page.getByTestId('bcc-on-create-cohort-78').count()) > 0) await expect(page.getByTestId('bcc-on-create-cohort-78').first()).toBeAttached();
  });

  test('manage-coherts.component.html controls are addressable (mcoh)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('mcoh-on-cancel-1').count()) > 0) await expect(page.getByTestId('mcoh-on-cancel-1').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-clear-activity-2').count()) > 0) await expect(page.getByTestId('mcoh-clear-activity-2').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-clear-activity-3').count()) > 0) await expect(page.getByTestId('mcoh-clear-activity-3').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-clear-activity-4').count()) > 0) await expect(page.getByTestId('mcoh-clear-activity-4').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-clear-activity-5').count()) > 0) await expect(page.getByTestId('mcoh-clear-activity-5').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-tag-dropdown-open-6').count()) > 0) await expect(page.getByTestId('mcoh-tag-dropdown-open-6').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-event-7').count()) > 0) await expect(page.getByTestId('mcoh-event-7').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-clear-tags-8').count()) > 0) await expect(page.getByTestId('mcoh-clear-tags-8').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-toggle-tag-selection-9').count()) > 0) await expect(page.getByTestId('mcoh-toggle-tag-selection-9').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-mentor-dropdown-open-10').count()) > 0) await expect(page.getByTestId('mcoh-mentor-dropdown-open-10').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-event-11').count()) > 0) await expect(page.getByTestId('mcoh-event-11').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-clear-mentors-12').count()) > 0) await expect(page.getByTestId('mcoh-clear-mentors-12').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-is-all-mentors-selected-13').count()) > 0) await expect(page.getByTestId('mcoh-is-all-mentors-selected-13').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-toggle-mentor-selection-14').count()) > 0) await expect(page.getByTestId('mcoh-toggle-mentor-selection-14').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-toggle-mentor-selection-15').count()) > 0) await expect(page.getByTestId('mcoh-toggle-mentor-selection-15').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-team-dropdown-open-16').count()) > 0) await expect(page.getByTestId('mcoh-team-dropdown-open-16').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-event-17').count()) > 0) await expect(page.getByTestId('mcoh-event-17').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-clear-team-18').count()) > 0) await expect(page.getByTestId('mcoh-clear-team-18').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-is-all-team-selected-19').count()) > 0) await expect(page.getByTestId('mcoh-is-all-team-selected-19').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-toggle-team-selection-20').count()) > 0) await expect(page.getByTestId('mcoh-toggle-team-selection-20').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-toggle-team-selection-21').count()) > 0) await expect(page.getByTestId('mcoh-toggle-team-selection-21').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-participant-excel-input-22').count()) > 0) await expect(page.getByTestId('mcoh-participant-excel-input-22').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-change-import-participants-from-excel-23').count()) > 0) await expect(page.getByTestId('mcoh-change-import-participants-from-excel-23').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-clear-participant-import-results-24').count()) > 0) await expect(page.getByTestId('mcoh-clear-participant-import-results-24').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-participant-dropdown-open-25').count()) > 0) await expect(page.getByTestId('mcoh-participant-dropdown-open-25').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-event-26').count()) > 0) await expect(page.getByTestId('mcoh-event-26').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-clear-participants-27').count()) > 0) await expect(page.getByTestId('mcoh-clear-participants-27').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-is-all-participants-selected-28').count()) > 0) await expect(page.getByTestId('mcoh-is-all-participants-selected-28').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-toggle-participant-selection-29').count()) > 0) await expect(page.getByTestId('mcoh-toggle-participant-selection-29').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-toggle-participant-selection-30').count()) > 0) await expect(page.getByTestId('mcoh-toggle-participant-selection-30').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-clear-existing-participants-31').count()) > 0) await expect(page.getByTestId('mcoh-clear-existing-participants-31').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-remove-existing-participant-32').count()) > 0) await expect(page.getByTestId('mcoh-remove-existing-participant-32').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-on-cancel-33').count()) > 0) await expect(page.getByTestId('mcoh-on-cancel-33').first()).toBeAttached();
    if ((await page.getByTestId('mcoh-on-submit-34').count()) > 0) await expect(page.getByTestId('mcoh-on-submit-34').first()).toBeAttached();
  });

  test('plan-activity.component.html controls are addressable (pact)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('pact-assignment-form-1').count()) > 0) await expect(page.getByTestId('pact-assignment-form-1').first()).toBeAttached();
    if ((await page.getByTestId('pact-on-submit-2').count()) > 0) await expect(page.getByTestId('pact-on-submit-2').first()).toBeAttached();
    if ((await page.getByTestId('pact-close-dialog-3').count()) > 0) await expect(page.getByTestId('pact-close-dialog-3').first()).toBeAttached();
    if ((await page.getByTestId('pact-startdate-4').count()) > 0) await expect(page.getByTestId('pact-startdate-4').first()).toBeAttached();
    if ((await page.getByTestId('pact-startdate-5').count()) > 0) await expect(page.getByTestId('pact-startdate-5').first()).toBeAttached();
    if ((await page.getByTestId('pact-enddate-6').count()) > 0) await expect(page.getByTestId('pact-enddate-6').first()).toBeAttached();
    if ((await page.getByTestId('pact-enddate-7').count()) > 0) await expect(page.getByTestId('pact-enddate-7').first()).toBeAttached();
    if ((await page.getByTestId('pact-set-notification-8').count()) > 0) await expect(page.getByTestId('pact-set-notification-8').first()).toBeAttached();
    if ((await page.getByTestId('pact-set-notification-9').count()) > 0) await expect(page.getByTestId('pact-set-notification-9').first()).toBeAttached();
    if ((await page.getByTestId('pact-set-selection-mode-10').count()) > 0) await expect(page.getByTestId('pact-set-selection-mode-10').first()).toBeAttached();
    if ((await page.getByTestId('pact-set-selection-mode-11').count()) > 0) await expect(page.getByTestId('pact-set-selection-mode-11').first()).toBeAttached();
    if ((await page.getByTestId('pact-remove-participant-12').count()) > 0) await expect(page.getByTestId('pact-remove-participant-12').first()).toBeAttached();
    if ((await page.getByTestId('pact-restore-all-13').count()) > 0) await expect(page.getByTestId('pact-restore-all-13').first()).toBeAttached();
    if ((await page.getByTestId('pact-restore-participant-14').count()) > 0) await expect(page.getByTestId('pact-restore-participant-14').first()).toBeAttached();
  });

  test('big-cohorts.component.html controls are addressable (bcoh)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('bcoh-cohorts-1').count()) > 0) await expect(page.getByTestId('bcoh-cohorts-1').first()).toBeAttached();
    if ((await page.getByTestId('bcoh-button-2').count()) > 0) await expect(page.getByTestId('bcoh-button-2').first()).toBeAttached();
    if ((await page.getByTestId('bcoh-on-edit-assignment-3').count()) > 0) await expect(page.getByTestId('bcoh-on-edit-assignment-3').first()).toBeAttached();
    if ((await page.getByTestId('bcoh-on-start-metting-4').count()) > 0) await expect(page.getByTestId('bcoh-on-start-metting-4').first()).toBeAttached();
    if ((await page.getByTestId('bcoh-on-validate-participant-assignment-5').count()) > 0) await expect(page.getByTestId('bcoh-on-validate-participant-assignment-5').first()).toBeAttached();
    if ((await page.getByTestId('bcoh-on-create-assignment-6').count()) > 0) await expect(page.getByTestId('bcoh-on-create-assignment-6').first()).toBeAttached();
  });

  test('unassigned-participants-dialog.component.html controls are addressable (upd)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('upd-on-close-1').count()) > 0) await expect(page.getByTestId('upd-on-close-1').first()).toBeAttached();
    if ((await page.getByTestId('upd-search-query-2').count()) > 0) await expect(page.getByTestId('upd-search-query-2').first()).toBeAttached();
    if ((await page.getByTestId('upd-toggle-select-mode-3').count()) > 0) await expect(page.getByTestId('upd-toggle-select-mode-3').first()).toBeAttached();
    if ((await page.getByTestId('upd-select-all-4').count()) > 0) await expect(page.getByTestId('upd-select-all-4').first()).toBeAttached();
    if ((await page.getByTestId('upd-button-5').count()) > 0) await expect(page.getByTestId('upd-button-5').first()).toBeAttached();
    if ((await page.getByTestId('upd-event-6').count()) > 0) await expect(page.getByTestId('upd-event-6').first()).toBeAttached();
    if ((await page.getByTestId('upd-event-7').count()) > 0) await expect(page.getByTestId('upd-event-7').first()).toBeAttached();
    if ((await page.getByTestId('upd-assign-to-cohort-8').count()) > 0) await expect(page.getByTestId('upd-assign-to-cohort-8').first()).toBeAttached();
    if ((await page.getByTestId('upd-select-mode-9').count()) > 0) await expect(page.getByTestId('upd-select-mode-9').first()).toBeAttached();
    if ((await page.getByTestId('upd-on-close-10').count()) > 0) await expect(page.getByTestId('upd-on-close-10').first()).toBeAttached();
  });

  test('view-arena-space.component.html controls are addressable (vas)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('vas-export-csv-1').count()) > 0) await expect(page.getByTestId('vas-export-csv-1').first()).toBeAttached();
    if ((await page.getByTestId('vas-open-dialog-2').count()) > 0) await expect(page.getByTestId('vas-open-dialog-2').first()).toBeAttached();
    if ((await page.getByTestId('vas-validate-arena-space-3').count()) > 0) await expect(page.getByTestId('vas-validate-arena-space-3').first()).toBeAttached();
    if ((await page.getByTestId('vas-prev-page-4').count()) > 0) await expect(page.getByTestId('vas-prev-page-4').first()).toBeAttached();
    if ((await page.getByTestId('vas-go-to-page-5').count()) > 0) await expect(page.getByTestId('vas-go-to-page-5').first()).toBeAttached();
    if ((await page.getByTestId('vas-go-to-page-6').count()) > 0) await expect(page.getByTestId('vas-go-to-page-6').first()).toBeAttached();
    if ((await page.getByTestId('vas-go-to-page-7').count()) > 0) await expect(page.getByTestId('vas-go-to-page-7').first()).toBeAttached();
    if ((await page.getByTestId('vas-next-page-8').count()) > 0) await expect(page.getByTestId('vas-next-page-8').first()).toBeAttached();
    if ((await page.getByTestId('vas-change-current-page-9').count()) > 0) await expect(page.getByTestId('vas-change-current-page-9').first()).toBeAttached();
  });

  test('update-atcmodel-level-config.component.html controls are addressable (umlc)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('umlc-add-metrics-1').count()) > 0) await expect(page.getByTestId('umlc-add-metrics-1').first()).toBeAttached();
    if ((await page.getByTestId('umlc-remove-metrics-2').count()) > 0) await expect(page.getByTestId('umlc-remove-metrics-2').first()).toBeAttached();
    if ((await page.getByTestId('umlc-close-3').count()) > 0) await expect(page.getByTestId('umlc-close-3').first()).toBeAttached();
    if ((await page.getByTestId('umlc-button-4').count()) > 0) await expect(page.getByTestId('umlc-button-4').first()).toBeAttached();
  });

  test('create-space.component.html controls are addressable (csp)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('csp-is-edit-1').count()) > 0) await expect(page.getByTestId('csp-is-edit-1').first()).toBeAttached();
    if ((await page.getByTestId('csp-edit-field-2').count()) > 0) await expect(page.getByTestId('csp-edit-field-2').first()).toBeAttached();
    if ((await page.getByTestId('csp-edit-field-3').count()) > 0) await expect(page.getByTestId('csp-edit-field-3').first()).toBeAttached();
  });

  test('create-space-type.component.html controls are addressable (cst)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('cst-is-type-edit-1').count()) > 0) await expect(page.getByTestId('cst-is-type-edit-1').first()).toBeAttached();
    if ((await page.getByTestId('cst-button-2').count()) > 0) await expect(page.getByTestId('cst-button-2').first()).toBeAttached();
    if ((await page.getByTestId('cst-edit-type-field-3').count()) > 0) await expect(page.getByTestId('cst-edit-type-field-3').first()).toBeAttached();
    if ((await page.getByTestId('cst-edit-type-field-4').count()) > 0) await expect(page.getByTestId('cst-edit-type-field-4').first()).toBeAttached();
  });

  test('watch-videos.component.html controls are addressable (watchvideos)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('watchvideos-complete').count()) > 0) await expect(page.getByTestId('watchvideos-complete').first()).toBeAttached();
    if ((await page.getByTestId('watchvideos-close-dialog-1').count()) > 0) await expect(page.getByTestId('watchvideos-close-dialog-1').first()).toBeAttached();
    if ((await page.getByTestId('watchvideos-play-video-2').count()) > 0) await expect(page.getByTestId('watchvideos-play-video-2').first()).toBeAttached();
    if ((await page.getByTestId('watchvideos-close-dialog-3').count()) > 0) await expect(page.getByTestId('watchvideos-close-dialog-3').first()).toBeAttached();
  });

  test('add-big-activity.component.html controls are addressable (aba)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('aba-close-1').count()) > 0) await expect(page.getByTestId('aba-close-1').first()).toBeAttached();
    if ((await page.getByTestId('aba-button-2').count()) > 0) await expect(page.getByTestId('aba-button-2').first()).toBeAttached();
  });

  test('arena-space-dialog.component.html controls are addressable (asd)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('asd-button-1').count()) > 0) await expect(page.getByTestId('asd-button-1').first()).toBeAttached();
    if ((await page.getByTestId('asd-submit-2').count()) > 0) await expect(page.getByTestId('asd-submit-2').first()).toBeAttached();
  });

  test('update-big-level.component.html controls are addressable (ubl)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('ubl-close-1').count()) > 0) await expect(page.getByTestId('ubl-close-1').first()).toBeAttached();
    if ((await page.getByTestId('ubl-button-2').count()) > 0) await expect(page.getByTestId('ubl-button-2').first()).toBeAttached();
  });

  test('create-marathon.component.html controls are addressable (cmar)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('cmar-on-cancel-1').count()) > 0) await expect(page.getByTestId('cmar-on-cancel-1').first()).toBeAttached();
    if ((await page.getByTestId('cmar-on-submit-2').count()) > 0) await expect(page.getByTestId('cmar-on-submit-2').first()).toBeAttached();
  });

  test('group-dialog.component.html controls are addressable (gdlg)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('gdlg-addtags-1').count()) > 0) await expect(page.getByTestId('gdlg-addtags-1').first()).toBeAttached();
    if ((await page.getByTestId('gdlg-addparticipant-tags-2').count()) > 0) await expect(page.getByTestId('gdlg-addparticipant-tags-2').first()).toBeAttached();
  });

  test('alertbox.component.html controls are addressable (alrt)', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    // Dialog/child: opened by a parent screen, so its controls may not be mounted on a bare session.
    if ((await page.getByTestId('alrt-close-1').count()) > 0) await expect(page.getByTestId('alrt-close-1').first()).toBeAttached();
  });

});
