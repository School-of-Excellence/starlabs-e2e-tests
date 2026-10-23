// view-atc-templates.spec.ts — Ask / WiSH outcomes on the read-only ATC screens (VATT-01..02), EMULATOR ONLY.
//
// Hook prefixes: vatc (ViewPrescribedATCComponent), pva (AtcPreviewComponent) — each declared by its own screen.
// Plan: starlabs-angular specs/plans/2026-10-23-atc-overnight-goal.md §3 — View Prescribed's full ATC and the
// /previewATC page show "Ask · area of focus" / "WiSH outcomes" only when the ATC has them, and label a WiSH
// directive "Immediate outcome". The ATCs are seed-atc.js phase 4 (tvv: vEI, vWish) — read-only here; a plain ATC
// (A1) is the negative control.
import { test, expect, Page } from '@playwright/test';
import {
  ATC, PA, NAME, TPL, TPL_ASKS, TPL_OUTCOMES, installAtcGuards, assertNoRealDb, loginAsAtc, pickOptions, tid, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

async function openView(page: Page) {
  await loginAsAtc(page, 'admin');
  await page.goto('/viewprescribedATC');
  await expect(page.getByTestId('vatc-count')).toBeVisible({ timeout: 45_000 });
  // only tvv's ATCs (they are dated far back, past page 1 of the unfiltered list)
  await pickOptions(page, page.getByTestId('vatc-filter-participant'), [NAME.tvv]);
  await expect(page.getByTestId('vatc-count')).toHaveText(/Showing 3 ATCs/, { timeout: 30_000 });
}
const row = (page: Page, id: string) => page.locator(tid(`vatc-row-${id}`));
async function openFull(page: Page, id: string) {
  const r = row(page, id);
  await expect(r).toBeVisible({ timeout: 45_000 });
  await r.getByTestId('vatc-toggle-full').click();
  await expect(r.locator(tid('vatc-adj-0'))).toBeVisible({ timeout: 45_000 });
  return r;
}
async function openPreview(page: Page, id: string, signIn = true) {
  if (signIn) await loginAsAtc(page, 'admin');      // a signed-in page sent to '/' skips the login form
  await page.goto(`/previewATC?type=alpha&atcdocid=${id}&participantassignmentid=${PA.activity}`);
  await expect(page.getByTestId('pva-participant')).toBeVisible({ timeout: 45_000 });
}

test.describe('ATC — Ask / WiSH outcomes on View Prescribed + Preview (emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);   // three full ATCs / three preview pages per case
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'view atc templates: no fatal console errors');
  });

  test('VATT-01 View Prescribed: EI shows its asks, WiSH its outcomes + "Immediate outcome"; a plain ATC shows neither', async ({ page }) => {
    await openView(page);
    const ei = await openFull(page, TPL.vEI);
    await expect(ei).toContainText('ATC Directive:');
    await expect(ei.getByTestId('vatc-ask-card')).toContainText('Ask · area of focus');
    await expect(ei.getByTestId('vatc-ask-row')).toHaveCount(2);
    await expect(ei.getByTestId('vatc-ask-row').nth(0)).toContainText('Self');
    await expect(ei.getByTestId('vatc-ask-row').nth(0)).toContainText(TPL_ASKS[0].askedfor);
    await expect(ei.getByTestId('vatc-ask-row').nth(1)).toContainText('Spouse');
    await expect(ei.getByTestId('vatc-outcome-card')).toHaveCount(0);

    const wish = await openFull(page, TPL.vWish);
    await expect(wish).toContainText('Immediate outcome:');
    await expect(wish).not.toContainText('ATC Directive:');
    await expect(wish.getByTestId('vatc-outcome-card')).toContainText('WiSH outcomes');
    await expect(wish.getByTestId('vatc-outcome-row')).toHaveCount(2);
    await expect(wish.getByTestId('vatc-outcome-row').nth(0)).toContainText('01');
    await expect(wish.getByTestId('vatc-outcome-row').nth(0)).toContainText(TPL_OUTCOMES[0].outcomearea);
    await expect(wish.getByTestId('vatc-outcome-row').nth(1)).toContainText(TPL_OUTCOMES[1].outcomeexpected);
    await expect(wish.getByTestId('vatc-ask-card')).toHaveCount(0);

    const plain = await openFull(page, TPL.vPlain);
    await expect(plain.getByTestId('vatc-ask-card')).toHaveCount(0);
    await expect(plain.getByTestId('vatc-outcome-card')).toHaveCount(0);
  });

  test('VATT-02 /previewATC: the same cards and labels; a plain ATC shows neither', async ({ page }) => {
    await openPreview(page, TPL.vEI);
    await expect(page.getByTestId('pva-directive')).toBeVisible();
    await expect(page.getByText('ATC Directive', { exact: true })).toBeVisible();
    await expect(page.getByTestId('pva-ask-card')).toBeVisible();
    await expect(page.getByTestId('pva-ask-row')).toHaveCount(2);
    await expect(page.getByTestId('pva-ask-row').nth(0)).toContainText('Self');
    await expect(page.getByTestId('pva-ask-row').nth(0)).toContainText(TPL_ASKS[0].askedfor);
    await expect(page.getByTestId('pva-outcome-card')).toHaveCount(0);

    await openPreview(page, TPL.vWish, false);
    await expect(page.getByText('Immediate outcome', { exact: true })).toBeVisible();
    await expect(page.getByTestId('pva-outcome-row')).toHaveCount(2);
    await expect(page.getByTestId('pva-outcome-row').nth(1)).toContainText(TPL_OUTCOMES[1].outcomearea);
    await expect(page.getByTestId('pva-ask-card')).toHaveCount(0);

    await openPreview(page, ATC.A1, false);
    await expect(page.getByTestId('pva-ask-card')).toHaveCount(0);
    await expect(page.getByTestId('pva-outcome-card')).toHaveCount(0);
  });
});
