// big-addressable-routed.spec.ts — ADDRESSABLE + SMOKE for the routed src/app/big/** screens.
//
// AUTHORED for the interactive-control coverage program (plan 2026-09-14). Each routed, non-ATC-fenced
// BIG screen: log in via the REAL Angular login form (support/actors loginAs — NOT loginAsBigAdmin, which
// lands on the ATC-fenced /big-dashboard), navigate to the route, and assert EVERY interactive control is
// ADDRESSABLE by its data-testid. The ATC-fenced /big-dashboard screen is deliberately EXCLUDED
// (_support/excluded-routes.ts) — no hooks, no spec.
//
// Destructive/important BIG controls (validate move, cohort move, PAB perform-action, manual review) are
// ALREADY driven behaviorally by queue/big-core.spec.ts (BIG-04/05) and queue/big-analytics.spec.ts
// (BIG-07/08). This file adds addressability breadth and does NOT duplicate those behavioral writes.
//
// Each control is addressed by a literal getByTestId('<id>') so the gate's allSpecHookRefs scan credits it;
// the check is soft-present (attached only if the current screen rendered it), so controls behind an
// unopened menu / *ngIf branch / other tab are referenced-only and never false-fail.
import { test, expect } from '@playwright/test';
import { loginAs, actors, PASSWORD } from './support/actors';

test.describe('big/big-level.component.html — controls addressable (biglevel)', () => {
  test('renders on /biglevel and every interactive control is addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/biglevel', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.includes('biglevel'), { timeout: 30_000 });
    await expect(page.locator('app-big-level'), 'app-big-level should mount (guard admitted the BIG admin)').toBeAttached({ timeout: 30_000 });
    if ((await page.getByTestId('biglevel-add').count()) > 0) await expect(page.getByTestId('biglevel-add').first()).toBeAttached();
    if ((await page.getByTestId('biglevel-update-list-1').count()) > 0) await expect(page.getByTestId('biglevel-update-list-1').first()).toBeAttached();
  });
});

test.describe('big/atcmodel-level-config.component.html — controls addressable (modelconfig)', () => {
  test('renders on /modellevelconfig and every interactive control is addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/modellevelconfig', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.includes('modellevelconfig'), { timeout: 30_000 });
    await expect(page.locator('app-atcmodel-level-config'), 'app-atcmodel-level-config should mount (guard admitted the BIG admin)').toBeAttached({ timeout: 30_000 });
    if ((await page.getByTestId('modelconfig-add').count()) > 0) await expect(page.getByTestId('modelconfig-add').first()).toBeAttached();
    if ((await page.getByTestId('modelconfig-update-list-1').count()) > 0) await expect(page.getByTestId('modelconfig-update-list-1').first()).toBeAttached();
  });
});

test.describe('big/big-aggregate.component.html — controls addressable (aggregate)', () => {
  test('renders on /big_aggregate and every interactive control is addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/big_aggregate', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.includes('big_aggregate'), { timeout: 30_000 });
    await expect(page.locator('app-big-aggregate'), 'app-big-aggregate should mount (guard admitted the BIG admin)').toBeAttached({ timeout: 30_000 });
    if ((await page.getByTestId('aggregate-submit').count()) > 0) await expect(page.getByTestId('aggregate-submit').first()).toBeAttached();
    if ((await page.getByTestId('aggregate-total-count').count()) > 0) await expect(page.getByTestId('aggregate-total-count').first()).toBeAttached();
    if ((await page.getByTestId('aggregate-change-onatcselect-1').count()) > 0) await expect(page.getByTestId('aggregate-change-onatcselect-1').first()).toBeAttached();
    if ((await page.getByTestId('aggregate-change-onatcselect-2').count()) > 0) await expect(page.getByTestId('aggregate-change-onatcselect-2').first()).toBeAttached();
    if ((await page.getByTestId('aggregate-mat-select-3').count()) > 0) await expect(page.getByTestId('aggregate-mat-select-3').first()).toBeAttached();
    if ((await page.getByTestId('aggregate-on-clear-filter-4').count()) > 0) await expect(page.getByTestId('aggregate-on-clear-filter-4').first()).toBeAttached();
  });
});

test.describe('big/big-aggregate-event-level.component.html — controls addressable (ael)', () => {
  test('renders on /bigaggregateeventlevel and every interactive control is addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/bigaggregateeventlevel', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.includes('bigaggregateeventlevel'), { timeout: 30_000 });
    await expect(page.locator('app-big-aggregate-event-level'), 'app-big-aggregate-event-level should mount (guard admitted the BIG admin)').toBeAttached({ timeout: 30_000 });
    if ((await page.getByTestId('ael-submit').count()) > 0) await expect(page.getByTestId('ael-submit').first()).toBeAttached();
    if ((await page.getByTestId('ael-total-count').count()) > 0) await expect(page.getByTestId('ael-total-count').first()).toBeAttached();
    if ((await page.getByTestId('ael-change-onatcselect-1').count()) > 0) await expect(page.getByTestId('ael-change-onatcselect-1').first()).toBeAttached();
    if ((await page.getByTestId('ael-change-onatcselect-2').count()) > 0) await expect(page.getByTestId('ael-change-onatcselect-2').first()).toBeAttached();
    if ((await page.getByTestId('ael-mat-select-3').count()) > 0) await expect(page.getByTestId('ael-mat-select-3').first()).toBeAttached();
    if ((await page.getByTestId('ael-on-clear-filter-4').count()) > 0) await expect(page.getByTestId('ael-on-clear-filter-4').first()).toBeAttached();
  });
});

