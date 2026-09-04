// eiflix-home-config.spec.ts — /eiflixhomeconfig (New-Workshop/upcomingworkshops).
//
// Recon: e2e/recon-allcomp/workshops.md "Addendum — 2026-09-04" (WS-18 / WS-19).
//
// The screen reads ONE collection (`eiflixhomewidgets`) and partitions it CLIENT-SIDE by `widgettype`
// into the "Upcoming Workshops" and "Ads" tabs (upcomingworkshops.component.ts:129,133). The route has
// NO canActivate (app.routes.ts:286), so nothing here asserts reachability.
//
// Anti-circularity — why the 'ads' doc must exist:
//   WS-18 asserts an ads-typed widget does NOT appear in the comingsoon tab. With no ads doc seeded,
//   that assertion passes trivially whether or not the partition runs. The seeded ads widget is the
//   negative control that makes the filter falsifiable.
import { test, expect } from '@playwright/test';
import {
  wsAddIds, wsAddNames, installWshopStubs, loginAsWshopAdmin, resetHomeWidgetAds,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil } from '../queue/support/firestore-admin';

/** Open the "Upcoming Workshops" tab — tab 1 is "Create / Assign EiFlix Home", not a table. */
async function openComingSoonTab(page: import('@playwright/test').Page) {
  await page.getByRole('tab', { name: 'Upcoming Workshops' }).click();
  await expect(page.locator('table.upcoming-table').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('Workshops — eiflix home config (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'eiflixhomeconfig: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // WS-18 — the widgettype partition is real: comingsoon renders, ads does NOT (same collection)
  // ===========================================================================================
  test('WS-18 the comingsoon tab shows comingsoon widgets and excludes ads widgets', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixhomeconfig', { waitUntil: 'domcontentloaded' });
    await openComingSoonTab(page);

    // [REAL-UI] the comingsoon-typed widget the app drew from its stream.
    await expect(
      page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: wsAddNames.hwFirst }),
      'WS-18: a widgettype:comingsoon widget must render in the Upcoming Workshops tab',
    ).toHaveCount(1, { timeout: 30_000 });

    // [ASSERT] the ads-typed widget from the SAME collection must be absent here. This is the whole
    // case: both docs live in `eiflixhomewidgets`, so the only thing that can keep them apart is the
    // app's own `w.widgettype === 'comingsoon'` filter (ts:129).
    await expect(
      page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: wsAddNames.hwAds }),
      'WS-18: a widgettype:ads widget must NOT leak into the comingsoon tab (partition, ts:129)',
    ).toHaveCount(0);

    // And it IS present in the Ads tab — proving the doc exists and only the partition moved it.
    await page.getByRole('tab', { name: 'Ads' }).click();
    await expect(
      page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: wsAddNames.hwAds }),
      'WS-18: the same ads widget MUST render in the Ads tab (proves it was seeded, not missing)',
    ).toHaveCount(1, { timeout: 30_000 });
  });

  // ===========================================================================================
  // WS-19 — rows render in `order` sequence; a widget with NO order field sorts last
  // ===========================================================================================
  test('WS-19 comingsoon rows sort by order, and an order-less widget sorts last', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixhomeconfig', { waitUntil: 'domcontentloaded' });
    await openComingSoonTab(page);

    await expect(
      page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: wsAddNames.hwFirst }),
    ).toHaveCount(1, { timeout: 30_000 });

    // [ASSERT] read the rendered row sequence and check OUR three widgets' relative positions. The seed
    // stores order:1, order:2 and NO order at all; the sequence is the app's sort (ts:130) with
    // orderOf() falling back to MAX_SAFE_INTEGER for the missing field (ts:260). The "sorts last"
    // behaviour is a real branch — it is only observable because one seeded doc omits `order`.
    const rows = await page.locator('table.upcoming-table tr.mat-mdc-row, table.upcoming-table tr[mat-row]').allTextContents();
    const idx = (needle: string) => rows.findIndex((r) => r.includes(needle));
    const iFirst = idx(wsAddNames.hwFirst);
    const iSecond = idx(wsAddNames.hwSecond);
    const iUnordered = idx(wsAddNames.hwUnordered);

    expect(iFirst, 'WS-19: the order:1 widget rendered').toBeGreaterThanOrEqual(0);
    expect(iSecond, 'WS-19: the order:2 widget rendered').toBeGreaterThanOrEqual(0);
    expect(iUnordered, 'WS-19: the order-less widget rendered').toBeGreaterThanOrEqual(0);
    expect(iFirst, `WS-19: order:1 (${iFirst}) must precede order:2 (${iSecond})`).toBeLessThan(iSecond);
    expect(
      iSecond,
      `WS-19: order:2 (${iSecond}) must precede the order-less widget (${iUnordered}) — orderOf() falls back to MAX_SAFE_INTEGER`,
    ).toBeLessThan(iUnordered);
  });

  // ===========================================================================================
  // WS-20 — deleting a widget accepts the confirm() and removes the doc (write path)
  // ===========================================================================================
  // DIALOG TRAP: deleteFrom() early-returns unless window.confirm returns true (ts:381). Playwright
  // AUTO-DISMISSES an unhandled dialog, so with no handler the deleteDoc never runs and a test that
  // merely checked "no error appeared" would still go green. The handler is registered before the
  // click, and the assertion is the Firestore post-state — which an auto-dismissed dialog cannot produce.
  //
  // Deletes the ADS widget rather than a comingsoon one: it is the disposable member of the seed (its
  // other job, as WS-18's negative control, is re-established by the reset helper on every run).
  test('WS-20 deleting an ads widget removes the eiflixhomewidgets doc', async ({ page }) => {
    // [PRECONDITION] re-create the target so the case is order- and re-run-independent.
    await resetHomeWidgetAds();
    const before = await getDoc('eiflixhomewidgets', wsAddIds.HW_ADS);
    expect(before, 'WS-20: the delete target must exist before the action').toBeTruthy();

    await loginAsWshopAdmin(page);
    await page.goto('/eiflixhomeconfig', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Ads' }).click();

    const row = page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: wsAddNames.hwAds });
    await expect(row, 'WS-20: the ads row must render').toHaveCount(1, { timeout: 30_000 });

    page.once('dialog', (d) => d.accept());   // deleteFrom()'s confirm (ts:381) — see DIALOG TRAP above
    await row.locator('button.del-btn').click();

    // [ASSERT] the doc is gone — the post-state the APP produced via deleteDoc (ts:383).
    const after = await pollUntil(
      () => getDoc('eiflixhomewidgets', wsAddIds.HW_ADS),
      (d) => d === null,
      { label: 'WS-20: eiflixhomewidgets doc deleted by the app', timeoutMs: 30_000 },
    );
    expect(after, 'WS-20: the app deleted the widget doc').toBeNull();
    await expect(row, 'WS-20: the deleted row must leave the table').toHaveCount(0, { timeout: 15_000 });

    // Restore it so a later WS-18 run still has its negative control (suite order is serial, but this
    // keeps the file independent of ordering).
    await resetHomeWidgetAds();
  });
});
