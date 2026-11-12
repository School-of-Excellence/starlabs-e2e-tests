// delivery-dashboard-stuck.spec.ts — /delivery-dashboard → Participants → Stuck Cases.
// STUCK RULE (starlabs-angular charan-release 2026-11-12, taken from mahalakshmi-development's
// delivery-dashboard-new; journal specs/journals/2026-11-12-pull-joshua-delivery-dashboard-fixes.md):
//   in delivery = status 'ongoing' AND participantsproduct.mode 'priority mode'
//   stuck       = > 15 days since the last ATTENDED appointment (none → since statusdate.ongoing)
//                 AND no future appointment booked. Longest stuck first.
// (Replaced: "initiated|ongoing, last ATTENDED appointment >= 15 days", bb5bca74 — which dropped products
// with no attended appointment.) Plus the Subscription Start / End columns.
//
// Hook prefix: ddc — DeliveryDashboardCloneComponent (same prefix dashboards.spec.ts addresses).
// Reference: starlabs-angular specs/journals/2026-10-01-pull-delivery-dashboard-stuck-cases.md.
//
// SEEDED WORLD (seed-journey.js step 8, seedDdcStuck — own run tag `<run>_ddc`, own DFU product).
// Every PP has a 20-day-old statusdate; all are priority mode except NONPRIO.
//   STALE   ongoing   · attended 18d ago + a newer UNattended appt 2d ago (past) → STUCK, DAYS 18
//   NOAPPT  ongoing   · no appointment                                  → STUCK, DAYS 20 (from statusdate.ongoing)
//   UNATT   ongoing   · only an unattended appt 30d ago                 → STUCK, DAYS 20 (unattended never counts)
//   RECENT  initiated · attended 3d ago                                 → excluded (status)
//   DONE    completed · attended 40d ago                                → excluded (status)
//   FUTURE  ongoing   · attended 25d ago + appt booked 3d AHEAD         → excluded (future booking)
//   NONPRIO ongoing   · Journey Mode · attended 18d ago                 → excluded (not priority mode)
// Each exclusion is a different clause of the rule, so a green run cannot be "nothing to drop": FUTURE is
// stale by days alone and NONPRIO is STALE's exact shape with the wrong mode.
//
// ANTI-CIRCULARITY. The test only clicks and types a name filter. The app derives membership from a
// join it runs itself (participantsproduct.docid ↔ appointments.participantproductid, attended filter,
// newest endtime), the DAYS value from that endtime, and the subscription dates from the PP doc; the
// name comes from `participant metadata`. The test asserts none of the values it wrote except the
// formatted subscription dates, and those only as "the column renders the PP's field".
//
// DDC-FLT (app dfdb6b57, mahalakshmi 2026-10-01, pulled 2026-10-02): the "All" tab (= Awaiting + Initiated
// – Not Consuming + Stuck rows, each with a status) and the Customer Status / Financial Status / Parallel Product
// filters + Clear Filter. In this world the All tab holds four run rows — STALE (Stuck; active, regular,
// parallel product = the NDFU `DDC Parallel Product`), NOAPPT and UNATT (Stuck; active, no finance status, no
// parallel) and RECENT (Initiated – Not Consuming; non active, defaulted, no parallel) — so every filter has rows
// it must keep and rows it must drop.
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

