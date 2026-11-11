// atc-education.spec.ts — /atctrajectory "ATC Education" (ATE-01..06), EMULATOR ONLY. Phase 2, plan 2026-10-17.
//
// Reached only from the side menu. Lists a QUEUE's ATCs per participant; per ATC: Edit / Cancel / Validate /
// Unvalidate. ATE-05 covers bug #3 (Validate wrote a default-database ref into an ATC doc), ATE-06 bug #2
// (Edit passed type 'atc_alpha', which edit-atc does not understand) — both fixed 2026-10-17.
import { test, expect, Page } from '@playwright/test';
import {
  ATC2, PF, NAME, RUN, ATE_QUEUE_NAME, installAtcGuards, assertNoRealDb, loginAsAtc, atcDoc, waitFor, pickOptions, popupFrom, tid, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const atcCol = (page: Page, id: string) => page.locator(`[data-testid="ate-atc"][data-atc="${id}"]`).first();
async function openParticipant(page: Page) {
  await loginAsAtc(page, 'admin');
  await page.goto('/atctrajectory');
  await pickOptions(page, page.getByTestId('ate-queue'), [ATE_QUEUE_NAME], false);
  const card = page.locator(`[data-testid="ate-participant-card"][data-pid="${PF.ate}"]`).first();
  await expect(card).toBeVisible({ timeout: 45_000 });
  await card.getByTestId('ate-participant-name').click();
  await expect(atcCol(page, ATC2.ATE_A)).toBeVisible({ timeout: 45_000 });
}

test.describe('ATC — ATC Education (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'atc education: no fatal console errors');
  });

  test('ATE-01 choosing a queue lists its participants', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto('/atctrajectory');
    await pickOptions(page, page.getByTestId('ate-queue'), [ATE_QUEUE_NAME], false);
    const card = page.locator(`[data-testid="ate-participant-card"][data-pid="${PF.ate}"]`).first();
    await expect(card.getByTestId('ate-participant-name')).toHaveText(NAME.ate, { timeout: 45_000 });
  });

  test('ATE-02 a participant shows each ATC (trajectory) and the consolidated view of validated ones', async ({ page }) => {
    await openParticipant(page);
    await expect(atcCol(page, ATC2.ATE_V)).toBeVisible();
    await expect(atcCol(page, ATC2.ATE_V).getByTestId('ate-status')).toHaveText('Yet to validate');
    await expect(page.locator(`[data-testid="ate-consolidated"][data-atc="${ATC2.ATE_A}"]`).first()).toBeVisible();
    await expect(page.locator(`[data-testid="ate-consolidated"][data-atc="${ATC2.ATE_V}"]`), 'only validated ATCs are consolidated').toHaveCount(0);
    await page.getByTestId('ate-back').click();
    await expect(page.locator(`[data-testid="ate-participant-card"][data-pid="${PF.ate}"]`).first()).toBeVisible();
  });

  test('ATE-03 Cancel retires the ATC', async ({ page }) => {
    await openParticipant(page);
    await atcCol(page, ATC2.ATE_C).getByTestId('ate-cancel').click();
    await waitFor(async () => { const d = await atcDoc(`atc_alpha/${ATC2.ATE_C}`); return d?.status === 'cancelled' && d.isdelete === true; }, 'cancelled');
  });

  test('ATE-04 Unvalidate retires a validated ATC', async ({ page }) => {
    await openParticipant(page);
    await atcCol(page, ATC2.ATE_U).getByTestId('ate-unvalidate').click();
    await waitFor(async () => { const d = await atcDoc(`atc_alpha/${ATC2.ATE_U}`); return d?.status === 'unvalidated' && d.isdelete === true; }, 'unvalidated');
  });

  test('ATE-05 Validate with a selected validator saves it (bug #3 fixed)', async ({ page }) => {
    await openParticipant(page);
    await atcCol(page, ATC2.ATE_V).getByTestId('ate-validate').click();
    await pickOptions(page, page.getByTestId('dbs-mat-select'), [NAME.mentor]);
    await page.getByTestId('dbs-submitvalidator').click();
    const d = await waitFor(async () => { const x = await atcDoc(`atc_to_validate/${ATC2.ATE_V}`); return x?.status === 'validated' ? x : null; }, 'validated');
    expect((d.validator || []).map((r: any) => r.id)).toContain(PF.mentor);
  });

  test('ATE-06 Edit opens the validated ATC from the right collection (bug #2 fixed)', async ({ page }) => {
    await openParticipant(page);
    const popup = await popupFrom(page, () => atcCol(page, ATC2.ATE_A).getByTestId('ate-edit').click());
    expect(new URL(popup.url()).pathname).toBe(`/editATC/${ATC2.ATE_A}/alpha`);
    await expect(popup.locator(tid('eatc-exadj-0'))).toContainText(`ATE_A adjustment ${RUN}`, { timeout: 45_000 });
    await popup.close();
  });
});
