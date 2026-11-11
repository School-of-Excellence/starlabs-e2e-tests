// ei-ai.spec.ts — /viewaigeneratedatc "EI AI" (EIA-01..04), EMULATOR ONLY. Phase 2, plan 2026-10-17.
//
// Lists the latest AI ATC summary per participant. "New ATC" opens Prescribe pre-filled from the AI output.
// The developer View opens the summary (and the participant's source forms — read from the `firestore-forms`
// database, which the emulator build does NOT connect; the seeded summaries carry no forms, so no read is made).
import { test, expect, Page } from '@playwright/test';
import {
  EIA, PF, NAME, ACT, PROC_NAME, RUN, AI_ADJ, MODEL, installAtcGuards, assertNoRealDb, loginAsAtc, atcDoc, waitFor, popupFrom, tid, pickOptions, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const row = (page: Page, pid: string) => page.locator(`[data-testid="eia-row"][data-pid="${pid}"]`);
async function open(page: Page, who: 'admin' | 'dev' = 'admin') {
  await loginAsAtc(page, who);
  await page.goto('/viewaigeneratedatc');
  await expect(row(page, PF.eia)).toBeVisible({ timeout: 45_000 });
}

test.describe('ATC — EI AI (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'ei ai: no fatal console errors');
  });

  test('EIA-01 one row per participant with the latest version; an ATC already made shows Validated', async ({ page }) => {
    await open(page);
    await expect(row(page, PF.eia), 'only the latest version is listed').toHaveCount(1);
    await expect(row(page, PF.eia).getByTestId('eia-name')).toHaveText(NAME.eia);
    await expect(row(page, PF.eia).getByTestId('eia-new-atc')).toBeVisible();
    await expect(row(page, PF.eia2).getByTestId('eia-validated')).toBeVisible();
    await expect(row(page, PF.eia2).getByTestId('eia-new-atc')).toHaveCount(0);
  });

  test('EIA-02 New ATC opens Prescribe pre-filled with the AI adjustment and procedure', async ({ page }) => {
    await open(page);
    const popup = await popupFrom(page, () => row(page, PF.eia).getByTestId('eia-new-atc').click());
    const u = new URL(popup.url());
    expect(u.pathname).toBe('/prescribeATC');
    expect(u.searchParams.get('docid')).toBe(EIA.S1v2);
    expect(u.searchParams.get('aigenerated')).toBe('true');
    const adj = popup.locator(tid('patc-adj-0'));
    // 2026-10-23 (operator: keep the product gating for AI entries too): the AI link brings the participant and
    // the adjustments but no product, so the form waits for the product pick like any other Prescribe entry
    const product = popup.getByTestId('patc-product');
    await expect(product).toHaveAttribute('aria-disabled', 'false', { timeout: 60_000 });
    await expect(adj, 'form hidden until a product is picked').toHaveCount(0);
    await pickOptions(popup, product, [MODEL.alpha], false);
    await expect(adj.getByTestId('patc-adj-text')).toHaveValue(`${AI_ADJ}, Outcome: Calmer`, { timeout: 60_000 });
    await expect(adj.getByTestId('patc-proc-name').first()).toContainText(PROC_NAME.one);
    // the AI gave areas + a summary → the AI section shows both (2026-10-23)
    await expect(popup.getByTestId('patc-ai-section')).toBeVisible();
    await expect(popup.getByTestId('patc-ai-areas')).toContainText('Sleep');
    await expect(popup.getByTestId('patc-ai-summary')).toContainText(`AI summary for ${RUN}`);
    // EIA-04 continues this draft: let the product pick reach it before closing
    await expect(popup.getByTestId('patc-draft-status')).toHaveText(/Draft saved\./, { timeout: 30_000 });
    await popup.close();
  });

  test('EIA-03 a developer views the summary and saves an edit', async ({ page }) => {
    await open(page, 'dev');
    await row(page, PF.eia).getByTestId('eia-view').click();
    await expect(page.getByTestId('eia-summary')).toContainText(`AI summary for ${RUN}`, { timeout: 30_000 });
    await expect(page.getByTestId('eia-form-title'), 'no source forms on this summary').toHaveCount(0);
    await page.getByTestId('eia-edit').click();
    await page.getByTestId('eia-summary-text').fill(`Edited AI summary ${RUN}`);
    await page.getByTestId('eia-save').click();
    await waitFor(async () => (await atcDoc(`ai_generated_atc_summary/${EIA.S1v2}`))?.output === `Edited AI summary ${RUN}`, 'summary saved');
  });

  test('EIA-04 Continue on the AI draft shows the AI section again; after submit the next ATC has none', async ({ page }) => {
    // the AI draft EIA-02 created (temporary_ATC/<summary id>), reopened the normal way on a fresh page
    await loginAsAtc(page, 'admin');
    await page.goto('/prescribeATC');
    const participant = page.getByTestId('patc-participant');
    await expect(participant).toHaveAttribute('aria-disabled', 'false', { timeout: 45_000 });
    await pickOptions(page, participant, [NAME.eia], false);
    await page.locator('[data-testid^="atco-draft-select-"]').first().click({ timeout: 30_000 });
    await expect(page.getByTestId('patc-ai-section'), 'restored from the draft').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('patc-ai-areas')).toContainText('Sleep');
    await expect(page.getByTestId('patc-ai-summary')).toContainText(`AI summary for ${RUN}`);

    // submit it …
    await pickOptions(page, page.locator(tid(`patc-author-${ACT.author}`)), [NAME.admin]);
    const adj = page.locator(tid('patc-adj-0'));
    await pickOptions(page, adj.getByTestId('patc-adj-awareness'), [/^\s*Aware\s*$/], false);
    await adj.getByTestId('patc-adj-years').fill('2');
    await adj.getByTestId('patc-adj-years').blur();
    await page.getByTestId('patc-points').fill('points EIA-04');
    await page.getByTestId('patc-points').blur();
    await page.getByTestId('patc-casenotes').fill('notes EIA-04');
    await page.getByTestId('patc-casenotes').blur();
    await expect(page.getByTestId('patc-draft-status')).toHaveText(/Draft saved\./, { timeout: 30_000 });
    await page.getByTestId('patc-submit').click();
    await page.getByTestId('aael-submit').click();
    await expect(page.locator('mat-snack-bar-container').filter({ hasText: 'The ATC has been submitted successfully' })).toBeVisible({ timeout: 45_000 });

    // … then a new ATC in the same tab must not show the previous participant's AI summary
    await expect(participant).toHaveAttribute('aria-disabled', 'false', { timeout: 30_000 });
    await pickOptions(page, participant, [NAME.eia2], false);
    // a leftover eia2 draft would open the picker first — take Start fresh if it shows
    if (await page.getByTestId('atco-close').waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
      await page.getByTestId('atco-close').click();
    }
    await pickOptions(page, page.getByTestId('patc-product'), [MODEL.alpha], false);
    await expect(page.locator(tid('patc-adj-0'))).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('patc-ai-section'), 'cleared after submit').toHaveCount(0);
  });
});
