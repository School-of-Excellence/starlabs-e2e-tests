// upgraded-atc.spec.ts — /viewUpgradedATC (VUA-01..03), EMULATOR ONLY. Phase 2, plan 2026-10-17.
//
// The screen was broken (it read versions through the DEFAULT Firestore handle; versions live in firestore-atc)
// and hid everything behind a hard-coded mentor check. Both fixed 2026-10-17 — access now comes from the
// dashboard configuration only. Reached from View Prescribed ATC's version buttons (window.open popup).
import { test, expect } from '@playwright/test';
import {
  ATC2, NAME, PROC_NAME, RUN, installAtcGuards, assertNoRealDb, loginAsAtc, pickOptions, popupFrom, tid, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe('ATC — Upgraded ATC (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'upgraded atc: no fatal console errors');
  });

  test('VUA-01 a version button on View Prescribed opens the retired version with its adjustments', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto('/viewprescribedATC');
    // filter to the vua participant: the unfiltered list shows 25 per page and other specs add newer ATCs
    await expect(page.getByTestId('vatc-count')).toBeVisible({ timeout: 45_000 });
    await pickOptions(page, page.getByTestId('vatc-filter-participant'), [NAME.vua]);
    const row = page.locator(tid(`vatc-row-${ATC2.U_NEW}`));
    await expect(row, 'the current version is listed').toBeVisible({ timeout: 45_000 });
    const popup = await popupFrom(page, () => row.getByTestId('vatc-version-btn').first().click());
    expect(decodeURIComponent(popup.url()), 'the button opens the RETIRED version').toContain(`atcpath=atc_alpha/${ATC2.U_OLD}`);

    await expect(popup.getByTestId('vua-root')).toBeVisible({ timeout: 30_000 });
    await expect(popup.locator(tid('vua-adj-0'))).toContainText(`U_OLD adjustment ${RUN}`);
    await expect(popup.getByTestId('vua-proc-name').first()).toContainText(PROC_NAME.one);
    await expect(popup.getByTestId('vua-status')).toContainText('Upgraded');
    await expect(popup.getByTestId('vua-authors')).toContainText(NAME.admin);
    await expect(popup.getByTestId('vua-validators')).toContainText(NAME.mentor);
    await expect(popup.locator('mat-dialog-container'), 'the loading dialog closed').toHaveCount(0);
  });

  test('VUA-02 an unknown version shows "not found" and does not hang', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto(`/viewUpgradedATC?atcpath=atc_alpha/${RUN}_no_such_version`);
    await expect(page.getByTestId('vua-not-found')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('mat-dialog-container'), 'the loading dialog closed').toHaveCount(0);
  });

  test('VUA-03 access comes from configuration — a non-mentor (eis) granted the route sees the version', async ({ page }) => {
    await loginAsAtc(page, 'eis');
    await page.goto(`/viewUpgradedATC?atcpath=atc_alpha/${ATC2.U_OLD}`);
    await expect(page.getByTestId('vua-root')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(tid('vua-adj-0'))).toContainText(`U_OLD adjustment ${RUN}`);
  });
});
