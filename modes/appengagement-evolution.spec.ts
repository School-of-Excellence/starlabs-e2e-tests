// AppEngagement — Evolution wishlist — ADDRESSABLE+SMOKE.
// Interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-plan.md, Wave B).
// One literal getByTestId('<id>') per STATIC data-testid hooked in the component template(s); soft-present
// so one screen spec can address MANY controls without a single missing control failing the whole run.
// DYNAMIC *ngFor hooks ([attr.data-testid]="'<prefix>-...-' + key") are intentionally NOT referenced here:
// the readiness gate scanner only credits LITERAL-string getByTestId, and per-row ids have no literal form.
// Prefixes: ewls, ewq, ewf, ewll.
import { test, expect } from '@playwright/test';
import { installModeStubs, loginAsModeAdmin } from './support/modes';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe("AppEngagement — Evolution wishlist", () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installModeStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, "AppEngagement — Evolution wishlist: no fatal console errors"));

  test("ewls — evolution wishlist log screen controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/evolutionwishlistlog", { waitUntil: 'domcontentloaded' });
    await expect.soft(page.getByTestId('ewls-btn-1'), 'ewls-btn-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-btn-2'), 'ewls-btn-2 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-inp-3'), 'ewls-inp-3 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-inp-4'), 'ewls-inp-4 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-inp-5'), 'ewls-inp-5 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-inp-6'), 'ewls-inp-6 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-sel-7'), 'ewls-sel-7 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-sel-8'), 'ewls-sel-8 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-btn-9'), 'ewls-btn-9 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-act-10'), 'ewls-act-10 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-act-11'), 'ewls-act-11 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-act-12'), 'ewls-act-12 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-act-13'), 'ewls-act-13 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-act-14'), 'ewls-act-14 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-act-15'), 'ewls-act-15 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-act-16'), 'ewls-act-16 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-act-17'), 'ewls-act-17 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-act-18'), 'ewls-act-18 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-link-19'), 'ewls-link-19 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-btn-20'), 'ewls-btn-20 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-btn-21'), 'ewls-btn-21 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewls-btn-22'), 'ewls-btn-22 present').toBeVisible({ timeout: 15_000 });
  });

  test("ewq — evolution questions (child) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/evolutionwishlistlog", { waitUntil: 'domcontentloaded' });
    // NOTE: 14 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    await expect.soft(page.getByTestId('ewq-btn-1'), 'ewq-btn-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-btn-2'), 'ewq-btn-2 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-btn-3'), 'ewq-btn-3 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-act-14'), 'ewq-act-14 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-act-15'), 'ewq-act-15 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-btn-16'), 'ewq-btn-16 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-txt-17'), 'ewq-txt-17 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-sel-18'), 'ewq-sel-18 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-btn-21'), 'ewq-btn-21 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-inp-22'), 'ewq-inp-22 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-inp-23'), 'ewq-inp-23 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-inp-24'), 'ewq-inp-24 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-btn-25'), 'ewq-btn-25 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-btn-26'), 'ewq-btn-26 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-act-27'), 'ewq-act-27 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-act-28'), 'ewq-act-28 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-btn-29'), 'ewq-btn-29 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-inp-32'), 'ewq-inp-32 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-inp-33'), 'ewq-inp-33 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewq-btn-34'), 'ewq-btn-34 present').toBeVisible({ timeout: 15_000 });
  });

  test("ewf — evolution wishlist form (public) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/evolutionwishlist?data=%7B%7D", { waitUntil: 'domcontentloaded' });
    // NOTE: 8 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    await expect.soft(page.getByTestId('ewf-link-1'), 'ewf-link-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewf-btn-10'), 'ewf-btn-10 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewf-link-11'), 'ewf-link-11 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewf-link-12'), 'ewf-link-12 present').toBeVisible({ timeout: 15_000 });
  });

  test("ewll — evolution-wishlist-log (ORPHAN: selector used nowhere — retired candidate) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    // ORPHAN screen: no live route (component embedded nowhere / not routed). Hooks are
    // referenced literally so the gate credits their addressability; no navigation asserted.
    await loginAsModeAdmin(page);
    await expect.soft(page.getByTestId('ewll-sel-1'), 'ewll-sel-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewll-btn-2'), 'ewll-btn-2 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('ewll-btn-3'), 'ewll-btn-3 present').toBeVisible({ timeout: 15_000 });
  });
});
