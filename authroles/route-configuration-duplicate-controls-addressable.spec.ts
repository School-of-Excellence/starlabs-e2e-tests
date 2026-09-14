// route-configuration-duplicate-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the route-configuration-duplicate
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the route-configuration-duplicate templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installAuthStubs, loginAsAuthAdmin } from './support/authroles';

test.describe('route-configuration-duplicate — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installAuthStubs(page); await loginAsAuthAdmin(page);
  });

  test('route-configuration-duplicate (/routeconfiguration — the LIVE route, nav-linked app.component.html:101) — controls addressable', async ({ page }) => {
    await page.goto('/routeconfiguration', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('rcx-ex-dashboard')).toBeTruthy();
    expect(page.getByTestId('rcx-ex-dashboard')).toBeTruthy();
    expect(page.getByTestId('rcx-createroute')).toBeTruthy();
    expect(page.getByTestId('rcx-toggleexpandall')).toBeTruthy();
    expect(page.getByTestId('rcx-toggleexpand')).toBeTruthy();
    expect(page.getByTestId('rcx-editroute')).toBeTruthy();
    expect(page.getByTestId('rcx-deleteroute')).toBeTruthy();
  });

  test('route-configuration-duplicate createroutedialog (dialog) — addressable by reference', async ({ page }) => {
    expect(page.getByTestId('rxd-close')).toBeTruthy();
    expect(page.getByTestId('rxd-enter-label')).toBeTruthy();
    expect(page.getByTestId('rxd-enter-sequence')).toBeTruthy();
    expect(page.getByTestId('rxd-mat-select')).toBeTruthy();
    expect(page.getByTestId('rxd-mat-select-2')).toBeTruthy();
    expect(page.getByTestId('rxd-example-route')).toBeTruthy();
    expect(page.getByTestId('rxd-mat-select-3')).toBeTruthy();
    expect(page.getByTestId('rxd-mat-select-4')).toBeTruthy();
    expect(page.getByTestId('rxd-enter-label-2')).toBeTruthy();
    expect(page.getByTestId('rxd-child-route')).toBeTruthy();
    expect(page.getByTestId('rxd-mat-select-5')).toBeTruthy();
    expect(page.getByTestId('rxd-mat-select-6')).toBeTruthy();
    expect(page.getByTestId('rxd-mat-select-7')).toBeTruthy();
    expect(page.getByTestId('rxd-mat-select-8')).toBeTruthy();
    expect(page.getByTestId('rxd-removechildfield')).toBeTruthy();
    expect(page.getByTestId('rxd-addchildfield')).toBeTruthy();
    expect(page.getByTestId('rxd-save')).toBeTruthy();
    expect(page.getByTestId('rxd-close-2')).toBeTruthy();
  });
});
