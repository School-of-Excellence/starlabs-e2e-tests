// access-screen.spec.ts — /accessscreen (content/access-screen): Tier · Assign Series · Assign Users.
//
// Recon: e2e/recon-allcomp/content.md "Addendum — 2026-09-07" (CN-28 … CN-31).
//
// Three tabs over three collections. The load-bearing case is CN-29: the Assign-Series tab getDoc()s
// every `tier[]` ref of every series and renders `tierData?.tier ?? 'Unknown'` (access-screen.component
// .ts:118-130). SER3 is seeded with two real tier refs and one ref to a tier doc that does not exist, so
// the chip set {Basic, Premium, Unknown} can only come from the app actually performing the lookups —
// and SER1's empty `tier` array is the zero-chip control on the same table.
//
// CN-30 pins a naming trap: the Users tab reads the collection literally named `user`, not `user_data`
// (ts:149-155). The seeded staff account lives ONLY in user_data, so its absence proves which one rendered.
import { test, expect } from '@playwright/test';
import { contentActors, contentText, deleteCreatedTier, installContentStubs, loginAsContentAdmin } from './support/content';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere, pollUntil, queryWhere } from '../queue/support/firestore-admin';
import { ROW, openTab, showAllRows } from './support/ui';

const RUN = process.env.CONT_RUNID || 'cont';

