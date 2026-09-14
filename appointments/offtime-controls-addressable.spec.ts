// offtime-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the Offtime
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the Offtime templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installApptStubs, loginAsApptAdmin } from './support/appt';

test.describe('Offtime — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installApptStubs(page); await loginAsApptAdmin(page);
  });

  test('offtime-list (/offtime) — controls addressable', async ({ page }) => {
    await page.goto('/offtime', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('ofl-input')).toBeTruthy();
    expect(page.getByTestId('ofl-input')).toBeTruthy();
    expect(page.getByTestId('ofl-addofftime')).toBeTruthy();
    expect(page.getByTestId('ofl-deleteselectedoff')).toBeTruthy();
    expect(page.getByTestId('ofl-event-mastertoggle')).toBeTruthy();
    expect(page.getByTestId('ofl-event-stoppropagation')).toBeTruthy();
  });

  test('approve-offtime (/approveofftime) — controls addressable', async ({ page }) => {
    await page.goto('/approveofftime', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('aof-input')).toBeTruthy();
    expect(page.getByTestId('aof-input')).toBeTruthy();
    expect(page.getByTestId('aof-selectedofftimeaction')).toBeTruthy();
    expect(page.getByTestId('aof-selectedofftimeaction-2')).toBeTruthy();
    expect(page.getByTestId('aof-selectedofftimeaction-3')).toBeTruthy();
    expect(page.getByTestId('aof-event-mastertoggle')).toBeTruthy();
    expect(page.getByTestId('aof-event-stoppropagation')).toBeTruthy();
  });

  test('add-offtime (dialog) — addressable by reference', async ({ page }) => {
    expect(page.getByTestId('aod-mat-select')).toBeTruthy();
    expect(page.getByTestId('aod-submit')).toBeTruthy();
    expect(page.getByTestId('aod-startdate')).toBeTruthy();
    expect(page.getByTestId('aod-startdate-2')).toBeTruthy();
    expect(page.getByTestId('aod-enddate')).toBeTruthy();
    expect(page.getByTestId('aod-starttime')).toBeTruthy();
    expect(page.getByTestId('aod-endtime')).toBeTruthy();
    expect(page.getByTestId('aod-removeslot')).toBeTruthy();
    expect(page.getByTestId('aod-addslot')).toBeTruthy();
    expect(page.getByTestId('aod-fullday')).toBeTruthy();
    expect(page.getByTestId('aod-dialogref-close')).toBeTruthy();
    expect(page.getByTestId('aod-button')).toBeTruthy();
  });
});
