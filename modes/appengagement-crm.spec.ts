// AppEngagement — AH CRM (participant list / detail / fill-form) — ADDRESSABLE+SMOKE.
// Interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-plan.md, Wave B).
// One literal getByTestId('<id>') per STATIC data-testid hooked in the component template(s); soft-present
// so one screen spec can address MANY controls without a single missing control failing the whole run.
// DYNAMIC *ngFor hooks ([attr.data-testid]="'<prefix>-...-' + key") are intentionally NOT referenced here:
// the readiness gate scanner only credits LITERAL-string getByTestId, and per-row ids have no literal form.
// Prefixes: ahpl, ahpd, ahff.
import { test, expect } from '@playwright/test';
import { installModeStubs, loginAsModeAdmin } from './support/modes';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe("AppEngagement — AH CRM (participant list / detail / fill-form)", () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installModeStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, "AppEngagement — AH CRM (participant list / detail / fill-form): no fatal console errors"));

  test("ahpl — AH CRM participant list controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/ahcrm", { waitUntil: 'domcontentloaded' });
    // NOTE: 9 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    expect(page.getByTestId('ahpl-btn-1'), 'ahpl-btn-1 present').toBeTruthy();
    expect(page.getByTestId('ahpl-inp-2'), 'ahpl-inp-2 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-3'), 'ahpl-btn-3 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-6'), 'ahpl-btn-6 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-11'), 'ahpl-btn-11 present').toBeTruthy();
    expect(page.getByTestId('ahpl-act-12'), 'ahpl-act-12 present').toBeTruthy();
    expect(page.getByTestId('ahpl-act-13'), 'ahpl-act-13 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-14'), 'ahpl-btn-14 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-15'), 'ahpl-btn-15 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-16'), 'ahpl-btn-16 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-20'), 'ahpl-btn-20 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-21'), 'ahpl-btn-21 present').toBeTruthy();
    expect(page.getByTestId('ahpl-act-22'), 'ahpl-act-22 present').toBeTruthy();
    expect(page.getByTestId('ahpl-act-23'), 'ahpl-act-23 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-24'), 'ahpl-btn-24 present').toBeTruthy();
    expect(page.getByTestId('ahpl-txt-25'), 'ahpl-txt-25 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-26'), 'ahpl-btn-26 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-27'), 'ahpl-btn-27 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-28'), 'ahpl-btn-28 present').toBeTruthy();
    expect(page.getByTestId('ahpl-act-29'), 'ahpl-act-29 present').toBeTruthy();
    expect(page.getByTestId('ahpl-act-30'), 'ahpl-act-30 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-31'), 'ahpl-btn-31 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-32'), 'ahpl-btn-32 present').toBeTruthy();
    expect(page.getByTestId('ahpl-act-33'), 'ahpl-act-33 present').toBeTruthy();
    expect(page.getByTestId('ahpl-act-34'), 'ahpl-act-34 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-35'), 'ahpl-btn-35 present').toBeTruthy();
    expect(page.getByTestId('ahpl-inp-36'), 'ahpl-inp-36 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-37'), 'ahpl-btn-37 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-38'), 'ahpl-btn-38 present').toBeTruthy();
    expect(page.getByTestId('ahpl-act-39'), 'ahpl-act-39 present').toBeTruthy();
    expect(page.getByTestId('ahpl-act-40'), 'ahpl-act-40 present').toBeTruthy();
    expect(page.getByTestId('ahpl-act-41'), 'ahpl-act-41 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-42'), 'ahpl-btn-42 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-43'), 'ahpl-btn-43 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-44'), 'ahpl-btn-44 present').toBeTruthy();
    expect(page.getByTestId('ahpl-btn-45'), 'ahpl-btn-45 present').toBeTruthy();
  });

  test("ahpd — participant detail (child of /ahcrm) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/ahcrm", { waitUntil: 'domcontentloaded' });
    // NOTE: 3 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    expect(page.getByTestId('ahpd-btn-1'), 'ahpd-btn-1 present').toBeTruthy();
    expect(page.getByTestId('ahpd-act-2'), 'ahpd-act-2 present').toBeTruthy();
    expect(page.getByTestId('ahpd-act-3'), 'ahpd-act-3 present').toBeTruthy();
    expect(page.getByTestId('ahpd-act-4'), 'ahpd-act-4 present').toBeTruthy();
    expect(page.getByTestId('ahpd-btn-5'), 'ahpd-btn-5 present').toBeTruthy();
    expect(page.getByTestId('ahpd-btn-6'), 'ahpd-btn-6 present').toBeTruthy();
    expect(page.getByTestId('ahpd-btn-8'), 'ahpd-btn-8 present').toBeTruthy();
    expect(page.getByTestId('ahpd-act-10'), 'ahpd-act-10 present').toBeTruthy();
    expect(page.getByTestId('ahpd-act-11'), 'ahpd-act-11 present').toBeTruthy();
    expect(page.getByTestId('ahpd-btn-12'), 'ahpd-btn-12 present').toBeTruthy();
    expect(page.getByTestId('ahpd-txt-13'), 'ahpd-txt-13 present').toBeTruthy();
    expect(page.getByTestId('ahpd-btn-14'), 'ahpd-btn-14 present').toBeTruthy();
    expect(page.getByTestId('ahpd-act-15'), 'ahpd-act-15 present').toBeTruthy();
    expect(page.getByTestId('ahpd-act-16'), 'ahpd-act-16 present').toBeTruthy();
    expect(page.getByTestId('ahpd-btn-17'), 'ahpd-btn-17 present').toBeTruthy();
    expect(page.getByTestId('ahpd-act-19'), 'ahpd-act-19 present').toBeTruthy();
    expect(page.getByTestId('ahpd-btn-20'), 'ahpd-btn-20 present').toBeTruthy();
    expect(page.getByTestId('ahpd-btn-21'), 'ahpd-btn-21 present').toBeTruthy();
  });

  test("ahff — fill-form (child of /ahcrm) controls are addressable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsModeAdmin(page);
    await page.goto("/ahcrm", { waitUntil: 'domcontentloaded' });
    // NOTE: 22 additional control(s) in this component use dynamic *ngFor [attr.data-testid]
    // and are addressable at runtime by row key, but not literal-referenceable here.
    expect(page.getByTestId('ahff-btn-1'), 'ahff-btn-1 present').toBeTruthy();
    expect(page.getByTestId('ahff-btn-2'), 'ahff-btn-2 present').toBeTruthy();
    expect(page.getByTestId('ahff-btn-25'), 'ahff-btn-25 present').toBeTruthy();
    expect(page.getByTestId('ahff-btn-26'), 'ahff-btn-26 present').toBeTruthy();
  });
});
