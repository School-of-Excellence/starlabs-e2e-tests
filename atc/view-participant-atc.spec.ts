// view-participant-atc.spec.ts — /view-participant-atc (VPA-01..03), EMULATOR ONLY. Phase 2, plan 2026-10-17.
//
// A participant's ATC history, grouped by CONSECUTIVE product. Expected groups are computed from the emulator
// (alpha + to-validate 'atc given', newest first) and compared with what the app rendered.
import { test, expect } from '@playwright/test';
import {
  ATC2, PF, PROC_NAME, MODEL, RUN, installAtcGuards, assertNoRealDb, loginAsAtc, atcDb, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

async function expectedGroups(pid: string) {
  const alpha = (await atcDb().collection('atc_alpha').where('profileid', '==', pid).where('isdelete', '==', false).get()).docs;
  const tov = (await atcDb().collection('atc_to_validate').where('profileid', '==', pid).where('isdelete', '==', false)
    .where('status', '==', 'atc given').get()).docs;
  const all = [...alpha, ...tov].map((d) => d.data()).filter((d) => d.type === 'online')
    .sort((a, b) => b.prescription_date.toMillis() - a.prescription_date.toMillis());
  const groups: { product: string; n: number }[] = [];
  for (const d of all) {
    if (groups.length && groups[groups.length - 1].product === d.product) groups[groups.length - 1].n++;
    else groups.push({ product: d.product, n: 1 });
  }
  return groups;
}
const card = (page, id: string) => page.locator(`[data-testid="vpa-card"][data-atc="${id}"]`);

test.describe('ATC — View Participant ATC (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'view participant atc: no fatal console errors');
  });

  test('VPA-01 the history is grouped by consecutive product, with validated / pending pills', async ({ page }) => {
    const want = await expectedGroups(PF.vpa);
    expect(want, 'precondition: alpha, alpha, then a pending beta').toEqual([{ product: MODEL.alpha, n: 2 }, { product: MODEL.beta, n: 1 }]);
    await loginAsAtc(page, 'admin');
    await page.goto(`/view-participant-atc?profileid=${PF.vpa}`);
    await expect(page.getByTestId('vpa-group')).toHaveCount(want.length, { timeout: 45_000 });
    await expect(page.getByTestId('vpa-product')).toHaveText(want.map((g) => g.product));
    for (let i = 0; i < want.length; i++) {
      await expect(page.getByTestId('vpa-group').nth(i).getByTestId('vpa-card')).toHaveCount(want[i].n);
    }
    await expect(card(page, ATC2.VPA1).getByTestId('vpa-pill-validated')).toBeVisible();
    await expect(card(page, ATC2.VPA3).getByTestId('vpa-pill-pending')).toBeVisible();
  });

  test('VPA-02 View Full ATC expands the adjustments and procedures', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto(`/view-participant-atc?profileid=${PF.vpa}`);
    const c = card(page, ATC2.VPA1);
    await expect(c).toBeVisible({ timeout: 45_000 });
    await c.getByTestId('vpa-toggle').click();
    await expect(c.getByTestId('vpa-adj-name')).toContainText(`VPA1 adjustment ${RUN}`, { timeout: 20_000 });
    await expect(c.getByTestId('vpa-proc-name').first()).toContainText(PROC_NAME.one);
  });

  test('VPA-03 no participant → the empty state', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto('/view-participant-atc');
    await expect(page.getByTestId('vpa-no-data')).toBeVisible({ timeout: 45_000 });
  });
});
