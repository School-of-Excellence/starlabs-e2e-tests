// playlist-edit.spec.ts — /playlistdashboard/edit-playlist?id=<id> (content/playlist-dashboard/edit).
//
// Recon: e2e/recon-allcomp/content.md "Addendum — 2026-09-07" (CN-37 / CN-38 / CN-39).
//
// Reachable by URL only: the dashboard's edit action now opens a dialog and its old navigateByUrl to this
// route is commented out (playlist-dashboard.component.ts:110-122). The parent keeps a <router-outlet>
// and hides its own table while the URL contains `edit-playlist` (ts:79-89), so the child DOES render.
//
// The screen keys its audio lookup on the data field `id` (edit.component.ts:90-94) — the seed writes
// `id == doc.id` on every audio for exactly this reason. Pre-selection happens in ngAferViewInit (sic,
// ts:153-166): one checked row per `sequence` ref that resolves.
import { test, expect } from '@playwright/test';
import { contentIds, contentText, installContentStubs, loginAsContentAdmin, resetPlaylistEdit } from './support/content';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil } from '../queue/support/firestore-admin';
import { ROW } from './support/ui';

const RUN = process.env.CONT_RUNID || 'cont';
const refId = (r: any): string => r?.id || r?._path?.segments?.slice(-1)[0] || '';

/** Rename PLAY2 through the form and press Update. The duplicate check compares the typed name against
 *  EVERY playlist including PLAY2's own (edit.component.ts:218-223), so an unchanged name keeps Update
 *  disabled — the rename is what makes the write reachable. */
async function renameAndUpdate(page: import('@playwright/test').Page, newName: string) {
  const name = page.locator('input[name="playlistName"]');
  await expect(name).toHaveValue(contentText.playlist2, { timeout: 30_000 });
  await expect(page.locator(ROW).first()).toBeVisible({ timeout: 30_000 });
  await name.fill(newName);
  const update = page.getByRole('button', { name: /^Update$/ });
  await expect(update, 'Update enables once the name is unique and rows are selected').toBeEnabled({ timeout: 20_000 });
  await update.click(); // no window.confirm on this path (edit.component.ts:190-212)
  return pollUntil(
    () => getDoc('solar voice playlist', contentIds.PLAY2),
    (d) => d?.name === newName,
    { label: `PLAY2.name == ${newName} (app setDoc)`, timeoutMs: 30_000 },
  );
}

test.describe('Content — /playlistdashboard/edit-playlist (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installContentStubs(page);
    await resetPlaylistEdit(); // PLAY2 back to its seed-time shape (CN-38/39 mutate it)
    await loginAsContentAdmin(page);
    await page.goto(`/playlistdashboard/edit-playlist?id=${contentIds.PLAY2}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/edit-playlist/, { timeout: 30_000 });
  });
  test.afterEach(() => assertNoFatal(guard, 'edit-playlist: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-37 — the form patches from the doc and pre-checks exactly sequence.length rows
  // ===========================================================================================
  test('CN-37 the edit form patches name/description and pre-checks exactly the sequence audios', async ({ page }) => {
    await expect(page.locator('input[name="playlistName"]'), 'CN-37: name patched from the doc')
      .toHaveValue(contentText.playlist2, { timeout: 30_000 });
    await expect(page.locator('input[name="description"]'), 'CN-37: description patched from the doc')
      .toHaveValue(/seed playlist 2/);

    // [INDEPENDENT] how many refs the doc's sequence holds.
    const doc = await getDoc('solar voice playlist', contentIds.PLAY2);
    const seqLen = (doc!.sequence as unknown[]).length;
    expect(seqLen, 'CN-37: the seed wrote 3 refs').toBe(3);

    // Narrow the audio table to THIS run's audios so the checked-row count is deterministic, then count
    // the rows the app pre-selected. All 3 must be checked, none unchecked.
    await page.getByPlaceholder('Search').first().fill(contentText.audioNamePrefix);
    const rows = page.locator(ROW).filter({ hasText: contentText.audioNamePrefix });
    await expect(rows, 'CN-37: the 3 run-scoped audios are listed').toHaveCount(3, { timeout: 30_000 });
    await expect(rows.locator('mat-checkbox.mat-mdc-checkbox-checked'), 'CN-37: every sequence audio is pre-checked (ts:153-166)')
      .toHaveCount(seqLen);
    // and the preview list mirrors the selection
    await expect(page.locator('.list .box'), 'CN-37: the preview holds one box per selected audio').toHaveCount(seqLen);
  });

  // ===========================================================================================
  // CN-38 — Update (renamed) → setDoc: name new, sequence == the 3 seeded audio refs, tags preserved
  // ===========================================================================================
  test('CN-38 Update rewrites the doc with the new name, the selected audio refs and the tags', async ({ page }) => {
    const NEW_NAME = `EDITED_PLAYLIST_${RUN}_${Date.now()}`;
    const before = (await getDoc('solar voice playlist', contentIds.PLAY2))!;
    const after = await renameAndUpdate(page, NEW_NAME);

    expect(after!.id, 'CN-38: id == doc id (edit.component.ts:199)').toBe(contentIds.PLAY2);
    expect((after!.sequence as any[]).map(refId).sort(), 'CN-38: sequence rebuilt from the pre-checked rows')
      .toEqual([contentIds.AUD1, contentIds.AUD2, contentIds.AUD3].sort());
    expect(after!.tags, 'CN-38: tags carried through the overwrite').toEqual(before.tags);
    expect(after!.private, 'CN-38: private flag carried through').toBe(before.private);
  });

  // ===========================================================================================
  // CN-39 — THE GAP: Update must preserve imageurl (the payload omits it → full-overwrite drops it)
  // ===========================================================================================
  // EXPECTED TO FAIL TODAY. onSubmit's setDoc payload (edit.component.ts:198-207) has no `imageurl`, and
  // setDoc without {merge:true} replaces the whole document, so the playlist loses its image on every
  // edit. Remove the test.fail() once the payload carries imageurl (or the write becomes a merge).
  test('CN-39 Update must preserve the playlist imageurl', async ({ page }) => {
    test.fail(
      true,
      'KNOWN DEFECT (recon-allcomp/content.md → Addendum 2026-09-07, Risk 13): edit.component.ts:198-207 '
      + 'setDoc()s a payload without imageurl, wiping it. Remove this test.fail() when the field survives.',
    );
    const before = (await getDoc('solar voice playlist', contentIds.PLAY2))!;
    expect(before.imageurl, 'CN-39: the seed gave PLAY2 an imageurl').toBeTruthy();
    const after = await renameAndUpdate(page, `EDITED_PLAYLIST_IMG_${RUN}_${Date.now()}`);
    expect(after!.imageurl, 'CN-39: imageurl must survive an Update').toBe(before.imageurl);
  });
});
