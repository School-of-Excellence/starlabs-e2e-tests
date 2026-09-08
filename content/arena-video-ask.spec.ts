// arena-video-ask.spec.ts — /createarenavideoasktemplate (content/arena-video-ask-input).
//
// Recon: e2e/recon-allcomp/content.md "Addendum — 2026-09-07" (CN-43 / CN-44).
//
// Reads `event collection` (one-shot, feeds the "Select Event" select — only `name` is used) and streams
// `arenavideoask` into the table (ts:66-88). The Submit path needs a Storage upload and is not driven
// (Risk 16); the row "Active" toggle is the deterministic write: `updateDoc({active})` plus, when turning
// ON, a writeBatch that sets `active:false` on every OTHER row sharing the same `eventref.path`
// (ts:193-220). VA4 lives on a different event and is the negative control for that partition.
import { test, expect } from '@playwright/test';
import { contentIds, contentText, installContentStubs, loginAsContentAdmin, resetVideoAskActives } from './support/content';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere, getDoc, pollUntil } from '../queue/support/firestore-admin';
import { ROW, openSelect, showAllRows } from './support/ui';

test.describe('Content — /createarenavideoasktemplate (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installContentStubs(page);
    await resetVideoAskActives(); // VA1 on · VA2 on · VA3 OFF · VA4 on (CN-44 mutates these)
    await loginAsContentAdmin(page);
    await page.goto('/createarenavideoasktemplate', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/createarenavideoasktemplate/, { timeout: 30_000 });
    await expect(page.locator(ROW).first()).toBeVisible({ timeout: 30_000 });
  });
  test.afterEach(() => assertNoFatal(guard, 'arenavideoask: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-43 — event select == events + "None"; rows == arenavideoask count
  // ===========================================================================================
  test('CN-43 the event select offers every event plus None, and rows == arenavideoask count', async ({ page }) => {
    // [ASSERT] select options: one per `event collection` doc + the literal "None" (html:10).
    await openSelect(page, page.locator('mat-form-field').filter({ hasText: 'Select Event' }).locator('mat-select'));
    const options = page.locator('.cdk-overlay-pane mat-option');
    const expectedEvents = await countWhere('event collection');
    await expect(options, 'CN-43: events + None').toHaveCount(expectedEvents + 1);
    await expect(options.filter({ hasText: /^\s*None\s*$/ }), 'CN-43: the None option').toHaveCount(1);
    await page.keyboard.press('Escape');

    // [ASSERT] rows: the table streams the whole collection (default page size is 5 — widen first).
    await showAllRows(page);
    const expectedRows = await countWhere('arenavideoask');
    await expect(page.locator(ROW), 'CN-43: one row per `arenavideoask` doc').toHaveCount(expectedRows, { timeout: 30_000 });
  });

  // ===========================================================================================
  // CN-44 — toggling VA3 ON: updateDoc({active:true}) + batch active:false on its EV1 siblings;
  //          VA4 (EV2) untouched
  // ===========================================================================================
  test('CN-44 turning a row Active deactivates only the siblings on the same event', async ({ page }) => {
    // pre-state (seeded, reset in beforeEach): VA1 on · VA2 on · VA3 off · VA4 on
    expect((await getDoc('arenavideoask', contentIds.VA3))!.active, 'CN-44: VA3 starts inactive').toBe(false);
    expect((await getDoc('arenavideoask', contentIds.VA4))!.active, 'CN-44: VA4 starts active').toBe(true);

    await showAllRows(page);
    const va3 = page.locator(ROW).filter({ hasText: contentText.videoAsk(3) });
    await expect(va3).toHaveCount(1, { timeout: 30_000 });
    // No confirm() on the toggle path (ts:193-201) — a plain click is correct.
    await va3.locator('td.mat-column-active mat-slide-toggle').click();

    // [ASSERT] the row's own updateDoc …
    await pollUntil(() => getDoc('arenavideoask', contentIds.VA3), (d) => d?.active === true,
      { label: 'CN-44: VA3.active == true (app updateDoc)', timeoutMs: 30_000 });
    // … and the sibling batch (updateVideoAskDocUnActive, ts:203-220) on the SAME eventref.path
    await pollUntil(() => getDoc('arenavideoask', contentIds.VA1), (d) => d?.active === false,
      { label: 'CN-44: VA1 deactivated by the sibling batch', timeoutMs: 30_000 });
    await pollUntil(() => getDoc('arenavideoask', contentIds.VA2), (d) => d?.active === false,
      { label: 'CN-44: VA2 deactivated by the sibling batch', timeoutMs: 30_000 });
    // [CONTROL] a different event's row is outside the partition
    expect((await getDoc('arenavideoask', contentIds.VA4))!.active, 'CN-44: VA4 (EV2) untouched').toBe(true);
  });
});
