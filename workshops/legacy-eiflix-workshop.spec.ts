// legacy-eiflix-workshop.spec.ts — /createworkshop (Workshop/eiflix-workshop/view-workshop).
//
// Recon: e2e/recon-allcomp/workshops.md "Addendum — 2026-09-04" (WS-16 / WS-17).
//
// NOTE ON THE ROUTE NAME: `/createworkshop` (legacy eiflix, this file) is a DIFFERENT screen from
// `/create-workshop` (New-Workshop, covered by workshops-deep.spec.ts WS-02). One hyphen apart, two
// unrelated components and collections. This one renders the `eiflix workshop` collection.
//
// Unlike the other addendum routes, /createworkshop DOES carry authGuard (app.routes.ts:186) — the
// dashboard grant seeded for it is load-bearing here.
import { test, expect } from '@playwright/test';
import {
  wsAddIds, wsAddNames, installWshopStubs, loginAsWshopAdmin, resetEiflixWorkshopDeleteTarget,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, countWhere, pollUntil } from '../queue/support/firestore-admin';

const RUN = process.env.WSHOP_RUNID || 'wshop';

test.describe('Workshops — legacy eiflix workshop list (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, '/createworkshop: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // WS-16 — the list renders every `eiflix workshop` doc the app streamed
  // ===========================================================================================
  test('WS-16 /createworkshop renders the live eiflix workshop stream', async ({ page }) => {
    // The delete case may have removed the second seeded doc on a previous run — restore it so WS-16's
    // count floor is deterministic regardless of test order. PRECONDITION only.
    await resetEiflixWorkshopDeleteTarget();

    await loginAsWshopAdmin(page);
    await page.goto('/createworkshop', { waitUntil: 'domcontentloaded' });

    // [REAL-UI] the constructor's onSnapshot(collection('eiflix workshop')) drives a MatTableDataSource
    // (view-workshop.component.ts:48-59); one row per doc.
    const keepRow = page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: wsAddNames.ewKeep });
    await expect(keepRow, 'WS-16: the seeded legacy workshop row must render from the live stream')
      .toBeVisible({ timeout: 30_000 });

    // [ASSERT] the app-rendered row count is bounded below by an INDEPENDENT Firestore count of our
    // seeded docs. Two separately-computed numbers — the test never asserts a row it just wrote.
    const seeded = await countWhere('eiflix workshop', [['testrunid', '==', RUN]]);
    expect(seeded, 'WS-16: precondition — 2 seeded legacy workshops for this run').toBe(2);
    const rendered = await page.locator('tr.mat-mdc-row, tr[mat-row]').count();
    expect(rendered, `WS-16: app rendered ${rendered} rows; must be >= ${seeded} seeded`)
      .toBeGreaterThanOrEqual(seeded);
  });

  // ===========================================================================================
  // WS-17 — row delete accepts the confirm() and HARD-deletes the doc (write path)
  // ===========================================================================================
  // DIALOG TRAP: deleteContent() gates on a bare window.confirm (view-workshop.component.ts:86). With no
  // page.on('dialog') handler Playwright AUTO-DISMISSES it — confirm() returns false, deleteDoc never
  // runs, and a test that only asserted "no error" would still pass. That is a false green, so the
  // handler is registered BEFORE the click and the assertion is on the Firestore post-state.
  test('WS-17 deleting a legacy workshop row removes the doc from Firestore', async ({ page }) => {
    // [PRECONDITION] re-create the delete target so the case is re-runnable.
    await resetEiflixWorkshopDeleteTarget();
    const before = await getDoc('eiflix workshop', wsAddIds.EW_DEL);
    expect(before, 'WS-17: the delete target must exist before the action').toBeTruthy();

    await loginAsWshopAdmin(page);
    await page.goto('/createworkshop', { waitUntil: 'domcontentloaded' });

    const row = page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: wsAddNames.ewDel });
    await expect(row, 'WS-17: the delete-target row must render').toBeVisible({ timeout: 30_000 });

    // Accept the confirm() BEFORE clicking — without this the delete silently no-ops (see above).
    page.once('dialog', (d) => d.accept());
    await row.locator('button.delete, button:has(mat-icon)').last().click();

    // [ASSERT] the doc is GONE. This is the post-state the APP produced via deleteDoc (ts:89) — the test
    // only created the precondition, and a dismissed dialog would leave the doc in place and fail here.
    const after = await pollUntil(
      () => getDoc('eiflix workshop', wsAddIds.EW_DEL),
      (d) => d === null,
      { label: 'WS-17: eiflix workshop doc deleted by the app', timeoutMs: 30_000 },
    );
    expect(after, 'WS-17: the app hard-deleted the doc').toBeNull();

    // The row must also disappear from the live stream the app is rendering.
    await expect(row, 'WS-17: the deleted row must leave the table').toHaveCount(0, { timeout: 15_000 });
  });
});
