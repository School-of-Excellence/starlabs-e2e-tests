// AppEngagement — Manage Recommended Playlist — ADDRESSABLE+SMOKE.
// Interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-plan.md, Wave B).
// One literal getByTestId('<id>') per STATIC data-testid hooked in the component template(s); soft-present
// so one screen spec can address MANY controls without a single missing control failing the whole run.
// DYNAMIC *ngFor hooks ([attr.data-testid]="'<prefix>-...-' + key") are intentionally NOT referenced here:
// the readiness gate scanner only credits LITERAL-string getByTestId, and per-row ids have no literal form.
// Prefixes: mrp, erp.
import { test, expect } from '@playwright/test';
import { installModeStubs, loginAsModeAdmin } from './support/modes';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe("AppEngagement — Manage Recommended Playlist", () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installModeStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, "AppEngagement — Manage Recommended Playlist: no fatal console errors"));

  test("mrp — manage recommended playlist controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/recommendedplaylist", { waitUntil: 'domcontentloaded' });
    // NOTE: 15 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    await expect.soft(page.getByTestId('mrp-btn-1'), 'mrp-btn-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-inp-2'), 'mrp-inp-2 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-inp-3'), 'mrp-inp-3 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-4'), 'mrp-btn-4 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-sel-5'), 'mrp-sel-5 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-6'), 'mrp-btn-6 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-sel-7'), 'mrp-sel-7 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-inp-8'), 'mrp-inp-8 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-9'), 'mrp-btn-9 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-25'), 'mrp-btn-25 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-26'), 'mrp-btn-26 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-27'), 'mrp-btn-27 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-change-28'), 'mrp-change-28 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-29'), 'mrp-btn-29 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-30'), 'mrp-btn-30 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-change-31'), 'mrp-change-31 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-32'), 'mrp-btn-32 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-33'), 'mrp-btn-33 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-34'), 'mrp-btn-34 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-sel-35'), 'mrp-sel-35 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-sel-36'), 'mrp-sel-36 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-sel-37'), 'mrp-sel-37 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-38'), 'mrp-btn-38 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-39'), 'mrp-btn-39 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-change-40'), 'mrp-change-40 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-act-41'), 'mrp-act-41 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-42'), 'mrp-btn-42 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-43'), 'mrp-btn-43 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('mrp-btn-44'), 'mrp-btn-44 present').toBeVisible({ timeout: 15_000 });
  });

  test("erp — edit recommended playlist (child dialog) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/recommendedplaylist", { waitUntil: 'domcontentloaded' });
    // NOTE: 3 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    await expect.soft(page.getByTestId('erp-inp-1'), 'erp-inp-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('erp-txt-2'), 'erp-txt-2 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('erp-inp-3'), 'erp-inp-3 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('erp-inp-4'), 'erp-inp-4 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('erp-sel-6'), 'erp-sel-6 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('erp-sel-8'), 'erp-sel-8 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('erp-sel-10'), 'erp-sel-10 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('erp-btn-11'), 'erp-btn-11 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('erp-btn-12'), 'erp-btn-12 present').toBeVisible({ timeout: 15_000 });
  });
});
