// edit-atc-templates.spec.ts — /editATC 2026-10-23 changes (EATT-01..05), EMULATOR ONLY.
//
// Hook prefix: eatc (EditAtcComponent); the preview dialog it opens uses pabs, the draft picker atco, the directive
// editor dbu.
// Plan: starlabs-angular specs/plans/2026-10-23-atc-overnight-goal.md (Edit takes the Prescribe design + the
// prototypes' Edit screen: header, read-only top card, directive → Ask/Outcomes order, required Ask/Outcomes,
// save checks author → directive → ask/outcomes, "Update changes in ATC" panel with the version line,
// change-agent inheritance in new adjustments, AI section content rule).
//
// Each case edits its OWN seeded ATC (seed-atc.js phase 4: tea / tel / tew / teb / tvv) because a save upgrades
// the ATC. Assertions read back the NEW version the app wrote (found by editedfrom → old) and compare it with what
// the test typed — never a value the test wrote.
import { test, expect, Page, Locator } from '@playwright/test';
import {
  PF, NAME, ACT, PROC_NAME, RUN, TPL, TPL_MODEL, TPL_DIRECTIVE, TPL_ASKS, TPL_OUTCOMES,
  installAtcGuards, assertNoRealDb, loginAsAtc, atcDb, atcDoc, waitFor, pickOptions, selectText, tid, AtcGuard,
  EMAIL,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

async function openEdit(page: Page, id: string, signIn = true) {
  if (signIn) await loginAsAtc(page, 'admin');      // a signed-in page sent to '/' skips the login form
  await page.goto(`/editATC/${id}/alpha`);
  await expect(page.locator(tid('eatc-exadj-0'))).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('eatc-loading')).toHaveCount(0, { timeout: 30_000 });
}
async function topOf(l: Locator): Promise<number> {
  const box = await l.boundingBox();
  if (!box) throw new Error('element not rendered');
  return box.y;
}
const snack = (page: Page, text: string | RegExp) => page.locator('mat-snack-bar-container').filter({ hasText: text });
async function expectBlocked(page: Page, message: string) {
  await page.getByTestId('eatc-submit').click();
  await expect(page.getByTestId('eatc-panel-error'), `panel: ${message}`).toContainText(message, { timeout: 15_000 });
  await expect(snack(page, message)).toBeVisible();
  await expect(page.getByTestId('pabs-submit'), 'blocked: no preview').toHaveCount(0);
}
async function waitDraftSaved(page: Page) {
  await expect(page.getByTestId('eatc-draft-status')).toHaveText(/Draft saved\./, { timeout: 30_000 });
}
/** The new version the app wrote (found by editedfrom → old). */
async function newVersionOf(oldId: string) {
  return waitFor(async () => {
    const s = await atcDb().collection('atc_alpha').get();
    return s.docs.find((d) => d.data().editedfrom?.id === oldId) || null;
  }, `new version of ${oldId}`);
}
async function confirmSave(page: Page, guard: AtcGuard) {
  await page.getByTestId('pabs-submit').click();
  await expect.poll(() => guard.dialogs.some((m) => /Updated Successfully/.test(m)), { message: 'save confirmed by the app', timeout: 60_000 }).toBe(true);
}
/** A second device: add a review on the ATC through View Prescribed (as admin). */
async function addReviewInView(browser: any, atcId: string, text: string) {
  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const p = await ctx.newPage();
  const g = await installAtcGuards(p);
  await loginAsAtc(p, 'admin');
  await p.goto('/viewprescribedATC');
  await expect(p.getByTestId('vatc-count')).toBeVisible({ timeout: 45_000 });
  await pickOptions(p, p.getByTestId('vatc-filter-participant'), [NAME.trl]);
  const r = p.locator(tid(`vatc-row-${atcId}`));
  await expect(r).toBeVisible({ timeout: 45_000 });
  await r.getByTestId('vatc-toggle-full').click();
  await r.getByTestId('vatc-review-text').fill(text);
  await r.getByTestId('vatc-review-add').click();
  await waitFor(async () => ((await atcDoc(`atc_alpha/${atcId}`))?.reviewlog || []).some((x: any) => x.note === text), `review "${text}" written`);
  assertNoRealDb(g);
  await ctx.close();
}
const newadj = (page: Page, i: number) => page.locator(tid(`eatc-newadj-${i}`));
const newproc = (page: Page, i: number, j: number) => newadj(page, i).locator(tid(`eatc-newproc-${j}`));
const caOf = (page: Page, i: number, j: number) => newproc(page, i, j).locator(tid(`eatc-proc-assigned-${ACT.ca}`));

