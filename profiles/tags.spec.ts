// tags.spec.ts — tag-participants: soft delete, resurrection, and the three bulk operations.
//
// tag-participants (792 LOC, 10 live handlers, setDoc + updateDoc + writeBatch) had no coverage at
// all. add-queue-tag exposes an IDENTICAL handler set (addTag / deleteTag / bulkAssignTag /
// bulkRemoveTag / bulkReplaceTag / editTag / saveTagEdit) — cover it by parameterising this file
// rather than duplicating it.
//
// Reached from analytics -> the "Tags" menu item (tagParticipants()).
//
// SEED CONTRACT (seed-lists-segments-tags.js): three tags, all carrying `created` — mandatory,
// because loadTags reads with orderBy('created','desc') and Firestore OMITS documents missing the
// orderBy field. A tag seeded without it is invisible to the dialog, and every assertion here would
// then pass or fail for the wrong reason.
//   TAG_ACTIVE   isActive true   — the assign/remove source
//   TAG_TARGET   isActive true   — the replace destination
//   TAG_DELETED  isActive false  — the resurrection case
import { test, expect } from '@playwright/test';
import { profProfileIds, installProfileStubs, loginAsProfileAdmin } from './support/profiles';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, queryWhere, pollUntil, db } from '../queue/support/firestore-admin';

const { LIST_IDS, TESTRUNID } = require('./seed-lists-segments-tags');

const TOLERATE = [/requires an index/i, /Cannot read properties of undefined \(reading 'indexOf'\)/i];

/** Restore the seeded tag states between cases (precondition writes only). */
async function resetTags(): Promise<void> {
  const c = db().collection('participant tags');
  await c.doc(LIST_IDS.TAG_ACTIVE).update({ isActive: true });
  await c.doc(LIST_IDS.TAG_TARGET).update({ isActive: true });
  await c.doc(LIST_IDS.TAG_DELETED).update({ isActive: false });
}

/** Clear any tag assignment the previous case left on the seeded participants. */
async function clearAssignments(): Promise<void> {
  const c = db().collection('participant metadata');
  for (const pid of [profProfileIds.p0, profProfileIds.p1]) {
    await c.doc(pid).set({ tags: [] }, { merge: true });
  }
}

async function openTags(page, profileIds: string[] = []) {
  await loginAsProfileAdmin(page);
  await page.goto('/participants-analytics', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Total/i).first(), 'analytics table must build').toBeVisible({ timeout: 60_000 });

  for (const pid of profileIds) {
    const row = page.locator('tr', { hasText: pid }).first();
    await row.locator('mat-checkbox input[type="checkbox"]').check({ force: true });
  }
  await page.getByRole('button', { name: /Actions|More|menu/i }).first().click().catch(() => {});
  await page.getByRole('menuitem', { name: /^\s*Tags\s*$/i }).click();
  await expect(page.getByText(/TEST Tag Active/i).first(),
    'the tags dialog must render the seeded tags').toBeVisible({ timeout: 20_000 });
}

