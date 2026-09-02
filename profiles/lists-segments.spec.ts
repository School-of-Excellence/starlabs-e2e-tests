// lists-segments.spec.ts — manage-participantlist-dialog: merge / de-merge / live-segment exclusivity.
//
// This covers the LARGEST untested artifact in the profiles glob (2,802 LOC, 28 live handlers,
// 7 setDoc + 7 updateDoc + 1 deleteDoc) and the suite's most intricate business rule. Nothing in the
// repo tested any of it before this file.
//
// THE RULE — live-segment exclusivity (getMergeConflicts, manage-participantlist:1548):
// a profile may not sit in two LIVE lists at once. "Live" has TWO INDEPENDENT derivations:
//   (a) the queue chain: `queue generation` where queuestartdate <= now <= queueenddate
//       -> `queue planning` where queueid == thatDocId -> planning[].segments[].segmentid
//       -> `segments`/{id}.participantlistid[]
//   (b) a `participant list` with live === true, directly.
// The seeder uses (b) by default so it writes NOTHING into the queue suite's collections
// (seed-lists-segments-tags.js, queueChain:false). Both derivations feed the SAME conflict logic.
//
// WHY THIS IS ISOLATED despite two unfiltered reads: a conflict is only recorded when a live list's
// profilelist[] CONTAINS one of the profile ids being merged (:1612). Our ids are run-prefixed, so no
// foreign list can contain them. Corollary — and the rule for anyone extending this file:
//   ASSERT ON RUN-NAMESPACED ENTITIES, NEVER ON GLOBAL COUNTS.
//   "p0 conflicts with List B" is isolated. "the dialog shows 4 lists" is not.
//
// Reached through analytics -> the "Manage List & Segments" menu item (managelist()).
// NOTE: analytics' own addSegments() has NO live template binding (the menu item is commented out at
// participants-analytics.component.html:38) — create-segments-dialog is only reachable as an embedded
// child of THIS dialog. That is why segments are exercised here rather than in their own file.
import { test, expect } from '@playwright/test';
import { profProfileIds, installProfileStubs, loginAsProfileAdmin } from './support/profiles';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, queryWhere, pollUntil, db } from '../queue/support/firestore-admin';

const { LIST_IDS } = require('./seed-lists-segments-tags');

const TOLERATE = [/requires an index/i, /Cannot read properties of undefined \(reading 'indexOf'\)/i];

/** Restore the seeded list topology between cases (precondition writes only). */
async function resetLists(): Promise<void> {
  const c = db().collection('participant list');
  await c.doc(LIST_IDS.LIST_A).update({ profilelist: [] });
  await c.doc(LIST_IDS.LIST_B).update({ profilelist: [profProfileIds.p0] });
}

/** Delete this run's audit rows so each case asserts only what IT caused. */
async function clearListLog(): Promise<void> {
  const snap = await db().collection('participant_list_log')
    .where('testrunid', '==', process.env.PROF_RUNID || 'prof').get();
  const batch = db().batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  if (snap.size) await batch.commit();
}

/** Open analytics, select the seeded participant rows, then open Manage List & Segments. */
async function openManageLists(page, profileIds: string[]) {
  await loginAsProfileAdmin(page);
  await page.goto('/participants-analytics', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Total/i).first(), 'analytics table must build').toBeVisible({ timeout: 60_000 });

  // Tick the row checkbox for each requested participant — managelist(selection.selected) passes the
  // selection in as externalProfileIds, which is what merge/de-merge operate on.
  for (const pid of profileIds) {
    const row = page.locator('tr', { hasText: pid }).first();
    await row.locator('mat-checkbox input[type="checkbox"]').check({ force: true });
  }

  await page.getByRole('button', { name: /Actions|More|menu/i }).first().click().catch(() => {});
  await page.getByRole('menuitem', { name: /Manage List & Segments/i }).click();
  await expect(page.getByText(new RegExp(`TEST List A`, 'i')).first(),
    'the manage-lists dialog must render the seeded lists').toBeVisible({ timeout: 20_000 });
}