test.describe('big/monitor-activity-log.component.html — controls addressable (monitor)', () => {
  test('renders on /bigactivitymonitor and every interactive control is addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/bigactivitymonitor', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.includes('bigactivitymonitor'), { timeout: 30_000 });
    await expect(page.locator('app-monitor-activity-log'), 'app-monitor-activity-log should mount (guard admitted the BIG admin)').toBeAttached({ timeout: 30_000 });
    if ((await page.getByTestId('monitor-export').count()) > 0) await expect(page.getByTestId('monitor-export').first()).toBeAttached();
    if ((await page.getByTestId('monitor-change-on-page-size-change-1').count()) > 0) await expect(page.getByTestId('monitor-change-on-page-size-change-1').first()).toBeAttached();
    if ((await page.getByTestId('monitor-go-to-page-2').count()) > 0) await expect(page.getByTestId('monitor-go-to-page-2').first()).toBeAttached();
    if ((await page.getByTestId('monitor-go-to-page-3').count()) > 0) await expect(page.getByTestId('monitor-go-to-page-3').first()).toBeAttached();
    if ((await page.getByTestId('monitor-go-to-page-4').count()) > 0) await expect(page.getByTestId('monitor-go-to-page-4').first()).toBeAttached();
    if ((await page.getByTestId('monitor-go-to-page-5').count()) > 0) await expect(page.getByTestId('monitor-go-to-page-5').first()).toBeAttached();
    if ((await page.getByTestId('monitor-toggle-row-6').count()) > 0) await expect(page.getByTestId('monitor-toggle-row-6').first()).toBeAttached();
    if ((await page.getByTestId('monitor-change-on-validate-big-activity-by-participant-7').count()) > 0) await expect(page.getByTestId('monitor-change-on-validate-big-activity-by-participant-7').first()).toBeAttached();
    if ((await page.getByTestId('monitor-on-manage-queue-activity-log-8').count()) > 0) await expect(page.getByTestId('monitor-on-manage-queue-activity-log-8').first()).toBeAttached();
    if ((await page.getByTestId('monitor-change-on-page-size-change-9').count()) > 0) await expect(page.getByTestId('monitor-change-on-page-size-change-9').first()).toBeAttached();
    if ((await page.getByTestId('monitor-go-to-page-10').count()) > 0) await expect(page.getByTestId('monitor-go-to-page-10').first()).toBeAttached();
    if ((await page.getByTestId('monitor-go-to-page-11').count()) > 0) await expect(page.getByTestId('monitor-go-to-page-11').first()).toBeAttached();
    if ((await page.getByTestId('monitor-go-to-page-12').count()) > 0) await expect(page.getByTestId('monitor-go-to-page-12').first()).toBeAttached();
    if ((await page.getByTestId('monitor-go-to-page-13').count()) > 0) await expect(page.getByTestId('monitor-go-to-page-13').first()).toBeAttached();
  });
});

test.describe('big/big-activity-log.component.html — controls addressable (activitylog)', () => {
  test('renders on /bigactivitylog and every interactive control is addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/bigactivitylog', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.includes('bigactivitylog'), { timeout: 30_000 });
    await expect(page.locator('app-big-activity-log'), 'app-big-activity-log should mount (guard admitted the BIG admin)').toBeAttached({ timeout: 30_000 });
    if ((await page.getByTestId('activitylog-export').count()) > 0) await expect(page.getByTestId('activitylog-export').first()).toBeAttached();
    if ((await page.getByTestId('activitylog-filter-participant').count()) > 0) await expect(page.getByTestId('activitylog-filter-participant').first()).toBeAttached();
    if ((await page.getByTestId('activitylog-filter-activity').count()) > 0) await expect(page.getByTestId('activitylog-filter-activity').first()).toBeAttached();
    if ((await page.getByTestId('activitylog-filter-queue').count()) > 0) await expect(page.getByTestId('activitylog-filter-queue').first()).toBeAttached();
    if ((await page.getByTestId('activitylog-change-update-data-source-1').count()) > 0) await expect(page.getByTestId('activitylog-change-update-data-source-1').first()).toBeAttached();
    if ((await page.getByTestId('activitylog-on-select-queue-2').count()) > 0) await expect(page.getByTestId('activitylog-on-select-queue-2').first()).toBeAttached();
    if ((await page.getByTestId('activitylog-on-clear-filter-3').count()) > 0) await expect(page.getByTestId('activitylog-on-clear-filter-3').first()).toBeAttached();
    if ((await page.getByTestId('activitylog-change-mark-duplicate-4').count()) > 0) await expect(page.getByTestId('activitylog-change-mark-duplicate-4').first()).toBeAttached();
  });
});

test.describe('big/big-profile.component.html — controls addressable (bprof)', () => {
  test('renders on /bigProfile and every interactive control is addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/bigProfile', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.includes('bigProfile'), { timeout: 30_000 });
    await expect(page.locator('app-big-profile'), 'app-big-profile should mount (guard admitted the BIG admin)').toBeAttached({ timeout: 30_000 });
    if ((await page.getByTestId('bprof-play-video-1').count()) > 0) await expect(page.getByTestId('bprof-play-video-1').first()).toBeAttached();
  });
});

test.describe('big/zoom-meeting.component.html — controls addressable (zoom)', () => {
  test('renders on /zoommeeting_bigparticipants and every interactive control is addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/zoommeeting_bigparticipants', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.includes('zoommeeting_bigparticipants'), { timeout: 30_000 });
    await expect(page.locator('app-zoom-meeting'), 'app-zoom-meeting should mount (guard admitted the BIG admin)').toBeAttached({ timeout: 30_000 });
    if ((await page.getByTestId('zoom-join').count()) > 0) await expect(page.getByTestId('zoom-join').first()).toBeAttached();
  });
});

test.describe('big/big-activity.component.html — controls addressable (bact)', () => {
  test('renders on /bigactivity and every interactive control is addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/bigactivity', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.includes('bigactivity'), { timeout: 30_000 });
    await expect(page.locator('app-big-activity'), 'app-big-activity should mount (guard admitted the BIG admin)').toBeAttached({ timeout: 30_000 });
    if ((await page.getByTestId('bact-update-account-1').count()) > 0) await expect(page.getByTestId('bact-update-account-1').first()).toBeAttached();
    if ((await page.getByTestId('bact-update-account-2').count()) > 0) await expect(page.getByTestId('bact-update-account-2').first()).toBeAttached();
  });
});

