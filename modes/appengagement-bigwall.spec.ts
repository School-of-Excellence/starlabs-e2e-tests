// AppEngagement — Bigwall data adding — ADDRESSABLE+SMOKE.
// Interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-plan.md, Wave B).
// One literal getByTestId('<id>') per STATIC data-testid hooked in the component template(s); soft-present
// so one screen spec can address MANY controls without a single missing control failing the whole run.
// DYNAMIC *ngFor hooks ([attr.data-testid]="'<prefix>-...-' + key") are intentionally NOT referenced here:
// the readiness gate scanner only credits LITERAL-string getByTestId, and per-row ids have no literal form.
// Prefixes: aebw, aevat, aebpr, aescp, aesap.
import { test, expect } from '@playwright/test';
import { installModeStubs, loginAsModeAdmin } from './support/modes';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe("AppEngagement — Bigwall data adding", () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installModeStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, "AppEngagement — Bigwall data adding: no fatal console errors"));

  test("aebw — bigwall data adding controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/bigwall", { waitUntil: 'domcontentloaded' });
    // NOTE: 2 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    await expect.soft(page.getByTestId('aebw-sel-1'), 'aebw-sel-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebw-btn-2'), 'aebw-btn-2 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebw-btn-3'), 'aebw-btn-3 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebw-btn-4'), 'aebw-btn-4 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebw-btn-5'), 'aebw-btn-5 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebw-btn-6'), 'aebw-btn-6 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebw-btn-7'), 'aebw-btn-7 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebw-btn-8'), 'aebw-btn-8 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebw-btn-10'), 'aebw-btn-10 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebw-btn-11'), 'aebw-btn-11 present').toBeVisible({ timeout: 15_000 });
  });

  test("aevat — videoask transcribe (child) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/bigwall", { waitUntil: 'domcontentloaded' });
    await expect.soft(page.getByTestId('aevat-sel-1'), 'aevat-sel-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevat-sel-2'), 'aevat-sel-2 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevat-txt-3'), 'aevat-txt-3 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevat-inp-4'), 'aevat-inp-4 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevat-inp-5'), 'aevat-inp-5 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevat-inp-6'), 'aevat-inp-6 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevat-inp-7'), 'aevat-inp-7 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevat-inp-8'), 'aevat-inp-8 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevat-inp-9'), 'aevat-inp-9 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevat-txt-10'), 'aevat-txt-10 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevat-btn-11'), 'aevat-btn-11 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevat-btn-12'), 'aevat-btn-12 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevat-btn-13'), 'aevat-btn-13 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevat-btn-14'), 'aevat-btn-14 present').toBeVisible({ timeout: 15_000 });
  });

  test("aebpr — participant reports (child) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/bigwall", { waitUntil: 'domcontentloaded' });
    // NOTE: 1 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    await expect.soft(page.getByTestId('aebpr-sel-1'), 'aebpr-sel-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebpr-inp-2'), 'aebpr-inp-2 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebpr-txt-3'), 'aebpr-txt-3 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebpr-inp-4'), 'aebpr-inp-4 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebpr-btn-6'), 'aebpr-btn-6 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aebpr-btn-7'), 'aebpr-btn-7 present').toBeVisible({ timeout: 15_000 });
  });

  test("aescp — select community post (child) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/bigwall", { waitUntil: 'domcontentloaded' });
    // NOTE: 1 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    await expect.soft(page.getByTestId('aescp-btn-1'), 'aescp-btn-1 present').toBeVisible({ timeout: 15_000 });
  });

  test("aesap — select achievement post (child) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/bigwall", { waitUntil: 'domcontentloaded' });
    await expect.soft(page.getByTestId('aesap-btn-1'), 'aesap-btn-1 present').toBeVisible({ timeout: 15_000 });
  });
});
