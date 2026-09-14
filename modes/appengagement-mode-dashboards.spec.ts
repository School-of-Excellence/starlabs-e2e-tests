// AppEngagement — Mode dashboards — ADDRESSABLE+SMOKE.
// Interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-plan.md, Wave B).
// One literal getByTestId('<id>') per STATIC data-testid hooked in the component template(s); soft-present
// so one screen spec can address MANY controls without a single missing control failing the whole run.
// DYNAMIC *ngFor hooks ([attr.data-testid]="'<prefix>-...-' + key") are intentionally NOT referenced here:
// the readiness gate scanner only credits LITERAL-string getByTestId, and per-row ids have no literal form.
// Prefixes: mdb, mdn.
import { test, expect } from '@playwright/test';
import { installModeStubs, loginAsModeAdmin } from './support/modes';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe("AppEngagement — Mode dashboards", () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installModeStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, "AppEngagement — Mode dashboards: no fatal console errors"));

  test("mdb — mode dashboard controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/modedashboard", { waitUntil: 'domcontentloaded' });
    // NOTE: 14 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    await expect.soft(page.getByTestId('mdb-inp-1'), 'mdb-inp-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdb-inp-2'), 'mdb-inp-2 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdb-btn-3'), 'mdb-btn-3 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdb-act-18'), 'mdb-act-18 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdb-btn-19'), 'mdb-btn-19 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdb-inp-20'), 'mdb-inp-20 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdb-btn-21'), 'mdb-btn-21 present').toBeVisible({ timeout: 15_000 });
  });

  test("mdn — mode dashboard (new) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/mode-dashboard-new", { waitUntil: 'domcontentloaded' });
    // NOTE: 7 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    await expect.soft(page.getByTestId('mdn-act-1'), 'mdn-act-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-inp-3'), 'mdn-inp-3 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-inp-4'), 'mdn-inp-4 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-5'), 'mdn-btn-5 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-sel-7'), 'mdn-sel-7 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-sel-8'), 'mdn-sel-8 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-sel-9'), 'mdn-sel-9 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-10'), 'mdn-btn-10 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-12'), 'mdn-btn-12 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-sel-13'), 'mdn-sel-13 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-sel-14'), 'mdn-sel-14 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-inp-15'), 'mdn-inp-15 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-inp-16'), 'mdn-inp-16 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-17'), 'mdn-btn-17 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-18'), 'mdn-btn-18 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-21'), 'mdn-btn-21 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-22'), 'mdn-btn-22 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-23'), 'mdn-btn-23 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-sel-24'), 'mdn-sel-24 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-sel-25'), 'mdn-sel-25 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-26'), 'mdn-btn-26 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-29'), 'mdn-btn-29 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-30'), 'mdn-btn-30 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-act-31'), 'mdn-act-31 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-act-32'), 'mdn-act-32 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-33'), 'mdn-btn-33 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-inp-34'), 'mdn-inp-34 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-inp-35'), 'mdn-inp-35 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-inp-36'), 'mdn-inp-36 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-inp-37'), 'mdn-inp-37 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-38'), 'mdn-btn-38 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-39'), 'mdn-btn-39 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-act-40'), 'mdn-act-40 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-act-41'), 'mdn-act-41 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-42'), 'mdn-btn-42 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-inp-43'), 'mdn-inp-43 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-44'), 'mdn-btn-44 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-45'), 'mdn-btn-45 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-46'), 'mdn-btn-46 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-47'), 'mdn-btn-47 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-48'), 'mdn-btn-48 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-49'), 'mdn-btn-49 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-50'), 'mdn-btn-50 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mdn-btn-51'), 'mdn-btn-51 present').toBeVisible({ timeout: 15_000 });
  });
});
