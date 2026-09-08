// big-event-mentor.spec.ts — /bigeventmentor (New-Workshop/bigeventmentor).
//
// Recon: e2e/recon-allcomp/workshops.md "Addendum — 2026-09-04" (WS-28 / WS-29).
//
// This route DOES carry authGuard (app.routes.ts:294), so the seeded dashboard grant is load-bearing.
//
// Two non-obvious facts about this screen, both established by reading the component and both encoded
// in the seed rather than in the test:
//   1. The `bigeventmentor` document is keyed BY THE EVENT ID — onEventChange() does a direct
//      getDoc(doc(db,'bigeventmentor', eventId)) (ts:201) and createBigEventMentor() writes under the
//      event's own id (ts:289). A differently-named doc is simply never found and the board never renders.
//   2. initializeData() issues `where('activejourney','in', this.bigjourney)` (ts:167). Firestore THROWS
//      on an `in` filter with an EMPTY array, so a B!G `journey` doc must exist or the screen errors out
//      before rendering — a failure that looks like a UI bug but is a seed gap (recon Risk #12).
import { test, expect } from '@playwright/test';
import {
  wsAddIds, wsAddNames, wsProfileIds, installWshopStubs, loginAsWshopAdmin, resetBigEventMentorBuckets,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil } from '../queue/support/firestore-admin';

/**
 * Open the event picker and wait until it actually has options.
 *
 * Two footguns, both learned the hard way against the real screen:
 *  1. It must go through the COMBOBOX role — clicking the <mat-select> host element does not open the
 *     Material overlay, only the inner trigger does.
 *  2. initializeData() runs in the CONSTRUCTOR and is async (ts:103,155), so for the first second or so
 *     after navigation `liveeventList` is still empty. A click that lands in that window opens a panel
 *     with nothing in it. Retrying the whole open (Escape → click → expect an option) is what makes this
 *     deterministic; simply waiting longer for an option inside one already-open empty panel is not.
 */
async function openEventPicker(page: import('@playwright/test').Page) {
  const combo = page.getByRole('combobox', { name: 'Select Event' });
  await expect(combo, 'the event picker must render').toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    await page.keyboard.press('Escape').catch(() => {});
    await combo.click();
    await expect(page.locator('mat-option').first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000, intervals: [500, 1_000, 2_000, 3_000] });
}

/** Pick the seeded B!G event in the toolbar's mat-select. */
async function selectBigEvent(page: import('@playwright/test').Page) {
  await openEventPicker(page);
  await page.getByRole('option', { name: wsAddNames.evtBig, exact: true }).click();
  await expect(page.locator('.main-content'), 'the status board must render for the seeded event')
    .toBeVisible({ timeout: 30_000 });
}

test.describe('Workshops — B!G event mentor (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await resetBigEventMentorBuckets();   // PRECONDITION: p0 in `registered`, `reached` empty
  });
  test.afterEach(() => assertNoFatal(guard, 'bigeventmentor: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // WS-28 — the picker offers only atcmodel=='B!G' events; the status buckets render the doc
  // ===========================================================================================
  test('WS-28 the event picker offers B!G events only and the buckets render the seeded arrays', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/bigeventmentor', { waitUntil: 'domcontentloaded' });

    // [REAL-UI] open the picker; liveeventList comes from `event collection where atcmodel=='B!G'` (ts:159).
    await openEventPicker(page);

    // exact:true throughout — role-name matching is substring by default, and "NonBIG Event <run>"
    // CONTAINS "BIG Event <run>". Without exact matching the negative control below could be satisfied
    // by the positive option and the case would silently stop testing the where-clause.
    await expect(
      page.getByRole('option', { name: wsAddNames.evtBig, exact: true }),
      'WS-28: a B!G event must be offered',
    ).toBeVisible({ timeout: 30_000 });

    // [ASSERT] the NON-B!G event must NOT be offered. It exists in the same collection and differs only
    // by `atcmodel`, so its absence can only be the app's where-clause. Without this seeded negative
    // control the first assertion alone would pass with the filter removed.
    await expect(
      page.getByRole('option', { name: wsAddNames.evtNonBig, exact: true }),
      'WS-28: a non-B!G event must NOT be offered (proves the atcmodel where-clause runs)',
    ).toHaveCount(0);

    await page.getByRole('option', { name: wsAddNames.evtBig, exact: true }).click();
    await expect(page.locator('.main-content')).toBeVisible({ timeout: 30_000 });

    // [ASSERT] the board rendered the seeded bucket arrays: registered holds p0, reached is empty.
    const registeredCol = page.locator('.status-column').filter({ hasText: 'Registered' }).first();
    await expect(
      registeredCol.locator('.participant-item'),
      'WS-28: the registered bucket must render exactly the one seeded participant',
    ).toHaveCount(1, { timeout: 20_000 });
  });

  // ===========================================================================================
  // WS-29 — moving a participant between buckets accepts confirm() and writes BOTH arrays
  // ===========================================================================================
  // DIALOG TRAP: moveSelected() gates on window.confirm (ts:317). Without a registered handler
  // Playwright auto-dismisses, the updateDoc never runs, and a test asserting only "no error" would go
  // green having exercised nothing. The handler is registered before the click; the assertion is on the
  // Firestore post-state, which a dismissed dialog cannot produce.
  test('WS-29 moving a participant from Registered to Reached writes both arrays', async ({ page }) => {
    // [PRECONDITION] the buckets are in a KNOWN state — the reset put p0 in registered, reached empty.
    const before = await getDoc('bigeventmentor', wsAddIds.BEM);
    expect((before as any)!.registered, 'WS-29: p0 starts in registered').toContain(wsProfileIds.p0);
    expect((before as any)!.reached, 'WS-29: reached starts empty').toHaveLength(0);

    await loginAsWshopAdmin(page);
    await page.goto('/bigeventmentor', { waitUntil: 'domcontentloaded' });
    await selectBigEvent(page);

    // [REAL-UI] tick the participant in the Registered column, then move it to Reached via the column's
    // own overflow menu.
    const registeredCol = page.locator('.status-column').filter({ hasText: 'Registered' }).first();
    await registeredCol.locator('.participant-item mat-checkbox').first().click();
    await registeredCol.locator('.header-actions button').first().click();

    page.once('dialog', (d) => d.accept());   // moveSelected()'s confirm (ts:317) — see DIALOG TRAP above
    await page.getByRole('menuitem', { name: /Reached/ }).click();

    // [ASSERT] BOTH sides of the move are app-written state. Asserting only the destination would not
    // catch a move that copies without removing.
    const after = await pollUntil(
      () => getDoc('bigeventmentor', wsAddIds.BEM),
      (d) => !!d && Array.isArray((d as any).reached) && (d as any).reached.includes(wsProfileIds.p0),
      { label: 'WS-29: bigeventmentor.reached contains p0', timeoutMs: 30_000 },
    );
    expect((after as any)!.reached, 'WS-29: the app added p0 to reached').toContain(wsProfileIds.p0);
    expect((after as any)!.registered, 'WS-29: the app REMOVED p0 from registered').not.toContain(wsProfileIds.p0);
  });
});
