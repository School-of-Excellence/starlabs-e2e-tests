// content-upload-v2.spec.ts — /content-upload-v2 (the "Content Home" v2 shell) and its dead nested child.
//
// Recon: e2e/recon-allcomp/content.md "Addendum — 2026-09-07" (CN-19 / CN-20).
//
// The shell reads FIVE collections, each `orderBy(<dateField>,'desc') limit(1)`, and renders one "latest
// item" card per collection (content-upload-version2.component.ts:71-104). CN-19 asks the Admin SDK the
// same question independently and compares — two readers of the same "latest", neither written by the test.
//
// CN-20 pins a route that cannot work: `/content-upload-v2/playlistdashboard/add-playlist` loads
// PlaylistConfigurationComponent, which injects MatDialogRef + MAT_DIALOG_DATA without @Optional
// (playlist-configuration.component.ts:89-90). Routing to it throws NullInjectorError. `test.fail()` keeps
// CI green while the defect stands and flips to "expected to fail, but passed" the day it is fixed.
import { test, expect } from '@playwright/test';
import { installContentStubs, loginAsContentAdmin } from './support/content';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { queryWhere } from '../queue/support/firestore-admin';

/** The shell's screens[] (ts:32-38): key → [collection, orderBy field, the field the card shows]. */
const CARDS: Array<[key: string, collection: string, dateField: string, titleField: string]> = [
  ['solar', 'solar voice audios', 'date', 'name'],
  ['episodes', 'episodes', 'date', 'title'],
  ['health', 'health stories', 'date', 'subject'],
  ['home', 'content_urls', 'added', 'title'],
];

test.describe('Content — /content-upload-v2 shell (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installContentStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'content-upload-v2: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-19 — every status card shows the NEWEST doc of its collection (app orderBy-desc-limit-1)
  // ===========================================================================================
  test('CN-19 the five status cards show the newest item of each collection', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/content-upload-v2', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/content-upload-v2$/, { timeout: 30_000 });

    // The shell only shows its cards when router.url === '/content-upload-v2' exactly (ts:63-65).
    await expect(page.locator('.card'), 'CN-19: five screen cards render').toHaveCount(5, { timeout: 30_000 });

    for (const [key, collection, dateField, titleField] of CARDS) {
      // [INDEPENDENT] the Admin SDK's answer to "newest doc of this collection".
      const latest = await queryWhere(collection, [], { orderBy: dateField, orderDir: 'desc', limit: 1 });
      expect(latest.length, `CN-19: ${collection} has at least one doc (seeded)`).toBe(1);
      const expected = String(latest[0][titleField] ?? '');
      expect(expected, `CN-19: ${collection} newest doc carries a ${titleField}`).not.toBe('');

      // [REAL-UI] the card the app rendered for this screen key (icon class is `icon-<key>`, html:263-302).
      const card = page.locator('.card').filter({ has: page.locator(`.icon-${key}`) });
      await expect(card, `CN-19: a card for "${key}" renders`).toHaveCount(1);
      await expect(
        card.locator('.card-item'),
        `CN-19: the "${key}" card shows the newest ${collection} doc's ${titleField} (${expected})`,
      ).toContainText(expected, { timeout: 30_000 });
      await expect(card.locator('.card-date'), `CN-19: the "${key}" card shows a date, not the empty state`)
        .not.toHaveText(/No data available/);
    }

    // The ads card has no title-ish field (ads docs carry calltoaction, not title/name/subject), so only
    // the date line is asserted: the seed wrote a Timestamp startdate, so the empty state must not show.
    const ads = page.locator('.card').filter({ has: page.locator('.icon-ads') });
    await expect(ads, 'CN-19: the ads card renders').toHaveCount(1);
    await expect(ads.locator('.card-date'), 'CN-19: the ads card found the newest ad by startdate')
      .not.toHaveText(/No data available/, { timeout: 30_000 });
  });
});

test.describe('Content — /content-upload-v2 nested child route (pinned defect)', () => {
  // No console guard here on purpose: the NullInjectorError this case pins IS a pageerror, and the point
  // of the case is the missing screen, not the console.
  test.beforeEach(async ({ page }) => { await installContentStubs(page); });

  // ===========================================================================================
  // CN-20 — THE GAP: the shell-only playlist-configuration route cannot mount
  // ===========================================================================================
  // EXPECTED TO FAIL TODAY. PlaylistConfigurationComponent is a dialog (opened by /playlistdashboard's
  // "New Playlist" / row edit) that also got declared as a route child of the v2 shell. It injects
  // MatDialogRef and MAT_DIALOG_DATA unconditionally, so the router cannot construct it. Remove the
  // test.fail() once the component takes those injections as @Optional() (or the route is deleted).
  test('CN-20 /content-upload-v2/playlistdashboard/add-playlist must mount the Create Playlist form', async ({ page }) => {
    test.fail(
      true,
      'KNOWN DEFECT (recon-allcomp/content.md → Addendum 2026-09-07): PlaylistConfigurationComponent '
      + 'injects MatDialogRef/MAT_DIALOG_DATA non-optionally (playlist-configuration.component.ts:89-90); '
      + 'routing to it throws NullInjectorError. Remove this test.fail() when the route can render.',
    );
    await loginAsContentAdmin(page);
    await page.goto('/content-upload-v2/playlistdashboard/add-playlist', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/playlistdashboard\/add-playlist/, { timeout: 30_000 });
    await expect(
      page.locator('h1.dash-title', { hasText: 'Create Playlist' }),
      'CN-20: the Create Playlist form must render inside the v2 shell',
    ).toBeVisible({ timeout: 15_000 });
  });
});