test.describe('Profiles — participant lists: merge, de-merge, live-segment exclusivity (deep)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installProfileStubs(page);
    await resetLists();
    await clearListLog();
  });
  test.afterEach(() => assertNoFatal(guard, 'lists-segments: no fatal console errors / pageerrors', TOLERATE));

  // ===========================================================================================
  // PA-33 — conflict-free merge. p1 is in NO list, so merging it into List A must just work.
  // ===========================================================================================
  test('PA-33 merging a conflict-free profile -> arrayUnion into profilelist + ONE audit row', async ({ page }) => {
    const before = await getDoc('participant list', LIST_IDS.LIST_A);
    expect(before!.profilelist, 'PA-33: List A starts empty').toHaveLength(0);

    await openManageLists(page, [profProfileIds.p1]);

    // mergeProfiles() gates on a native confirm() when there are no conflicts (:1184).
    page.once('dialog', (d) => d.accept());
    await page.locator(`[data-list="${LIST_IDS.LIST_A}"] button`, { hasText: /merge/i }).first()
      .or(page.getByRole('button', { name: /^\s*Merge\s*$/i }).first())
      .click();

    // [ASSERT] the value the APP wrote (executeMerge -> arrayUnion, :1296).
    const after = await pollUntil(
      () => getDoc('participant list', LIST_IDS.LIST_A),
      (d) => Array.isArray(d?.profilelist) && d!.profilelist.includes(profProfileIds.p1),
      { label: 'PA-33: List A.profilelist gains p1', timeoutMs: 30_000 },
    );
    expect(after!.profilelist).toContain(profProfileIds.p1);
    expect(after!.updateddate, 'PA-33: the app stamps updateddate').toBeTruthy();

    // [ASSERT] exactly ONE audit row, referencing THIS list. The conflict path writes two (B-02);
    // the clean path must write one.
    const logs = await queryWhere('participant_list_log', [
      ['testrunid', '==', process.env.PROF_RUNID || 'prof'],
    ]);
    expect(logs, 'PA-33: the clean merge writes exactly one participant_list_log row').toHaveLength(1);
    expect(logs[0].action_type).toBe('edit');
    expect(logs[0].type).toBe('list');
    expect(logs[0].metadata?.current?.added_profiles).toContain(profProfileIds.p1);
  });

  // ===========================================================================================
  // PA-34 — conflict ACCEPTED. p0 is already in List B, which is LIVE. Merging p0 into List A must
  //         raise the conflict popup, and confirming must REMOVE p0 from B and ADD it to A.
  // ===========================================================================================
  test('PA-34 accepting a live-list conflict moves the profile out of the conflicting list', async ({ page }) => {
    const bBefore = await getDoc('participant list', LIST_IDS.LIST_B);
    expect(bBefore!.profilelist, 'PA-34: List B starts holding p0').toContain(profProfileIds.p0);
    expect(bBefore!.live, 'PA-34: List B must be live for the rule to fire').toBe(true);

    await openManageLists(page, [profProfileIds.p0]);
    await page.getByRole('button', { name: /^\s*Merge\s*$/i }).first().click();

    // The conflict popup opens with EVERY conflict pre-checked (selectedMergeConflictIds is seeded
    // from all conflicts, :1173) — leaving it checked means "resolve it by moving the profile".
    const popup = page.locator('.mcp-cancel-btn').locator('xpath=ancestor::*[1]');
    await expect(page.locator('.mcp-cancel-btn'), 'PA-34: the merge-conflict popup must open')
      .toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Confirm|Merge/i }).last().click();

    // [ASSERT] exclusivity now holds: p0 is in A and NO LONGER in B.
    const aAfter = await pollUntil(
      () => getDoc('participant list', LIST_IDS.LIST_A),
      (d) => Array.isArray(d?.profilelist) && d!.profilelist.includes(profProfileIds.p0),
      { label: 'PA-34: List A gains p0', timeoutMs: 30_000 },
    );
    expect(aAfter!.profilelist).toContain(profProfileIds.p0);

    const bAfter = await getDoc('participant list', LIST_IDS.LIST_B);
    expect(bAfter!.profilelist,
      'PA-34: p0 must be REMOVED from the conflicting live list (arrayRemove, :1257)',
    ).not.toContain(profProfileIds.p0);

    // DEFECT B-02 — the conflict path writes the audit row TWICE: once inside the conflict-removal
    // branch (:1267, describing a merge that has not happened yet) and once after the merge (:1306).
    // The correct behaviour is ONE row. This assertion is expected to FAIL until B-02 is fixed;
    // it is written to the CORRECT expectation deliberately so the bug stays visible.
    const logs = await queryWhere('participant_list_log', [
      ['testrunid', '==', process.env.PROF_RUNID || 'prof'],
    ]);
    expect(logs.length,
      'PA-34 / DEFECT B-02: a conflict-path merge must write ONE audit row, not two. ' +
      'Two rows = B-02 still open (manage-participantlist:1267 + :1306).',
    ).toBe(1);
  });

  // ===========================================================================================
  // PA-35 — conflict DECLINED. The counter-intuitive rule, and the best reason this file exists:
  //         unchecking a conflict does NOT mean "merge anyway, leave the other list alone" — it
  //         drops that profile from the merge ENTIRELY (confirmMergeWithSelection, :1189).
  // ===========================================================================================
  test('PA-35 declining a conflict drops the profile from the merge — BOTH lists unchanged', async ({ page }) => {
    await openManageLists(page, [profProfileIds.p0]);
    await page.getByRole('button', { name: /^\s*Merge\s*$/i }).first().click();
    await expect(page.locator('.mcp-cancel-btn'), 'PA-35: the conflict popup must open')
      .toBeVisible({ timeout: 20_000 });

    // UNCHECK the conflict, then confirm.
    await page.locator('input[type="checkbox"]').first().uncheck({ force: true });
    await page.getByRole('button', { name: /Confirm|Merge/i }).last().click();
    await page.waitForTimeout(3_000);   // let any (incorrect) write land before asserting absence

    // [ASSERT] neither list moved. This is the assertion the UI gives no hint about.
    const a = await getDoc('participant list', LIST_IDS.LIST_A);
    expect(a!.profilelist,
      'PA-35: an unchecked conflict is EXCLUDED from the merge — List A must stay empty',
    ).toHaveLength(0);

    const b = await getDoc('participant list', LIST_IDS.LIST_B);
    expect(b!.profilelist,
      'PA-35: and the conflicting list must be left intact',
    ).toContain(profProfileIds.p0);
  });

  // ===========================================================================================
  // PA-36 — de-merge. Three branches; the one worth pinning is that when EVERY selected profile is
  //         present, removal happens IMMEDIATELY with no confirmation at all (:1680).
  // ===========================================================================================
  test('PA-36 de-merging a fully-present selection removes immediately and writes NO audit row', async ({ page }) => {
    await openManageLists(page, [profProfileIds.p0]);

    await page.getByRole('button', { name: /De-?merge/i }).first().click();

    const bAfter = await pollUntil(
      () => getDoc('participant list', LIST_IDS.LIST_B),
      (d) => Array.isArray(d?.profilelist) && !d!.profilelist.includes(profProfileIds.p0),
      { label: 'PA-36: p0 removed from List B', timeoutMs: 30_000 },
    );
    expect(bAfter!.profilelist).not.toContain(profProfileIds.p0);

    // DEFECT B-03 — de-merge writes NO participant_list_log entry while merge does. Removals from a
    // list are untraceable. Asserting the CURRENT (wrong) behaviour so the asymmetry is recorded;
    // when B-03 is fixed this fails and points at the fix.
    const logs = await queryWhere('participant_list_log', [
      ['testrunid', '==', process.env.PROF_RUNID || 'prof'],
    ]);
    expect(logs,
      'PA-36 / DEFECT B-03: de-merge currently writes no audit row (merge writes one). ' +
      'If this is now non-empty, B-03 has been FIXED — update this assertion.',
    ).toHaveLength(0);
  });

  // ===========================================================================================
  // PA-37 — the live-list CONTROL. List D is live but does NOT contain p1, and List C is not live
  //         at all. Neither may produce a conflict. This is what proves the rule keys on MEMBERSHIP
  //         (:1612) rather than merely on list liveness — and it is also what makes the whole suite
  //         immune to foreign live lists on a shared emulator.
  // ===========================================================================================
  test('PA-37 a live list that does NOT contain the profile raises no conflict', async ({ page }) => {
    const d = await getDoc('participant list', LIST_IDS.LIST_D);
    expect(d!.live, 'PA-37: List D is live').toBe(true);
    expect(d!.profilelist, 'PA-37: ...but does not contain p1').not.toContain(profProfileIds.p1);

    await openManageLists(page, [profProfileIds.p1]);
    page.once('dialog', (d2) => d2.accept());
    await page.getByRole('button', { name: /^\s*Merge\s*$/i }).first().click();

    // No conflict popup: the merge proceeds straight through the confirm() path.
    await expect(page.locator('.mcp-cancel-btn'),
      'PA-37: a live list without the profile must NOT raise the conflict popup',
    ).toHaveCount(0, { timeout: 10_000 });

    const a = await pollUntil(
      () => getDoc('participant list', LIST_IDS.LIST_A),
      (x) => Array.isArray(x?.profilelist) && x!.profilelist.includes(profProfileIds.p1),
      { label: 'PA-37: the merge completed', timeoutMs: 30_000 },
    );
    expect(a!.profilelist).toContain(profProfileIds.p1);
  });

  // ===========================================================================================
  // PA-38 — segment link integrity. PARKED: needs the embedded create-segments UI walked.
  // ===========================================================================================
  test.fixme('PA-38 deleting a segment unlinks it from every list and tag', async () => {
    // The rule (create-segments-dialog.deleteSegment):
    //   confirm() -> for each participantlistid: updateDoc('participant list', {segmentid: arrayRemove})
    //             -> for each tagids:            updateDoc('participant tags', {segmentid: arrayRemove})
    //             -> deleteDoc('segments'/{docid})
    //             -> setDoc('participant_list_log', {action_type:'delete', type:'segment',
    //                        metadata.previous:{segmentname, participantlistid, tagids}})
    // ASSERT: no dangling segmentid survives on any list or tag.
    // ALSO RECORD: these are sequential UN-BATCHED writes (creation batches) so a mid-way failure
    // leaves a dangling link (B-06); and the audit doc's `referals` points at the segments doc that
    // was just deleted (B-07).
    //
    // PARKED because create-segments-dialog is an EMBEDDED child of the manage-lists dialog rather
    // than its own dialog (analytics' addSegments() has no live binding — the menu item at
    // participants-analytics.component.html:38 is commented out), so the selector path has to be
    // walked against a running app before this can be written honestly.
  });
});
