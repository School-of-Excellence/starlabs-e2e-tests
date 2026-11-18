// new-users-redesign.spec.ts — /newusersprofile after the 2026-11-16 redesign ("Heritage Ledger").
//
// Recon: starlabs-angular specs/plans/2026-11-16-new-users-redesign-dev.md ("Coverage to add") and the design
// journal specs/journals/2026-11-16-new-users-redesign.md (mockups: new-users-ui.html, new-users-states.html).
//
// Hooks — one prefix per component:
//   `new` = New-Workshop/newusersprofile/newusersprofile.component.html
//   `atd` = New-Workshop/newusersprofile/assign-tags-dialog/assign-tags-dialog.component.html
// Every case keys on hooks that landed with the redesign (new-created-pill, new-chip-*, new-dock-*, new-xpage-*,
// new-file-*, new-why-*, new-filters-*, atd-chip-count, ...), so the hub-ahead guard (scripts/readiness/
// landed-specs.cjs) skips this whole file on app branches that predate the port. new-users-profile.spec.ts and
// new-users-screen.spec.ts keep the pre-redesign contract and stay green on both sides.
//
// WS-56 (Created range) moved here as NUR-01: the From/To inputs live in the Created panel now (they were always
// on the toolbar), and they read D/M/Y and "12 Nov 2026" instead of M/D/Y.
//
// Anti-circularity: counts are checked against the TEST's own read of Firestore (newUserRows, newUserSegmentTags,
// newUserIdsEnrolledIn, countFunnelWorkshops), never against a number the app printed elsewhere. Filters are
// asserted negative-half first (a row that rendered a moment ago must be GONE), because a predicate that throws
// leaves every row in place.
import { test, expect, Page, Route, Locator } from '@playwright/test';
import {
  wsAddIds, wsAddNames, wsIds, installWshopStubs, loginAsWshopAdmin, resetNewUserTags,
  seedConvertedNewUser, clearConvertedNewUser, seedEnrolledExportCase, clearEnrolledExportCase,
  wsRenameTag, seedRenameTag, clearRenameTag,
  wsSeedDate, wsDayDMY, wsSeedDayDMY, wsCrowd, seedNewUserCrowd, clearNewUserCrowd,
  wsSubscriber, seedSubscriberNewUser, clearSubscriberNewUser,
  newUserRows, newUserIdsEnrolledIn, countFunnelWorkshops, newUserSegmentTags,
} from './support/wshop';
import { xlsxColumnA } from './support/xlsx-mini';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil } from '../queue/support/firestore-admin';

const ROW = 'table.users-table tr.mat-mdc-row, table.users-table tr[mat-row]';
const RUN = process.env.WSHOP_RUNID || 'wshop';
const SEG = wsAddNames.segment;
const DASH_TITLE = `Dashboard Workshop ${RUN}`;

