// event-participation-confirmation.spec.ts — Event Participation Confirmations overview + product
// funnel: mount + the app-computed "Potential" and "Approved" funnel counts (real UI, ANTI-CIRCULAR).
// Closes the "never opened" gap flagged in the StarLabs route-coverage map (2026-09-03) for
// `/event-participation-confirmation`.
//
// Anti-circularity: `counts.potential`/`counts.approved` in product-funnel.component.ts are not stored
// fields — they're computed client-side from joined `participantsproduct`/`event participation
// request` reads. We assert them against INDEPENDENT server-side counts of the same predicates, never
// against a value this test wrote.
//
// Selectors were derived from static source review of event-participation-confirmations.component.ts
// and product-funnel.component.ts/.html (no Angular unit test exists for either to cross-check
// against, and this suite has never opened the route before), not from a live DOM — expect to true
// these up against the emulator on first run.
import { test, expect } from '@playwright/test';
import { evtIds, installEvtStubs, loginAsEvtAdmin, refTo } from './support/events';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere } from '../queue/support/firestore-admin';

const RUN = process.env.EVT_RUNID || 'evt';
const EVENT_NAME = `TEST Event ${RUN}`;
const PRODUCT_NAME = `TEST Event Product ${RUN}`;

test.describe('Event Participation Confirmations — overview + funnel (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installEvtStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'event-participation-confirmation: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // EPC-01 — open the seeded arena's funnel and assert the app's own "Potential" + "Approved"
  // segment counts against independent Firestore counts of the same predicates.
  // ===========================================================================================
  test('EPC-01 the product funnel renders the app-computed Potential + Approved counts (== independent Firestore counts)', async ({ page }) => {
    // Oracles (independent computation):
    // - "Potential" = participantsproduct where productref==P1 && status==null. Only PP_EPC (p6)
    //   matches — p0/p1 are already "approved" via an EPR but carry no participantsproduct doc.
    const potentialOracle = await countWhere('participantsproduct', [
      ['productref', '==', refTo('products', evtIds.product1)],
      ['status', '==', null],
    ]);
    expect(potentialOracle, 'EPC-01: seeded precondition — PP_EPC is the sole owner-with-no-EPR row').toBe(1);
    // - "Approved" = event participation request where arenaeventid==ARENAEVT1 && status=='approved'.
    const approvedOracle = await countWhere('event participation request', [
      ['arenaeventid', '==', evtIds.arenaEvent1],
      ['status', '==', 'approved'],
    ]);
    expect(approvedOracle, 'EPC-01: seeded precondition — EPR0 + EPR1 are approved').toBe(2);

    await loginAsEvtAdmin(page);
    await page.goto('/event-participation-confirmation', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/event-participation-confirmation/, { timeout: 30_000 });
    await expect(page.getByText('Event participation confirmations', { exact: true }), 'EPC-01: overview heading must render')
      .toBeVisible({ timeout: 30_000 });

    // [REAL-UI] the overview row is a keyboard-activatable "button" role, aria-labelled by the app
    // with the product + event name it resolved from the arena/product docs it streamed.
    const row = page.getByRole('button', { name: `Open ${PRODUCT_NAME} ${EVENT_NAME}` });
    await expect(row, 'EPC-01: the seeded arena row must render on the overview').toBeVisible({ timeout: 30_000 });
    await row.click();

    // The funnel opens in its own dynamic tab (tab label combines product + event name).
    const funnelTab = page.getByRole('tab', { name: new RegExp(PRODUCT_NAME) });
    await expect(funnelTab, 'EPC-01: the funnel tab must open').toBeVisible({ timeout: 30_000 });

    // [ASSERT] the app-computed "Potential" and "Approved" funnel cards.
    const potentialCard = page.locator('button.sx-bd-row').filter({ hasText: 'Potential' });
    await expect(potentialCard, 'EPC-01: the Potential funnel card must render').toBeVisible({ timeout: 30_000 });
    await expect(potentialCard.locator('.sx-bd-num'), `EPC-01: Potential must equal the independent count (${potentialOracle})`)
      .toHaveText(String(potentialOracle), { timeout: 20_000 });

    const approvedCard = page.locator('button.sx-bd-row').filter({ hasText: 'Approved' }).filter({ hasNotText: 'not' });
    await expect(approvedCard, 'EPC-01: the Approved funnel card must render').toBeVisible({ timeout: 20_000 });
    await expect(approvedCard.locator('.sx-bd-num'), `EPC-01: Approved must equal the independent count (${approvedOracle})`)
      .toHaveText(String(approvedOracle), { timeout: 20_000 });
  });
});

// ===========================================================================================
// Route-mount smoke — proves the dashboard route-grant seeded (ROUTES in seed-events.js) and the
// guard admits the super-role admin.
// ===========================================================================================
test('event-participation-confirmation route mounts for the super-role admin (no /login bounce)', async ({ page }) => {
  await installEvtStubs(page);
  await loginAsEvtAdmin(page);
  await page.goto('/event-participation-confirmation', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  expect(page.url(), 'event-participation-confirmation must not bounce to /login').not.toMatch(/\/login/);
});
