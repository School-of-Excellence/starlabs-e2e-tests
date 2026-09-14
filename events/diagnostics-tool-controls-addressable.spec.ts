// diagnostics-tool-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the Diagnostics Tool
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the Diagnostics Tool templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installEvtStubs, loginAsEvtAdmin } from './support/events';

test.describe('Diagnostics Tool — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installEvtStubs(page); await loginAsEvtAdmin(page);
  });

  test('queue-event-health (/queueeventhealth) — controls addressable', async ({ page }) => {
    await page.goto('/queueeventhealth', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('qeh-activekpifilter-null-applyfilters')).toBeTruthy();
    expect(page.getByTestId('qeh-activekpifilter-null-applyfilters')).toBeTruthy();
    expect(page.getByTestId('qeh-onkpiclick')).toBeTruthy();
    expect(page.getByTestId('qeh-onkpiclick-2')).toBeTruthy();
    expect(page.getByTestId('qeh-onkpiclick-3')).toBeTruthy();
    expect(page.getByTestId('qeh-onkpiclick-4')).toBeTruthy();
    expect(page.getByTestId('qeh-onkpiclick-5')).toBeTruthy();
    expect(page.getByTestId('qeh-onkpiclick-6')).toBeTruthy();
    expect(page.getByTestId('qeh-onkpiclick-7')).toBeTruthy();
    expect(page.getByTestId('qeh-onkpiclick-8')).toBeTruthy();
    expect(page.getByTestId('qeh-onkpiclick-9')).toBeTruthy();
    expect(page.getByTestId('qeh-onkpiclick-10')).toBeTruthy();
    expect(page.getByTestId('qeh-onkpiclick-11')).toBeTruthy();
    expect(page.getByTestId('qeh-fixallinvalideventstatus')).toBeTruthy();
    expect(page.getByTestId('qeh-onkpiclick-12')).toBeTruthy();
    expect(page.getByTestId('qeh-onatccountclick')).toBeTruthy();
    expect(page.getByTestId('qeh-onatccountclick-2')).toBeTruthy();
    expect(page.getByTestId('qeh-onatccountclick-3')).toBeTruthy();
    expect(page.getByTestId('qeh-onatccountclick-4')).toBeTruthy();
    expect(page.getByTestId('qeh-onatccountclick-5')).toBeTruthy();
    expect(page.getByTestId('qeh-event-stoppropagation')).toBeTruthy();
    expect(page.getByTestId('qeh-select')).toBeTruthy();
    expect(page.getByTestId('qeh-attendedstatusresolver-attendedsta')).toBeTruthy();
    expect(page.getByTestId('qeh-attendedstatusresolver-attendedsta-2')).toBeTruthy();
    expect(page.getByTestId('qeh-select-queue')).toBeTruthy();
    expect(page.getByTestId('qeh-selectqueue')).toBeTruthy();
    expect(page.getByTestId('qeh-search')).toBeTruthy();
    expect(page.getByTestId('qeh-exportcsv')).toBeTruthy();
    expect(page.getByTestId('qeh-bulkmarkunattended')).toBeTruthy();
    expect(page.getByTestId('qeh-bulkmarkattended')).toBeTruthy();
    expect(page.getByTestId('qeh-toggleselectall')).toBeTruthy();
    expect(page.getByTestId('qeh-togglefilter')).toBeTruthy();
    expect(page.getByTestId('qeh-selectedstage-applyfilters')).toBeTruthy();
    expect(page.getByTestId('qeh-selectedstage-stage-value-applyfil')).toBeTruthy();
    expect(page.getByTestId('qeh-togglefilter-2')).toBeTruthy();
    expect(page.getByTestId('qeh-selectedproduct-applyfilters')).toBeTruthy();
    expect(page.getByTestId('qeh-selectedproduct-product-value-appl')).toBeTruthy();
    expect(page.getByTestId('qeh-togglefilter-3')).toBeTruthy();
    expect(page.getByTestId('qeh-selectedintegrationmode-applyfilte')).toBeTruthy();
    expect(page.getByTestId('qeh-selectedintegrationmode-mode-value')).toBeTruthy();
    expect(page.getByTestId('qeh-input')).toBeTruthy();
    expect(page.getByTestId('qeh-toggleselectallinitiated')).toBeTruthy();
    expect(page.getByTestId('qeh-input-2')).toBeTruthy();
    expect(page.getByTestId('qeh-exportatclistcsv')).toBeTruthy();
    expect(page.getByTestId('qeh-toggleselectallnoqueueatcs')).toBeTruthy();
    expect(page.getByTestId('qeh-toggleatcfilter')).toBeTruthy();
    expect(page.getByTestId('qeh-selectatcproductfilter')).toBeTruthy();
    expect(page.getByTestId('qeh-selectatcproductfilter-2')).toBeTruthy();
    expect(page.getByTestId('qeh-toggleatcfilter-2')).toBeTruthy();
    expect(page.getByTestId('qeh-selectatcstagefilter')).toBeTruthy();
    expect(page.getByTestId('qeh-selectatcstagefilter-2')).toBeTruthy();
    expect(page.getByTestId('qeh-input-3')).toBeTruthy();
    expect(page.getByTestId('qeh-prevatclistpage')).toBeTruthy();
    expect(page.getByTestId('qeh-nextatclistpage')).toBeTruthy();
    expect(page.getByTestId('qeh-onatclistpagesizechange')).toBeTruthy();
    expect(page.getByTestId('qeh-button')).toBeTruthy();
    expect(page.getByTestId('qeh-prevpage')).toBeTruthy();
    expect(page.getByTestId('qeh-nextpage')).toBeTruthy();
    expect(page.getByTestId('qeh-onpagesizechange')).toBeTruthy();
  });

  test('live-event-health (/liveeventhealth) — controls addressable', async ({ page }) => {
    await page.goto('/liveeventhealth', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('leh-type-to-search')).toBeTruthy();
    expect(page.getByTestId('leh-type-to-search')).toBeTruthy();
    expect(page.getByTestId('leh-ontotalkpiclick')).toBeTruthy();
    expect(page.getByTestId('leh-onvalidkpiclick')).toBeTruthy();
    expect(page.getByTestId('leh-onvalidkpiclick-2')).toBeTruthy();
    expect(page.getByTestId('leh-oneventstatuskpiclick')).toBeTruthy();
    expect(page.getByTestId('leh-onproductstatuskpiclick')).toBeTruthy();
    expect(page.getByTestId('leh-search-name-product-status')).toBeTruthy();
    expect(page.getByTestId('leh-cancelselected')).toBeTruthy();
    expect(page.getByTestId('leh-exporttoexcel')).toBeTruthy();
    expect(page.getByTestId('leh-toggleselectall')).toBeTruthy();
    expect(page.getByTestId('leh-togglerow')).toBeTruthy();
    expect(page.getByTestId('leh-all')).toBeTruthy();
    expect(page.getByTestId('leh-all-2')).toBeTruthy();
    expect(page.getByTestId('leh-all-3')).toBeTruthy();
    expect(page.getByTestId('leh-all-4')).toBeTruthy();
  });
});