test.describe('Profiles — participant tags: soft delete, resurrection, bulk ops (deep)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installProfileStubs(page);
    await resetTags();
    await clearAssignments();
  });
  test.afterEach(() => assertNoFatal(guard, 'tags: no fatal console errors / pageerrors', TOLERATE));

  // ===========================================================================================
  // PA-39 — deleteTag is a SOFT delete. The confirm text says so out loud:
  //         "participant tagged with this tag will not be removed".
  // ===========================================================================================
  test('PA-39 deleting a tag flips isActive and leaves every participant assignment untouched', async ({ page }) => {
    // Give p0 the tag first, so "assignments untouched" has something to protect.
    await db().collection('participant metadata').doc(profProfileIds.p0)
      .set({ tags: [LIST_IDS.TAG_ACTIVE] }, { merge: true });

    const before = await getDoc('participant tags', LIST_IDS.TAG_ACTIVE);
    expect(before!.isActive, 'PA-39: the tag starts active').toBe(true);

    await openTags(page);
    page.once('dialog', (d) => d.accept());   // deleteTag gates on confirm() (:180)
    await page.locator('button.btn-icon.delete').first().click();

    // [ASSERT] the app flipped isActive — a SOFT delete, not a deleteDoc.
    const after = await pollUntil(
      () => getDoc('participant tags', LIST_IDS.TAG_ACTIVE),
      (d) => d !== null && d.isActive === false,
      { label: 'PA-39: tag isActive -> false', timeoutMs: 30_000 },
    );
    expect(after, 'PA-39: the tag document must still EXIST (soft delete)').toBeTruthy();
    expect(after!.isActive).toBe(false);

    // [ASSERT] the invariant the confirm() text promises: assignments are untouched.
    const meta = await getDoc('participant metadata', profProfileIds.p0);
    expect(meta!.tags,
      'PA-39: a soft delete must NOT strip the tag from tagged participants',
    ).toContain(LIST_IDS.TAG_ACTIVE);
  });

  // ===========================================================================================
  // PA-40 — addTag RESURRECTS a soft-deleted name instead of creating a duplicate (:132).
  //         Matching is on the TRIMMED, LOWER-CASED name.
  // ===========================================================================================
  test('PA-40 adding a soft-deleted tag name reactivates the original doc rather than duplicating', async ({ page }) => {
    const deleted = await getDoc('participant tags', LIST_IDS.TAG_DELETED);
    expect(deleted!.isActive, 'PA-40: TAG_DELETED starts inactive').toBe(false);
    const nameToRetype = String(deleted!.name);

    const countBefore = (await queryWhere('participant tags', [['testrunid', '==', TESTRUNID]])).length;

    await openTags(page);
    // Retype the SAME name with different casing + padding — the match is trimmed + lower-cased.
    await page.locator('input').first().fill(`  ${nameToRetype.toUpperCase()}  `);
    await page.getByRole('button', { name: /Add Tag|^\s*Add\s*$/i }).first().click();

    // [ASSERT] the ORIGINAL doc was reactivated...
    const after = await pollUntil(
      () => getDoc('participant tags', LIST_IDS.TAG_DELETED),
      (d) => d !== null && d.isActive === true,
      { label: 'PA-40: the soft-deleted tag is reactivated', timeoutMs: 30_000 },
    );
    expect(after!.isActive).toBe(true);

    // ...and NO second document was created for the same name.
    const countAfter = (await queryWhere('participant tags', [['testrunid', '==', TESTRUNID]])).length;
    expect(countAfter,
      'PA-40: resurrection must not create a duplicate tag document',
    ).toBe(countBefore);
  });

  // ===========================================================================================
  // PA-41 — bulkAssignTag. Guarded twice (a tag AND >=1 participant, else alert() and return),
  //         then confirm(), then chunked writes at BATCH_SIZE 500.
  // ===========================================================================================
  test('PA-41 bulk-assigning a tag writes it to every selected participant and no other', async ({ page }) => {
    await openTags(page, [profProfileIds.p0]);   // p0 selected, p1 deliberately NOT

    await page.getByRole('combobox').first().selectOption({ label: /TEST Tag Active/i } as any)
      .catch(async () => { await page.getByText(/TEST Tag Active/i).first().click(); });

    page.once('dialog', (d) => d.accept());      // "Are you sure to Bulk Assign Tag"
    await page.getByRole('button', { name: /Assign/i }).first().click();

    // [ASSERT] the selected participant got it...
    const p0 = await pollUntil(
      () => getDoc('participant metadata', profProfileIds.p0),
      (d) => Array.isArray(d?.tags) && d!.tags.includes(LIST_IDS.TAG_ACTIVE),
      { label: 'PA-41: p0 gains the tag', timeoutMs: 30_000 },
    );
    expect(p0!.tags).toContain(LIST_IDS.TAG_ACTIVE);

    // ...and the UNSELECTED one did not. This is the half that catches a "assign to all" bug.
    const p1 = await getDoc('participant metadata', profProfileIds.p1);
    expect(p1!.tags ?? [],
      'PA-41: an unselected participant must NOT receive the tag',
    ).not.toContain(LIST_IDS.TAG_ACTIVE);
  });

  // ===========================================================================================
  // PA-42 — the empty-selection guards. Three handlers, three different failure modes, and one of
  //         them fails SILENTLY — which is exactly the kind of thing that never gets noticed.
  // ===========================================================================================
  test('PA-42 bulk operations with nothing selected write nothing', async ({ page }) => {
    await openTags(page);   // NO participants selected

    // bulkAssignTag / bulkRemoveTag alert() and return. bulkReplaceTag returns SILENTLY when either
    // tag is unset (:395) — no alert, no snackbar, no write. Accept any dialog that does appear.
    page.on('dialog', (d) => d.accept());

    for (const label of [/Assign/i, /Remove/i, /Replace/i]) {
      await page.getByRole('button', { name: label }).first().click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2_000);

    for (const pid of [profProfileIds.p0, profProfileIds.p1]) {
      const meta = await getDoc('participant metadata', pid);
      expect(meta!.tags ?? [],
        `PA-42: no bulk op may write when nothing is selected (${pid})`,
      ).toHaveLength(0);
    }
  });

  // ===========================================================================================
  // PA-43 — bulkReplaceTag is atomic PER PARTICIPANT: nobody ends up holding both tags or neither.
  //         Chunked at 250 here, unlike assign/remove at 500.
  // ===========================================================================================
  test('PA-43 bulk-replacing a tag leaves each participant with exactly the new tag', async ({ page }) => {
    await db().collection('participant metadata').doc(profProfileIds.p0)
      .set({ tags: [LIST_IDS.TAG_ACTIVE] }, { merge: true });

    await openTags(page, [profProfileIds.p0]);
    await page.getByRole('tab', { name: /Replace/i }).click().catch(() => {});

    // pick old -> new in the two selects, then confirm.
    const selects = page.getByRole('combobox');
    await selects.nth(0).selectOption({ label: /TEST Tag Active/i } as any).catch(() => {});
    await selects.nth(1).selectOption({ label: /TEST Tag Target/i } as any).catch(() => {});
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /Replace/i }).first().click();

    const after = await pollUntil(
      () => getDoc('participant metadata', profProfileIds.p0),
      (d) => Array.isArray(d?.tags) && d!.tags.includes(LIST_IDS.TAG_TARGET),
      { label: 'PA-43: p0 holds the replacement tag', timeoutMs: 30_000 },
    );
    // The whole point: replace is not "add the new one" — the old one must be gone.
    expect(after!.tags, 'PA-43: the replacement tag is present').toContain(LIST_IDS.TAG_TARGET);
    expect(after!.tags, 'PA-43: and the OLD tag must be gone — no participant holds both').not.toContain(LIST_IDS.TAG_ACTIVE);
  });
});
