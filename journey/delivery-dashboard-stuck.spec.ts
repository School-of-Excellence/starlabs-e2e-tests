// delivery-dashboard-stuck.spec.ts — /delivery-dashboard → Participants → Stuck Cases, after the
// "stuck = last ATTENDED appointment >= 15 days ago" rule (starlabs-angular bb5bca74, mahalakshmi
// 2026-09-29, pulled onto charan-release 2026-10-01) and the new Subscription Start / End columns.
//
// Hook prefix: ddc — DeliveryDashboardCloneComponent (same prefix dashboards.spec.ts addresses).
// Reference: starlabs-angular specs/journals/2026-10-01-pull-delivery-dashboard-stuck-cases.md.
//
// SEEDED WORLD (seed-journey.js step 8, seedDdcStuck — own run tag `<run>_ddc`, own DFU product):
//   STALE   ongoing   · attended appt 18d ago + a newer UNattended appt 2d ago → the ONLY stuck row
//   RECENT  initiated · attended appt 3d ago                                   → excluded
//   NOAPPT  ongoing   · no appointment                                         → excluded
//   UNATT   ongoing   · only an unattended appt 30d ago                        → excluded
//   DONE    completed · attended appt 40d ago                                  → excluded (status)
// Every PP has a 20-day-old statusdate, so under the PREVIOUS rule (15 days since statusdate) all four
// active controls would be stuck: a green run cannot be the old rule, nor "there was nothing to drop".
//
// ANTI-CIRCULARITY. The test only clicks and types a name filter. The app derives membership from a
// join it runs itself (participantsproduct.docid ↔ appointments.participantproductid, attended filter,
// newest endtime), the DAYS value from that endtime, and the subscription dates from the PP doc; the
// name comes from `participant metadata`. The test asserts none of the values it wrote except the
// formatted subscription dates, and those only as "the column renders the PP's field".
//
// DDC-FLT (app dfdb6b57, mahalakshmi 2026-10-01, pulled 2026-10-02): the new "All" tab (= Awaiting + Initiated
// – Not Consuming + Stuck rows, each with a status) and the Customer Status / Financial Status / Parallel Product
// filters + Clear Filter. In this world the All tab holds exactly two run rows — STALE (Stuck; active, regular,
// parallel product = the NDFU `DDC Parallel Product`) and RECENT (Initiated – Not Consuming; non active,
// defaulted, no parallel) — so every filter has one row it must keep and one it must drop.
//
// NOT COVERED: the participant-set cache (stuckKey) — it only changes WHEN the appointment read re-runs,
// which no assertion here can observe without counting reads. Subscription columns on the other three
// tables use the same header/row path; Stuck Cases is the one asserted.
import { test, expect, Page } from '@playwright/test';
import { installJourneyStubs, attachJourneyGuard, loginAsJourneyAdmin, ddcStuckWorld as W } from './support/journey';
import { assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

let guard: ConsoleGuard;
test.beforeEach(async ({ page }) => {
  guard = attachJourneyGuard(page);
  await installJourneyStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'delivery dashboard stuck cases: no fatal console errors / pageerrors'));

/** Open /delivery-dashboard → Participants → Stuck Cases; returns the Stuck Cases tab panel. Inactive
 *  panels keep their (identical) table in the DOM, so everything is scoped to this panel. */
async function openStuckCases(page: Page) {
  await loginAsJourneyAdmin(page);
  await page.goto('/delivery-dashboard', { waitUntil: 'domcontentloaded' });
  const host = page.locator('app-delivery-dashboard-clone');
  await expect(host, 'ddc must mount').toBeAttached({ timeout: 30_000 });
  await page.getByTestId('ddc-btn-017').click();   // outer tab strip: custom buttons, not mat-tabs
  await host.getByRole('tab', { name: /Stuck Cases/ }).click();
  const panel = host.getByRole('tabpanel', { name: /Stuck Cases/ });
  await expect(panel.locator('.pm-data-table th').filter({ hasText: 'SUBSCRIPTION START' }), 'the Stuck Cases headers render').toBeVisible({ timeout: 30_000 });
  return panel;
}

test.describe('Journey — Delivery dashboard Stuck Cases (last attended appointment >= 15 days; subscription columns)', () => {
  test('DDC-STK-01 only the participant whose last ATTENDED appointment is >= 15 days old is stuck', async ({ page }) => {
    const panel = await openStuckCases(page);
    const rows = panel.locator('tr.pm-table-row');

    // The appointment join is async and lands after the tab renders; the name filter re-reads the
    // tab's data on every input, so re-type until the app's join has landed.
    await expect(async () => {
      await page.getByTestId('ddc-inp-104').fill('');
      await page.getByTestId('ddc-inp-104').fill(W.tag);
      await expect(rows.filter({ hasText: W.names.STALE })).toHaveCount(1, { timeout: 3_000 });
    }, 'DDC-STK-01: STALE (attended 18d ago) must be a stuck row').toPass({ timeout: 90_000 });

    await expect(rows, 'DDC-STK-01: exactly one of the five seeded participants is stuck').toHaveCount(1);
    for (const k of ['RECENT', 'NOAPPT', 'UNATT', 'DONE'] as const) {
      await expect(rows.filter({ hasText: W.names[k] }), `DDC-STK-01: ${k} must not be stuck`).toHaveCount(0);
    }
    // DAYS comes from the last ATTENDED appointment (18d) — not the newer unattended one (2d), and not
    // the 20-day statusdate that DAYS STUCK (waitingperiod) shows in the same row.
    const badges = rows.first().locator('.pm-days-badge');
    await expect(badges.filter({ hasText: /^\s*18 DAYS\s*$/ }), 'DDC-STK-01: DAYS is counted from the last ATTENDED appointment').toHaveCount(1);
    await expect(badges.filter({ hasText: /^\s*2 DAYS\s*$/ }), 'DDC-STK-01: the unattended 2-day-old appointment is ignored').toHaveCount(0);
  });

  test('DDC-STK-02 the stuck row renders the PP subscription start and end dates', async ({ page }) => {
    const panel = await openStuckCases(page);
    await expect(panel.locator('.pm-data-table th').filter({ hasText: 'SUBSCRIPTION END' })).toBeVisible();
    const row = panel.locator('tr.pm-table-row').filter({ hasText: W.names.STALE });
    await expect(async () => {
      await page.getByTestId('ddc-inp-104').fill('');
      await page.getByTestId('ddc-inp-104').fill(W.names.STALE);
      await expect(row).toHaveCount(1, { timeout: 3_000 });
    }).toPass({ timeout: 90_000 });
    await expect(row.locator('.pm-date-text').filter({ hasText: W.subscription.start }), 'DDC-STK-02: SUBSCRIPTION START').toHaveCount(1);
    await expect(row.locator('.pm-date-text').filter({ hasText: W.subscription.end }), 'DDC-STK-02: SUBSCRIPTION END').toHaveCount(1);
  });
});

/** Open a mat-select from the keyboard and pick one option by its visible text. Takes a Locator (gate rule). */
async function pickFilter(page: Page, select: import('@playwright/test').Locator, option: string) {
  await select.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('option', { name: option, exact: true }).click();
  await page.keyboard.press('Escape');
}

test.describe('Journey — Delivery dashboard All tab + filters (customer status, financial status, parallel product)', () => {
  /** Open Participants → All, narrow to the run, and wait for BOTH run rows (the Stuck one lands async). */
  async function openAll(page: Page) {
    await loginAsJourneyAdmin(page);
    await page.goto('/delivery-dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-delivery-dashboard-clone')).toBeAttached({ timeout: 30_000 });
    await page.getByTestId('ddc-btn-017').click();
    const host = page.locator('app-delivery-dashboard-clone');
    await host.getByRole('tab', { name: /^All/ }).click();
    const panel = host.getByRole('tabpanel', { name: /^All/ });
    const rows = panel.locator('tr.pm-table-row');
    await expect(async () => {
      await page.getByTestId('ddc-inp-104').fill('');
      await page.getByTestId('ddc-inp-104').fill(W.tag);
      await expect(rows).toHaveCount(2, { timeout: 3_000 });
    }, 'the All tab shows the two run rows (STALE stuck + RECENT idle)').toPass({ timeout: 90_000 });
    return rows;
  }

  test('DDC-FLT-01 the All tab lists every actionable row with its status and parallel product', async ({ page }) => {
    const rows = await openAll(page);
    const stale = rows.filter({ hasText: W.names.STALE });
    const recent = rows.filter({ hasText: W.names.RECENT });
    await expect(stale, 'DDC-FLT-01: STALE is listed as Stuck').toContainText('Stuck');
    await expect(stale, 'DDC-FLT-01: STALE shows its parallel product').toContainText(W.parallel);
    await expect(recent, 'DDC-FLT-01: RECENT is listed as Initiated – Not Consuming').toContainText('Initiated – Not Consuming');
    await expect(recent, 'DDC-FLT-01: RECENT has no parallel product').not.toContainText(W.parallel);
    for (const k of ['NOAPPT', 'UNATT', 'DONE'] as const) {
      await expect(rows.filter({ hasText: W.names[k] }), `DDC-FLT-01: ${k} is in no actionable bucket`).toHaveCount(0);
    }
  });

  test('DDC-FLT-02 each filter keeps its match, drops the other, and Clear Filter resets them all', async ({ page }) => {
    const rows = await openAll(page);
    const only = async (k: 'STALE' | 'RECENT', why: string) => {
      await expect(rows, why).toHaveCount(1);
      await expect(rows.first(), why).toContainText(W.names[k]);
    };

    await pickFilter(page, page.getByTestId('ddc-msel-125'), 'Non-active');
    await only('RECENT', 'DDC-FLT-02: Customer Status = Non-active keeps RECENT only');
    await page.getByTestId('ddc-btn-129').click();
    await expect(page.getByTestId('ddc-inp-104'), 'DDC-FLT-02: Clear Filter also clears the search').toHaveValue('');

    await page.getByTestId('ddc-inp-104').fill(W.tag);
    await expect(rows).toHaveCount(2);
    await pickFilter(page, page.getByTestId('ddc-msel-126'), 'Regular');
    await only('STALE', 'DDC-FLT-02: Financial Status = Regular keeps STALE only');
    await page.getByTestId('ddc-btn-129').click();

    await page.getByTestId('ddc-inp-104').fill(W.tag);
    await expect(rows).toHaveCount(2);
    await pickFilter(page, page.getByTestId('ddc-msel-127'), 'Parallel Product Available');
    await only('STALE', 'DDC-FLT-02: Parallel Product Available keeps STALE only');
    await pickFilter(page, page.getByTestId('ddc-msel-127'), 'No Parallel Product');
    await only('RECENT', 'DDC-FLT-02: No Parallel Product keeps RECENT only');
  });

  test.fixme('DDC-ADDR1 All-tab filter-indicator Clear addressable (deferred behavioral — shown only for tile-driven filters)', async ({ page }) => {
    await page.goto('/delivery-dashboard', { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('ddc-btn-128')).toBeTruthy();
  });
});
