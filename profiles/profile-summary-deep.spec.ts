// profile-summary-deep.spec.ts — the profile-summary WRITE paths (deep).
//
// profile-summary is 903 LOC with 8 live handlers and exactly ONE existing case (PA-10, a render).
// Everything that writes is untested. These are the two cheapest real write cases in the whole
// profiles suite: both target `profile_data`, which the seeder already seeds, so they need no
// seeder extension and no composite index.
//
//   PA-21 General Notes -> the APP appends to profile_data.notes.generalnotes[] and writes the map.
//   PA-22 Private Notes -> the same for notes.privatenotes[], and must NOT disturb generalnotes.
//   PA-21b Cancel on the dialog writes NOTHING (UpdateDialogComponent.cancel() closes with null,
//         and addgeneralnotes short-circuits on `result != null`).
//   PA-23 Add Issue — PARKED, see the fixme note.
//
// Anti-circularity: the assertion is always on the doc the PRODUCT wrote (polled through the admin
// SDK), never on a value this spec wrote. The seed is precondition only.
//
// DEFECT PINNED — B-01 (profile-summary.component.ts:441,479): the note's `givenby` is set to
// `this.profileId`, i.e. the PARTICIPANT whose summary is open, not the logged-in author. Contrast
// participants-analytics `addremarks` (:1373) which correctly uses `loggedInProfileId`. PA-21 asserts
// the CURRENT (wrong) value and is annotated so the day it is fixed, this test fails loudly and
// tells the next reader why.
import { test, expect } from '@playwright/test';
import {
  profProfileIds, installProfileStubs, loginAsProfileAdmin,
} from './support/profiles';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil, db } from '../queue/support/firestore-admin';

// profile-summary mounts the same wide participant dashboard as userprofile — tolerate ONLY the two
// documented environment classes the existing profile.spec.ts tolerates.
const TOLERATE = [/requires an index/i, /Cannot read properties of undefined \(reading 'indexOf'\)/i];

/** Reset profile_data.notes to a known empty baseline (precondition write only). */
async function resetNotes(profileId: string): Promise<void> {
  await db().collection('profile_data').doc(profileId).set({ notes: {} }, { merge: true });
}

/** The notes dialog: a textarea + Submit/Cancel (DialogBox/update-dialog). */
const NOTES_TEXTAREA = '.mainscreen textarea';
const NOTES_SUBMIT = 'button.submitbtn';
const NOTES_CANCEL = 'button.cancelbtn';

