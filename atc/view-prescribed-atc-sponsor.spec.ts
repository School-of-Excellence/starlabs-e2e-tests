// view-prescribed-atc-sponsor.spec.ts — sponsor forms on /viewprescribedATC + the corrupted version chain on the form
// screen (VATCS-01..04), EMULATOR ONLY. Hook prefix: vatc (View Prescribed ATC). Plan:
// specs/plans/2026-11-02-atc-sponsor-forms.md (app repo).
//
// World (seed-atc.js phase 8): tsp is the participant, tss the sponsor. The sponsor model has one participant form
// (life) and two sponsor forms (support, feedback). SPN has no sponsor yet; SP1 (edited from SP0) has sponsor tss, the
// sponsor's answer + submitted request on SP0, a waiting sponsor request on SP1, the participant's answer and a delivery
// answer of its purchase. Negative controls: tss's own answer on SPX (tss as participant), another participant's
// sponsor-form answer on another ATC. Every button's effect is read back from the emulator with the Admin SDK.
import { test, expect, Page } from '@playwright/test';
import {
  PF, EMAIL, RUN, DF, DF_NAME, FATC, SP_MODEL, SPF, SPF_NAME, SP_ANS, SP_DELIVERY_NAME, SP_TEXT,
  installAtcGuards, assertNoRealDb, loginAsAtc, atcDb, atcDoc, formsDb, waitFor, pickOptions, popupFrom, tid, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

async function openFor(page: Page, participant: 'tsp', login = true) {
  if (login) await loginAsAtc(page, 'admin');
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

test.describe('ATC — View Prescribed ATC sponsor forms (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'view prescribed atc sponsor: no fatal console errors');
  });

  test('VATCS-01 first send asks for the sponsor → request + ATC sponsorid; the sponsor then locks; Withdraw frees it', async ({ page }) => {
    expect((await atcDoc(`atc_alpha/${FATC.SPN}`)).sponsorid, 'precondition: no sponsor yet').toBeUndefined();
    await openFor(page, 'tsp');
    const r = row(page, FATC.SPN);
    await openFull(r);
    const group = r.getByTestId('vatc-forms-group-sponsor');
    await expect(group).toHaveText(/Forms the sponsor fills$/);
    await expect(r.getByTestId('vatc-sponsor-name')).toHaveCount(0);
    const support = formRow(r, SPF_NAME.support);
    await expect(support.getByTestId('vatc-form-status')).toHaveText('Not sent');
    await expect(support.getByTestId('vatc-form-note')).toHaveText("The sponsor can't see it yet");
    await expect(support.getByTestId('vatc-form-send')).toHaveText('Send to sponsor');

    // first send: search, pick, send
    await support.getByTestId('vatc-form-send').click();
    const dialog = r.getByTestId('vatc-sponsor-dialog');
    await expect(dialog).toContainText(`Send ${SPF_NAME.support}`);
    await expect(dialog).toContainText('You can change the sponsor until the first sponsor form is sent.');
    await expect(dialog.getByTestId('vatc-sponsor-send'), 'no sponsor picked yet').toBeDisabled();
    await dialog.getByTestId('vatc-sponsor-search').fill(`tss+${RUN}`);
    await dialog.getByTestId('vatc-sponsor-option').filter({ hasText: EMAIL.tss }).click();
    await expect(dialog.getByTestId('vatc-sponsor-search')).toHaveValue(EMAIL.tss);
    await dialog.getByTestId('vatc-sponsor-send').click();
    await expect(dialog).toHaveCount(0);

    const sent = await waitFor(() => requestDoc(FATC.SPN, SPF.support), 'Send wrote the sponsor request');
    expect({ ...sent, sentat: undefined }).toEqual({ atcid: FATC.SPN, formid: SPF.support, profileid: PF.tss, participantid: PF.tsp,
      filledby: 'sponsor', product: SP_MODEL, sentby: PF.admin, sentat: undefined, formstatus: 'sent' });
    await waitFor(async () => (await atcDoc(`atc_alpha/${FATC.SPN}`)).sponsorid === PF.tss, 'sponsorid saved on the ATC');
    await expect(support.getByTestId('vatc-form-status')).toHaveText('Waiting for sponsor', { timeout: 15_000 });
    await expect(r.getByTestId('vatc-sponsor-name')).toContainText(EMAIL.tss);
    await expect(r.getByTestId('vatc-sponsor-locked-icon')).toBeVisible();
    await expect(r.getByTestId('vatc-forms-summary')).toContainText('1 waiting for sponsor');

    // second sponsor form: the sponsor is locked → no search, the name, sent to the same sponsor
    const feedback = formRow(r, SPF_NAME.feedback);
    await feedback.getByTestId('vatc-form-send').click();
    await expect(dialog.getByTestId('vatc-sponsor-search')).toHaveCount(0);
    await expect(dialog.getByTestId('vatc-sponsor-locked')).toHaveText(new RegExp(EMAIL.tss.replace(/[+.]/g, '\\$&')));
    await expect(dialog).toContainText(`Locked: a form was already sent to ${EMAIL.tss}.`);
    await dialog.getByTestId('vatc-sponsor-send').click();
    const second = await waitFor(() => requestDoc(FATC.SPN, SPF.feedback), 'second sponsor request');
    expect([second.profileid, second.filledby, second.participantid]).toEqual([PF.tss, 'sponsor', PF.tsp]);

    // Withdraw both → no sponsor request and no sponsor answer → the sponsor can be changed again (search, prefilled)
    await support.getByTestId('vatc-form-revoke').click();
    await feedback.getByTestId('vatc-form-revoke').click();
    expect(guard.dialogs).toContain("confirm: Withdraw this form? The sponsor won't be able to submit it.");
    await waitFor(async () => !(await requestDoc(FATC.SPN, SPF.support)) && !(await requestDoc(FATC.SPN, SPF.feedback)), 'both withdrawn');
    await expect(r.getByTestId('vatc-sponsor-locked-icon')).toHaveCount(0, { timeout: 15_000 });
    await support.getByTestId('vatc-form-send').click();
    await expect(dialog.getByTestId('vatc-sponsor-search'), 'the ATC sponsor is filled in').toHaveValue(EMAIL.tss);
    await dialog.getByTestId('vatc-sponsor-cancel').click();
    await expect(dialog).toHaveCount(0);
    expect(await requestDoc(FATC.SPN, SPF.support), 'Cancel writes nothing').toBeFalsy();
  });

  test('VATCS-02 one forms query: groups by who fills, answers by profileid, sponsor requests load by atcid, delivery part', async ({ page }) => {
    const sp1 = await atcDoc(`atc_alpha/${FATC.SP1}`);
    expect([sp1.sponsorid, sp1.editedfrom.id]).toEqual([PF.tss, FATC.SP0]);
    await openFor(page, 'tsp');
    const r = row(page, FATC.SP1);
    await openFull(r);
    // three model forms, three rows: the negative controls (tss's own answer on SPX, another participant's) add none
    await expect(r.getByTestId('vatc-form-row')).toHaveCount(3);
    await expect(r.getByTestId('vatc-forms-group-participant')).toContainText(`Forms the participant fills · ${EMAIL.tsp}`);
    await expect(r.getByTestId('vatc-sponsor-name')).toContainText(EMAIL.tss);
    await expect(r.getByTestId('vatc-sponsor-locked-icon')).toBeVisible();

    const support = formRow(r, SPF_NAME.support);       // answered by the sponsor on SP0 (an earlier version)
    await expect(support.getByTestId('vatc-form-status')).toHaveText('Submitted');
    await expect(support.getByTestId('vatc-form-note')).toHaveText('Filled by the sponsor');
    const feedback = formRow(r, SPF_NAME.feedback);     // the sponsor's waiting request (profileid tss) loaded by atcid
    await expect(feedback.getByTestId('vatc-form-status')).toHaveText('Waiting for sponsor');
    const life = formRow(r, DF_NAME.life);
    await expect(life.getByTestId('vatc-form-status')).toHaveText('Submitted');
    await expect(life.getByTestId('vatc-form-note')).toHaveText('Filled by the participant');
    await expect(r.getByTestId('vatc-forms-summary')).toHaveText('2 of 3 submitted · 1 waiting for sponsor');

    // the same query's purchase clause: the delivery answer of SP1's participantproductid
    const delivery = r.getByTestId('vatc-forms-part-delivery');
    await expect(delivery.getByTestId('vatc-activity-name')).toHaveText([SP_DELIVERY_NAME]);

    // View answer names whoever filled it (the answer's profileid)
    await support.getByTestId('vatc-form-view').click();
    const panel = page.getByTestId('fov-panel-3');
    await expect(panel).toContainText(SP_TEXT(SP_ANS.support), { timeout: 15_000 });
    await expect(panel).toContainText(EMAIL.tss);
    await page.getByTestId('fov-close-2').click();

    // the sponsor's Ask to update goes through the dialog, locked on tss
    await support.getByTestId('vatc-form-resend').click();
    const dialog = r.getByTestId('vatc-sponsor-dialog');
    await expect(dialog.getByTestId('vatc-sponsor-locked')).toBeVisible();
    await dialog.getByTestId('vatc-sponsor-cancel').click();
  });

  test('VATCS-03 the forms query answer set equals what the emulator holds for SP1 (anti-circularity)', async () => {
    const sp1 = await atcDoc(`atc_alpha/${FATC.SP1}`);
    const fdb = formsDb().collection('formsByClient');
    const byAtc = (await fdb.where('atcid', 'in', [FATC.SP1, FATC.SP0]).get()).docs.map((d) => d.id).sort();
    const byPp = (await fdb.where('participantproductid', '==', sp1.participantproductid).get()).docs.map((d) => d.id);
    expect(byAtc).toEqual([SP_ANS.life, SP_ANS.support].sort());
    expect(byPp).toEqual([SP_ANS.delivery]);
    // the negative controls exist and are outside both clauses
    expect((await fdb.doc(SP_ANS.xSponsor).get()).data()?.atcid).toBe(FATC.SPX);
    expect((await fdb.doc(SP_ANS.xOther).get()).data()?.atcid).toBe(FATC.OTHER);
  });

  test('VATCS-04 Fill form when the version chain loops: "corrupted" alert, nothing saved, the tab stays open', async ({ page }) => {
    await openFor(page, 'tsp');
    const r = row(page, FATC.COR);
    await openFull(r);
    const tab = await popupFrom(page, () => formRow(r, DF_NAME.review).getByTestId('vatc-form-fill').click());
    await page.goto('about:blank'); // harness only: free the emulator connections for the form tab (see the forms spec)
    await expect(tab.locator('.form-content input').first()).toBeVisible({ timeout: 45_000 });
    // a broken edit elsewhere: COR is marked upgraded and points at itself
    await atcDb().doc(`atc_alpha/${FATC.COR}`).update({ status: 'upgraded', isdelete: true, upgradedto: atcDb().doc(`atc_alpha/${FATC.COR}`) });

    await tab.locator('.form-content input').first().fill(`Corrupted chain ${RUN}`);
    await tab.getByTestId('for-on-submit-15').click();
    await tab.getByTestId('ftp-on-confirm-2').click();
    await expect.poll(() => guard.dialogs.some((m) => m === 'alert: This ATC is corrupted — unable to find the stable version.'), { timeout: 20_000 }).toBe(true);
    expect(tab.isClosed(), 'the tab stays open').toBe(false);
    const saved = await formsDb().collection('formsByClient').where('atcid', '==', FATC.COR).get();
    expect(saved.size, 'no answer saved').toBe(0);
    expect((await atcDoc(`atc_alpha/${FATC.COR}`)).formsubmitted).toBeUndefined();
  });
});
