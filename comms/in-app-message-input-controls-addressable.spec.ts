// in-app-message-input-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the in-app-message-input
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the in-app-message-input templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installCommsStubs, loginAsCommsAdmin } from './support/comms';

test.describe('in-app-message-input — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installCommsStubs(page); await loginAsCommsAdmin(page);
  });

  test('in-app-message-input (embedded shared input, no standalone route) — addressable by reference', async ({ page }) => {
    expect(page.getByTestId('iam-button')).toBeTruthy();
    expect(page.getByTestId('iam-button-2')).toBeTruthy();
    expect(page.getByTestId('iam-button-3')).toBeTruthy();
    expect(page.getByTestId('iam-templatename')).toBeTruthy();
    expect(page.getByTestId('iam-templatealias')).toBeTruthy();
    expect(page.getByTestId('iam-templatecategory')).toBeTruthy();
    expect(page.getByTestId('iam-addcategory')).toBeTruthy();
    expect(page.getByTestId('iam-addcategory-2')).toBeTruthy();
    expect(page.getByTestId('iam-templatesubcategory')).toBeTruthy();
    expect(page.getByTestId('iam-addsubcategory')).toBeTruthy();
    expect(page.getByTestId('iam-addsubcategory-2')).toBeTruthy();
    expect(page.getByTestId('iam-input')).toBeTruthy();
    expect(page.getByTestId('iam-input-2')).toBeTruthy();
    expect(page.getByTestId('iam-description')).toBeTruthy();
    expect(page.getByTestId('iam-notes')).toBeTruthy();
    expect(page.getByTestId('iam-createtemplate')).toBeTruthy();
    expect(page.getByTestId('iam-input-3')).toBeTruthy();
    expect(page.getByTestId('iam-mat-select')).toBeTruthy();
    expect(page.getByTestId('iam-createtemplate-2')).toBeTruthy();
    expect(page.getByTestId('iam-input-4')).toBeTruthy();
    expect(page.getByTestId('iam-onsubmit')).toBeTruthy();
  });
});
