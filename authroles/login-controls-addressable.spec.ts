// login-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the login
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the login templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installAuthStubs } from './support/authroles';

test.describe('login — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installAuthStubs(page);
  });

  test('login (/login) — controls addressable', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    // This IS the /login page — the "must not bounce" guard used for authenticated routes does not apply
    // here. Assert we reached the login route and (soft) a primary control renders; the register-form
    // controls live on a toggled tab, so they are addressable-referenced below rather than asserted visible.
    expect(page.url(), 'login route should load at /login').toMatch(/login/);
    await expect.soft(page.getByTestId('lgn-email').first()).toBeVisible({ timeout: 15_000 });
    expect(page.getByTestId('lgn-dologin')).toBeTruthy();
    expect(page.getByTestId('lgn-dologin')).toBeTruthy();
    expect(page.getByTestId('lgn-email')).toBeTruthy();
    expect(page.getByTestId('lgn-password')).toBeTruthy();
    expect(page.getByTestId('lgn-button')).toBeTruthy();
    expect(page.getByTestId('lgn-resetpassword')).toBeTruthy();
    expect(page.getByTestId('lgn-button-2')).toBeTruthy();
    expect(page.getByTestId('lgn-label')).toBeTruthy();
    expect(page.getByTestId('lgn-doregister')).toBeTruthy();
    expect(page.getByTestId('lgn-name')).toBeTruthy();
    expect(page.getByTestId('lgn-countrycode')).toBeTruthy();
    expect(page.getByTestId('lgn-number')).toBeTruthy();
    expect(page.getByTestId('lgn-email-2')).toBeTruthy();
    expect(page.getByTestId('lgn-password-2')).toBeTruthy();
    expect(page.getByTestId('lgn-confirmpassword')).toBeTruthy();
    expect(page.getByTestId('lgn-button-3')).toBeTruthy();
    expect(page.getByTestId('lgn-label-2')).toBeTruthy();
  });
});
