// view-assigned-atc.spec.ts — /viewassignedATC "Mark Changework Status" (VAA-01..05), EMULATOR ONLY. Phase 2.
//
// The change-agent work queue. AS1 is assigned to agent1 at ATC, correction and procedure level; its three
// procedures are used once each (complete / auto-generalize / undo), so the cases stay order-independent.
import { test, expect, Page } from '@playwright/test';
import {
  ATC2, PF, NAME, ACT, PROC_NAME, installAtcGuards, assertNoRealDb, loginAsAtc, atcDb, atcDoc, waitFor, pickOptions, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const PROC_PATH = (n: number) => `atc_alpha/${ATC2.AS1}/corrections/adjustment 01/procedures/adjustment 01 - ${n}`;
const atcBox = (page: Page) => page.locator(`[data-testid="vaa-atc"][data-atc="${ATC2.AS1}"]`);
const procBox = (page: Page, n: number) => atcBox(page).locator(`[data-testid="vaa-proc"][data-proc="adjustment 01 - ${n}"]`);

async function openAsAgent(page: Page) {
  await loginAsAtc(page, 'agent1');
  await page.goto('/viewassignedATC');
  await expect(procBox(page, 1)).toBeVisible({ timeout: 45_000 });
}

test.describe('ATC — View Assigned ATC (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'view assigned atc: no fatal console errors');
  });

  test('VAA-01 a change agent sees only the ATCs assigned to them; the agent filter is locked', async ({ page }) => {
    const mine = (await atcDb().collection('atc_alpha').where('implementationagent', 'array-contains', PF.agent1)
      .where('isdelete', '==', false).get()).docs.map((d) => d.id);
    expect(mine, 'precondition: AS1 is the ATC assigned to agent1').toContain(ATC2.AS1);
    await openAsAgent(page);
    await expect(page.getByTestId('vaa-atc')).toHaveCount(mine.length);
    await expect(page.getByTestId('vaa-filter-ca')).toHaveAttribute('aria-disabled', 'true');
    await expect(procBox(page, 1).getByTestId('vaa-proc-name')).toContainText(PROC_NAME.one);
  });

  test('VAA-02 a super role filters the queue by change agent, then clears it', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto('/viewassignedATC');
    await expect(page.getByTestId('vaa-atc').first()).toBeVisible({ timeout: 45_000 });
    await pickOptions(page, page.getByTestId('vaa-filter-ca'), [NAME.agent1], false);
    await expect(atcBox(page)).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('vaa-clear').click();
    await expect(page.getByTestId('vaa-atc').first()).toBeVisible({ timeout: 20_000 });
    await pickOptions(page, page.getByTestId('vaa-filter-participant'), [NAME.vaa], false);
    await expect(atcBox(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('vaa-atc'), 'only that participant\'s ATC').toHaveCount(1);
  });

  test('VAA-03 Mark as Completed: Cancel writes nothing; Update writes completed + date + agent', async ({ page }) => {
    await openAsAgent(page);
    const p = procBox(page, 1);
    await p.getByTestId('vaa-completed-btn').click();
    await p.getByTestId('vaa-cancel').click();
    expect((await atcDoc(PROC_PATH(1))).status, 'Cancel writes nothing').toBe('yet to start');

    await p.getByTestId('vaa-completed-btn').click();
    await expect(p.locator(`[data-testid="vaa-agent-select"][data-activity="${ACT.ca}"]`)).toBeVisible();
    await p.getByTestId('vaa-date').fill('2026-10-10T10:30');
    await p.getByTestId('vaa-update').click();
    const d = await waitFor(async () => { const x = await atcDoc(PROC_PATH(1)); return x?.status === 'completed' ? x : null; }, 'procedure completed');
    expect(d.last_activity.toDate().getFullYear()).toBe(2026);
    expect((d.assigned_to || []).map((r: any) => r.id)).toEqual([PF.agent1]);
    expect(d.autogeneralized).toBe(false);
  });

  test('VAA-04 Mark as Auto-Generalized writes autogeneralized:true', async ({ page }) => {
    await openAsAgent(page);
    const p = procBox(page, 2);
    await p.getByTestId('vaa-ag-btn').click();
    await p.getByTestId('vaa-date').fill('2026-10-11T09:00');
    await p.getByTestId('vaa-update').click();
    const d = await waitFor(async () => { const x = await atcDoc(PROC_PATH(2)); return x?.autogeneralized === true ? x : null; }, 'auto-generalized');
    expect(d.status).toBe('completed');
  });

  test('VAA-05 undo a completed procedure → yet to start, no activity date', async ({ page }) => {
    expect((await atcDoc(PROC_PATH(3))).status, 'precondition: seeded completed').toBe('completed');
    await openAsAgent(page);
    await procBox(page, 3).getByTestId('vaa-completed-btn').click();   // a completed procedure's button = undo
    const d = await waitFor(async () => { const x = await atcDoc(PROC_PATH(3)); return x?.status === 'yet to start' ? x : null; }, 'undone');
    expect(d.last_activity).toBeNull();
    expect(guard.dialogs.some((m) => /^confirm: Sure, Unmark procedure as Completed/.test(m)), 'undo is confirmed').toBe(true);
  });
});
