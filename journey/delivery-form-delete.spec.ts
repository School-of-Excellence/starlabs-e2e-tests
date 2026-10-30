// delivery-form-delete.spec.ts — every delivery form carries `delete`; Delete / Restore (/deliveryactivities + the
// Update Delivery dialog), EMULATOR. Hook prefixes: ds1 (delivery-set), ud (update-delivery).
// Why: screens that list forms (e.g. the ATC model dialog) need `delete` on every doc to query active forms; most
// existing docs have no field, so a save now writes it (new / active → false, a deleted form stays true).
// Anti-circularity: every expectation reads the doc back from the emulator with the Admin SDK.
import { test, expect, Page } from '@playwright/test';
import { installJourneyStubs, loginAsJourneyAdmin } from './support/journey';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const seed = require('../fixtures/seed-test-project');
const RUN = process.env.JNY_RUNID || 'jny';
const db = () => seed.initAdmin().firestore();
const ID = `${RUN}_dfd_form`;
const NAME = `DFD Delete flag form ${RUN}`;
const formDoc = async () => (await db().collection('delivery forms').doc(ID).get()).data();

async function openDialog(page: Page) {
  await page.goto('/deliveryactivities', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Filter').fill(NAME);
  const row = page.locator('tr.mat-mdc-row').filter({ hasText: NAME });
  await expect(row).toHaveCount(1, { timeout: 45_000 });
  await row.getByTestId('ds1-edit-delivery-3').click();
  await expect(page.getByTestId('ud-submit-form-15')).toBeVisible({ timeout: 20_000 });
  return row;
}

test.describe('Product Designer — delivery form delete flag + Restore (real UI, emulator)', () => {
  test.beforeAll(async () => {
    // an existing form from before the change: NO delete field
    await db().collection('delivery forms').doc(ID).set({
      docid: ID, formname: NAME, formtype: 'participant', formfor: null, formdescription: null, testrunid: RUN,
      formarray: [{ type: 'Text', fieldname: `DFD question ${RUN}`, fielddescription: '', fieldnotes: '', required: false, options: [], array: [] }],
    });
  });
  test.afterAll(async () => { await db().collection('delivery forms').doc(ID).delete().catch(() => {}); });
  test.beforeEach(async ({ page }) => {
    await installJourneyStubs(page);
    page.on('dialog', (d) => d.accept().catch(() => {}));   // Delete / Restore confirm()
  });

  test('DFD-01 save writes delete:false; Delete → true + "(Deleted)"; a deleted form shows Restore (not Delete), saving keeps it deleted; Restore → false', async ({ page }) => {
    expect((await formDoc()).delete, 'precondition: no delete field').toBeUndefined();
    await loginAsJourneyAdmin(page);

    // 1) save an existing form → delete:false is written
    await openDialog(page);
    await expect(page.getByTestId('ud-restore-form-24')).toHaveCount(0);
    await page.getByTestId('ud-submit-form-15').click();
    await expect.poll(async () => (await formDoc()).delete, { timeout: 20_000 }).toBe(false);
    await page.getByTestId('ud-close-dialog-14').click();

    // 2) Delete → delete:true, the list marks it
    await openDialog(page);
    await page.getByTestId('ud-delete-form-13').click();
    await expect.poll(async () => (await formDoc()).delete, { timeout: 20_000 }).toBe(true);
    const row = page.locator('tr.mat-mdc-row').filter({ hasText: NAME });
    await expect(row).toContainText('(Deleted)', { timeout: 20_000 });

    // 3) a deleted form: Restore instead of Delete; saving it keeps delete:true
    await openDialog(page);
    await expect(page.getByTestId('ud-delete-form-13')).toHaveCount(0);
    await expect(page.getByTestId('ud-restore-form-24')).toBeVisible();
    await page.getByTestId('ud-submit-form-15').click();
    await page.waitForTimeout(1_500);
    expect((await formDoc()).delete, 'saving a deleted form does not undelete it').toBe(true);

    // 4) Restore → delete:false, the mark goes
    await page.getByTestId('ud-restore-form-24').click();
    await expect.poll(async () => (await formDoc()).delete, { timeout: 20_000 }).toBe(false);
    await expect(row).not.toContainText('(Deleted)', { timeout: 20_000 });
  });
});
