// eiflix-ops-dashboard.spec.ts — /eiflixoperationsdashboard (New-Workshop/eiflixoperationsdashboard).
//
// Recon: e2e/recon-allcomp/workshops.md "Addendum — 2026-09-04" (WS-30).
//
// This route carries authGuard (app.routes.ts:295), so the seeded dashboard grant is load-bearing.
//
// ORACLE shape: the screen aggregates its own `new_user_data` reads into the "Total New Users" headline
// card (ts:136-138). The test computes the same population INDEPENDENTLY with an Admin-SDK countWhere
// and requires the rendered number to be at least that. Two separate computations over one seeded
// population — the test never reads the app's number back into its own expectation.
//
// Lower bound rather than equality on purpose: the emulator's `new_user_data` also holds docs from other
// suites' runs, which the app legitimately counts and our run-scoped count does not. An upper bound
// would make this test fail whenever an unrelated suite seeded first; the floor still fails if the app
// stops aggregating.
//
// SIDE EFFECT (recon Risk #14): rendering this screen WRITES an `eiflixdailywatchers` rollup keyed by a
// shared day id (ts:1227/1247). Nothing here asserts on it; teardown removes what the run created.
import { test, expect } from '@playwright/test';
import { installWshopStubs, loginAsWshopAdmin } from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere } from '../queue/support/firestore-admin';

const RUN = process.env.WSHOP_RUNID || 'wshop';

test.describe('Workshops — eiflix operations dashboard (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() =>
    // The dashboard's content-analytics panels query date windows that are empty on a freshly-seeded
    // emulator; those reads log benign errors that are not the behaviour under test.
    assertNoFatal(guard, 'eiflixoperationsdashboard: no fatal console errors / pageerrors', [
      /content analytics/i,
      /eiflixdailywatchers/i,
    ]));

  // ===========================================================================================
  // WS-30 — the headline new-user count matches an independent Firestore count of the same population
  // ===========================================================================================
  test('WS-30 the Total New Users card counts at least the seeded new_user_data population', async ({ page }) => {
    // [ORACLE] computed by the TEST, from Firestore, before the app is asked anything.
    const seeded = await countWhere('new_user_data', [['testrunid', '==', RUN]]);
    expect(seeded, 'WS-30: precondition — 3 seeded new users for this run').toBe(3);

    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });

    // [REAL-UI] the Users section renders one .eod-card per aggregate the component built.
    const totalCard = page.locator('button.eod-card').filter({ hasText: 'Total New Users' });
    await expect(totalCard, 'WS-30: the Total New Users card must render').toBeVisible({ timeout: 45_000 });

    // READINESS: the card is NOT settled the moment it becomes visible. The template swaps its skeleton
    // for `.eod-count` as soon as cardLoading(card) goes false (html:44-48), but the aggregation that
    // fills the count resolves later — so there is a real window in which the card renders a literal 0.
    // Reading once inside that window is what made an earlier version of this case pass in isolation and
    // fail in a full-suite run (the dashboard settles more slowly with more data in the emulator).
    // Polling is the fix; it is not circular — if the app never aggregates, the count stays 0 and this
    // fails at the timeout exactly as it should.
    await expect
      .poll(
        async () => {
          const t = await totalCard.locator('.eod-count').first().innerText().catch(() => '');
          return Number(t.replace(/[^\d]/g, '')) || 0;   // the `number` pipe adds grouping separators
        },
        {
          message: `WS-30: the app-aggregated Total New Users count must reach >= the independently-counted seeded population (${seeded})`,
          timeout: 60_000,
        },
      )
      .toBeGreaterThanOrEqual(seeded);
  });
});
