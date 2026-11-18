// workshop-dashboard-new-exist.spec.ts — the side panel's New / Exist filter, the "New" tag, the
// Total Enrolled export's Enrollment Date + Tags columns, the Total Enrolled cards' tag chips + Tag filter
// (2026-11-12), the Total Enrolled sort and the Participant Data tags (2026-11-13), and the enrollment-date range on
// Total / Exist Users / New Users Enrolled, and the Tag filter on Exist Users / New Users Enrolled (2026-11-16).
// The New Users panel's own membership against its card lives in workshop-dashboard-new-users-panel.spec.ts (WNU-*):
// it needs the 2026-11-17 panel heading, and kept here it would make the hub-ahead guard skip this whole file on
// app branches that have the 2026-11-16 hooks but not that one.
//
// Recon: starlabs-angular specs/journals/2026-11-12-new-exist-and-export-tags.md.
//
// THE RULE UNDER TEST (workshop-dashboard.component.ts → isNewUserProfile):
//   New   = a still-new user: a new_user_data doc WITHOUT movedtoexist: true.
//   Exist = everyone else — participant metadata people, and new_user_data people marked movedtoexist.
// The participant-metadata `workshoponly` flag no longer decides either (it used to drive "New").
//
// Hooks: `wd-*` (workshop-dashboard.component.html). `wd-side-filter-all/new/exist`, `wd-side-enrolled-tag` and
// `wd-side-tag-filter/-option/-clear`, `wd-side-sort-*`, `wd-pd-tag` and `wd-side-enrolled-*` landed with these rules,
// so the hub-ahead guard (scripts/readiness/landed-specs.cjs) skips this file on app branches without it.
//
// THE WORLD (seedEnrolledExportCase + tagEnrolledExportCase, on W_DASH):
//   p0, p1 — participant metadata (p0 also stamped workshoponly: true — the OLD "New" condition)
//   moved  — new_user_data with movedtoexist: true and no metadata          → Exist
//   NU     — new_user_data, not moved                                        → New
//   NU's enrolled doc carries two real newusertags ids; moved's carries one id with no tag doc.
import { test, expect, Page } from '@playwright/test';
import {
  wsIds, wsProfileIds, installWshopStubs, loginAsWshopAdmin, stampP0Workshoponly,
  seedEnrolledExportCase, clearEnrolledExportCase, tagEnrolledExportCase, wsExportPeople, wsExportIds, wsExportTags,
  setEnrolledTags, enrollSecondNewUser, clearSecondNewUser, wsAddNames,
  readCsvRows,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc } from '../queue/support/firestore-admin';
import { readFileSync } from 'fs';

const PROGRESS_ROW = 'table.progress-table tr.mat-mdc-row, table.progress-table tr[mat-row]';
const cardNames = async (page: Page): Promise<string[]> =>
  (await page.locator('.participant-panel mat-card.participant-card .participant-name').allTextContents()).map(n => n.trim());
const nameOrder = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
const nameless = (n: string) => !n || n === 'Unknown';

const panelCard = (page: Page, name: string) =>
  page.locator('.participant-panel mat-card.participant-card').filter({ hasText: name });

async function openTotalEnrolled(page: Page): Promise<void> {
  await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('wd-on-metric-click-6').click({ timeout: 45_000 });
  await expect(page.getByTestId('wd-export-participants-62'), 'the Total Enrolled panel opens').toBeVisible({ timeout: 30_000 });
  await expect(panelCard(page, wsExportPeople.nu.name), 'the new user is listed').toBeVisible({ timeout: 30_000 });
}

/** The radios live in a mat-menu that closes after each pick, so open it every time. */
async function pickFilter(page: Page, id: 'wd-side-filter-all' | 'wd-side-filter-new' | 'wd-side-filter-exist'): Promise<void> {
  await page.getByTestId('wd-button-63').click();
  if (id === 'wd-side-filter-all') await page.getByTestId('wd-side-filter-all').click();
  if (id === 'wd-side-filter-new') await page.getByTestId('wd-side-filter-new').click();
  if (id === 'wd-side-filter-exist') await page.getByTestId('wd-side-filter-exist').click();
  if (await page.locator('.mat-mdc-menu-panel').count()) await page.keyboard.press('Escape');
}

