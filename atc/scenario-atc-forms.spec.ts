// scenario-atc-forms.spec.ts — the WEB half of the ATC forms mobile scenario (2026-10-30), EMULATOR ONLY.
// Hook prefix: vatc. Runs only when SCENARIO_PHASE names a phase (skipped in the normal atc suite).
//
// Alternates with the Flutter app on the iOS simulator, on ONE seeded emulator (runner: scratch run-scenario.sh):
//   web1 → app1 → web2 → app2 → web3        (Flutter: integration_test/features/atc_forms_scenario_test.dart)
// Participant: tfm (seed-atc.js). ATCs: M1 (main), M2 (same model), M3 (deleted before submit), M5 → M5B (edited).
import { test, expect, Page } from '@playwright/test';
import {
  PF, EMAIL, RUN, DF, DF_NAME, DF_QUESTION, FATC, installAtcGuards, assertNoRealDb, loginAsAtc, atcDb, atcDoc, formsDb,
  waitFor, pickOptions, tid, AtcGuard,
} from './support/atc';

const PHASE = process.env.SCENARIO_PHASE || '';
export const APP_TEXT_1 = `Mobile answer one ${RUN}`;   // typed by the app in app1 (Life Report, M1)
export const APP_TEXT_2 = `Mobile answer two ${RUN}`;   // typed by the app in app2 (the resubmission)

const row = (page: Page, id: string) => page.locator(tid(`vatc-row-${id}`));
const formRow = (r: ReturnType<typeof row>, name: string) => r.getByTestId('vatc-form-row').filter({ hasText: name });
const req = (atcid: string, formid: string) => atcDoc(`atc_form_requests/${atcid}_${formid}`);
async function openTfm(page: Page) {
  await loginAsAtc(page, 'admin');
  await page.goto('/viewprescribedATC');
  await expect(page.getByTestId('vatc-count')).toBeVisible({ timeout: 45_000 });
  await pickOptions(page, page.getByTestId('vatc-filter-participant'), [EMAIL.tfm]);
}
async function openFull(page: Page, id: string) {
  const r = row(page, id);
  await expect(r).toBeVisible({ timeout: 45_000 });
  await r.getByTestId('vatc-toggle-full').click();
  await expect(r.getByTestId('vatc-forms-card')).toBeVisible({ timeout: 30_000 });
  return r;
}
async function closeFull(r: ReturnType<typeof row>) { await r.getByTestId('vatc-toggle-full').click(); }

