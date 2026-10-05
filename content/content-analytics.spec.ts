// content-analytics.spec.ts — /contentanalytics (content/content-analytics). NOT the same screen as
// /content-analytics-dashboard (CN-08).
//
// Recon: e2e/recon-allcomp/content.md "Addendum — 2026-09-07" (CN-40 / CN-41 / CN-42).
//
// On init the screen runs ONE live query: `content analytics` where logdate > (today−7 @ 00:00:00.000)
// and logdate < (today @ 23:59:59.999), orderBy logdate desc (content-analytics.component.ts:109-110,
// 810-821). CN-40 rebuilds the same window in the test process and asks the Admin SDK for the distinct
// profileids inside it — the "Unique Users" card must agree. The seeded 30-day-old log is the negative
// control: if the window were ignored, both the card and the Video Name option list would include it.
//
// Duplicate detection (ts:831-842): key = `${logdate.seconds}_${videoid}_${totaltimespend}_${profileid}`;
// the SECOND doc with a key seen before is flagged isDuplicate → trash button. The seed writes two docs
// that differ only by doc id, so exactly one trash button is the falsifiable outcome (CN-41).
import { test, expect } from '@playwright/test';
import {
  analyticsDupProfile, analyticsUserTypeText, analyticsVideoNames, clearAnalyticsUserTypes,
  installContentStubs, loginAsContentAdmin, resetAnalyticsDuplicates, seedAnalyticsUserTypes,
} from './support/content';
import { readFileSync } from 'fs';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere, pollUntil, queryWhere } from '../queue/support/firestore-admin';
import { ROW, openSelect } from './support/ui';

/** The screen's default window, rebuilt the way the constructor builds it (ts:105-110). */
function defaultWindow(): { start: number; end: number } {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const start = new Date(); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime() };
}
const toMillis = (v: any): number => typeof v?.toMillis === 'function' ? v.toMillis() : (v?._seconds ? v._seconds * 1000 : NaN);

/**
 * Type a name into the Analytics Table's name filter.
 *
 * TRAP: the input is bound to `(keyup)="onFilter(filterValue)"`. Playwright's fill() dispatches only
 * `input`, so it would set the box and never run the filter. pressSequentially sends real keys.
 * The match is a PREFIX one (`indexOf(term) === 0`), so pass a prefix, not a fragment.
 */
async function filterAnalyticsByName(page: import('@playwright/test').Page, term: string): Promise<void> {
  const box = page.getByTestId('ca-inp-005');
  await expect(box, 'the name filter must render').toBeVisible({ timeout: 30_000 });
  await box.fill('');
  await box.pressSequentially(term, { delay: 10 });
}

/** The downloaded file's text. acceptDownloads is on by default, so path() resolves locally. */
async function readDownload(download: import('@playwright/test').Download): Promise<string> {
  const path = await download.path();
  expect(path, 'the download must land on disk').toBeTruthy();
  return readFileSync(path!, 'utf8');
}

