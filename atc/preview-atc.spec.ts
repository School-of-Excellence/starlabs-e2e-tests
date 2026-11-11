// preview-atc.spec.ts — /previewATC (PVA-01..05), EMULATOR ONLY. Phase 2, plan 2026-10-17.
//
// The reviewer screen the BIG boards open (window.open) to close a participant assignment. Opened here by
// direct URL with the same query params. Each action uses its own seeded `big participants assignments` doc.
// PVA-04 covers bug #1 (fixed 2026-10-17): Rework wrote an ATC-database ref into a default-database doc.
import { test, expect, Page } from '@playwright/test';
import {
  ATC2, PA, NAME, PROC_NAME, MODEL, RUN, installAtcGuards, assertNoRealDb, loginAsAtc, defaultDb, atcDoc, waitFor, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const open = async (page: Page, type: 'alpha' | 'validation', atc: string, pa: string) => {
  await loginAsAtc(page, 'admin');
  await page.goto(`/previewATC?type=${type}&atcdocid=${atc}&participantassignmentid=${pa}`);
  await expect(page.getByTestId('pva-participant')).toBeVisible({ timeout: 45_000 });
};
const assignment = async (id: string) => (await defaultDb().collection('big participants assignments').doc(id).get()).data();

test.describe('ATC — Preview ATC (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'preview atc: no fatal console errors');
  });

  test('PVA-01 renders participant, product, directive, adjustments and procedures (alpha and validation)', async ({ page }) => {
    await open(page, 'alpha', ATC2.PV_A, PA.activity);
    await expect(page.getByTestId('pva-participant')).toHaveText(NAME.pva);
    await expect(page.getByTestId('pva-product')).toHaveText(MODEL.alpha);
    await expect(page.getByTestId('pva-directive')).toHaveText(`Seed directive ${MODEL.alpha}`);
    await expect(page.getByTestId('pva-adj-title').first()).toContainText(`PV_A adjustment ${RUN}`);
    await expect(page.getByTestId('pva-proc-name').first()).toContainText(PROC_NAME.one);
    await expect(page.getByTestId('pva-notes')).toContainText(`PV_A consultation point ${RUN}`);
    await expect(page.getByTestId('pva-notes')).toContainText(`PV_A case notes ${RUN}`);

    await page.goto(`/previewATC?type=validation&atcdocid=${ATC2.PV_V}&participantassignmentid=${PA.activity}`);
    await expect(page.getByTestId('pva-product')).toHaveText(MODEL.beta, { timeout: 30_000 });
    await expect(page.getByTestId('pva-adj-title').first()).toContainText(`PV_V adjustment ${RUN}`);
  });

  test('PVA-02 Activity Completed closes the assignment with the notes as summary', async ({ page }) => {
    await open(page, 'validation', ATC2.PV_V, PA.activity);
    await page.getByTestId('pva-action-notes').fill(`PVA-02 notes ${RUN}`);
    await page.getByTestId('pva-activity-completed').click();
    const a = await waitFor(async () => { const d = await assignment(PA.activity); return d?.status === 'completed' ? d : null; }, 'assignment completed');
    expect(a.summary).toBe(`PVA-02 notes ${RUN}`);
  });

  test('PVA-03 ATC Validated also marks the ATC validated', async ({ page }) => {
    await open(page, 'validation', ATC2.PV_V2, PA.validated);
    await page.getByTestId('pva-action-notes').fill(`PVA-03 notes ${RUN}`);
    await page.getByTestId('pva-atc-validated').click();
    await waitFor(async () => (await assignment(PA.validated))?.status === 'completed', 'assignment completed');
    await waitFor(async () => (await atcDoc(`atc_to_validate/${ATC2.PV_V2}`))?.status === 'validated', 'ATC validated');
  });

  test('PVA-04 Mark for Rework moves the assignment to rework with a log entry (bug #1 fixed)', async ({ page }) => {
    await open(page, 'validation', ATC2.PV_V, PA.rework);
    await page.getByTestId('pva-action-notes').fill(`PVA-04 rework ${RUN}`);
    await page.getByTestId('pva-rework').click();
    const a = await waitFor(async () => { const d = await assignment(PA.rework); return d?.status === 'rework' ? d : null; }, 'assignment rework');
    expect(a.activitylog).toHaveLength(1);
    expect(a.activitylog[0].notes).toBe(`PVA-04 rework ${RUN}`);
    expect(a.activityref.path, 'activityref points at the ATC (default-database ref, path only)').toBe(`atc_to_validate/${ATC2.PV_V}`);
  });

  test('PVA-05 the actions stay disabled until notes are written', async ({ page }) => {
    await open(page, 'validation', ATC2.PV_V, PA.activity);
    await expect(page.getByTestId('pva-rework')).toBeDisabled();
    await expect(page.getByTestId('pva-activity-completed')).toBeDisabled();
    await expect(page.getByTestId('pva-atc-validated')).toBeDisabled();
    await page.getByTestId('pva-action-notes').fill('x');
    await expect(page.getByTestId('pva-rework')).toBeEnabled();
  });
});
