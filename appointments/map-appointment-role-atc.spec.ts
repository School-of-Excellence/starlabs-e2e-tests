// map-appointment-role-atc.spec.ts — the ATC section of the Map Appointment Role dialog (2026-10-22), EMULATOR ONLY.
//
// Hook prefix: mard (MapAppointmentRoleDialogComponent) and mar (its list screen, the opener).
// Plans: starlabs-angular specs/plans/2026-10-15-map-appointment-role-atc.md, 2026-10-22-map-appointment-role-dialog-ui.md.
//
// Asserts what the APP writes to AppointmentType-To-Roles (read back via the Admin SDK) — never a value the test
// wrote. The suite seed gives R1/R2 roles (with `id`); this file adds (beforeAll, seedDialogAtc) three ATC
// activities with an atcproperty (+ one without, which must not be offered), the `atc model` names, and ATR2R
// prescribing an EI Solution ATC, and removes them in afterAll. Cases run in order (create → validate → edit → scroll).
import { test, expect, Page, Locator } from '@playwright/test';
import { loginAsApptAdmin, installApptStubs } from './support/appt';

const S = require('./seed-appointments');
const { initAdminAuto } = require('../lib/seed-common');
const ID = S.ID;
const ACT = S.ATC_ACT;
const ACT_NAME = S.ATC_ACT_NAME;
const MODEL = S.ATC_MODEL;

function db() { return initAdminAuto().firestore(); }
async function mappingFor(typeId: string): Promise<any | null> {
  const snap = await db().collection('AppointmentType-To-Roles').where('assigned_appttype_ref', '==', db().collection('appointmenttype').doc(typeId)).get();
  return snap.empty ? null : snap.docs[0].data();
}
async function waitFor<T>(fn: () => Promise<T>, what: string, timeoutMs = 30_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  let last: T;
  while (Date.now() < end) { last = await fn(); if (last) return last; await new Promise((r) => setTimeout(r, 500)); }
  throw new Error(`timed out after ${timeoutMs}ms waiting for: ${what}`);
}