test.describe('Content — /contentanalytics (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installContentStubs(page);
    await resetAnalyticsDuplicates(); // the identical pair back in place (CN-42 deletes one)
    await loginAsContentAdmin(page);
    await page.goto('/contentanalytics', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/contentanalytics$/, { timeout: 30_000 });
    await expect(page.locator(ROW).first(), 'a first in-window log row rendered').toBeVisible({ timeout: 45_000 });
  });
  test.afterEach(() => assertNoFatal(guard, 'contentanalytics: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-40 — Unique Users == distinct in-window profileids; the 30-day-old log is outside the window
  // ===========================================================================================
  test('CN-40 the Unique Users card equals the distinct in-window profileids (old log excluded)', async ({ page }) => {
    // [INDEPENDENT] every log the app's strict range would admit, distinct by profileid.
    const { start, end } = defaultWindow();
    const all = await queryWhere('content analytics');
    const inWindow = all.filter((d) => { const t = toMillis(d.logdate); return t > start && t < end; });
    const distinct = new Set(inWindow.map((d) => String(d.profileid)));
    expect(distinct.size, 'CN-40: the seed put several profiles inside the window').toBeGreaterThanOrEqual(6);
    expect(all.some((d) => d.videoname === 'TEST_VID_old'), 'CN-40: the 30-day-old control log exists').toBe(true);
    expect(inWindow.some((d) => d.videoname === 'TEST_VID_old'), 'CN-40: …and is outside the window').toBe(false);

    // [REAL-UI] the card the app computed from its own stream (getUniqueUser, ts:993-1007).
    const card = page.locator('.summary-card').filter({ hasText: 'Unique Users' });
    await expect(card.locator('.summary-card-value'), 'CN-40: Unique Users == Admin-computed distinct in-window profileids')
      .toHaveText(String(distinct.size), { timeout: 30_000 });

    // [CONTROL] the Video Name filter's options are accumulated from the SAME in-window stream
    // (ts:867-880): the dup video is offered, the 30-day-old one is not.
    await openSelect(page, page.locator('mat-form-field').filter({ hasText: 'Video Name' }).locator('mat-select'));
    const options = page.locator('.cdk-overlay-pane mat-option');
    await expect(options.filter({ hasText: 'TEST_VID_dup' }), 'CN-40: an in-window video is a filter option').toHaveCount(1);
    await expect(options.filter({ hasText: 'TEST_VID_old' }), 'CN-40: the out-of-window video is NOT offered').toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  // ===========================================================================================
  // CN-41 — exactly one of the identical pair is flagged; "Duplicates only" narrows to that row
  // ===========================================================================================
  test('CN-41 the identical pair yields exactly one duplicate flag and one row under "Duplicates only"', async ({ page }) => {
    // [ASSERT] the app flagged the SECOND occurrence only (first is not a duplicate, ts:831-842).
    await expect(page.locator('button[title="Delete duplicate"]'), 'CN-41: exactly one trash button for the pair')
      .toHaveCount(1, { timeout: 30_000 });

    await page.locator('mat-slide-toggle.ctrl-toggle-duplicates').click();
    await expect(page.locator(ROW), 'CN-41: "Duplicates only" leaves exactly the flagged row').toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator(ROW).first(), 'CN-41: …and it is the seeded dup video').toContainText('TEST_VID_dup');
  });

  // ===========================================================================================
  // CN-42 — Delete duplicate (confirm ACCEPTED) → exactly one of the pair remains
  // ===========================================================================================
  // DIALOG TRAP: deleteDuplicate() gates on a bare window.confirm (ts:979). With no page.on('dialog')
  // handler Playwright AUTO-DISMISSES it — confirm() returns false, deleteDoc never runs, and a test that
  // only asserted "no error" would still pass. So the handler is registered BEFORE the click and the
  // assertion is on the Firestore post-state (2 → 1), never on the UI alone.
  test('CN-42 accepting the delete-duplicate confirm removes exactly one of the pair', async ({ page }) => {
    expect(await countWhere('content analytics', [['profileid', '==', analyticsDupProfile]]), 'CN-42: the pair is in place').toBe(2);

    let confirmText = '';
    page.on('dialog', async (d) => { confirmText = d.message(); await d.accept(); });

    const trash = page.locator('button[title="Delete duplicate"]');
    await expect(trash).toHaveCount(1, { timeout: 30_000 });
    await trash.click();

    await pollUntil(
      () => countWhere('content analytics', [['profileid', '==', analyticsDupProfile]]),
      (n) => n === 1,
      { label: 'CN-42: the app deleted one of the two identical logs', timeoutMs: 30_000 },
    );
    expect(confirmText, 'CN-42: the confirm() the app showed').toBe('Are you sure you want to delete this duplicate?');
    // and the flag is gone from the table — the survivor is no longer a duplicate of anything
    await expect(page.locator('button[title="Delete duplicate"]'), 'CN-42: no duplicate flag remains').toHaveCount(0, { timeout: 30_000 });
  });
});

// ===============================================================================================
// CN-47 / CN-48 — 2026-10-05. Two changes on the Analytics Table tab:
//   • new_user_data is read for NEW users only — a record flagged `movedtoexist: true` has been
//     migrated to a full profile and must no longer stand in for that person.
//   • the CSV export carries the person's email and the row's Status, which it was missing.
//
// Anti-circularity: the seed writes three people with KNOWN names, emails and a known status, and
// both cases assert what the APP rendered or wrote from them. The export case reads the real
// downloaded file, not an in-page preview.
//
// Own describe + own seeder: CN-41 counts duplicate flags and CN-40 bounds the Unique Users card,
// so these extra logs must not exist while those run.
// ===============================================================================================
test.describe('Content — /contentanalytics new-user rule + export columns', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    guard = attachConsoleGuard(page);
    await seedAnalyticsUserTypes();
    await installContentStubs(page);
  });
  test.afterEach(async () => {
    await clearAnalyticsUserTypes();
    assertNoFatal(guard, '/contentanalytics: no fatal console errors / pageerrors');
  });

  // =============================================================================================
  // CN-47 — a migrated new_user_data record no longer names its person
  // =============================================================================================
  test('CN-47 only new_user_data records that have NOT moved to a full profile name their person', async ({ page }) => {
    // Preconditions on the constants: an empty name would make every hasText locator below match
    // everything, and the case would fail far from the cause.
    expect(analyticsUserTypeText.stillNewName, 'CN-47: the still-new name resolves').toBeTruthy();
    expect(analyticsUserTypeText.movedName, 'CN-47: the moved name resolves').toBeTruthy();

    await loginAsContentAdmin(page);
    await page.goto('/contentanalytics', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table').first(), 'CN-47: the analytics table renders').toBeVisible({ timeout: 60_000 });

    // Isolate the three seeded people with the screen's own name filter. The table paginates
    // (25/50/100) over a 7-day window of a collection the shared emulator also holds other runs'
    // documents in, so an unfiltered row lookup could simply be on another page.
    await filterAnalyticsByName(page, analyticsUserTypeText.prefix);

    // [ASSERT] the still-new person IS named from new_user_data, and carries the (New User) tag —
    // the positive control. Without it, "the other name is absent" would prove nothing: both could
    // be missing because the screen never read new_user_data at all.
    const newRow = page.locator('tr', { hasText: analyticsUserTypeText.stillNewName });
    await expect(newRow, 'CN-47: the still-new person is named from new_user_data')
      .toHaveCount(1, { timeout: 60_000 });
    await expect(newRow.first(), 'CN-47: and is tagged as a new user').toContainText('(New User)');

    // [ASSERT] the ordinary existing person is unaffected and named from participant metadata.
    await expect(
      page.locator('tr', { hasText: analyticsUserTypeText.existingName }),
      'CN-47: an existing person is still named from participant metadata',
    ).toHaveCount(1);

    // [ASSERT] the migrated person is NOT named from their stale new_user_data row. They have no
    // participant metadata either, by design — so before this change the old name WAS on screen and
    // matched this very filter. This is the assertion that would have failed.
    await expect(
      page.locator('tr', { hasText: analyticsUserTypeText.movedName }),
      'CN-47: a record flagged movedtoexist no longer names its person',
    ).toHaveCount(0);
  });

  // =============================================================================================
  // CN-48 — the exported CSV carries email and status
  // =============================================================================================
  test('CN-48 the CSV export includes an email column and the Status column', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/contentanalytics', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table').first(), 'CN-48: the analytics table renders').toBeVisible({ timeout: 60_000 });

    // Narrow to the seeded people first. exportCSV() writes filteredData when a filter is active, so
    // this makes the downloaded file deterministic — otherwise it carries every row in the window,
    // including other runs', and the per-row cell count below could trip over foreign data.
    await filterAnalyticsByName(page, analyticsUserTypeText.prefix);
    await expect(
      page.locator('tr', { hasText: analyticsUserTypeText.existingName }),
      'CN-48: the seeded rows are in the table before exporting',
    ).toHaveCount(1, { timeout: 60_000 });

    // [REAL-UI] click the real export button and take the real download.
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByTestId('ca-btn-004').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename(), 'CN-48: a .csv is downloaded').toMatch(/\.csv$/);
    const csv = await readDownload(download);

    const [header, ...body] = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
    const columns = header.split(',').map(c => c.trim());

    // [ASSERT] both columns exist, by exact name — a substring check would pass on "emailaddress"
    // or on "status" inside some other header.
    expect(columns, `CN-48: an email column. Header=${header}`).toContain('email');
    expect(columns, `CN-48: a status column. Header=${header}`).toContain('status');

    // [ASSERT] and they carry real values, not empty cells. Email resolves from participant
    // metadata for the existing person and from new_user_data for the still-new one — the two
    // sources the export falls through, asserted separately.
    const lineFor = (name: string) => body.find(l => l.includes(name));
    const existingLine = lineFor(analyticsUserTypeText.existingName);
    expect(existingLine, `CN-48: the existing person has a row. Body=${body.join(' | ')}`).toBeTruthy();
    expect(existingLine, 'CN-48: their email comes from participant metadata')
      .toContain(analyticsUserTypeText.existingEmail);
    expect(existingLine, 'CN-48: the seeded status is exported').toContain('incomplete');

    const newLine = lineFor(analyticsUserTypeText.stillNewName);
    expect(newLine, 'CN-48: the still-new person has a row').toBeTruthy();
    expect(newLine, 'CN-48: their email comes from new_user_data')
      .toContain(analyticsUserTypeText.stillNewEmail);

    // [ASSERT] the seeded rows have exactly as many cells as the header. This is the guard that
    // matters: ConvertToCSV quotes nothing, so a value carrying a comma would silently shift every
    // column after it and the file would still look fine at a glance. Checked on the rows this case
    // controls the content of — a foreign row's name is not ours to make assumptions about.
    for (const line of [existingLine!, newLine!]) {
      expect(line.split(',').length, `CN-48: row has ${columns.length} cells. Row="${line}"`)
        .toBe(columns.length);
    }
  });

  // =============================================================================================
  // CN-49 — the Video Name dropdown's typeahead
  //
  // The second assertion is the one with teeth. The dropdown is `multiple`, and MatSelect's
  // _initializeSelection() → _setSelectionByValue() clears the selection model on every options
  // change and re-selects only the options CURRENTLY RENDERED; _propagateChanges() then writes back
  // `selected.map(o => o.value)`. So a chosen video hidden behind a search term would leave the
  // model, and the user's next click would silently emit a value array without it — losing a choice
  // they had already made. The engine keeps selected options rendered to prevent exactly that, and
  // this case is what holds that in place.
  // =============================================================================================
  test('CN-49 the Video Name dropdown searches its options, and never hides one already chosen', async ({ page }) => {
    expect(analyticsVideoNames.prefix, 'CN-49: the video name prefix resolves').toBeTruthy();
    expect(analyticsVideoNames.one, 'CN-49: the first video name resolves').toBeTruthy();

    await loginAsContentAdmin(page);
    await page.goto('/contentanalytics', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('table').first(), 'CN-49: the analytics table renders').toBeVisible({ timeout: 60_000 });

    const rows = page.locator('tr', { hasText: analyticsUserTypeText.existingName });
    await expect(rows, 'CN-49: the seeded logs are loaded, so their video names are options')
      .toHaveCount(1, { timeout: 60_000 });

    const options = page.getByTestId('ca-videoname-option');
    await page.getByTestId('ca-msel-009').click();
    await expect(options.first(), 'CN-49: the dropdown lists its options').toBeVisible({ timeout: 30_000 });
    const allCount = await options.count();
    expect(allCount, 'CN-49: at least the three seeded video names are offered').toBeGreaterThanOrEqual(3);

    // ngx-mat-select-search renders a hidden helper <input> beside the visible one, so address the
    // visible one by its placeholder. It also marks its host <mat-option> aria-disabled while keeping
    // pointer-events:all — a person types there fine, but Playwright's actionability check refuses to
    // fill inside an aria-disabled ancestor. Click with the check bypassed and type real keys.
    const search = page.getByTestId('ca-videoname-search').getByPlaceholder('Search video names');
    await search.click({ force: true });
    await page.keyboard.type(analyticsVideoNames.prefix);

    // [ASSERT] the term narrows the OPTIONS to the three seeded names...
    await expect(options, 'CN-49: the search narrows the options to the seeded three')
      .toHaveCount(3, { timeout: 15_000 });
    for (const name of [analyticsVideoNames.one, analyticsVideoNames.two, analyticsVideoNames.three]) {
      await expect(options.filter({ hasText: name }), `CN-49: "${name}" is offered`).toHaveCount(1);
    }
    // ...and does NOT filter the table behind it — the typeahead picks options, nothing else.
    await expect(rows, 'CN-49: typing in the option search does not filter the table').toHaveCount(1);

    // Choose one, then search for a term that excludes it.
    await options.filter({ hasText: analyticsVideoNames.one }).click();
    await search.click({ force: true });
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(analyticsVideoNames.three);

    // [ASSERT] the chosen video is STILL offered although the term excludes it, and is still ticked.
    // Without the keep-selected rule it would vanish here, and the next click would drop it.
    const chosen = options.filter({ hasText: analyticsVideoNames.one });
    await expect(chosen, 'CN-49: an already-chosen name stays rendered under a term that excludes it')
      .toHaveCount(1, { timeout: 15_000 });
    await expect(chosen, 'CN-49: and is still selected').toHaveAttribute('aria-selected', 'true');
    // The matching one is there too; the one matching neither is gone.
    await expect(options.filter({ hasText: analyticsVideoNames.three }), 'CN-49: the matching name is offered').toHaveCount(1);
    await expect(options.filter({ hasText: analyticsVideoNames.two }), 'CN-49: an unmatched, unchosen name is not').toHaveCount(0);

    // [ASSERT] clearing the term brings every option back.
    await search.click({ force: true });
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await expect(options, 'CN-49: clearing the search restores every option')
      .toHaveCount(allCount, { timeout: 15_000 });
  });
});