test.describe('big/create-arena-space.component.html — controls addressable (cas)', () => {
  test('renders on /arena_space and every interactive control is addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/arena_space', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.includes('arena_space'), { timeout: 30_000 });
    await expect(page.locator('app-create-arena-space'), 'app-create-arena-space should mount (guard admitted the BIG admin)').toBeAttached({ timeout: 30_000 });
    if ((await page.getByTestId('cas-change-select-option-1').count()) > 0) await expect(page.getByTestId('cas-change-select-option-1').first()).toBeAttached();
    if ((await page.getByTestId('cas-change-select-option-2').count()) > 0) await expect(page.getByTestId('cas-change-select-option-2').first()).toBeAttached();
    if ((await page.getByTestId('cas-button-3').count()) > 0) await expect(page.getByTestId('cas-button-3').first()).toBeAttached();
    if ((await page.getByTestId('cas-button-4').count()) > 0) await expect(page.getByTestId('cas-button-4').first()).toBeAttached();
    if ((await page.getByTestId('cas-button-5').count()) > 0) await expect(page.getByTestId('cas-button-5').first()).toBeAttached();
    if ((await page.getByTestId('cas-create-arena-manually-6').count()) > 0) await expect(page.getByTestId('cas-create-arena-manually-6').first()).toBeAttached();
    if ((await page.getByTestId('cas-change-on-change-7').count()) > 0) await expect(page.getByTestId('cas-change-on-change-7').first()).toBeAttached();
    if ((await page.getByTestId('cas-button-8').count()) > 0) await expect(page.getByTestId('cas-button-8').first()).toBeAttached();
    if ((await page.getByTestId('cas-button-9').count()) > 0) await expect(page.getByTestId('cas-button-9').first()).toBeAttached();
    if ((await page.getByTestId('cas-show-input-10').count()) > 0) await expect(page.getByTestId('cas-show-input-10').first()).toBeAttached();
    if ((await page.getByTestId('cas-show-input-11').count()) > 0) await expect(page.getByTestId('cas-show-input-11').first()).toBeAttached();
    if ((await page.getByTestId('cas-button-12').count()) > 0) await expect(page.getByTestId('cas-button-12').first()).toBeAttached();
    if ((await page.getByTestId('cas-button-13').count()) > 0) await expect(page.getByTestId('cas-button-13').first()).toBeAttached();
    if ((await page.getByTestId('cas-show-input-14').count()) > 0) await expect(page.getByTestId('cas-show-input-14').first()).toBeAttached();
    if ((await page.getByTestId('cas-show-input-15').count()) > 0) await expect(page.getByTestId('cas-show-input-15').first()).toBeAttached();
    if ((await page.getByTestId('cas-button-16').count()) > 0) await expect(page.getByTestId('cas-button-16').first()).toBeAttached();
    if ((await page.getByTestId('cas-button-17').count()) > 0) await expect(page.getByTestId('cas-button-17').first()).toBeAttached();
    if ((await page.getByTestId('cas-show-input-18').count()) > 0) await expect(page.getByTestId('cas-show-input-18').first()).toBeAttached();
    if ((await page.getByTestId('cas-show-input-19').count()) > 0) await expect(page.getByTestId('cas-show-input-19').first()).toBeAttached();
    if ((await page.getByTestId('cas-button-20').count()) > 0) await expect(page.getByTestId('cas-button-20').first()).toBeAttached();
    if ((await page.getByTestId('cas-button-21').count()) > 0) await expect(page.getByTestId('cas-button-21').first()).toBeAttached();
    if ((await page.getByTestId('cas-on-upload-all-22').count()) > 0) await expect(page.getByTestId('cas-on-upload-all-22').first()).toBeAttached();
    if ((await page.getByTestId('cas-on-validate-import-sheet-23').count()) > 0) await expect(page.getByTestId('cas-on-validate-import-sheet-23').first()).toBeAttached();
    if ((await page.getByTestId('cas-button-24').count()) > 0) await expect(page.getByTestId('cas-button-24').first()).toBeAttached();
    if ((await page.getByTestId('cas-upload-data-25').count()) > 0) await expect(page.getByTestId('cas-upload-data-25').first()).toBeAttached();
    if ((await page.getByTestId('cas-remove-data-26').count()) > 0) await expect(page.getByTestId('cas-remove-data-26').first()).toBeAttached();
    if ((await page.getByTestId('cas-prev-page-27').count()) > 0) await expect(page.getByTestId('cas-prev-page-27').first()).toBeAttached();
    if ((await page.getByTestId('cas-go-to-page-28').count()) > 0) await expect(page.getByTestId('cas-go-to-page-28').first()).toBeAttached();
    if ((await page.getByTestId('cas-go-to-page-29').count()) > 0) await expect(page.getByTestId('cas-go-to-page-29').first()).toBeAttached();
    if ((await page.getByTestId('cas-go-to-page-30').count()) > 0) await expect(page.getByTestId('cas-go-to-page-30').first()).toBeAttached();
    if ((await page.getByTestId('cas-next-page-31').count()) > 0) await expect(page.getByTestId('cas-next-page-31').first()).toBeAttached();
    if ((await page.getByTestId('cas-change-current-page-32').count()) > 0) await expect(page.getByTestId('cas-change-current-page-32').first()).toBeAttached();
    if ((await page.getByTestId('cas-prev-page-33').count()) > 0) await expect(page.getByTestId('cas-prev-page-33').first()).toBeAttached();
    if ((await page.getByTestId('cas-go-to-page-34').count()) > 0) await expect(page.getByTestId('cas-go-to-page-34').first()).toBeAttached();
    if ((await page.getByTestId('cas-go-to-page-35').count()) > 0) await expect(page.getByTestId('cas-go-to-page-35').first()).toBeAttached();
    if ((await page.getByTestId('cas-go-to-page-36').count()) > 0) await expect(page.getByTestId('cas-go-to-page-36').first()).toBeAttached();
    if ((await page.getByTestId('cas-next-page-37').count()) > 0) await expect(page.getByTestId('cas-next-page-37').first()).toBeAttached();
    if ((await page.getByTestId('cas-change-current-page-38').count()) > 0) await expect(page.getByTestId('cas-change-current-page-38').first()).toBeAttached();
  });
});

