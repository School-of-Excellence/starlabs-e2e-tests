// new-users-profile.spec.ts — /newusersprofile (New-Workshop/newusersprofile).
//
// Recon: e2e/recon-allcomp/workshops.md "Addendum — 2026-09-04" (WS-21 / WS-22 / WS-23).
//
// The route has NO canActivate (app.routes.ts:287) and exposes bulk participant data plus a write path,
// so every case here asserts data the app computed, not reachability.
//
// Anti-circularity — the untagged user:
//   WS-22 asserts the tag filter HIDES a user. With only tagged users seeded, "the untagged user is not
//   visible" would pass whether or not the filter runs. NU_C is seeded deliberately WITHOUT the segment
//   so the filter has something to actually exclude; the same doc is then the WS-23 write target, reset
//   to untagged beforehand so the assertion is on the array the APP wrote.
import { test, expect } from '@playwright/test';
import {
  wsAddIds, wsAddNames, installWshopStubs, loginAsWshopAdmin, resetNewUserTags,
  seedConvertedNewUser, clearConvertedNewUser, wsSeedDayMDY,
  seedWatiConfig, clearWatiConfig, captureWorkshopProgressSend, pickWatiTemplate,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil } from '../queue/support/firestore-admin';

const ROW = 'table.users-table tr.mat-mdc-row, table.users-table tr[mat-row]';

