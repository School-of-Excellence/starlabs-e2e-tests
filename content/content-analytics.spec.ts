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
import { analyticsDupProfile, installContentStubs, loginAsContentAdmin, resetAnalyticsDuplicates } from './support/content';
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