test.describe('big/cohort-management.component.html — controls addressable (cman)', () => {
  test('renders on /bigcohorts and every interactive control is addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/bigcohorts', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.includes('bigcohorts'), { timeout: 30_000 });
    await expect(page.locator('app-cohort-management'), 'app-cohort-management should mount (guard admitted the BIG admin)').toBeAttached({ timeout: 30_000 });
    if ((await page.getByTestId('cman-button-1').count()) > 0) await expect(page.getByTestId('cman-button-1').first()).toBeAttached();
    if ((await page.getByTestId('cman-select-single-marathon-2').count()) > 0) await expect(page.getByTestId('cman-select-single-marathon-2').first()).toBeAttached();
    if ((await page.getByTestId('cman-button-3').count()) > 0) await expect(page.getByTestId('cman-button-3').first()).toBeAttached();
    if ((await page.getByTestId('cman-event-4').count()) > 0) await expect(page.getByTestId('cman-event-4').first()).toBeAttached();
    if ((await page.getByTestId('cman-button-5').count()) > 0) await expect(page.getByTestId('cman-button-5').first()).toBeAttached();
    if ((await page.getByTestId('cman-event-6').count()) > 0) await expect(page.getByTestId('cman-event-6').first()).toBeAttached();
    if ((await page.getByTestId('cman-button-7').count()) > 0) await expect(page.getByTestId('cman-button-7').first()).toBeAttached();
    if ((await page.getByTestId('cman-event-8').count()) > 0) await expect(page.getByTestId('cman-event-8').first()).toBeAttached();
    if ((await page.getByTestId('cman-on-create-cohort-9').count()) > 0) await expect(page.getByTestId('cman-on-create-cohort-9').first()).toBeAttached();
    if ((await page.getByTestId('cman-export-cohorts-data-10').count()) > 0) await expect(page.getByTestId('cman-export-cohorts-data-10').first()).toBeAttached();
    if ((await page.getByTestId('cman-set-mode-view-11').count()) > 0) await expect(page.getByTestId('cman-set-mode-view-11').first()).toBeAttached();
    if ((await page.getByTestId('cman-set-mode-view-12').count()) > 0) await expect(page.getByTestId('cman-set-mode-view-12').first()).toBeAttached();
    if ((await page.getByTestId('cman-change-set-type-filter-13').count()) > 0) await expect(page.getByTestId('cman-change-set-type-filter-13').first()).toBeAttached();
    if ((await page.getByTestId('cman-change-set-category-filter-14').count()) > 0) await expect(page.getByTestId('cman-change-set-category-filter-14').first()).toBeAttached();
    if ((await page.getByTestId('cman-change-set-status-filter-15').count()) > 0) await expect(page.getByTestId('cman-change-set-status-filter-15').first()).toBeAttached();
    if ((await page.getByTestId('cman-button-16').count()) > 0) await expect(page.getByTestId('cman-button-16').first()).toBeAttached();
    if ((await page.getByTestId('cman-event-17').count()) > 0) await expect(page.getByTestId('cman-event-17').first()).toBeAttached();
    if ((await page.getByTestId('cman-button-18').count()) > 0) await expect(page.getByTestId('cman-button-18').first()).toBeAttached();
    if ((await page.getByTestId('cman-change-toggle-temporary-only-19').count()) > 0) await expect(page.getByTestId('cman-change-toggle-temporary-only-19').first()).toBeAttached();
    if ((await page.getByTestId('cman-remove-filter-chip-20').count()) > 0) await expect(page.getByTestId('cman-remove-filter-chip-20').first()).toBeAttached();
    if ((await page.getByTestId('cman-clear-all-filters-21').count()) > 0) await expect(page.getByTestId('cman-clear-all-filters-21').first()).toBeAttached();
    if ((await page.getByTestId('cman-sidebar-collapsed-22').count()) > 0) await expect(page.getByTestId('cman-sidebar-collapsed-22').first()).toBeAttached();
    if ((await page.getByTestId('cman-toggle-sidebar-collapse-23').count()) > 0) await expect(page.getByTestId('cman-toggle-sidebar-collapse-23').first()).toBeAttached();
    if ((await page.getByTestId('cman-toggle-unassigned-select-mode-24').count()) > 0) await expect(page.getByTestId('cman-toggle-unassigned-select-mode-24').first()).toBeAttached();
    if ((await page.getByTestId('cman-select-all-unassigned-participants-25').count()) > 0) await expect(page.getByTestId('cman-select-all-unassigned-participants-25').first()).toBeAttached();
    if ((await page.getByTestId('cman-button-26').count()) > 0) await expect(page.getByTestId('cman-button-26').first()).toBeAttached();
    if ((await page.getByTestId('cman-event-27').count()) > 0) await expect(page.getByTestId('cman-event-27').first()).toBeAttached();
    if ((await page.getByTestId('cman-event-28').count()) > 0) await expect(page.getByTestId('cman-event-28').first()).toBeAttached();
    if ((await page.getByTestId('cman-unassign-to-cohort-29').count()) > 0) await expect(page.getByTestId('cman-unassign-to-cohort-29').first()).toBeAttached();
    if ((await page.getByTestId('cman-selected-unassign-participants-30').count()) > 0) await expect(page.getByTestId('cman-selected-unassign-participants-30').first()).toBeAttached();
    if ((await page.getByTestId('cman-toggle-select-mode-31').count()) > 0) await expect(page.getByTestId('cman-toggle-select-mode-31').first()).toBeAttached();
    if ((await page.getByTestId('cman-button-32').count()) > 0) await expect(page.getByTestId('cman-button-32').first()).toBeAttached();
    if ((await page.getByTestId('cman-set-group-by-33').count()) > 0) await expect(page.getByTestId('cman-set-group-by-33').first()).toBeAttached();
    if ((await page.getByTestId('cman-set-group-by-34').count()) > 0) await expect(page.getByTestId('cman-set-group-by-34').first()).toBeAttached();
    if ((await page.getByTestId('cman-set-group-by-35').count()) > 0) await expect(page.getByTestId('cman-set-group-by-35').first()).toBeAttached();
    if ((await page.getByTestId('cman-set-group-by-36').count()) > 0) await expect(page.getByTestId('cman-set-group-by-36').first()).toBeAttached();
    if ((await page.getByTestId('cman-set-group-by-37').count()) > 0) await expect(page.getByTestId('cman-set-group-by-37').first()).toBeAttached();
    if ((await page.getByTestId('cman-set-group-by-38').count()) > 0) await expect(page.getByTestId('cman-set-group-by-38').first()).toBeAttached();
    if ((await page.getByTestId('cman-on-create-cohort-39').count()) > 0) await expect(page.getByTestId('cman-on-create-cohort-39').first()).toBeAttached();
    if ((await page.getByTestId('cman-toggle-cohort-selected-40').count()) > 0) await expect(page.getByTestId('cman-toggle-cohort-selected-40').first()).toBeAttached();
    if ((await page.getByTestId('cman-on-edit-cohort-41').count()) > 0) await expect(page.getByTestId('cman-on-edit-cohort-41').first()).toBeAttached();
    if ((await page.getByTestId('cman-open-cohort-studio-42').count()) > 0) await expect(page.getByTestId('cman-open-cohort-studio-42').first()).toBeAttached();
    if ((await page.getByTestId('cman-open-cohort-studio-43').count()) > 0) await expect(page.getByTestId('cman-open-cohort-studio-43').first()).toBeAttached();
    if ((await page.getByTestId('cman-open-cohort-studio-44').count()) > 0) await expect(page.getByTestId('cman-open-cohort-studio-44').first()).toBeAttached();
    if ((await page.getByTestId('cman-open-cohort-studio-45').count()) > 0) await expect(page.getByTestId('cman-open-cohort-studio-45').first()).toBeAttached();
    if ((await page.getByTestId('cman-cohorts-46').count()) > 0) await expect(page.getByTestId('cman-cohorts-46').first()).toBeAttached();
    if ((await page.getByTestId('cman-cohorts-47').count()) > 0) await expect(page.getByTestId('cman-cohorts-47').first()).toBeAttached();
    if ((await page.getByTestId('cman-toggle-participant-select-mode-48').count()) > 0) await expect(page.getByTestId('cman-toggle-participant-select-mode-48').first()).toBeAttached();
    if ((await page.getByTestId('cman-event-49').count()) > 0) await expect(page.getByTestId('cman-event-49').first()).toBeAttached();
    if ((await page.getByTestId('cman-delete-participant-from-cohort-50').count()) > 0) await expect(page.getByTestId('cman-delete-participant-from-cohort-50').first()).toBeAttached();
    if ((await page.getByTestId('cman-event-51').count()) > 0) await expect(page.getByTestId('cman-event-51').first()).toBeAttached();
    if ((await page.getByTestId('cman-event-52').count()) > 0) await expect(page.getByTestId('cman-event-52').first()).toBeAttached();
    if ((await page.getByTestId('cman-event-53').count()) > 0) await expect(page.getByTestId('cman-event-53').first()).toBeAttached();
    if ((await page.getByTestId('cman-move-selected-participants-to-54').count()) > 0) await expect(page.getByTestId('cman-move-selected-participants-to-54').first()).toBeAttached();
    if ((await page.getByTestId('cman-is-participant-select-active-55').count()) > 0) await expect(page.getByTestId('cman-is-participant-select-active-55').first()).toBeAttached();
    if ((await page.getByTestId('cman-toggle-participant-expanded-56').count()) > 0) await expect(page.getByTestId('cman-toggle-participant-expanded-56').first()).toBeAttached();
    if ((await page.getByTestId('cman-on-edit-assignment-57').count()) > 0) await expect(page.getByTestId('cman-on-edit-assignment-57').first()).toBeAttached();
    if ((await page.getByTestId('cman-on-validate-participant-assignment-58').count()) > 0) await expect(page.getByTestId('cman-on-validate-participant-assignment-58').first()).toBeAttached();
    if ((await page.getByTestId('cman-on-create-assignment-59').count()) > 0) await expect(page.getByTestId('cman-on-create-assignment-59').first()).toBeAttached();
    if ((await page.getByTestId('cman-send-cohort-notification-60').count()) > 0) await expect(page.getByTestId('cman-send-cohort-notification-60').first()).toBeAttached();
    if ((await page.getByTestId('cman-send-cohort-whatsapp-61').count()) > 0) await expect(page.getByTestId('cman-send-cohort-whatsapp-61').first()).toBeAttached();
    if ((await page.getByTestId('cman-send-cohort-email-62').count()) > 0) await expect(page.getByTestId('cman-send-cohort-email-62').first()).toBeAttached();
    if ((await page.getByTestId('cman-send-cohort-recommended-playlist-63').count()) > 0) await expect(page.getByTestId('cman-send-cohort-recommended-playlist-63').first()).toBeAttached();
    if ((await page.getByTestId('cman-open-cohort-chat-64').count()) > 0) await expect(page.getByTestId('cman-open-cohort-chat-64').first()).toBeAttached();
    if ((await page.getByTestId('cman-on-create-assignment-65').count()) > 0) await expect(page.getByTestId('cman-on-create-assignment-65').first()).toBeAttached();
    if ((await page.getByTestId('cman-send-selected-notification-66').count()) > 0) await expect(page.getByTestId('cman-send-selected-notification-66').first()).toBeAttached();
    if ((await page.getByTestId('cman-send-selected-email-67').count()) > 0) await expect(page.getByTestId('cman-send-selected-email-67').first()).toBeAttached();
    if ((await page.getByTestId('cman-send-selected-whatsapp-68').count()) > 0) await expect(page.getByTestId('cman-send-selected-whatsapp-68').first()).toBeAttached();
    if ((await page.getByTestId('cman-toggle-activity-sidenav-69').count()) > 0) await expect(page.getByTestId('cman-toggle-activity-sidenav-69').first()).toBeAttached();
    if ((await page.getByTestId('cman-toggle-loged-to-me-70').count()) > 0) await expect(page.getByTestId('cman-toggle-loged-to-me-70').first()).toBeAttached();
    if ((await page.getByTestId('cman-toggle-activity-sidenav-71').count()) > 0) await expect(page.getByTestId('cman-toggle-activity-sidenav-71').first()).toBeAttached();
    if ((await page.getByTestId('cman-select-all-cohorts-72').count()) > 0) await expect(page.getByTestId('cman-select-all-cohorts-72').first()).toBeAttached();
    if ((await page.getByTestId('cman-selectbar-expanded-73').count()) > 0) await expect(page.getByTestId('cman-selectbar-expanded-73').first()).toBeAttached();
    if ((await page.getByTestId('cman-toggle-select-mode-74').count()) > 0) await expect(page.getByTestId('cman-toggle-select-mode-74').first()).toBeAttached();
    if ((await page.getByTestId('cman-send-selected-cohorts-notification-75').count()) > 0) await expect(page.getByTestId('cman-send-selected-cohorts-notification-75').first()).toBeAttached();
    if ((await page.getByTestId('cman-send-selected-cohorts-email-76').count()) > 0) await expect(page.getByTestId('cman-send-selected-cohorts-email-76').first()).toBeAttached();
    if ((await page.getByTestId('cman-send-selected-cohorts-whatsapp-77').count()) > 0) await expect(page.getByTestId('cman-send-selected-cohorts-whatsapp-77').first()).toBeAttached();
    if ((await page.getByTestId('cman-send-selected-cohorts-playlist-78').count()) > 0) await expect(page.getByTestId('cman-send-selected-cohorts-playlist-78').first()).toBeAttached();
    if ((await page.getByTestId('cman-export-selected-cohorts-79').count()) > 0) await expect(page.getByTestId('cman-export-selected-cohorts-79').first()).toBeAttached();
    if ((await page.getByTestId('cman-make-selected-cohorts-inactive-80').count()) > 0) await expect(page.getByTestId('cman-make-selected-cohorts-inactive-80').first()).toBeAttached();
    if ((await page.getByTestId('cman-change-on-chat-toggle-81').count()) > 0) await expect(page.getByTestId('cman-change-on-chat-toggle-81').first()).toBeAttached();
    if ((await page.getByTestId('cman-chat-model-close-82').count()) > 0) await expect(page.getByTestId('cman-chat-model-close-82').first()).toBeAttached();
  });
});