test.describe('ATC — Edit ATC 2026-10-23: Prescribe design, Ask / WiSH outcomes, version panel (emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'edit atc templates: no fatal console errors');
  });

  test('EATT-01 EI Solution: layout + order, saved asks load, edits kept in the draft, preview + new version carry `ask`', async ({ page }) => {
    await openEdit(page, TPL.eEI);
    // header + read-only top card
    await expect(page.getByTestId('eatc-back')).toHaveText(/Prescribed ATC/);
    await expect(page.locator('.header-title')).toHaveText('Edit prescribed ATC');
    await expect(page.getByTestId('eatc-participant')).toHaveText(NAME.tea);
    await expect(page.getByTestId('eatc-product')).toHaveText(TPL_MODEL.ei);
    // directive → Ask → Authors; no WiSH card; not an AI ATC → no AI section
    expect(await topOf(page.locator('#atcfield-directive'))).toBeLessThan(await topOf(page.getByTestId('eatc-ask-card')));
    expect(await topOf(page.getByTestId('eatc-ask-card'))).toBeLessThan(await topOf(page.locator('#atcfield-author')));
    await expect(page.getByTestId('eatc-outcome-card')).toHaveCount(0);
    await expect(page.getByTestId('eatc-ai-section')).toHaveCount(0);
    await expect(page.getByTestId('eatc-directive-text')).toHaveText(TPL_DIRECTIVE.ei);
    await expect(page.getByTestId('eatc-directive-btn')).toHaveText(/Update Directive/);
    // the directive text opens the same editor as the button; Cancel leaves it unchanged
    await page.getByTestId('eatc-directive-open').click();
    await expect(page.getByTestId('dbu-textarea')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('dbu-cancel').click();
    await expect(page.getByTestId('dbu-textarea')).toHaveCount(0);
    await expect(page.getByTestId('eatc-directive-text')).toHaveText(TPL_DIRECTIVE.ei);
    // the saved asks
    await expect(page.getByTestId('eatc-ask-card')).toContainText('At least one complete ask is required.');
    await expect(page.getByTestId('eatc-ask-by')).toHaveCount(2);
    expect(await selectText(page.getByTestId('eatc-ask-by').nth(0))).toBe('Self');
    await expect(page.getByTestId('eatc-ask-for').nth(0)).toHaveValue(TPL_ASKS[0].askedfor);
    await expect(page.getByTestId('eatc-ask-count')).toHaveText('2 complete');
    // the panel
    await expect(page.getByTestId('eatc-summary-line')).toHaveText('0 edited, 0 deleted and 0 new adjustments. Change agents: none.');
    await expect(page.getByTestId('eatc-version-line')).toHaveText('Saving creates version 2. The current version is kept and hidden from the participant.');
    await expect(page.getByTestId('eatc-cancel')).toBeVisible();

    // edit: change one, add one complete + one empty row
    await page.getByTestId('eatc-ask-for').nth(1).fill(`  Calmer evenings and weekends ${RUN} `);
    await page.getByTestId('eatc-ask-for').nth(1).blur();
    await page.getByTestId('eatc-ask-add').click();
    await pickOptions(page, page.getByTestId('eatc-ask-by').nth(2), ['Family'], false);
    await page.getByTestId('eatc-ask-for').nth(2).fill(`More patience ${RUN}`);
    await page.getByTestId('eatc-ask-for').nth(2).blur();
    await page.getByTestId('eatc-ask-add').click();
    await expect(page.getByTestId('eatc-ask-by')).toHaveCount(4);
    await expect(page.getByTestId('eatc-ask-count')).toHaveText('3 complete');
    // the empty fourth row goes again (remove → saves)
    await page.getByTestId('eatc-ask-remove').nth(3).click();
    await expect(page.getByTestId('eatc-ask-by')).toHaveCount(3);
    // (adding an empty row does not save by itself — the draft holds the rows as of the last save, here the typed third)
    await waitDraftSaved(page);
    const draftAsks = await waitFor(async () => { const a = (await atcDoc(`temporary_edit_ATC/${TPL.eEI}`))?.ask || []; return a.length === 3 ? a : null; }, 'edit draft with the three typed rows');
    expect(draftAsks[1].askedfor, 'the draft keeps the row as typed (not trimmed)').toBe(`  Calmer evenings and weekends ${RUN} `);

    // preview shows what will be saved, then the new version holds the complete rows
    await page.getByTestId('eatc-submit').click();
    await expect(page.getByTestId('pabs-ask')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('pabs-ask-row')).toHaveCount(3);
    await expect(page.getByTestId('pabs-ask-row').nth(2)).toContainText('Family');
    await expect(page.getByTestId('pabs-outcomes')).toHaveCount(0);
    await confirmSave(page, guard);
    const v = await newVersionOf(TPL.eEI);
    expect(v.data().ask, 'complete rows only, trimmed').toEqual([
      TPL_ASKS[0],
      { askedby: 'spouse', askedfor: `Calmer evenings and weekends ${RUN}` },
      { askedby: 'family', askedfor: `More patience ${RUN}` },
    ]);
    expect(v.data().product).toBe(TPL_MODEL.ei);
  });

  test('EATT-02 an older EI ATC: checks run author → directive → ask; the ask is required; then it saves', async ({ page }) => {
    await openEdit(page, TPL.eLegacy);
    await expect(page.getByTestId('eatc-directive-placeholder')).toHaveText(/Directive not provided/);
    await expect(page.getByTestId('eatc-ask-by'), 'one empty row to start').toHaveCount(1);
    await expect(page.getByTestId('eatc-ask-count')).toHaveText('0 complete');

    // author first: take the author away → that is the first thing reported (although the directive is missing too)
    await pickOptions(page, page.locator(tid(`eatc-person-${ACT.author}`)), [NAME.admin]);   // toggles admin off
    await expectBlocked(page, 'Choose the author names');
    await pickOptions(page, page.locator(tid(`eatc-person-${ACT.author}`)), [NAME.admin]);   // back on
    // then the directive
    await expectBlocked(page, 'Provide ATC directive');
    await page.getByTestId('eatc-directive-placeholder').click();                            // the empty state opens the editor
    await page.getByTestId('dbu-textarea').fill(`EATT-02 directive ${RUN}`);
    await page.getByTestId('dbu-submit').click();
    await expect(page.getByTestId('eatc-directive-text')).toHaveText(`EATT-02 directive ${RUN}`);
    // then the ask
    await expectBlocked(page, 'At least one complete ask is required');
    await pickOptions(page, page.getByTestId('eatc-ask-by').nth(0), ['Sponsors'], false);
    await expectBlocked(page, 'Fill both asked by and asked for');
    expect((await atcDb().collection('atc_alpha').get()).docs.some((d) => d.data().editedfrom?.id === TPL.eLegacy), 'nothing written while blocked').toBe(false);

    await page.getByTestId('eatc-ask-for').nth(0).fill(`Grow the business ${RUN}`);
    await page.getByTestId('eatc-ask-for').nth(0).blur();
    await page.getByTestId('eatc-submit').click();
    await expect(page.getByTestId('pabs-ask-row')).toHaveCount(1, { timeout: 30_000 });
    await confirmSave(page, guard);
    const v = await newVersionOf(TPL.eLegacy);
    expect(v.data().ask).toEqual([{ askedby: 'sponsors', askedfor: `Grow the business ${RUN}` }]);
    expect(v.data().directive).toBe(`EATT-02 directive ${RUN}`);
  });

  test('EATT-03 WiSH: immediate-outcome look, outcomes load + edit, version 3 from the chain, AI areas only, `outcomes` saved', async ({ page }) => {
    await openEdit(page, TPL.eWish);
    const directive = page.locator('#atcfield-directive');
    await expect(directive).toContainText('IMMEDIATE OUTCOME EXPECTED FROM WiSH');
    await expect(page.getByTestId('eatc-directive-text')).toHaveText(TPL_DIRECTIVE.wish);
    await expect(page.getByTestId('eatc-directive-btn')).toHaveText(/Edit Immediate Outcome/);
    const card = page.getByTestId('eatc-outcome-card');
    expect(await topOf(directive)).toBeLessThan(await topOf(card));
    await expect(page.getByTestId('eatc-ask-card')).toHaveCount(0);
    await expect(card).toContainText('At least one complete row is required.');
    await expect(page.getByTestId('eatc-outcome-area'), 'the two saved rows, not five empty ones').toHaveCount(2);
    await expect(page.getByTestId('eatc-outcome-area').nth(0)).toHaveValue(TPL_OUTCOMES[0].outcomearea);
    await expect(page.getByTestId('eatc-outcome-count')).toHaveText('2 filled');
    // one earlier version on the chain → this save makes version 3
    await expect(page.getByTestId('eatc-version-line')).toHaveText(/^Saving creates version 3\./, { timeout: 15_000 });
    // the AI gave areas but no summary → only "Areas to explore"
    await expect(page.getByTestId('eatc-ai-section')).toBeVisible();
    await expect(page.getByTestId('eatc-ai-areas')).toContainText('Sleep');
    await expect(page.getByTestId('eatc-ai-summary')).toHaveCount(0);

    // a half-filled row blocks; remove it; drop the second saved row; change the first
    await page.getByTestId('eatc-outcome-add').click();
    await page.getByTestId('eatc-outcome-area').nth(2).fill('Half row');
    await page.getByTestId('eatc-outcome-area').nth(2).blur();
    await expectBlocked(page, 'Fill both outcome area and outcomes expected');
    await page.getByTestId('eatc-outcome-remove').nth(2).click();
    await page.getByTestId('eatc-outcome-remove').nth(1).click();
    await page.getByTestId('eatc-outcome-expected').nth(0).fill(`Run 10K by June ${RUN}`);
    await page.getByTestId('eatc-outcome-expected').nth(0).blur();
    await expect(page.getByTestId('eatc-outcome-count')).toHaveText('1 filled');

    await page.getByTestId('eatc-submit').click();
    await expect(page.getByTestId('pabs-outcomes')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('pabs-outcome-row')).toHaveCount(1);
    await expect(page.locator('mat-dialog-container .section-title').first(), 'preview names the WiSH directive').toHaveText('Immediate outcome');
    await confirmSave(page, guard);
    const v = await newVersionOf(TPL.eWish);
    expect(v.data().outcomes).toEqual([{ outcomearea: TPL_OUTCOMES[0].outcomearea, outcomeexpected: `Run 10K by June ${RUN}` }]);
    expect(v.data().editedfrom.id).toBe(TPL.eWish);
  });

  test('EATT-04 new adjustments: a procedure chosen after "Apply to all" inherits the change agent, a manual pick is kept, it survives a reopen', async ({ page, browser }) => {
    await openEdit(page, TPL.eBulk);
    await page.getByTestId('eatc-newadj-add').click();
    const a = newadj(page, 0);
    await a.getByTestId('eatc-newadj-text').fill(`EATT-04 new adjustment ${RUN}`);
    await a.getByTestId('eatc-newadj-text').blur();
    await pickOptions(page, a.getByTestId('eatc-newadj-awareness'), [/^\s*Aware\s*$/], false);
    await a.getByTestId('eatc-newadj-years').fill('4');
    await pickOptions(page, newproc(page, 0, 0).getByTestId('eatc-proc-name'), [PROC_NAME.one], false);

    await pickOptions(page, page.locator(tid(`eatc-bulk-select-${ACT.ca}`)), [NAME.agent1]);
    await page.locator(tid(`eatc-bulk-apply-${ACT.ca}`)).click();
    await expect.poll(() => selectText(caOf(page, 0, 0))).toBe(NAME.agent1);

    // a new procedure row is empty until its changework is chosen — then it inherits
    await newproc(page, 0, 0).getByTestId('eatc-newproc-add').click();
    await expect(caOf(page, 0, 1)).toBeVisible({ timeout: 15_000 });
    expect(await selectText(caOf(page, 0, 1))).toBe('');
    await pickOptions(page, newproc(page, 0, 1).getByTestId('eatc-proc-name'), [PROC_NAME.two], false);
    await expect.poll(() => selectText(caOf(page, 0, 1)), { message: 'inherits the applied agent' }).toBe(NAME.agent1);
    // a manual pick made before choosing the changework is kept
    await newproc(page, 0, 1).getByTestId('eatc-newproc-add').click();
    await expect(caOf(page, 0, 2), 'the new row is drawn before its picker is used').toBeVisible({ timeout: 15_000 });
    await pickOptions(page, caOf(page, 0, 2), [NAME.agent2]);
    await pickOptions(page, newproc(page, 0, 2).getByTestId('eatc-proc-name'), [PROC_NAME.one], false);
    await page.waitForTimeout(500);
    expect(await selectText(caOf(page, 0, 2))).toBe(NAME.agent2);
    await expect(page.getByTestId('eatc-summary-line')).toHaveText(`0 edited, 0 deleted and 1 new adjustments. Change agents: ${NAME.agent1}.`);

    await waitDraftSaved(page);
    await waitFor(async () => ((await atcDoc(`temporary_edit_ATC/${TPL.eBulk}`))?.bulkapplied?.[ACT.ca] || []).length === 1, 'bulkapplied in the edit draft');

    // another device: the applied agent still fills a procedure chosen there
    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const p = await ctx.newPage();
    const g = await installAtcGuards(p);
    await loginAsAtc(p, 'admin');
    await p.goto(`/editATC/${TPL.eBulk}/alpha`);
    await p.locator(tid('atco-draft-select-0')).click({ timeout: 45_000 });
    await expect(newadj(p, 0).getByTestId('eatc-newadj-text')).toHaveValue(`EATT-04 new adjustment ${RUN}`, { timeout: 30_000 });
    await newproc(p, 0, 2).getByTestId('eatc-newproc-add').click();
    await expect(newproc(p, 0, 3)).toBeVisible({ timeout: 15_000 });
    await pickOptions(p, newproc(p, 0, 3).getByTestId('eatc-proc-name'), [PROC_NAME.two], false);
    await expect.poll(() => selectText(caOf(p, 0, 3)), { message: 'reopened draft: still inherits' }).toBe(NAME.agent1);
    assertNoRealDb(g);
    await ctx.close();
  });

  test('EATT-05 "← Prescribed ATC" and Cancel leave without saving', async ({ page }) => {
    await openEdit(page, TPL.vWish);
    await page.getByTestId('eatc-cancel').click();
    await expect(page).toHaveURL(/\/viewprescribedATC/, { timeout: 30_000 });
    await openEdit(page, TPL.vWish, false);
    await page.getByTestId('eatc-back').click();
    await expect(page).toHaveURL(/\/viewprescribedATC/, { timeout: 30_000 });
    expect((await atcDb().collection('atc_alpha').get()).docs.some((d) => d.data().editedfrom?.id === TPL.vWish), 'nothing saved').toBe(false);
  });

  test('EATT-06 Edit review log: live from the ATC, delete + add straight to the ATC; change agent may add; others read only', async ({ page, browser }) => {
    test.setTimeout(240_000);
    await openEdit(page, TPL.rLive);
    const card = page.getByTestId('eatc-review-card');
    await expect(card).toContainText('Hidden in the participant app');
    await expect(card.getByTestId('eatc-review-empty')).toBeVisible();
    await expect(page.getByTestId('eatc-review-carry')).toHaveText('0 reviews carry over.');

    // added on another device (View) → appears here, live
    await addReviewInView(browser, TPL.rLive, `EATT-06 from View ${RUN}`);
    await expect(card.getByTestId('eatc-review-note').nth(0)).toHaveText(`EATT-06 from View ${RUN}`, { timeout: 20_000 });
    await expect(page.getByTestId('eatc-review-carry')).toHaveText('1 reviews carry over.');

    // soft delete from Edit (Cancel first, then confirm) — written straight to the ATC, no save needed
    await card.getByTestId('eatc-review-delete').click();
    await expect(card.getByTestId('eatc-review-confirm')).toContainText("Delete this review? It's hidden from the log but kept on the ATC.");
    await card.getByTestId('eatc-review-cancel').click();
    await expect(card.getByTestId('eatc-review-confirm')).toHaveCount(0);
    await card.getByTestId('eatc-review-delete').click();
    await card.getByTestId('eatc-review-confirm-delete').click();
    await expect(card.getByTestId('eatc-review-row')).toHaveCount(0, { timeout: 20_000 });
    await waitFor(async () => ((await atcDoc(`atc_alpha/${TPL.rLive}`))?.reviewlog || []).some((x: any) => x.isdelete && x.deletedby === PF.admin), 'soft delete on the ATC');
    await card.getByTestId('eatc-review-show-deleted').locator('input').check();
    await expect(card.getByTestId('eatc-review-row')).toContainText('Deleted');
    await expect(page.getByTestId('eatc-review-carry')).toHaveText('0 reviews carry over.');
    // undelete from Edit (no confirmation) → back, counts up, delete fields cleared
    await card.getByTestId('eatc-review-undelete').click();
    await expect(card.getByTestId('eatc-review-row')).not.toContainText('Deleted', { timeout: 20_000 });
    await expect(page.getByTestId('eatc-review-carry')).toHaveText('1 reviews carry over.');
    const restored = await waitFor(async () => ((await atcDoc(`atc_alpha/${TPL.rLive}`))?.reviewlog || []).find((x: any) => x.isdelete === false) || null, 'undelete on the ATC');
    expect(restored.deletedby).toBeNull();

    // add from Edit
    await card.getByTestId('eatc-review-add').click();
    await expect(card.getByTestId('eatc-review-error')).toHaveText('Write the review first.');
    await card.getByTestId('eatc-review-text').fill(`EATT-06 from Edit ${RUN}`);
    await card.getByTestId('eatc-review-add').click();
    await waitFor(async () => ((await atcDoc(`atc_alpha/${TPL.rLive}`))?.reviewlog || []).some((x: any) => x.note === `EATT-06 from Edit ${RUN}`), 'review from Edit on the ATC');
    expect((await atcDb().collection('atc_alpha').get()).docs.some((d) => d.data().editedfrom?.id === TPL.rLive), 'no new version').toBe(false);

    // eis: the adjustment's implementation agent → may add; not involved anywhere → read only
    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const p = await ctx.newPage();
    const g = await installAtcGuards(p);
    await loginAsAtc(p, 'eis');
    await p.goto(`/editATC/${TPL.rImpl}/alpha`);
    await expect(p.locator(tid('eatc-exadj-0'))).toBeVisible({ timeout: 45_000 });
    await p.getByTestId('eatc-review-text').fill(`EATT-06 change agent ${RUN}`);
    await p.getByTestId('eatc-review-add').click();
    const impl = await waitFor(async () => ((await atcDoc(`atc_alpha/${TPL.rImpl}`))?.reviewlog || [])[0] || null, 'change agent review');
    expect(impl).toMatchObject({ createdby: PF.eis, note: `EATT-06 change agent ${RUN}` });
    await p.goto(`/editATC/${TPL.rNot}/alpha`);
    await expect(p.locator(tid('eatc-exadj-0'))).toBeVisible({ timeout: 45_000 });
    await expect(p.getByTestId('eatc-review-readonly')).toContainText("Only this ATC's authors, change agents, mentors and admins");
    await expect(p.getByTestId('eatc-review-text')).toHaveCount(0);
    assertNoRealDb(g);
    await ctx.close();
  });

  test('EATT-07 a review added while Edit is open is on the saved new version', async ({ page, browser }) => {
    test.setTimeout(240_000);
    await openEdit(page, TPL.rCarry);
    await addReviewInView(browser, TPL.rCarry, `EATT-07 meanwhile ${RUN}`);
    await expect(page.getByTestId('eatc-review-note').nth(0)).toHaveText(`EATT-07 meanwhile ${RUN}`, { timeout: 20_000 });
    await page.getByTestId('eatc-submit').click();
    await confirmSave(page, guard);
    const v = await newVersionOf(TPL.rCarry);
    expect((v.data().reviewlog || []).map((x: any) => x.note), 'built on the live ATC, not the copy loaded at open').toContain(`EATT-07 meanwhile ${RUN}`);
  });

  test('EATT-08 the ATC saved or deleted elsewhere while open: banner, Review and update disabled, Open latest version', async ({ page, browser }) => {
    test.setTimeout(240_000);
    await openEdit(page, TPL.rUp);
    await expect(page.getByTestId('eatc-retired-banner')).toHaveCount(0);
    // another device saves an edit of the same ATC
    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const p = await ctx.newPage();
    const g = await installAtcGuards(p);
    await loginAsAtc(p, 'admin');
    await p.goto(`/editATC/${TPL.rUp}/alpha`);
    await expect(p.locator(tid('eatc-exadj-0'))).toBeVisible({ timeout: 45_000 });
    await p.getByTestId('eatc-submit').click();
    await p.getByTestId('pabs-submit').click({ timeout: 30_000 });
    const v = await newVersionOf(TPL.rUp);
    await ctx.close().catch(() => {});

    await expect(page.getByTestId('eatc-retired-text')).toContainText('This ATC was updated by someone else on', { timeout: 30_000 });
    await expect(page.getByTestId('eatc-retired-text')).toContainText("Your changes can't be saved on this version. Open the latest version to continue.");
    await expect(page.getByTestId('eatc-submit')).toBeDisabled();
    await expect(page.getByTestId('eatc-review-readonly')).toContainText('This version can no longer be changed.');
    await page.getByTestId('eatc-open-latest').click();
    await expect(page).toHaveURL(new RegExp(`/editATC/${v.id}/alpha`), { timeout: 30_000 });
    assertNoRealDb(g);

    // deleted while open
    await openEdit(page, TPL.rDel, false);
    await expect(page.getByTestId('eatc-retired-banner')).toHaveCount(0);
    await atcDb().doc(`atc_alpha/${TPL.rDel}`).update({ isdelete: true });   // stands in for a delete made elsewhere
    await expect(page.getByTestId('eatc-retired-text')).toHaveText("This ATC was deleted. Your changes can't be saved.", { timeout: 30_000 });
    await expect(page.getByTestId('eatc-submit')).toBeDisabled();
    await expect(page.getByTestId('eatc-open-latest')).toHaveCount(0);
  });
});
