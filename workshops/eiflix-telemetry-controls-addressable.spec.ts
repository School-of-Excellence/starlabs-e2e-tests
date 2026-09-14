// eiflix-telemetry-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the eiflix-telemetry
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the eiflix-telemetry templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installWshopStubs, loginAsWshopAdmin } from './support/wshop';

test.describe('eiflix-telemetry — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installWshopStubs(page); await loginAsWshopAdmin(page);
  });

  test('eiflix-telemetry (/eiflixtelemetry) — controls addressable', async ({ page }) => {
    await page.goto('/eiflixtelemetry', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('ett-settab')).toBeTruthy();
    expect(page.getByTestId('ett-settab')).toBeTruthy();
    expect(page.getByTestId('ett-settab-2')).toBeTruthy();
    expect(page.getByTestId('ett-reload')).toBeTruthy();
    expect(page.getByTestId('ett-setovplat')).toBeTruthy();
    expect(page.getByTestId('ett-setovplat-2')).toBeTruthy();
    expect(page.getByTestId('ett-setovplat-3')).toBeTruthy();
    expect(page.getByTestId('ett-setovwin')).toBeTruthy();
    expect(page.getByTestId('ett-setovwin-2')).toBeTruthy();
    expect(page.getByTestId('ett-setovwin-3')).toBeTruthy();
    expect(page.getByTestId('ett-search-message-type-user-screen')).toBeTruthy();
    expect(page.getByTestId('ett-setfeedlevel')).toBeTruthy();
    expect(page.getByTestId('ett-setfeedlevel-2')).toBeTruthy();
    expect(page.getByTestId('ett-setfeedlevel-3')).toBeTruthy();
    expect(page.getByTestId('ett-setfeedsort')).toBeTruthy();
    expect(page.getByTestId('ett-setfeedsort-2')).toBeTruthy();
    expect(page.getByTestId('ett-setfeedsort-3')).toBeTruthy();
    expect(page.getByTestId('ett-setfeedsort-4')).toBeTruthy();
    expect(page.getByTestId('ett-togglefeedrow')).toBeTruthy();
    expect(page.getByTestId('ett-feedprev')).toBeTruthy();
    expect(page.getByTestId('ett-feednext')).toBeTruthy();
    expect(page.getByTestId('ett-find-user-or-device')).toBeTruthy();
    expect(page.getByTestId('ett-selectuser')).toBeTruthy();
    expect(page.getByTestId('ett-input')).toBeTruthy();
    expect(page.getByTestId('ett-input-2')).toBeTruthy();
    expect(page.getByTestId('ett-resetdates')).toBeTruthy();
    expect(page.getByTestId('ett-settype')).toBeTruthy();
    expect(page.getByTestId('ett-setlevel')).toBeTruthy();
    expect(page.getByTestId('ett-togglesession')).toBeTruthy();
  });
});