test.describe('Journey — Delivery dashboard Stuck Cases (priority in-delivery, > 15 days since last attended, no future booking; subscription columns)', () => {
  test('DDC-STK-01 stuck = ongoing priority products > 15 days since last attended appointment with nothing booked ahead', async ({ page }) => {
    const panel = await openStuckCases(page);
    const rows = panel.locator('tr.pm-table-row');

    // The appointment join is async and lands after the tab renders; the name filter re-reads the
    // tab's data on every input, so re-type until the app's join has landed.
    await expect(async () => {
      await page.getByTestId('ddc-inp-104').fill('');
      await page.getByTestId('ddc-inp-104').fill(W.tag);
      await expect(rows.filter({ hasText: W.names.STALE })).toHaveCount(1, { timeout: 3_000 });
    }, 'DDC-STK-01: STALE (attended 18d ago) must be a stuck row').toPass({ timeout: 90_000 });

    await expect(rows, 'DDC-STK-01: exactly STALE, NOAPPT and UNATT are stuck').toHaveCount(3);
    for (const k of ['STALE', 'NOAPPT', 'UNATT'] as const) {
      await expect(rows.filter({ hasText: W.names[k] }), `DDC-STK-01: ${k} must be stuck`).toHaveCount(1);
    }
    await expect(rows.filter({ hasText: W.names.RECENT }), 'DDC-STK-01: RECENT is initiated, not in delivery').toHaveCount(0);
    await expect(rows.filter({ hasText: W.names.DONE }), 'DDC-STK-01: DONE is completed').toHaveCount(0);
    await expect(rows.filter({ hasText: W.names.FUTURE }), 'DDC-STK-01: FUTURE has an appointment booked ahead').toHaveCount(0);
    await expect(rows.filter({ hasText: W.names.NONPRIO }), 'DDC-STK-01: NONPRIO is not priority mode').toHaveCount(0);

    // DAYS for STALE comes from the last ATTENDED appointment (18d) — not the newer unattended one (2d), and
    // not the 20-day statusdate that DAYS STUCK (waitingperiod) shows in the same row.
    const stale = rows.filter({ hasText: W.names.STALE }).locator('.pm-days-badge');
    await expect(stale.filter({ hasText: /^\s*18 DAYS\s*$/ }), 'DDC-STK-01: STALE DAYS = since last ATTENDED appointment').toHaveCount(1);
    await expect(stale.filter({ hasText: /^\s*2 DAYS\s*$/ }), 'DDC-STK-01: the unattended 2-day-old appointment is ignored').toHaveCount(0);
    // NOAPPT has no attended appointment → DAYS falls back to statusdate.ongoing (20d), so BOTH badges read 20.
    const noappt = rows.filter({ hasText: W.names.NOAPPT }).locator('.pm-days-badge');
    await expect(noappt.filter({ hasText: /^\s*20 DAYS\s*$/ }), 'DDC-STK-01: NOAPPT DAYS falls back to the ongoing date').toHaveCount(2);
    // Longest stuck first: the 20-day rows sit above STALE's 18.
    await expect(rows.last(), 'DDC-STK-01: sorted longest stuck first').toContainText(W.names.STALE);
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
      await expect(rows).toHaveCount(4, { timeout: 3_000 });
    }, 'the All tab shows the four run rows (STALE, NOAPPT, UNATT stuck + RECENT idle)').toPass({ timeout: 90_000 });
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
    for (const k of ['NOAPPT', 'UNATT'] as const) {
      await expect(rows.filter({ hasText: W.names[k] }), `DDC-FLT-01: ${k} is listed as Stuck`).toContainText('Stuck');
    }
    for (const k of ['DONE', 'FUTURE', 'NONPRIO'] as const) {
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
    await expect(rows).toHaveCount(4);
    await pickFilter(page, page.getByTestId('ddc-msel-126'), 'Regular');
    await only('STALE', 'DDC-FLT-02: Financial Status = Regular keeps STALE only');
    await page.getByTestId('ddc-btn-129').click();

    await page.getByTestId('ddc-inp-104').fill(W.tag);
    await expect(rows).toHaveCount(4);
    await pickFilter(page, page.getByTestId('ddc-msel-127'), 'Parallel Product Available');
    await only('STALE', 'DDC-FLT-02: Parallel Product Available keeps STALE only');
    await pickFilter(page, page.getByTestId('ddc-msel-127'), 'No Parallel Product');
    await expect(rows, 'DDC-FLT-02: No Parallel Product keeps RECENT, NOAPPT and UNATT').toHaveCount(3);
    await expect(rows.filter({ hasText: W.names.STALE }), 'DDC-FLT-02: No Parallel Product drops STALE').toHaveCount(0);
  });

  test.fixme('DDC-ADDR1 All-tab filter-indicator Clear addressable (deferred behavioral — shown only for tile-driven filters)', async ({ page }) => {
    await page.goto('/delivery-dashboard', { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('ddc-btn-128')).toBeTruthy();
  });
});

// DDC-WR (app fe76c262 / 97760808, mahalakshmi 2026-10-26, pulled onto charan-release 2026-11-06 —
// starlabs-angular specs/journals/2026-11-06-pull-mahalakshmi-development.md): the new outer "Weekly
// Report" tab. Its filters and Clear / Export sit behind `*ngIf="weeklyReportCardId"`, so before a product
// is chosen ONLY the product picker may render — that gating is the negative control proved here. The
// filtered report itself (initiated / appointment ranges, booked vs completed) needs a weekly-report seed
// and stays a deferred behavioral case (DDC-ADDR2).
test.describe('Journey — Delivery dashboard Weekly Report tab (product picker gates the filters)', () => {
  test('DDC-WR-01 the Weekly Report tab opens on the product picker; filters, Clear and Export wait for a product', async ({ page }) => {
    await loginAsJourneyAdmin(page);
    await page.goto('/delivery-dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-delivery-dashboard-clone'), 'ddc must mount').toBeAttached({ timeout: 30_000 });
    await page.getByTestId('ddc-btn-130').click();
    await expect(page.getByTestId('ddc-msel-131'), 'DDC-WR-01: the product picker renders').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ddc-msel-136'), 'DDC-WR-01: no status filter before a product').toHaveCount(0);
    await expect(page.getByTestId('ddc-btn-137'), 'DDC-WR-01: no Clear Filter before a product').toHaveCount(0);
    await expect(page.getByTestId('ddc-btn-138'), 'DDC-WR-01: no Export before a product').toHaveCount(0);
  });

  test.fixme('DDC-ADDR2 Weekly Report filters / Clear / Export addressable (deferred behavioral — needs a weekly-report seed)', async ({ page }) => {
    await page.goto('/delivery-dashboard', { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('ddc-inp-132')).toBeTruthy();
    expect(page.getByTestId('ddc-inp-133')).toBeTruthy();
    expect(page.getByTestId('ddc-inp-134')).toBeTruthy();
    expect(page.getByTestId('ddc-inp-135')).toBeTruthy();
    expect(page.getByTestId('ddc-msel-136')).toBeTruthy();
    expect(page.getByTestId('ddc-btn-137')).toBeTruthy();
    expect(page.getByTestId('ddc-btn-138')).toBeTruthy();
  });
});
