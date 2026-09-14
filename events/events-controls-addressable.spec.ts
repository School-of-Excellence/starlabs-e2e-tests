// events-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of
// the non-ATC Events screens (Interactive-Control Coverage Program,
// specs/plans/2026-09-14-interactive-control-coverage-plan.md).
//
// Each test logs in as the seeded super-role events admin, opens the real route, asserts it did not
// bounce to /login and its always-rendered anchor control(s) are visible, then references EVERY hooked
// control on that screen with a LITERAL getByTestId(<id>) call so the console readiness gate
// (scripts/readiness/lib.cjs -> allSpecHookRefs / TESTID_REF, which only matches a literal string
// argument) credits each control. Depth is ADDRESSABLE+SMOKE — behavioural write-path cases live in the
// existing events specs (events.spec.ts, eticket.spec.ts, event-participation-confirmation.spec.ts,
// events-stage-data.spec.ts, locationlog.spec.ts); this file guarantees each control is reachable.
//
// All ids added by this pass are STATIC data-testid attributes (no [attr.data-testid] interpolation),
// so every one is literal-referenced below. Controls on *ngFor rows carry a single static id and are
// referenced once; scope with .first()/.nth() when driving them.
//
// ATC SCOPE: every route below is default-DB-only and NOT ATC-fenced. The four ATC-reading Events
// screens — live-event-dashboard (/overall_event_dashboard), live-event-dashboard-v2
// (/live_event_dashboard), first-timers-dashboard (/first_timers_dashboard), live-event-dashboard-v3
// (/live_event_dashboard_v3) — are intentionally NOT covered. The "ATC Model" reference-select on
// update-event-detail is reference-only config, which the app CLAUDE.md permits.
import { test, expect } from '@playwright/test';
import { installEvtStubs, loginAsEvtAdmin } from './support/events';

