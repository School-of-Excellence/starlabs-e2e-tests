// AppEngagement — App Action Pending (controls addressable; complements app-action-pending.spec.ts) — ADDRESSABLE+SMOKE.
// Interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-plan.md, Wave B).
// One literal getByTestId('<id>') per STATIC data-testid hooked in the component template(s); soft-present
// so one screen spec can address MANY controls without a single missing control failing the whole run.
// DYNAMIC *ngFor hooks ([attr.data-testid]="'<prefix>-...-' + key") are intentionally NOT referenced here:
// the readiness gate scanner only credits LITERAL-string getByTestId, and per-row ids have no literal form.
// Prefixes: aap, apa.
import { test, expect } from '@playwright/test';
import { installModeStubs, loginAsModeAdmin } from './support/modes';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe("AppEngagement — App Action Pending (controls addressable; complements app-action-pending.spec.ts)", () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installModeStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, "AppEngagement — App Action Pending (controls addressable; complements app-action-pending.spec.ts): no fatal console errors"));

  test("aap — app action pending controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/appactionpending", { waitUntil: 'domcontentloaded' });
    await expect.soft(page.getByTestId('aap-btn-1'), 'aap-btn-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aap-btn-2'), 'aap-btn-2 present').toBeVisible({ timeout: 15_000 });
  });

  test("apa — add pending action (child) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/appactionpending", { waitUntil: 'domcontentloaded' });
    await expect.soft(page.getByTestId('apa-sel-1'), 'apa-sel-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('apa-sel-2'), 'apa-sel-2 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('apa-sel-3'), 'apa-sel-3 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('apa-sel-4'), 'apa-sel-4 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('apa-sel-5'), 'apa-sel-5 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('apa-btn-6'), 'apa-btn-6 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('apa-btn-7'), 'apa-btn-7 present').toBeVisible({ timeout: 15_000 });
  });
});