test.describe('Workshops — new users profile (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'newusersprofile: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // WS-21 — the table renders newest-first (created DESC)
  // ===========================================================================================
  test('WS-21 new_user_data rows render newest-first', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/newusersprofile', { waitUntil: 'domcontentloaded' });

    await expect(
      page.locator(ROW).filter({ hasText: wsAddNames.nuAlpha }),
      'WS-21: the seeded users must render from the live stream',
    ).toHaveCount(1, { timeout: 30_000 });

    // [ASSERT] the app sorts its stream by created DESC (ts:306). The seed supplies three KNOWN,
    // distinct created stamps (-1d, -2d, -3d); the ORDER is the app's conclusion, not a seeded field.
    const rows = await page.locator(ROW).allTextContents();
    const idx = (n: string) => rows.findIndex((r) => r.includes(n));
    const iA = idx(wsAddNames.nuAlpha);    // created -1d → newest
    const iB = idx(wsAddNames.nuBravo);    // created -2d
    const iC = idx(wsAddNames.nuCharlie);  // created -3d → oldest
    expect(iA, 'WS-21: the newest user rendered').toBeGreaterThanOrEqual(0);
    expect(iA, `WS-21: created -1d (${iA}) must precede created -2d (${iB})`).toBeLessThan(iB);
    expect(iB, `WS-21: created -2d (${iB}) must precede created -3d (${iC})`).toBeLessThan(iC);
  });

  // ===========================================================================================
  // WS-22 — the segment-tag filter narrows to only users carrying that tag
  // ===========================================================================================
  test('WS-22 filtering by a segment hides users that do not carry it', async ({ page }) => {
    // The write case may have tagged NU_C on a previous run — reset so it is the untagged control here.
    await resetNewUserTags();

    await loginAsWshopAdmin(page);
    await page.goto('/newusersprofile', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(ROW).filter({ hasText: wsAddNames.nuCharlie })).toHaveCount(1, { timeout: 30_000 });

    // [REAL-UI] open the tag filter menu and pick the seeded segment by NAME (the menu resolves tag ids
    // to names, so clicking by name also exercises that lookup).
    await page.locator('button.tag-select-btn').first().click();
    await page.locator('button.tfm-item').filter({ hasText: wsAddNames.segment }).click();

    // [ASSERT] the two tagged users survive the filter...
    await expect(
      page.locator(ROW).filter({ hasText: wsAddNames.nuAlpha }),
      'WS-22: a user carrying the segment must remain visible',
    ).toHaveCount(1, { timeout: 15_000 });
    await expect(
      page.locator(ROW).filter({ hasText: wsAddNames.nuBravo }),
      'WS-22: the second tagged user must remain visible',
    ).toHaveCount(1);

    // ...and the UNTAGGED user is excluded. This is the falsifiable half: NU_C exists and rendered a
    // moment ago, so its disappearance can only be the app's filter.
    await expect(
      page.locator(ROW).filter({ hasText: wsAddNames.nuCharlie }),
      'WS-22: the untagged user must be filtered OUT (negative control)',
    ).toHaveCount(0, { timeout: 15_000 });
  });

  // ===========================================================================================
  // WS-23 — bulk tag assign WRITES tags[] onto the selected new_user_data doc (writeBatch)
  // ===========================================================================================
  test('WS-23 assigning a segment writes the tag id onto the selected user', async ({ page }) => {
    // [PRECONDITION] NU_C starts untagged, so the post-state cannot be the value the test wrote.
    await resetNewUserTags();
    const before = await getDoc('new_user_data', wsAddIds.NU_C);
    expect(((before as any)!.tags || []), 'WS-23: the target user starts with no tags').toHaveLength(0);

    await loginAsWshopAdmin(page);
    await page.goto('/newusersprofile', { waitUntil: 'domcontentloaded' });

    const row = page.locator(ROW).filter({ hasText: wsAddNames.nuCharlie });
    await expect(row, 'WS-23: the target row must render').toHaveCount(1, { timeout: 30_000 });

    // [REAL-UI] select the row → the bulk side panel appears → "Edit tags" opens the assign dialog.
    await row.locator('mat-checkbox input[type="checkbox"], mat-checkbox').first().click();
    await page.getByRole('button', { name: /Edit tags/i }).click();

    // Pick the seeded segment chip, then Apply (bulk mode's confirm label).
    const chip = page.locator('button.chip').filter({ hasText: wsAddNames.segment });
    await expect(chip, 'WS-23: the segment chip must be offered in the dialog').toBeVisible({ timeout: 20_000 });
    await chip.click();
    await page.getByRole('button', { name: /^Apply$/ }).click();

    // [ASSERT] the app's writeBatch (ts:633) put the tag ID on the doc. We compare the persisted array
    // to the KNOWN seeded tag id — app output vs known input. The test never wrote this value.
    const after = await pollUntil(
      () => getDoc('new_user_data', wsAddIds.NU_C),
      (d) => !!d && Array.isArray((d as any).tags) && (d as any).tags.includes(wsAddIds.NUT_SEGMENT),
      { label: 'WS-23: new_user_data.tags contains the segment id', timeoutMs: 30_000 },
    );
    expect(
      (after as any)!.tags,
      'WS-23: the app persisted the segment tag id on the selected user',
    ).toContain(wsAddIds.NUT_SEGMENT);
  });

  // ===========================================================================================
  // WS-56 — the created-date range filter keeps only rows created inside the window
  //
  // The three seeded users sit on three different days (-1d / -2d / -3d, seed-workshops.js at()).
  // Narrowing to the MIDDLE day puts a negative control on BOTH sides of the window, so a filter
  // that ignored the start bound and one that ignored the end bound both fail.
  //
  // Why the toHaveCount(0) assertions are sound: all three rows are asserted VISIBLE TOGETHER first,
  // which also proves they share page 1 of the 20-row paginator. Filtering only removes rows, so a
  // row that was on page 1 and is now absent was excluded by the filter, not paged away.
  //
  // The negative halves are asserted FIRST (and carry the wait). A filterPredicate that THROWS leaves
  // every row in place, so leading with "the row must be gone" catches that; leading with the positive
  // would pass on a broken predicate (the WS-43 lesson).
  // ===========================================================================================
  test('WS-56 the created-date range narrows the table to the chosen window', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/newusersprofile', { waitUntil: 'domcontentloaded' });

    const rowFor = (name: string) => page.locator(ROW).filter({ hasText: name });

    // [PRECONDITION] all three days render, on one page, before any filtering.
    await expect(rowFor(wsAddNames.nuAlpha), 'WS-56: the -1d user must render').toHaveCount(1, { timeout: 30_000 });
    await expect(rowFor(wsAddNames.nuBravo), 'WS-56: the -2d user must render').toHaveCount(1);
    await expect(rowFor(wsAddNames.nuCharlie), 'WS-56: the -3d user must render').toHaveCount(1);

    // [REAL-UI] type the SAME day into both bounds — a one-day window on the -2d user. Both bounds are
    // real inputs now, so this exercises the app's own parse. Tab blurs, which is what fires dateChange
    // (fill() alone dispatches `input`, and the component re-filters on `change`).
    const middleDay = wsSeedDayMDY(-2);
    const start = page.getByTestId('new-created-start-date');
    const end = page.getByTestId('new-created-end-date');
    await start.fill(middleDay);
    await start.press('Tab');
    await end.fill(middleDay);
    await end.press('Tab');

    // [ASSERT] negative controls first — one newer than the end bound, one older than the start bound.
    await expect(
      rowFor(wsAddNames.nuAlpha),
      `WS-56: the -1d user is NEWER than the window end (${middleDay}) and must be filtered out`,
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(
      rowFor(wsAddNames.nuCharlie),
      `WS-56: the -3d user is OLDER than the window start (${middleDay}) and must be filtered out`,
    ).toHaveCount(0);

    // ...and the row inside the window survives.
    await expect(
      rowFor(wsAddNames.nuBravo),
      'WS-56: the user created inside the window must remain visible',
    ).toHaveCount(1);

    // [REAL-UI] the clear (x) on the range control drops both bounds and the full table comes back.
    await page.getByTestId('new-event-17').click();
    await expect(
      rowFor(wsAddNames.nuAlpha),
      'WS-56: clearing the dates restores the rows outside the window',
    ).toHaveCount(1, { timeout: 15_000 });
    await expect(rowFor(wsAddNames.nuCharlie), 'WS-56: clearing restores the oldest row too').toHaveCount(1);
  });

  // ===========================================================================================
  // WS-57 — the conversion filter's two options split the table, and the pair SWAPS
  //
  // NU_C is flipped to "moved over to existing users"; NU_A is left alone. The same two rows must
  // trade places when the option flips — Converted shows C and hides A, Not converted shows A and
  // hides C. A table that filtered nothing (or filtered on the wrong side) fails one direction.
  //
  // The Moved On column is asserted too: it belongs to the Converted side only, because the rows on
  // the other side have no move date to put in it.
  // ===========================================================================================
  test('WS-57 the conversion filter splits converted from not-converted profiles', async ({ page }) => {
    await seedConvertedNewUser();
    try {
      await loginAsWshopAdmin(page);
      await page.goto('/newusersprofile', { waitUntil: 'domcontentloaded' });

      const rowFor = (name: string) => page.locator(ROW).filter({ hasText: name });
      const movedOnHeader = page.locator('table.users-table th').filter({ hasText: 'Moved On' });

      // Open the menu by clicking the button's LEADING icon, not its centre. Once a choice is active
      // the button also carries a clear (x), and a centre click on a short label could land on it —
      // which would clear the filter instead of opening the menu. x:14 is always the leading icon.
      const openConversionMenu = () =>
        page.getByTestId('new-toggle-converted-filter-18').click({ position: { x: 14, y: 22 } });

      // [PRECONDITION] both sides render unfiltered, on one page.
      await expect(rowFor(wsAddNames.nuCharlie), 'WS-57: the converted user must render').toHaveCount(1, { timeout: 30_000 });
      await expect(rowFor(wsAddNames.nuAlpha), 'WS-57: the not-converted user must render').toHaveCount(1);
      await expect(movedOnHeader, 'WS-57: the Moved On column is absent while nothing is filtered').toHaveCount(0);

      // [REAL-UI] open the two-option menu and pick "Converted".
      await openConversionMenu();
      await page.getByTestId('new-set-converted-filter-converted').click();

      // [ASSERT] negative half first — a thrown predicate would leave this row in place.
      await expect(
        rowFor(wsAddNames.nuAlpha),
        'WS-57: Converted must filter OUT the profile that never moved over',
      ).toHaveCount(0, { timeout: 15_000 });
      await expect(
        rowFor(wsAddNames.nuCharlie),
        'WS-57: Converted must keep the profile that moved over',
      ).toHaveCount(1);
      await expect(movedOnHeader, 'WS-57: Converted adds the Moved On column').toHaveCount(1);

      // [REAL-UI] flip to the other option — the same two rows must trade places.
      await openConversionMenu();
      await page.getByTestId('new-set-converted-filter-not-converted').click();

      await expect(
        rowFor(wsAddNames.nuCharlie),
        'WS-57: Not converted must filter OUT the profile that moved over',
      ).toHaveCount(0, { timeout: 15_000 });
      await expect(
        rowFor(wsAddNames.nuAlpha),
        'WS-57: Not converted must keep the profile that never moved over',
      ).toHaveCount(1);
      await expect(
        movedOnHeader,
        'WS-57: the Moved On column belongs to the Converted side only',
      ).toHaveCount(0);

      // [REAL-UI] the clear (x) on the button drops the filter — both sides come back.
      await page.getByTestId('new-event-19').click();
      await expect(
        rowFor(wsAddNames.nuCharlie),
        'WS-57: clearing the conversion filter restores the converted profile',
      ).toHaveCount(1, { timeout: 15_000 });
      await expect(rowFor(wsAddNames.nuAlpha), 'WS-57: clearing restores the not-converted profile').toHaveCount(1);
    } finally {
      // Restore NU_C however this case ended, so the next spec sees the seeded state.
      await clearConvertedNewUser();
    }
  });

  // ===========================================================================================
  // WS-63 — a WhatsApp send from New Users carries the profileid (2026-10-13)
  //
  // Same mechanism as WDC-14: the WATI config points at an in-browser endpoint with one stubbed template,
  // and the bulk POST to workshopprogressmessage is caught and answered by the test. NU Alpha is the
  // only ticked row, so exactly one participant must be sent, carrying NU Alpha's id.
  // (This screen's mail button for SendmessagesComponent is commented out — mail here goes through the
  // email-campaign composer — so WhatsApp is the SendmessagesComponent path to check.)
  // ===========================================================================================
  test('WS-63 a WhatsApp send from New Users carries the selected profileid', async ({ page }) => {
    await seedWatiConfig();
    try {
      const sent = await captureWorkshopProgressSend(page);
      await loginAsWshopAdmin(page);
      await page.goto('/newusersprofile', { waitUntil: 'domcontentloaded' });
      const row = page.locator(ROW).filter({ hasText: wsAddNames.nuAlpha });
      await expect(row, 'WS-63: the row renders').toHaveCount(1, { timeout: 30_000 });
      await row.locator('mat-checkbox input[type="checkbox"], mat-checkbox').first().click();

      await page.getByTestId('new-toggle-comm-31').click();
      await page.getByTestId('new-send-watti-33').click();
      const composer = page.getByRole('dialog').last();
      await expect(composer.getByRole('heading', { name: 'Send Message' })).toBeVisible({ timeout: 20_000 });
      await pickWatiTemplate(page, composer);
      await composer.getByTestId('sen-send-whats-app-14').click();

      await expect.poll(sent, { message: 'WS-63: the screen posts the bulk WhatsApp send', timeout: 30_000 }).not.toBeNull();
      const body = sent();
      expect(body.type).toBe('whatsapp');
      expect(body.participants, 'WS-63: only the ticked row is sent').toHaveLength(1);
      expect(body.participants[0].profileid, 'WS-63: the participant carries their profileid').toBe(wsAddIds.NU_A);
    } finally {
      await clearWatiConfig();
    }
  });
});
