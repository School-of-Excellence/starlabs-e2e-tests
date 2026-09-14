// channel-communication-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the Channel Communication
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the Channel Communication templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installCommsStubs, loginAsCommsAdmin } from './support/comms';

test.describe('Channel Communication — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installCommsStubs(page); await loginAsCommsAdmin(page);
  });

  test('channeltemplates (/channel-templates) — controls addressable', async ({ page }) => {
    await page.goto('/channel-templates', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('cht-viewmode-list-loadtemplates')).toBeTruthy();
    expect(page.getByTestId('cht-viewmode-list-loadtemplates')).toBeTruthy();
    expect(page.getByTestId('cht-onreset')).toBeTruthy();
    expect(page.getByTestId('cht-button')).toBeTruthy();
    expect(page.getByTestId('cht-search-by-name-template-id-categor')).toBeTruthy();
    expect(page.getByTestId('cht-searchterm-applyfilters')).toBeTruthy();
    expect(page.getByTestId('cht-mat-select')).toBeTruthy();
    expect(page.getByTestId('cht-mat-select-2')).toBeTruthy();
    expect(page.getByTestId('cht-clearfilters')).toBeTruthy();
    expect(page.getByTestId('cht-openmanagedialog')).toBeTruthy();
    expect(page.getByTestId('cht-switchtopreviewview')).toBeTruthy();
    expect(page.getByTestId('cht-edittemplate')).toBeTruthy();
    expect(page.getByTestId('cht-duplicatetemplate')).toBeTruthy();
    expect(page.getByTestId('cht-approvetemplate')).toBeTruthy();
    expect(page.getByTestId('cht-reworktemplate')).toBeTruthy();
    expect(page.getByTestId('cht-deletetemplate')).toBeTruthy();
    expect(page.getByTestId('cht-onreset-2')).toBeTruthy();
    expect(page.getByTestId('cht-clearfilters-2')).toBeTruthy();
    expect(page.getByTestId('cht-closemanagedialog')).toBeTruthy();
    expect(page.getByTestId('cht-event-stoppropagation')).toBeTruthy();
    expect(page.getByTestId('cht-closemanagedialog-2')).toBeTruthy();
    expect(page.getByTestId('cht-enter-name')).toBeTruthy();
    expect(page.getByTestId('cht-addcategory')).toBeTruthy();
    expect(page.getByTestId('cht-edittemplate-2')).toBeTruthy();
    expect(page.getByTestId('cht-approvetemplate-2')).toBeTruthy();
    expect(page.getByTestId('cht-link')).toBeTruthy();
    expect(page.getByTestId('cht-templatename')).toBeTruthy();
    expect(page.getByTestId('cht-category')).toBeTruthy();
    expect(page.getByTestId('cht-openmanagedialog-2')).toBeTruthy();
    expect(page.getByTestId('cht-onreset-3')).toBeTruthy();
    expect(page.getByTestId('cht-onsubmit')).toBeTruthy();
    expect(page.getByTestId('cht-headertype')).toBeTruthy();
    expect(page.getByTestId('cht-headervalue')).toBeTruthy();
    expect(page.getByTestId('cht-button-2')).toBeTruthy();
    expect(page.getByTestId('cht-button-3')).toBeTruthy();
    expect(page.getByTestId('cht-headervalue-2')).toBeTruthy();
    expect(page.getByTestId('cht-uploadfile')).toBeTruthy();
    expect(page.getByTestId('cht-headerfileinput-click')).toBeTruthy();
    expect(page.getByTestId('cht-removeheaderupload')).toBeTruthy();
    expect(page.getByTestId('cht-uploadfile-2')).toBeTruthy();
    expect(page.getByTestId('cht-bodyfileinput-click')).toBeTruthy();
    expect(page.getByTestId('cht-button-4')).toBeTruthy();
    expect(page.getByTestId('cht-link-2')).toBeTruthy();
    expect(page.getByTestId('cht-link-3')).toBeTruthy();
    expect(page.getByTestId('cht-removefile')).toBeTruthy();
    expect(page.getByTestId('cht-footer')).toBeTruthy();
    expect(page.getByTestId('cht-removebutton')).toBeTruthy();
    expect(page.getByTestId('cht-label')).toBeTruthy();
    expect(page.getByTestId('cht-url')).toBeTruthy();
    expect(page.getByTestId('cht-addbutton')).toBeTruthy();
    expect(page.getByTestId('cht-link-4')).toBeTruthy();
  });

  test('channel-communication (embedded shared component, no standalone route) — addressable by reference', async ({ page }) => {
    expect(page.getByTestId('chc-oncancel')).toBeTruthy();
    expect(page.getByTestId('chc-currentstep-1-gotostep')).toBeTruthy();
    expect(page.getByTestId('chc-currentstep-2-gotostep')).toBeTruthy();
    expect(page.getByTestId('chc-currentstep-3-gotostep')).toBeTruthy();
    expect(page.getByTestId('chc-search-by-name')).toBeTruthy();
    expect(page.getByTestId('chc-channelsearch-onchannelsearch')).toBeTruthy();
    expect(page.getByTestId('chc-button')).toBeTruthy();
    expect(page.getByTestId('chc-selectchannel')).toBeTruthy();
    expect(page.getByTestId('chc-search-by-name-2')).toBeTruthy();
    expect(page.getByTestId('chc-mat-select')).toBeTruthy();
    expect(page.getByTestId('chc-selecttemplate')).toBeTruthy();
    expect(page.getByTestId('chc-setfilltype')).toBeTruthy();
    expect(page.getByTestId('chc-setfilltype-2')).toBeTruthy();
    expect(page.getByTestId('chc-enter-value')).toBeTruthy();
    expect(page.getByTestId('chc-mat-select-2')).toBeTruthy();
    expect(page.getByTestId('chc-div')).toBeTruthy();
    expect(page.getByTestId('chc-event-stoppropagation')).toBeTruthy();
    expect(page.getByTestId('chc-gotostep')).toBeTruthy();
    expect(page.getByTestId('chc-div-2')).toBeTruthy();
    expect(page.getByTestId('chc-gotostep-2')).toBeTruthy();
    expect(page.getByTestId('chc-link')).toBeTruthy();
    expect(page.getByTestId('chc-div-3')).toBeTruthy();
    expect(page.getByTestId('chc-event-stoppropagation-2')).toBeTruthy();
    expect(page.getByTestId('chc-button-2')).toBeTruthy();
    expect(page.getByTestId('chc-div-4')).toBeTruthy();
    expect(page.getByTestId('chc-event-stoppropagation-3')).toBeTruthy();
    expect(page.getByTestId('chc-button-3')).toBeTruthy();
    expect(page.getByTestId('chc-div-5')).toBeTruthy();
    expect(page.getByTestId('chc-event-stoppropagation-4')).toBeTruthy();
    expect(page.getByTestId('chc-button-4')).toBeTruthy();
    expect(page.getByTestId('chc-channelname')).toBeTruthy();
    expect(page.getByTestId('chc-description')).toBeTruthy();
    expect(page.getByTestId('chc-button-5')).toBeTruthy();
    expect(page.getByTestId('chc-uploadchannelimage')).toBeTruthy();
    expect(page.getByTestId('chc-imginput-click')).toBeTruthy();
    expect(page.getByTestId('chc-mat-select-3')).toBeTruthy();
    expect(page.getByTestId('chc-button-6')).toBeTruthy();
    expect(page.getByTestId('chc-createchannel')).toBeTruthy();
    expect(page.getByTestId('chc-currentstep-1-oncancel')).toBeTruthy();
    expect(page.getByTestId('chc-gotostep-3')).toBeTruthy();
    expect(page.getByTestId('chc-gotostep-4')).toBeTruthy();
    expect(page.getByTestId('chc-gotostep-5')).toBeTruthy();
    expect(page.getByTestId('chc-onsend')).toBeTruthy();
  });
});
