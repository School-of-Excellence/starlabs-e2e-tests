// ei-ai.spec.ts — /viewaigeneratedatc "EI AI" (EIA-01..03), EMULATOR ONLY. Phase 2, plan 2026-10-17.
//
// Lists the latest AI ATC summary per participant. "New ATC" opens Prescribe pre-filled from the AI output.
// The developer View opens the summary (and the participant's source forms — read from the `firestore-forms`
// database, which the emulator build does NOT connect; the seeded summaries carry no forms, so no read is made).
import { test, expect, Page } from '@playwright/test';
import {
  EIA, PF, NAME, PROC_NAME, RUN, AI_ADJ, installAtcGuards, assertNoRealDb, loginAsAtc, atcDoc, waitFor, popupFrom, tid, AtcGuard,
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
    await expect(row(page, PF.eia).getByTestId('eia-version')).toHaveText('v2');
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
    await expect(adj.getByTestId('patc-adj-text')).toHaveValue(`${AI_ADJ}, Outcome: Calmer`, { timeout: 60_000 });
    await expect(adj.getByTestId('patc-proc-name').first()).toContainText(PROC_NAME.one);
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
});