/** Open a mat-select (via its form field) and click the matching option(s); Escape closes a multi-select. */
async function pick(page: Page, select: Locator, labels: (string | RegExp)[], multiple = true) {
  const field = select.locator('xpath=ancestor::mat-form-field[1]');
  const panel = page.locator('.cdk-overlay-pane .mat-mdc-select-panel').last();
  await expect(async () => {
    if (!(await panel.isVisible())) { if (await field.count()) await field.click(); else await select.click(); }
    await expect(panel).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  for (const l of labels) await panel.locator('mat-option').filter({ hasText: l }).first().click();
  if (multiple) await page.keyboard.press('Escape');
  await expect(page.locator('.cdk-overlay-pane .mat-mdc-select-panel')).toHaveCount(0);
}
async function optionTexts(page: Page, select: Locator): Promise<string[]> {
  const field = select.locator('xpath=ancestor::mat-form-field[1]');
  const panel = page.locator('.cdk-overlay-pane .mat-mdc-select-panel').last();
  await expect(async () => {
    if (!(await panel.isVisible())) await field.click();
    await expect(panel).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  const texts = (await panel.locator('mat-option').allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press('Escape');
  await expect(page.locator('.cdk-overlay-pane .mat-mdc-select-panel')).toHaveCount(0);
  return texts;
}
const dialog = (page: Page) => page.locator('mat-dialog-container');
const formSelect = (page: Page, control: string) => dialog(page).locator(`mat-select[formcontrolname="${control}"]`);

async function openList(page: Page) {
  await loginAsApptAdmin(page);
  await page.goto('/mapappointmentrole');
  await expect(page.locator('tr.mat-mdc-row').first()).toBeVisible({ timeout: 45_000 });
}
async function openEdit(page: Page, typeName: string) {
  await page.locator('tr.mat-mdc-row').filter({ hasText: typeName }).getByTestId('mar-update-data-2').click();
  await expect(dialog(page)).toBeVisible({ timeout: 15_000 });
}

test.describe.serial('Scheduling — Map Appointment Role dialog: ATC section (emulator)', () => {
  // This file OWNS its ATC data (2026-10-23, scoped cleanup): the ATC activities / models / ATR2R's ATC fields are
  // added here, not by the suite seed, and everything is put back afterwards — ATR2R exactly as seeded (the
  // scheduling suite books on it), the AT2 mapping created by MARD-ATC-01 deleted — so nothing lingers on a
  // shared emulator for later files or the ATC suite (which reads bigactivity + `atc model` app-wide).
  let atr2rSeed: any;
  test.beforeAll(async () => {
    atr2rSeed = (await db().collection('AppointmentType-To-Roles').doc(ID.ATR2R).get()).data();
    await S.seedDialogAtc(db());
  });
  test.afterAll(async () => {
    await S.removeDialogAtc(db());
    if (atr2rSeed) await db().collection('AppointmentType-To-Roles').doc(ID.ATR2R).set(atr2rSeed);
    const snap = await db().collection('AppointmentType-To-Roles').where('assigned_appttype_ref', '==', db().collection('appointmenttype').doc(ID.AT2)).get();
    for (const d of snap.docs) await d.ref.delete();
  });
  test.beforeEach(async ({ page }) => { await installApptStubs(page); });

  test('MARD-ATC-01 create: ATC model + activities per required AND additional role are saved as atcrolemap arrays', async ({ page }) => {
    expect(await mappingFor(ID.AT2), 'precondition: Test Implementation has no mapping yet').toBeNull();
    await openList(page);
    await page.getByTestId('mar-update-data-1').click();
    await expect(dialog(page)).toBeVisible({ timeout: 15_000 });
    await pick(page, formSelect(page, 'selectedApptType'), ['Test Implementation'], false);

    // ticked with no role yet → the hint, no rows
    await page.getByTestId('mard-atc-card-3').getByTestId('mard-atc-required-4').locator('input').check();
    await expect(page.getByTestId('mard-atc-norole-5')).toBeVisible();

    await pick(page, formSelect(page, 'required_role'), ['Primary Specialist']);
    await pick(page, formSelect(page, 'additional_role'), ['Secondary Specialist']);
    await expect(page.getByTestId('mard-atc-norole-5')).toHaveCount(0);
    await expect(page.getByTestId('mard-atc-role-6')).toHaveCount(2);
    await expect(page.getByTestId('mard-atc-role-6').nth(1)).toContainText('Additional');

    // options: the ATC models, and only activities that carry an atcproperty
    const models = await optionTexts(page, page.getByTestId('mard-atc-model-8'));
    expect(models).toEqual(expect.arrayContaining([MODEL.ei, MODEL.wish]));
    const acts = await optionTexts(page, page.getByTestId('mard-atc-activity-7').first());
    expect(acts).toEqual(expect.arrayContaining([`${ACT_NAME.author} · author`, `${ACT_NAME.observer} · observer`, `${ACT_NAME.ca} · assigned_to`]));
    expect(acts.some((t) => t.includes(ACT_NAME.plain)), 'an activity without atcproperty is not offered').toBe(false);

    await pick(page, page.getByTestId('mard-atc-model-8'), [MODEL.ei], false);
    await pick(page, page.getByTestId('mard-atc-activity-7').nth(0), [ACT_NAME.author]);
    await pick(page, page.getByTestId('mard-atc-activity-7').nth(1), [ACT_NAME.observer, ACT_NAME.ca]);
    await page.getByTestId('mard-onformsubmit-2').click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 15_000 });

    const m = await waitFor(() => mappingFor(ID.AT2), 'mapping written for Test Implementation');
    expect(m.atcrequired).toBe(true);
    expect(m.atcmodel).toBe(MODEL.ei);
    // a multi-select keeps option-list order (not click order); the order carries no meaning → compare sorted
    const sorted = (map: any) => Object.fromEntries(Object.entries(map || {}).map(([k, v]: any) => [k, [...v].sort()]));
    expect(sorted(m.atcrolemap)).toEqual(sorted({ [ID.R1]: [ACT.author], [ID.R2]: [ACT.observer, ACT.ca] }));
    expect((m.required_role || []).map((r: any) => r.id)).toEqual([ID.R1]);
    expect((m.additional_role || []).map((r: any) => r.id)).toEqual([ID.R2]);
  });

  test('MARD-ATC-02 ticked ATC needs a model and each required role an activity; nothing is written until then', async ({ page }) => {
    const before = await mappingFor(ID.AT1);
    expect(before.atcrequired, 'precondition: Test Diagnostic has no ATC').toBeUndefined();
    await openList(page);
    await openEdit(page, 'Test Diagnostic');
    await page.getByTestId('mard-atc-required-4').locator('input').check();
    await page.getByTestId('mard-onformsubmit-2').click();
    await expect(dialog(page)).toContainText('ATC model required');
    await expect(dialog(page)).toContainText('Activity required');
    await expect(dialog(page), 'blocked: the dialog stays open').toBeVisible();
    await page.waitForTimeout(1000);
    expect((await mappingFor(ID.AT1)).atcrequired, 'nothing written').toBeUndefined();
    await page.getByTestId('mard-close-1').click();
    await expect(dialog(page)).toHaveCount(0);
  });

  test('MARD-ATC-03 edit: the saved ATC loads; a removed role leaves atcrolemap; unticking clears model + map', async ({ page }) => {
    await openList(page);
    await openEdit(page, 'Test Two-Role');
    await expect(page.getByTestId('mard-atc-required-4').locator('input')).toBeChecked();
    await expect(page.getByTestId('mard-atc-model-8')).toContainText(MODEL.ei);
    await expect(page.getByTestId('mard-atc-activity-7').nth(0)).toContainText(ACT_NAME.author);
    await expect(page.getByTestId('mard-atc-activity-7').nth(1)).toContainText(ACT_NAME.observer);

    // drop R2 from the required roles → its row and its atcrolemap key go
    await pick(page, formSelect(page, 'required_role'), ['Secondary Specialist']);   // toggles it off
    await expect(page.getByTestId('mard-atc-role-6')).toHaveCount(1);
    await page.getByTestId('mard-onformsubmit-2').click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 15_000 });
    const m1 = await waitFor(async () => { const m = await mappingFor(ID.AT2R); return m && !m.atcrolemap?.[ID.R2] ? m : null; }, 'R2 removed from atcrolemap');
    expect(m1.atcrolemap).toEqual({ [ID.R1]: [ACT.author] });
    expect(m1.atcmodel).toBe(MODEL.ei);
    expect(m1.testrunid, 'mergeFields keeps fields the dialog does not own').toBe(S.TESTRUNID);

    // untick → atcrequired false, atcmodel null, atcrolemap {}
    await openEdit(page, 'Test Two-Role');
    await page.getByTestId('mard-atc-required-4').locator('input').uncheck();
    await page.getByTestId('mard-onformsubmit-2').click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 15_000 });
    const m2 = await waitFor(async () => { const m = await mappingFor(ID.AT2R); return m && m.atcrequired === false ? m : null; }, 'ATC unticked');
    expect(m2.atcmodel).toBeNull();
    expect(m2.atcrolemap).toEqual({});
  });

  test('MARD-ATC-04 a short window: the dialog body scrolls and Update Role stays on screen', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 600 });
    await openList(page);
    await openEdit(page, 'Test Implementation');                     // created by MARD-ATC-01: 2 ATC rows + model
    await expect(page.getByTestId('mard-atc-role-6')).toHaveCount(2);
    const body = dialog(page).locator('.mard-body');
    const scroll = await body.evaluate((el) => ({ scrollH: el.scrollHeight, clientH: el.clientHeight, overflowY: getComputedStyle(el).overflowY }));
    expect(scroll.overflowY).toBe('auto');
    expect(scroll.scrollH, 'content is taller than the body → it scrolls').toBeGreaterThan(scroll.clientH);
    const btn = await page.getByTestId('mard-onformsubmit-2').boundingBox();
    expect(btn, 'Update Role rendered').not.toBeNull();
    expect(btn!.y + btn!.height, 'Update Role inside the 600px window').toBeLessThanOrEqual(600);
    await page.getByTestId('mard-close-1').click();
  });
});
