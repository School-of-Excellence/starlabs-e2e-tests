// live-prescription.spec.ts — /liveprescription/:draft (LRX-01..03), EMULATOR ONLY. Phase 2, plan 2026-10-17.
//
// The read-only collaborator view of an in-progress Prescribe draft (temporary_ATC). LRX-02 drives a REAL
// Prescribe session in one tab and watches the live view in another update as Prescribe autosaves.
import { test, expect } from '@playwright/test';
import {
  PF, NAME, MODEL, PROC_NAME, RUN, LRX_DRAFT, installAtcGuards, assertNoRealDb, loginAsAtc, atcDb, waitFor, pickOptions, tid, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe('ATC — Live Prescription (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'live prescription: no fatal console errors');
  });

  test('LRX-01 a draft link shows the participant, product, prescribers, adjustments, procedures and notes', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto(`/liveprescription/${LRX_DRAFT}`);
    await expect(page.getByTestId('lrx-owner')).toContainText(NAME.lrx, { timeout: 45_000 });
    await expect(page.getByTestId('lrx-product')).toContainText(MODEL.alpha);
    await expect(page.getByTestId('lrx-prescribers')).toContainText(NAME.admin);
    await expect(page.getByTestId('lrx-adj').first()).toContainText(`LRX adjustment ${RUN}`);
    await expect(page.getByTestId('lrx-proc').first()).toContainText(PROC_NAME.one);
    await expect(page.getByTestId('lrx-casenotes')).toContainText(`LRX case notes ${RUN}`);
  });

  test('LRX-02 the live view follows a real Prescribe session as it autosaves', async ({ page, context }) => {
    await loginAsAtc(page, 'admin');
    await page.goto('/prescribeATC');
    const sel = page.getByTestId('patc-participant');
    await expect(sel).toHaveAttribute('aria-disabled', 'false', { timeout: 45_000 });
    await pickOptions(page, sel, [NAME.lrx2], false);
    await pickOptions(page, page.getByTestId('patc-product'), [MODEL.alpha], false);
    const draft = await waitFor(async () => {
      const d = (await atcDb().collection('temporary_ATC').where('profileid', '==', PF.lrx2).get()).docs.find((x) => x.data().delete === false);
      return d || null;
    }, 'Prescribe created the draft');

    const live = await context.newPage();
    const g2 = await installAtcGuards(live);
    await live.goto(`/liveprescription/${draft.id}`);
    await expect(live.getByTestId('lrx-owner')).toContainText(NAME.lrx2, { timeout: 45_000 });

    await page.locator(tid('patc-adj-0')).getByTestId('patc-adj-text').fill(`LRX-02 typed live ${RUN}`);
    await page.locator(tid('patc-adj-0')).getByTestId('patc-adj-text').blur();
    await expect(live.getByTestId('lrx-adj').first(), 'the live view updates from the autosave').toContainText(`LRX-02 typed live ${RUN}`, { timeout: 30_000 });
    assertNoRealDb(g2);
  });

  test('LRX-03 an unknown draft says it is deleted or not started', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto(`/liveprescription/${RUN}_no_such_draft`);
    await expect(page.getByTestId('lrx-status')).toContainText('deleted or yet to start', { timeout: 45_000 });
  });
});
