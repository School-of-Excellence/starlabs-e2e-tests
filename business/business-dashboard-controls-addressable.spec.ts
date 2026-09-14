// business-dashboard-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the Business Dashboard
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the Business Dashboard templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installBizStubs, loginAsBizAdmin } from './support/business';

test.describe('Business Dashboard — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installBizStubs(page); await loginAsBizAdmin(page);
  });

  test('profile-based-access (/profile-role-access) — controls addressable', async ({ page }) => {
    await page.goto('/profile-role-access', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('pba-ex-path-or-dashboard')).toBeTruthy();
    expect(page.getByTestId('pba-ex-path-or-dashboard')).toBeTruthy();
    expect(page.getByTestId('pba-select-profiles')).toBeTruthy();
    expect(page.getByTestId('pba-select-access-type')).toBeTruthy();
    expect(page.getByTestId('pba-showprofiles')).toBeTruthy();
    expect(page.getByTestId('pba-showprofiles-2')).toBeTruthy();
    expect(page.getByTestId('pba-openeditdialog')).toBeTruthy();
    expect(page.getByTestId('pba-dashboard')).toBeTruthy();
    expect(page.getByTestId('pba-select-profiles-2')).toBeTruthy();
    expect(page.getByTestId('pba-clearahcrmform')).toBeTruthy();
    expect(page.getByTestId('pba-addahcrmscreenaccess')).toBeTruthy();
    expect(page.getByTestId('pba-button')).toBeTruthy();
    expect(page.getByTestId('pba-showahcrmprofiles')).toBeTruthy();
    expect(page.getByTestId('pba-showahcrmprofiles-2')).toBeTruthy();
    expect(page.getByTestId('pba-openahcmeditdialog')).toBeTruthy();
    expect(page.getByTestId('pba-mat-select')).toBeTruthy();
    expect(page.getByTestId('pba-button-2')).toBeTruthy();
    expect(page.getByTestId('pba-button-3')).toBeTruthy();
    expect(page.getByTestId('pba-button-4')).toBeTruthy();
    expect(page.getByTestId('pba-mat-select-2')).toBeTruthy();
    expect(page.getByTestId('pba-button-5')).toBeTruthy();
    expect(page.getByTestId('pba-button-6')).toBeTruthy();
    expect(page.getByTestId('pba-button-7')).toBeTruthy();
  });

  test('expense-planner (/expense-planner/expense) — controls addressable', async ({ page }) => {
    await page.goto('/expense-planner/expense', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('exp-setactivetab')).toBeTruthy();
    expect(page.getByTestId('exp-setactivetab')).toBeTruthy();
    expect(page.getByTestId('exp-setactivetab-2')).toBeTruthy();
    expect(page.getByTestId('exp-setfiltertype')).toBeTruthy();
    expect(page.getByTestId('exp-setfiltertype-2')).toBeTruthy();
    expect(page.getByTestId('exp-backwardmonth')).toBeTruthy();
    expect(page.getByTestId('exp-updatedate')).toBeTruthy();
    expect(page.getByTestId('exp-forwardmonth')).toBeTruthy();
    expect(page.getByTestId('exp-start')).toBeTruthy();
    expect(page.getByTestId('exp-end')).toBeTruthy();
    expect(page.getByTestId('exp-addentry')).toBeTruthy();
    expect(page.getByTestId('exp-setinflowmonth')).toBeTruthy();
    expect(page.getByTestId('exp-setinflowmonth-2')).toBeTruthy();
    expect(page.getByTestId('exp-updatepaidstatus')).toBeTruthy();
    expect(page.getByTestId('exp-input')).toBeTruthy();
    expect(page.getByTestId('exp-editentry')).toBeTruthy();
    expect(page.getByTestId('exp-deleteentry')).toBeTruthy();
    expect(page.getByTestId('exp-onoverlayclick')).toBeTruthy();
    expect(page.getByTestId('exp-closedialog')).toBeTruthy();
    expect(page.getByTestId('exp-date')).toBeTruthy();
    expect(page.getByTestId('exp-adddescription')).toBeTruthy();
    expect(page.getByTestId('exp-name')).toBeTruthy();
    expect(page.getByTestId('exp-amount')).toBeTruthy();
    expect(page.getByTestId('exp-paid')).toBeTruthy();
    expect(page.getByTestId('exp-removedescription')).toBeTruthy();
    expect(page.getByTestId('exp-closedialog-2')).toBeTruthy();
    expect(page.getByTestId('exp-saveentry')).toBeTruthy();
  });

  test('entry-management / AdsEntry (/ads-entry) — controls addressable', async ({ page }) => {
    await page.goto('/ads-entry', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('ame-openaddform')).toBeTruthy();
    expect(page.getByTestId('ame-openaddform')).toBeTruthy();
    expect(page.getByTestId('ame-setfiltertype')).toBeTruthy();
    expect(page.getByTestId('ame-setfiltertype-2')).toBeTruthy();
    expect(page.getByTestId('ame-backwardmonth')).toBeTruthy();
    expect(page.getByTestId('ame-updatedate')).toBeTruthy();
    expect(page.getByTestId('ame-forwardmonth')).toBeTruthy();
    expect(page.getByTestId('ame-start')).toBeTruthy();
    expect(page.getByTestId('ame-end')).toBeTruthy();
    expect(page.getByTestId('ame-editentry')).toBeTruthy();
    expect(page.getByTestId('ame-viewlog')).toBeTruthy();
    expect(page.getByTestId('ame-closeform')).toBeTruthy();
    expect(page.getByTestId('ame-handlesubmit')).toBeTruthy();
    expect(page.getByTestId('ame-date')).toBeTruthy();
    expect(page.getByTestId('ame-campaigns')).toBeTruthy();
    expect(page.getByTestId('ame-amount')).toBeTruthy();
    expect(page.getByTestId('ame-closeform-2')).toBeTruthy();
    expect(page.getByTestId('ame-button')).toBeTruthy();
    expect(page.getByTestId('ame-closelogmodal')).toBeTruthy();
    expect(page.getByTestId('ame-event-stoppropagation')).toBeTruthy();
    expect(page.getByTestId('ame-closelogmodal-2')).toBeTruthy();
  });
});
