// atcmodel-forms.spec.ts — ATC model forms config (/atcmodel table + the Create/Edit ATC model dialog), EMULATOR.
// Hook prefixes: va (view-atcmodel), ca (create-atcmodel). Plan: specs/plans/2026-10-29-atc-forms-step1.md (app repo).
//
// World (seeded here, run-namespaced, removed in afterAll): delivery forms A + B active, C soft-deleted (delete:true);
// one ATC model configured with A (specialist), C (participant) and a form id with no delivery forms doc.
// Anti-circularity: names on screen are compared with the seeded delivery forms; the saved config is read back
// from the emulator with the Admin SDK.
import { test, expect, Page } from '@playwright/test';
import { installJourneyStubs, loginAsJourneyAdmin } from './support/journey';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const seed = require('../fixtures/seed-test-project');
const RUN = process.env.JNY_RUNID || 'jny';
const db = () => seed.initAdmin().firestore();

const F = { a: `${RUN}_amf_a`, b: `${RUN}_amf_b`, c: `${RUN}_amf_c`, gone: `${RUN}_amf_gone` };
const NAME = { a: `AMF Alpha form ${RUN}`, b: `AMF Bravo form ${RUN}`, c: `AMF Charlie form ${RUN}` };
const MODEL_ID = `${RUN}_amf_model`;
const MODEL = `AMF Forms model ${RUN}`;
const CONFIG = [
  { formid: F.a, filledby: 'specialist' },
  { formid: F.c, filledby: 'participant' },
  { formid: F.gone, filledby: 'participant' },
];

async function openTable(page: Page) {
  await loginAsJourneyAdmin(page);
  await page.goto('/atcmodel', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Ex. Mia').fill(MODEL);
  const row = page.locator('tr.mat-mdc-row').filter({ hasText: MODEL });
  await expect(row).toHaveCount(1, { timeout: 45_000 });
  return row;
}

test.describe('Product Designer — ATC model forms config (real UI, emulator)', () => {
  test.beforeAll(async () => {
    const tag = { testrunid: RUN };
    const form = (id: string, name: string, extra = {}) => db().collection('delivery forms').doc(id).set({ docid: id, formname: name, formarray: [], ...extra, ...tag });
    await form(F.a, NAME.a);
    await form(F.b, NAME.b);
    await form(F.c, NAME.c, { delete: true });
    await db().collection('atc model').doc(MODEL_ID).set({ docid: MODEL_ID, atcmodel: MODEL, evolutiontype: 'full', forms: CONFIG, ...tag });
  });
  test.afterAll(async () => {
    for (const id of Object.values(F)) await db().collection('delivery forms').doc(id).delete().catch(() => {});
    await db().collection('atc model').doc(MODEL_ID).delete().catch(() => {});
  });
  test.beforeEach(async ({ page }) => {
    await installJourneyStubs(page);
    // reset the config before every case (AMF-03 saves a change)
    await db().collection('atc model').doc(MODEL_ID).set({ forms: CONFIG }, { merge: true });
  });

  test('AMF-01 table Forms column lists the configured form names', async ({ page }) => {
    const row = await openTable(page);
    // names read by document id: A and C (soft-deleted forms still have a name); the missing doc has none
    await expect(row.getByTestId('va-form-name')).toHaveCount(3);
    await expect(row.getByTestId('va-form-name').nth(0)).toHaveText(NAME.a, { timeout: 20_000 });
    await expect(row.getByTestId('va-form-name').nth(1)).toHaveText(NAME.c);
    await expect(row.getByTestId('va-form-name').nth(2)).toHaveText('');
    await expect(row.getByTestId('va-forms-none')).toHaveCount(0);
  });

  test('AMF-02 edit dialog: configured forms by name, inactive/missing ones flagged; "Add a form" offers only active, unchosen forms', async ({ page }) => {
    const row = await openTable(page);
    await row.getByTestId('va-on-edit-dialog-2').click();
    const rows = page.getByTestId('ca-form-row');
    await expect(rows).toHaveCount(3, { timeout: 20_000 });
    await expect(rows.nth(0)).toContainText(NAME.a);                         // active → named, first
    await expect(page.getByTestId('ca-form-missing'), 'C is soft-deleted (not loaded) and gone has no doc').toHaveCount(2);
    await expect(rows.nth(0).getByTestId('ca-form-specialist')).toHaveAttribute('class', /mat-button-toggle-checked/);

    await page.getByTestId('ca-form-input').click();
    await page.getByTestId('ca-form-input').fill(`AMF`);
    const options = page.locator('.cdk-overlay-pane mat-option');
    await expect(options.filter({ hasText: NAME.b })).toHaveCount(1, { timeout: 15_000 });
    await expect(options.filter({ hasText: NAME.a }), 'already chosen → not offered').toHaveCount(0);
    await expect(options.filter({ hasText: NAME.c }), 'soft-deleted → not offered').toHaveCount(0);
    await page.getByTestId('ca-form-input').fill('zzz-no-such-form');
    await expect(options).toHaveCount(0);
    await page.getByTestId('ca-dialog-ref-1').click();
  });

  test('AMF-03 add a form: "filled by" required before Save, then saved in name order', async ({ page }) => {
    const row = await openTable(page);
    await row.getByTestId('va-on-edit-dialog-2').click();
    await expect(page.getByTestId('ca-form-row')).toHaveCount(3, { timeout: 20_000 });
    await page.getByTestId('ca-form-input').click();
    await page.getByTestId('ca-form-input').fill(NAME.b);
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: NAME.b }).click();

    const b = page.getByTestId('ca-form-row').filter({ hasText: NAME.b });
    await expect(page.getByTestId('ca-form-row').nth(1), 'name order: A, B, then the unnamed ones').toContainText(NAME.b);
    await expect(b.getByTestId('ca-form-filledby-required')).toBeVisible();
    await expect(b.getByTestId('ca-form-filledby'), 'the Specialist / Participant toggle').toBeVisible();
    await expect(page.getByTestId('ca-on-submit-2')).toBeDisabled();
    await b.getByTestId('ca-form-participant').click();
    await expect(b.getByTestId('ca-form-filledby-required')).toHaveCount(0);
    await expect(page.getByTestId('ca-on-submit-2')).toBeEnabled();
    await page.getByTestId('ca-on-submit-2').click();

    await expect.poll(async () => (await db().collection('atc model').doc(MODEL_ID).get()).data().forms, { timeout: 20_000 }).toEqual([
      { formid: F.a, filledby: 'specialist' },
      { formid: F.b, filledby: 'participant' },
      { formid: F.c, filledby: 'participant' },
      { formid: F.gone, filledby: 'participant' },
    ]);
    await expect(row.getByTestId('va-form-name').nth(1)).toHaveText(NAME.b, { timeout: 20_000 });
  });

  test('AMF-04 remove a form takes it out of the saved config', async ({ page }) => {
    const row = await openTable(page);
    await row.getByTestId('va-on-edit-dialog-2').click();
    const rows = page.getByTestId('ca-form-row');
    await expect(rows).toHaveCount(3, { timeout: 20_000 });
    await rows.nth(0).getByTestId('ca-form-remove').click();
    await expect(rows).toHaveCount(2);
    await page.getByTestId('ca-on-submit-2').click();
    await expect.poll(async () => (await db().collection('atc model').doc(MODEL_ID).get()).data().forms.map((f: any) => f.formid), { timeout: 20_000 })
      .toEqual([F.c, F.gone]);
  });
});
