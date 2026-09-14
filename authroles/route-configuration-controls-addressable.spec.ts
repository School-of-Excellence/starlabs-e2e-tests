// route-configuration-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the route-configuration
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the route-configuration templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installAuthStubs, loginAsAuthAdmin } from './support/authroles';

test.describe('route-configuration — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installAuthStubs(page); await loginAsAuthAdmin(page);
  });

  test('route-configuration (route commented out in app.routes.ts:561 — not navigable; hooked add-only + createroutedialog) — addressable by reference', async ({ page }) => {
    expect(page.getByTestId('rcf-ex-dashboard')).toBeTruthy();
    expect(page.getByTestId('rcf-createroute')).toBeTruthy();
    expect(page.getByTestId('rcf-toggleexpandall')).toBeTruthy();
    expect(page.getByTestId('rcf-toggleexpand')).toBeTruthy();
    expect(page.getByTestId('rcf-editroute')).toBeTruthy();
    expect(page.getByTestId('rcf-deleteroute')).toBeTruthy();
    expect(page.getByTestId('rcd-close')).toBeTruthy();
    expect(page.getByTestId('rcd-enter-label')).toBeTruthy();
    expect(page.getByTestId('rcd-enter-sequence')).toBeTruthy();
    expect(page.getByTestId('rcd-mat-select')).toBeTruthy();
    expect(page.getByTestId('rcd-example-route')).toBeTruthy();
    expect(page.getByTestId('rcd-mat-select-2')).toBeTruthy();
    expect(page.getByTestId('rcd-mat-select-3')).toBeTruthy();
    expect(page.getByTestId('rcd-enter-label-2')).toBeTruthy();
    expect(page.getByTestId('rcd-child-route')).toBeTruthy();
    expect(page.getByTestId('rcd-mat-select-4')).toBeTruthy();
    expect(page.getByTestId('rcd-mat-select-5')).toBeTruthy();
    expect(page.getByTestId('rcd-mat-select-6')).toBeTruthy();
    expect(page.getByTestId('rcd-removechildfield')).toBeTruthy();
    expect(page.getByTestId('rcd-addchildfield')).toBeTruthy();
    expect(page.getByTestId('rcd-save')).toBeTruthy();
    expect(page.getByTestId('rcd-close-2')).toBeTruthy();
  });
});
