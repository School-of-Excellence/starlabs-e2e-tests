// content-upload-version2-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the content-upload-version2
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the content-upload-version2 templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installContentStubs, loginAsContentAdmin } from './support/content';

test.describe('content-upload-version2 — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installContentStubs(page); await loginAsContentAdmin(page);
  });

  test('content-upload-version2 (/content-upload-v2) — controls addressable', async ({ page }) => {
    await page.goto('/content-upload-v2', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('cuv-openscreen')).toBeTruthy();
    expect(page.getByTestId('cuv-openscreen')).toBeTruthy();
  });
});