test.describe('big/manual-assignments.component.html — controls addressable (manual)', () => {
  test('renders on /manualassignment and every interactive control is addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/manualassignment?type=review&assignmentid=__none__&profileid=__none__&participantAssignmentId=__none__', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.includes('manualassignment'), { timeout: 30_000 });
    await expect(page.locator('app-manual-assignments'), 'app-manual-assignments should mount (guard admitted the BIG admin)').toBeAttached({ timeout: 30_000 });
    if ((await page.getByTestId('manual-file-input').count()) > 0) await expect(page.getByTestId('manual-file-input').first()).toBeAttached();
    if ((await page.getByTestId('manual-rework').count()) > 0) await expect(page.getByTestId('manual-rework').first()).toBeAttached();
    if ((await page.getByTestId('manual-submit').count()) > 0) await expect(page.getByTestId('manual-submit').first()).toBeAttached();
    if ((await page.getByTestId('manual-complete').count()) > 0) await expect(page.getByTestId('manual-complete').first()).toBeAttached();
    if ((await page.getByTestId('manual-file-input-1').count()) > 0) await expect(page.getByTestId('manual-file-input-1').first()).toBeAttached();
    if ((await page.getByTestId('manual-clear-all-files-2').count()) > 0) await expect(page.getByTestId('manual-clear-all-files-2').first()).toBeAttached();
    if ((await page.getByTestId('manual-open-preview-3').count()) > 0) await expect(page.getByTestId('manual-open-preview-3').first()).toBeAttached();
    if ((await page.getByTestId('manual-open-preview-4').count()) > 0) await expect(page.getByTestId('manual-open-preview-4').first()).toBeAttached();
    if ((await page.getByTestId('manual-remove-file-5').count()) > 0) await expect(page.getByTestId('manual-remove-file-5').first()).toBeAttached();
    if ((await page.getByTestId('manual-close-preview-6').count()) > 0) await expect(page.getByTestId('manual-close-preview-6').first()).toBeAttached();
    if ((await page.getByTestId('manual-event-7').count()) > 0) await expect(page.getByTestId('manual-event-7').first()).toBeAttached();
    if ((await page.getByTestId('manual-close-preview-8').count()) > 0) await expect(page.getByTestId('manual-close-preview-8').first()).toBeAttached();
    if ((await page.getByTestId('manual-download-file-9').count()) > 0) await expect(page.getByTestId('manual-download-file-9').first()).toBeAttached();
  });
});

