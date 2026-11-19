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
// RULE since 2026-11-19 (operator): > 7 days since the last BOOKED appointment (latest non-cancelled one that has
// started, attended or not; none → since statusdate.ongoing) and nothing booked ahead. Every PP has a 20-day-old
// statusdate; all are priority mode except NONPRIO.
//   UNATT   ongoing   · only an unattended appt 30d ago                 → STUCK 30 (appointment, Not attended)
//   NOAPPT  ongoing   · no appointment                                  → STUCK 20 (status basis, '*')
//   MID     ongoing   · attended 10d ago                                → STUCK 10 (only under > 7 — threshold control)
//   STALE   ongoing   · attended 18d ago + unattended booking 2d ago    → excluded (the newer booking resets the clock)
//   RECENT  initiated · attended 3d ago                                 → excluded (status)
//   DONE    completed · attended 40d ago                                → excluded (status)
//   FUTURE  ongoing   · attended 25d ago + appt booked 3d AHEAD         → excluded (future booking)
//   NONPRIO ongoing   · Journey Mode · attended 18d ago                 → excluded (not priority mode)
// Each exclusion is a different clause of the rule, so a green run cannot be "nothing to drop": FUTURE is
// stale by days alone, NONPRIO is stale with the wrong mode, STALE is stale only by its last ATTENDED appointment.
//
// ANTI-CIRCULARITY. The test only clicks and types a name filter. The app derives membership from a
// join it runs itself (participantsproduct.docid ↔ appointments.participantproductid, attended filter,
// newest endtime), the DAYS value from that endtime, and the subscription dates from the PP doc; the
// name comes from `participant metadata`. The test asserts none of the values it wrote except the
// formatted subscription dates, and those only as "the column renders the PP's field".
//
// DDC-FLT (app dfdb6b57, mahalakshmi 2026-10-01, pulled 2026-10-02): the "All" tab (= Awaiting + Initiated
// – Not Consuming + Stuck rows, each with a status) and the Customer Status / Financial Status / Parallel Product
// filters + Clear Filter. In this world the All tab holds four run rows — MID (Stuck; active, regular,
// parallel product = the NDFU `DDC Parallel Product`), NOAPPT and UNATT (Stuck; active, no finance status, no
// parallel) and RECENT (Initiated – Not Consuming; non active, defaulted, no parallel) — so every filter has rows
// it must keep and rows it must drop.
//
// NOT COVERED: the participant-set cache (stuckKey) — it only changes WHEN the appointment read re-runs,
// which no assertion here can observe without counting reads. Subscription columns on the other three
// tables use the same header/row path; Stuck Cases is the one asserted.
import { test, expect, Page } from '@playwright/test';
import { installJourneyStubs, attachJourneyGuard, loginAsJourneyAdmin, ddcStuckWorld as W } from './support/journey';
import { queryWhere } from '../queue/support/firestore-admin';
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

