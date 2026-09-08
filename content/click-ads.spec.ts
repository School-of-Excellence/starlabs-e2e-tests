// click-ads.spec.ts — /ads (content/click-ads).
//
// Recon: e2e/recon-allcomp/content.md "Addendum — 2026-09-07" (CN-26 / CN-27). CORRECTS the original
// recon's Risk #1 / CN-18: the ClickAdsComponent class is LIVE (click-ads.component.ts:118); lines 1-82
// are an old commented copy. The route renders a working table + dialog, not an empty shell.
//
// The screen streams the whole `ads` collection with NO client filter — a `delete:true` doc still renders,
// only its badge changes (html:196-198). So the honest read assertion is "rows == Admin count" plus the
// badge per seeded flag, not a hidden-row negative control.
import { test, expect } from '@playwright/test';
import { contentText, deleteCreatedAd, installContentStubs, loginAsContentAdmin } from './support/content';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere, pollUntil, queryWhere } from '../queue/support/firestore-admin';
import { ROW, openSelect, showAllRows } from './support/ui';

const RUN = process.env.CONT_RUNID || 'cont';

test.describe('Content — /ads click-ads (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installContentStubs(page);
    await loginAsContentAdmin(page);
    await page.goto('/ads', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/ads$/, { timeout: 30_000 });
    await expect(page.locator('h1.dash-title', { hasText: 'Click Ads' })).toBeVisible({ timeout: 30_000 });
  });
  test.afterEach(() => assertNoFatal(guard, 'ads: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-26 — rows == `ads` count; the soft-deleted ad still renders, badge "Deleted"
  // ===========================================================================================
  test('CN-26 rows == ads count and the delete flag only changes the badge', async ({ page }) => {
    await expect(page.locator(ROW).first()).toBeVisible({ timeout: 30_000 });
    await showAllRows(page);

    const expectedRows = await countWhere('ads');
    await expect(page.locator(ROW), 'CN-26: one row per `ads` doc (no client filter, deleted included)')
      .toHaveCount(expectedRows, { timeout: 30_000 });

    const deleted = page.locator(ROW).filter({ hasText: contentText.ctaDeleted });
    await expect(deleted, 'CN-26: the delete:true ad is still a row').toHaveCount(1);
    await expect(deleted.locator('span.status-badge.deleted'), 'CN-26: delete:true renders the Deleted badge').toHaveText(/Deleted/);

    const active = page.locator(ROW).filter({ hasText: contentText.ctaActive });
    await expect(active, 'CN-26: the live ad renders').toHaveCount(1);
    await expect(active.locator('span.status-badge.active'), 'CN-26: delete:false renders the Active badge').toHaveText(/Active/);
  });

  // ===========================================================================================
  // CN-27 — Create Ad (no image slots) → setDoc(ads/{auto}, {...form, docid, image: {}})
  // ===========================================================================================
  // No image slot is added on purpose: the dialog's Storage path (uploadBytes per slot, update-ads.ts:
  // 459-472) is not what this case is about, and zero slots is a valid submission (`image: {}`).
  test('CN-27 Create Ad writes an ads doc with docid == doc id and an empty image map', async ({ page }) => {
    const CTA = `NEW_CTA_${RUN}_${Date.now()}`;
    await deleteCreatedAd(CTA);
    expect(await countWhere('ads', [['calltoaction', '==', CTA]]), 'CN-27: CTA unused pre-submit').toBe(0);

    await page.locator('button.btn-primary', { hasText: 'New Ad' }).click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText('Create New Ad')).toBeVisible();

    // required controls (update-ads.component.ts:309-318): calltoaction, displayscreen, startdate, enddate
    await dialog.locator('input[formcontrolname="calltoaction"]').fill(CTA);
    await dialog.locator('input[formcontrolname="paymentlink"]').fill('https://example.com/pay');
    await openSelect(page, dialog.locator('mat-select[formcontrolname="displayscreen"]'));
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: /home/i }).first().click();
    // the date-range inputs accept typed dates (NativeDateAdapter parses via Date.parse)
    const today = new Date(); const later = new Date(Date.now() + 7 * 86400e3);
    const us = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    await dialog.locator('input[formcontrolname="startdate"]').fill(us(today));
    await dialog.locator('input[formcontrolname="enddate"]').fill(us(later));
    await dialog.locator('input[formcontrolname="enddate"]').press('Tab');

    const create = dialog.locator('button', { hasText: /^Create Ad$/ });
    await expect(create, 'CN-27: Create Ad enables once the reactive form is valid').toBeEnabled({ timeout: 20_000 });
    await create.click();

    // [ASSERT] the app-written doc: docid stamped from the auto id, image map empty, Timestamp dates.
    const docs = await pollUntil(
      () => queryWhere('ads', [['calltoaction', '==', CTA]]),
      (rows) => rows.length === 1,
      { label: `CN-27: one ad with calltoaction ${CTA}`, timeoutMs: 30_000 },
    );
    const d = docs[0] as any;
    expect(d.docid, 'CN-27: docid == doc id (update-ads.ts:438-442)').toBe(docs[0].id);
    expect(d.image, 'CN-27: no slots → empty image map').toEqual({});
    expect(typeof d.startdate?.toMillis, 'CN-27: startdate stored as a Timestamp').toBe('function');
    expect(typeof d.enddate?.toMillis, 'CN-27: enddate stored as a Timestamp').toBe('function');
    expect(d.delete, 'CN-27: a new ad is not deleted').toBe(false);

    // the live table shows it as Active
    await expect(page.locator(ROW).filter({ hasText: CTA }).locator('span.status-badge.active')).toHaveText(/Active/, { timeout: 30_000 });
    await deleteCreatedAd(CTA); // tidy the app-created doc
  });
});