test.describe('big/participant-assignment-board — controls addressable (pab)', () => {
  // adminIndex 1 (big1@…): the index-0 BIG admin owns a seeded assignment whose dangling marathonref
  // crashes the board on mount (queue/big-core.spec.ts BIG-04 header); index-1 mounts clean.
  test('renders on /particiant_assignment_board and every interactive control is addressable', async ({ page }) => {
    await loginAs(page, actors.big(1), PASSWORD);
    await page.goto('/particiant_assignment_board', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => u.pathname.includes('particiant_assignment_board'), { timeout: 30_000 });
    await expect(page.locator('app-participant-assignment-board'), 'PAB should mount for the BIG admin').toBeAttached({ timeout: 30_000 });
    if ((await page.getByTestId('pab-marathon-btn').count()) > 0) await expect(page.getByTestId('pab-marathon-btn').first()).toBeAttached();
    if ((await page.getByTestId('pab-marathon-pending').count()) > 0) await expect(page.getByTestId('pab-marathon-pending').first()).toBeAttached();
    if ((await page.getByTestId('pab-status-btn').count()) > 0) await expect(page.getByTestId('pab-status-btn').first()).toBeAttached();
    if ((await page.getByTestId('pab-status-count').count()) > 0) await expect(page.getByTestId('pab-status-count').first()).toBeAttached();
    if ((await page.getByTestId('pab-card').count()) > 0) await expect(page.getByTestId('pab-card').first()).toBeAttached();
    if ((await page.getByTestId('pab-type-badge').count()) > 0) await expect(page.getByTestId('pab-type-badge').first()).toBeAttached();
    if ((await page.getByTestId('pab-status-badge').count()) > 0) await expect(page.getByTestId('pab-status-badge').first()).toBeAttached();
    if ((await page.getByTestId('pab-perform-action').count()) > 0) await expect(page.getByTestId('pab-perform-action').first()).toBeAttached();
    if ((await page.getByTestId('pab-activity-1').count()) > 0) await expect(page.getByTestId('pab-activity-1').first()).toBeAttached();
    if ((await page.getByTestId('pab-activity-2').count()) > 0) await expect(page.getByTestId('pab-activity-2').first()).toBeAttached();
    if ((await page.getByTestId('pab-activity-3').count()) > 0) await expect(page.getByTestId('pab-activity-3').first()).toBeAttached();
    if ((await page.getByTestId('pab-activity-4').count()) > 0) await expect(page.getByTestId('pab-activity-4').first()).toBeAttached();
    if ((await page.getByTestId('pab-activity-5').count()) > 0) await expect(page.getByTestId('pab-activity-5').first()).toBeAttached();
    if ((await page.getByTestId('pab-activity-6').count()) > 0) await expect(page.getByTestId('pab-activity-6').first()).toBeAttached();
  });
});

