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
});
