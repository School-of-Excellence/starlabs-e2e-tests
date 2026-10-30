// view-prescribed-atc-forms.spec.ts — ATC forms on /viewprescribedATC + the form screen's ATC record (VATCF-01..10),
// EMULATOR ONLY. Hook prefix: vatc (View Prescribed ATC). Plan: specs/plans/2026-10-29-atc-forms-step1.md (app repo).
//
// World (seed-atc.js phase 6): one ATC model with 8 forms — specialist clarity / review / oldSub, participant
// life / sleep / diet / old / gone; old + oldSub are soft-deleted delivery forms, gone has no doc.
// Anti-circularity: rows and statuses on screen are compared against what the seed put in the emulator; every
// button's effect is read back from the emulator with the Admin SDK.
import { test, expect, Page } from '@playwright/test';
import {
  ATC, PF, EMAIL, RUN, FORMS_MODEL, DF, DF_NAME, DF_QUESTION, FATC, FANS, FANSWER_TEXT, DF_ALL, DF_ALL_NAME, W, MEDIA,
  installAtcGuards, assertNoRealDb,
  loginAsAtc, atcDb, atcDoc, formsDb, waitFor, pickOptions, popupFrom, tid, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

async function openFor(page: Page, participant: 'tfa' | 'tfb' | 'tfc' | 'tfd' | 'tfe', login = true, who: 'admin' | 'ah' = 'admin') {
  if (login) await loginAsAtc(page, who);
  await page.goto('/viewprescribedATC');
  await expect(page.getByTestId('vatc-count')).toBeVisible({ timeout: 45_000 });
  await pickOptions(page, page.getByTestId('vatc-filter-participant'), [EMAIL[participant]]);
}
const row = (page: Page, id: string) => page.locator(tid(`vatc-row-${id}`));
const formRow = (r: ReturnType<typeof row>, name: string) => r.getByTestId('vatc-form-row').filter({ hasText: name });
async function openFull(r: ReturnType<typeof row>) {
  await expect(r).toBeVisible({ timeout: 45_000 });
  await r.getByTestId('vatc-toggle-full').click();
  await expect(r.getByTestId('vatc-forms-card')).toBeVisible({ timeout: 30_000 });
}
const requestDoc = (atcid: string, formid: string) => atcDoc(`atc_form_requests/${atcid}_${formid}`);
// HARNESS ONLY: the emulator speaks HTTP/1.1 and Chrome allows 6 connections per host, so View ATC's live
// listeners plus the form tab's own channels starve the form tab's Write stream (its ack never arrives). Production
// Firestore is HTTP/2 (multiplexed) — no such limit. The View ATC page steps away while the form tab submits; the
// tab stays script-closable (it was opened by window.open), and View ATC is reopened afterwards to check the row.
async function releaseViewAtc(page: Page) { await page.goto('about:blank'); }

// ---- the all-widgets form (seed-atc.js DF_ALL): fill every field type the form screen renders ----------------
const card = (p: Page, name: string) => p.locator('.form-field-card').filter({ hasText: name });
async function pickMat(p: Page, select: ReturnType<Page['locator']>, labels: string[], multiple = false) {
  await select.click();
  for (const l of labels) await p.locator('.cdk-overlay-pane mat-option').filter({ hasText: l }).click();
  if (multiple) await p.keyboard.press('Escape');
  await expect(p.locator('.cdk-overlay-pane mat-option')).toHaveCount(0);
}
async function nudge(range: ReturnType<Page['locator']>, steps: number) {
  await range.focus();
  for (let k = 0; k < steps; k++) await range.press('ArrowRight');
}
const AW = { text: `AW text value ${RUN}`, paragraph: `AW paragraph ${RUN}`, item1: `AW item one ${RUN}`, item2: `AW item two ${RUN}`, itemPara: `AW item para ${RUN}` };
/** Fills every widget; returns the slider value the screen shows (compared with the saved answer). */
async function fillAllWidgets(p: Page): Promise<number> {
  await expect(card(p, W.text).locator('input')).toBeVisible({ timeout: 45_000 });
  await expect.soft(card(p, W.video).locator('video source')).toHaveAttribute('src', new RegExp(`^${MEDIA.video}\\?ngsw-bypass$`));
  await expect.soft(card(p, W.audio).locator('audio source')).toHaveAttribute('src', MEDIA.audio);
  await card(p, W.text).locator('input').fill(AW.text);
  await card(p, W.number).locator('input').fill('42');
  await card(p, W.email).locator('input').fill('aw@example.com');
  await card(p, W.time).locator('input').fill('10:30 AM');
  await card(p, W.time).locator('input').press('Tab');
  await card(p, W.date).locator('input').fill('1/15/2026');
  await card(p, W.date).locator('input').press('Tab');
  await pickMat(p, card(p, W.dropdown).locator('mat-select'), ['Drop B']);
  await pickMat(p, card(p, W.multiselect).locator('mat-select'), ['Multi A', 'Multi C'], true);
  await card(p, W.paragraph).locator('textarea').fill(AW.paragraph);
  await card(p, W.checkbox).locator('mat-checkbox input').check();
  await nudge(card(p, W.slider).locator('input[type=range]'), 2);
  const mcb = card(p, W.multicheckbox);
  await mcb.locator('mat-list-option').filter({ hasText: 'Box A' }).click();
  await mcb.locator('mat-list-option').filter({ hasText: 'Box C' }).click();
  await expect(mcb.locator('.flipping-slider-item')).toHaveCount(2);
  await nudge(mcb.locator('.flipping-slider-item').nth(0).locator('input[type=range]'), 3);
  await nudge(mcb.locator('.flipping-slider-item').nth(1).locator('input[type=range]'), 5);
  await card(p, W.radio).locator('input[type=radio][value="Yes"]').check();  // the button's centre isn't its label
  // repeating group: item 1 gets every sub-field, then a second item with text only
  const arr = card(p, W.array);
  const item = (n: number, name: string) => arr.locator('.form-array-item').nth(n).locator('.array-field').filter({ hasText: name });
  await item(0, W.aText).locator('input').fill(AW.item1);
  await item(0, W.aNumber).locator('input').fill('7');
  await item(0, W.aDate).locator('input').fill('2/20/2026');
  await item(0, W.aDate).locator('input').press('Tab');
  await pickMat(p, item(0, W.aDropdown).locator('mat-select'), ['Item B']);
  await item(0, W.aParagraph).locator('textarea').fill(AW.itemPara);
  await item(0, W.aCheckbox).locator('mat-checkbox input').check();
  await item(0, W.aRadio).locator('input[type=radio][value="On"]').check();
  await arr.getByTestId('for-on-add-13').click();
  await item(1, W.aText).locator('input').fill(AW.item2);
  await card(p, W.text).locator('input').press('End');     // a last keyup → autosave runs with every value in
  return Number((await card(p, W.slider).locator('.slider-value strong').innerText()).trim());
}
/** Every saved value, by field name, against what fillAllWidgets typed. */
function expectAllAnswers(saved: any, sliderShown: number) {
  const f = (name: string) => saved.formarray.find((x: any) => x.fieldname === name);
  const day = (v: any) => { const d = v.toDate(); return [d.getFullYear(), d.getMonth() + 1, d.getDate()]; };
  expect.soft(f(W.video).options, 'video URL saved as the plain string from delivery forms').toEqual([MEDIA.video]);
  expect.soft(f(W.audio).options).toEqual([MEDIA.audio]);
  expect.soft(f(W.text).value).toBe(AW.text);
  expect.soft(f(W.number).value, 'number inputs save the typed text (existing behaviour)').toBe('42');
  expect.soft(f(W.email).value).toBe('aw@example.com');
  const t = f(W.time).value.toDate();
  expect.soft([t.getHours(), t.getMinutes()], 'time').toEqual([10, 30]);
  expect.soft(day(f(W.date).value), 'date').toEqual([2026, 1, 15]);
  expect.soft(f(W.dropdown).value).toBe('Drop B');
  expect.soft(f(W.multiselect).value).toEqual(['Multi A', 'Multi C']);
  expect.soft(f(W.paragraph).value).toBe(AW.paragraph);
  expect.soft(f(W.checkbox).value).toBe(true);
  expect.soft(sliderShown, 'slider moved off its minimum').toBeGreaterThan(1);
  expect.soft(f(W.slider).value).toBe(sliderShown);
  expect.soft(f(W.multicheckbox).value).toEqual(['Box A', 'Box C']);
  const flip = f(W.multicheckbox).flippingquestion.value;
  expect.soft(Object.keys(flip).sort(), 'one flipping slider per ticked box').toEqual(['Box A', 'Box C']);
  expect.soft(Number(flip['Box A']), 'flipping slider Box A').toBeGreaterThan(1);
  expect.soft(Number(flip['Box C']), 'flipping slider Box C').toBeGreaterThan(1);
  expect.soft(f(W.radio).value).toBe('Yes');
  const items = f(W.array).value;
  expect(items).toHaveLength(2);
  expect.soft(items[0][W.aText]).toBe(AW.item1);
  expect.soft(items[0][W.aNumber]).toBe('7');
  expect.soft(day(items[0][W.aDate])).toEqual([2026, 2, 20]);
  expect.soft(items[0][W.aDropdown]).toBe('Item B');
  expect.soft(items[0][W.aParagraph]).toBe(AW.itemPara);
  expect.soft(items[0][W.aCheckbox]).toBe(true);
  expect.soft(items[0][W.aRadio]).toBe('On');
  expect.soft(items[1][W.aText]).toBe(AW.item2);
}
/** The draft autosave landed in firestore-forms (no "Save failed"), video URL still a plain string. */
async function expectDraftSaved(p: Page, profileid: string) {
  await expect(p.locator('.form-top-bar').getByText(/^Saved/), 'draft chip says Saved').toBeVisible({ timeout: 30_000 });
  await expect(p.getByText(/Save failed/)).toHaveCount(0);
  const draft = await waitFor(async () => {
    const q = await formsDb().collection('temporary_forms').where('formid', '==', DF_ALL).where('profileid', '==', profileid).get();
    const d = q.docs[0]?.data();
    return d?.formarray?.find((x: any) => x.fieldname === W.text)?.value === AW.text ? d : null;
  }, 'draft in temporary_forms');
  expect(draft.formarray.find((x: any) => x.fieldname === W.video).options).toEqual([MEDIA.video]);
}

test.describe('ATC — View Prescribed ATC forms (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'view prescribed atc forms: no fatal console errors');
  });

  test('VATCF-01 collapsed: validated ATC shows "X of N forms submitted"; unvalidated and no-forms ATCs show none', async ({ page }) => {
    await openFor(page, 'tfa');
    const v1 = (await atcDoc(`atc_alpha/${FATC.V1}`)).formsubmitted;
    const done = Object.keys(v1).length;                                   // 4 of the model's 8
    await expect(row(page, FATC.V1).getByTestId('vatc-forms-count')).toHaveText(`${done} of 8 forms submitted`, { timeout: 30_000 });
    await expect(row(page, FATC.OTHER).getByTestId('vatc-forms-count')).toHaveText('0 of 8 forms submitted');
    await expect(row(page, FATC.UNV).getByTestId('vatc-status-pending')).toBeVisible();
    await expect(row(page, FATC.UNV).getByTestId('vatc-forms-count'), 'not validated → only the unvalidated tag').toHaveCount(0);
    await expect(row(page, FATC.V1).getByTestId('vatc-forms-card'), 'collapsed → no Forms card').toHaveCount(0);
    await expect(row(page, FATC.V0), 'an upgraded version is not listed').toHaveCount(0);

    // a model without forms (A1, model alpha): no count, and no Forms card when opened
    await page.getByTestId('vatc-clear-filter').click();
    const a1 = row(page, ATC.A1);
    await expect(a1).toBeVisible({ timeout: 45_000 });
    await expect(a1.getByTestId('vatc-forms-count')).toHaveCount(0);
    await a1.getByTestId('vatc-toggle-full').click();
    await expect(a1.locator(tid('vatc-adj-0'))).toBeVisible({ timeout: 20_000 });
    await expect(a1.getByTestId('vatc-forms-card')).toHaveCount(0);
  });

  test('VATCF-02 opened: rows in name order with status + buttons from formsubmitted and this ATC\'s requests (incl. earlier version)', async ({ page }) => {
    await openFor(page, 'tfa');
    const r = row(page, FATC.V1);
    await openFull(r);
    // gone (no delivery forms doc) is hidden → 7 rows, form-name order
    await expect(r.getByTestId('vatc-form-row')).toHaveCount(7);
    const names = await r.getByTestId('vatc-form-row').locator('.form-name > span:first-child').allInnerTexts();
    // grouped: forms you fill first, then the participant's — each group in form-name order
    expect(names).toEqual([DF_NAME.clarity, DF_NAME.oldSub, DF_NAME.review, DF_NAME.diet, DF_NAME.life, DF_NAME.old, DF_NAME.sleep]);

    const expectRow = async (name: string, status: string, buttons: string[]) => {
      const fr = formRow(r, name);
      await expect(fr.getByTestId('vatc-form-status'), `${name}: status`).toHaveText(status);
      await expect(fr.locator('.form-actions button'), `${name}: buttons`).toHaveText(buttons);
    };
    await expectRow(DF_NAME.clarity, 'Submitted', ['View answer', 'Edit answer']);          // specialist, answered → can resubmit
    await expectRow(DF_NAME.review, 'To fill', ['Fill form']);                               // specialist, no answer
    await expectRow(DF_NAME.diet, 'Waiting for participant', ['Withdraw']);                  // request on V1, no answer
    await expectRow(DF_NAME.life, 'Waiting for update', ['View answer', 'Withdraw']);        // request with answerid on V0 (earlier version)
    await expectRow(DF_NAME.sleep, 'Submitted', ['View answer', 'Ask to update']);           // OTHER's request must not count here
    await expectRow(DF_NAME.oldSub, 'Submitted', ['View answer']);                           // soft-deleted but answered → View only (no Edit)
    await expect(formRow(r, DF_NAME.oldSub).getByTestId('vatc-form-note')).toHaveText('Filled by you');
    // groups + summary line + explanation lines
    await expect(r.getByTestId('vatc-forms-group-specialist')).toContainText('Forms you fill');
    await expect(r.getByTestId('vatc-forms-group-participant')).toContainText('Forms the participant fills in the app');
    await expect(r.getByTestId('vatc-forms-summary')).toHaveText('4 of 7 submitted · 2 waiting for participant · 1 for you to fill');
    await expect(formRow(r, DF_NAME.review).getByTestId('vatc-form-note')).toHaveText("You haven't filled this yet");
    await expect(formRow(r, DF_NAME.diet).getByTestId('vatc-form-note')).toHaveText(/^Sent \d{1,2} \w{3} \d{4}$/);
    await expect(formRow(r, DF_NAME.life).getByTestId('vatc-form-note')).toHaveText(/^Sent back \d{1,2} \w{3} \d{4} to update their answer$/);
    await expect(formRow(r, DF_NAME.sleep).getByTestId('vatc-form-note')).toHaveText('Filled by the participant');
    // soft-deleted, not answered → button disabled + the note
    await expectRow(DF_NAME.old, 'Not required', []);
    await expect(formRow(r, DF_NAME.old).getByTestId('vatc-form-note')).toHaveText('This form was deleted');
  });

  test('VATCF-03 opened unvalidated ATC has no Forms card', async ({ page }) => {
    await openFor(page, 'tfa');
    const r = row(page, FATC.UNV);
    await expect(r).toBeVisible({ timeout: 45_000 });
    await r.getByTestId('vatc-toggle-full').click();
    await expect(r.locator(tid('vatc-adj-0'))).toBeVisible({ timeout: 20_000 });
    await expect(r.getByTestId('vatc-forms-card')).toHaveCount(0);
  });

  test('VATCF-04 rows are not rebuilt while the ATC stays open, and the page stays responsive (no freeze)', async ({ page }) => {
    await openFor(page, 'tfa');
    const r = row(page, FATC.V1);
    await expect(r).toBeVisible({ timeout: 45_000 });
    await page.evaluate(() => {
      (window as any).__longTasks = [];
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window as any).__longTasks.push(e.duration))).observe({ entryTypes: ['longtask'] });
    });
    const t0 = Date.now();
    await openFull(r);
    expect(Date.now() - t0, 'Forms card shows within 15 s of View Full ATC').toBeLessThan(15_000);
    // same DOM node 3 s later = rows updated in place (trackBy), not re-created on every change detection
    const first = await formRow(r, DF_NAME.clarity).elementHandle();
    await page.waitForTimeout(3_000);
    expect(await first.evaluate((el) => el.isConnected), 'the row element survives change detection').toBe(true);
    const longest = await page.evaluate(() => Math.max(0, ...(window as any).__longTasks));
    expect(longest, 'no main-thread block over 2 s after opening (dev build)').toBeLessThan(2_000);
    // a click still lands
    await formRow(r, DF_NAME.clarity).getByTestId('vatc-form-view').click();
    await expect(page.getByTestId('fov-panel-3')).toBeVisible({ timeout: 15_000 });
  });

  test('VATCF-05 View opens the participant forms overlay with the saved answer', async ({ page }) => {
    await openFor(page, 'tfa');
    const r = row(page, FATC.V1);
    await openFull(r);
    await formRow(r, DF_NAME.clarity).getByTestId('vatc-form-view').click();
    const panel = page.getByTestId('fov-panel-3');
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel).toContainText(DF_NAME.clarity);
    await expect(panel).toContainText(DF_QUESTION);
    await expect(panel, 'the answer read from formsByClient').toContainText(FANSWER_TEXT('clarity'), { timeout: 15_000 });
    await expect(panel).toContainText(EMAIL.tfa);                          // participant name = users_roles name (email)
    await page.getByTestId('fov-close-2').click();
    await expect(panel).toHaveCount(0);
  });

  test('VATCF-06 Send → request doc → Sent → Revoke deletes it; Resend → answerid → Resent → Revoke → Submitted', async ({ page }) => {
    await openFor(page, 'tfb');
    const r = row(page, FATC.ACT);
    await openFull(r);
    const life = formRow(r, DF_NAME.life);
    await expect(life.getByTestId('vatc-form-status')).toHaveText('Not sent');
    await life.getByTestId('vatc-form-send').click();
    const sent = await waitFor(() => requestDoc(FATC.ACT, DF.life), 'Send wrote the request');
    expect({ ...sent, sentat: undefined }).toEqual({ atcid: FATC.ACT, formid: DF.life, profileid: PF.tfb, product: FORMS_MODEL, sentby: PF.admin, sentat: undefined, formstatus: 'sent' });
    expect(sent.sentat?.toDate?.(), 'sentat is a server timestamp').toBeTruthy();
    expect(sent.answerid, 'Send carries no answerid').toBeUndefined();
    await expect(life.getByTestId('vatc-form-status')).toHaveText('Waiting for participant', { timeout: 15_000 });
    await life.getByTestId('vatc-form-revoke').click();
    await waitFor(async () => !(await requestDoc(FATC.ACT, DF.life)), 'Withdraw deleted the request');
    expect(guard.dialogs, 'Withdraw asks first').toContain("confirm: Withdraw this form? The participant won't be able to submit it.");
    await expect(life.getByTestId('vatc-form-status')).toHaveText('Not sent', { timeout: 15_000 });

    const sleep = formRow(r, DF_NAME.sleep);
    await expect(sleep.getByTestId('vatc-form-status')).toHaveText('Submitted');
    await sleep.getByTestId('vatc-form-resend').click();
    const resent = await waitFor(() => requestDoc(FATC.ACT, DF.sleep), 'Resend wrote the request');
    expect(resent.answerid, 'Resend points at the answer to edit').toBe(FANS.actSleep);
    await expect(sleep.getByTestId('vatc-form-status')).toHaveText('Waiting for update', { timeout: 15_000 });
    await expect(sleep.locator('.form-actions button')).toHaveText(['View answer', 'Withdraw']);
    await sleep.getByTestId('vatc-form-revoke').click();
    await waitFor(async () => !(await requestDoc(FATC.ACT, DF.sleep)), 'Revoke deleted the resend');
    await expect(sleep.getByTestId('vatc-form-status')).toHaveText('Submitted', { timeout: 15_000 });
  });

  test('VATCF-07 the requests listener is live while open: a request written elsewhere shows at once', async ({ page }) => {
    await openFor(page, 'tfa');
    const r = row(page, FATC.OTHER);
    await openFull(r);
    const diet = formRow(r, DF_NAME.diet);
    await expect(diet.getByTestId('vatc-form-status')).toHaveText('Not sent');
    const id = `${FATC.OTHER}_${DF.diet}`;
    await atcDb().collection('atc_form_requests').doc(id).set({ atcid: FATC.OTHER, formid: DF.diet, profileid: PF.tfa, product: FORMS_MODEL, sentby: PF.admin, sentat: new Date(), formstatus: 'sent' });
    try {
      await expect(diet.getByTestId('vatc-form-status')).toHaveText('Waiting for participant', { timeout: 15_000 });
    } finally {
      await atcDb().collection('atc_form_requests').doc(id).delete();
    }
    await expect(diet.getByTestId('vatc-form-status')).toHaveText('Not sent', { timeout: 15_000 });
  });

  test('VATCF-08 Fill form: new tab → submit → answer saved, recorded on the ATC (formsubmitted), tab closes, row → Submitted + View', async ({ page }) => {
    await openFor(page, 'tfc');
    const r = row(page, FATC.FILL);
    await openFull(r);
    const clarity = formRow(r, DF_NAME.clarity);
    await expect(clarity.getByTestId('vatc-form-status')).toHaveText('To fill');
    const tab = await popupFrom(page, () => clarity.getByTestId('vatc-form-fill').click());
    await releaseViewAtc(page);
    const url = new URL(tab.url());
    expect(url.pathname).toBe('/formtemplate');
    expect(Object.fromEntries(url.searchParams)).toEqual({ id: DF.clarity, type: 'form', profileid: PF.tfc, atcid: FATC.FILL });

    const text = `Specialist answer ${RUN}`;
    await tab.locator('.form-content input').first().fill(text, { timeout: 45_000 });
    const closed = tab.waitForEvent('close', { timeout: 45_000 });
    await tab.getByTestId('for-on-submit-15').click();
    await tab.getByTestId('ftp-on-confirm-2').click();
    await closed;

    const atc = await waitFor(async () => { const d = await atcDoc(`atc_alpha/${FATC.FILL}`); return d?.formsubmitted?.[DF.clarity] ? d : null; }, 'formsubmitted recorded');
    const answerId = atc.formsubmitted[DF.clarity];
    const answer = (await formsDb().collection('formsByClient').doc(answerId).get()).data();
    expect(answer.formid).toBe(DF.clarity);
    expect(answer.atcid).toBe(FATC.FILL);
    expect(answer.filledby).toBe('specialist');
    expect(answer.profileid).toBe(PF.tfc);
    expect(answer.formarray.find((f: any) => f.fieldname === DF_QUESTION).value).toBe(text);
    expect(Object.keys(atc.formsubmitted), 'only that form was recorded').toEqual([DF.clarity]);

    await openFor(page, 'tfc', false);  // still signed in
    await openFull(r);
    await expect(clarity.getByTestId('vatc-form-status')).toHaveText('Submitted', { timeout: 20_000 });
    await expect(r.getByTestId('vatc-forms-count')).toHaveText('1 of 8 forms submitted');
    await clarity.getByTestId('vatc-form-view').click();
    await expect(page.getByTestId('fov-panel-3')).toContainText(text, { timeout: 15_000 });
  });

  test('VATCF-09 Fill form after the ATC was edited: the answer is recorded on the latest version', async ({ page }) => {
    await openFor(page, 'tfd');
    const r = row(page, FATC.UP1);
    await openFull(r);
    const tab = await popupFrom(page, () => formRow(r, DF_NAME.review).getByTestId('vatc-form-fill').click());
    await releaseViewAtc(page);
    await expect(tab.locator('.form-content input').first()).toBeVisible({ timeout: 45_000 });
    // edit elsewhere: UP1 → UP2 (the same shape the Edit screen leaves behind)
    const up1 = await atcDoc(`atc_alpha/${FATC.UP1}`);
    await atcDb().doc(`atc_alpha/${FATC.UP2}`).set({ ...up1, atcid: FATC.UP2, editedfrom: atcDb().doc(`atc_alpha/${FATC.UP1}`) });
    await atcDb().doc(`atc_alpha/${FATC.UP1}`).update({ status: 'upgraded', isdelete: true, upgradedto: atcDb().doc(`atc_alpha/${FATC.UP2}`) });

    await tab.locator('.form-content input').first().fill(`After edit ${RUN}`);
    const closed = tab.waitForEvent('close', { timeout: 45_000 });
    await tab.getByTestId('for-on-submit-15').click();
    await tab.getByTestId('ftp-on-confirm-2').click();
    await closed;
    const up2 = await waitFor(async () => { const d = await atcDoc(`atc_alpha/${FATC.UP2}`); return d?.formsubmitted?.[DF.review] ? d : null; }, 'recorded on UP2');
    expect((await atcDoc(`atc_alpha/${FATC.UP1}`)).formsubmitted, 'nothing recorded on the old version').toBeUndefined();
    const answer = (await formsDb().collection('formsByClient').doc(up2.formsubmitted[DF.review]).get()).data();
    expect(answer.atcid).toBe(FATC.UP2);
  });

  test('VATCF-10 Fill form after the ATC was deleted: nothing is saved and the specialist is told', async ({ page }) => {
    await openFor(page, 'tfd');
    const r = row(page, FATC.DEL);
    await openFull(r);
    const tab = await popupFrom(page, () => formRow(r, DF_NAME.review).getByTestId('vatc-form-fill').click());
    await releaseViewAtc(page);
    await expect(tab.locator('.form-content input').first()).toBeVisible({ timeout: 45_000 });
    await atcDb().doc(`atc_alpha/${FATC.DEL}`).update({ isdelete: true });

    await tab.locator('.form-content input').first().fill(`After delete ${RUN}`);
    await tab.getByTestId('for-on-submit-15').click();
    await tab.getByTestId('ftp-on-confirm-2').click();
    await expect.poll(() => guard.dialogs.some((m) => m === "alert: This ATC was removed, so the form wasn't saved."), { timeout: 20_000 }).toBe(true);
    expect(tab.isClosed(), 'the tab stays open').toBe(false);
    const saved = await formsDb().collection('formsByClient').where('atcid', '==', FATC.DEL).get();
    expect(saved.size, 'no answer saved for a deleted ATC').toBe(0);
    expect((await atcDoc(`atc_alpha/${FATC.DEL}`)).formsubmitted).toBeUndefined();
  });

  test('VATCF-11 regression: the form screen without ?atcid saves as before — no ATC fields, no ATC write, goes home', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    const before = (await atcDoc(`atc_alpha/${FATC.V1}`)).formsubmitted;
    await page.goto(`/formtemplate?id=${DF.diet}&type=form&profileid=${PF.tfa}`);
    await page.locator('.form-content input').first().fill(`No ATC ${RUN}`, { timeout: 45_000 });
    await page.getByTestId('for-on-submit-15').click();
    await page.getByTestId('ftp-on-confirm-2').click();
    await expect(page).not.toHaveURL(/formtemplate/, { timeout: 30_000 });
    const saved = await waitFor(async () => {
      const q = await formsDb().collection('formsByClient').where('formid', '==', DF.diet).where('profileid', '==', PF.tfa).get();
      return q.docs[0]?.data();
    }, 'answer saved');
    expect(saved.atcid, 'no atcid on a non-ATC answer').toBeUndefined();
    expect(saved.filledby).toBeUndefined();
    expect(saved.formarray.find((f: any) => f.fieldname === DF_QUESTION).value).toBe(`No ATC ${RUN}`);
    expect((await atcDoc(`atc_alpha/${FATC.V1}`)).formsubmitted, 'no ATC changed').toEqual(before);
  });

  test('VATCF-12 all widget types through View ATC → Fill form: draft saves, submit saves every value, ATC recorded, View shows it', async ({ page }) => {
    await openFor(page, 'tfe');
    const r = row(page, FATC.ALL);
    await openFull(r);
    const tab = await popupFrom(page, () => formRow(r, DF_ALL_NAME).getByTestId('vatc-form-fill').click());
    await releaseViewAtc(page);
    const sliderShown = await fillAllWidgets(tab);
    await expectDraftSaved(tab, PF.tfe);

    const closed = tab.waitForEvent('close', { timeout: 45_000 });
    await tab.getByTestId('for-on-submit-15').click();
    await tab.getByTestId('ftp-on-confirm-2').click();
    await closed;
    const atc = await waitFor(async () => { const d = await atcDoc(`atc_alpha/${FATC.ALL}`); return d?.formsubmitted?.[DF_ALL] ? d : null; }, 'formsubmitted recorded');
    const saved = (await formsDb().collection('formsByClient').doc(atc.formsubmitted[DF_ALL]).get()).data();
    expect(saved.atcid).toBe(FATC.ALL);
    expect(saved.filledby).toBe('specialist');
    expectAllAnswers(saved, sliderShown);
    const drafts = await formsDb().collection('temporary_forms').where('formid', '==', DF_ALL).where('profileid', '==', PF.tfe).get();
    expect(drafts.size, 'the draft is removed on submit').toBe(0);

    await openFor(page, 'tfe', false);
    await openFull(r);
    const all = formRow(r, DF_ALL_NAME);
    await expect(all.getByTestId('vatc-form-status')).toHaveText('Submitted', { timeout: 20_000 });
    await all.getByTestId('vatc-form-view').click();
    const panel = page.getByTestId('fov-panel-3');
    await expect(panel).toContainText(AW.text, { timeout: 15_000 });
    await expect(panel).toContainText('Drop B');
    await expect(panel).toContainText(AW.paragraph);
  });

  test('VATCF-13 all widget types on the form screen without an ATC: draft saves, submit saves every value (regression)', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto(`/formtemplate?id=${DF_ALL}&type=form&profileid=${PF.tfd}`);
    const sliderShown = await fillAllWidgets(page);
    await expectDraftSaved(page, PF.tfd);
    await page.getByTestId('for-on-submit-15').click();
    await page.getByTestId('ftp-on-confirm-2').click();
    await expect(page).not.toHaveURL(/formtemplate/, { timeout: 30_000 });
    const saved = await waitFor(async () => {
      const q = await formsDb().collection('formsByClient').where('formid', '==', DF_ALL).where('profileid', '==', PF.tfd).get();
      return q.docs[0]?.data();
    }, 'answer saved');
    expect(saved.atcid).toBeUndefined();
    expectAllAnswers(saved, sliderShown);
  });

  test('VATCF-14 specialist resubmit: Edit opens the saved answer prefilled → Preview & Update overwrites that answer, old copy logged, tab closes', async ({ page }) => {
    await openFor(page, 'tfe');
    const r = row(page, FATC.EDIT);
    await openFull(r);
    const clarity = formRow(r, DF_NAME.clarity);
    await expect(clarity.locator('.form-actions button')).toHaveText(['View answer', 'Edit answer']);
    const tab = await popupFrom(page, () => clarity.getByTestId('vatc-form-edit').click());
    await releaseViewAtc(page);
    const url = new URL(tab.url());
    expect(url.pathname).toBe('/formtemplate');
    expect(Object.fromEntries(url.searchParams)).toEqual({ id: DF.clarity, type: 'form', patchdata: `formsByClient/${FANS.editClarity}`, profileid: PF.tfe, atcid: FATC.EDIT });

    const input = tab.locator('.form-content input').first();
    await expect(input, 'prefilled with the saved answer, not blank').toHaveValue(FANSWER_TEXT('clarity'), { timeout: 45_000 });
    await expect(input).toBeEditable();
    await expect(tab.getByTestId('for-on-submit-15'), 'no new-submit button on an edit').toHaveCount(0);
    const edited = `Edited answer ${RUN}`;
    await input.fill(edited);
    const closed = tab.waitForEvent('close', { timeout: 45_000 });
    await tab.getByTestId('for-on-update-16').click();
    await tab.getByTestId('ftp-on-confirm-2').click();
    await closed;

    const answer = await waitFor(async () => {
      const d = (await formsDb().collection('formsByClient').doc(FANS.editClarity).get()).data();
      return d?.formarray?.find((f: any) => f.fieldname === DF_QUESTION)?.value === edited ? d : null;
    }, 'the same answer doc updated');
    expect(answer.atcid).toBe(FATC.EDIT);
    expect((await atcDoc(`atc_alpha/${FATC.EDIT}`)).formsubmitted, 'still points at the same answer').toEqual({ [DF.clarity]: FANS.editClarity });
    const logs = await formsDb().collection('formsByClient log').where('docid', '==', FANS.editClarity).get();
    expect(logs.docs.map((d) => d.data().formarray.find((f: any) => f.fieldname === DF_QUESTION).value), 'the previous answer kept in formsByClient log')
      .toContain(FANSWER_TEXT('clarity'));
    const extra = await formsDb().collection('formsByClient').where('atcid', '==', FATC.EDIT).get();
    expect(extra.size, 'no second answer created').toBe(1);

    await openFor(page, 'tfe', false);
    await openFull(r);
    await formRow(r, DF_NAME.clarity).getByTestId('vatc-form-view').click();
    await expect(page.getByTestId('fov-panel-3')).toContainText(edited, { timeout: 15_000 });
  });

  test('VATCF-15 no extra access check: whoever the list shows the ATC to may act on its forms (an "ah" super-role user)', async ({ page }) => {
    await openFor(page, 'tfa', true, 'ah');
    const r = row(page, FATC.V1);
    await openFull(r);
    await expect(r.getByTestId('vatc-form-row')).toHaveCount(7);
    await expect(formRow(r, DF_NAME.clarity).locator('.form-actions button')).toHaveText(['View answer', 'Edit answer']);
    await expect(formRow(r, DF_NAME.review).getByTestId('vatc-form-fill')).toBeVisible();
    await expect(formRow(r, DF_NAME.diet).getByTestId('vatc-form-revoke')).toBeVisible();
    await expect(formRow(r, DF_NAME.sleep).getByTestId('vatc-form-resend')).toBeVisible();
    await formRow(r, DF_NAME.clarity).getByTestId('vatc-form-view').click();
    await expect(page.getByTestId('fov-panel-3')).toContainText(FANSWER_TEXT('clarity'), { timeout: 15_000 });
  });

  // the participant app keeps the request as the record of what was sent and marks it formstatus 'submitted',
  // so the row must read it from formstatus and not from the doc merely being there
  test('VATCF-16 a request the participant app submitted is kept, and the row closes instead of reopening', async ({ page }) => {
    await openFor(page, 'tfa');
    const r = row(page, FATC.V1);
    await openFull(r);
    const sleep = formRow(r, DF_NAME.sleep);
    await expect(sleep.getByTestId('vatc-form-status')).toHaveText('Submitted');
    const id = `${FATC.V1}_${DF.sleep}`;
    // a pending resend reopens the row …
    await atcDb().collection('atc_form_requests').doc(id).set({ atcid: FATC.V1, formid: DF.sleep, profileid: PF.tfa, product: FORMS_MODEL, sentby: PF.admin, sentat: new Date(), formstatus: 'sent', answerid: FANS.sleep });
    try {
      await expect(sleep.getByTestId('vatc-form-status')).toHaveText('Waiting for update', { timeout: 15_000 });
      await expect(sleep.getByTestId('vatc-form-revoke')).toBeVisible();
      // … and the app marking it submitted closes it again, with the request still there
      await atcDb().collection('atc_form_requests').doc(id).update({ formstatus: 'submitted' });
      await expect(sleep.getByTestId('vatc-form-status')).toHaveText('Submitted', { timeout: 15_000 });
      await expect(sleep.locator('.form-actions button')).toHaveText(['View answer', 'Ask to update']);
      expect(await requestDoc(FATC.V1, DF.sleep), 'the submitted request is kept, not deleted').toBeTruthy();
    } finally {
      await atcDb().collection('atc_form_requests').doc(id).delete();
    }
  });

  test('VATCF-17 one request per ATC + form across versions: Resend on the edited ATC rewrites the earlier version\'s request; a pending soft-deleted form keeps Revoke', async ({ page }) => {
    await openFor(page, 'tfb');
    const r = row(page, FATC.RV1);
    await openFull(r);
    const sleepDoc = `atc_form_requests/${FATC.RV0}_${DF.sleep}`;
    const sleep = formRow(r, DF_NAME.sleep);
    await expect(sleep.getByTestId('vatc-form-status')).toHaveText('Submitted');
    await expect(sleep.locator('.form-actions button')).toHaveText(['View answer', 'Ask to update']);
    await sleep.getByTestId('vatc-form-resend').click();
    const rewritten = await waitFor(async () => { const d = await atcDoc(sleepDoc); return d?.formstatus === 'sent' ? d : null; }, 'RV0 request rewritten');
    expect(rewritten.atcid, 'keeps the atcid the app builds the doc id from').toBe(FATC.RV0);
    expect(rewritten.answerid).toBe(FANS.rvSleep);
    expect(await atcDoc(`atc_form_requests/${FATC.RV1}_${DF.sleep}`), 'no second request for the edited version').toBeNull();
    const all = await atcDb().collection('atc_form_requests').where('formid', '==', DF.sleep).where('profileid', '==', PF.tfb).get();
    expect(all.docs.map((d) => d.id)).toEqual([`${FATC.RV0}_${DF.sleep}`]);
    await expect(sleep.getByTestId('vatc-form-status')).toHaveText('Waiting for update', { timeout: 15_000 });
    await expect(sleep.locator('.form-actions button')).toHaveText(['View answer', 'Withdraw']);

    // a soft-deleted form already sent: no "no longer required", Revoke enabled; after Revoke → deleted note, Send off
    const old = formRow(r, DF_NAME.old);
    await expect(old.getByTestId('vatc-form-status')).toHaveText('Waiting for participant');
    await expect(old.getByTestId('vatc-form-note')).not.toHaveText('This form was deleted');
    await expect(old.getByTestId('vatc-form-revoke')).toBeEnabled();
    await old.getByTestId('vatc-form-revoke').click();
    await waitFor(async () => !(await atcDoc(`atc_form_requests/${FATC.RV0}_${DF.old}`)), 'pending deleted-form request revoked');
    await expect(old.getByTestId('vatc-form-status')).toHaveText('Not required', { timeout: 15_000 });
    await expect(old.getByTestId('vatc-form-note')).toHaveText('This form was deleted');
    await expect(old.locator('.form-actions button'), 'no buttons on a form that is not required').toHaveCount(0);
  });
});
