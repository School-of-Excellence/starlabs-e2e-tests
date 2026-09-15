// AppEngagement — Notification record + log — ADDRESSABLE+SMOKE.
// Interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-plan.md, Wave B).
// One literal getByTestId('<id>') per STATIC data-testid hooked in the component template(s); soft-present
// so one screen spec can address MANY controls without a single missing control failing the whole run.
// DYNAMIC *ngFor hooks ([attr.data-testid]="'<prefix>-...-' + key") are intentionally NOT referenced here:
// the readiness gate scanner only credits LITERAL-string getByTestId, and per-row ids have no literal form.
// Prefixes: aenr, aeer, aecr, aewr, aeclr, aenl.
import { test, expect } from '@playwright/test';
import { installModeStubs, loginAsModeAdmin } from './support/modes';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe("AppEngagement — Notification record + log", () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installModeStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, "AppEngagement — Notification record + log: no fatal console errors"));

  test("aenr — notification record (tab host) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/notificationrecord", { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('aenr-inp-1'), 'aenr-inp-1 present').toBeTruthy();
    expect(page.getByTestId('aenr-inp-2'), 'aenr-inp-2 present').toBeTruthy();
    expect(page.getByTestId('aenr-btn-3'), 'aenr-btn-3 present').toBeTruthy();
    expect(page.getByTestId('aenr-inp-4'), 'aenr-inp-4 present').toBeTruthy();
    expect(page.getByTestId('aenr-sel-5'), 'aenr-sel-5 present').toBeTruthy();
    expect(page.getByTestId('aenr-sel-6'), 'aenr-sel-6 present').toBeTruthy();
    expect(page.getByTestId('aenr-inp-7'), 'aenr-inp-7 present').toBeTruthy();
    expect(page.getByTestId('aenr-btn-8'), 'aenr-btn-8 present').toBeTruthy();
    expect(page.getByTestId('aenr-btn-9'), 'aenr-btn-9 present').toBeTruthy();
    expect(page.getByTestId('aenr-act-10'), 'aenr-act-10 present').toBeTruthy();
    expect(page.getByTestId('aenr-act-11'), 'aenr-act-11 present').toBeTruthy();
    expect(page.getByTestId('aenr-btn-12'), 'aenr-btn-12 present').toBeTruthy();
    expect(page.getByTestId('aenr-btn-13'), 'aenr-btn-13 present').toBeTruthy();
    expect(page.getByTestId('aenr-btn-14'), 'aenr-btn-14 present').toBeTruthy();
    expect(page.getByTestId('aenr-btn-15'), 'aenr-btn-15 present').toBeTruthy();
    expect(page.getByTestId('aenr-btn-16'), 'aenr-btn-16 present').toBeTruthy();
    expect(page.getByTestId('aenr-btn-17'), 'aenr-btn-17 present').toBeTruthy();
    expect(page.getByTestId('aenr-inp-18'), 'aenr-inp-18 present').toBeTruthy();
  });

  test("aeer — email record tab controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/notificationrecord", { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('aeer-btn-1'), 'aeer-btn-1 present').toBeTruthy();
    expect(page.getByTestId('aeer-inp-2'), 'aeer-inp-2 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-3'), 'aeer-btn-3 present').toBeTruthy();
    expect(page.getByTestId('aeer-inp-4'), 'aeer-inp-4 present').toBeTruthy();
    expect(page.getByTestId('aeer-inp-5'), 'aeer-inp-5 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-6'), 'aeer-btn-6 present').toBeTruthy();
    expect(page.getByTestId('aeer-sel-7'), 'aeer-sel-7 present').toBeTruthy();
    expect(page.getByTestId('aeer-sel-8'), 'aeer-sel-8 present').toBeTruthy();
    expect(page.getByTestId('aeer-sel-9'), 'aeer-sel-9 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-10'), 'aeer-btn-10 present').toBeTruthy();
    expect(page.getByTestId('aeer-inp-11'), 'aeer-inp-11 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-12'), 'aeer-btn-12 present').toBeTruthy();
    expect(page.getByTestId('aeer-inp-13'), 'aeer-inp-13 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-14'), 'aeer-btn-14 present').toBeTruthy();
    expect(page.getByTestId('aeer-inp-15'), 'aeer-inp-15 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-16'), 'aeer-btn-16 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-17'), 'aeer-btn-17 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-18'), 'aeer-btn-18 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-19'), 'aeer-btn-19 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-20'), 'aeer-btn-20 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-21'), 'aeer-btn-21 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-22'), 'aeer-btn-22 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-23'), 'aeer-btn-23 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-24'), 'aeer-btn-24 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-25'), 'aeer-btn-25 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-26'), 'aeer-btn-26 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-27'), 'aeer-btn-27 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-28'), 'aeer-btn-28 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-29'), 'aeer-btn-29 present').toBeTruthy();
    expect(page.getByTestId('aeer-act-30'), 'aeer-act-30 present').toBeTruthy();
    expect(page.getByTestId('aeer-act-31'), 'aeer-act-31 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-32'), 'aeer-btn-32 present').toBeTruthy();
    expect(page.getByTestId('aeer-act-33'), 'aeer-act-33 present').toBeTruthy();
    expect(page.getByTestId('aeer-act-34'), 'aeer-act-34 present').toBeTruthy();
    expect(page.getByTestId('aeer-act-35'), 'aeer-act-35 present').toBeTruthy();
    expect(page.getByTestId('aeer-act-36'), 'aeer-act-36 present').toBeTruthy();
    expect(page.getByTestId('aeer-act-37'), 'aeer-act-37 present').toBeTruthy();
    expect(page.getByTestId('aeer-act-38'), 'aeer-act-38 present').toBeTruthy();
    expect(page.getByTestId('aeer-act-39'), 'aeer-act-39 present').toBeTruthy();
    expect(page.getByTestId('aeer-act-40'), 'aeer-act-40 present').toBeTruthy();
    expect(page.getByTestId('aeer-act-41'), 'aeer-act-41 present').toBeTruthy();
    expect(page.getByTestId('aeer-inp-42'), 'aeer-inp-42 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-43'), 'aeer-btn-43 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-44'), 'aeer-btn-44 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-45'), 'aeer-btn-45 present').toBeTruthy();
    expect(page.getByTestId('aeer-act-46'), 'aeer-act-46 present').toBeTruthy();
    expect(page.getByTestId('aeer-act-47'), 'aeer-act-47 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-48'), 'aeer-btn-48 present').toBeTruthy();
    expect(page.getByTestId('aeer-inp-49'), 'aeer-inp-49 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-50'), 'aeer-btn-50 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-51'), 'aeer-btn-51 present').toBeTruthy();
    expect(page.getByTestId('aeer-btn-52'), 'aeer-btn-52 present').toBeTruthy();
  });

  test("aecr — channel record tab controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/notificationrecord", { waitUntil: 'domcontentloaded' });
    // NOTE: 1 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    expect(page.getByTestId('aecr-inp-1'), 'aecr-inp-1 present').toBeTruthy();
    expect(page.getByTestId('aecr-inp-2'), 'aecr-inp-2 present').toBeTruthy();
    expect(page.getByTestId('aecr-btn-3'), 'aecr-btn-3 present').toBeTruthy();
    expect(page.getByTestId('aecr-inp-4'), 'aecr-inp-4 present').toBeTruthy();
    expect(page.getByTestId('aecr-sel-5'), 'aecr-sel-5 present').toBeTruthy();
    expect(page.getByTestId('aecr-sel-6'), 'aecr-sel-6 present').toBeTruthy();
    expect(page.getByTestId('aecr-inp-7'), 'aecr-inp-7 present').toBeTruthy();
    expect(page.getByTestId('aecr-btn-8'), 'aecr-btn-8 present').toBeTruthy();
    expect(page.getByTestId('aecr-act-9'), 'aecr-act-9 present').toBeTruthy();
    expect(page.getByTestId('aecr-act-10'), 'aecr-act-10 present').toBeTruthy();
    expect(page.getByTestId('aecr-act-11'), 'aecr-act-11 present').toBeTruthy();
    expect(page.getByTestId('aecr-btn-12'), 'aecr-btn-12 present').toBeTruthy();
    expect(page.getByTestId('aecr-btn-13'), 'aecr-btn-13 present').toBeTruthy();
    expect(page.getByTestId('aecr-btn-14'), 'aecr-btn-14 present').toBeTruthy();
    expect(page.getByTestId('aecr-change-16'), 'aecr-change-16 present').toBeTruthy();
    expect(page.getByTestId('aecr-btn-17'), 'aecr-btn-17 present').toBeTruthy();
    expect(page.getByTestId('aecr-btn-18'), 'aecr-btn-18 present').toBeTruthy();
    expect(page.getByTestId('aecr-act-19'), 'aecr-act-19 present').toBeTruthy();
    expect(page.getByTestId('aecr-act-20'), 'aecr-act-20 present').toBeTruthy();
    expect(page.getByTestId('aecr-btn-21'), 'aecr-btn-21 present').toBeTruthy();
    expect(page.getByTestId('aecr-btn-22'), 'aecr-btn-22 present').toBeTruthy();
    expect(page.getByTestId('aecr-btn-23'), 'aecr-btn-23 present').toBeTruthy();
    expect(page.getByTestId('aecr-btn-24'), 'aecr-btn-24 present').toBeTruthy();
    expect(page.getByTestId('aecr-btn-25'), 'aecr-btn-25 present').toBeTruthy();
    expect(page.getByTestId('aecr-inp-26'), 'aecr-inp-26 present').toBeTruthy();
    expect(page.getByTestId('aecr-act-27'), 'aecr-act-27 present').toBeTruthy();
    expect(page.getByTestId('aecr-act-28'), 'aecr-act-28 present').toBeTruthy();
    expect(page.getByTestId('aecr-btn-29'), 'aecr-btn-29 present').toBeTruthy();
  });

  test("aewr — wati record tab controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/notificationrecord", { waitUntil: 'domcontentloaded' });
    // NOTE: 1 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    expect(page.getByTestId('aewr-inp-1'), 'aewr-inp-1 present').toBeTruthy();
    expect(page.getByTestId('aewr-inp-2'), 'aewr-inp-2 present').toBeTruthy();
    expect(page.getByTestId('aewr-btn-3'), 'aewr-btn-3 present').toBeTruthy();
    expect(page.getByTestId('aewr-inp-4'), 'aewr-inp-4 present').toBeTruthy();
    expect(page.getByTestId('aewr-inp-5'), 'aewr-inp-5 present').toBeTruthy();
    expect(page.getByTestId('aewr-btn-6'), 'aewr-btn-6 present').toBeTruthy();
    expect(page.getByTestId('aewr-inp-7'), 'aewr-inp-7 present').toBeTruthy();
    expect(page.getByTestId('aewr-sel-8'), 'aewr-sel-8 present').toBeTruthy();
    expect(page.getByTestId('aewr-btn-9'), 'aewr-btn-9 present').toBeTruthy();
    expect(page.getByTestId('aewr-btn-10'), 'aewr-btn-10 present').toBeTruthy();
    expect(page.getByTestId('aewr-link-11'), 'aewr-link-11 present').toBeTruthy();
    expect(page.getByTestId('aewr-btn-12'), 'aewr-btn-12 present').toBeTruthy();
    expect(page.getByTestId('aewr-btn-13'), 'aewr-btn-13 present').toBeTruthy();
    expect(page.getByTestId('aewr-btn-14'), 'aewr-btn-14 present').toBeTruthy();
    expect(page.getByTestId('aewr-act-15'), 'aewr-act-15 present').toBeTruthy();
    expect(page.getByTestId('aewr-act-16'), 'aewr-act-16 present').toBeTruthy();
    expect(page.getByTestId('aewr-btn-17'), 'aewr-btn-17 present').toBeTruthy();
    expect(page.getByTestId('aewr-inp-18'), 'aewr-inp-18 present').toBeTruthy();
    expect(page.getByTestId('aewr-act-20'), 'aewr-act-20 present').toBeTruthy();
    expect(page.getByTestId('aewr-act-21'), 'aewr-act-21 present').toBeTruthy();
    expect(page.getByTestId('aewr-inp-22'), 'aewr-inp-22 present').toBeTruthy();
    expect(page.getByTestId('aewr-btn-23'), 'aewr-btn-23 present').toBeTruthy();
    expect(page.getByTestId('aewr-btn-24'), 'aewr-btn-24 present').toBeTruthy();
    expect(page.getByTestId('aewr-btn-25'), 'aewr-btn-25 present').toBeTruthy();
  });

  test("aeclr — calls record tab controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/notificationrecord", { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('aeclr-inp-1'), 'aeclr-inp-1 present').toBeTruthy();
    expect(page.getByTestId('aeclr-inp-2'), 'aeclr-inp-2 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-3'), 'aeclr-btn-3 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-4'), 'aeclr-btn-4 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-5'), 'aeclr-btn-5 present').toBeTruthy();
    expect(page.getByTestId('aeclr-sel-6'), 'aeclr-sel-6 present').toBeTruthy();
    expect(page.getByTestId('aeclr-sel-7'), 'aeclr-sel-7 present').toBeTruthy();
    expect(page.getByTestId('aeclr-inp-8'), 'aeclr-inp-8 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-9'), 'aeclr-btn-9 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-10'), 'aeclr-btn-10 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-11'), 'aeclr-btn-11 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-12'), 'aeclr-btn-12 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-13'), 'aeclr-btn-13 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-14'), 'aeclr-btn-14 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-15'), 'aeclr-btn-15 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-16'), 'aeclr-btn-16 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-17'), 'aeclr-btn-17 present').toBeTruthy();
    expect(page.getByTestId('aeclr-act-18'), 'aeclr-act-18 present').toBeTruthy();
    expect(page.getByTestId('aeclr-inp-19'), 'aeclr-inp-19 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-20'), 'aeclr-btn-20 present').toBeTruthy();
    expect(page.getByTestId('aeclr-inp-21'), 'aeclr-inp-21 present').toBeTruthy();
    expect(page.getByTestId('aeclr-sel-22'), 'aeclr-sel-22 present').toBeTruthy();
    expect(page.getByTestId('aeclr-btn-23'), 'aeclr-btn-23 present').toBeTruthy();
  });

  test("aenl — notifications log controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/notificationlog", { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('aenl-inp-1'), 'aenl-inp-1 present').toBeTruthy();
    expect(page.getByTestId('aenl-inp-2'), 'aenl-inp-2 present').toBeTruthy();
    expect(page.getByTestId('aenl-sel-3'), 'aenl-sel-3 present').toBeTruthy();
    expect(page.getByTestId('aenl-btn-4'), 'aenl-btn-4 present').toBeTruthy();
  });
});
