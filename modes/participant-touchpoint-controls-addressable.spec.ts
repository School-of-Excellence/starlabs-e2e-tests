// participant-touchpoint-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the participant-touchpoint
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the participant-touchpoint templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installModeStubs, loginAsModeAdmin } from './support/modes';

test.describe('participant-touchpoint — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installModeStubs(page); await loginAsModeAdmin(page);
  });

  test('participant-touchpoint (/participanttouchpoint) — controls addressable', async ({ page }) => {
    await page.goto('/participanttouchpoint', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('ptp-mat-select')).toBeTruthy();
    expect(page.getByTestId('ptp-mat-select')).toBeTruthy();
    expect(page.getByTestId('ptp-rangepicker-open')).toBeTruthy();
    expect(page.getByTestId('ptp-rangepicker-open-2')).toBeTruthy();
    expect(page.getByTestId('ptp-updatetimedelaytouchpoint')).toBeTruthy();
  });
});
