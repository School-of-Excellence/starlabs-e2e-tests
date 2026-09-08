// content-upload.spec.ts — /contentupload (content/content-upload, "Home Content").
//
// Recon: e2e/recon-allcomp/content.md "Addendum — 2026-09-07" (CN-32 / CN-33).
//
// The screen streams `content_urls orderBy('added','desc')` with NO availability filter
// (content-upload.component.ts:77-91): an `available:false` doc still renders, only the badge changes.
// Every seeded `added` is a Timestamp because the row template calls `row.added.toDate()` (html:149).
//
// The HLS badge's dblclick fires confirm() and then a GET to the PRODUCTION uploadContentToPublitio
// endpoint (ts:153-157). It is never driven here; the prod firewall (installContentStubs) would abort it
// anyway. Nothing in this file touches Storage.
import { test, expect } from '@playwright/test';
import {
  contentIds, contentText, countStorageRequests, installContentStubs, loginAsContentAdmin, resetContentUrlTitle,
} from './support/content';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere, getDoc, pollUntil, queryWhere } from '../queue/support/firestore-admin';
import { ROW, showAllRows } from './support/ui';

const RUN = process.env.CONT_RUNID || 'cont';

test.describe('Content — /contentupload (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  let storageRequests: () => number;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    storageRequests = countStorageRequests(page);
    await installContentStubs(page);
    await resetContentUrlTitle(); // CU1 title back to the seed value (CN-33 renames it)
    await loginAsContentAdmin(page);
    await page.goto('/contentupload', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/contentupload/, { timeout: 30_000 });
    await expect(page.locator('h1.dash-title', { hasText: 'Content Upload' })).toBeVisible({ timeout: 30_000 });
  });
  test.afterEach(() => assertNoFatal(guard, 'contentupload: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-32 — rows == content_urls count; available:false still renders; newest by `added` is first
  // ===========================================================================================
  test('CN-32 rows == content_urls count, unavailable rows still render, newest first', async ({ page }) => {
    await expect(page.locator(ROW).first()).toBeVisible({ timeout: 30_000 });
    await showAllRows(page);

    const expectedRows = await countWhere('content_urls');
    await expect(page.locator(ROW), 'CN-32: one row per `content_urls` doc (no availability filter)')
      .toHaveCount(expectedRows, { timeout: 30_000 });

    // [ASSERT] the available:false doc is present, and its badge says so.
    const cu2 = page.locator(ROW).filter({ hasText: contentText.content2 });
    await expect(cu2, 'CN-32: the available:false doc is still a row').toHaveCount(1);
    await expect(cu2.locator('span.status-badge.deleted').first(), 'CN-32: available:false renders the "No" badge').toHaveText(/No/);
    const cu1 = page.locator(ROW).filter({ hasText: new RegExp(`${contentText.content1}(?!2)`) });
    await expect(cu1.locator('span.status-badge.active').first(), 'CN-32: available:true renders the "Yes" badge').toHaveText(/Yes/);

    // [ASSERT] ordering: the first rendered row is the doc the Admin SDK calls newest by `added`.
    const newest = await queryWhere('content_urls', [], { orderBy: 'added', orderDir: 'desc', limit: 1 });
    await expect(page.locator(ROW).first().locator('span.c-name'), 'CN-32: orderBy(added desc) — newest doc renders first')
      .toHaveText(new RegExp(String(newest[0].title)));
  });

  // ===========================================================================================
  // CN-33 — metadata-only edit → updateDoc; media fields untouched; ZERO Storage requests
  // ===========================================================================================
  // Edit mode uploads only when the old asset was removed AND a new File was picked (dialog.ts:368-398).
  // Changing just the title takes the pure-Firestore branch; the request counter proves it.
  test('CN-33 editing only the title runs updateDoc and never touches Storage', async ({ page }) => {
    const NEW_TITLE = `EDITED_CONTENT_${RUN}_${Date.now()}`;
    const before = (await getDoc('content_urls', contentIds.CU1))!;

    const row = page.locator(ROW).filter({ hasText: new RegExp(`${contentText.content1}(?!2)`) });
    await expect(row).toHaveCount(1, { timeout: 30_000 });
    await row.locator('button.a-btn.a-edit').click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog.locator('h2.dialog-title', { hasText: 'Edit Content' })).toBeVisible({ timeout: 20_000 });
    // the form is patched inside the taxonomy snapshot callback (dialog.ts:100-141) — wait for it
    const title = dialog.locator('input[formcontrolname="title"]');
    await expect(title).toHaveValue(contentText.content1, { timeout: 20_000 });
    await title.fill(NEW_TITLE);

    // No window.confirm on Update Content — a plain click is correct (confirm() only guards HLS/delete).
    const update = dialog.locator('button.btn-primary', { hasText: 'Update Content' });
    await expect(update, 'CN-33: Update enables (type + publishdate were seeded so myForm is valid)').toBeEnabled({ timeout: 10_000 });
    await update.click();

    const after = await pollUntil(
      () => getDoc('content_urls', contentIds.CU1),
      (d) => d?.title === NEW_TITLE,
      { label: 'CN-33: CU1.title updated by the app', timeoutMs: 30_000 },
    );
    expect(after!.url, 'CN-33: url untouched by a metadata-only edit').toBe(before.url);
    expect(after!.thumbnail, 'CN-33: thumbnail untouched').toBe(before.thumbnail);
    expect(after!.videoSize, 'CN-33: videoSize untouched').toBe(before.videoSize);
    expect(after!.available, 'CN-33: availability untouched').toBe(before.available);
    expect(storageRequests(), 'CN-33: zero requests to Firebase Storage during the edit').toBe(0);
    await expect(page.locator(ROW).filter({ hasText: NEW_TITLE }), 'CN-33: the live table shows the new title').toHaveCount(1, { timeout: 30_000 });
  });
});