test.describe('Workshop dashboard — New / Exist and the Total Enrolled export', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await seedEnrolledExportCase();
    await tagEnrolledExportCase();
    await stampP0Workshoponly(true);
  });
  test.afterEach(async () => {
    await stampP0Workshoponly(false);
    await clearEnrolledExportCase();
    assertNoFatal(guard, 'new / exist: no fatal console errors / pageerrors');
  });

  test('WNE-01 New is only the still-new user; Exist holds moved and participant-metadata people', async ({ page }) => {
    const p0Meta: any = await getDoc('participant metadata', wsProfileIds.p0);
    const { moved, nu } = wsExportPeople;
    await loginAsWshopAdmin(page);
    await openTotalEnrolled(page);
    await expect(panelCard(page, moved.name), 'All: the moved person is listed').toBeVisible();
    await expect(panelCard(page, p0Meta.name), 'All: p0 is listed').toBeVisible();

    await pickFilter(page, 'wd-side-filter-new');
    await expect(page.locator('.participant-panel h4', { hasText: /^Filter New/ }), 'WNE-01: the header names the filter').toBeVisible();
    await expect(panelCard(page, nu.name), 'WNE-01: New keeps the still-new user').toBeVisible();
    await expect(panelCard(page, moved.name), 'WNE-01: movedtoexist is NOT new').toHaveCount(0);
    await expect(panelCard(page, p0Meta.name), 'WNE-01: workshoponly no longer makes p0 new').toHaveCount(0);

    await pickFilter(page, 'wd-side-filter-exist');
    await expect(page.locator('.participant-panel h4', { hasText: /^Filter Exist/ }), 'WNE-01: the option is called Exist').toBeVisible();
    await expect(panelCard(page, moved.name), 'WNE-01: Exist holds the moved person').toBeVisible();
    await expect(panelCard(page, p0Meta.name), 'WNE-01: Exist holds p0').toBeVisible();
    await expect(panelCard(page, nu.name), 'WNE-01: Exist drops the new user').toHaveCount(0);

    await pickFilter(page, 'wd-side-filter-all');
    await expect(panelCard(page, nu.name), 'WNE-01: All brings everyone back').toBeVisible();
    await expect(panelCard(page, moved.name)).toBeVisible();
  });

  test('WNE-02 the "New" tag follows the same rule: on the new user only, as highlighted text', async ({ page }) => {
    const p0Meta: any = await getDoc('participant metadata', wsProfileIds.p0);
    await loginAsWshopAdmin(page);
    await openTotalEnrolled(page);

    const badge = panelCard(page, wsExportPeople.nu.name).locator('.new-badge');
    await expect(badge, 'WNE-02: the still-new user carries the tag').toBeVisible();
    await expect(badge, 'WNE-02: the tag is the word New').toHaveText(/^New$/i);
    expect(await badge.evaluate((el) => el.tagName.toLowerCase()), 'WNE-02: the tag is not an image').not.toBe('img');
    const bg = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg, `WNE-02: the tag is highlighted. Got "${bg}"`).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);

    await expect(panelCard(page, wsExportPeople.moved.name).locator('.new-badge'), 'WNE-02: no tag on a moved person').toHaveCount(0);
    await expect(panelCard(page, p0Meta.name).locator('.new-badge'), 'WNE-02: workshoponly alone gives no tag').toHaveCount(0);
    // The progress table uses the same rule: p0's row (workshoponly, participant metadata) has no tag.
    const p0Row = page.locator('table.progress-table tr.mat-mdc-row, table.progress-table tr[mat-row]').filter({ hasText: p0Meta.name });
    await expect(p0Row.first(), 'WNE-02: p0 has a progress row').toBeVisible({ timeout: 90_000 });
    await expect(p0Row.first().locator('.new-badge'), 'WNE-02: no tag in the progress table for p0').toHaveCount(0);
  });

  // Was WS-77 in workshop-dashboard.spec.ts; Tags added 2026-11-12.
  test('WNE-03 Total Enrolled export ends with Enrollment Date and Tags; other panels do not', async ({ page }) => {
    const p0Meta: any = await getDoc('participant metadata', wsProfileIds.p0);
    const enrA: any = await getDoc('workshop participant enrolled', wsIds.ENR_A);
    const enrMoved: any = await getDoc('workshop participant enrolled', wsExportIds.ENR_MOVED);
    expect(enrA?.enrollmentdate?.toMillis, 'WNE-03 precondition: p0 has a seeded enrollment date').toBeTruthy();
    expect(enrMoved?.enrollmentdate?.toMillis, 'WNE-03 precondition: the moved person has one').toBeTruthy();
    await loginAsWshopAdmin(page);
    await openTotalEnrolled(page);
    // Formatted in the browser exactly as the app's formatDateTime does: "<day>, <time>".
    const fmt = (ms: number) => page.evaluate((t) => {
      const d = new Date(t);
      return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${
        d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }, ms);
    const p0Date = await fmt(enrA.enrollmentdate.toMillis());
    const movedDate = await fmt(enrMoved.enrollmentdate.toMillis());
    expect(p0Date, 'WNE-03 precondition: the two seeded dates differ').not.toBe(movedDate);

    const exportPanel = async (name: string) => {
      page.once('dialog', (d) => d.accept());   // "export participants as CSV?"
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30_000 }),
        page.getByTestId('wd-export-participants-62').click(),
      ]);
      const file = test.info().outputPath(name);
      await download.saveAs(file);
      return readCsvRows(readFileSync(file, 'utf8').replace(/^﻿/, ''));
    };

    const [header, ...data] = await exportPanel('total-enrolled.csv');
    const col = (h: string) => header.indexOf(h);
    expect(header.slice(-2), 'WNE-03: Enrollment Date then Tags are the last two columns').toEqual(['Enrollment Date', 'Tags']);
    expect(header.slice(0, 6), 'WNE-03: the existing columns keep their positions')
      .toEqual(['Participant Name', 'Email', 'Phone', 'Active Journey', 'Last Journey', 'Subscription End']);

    const p0Row = data.find((r) => r[col('Email')] === p0Meta.email);
    expect(p0Row, 'WNE-03: p0 is exported').toBeTruthy();
    expect(p0Row![col('Enrollment Date')], 'WNE-03: p0 carries their own date and time').toBe(p0Date);
    expect(p0Row![col('Enrollment Date')], 'WNE-03: the time is included').toMatch(/, \d{1,2}:\d{2}\s?(am|pm)$/i);
    expect(p0Row![col('Tags')], 'WNE-03: no tags → empty').toBe('');

    const movedRow = data.find((r) => r[col('Participant Name')] === wsExportPeople.moved.name);
    expect(movedRow, 'WNE-03: the moved person is exported').toBeTruthy();
    expect(movedRow![col('Enrollment Date')], 'WNE-03: the moved person carries their own date').toBe(movedDate);
    expect(movedRow![col('Tags')], 'WNE-03: a tag id with no tag doc exports as nothing').toBe('');

    const nuRow = data.find((r) => r[col('Participant Name')] === wsExportPeople.nu.name);
    expect(nuRow, 'WNE-03: the new user is exported').toBeTruthy();
    expect(nuRow![col('Tags')], 'WNE-03: tag ids export as their names, in stored order')
      .toBe(`${wsExportTags.segment.name}, ${wsExportTags.venue.name}`);

    // Negative control: another panel's export (Exist Users Enrolled) has neither column.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wdash-exist-users-card').click();
    await expect(page.getByTestId('wd-export-participants-62'), 'WNE-03: the Exist Users panel opens with Export').toBeVisible({ timeout: 30_000 });
    const [otherHeader, ...otherData] = await exportPanel('exist-users.csv');
    expect(otherData.length, 'WNE-03: the other panel exported rows').toBeGreaterThan(0);
    expect(otherHeader, 'WNE-03: the other panel still exports Email').toContain('Email');
    expect(otherHeader, 'WNE-03: only Total Enrolled adds Enrollment Date').not.toContain('Enrollment Date');
    expect(otherHeader, 'WNE-03: only Total Enrolled adds Tags').not.toContain('Tags');
  });

  test('WNE-04 Total Enrolled cards show the enrolled-doc tags beside the New tag; other panels do not', async ({ page }) => {
    const { moved, nu } = wsExportPeople;
    const { segment, venue, ghost } = wsExportTags;
    // The moved person carries a deleted tag id AND a real one, so the card must drop just the dead id.
    await tagEnrolledExportCase([ghost, segment.id]);
    const p0Meta: any = await getDoc('participant metadata', wsProfileIds.p0);
    await loginAsWshopAdmin(page);
    await openTotalEnrolled(page);

    const nuCard = panelCard(page, nu.name);
    await expect(nuCard.getByTestId('wd-side-enrolled-tag'), 'WNE-04: tag ids show as names, in stored order')
      .toHaveText([segment.name, venue.name], { timeout: 30_000 });
    await expect(nuCard.locator('.new-badge'), 'WNE-04: beside the New tag').toBeVisible();
    await expect(panelCard(page, moved.name).getByTestId('wd-side-enrolled-tag'),
      'WNE-04: a deleted tag id shows nothing; the real one shows its name').toHaveText([segment.name]);
    await expect(panelCard(page, p0Meta.name).getByTestId('wd-side-enrolled-tag'), 'WNE-04: no tags → no chips')
      .toHaveCount(0);

    // Negative control: Exist Users Enrolled lists the same moved person, without the Total Enrolled chips.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wdash-exist-users-card').click();
    await expect(panelCard(page, moved.name), 'WNE-04: the moved person is in Exist Users').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('wd-side-enrolled-tag'), 'WNE-04: Exist Users never draws the Total Enrolled chips (it has its own hook since 2026-11-17, WNE-10)').toHaveCount(0);
  });

  test('WNE-05 Total Enrolled filters by enrolment tag, together with New / Exist; other panels have no Tag filter', async ({ page }) => {
    const { moved, nu } = wsExportPeople;
    const { segment, venue, ghost } = wsExportTags;
    // NU carries Segment + Venue; the moved person carries Segment plus a dead id; p0 carries none.
    await tagEnrolledExportCase([ghost, segment.id]);
    const p0Meta: any = await getDoc('participant metadata', wsProfileIds.p0);
    await loginAsWshopAdmin(page);
    await openTotalEnrolled(page);
    await expect(panelCard(page, nu.name).getByTestId('wd-side-enrolled-tag'), 'WNE-05 precondition: tags loaded')
      .toHaveCount(2, { timeout: 30_000 });

    await page.getByTestId('wd-button-63').click();
    await expect(page.getByTestId('wd-side-tag-filter'), 'WNE-05: the Tag filter sits under All / New / Exist').toBeVisible();
    await expect(page.getByTestId('wd-side-filter-exist'), 'WNE-05: in the same menu as New / Exist').toBeVisible();
    const option = page.getByTestId('wd-side-tag-option');
    await expect(option, 'WNE-05: one option per tag in the panel, A to Z; a dead id offers nothing')
      .toHaveText([segment.name, venue.name]);

    await option.filter({ hasText: venue.name }).click();
    await expect(panelCard(page, nu.name), 'WNE-05: Venue keeps the person carrying it').toBeVisible();
    await expect(panelCard(page, moved.name), 'WNE-05: Venue drops the moved person (Segment only)').toHaveCount(0);
    await expect(panelCard(page, p0Meta.name), 'WNE-05: Venue drops untagged p0').toHaveCount(0);

    await option.filter({ hasText: segment.name }).click();     // the menu stays open while ticking
    await expect(panelCard(page, moved.name), 'WNE-05: any ticked tag matches').toBeVisible();
    await expect(panelCard(page, nu.name)).toBeVisible();
    await expect(panelCard(page, p0Meta.name), 'WNE-05: still no untagged people').toHaveCount(0);

    await page.getByTestId('wd-side-filter-exist').click();     // picking a radio closes the menu
    await expect(panelCard(page, moved.name), 'WNE-05: Exist + tags keeps the moved person').toBeVisible();
    await expect(panelCard(page, nu.name), 'WNE-05: Exist + tags drops the new user').toHaveCount(0);

    await page.getByTestId('wd-button-63').click();
    await page.getByTestId('wd-side-tag-clear').click();
    await page.keyboard.press('Escape');
    await pickFilter(page, 'wd-side-filter-all');
    await expect(panelCard(page, p0Meta.name), 'WNE-05: Clear + All brings untagged people back').toBeVisible();
    await expect(panelCard(page, nu.name)).toBeVisible();
    await expect(panelCard(page, moved.name)).toBeVisible();

    // Negative control: Total Started has the same filter menu, without the Tag filter. (Exist Users Enrolled and
    // New Users Enrolled gained it on 2026-11-16 — WNE-09.)
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wd-on-metric-click-16').click();
    await expect(page.getByTestId('wd-close-participant-panel-61'), 'WNE-05: the Total Started panel opened').toBeVisible({ timeout: 30_000 });
    await page.getByTestId('wd-button-63').click();
    await expect(page.getByTestId('wd-side-filter-exist'), 'WNE-05: its filter menu opened').toBeVisible();
    await expect(page.getByTestId('wd-side-tag-filter'), 'WNE-05: no Tag filter there').toHaveCount(0);
  });

  test('WNE-06 Total Enrolled opens newest-enrolled first; sorts by date and name; picking the active sort turns it off; other panels have no sort', async ({ page }) => {
    const p0Meta: any = await getDoc('participant metadata', wsProfileIds.p0);
    const { moved } = wsExportPeople;   // enrolled now; p0 enrolled 5 days ago
    const ticked = page.locator('.side-sort-menu .mat-mdc-menu-item.on');
    const movedAboveP0 = async () => { const n = await cardNames(page); return n.indexOf(moved.name) < n.indexOf(p0Meta.name); };
    await loginAsWshopAdmin(page);
    await openTotalEnrolled(page);
    await expect(panelCard(page, p0Meta.name), 'WNE-06 precondition: p0 is listed').toBeVisible();
    expect((await cardNames(page)).length, 'WNE-06 precondition: enough people to sort').toBeGreaterThan(2);

    // Default: most recent enrollment first, and the menu says so.
    await expect.poll(movedAboveP0, { message: 'WNE-06: by default the moved person (today) is above p0 (5 days ago)' }).toBe(true);
    await page.getByTestId('wd-side-sort-btn').click();
    await expect(ticked, 'WNE-06: one choice is ticked by default').toHaveCount(1);
    await expect(page.getByTestId('wd-side-sort-enrolled-new'), 'WNE-06: ...newest first').toHaveClass(/\bon\b/);
    await page.getByTestId('wd-side-sort-enrolled-old').click();
    await expect.poll(movedAboveP0, { message: 'WNE-06: oldest first puts p0 above the moved person' }).toBe(false);

    const current = await cardNames(page);
    const az = [...current.filter(n => !nameless(n))].sort(nameOrder).concat(current.filter(nameless));
    await page.getByTestId('wd-side-sort-btn').click();
    await page.getByTestId('wd-side-sort-name-az').click();
    await expect.poll(() => cardNames(page), { message: 'WNE-06: A to Z, ignoring case, nameless last' }).toEqual(az);

    const za = [...current.filter(n => !nameless(n))].sort((a, b) => -nameOrder(a, b)).concat(current.filter(nameless));
    await page.getByTestId('wd-side-sort-btn').click();
    await page.getByTestId('wd-side-sort-name-za').click();
    await expect.poll(() => cardNames(page), { message: 'WNE-06: Z to A, nameless still last' }).toEqual(za);

    // Picking the active choice again turns sorting off: nothing ticked.
    await page.getByTestId('wd-side-sort-btn').click();
    await page.getByTestId('wd-side-sort-name-za').click();
    await page.getByTestId('wd-side-sort-btn').click();
    await expect(ticked, 'WNE-06: sorting is off').toHaveCount(0);
    await page.keyboard.press('Escape');

    // Reopening Total Enrolled starts on newest first again.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await openTotalEnrolled(page);
    await expect.poll(movedAboveP0, { message: 'WNE-06: reopened panel is newest first again' }).toBe(true);

    // Negative control: Exist Users Enrolled has no sort button.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wdash-exist-users-card').click();
    await expect(panelCard(page, moved.name), 'WNE-06: the Exist Users panel opened').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('wd-side-sort-btn'), 'WNE-06: only Total Enrolled sorts').toHaveCount(0);
  });

  test('WNE-07 Participant Data shows the enrollment\'s tag names after the platform; none while untagged', async ({ page }) => {
    const { segment, venue, ghost } = wsExportTags;
    const p0Meta: any = await getDoc('participant metadata', wsProfileIds.p0);
    const openP0 = async () => {
      await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
      const p0Row = page.locator(PROGRESS_ROW).filter({ hasText: p0Meta.name }).first();
      await expect(p0Row, 'WNE-07: p0 has a progress row').toBeVisible({ timeout: 90_000 });
      await p0Row.click();
      await expect(page.getByTestId('wdash-pd-platform'), 'WNE-07: Participant Data opened').toBeVisible({ timeout: 30_000 });
    };
    await setEnrolledTags(wsIds.ENR_A, null);
    try {
      await loginAsWshopAdmin(page);
      // [NEGATIVE CONTROL] the same person, untagged: Participant Data opens with no tag pills.
      await openP0();
      await expect(page.getByTestId('wd-pd-tag'), 'WNE-07: no tags on an untagged enrollment').toHaveCount(0);

      // Stored order venue, dead id, segment: names in that order, the dead id dropped.
      await setEnrolledTags(wsIds.ENR_A, [venue.id, ghost, segment.id]);
      await openP0();
      await expect(page.getByTestId('wd-pd-tag'), 'WNE-07: tag names in stored order, the dead id dropped')
        .toHaveText([venue.name, segment.name], { timeout: 30_000 });
    } finally {
      await setEnrolledTags(wsIds.ENR_A, null);
    }
  });

  test('WNE-08 Total, Exist Users and New Users Enrolled filter by enrollment date; either end alone works; reopening clears it', async ({ page }) => {
    const p0Meta: any = await getDoc('participant metadata', wsProfileIds.p0);
    const enrA: any = await getDoc('workshop participant enrolled', wsIds.ENR_A);          // p0, 5 days ago
    const enrMoved: any = await getDoc('workshop participant enrolled', wsExportIds.ENR_MOVED);   // moved + NU: now
    const { moved, nu } = wsExportPeople;
    await loginAsWshopAdmin(page);
    // Day strings in the browser's own time zone, as the date inputs read them.
    const dayOf = (ms: number) => page.evaluate((t) => {
      const d = new Date(t);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }, ms);
    await openTotalEnrolled(page);
    const p0Day = await dayOf(enrA.enrollmentdate.toMillis());
    const newDay = await dayOf(enrMoved.enrollmentdate.toMillis());
    expect(p0Day, 'WNE-08 precondition: the two enrollment days differ').not.toBe(newDay);
    const from = page.getByTestId('wd-side-enrolled-from');
    const to = page.getByTestId('wd-side-enrolled-to');
    await expect(page.getByTestId('wd-side-enrolled-range'), 'WNE-08: Total Enrolled has the range').toBeVisible();
    await expect(page.getByTestId('wd-side-enrolled-clear'), 'WNE-08: no Clear while empty').toHaveCount(0);

    // Total Enrolled: p0's day only.
    await from.fill(p0Day);
    await to.fill(p0Day);
    await expect(panelCard(page, p0Meta.name), 'WNE-08: p0 enrolled that day').toBeVisible();
    await expect(panelCard(page, moved.name), 'WNE-08: the moved person (today) is out').toHaveCount(0);
    await expect(panelCard(page, nu.name), 'WNE-08: the new user (today) is out').toHaveCount(0);
    // From alone: today onwards.
    await from.fill(newDay);
    await to.fill('');
    await expect(panelCard(page, moved.name), 'WNE-08: From alone keeps today').toBeVisible();
    await expect(panelCard(page, nu.name)).toBeVisible();
    await expect(panelCard(page, p0Meta.name), 'WNE-08: ...and drops 5 days ago').toHaveCount(0);
    await page.getByTestId('wd-side-enrolled-clear').click();
    await expect(from, 'WNE-08: Clear empties From').toHaveValue('');
    await expect(panelCard(page, p0Meta.name), 'WNE-08: Clear brings everyone back').toBeVisible();

    // Reopening the panel starts without a range.
    await from.fill(newDay);
    await page.getByTestId('wd-close-participant-panel-61').click();
    await openTotalEnrolled(page);
    await expect(page.getByTestId('wd-side-enrolled-from'), 'WNE-08: reopened → no range').toHaveValue('');

    // Exist Users Enrolled: p0's day keeps p0, drops the moved person.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wdash-exist-users-card').click();
    await expect(panelCard(page, moved.name), 'WNE-08: the Exist Users panel opened').toBeVisible({ timeout: 30_000 });
    await page.getByTestId('wd-side-enrolled-from').fill(p0Day);
    await page.getByTestId('wd-side-enrolled-to').fill(p0Day);
    await expect(panelCard(page, p0Meta.name), 'WNE-08: Exist Users keeps p0').toBeVisible();
    await expect(panelCard(page, moved.name), 'WNE-08: ...and drops the moved person').toHaveCount(0);

    // New Users Enrolled: today keeps the new user, p0's day drops them.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wd-on-metric-click-19').click();
    await expect(panelCard(page, nu.name), 'WNE-08: the New Users Enrolled panel lists the new user').toBeVisible({ timeout: 30_000 });
    await page.getByTestId('wd-side-enrolled-from').fill(newDay);
    await expect(panelCard(page, nu.name), 'WNE-08: enrolled today → kept').toBeVisible();
    await page.getByTestId('wd-side-enrolled-from').fill(p0Day);
    await page.getByTestId('wd-side-enrolled-to').fill(p0Day);
    await expect(panelCard(page, nu.name), 'WNE-08: not enrolled on that day → out').toHaveCount(0);

    // Negative control: Total Started has no enrollment range.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wd-on-metric-click-16').click();
    await expect(page.getByTestId('wd-close-participant-panel-61'), 'WNE-08: the Total Started panel opened').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('wd-side-enrolled-range'), 'WNE-08: only the three enrolled panels have it').toHaveCount(0);
  });

  test('WNE-09 Exist Users Enrolled and New Users Enrolled filter by enrollment tag too; reopening clears it', async ({ page }) => {
    const { moved, nu } = wsExportPeople;
    const { segment, venue, ghost } = wsExportTags;
    // Exist side: the moved person carries Segment (+ a dead id); p0 is untagged.
    // New side: NU carries Segment + Venue; a second enrolled new user (NU Bravo) carries Venue only.
    await tagEnrolledExportCase([ghost, segment.id]);
    await enrollSecondNewUser([venue.id]);
    try {
      const p0Meta: any = await getDoc('participant metadata', wsProfileIds.p0);
      await loginAsWshopAdmin(page);
      await openTotalEnrolled(page);
      await page.getByTestId('wd-close-participant-panel-61').click();

      // Exist Users Enrolled — the shared filter menu now has Tags.
      await page.getByTestId('wdash-exist-users-card').click();
      await expect(panelCard(page, moved.name), 'WNE-09: Exist Users opened').toBeVisible({ timeout: 30_000 });
      await expect(panelCard(page, p0Meta.name), 'WNE-09: p0 is listed').toBeVisible();
      await page.getByTestId('wd-button-63').click();
      await expect(page.getByTestId('wd-side-tag-filter'), 'WNE-09: Exist Users has the Tag filter').toBeVisible({ timeout: 30_000 });
      const option = page.getByTestId('wd-side-tag-option');
      await expect(option, 'WNE-09: only the tags of people in this panel (the moved person); dead ids offer nothing')
        .toHaveText([segment.name]);
      await option.filter({ hasText: segment.name }).click();
      await expect(panelCard(page, moved.name), 'WNE-09: the tagged person stays').toBeVisible();
      await expect(panelCard(page, p0Meta.name), 'WNE-09: the untagged one goes').toHaveCount(0);
      await page.getByTestId('wd-side-tag-clear').click();
      await page.keyboard.press('Escape');
      await expect(panelCard(page, p0Meta.name), 'WNE-09: Clear brings p0 back').toBeVisible();

      // Reopening starts with nothing ticked.
      await page.getByTestId('wd-button-63').click();
      await option.filter({ hasText: segment.name }).click();
      await page.keyboard.press('Escape');
      await page.getByTestId('wd-close-participant-panel-61').click();
      await page.getByTestId('wdash-exist-users-card').click();
      await expect(panelCard(page, p0Meta.name), 'WNE-09: reopened → unfiltered').toBeVisible({ timeout: 30_000 });

      // New Users Enrolled — its own filter menu gets the same Tags section.
      await page.getByTestId('wd-close-participant-panel-61').click();
      await page.getByTestId('wd-on-metric-click-19').click();
      await expect(panelCard(page, nu.name), 'WNE-09: New Users Enrolled opened').toBeVisible({ timeout: 30_000 });
      await expect(panelCard(page, wsAddNames.nuBravo), 'WNE-09: the second new user is listed').toBeVisible();
      await page.getByTestId('wd-button-65').click();
      await expect(page.getByTestId('wd-side-tag-filter'), 'WNE-09: New Users Enrolled has the Tag filter').toBeVisible({ timeout: 30_000 });
      await expect(option, 'WNE-09: the new users\' tags, A to Z').toHaveText([segment.name, venue.name]);
      await option.filter({ hasText: segment.name }).click();
      await expect(panelCard(page, nu.name), 'WNE-09: Segment keeps NU').toBeVisible();
      await expect(panelCard(page, wsAddNames.nuBravo), 'WNE-09: ...and drops NU Bravo (Venue only)').toHaveCount(0);
      await option.filter({ hasText: venue.name }).click();
      await expect(panelCard(page, wsAddNames.nuBravo), 'WNE-09: any ticked tag matches').toBeVisible();
    } finally {
      await clearSecondNewUser();
    }
  });
});
