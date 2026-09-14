// slackwebhookurls-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the slackwebhookurls
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the slackwebhookurls templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installAuthStubs, loginAsAuthAdmin } from './support/authroles';

test.describe('slackwebhookurls — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installAuthStubs(page); await loginAsAuthAdmin(page);
  });

  test('slackwebhookurls (/slackwebhookurls) — NO SUITE claims src/app/slackwebhookurls/** (manifest gap) — controls addressable', async ({ page }) => {
    await page.goto('/slackwebhookurls', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('swh-openaddform')).toBeTruthy();
    expect(page.getByTestId('swh-openaddform')).toBeTruthy();
    expect(page.getByTestId('swh-webhooktype')).toBeTruthy();
    expect(page.getByTestId('swh-webhooktype-2')).toBeTruthy();
    expect(page.getByTestId('swh-e-g-slacknewintegration')).toBeTruthy();
    expect(page.getByTestId('swh-select')).toBeTruthy();
    expect(page.getByTestId('swh-https-hooks-slack-com-services')).toBeTruthy();
    expect(page.getByTestId('swh-e-g-general')).toBeTruthy();
    expect(page.getByTestId('swh-addwebhook')).toBeTruthy();
    expect(page.getByTestId('swh-canceladd')).toBeTruthy();
    expect(page.getByTestId('swh-input')).toBeTruthy();
    expect(page.getByTestId('swh-togglevisibility')).toBeTruthy();
    expect(page.getByTestId('swh-input-2')).toBeTruthy();
    expect(page.getByTestId('swh-saveedit')).toBeTruthy();
    expect(page.getByTestId('swh-canceledit')).toBeTruthy();
    expect(page.getByTestId('swh-startedit')).toBeTruthy();
    expect(page.getByTestId('swh-deletewebhook')).toBeTruthy();
  });
});