test.describe('Profiles — profile-summary notes + issues (deep, real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installProfileStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'profile-summary-deep: no fatal console errors / pageerrors', TOLERATE));

  async function openSummary(page) {
    await loginAsProfileAdmin(page);
    await page.goto(`/profilesummary/${profProfileIds.p0}`, { waitUntil: 'domcontentloaded' });
    // the participant name is what PA-10 already proves renders — use it as the mount signal.
    await expect(page.getByText(/General Notes/i).first(), 'profile-summary must mount').toBeVisible({ timeout: 30_000 });
  }

  // ===========================================================================================
  // PA-21 — General Notes: the app appends to profile_data.notes.generalnotes[]
  // ===========================================================================================
  test('PA-21 adding a general note -> the app writes profile_data.notes.generalnotes[]', async ({ page }) => {
    await resetNotes(profProfileIds.p0);
    const before = await getDoc('profile_data', profProfileIds.p0);
    expect(before, 'PA-21: seeded profile_data must exist').toBeTruthy();
    expect(before!.notes?.generalnotes ?? [], 'PA-21: baseline has no general notes').toHaveLength(0);

    const NOTE = `PA-21 general note ${Date.now()}`;
    await openSummary(page);

    // [REAL-UI] the "General Notes" button opens UpdateDialogComponent (a textarea + Submit).
    await page.getByRole('button', { name: /General Notes/i }).click();
    const box = page.locator(NOTES_TEXTAREA);
    await expect(box, 'PA-21: the notes dialog must open').toBeVisible({ timeout: 10_000 });
    await box.fill(NOTE);
    await page.locator(NOTES_SUBMIT).click();

    // [ASSERT] the value the APP wrote (updateDoc profile_data.notes — component:465).
    const after = await pollUntil(
      () => getDoc('profile_data', profProfileIds.p0),
      (d) => Array.isArray(d?.notes?.generalnotes) && d!.notes.generalnotes.length === 1,
      { label: 'PA-21: profile_data.notes.generalnotes[] gains the note', timeoutMs: 30_000 },
    );
    const entry = after!.notes.generalnotes[0];
    expect(entry.generalnotes, 'PA-21: the note text the app stored').toBe(NOTE);
    expect(entry.date, 'PA-21: the app stamps a date').toBeTruthy();

    // DEFECT B-01 — `givenby` is the PARTICIPANT id, not the author's. Asserting the CURRENT
    // behaviour deliberately: when B-01 is fixed this line fails and points at the fix.
    expect(entry.givenby,
      'PA-21 / DEFECT B-01: givenby is the participant profileid, not the logged-in author. ' +
      'If this now holds the author id, B-01 has been FIXED — update this assertion.',
    ).toBe(profProfileIds.p0);

    await resetNotes(profProfileIds.p0);
  });

  // ===========================================================================================
  // PA-21b — Cancel must not write. UpdateDialogComponent.cancel() closes with null and
  //          addgeneralnotes() guards on `result != null` (component:451).
  // ===========================================================================================
  test('PA-21b cancelling the notes dialog writes nothing', async ({ page }) => {
    await resetNotes(profProfileIds.p0);
    await openSummary(page);

    await page.getByRole('button', { name: /General Notes/i }).click();
    const box = page.locator(NOTES_TEXTAREA);
    await expect(box).toBeVisible({ timeout: 10_000 });
    await box.fill('PA-21b this text must never be persisted');
    await page.locator(NOTES_CANCEL).click();

    // Give any (incorrect) write time to land before asserting absence.
    await page.waitForTimeout(2_000);
    const after = await getDoc('profile_data', profProfileIds.p0);
    expect(after!.notes?.generalnotes ?? [],
      'PA-21b: Cancel closes with null -> the app must not write',
    ).toHaveLength(0);
  });

  // ===========================================================================================
  // PA-22 — Private Notes write their OWN array and leave generalnotes untouched.
  // ===========================================================================================
  test('PA-22 adding a private note writes notes.privatenotes[] and leaves generalnotes intact', async ({ page }) => {
    // Baseline: ONE existing general note, so the independence assertion has something to protect.
    await db().collection('profile_data').doc(profProfileIds.p0).set({
      notes: { generalnotes: [{ givenby: profProfileIds.p0, generalnotes: 'PA-22 pre-existing', date: new Date() }] },
    }, { merge: true });

    const NOTE = `PA-22 private note ${Date.now()}`;
    await openSummary(page);

    await page.getByRole('button', { name: /Private Notes/i }).click();
    const box = page.locator(NOTES_TEXTAREA);
    await expect(box, 'PA-22: the notes dialog must open').toBeVisible({ timeout: 10_000 });
    await box.fill(NOTE);
    await page.locator(NOTES_SUBMIT).click();

    const after = await pollUntil(
      () => getDoc('profile_data', profProfileIds.p0),
      (d) => Array.isArray(d?.notes?.privatenotes) && d!.notes.privatenotes.length === 1,
      { label: 'PA-22: profile_data.notes.privatenotes[] gains the note', timeoutMs: 30_000 },
    );
    expect(after!.notes.privatenotes[0].privatenotes, 'PA-22: the private note the app stored').toBe(NOTE);

    // The whole `notes` map is rewritten from client state (component:503) — the pre-existing
    // general note must survive that rewrite. This is the assertion that catches a lost-update.
    expect(after!.notes.generalnotes, 'PA-22: the general note must survive the privatenotes write').toHaveLength(1);
    expect(after!.notes.generalnotes[0].generalnotes).toBe('PA-22 pre-existing');

    await resetNotes(profProfileIds.p0);
  });

  // ===========================================================================================
  // PA-23 — Add Issue. PARKED: needs seed data this seeder does not yet write.
  // ===========================================================================================
  test.fixme('PA-23 Add Issue -> the app creates a clientissue doc numbered max+1 (1001 when empty)', async ({ page }) => {
    // BLOCKED ON SEED, not on the app. addcustomersupportissue (profile-summary:386) only opens
    // AddIssueComponent when productlist AND clientList AND ahMember are ALL non-empty — otherwise it
    // is a SILENT no-op (no dialog, no error). The profiles seeder currently seeds `products` but
    // nothing that populates clientList / ahMember, so the guard's state is not deterministic here
    // and neither the positive nor the negative assertion can be trusted.
    //
    // TO UNPARK: seed the two collections behind clientList + ahMember, then assert BOTH branches:
    //   PA-23a  clientissue EMPTY  -> the created doc has issueno === 1001  (the surprising default)
    //   PA-23b  clientissue seeded -> issueno === max + 1   (use seedClientIssue() from
    //           seed-lists-segments-tags.js; the two are mutually exclusive per run — see that file)
    // Both are non-transactional reads of orderBy('issueno','desc').limit(1) across the WHOLE
    // collection with no testrunid clause, so a leftover issue doc from any run changes the number.
  });
});
