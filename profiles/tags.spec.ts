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
import { selectMatOption, selectMatOptions } from '../_shared/mat-select';

const { LIST_IDS, TESTRUNID } = require('./seed-lists-segments-tags');

const TOLERATE = [
  /requires an index/i,
  /Cannot read properties of undefined \(reading 'indexOf'\)/i,
  // EMULATOR-ONLY (same as lists-segments.spec.ts): environment.emulator.ts:36 sets `watson: null` on
  // purpose, so any screen reached from analytics that calls getApp('watson') raises
  //   FirebaseError: No Firebase App 'watson' has been created - call initializeApp() first
  // There is no Watson emulator to point at; this says nothing about the tag logic under test.
  /No Firebase App 'watson' has been created/i,
];

/** The seeded tag names (mirrors seed-lists-segments-tags.js mkTag calls). */
const TAG_ACTIVE_NAME = `TEST Tag Active ${TESTRUNID}`;
const TAG_TARGET_NAME = `TEST Tag Target ${TESTRUNID}`;

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
    await c.doc(pid).set({ profiletags: [] }, { merge: true });
  }
}

async function openTags(page, profileIds: string[] = []) {
  await loginAsProfileAdmin(page);
  await page.goto('/participants-analytics', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Total/i).first(), 'analytics table must build').toBeVisible({ timeout: 60_000 });

  // MATCH ON THE ROW'S LINK, NOT ITS TEXT (same fix as lists-segments.spec.ts openManageLists): the
  // analytics table renders the participant's display NAME, and the profileid appears only in the name
  // cell's href (/userprofile/<profileid>). `hasText: pid` matched no row, so .check() waited out the
  // full 120s test timeout — that is what killed PA-41 and PA-43.
  for (const pid of profileIds) {
    const row = page.locator('tr').filter({ has: page.locator(`a[href*="/userprofile/${pid}"]`) }).first();
    await expect(row, `openTags: the analytics row for ${pid} must render`).toBeVisible({ timeout: 30_000 });
    await row.locator('mat-checkbox input[type="checkbox"]').check({ force: true });
  }
  await page.getByRole('button', { name: /Actions|More|menu/i }).first().click().catch(() => {});
  await page.getByRole('menuitem', { name: /^\s*Tags\s*$/i }).click();

  // THE DIALOG OPENS ON A DIFFERENT TAB DEPENDING ON THE SELECTION. ngOnInit does:
  //     if (this.selectedParticipants.length > 0) { this.activeTab = 'assign'; }
  // (tag-participants.component.ts:100-102), and both panels are always in the DOM — the inactive one is
  // just not visible. So with participants selected, the Manage-tab tag list is PRESENT BUT HIDDEN, and
  // the old unconditional "TEST Tag Active must be visible" wait failed with "Received: hidden" for
  // PA-41/42/43 (which pass profile ids) while passing for PA-39/40 (which do not).
  //
  // Assert the panel that is actually showing.
  if (profileIds.length) {
    await expect(page.getByRole('button', { name: /Assign to Participants/i }),
      'the tags dialog must open on the Assign tab when participants are pre-selected')
      .toHaveClass(/active/, { timeout: 20_000 });
  } else {
    await expect(page.getByText(new RegExp(TAG_ACTIVE_NAME, 'i')).first(),
      'the tags dialog must render the seeded tags on the Manage tab').toBeVisible({ timeout: 20_000 });
  }
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
      .set({ profiletags: [LIST_IDS.TAG_ACTIVE] }, { merge: true });

    const before = await getDoc('participant tags', LIST_IDS.TAG_ACTIVE);
    expect(before!.isActive, 'PA-39: the tag starts active').toBe(true);

    await openTags(page);
    page.once('dialog', (d) => d.accept());   // deleteTag gates on confirm() (:180)
    // SCOPE TO THE TAG WE ARE ASSERTING ON. The dialog renders one .tag-item per active tag, and this
    // used to click .first() — whichever tag the app happened to list first. That is not TAG_ACTIVE by
    // construction: the seeder gives all three tags the SAME `created` timestamp (ts(0)), which is the
    // field loadTags orders by, so the order is not even stable between runs. The click was soft-deleting
    // an arbitrary tag while the assertion below waited on TAG_ACTIVE, which therefore never flipped.
    const tagRow = page.locator(`.tag-item`).filter({ hasText: TAG_ACTIVE_NAME });
    await expect(tagRow, `PA-39: the ${TAG_ACTIVE_NAME} row must render`).toBeVisible({ timeout: 20_000 });
    await tagRow.locator('button.btn-icon.delete').click();

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
    expect(meta!.profiletags,
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
    // TARGET THE ADD-TAG FIELD EXPLICITLY. `locator('input').first()` resolved to the dialog's SEARCH
    // box (placeholder="Search"), which is simply a different control — typing a tag name there does
    // nothing and the fill timed out. The add form's input is the one bound to newTagName:
    //   <input class="tag-name-input" placeholder="Enter tag name..." [(ngModel)]="newTagName">
    // (tag-participants.component.html:31). Note the edit form reuses .tag-name-input (html:52-55), but
    // it only renders while isEditing, which is false here.
    await page.getByPlaceholder('Enter tag name...').fill(`  ${nameToRetype.toUpperCase()}  `);
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

    // THESE ARE mat-selects, NOT NATIVE <select>. selectOption() only drives a native element, so it
    // always threw here — and the .catch() fallback then clicked the Manage tab text, which is hidden
    // while the Assign tab is showing. Net effect: NOTHING was ever selected, and the test timed out on
    // a click that could not land. Use the shared multi-select helper (the Assign select is `multiple`).
    //
    // Scope to the "Assign Tag" card: the Assign tab has THREE cards (Assign / Remove / Replace), each
    // with its own select and its own button, and an unscoped /Assign/i also matches the tab button
    // "Assign to Participants (1)".
    const assignCard = page.locator('.action-card').filter({ hasText: 'Assign Tag' });
    await selectMatOptions(page, assignCard.getByRole('combobox'), [TAG_ACTIVE_NAME]);

    page.once('dialog', (d) => d.accept());      // "Are you sure to Bulk Assign Tag"
    await assignCard.getByRole('button', { name: /Assign/i }).click();

    // [ASSERT] the selected participant got it...
    const p0 = await pollUntil(
      () => getDoc('participant metadata', profProfileIds.p0),
      (d) => Array.isArray(d?.profiletags) && d!.profiletags.includes(LIST_IDS.TAG_ACTIVE),
      { label: 'PA-41: p0 gains the tag', timeoutMs: 30_000 },
    );
    expect(p0!.profiletags).toContain(LIST_IDS.TAG_ACTIVE);

    // ...and the UNSELECTED one did not. This is the half that catches a "assign to all" bug.
    const p1 = await getDoc('participant metadata', profProfileIds.p1);
    expect(p1!.profiletags ?? [],
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

    // THE GUARD IS UPSTREAM OF THE BUTTONS. With nothing selected the entire bulk-actions container is
    // removed by *ngIf="selectedParticipants.length != 0" (component.html), so there are no Assign /
    // Remove / Replace buttons to press at all — the strongest possible form of "writes nothing".
    //
    // The old loop clicked `getByRole('button', {name})` with NO timeout, so each miss waited the full
    // TEST budget rather than failing fast; .catch() never got the chance to swallow anything and the
    // case died at 120s. (It also matched the tab button "Assign to Participants (0)" for /Assign/i,
    // which is not a bulk action at all.) Assert the container's absence, then still exercise every
    // handler that IS reachable, with a bounded timeout.
    await expect(page.locator('.bulk-actions-container'),
      'PA-42: with no participants selected the bulk actions must not render at all')
      .toHaveCount(0, { timeout: 10_000 });

    for (const label of [/^Assign$/i, /^Remove$/i, /^Replace$/i]) {
      const btn = page.locator('.action-card').getByRole('button', { name: label });
      await btn.click({ timeout: 2_000 }).catch(() => { /* not rendered — that is the point */ });
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(2_000);

    for (const pid of [profProfileIds.p0, profProfileIds.p1]) {
      const meta = await getDoc('participant metadata', pid);
      expect(meta!.profiletags ?? [],
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
      .set({ profiletags: [LIST_IDS.TAG_ACTIVE] }, { merge: true });

    await openTags(page, [profProfileIds.p0]);

    // No tab click needed: all three bulk cards (Assign / Remove / Replace) live on the SAME Assign
    // panel, which the dialog already opened because a participant is pre-selected. `getByRole('tab')`
    // matched nothing anyway — the tabs are plain buttons (component.html:15-20).
    //
    // Both selects here are SINGLE mat-selects (not native <select>, so selectOption never worked — and
    // the .catch(() => {}) hid that completely: nothing was selected and the test pressed Replace on an
    // empty form, which bulkReplaceTag() returns from SILENTLY at :395). Scope to the Replace card and
    // drive them in order: the second is `[disabled]="!selectedTagToReplace"`, so the source MUST be
    // chosen before the destination becomes usable.
    const replaceCard = page.locator('.action-card').filter({ hasText: 'Replace Tag' });
    const replaceSelects = replaceCard.getByRole('combobox');
    await selectMatOption(page, replaceSelects.nth(0), TAG_ACTIVE_NAME);
    await selectMatOption(page, replaceSelects.nth(1), TAG_TARGET_NAME);

    page.once('dialog', (d) => d.accept());
    await replaceCard.getByRole('button', { name: /Replace/i }).click();

    const after = await pollUntil(
      () => getDoc('participant metadata', profProfileIds.p0),
      (d) => Array.isArray(d?.profiletags) && d!.profiletags.includes(LIST_IDS.TAG_TARGET),
      { label: 'PA-43: p0 holds the replacement tag', timeoutMs: 30_000 },
    );
    // The whole point: replace is not "add the new one" — the old one must be gone.
    expect(after!.profiletags, 'PA-43: the replacement tag is present').toContain(LIST_IDS.TAG_TARGET);
    expect(after!.profiletags, 'PA-43: and the OLD tag must be gone — no participant holds both').not.toContain(LIST_IDS.TAG_ACTIVE);
  });
});
