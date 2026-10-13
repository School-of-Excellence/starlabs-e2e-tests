// emulator-wiring.spec.ts — G3: prove the app reads the EMULATOR's firestore-atc before any other ATC case runs.
//
// Operator rule (2026-10-13): ATC is NEVER tested against the development or production database. This case is
// the positive proof of the wiring: a document that exists ONLY in the emulator's firestore-atc (seed-atc.js)
// must render on /viewprescribedATC, and G2 must record zero requests to a real Firestore/Storage backend. If
// main.ts ever stops connecting firestore-atc to the emulator, this fails first and loudly.
import { test, expect } from '@playwright/test';
import { ATC, installAtcGuards, assertNoRealDb, loginAsAtc, atcDoc, tid, AtcGuard } from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe('ATC — emulator wiring (G3)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'atc wiring: no fatal console errors');
  });

  test('ATC-G3 a firestore-atc doc that exists only in the emulator renders, with zero real-DB traffic', async ({ page }) => {
    // precondition read straight from the EMULATOR (Admin SDK pinned by G1)
    const seeded = await atcDoc(`atc_alpha/${ATC.A1}`);
    expect(seeded, 'G3: precondition — A1 seeded in the emulator firestore-atc').not.toBeNull();

    await loginAsAtc(page, 'admin');
    await page.goto('/viewprescribedATC');
    await expect(page.locator(tid(`vatc-row-${ATC.A1}`)), 'G3: the emulator-only ATC must render').toBeVisible({ timeout: 45_000 });
  });
});
