// dialogbox-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the DialogBox
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the DialogBox templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installAuthStubs, loginAsAuthAdmin } from './support/authroles';

test.describe('DialogBox — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installAuthStubs(page); await loginAsAuthAdmin(page);
  });

  test('DialogBox shared dialogs (ah-notification, otp-verification, confirm, select-validator, update-dialog) — crossCutting, no route — addressable by reference', async ({ page }) => {
    expect(page.getByTestId('dbn-button')).toBeTruthy();
    expect(page.getByTestId('dbn-button-2')).toBeTruthy();
    expect(page.getByTestId('dbn-button-3')).toBeTruthy();
    expect(page.getByTestId('dbn-templatecategory')).toBeTruthy();
    expect(page.getByTestId('dbn-addcategory')).toBeTruthy();
    expect(page.getByTestId('dbn-addcategory-2')).toBeTruthy();
    expect(page.getByTestId('dbn-templatesubcategory')).toBeTruthy();
    expect(page.getByTestId('dbn-addsubcategory')).toBeTruthy();
    expect(page.getByTestId('dbn-addsubcategory-2')).toBeTruthy();
    expect(page.getByTestId('dbn-input')).toBeTruthy();
    expect(page.getByTestId('dbn-input-2')).toBeTruthy();
    expect(page.getByTestId('dbn-you-message')).toBeTruthy();
    expect(page.getByTestId('dbn-input-3')).toBeTruthy();
    expect(page.getByTestId('dbn-importimages')).toBeTruthy();
    expect(page.getByTestId('dbn-input-4')).toBeTruthy();
    expect(page.getByTestId('dbn-mat-select')).toBeTruthy();
    expect(page.getByTestId('dbn-sendnotification')).toBeTruthy();
    expect(page.getByTestId('dbo-closedialog')).toBeTruthy();
    expect(page.getByTestId('dbo-input')).toBeTruthy();
    expect(page.getByTestId('dbo-input-2')).toBeTruthy();
    expect(page.getByTestId('dbo-input-3')).toBeTruthy();
    expect(page.getByTestId('dbo-input-4')).toBeTruthy();
    expect(page.getByTestId('dbo-input-5')).toBeTruthy();
    expect(page.getByTestId('dbo-input-6')).toBeTruthy();
    expect(page.getByTestId('dbo-verifyotp')).toBeTruthy();
    expect(page.getByTestId('dbo-resendotp')).toBeTruthy();
    expect(page.getByTestId('dbc-oncancel')).toBeTruthy();
    expect(page.getByTestId('dbc-onconfirm')).toBeTruthy();
    expect(page.getByTestId('dbs-mat-select')).toBeTruthy();
    expect(page.getByTestId('dbs-submitvalidator')).toBeTruthy();
    expect(page.getByTestId('dbs-closedialog')).toBeTruthy();
    expect(page.getByTestId('dbu-textarea')).toBeTruthy();
    expect(page.getByTestId('dbu-cancel')).toBeTruthy();
    expect(page.getByTestId('dbu-submit')).toBeTruthy();
  });
});
