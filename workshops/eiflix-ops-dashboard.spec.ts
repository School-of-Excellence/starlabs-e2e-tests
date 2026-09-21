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
import { installWshopStubs, loginAsWshopAdmin, seedLoginLogs, clearLoginLogs, wsMetaNames, alignWorkshopMetadataNames } from './support/wshop';
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

// =============================================================================================
// WS-31 — EiFlix Mobile App Logs: `loginlog` by date range, app == 'EiFlix', name/OS filters,
// search, sort, paging. Preconditions in seedLoginLogs() (six known documents); every assertion is
// on what the APP rendered from them. Names are the CF-owned metadata names (actor emails).
// =============================================================================================
test.describe('Workshops — eiflix operations dashboard: EiFlix Mobile App Logs', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await alignWorkshopMetadataNames();
    await seedLoginLogs();
    await installWshopStubs(page);
  });
  test.afterEach(() => clearLoginLogs());

  test('WS-31 the logs table honours the range, drops other apps, maps names, filters, sorts and pages', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });
    const section = page.getByTestId('eif-logs-section');
    await expect(section, 'WS-31: the section renders after Device Breakdown').toBeVisible({ timeout: 60_000 });
    const rows = section.getByTestId('eif-logs-row');
    const rowFor = (name: string) => rows.filter({ hasText: name });

    // Today (default): the two EiFlix rows dated today; the other-app row is filtered out client-side.
    await expect(section.getByTestId('eif-logs-range-today')).toHaveAttribute('aria-pressed', 'true');
    await expect(rowFor(wsMetaNames.p0), 'WS-31: p0 today').toHaveCount(1, { timeout: 60_000 });
    await expect(rowFor(wsMetaNames.p1), 'WS-31: p1 today').toHaveCount(1);
    await expect(rows.filter({ hasText: '9.9.9' }), 'WS-31: the SolarVoice row never appears').toHaveCount(0);
    await expect(rowFor(wsMetaNames.p2), 'WS-31: the 20-day-old row is outside Today').toHaveCount(0);
    // Name is mapped from participant metadata; the id is shown beneath it.
    await expect(rowFor(wsMetaNames.p0).first()).toContainText('android');
    await expect(rowFor(wsMetaNames.p0).first()).toContainText('2.3.1');

    // 7D adds the 3-day-old p0 row; 30D adds p2's; the 40-day-old one is never in range.
    await section.getByTestId('eif-logs-range-7d').click();
    await expect(rows.filter({ hasText: '2.2.9' }), 'WS-31: 7D includes the 3-day-old row').toHaveCount(1, { timeout: 60_000 });
    await expect(rowFor(wsMetaNames.p2)).toHaveCount(0);
    await section.getByTestId('eif-logs-range-30d').click();
    await expect(rowFor(wsMetaNames.p2), 'WS-31: 30D includes the 20-day-old row').toHaveCount(1, { timeout: 60_000 });
    await expect(rows.filter({ hasText: '2.0.0' }), 'WS-31: 40 days is outside 30D').toHaveCount(0);
    await expect(rows.filter({ hasText: '9.9.9' })).toHaveCount(0);

    // Default sort is newest first: today's rows precede the older ones.
    await expect(rows.first()).not.toContainText('2.2.9');
    await expect(rows.last(), 'WS-31: oldest row last').toContainText(wsMetaNames.p2);

    // Name filter: options are exactly the people in the loaded rows (p0, p1, p2 — three).
    await section.getByTestId('eif-logs-name-filter').click();
    await expect(page.getByTestId('eif-logs-name-option'), 'WS-31: one option per person in range').toHaveCount(3);
    await page.getByTestId('eif-logs-name-option').filter({ hasText: wsMetaNames.p0 }).click();
    await expect(rows, 'WS-31: p0 has two EiFlix rows in 30D').toHaveCount(2, { timeout: 15_000 });
    for (const r of await rows.all()) await expect(r).toContainText(wsMetaNames.p0);

    // OS filter on top of the name filter: p0 on ios → nobody.
    await section.getByTestId('eif-logs-os-filter').click();
    await expect(page.getByTestId('eif-logs-os-option')).toHaveCount(2);         // android, ios
    await page.getByTestId('eif-logs-os-option').filter({ hasText: 'ios' }).click();
    await expect(section.locator('.eod-log-none'), 'WS-31: empty state inside the table').toBeVisible({ timeout: 15_000 });
    await expect(section.getByTestId('eif-logs-clear')).toContainText('2');
    await section.getByTestId('eif-logs-clear').click();
    await expect(rows).toHaveCount(4, { timeout: 15_000 });

    // Search narrows across columns.
    await section.getByTestId('eif-logs-search').fill('2.3.1');
    await expect(rows, 'WS-31: two rows carry version 2.3.1').toHaveCount(2, { timeout: 15_000 });
    await section.getByTestId('eif-logs-search').fill('');
    await expect(rows).toHaveCount(4, { timeout: 15_000 });

    // Sort by version ascending: 2.2.9 first.
    await section.getByTestId('eif-logs-sort-version').click();
    await expect(rows.first(), 'WS-31: version ascending').toContainText('2.2.9');
    await section.getByTestId('eif-logs-sort-version').click();
    await expect(rows.first(), 'WS-31: version descending').toContainText('2.3.1');
    await section.getByTestId('eif-logs-sort-date').click();

    // Paging: 10 rows per page → the four fit on one page; the label and buttons agree.
    await section.getByTestId('eif-logs-page-size').selectOption('10');
    await expect(section.getByTestId('eif-logs-page-label')).toContainText('1–4 of 4');
    await expect(section.getByTestId('eif-logs-prev')).toBeDisabled();
    await expect(section.getByTestId('eif-logs-next')).toBeDisabled();
    expect(section.getByTestId('eif-logs-count')).toBeTruthy();
    expect(section.getByTestId('eif-logs-sort-name')).toBeTruthy();
    expect(section.getByTestId('eif-logs-sort-os')).toBeTruthy();
  });
});