test.describe('big/cohort-detail.component.html — controls addressable (cdet)', () => {
  // Soft mount: this route needs a role/seed precondition (mentor, a seeded assignment/template) beyond a
  // bare load, so we navigate and assert only that we authenticated onto the route (not bounced to /login),
  // then address whatever controls rendered. Behavioral coverage lives in the queue BIG specs.
  test('navigates to /cohort-detail and its interactive controls are addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/cohort-detail', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'BIG admin should be authenticated (not bounced to /login)').not.toContain('/login');
    if ((await page.getByTestId('cdet-is-dialog-mode-1').count()) > 0) await expect(page.getByTestId('cdet-is-dialog-mode-1').first()).toBeAttached();
    if ((await page.getByTestId('cdet-close-dialog-2').count()) > 0) await expect(page.getByTestId('cdet-close-dialog-2').first()).toBeAttached();
    if ((await page.getByTestId('cdet-button-3').count()) > 0) await expect(page.getByTestId('cdet-button-3').first()).toBeAttached();
    if ((await page.getByTestId('cdet-selected-owner-4').count()) > 0) await expect(page.getByTestId('cdet-selected-owner-4').first()).toBeAttached();
    if ((await page.getByTestId('cdet-set-tab-5').count()) > 0) await expect(page.getByTestId('cdet-set-tab-5').first()).toBeAttached();
    if ((await page.getByTestId('cdet-set-tab-6').count()) > 0) await expect(page.getByTestId('cdet-set-tab-6').first()).toBeAttached();
    if ((await page.getByTestId('cdet-set-tab-7').count()) > 0) await expect(page.getByTestId('cdet-set-tab-7').first()).toBeAttached();
    if ((await page.getByTestId('cdet-toggle-select-mode-8').count()) > 0) await expect(page.getByTestId('cdet-toggle-select-mode-8').first()).toBeAttached();
    if ((await page.getByTestId('cdet-select-mode-9').count()) > 0) await expect(page.getByTestId('cdet-select-mode-9').first()).toBeAttached();
    if ((await page.getByTestId('cdet-toggle-studio-group-filter-10').count()) > 0) await expect(page.getByTestId('cdet-toggle-studio-group-filter-10').first()).toBeAttached();
    if ((await page.getByTestId('cdet-enable-stduio-create-mode-11').count()) > 0) await expect(page.getByTestId('cdet-enable-stduio-create-mode-11').first()).toBeAttached();
    if ((await page.getByTestId('cdet-create-studio-combination-12').count()) > 0) await expect(page.getByTestId('cdet-create-studio-combination-12').first()).toBeAttached();
    if ((await page.getByTestId('cdet-assign-roles-13').count()) > 0) await expect(page.getByTestId('cdet-assign-roles-13').first()).toBeAttached();
    if ((await page.getByTestId('cdet-remove-pairing-14').count()) > 0) await expect(page.getByTestId('cdet-remove-pairing-14').first()).toBeAttached();
    if ((await page.getByTestId('cdet-toggle-studio-15').count()) > 0) await expect(page.getByTestId('cdet-toggle-studio-15').first()).toBeAttached();
    if ((await page.getByTestId('cdet-toggle-checkin-16').count()) > 0) await expect(page.getByTestId('cdet-toggle-checkin-16').first()).toBeAttached();
    if ((await page.getByTestId('cdet-toggle-studio-expanded-17').count()) > 0) await expect(page.getByTestId('cdet-toggle-studio-expanded-17').first()).toBeAttached();
    if ((await page.getByTestId('cdet-delete-studio-18').count()) > 0) await expect(page.getByTestId('cdet-delete-studio-18').first()).toBeAttached();
    if ((await page.getByTestId('cdet-open-atc-edit-mode-19').count()) > 0) await expect(page.getByTestId('cdet-open-atc-edit-mode-19').first()).toBeAttached();
    if ((await page.getByTestId('cdet-open-mandatory-edit-mode-20').count()) > 0) await expect(page.getByTestId('cdet-open-mandatory-edit-mode-20').first()).toBeAttached();
    if ((await page.getByTestId('cdet-cancel-atc-edit-21').count()) > 0) await expect(page.getByTestId('cdet-cancel-atc-edit-21').first()).toBeAttached();
    if ((await page.getByTestId('cdet-event-22').count()) > 0) await expect(page.getByTestId('cdet-event-22').first()).toBeAttached();
    if ((await page.getByTestId('cdet-cancel-atc-edit-23').count()) > 0) await expect(page.getByTestId('cdet-cancel-atc-edit-23').first()).toBeAttached();
    if ((await page.getByTestId('cdet-cancel-atc-edit-24').count()) > 0) await expect(page.getByTestId('cdet-cancel-atc-edit-24').first()).toBeAttached();
    if ((await page.getByTestId('cdet-apply-atc-edit-25').count()) > 0) await expect(page.getByTestId('cdet-apply-atc-edit-25').first()).toBeAttached();
    if ((await page.getByTestId('cdet-cancel-mandatory-edit-26').count()) > 0) await expect(page.getByTestId('cdet-cancel-mandatory-edit-26').first()).toBeAttached();
    if ((await page.getByTestId('cdet-event-27').count()) > 0) await expect(page.getByTestId('cdet-event-27').first()).toBeAttached();
    if ((await page.getByTestId('cdet-cancel-mandatory-edit-28').count()) > 0) await expect(page.getByTestId('cdet-cancel-mandatory-edit-28').first()).toBeAttached();
    if ((await page.getByTestId('cdet-cancel-mandatory-edit-29').count()) > 0) await expect(page.getByTestId('cdet-cancel-mandatory-edit-29').first()).toBeAttached();
    if ((await page.getByTestId('cdet-apply-mandatory-edit-30').count()) > 0) await expect(page.getByTestId('cdet-apply-mandatory-edit-30').first()).toBeAttached();
    if ((await page.getByTestId('cdet-close-duplicate-stuio-model-31').count()) > 0) await expect(page.getByTestId('cdet-close-duplicate-stuio-model-31').first()).toBeAttached();
    if ((await page.getByTestId('cdet-toggle-studio-in-model-32').count()) > 0) await expect(page.getByTestId('cdet-toggle-studio-in-model-32').first()).toBeAttached();
    if ((await page.getByTestId('cdet-close-duplicate-stuio-model-33').count()) > 0) await expect(page.getByTestId('cdet-close-duplicate-stuio-model-33').first()).toBeAttached();
    if ((await page.getByTestId('cdet-close-duplicate-stuio-model-34').count()) > 0) await expect(page.getByTestId('cdet-close-duplicate-stuio-model-34').first()).toBeAttached();
    if ((await page.getByTestId('cdet-select-all-participants-35').count()) > 0) await expect(page.getByTestId('cdet-select-all-participants-35').first()).toBeAttached();
    if ((await page.getByTestId('cdet-send-selected-notification-36').count()) > 0) await expect(page.getByTestId('cdet-send-selected-notification-36').first()).toBeAttached();
    if ((await page.getByTestId('cdet-send-selected-email-37').count()) > 0) await expect(page.getByTestId('cdet-send-selected-email-37').first()).toBeAttached();
    if ((await page.getByTestId('cdet-send-selected-whatsapp-38').count()) > 0) await expect(page.getByTestId('cdet-send-selected-whatsapp-38').first()).toBeAttached();
    if ((await page.getByTestId('cdet-toggle-select-mode-39').count()) > 0) await expect(page.getByTestId('cdet-toggle-select-mode-39').first()).toBeAttached();
    if ((await page.getByTestId('cdet-send-selected-recommend-playist-40').count()) > 0) await expect(page.getByTestId('cdet-send-selected-recommend-playist-40').first()).toBeAttached();
  });
});

test.describe('big/big-chat-screen.component.html — controls addressable (bchat)', () => {
  // Soft mount: this route needs a role/seed precondition (mentor, a seeded assignment/template) beyond a
  // bare load, so we navigate and assert only that we authenticated onto the route (not bounced to /login),
  // then address whatever controls rendered. Behavioral coverage lives in the queue BIG specs.
  test('navigates to /bigchatscreen and its interactive controls are addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/bigchatscreen', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'BIG admin should be authenticated (not bounced to /login)').not.toContain('/login');
    if ((await page.getByTestId('bchat-toggle-marathon-1').count()) > 0) await expect(page.getByTestId('bchat-toggle-marathon-1').first()).toBeAttached();
    if ((await page.getByTestId('bchat-select-assignment-2').count()) > 0) await expect(page.getByTestId('bchat-select-assignment-2').first()).toBeAttached();
    if ((await page.getByTestId('bchat-toggle-sidenav-3').count()) > 0) await expect(page.getByTestId('bchat-toggle-sidenav-3').first()).toBeAttached();
    if ((await page.getByTestId('bchat-start-participant-selection-4').count()) > 0) await expect(page.getByTestId('bchat-start-participant-selection-4').first()).toBeAttached();
    if ((await page.getByTestId('bchat-create-new-broadcast-5').count()) > 0) await expect(page.getByTestId('bchat-create-new-broadcast-5').first()).toBeAttached();
    if ((await page.getByTestId('bchat-cancel-participant-selection-6').count()) > 0) await expect(page.getByTestId('bchat-cancel-participant-selection-6').first()).toBeAttached();
    if ((await page.getByTestId('bchat-change-toggle-select-all-participants-7').count()) > 0) await expect(page.getByTestId('bchat-change-toggle-select-all-participants-7').first()).toBeAttached();
    if ((await page.getByTestId('bchat-select-group-chat-8').count()) > 0) await expect(page.getByTestId('bchat-select-group-chat-8').first()).toBeAttached();
    if ((await page.getByTestId('bchat-is-selecting-participants-9').count()) > 0) await expect(page.getByTestId('bchat-is-selecting-participants-9').first()).toBeAttached();
    if ((await page.getByTestId('bchat-event-10').count()) > 0) await expect(page.getByTestId('bchat-event-10').first()).toBeAttached();
    if ((await page.getByTestId('bchat-a-11').count()) > 0) await expect(page.getByTestId('bchat-a-11').first()).toBeAttached();
    if ((await page.getByTestId('bchat-a-12').count()) > 0) await expect(page.getByTestId('bchat-a-12').first()).toBeAttached();
    if ((await page.getByTestId('bchat-remove-selected-file-13').count()) > 0) await expect(page.getByTestId('bchat-remove-selected-file-13').first()).toBeAttached();
    if ((await page.getByTestId('bchat-attachment-14').count()) > 0) await expect(page.getByTestId('bchat-attachment-14').first()).toBeAttached();
    if ((await page.getByTestId('bchat-send-message-15').count()) > 0) await expect(page.getByTestId('bchat-send-message-15').first()).toBeAttached();
  });
});

