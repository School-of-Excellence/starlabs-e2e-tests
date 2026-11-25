// arena-video-ask.spec.ts — /createarenavideoasktemplate (content/arena-video-ask-input).
//
// Recon: e2e/recon-allcomp/content.md "Addendum — 2026-09-07" (CN-43 / CN-44).
//
// Reads `event collection` (one-shot, feeds the "Select Event" select — only `name` is used) and streams
// `arenavideoask` into the table (ts:66-88). The Submit path needs a Storage upload and is not driven
// (Risk 16); the row "Active" toggle is the deterministic write: `updateDoc({active})` plus, when turning
// ON, a writeBatch that sets `active:false` on every OTHER row sharing the same `eventref.path`
// (ts:193-220). VA4 lives on a different event and is the negative control for that partition.
//
// 2026-11-25 — the row Edit dialog (CN-47 / CN-48): the pencil opens a dialog pre-filled with THAT row's
// title and description; Cancel writes nothing; Update does `updateDoc({title, description})` on the row's
// `docid` and nothing else (onEdit / onUpdate). VA4 is the negative control: it is never edited.
//
// Hooks: prefix `ava` (content/arena-video-ask-input/arena-video-ask-input.component.html). The Edit hooks
// ava-btn-011 (pencil), ava-inp-013 (title), ava-txt-014 (description), ava-btn-015 (Cancel), ava-btn-016
// (Update) landed with Dharshan's edit option, so the hub-ahead guard skips this file on older app branches.
import { test, expect } from '@playwright/test';
import { contentIds, contentText, installContentStubs, loginAsContentAdmin, resetVideoAskActives, resetVideoAskTexts } from './support/content';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere, getDoc, pollUntil } from '../queue/support/firestore-admin';
import { ROW, openSelect, showAllRows } from './support/ui';

test.describe('Content — /createarenavideoasktemplate (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installContentStubs(page);
    await resetVideoAskActives(); // VA1 on · VA2 on · VA3 OFF · VA4 on (CN-44 mutates these)
    await resetVideoAskTexts();   // seeded titles/descriptions (CN-48 edits VA3; CN-44 finds VA3 by title)
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

  // ===========================================================================================
  // CN-47 — Edit opens with THAT row's title and description; Cancel writes nothing
  // ===========================================================================================
  test("CN-47 Edit shows the row's own title and description, and Cancel changes nothing", async ({ page }) => {
    const before = await getDoc('arenavideoask', contentIds.VA2);
    expect(before!.title, 'CN-47 precondition: VA2 has its seeded title').toBe(contentText.videoAsk(2));

    await showAllRows(page);
    const va2 = page.locator(ROW).filter({ hasText: contentText.videoAsk(2) });
    await expect(va2).toHaveCount(1, { timeout: 30_000 });
    await va2.getByTestId('ava-btn-011').click();

    // [ASSERT] the dialog is pre-filled from the clicked row, not another one.
    await expect(page.getByTestId('ava-inp-013'), 'CN-47: title pre-filled from VA2').toHaveValue(contentText.videoAsk(2));
    await expect(page.getByTestId('ava-txt-014'), 'CN-47: description pre-filled from VA2').toHaveValue('seed video ask');

    // Type something, then Cancel: nothing may reach Firestore.
    await page.getByTestId('ava-inp-013').fill('CN-47 should not be saved');
    await page.getByTestId('ava-txt-014').fill('CN-47 should not be saved either');
    await page.getByTestId('ava-btn-015').click();
    await expect(page.getByTestId('ava-inp-013'), 'CN-47: Cancel closes the dialog').toHaveCount(0);

    const after = await getDoc('arenavideoask', contentIds.VA2);
    expect(after!.title, 'CN-47: Cancel kept the title').toBe(contentText.videoAsk(2));
    expect(after!.description, 'CN-47: Cancel kept the description').toBe('seed video ask');
    await expect(page.locator(ROW).filter({ hasText: 'CN-47 should not be saved' }), 'CN-47: the table shows no unsaved text')
      .toHaveCount(0);
  });

  // ===========================================================================================
  // CN-48 — Update writes the new title and description to that row only
  // ===========================================================================================
  test('CN-48 Update saves the new title and description to that row only', async ({ page }) => {
    const va4Before = await getDoc('arenavideoask', contentIds.VA4);
    const newTitle = `${contentText.videoAsk(3)} edited`;
    const newDescription = 'CN-48 edited description';

    await showAllRows(page);
    const va3 = page.locator(ROW).filter({ hasText: contentText.videoAsk(3) });
    await expect(va3).toHaveCount(1, { timeout: 30_000 });
    await va3.getByTestId('ava-btn-011').click();
    await expect(page.getByTestId('ava-inp-013'), 'CN-48: title pre-filled from VA3').toHaveValue(contentText.videoAsk(3));

    await page.getByTestId('ava-inp-013').fill(newTitle);
    await page.getByTestId('ava-txt-014').fill(newDescription);
    await page.getByTestId('ava-btn-016').click();
    await expect(page.getByTestId('ava-inp-013'), 'CN-48: Update closes the dialog').toHaveCount(0, { timeout: 30_000 });

    // [ASSERT] what the app WROTE on VA3 ...
    const va3After = await pollUntil(() => getDoc('arenavideoask', contentIds.VA3), (d) => d?.title === newTitle,
      { label: 'CN-48: VA3.title == the edited title (app updateDoc)', timeoutMs: 30_000 });
    expect(va3After!.description, 'CN-48: VA3.description saved').toBe(newDescription);
    // ... and only the two edited fields: the rest of the row is as seeded.
    expect(va3After!.active, 'CN-48: VA3.active untouched').toBe(false);
    expect(va3After!.questiontype, 'CN-48: VA3.questiontype untouched').toBe('image');
    expect(va3After!.questionurl, 'CN-48: VA3.questionurl untouched').toBe('https://example.com/q.png');
    // [CONTROL] another row is never edited.
    const va4After = await getDoc('arenavideoask', contentIds.VA4);
    expect(va4After!.title, 'CN-48: VA4 title untouched').toBe(va4Before!.title);
    expect(va4After!.description, 'CN-48: VA4 description untouched').toBe(va4Before!.description);
    // [ASSERT] the table streams the change in.
    const edited = page.locator(ROW).filter({ hasText: newTitle });
    await expect(edited, 'CN-48: the row shows the new title').toHaveCount(1);
    await expect(edited, 'CN-48: the row shows the new description').toContainText(newDescription);
  });
});
