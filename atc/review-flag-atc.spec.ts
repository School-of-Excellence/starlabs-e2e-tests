// review-flag-atc.spec.ts — /reviewflagATC + Add Review Notes dialog (RFA-01..05), EMULATOR ONLY. Phase 2.
//
// Five tabs (Yet to Validate / Validated / Mandatory / Enhanced / Final). Tab counts are computed from the
// emulator; each action uses its own seeded ATC (RF_V, RF_A, RF_F1..F3).
import { test, expect, Page } from '@playwright/test';
import {
  ATC2, PF, NAME, RUN, installAtcGuards, assertNoRealDb, loginAsAtc, atcDb, atcDoc, waitFor, pickOptions, popupFrom, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const FLAG_TYPES = ['finalreview', 'flagmandatory', 'flagenhance'];
const panel = (page: Page, id: string) => page.locator(`[data-testid="rfa-panel"][data-atc="${id}"]`);
const tab = (page: Page, name: RegExp) => page.getByRole('tab', { name });
async function open(page: Page) {
  await loginAsAtc(page, 'admin');
  await page.goto('/reviewflagATC');
  await expect(tab(page, /Yet to Validate/)).toBeVisible({ timeout: 45_000 });
}

test.describe('ATC — Review / Flag (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'review flag atc: no fatal console errors');
  });

  test('RFA-01 tab counts match the emulator; the client filter narrows; Reset restores', async ({ page }) => {
    const tov = (await atcDb().collection('atc_to_validate').where('isdelete', '==', false).where('type', '==', 'online')
      .where('status', '==', 'atc given').get()).size;
    const alpha = (await atcDb().collection('atc_alpha').where('isdelete', '==', false).where('type', '==', 'online').get())
      .docs.map((d) => d.data());
    const validated = alpha.filter((d) => !FLAG_TYPES.includes(d.flagtype)).length;
    await open(page);
    await expect(tab(page, /Yet to Validate/)).toHaveText(new RegExp(`\\(${tov}\\)`), { timeout: 20_000 });
    await expect(tab(page, /Validated By Arena Mentor/)).toHaveText(new RegExp(`\\(${validated}\\)`));
    await expect(panel(page, ATC2.RF_V)).toBeVisible();
    await panel(page, ATC2.RF_V).click();
    await expect(panel(page, ATC2.RF_V).getByTestId('rfa-adj').first()).toContainText(`RF_V adjustment ${RUN}`, { timeout: 20_000 });

    await pickOptions(page, page.getByTestId('rfa-filter-client'), [NAME.rfa], false);
    await expect(tab(page, /Yet to Validate/)).toHaveText(/\(1\)/, { timeout: 20_000 });
    await page.getByTestId('rfa-reset').click();
    await expect(tab(page, /Yet to Validate/)).toHaveText(new RegExp(`\\(${tov}\\)`), { timeout: 20_000 });
  });

  test('RFA-02 Mark ATC as Validated with a validator', async ({ page }) => {
    await open(page);
    await panel(page, ATC2.RF_V).getByTestId('rfa-validate').click();
    await pickOptions(page, page.getByTestId('selv-select'), [NAME.mentor]);
    await page.getByTestId('selv-submit').click();
    const d = await waitFor(async () => { const x = await atcDoc(`atc_to_validate/${ATC2.RF_V}`); return x?.status === 'validated' ? x : null; }, 'validated');
    expect((d.validator || []).map((r: any) => r.id)).toEqual([PF.mentor]);
  });

  test('RFA-03 each flag writes flagtype + the comment, and moves the ATC to its tab', async ({ page }) => {
    await open(page);
    await tab(page, /Validated By Arena Mentor/).click();
    // buttons named literally (the readiness check only counts literal hook references)
    const cases: [string, () => Promise<void>, string, RegExp][] = [
      [ATC2.RF_F1, () => panel(page, ATC2.RF_F1).getByTestId('rfa-flag-mandatory').click(), 'flagmandatory', /Marked for Mandatory/],
      [ATC2.RF_F2, () => panel(page, ATC2.RF_F2).getByTestId('rfa-flag-enhance').click(), 'flagenhance', /Marked for Enhanced/],
      [ATC2.RF_F3, () => panel(page, ATC2.RF_F3).getByTestId('rfa-flag-final').click(), 'finalreview', /Approved ATC as Final/],
    ];
    for (const [id, clickFlag, type] of cases) {
      await clickFlag();
      await expect(page.getByTestId('arn-heading')).toBeVisible();
      await page.getByTestId('arn-text').fill(`${type} comment ${RUN}`);
      await page.getByTestId('arn-confirm').click();
      const d = await waitFor(async () => { const x = await atcDoc(`atc_alpha/${id}`); return x?.flagtype === type ? x : null; }, `${id} flagged ${type}`);
      expect(d.flagcomment.at(-1)).toMatchObject({ comment: `${type} comment ${RUN}`, addedby: PF.admin, type });
    }
    for (const [id, , type, tabName] of cases) {
      await tab(page, tabName).click();
      await expect(panel(page, id).getByTestId('rfa-last-comment')).toContainText(`${type} comment ${RUN}`, { timeout: 20_000 });
    }
  });

  test('RFA-04 the notes dialog: ×, Close and an empty Confirm write nothing', async ({ page }) => {
    await open(page);
    await tab(page, /Validated By Arena Mentor/).click();
    const flag = panel(page, ATC2.RF_A).getByTestId('rfa-flag-mandatory');
    await flag.click();
    await page.getByTestId('arn-x').click();
    await flag.click();
    await page.getByTestId('arn-close').click();
    await flag.click();
    await page.getByTestId('arn-confirm').click();   // nothing typed
    await page.waitForTimeout(1500);
    const d = await atcDoc(`atc_alpha/${ATC2.RF_A}`);
    expect(d.flagtype, 'no flag written').toBeUndefined();
    expect(d.flagcomment).toBeUndefined();
  });

  test('RFA-05 Edit ATC opens the edit screen for the right collection', async ({ page }) => {
    await open(page);
    const v = await popupFrom(page, () => panel(page, ATC2.RF_V).getByTestId('rfa-edit').click());
    expect(new URL(v.url()).pathname).toBe(`/editATC/${ATC2.RF_V}/validation`);
    await v.close();
    await tab(page, /Validated By Arena Mentor/).click();
    const a = await popupFrom(page, () => panel(page, ATC2.RF_A).getByTestId('rfa-edit').click());
    expect(new URL(a.url()).pathname).toBe(`/editATC/${ATC2.RF_A}/alpha`);
    await a.close();
  });
});