test.describe('Journey — Delivery dashboard Stuck Cases (priority in-delivery, > 7 days since last booked, no future booking; subscription columns)', () => {
  test('DDC-STK-01 stuck = ongoing priority products > 7 days since the last booked appointment with nothing booked ahead', async ({ page }) => {
    const panel = await openStuckCases(page);
    const rows = panel.locator('tr.pm-table-row');

    // The appointment join is async and lands after the tab renders; the name filter re-reads the
    // tab's data on every input, so re-type until the app's join has landed.
    await expect(async () => {
      await page.getByTestId('ddc-inp-104').fill('');
      await page.getByTestId('ddc-inp-104').fill(W.tag);
      await expect(rows.filter({ hasText: W.names.UNATT })).toHaveCount(1, { timeout: 3_000 });
    }, 'DDC-STK-01: UNATT (unattended booking 30d ago) must be a stuck row').toPass({ timeout: 90_000 });

    await expect(rows, 'DDC-STK-01: exactly UNATT, NOAPPT and MID are stuck').toHaveCount(3);
    for (const k of ['UNATT', 'NOAPPT', 'MID'] as const) {
      await expect(rows.filter({ hasText: W.names[k] }), `DDC-STK-01: ${k} must be stuck`).toHaveCount(1);
    }
    await expect(rows.filter({ hasText: W.names.STALE }), 'DDC-STK-01: STALE\'s unattended booking 2d ago resets the clock').toHaveCount(0);
    await expect(rows.filter({ hasText: W.names.RECENT }), 'DDC-STK-01: RECENT is initiated, not in delivery').toHaveCount(0);
    await expect(rows.filter({ hasText: W.names.DONE }), 'DDC-STK-01: DONE is completed').toHaveCount(0);
    await expect(rows.filter({ hasText: W.names.FUTURE }), 'DDC-STK-01: FUTURE has an appointment booked ahead').toHaveCount(0);
    await expect(rows.filter({ hasText: W.names.NONPRIO }), 'DDC-STK-01: NONPRIO is not priority mode').toHaveCount(0);

    // DAYS STUCK: one `stuckdays` badge, data-basis = where it counted from.
    const days = (k: 'UNATT' | 'NOAPPT' | 'MID') => rows.filter({ hasText: W.names[k] }).getByTestId('ddc-stuck-days');
    await expect(days('UNATT'), 'DDC-STK-01: UNATT counts from its unattended booking (attended or not now counts)').toHaveText(/^\s*30 DAYS\s*$/);
    await expect(days('UNATT')).toHaveAttribute('data-basis', 'appointment');
    await expect(days('NOAPPT'), 'DDC-STK-01: NOAPPT falls back to the ongoing date, marked *').toHaveText(/^\s*20 DAYS\*\s*$/);
    await expect(days('NOAPPT')).toHaveAttribute('data-basis', 'status');
    await expect(days('MID'), 'DDC-STK-01: MID — 10 days is stuck at the 7-day threshold').toHaveText(/^\s*10 DAYS\s*$/);
    // Longest stuck first: UNATT 30 › NOAPPT 20 › MID 10.
    await expect(rows.first(), 'DDC-STK-01: sorted longest stuck first').toContainText(W.names.UNATT);
    await expect(rows.last()).toContainText(W.names.MID);
  });

  test('DDC-STK-03 the stuck row shows its last BOOKED appointment and whether it was attended; the lookup did not fail', async ({ page }) => {
    const panel = await openStuckCases(page);
    for (const h of ['APPOINTMENT', 'APPOINTMENT STATUS', 'LAST BOOKED APPT', 'DAYS STUCK', 'ASSIGNED TO']) {
      await expect(panel.locator('.pm-data-table th').filter({ hasText: new RegExp(`^\\s*${h}\\s*$`) }), `DDC-STK-03: the ${h} column renders`).toHaveCount(1);
    }
    for (const gone of ['LAST APPOINTMENT DATE', 'APPOINTMENT DATE', 'DAYS']) {
      await expect(panel.locator('.pm-data-table th').filter({ hasText: new RegExp(`^\\s*${gone}\\s*$`) }), `DDC-STK-03: the old ${gone} column is gone`).toHaveCount(0);
    }
    const rows = panel.locator('tr.pm-table-row');
    await expect(async () => {
      await page.getByTestId('ddc-inp-104').fill('');
      await page.getByTestId('ddc-inp-104').fill(W.tag);
      await expect(rows.filter({ hasText: W.names.MID }).getByTestId('ddc-stuck-days')).toHaveAttribute('data-basis', 'appointment', { timeout: 3_000 });
    }, 'the appointment join lands').toPass({ timeout: 90_000 });
    await expect(page.getByTestId('ddc-stuck-appointments-error'), 'DDC-STK-03: the appointment lookup succeeded').toHaveCount(0);
    await expect(rows.filter({ hasText: W.names.MID }), 'DDC-STK-03: MID\'s last booking was attended').toContainText('Attended');
    await expect(rows.filter({ hasText: W.names.MID })).not.toContainText('Not attended');
    await expect(rows.filter({ hasText: W.names.UNATT }), 'DDC-STK-03: UNATT\'s last booking was not attended').toContainText('Not attended');
    await expect(rows.filter({ hasText: W.names.NOAPPT }), 'DDC-STK-03: NOAPPT has no booking at all').toContainText('No booked appointment');
  });

  test('DDC-STK-02 the stuck row renders the PP subscription start and end dates', async ({ page }) => {
    const panel = await openStuckCases(page);
    await expect(panel.locator('.pm-data-table th').filter({ hasText: 'SUBSCRIPTION END' })).toBeVisible();
    const row = panel.locator('tr.pm-table-row').filter({ hasText: W.names.MID });
    await expect(async () => {
      await page.getByTestId('ddc-inp-104').fill('');
      await page.getByTestId('ddc-inp-104').fill(W.names.MID);
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
    }, 'the All tab shows the four run rows (MID, NOAPPT, UNATT stuck + RECENT idle)').toPass({ timeout: 90_000 });
    return rows;
  }

  test('DDC-FLT-01 the All tab lists every actionable row with its status and parallel product', async ({ page }) => {
    const rows = await openAll(page);
    const mid = rows.filter({ hasText: W.names.MID });
    const recent = rows.filter({ hasText: W.names.RECENT });
    await expect(mid, 'DDC-FLT-01: MID is listed as Stuck').toContainText('Stuck');
    await expect(mid, 'DDC-FLT-01: MID shows its parallel product').toContainText(W.parallel);
    await expect(recent, 'DDC-FLT-01: RECENT is listed as Initiated – Not Consuming').toContainText('Initiated – Not Consuming');
    await expect(recent, 'DDC-FLT-01: RECENT has no parallel product').not.toContainText(W.parallel);
    for (const k of ['NOAPPT', 'UNATT'] as const) {
      await expect(rows.filter({ hasText: W.names[k] }), `DDC-FLT-01: ${k} is listed as Stuck`).toContainText('Stuck');
    }
    for (const k of ['DONE', 'FUTURE', 'NONPRIO', 'STALE'] as const) {
      await expect(rows.filter({ hasText: W.names[k] }), `DDC-FLT-01: ${k} is in no actionable bucket`).toHaveCount(0);
    }
  });

  test('DDC-FLT-02 each filter keeps its match, drops the other, and Clear Filter resets them all', async ({ page }) => {
    const rows = await openAll(page);
    const only = async (k: 'MID' | 'RECENT', why: string) => {
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
    await only('MID', 'DDC-FLT-02: Financial Status = Regular keeps MID only');
    await page.getByTestId('ddc-btn-129').click();

    await page.getByTestId('ddc-inp-104').fill(W.tag);
    await expect(rows).toHaveCount(4);
    await pickFilter(page, page.getByTestId('ddc-msel-127'), 'Parallel Product Available');
    await only('MID', 'DDC-FLT-02: Parallel Product Available keeps MID only');
    await pickFilter(page, page.getByTestId('ddc-msel-127'), 'No Parallel Product');
    await expect(rows, 'DDC-FLT-02: No Parallel Product keeps RECENT, NOAPPT and UNATT').toHaveCount(3);
    await expect(rows.filter({ hasText: W.names.MID }), 'DDC-FLT-02: No Parallel Product drops MID').toHaveCount(0);
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

// DDC-FN (2026-11-18, Joshua's v4 layout pulled onto charan-release — journal 2026-11-18-pull-joshua-jc-health-delivery-v4):
// one Delivery funnel (Awaiting · Ready · In delivery · Delivered + Stuck / Not-consuming flags) replaces the KPI
// bento, an "Ongoing by product" strip writes the Products filter, and the stage-mix bar + Delivery speed gauge.
// ORACLE: the DDC world's product has exactly six `ongoing` PPs (STALE, NOAPPT, UNATT, FUTURE, NONPRIO, MID — mode does
// not matter for In delivery, only for Stuck). Its chip must read that, re-derived here from the PP docs; picking it
// must scope the whole screen (strip selection, speed caption, funnel = the chip). The All chip must show the same
// total as In delivery (it printed a hard-coded dash in Joshua's v4).
test.describe('Journey — Delivery dashboard funnel + Ongoing-by-product strip (v4 layout)', () => {
  test('DDC-FN-01 the product chip counts its ongoing PPs; picking it scopes the funnel; All restores it', async ({ page }) => {
    const pps = (await queryWhere('participantsproduct', [['testrunid', '==', W.RUN]])) as any[];
    const ongoing = pps.filter((d) => d.status === 'ongoing' && String(d.productref?.id ?? d.productref?._path?.segments?.slice(-1)[0] ?? '').endsWith('_P_DFU')).length;
    expect(ongoing, 'oracle sanity: STALE, NOAPPT, UNATT, FUTURE, NONPRIO, MID are ongoing on the DFU product').toBe(6);

    await loginAsJourneyAdmin(page);
    await page.goto('/delivery-dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-delivery-dashboard-clone'), 'ddc must mount').toBeAttached({ timeout: 30_000 });
    await expect(page.getByTestId('ddc-funnel'), 'DDC-FN-01: the funnel renders').toBeVisible({ timeout: 60_000 });
    for (const el of [page.getByTestId('ddc-funnel-indelivery'), page.getByTestId('ddc-funnel-delivered'), page.getByTestId('ddc-speed'),
      page.getByTestId('ddc-kpi-avg-complete'), page.getByTestId('ddc-strip')]) {
      await expect(el, 'DDC-FN-01: v4 section renders').toBeVisible();
    }

    const inDelivery = page.getByTestId('ddc-funnel-indelivery').locator('.dd-fnl-step__val');
    const allChip = page.getByTestId('ddc-strip-all');
    await expect(allChip, 'DDC-FN-01: nothing narrowed → All products is selected').toHaveClass(/is-sel/);
    await expect(allChip.locator('.dd-pchip__v'), 'DDC-FN-01: the All chip shows a number, not a dash').toHaveText(/^\s*[\d,]+\s*$/, { timeout: 60_000 });
    await expect(async () => {
      expect((await allChip.locator('.dd-pchip__v').textContent())?.trim(), 'DDC-FN-01: All products = In delivery').toBe((await inDelivery.textContent())?.trim());
    }).toPass({ timeout: 30_000 });

    const chip = page.getByTestId('ddc-strip-chip').filter({ hasText: W.product });
    await expect(chip.locator('.dd-pchip__v'), `DDC-FN-01: the run product's chip = its ongoing PPs (${ongoing})`).toHaveText(String(ongoing), { timeout: 60_000 });
    await chip.click();
    await expect(chip, 'DDC-FN-01: the clicked chip is selected').toHaveClass(/is-sel/, { timeout: 30_000 });
    await expect(allChip, 'DDC-FN-01: …and All is not').not.toHaveClass(/is-sel/);
    // the scope caption is the section header next to the gauge (.dd-section-sub), not inside ddc-speed
    const speedCaption = page.locator('.dd-speed-sec .dd-section-sub');
    await expect(speedCaption, 'DDC-FN-01: the speed caption names the scope').toHaveText(`Scoped to ${W.product}`);
    await expect(inDelivery, 'DDC-FN-01: In delivery now counts only that product').toHaveText(String(ongoing), { timeout: 30_000 });

    await allChip.click();
    await expect(allChip, 'DDC-FN-01: All products clears the narrowing').toHaveClass(/is-sel/, { timeout: 30_000 });
    await expect(speedCaption, 'DDC-FN-01: …and the caption says so').toHaveText('Across all products');
  });

  test('DDC-FN-02 the Products Overview stage-mix bar spells out the run product\'s split', async ({ page }) => {
    await loginAsJourneyAdmin(page);
    await page.goto('/delivery-dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-delivery-dashboard-clone')).toBeAttached({ timeout: 30_000 });
    await expect(page.getByTestId('ddc-stagemix-legend').first(), 'DDC-FN-02: the stage legend renders').toBeVisible({ timeout: 60_000 });
    const mix = page.getByTestId('ddc-stagemix').and(page.locator(`[aria-label*="Ongoing 6, Done"]`));
    await expect(mix.first(), 'DDC-FN-02: a bar reads "Ongoing 6" — the run product\'s six ongoing PPs').toBeAttached({ timeout: 60_000 });
  });

  test.fixme('DDC-ADDR3 stage-mix segments (open the card funnel modal per stage) addressable (deferred behavioral)', async ({ page }) => {
    await page.goto('/delivery-dashboard', { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('ddc-stagemix-awaiting')).toBeTruthy();
    expect(page.getByTestId('ddc-stagemix-initiated')).toBeTruthy();
    expect(page.getByTestId('ddc-stagemix-started')).toBeTruthy();
    expect(page.getByTestId('ddc-stagemix-ongoing')).toBeTruthy();
    expect(page.getByTestId('ddc-stagemix-completed')).toBeTruthy();
  });
});

// DDC-CTD (app charan-release 2026-11-19, journal specs/journals/2026-11-19-delivery-dashboard-ctd-stage-tab.md): the
// Stages section gains a "CTD D&I (Appointment)" product chip (exact product, not the merged CTD card) with its own
// board — Total Eligible → Diagnostics → Implementation → Review → Completion — and EI Starter Pack's month columns were
// re-wired 1:1 (Past / This / Next Month sit between Total Eligible and Onboarding). The column lists are the app's
// own config; the cases prove each chip renders ITS board and not another product's (CTD has no Onboarding /
// Celebration Call; Starter Pack has no Review / Completion). Card membership needs a CTD appointment seed (deferred).
test.describe('Journey — Delivery dashboard Stages (CTD D&I Appointment board, EI Starter Pack month columns)', () => {
  async function openStages(page: Page) {
    await loginAsJourneyAdmin(page);
    await page.goto('/delivery-dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-delivery-dashboard-clone'), 'ddc must mount').toBeAttached({ timeout: 30_000 });
  }
  const titles = (page: Page) => page.locator('app-delivery-dashboard-clone .board .col-title');

  test('DDC-CTD-01 the CTD D&I (Appointment) chip opens its delivery-sequence board; the cycle toggle swaps the third form', async ({ page }) => {
    // 2026-11-19 (later): the full CTD sequence — 4 forms then the appointments — in two versions picked by the
    // 1st / Next Cycle toggle (participantsproduct.deliverytype). Next Cycle replaces My Evolution Wishlist with
    // My Pocket ATC; every other column is shared.
    await openStages(page);
    const chip = page.getByTestId('ddc-btn-ctd-appt');
    await expect(chip, 'DDC-CTD-01: the CTD chip is offered with no product filter').toBeVisible({ timeout: 60_000 });
    await chip.click();
    await expect(chip, 'DDC-CTD-01: the chip becomes the active product').toHaveClass(/active/, { timeout: 30_000 });
    await expect(page.getByTestId('ddc-ctd-cycle-first'), 'DDC-CTD-01: 1st Cycle is the default').toHaveClass(/is-active/);
    await expect(titles(page), 'DDC-CTD-01: 1st Cycle — forms, then Diagnostics → Implementation ×2 → Review → Completion')
      .toHaveText(['Total Eligible', 'Aspiration Form', 'ATC Understanding Validation', 'My Evolution Wishlist',
        'Impact Valuation Activity', 'Diagnostics', 'Implementation 1', 'Implementation 2', 'Review', 'Completion'], { timeout: 90_000 });

    await page.getByTestId('ddc-ctd-cycle-next').click();
    await expect(page.getByTestId('ddc-ctd-cycle-next'), 'DDC-CTD-01: Next Cycle is now active').toHaveClass(/is-active/);
    await expect(page.getByTestId('ddc-ctd-cycle-first')).not.toHaveClass(/is-active/);
    await expect(titles(page).nth(3), 'DDC-CTD-01: Next Cycle\'s third form is My Pocket ATC').toHaveText('My Pocket ATC', { timeout: 90_000 });
    await expect(titles(page).filter({ hasText: /^\s*My Evolution Wishlist\s*$/ }), 'DDC-CTD-01: …and the 1st-Cycle form is gone').toHaveCount(0);
    await expect(titles(page), 'DDC-CTD-01: the other nine columns are shared').toHaveCount(10);
    await expect(page.getByTestId('ddc-btn-085'), 'DDC-CTD-01: EI Starter Pack is not active').not.toHaveClass(/active/);
  });

  test('DDC-CTD-02 EI Starter Pack lists the month columns between Total Eligible and Onboarding', async ({ page }) => {
    await openStages(page);
    await page.getByTestId('ddc-btn-085').click();
    await expect(titles(page), 'DDC-CTD-02: the ten Starter Pack columns, months wired 1:1')
      .toHaveText(['Total Eligible', 'Past Month', 'This Month', 'Next Month', 'Onboarding', 'Pre-Process', 'Diagnostics',
        'Implementation', 'Report', 'Celebration Call'], { timeout: 90_000 });
    await page.getByTestId('ddc-btn-ctd-appt').click();
    await expect(titles(page).filter({ hasText: /^\s*(Onboarding|Celebration Call|Past Month)\s*$/ }),
      'DDC-CTD-02: switching to CTD drops the Starter Pack-only columns').toHaveCount(0, { timeout: 90_000 });
  });

  test.fixme('DDC-ADDR4 Add-on count chips (Products Overview row + product modal) addressable (deferred — needs an Addons package seed)', async ({ page }) => {
    await page.goto('/delivery-dashboard', { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('ddc-chip-addon')).toBeTruthy();
    expect(page.getByTestId('ddc-btn-addon')).toBeTruthy();
  });

  test.fixme('DDC-ADDR5 "Why not here?" dialog addressable (deferred — per-product reasons need a multi-product world)', async ({ page }) => {
    await page.goto('/delivery-dashboard', { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('ddc-btn-whynot')).toBeTruthy();
    expect(page.getByTestId('ddc-why-overlay')).toBeTruthy();
    expect(page.getByTestId('ddc-why-dialog')).toBeTruthy();
    expect(page.getByTestId('ddc-why-close')).toBeTruthy();
    expect(page.getByTestId('ddc-why-name')).toBeTruthy();
    expect(page.getByTestId('ddc-why-match')).toBeTruthy();
    expect(page.getByTestId('ddc-why-product')).toBeTruthy();
    expect(page.getByTestId('ddc-why-status')).toBeTruthy();
    expect(page.getByTestId('ddc-why-section')).toBeTruthy();
    expect(page.getByTestId('ddc-why-panel')).toBeTruthy();
  });
});
