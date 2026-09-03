// events-stage-data.spec.ts — Events Stage Data wizard: mount + the app-computed cohort-summary count
// (real screen, ANTI-CIRCULAR). Closes the "never opened" gap flagged in the StarLabs route-coverage
// map (2026-09-03) for `/events-stage-data` — the events suite had zero specs touching this route.
//
// Recon: recon-allcomp/events-arena.md (ESD-01)
//
// Anti-circularity: the "Approved" cohort card is not a stored field anywhere — it's computed client-
// side by computeCohortSummary() over the `event participation request` rows it streamed for the
// selected arena event. We assert it against an INDEPENDENT server-side count of the same predicate
// (status:'approved', arenaeventid==ARENAEVT1), never against a value this test wrote.
//
// Selectors were derived from static source review of events-stage-data.component.ts/.html (no Angular
// unit test exists for this screen to cross-check against, and this suite has never opened the route
// before), not from a live DOM — expect to true these up against the emulator on first run.
//
// NO WRITE-PATH TESTS IN THIS FILE: events-stage-data.component.ts contains zero addDoc/setDoc/
// updateDoc/deleteDoc calls (verified by reading the whole file) — journey-group/ready-stage/stage-def/
// eligibility config persists to `localStorage` only (`esd_journeygroups_<arenaeventid>`), never to
// Firestore. This is a genuinely read-only screen; there is no write-path tier to add.
import { test, expect } from '@playwright/test';
import { evtIds, installEvtStubs, loginAsEvtAdmin } from './support/events';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere } from '../queue/support/firestore-admin';

const RUN = process.env.EVT_RUNID || 'evt';
const EVENT_NAME = `TEST Event ${RUN}`;
const PRODUCT_NAME = `TEST Event Product ${RUN}`;
const QUEUE_NAME = `TEST EOD Queue ${RUN}`;

test.describe('Events Stage Data — wizard mount + app-computed cohort summary (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installEvtStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'events-stage-data: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // ESD-01 — walk the 4-step wizard for the seeded event/arena/queue, then assert the app's own
  // "Approved" cohort-summary total against an independently-queried Firestore count.
  // ===========================================================================================
  test('ESD-01 the plan step renders the app-computed "Approved" cohort total (== independent Firestore count)', async ({ page }) => {
    // Oracle (independent computation, not read by the app's own client-side aggregation path):
    // EPR0 + EPR1 are both seeded status:'approved' for ARENAEVT1 (seed-events.js step 6).
    const approvedOracle = await countWhere('event participation request', [
      ['arenaeventid', '==', evtIds.arenaEvent1],
      ['status', '==', 'approved'],
    ]);
    // Floor, not exact equality: event-participation-confirmation.spec.ts's EPC-02 (same seeded world in
    // a full-suite run) approves p6 for real, writing an EXTRA approved EPR with a fresh auto-id and NO
    // testrunid — reseeding can't sweep it, so it can persist across runs. The UI-vs-oracle comparison
    // below stays exact against WHATEVER this count is at run time.
    expect(approvedOracle, 'ESD-01: seeded precondition — at least EPR0 + EPR1 are approved for ARENAEVT1').toBeGreaterThanOrEqual(2);
    // "Prove the filter" doc (mirrors comms' delete:true channeltemplates row): EPR2 shares
    // ARENAEVT1 but is status:'requested' — a same-arena EPR that must never count as "Approved".
    const totalEprForArena = await countWhere('event participation request', [['arenaeventid', '==', evtIds.arenaEvent1]]);
    expect(totalEprForArena, 'ESD-01: EPR2 (requested) must not be counted as approved').toBe(approvedOracle + 1);

    await loginAsEvtAdmin(page);
    await page.goto('/events-stage-data', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/events-stage-data/, { timeout: 30_000 });
    await expect(page.getByText('Events stage data', { exact: true }), 'ESD-01: step 1 heading must render').toBeVisible({ timeout: 30_000 });

    // Step 1 — select the seeded event (plain <table>, not mat-table; row found by seeded name).
    const eventRow = page.locator('tbody tr', { hasText: EVENT_NAME });
    await expect(eventRow, 'ESD-01: the seeded event row must render').toBeVisible({ timeout: 30_000 });
    await eventRow.getByRole('button', { name: 'Select' }).click();

    // Step 2 — select the seeded arena event (row identified by the product name it resolved).
    const arenaRow = page.locator('tbody tr', { hasText: PRODUCT_NAME });
    await expect(arenaRow, 'ESD-01: the seeded arena-event row must render').toBeVisible({ timeout: 30_000 });
    await arenaRow.getByRole('button', { name: 'Select' }).click();

    // Step 3 — check the seeded queue, then continue to the plan.
    const queueChk = page.locator('label.qchk', { hasText: QUEUE_NAME }).locator('input[type="checkbox"]');
    await expect(queueChk, 'ESD-01: the seeded queue checkbox must render').toBeVisible({ timeout: 30_000 });
    await queueChk.check();
    await page.getByRole('button', { name: /Continue to plan/i }).click();

    // Step 4 (plan) — the "Approved" cohort card. Distinct from the sibling "Approved · not in queue"
    // card, which also contains the word "Approved" — exclude it explicitly.
    const approvedCard = page.locator('.cs-stat')
      .filter({ hasText: 'Approved' })
      .filter({ hasNotText: 'not in queue' });
    await expect(approvedCard, 'ESD-01: the Approved cohort card must render').toBeVisible({ timeout: 30_000 });
    const total = approvedCard.locator('.cs-total');
    await expect(total, `ESD-01: Approved card total must equal the independent Firestore count (${approvedOracle})`)
      .toHaveText(String(approvedOracle), { timeout: 20_000 });
  });
});

// ===========================================================================================
// Route-mount smoke — proves the dashboard route-grant seeded (ROUTES in seed-events.js) and the
// guard admits the super-role admin. Mirrors the pattern in events.spec.ts's own smoke block.
// ===========================================================================================
test('events-stage-data route mounts for the super-role admin (no /login bounce)', async ({ page }) => {
  await installEvtStubs(page);
  await loginAsEvtAdmin(page);
  await page.goto('/events-stage-data', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  expect(page.url(), 'events-stage-data must not bounce to /login').not.toMatch(/\/login/);
});
