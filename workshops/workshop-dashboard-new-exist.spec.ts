// workshop-dashboard-new-exist.spec.ts — the side panel's New / Exist filter, the "New" tag, the
// Total Enrolled export's Enrollment Date + Tags columns, and the Total Enrolled cards' tag chips + Tag filter
// (2026-11-12).
//
// Recon: starlabs-angular specs/journals/2026-11-12-new-exist-and-export-tags.md.
//
// THE RULE UNDER TEST (workshop-dashboard.component.ts → isNewUserProfile):
//   New   = a still-new user: a new_user_data doc WITHOUT movedtoexist: true.
//   Exist = everyone else — participant metadata people, and new_user_data people marked movedtoexist.
// The participant-metadata `workshoponly` flag no longer decides either (it used to drive "New").
//
// Hooks: `wd-*` (workshop-dashboard.component.html). `wd-side-filter-all/new/exist`, `wd-side-enrolled-tag` and
// `wd-side-tag-filter/-option/-clear` landed with these rules,
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
  readCsvRows,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc } from '../queue/support/firestore-admin';
import { readFileSync } from 'fs';

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

    // Negative control: Exist Users Enrolled lists the same moved person, without chips.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wdash-exist-users-card').click();
    await expect(panelCard(page, moved.name), 'WNE-04: the moved person is in Exist Users').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('wd-side-enrolled-tag'), 'WNE-04: only Total Enrolled shows tag chips').toHaveCount(0);
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

    // Negative control: Exist Users Enrolled has the same filter menu, without the Tag filter.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wdash-exist-users-card').click();
    await expect(panelCard(page, moved.name), 'WNE-05: the Exist Users panel opened').toBeVisible({ timeout: 30_000 });
    await page.getByTestId('wd-button-63').click();
    await expect(page.getByTestId('wd-side-filter-exist'), 'WNE-05: its filter menu opened').toBeVisible();
    await expect(page.getByTestId('wd-side-tag-filter'), 'WNE-05: only Total Enrolled has the Tag filter').toHaveCount(0);
  });
});
