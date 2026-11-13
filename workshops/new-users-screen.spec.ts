// new-users-screen.spec.ts — /newusersprofile after the 2026-11-12 usability pass: the column chooser,
// renaming a tag from "Manage tags", search / no-match, and the selection bar.
//
// Recon: starlabs-angular specs/journals/2026-11-12-new-users-screen.md.
//
// Hooks: `new-*` (newusersprofile.component.html) and `atd-*` (assign-tags-dialog.component.html).
// new-columns-*, new-column-*, new-search-*, new-result-count, new-no-match-clear-filters, new-selection-bar,
// new-workshop-filter-loading and atd-rename-* landed with this pass, so the hub-ahead guard
// (scripts/readiness/landed-specs.cjs) skips this whole file on app branches that predate it.
//
// THE RULES UNDER TEST
//   · Columns: Name, Phone, Email, Created and Tags show by default. Status and Referred by are opt-in. The
//     choice is kept in this browser. Workshop and Moved On still come and go with their filters (WS-57).
//   · Manage tags: clicking a tag renames it. Only the tag's name changes; its id, and every user carrying
//     it, stay. An empty name or another tag's name (any case) is refused, and nothing is written.
//   · Ticking rows opens a bar UNDER the table; the table keeps its width.
import { test, expect, Page } from '@playwright/test';
import {
  wsAddIds, wsAddNames, installWshopStubs, loginAsWshopAdmin, resetNewUserTags,
  wsReferred, seedReferredNewUsers, clearReferredNewUsers, alignWorkshopMetadataNames, wsMetaNames,
  wsRenameTag, seedRenameTag, clearRenameTag,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil } from '../queue/support/firestore-admin';

const ROW = 'table.users-table tr.mat-mdc-row, table.users-table tr[mat-row]';
const HEADERS = 'table.users-table th.mat-mdc-header-cell:not(.select-col)';

async function openScreen(page: Page, waitFor: string): Promise<void> {
  await page.goto('/newusersprofile', { waitUntil: 'domcontentloaded' });
  await expect(page.locator(ROW).filter({ hasText: waitFor }), 'the table must render').toHaveCount(1, { timeout: 30_000 });
}