const rowFor = (page: Page, name: string) => page.locator(ROW).filter({ hasText: name });
const n = (v: number) => v.toLocaleString('en-US');
const people = (v: number) => `${n(v)} ${v === 1 ? 'person' : 'people'}`;
const matches = (v: number) => `${n(v)} ${v === 1 ? 'person matches' : 'people match'}`;
const sameDay = (a: Date | null, b: Date) =>
  !!a && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const MONTH_LONG = (d: Date) => `${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;

async function openScreen(page: Page, waitFor: string): Promise<void> {
  await page.goto('/newusersprofile', { waitUntil: 'domcontentloaded' });
  await expect(rowFor(page, waitFor), 'the table must render').toHaveCount(1, { timeout: 30_000 });
}

/** Tick a row's own checkbox (the mat-checkbox input, as NUS-05 does). */
async function tick(page: Page, name: string): Promise<void> {
  await rowFor(page, name).getByTestId('new-change-selection-24').locator('input').click();
}

/** The no-match chip that holds a given × (the chip itself carries no hook). */
const chipOf = (x: Locator) => x.locator('xpath=..');

/**
 * Hold every new Firestore read for `ms` on its way to the emulator, so an in-progress state stays on screen long
 * enough to assert. Reads go through the Listen channel; only the POSTs that add a target are held (the long-poll
 * GET that carries the answers is left alone). Returns the release function.
 */
async function holdReads(page: Page, ms: number): Promise<() => Promise<void>> {
  const pattern = '**/google.firestore.v1.Firestore/Listen/channel**';
  const handler = async (route: Route) => {
    if (route.request().method() === 'POST') await new Promise(r => setTimeout(r, ms));
    await route.continue().catch(() => undefined);
  };
  await page.route(pattern, handler);
  return () => page.unroute(pattern, handler);
}

test.describe('Workshops — new users redesign: panels, readout, selection, file, narrow layout, tag dialogs', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'new users redesign: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // NUR-01 (was WS-56) — the Created panel narrows the table to a typed window; the chip × clears it.
  //
  // The three seeded users sit on three different days (-1d / -2d / -3d). A one-day window on the MIDDLE day puts
  // a negative control on BOTH sides, so a filter that ignored either bound fails. All three are asserted visible
  // together first (one page of 20), so a row that disappears was filtered, not paged away.
  // ===========================================================================================
  test('NUR-01 (was WS-56) the Created panel narrows the table to the typed window; the chip × clears it', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openScreen(page, wsAddNames.nuAlpha);
    await expect(rowFor(page, wsAddNames.nuBravo), 'NUR-01: the -2d user must render').toHaveCount(1);
    await expect(rowFor(page, wsAddNames.nuCharlie), 'NUR-01: the -3d user must render').toHaveCount(1);

    const start = page.getByTestId('new-created-start-date');
    const end = page.getByTestId('new-created-end-date');
    await expect(start, 'NUR-01: the dates live in the Created panel, not on the toolbar').toHaveCount(0);
    await page.getByTestId('new-created-pill').click();
    await expect(page.getByTestId('new-created-panel'), 'NUR-01: the pill opens the Created panel').toBeVisible();

    // [REAL-UI] the same day in both bounds, typed the way the panel shows days ("14 Nov 2026"). Tab (blur) commits
    // From; Enter commits To — both commit paths are exercised.
    const middleDay = wsSeedDayDMY(-2);
    await start.fill(middleDay);
    await start.press('Tab');
    await end.fill(middleDay);
    await end.press('Enter');

    await expect(rowFor(page, wsAddNames.nuAlpha), `NUR-01: the -1d user is NEWER than ${middleDay} and must go`).toHaveCount(0, { timeout: 15_000 });
    await expect(rowFor(page, wsAddNames.nuCharlie), `NUR-01: the -3d user is OLDER than ${middleDay} and must go`).toHaveCount(0);
    await expect(rowFor(page, wsAddNames.nuBravo), 'NUR-01: the user created inside the window stays').toHaveCount(1);
    await expect(page.getByTestId('new-chip-created').locator('b'), 'NUR-01: the readout spells the window out').toHaveText(middleDay);
    await expect(page.getByTestId('new-created-pill'), 'NUR-01: the pill shows it is set').toHaveAttribute('aria-label', 'Created date filter, on');

    // [REAL-UI] the chip × (new-event-17) drops both bounds. Escape first: the open panel would cover the readout.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('new-created-panel'), 'NUR-01: Escape closes the panel').toHaveCount(0);
    await page.getByTestId('new-event-17').click();
    await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-01: clearing restores the newer row').toHaveCount(1, { timeout: 15_000 });
    await expect(rowFor(page, wsAddNames.nuCharlie), 'NUR-01: clearing restores the older row').toHaveCount(1);
    await expect(page.getByTestId('new-chip-created'), 'NUR-01: the chip goes with the filter').toHaveCount(0);
    await expect(page.getByTestId('new-created-pill')).toHaveAttribute('aria-label', 'Created date filter, off');
    await page.getByTestId('new-created-pill').click();
    await expect(start, 'NUR-01: both inputs are empty again').toHaveValue('');
    await expect(end).toHaveValue('');
  });

  // ===========================================================================================
  // NUR-02 — typed formats (D/M/Y, "14 nov"), an unreadable end, the quick ranges, and the month calendar.
  // ===========================================================================================
  test('NUR-02 Created reads D/M/Y and "d mmm", ignores an unreadable end, and offers quick ranges and a calendar', async ({ page }) => {
    const rows = await newUserRows();
    const today = new Date();
    const d1 = wsSeedDate(-1);
    const d2 = wsSeedDate(-2);
    const onD2 = rows.filter(r => sameDay(r.created, d2)).length;
    await loginAsWshopAdmin(page);
    await openScreen(page, wsAddNames.nuAlpha);

    const start = page.getByTestId('new-created-start-date');
    const end = page.getByTestId('new-created-end-date');
    await page.getByTestId('new-created-pill').click();

    // D/M/Y numerics read the Indian way; the field shows the day back as "14 Nov 2026".
    await start.fill(`${d2.getDate()}/${d2.getMonth() + 1}/${d2.getFullYear()}`);
    await start.press('Enter');
    await expect(start, 'NUR-02: D/M/Y is read day-first and shown back').toHaveValue(wsDayDMY(d2));
    // "14 nov" (no year = this year), any case.
    const short = d2.getFullYear() === today.getFullYear()
      ? `${d2.getDate()} ${wsDayDMY(d2).split(' ')[1].toLowerCase()}` : wsDayDMY(d2).toLowerCase();
    await end.fill(short);
    await end.press('Enter');
    await expect(end, 'NUR-02: "d mmm" is read and shown back').toHaveValue(wsDayDMY(d2));
    await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-02: -1d is outside the typed day').toHaveCount(0, { timeout: 15_000 });
    await expect(rowFor(page, wsAddNames.nuCharlie), 'NUR-02: -3d is outside the typed day').toHaveCount(0);
    await expect(rowFor(page, wsAddNames.nuBravo)).toHaveCount(1);
    await expect(page.getByTestId('new-created-match-count'), 'NUR-02: the panel counts the people that day (Firestore)')
      .toHaveText(matches(onD2));

    // An unreadable From is no bound (and stays as typed); only "until d2" applies now.
    await start.fill('someday soon');
    await start.press('Enter');
    await expect(start, 'NUR-02: unreadable text stays as typed').toHaveValue('someday soon');
    await expect(rowFor(page, wsAddNames.nuCharlie), 'NUR-02: with no From, the older row comes back').toHaveCount(1, { timeout: 15_000 });
    await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-02: the To bound still holds').toHaveCount(0);
    await expect(page.getByTestId('new-chip-created').locator('b')).toHaveText(`until ${wsDayDMY(d2)}`);

    // Clear (in the panel) empties both and drops the filter.
    await page.getByTestId('new-created-clear').click();
    await expect(start).toHaveValue('');
    await expect(end).toHaveValue('');
    await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-02: Clear drops the filter').toHaveCount(1, { timeout: 15_000 });

    // Quick ranges. Today leaves out the -1d user; Last 7 days takes all three back.
    await page.getByTestId('new-created-preset-today').click();
    await expect(page.getByTestId('new-created-preset-today'), 'NUR-02: the active preset is marked').toHaveAttribute('aria-pressed', 'true');
    await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-02: Today leaves out yesterday').toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId('new-chip-created').locator('b')).toHaveText(wsDayDMY(today));
    await page.getByTestId('new-created-preset-7d').click();
    await expect(page.getByTestId('new-created-preset-7d')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('new-created-preset-today')).toHaveAttribute('aria-pressed', 'false');
    await expect(rowFor(page, wsAddNames.nuCharlie), 'NUR-02: Last 7 days takes -3d in').toHaveCount(1, { timeout: 15_000 });
    await expect(rowFor(page, wsAddNames.nuAlpha)).toHaveCount(1);
    await expect(page.getByTestId('new-chip-created').locator('b'), 'NUR-02: the range ends today').toContainText(wsDayDMY(today));
    await page.getByTestId('new-created-preset-30d').click();
    await expect(page.getByTestId('new-created-preset-30d')).toHaveAttribute('aria-pressed', 'true');
    await expect(rowFor(page, wsAddNames.nuCharlie)).toHaveCount(1);
    await page.getByTestId('new-created-preset-month').click();
    await expect(page.getByTestId('new-created-preset-month')).toHaveAttribute('aria-pressed', 'true');
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-02: This month starts on the 1st')
      .toHaveCount(d1 >= firstOfMonth ? 1 : 0, { timeout: 15_000 });

    // The month calendar: the grid shows this month; prev/next move it; two clicks on one day make a one-day range.
    await page.getByTestId('new-created-clear').click();
    await expect(page.getByTestId('new-created-picker-16'), 'NUR-02: the calendar is in the panel').toBeVisible();
    await expect(page.getByTestId('new-cal-grid')).toBeVisible();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    await expect(page.getByTestId('new-cal-month')).toHaveText(MONTH_LONG(thisMonth));
    await expect(page.getByTestId('new-cal-day').and(page.locator('[aria-current="date"]')), 'NUR-02: today is marked')
      .toHaveAttribute('aria-label', wsDayDMY(today));
    await page.getByTestId('new-cal-prev').click();
    await expect(page.getByTestId('new-cal-month')).toHaveText(MONTH_LONG(prevMonth));
    await page.getByTestId('new-cal-next').click();
    await expect(page.getByTestId('new-cal-month')).toHaveText(MONTH_LONG(thisMonth));
    if (d2.getMonth() !== today.getMonth()) await page.getByTestId('new-cal-prev').click();
    const d2Button = page.getByTestId('new-cal-day').and(page.locator(`[aria-label="${wsDayDMY(d2)}"]`));
    await d2Button.click();
    await d2Button.click();
    await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-02: a calendar day range filters too').toHaveCount(0, { timeout: 15_000 });
    await expect(rowFor(page, wsAddNames.nuCharlie)).toHaveCount(0);
    await expect(rowFor(page, wsAddNames.nuBravo)).toHaveCount(1);
    await expect(start, 'NUR-02: the picked day is written into From').toHaveValue(wsDayDMY(d2));
    await expect(end).toHaveValue(wsDayDMY(d2));

    // Done closes the panel and keeps the filter.
    await page.getByTestId('new-created-done').click();
    await expect(page.getByTestId('new-created-panel'), 'NUR-02: Done closes the panel').toHaveCount(0);
    await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-02: ...and the filter stays').toHaveCount(0);
  });

  // ===========================================================================================
  // NUR-03 — Tags panel: people per tag, the rule sentence, Find, chosen-first order, readout chip phrases, +N.
  // ===========================================================================================
  test('NUR-03 the Tags panel counts people per tag, spells the rule out, finds, and lists chosen tags first', async ({ page }) => {
    const T = wsRenameTag;
    const E1 = T.extras[0].name;
    await resetNewUserTags();
    await seedRenameTag();
    try {
      const rows = await newUserRows();
      const has = (r: { tags: string[] }, id: string) => r.tags.includes(id);
      const segN = rows.filter(r => has(r, wsAddIds.NUT_SEGMENT)).length;
      const e1N = rows.filter(r => has(r, T.extras[0].id)).length;
      const either = rows.filter(r => has(r, wsAddIds.NUT_SEGMENT) || has(r, T.extras[0].id)).length;
      const both = rows.filter(r => has(r, wsAddIds.NUT_SEGMENT) && has(r, T.extras[0].id)).length;
      await loginAsWshopAdmin(page);
      await openScreen(page, T.user.name);

      // "+N" is a real button (the hook), still a .tag-pill with text "+N" (NUS-03), naming the hidden tags.
      const more = rowFor(page, T.user.name).getByTestId('new-tag-more');
      await expect(more, 'NUR-03: four tags show three pills and "+1"').toHaveText('+1');
      await expect(more).toHaveAttribute('aria-label', `1 more tag: ${T.extras[2].name}`);

      await page.getByTestId('new-button-1').click();
      const panel = page.getByTestId('new-event-2');
      await expect(panel, 'NUR-03: the pill opens the Tags panel').toBeVisible();
      const option = (name: string) => panel.getByTestId('new-toggle-tag-select-8').filter({ hasText: name });
      await expect(option(SEG).locator('.nx-opt-n'), 'NUR-03: people per tag (Firestore)').toHaveAttribute('aria-label', people(segN));
      await expect(option(E1).locator('.nx-opt-n')).toHaveAttribute('aria-label', people(e1N));
      await expect(page.getByTestId('new-tag-rule'), 'NUR-03: no rule before a tag is chosen').toHaveCount(0);

      await option(SEG).click();
      await expect(rowFor(page, wsAddNames.nuCharlie), 'NUR-03: the untagged user goes').toHaveCount(0, { timeout: 15_000 });
      await expect(page.getByTestId('new-tag-rule')).toHaveText(`Shows people tagged ${SEG}.`);
      await expect(page.getByTestId('new-tag-match-count')).toHaveText(matches(segN));
      await expect(page.getByTestId('new-chip-tags').locator('.nx-chip-k')).toHaveText('Tags');
      await expect(page.getByTestId('new-chip-tags').locator('b')).toHaveText(SEG);
      await expect(page.getByTestId('new-button-1')).toHaveAttribute('aria-label', 'Tags filter, 1 tag chosen');

      // Two tags, default Match all: names in list (alphabetical) order.
      const [a, b] = [E1, SEG].sort((x, y) => x.localeCompare(y));
      await option(E1).click();
      await expect(page.getByTestId('new-tag-rule')).toHaveText(`Shows only people who carry both ${a} and ${b}.`);
      await expect(page.getByTestId('new-tag-match-count'), 'NUR-03: carrying both (Firestore)').toHaveText(matches(both));
      await expect(page.getByTestId('new-chip-tags').locator('.nx-chip-k')).toHaveText('Tags, all of');

      await page.getByTestId('new-set-tag-mode-5').click();
      await expect(page.getByTestId('new-tag-rule')).toHaveText(`Shows people tagged ${a} or ${b}.`);
      await expect(page.getByTestId('new-tag-match-count'), 'NUR-03: carrying either').toHaveText(matches(either));
      await expect(page.getByTestId('new-chip-tags').locator('.nx-chip-k')).toHaveText('Tags, any of');
      await expect(rowFor(page, T.user.name), 'NUR-03: Match any keeps the second tag\'s carrier').toHaveCount(1, { timeout: 15_000 });

      await page.getByTestId('new-set-tag-polarity-7').click();
      await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-03: Exclude hides a carrier').toHaveCount(0, { timeout: 15_000 });
      await expect(rowFor(page, wsAddNames.nuCharlie), 'NUR-03: ...and shows the untagged user').toHaveCount(1);
      await expect(page.getByTestId('new-tag-rule')).toHaveText(`Hides everyone tagged ${a} or ${b}.`);
      await expect(page.getByTestId('new-tag-match-count')).toHaveText(matches(rows.length - either));
      await expect(page.getByTestId('new-chip-tags').locator('.nx-chip-k')).toHaveText('Tags, excluding');
      await page.getByTestId('new-set-tag-polarity-6').click();
      await page.getByTestId('new-set-tag-mode-4').click();
      await expect(page.getByTestId('new-tag-rule')).toHaveText(`Shows only people who carry both ${a} and ${b}.`);

      // Find narrows the list; nothing found says so.
      await page.getByTestId('new-tag-find').fill('zz none');
      await expect(panel.getByTestId('new-toggle-tag-select-8'), 'NUR-03: Find narrows').toHaveCount(0);
      await expect(page.getByTestId('new-tag-empty')).toHaveText('No tag matches “zz none”.');
      await page.getByTestId('new-tag-find').fill('');

      // Done, then reopen: the chosen tags come first, then a separator, then the rest.
      await page.getByTestId('new-tag-done').click();
      await expect(panel, 'NUR-03: Done closes the panel').toHaveCount(0);
      await page.getByTestId('new-button-1').click();
      const opts = panel.getByTestId('new-toggle-tag-select-8');
      await expect(opts.nth(0)).toContainText(a);
      await expect(opts.nth(0)).toHaveAttribute('aria-pressed', 'true');
      await expect(opts.nth(1)).toContainText(b);
      await expect(opts.nth(1)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('new-tag-separator'), 'NUR-03: a line between chosen and the rest').toHaveCount(1);
      await expect(opts.nth(2), 'NUR-03: after the line, an unchosen tag').toHaveAttribute('aria-pressed', 'false');

      await page.getByTestId('new-clear-tag-filter-3').click();
      await expect(page.getByTestId('new-chip-tags'), 'NUR-03: Clear drops the chip').toHaveCount(0);
      await expect(rowFor(page, wsAddNames.nuCharlie)).toHaveCount(1, { timeout: 15_000 });
    } finally {
      await clearRenameTag();
    }
  });

  // ===========================================================================================
  // NUR-04 — Conversion is a three-option menu: Everyone clears, picking the active option keeps it, and the Moved On
  // export column is offered only while Converted is on.
  // ===========================================================================================
  test('NUR-04 Conversion: Everyone clears it, re-picking keeps it, and Moved On joins the export only while Converted', async ({ page }) => {
    await seedConvertedNewUser();
    try {
      await loginAsWshopAdmin(page);
      await openScreen(page, wsAddNames.nuCharlie);
      const openMenu = () => page.getByTestId('new-toggle-converted-filter-18').click({ position: { x: 14, y: 22 } });
      const movedOn = page.locator('table.users-table th').filter({ hasText: 'Moved On' });

      await openMenu();
      await expect(page.getByTestId('new-conversion-panel'), 'NUR-04: the pill opens the menu').toBeVisible();
      await expect(page.getByTestId('new-set-converted-filter-everyone'), 'NUR-04: Everyone is the default').toHaveAttribute('aria-checked', 'true');
      await page.getByTestId('new-set-converted-filter-converted').click();
      await expect(page.getByTestId('new-conversion-panel'), 'NUR-04: a pick closes the menu').toHaveCount(0);
      await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-04: Converted hides the not-converted user').toHaveCount(0, { timeout: 15_000 });
      await expect(page.getByTestId('new-chip-conversion').locator('b')).toHaveText('Converted');

      await openMenu();
      await expect(page.getByTestId('new-set-converted-filter-converted')).toHaveAttribute('aria-checked', 'true');
      await page.getByTestId('new-set-converted-filter-converted').click();
      await expect(page.getByTestId('new-chip-conversion').locator('b'), 'NUR-04: re-picking the active option keeps it').toHaveText('Converted');
      await expect(rowFor(page, wsAddNames.nuAlpha)).toHaveCount(0);

      // Moved On is an export column only while Converted is on.
      await tick(page, wsAddNames.nuCharlie);
      await page.getByTestId('new-toggle-export-28').click();
      // Converted switches the Moved On column on in the export as well (as before the redesign); it can be dropped.
      await expect(page.getByTestId('new-export-col-movedon'), 'NUR-04: Moved On is offered, and on').toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('new-export-col-workshop'), 'NUR-04: Workshop is not (no workshop filter)').toHaveCount(0);
      await expect(page.getByTestId('new-export-summary')).toHaveText('Excel file · 9 columns · 1 row');
      await page.getByTestId('new-export-col-movedon').click();
      await expect(page.getByTestId('new-export-col-movedon')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByTestId('new-export-summary')).toHaveText('Excel file · 8 columns · 1 row');
      await page.getByTestId('new-clear-selection-26').click();

      await openMenu();
      await page.getByTestId('new-set-converted-filter-everyone').click();
      await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-04: Everyone brings the other side back').toHaveCount(1, { timeout: 15_000 });
      await expect(rowFor(page, wsAddNames.nuCharlie)).toHaveCount(1);
      await expect(page.getByTestId('new-chip-conversion'), 'NUR-04: no chip for Everyone').toHaveCount(0);
      await expect(movedOn, 'NUR-04: Moved On leaves with Converted').toHaveCount(0);
      await expect(page.getByTestId('new-toggle-converted-filter-18')).toHaveAttribute('aria-label', 'Conversion filter, off');
    } finally {
      await clearConvertedNewUser();
    }
  });

  // ===========================================================================================
  // NUR-05 — selection across pages: the header box selects everyone matching (every page); the cross-page banner;
  // Only this page; the dock's Select all N matching; the pager. 22 extra (older) users make a second page.
  // ===========================================================================================
  test('NUR-05 the header box selects every page; the banner and dock offer Only this page and Select all N matching', async ({ page }) => {
    await seedNewUserCrowd();
    try {
      const rows = await newUserRows();
      const total = rows.length;
      expect(total, 'NUR-05 precondition: more than one page of 20').toBeGreaterThan(20);
      const crowdN = rows.filter(r => r.name.toLowerCase().includes(wsCrowd.prefix.toLowerCase())
        || r.email.toLowerCase().includes(wsCrowd.prefix.toLowerCase())).length;
      const oldest = wsCrowd.names[wsCrowd.count - 1];
      await loginAsWshopAdmin(page);
      await openScreen(page, wsAddNames.nuAlpha);
      const dock = page.getByTestId('new-dock-count');
      const banner = page.getByTestId('new-xpage-banner');
      const boxOf = (name: string) => rowFor(page, name).getByTestId('new-change-selection-24').locator('input');

      await expect(page.getByTestId('new-total-count'), 'NUR-05: the header figure (Firestore)').toHaveText(n(total));
      await expect(page.getByTestId('new-page-range')).toHaveText(`1–20 of ${n(total)}`);
      await expect(page.locator(ROW), 'NUR-05: 20 rows per page').toHaveCount(20);
      await expect(page.getByTestId('new-page-prev')).toBeDisabled();
      await expect(page.getByTestId('new-page-first')).toBeDisabled();

      await page.getByTestId('new-change-master-toggle-23').locator('input').click();
      await expect(banner, 'NUR-05: everyone on every page is selected')
        .toContainText(`All ${people(total)} in the list are selected, including ${n(total - 20)} on other pages.`);
      await expect(dock).toContainText(`All ${n(total)} matching selected`);

      await page.getByTestId('new-page-next').click();
      await expect(page.getByTestId('new-page-range')).toHaveText(`21–${n(total)} of ${n(total)}`);
      await expect(boxOf(oldest), 'NUR-05: a page-2 row is selected too').toBeChecked();
      await page.getByTestId('new-page-first').click();
      await expect(page.getByTestId('new-page-range')).toHaveText(`1–20 of ${n(total)}`);

      await page.getByTestId('new-xpage-only-this-page').click();
      await expect(banner, 'NUR-05: Only this page ends the cross-page selection').toHaveCount(0);
      await expect(dock).toContainText(/\b20\s*selected/);
      await expect(page.getByTestId('new-dock-select-all-matching')).toHaveText(`Select all ${n(total)} matching`);
      await page.getByTestId('new-page-last').click();
      await expect(boxOf(oldest), 'NUR-05: [NEGATIVE CONTROL] the page-2 row is no longer selected').not.toBeChecked();
      await page.getByTestId('new-page-prev').click();
      await expect(boxOf(wsAddNames.nuAlpha), 'NUR-05: page-1 rows stay selected').toBeChecked();

      await page.getByTestId('new-dock-select-all-matching').click();
      await expect(dock, 'NUR-05: the dock selects every match').toContainText(`All ${n(total)} matching selected`);
      await expect(banner).toBeVisible();
      await page.getByTestId('new-dock-only-this-page').click();
      await expect(dock).toContainText(/\b20\s*selected/);
      await page.getByTestId('new-clear-selection-26').click();
      await expect(page.getByTestId('new-selection-bar')).toHaveCount(0);

      // With a search: "Select all N matching" means the people the search finds, and the banner says so.
      await page.getByTestId('new-search-input').fill(wsCrowd.prefix.trim());
      await expect(page.getByTestId('new-result-count')).toHaveText(`${n(crowdN)} of ${n(total)} users`, { timeout: 15_000 });
      await tick(page, wsCrowd.names[0]);
      await expect(page.getByTestId('new-dock-select-all-matching')).toHaveText(`Select all ${n(crowdN)} matching`);
      await page.getByTestId('new-dock-select-all-matching').click();
      await expect(banner).toContainText(`All ${people(crowdN)} matching these filters are selected, including ${n(crowdN - 20)} on other pages.`);
      await page.getByTestId('new-search-clear').click();
      await expect(dock, 'NUR-05: the selection holds the matches only').toContainText(new RegExp(`\\b${crowdN}\\s*selected`));
      await expect(boxOf(wsAddNames.nuAlpha), 'NUR-05: [NEGATIVE CONTROL] a non-match was not selected').not.toBeChecked();
      await page.getByTestId('new-clear-selection-26').click();

      // 50 per page: one page, so selecting everyone is not "across pages".
      await page.getByTestId('new-page-size').selectOption('50');
      await expect(page.getByTestId('new-page-range')).toHaveText(`1–${n(Math.min(total, 50))} of ${n(total)}`);
      await expect(page.locator(ROW)).toHaveCount(Math.min(total, 50));
      if (total <= 50) {
        await page.getByTestId('new-change-master-toggle-23').locator('input').click();
        await expect(dock).toContainText(new RegExp(`\\b${total}\\s*selected`));
        await expect(banner, 'NUR-05: no cross-page banner when everyone is on this page').toHaveCount(0);
        await expect(page.getByTestId('new-page-next')).toBeDisabled();
      }
    } finally {
      await clearNewUserCrowd();
    }
  });

  // ===========================================================================================
  // NUR-06 — people hidden by a search stay selected: the dock says how many, Export and Send count them in, and
  // the export columns drive the summary line and the Download button.
  // ===========================================================================================
  test('NUR-06 hidden selected people: the dock chip, Export and Send counts, and the export column chips', async ({ page }) => {
    await resetNewUserTags();
    await loginAsWshopAdmin(page);
    await openScreen(page, wsAddNames.nuAlpha);
    await tick(page, wsAddNames.nuAlpha);
    await tick(page, wsAddNames.nuBravo);
    await expect(page.getByTestId('new-dock-count')).toContainText(/\b2\s*selected/);
    await expect(page.getByTestId('new-dock-hidden'), 'NUR-06: nobody hidden yet').toHaveCount(0);

    await page.getByTestId('new-search-input').fill(wsAddNames.nuCharlie);
    await expect(page.getByTestId('new-dock-hidden'), 'NUR-06: the two ticked people are hidden by the search').toHaveText('2 not shown', { timeout: 15_000 });

    await page.getByTestId('new-toggle-export-28').click();
    const exportPanel = page.getByTestId('new-export-panel');
    await expect(exportPanel.locator('h3'), 'NUR-06: Export counts the hidden people in').toHaveText('Export 2 people');
    await expect(page.getByTestId('new-export-hidden-note')).toHaveText('Includes 2 hidden by filters');
    await expect(page.getByTestId('new-export-summary')).toHaveText('Excel file · 8 columns · 2 rows');
    await expect(page.getByTestId('new-export-col-workshop'), 'NUR-06: no Workshop column without its filter').toHaveCount(0);
    await expect(page.getByTestId('new-export-col-movedon'), 'NUR-06: no Moved On column without Converted').toHaveCount(0);

    // Each chip toggles one column. Turning all eight off disables Download and says why.
    const chips = [
      page.getByTestId('new-export-col-name'), page.getByTestId('new-export-col-countrycode'),
      page.getByTestId('new-export-col-phone'), page.getByTestId('new-export-col-email'),
      page.getByTestId('new-export-col-created'), page.getByTestId('new-export-col-status'),
      page.getByTestId('new-export-col-referredby'), page.getByTestId('new-export-col-tags'),
    ];
    for (let i = 0; i < chips.length; i++) {
      await expect(chips[i]).toHaveAttribute('aria-pressed', 'true');
      await chips[i].click();
      await expect(chips[i]).toHaveAttribute('aria-pressed', 'false');
      if (i < chips.length - 1) {
        const left = chips.length - 1 - i;
        await expect(page.getByTestId('new-export-summary')).toHaveText(`Excel file · ${left} column${left === 1 ? '' : 's'} · 2 rows`);
      }
    }
    await expect(page.getByTestId('new-export-reason'), 'NUR-06: no columns, no file').toHaveText('Choose at least one column');
    await expect(page.getByTestId('new-export-excel-30')).toBeDisabled();
    await page.getByTestId('new-select-all-export-columns-29').click();
    await expect(page.getByTestId('new-export-summary')).toHaveText('Excel file · 8 columns · 2 rows');
    await expect(page.getByTestId('new-export-excel-30')).toBeEnabled();
    const download = page.waitForEvent('download');
    await page.getByTestId('new-export-excel-30').click();
    expect((await download).suggestedFilename(), 'NUR-06: Download writes the Excel file').toMatch(/^new_users_\d{4}-\d{2}-\d{2}\.xlsx$/);

    await page.getByTestId('new-toggle-comm-31').click();
    await expect(page.getByTestId('new-comm-panel').locator('h3'), 'NUR-06: Send counts the hidden people in').toHaveText('Send to 2 people');
    await expect(page.getByTestId('new-comm-hidden-note')).toHaveText('2 are hidden by filters and still included');
    await expect(exportPanel, 'NUR-06: one panel at a time').toHaveCount(0);
  });

  // ===========================================================================================
  // NUR-07 — Select from file: the rule popover, then a result banner instead of snackbars. The file's emails select
  // exactly the matching people (any case), replacing the selection; the banner counts emails, matches, misses and
  // non-emails; a file that can't be used says why and leaves the selection alone.
  // ===========================================================================================
  test('NUR-07 Select from file: the banner counts the file, lists unmatched emails, and refuses unusable files', async ({ page }) => {
    const nobody = `nobody.${RUN}@example.com`;
    const good = xlsxColumnA(['email', `${wsAddIds.NU_A}@example.com`, `${wsAddIds.NU_C}@example.com`.toUpperCase(), nobody, 'not an email']);
    const badHeading = xlsxColumnA(['mail', `${wsAddIds.NU_A}@example.com`]);
    const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    await loginAsWshopAdmin(page);
    await openScreen(page, wsAddNames.nuAlpha);
    const box = (name: string) => rowFor(page, name).getByTestId('new-change-selection-24').locator('input');
    const banner = page.getByTestId('new-file-banner');

    await tick(page, wsAddNames.nuBravo);   // a selection the file must REPLACE

    await page.getByTestId('new-import-from-excel-21').click();
    await expect(page.getByTestId('new-import-popover'), 'NUR-07: the rule comes first').toContainText('“email”');
    let chooser = page.waitForEvent('filechooser');
    await page.getByTestId('new-import-choose-file').click();
    await (await chooser).setFiles({ name: 'people.xlsx', mimeType: XLSX_MIME, buffer: good });

    await expect(banner.locator('.nx-banner-title'), 'NUR-07: the result banner').toHaveText('Selected 2 people from people.xlsx', { timeout: 20_000 });
    await expect(banner).toContainText('3 emails in the file');
    await expect(banner).toContainText('2 matched');
    await expect(banner).toContainText('1 matched no one');
    await expect(banner).toContainText('1 value was not an email');
    await expect(page.getByTestId('new-import-popover'), 'NUR-07: the popover closed').toHaveCount(0);
    await expect(box(wsAddNames.nuAlpha), 'NUR-07: a matched email is selected').toBeChecked();
    await expect(box(wsAddNames.nuCharlie), 'NUR-07: matching ignores case').toBeChecked();
    await expect(box(wsAddNames.nuBravo), 'NUR-07: [NEGATIVE CONTROL] the earlier selection was replaced').not.toBeChecked();
    await expect(page.getByTestId('new-dock-count')).toContainText(/\b2\s*selected/);

    await expect(page.getByTestId('new-file-unmatched-list')).toHaveCount(0);
    await page.getByTestId('new-file-show-unmatched').click();
    await expect(page.getByTestId('new-file-unmatched-list'), 'NUR-07: the email that matched no one').toHaveText(nobody);
    await expect(page.getByTestId('new-file-show-unmatched')).toHaveText('Hide unmatched emails');

    // Live: of the people the file selected, how many the current search hides.
    await page.getByTestId('new-search-input').fill(wsAddNames.nuBravo);
    await expect(banner).toContainText('2 of those selected are hidden by the current filters', { timeout: 15_000 });
    await page.getByTestId('new-search-clear').click();
    await page.getByTestId('new-file-banner-dismiss').click();
    await expect(banner, 'NUR-07: dismissed').toHaveCount(0);
    await expect(page.getByTestId('new-dock-count'), 'NUR-07: dismissing keeps the selection').toContainText(/\b2\s*selected/);

    // Not an Excel file: refused, and the selection is untouched.
    await page.getByTestId('new-import-from-excel-21').click();
    chooser = page.waitForEvent('filechooser');
    await page.getByTestId('new-import-choose-file').click();
    await (await chooser).setFiles({ name: 'people.csv', mimeType: 'text/csv', buffer: Buffer.from(`email\n${wsAddIds.NU_B}@example.com\n`) });
    await expect(banner.locator('.nx-banner-title')).toHaveText('This file can\'t be used');
    await expect(banner).toContainText('Choose an Excel file (.xlsx or .xls).');
    await expect(box(wsAddNames.nuBravo), 'NUR-07: a refused file selects no one').not.toBeChecked();
    await expect(page.getByTestId('new-dock-count')).toContainText(/\b2\s*selected/);

    // Choose another file, from the banner: a sheet without the "email" heading.
    chooser = page.waitForEvent('filechooser');
    await page.getByTestId('new-file-choose-another').click();
    await (await chooser).setFiles({ name: 'heading.xlsx', mimeType: XLSX_MIME, buffer: badHeading });
    await expect(banner, 'NUR-07: the heading rule is spelled out').toContainText('The first column needs the heading “email”', { timeout: 20_000 });
    await expect(page.getByTestId('new-dock-count')).toContainText(/\b2\s*selected/);
  });

  // ===========================================================================================
  // NUR-08 — no match: one chip per condition with its own count; each × removes just that one; "Clear search only".
  // Tags = the segment (A, B) and Conversion = Converted (C only) leave no one, while each finds people alone.
  // ===========================================================================================
  test('NUR-08 no match lists each condition with its own count; each × removes only that one', async ({ page }) => {
    await resetNewUserTags();
    await seedConvertedNewUser();
    try {
      const rows = await newUserRows();
      const segN = rows.filter(r => r.tags.includes(wsAddIds.NUT_SEGMENT)).length;
      const movedN = rows.filter(r => r.moved).length;
      const alphaN = rows.filter(r => (r.name + ' ' + r.email).toLowerCase().includes(wsAddNames.nuAlpha.toLowerCase())).length;
      await loginAsWshopAdmin(page);
      await openScreen(page, wsAddNames.nuAlpha);
      const noMatch = page.getByTestId('new-no-match');
      const primary = page.getByTestId('new-no-match-clear-filters');
      const pickConverted = async () => {
        await page.getByTestId('new-toggle-converted-filter-18').click({ position: { x: 14, y: 22 } });
        await page.getByTestId('new-set-converted-filter-converted').click();
      };

      await page.getByTestId('new-button-1').click();
      await page.getByTestId('new-toggle-tag-select-8').filter({ hasText: SEG }).click();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('new-event-2'), 'NUR-08: Escape closes the panel').toHaveCount(0);
      await pickConverted();

      await expect(noMatch, 'NUR-08: together they leave no one').toBeVisible({ timeout: 15_000 });
      await expect(noMatch.locator('h3')).toHaveText('No users match these filters.');
      await expect(chipOf(page.getByTestId('new-why-tags-x')).locator('.nx-chip-n'), 'NUR-08: the tag alone (Firestore)').toHaveText(`· ${people(segN)}`);
      await expect(chipOf(page.getByTestId('new-why-conversion-x')).locator('.nx-chip-n'), 'NUR-08: Converted alone').toHaveText(`· ${people(movedN)}`);
      await expect(page.getByTestId('new-why-search-x'), 'NUR-08: no search, no search chip').toHaveCount(0);
      await expect(primary).toHaveText('Clear filters');
      await expect(page.getByTestId('new-no-match-clear-search'), 'NUR-08: nothing to clear in the search').toHaveCount(0);

      await page.getByTestId('new-search-input').fill(wsAddNames.nuAlpha);
      await expect(chipOf(page.getByTestId('new-why-search-x')).locator('.nx-chip-n'), 'NUR-08: the search alone').toHaveText(`· ${people(alphaN)}`, { timeout: 15_000 });
      await expect(chipOf(page.getByTestId('new-why-search-x')).locator('b')).toHaveText(`“${wsAddNames.nuAlpha}”`);
      await expect(primary).toHaveText('Clear search and filters');
      await page.getByTestId('new-no-match-clear-search').click();
      await expect(page.getByTestId('new-search-input'), 'NUR-08: Clear search only').toHaveValue('');
      await expect(noMatch, 'NUR-08: ...the filters stay').toBeVisible();
      await expect(page.getByTestId('new-why-search-x')).toHaveCount(0);

      await page.getByTestId('new-why-conversion-x').click();
      await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-08: removing Conversion brings the tagged users back').toHaveCount(1, { timeout: 15_000 });
      await expect(rowFor(page, wsAddNames.nuCharlie), 'NUR-08: ...while the tag filter still holds').toHaveCount(0);
      await expect(page.getByTestId('new-chip-tags')).toHaveCount(1);
      await expect(page.getByTestId('new-chip-conversion')).toHaveCount(0);

      await page.getByTestId('new-created-pill').click();
      await page.getByTestId('new-created-preset-today').click();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('new-why-created-x'), 'NUR-08: Today and the tag leave no one').toBeVisible({ timeout: 15_000 });
      await page.getByTestId('new-why-created-x').click();
      await expect(rowFor(page, wsAddNames.nuAlpha)).toHaveCount(1, { timeout: 15_000 });
      await expect(page.getByTestId('new-chip-created')).toHaveCount(0);

      await page.getByTestId('new-search-input').fill('zz no such user zz');
      await expect(page.getByTestId('new-why-search-x')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('new-why-search-x').click();
      await expect(page.getByTestId('new-search-input')).toHaveValue('');
      await expect(rowFor(page, wsAddNames.nuAlpha)).toHaveCount(1, { timeout: 15_000 });

      await pickConverted();
      await expect(page.getByTestId('new-why-tags-x')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('new-why-tags-x').click();
      await expect(rowFor(page, wsAddNames.nuCharlie), 'NUR-08: removing the tag shows the converted user').toHaveCount(1, { timeout: 15_000 });
      await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-08: ...and Converted still hides the other').toHaveCount(0);
    } finally {
      await clearConvertedNewUser();
    }
  });

  // ===========================================================================================
  // NUR-09 — Workshops panel: the empty funnel state, Show all, Find, the rule sentence, the people read in
  // progress, include and exclude, the readout chip ×, and the workshop no-match chip.
  // ===========================================================================================
  test('NUR-09 the Workshops panel shows the read in progress, spells the rule out, and its chip × removes it', async ({ page }) => {
    await seedEnrolledExportCase();   // NU Alpha (and a moved person) enrolled in the dashboard workshop
    try {
      const funnel = await countFunnelWorkshops();
      const enrolled = await newUserIdsEnrolledIn(wsIds.W_DASH);
      expect(enrolled, 'NUR-09 precondition: NU Alpha is enrolled').toContain(wsAddIds.NU_A);
      expect(enrolled, 'NUR-09 precondition: NU Charlie is not').not.toContain(wsAddIds.NU_C);
      await loginAsWshopAdmin(page);
      await openScreen(page, wsAddNames.nuAlpha);
      const panel = page.getByTestId('new-event-10');
      const option = page.getByTestId('new-toggle-workshop-select-15').filter({ hasText: DASH_TITLE });

      await page.getByTestId('new-button-9').click();
      await expect(panel).toBeVisible();
      if (funnel === 0) {
        await expect(page.getByTestId('new-workshop-no-funnel'), 'NUR-09: no funnel workshops, says so').toContainText('No funnel workshops yet');
        await page.getByTestId('new-workshop-show-all').click();
      } else {
        await page.getByTestId('new-change-set-funnel-only-12').locator('button').click();
      }
      await expect(page.getByTestId('new-change-set-funnel-only-12').locator('button'), 'NUR-09: Funnel only is off')
        .toHaveAttribute('aria-checked', 'false');
      await expect(option, 'NUR-09: the full list offers the workshop').toHaveCount(1, { timeout: 20_000 });
      await expect(page.getByTestId('new-workshop-options-loading'), 'NUR-09: the list read is done').toHaveCount(0);

      await page.getByTestId('new-workshop-find').fill('zz none');
      await expect(page.getByTestId('new-workshop-empty')).toHaveText('No workshop matches “zz none”.');
      await page.getByTestId('new-workshop-find').fill(DASH_TITLE);
      await expect(option).toHaveCount(1);

      // Hold the enrolment read so the in-progress state can be seen, then let it land.
      const release = await holdReads(page, 4_000);
      try {
        await option.click();
        await expect(page.getByTestId('new-count-pending'), 'NUR-09: the readout says it is reading')
          .toContainText('Reading the people in 1 workshop');
        await expect(page.getByTestId('new-workshop-filter-loading')).toContainText(`Loading the people enrolled in ${DASH_TITLE}`);
        await expect(page.getByTestId('new-workshop-filter-progress')).toBeVisible();
        await expect(page.getByTestId('new-button-9')).toHaveAttribute('aria-busy', 'true');
      } finally {
        await release();
      }
      await expect(rowFor(page, wsAddNames.nuCharlie), 'NUR-09: someone not enrolled is filtered out').toHaveCount(0, { timeout: 30_000 });
      await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-09: the enrolled user stays').toHaveCount(1);
      await expect(page.getByTestId('new-workshop-filter-loading')).toHaveCount(0);
      await expect(page.getByTestId('new-workshop-rule')).toHaveText(`Shows people enrolled in ${DASH_TITLE}, with a Workshop column.`);
      await expect(page.getByTestId('new-workshop-match-count'), 'NUR-09: enrolled new users (Firestore)').toHaveText(matches(enrolled.length));
      await expect(page.getByTestId('new-chip-workshops').locator('.nx-chip-k')).toHaveText('Workshops, including');
      await expect(page.getByTestId('new-chip-workshops').locator('b')).toHaveText(DASH_TITLE);
      await page.getByTestId('new-workshop-done').click();
      await expect(panel, 'NUR-09: Done closes').toHaveCount(0);
      await expect(page.locator('table.users-table th').filter({ hasText: 'Workshop' }), 'NUR-09: the Workshop column').toHaveCount(1);

      await page.getByTestId('new-button-9').click();
      await page.getByTestId('new-set-workshop-filter-mode-14').click();
      await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-09: Exclude hides the enrolled user').toHaveCount(0, { timeout: 15_000 });
      await expect(rowFor(page, wsAddNames.nuCharlie)).toHaveCount(1);
      await expect(page.getByTestId('new-workshop-rule')).toHaveText(`Hides people enrolled in ${DASH_TITLE}. No Workshop column.`);
      await expect(page.getByTestId('new-chip-workshops').locator('.nx-chip-k')).toHaveText('Workshops, excluding');
      await page.keyboard.press('Escape');
      await expect(page.locator('table.users-table th').filter({ hasText: 'Workshop' }), 'NUR-09: no Workshop column when excluding').toHaveCount(0);

      await page.getByTestId('new-chip-workshops-x').click();
      await expect(page.getByTestId('new-chip-workshops'), 'NUR-09: the chip × removes the filter').toHaveCount(0);
      await expect(rowFor(page, wsAddNames.nuAlpha)).toHaveCount(1, { timeout: 15_000 });

      // The workshop condition as a no-match chip, with its own count.
      await page.getByTestId('new-button-9').click();
      await page.getByTestId('new-set-workshop-filter-mode-13').click();
      await option.click();
      await page.keyboard.press('Escape');
      await expect(rowFor(page, wsAddNames.nuCharlie)).toHaveCount(0, { timeout: 30_000 });
      await page.getByTestId('new-search-input').fill(wsAddNames.nuCharlie);
      await expect(chipOf(page.getByTestId('new-why-workshops-x')).locator('.nx-chip-n'), 'NUR-09: the workshop alone')
        .toHaveText(`· ${people(enrolled.length)}`, { timeout: 15_000 });
      await page.getByTestId('new-why-workshops-x').click();
      await expect(rowFor(page, wsAddNames.nuCharlie), 'NUR-09: without the workshop the search finds Charlie').toHaveCount(1, { timeout: 15_000 });
    } finally {
      await clearEnrolledExportCase();
    }
  });

  // ===========================================================================================
  // NUR-10 — narrow layout (820px): rows become cards with a card bar (select all, sort), and the pills fold into a
  // Filters button that opens a sheet. Back at desktop width the narrow-only controls leave the DOM.
  // ===========================================================================================
  test('NUR-10 at 820px: card bar select all and sort, and the Filters sheet with its sub-views', async ({ page }) => {
    await resetNewUserTags();
    const rows = await newUserRows();
    const total = rows.length;
    const d2 = wsSeedDate(-2);
    const segOnD2 = rows.filter(r => r.tags.includes(wsAddIds.NUT_SEGMENT) && sameDay(r.created, d2)).length;
    const funnel = await countFunnelWorkshops();
    await loginAsWshopAdmin(page);
    await page.setViewportSize({ width: 820, height: 1000 });
    await openScreen(page, wsAddNames.nuAlpha);
    const order = async () => {
      const t = await page.locator(ROW).allTextContents();
      return [wsAddNames.nuAlpha, wsAddNames.nuBravo, wsAddNames.nuCharlie].map(name => t.findIndex(s => s.includes(name)));
    };

    await expect(page.getByTestId('new-filters-btn'), 'NUR-10: the Filters button replaces the pills').toBeVisible();
    await expect(page.getByTestId('new-card-bar'), 'NUR-10: the card bar replaces the header row').toBeVisible();

    // Card sort drives the same sort as the headers.
    await page.getByTestId('new-card-sort').selectOption('name-asc');
    await expect.poll(async () => { const [a, b] = await order(); return a < b; }, { message: 'NUR-10: Name A–Z' }).toBe(true);
    let [ia, ib, ic] = await order();
    expect(ia < ib && ib < ic, `NUR-10: Name A–Z puts Alpha, Bravo, Charlie in order (${ia}, ${ib}, ${ic})`).toBe(true);
    await page.getByTestId('new-card-sort').selectOption('oldest');
    await expect.poll(async () => { const [a, , c] = await order(); return c < a; }, { message: 'NUR-10: Oldest first' }).toBe(true);
    [ia, ib, ic] = await order();
    expect(ic < ib && ib < ia, `NUR-10: Oldest first puts Charlie, Bravo, Alpha in order (${ic}, ${ib}, ${ia})`).toBe(true);
    await page.getByTestId('new-card-sort').selectOption('newest');

    // The card bar box selects everyone matching.
    await page.getByTestId('new-cardbar-select-all').locator('input').click();
    await expect(page.getByTestId('new-dock-count'), 'NUR-10: everyone is selected (Firestore count)').toContainText(n(total));
    await page.getByTestId('new-clear-selection-26').click();

    // The Filters sheet: choose a tag in its sub-view, set Created, pick a conversion, then Show N people.
    await page.getByTestId('new-filters-btn').click();
    const sheet = page.getByTestId('new-filters-sheet');
    await expect(sheet).toBeVisible();
    await page.getByTestId('new-sheet-tags-choose').click();
    await expect(page.getByTestId('new-sheet-find')).toBeVisible();
    await page.getByTestId('new-sheet-tag-option').filter({ hasText: SEG }).click();
    await expect(page.getByTestId('new-sheet-tag-option').filter({ hasText: SEG })).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('new-sheet-back').click();
    await expect(page.getByTestId('new-sheet-tag-chip').filter({ hasText: SEG }), 'NUR-10: the chosen tag shows as a chip').toBeVisible();
    await expect(page.getByTestId('new-sheet-tag-rule')).toHaveText(`Shows people tagged ${SEG}.`);
    await page.getByTestId('new-sheet-tag-exclude').click();
    await expect(page.getByTestId('new-sheet-tag-rule')).toHaveText(`Hides everyone tagged ${SEG}.`);
    await page.getByTestId('new-sheet-tag-include').click();
    await page.getByTestId('new-sheet-tag-mode-any').click();
    await expect(page.getByTestId('new-sheet-tag-mode-any')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('new-sheet-tag-mode-all').click();
    await expect(page.getByTestId('new-sheet-tag-mode-all')).toHaveAttribute('aria-checked', 'true');

    const from = page.getByTestId('new-sheet-created-start');
    const to = page.getByTestId('new-sheet-created-end');
    await from.fill(wsDayDMY(d2));
    await from.press('Enter');
    await to.fill(wsDayDMY(d2));
    await to.press('Enter');
    await page.getByTestId('new-sheet-conv-not-converted').click();
    await expect(page.getByTestId('new-sheet-conv-not-converted')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('new-sheet-conv-everyone').click();
    await expect(page.getByTestId('new-sheet-conv-everyone')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('new-sheet-conv-converted').click();
    await expect(page.getByTestId('new-sheet-conv-converted')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('new-sheet-conv-everyone').click();

    await expect(page.getByTestId('new-filters-sheet-apply'), 'NUR-10: the sheet counts the result (Firestore)').toHaveText(`Show ${people(segOnD2)}`);
    await page.getByTestId('new-filters-sheet-apply').click();
    await expect(sheet, 'NUR-10: Show N people closes the sheet').toHaveCount(0);
    await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-10: -1d is outside the window').toHaveCount(0, { timeout: 15_000 });
    await expect(rowFor(page, wsAddNames.nuCharlie), 'NUR-10: untagged and outside').toHaveCount(0);
    await expect(rowFor(page, wsAddNames.nuBravo)).toHaveCount(1);
    await expect(page.getByTestId('new-filters-btn')).toHaveAttribute('aria-label', 'Filters, 2 on');

    await page.getByTestId('new-filters-btn').click();
    await page.getByTestId('new-filters-sheet-clear').click();
    await expect(page.getByTestId('new-sheet-tag-rule'), 'NUR-10: Clear all empties the sheet').toHaveCount(0);
    await expect(page.getByTestId('new-filters-sheet-apply')).toHaveText(`Show ${people(total)}`);

    // Workshops sub-view: the empty funnel offers Show all; then the options and Include/Exclude.
    await page.getByTestId('new-sheet-workshops-choose').click();
    if (funnel === 0) {
      await expect(page.getByTestId('new-sheet-workshop-show-all'), 'NUR-10: no funnel workshops').toBeVisible({ timeout: 20_000 });
      await page.getByTestId('new-sheet-workshop-show-all').click();
    }
    await expect(page.getByTestId('new-sheet-workshop-option').filter({ hasText: DASH_TITLE }), 'NUR-10: the workshop is offered')
      .toHaveCount(funnel === 0 ? 1 : 0, { timeout: 20_000 });
    await page.getByTestId('new-sheet-find').fill('zz none');
    await expect(page.getByTestId('new-sheet-workshop-option'), 'NUR-10: Find narrows the workshops').toHaveCount(0);
    await expect(page.getByTestId('new-sheet-workshop-include')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('new-sheet-workshop-exclude').click();
    await expect(page.getByTestId('new-sheet-workshop-exclude')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('new-sheet-workshop-include').click();
    await page.getByTestId('new-sheet-back').click();
    const funnelSwitch = page.getByTestId('new-sheet-funnel-only').locator('button');
    await expect(funnelSwitch).toHaveAttribute('aria-checked', funnel === 0 ? 'false' : 'true');
    await funnelSwitch.click();
    await expect(funnelSwitch).toHaveAttribute('aria-checked', funnel === 0 ? 'true' : 'false');
    await page.getByTestId('new-filters-sheet-close').click();
    await expect(sheet).toHaveCount(0);
    await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-10: cleared filters bring everyone back').toHaveCount(1, { timeout: 15_000 });

    // Back to desktop width: the narrow-only controls leave the DOM (no hook twice), the pills are back.
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByTestId('new-filters-btn'), 'NUR-10: desktop has no Filters button').toHaveCount(0);
    await expect(page.getByTestId('new-card-bar'), 'NUR-10: ...and no card bar').toHaveCount(0);
    await expect(page.getByTestId('new-button-1')).toBeVisible();
  });

  // ===========================================================================================
  // NUR-11 — phones (390px): Export and Send open as bottom sheets, never as the dock panels.
  // ===========================================================================================
  test('NUR-11 at 390px Export and Send open as bottom sheets with close and cancel', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openScreen(page, wsAddNames.nuAlpha);
    await tick(page, wsAddNames.nuAlpha);

    await page.getByTestId('new-toggle-export-28').click();
    await expect(page.getByTestId('new-export-sheet'), 'NUR-11: Export is a sheet on a phone').toBeVisible();
    await expect(page.getByTestId('new-export-sheet').locator('h3')).toHaveText('Export 1 person');
    await expect(page.getByTestId('new-export-panel'), 'NUR-11: [NEGATIVE CONTROL] not the dock panel too').toHaveCount(0);
    await page.getByTestId('new-export-sheet-close').click();
    await expect(page.getByTestId('new-export-sheet')).toHaveCount(0);

    await page.getByTestId('new-toggle-comm-31').click();
    await expect(page.getByTestId('new-send-sheet'), 'NUR-11: Send is a sheet on a phone').toBeVisible();
    await expect(page.getByTestId('new-send-sheet').locator('h3')).toHaveText('Send to 1 person');
    await expect(page.getByTestId('new-comm-panel')).toHaveCount(0);
    await page.getByTestId('new-send-sheet-cancel').click();
    await expect(page.getByTestId('new-send-sheet')).toHaveCount(0);
    await page.getByTestId('new-toggle-comm-31').click();
    await expect(page.getByTestId('new-send-sheet')).toBeVisible();
    await page.getByTestId('new-send-sheet-close').click();
    await expect(page.getByTestId('new-send-sheet')).toHaveCount(0);
  });

  // ===========================================================================================
  // NUR-12 — search suggestions: typing offers matching tags (with counts) and loaded workshops; picking one turns it
  // into a filter and clears the search. Plain text is never turned into a filter by itself.
  // ===========================================================================================
  test('NUR-12 search suggests tags and workshops; a pick becomes a filter and clears the search', async ({ page }) => {
    await resetNewUserTags();
    const rows = await newUserRows();
    const segN = rows.filter(r => r.tags.includes(wsAddIds.NUT_SEGMENT)).length;
    const funnel = await countFunnelWorkshops();
    const enrolled = await newUserIdsEnrolledIn(wsIds.W_DASH);
    await loginAsWshopAdmin(page);
    await openScreen(page, wsAddNames.nuAlpha);
    const search = page.getByTestId('new-search-input');

    await search.fill('WS Seg');
    await expect(page.getByTestId('new-search-suggest'), 'NUR-12: suggestions open').toBeVisible({ timeout: 15_000 });
    const tagSug = page.getByTestId('new-suggest-tag').filter({ hasText: SEG });
    await expect(tagSug.locator('.nx-sug-n'), 'NUR-12: the tag suggestion counts its people (Firestore)').toHaveText(people(segN));
    await expect(page.getByTestId('new-suggest-footer')).toContainText('“WS Seg”');
    await expect(page.getByTestId('new-chip-tags'), 'NUR-12: typing alone makes no filter').toHaveCount(0);
    await search.press('ArrowDown');
    await search.press('Enter');
    await expect(search, 'NUR-12: the pick clears the search').toHaveValue('');
    await expect(page.getByTestId('new-chip-tags').locator('b'), 'NUR-12: ...and becomes the tag filter').toHaveText(SEG);
    await expect(rowFor(page, wsAddNames.nuCharlie), 'NUR-12: the untagged user goes').toHaveCount(0, { timeout: 15_000 });
    await page.getByTestId('new-chip-tags-x').click();
    await expect(rowFor(page, wsAddNames.nuCharlie)).toHaveCount(1, { timeout: 15_000 });

    // Workshop suggestions come from the loaded workshop list (all workshops once Funnel only is off).
    await page.getByTestId('new-button-9').click();
    if (funnel === 0) await page.getByTestId('new-workshop-show-all').click();
    else await page.getByTestId('new-change-set-funnel-only-12').locator('button').click();
    await expect(page.getByTestId('new-toggle-workshop-select-15').filter({ hasText: DASH_TITLE })).toHaveCount(1, { timeout: 20_000 });
    await page.keyboard.press('Escape');
    await search.fill('Dashboard Workshop');
    const wsSug = page.getByTestId('new-suggest-workshop').filter({ hasText: DASH_TITLE });
    await expect(wsSug, 'NUR-12: the workshop is suggested').toBeVisible({ timeout: 15_000 });
    await wsSug.click();
    await expect(search).toHaveValue('');
    await expect(page.getByTestId('new-chip-workshops').locator('b')).toHaveText(DASH_TITLE);
    if (!enrolled.includes(wsAddIds.NU_A)) {
      await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-12: NU Alpha is not enrolled there (Firestore)').toHaveCount(0, { timeout: 30_000 });
    }
  });

  // ===========================================================================================
  // NUR-13 — the header figure, the readout hint, the Columns count and note, and the Subscriber chip.
  // ===========================================================================================
  test('NUR-13 header figure, readout hint, Columns "N of 7", and the Subscriber chip under Referred by', async ({ page }) => {
    await seedSubscriberNewUser();
    try {
      const total = (await newUserRows()).length;
      await loginAsWshopAdmin(page);
      await openScreen(page, wsSubscriber.name);
      await expect(page.getByTestId('new-users-table')).toBeVisible();
      await expect(page.getByTestId('new-total-count'), 'NUR-13: the header figure (Firestore)').toHaveText(n(total));
      await expect(page.getByTestId('new-readout')).toContainText(`of ${n(total)} users`);
      await expect(page.getByTestId('new-readout-hint')).toHaveText('Tick people to tag, export or message them.');
      await tick(page, wsAddNames.nuAlpha);
      await expect(page.getByTestId('new-readout-hint'), 'NUR-13: the hint goes once someone is ticked').toHaveCount(0);
      await page.getByTestId('new-clear-selection-26').click();
      await expect(page.getByTestId('new-readout-hint')).toBeVisible();

      await expect(page.getByTestId('new-columns-count')).toHaveText('5 of 7');
      await page.getByTestId('new-columns-btn').click();
      await expect(page.getByTestId('new-columns-note')).toContainText('Saved in this browser');
      await page.getByTestId('new-column-referredby').click();
      await expect(page.getByTestId('new-columns-count')).toHaveText('6 of 7');
      await page.keyboard.press('Escape');

      const sub = rowFor(page, wsSubscriber.name);
      await expect(sub.getByTestId('new-subscriber-badge'), 'NUR-13: a subscriber shows the chip').toHaveText('Subscriber');
      await expect(sub.getByTestId('new-referred-by'), 'NUR-13: ...not a referrer').toHaveCount(0);
      await expect(rowFor(page, wsAddNames.nuAlpha).getByTestId('new-subscriber-badge'), 'NUR-13: [NEGATIVE CONTROL] others do not').toHaveCount(0);
    } finally {
      await clearSubscriberNewUser();
    }
  });

  // ===========================================================================================
  // NUR-14 — Manage tags: people per tag, the total, Similar tags, the rename status line, and Segment links.
  // ===========================================================================================
  test('NUR-14 Manage tags counts people per tag, suggests similar tags, and copies segment links', async ({ page }) => {
    const T = wsRenameTag;
    await resetNewUserTags();
    await seedRenameTag();
    try {
      const tags = await newUserSegmentTags();
      const rows = await newUserRows();
      const segN = rows.filter(r => r.tags.includes(wsAddIds.NUT_SEGMENT)).length;
      const tN = rows.filter(r => r.tags.includes(T.id)).length;
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await loginAsWshopAdmin(page);
      await openScreen(page, T.user.name);

      await page.getByTestId('new-open-tags-manager-20').click();
      await expect(page.getByTestId('atd-dialog-title')).toHaveText('Manage tags', { timeout: 20_000 });
      await expect(page.getByTestId('atd-dialog-sub')).toHaveText('Create and rename tags, copy segment links');
      await expect(page.getByTestId('atd-loading'), 'NUR-14: the tags have loaded').toHaveCount(0, { timeout: 20_000 });
      await expect(page.getByTestId('atd-tags-total'), 'NUR-14: every tag (Firestore)').toHaveText(`All tags · ${tags.length}`);
      await expect(page.getByTestId('atd-ledger')).toBeVisible();
      const ledgerRow = (name: string) => page.getByTestId('atd-toggle-4').filter({ hasText: name });
      await expect(ledgerRow(SEG).getByTestId('atd-tag-count'), 'NUR-14: people per tag (Firestore)').toHaveText(people(segN));
      await expect(ledgerRow(T.name).getByTestId('atd-tag-count')).toHaveText(people(tN));

      // A new name that shares a word with an existing tag: Create is offered, and so is the existing one.
      const search = page.getByTestId('atd-search-input');
      await search.fill('Segment Zed');
      await expect(page.getByTestId('atd-create-tag-3')).toContainText('Create “Segment Zed”');
      const similar = page.getByTestId('atd-similar-tag').filter({ hasText: SEG });
      await expect(similar, 'NUR-14: the near-duplicate is suggested').toBeVisible();
      await similar.click();
      await expect(search, 'NUR-14: picking it finds that tag instead').toHaveValue(SEG);
      await expect(page.getByTestId('atd-tags-total')).toHaveText('Matching · 1');
      await expect(page.getByTestId('atd-create-tag-3'), 'NUR-14: no Create for an existing name').toHaveCount(0);
      await page.getByTestId('atd-search-2').click();
      await expect(search).toHaveValue('');

      // The footer names the tag being renamed; Escape cancels without a write.
      await ledgerRow(T.name).click();
      await expect(page.getByTestId('atd-footer-status')).toHaveText(`Renaming “${T.name}”`);
      await page.getByTestId('atd-rename-input').press('Escape');
      await expect(page.getByTestId('atd-rename-input')).toHaveCount(0);
      await expect(page.getByTestId('atd-footer-status')).not.toContainText('Renaming');

      // Segment links.
      await page.getByTestId('atd-tab-links').click();
      await expect(page.getByTestId('atd-tab-links')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('atd-link-example')).toContainText('?segment=');
      await expect(page.getByTestId('atd-seg-table')).toBeVisible();
      await expect(page.getByTestId('atd-seg-selected-count')).toHaveText('0 selected');
      await expect(page.getByTestId('atd-copy-selected-segments-5')).toBeDisabled();
      const segRow = page.getByTestId('atd-seg-table').locator('tbody tr').filter({ hasText: SEG });
      await segRow.getByTestId('atd-change-copy-selection-7').check();
      await expect(page.getByTestId('atd-seg-selected-count')).toHaveText('1 selected');
      await page.getByTestId('atd-copy-selected-segments-5').click();
      await expect(page.getByTestId('atd-footer-status'), 'NUR-14: copied').toHaveText('Copied a link for 1 tag');
      expect(await page.evaluate(() => navigator.clipboard.readText()), 'NUR-14: the link carries the tag id (Firestore)')
        .toBe(`?segment=${wsAddIds.NUT_SEGMENT}`);
      const tRow = page.getByTestId('atd-seg-table').locator('tbody tr').filter({ hasText: T.name });
      await tRow.getByTestId('atd-copy-segment-8').click();
      await expect(page.getByTestId('atd-footer-status')).toHaveText(`Copied the link for ${T.name}`);
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`?segment=${T.id}`);
      await page.getByTestId('atd-change-master-toggle-tags-6').check();
      await expect(page.getByTestId('atd-seg-selected-count'), 'NUR-14: select all = every tag').toHaveText(`${tags.length} selected`);

      await page.getByTestId('atd-tab-tags').click();
      await expect(page.getByTestId('atd-ledger')).toBeVisible();
      await page.getByTestId('atd-cancel-11').click();
      await expect(page.getByTestId('atd-dialog-title'), 'NUR-14: Close closes').toHaveCount(0);
      const after = await newUserSegmentTags();
      expect(after.map(t => t.name).sort(), 'NUR-14: nothing was created or renamed').toEqual(tags.map(t => t.name).sort());
    } finally {
      await clearRenameTag();
    }
  });

  // ===========================================================================================
  // NUR-15 — Edit tags for several people: a tag some of them carry starts "partial"; taps cycle partial → all →
  // none → partial; the footer says exactly what Apply will do; Apply shows "Updating tags" in the dock.
  // ===========================================================================================
  test('NUR-15 Edit tags: partial state, chip counts, the footer summary, and Updating tags in the dock', async ({ page }) => {
    await resetNewUserTags();
    try {
      await loginAsWshopAdmin(page);
      await openScreen(page, wsAddNames.nuAlpha);
      await tick(page, wsAddNames.nuAlpha);     // carries the segment
      await tick(page, wsAddNames.nuCharlie);   // does not
      await page.getByTestId('new-open-bulk-tags-27').click();

      await expect(page.getByTestId('atd-dialog-title')).toHaveText('Edit tags', { timeout: 20_000 });
      await expect(page.getByTestId('atd-dialog-sub')).toHaveText('2 selected people');
      await expect(page.getByTestId('atd-key'), 'NUR-15: the key explains the states').toBeVisible();
      await expect(page.getByTestId('atd-cloud-all')).toBeVisible();
      const chip = page.getByTestId('atd-cloud-all').getByTestId('atd-toggle-4').filter({ hasText: SEG });
      const count = chip.getByTestId('atd-chip-count');
      const summary = page.getByTestId('atd-summary');
      const apply = page.getByTestId('atd-save-10');

      await expect(chip, 'NUR-15: one of two carries it').toHaveAttribute('aria-pressed', 'mixed');
      await expect(count).toHaveText('on 1 of 2');
      await expect(summary).toHaveText('No changes yet');
      await expect(apply).toBeDisabled();
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
      await expect(count).toHaveText('adds to 1');
      await expect(summary).toHaveText(`Adds ${SEG} to 1 person`);
      await expect(apply).toBeEnabled();
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'false');
      await expect(count).toHaveText('removes from 1');
      await expect(summary).toHaveText(`Removes ${SEG} from 1 person`);
      await chip.click();
      await expect(chip, 'NUR-15: a third tap is back to untouched').toHaveAttribute('aria-pressed', 'mixed');
      await expect(summary).toHaveText('No changes yet');
      await expect(apply).toBeDisabled();
      await chip.click();

      // Hold the write so the dock's in-progress state can be seen.
      const WRITE = '**/google.firestore.v1.Firestore/Write/**';
      await page.route(WRITE, async route => {
        await new Promise(r => setTimeout(r, 3_000));
        await route.continue().catch(() => undefined);
      });
      try {
        await apply.click();
        await expect(page.getByTestId('new-dock-updating'), 'NUR-15: the dock says it is writing')
          .toContainText('Updating tags for 2 people');
        await expect(page.getByTestId('new-toggle-export-28'), 'NUR-15: dock actions wait').toBeDisabled();
      } finally {
        await page.unroute(WRITE);
      }
      const c = await pollUntil(() => getDoc('new_user_data', wsAddIds.NU_C),
        (d: any) => Array.isArray(d?.tags) && d.tags.includes(wsAddIds.NUT_SEGMENT),
        { label: 'NUR-15: the segment is written onto NU Charlie', timeoutMs: 30_000 });
      expect((c as any).tags).toEqual([wsAddIds.NUT_SEGMENT]);
      expect(((await getDoc('new_user_data', wsAddIds.NU_A)) as any).tags, 'NUR-15: no duplicate on the carrier').toEqual([wsAddIds.NUT_SEGMENT]);
      expect(((await getDoc('new_user_data', wsAddIds.NU_B)) as any).tags, 'NUR-15: [NEGATIVE CONTROL] the unselected user is untouched')
        .toEqual([wsAddIds.NUT_SEGMENT]);
      await expect(page.getByTestId('new-selection-bar'), 'NUR-15: the selection clears after the write').toHaveCount(0, { timeout: 15_000 });
    } finally {
      await resetNewUserTags();
    }
  });

  // ===========================================================================================
  // NUR-16 — Assign tags for one person: their tags apart from the rest, a summary in their name, Cancel writes nothing.
  // ===========================================================================================
  test('NUR-16 Assign tags: the person\'s tags first, the summary names them, and Cancel writes nothing', async ({ page }) => {
    await resetNewUserTags();
    await loginAsWshopAdmin(page);
    await openScreen(page, wsAddNames.nuAlpha);
    await rowFor(page, wsAddNames.nuAlpha).getByTestId('new-open-tags-25').click();

    await expect(page.getByTestId('atd-dialog-title')).toHaveText('Assign tags', { timeout: 20_000 });
    await expect(page.getByTestId('atd-dialog-sub')).toHaveText(`${wsAddNames.nuAlpha} · ${wsAddIds.NU_A}@example.com`);
    const on = page.getByTestId('atd-cloud-on');
    const more = page.getByTestId('atd-cloud-more');
    await expect(on.getByTestId('atd-toggle-4').filter({ hasText: SEG }), 'NUR-16: their tag is apart').toHaveCount(1);
    await expect(more.getByTestId('atd-toggle-4').filter({ hasText: SEG })).toHaveCount(0);
    await expect(page.getByTestId('atd-summary')).toHaveText('No changes yet');

    await on.getByTestId('atd-toggle-4').filter({ hasText: SEG }).click();
    await expect(more.getByTestId('atd-toggle-4').filter({ hasText: SEG }), 'NUR-16: tapping moves it to the rest').toHaveCount(1);
    await expect(on, 'NUR-16: no tags left on them').toHaveCount(0);
    await expect(page.getByTestId('atd-summary')).toHaveText(`Removes ${SEG} from NU`);
    await page.getByTestId('atd-cancel-9').click();
    await expect(page.getByTestId('atd-dialog-title')).toHaveCount(0);
    expect(((await getDoc('new_user_data', wsAddIds.NU_A)) as any).tags, 'NUR-16: Cancel wrote nothing').toEqual([wsAddIds.NUT_SEGMENT]);
  });

  // ===========================================================================================
  // NUR-17 — while access is checked and the list is read, the page shows a status and a skeleton made of divs
  // (never a <table>: WDA-06), and the count waits. Reads are held on their way to the emulator to make this visible.
  // ===========================================================================================
  test('NUR-17 checking access, then a div skeleton and a waiting count, before the rows', async ({ page }) => {
    await loginAsWshopAdmin(page);
    const release = await holdReads(page, 2_500);
    try {
      await page.goto('/newusersprofile', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('new-checking-access'), 'NUR-17: the access check shows').toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('new-loading-skeleton'), 'NUR-17: then the skeleton').toBeVisible({ timeout: 30_000 });
      await expect(page.locator('table'), 'NUR-17: the skeleton is not a table').toHaveCount(0);
      await expect(page.getByTestId('new-count-pending')).toContainText('Reading new users');
      await expect(page.getByTestId('new-total-count')).toHaveAttribute('aria-busy', 'true');
    } finally {
      await release();
    }
    await expect(rowFor(page, wsAddNames.nuAlpha), 'NUR-17: the rows arrive').toHaveCount(1, { timeout: 30_000 });
    await expect(page.getByTestId('new-loading-skeleton')).toHaveCount(0);
    await expect(page.getByTestId('new-checking-access')).toHaveCount(0);
  });

  // ===========================================================================================
  // NUR-18 — states the shared emulator cannot put on screen: the list read failing (the emulator's rules are
  // open, so the stream never errors), no users at all (the suite seeds users), and the workshop list read failing.
  // Their hooks are registered here; on a healthy screen with rows, each must be ABSENT, which is asserted.
  // ===========================================================================================
  test('NUR-18 error and empty states stay away on a healthy screen (reference for states the emulator cannot drive)', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openScreen(page, wsAddNames.nuAlpha);
    await expect(page.getByTestId('new-load-error')).toHaveCount(0);                 // reference-only: stream error
    await expect(page.getByTestId('new-load-retry')).toHaveCount(0);                 // reference-only: stream error
    await expect(page.getByTestId('new-no-users')).toHaveCount(0);                   // reference-only: zero new users
    await expect(page.getByTestId('new-no-users-manage-tags')).toHaveCount(0);       // reference-only: zero new users
    await page.getByTestId('new-button-9').click();
    await expect(page.getByTestId('new-event-10')).toBeVisible();
    await expect(page.getByTestId('new-workshop-options-loading')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId('new-workshop-options-error')).toHaveCount(0);     // reference-only: list read error
    await expect(page.getByTestId('new-workshop-options-retry')).toHaveCount(0);     // reference-only: list read error
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 820, height: 1000 });
    await page.getByTestId('new-filters-btn').click();
    await page.getByTestId('new-sheet-workshops-choose').click();
    await expect(page.getByTestId('new-sheet-workshop-retry')).toHaveCount(0);       // reference-only: list read error
    await page.getByTestId('new-filters-sheet-close').click();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByTestId('new-open-tags-manager-20').click();
    await expect(page.getByTestId('atd-ledger')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('atd-empty')).toHaveCount(0);                      // reference-only: no tags at all
  });
});
