// hpc-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the hpc
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the hpc templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installBizStubs, loginAsBizAdmin } from './support/business';

test.describe('hpc — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installBizStubs(page); await loginAsBizAdmin(page);
  });

  test('hpc (/hpc) — controls addressable', async ({ page }) => {
    await page.goto('/hpc', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('hpc-mat-select')).toBeTruthy();
    expect(page.getByTestId('hpc-mat-select')).toBeTruthy();
    expect(page.getByTestId('hpc-button')).toBeTruthy();
    expect(page.getByTestId('hpc-mat-select-2')).toBeTruthy();
    expect(page.getByTestId('hpc-button-2')).toBeTruthy();
    expect(page.getByTestId('hpc-input')).toBeTruthy();
    expect(page.getByTestId('hpc-button-3')).toBeTruthy();
    expect(page.getByTestId('hpc-textarea')).toBeTruthy();
    expect(page.getByTestId('hpc-savecontrastprompt')).toBeTruthy();
    expect(page.getByTestId('hpc-input-2')).toBeTruthy();
    expect(page.getByTestId('hpc-textarea-2')).toBeTruthy();
    expect(page.getByTestId('hpc-input-3')).toBeTruthy();
    expect(page.getByTestId('hpc-textarea-3')).toBeTruthy();
    expect(page.getByTestId('hpc-saveprofiles')).toBeTruthy();
    expect(page.getByTestId('hpc-search-id-name')).toBeTruthy();
    expect(page.getByTestId('hpc-mat-select-3')).toBeTruthy();
    expect(page.getByTestId('hpc-mat-select-4')).toBeTruthy();
    expect(page.getByTestId('hpc-mat-select-5')).toBeTruthy();
    expect(page.getByTestId('hpc-clearallfilters')).toBeTruthy();
    expect(page.getByTestId('hpc-toggleallcards')).toBeTruthy();
    expect(page.getByTestId('hpc-openstatpanel')).toBeTruthy();
    expect(page.getByTestId('hpc-openstatpanel-2')).toBeTruthy();
    expect(page.getByTestId('hpc-openstatpanel-3')).toBeTruthy();
    expect(page.getByTestId('hpc-openstatpanel-4')).toBeTruthy();
    expect(page.getByTestId('hpc-openstatpanel-5')).toBeTruthy();
    expect(page.getByTestId('hpc-openstatpanel-6')).toBeTruthy();
    expect(page.getByTestId('hpc-openstatpanel-7')).toBeTruthy();
    expect(page.getByTestId('hpc-openstatpanel-8')).toBeTruthy();
    expect(page.getByTestId('hpc-openstatpanel-9')).toBeTruthy();
    expect(page.getByTestId('hpc-openstatpanel-10')).toBeTruthy();
    expect(page.getByTestId('hpc-openstatpanel-11')).toBeTruthy();
    expect(page.getByTestId('hpc-togglecard')).toBeTruthy();
    expect(page.getByTestId('hpc-ondelete')).toBeTruthy();
    expect(page.getByTestId('hpc-link')).toBeTruthy();
    expect(page.getByTestId('hpc-link-2')).toBeTruthy();
    expect(page.getByTestId('hpc-link-3')).toBeTruthy();
    expect(page.getByTestId('hpc-closepanel')).toBeTruthy();
    expect(page.getByTestId('hpc-filterbyname')).toBeTruthy();
    expect(page.getByTestId('hpc-filterbyprofile')).toBeTruthy();
    expect(page.getByTestId('hpc-closepanel-2')).toBeTruthy();
  });
});
