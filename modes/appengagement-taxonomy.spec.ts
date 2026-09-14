// AppEngagement — Taxonomy (atc taxonomy reference config — deemed safe, not in excluded-routes) — ADDRESSABLE+SMOKE.
// Interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-plan.md, Wave B).
// One literal getByTestId('<id>') per STATIC data-testid hooked in the component template(s); soft-present
// so one screen spec can address MANY controls without a single missing control failing the whole run.
// DYNAMIC *ngFor hooks ([attr.data-testid]="'<prefix>-...-' + key") are intentionally NOT referenced here:
// the readiness gate scanner only credits LITERAL-string getByTestId, and per-row ids have no literal form.
// Prefixes: aevt, aeat.
import { test, expect } from '@playwright/test';
import { installModeStubs, loginAsModeAdmin } from './support/modes';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe("AppEngagement — Taxonomy (atc taxonomy reference config — deemed safe, not in excluded-routes)", () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installModeStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, "AppEngagement — Taxonomy (atc taxonomy reference config — deemed safe, not in excluded-routes): no fatal console errors"));

  test("aevt — view tags controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/atctaxonomy", { waitUntil: 'domcontentloaded' });
    await expect.soft(page.getByTestId('aevt-btn-1'), 'aevt-btn-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aevt-btn-2'), 'aevt-btn-2 present').toBeVisible({ timeout: 15_000 });
  });

  test("aeat — add tags (child dialog) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/atctaxonomy", { waitUntil: 'domcontentloaded' });
    await expect.soft(page.getByTestId('aeat-inp-1'), 'aeat-inp-1 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aeat-btn-2'), 'aeat-btn-2 present').toBeVisible({ timeout: 15_000 });
    await expect.soft(page.getByTestId('aeat-btn-3'), 'aeat-btn-3 present').toBeVisible({ timeout: 15_000 });
  });
});