test.describe('Workshops — new users screen: columns, tag rename, search, selection', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'new users screen: no fatal console errors / pageerrors'));

  test('NUS-01 five columns by default; Status / Referred by are opt-in; the choice survives a reload; Default resets it', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openScreen(page, wsAddNames.nuAlpha);
    await expect(page.locator(HEADERS), 'NUS-01: the default columns, in order').toHaveText(['Name', 'Phone', 'Email', 'Created', 'Tags']);

    await page.getByTestId('new-columns-btn').click();
    await expect(page.getByTestId('new-columns-panel'), 'NUS-01: the chooser opens').toBeVisible();
    await expect(page.getByTestId('new-column-name'), 'NUS-01: Name is ticked').toHaveClass(/\bsel\b/);
    await expect(page.getByTestId('new-column-phone'), 'NUS-01: Phone is ticked').toHaveClass(/\bsel\b/);
    await expect(page.getByTestId('new-column-email'), 'NUS-01: Email is ticked').toHaveClass(/\bsel\b/);
    await expect(page.getByTestId('new-column-created'), 'NUS-01: Created is ticked').toHaveClass(/\bsel\b/);
    await expect(page.getByTestId('new-column-tags'), 'NUS-01: Tags is ticked').toHaveClass(/\bsel\b/);
    await expect(page.getByTestId('new-column-status'), 'NUS-01: Status is not ticked').not.toHaveClass(/\bsel\b/);
    await expect(page.getByTestId('new-columns-reset'), 'NUS-01: no Default link while on the defaults').toHaveCount(0);

    // The menu stays open while ticking, so several changes go in one go.
    await page.getByTestId('new-column-status').click();
    await page.getByTestId('new-column-referredby').click();
    await page.getByTestId('new-column-email').click();
    await expect(page.locator(HEADERS), 'NUS-01: Status and Referred by on, Email off, table order kept')
      .toHaveText(['Name', 'Phone', 'Created', 'Status', 'Referred by', 'Tags']);
    await page.keyboard.press('Escape');

    await openScreen(page, wsAddNames.nuAlpha);
    await expect(page.locator(HEADERS), 'NUS-01: the choice is kept after a reload')
      .toHaveText(['Name', 'Phone', 'Created', 'Status', 'Referred by', 'Tags']);

    await page.getByTestId('new-columns-btn').click();
    await page.getByTestId('new-columns-reset').click();
    await expect(page.locator(HEADERS), 'NUS-01: Default brings back the five').toHaveText(['Name', 'Phone', 'Email', 'Created', 'Tags']);
  });

  // Was WS-73 in new-users-profile.spec.ts. Referred by is opt-in now, so the case turns it on first.
  test('NUS-02 Referred by (turned on) shows the referrer\'s name, participant or new user', async ({ page }) => {
    await alignWorkshopMetadataNames();   // p0's metadata name is CF-owned (its actor email) — make it known first
    await seedReferredNewUsers();
    try {
      await loginAsWshopAdmin(page);
      const R = wsReferred;
      await openScreen(page, R.byNew.name);
      const referredBy = (name: string) => page.locator(ROW).filter({ hasText: name }).getByTestId('new-referred-by');
      // [NEGATIVE CONTROL] hidden by default: the referred users render, but no referrer cell does.
      await expect(page.getByTestId('new-referred-by'), 'NUS-02: Referred by is hidden by default').toHaveCount(0);

      await page.getByTestId('new-columns-btn').click();
      await page.getByTestId('new-column-referredby').click();
      await page.keyboard.press('Escape');

      // A referrer nobody knows still falls back to the raw id — the lookup is not inventing names.
      await expect(referredBy(R.byUnknown.name), 'NUS-02: unknown referrer -> the id').toHaveText(R.UNKNOWN_REFERRER);
      await expect(referredBy(R.byMeta.name), 'NUS-02: participant referrer -> metadata name').toHaveText(wsMetaNames.p0);
      await expect(referredBy(R.byNew.name), 'NUS-02: new-user referrer (id) -> their name, not the id').toHaveText(wsAddNames.nuAlpha);
      await expect(referredBy(R.byNewRef.name), 'NUS-02: new-user referrer (reference) -> their name').toHaveText(wsAddNames.nuBravo);
    } finally {
      await clearReferredNewUsers();
    }
  });

  test('NUS-03 Manage tags renames a tag: name only, duplicates and blanks refused, Escape keeps the dialog', async ({ page }) => {
    const T = wsRenameTag;
    await seedRenameTag();
    try {
      const before: any = await getDoc('newusertags', T.id);
      expect(before?.name, 'NUS-03 precondition: the tag is seeded').toBe(T.name);
      await loginAsWshopAdmin(page);
      await openScreen(page, T.user.name);
      const row = page.locator(ROW).filter({ hasText: T.user.name });
      // Four tags on the row: three pills, then "+1".
      await expect(row.locator('.tag-pill'), 'NUS-03: three tag pills and a +1')
        .toHaveText([T.name, T.extras[0].name, T.extras[1].name, '+1']);

      await page.getByTestId('new-open-tags-manager-20').click();
      const chip = (name: string) => page.getByTestId('atd-toggle-4').filter({ hasText: name });
      await expect(chip(T.name), 'NUS-03: the tag is listed in Manage tags').toBeVisible({ timeout: 20_000 });
      const input = page.getByTestId('atd-rename-input');

      // Escape ends the edit, not the dialog.
      await chip(T.name).click();
      await expect(input, 'NUS-03: clicking a tag opens its name for editing').toHaveValue(T.name);
      await input.press('Escape');
      await expect(input, 'NUS-03: Escape closes the editor').toHaveCount(0);
      await expect(page.getByTestId('atd-cancel-1'), 'NUS-03: ...and the dialog stays open').toBeVisible();

      // Cancel does the same.
      await chip(T.name).click();
      await page.getByTestId('atd-rename-cancel').click();
      await expect(input, 'NUS-03: Cancel closes the editor').toHaveCount(0);

      // Another tag's name, in another case: refused, nothing written.
      await chip(T.name).click();
      await input.fill(wsAddNames.segment.toUpperCase());
      await page.getByTestId('atd-rename-save').click();
      await expect(page.getByTestId('atd-rename-error'), 'NUS-03: a duplicate name is refused').toContainText(/already has this name/i);
      // A blank name: refused.
      await input.fill('   ');
      await input.press('Enter');
      await expect(page.getByTestId('atd-rename-error'), 'NUS-03: a blank name is refused').toContainText(/Enter a name/i);
      expect((await getDoc('newusertags', T.id) as any)?.name, 'NUS-03: refused saves wrote nothing').toBe(T.name);

      await input.fill(T.renamed);
      await input.press('Enter');
      const after: any = await pollUntil(
        () => getDoc('newusertags', T.id),
        (d: any) => d?.name === T.renamed,
        { label: 'NUS-03: the app renamed the tag', timeoutMs: 30_000 },
      );
      expect(after.type, 'NUS-03: the tag keeps its type').toBe('newusersegments');
      expect(after.docid, 'NUS-03: and its other stored fields').toBe(T.id);
      await expect(chip(T.renamed), 'NUS-03: the dialog shows the new name').toBeVisible();
      await expect(input, 'NUS-03: the editor closes after saving').toHaveCount(0);

      await page.getByTestId('atd-cancel-1').click();
      await expect(row.locator('.tag-pill').first(), 'NUS-03: the table shows the new name on the user').toHaveText(T.renamed);
      const user: any = await getDoc('new_user_data', T.user.id);
      expect(user.tags, 'NUS-03: the user still carries the same tag ids').toEqual([T.id, ...T.extras.map(e => e.id)]);
    } finally {
      await clearRenameTag();
    }
  });

  test('NUS-04 search clears from its own button; no match offers Clear filters; the count follows', async ({ page }) => {
    await resetNewUserTags();
    await loginAsWshopAdmin(page);
    await openScreen(page, wsAddNames.nuAlpha);
    const count = page.getByTestId('new-result-count');
    await expect(count, 'NUS-04: the count reads "N of M users"').toHaveText(/^\s*\d+ of \d+ users\s*$/);

    const search = page.getByTestId('new-search-input');
    await search.fill(wsAddNames.nuCharlie);
    await expect(page.locator(ROW).filter({ hasText: wsAddNames.nuCharlie }), 'NUS-04: the match stays').toHaveCount(1);
    await expect(page.locator(ROW).filter({ hasText: wsAddNames.nuAlpha }), 'NUS-04: others go').toHaveCount(0);
    await expect(count, 'NUS-04: one shown').toHaveText(/^\s*1 of \d+ users\s*$/);
    await page.getByTestId('new-search-clear').click();
    await expect(search, 'NUS-04: the clear button empties the search').toHaveValue('');
    await expect(page.locator(ROW).filter({ hasText: wsAddNames.nuAlpha }), 'NUS-04: everyone is back').toHaveCount(1);

    await search.fill('zz no such user zz');
    await expect(page.locator(ROW), 'NUS-04: nothing matches').toHaveCount(0);
    await expect(page.getByText('No users match these filters.'), 'NUS-04: the empty table says why').toBeVisible();
    await expect(page.getByTestId('new-workshop-filter-loading'), 'NUS-04: no workshop read is pending').toHaveCount(0);
    await page.getByTestId('new-no-match-clear-filters').click();
    await expect(search, 'NUS-04: Clear filters empties the search too').toHaveValue('');
    await expect(page.locator(ROW).filter({ hasText: wsAddNames.nuAlpha }), 'NUS-04: rows are back').toHaveCount(1);
  });

  test('NUS-05 ticking rows opens a bar under the table without squeezing it; Export and Send open one at a time', async ({ page }) => {
    await resetNewUserTags();
    await loginAsWshopAdmin(page);
    await openScreen(page, wsAddNames.nuAlpha);
    const card = page.locator('.nu-table-card');
    const before = (await card.boundingBox())!.width;
    const bar = page.getByTestId('new-selection-bar');
    await expect(bar, 'NUS-05: no bar before anything is ticked').toHaveCount(0);

    await page.locator(ROW).filter({ hasText: wsAddNames.nuAlpha }).getByTestId('new-change-selection-24').locator('input').click();
    await expect(bar, 'NUS-05: ticking a row opens the bar').toBeVisible();
    await expect(bar, 'NUS-05: it counts the selection').toContainText(/1\s*selected/);
    expect(Math.abs((await card.boundingBox())!.width - before), 'NUS-05: the table keeps its width').toBeLessThan(2);

    await page.getByTestId('new-toggle-export-28').click();
    await expect(page.getByTestId('new-export-excel-30'), 'NUS-05: Export opens its panel').toBeVisible();
    await page.getByTestId('new-toggle-comm-31').click();
    await expect(page.getByTestId('new-send-watti-33'), 'NUS-05: Send opens its panel').toBeVisible();
    await expect(page.getByTestId('new-export-excel-30'), 'NUS-05: ...and closes Export').toHaveCount(0);

    // A ticked person hidden by a search is still selected, and the bar says so.
    await page.getByTestId('new-search-input').fill(wsAddNames.nuCharlie);
    await expect(bar, 'NUS-05: the hidden ticked person is called out').toContainText('1 not shown');

    await page.getByTestId('new-clear-selection-26').click();
    await expect(bar, 'NUS-05: clearing the selection closes the bar').toHaveCount(0);
  });
});
