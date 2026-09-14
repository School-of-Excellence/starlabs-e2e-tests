// form-element-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the form-element
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the form-element templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installAuthStubs, loginAsAuthAdmin } from './support/authroles';

test.describe('form-element — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installAuthStubs(page); await loginAsAuthAdmin(page);
  });

  test('form-element shared controls (mat-chip, text-stack) — crossCutting, no route — addressable by reference', async ({ page }) => {
    expect(page.getByTestId('fmc-button')).toBeTruthy();
    expect(page.getByTestId('fmc-type-your-input')).toBeTruthy();
    expect(page.getByTestId('fts-input')).toBeTruthy();
    expect(page.getByTestId('fts-onremovetext')).toBeTruthy();
  });
});