test.describe('ATC forms mobile scenario — web side (emulator only)', () => {
  let guard: AtcGuard;
  test.beforeEach(async ({ page }) => { guard = await installAtcGuards(page); });
  test.afterEach(() => assertNoRealDb(guard));

  test('web1 specialist sends forms; M5 is edited and M3 deleted before the app submits', async ({ page }) => {
    test.skip(PHASE !== 'web1', 'scenario phase web1 only');
    await openTfm(page);
    // S1 — send three participant forms on M1
    const m1 = await openFull(page, FATC.M1);
    for (const name of [DF_NAME.life, DF_NAME.sleep, DF_NAME.diet]) {
      await formRow(m1, name).getByTestId('vatc-form-send').click();
      await expect(formRow(m1, name).getByTestId('vatc-form-status')).toHaveText('Waiting for participant', { timeout: 15_000 });
    }
    for (const key of ['life', 'sleep', 'diet']) {
      expect(await req(FATC.M1, DF[key]), `M1 ${key} request`).toMatchObject({ atcid: FATC.M1, formid: DF[key], profileid: PF.tfm, formstatus: 'sent' });
    }
    // S9 — the soft-deleted form already sent: Waiting + Withdraw, no "not required"
    await expect(formRow(m1, DF_NAME.old).getByTestId('vatc-form-status')).toHaveText('Waiting for participant');
    await expect(formRow(m1, DF_NAME.old).getByTestId('vatc-form-revoke')).toBeVisible();
    await closeFull(m1);
    // S7 — send diet on M5, then the ATC is edited (M5 → M5B, the shape the Edit screen leaves)
    const m5 = await openFull(page, FATC.M5);
    await formRow(m5, DF_NAME.diet).getByTestId('vatc-form-send').click();
    await waitFor(() => req(FATC.M5, DF.diet), 'M5 diet request');
    const m5data = await atcDoc(`atc_alpha/${FATC.M5}`);
    await atcDb().doc(`atc_alpha/${FATC.M5B}`).set({ ...m5data, atcid: FATC.M5B, editedfrom: atcDb().doc(`atc_alpha/${FATC.M5}`) });
    await atcDb().doc(`atc_alpha/${FATC.M5}`).update({ status: 'upgraded', isdelete: true, upgradedto: atcDb().doc(`atc_alpha/${FATC.M5B}`) });
    // S8 — M3 (pending sleep request) is deleted before the app submits
    await atcDb().doc(`atc_alpha/${FATC.M3}`).update({ isdelete: true });
  });

  test('web2 the app submissions show; withdraw M1 diet; ask the participant to update M1 life', async ({ page }) => {
    test.skip(PHASE !== 'web2', 'scenario phase web2 only');
    await openTfm(page);
    const m1 = await openFull(page, FATC.M1);
    const life = formRow(m1, DF_NAME.life);
    await expect(life.getByTestId('vatc-form-status')).toHaveText('Submitted', { timeout: 20_000 });
    await expect(life.getByTestId('vatc-form-note')).toHaveText('Filled by the participant');
    await life.getByTestId('vatc-form-view').click();
    await expect(page.getByTestId('fov-panel-3')).toContainText(APP_TEXT_1, { timeout: 15_000 });
    await page.getByTestId('fov-close-2').click();
    // S6a — withdraw diet (never filled) → the card leaves the app
    await formRow(m1, DF_NAME.diet).getByTestId('vatc-form-revoke').click();
    await waitFor(async () => !(await req(FATC.M1, DF.diet)), 'M1 diet withdrawn');
    expect(guard.dialogs).toContain("confirm: Withdraw this form? The participant won't be able to submit it.");
    await expect(formRow(m1, DF_NAME.diet).getByTestId('vatc-form-status')).toHaveText('Not sent', { timeout: 15_000 });
    // S2 — ask to update life → the same request, answerid = the app's answer
    const answerId = (await atcDoc(`atc_alpha/${FATC.M1}`)).formsubmitted[DF.life];
    await life.getByTestId('vatc-form-resend').click();
    await waitFor(async () => (await req(FATC.M1, DF.life))?.formstatus === 'sent', 'M1 life asked to update');
    expect((await req(FATC.M1, DF.life)).answerid).toBe(answerId);
    await expect(life.getByTestId('vatc-form-status')).toHaveText('Waiting for update', { timeout: 15_000 });
    await closeFull(m1);
    // S7 — the edited ATC shows the app's diet answer on M5B (M5 is retired, not listed)
    await expect(row(page, FATC.M5)).toHaveCount(0);
    const m5b = await openFull(page, FATC.M5B);
    await expect(formRow(m5b, DF_NAME.diet).getByTestId('vatc-form-status')).toHaveText('Submitted', { timeout: 20_000 });
    // S8 — the deleted ATC is not listed
    await expect(row(page, FATC.M3)).toHaveCount(0);
  });

  test('web3 the resubmission updated the same answer; final states', async ({ page }) => {
    test.skip(PHASE !== 'web3', 'scenario phase web3 only');
    const atc = await atcDoc(`atc_alpha/${FATC.M1}`);
    const answerId = atc.formsubmitted[DF.life];
    const answer = (await formsDb().collection('formsByClient').doc(answerId).get()).data();
    expect(answer.formarray.find((f: any) => f.fieldname === DF_QUESTION).value).toBe(APP_TEXT_2);
    const logs = await formsDb().collection('formsByClient log').where('docid', '==', answerId).get();
    expect(logs.docs.map((d) => d.data().formarray.find((f: any) => f.fieldname === DF_QUESTION).value)).toContain(APP_TEXT_1);
    await openTfm(page);
    const m1 = await openFull(page, FATC.M1);
    await expect(formRow(m1, DF_NAME.life).getByTestId('vatc-form-status')).toHaveText('Submitted', { timeout: 20_000 });
    await formRow(m1, DF_NAME.life).getByTestId('vatc-form-view').click();
    await expect(page.getByTestId('fov-panel-3')).toContainText(APP_TEXT_2, { timeout: 15_000 });
    await page.getByTestId('fov-close-2').click();
    // S6b — the request deleted while the app had the form open → Not sent
    await expect(formRow(m1, DF_NAME.sleep).getByTestId('vatc-form-status')).toHaveText('Not sent', { timeout: 15_000 });
    await expect(formRow(m1, DF_NAME.diet).getByTestId('vatc-form-status')).toHaveText('Not sent');
  });
});