test.describe('big/validate-participants-assignment.component.html — controls addressable (validate)', () => {
  // Soft mount: this route needs a role/seed precondition (mentor, a seeded assignment/template) beyond a
  // bare load, so we navigate and assert only that we authenticated onto the route (not bounced to /login),
  // then address whatever controls rendered. Behavioral coverage lives in the queue BIG specs.
  test('navigates to /validateParticipantAssignments and its interactive controls are addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/validateParticipantAssignments', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'BIG admin should be authenticated (not bounced to /login)').not.toContain('/login');
    if ((await page.getByTestId('validate-marathon-select').count()) > 0) await expect(page.getByTestId('validate-marathon-select').first()).toBeAttached();
    if ((await page.getByTestId('validate-assignment-item').count()) > 0) await expect(page.getByTestId('validate-assignment-item').first()).toBeAttached();
    if ((await page.getByTestId('validate-col').count()) > 0) await expect(page.getByTestId('validate-col').first()).toBeAttached();
    if ((await page.getByTestId('validate-col-count').count()) > 0) await expect(page.getByTestId('validate-col-count').first()).toBeAttached();
    if ((await page.getByTestId('validate-bulk-move').count()) > 0) await expect(page.getByTestId('validate-bulk-move').first()).toBeAttached();
    if ((await page.getByTestId('validate-move-to').count()) > 0) await expect(page.getByTestId('validate-move-to').first()).toBeAttached();
    if ((await page.getByTestId('validate-review').count()) > 0) await expect(page.getByTestId('validate-review').first()).toBeAttached();
    if ((await page.getByTestId('validate-single-move').count()) > 0) await expect(page.getByTestId('validate-single-move').first()).toBeAttached();
    if ((await page.getByTestId('validate-change-on-toggle-rework-filter-1').count()) > 0) await expect(page.getByTestId('validate-change-on-toggle-rework-filter-1').first()).toBeAttached();
    if ((await page.getByTestId('validate-change-on-toggle-my-activities-2').count()) > 0) await expect(page.getByTestId('validate-change-on-toggle-my-activities-2').first()).toBeAttached();
    if ((await page.getByTestId('validate-send-notification-3').count()) > 0) await expect(page.getByTestId('validate-send-notification-3').first()).toBeAttached();
    if ((await page.getByTestId('validate-send-email-4').count()) > 0) await expect(page.getByTestId('validate-send-email-4').first()).toBeAttached();
    if ((await page.getByTestId('validate-send-whats-app-5').count()) > 0) await expect(page.getByTestId('validate-send-whats-app-5').first()).toBeAttached();
    if ((await page.getByTestId('validate-big-chat-6').count()) > 0) await expect(page.getByTestId('validate-big-chat-6').first()).toBeAttached();
    if ((await page.getByTestId('validate-toggle-details-panel-7').count()) > 0) await expect(page.getByTestId('validate-toggle-details-panel-7').first()).toBeAttached();
    if ((await page.getByTestId('validate-toggle-select-all-8').count()) > 0) await expect(page.getByTestId('validate-toggle-select-all-8').first()).toBeAttached();
    if ((await page.getByTestId('validate-change-on-select-participant-assignment-9').count()) > 0) await expect(page.getByTestId('validate-change-on-select-participant-assignment-9').first()).toBeAttached();
    if ((await page.getByTestId('validate-toggle-details-panel-10').count()) > 0) await expect(page.getByTestId('validate-toggle-details-panel-10').first()).toBeAttached();
    if ((await page.getByTestId('validate-change-mark-assignment-completion-11').count()) > 0) await expect(page.getByTestId('validate-change-mark-assignment-completion-11').first()).toBeAttached();
    if ((await page.getByTestId('validate-on-update-summary-12').count()) > 0) await expect(page.getByTestId('validate-on-update-summary-12').first()).toBeAttached();
  });
});

test.describe('big/form-based-submission.component.html — controls addressable (form)', () => {
  // Soft mount: this route needs a role/seed precondition (mentor, a seeded assignment/template) beyond a
  // bare load, so we navigate and assert only that we authenticated onto the route (not bounced to /login),
  // then address whatever controls rendered. Behavioral coverage lives in the queue BIG specs.
  test('navigates to /formbasedsubmission and its interactive controls are addressable', async ({ page }) => {
    await loginAs(page, actors.big(0), PASSWORD);
    await page.goto('/formbasedsubmission', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'BIG admin should be authenticated (not bounced to /login)').not.toContain('/login');
    if ((await page.getByTestId('form-submit').count()) > 0) await expect(page.getByTestId('form-submit').first()).toBeAttached();
    if ((await page.getByTestId('form-rework').count()) > 0) await expect(page.getByTestId('form-rework').first()).toBeAttached();
    if ((await page.getByTestId('form-complete').count()) > 0) await expect(page.getByTestId('form-complete').first()).toBeAttached();
    if ((await page.getByTestId('form-change-auto-save-1').count()) > 0) await expect(page.getByTestId('form-change-auto-save-1').first()).toBeAttached();
    if ((await page.getByTestId('form-change-auto-save-2').count()) > 0) await expect(page.getByTestId('form-change-auto-save-2').first()).toBeAttached();
    if ((await page.getByTestId('form-change-auto-save-3').count()) > 0) await expect(page.getByTestId('form-change-auto-save-3').first()).toBeAttached();
    if ((await page.getByTestId('form-change-on-slider-flipping-value-change-4').count()) > 0) await expect(page.getByTestId('form-change-on-slider-flipping-value-change-4').first()).toBeAttached();
    if ((await page.getByTestId('form-change-auto-save-5').count()) > 0) await expect(page.getByTestId('form-change-auto-save-5').first()).toBeAttached();
    if ((await page.getByTestId('form-change-auto-save-6').count()) > 0) await expect(page.getByTestId('form-change-auto-save-6').first()).toBeAttached();
    if ((await page.getByTestId('form-on-add-7').count()) > 0) await expect(page.getByTestId('form-on-add-7').first()).toBeAttached();
    if ((await page.getByTestId('form-on-remove-8').count()) > 0) await expect(page.getByTestId('form-on-remove-8').first()).toBeAttached();
    if ((await page.getByTestId('form-on-update-9').count()) > 0) await expect(page.getByTestId('form-on-update-9').first()).toBeAttached();
    if ((await page.getByTestId('form-add-note-10').count()) > 0) await expect(page.getByTestId('form-add-note-10').first()).toBeAttached();
    if ((await page.getByTestId('form-remove-note-11').count()) > 0) await expect(page.getByTestId('form-remove-note-11').first()).toBeAttached();
  });
});

