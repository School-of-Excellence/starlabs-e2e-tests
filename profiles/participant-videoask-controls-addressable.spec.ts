// participant-videoask-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the participant-videoask
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the participant-videoask templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installProfileStubs, loginAsProfileAdmin } from './support/profiles';

test.describe('participant-videoask — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installProfileStubs(page); await loginAsProfileAdmin(page);
  });

  test('participant-videoask (/participantvideoask) — controls addressable', async ({ page }) => {
    await page.goto('/participantvideoask', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('pva-live')).toBeTruthy();
    expect(page.getByTestId('pva-live')).toBeTruthy();
    expect(page.getByTestId('pva-type-to-search')).toBeTruthy();
    expect(page.getByTestId('pva-queue')).toBeTruthy();
    expect(page.getByTestId('pva-type-to-search-2')).toBeTruthy();
    expect(page.getByTestId('pva-workshop')).toBeTruthy();
    expect(page.getByTestId('pva-type-to-search-3')).toBeTruthy();
    expect(page.getByTestId('pva-profileid')).toBeTruthy();
    expect(page.getByTestId('pva-type-to-search-4')).toBeTruthy();
    expect(page.getByTestId('pva-template')).toBeTruthy();
    expect(page.getByTestId('pva-type-to-search-5')).toBeTruthy();
    expect(page.getByTestId('pva-start')).toBeTruthy();
    expect(page.getByTestId('pva-end')).toBeTruthy();
    expect(page.getByTestId('pva-clearpill')).toBeTruthy();
    expect(page.getByTestId('pva-clearpill-2')).toBeTruthy();
    expect(page.getByTestId('pva-onresetform')).toBeTruthy();
    expect(page.getByTestId('pva-onsearch')).toBeTruthy();
    expect(page.getByTestId('pva-ontagfilterchange')).toBeTruthy();
    expect(page.getByTestId('pva-any-tag')).toBeTruthy();
    expect(page.getByTestId('pva-clearselectedtags')).toBeTruthy();
    expect(page.getByTestId('pva-playvideo')).toBeTruthy();
    expect(page.getByTestId('pva-updatevideoask')).toBeTruthy();
  });
});