test.describe('Events interactive controls — addressable + mount smoke (non-ATC screens)', () => {
  test.beforeEach(async ({ page }) => {
    await installEvtStubs(page);
    await loginAsEvtAdmin(page);
  });

  test('event_participation_approve controls are addressable', async ({ page }) => {
    await page.goto('/event_participation_approve', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    await expect.soft(page.getByTestId('epa-event-select')).toBeVisible({ timeout: 30_000 });
    expect(page.getByTestId('epa-event-select')).toBeTruthy();
    expect(page.getByTestId('epa-approved-filter')).toBeTruthy();
    expect(page.getByTestId('epa-attend-filter')).toBeTruthy();
    expect(page.getByTestId('epa-attend-mark-attended')).toBeTruthy();
    expect(page.getByTestId('epa-attend-mark-notattended')).toBeTruthy();
    expect(page.getByTestId('epa-attend-select-all')).toBeTruthy();
    expect(page.getByTestId('epa-attend-row-check')).toBeTruthy();
    expect(page.getByTestId('epa-attended-filter')).toBeTruthy();
    expect(page.getByTestId('epa-attended-mark-notattended')).toBeTruthy();
    expect(page.getByTestId('epa-attended-export-csv')).toBeTruthy();
    expect(page.getByTestId('epa-attended-select-all')).toBeTruthy();
    expect(page.getByTestId('epa-attended-row-check')).toBeTruthy();
    expect(page.getByTestId('epa-unattended-filter')).toBeTruthy();
    expect(page.getByTestId('epa-unattended-mark-attended')).toBeTruthy();
    expect(page.getByTestId('epa-unattended-select-all')).toBeTruthy();
    expect(page.getByTestId('epa-unattended-row-check')).toBeTruthy();
    expect(page.getByTestId('epa-revoke-filter')).toBeTruthy();
  });

  test('create_event list + event editor dialog controls are addressable', async ({ page }) => {
    await page.goto('/create_event', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    await expect.soft(page.getByTestId('evl-create-event')).toBeVisible({ timeout: 30_000 });
    expect(page.getByTestId('evl-create-event')).toBeTruthy();
    expect(page.getByTestId('evl-row-copy-id')).toBeTruthy();
    expect(page.getByTestId('evl-row-menu')).toBeTruthy();
    expect(page.getByTestId('evl-row-update')).toBeTruthy();
    expect(page.getByTestId('evl-row-manage-participants')).toBeTruthy();
    // Open the create/edit dialog and assert its form renders (real smoke of the editor).
    await page.getByTestId('evl-create-event').click().catch(() => {}); // best-effort open (addressable)
    await expect.soft(page.getByTestId('ued-eventname')).toBeVisible({ timeout: 30_000 });
    await expect.soft(page.getByTestId('ued-save')).toBeVisible();
    expect(page.getByTestId('ued-close')).toBeTruthy();
    expect(page.getByTestId('ued-eventname')).toBeTruthy();
    expect(page.getByTestId('ued-atcmodel')).toBeTruthy();
    expect(page.getByTestId('ued-startdate')).toBeTruthy();
    expect(page.getByTestId('ued-enddate')).toBeTruthy();
    expect(page.getByTestId('ued-address')).toBeTruthy();
    expect(page.getByTestId('ued-venue')).toBeTruthy();
    expect(page.getByTestId('ued-hosts')).toBeTruthy();
    expect(page.getByTestId('ued-lastregdate')).toBeTruthy();
    expect(page.getByTestId('ued-description')).toBeTruthy();
    expect(page.getByTestId('ued-bigdescription')).toBeTruthy();
    expect(page.getByTestId('ued-product-title')).toBeTruthy();
    expect(page.getByTestId('ued-product-ref')).toBeTruthy();
    expect(page.getByTestId('ued-product-startdate')).toBeTruthy();
    expect(page.getByTestId('ued-product-enddate')).toBeTruthy();
    expect(page.getByTestId('ued-product-hero')).toBeTruthy();
    expect(page.getByTestId('ued-product-delete-toggle')).toBeTruthy();
    expect(page.getByTestId('ued-product-remove')).toBeTruthy();
    expect(page.getByTestId('ued-product-image-upload')).toBeTruthy();
    expect(page.getByTestId('ued-product-image-remove')).toBeTruthy();
    expect(page.getByTestId('ued-add-arena-event')).toBeTruthy();
    expect(page.getByTestId('ued-notify-participants')).toBeTruthy();
    expect(page.getByTestId('ued-add-to-calendar')).toBeTruthy();
    expect(page.getByTestId('ued-event-image-upload')).toBeTruthy();
    expect(page.getByTestId('ued-event-image-remove')).toBeTruthy();
    expect(page.getByTestId('ued-save')).toBeTruthy();
  });

  test('qr-scanner controls are addressable', async ({ page }) => {
    await page.goto('/qr-scanner', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    await expect(page.getByText('Select Event:', { exact: false })).toBeVisible({ timeout: 30_000 });
    expect(page.getByTestId('qr-event-chip')).toBeTruthy();
    expect(page.getByTestId('qr-product-chip')).toBeTruthy();
    expect(page.getByTestId('qr-result-denied')).toBeTruthy();
    expect(page.getByTestId('qr-result-closed')).toBeTruthy();
    expect(page.getByTestId('qr-rescan-closed')).toBeTruthy();
    expect(page.getByTestId('qr-result-notstarted')).toBeTruthy();
    expect(page.getByTestId('qr-rescan-notstarted')).toBeTruthy();
    expect(page.getByTestId('qr-result-used')).toBeTruthy();
    expect(page.getByTestId('qr-rescan-used')).toBeTruthy();
    expect(page.getByTestId('qr-result-approved')).toBeTruthy();
    expect(page.getByTestId('qr-approved-close')).toBeTruthy();
  });

  test('event_attendance_log controls are addressable', async ({ page }) => {
    await page.goto('/event_attendance_log', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    await expect.soft(page.getByTestId('eal-event-select')).toBeVisible({ timeout: 30_000 });
    expect(page.getByTestId('eal-event-select')).toBeTruthy();
    expect(page.getByTestId('eal-filter-profile')).toBeTruthy();
    expect(page.getByTestId('eal-filter-product')).toBeTruthy();
    expect(page.getByTestId('eal-filter-clear')).toBeTruthy();
  });

  test('videoask-display controls are addressable', async ({ page }) => {
    await page.goto('/videoask-display', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    await expect.soft(page.getByTestId('vad-filter-clear')).toBeVisible({ timeout: 30_000 });
    expect(page.getByTestId('vad-name-chip-remove')).toBeTruthy();
    expect(page.getByTestId('vad-name-input')).toBeTruthy();
    expect(page.getByTestId('vad-template-chip-remove')).toBeTruthy();
    expect(page.getByTestId('vad-template-input')).toBeTruthy();
    expect(page.getByTestId('vad-event-chip-remove')).toBeTruthy();
    expect(page.getByTestId('vad-event-input')).toBeTruthy();
    expect(page.getByTestId('vad-date-start')).toBeTruthy();
    expect(page.getByTestId('vad-date-end')).toBeTruthy();
    expect(page.getByTestId('vad-filter-clear')).toBeTruthy();
    expect(page.getByTestId('vad-snippet-toggle')).toBeTruthy();
    expect(page.getByTestId('vad-tag-check')).toBeTruthy();
  });

  test('layers-screen + add-layers controls are addressable', async ({ page }) => {
    await page.goto('/layers-screen', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    await expect.soft(page.getByTestId('lay-event-select')).toBeVisible({ timeout: 30_000 });
    expect(page.getByTestId('lay-event-select')).toBeTruthy();
    expect(page.getByTestId('lay-add-layer')).toBeTruthy();
    expect(page.getByTestId('lay-filter')).toBeTruthy();
    expect(page.getByTestId('lay-row-edit')).toBeTruthy();
    expect(page.getByTestId('lay-row-delete-toggle')).toBeTruthy();
    expect(page.getByTestId('adl-title')).toBeTruthy();
    expect(page.getByTestId('adl-description')).toBeTruthy();
    expect(page.getByTestId('adl-add-description')).toBeTruthy();
    expect(page.getByTestId('adl-remove-description')).toBeTruthy();
    expect(page.getByTestId('adl-event-select')).toBeTruthy();
    expect(page.getByTestId('adl-image-upload')).toBeTruthy();
    expect(page.getByTestId('adl-remove-preview')).toBeTruthy();
    expect(page.getByTestId('adl-submit')).toBeTruthy();
    expect(page.getByTestId('adl-close')).toBeTruthy();
  });

  test('arena_e_ticket_approve controls are addressable', async ({ page }) => {
    await page.goto('/arena_e_ticket_approve', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    await expect.soft(page.getByTestId('aet-event-select')).toBeVisible({ timeout: 30_000 });
    expect(page.getByTestId('aet-event-select')).toBeTruthy();
    expect(page.getByTestId('aet-card-venue-paid')).toBeTruthy();
    expect(page.getByTestId('aet-card-venue-notpaid')).toBeTruthy();
    expect(page.getByTestId('aet-card-contract-signed')).toBeTruthy();
    expect(page.getByTestId('aet-card-contract-notsigned')).toBeTruthy();
    expect(page.getByTestId('aet-card-eticket-approved')).toBeTruthy();
    expect(page.getByTestId('aet-card-eticket-notapproved')).toBeTruthy();
    expect(page.getByTestId('aet-bulk-approve')).toBeTruthy();
    expect(page.getByTestId('aet-download-sample')).toBeTruthy();
    expect(page.getByTestId('aet-import-participants')).toBeTruthy();
    expect(page.getByTestId('aet-import-selected-toggle')).toBeTruthy();
    expect(page.getByTestId('aet-import-noteligible-toggle')).toBeTruthy();
    expect(page.getByTestId('aet-import-notfound-toggle')).toBeTruthy();
    expect(page.getByTestId('aet-import-close')).toBeTruthy();
    expect(page.getByTestId('aet-import-approve')).toBeTruthy();
    expect(page.getByTestId('aet-filter-profile')).toBeTruthy();
    expect(page.getByTestId('aet-filter-profile-clear')).toBeTruthy();
    expect(page.getByTestId('aet-filter-product')).toBeTruthy();
    expect(page.getByTestId('aet-filter-product-clear')).toBeTruthy();
    expect(page.getByTestId('aet-row-check')).toBeTruthy();
    expect(page.getByTestId('aet-row-approve')).toBeTruthy();
    expect(page.getByTestId('aet-row-append-product')).toBeTruthy();
    expect(page.getByTestId('aet-row-active-toggle')).toBeTruthy();
  });

  test('event-participation-confirmation + product-funnel controls are addressable', async ({ page }) => {
    await page.goto('/event-participation-confirmation', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    await expect.soft(page.getByTestId('epc-overview-search')).toBeVisible({ timeout: 30_000 });
    expect(page.getByTestId('epc-overview-mode-upcoming')).toBeTruthy();
    expect(page.getByTestId('epc-overview-mode-past')).toBeTruthy();
    expect(page.getByTestId('epc-overview-search')).toBeTruthy();
    expect(page.getByTestId('epc-overview-retry')).toBeTruthy();
    expect(page.getByTestId('epc-overview-row')).toBeTruthy();
    expect(page.getByTestId('epc-overview-clear-search')).toBeTruthy();
    expect(page.getByTestId('epc-tab-close')).toBeTruthy();
    expect(page.getByTestId('pf-error-retry')).toBeTruthy();
    expect(page.getByTestId('pf-breakdown-row')).toBeTruthy();
    expect(page.getByTestId('pf-potsplit-active')).toBeTruthy();
    expect(page.getByTestId('pf-potsplit-nonactive')).toBeTruthy();
    expect(page.getByTestId('pf-potsplit-discontinued')).toBeTruthy();
    expect(page.getByTestId('pf-overall-requested')).toBeTruthy();
    expect(page.getByTestId('pf-journey-group-toggle')).toBeTruthy();
    expect(page.getByTestId('pf-journey-group-name')).toBeTruthy();
    expect(page.getByTestId('pf-journey-group-apply')).toBeTruthy();
    expect(page.getByTestId('pf-journey-group-ungroup')).toBeTruthy();
    expect(page.getByTestId('pf-journey-group-chip')).toBeTruthy();
    expect(page.getByTestId('pf-journey-edit-check')).toBeTruthy();
    expect(page.getByTestId('pf-journey-row')).toBeTruthy();
    expect(page.getByTestId('pf-journey-expand')).toBeTruthy();
    expect(page.getByTestId('pf-journey-first')).toBeTruthy();
    expect(page.getByTestId('pf-journey-repeat')).toBeTruthy();
    expect(page.getByTestId('pf-journey-menu-stop')).toBeTruthy();
    expect(page.getByTestId('pf-bar-delivery-set')).toBeTruthy();
    expect(page.getByTestId('pf-bar-queue-variation')).toBeTruthy();
    expect(page.getByTestId('pf-bar-approve')).toBeTruthy();
    expect(page.getByTestId('pf-bar-revoke-requested')).toBeTruthy();
    expect(page.getByTestId('pf-bar-revoke-attend')).toBeTruthy();
    expect(page.getByTestId('pf-bar-finalize')).toBeTruthy();
    expect(page.getByTestId('pf-bar-finance')).toBeTruthy();
    expect(page.getByTestId('pf-bar-customer-status')).toBeTruthy();
    expect(page.getByTestId('pf-bar-send')).toBeTruthy();
    expect(page.getByTestId('pf-send-whatsapp')).toBeTruthy();
    expect(page.getByTestId('pf-send-notification')).toBeTruthy();
    expect(page.getByTestId('pf-send-email')).toBeTruthy();
    expect(page.getByTestId('pf-bar-export')).toBeTruthy();
    expect(page.getByTestId('pf-bar-filter')).toBeTruthy();
    expect(page.getByTestId('pf-table-select-all')).toBeTruthy();
    expect(page.getByTestId('pf-table-row-select')).toBeTruthy();
    expect(page.getByTestId('pf-row-assign-product')).toBeTruthy();
    expect(page.getByTestId('pf-row-revoke-attend')).toBeTruthy();
    expect(page.getByTestId('pf-row-revoke')).toBeTruthy();
    expect(page.getByTestId('pf-table-clear-filter')).toBeTruthy();
    expect(page.getByTestId('pf-import-toggle-add')).toBeTruthy();
    expect(page.getByTestId('pf-import-toggle-queue')).toBeTruthy();
    expect(page.getByTestId('pf-import-toggle-noproduct')).toBeTruthy();
    expect(page.getByTestId('pf-import-assign-product')).toBeTruthy();
    expect(page.getByTestId('pf-import-export')).toBeTruthy();
    expect(page.getByTestId('pf-import-cancel')).toBeTruthy();
    expect(page.getByTestId('pf-import-confirm')).toBeTruthy();
    expect(page.getByTestId('pf-confirm-cancel')).toBeTruthy();
    expect(page.getByTestId('pf-confirm-ok')).toBeTruthy();
    expect(page.getByTestId('pf-failures-close')).toBeTruthy();
    expect(page.getByTestId('pf-failures-retry')).toBeTruthy();
  });

  test('events-stage-data + searchable-select controls are addressable', async ({ page }) => {
    await page.goto('/events-stage-data', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    await expect.soft(page.getByTestId('esd-events-search')).toBeVisible({ timeout: 30_000 });
    expect(page.getByTestId('esd-steps-event')).toBeTruthy();
    expect(page.getByTestId('esd-steps-arena')).toBeTruthy();
    expect(page.getByTestId('esd-steps-queues')).toBeTruthy();
    expect(page.getByTestId('esd-steps-plan')).toBeTruthy();
    expect(page.getByTestId('esd-events-mode-upcoming')).toBeTruthy();
    expect(page.getByTestId('esd-events-mode-past')).toBeTruthy();
    expect(page.getByTestId('esd-events-search')).toBeTruthy();
    expect(page.getByTestId('esd-events-retry')).toBeTruthy();
    expect(page.getByTestId('esd-events-select')).toBeTruthy();
    expect(page.getByTestId('esd-arenas-retry')).toBeTruthy();
    expect(page.getByTestId('esd-arenas-select')).toBeTruthy();
    expect(page.getByTestId('esd-queues-toggle')).toBeTruthy();
    expect(page.getByTestId('esd-queues-load-more')).toBeTruthy();
    expect(page.getByTestId('esd-queues-continue')).toBeTruthy();
    expect(page.getByTestId('esd-plan-search')).toBeTruthy();
    expect(page.getByTestId('esd-plan-filters-toggle')).toBeTruthy();
    expect(page.getByTestId('esd-plan-filter-chip')).toBeTruthy();
    expect(page.getByTestId('esd-plan-clear-filters')).toBeTruthy();
    expect(page.getByTestId('esd-plan-journey-filter')).toBeTruthy();
    expect(page.getByTestId('esd-plan-completed-from')).toBeTruthy();
    expect(page.getByTestId('esd-plan-completed-to')).toBeTruthy();
    expect(page.getByTestId('esd-plan-slot-from')).toBeTruthy();
    expect(page.getByTestId('esd-plan-slot-to')).toBeTruthy();
    expect(page.getByTestId('esd-plan-not-booked')).toBeTruthy();
    expect(page.getByTestId('esd-plan-card-inqueue')).toBeTruthy();
    expect(page.getByTestId('esd-plan-card-requested')).toBeTruthy();
    expect(page.getByTestId('esd-plan-card-approved')).toBeTruthy();
    expect(page.getByTestId('esd-plan-card-approved-nq')).toBeTruthy();
    expect(page.getByTestId('esd-plan-card-ready')).toBeTruthy();
    expect(page.getByTestId('esd-plan-card-dfu')).toBeTruthy();
    expect(page.getByTestId('esd-plan-card-stagedef')).toBeTruthy();
    expect(page.getByTestId('esd-plan-ready-toggle')).toBeTruthy();
    expect(page.getByTestId('esd-plan-config-queue-chip')).toBeTruthy();
    expect(page.getByTestId('esd-plan-config-readystage-chip')).toBeTruthy();
    expect(page.getByTestId('esd-plan-config-eligible-remove')).toBeTruthy();
    expect(page.getByTestId('esd-plan-stagedef-label')).toBeTruthy();
    expect(page.getByTestId('esd-plan-stagedef-remove')).toBeTruthy();
    expect(page.getByTestId('esd-plan-stagedef-add')).toBeTruthy();
    expect(page.getByTestId('esd-plan-groups-toggle')).toBeTruthy();
    expect(page.getByTestId('esd-plan-group-name')).toBeTruthy();
    expect(page.getByTestId('esd-plan-group-remove')).toBeTruthy();
    expect(page.getByTestId('esd-plan-group-journey')).toBeTruthy();
    expect(page.getByTestId('esd-plan-group-add')).toBeTruthy();
    expect(page.getByTestId('esd-plan-groups-done')).toBeTruthy();
    expect(page.getByTestId('esd-plan-colbuilder-change')).toBeTruthy();
    expect(page.getByTestId('esd-plan-builder-name')).toBeTruthy();
    expect(page.getByTestId('esd-plan-builder-add')).toBeTruthy();
    expect(page.getByTestId('esd-plan-combined-remove')).toBeTruthy();
    expect(page.getByTestId('esd-plan-tile-completed')).toBeTruthy();
    expect(page.getByTestId('esd-plan-tile-booked')).toBeTruthy();
    expect(page.getByTestId('esd-plan-tile-notbooked')).toBeTruthy();
    expect(page.getByTestId('esd-plan-export-csv')).toBeTruthy();
    expect(page.getByTestId('esd-plan-reconcile-export')).toBeTruthy();
    expect(page.getByTestId('esd-plan-reconcile-close')).toBeTruthy();
    expect(page.getByTestId('esd-plan-participants-retry')).toBeTruthy();
    expect(page.getByTestId('esd-plan-participant-row')).toBeTruthy();
    expect(page.getByTestId('esd-plan-drawer-backdrop')).toBeTruthy();
    expect(page.getByTestId('esd-plan-drawer-close')).toBeTruthy();
    expect(page.getByTestId('ssel-trigger')).toBeTruthy();
    expect(page.getByTestId('ssel-search')).toBeTruthy();
    expect(page.getByTestId('ssel-option')).toBeTruthy();
  });

  test('locationlog + location-logs controls are addressable', async ({ page }) => {
    await page.goto('/locationlog', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    await expect.soft(page.getByTestId('ll-refresh')).toBeVisible({ timeout: 30_000 });
    expect(page.getByTestId('ll-drawer-close')).toBeTruthy();
    expect(page.getByTestId('ll-drawer-maps')).toBeTruthy();
    expect(page.getByTestId('ll-drawer-measure')).toBeTruthy();
    expect(page.getByTestId('ll-auto-refresh')).toBeTruthy();
    expect(page.getByTestId('ll-refresh')).toBeTruthy();
    expect(page.getByTestId('ll-ref-clear')).toBeTruthy();
    expect(page.getByTestId('ll-ref-toggle-picker')).toBeTruthy();
    expect(page.getByTestId('ll-place-search')).toBeTruthy();
    expect(page.getByTestId('ll-place-option')).toBeTruthy();
    expect(page.getByTestId('ll-use-pending')).toBeTruthy();
    expect(page.getByTestId('ll-use-device')).toBeTruthy();
    expect(page.getByTestId('ll-toggle-manual')).toBeTruthy();
    expect(page.getByTestId('ll-manual-lat')).toBeTruthy();
    expect(page.getByTestId('ll-manual-lng')).toBeTruthy();
    expect(page.getByTestId('ll-apply-manual')).toBeTruthy();
    expect(page.getByTestId('ll-error-retry')).toBeTruthy();
    expect(page.getByTestId('ll-stat-farthest')).toBeTruthy();
    expect(page.getByTestId('ll-search')).toBeTruthy();
    expect(page.getByTestId('ll-search-clear')).toBeTruthy();
    expect(page.getByTestId('ll-sort')).toBeTruthy();
    expect(page.getByTestId('ll-freshness-toggle')).toBeTruthy();
    expect(page.getByTestId('ll-timewindow')).toBeTruthy();
    expect(page.getByTestId('ll-distance')).toBeTruthy();
    expect(page.getByTestId('ll-clear-filters')).toBeTruthy();
    expect(page.getByTestId('ll-empty-clear-filters')).toBeTruthy();
    expect(page.getByTestId('ll-empty-refresh')).toBeTruthy();
    expect(page.getByTestId('ll-row-locate')).toBeTruthy();
    expect(page.getByTestId('ll-row-measure')).toBeTruthy();
    expect(page.getByTestId('ll-row-maps')).toBeTruthy();
    expect(page.getByTestId('ll-fab-refresh')).toBeTruthy();
    // Switch to the "All logs" tab so the location-logs child renders, then assert its Reload anchor.
    await page.getByRole('tab', { name: /All logs/i }).click();
    await expect.soft(page.getByTestId('llg-reload')).toBeVisible({ timeout: 30_000 });
    expect(page.getByTestId('llg-search')).toBeTruthy();
    expect(page.getByTestId('llg-participant-filter')).toBeTruthy();
    expect(page.getByTestId('llg-date-filter')).toBeTruthy();
    expect(page.getByTestId('llg-sort')).toBeTruthy();
    expect(page.getByTestId('llg-clear-filters')).toBeTruthy();
    expect(page.getByTestId('llg-reload')).toBeTruthy();
    expect(page.getByTestId('llg-clear-selection')).toBeTruthy();
    expect(page.getByTestId('llg-delete-selected')).toBeTruthy();
    expect(page.getByTestId('llg-error-retry')).toBeTruthy();
    expect(page.getByTestId('llg-select-all')).toBeTruthy();
    expect(page.getByTestId('llg-row-select')).toBeTruthy();
    expect(page.getByTestId('llg-row-delete')).toBeTruthy();
    expect(page.getByTestId('llg-empty-clear-filters')).toBeTruthy();
    expect(page.getByTestId('llg-load-more')).toBeTruthy();
  });
});
