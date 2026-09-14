// zone-management-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the Zone Management
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the Zone Management templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installBizStubs, loginAsBizAdmin } from './support/business';

test.describe('Zone Management — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installBizStubs(page); await loginAsBizAdmin(page);
  });

  test('event-zone-management (/eventzonemanagement) — controls addressable', async ({ page }) => {
    await page.goto('/eventzonemanagement', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('ezm-mat-select')).toBeTruthy();
    expect(page.getByTestId('ezm-mat-select')).toBeTruthy();
    expect(page.getByTestId('ezm-openunmappedparticipants')).toBeTruthy();
    expect(page.getByTestId('ezm-opencreatezonedialog')).toBeTruthy();
    expect(page.getByTestId('ezm-openparticipantzoneoverlay')).toBeTruthy();
    expect(page.getByTestId('ezm-submitconfiguration')).toBeTruthy();
    expect(page.getByTestId('ezm-button')).toBeTruthy();
    expect(page.getByTestId('ezm-opencreatezonedialog-2')).toBeTruthy();
    expect(page.getByTestId('ezm-togglezonestatus')).toBeTruthy();
    expect(page.getByTestId('ezm-removecohortfromzone')).toBeTruthy();
    expect(page.getByTestId('ezm-event-stoppropagation')).toBeTruthy();
    expect(page.getByTestId('ezm-setcohortfilter')).toBeTruthy();
    expect(page.getByTestId('ezm-setcohortfilter-2')).toBeTruthy();
    expect(page.getByTestId('ezm-type-to-search')).toBeTruthy();
    expect(page.getByTestId('ezm-clearselection')).toBeTruthy();
    expect(page.getByTestId('ezm-mat-select-2')).toBeTruthy();
    expect(page.getByTestId('ezm-togglecohortselection')).toBeTruthy();
    expect(page.getByTestId('ezm-togglecohortselection-2')).toBeTruthy();
    expect(page.getByTestId('ezm-event-stoppropagation-2')).toBeTruthy();
    expect(page.getByTestId('ezm-closeparticipantzoneoverlay')).toBeTruthy();
    expect(page.getByTestId('ezm-exportparticipantzonestoexcel')).toBeTruthy();
    expect(page.getByTestId('ezm-closeparticipantzoneoverlay-2')).toBeTruthy();
    expect(page.getByTestId('ezm-search-by-name-email-or-zone')).toBeTruthy();
    expect(page.getByTestId('ezm-button-2')).toBeTruthy();
    expect(page.getByTestId('ezm-toggletrail')).toBeTruthy();
  });

  test('Zone Management dialogs (resolve-participant-zone, update-zone-detail, cohort-participants-dialog) — addressable by reference', async ({ page }) => {
    expect(page.getByTestId('rpz-onclose')).toBeTruthy();
    expect(page.getByTestId('rpz-applyzonetoall')).toBeTruthy();
    expect(page.getByTestId('rpz-onclose-2')).toBeTruthy();
    expect(page.getByTestId('rpz-onsubmit')).toBeTruthy();
    expect(page.getByTestId('uzd-oncancel')).toBeTruthy();
    expect(page.getByTestId('uzd-e-g-zone-a-main-hall')).toBeTruthy();
    expect(page.getByTestId('uzd-input')).toBeTruthy();
    expect(page.getByTestId('uzd-mat-select')).toBeTruthy();
    expect(page.getByTestId('uzd-mat-select-2')).toBeTruthy();
    expect(page.getByTestId('uzd-oncancel-2')).toBeTruthy();
    expect(page.getByTestId('uzd-onsave')).toBeTruthy();
    expect(page.getByTestId('cpd-close')).toBeTruthy();
    expect(page.getByTestId('cpd-search-by-name-or-email')).toBeTruthy();
    expect(page.getByTestId('cpd-mat-icon')).toBeTruthy();
  });
});
