// engagement-dashboard-v2.spec.ts — /engagementdashboardv2 (New-Workshop/engagementdashboardv2), 2026-11-02.
// Hook prefix: ed2.
//
// The screen: `participant metadata` where customerstatus is 'active' / 'non active' is the whole
// population. A person is ENGAGED in the chosen month when their profileid has a `content analytics` view
// with a logdate inside that month. Grouped by journey: activejourney, else lastcompletedjourney.
//
// Anti-circularity:
//   • Journey rows: the run-scoped ALPHA / BETA journeys hold ONLY the people seedEd2World writes, so their
//     numbers are known from the seed design (see wsEd2 in support/wshop.ts) — never read from the app.
//   • Headline cards: the emulator also holds other seeds' metadata, so the cards are checked against
//     ed2Oracle — an independent Admin-SDK count over the same collections.
// Negative controls: an 'expired' person who DID view this month (never counted), a view by a profile with
// no metadata (ignored), and a person whose only view is LAST month (not engaged now, engaged then).
// The route carries no authGuard yet (development); it is still granted in seed ROUTES.
import { test, expect, Page, Locator } from '@playwright/test';
import { readFileSync } from 'fs';
import {
  installWshopStubs, loginAsWshopAdmin, wsEd2, seedEd2World, clearEd2World, ed2Oracle, readCsvRows,
  seedWatiConfig, clearWatiConfig, captureWorkshopProgressSend, pickWatiTemplate,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const P = wsEd2.people;
const num = (s: string) => parseInt(s.replace(/[^0-9]/g, ''), 10);
const monthName = (d: Date) => `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;

async function openEd2(page: Page): Promise<void> {
  await loginAsWshopAdmin(page);
  await page.goto('/engagementdashboardv2', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('ed2-month-label'), 'the dashboard header renders').toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('ed2-kpi-total'), 'the first load finishes').toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('ed2-loading')).toHaveCount(0);
  await expect(page.getByTestId('ed2-error'), 'no load error').toHaveCount(0);
  await expect(page.getByTestId('ed2-retry')).toHaveCount(0);
}

const row = (page: Page, journeyName: string) =>
  page.getByTestId('ed2-row').filter({ has: page.getByTestId('ed2-row-name').getByText(journeyName, { exact: true }) });

async function expectRow(page: Page, journeyName: string, total: number, engaged: number, notEngaged: number, rate: number, ctx: string) {
  const r = row(page, journeyName);
  await expect(r, `${ctx}: one row for ${journeyName}`).toHaveCount(1, { timeout: 30_000 });
  await expect(r.getByTestId('ed2-row-total'), `${ctx}: participants`).toHaveText(String(total));
  await expect(r.getByTestId('ed2-row-engaged'), `${ctx}: engaged`).toHaveText(String(engaged));
  await expect(r.getByTestId('ed2-row-notengaged'), `${ctx}: not engaged`).toHaveText(String(notEngaged));
  await expect(r.getByTestId('ed2-row-rate'), `${ctx}: engagement rate`).toHaveText(`${rate}%`);
}

async function expectCards(page: Page, o: { total: number; engaged: number }, ctx: string) {
  await expect.poll(async () => num(await page.getByTestId('ed2-kpi-total').innerText()), { message: `${ctx}: Participants card = oracle`, timeout: 30_000 }).toBe(o.total);
  expect(num(await page.getByTestId('ed2-kpi-engaged').innerText()), `${ctx}: Engaged card = oracle`).toBe(o.engaged);
  expect(num(await page.getByTestId('ed2-kpi-notengaged').innerText()), `${ctx}: Not engaged card = oracle`).toBe(o.total - o.engaged);
  const rate = o.total ? Math.round((o.engaged / o.total) * 100) : 0;
  await expect(page.getByTestId('ed2-kpi-rate'), `${ctx}: rate card`).toHaveText(String(rate));
}

test.describe('Engagement dashboard v2 — content engagement by month', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await seedEd2World();
  });
  test.afterEach(async () => {
    await clearEd2World();
    assertNoFatal(guard, 'engagement dashboard v2: no fatal console errors / pageerrors');
  });

  test('ED2-01 this month: journeys by active-else-last journey, engaged = viewed content this month, only active / non active counted', async ({ page }) => {
    await openEd2(page);
    const now = new Date();
    await expect(page.getByTestId('ed2-month-label'), 'ED2-01: opens on the current month').toContainText(monthName(now));
    await expect(page.getByTestId('ed2-month-next'), 'ED2-01: no month after the current one').toBeDisabled();

    // ALPHA: Asha (active, viewed) + Bala (non active, journey from last completed, viewed) + Chitra
    // (active, viewed LAST month only). Dev is 'expired' and viewed this month — must not be counted.
    await expectRow(page, wsEd2.ALPHA_NAME, 3, 2, 1, 67, 'ED2-01 ALPHA');
    await expectRow(page, wsEd2.BETA_NAME, 1, 0, 1, 0, 'ED2-01 BETA');
    await expect(row(page, wsEd2.BETA_NAME).getByTestId('ed2-row-engaged'), 'ED2-01: nobody to list -> disabled').toBeDisabled();
    await expect(page.getByTestId('ed2-empty'), 'ED2-01: rows, so no empty state').toHaveCount(0);
    expect(num(await page.getByTestId('ed2-journey-count').innerText()), 'ED2-01: journey count = rows').toBe(await page.getByTestId('ed2-row').count());

    const o = await ed2Oracle(now, 'all');
    await expectCards(page, o, 'ED2-01');
    expect(num(await page.getByTestId('ed2-kpi-active').innerText()), 'ED2-01: active split = oracle').toBe(o.active);
    expect(num(await page.getByTestId('ed2-kpi-nonactive').innerText()), 'ED2-01: non active split = oracle').toBe(o.nonActive);
  });

  test('ED2-02 the status filter narrows the cards and the journeys', async ({ page }) => {
    await openEd2(page);
    const now = new Date();
    await expect(page.getByTestId('ed2-status-all'), 'ED2-02: All is the default').toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('ed2-status-active').click();
    await expect(page.getByTestId('ed2-status-active')).toHaveAttribute('aria-pressed', 'true');
    await expectRow(page, wsEd2.ALPHA_NAME, 2, 1, 1, 50, 'ED2-02 Active ALPHA');   // Asha + Chitra
    await expectCards(page, await ed2Oracle(now, 'active'), 'ED2-02 Active');

    await page.getByTestId('ed2-status-nonactive').click();
    await expect(page.getByTestId('ed2-status-nonactive')).toHaveAttribute('aria-pressed', 'true');
    await expectRow(page, wsEd2.ALPHA_NAME, 1, 1, 0, 100, 'ED2-02 Non active ALPHA');   // Bala
    await expect(row(page, wsEd2.BETA_NAME), 'ED2-02: BETA has no non active people').toHaveCount(0);
    await expectCards(page, await ed2Oracle(now, 'non active'), 'ED2-02 Non active');

    await page.getByTestId('ed2-status-all').click();
    await expectRow(page, wsEd2.ALPHA_NAME, 3, 2, 1, 67, 'ED2-02 back to All');
  });

  test('ED2-03 months: previous / next, the month picker, and last month counted on its own', async ({ page }) => {
    await openEd2(page);
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Previous month: only Chitra viewed ALPHA content then.
    await page.getByTestId('ed2-month-prev').click();
    await expect(page.getByTestId('ed2-month-label'), 'ED2-03: previous month').toContainText(monthName(prev));
    await expect(page.getByTestId('ed2-refreshing'), 'ED2-03: the month finishes loading').toHaveCount(0, { timeout: 60_000 });
    await expectRow(page, wsEd2.ALPHA_NAME, 3, 1, 2, 33, 'ED2-03 last month ALPHA');
    await expectCards(page, await ed2Oracle(prev, 'all'), 'ED2-03 last month');
    await expect(page.getByTestId('ed2-month-next'), 'ED2-03: can step forward again').toBeEnabled();
    await page.getByTestId('ed2-month-next').click();
    await expect(page.getByTestId('ed2-month-label')).toContainText(monthName(now));
    await expect(page.getByTestId('ed2-refreshing')).toHaveCount(0, { timeout: 60_000 });
    await expectRow(page, wsEd2.ALPHA_NAME, 3, 2, 1, 67, 'ED2-03 back to this month');

    // Picker: this year, no later year, future months disabled.
    await page.getByTestId('ed2-month-label').click();
    const picker = page.getByTestId('ed2-month-picker');
    await expect(picker, 'ED2-03: the picker opens').toBeVisible();
    await expect(picker.getByTestId('ed2-year-label')).toHaveText(String(now.getFullYear()));
    await expect(picker.getByTestId('ed2-year-next'), 'ED2-03: no later year').toBeDisabled();
    const options = picker.getByTestId('ed2-month-option');
    await expect(options).toHaveCount(12);
    for (let m = 0; m < 12; m++) {
      if (m > now.getMonth()) await expect(options.nth(m), `ED2-03: month ${m + 1} is in the future`).toBeDisabled();
      else await expect(options.nth(m), `ED2-03: month ${m + 1} can be picked`).toBeEnabled();
    }
    // Clicking outside closes it without changing the month.
    // Bottom-centre of the viewport: inside the content area, clear of the app's side menu.
    const vp = page.viewportSize()!;
    await page.getByTestId('ed2-picker-scrim').click({ position: { x: Math.round(vp.width / 2), y: vp.height - 40 } });
    await expect(picker, 'ED2-03: outside click closes the picker').toHaveCount(0);
    await expect(page.getByTestId('ed2-month-label')).toContainText(monthName(now));

    // Previous year: every month can be picked; pick the previous month via its own year.
    await page.getByTestId('ed2-month-label').click();
    await picker.getByTestId('ed2-year-prev').click();
    await expect(picker.getByTestId('ed2-year-label')).toHaveText(String(now.getFullYear() - 1));
    await expect(picker.getByTestId('ed2-year-next'), 'ED2-03: can come back to this year').toBeEnabled();
    for (let m = 0; m < 12; m++) await expect(options.nth(m)).toBeEnabled();
    if (prev.getFullYear() === now.getFullYear()) await picker.getByTestId('ed2-year-next').click();
    await options.nth(prev.getMonth()).click();
    await expect(picker, 'ED2-03: picking closes the picker').toHaveCount(0);
    await expect(page.getByTestId('ed2-month-label')).toContainText(monthName(prev));
    await expect(page.getByTestId('ed2-refreshing')).toHaveCount(0, { timeout: 60_000 });
    await expectRow(page, wsEd2.ALPHA_NAME, 3, 1, 2, 33, 'ED2-03 picked last month');
  });

  test('ED2-04 the people panel: engaged / not engaged / all, search, export, close', async ({ page }) => {
    await openEd2(page);
    const panel = page.getByTestId('ed2-panel');
    const people = panel.getByTestId('ed2-person');
    const personNames = panel.getByTestId('ed2-person-name');
    const names = () => personNames.allInnerTexts();

    await row(page, wsEd2.ALPHA_NAME).getByTestId('ed2-row-engaged').click();
    await expect(panel.getByTestId('ed2-panel-title'), 'ED2-04: the panel is for the journey').toHaveText(wsEd2.ALPHA_NAME);
    await expect(panel.getByTestId('ed2-panel-tab-engaged'), 'ED2-04: opened on Engaged').toHaveAttribute('aria-pressed', 'true');
    await expect(people).toHaveCount(2);
    // Most watched first: Asha (5400 s) then Bala (600 s).
    await expect(personNames, 'ED2-04: engaged, most watched first').toHaveText([P.activeEngaged.name, P.nonActiveLast.name]);
    const asha = people.filter({ hasText: P.activeEngaged.name });
    await expect(asha.getByTestId('ed2-person-activity'), 'ED2-04: watch time from totaltimespend, both sources').toContainText('2h');
    await expect(asha.getByTestId('ed2-person-status')).toHaveText('Active');
    await expect(people.filter({ hasText: P.nonActiveLast.name }).getByTestId('ed2-person-status')).toHaveText('Non active');
    await expect(panel.getByTestId('ed2-panel-count')).toHaveText('2 people');

    await panel.getByTestId('ed2-panel-tab-notengaged').click();
    await expect(personNames, 'ED2-04: not engaged this month = Chitra').toHaveText([P.activeLastMonth.name]);
    await expect(people.getByTestId('ed2-person-activity'), 'ED2-04: no activity line without views').toHaveCount(0);
    await expect(panel.getByTestId('ed2-panel-count')).toHaveText('1 person');

    await panel.getByTestId('ed2-panel-tab-all').click();
    await expect(people).toHaveCount(3);
    expect((await names()).sort(), 'ED2-04: the expired person is never listed').toEqual([P.activeEngaged.name, P.nonActiveLast.name, P.activeLastMonth.name].sort());

    // Search — the negative control first: a miss removes everyone.
    const search = panel.getByTestId('ed2-panel-search');
    await search.fill('zz-nobody-zz');
    await expect(people).toHaveCount(0);
    await expect(panel.getByTestId('ed2-panel-empty'), 'ED2-04: a miss says so').toBeVisible();
    await expect(panel.getByTestId('ed2-panel-export'), 'ED2-04: nothing to export').toBeDisabled();
    await search.fill(P.nonActiveLast.email.toUpperCase());
    await expect(personNames, 'ED2-04: email search, any case').toHaveText([P.nonActiveLast.name]);
    await search.fill('');
    await expect(people).toHaveCount(3);

    // Export the list shown.
    const [download] = await Promise.all([page.waitForEvent('download'), panel.getByTestId('ed2-panel-export').click()]);
    const file = test.info().outputPath('ed2.csv');
    await download.saveAs(file);
    const csv = readCsvRows(readFileSync(file, 'utf8').replace(/^﻿/, ''));
    expect(csv[0], 'ED2-04: CSV header').toEqual(['Name', 'Email', 'Phone', 'Status', 'Journey', 'Engaged', 'Sessions', 'Watch time', 'Last watched', 'Watched from', 'Watched on']);
    const ashaRow = csv.find(r => r[0] === P.activeEngaged.name);
    expect(ashaRow, 'ED2-04: Asha exported').toBeTruthy();
    expect(ashaRow!.slice(1, 8), 'ED2-04: Asha row').toEqual([P.activeEngaged.email, '+91 9000000000', 'Active', wsEd2.ALPHA_NAME, 'Yes', '2', '2h']);
    expect(ashaRow![9], 'ED2-04: watch time by source, most watched first').toMatch(/^eiflixworkshop 1h 30m; eiflixcontent 30m$/i);
    expect(ashaRow![10], 'ED2-04: watch time by platform, most watched first').toMatch(/^eiflixapp 1h 30m; eiflixweb 30m$/i);
    expect(csv.find(r => r[0] === P.activeLastMonth.name)?.[5], 'ED2-04: Chitra not engaged').toBe('No');
    expect(csv.length - 1, 'ED2-04: one row per person listed').toBe(3);

    await panel.getByTestId('ed2-panel-close').click();
    await expect(panel.getByTestId('ed2-panel-title'), 'ED2-04: closed').toHaveCount(0);

    // The cards open the panel across every journey; the backdrop closes it.
    await page.getByTestId('ed2-kpi-engaged-card').click();
    await expect(panel.getByTestId('ed2-panel-title')).toHaveText('All journeys');
    await expect(panel.getByTestId('ed2-panel-tab-engaged')).toHaveAttribute('aria-pressed', 'true');
    await expect(people.filter({ hasText: P.expired.name }), 'ED2-04: expired never listed, even across journeys').toHaveCount(0);
    // Just left of the 460px panel, mid-height: the backdrop, clear of the app's side menu.
    const vp = page.viewportSize()!;
    await page.getByTestId('ed2-panel-backdrop').click({ position: { x: vp.width - 520, y: Math.round(vp.height / 2) } });
    await expect(panel.getByTestId('ed2-panel-title')).toHaveCount(0);
    await page.getByTestId('ed2-kpi-notengaged-card').click();
    await expect(panel.getByTestId('ed2-panel-tab-notengaged')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('ed2-panel-close').click();
    await page.getByTestId('ed2-kpi-total-card').click();
    await expect(panel.getByTestId('ed2-panel-tab-all')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('ed2-panel-close').click();
    await row(page, wsEd2.ALPHA_NAME).getByTestId('ed2-row-total').click();
    await expect(people, 'ED2-04: the participants number lists everyone in the journey').toHaveCount(3);
    await page.getByTestId('ed2-panel-close').click();
    await row(page, wsEd2.ALPHA_NAME).getByTestId('ed2-row-notengaged').click();
    await expect(personNames, 'ED2-04: the not-engaged pill opens on that list').toHaveText([P.activeLastMonth.name]);
  });

  test('ED2-05 the journey table sorts by every column', async ({ page }) => {
    await openEd2(page);
    // The header cell around a sort button (aria-sort lives on the th).
    const th = (btn: Locator) => page.locator('th').filter({ has: btn });
    const byName = page.getByTestId('ed2-sort-name');
    const byTotal = page.getByTestId('ed2-sort-total');
    const byEngaged = page.getByTestId('ed2-sort-engaged');
    const byNotEngaged = page.getByTestId('ed2-sort-notengaged');
    const byRate = page.getByTestId('ed2-sort-rate');
    await expect(th(byTotal), 'ED2-05: Participants, biggest first, by default').toHaveAttribute('aria-sort', 'descending');

    const rowNames = async () => (await page.getByTestId('ed2-row-name').allInnerTexts()).filter(n => n === wsEd2.ALPHA_NAME || n === wsEd2.BETA_NAME);
    await byName.click();
    await expect(th(byName), 'ED2-05: Journey sorts A–Z first').toHaveAttribute('aria-sort', 'ascending');
    await expect.poll(rowNames, { message: 'ED2-05: A–Z' }).toEqual([wsEd2.ALPHA_NAME, wsEd2.BETA_NAME]);
    await byName.click();
    await expect(th(byName)).toHaveAttribute('aria-sort', 'descending');
    await expect.poll(rowNames, { message: 'ED2-05: Z–A' }).toEqual([wsEd2.BETA_NAME, wsEd2.ALPHA_NAME]);
    await expect(th(byTotal), 'ED2-05: only one column sorts at a time').toHaveAttribute('aria-sort', 'none');

    await byEngaged.click();
    await expect(th(byEngaged), 'ED2-05: Engaged sorts highest first').toHaveAttribute('aria-sort', 'descending');
    await byNotEngaged.click();
    await expect(th(byNotEngaged), 'ED2-05: Not engaged sorts highest first').toHaveAttribute('aria-sort', 'descending');
    await byTotal.click();
    await expect(th(byTotal), 'ED2-05: Participants sorts highest first').toHaveAttribute('aria-sort', 'descending');
    await byRate.click();
    await expect(th(byRate), 'ED2-05: Engagement sorts highest first').toHaveAttribute('aria-sort', 'descending');
    await expect.poll(rowNames, { message: 'ED2-05: highest engagement first' }).toEqual([wsEd2.ALPHA_NAME, wsEd2.BETA_NAME]);
    await byRate.click();
    await expect(th(byRate), 'ED2-05: a second click reverses').toHaveAttribute('aria-sort', 'ascending');
    // Lowest rate first: BETA (0%) comes before ALPHA (67%).
    await expect.poll(rowNames, { message: 'ED2-05: lowest engagement first' }).toEqual([wsEd2.BETA_NAME, wsEd2.ALPHA_NAME]);
  });
  test('ED2-06 the From filter counts only views from the picked sources', async ({ page }) => {
    await openEd2(page);
    const now = new Date();
    const btn = page.getByTestId('ed2-from-btn');
    const summary = page.getByTestId('ed2-from-summary');
    const menu = page.getByTestId('ed2-from-menu');
    const all = page.getByTestId('ed2-from-all');
    // Match on the label only — the option also holds the tick icon, whose ligature text is "check".
    const opt = (key: string) => page.getByTestId('ed2-from-option')
      .filter({ has: page.getByTestId('ed2-from-option-label').getByText(new RegExp(`^${key}$`, 'i')) });
    await expect(summary, 'ED2-06: every source by default').toHaveText('All sources');

    await btn.click();
    await expect(menu, 'ED2-06: the menu opens').toBeVisible();
    await expect(all).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('ed2-from-empty'), 'ED2-06: this month has sources').toHaveCount(0);
    // 'EiflixWorkshop' and 'eiflixworkshop' are ONE source.
    await expect(opt('eiflixworkshop'), 'ED2-06: spellings grouped into one option').toHaveCount(1);
    await expect(opt('eiflixcontent')).toHaveCount(1);

    // eiflixcontent only: Asha counts (she also watched there), Bala does not (workshop only).
    await opt('eiflixcontent').click();
    await expect(opt('eiflixcontent')).toHaveAttribute('aria-checked', 'true');
    await expect(all, 'ED2-06: All is no longer ticked').toHaveAttribute('aria-checked', 'false');
    await expect(summary).toHaveText(/^eiflixcontent$/i);
    await expectRow(page, wsEd2.ALPHA_NAME, 3, 1, 2, 33, 'ED2-06 eiflixcontent');
    await expectCards(page, await ed2Oracle(now, 'all', ['eiflixcontent']), 'ED2-06 eiflixcontent');

    // Both sources: back to everyone who watched anything.
    await opt('eiflixworkshop').click();
    await expect(summary).toHaveText('2 sources');
    await expectRow(page, wsEd2.ALPHA_NAME, 3, 2, 1, 67, 'ED2-06 both');

    // Clicking outside closes it and keeps the choice; All sources clears it.
    const vp = page.viewportSize()!;
    await page.getByTestId('ed2-menu-scrim').click({ position: { x: Math.round(vp.width / 2), y: vp.height - 40 } });
    await expect(menu).toHaveCount(0);
    await expect(summary).toHaveText('2 sources');
    await btn.click();
    await all.click();
    await expect(summary).toHaveText('All sources');
    await expect(opt('eiflixcontent')).toHaveAttribute('aria-checked', 'false');
    await expectRow(page, wsEd2.ALPHA_NAME, 3, 2, 1, 67, 'ED2-06 cleared');
    await expectCards(page, await ed2Oracle(now, 'all'), 'ED2-06 cleared');
  });

  test('ED2-07 a person expands to show watch time for each source', async ({ page }) => {
    await openEd2(page);
    const panel = page.getByTestId('ed2-panel');
    const person = (name: string) => panel.getByTestId('ed2-person').filter({ hasText: name });

    await row(page, wsEd2.ALPHA_NAME).getByTestId('ed2-row-engaged').click();
    const asha = person(P.activeEngaged.name);
    const toggle = asha.getByTestId('ed2-person-toggle');
    await expect(toggle, 'ED2-07: collapsed by default').toHaveAttribute('aria-expanded', 'false');
    await expect(asha.getByTestId('ed2-person-froms')).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const froms = asha.getByTestId('ed2-person-from');
    await expect(froms, 'ED2-07: one line per source').toHaveCount(2);
    // Most watched first: the workshop source (5400 s), then eiflixcontent (1800 s).
    await expect(froms.nth(0).getByTestId('ed2-person-from-name')).toHaveText(/^eiflixworkshop$/i);
    await expect(froms.nth(0).getByTestId('ed2-person-from-time')).toHaveText('1h 30m');
    await expect(froms.nth(1).getByTestId('ed2-person-from-name')).toHaveText(/^eiflixcontent$/i);
    await expect(froms.nth(1).getByTestId('ed2-person-from-time')).toHaveText('30m');
    // Bala stays collapsed while Asha is open; open him too.
    const bala = person(P.nonActiveLast.name);
    await expect(bala.getByTestId('ed2-person-froms')).toHaveCount(0);
    await bala.getByTestId('ed2-person-toggle').click();
    await expect(bala.getByTestId('ed2-person-from-time'), 'ED2-07: one source, 10m').toHaveText(['10m']);
    await toggle.click();
    await expect(asha.getByTestId('ed2-person-froms'), 'ED2-07: collapses again').toHaveCount(0);

    // Nobody to expand without views.
    await panel.getByTestId('ed2-panel-tab-notengaged').click();
    await expect(person(P.activeLastMonth.name).getByTestId('ed2-person-toggle'), 'ED2-07: no views, no breakdown').toHaveCount(0);
    await panel.getByTestId('ed2-panel-close').click();

    // With a source picked, the breakdown and the total show that source only.
    await page.getByTestId('ed2-from-btn').click();
    await page.getByTestId('ed2-from-option')
      .filter({ has: page.getByTestId('ed2-from-option-label').getByText(/^eiflixcontent$/i) }).click();
    await page.getByTestId('ed2-menu-scrim').click({ position: { x: Math.round(page.viewportSize()!.width / 2), y: page.viewportSize()!.height - 40 } });
    await row(page, wsEd2.ALPHA_NAME).getByTestId('ed2-row-engaged').click();
    await expect(panel.getByTestId('ed2-person-name'), 'ED2-07: only Asha watched eiflixcontent').toHaveText([P.activeEngaged.name]);
    await expect(asha.getByTestId('ed2-person-activity')).toContainText('30m');
    await asha.getByTestId('ed2-person-toggle').click();
    await expect(asha.getByTestId('ed2-person-from-name'), 'ED2-07: only the picked source').toHaveText([/^eiflixcontent$/i]);
  });
  test('ED2-08 the Platform filter, both filters together, and Clear filters', async ({ page }) => {
    await openEd2(page);
    const now = new Date();
    const clear = page.getByTestId('ed2-clear-filters');
    const fromBtn = page.getByTestId('ed2-from-btn');
    const platBtn = page.getByTestId('ed2-platform-btn');
    const platSummary = page.getByTestId('ed2-platform-summary');
    const platMenu = page.getByTestId('ed2-platform-menu');
    const platAll = page.getByTestId('ed2-platform-all');
    // Match on the label only — the option also holds the tick icon, whose ligature text is "check".
    const platOpt = (key: string) => page.getByTestId('ed2-platform-option')
      .filter({ has: page.getByTestId('ed2-platform-option-label').getByText(new RegExp(`^${key}$`, 'i')) });
    const fromOpt = (key: string) => page.getByTestId('ed2-from-option')
      .filter({ has: page.getByTestId('ed2-from-option-label').getByText(new RegExp(`^${key}$`, 'i')) });
    const vp = page.viewportSize()!;
    const outside = { position: { x: Math.round(vp.width / 2), y: vp.height - 40 } };

    await expect(clear, 'ED2-08: nothing to clear by default').toBeHidden();
    // Picking filters must not reflow the page (operator 2026-11-03): remember where things sit.
    // Position inside the dashboard (not the viewport — clicks scroll the page).
    const boxOf = (id: string) => page.getByTestId(id).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const home = el.closest('.ed2-page')!.getBoundingClientRect();
      return { x: Math.round(r.left - home.left), y: Math.round(r.top - home.top), width: Math.round(r.width) };
    });
    const before = { from: await boxOf('ed2-from-btn'), plat: await boxOf('ed2-platform-btn'), status: await boxOf('ed2-status-all'), kpi: await boxOf('ed2-kpi-total') };
    await expect(platSummary).toHaveText('All platforms');
    await platBtn.click();
    await expect(platMenu).toBeVisible();
    await expect(platAll).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('ed2-platform-empty'), 'ED2-08: this month has platforms').toHaveCount(0);
    await expect(platOpt('eiflixapp'), "ED2-08: 'EiflixApp' and 'eiflixapp' are one platform").toHaveCount(1);

    // Web only: Asha's content view was on the web; Bala watched on the app.
    await platOpt('eiflixweb').click();
    await expect(platOpt('eiflixweb')).toHaveAttribute('aria-checked', 'true');
    await expect(platSummary).toHaveText(/^eiflixweb$/i);
    await expect(clear, 'ED2-08: a filter is set -> Clear shows').toBeVisible();
    await expectRow(page, wsEd2.ALPHA_NAME, 3, 1, 2, 33, 'ED2-08 web');
    await expectCards(page, await ed2Oracle(now, 'all', [], ['eiflixweb']), 'ED2-08 web');

    // AND across filters: workshop views were never on the web.
    await page.getByTestId('ed2-menu-scrim').click(outside);
    await expect(platMenu).toHaveCount(0);
    await fromBtn.click();
    await fromOpt('eiflixworkshop').click();
    await page.getByTestId('ed2-menu-scrim').click(outside);
    await expectRow(page, wsEd2.ALPHA_NAME, 3, 0, 3, 0, 'ED2-08 workshop AND web');
    const after = { from: await boxOf('ed2-from-btn'), plat: await boxOf('ed2-platform-btn'), status: await boxOf('ed2-status-all'), kpi: await boxOf('ed2-kpi-total') };
    for (const k of ['from', 'plat', 'status', 'kpi'] as const) {
      expect([after[k].x, after[k].y, after[k].width], `ED2-08: ${k} stays put when filters are picked`).toEqual([before[k].x, before[k].y, before[k].width]);
    }
    await expectCards(page, await ed2Oracle(now, 'all', ['eiflixworkshop'], ['eiflixweb']), 'ED2-08 workshop AND web');

    // Clear filters resets status too — but not the month.
    await page.getByTestId('ed2-status-nonactive').click();
    await clear.click();
    await expect(clear, 'ED2-08: cleared -> the button hides').toBeHidden();
    await expect(page.getByTestId('ed2-from-summary')).toHaveText('All sources');
    await expect(platSummary).toHaveText('All platforms');
    await expect(page.getByTestId('ed2-status-all'), 'ED2-08: status back to All').toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('ed2-month-label')).toContainText(monthName(now));
    await expectRow(page, wsEd2.ALPHA_NAME, 3, 2, 1, 67, 'ED2-08 cleared');
    // The status filter alone also shows Clear.
    await page.getByTestId('ed2-status-active').click();
    await expect(clear).toBeVisible();
    await platBtn.click();
    await platAll.click();
    await expect(platSummary).toHaveText('All platforms');
    await page.getByTestId('ed2-menu-scrim').click(outside);
    await clear.click();

    // The expanded person shows platforms as well as sources.
    await row(page, wsEd2.ALPHA_NAME).getByTestId('ed2-row-engaged').click();
    const asha = page.getByTestId('ed2-panel').getByTestId('ed2-person').filter({ hasText: P.activeEngaged.name });
    await asha.getByTestId('ed2-person-toggle').click();
    const plats = asha.getByTestId('ed2-person-platform');
    await expect(plats, 'ED2-08: one line per platform').toHaveCount(2);
    await expect(plats.nth(0).getByTestId('ed2-person-platform-name')).toHaveText(/^eiflixapp$/i);
    await expect(plats.nth(0).getByTestId('ed2-person-platform-time')).toHaveText('1h 30m');
    await expect(plats.nth(1).getByTestId('ed2-person-platform-name')).toHaveText(/^eiflixweb$/i);
    await expect(plats.nth(1).getByTestId('ed2-person-platform-time')).toHaveText('30m');
  });
  test('ED2-09 a past month takes Active / Non active from the subscription dates, the current month from today', async ({ page }) => {
    await openEd2(page);
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const note = page.getByTestId('ed2-status-note');
    const panel = page.getByTestId('ed2-panel');
    const statusOf = (name: string) => panel.getByTestId('ed2-person').filter({ hasText: name }).getByTestId('ed2-person-status');

    // This month: live status. Farah is Non active today; Gita (no dates) is counted as Active.
    await expect(note, 'ED2-09: this month says it uses today').toContainText('status as of today');
    await expect(page.getByTestId('ed2-leftout-notyet'), 'ED2-09: nobody left out this month').toHaveCount(0);
    await expectRow(page, wsEd2.GAMMA_NAME, 2, 0, 2, 0, 'ED2-09 GAMMA now');
    await expect(row(page, wsEd2.GAMMA_NAME).locator('.ed2-jmeta')).toHaveText('1 active · 1 non active');
    await row(page, wsEd2.GAMMA_NAME).getByTestId('ed2-row-total').click();
    await expect(statusOf(P.farahFlip.name), 'ED2-09: Farah is Non active today').toHaveText('Non active');
    await expect(statusOf(P.gitaUndated.name)).toHaveText('Active');
    await page.getByTestId('ed2-panel-close').click();

    // Last month: from the dates.
    await page.getByTestId('ed2-month-prev').click();
    await expect(page.getByTestId('ed2-month-label')).toContainText(monthName(prev));
    await expect(page.getByTestId('ed2-refreshing')).toHaveCount(0, { timeout: 60_000 });
    await expect(note, 'ED2-09: last month says it uses the dates').toContainText('from each person\'s subscription dates');
    const o = await ed2Oracle(prev, 'all');
    expect(o.notYet, 'ED2-09 precondition: Esha started this month').toBeGreaterThanOrEqual(1);
    expect(o.undated, 'ED2-09 precondition: Gita has no dates').toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId('ed2-leftout-notyet'), 'ED2-09: not-yet count = oracle').toHaveText(String(o.notYet));
    await expect(page.getByTestId('ed2-leftout-undated'), 'ED2-09: no-dates count = oracle').toHaveText(String(o.undated));
    await expectCards(page, o, 'ED2-09 last month');
    // ALPHA: Asha + Chitra ran last month (Active), Bala ended two months ago (Non active).
    await expectRow(page, wsEd2.ALPHA_NAME, 3, 1, 2, 33, 'ED2-09 ALPHA last month');
    await expect(row(page, wsEd2.ALPHA_NAME).locator('.ed2-jmeta')).toHaveText('2 active · 1 non active');
    // BETA: Esha only started this month -> not a customer then -> no row.
    await expect(row(page, wsEd2.BETA_NAME), 'ED2-09: BETA had nobody last month').toHaveCount(0);
    // GAMMA: Farah's journey ran until the 15th of last month -> Active then; Gita (no dates) left out.
    await expectRow(page, wsEd2.GAMMA_NAME, 1, 0, 1, 0, 'ED2-09 GAMMA last month');
    await expect(row(page, wsEd2.GAMMA_NAME).locator('.ed2-jmeta')).toHaveText('1 active · 0 non active');
    await row(page, wsEd2.GAMMA_NAME).getByTestId('ed2-row-total').click();
    await expect(statusOf(P.farahFlip.name), 'ED2-09: Farah was Active last month').toHaveText('Active');
    await expect(panel.getByTestId('ed2-person').filter({ hasText: P.gitaUndated.name }), 'ED2-09: Gita left out').toHaveCount(0);
    await page.getByTestId('ed2-panel-close').click();

    // The Active filter follows the month's status.
    await page.getByTestId('ed2-status-active').click();
    await expectRow(page, wsEd2.ALPHA_NAME, 2, 1, 1, 50, 'ED2-09 Active last month');
    await expectRow(page, wsEd2.GAMMA_NAME, 1, 0, 1, 0, 'ED2-09 Active GAMMA last month');
    await expectCards(page, await ed2Oracle(prev, 'active'), 'ED2-09 Active last month');
  });
  test('ED2-10 free users: their own status, and a "Free users" row that always comes last', async ({ page }) => {
    await openEd2(page);
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const F = wsEd2.free;
    const FREE = 'Free users';
    const lastRowName = async () => (await page.getByTestId('ed2-row-name').allInnerTexts()).slice(-1)[0];

    // All: the Free users row is last, labelled, and matches the oracle's free population.
    const o = await ed2Oracle(now, 'all');
    expect(o.free, 'ED2-10 precondition: Hari and Ivy are free users').toBeGreaterThanOrEqual(2);
    await expect.poll(lastRowName, { message: 'ED2-10: Free users is the last row' }).toBe(FREE);
    await expect(row(page, FREE).locator('.ed2-jmeta')).toHaveText('Signed up, no journey yet');
    const oFree = await ed2Oracle(now, 'free');
    await expect(row(page, FREE).getByTestId('ed2-row-total'), 'ED2-10: free row = oracle').toHaveText(String(oFree.total));
    await expect(row(page, FREE).getByTestId('ed2-row-engaged')).toHaveText(String(oFree.engaged));
    expect(num(await page.getByTestId('ed2-kpi-free').innerText()), 'ED2-10: free split on the card').toBe(o.free);
    await expectCards(page, o, 'ED2-10 all');
    // Sorting never moves it.
    await page.getByTestId('ed2-sort-name').click();
    await expect.poll(lastRowName, { message: 'ED2-10: still last, A–Z' }).toBe(FREE);
    await page.getByTestId('ed2-sort-name').click();
    await expect.poll(lastRowName, { message: 'ED2-10: still last, Z–A' }).toBe(FREE);

    // The Free users filter: only that row, and the cards follow.
    await page.getByTestId('ed2-status-free').click();
    await expect(page.getByTestId('ed2-status-free')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('ed2-row'), 'ED2-10: only the free row').toHaveCount(1);
    await expect(page.getByTestId('ed2-row-name')).toHaveText(FREE);
    await expectCards(page, oFree, 'ED2-10 free');

    // The panel: Hari (viewed) is an engaged free user; Jai (moved) and Asha (paid) are not free users.
    await row(page, FREE).getByTestId('ed2-row-total').click();
    const panel = page.getByTestId('ed2-panel');
    const person = (name: string) => panel.getByTestId('ed2-person').filter({ hasText: name });
    await expect(panel.getByTestId('ed2-panel-title')).toHaveText(FREE);
    await expect(person(F.hari.name).getByTestId('ed2-person-status')).toHaveText('Free user');
    await expect(person(F.hari.name).getByTestId('ed2-person-activity'), 'ED2-10: Hari watched 15m').toContainText('15m');
    await expect(person(F.ivy.name).getByTestId('ed2-person-status')).toHaveText('Free user');
    await expect(person(F.jai.name), 'ED2-10: moved to existing -> not a free user').toHaveCount(0);
    await expect(person(P.activeEngaged.name), 'ED2-10: paid wins over new_user_data').toHaveCount(0);
    await page.getByTestId('ed2-panel-close').click();

    // Last month: only people who had signed up by then — Ivy joined this month.
    await page.getByTestId('ed2-month-prev').click();
    await expect(page.getByTestId('ed2-month-label')).toContainText(monthName(prev));
    await expect(page.getByTestId('ed2-refreshing')).toHaveCount(0, { timeout: 60_000 });
    const oPrev = await ed2Oracle(prev, 'free');
    await expect(row(page, FREE).getByTestId('ed2-row-total'), 'ED2-10: last month free row = oracle').toHaveText(String(oPrev.total));
    await row(page, FREE).getByTestId('ed2-row-total').click();
    await expect(person(F.hari.name), 'ED2-10: Hari had signed up').toHaveCount(1);
    await expect(person(F.ivy.name), 'ED2-10: Ivy had not').toHaveCount(0);
  });
});

// =============================================================================================
// ED2-11 / ED2-12 — Send from the side panel (2026-11-03): Email / WhatsApp / Notification open the SAME
// composers as the workshop dashboard's Communication dialog (one shared CommunicationSendersService).
// No console guard, as in WDC-07/14: the composers log benign config errors when they open. Nothing is
// ever sent for real — ED2-11 dismisses every composer; ED2-12's WATI endpoint and bulk POST exist only in
// the test browser (captureWorkshopProgressSend).
// =============================================================================================
test.describe('Engagement dashboard v2 — send from the side panel', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);
    await installWshopStubs(page);
    await seedEd2World();
    await seedWatiConfig();
  });
  test.afterEach(async () => {
    await clearEd2World();
    await clearWatiConfig();
  });

  test('ED2-11 Email / WhatsApp / Notification count the people listed and open the Communication dialog\'s composers', async ({ page }) => {
    await openEd2(page);
    await row(page, wsEd2.ALPHA_NAME).getByTestId('ed2-row-engaged').click();
    const panel = page.getByTestId('ed2-panel');
    const email = panel.getByTestId('ed2-send-email');
    const whatsapp = panel.getByTestId('ed2-send-whatsapp');
    const notify = panel.getByTestId('ed2-send-notification');
    // Asha + Bala are listed; both have an address and a phone.
    await expect(panel.getByTestId('ed2-send-email-n'), 'ED2-11: email count = people listed with an address').toHaveText('2');
    await expect(panel.getByTestId('ed2-send-whatsapp-n'), 'ED2-11: WhatsApp count = people listed with a phone').toHaveText('2');
    await expect(panel.getByTestId('ed2-send-notification-n'), 'ED2-11: notification count = people listed').toHaveText('2');

    // [NEGATIVE CONTROL] nobody listed -> nothing to send.
    const search = panel.getByTestId('ed2-panel-search');
    await search.fill('zz-nobody-zz');
    await expect(email).toBeDisabled();
    await expect(whatsapp).toBeDisabled();
    await expect(notify).toBeDisabled();
    // The counts follow the list: one person.
    await search.fill(P.activeEngaged.email);
    await expect(panel.getByTestId('ed2-send-notification-n')).toHaveText('1');
    await expect(panel.getByTestId('ed2-send-email-n')).toHaveText('1');
    await expect(panel.getByTestId('ed2-send-whatsapp-n')).toHaveText('1');

    const dialogs = page.getByRole('dialog').filter({ hasNot: page.getByTestId('ed2-panel-title') });
    await expect(dialogs).toHaveCount(0);
    // WhatsApp -> SendmessagesComponent; its header x closes it.
    await whatsapp.click();
    await expect(dialogs, 'ED2-11: the WhatsApp composer opens').toHaveCount(1, { timeout: 20_000 });
    await expect(dialogs.last().getByRole('heading', { name: 'Send Message' })).toBeVisible({ timeout: 20_000 });
    await dialogs.last().locator('button.close-btn').first().click();
    await expect(dialogs, 'ED2-11: dismissed without sending').toHaveCount(0, { timeout: 15_000 });
    // Notification -> AhNotificationComponent (disableClose) — its mat-dialog-close x.
    await notify.click();
    await expect(dialogs, 'ED2-11: the notification composer opens').toHaveCount(1, { timeout: 20_000 });
    await dialogs.last().locator('button.close-button[mat-dialog-close]').click();
    await expect(dialogs).toHaveCount(0, { timeout: 15_000 });
    // Email -> the Email Campaign Composer (disableClose) — its header cancel.
    await email.click();
    await expect(dialogs, 'ED2-11: the email composer opens').toHaveCount(1, { timeout: 20_000 });
    await expect(dialogs.last().getByRole('heading', { name: 'Email Campaign Composer' })).toBeVisible({ timeout: 20_000 });
    // Escape belongs to the open composer: it must not close the side panel underneath.
    await page.keyboard.press('Escape');
    await expect(dialogs, 'ED2-11: Escape leaves the composer open (disableClose)').toHaveCount(1);
    await expect(panel.getByTestId('ed2-panel-title'), 'ED2-11: and the panel under it stays open').toBeVisible();
    await dialogs.last().locator('button.hdr-btn.danger').click();
    await expect(dialogs).toHaveCount(0, { timeout: 15_000 });
  });

  test('ED2-12 a WhatsApp send from the side panel carries the listed person\'s profileid and full number', async ({ page }) => {
    const sent = await captureWorkshopProgressSend(page);   // after the stubs, so these routes win
    await openEd2(page);
    await row(page, wsEd2.ALPHA_NAME).getByTestId('ed2-row-engaged').click();
    const panel = page.getByTestId('ed2-panel');
    await panel.getByTestId('ed2-panel-search').fill(P.activeEngaged.email);
    await expect(panel.getByTestId('ed2-person'), 'ED2-12: only Asha is listed').toHaveCount(1);

    await panel.getByTestId('ed2-send-whatsapp').click();
    const composer = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Send Message' }) });
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await pickWatiTemplate(page, composer);
    await composer.getByTestId('sen-send-whats-app-14').click();

    await expect.poll(sent, { message: 'ED2-12: the screen posts the bulk WhatsApp send', timeout: 30_000 }).not.toBeNull();
    const body = sent();
    expect(body.type, 'ED2-12: a WhatsApp send').toBe('whatsapp');
    expect(body.participants, 'ED2-12: only the listed person is sent').toHaveLength(1);
    expect(body.participants[0].profileid, 'ED2-12: their profileid').toBe(P.activeEngaged.id);
    expect(body.participants[0].phonenumber, 'ED2-12: dial code + number, as the workshop dashboard sends it').toBe('+919000000000');
  });
});