test.describe('Content — /accessscreen (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installContentStubs(page);
    await loginAsContentAdmin(page);
    await page.goto('/accessscreen', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/accessscreen/, { timeout: 30_000 });
    await expect(page.locator('h1.dash-title', { hasText: 'Access Management' })).toBeVisible({ timeout: 30_000 });
  });
  test.afterEach(() => assertNoFatal(guard, 'accessscreen: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-28 — Tier tab: rows == `tier` count
  // ===========================================================================================
  test('CN-28 the Tier tab lists one row per tier doc', async ({ page }) => {
    await openTab(page, 'Tier');
    const table = page.locator('mat-tab-body').filter({ has: page.locator('#paginator_tier') });
    await expect(table.locator(ROW).first()).toBeVisible({ timeout: 30_000 });
    await showAllRows(page, page.locator('#paginator_tier'));

    const expected = await countWhere('tier');
    await expect(table.locator(ROW), 'CN-28: one row per `tier` doc (no client filter)').toHaveCount(expected, { timeout: 30_000 });
    await expect(table.locator(ROW).filter({ hasText: contentText.tierBasic }), 'CN-28: the seeded Basic tier renders').toHaveCount(1);
    await expect(table.locator(ROW).filter({ hasText: contentText.tierPrem }), 'CN-28: the seeded Premium tier renders').toHaveCount(1);
  });

  // ===========================================================================================
  // CN-29 — Assign Series tab: tier chips come from per-ref getDoc lookups (Unknown for a missing tier)
  // ===========================================================================================
  test('CN-29 the Assign Series tab resolves tier refs, rendering Unknown for a missing tier', async ({ page }) => {
    await openTab(page, 'Assign Series');
    const table = page.locator('mat-tab-body').filter({ has: page.locator('#paginator_assigntier') });
    // the table is set only after Promise.all over every tier lookup resolves (ts:108-147)
    await expect(table.locator(ROW).first()).toBeVisible({ timeout: 30_000 });
    await showAllRows(page, page.locator('#paginator_assigntier'));

    const expected = await countWhere('series');
    await expect(table.locator(ROW), 'CN-29: one row per `series` doc').toHaveCount(expected, { timeout: 30_000 });

    // [ASSERT] SER3.tier = [TIER1, TIER2, <missing>] → chips {Basic, Premium, Unknown} (order is the
    // getDoc resolution order — a race — so compare as a set).
    const ser3 = table.locator(ROW).filter({ hasText: contentText.seriesTier });
    await expect(ser3, 'CN-29: the SER3 row renders').toHaveCount(1);
    await expect(ser3.locator('span.chip'), 'CN-29: three refs → three chips').toHaveCount(3, { timeout: 30_000 });
    const chips = (await ser3.locator('span.chip').allTextContents()).map((t) => t.trim()).sort();
    expect(chips, 'CN-29: the two real tiers by name + `Unknown` for the dangling ref (ts:126)')
      .toEqual([contentText.tierBasic, contentText.tierPrem, 'Unknown'].sort());

    // [CONTROL] SER1.tier = [] → zero chips on the same table.
    const ser1 = table.locator(ROW).filter({ hasText: contentText.seriesFree });
    await expect(ser1, 'CN-29: the SER1 row renders').toHaveCount(1);
    await expect(ser1.locator('span.chip'), 'CN-29: an empty tier[] renders no chips').toHaveCount(0);
  });

  // ===========================================================================================
  // CN-30 — Assign Users tab reads `user`, not `user_data`
  // ===========================================================================================
  test('CN-30 the Assign Users tab lists the `user` collection, not user_data', async ({ page }) => {
    await openTab(page, 'Assign Users');
    const table = page.locator('mat-tab-body').filter({ has: page.locator('#paginator_assignuser') });
    await expect(table.locator(ROW).first()).toBeVisible({ timeout: 30_000 });
    await showAllRows(page, page.locator('#paginator_assignuser'));

    const expected = await countWhere('user');
    await expect(table.locator(ROW), 'CN-30: one row per `user` doc').toHaveCount(expected, { timeout: 30_000 });
    await expect(table.locator(ROW).filter({ hasText: contentText.user1 }), 'CN-30: seeded user 1 renders').toHaveCount(1);
    await expect(table.locator(ROW).filter({ hasText: contentText.user2 }), 'CN-30: seeded user 2 renders').toHaveCount(1);
    // [CONTROL] the admin actor exists in user_data/profile_data (auth chain) but NOT in `user`.
    await expect(table.locator(ROW).filter({ hasText: contentActors.admin }), 'CN-30: a user_data-only account must not appear')
      .toHaveCount(0);
  });

  // ===========================================================================================
  // CN-31 — Add Tier → setDoc(tier/{auto}, {id: auto, tier, …, customersupport: blanks stripped, date})
  // ===========================================================================================
  test('CN-31 Add Tier writes a tier doc with id == doc id and blank support entries stripped', async ({ page }) => {
    const NEW_TIER = `NEW_TIER_${RUN}_${Date.now()}`;
    await deleteCreatedTier(NEW_TIER);
    expect(await countWhere('tier', [['tier', '==', NEW_TIER]]), 'CN-31: name unused pre-submit').toBe(0);

    await openTab(page, 'Tier');
    await page.locator('button.btn-primary', { hasText: 'Add Tier' }).click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 20_000 });

    await dialog.locator('input[name="name"]').fill(NEW_TIER);
    await dialog.locator('input[name="tiereligibilitymessage"]').fill('eligible (e2e)');
    // ONE real support entry; the remaining customersupport slots stay blank → the app must drop them
    // (add-tier.component.ts:77-97 filters empty strings).
    await dialog.locator('input[name="customersupport0"]').fill('support@example.com');

    // No window.confirm on this path — a plain click is correct. The footer "Add" is the submit.
    const add = dialog.locator('button', { hasText: /^Add$/ });
    await expect(add, 'CN-31: Add enables once the form is valid and the name is unique').toBeEnabled({ timeout: 10_000 });
    await add.click();

    const docs = await pollUntil(
      () => queryWhere('tier', [['tier', '==', NEW_TIER]]),
      (rows) => rows.length === 1,
      { label: `CN-31: one tier named ${NEW_TIER}`, timeoutMs: 30_000 },
    );
    const d = docs[0] as any;
    expect(d.id, 'CN-31: id field == doc id (add-tier.ts:81)').toBe(docs[0].id);
    expect(d.customersupport, 'CN-31: blank customersupport entries stripped').toEqual(['support@example.com']);
    expect(typeof d.date?.toMillis, 'CN-31: date stored as a Timestamp').toBe('function');

    const table = page.locator('mat-tab-body').filter({ has: page.locator('#paginator_tier') });
    await expect(table.locator(ROW).filter({ hasText: NEW_TIER }), 'CN-31: the live table shows the new tier').toHaveCount(1, { timeout: 30_000 });
    await deleteCreatedTier(NEW_TIER); // tidy the app-created doc
  });
});
