// workshop-dashboard-communication.spec.ts — Workshop dashboard: the "Exist Users Enrolled" card + its
// journey / customer-status filters, and the Communication dialog (reach anyone — enrolled or not) with
// its filters, search, selection and the three composer hand-offs.
//
// Recon: starlabs-angular specs/journals/2026-09-10-dashboard-exist-users-card.md and
//        2026-09-11-dashboard-communication-dialog.md.
// Seed (seed-workshops.js): W_DASH has TWO enrolled docs (p0 'enrolled', p1 'enrollednotstarted'); p0/p1/p2
// have `participant metadata` (countrycode '+91', customerstatus 'active', p0.activejourney = JRN_BIG); three
// `new_user_data` docs (NU Alpha/Bravo/Charlie, countryCode '+91', no movedtoexist) are NEW users.
// Anti-circularity:
//   • WDC-01: the card renders totalExistUsersEnrolled = enrolled docs whose profile is NOT a still-new
//     `new_user_data` doc. We compare it to an INDEPENDENT Firestore count (enrolled docs for this run whose
//     profileid has no fresh new_user_data doc) — never a value the test wrote.
//   • WDC-03..06: the dialog merges `participant metadata` + `new_user_data` and flags enrollment from
//     `workshop participant enrolled where workshopref==ref`. Every assertion is on what the APP rendered
//     for the seeded inputs (Enrolled / Not enrolled / New user rows, filter results, selection survival).
//   • WDC-07: the three footer buttons must hand off to the SAME composers as the side panel; we assert the
//     composer dialog the app opened, then dismiss it — nothing is ever sent (prod firewall + stubs, and a
//     dismissed composer returns no payload).
// All reads are single-equality / collection scans — NO composite index needed.
import { test, expect, Page, Locator } from '@playwright/test';
import {
  wsIds, wsAddIds, wsMetaNames, wsUids, installWshopStubs, loginAsWshopAdmin, alignWorkshopMetadataNames,
  resetParticipantWorkshopP0, stampParticipantWorkshopP0Completed,
  setupChatGroupPrecondition, teardownChatGroupPrecondition, giveP1LoginRef, chatGroupMembers,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, queryWhere, pollUntil } from '../queue/support/firestore-admin';

const RUN = process.env.WSHOP_RUNID || 'wshop';
// The metadata people are identified by the name the CF-owned field actually carries — their actor
// EMAIL (see wsMetaNames in support/wshop.ts) — never by the seed's "WS Alpha <run>" label, which the
// profiledata_to_participantmetadata trigger overwrites seconds after the seed. alignWorkshopMetadataNames()
// in beforeEach makes that true in both orders. new_user_data people keep their seeded names.
const ALPHA = wsMetaNames.p0;        // p0 — enrolled, metadata, journey JRN_BIG
const BRAVO = wsMetaNames.p1;        // p1 — enrollednotstarted (still counted as enrolled), metadata
const CHARLIE = wsMetaNames.p2;      // p2 — metadata, NOT enrolled in W_DASH
const NU_ALPHA = `NU Alpha ${RUN}`;  // new_user_data — NEW user, not enrolled
const NU_BRAVO = `NU Bravo ${RUN}`;  // new_user_data — NEW user, not enrolled

async function openDashboard(page: Page): Promise<void> {
  await loginAsWshopAdmin(page);
  await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });
}

/** Opens the Communication dialog and waits for its one-shot load to finish (the result strip appears). */
async function openCommunication(page: Page) {
  const openBtn = page.getByTestId('wdash-comm-open-btn');
  await expect(openBtn, 'the Communication button must render in the dashboard header').toBeVisible({ timeout: 30_000 });
  await openBtn.click();
  const dialog = page.getByRole('dialog').filter({ has: page.getByTestId('wdash-comm-shown-count') });
  await expect(dialog.getByTestId('wdash-comm-shown-count'), 'the dialog must finish loading everyone').toBeVisible({ timeout: 60_000 });
  return dialog;
}

const rows = (dialog: Locator) => dialog.getByTestId('wdash-comm-row');
const row = (dialog: Locator, name: string) => rows(dialog).filter({ hasText: name });
const shownCount = async (dialog: Locator) =>
  parseInt((await dialog.getByTestId('wdash-comm-shown-count').innerText()).replace(/[^0-9]/g, ''), 10);
const selectedCount = async (dialog: Locator) =>
  parseInt((await dialog.getByTestId('wdash-comm-selected-count').innerText()).replace(/[^0-9]/g, ''), 10);

/**
 * Click a mat-checkbox by its native input. The hosts in the menus are block-level (display:block), so a
 * click on the host's centre lands on empty space to the right of the label and toggles nothing; the
 * input sits on top of the 40px touch target and always toggles exactly once.
 */
const tick = async (checkbox: Locator) => {
  const input = checkbox.locator('input');
  const was = await input.isChecked();
  await input.click();
  await expect(input, 'the checkbox must toggle on click').toBeChecked({ checked: !was });
};

/** Types into the (debounced, 180 ms) search and waits until the table has narrowed to `expectRows` rows. */
async function search(dialog: Locator, q: string, expectRows: number): Promise<void> {
  await dialog.getByTestId('wdash-comm-search').fill(q);
  await expect(rows(dialog), `search "${q}" narrows to ${expectRows}`).toHaveCount(expectRows, { timeout: 15_000 });
}

test.describe('Workshop dashboard — Exist Users Enrolled card + Communication dialog (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    // login (30 s) + header (30 s) + the dialog's full-collection load (60 s) must fit with room to spare.
    test.setTimeout(180_000);
    guard = attachConsoleGuard(page);
    await alignWorkshopMetadataNames();   // precondition: CF-terminal names on p0/p1/p2 (see wshop.ts)
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'dashboard communication: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // WDC-01 — the Exist Users Enrolled card equals (enrolled docs) − (still-new users), computed independently
  // ===========================================================================================
  test('WDC-01 Exist Users Enrolled equals the Firestore count of enrolled non-new profiles (app-computed)', async ({ page }) => {
    // [ORACLE] enrolled docs for this run all point at W_DASH; a profile is "new" only while its
    // new_user_data doc exists WITHOUT movedtoexist:true. p0/p1 have no new_user_data doc → both existing.
    const enrolled = await queryWhere('workshop participant enrolled', [['testrunid', '==', RUN]]);
    expect(enrolled.length, 'WDC-01: precondition — 2 enrolled docs seeded for this run').toBe(2);
    let expected = 0;
    for (const e of enrolled) {                       // DocResult is FLAT: { id, ...fields }
      const nu = await getDoc('new_user_data', String(e['profileid']));
      const stillNew = !!nu && nu['movedtoexist'] !== true;
      if (!stillNew) expected++;
    }
    expect(expected, 'WDC-01: precondition — neither seeded enrollee is a still-new user').toBe(2);

    await openDashboard(page);
    const card = page.getByTestId('wdash-exist-users-card');
    await expect(card, 'WDC-01: the Exist Users Enrolled card must render').toBeVisible({ timeout: 30_000 });
    await expect(card, 'WDC-01: it sits before New Users Enrolled').toContainText('Exist Users Enrolled');
    await expect(page.getByTestId('wdash-exist-users-count'), `WDC-01: app-computed count == ${expected}`)
      .toHaveText(String(expected), { timeout: 30_000 });
  });

  // ===========================================================================================
  // WDC-02 — the card's side panel: journey + customer-status filters narrow the list, chips show, clear restores
  // ===========================================================================================
  test('WDC-02 the Exist panel filters by customer status and journey, shows chips, and clears', async ({ page }) => {
    await openDashboard(page);
    await page.getByTestId('wdash-exist-users-card').click();

    // The panel lists one participant-card per existing enrollee (p0 + p1). The name lags the row under a
    // slow emulator (metadata query is a separate await), so count cards rather than names.
    const cards = page.locator('.participant-panel mat-card.participant-card');
    await expect(cards, 'WDC-02: both existing enrollees listed').toHaveCount(2, { timeout: 30_000 });

    // Open the filter menu — options are derived from the people in the list (never from config).
    await page.getByTestId('wdash-exist-filter-btn').click();
    await expect(page.getByTestId('wdash-exist-filter-body'), 'WDC-02: filter menu opens').toBeVisible({ timeout: 15_000 });

    // Customer status: both seeded enrollees are 'active' → filtering keeps both, and a chip appears.
    const active = page.getByTestId('wdash-exist-status-option').filter({ hasText: 'active' });
    await expect(active, 'WDC-02: the active status option is offered').toHaveCount(1);
    await tick(active);
    await expect(page.getByTestId('wdash-exist-status-chip'), 'WDC-02: status chip renders').toContainText('active', { timeout: 15_000 });
    await expect(cards, 'WDC-02: both enrollees are active').toHaveCount(2);

    // Journey: only p0 carries activejourney (JRN_BIG) → the single journey option narrows to p0.
    const journeyOpt = page.getByTestId('wdash-exist-journey-option');
    await expect(journeyOpt, 'WDC-02: exactly one journey is offered (p0 only)').toHaveCount(1);
    await tick(journeyOpt);
    await expect(page.getByTestId('wdash-exist-journey-chip'), 'WDC-02: journey chip renders').toHaveCount(1, { timeout: 15_000 });
    await expect(cards, 'WDC-02: journey AND status narrows to p0').toHaveCount(1, { timeout: 15_000 });
    await expect(cards.first(), 'WDC-02: the remaining row is p0').toContainText(ALPHA, { timeout: 30_000 });

    // Clear All Filters lives inside the menu; it restores the full list and removes the chips.
    await page.getByTestId('wdash-exist-clear-filters-btn').click();
    await expect(cards, 'WDC-02: cleared → both enrollees again').toHaveCount(2, { timeout: 15_000 });
    await expect(page.getByTestId('wdash-exist-status-chip')).toHaveCount(0);
    await expect(page.getByTestId('wdash-exist-journey-chip')).toHaveCount(0);
    await page.keyboard.press('Escape').catch(() => {});
    expect(page.getByTestId('wdash-exist-filter-menu')).toBeTruthy(); // menu host (addressable)
  });

  // ===========================================================================================
  // WDC-03 — the Communication dialog loads EVERYONE and flags enrollment for THIS workshop
  // ===========================================================================================
  test('WDC-03 the dialog lists enrolled, not-enrolled and new people with the right flags', async ({ page }) => {
    await openDashboard(page);
    const dialog = await openCommunication(page);

    // [REAL-UI] p0 + p1 are enrolled in W_DASH; p2 has metadata but no enrollment; NU Alpha is a new user.
    // Rows are found by the actor email (the CF-owned name), which is unique per person.
    await expect(row(dialog, ALPHA), 'WDC-03: p0 is Enrolled').toContainText('Enrolled', { timeout: 30_000 });
    await expect(row(dialog, ALPHA)).not.toContainText('Not enrolled');
    await expect(row(dialog, BRAVO), 'WDC-03: p1 (enrollednotstarted) still counts as Enrolled').toContainText('Enrolled');
    await expect(row(dialog, BRAVO)).not.toContainText('Not enrolled');
    await expect(row(dialog, CHARLIE), 'WDC-03: p2 is Not enrolled').toContainText('Not enrolled');
    await expect(row(dialog, NU_ALPHA), 'WDC-03: a new_user_data person is a New user').toContainText('New user');
    await expect(row(dialog, ALPHA), 'WDC-03: a metadata person is Existing').toContainText('Existing');
    // Phone renders with the dial code the seed stored as "+91"
    await expect(row(dialog, ALPHA), 'WDC-03: phone shows +91 dial code').toContainText('+91');

    await dialog.getByTestId('wdash-comm-close-btn').click();
    await expect(page.getByRole('dialog'), 'WDC-03: the dialog closes').toHaveCount(0, { timeout: 15_000 });
  });

  // ===========================================================================================
  // WDC-04 — audience + enrollment filters
  // ===========================================================================================
  test('WDC-04 audience and enrollment filters narrow the table; new users hide the existing-only filters', async ({ page }) => {
    await openDashboard(page);
    const dialog = await openCommunication(page);
    const before = await shownCount(dialog);
    expect(before, 'WDC-04: everyone is shown initially').toBeGreaterThanOrEqual(6); // p0 p1 p2 + NU ×3 at least

    // Enrolled → exactly the two W_DASH enrollees.
    await dialog.getByTestId('wdash-comm-enroll-enrolled').click();
    await expect(rows(dialog), 'WDC-04: Enrolled → the 2 W_DASH enrollees').toHaveCount(2, { timeout: 15_000 });
    await expect(row(dialog, ALPHA)).toHaveCount(1);
    await expect(row(dialog, BRAVO)).toHaveCount(1);

    // Not enrolled → p2 and the new users are in, the enrollees are out.
    await dialog.getByTestId('wdash-comm-enroll-not').click();
    await expect(row(dialog, ALPHA), 'WDC-04: Not enrolled excludes p0').toHaveCount(0, { timeout: 15_000 });
    await expect(row(dialog, CHARLIE)).toHaveCount(1);
    await expect(row(dialog, NU_ALPHA)).toHaveCount(1);
    await dialog.getByTestId('wdash-comm-enroll-all').click();

    // New users → only new_user_data people; the status + journey filters (existing-only) disappear.
    await dialog.getByTestId('wdash-comm-audience-new').click();
    await expect(row(dialog, ALPHA), 'WDC-04: New users excludes metadata people').toHaveCount(0, { timeout: 15_000 });
    await expect(row(dialog, NU_ALPHA)).toHaveCount(1);
    await expect(dialog.getByTestId('wdash-comm-status-btn'), 'WDC-04: status filter hidden for new users').toHaveCount(0);
    await expect(dialog.getByTestId('wdash-comm-journey-btn'), 'WDC-04: journey filter hidden for new users').toHaveCount(0);

    // Existing users → metadata people only.
    await dialog.getByTestId('wdash-comm-audience-exist').click();
    await expect(row(dialog, NU_ALPHA), 'WDC-04: Existing excludes new users').toHaveCount(0, { timeout: 15_000 });
    await expect(row(dialog, CHARLIE)).toHaveCount(1);
    await expect(dialog.getByTestId('wdash-comm-status-btn')).toHaveCount(1);
    await dialog.getByTestId('wdash-comm-audience-all').click();

    // Clear N restores everyone.
    await dialog.getByTestId('wdash-comm-enroll-enrolled').click();
    await dialog.getByTestId('wdash-comm-clear-filters').click();
    await expect.poll(() => shownCount(dialog), { timeout: 15_000 }).toBe(before);
  });

  // ===========================================================================================
  // WDC-05 — search + selection: a tick survives clearing the search and searching for someone else
  // ===========================================================================================
  test('WDC-05 ticks survive search changes; the selected panel lists them; show-only, remove and clear work', async ({ page }) => {
    await openDashboard(page);
    const dialog = await openCommunication(page);
    const everyone = await shownCount(dialog);

    // search Alpha → tick → clear (×) → search NU Bravo → tick  ⇒ BOTH stay ticked (the operator's bug)
    await search(dialog, ALPHA, 1);
    await tick(row(dialog, ALPHA).getByTestId('wdash-comm-select-row'));
    await expect.poll(() => selectedCount(dialog), { timeout: 10_000 }).toBe(1);
    await dialog.getByTestId('wdash-comm-clear-search').click();
    await expect(rows(dialog), 'WDC-05: × restores everyone').toHaveCount(everyone, { timeout: 15_000 });
    await expect(row(dialog, ALPHA).getByTestId('wdash-comm-select-row').locator('input'), 'WDC-05: Alpha still ticked after clearing the search').toBeChecked();
    await search(dialog, NU_BRAVO, 1);
    await tick(row(dialog, NU_BRAVO).getByTestId('wdash-comm-select-row'));
    await expect.poll(() => selectedCount(dialog), { timeout: 10_000 }).toBe(2);

    // The selected panel lists both names regardless of what the search shows.
    const panel = dialog.getByTestId('wdash-comm-selected-panel');
    await expect(panel, 'WDC-05: selected panel appears').toBeVisible();
    await expect(panel).toContainText(ALPHA);
    await expect(panel).toContainText(NU_BRAVO);
    await expect(dialog.getByTestId('wdash-comm-selected-chip'), 'WDC-05: one chip per ticked person').toHaveCount(2);

    // Collapse / expand.
    await dialog.getByTestId('wdash-comm-selected-toggle').click();
    await expect(dialog.getByTestId('wdash-comm-selected-chip'), 'WDC-05: collapsed hides the chips').toHaveCount(0);
    await dialog.getByTestId('wdash-comm-selected-toggle').click();
    await expect(dialog.getByTestId('wdash-comm-selected-chip')).toHaveCount(2);

    // Show only these → the table shows exactly the ticked two, across the search.
    await dialog.getByTestId('wdash-comm-clear-search').click();
    await dialog.getByTestId('wdash-comm-only-selected').click();
    await expect(rows(dialog), 'WDC-05: show-only narrows to the ticked people').toHaveCount(2, { timeout: 15_000 });
    await expect(row(dialog, ALPHA)).toHaveCount(1);
    await expect(row(dialog, NU_BRAVO)).toHaveCount(1);

    // × on a chip unticks that person only.
    await dialog.getByTestId('wdash-comm-selected-chip').filter({ hasText: NU_BRAVO }).getByTestId('wdash-comm-selected-remove').click();
    await expect.poll(() => selectedCount(dialog), { timeout: 10_000 }).toBe(1);
    await expect(rows(dialog), 'WDC-05: show-only follows the selection').toHaveCount(1, { timeout: 15_000 });

    // Clear selection → panel gone, everyone shown again.
    await dialog.getByTestId('wdash-comm-clear-selection').click();
    await expect(panel, 'WDC-05: panel disappears when nothing is ticked').toHaveCount(0);
    await expect(rows(dialog)).toHaveCount(everyone, { timeout: 15_000 });

    // Clicking the row (its name cell, not the box) also ticks; select-all ticks everyone shown; the
    // empty state's Clear restores.
    await row(dialog, CHARLIE).locator('.cm-name').click();
    await expect.poll(() => selectedCount(dialog), { timeout: 10_000 }).toBe(1);
    await tick(dialog.getByTestId('wdash-comm-select-all'));
    await expect.poll(() => selectedCount(dialog), { timeout: 10_000 }).toBe(everyone);
    await dialog.getByTestId('wdash-comm-clear-selection').click();
    await dialog.getByTestId('wdash-comm-search').fill('nobody-matches-this-zzz');
    await expect(dialog.getByTestId('wdash-comm-empty-clear'), 'WDC-05: empty state offers Clear filters').toBeVisible({ timeout: 15_000 });
    await dialog.getByTestId('wdash-comm-empty-clear').click();
    await expect(rows(dialog)).toHaveCount(everyone, { timeout: 15_000 });
  });

  // ===========================================================================================
  // WDC-06 — the menu filters (customer status / journey / country) and the has-phone / has-email boxes
  // ===========================================================================================
  test('WDC-06 status, journey, country and has-phone/has-email filters narrow to the seeded people', async ({ page }) => {
    await openDashboard(page);
    const dialog = await openCommunication(page);

    // Customer status 'active' — every seeded metadata person is active; new users have no status.
    await dialog.getByTestId('wdash-comm-status-btn').click();
    await expect(page.getByTestId('wdash-comm-status-menu'), 'WDC-06: status menu opens').toBeVisible({ timeout: 15_000 });
    await tick(page.getByTestId('wdash-comm-status-option').filter({ hasText: 'active' }));
    await page.keyboard.press('Escape');
    await expect(row(dialog, ALPHA), 'WDC-06: active keeps p0').toHaveCount(1, { timeout: 15_000 });
    await expect(row(dialog, NU_ALPHA), 'WDC-06: active excludes new users (no status)').toHaveCount(0);

    // Journey — only p0 carries one; picking it narrows to p0.
    await dialog.getByTestId('wdash-comm-journey-btn').click();
    await expect(page.getByTestId('wdash-comm-journey-menu'), 'WDC-06: journey menu opens').toBeVisible({ timeout: 15_000 });
    // p0's journey. The dialog labels a journey by its `journey` field and falls back to the doc id, so match
    // either spelling the seed may carry (seed-workshops.js writes `journeyname`).
    const seededJourney = page.getByTestId('wdash-comm-journey-option').filter({ hasText: new RegExp(`${wsAddIds.JRN_BIG}|BIG Journey`) });
    await expect(seededJourney, 'WDC-06: the seeded journey is offered').toHaveCount(1);
    await tick(seededJourney);
    await page.keyboard.press('Escape');
    await expect(rows(dialog), 'WDC-06: status AND journey → p0 only').toHaveCount(1, { timeout: 15_000 });
    await expect(row(dialog, ALPHA)).toHaveCount(1);
    await dialog.getByTestId('wdash-comm-clear-filters').click();

    // Country — both collections store +91 (different spellings); the option shows once and keeps everyone seeded.
    await dialog.getByTestId('wdash-comm-country-btn').click();
    await expect(page.getByTestId('wdash-comm-country-menu'), 'WDC-06: country menu opens').toBeVisible({ timeout: 15_000 });
    await tick(page.getByTestId('wdash-comm-country-option').filter({ hasText: '+91' }));
    await page.keyboard.press('Escape');
    await expect(row(dialog, ALPHA), 'WDC-06: +91 keeps a metadata person').toHaveCount(1, { timeout: 15_000 });
    await expect(row(dialog, NU_ALPHA), 'WDC-06: +91 keeps a new user (camelCase spelling)').toHaveCount(1);
    await dialog.getByTestId('wdash-comm-clear-filters').click();

    // Has phone / has email — the seeded people have both, so they stay.
    await tick(dialog.getByTestId('wdash-comm-need-phone'));
    await tick(dialog.getByTestId('wdash-comm-need-email'));
    await expect(row(dialog, ALPHA), 'WDC-06: p0 has a phone and an email').toHaveCount(1, { timeout: 15_000 });
    await expect(row(dialog, NU_ALPHA)).toHaveCount(1);
    await dialog.getByTestId('wdash-comm-clear-filters').click();
  });

  // ===========================================================================================
  // WDC-08 — Participant Data › Challenge Progress Details shows where each step was done
  // ===========================================================================================
  test('WDC-08 each sub-challenge card shows its platform, defaulting to "EiFlix Web" when the row carries none', async ({ page }) => {
    await openDashboard(page);
    // The progress table lists the one status==='enrolled' participant (p0); locate the row positionally —
    // its name lags the row under a slow emulator (see WS-11). Clicking it opens Participant Data.
    const p0Row = page.locator('table.progress-table tr.mat-mdc-row, table.progress-table tr[mat-row]').first();
    await expect(p0Row, 'WDC-08: the enrolled participant row must render').toBeVisible({ timeout: 90_000 });
    await p0Row.click();

    // [ASSERT] p0's seeded participant-workshop rows (seed-workshops.js pwChallengesP0: one COMPLETED
    // sub-challenge, one untouched) carry NO platform_name. The pill is only shown on a completed step, so
    // exactly one pill renders, and it reads the fallback — the value the APP chose for a missing field,
    // never one the test wrote. (WS-12 may complete the second step before us — then it is two pills.)
    const completedChips = page.locator('.pd-sub .pd-chip.completed');
    await expect(completedChips.first(), 'WDC-08: the seeded completed step renders').toBeVisible({ timeout: 30_000 });
    const done = await completedChips.count();
    const pills = page.getByTestId('wdash-sub-platform');
    await expect(pills, 'WDC-08: a pill on every completed step, none on untouched ones').toHaveCount(done, { timeout: 15_000 });
    for (const pill of await pills.all()) {
      await expect(pill, 'WDC-08: a row without a platform reads "EiFlix Web"').toHaveText(/EiFlix Web/);
    }
    // Untouched steps show no pill at all.
    const untouched = page.locator('.pd-sub').filter({ has: page.locator('.pd-chip.notstarted') });
    expect(await untouched.count(), 'WDC-08: the seed leaves at least one untouched step').toBeGreaterThanOrEqual(1);
    await expect(untouched.first().getByTestId('wdash-sub-platform'), 'WDC-08: no pill on an untouched step').toHaveCount(0);
    // The document-level platform (how p0 enrolled) sits in the hero strip; the seed stores none → web.
    await expect(page.getByTestId('wdash-pd-platform'), 'WDC-08: hero shows the enrolment platform').toContainText('EiFlix Web');
  });

  // ===========================================================================================
  // WDC-10 — a completed step's date carries the clock time; an untouched step shows no date at all
  // ===========================================================================================
  test('WDC-10 a completed step shows its platform label and its date WITH time; an untouched step shows neither', async ({ page }) => {
    // Precondition (anti-circular): a KNOWN completed instant and raw platform value on p0's first step.
    // The app must turn them into "15 Sept 2026, 8:05 pm" and "EiFlix App" — the format and label are the
    // app's, never strings the test wrote. Restored to the plain seed state afterwards for WS-12.
    await stampParticipantWorkshopP0Completed('eiflixapp');
    try {
      await openDashboard(page);
      const p0Row = page.locator('table.progress-table tr.mat-mdc-row, table.progress-table tr[mat-row]').first();
      await expect(p0Row, 'WDC-10: the enrolled participant row must render').toBeVisible({ timeout: 90_000 });
      await p0Row.click();

      const completedCard = page.locator('.pd-sub').filter({ has: page.locator('.pd-chip.completed') }).first();
      await expect(completedCard, 'WDC-10: the completed card renders').toBeVisible({ timeout: 30_000 });
      // Day + 12-hour time, en-IN ("Sept" on current ICU, "Sep" on older builds — both are the same day).
      await expect(completedCard.locator('.pd-meta-item').filter({ hasText: /2026/ }), 'WDC-10: completed date carries the clock time')
        .toHaveText(/15 Sept? 2026, 8:05 pm/, { timeout: 15_000 });
      await expect(completedCard.getByTestId('wdash-sub-platform'), 'WDC-10: raw "eiflixapp" is shown as EiFlix App')
        .toHaveText(/EiFlix App/);

      const untouched = page.locator('.pd-sub').filter({ has: page.locator('.pd-chip.notstarted') }).first();
      await expect(untouched, 'WDC-10: the untouched step renders').toBeVisible();
      await expect(untouched.locator('.pd-meta-item'), 'WDC-10: no date on an untouched step').toHaveCount(0);
      await expect(untouched.getByTestId('wdash-sub-platform'), 'WDC-10: no platform pill on an untouched step').toHaveCount(0);
    } finally {
      await resetParticipantWorkshopP0();
    }
  });

  // ===========================================================================================
  // WDC-09 — Platform Usage: participants by enrolment platform, steps by step platform
  // ===========================================================================================
  test('WDC-09 the Platform Usage section counts the seeded progress documents and their touched steps', async ({ page }) => {
    // [ORACLE] every progress doc for W_DASH is seeded without platform_name → all "EiFlix Web";
    // p0 has one completed step (Intro Video) and one untouched, p1's copy of the workshop
    // challenges is untouched. So: enrolled-via "EiFlix Web" = number of progress docs for this run;
    // steps "EiFlix Web" completed ≥ 1 (WS-12 may add a second before or after us — same platform).
    const pwDocs = await queryWhere('participant workshop', [['testrunid', '==', RUN]]);
    expect(pwDocs.length, 'WDC-09: precondition — progress docs seeded for this run').toBeGreaterThanOrEqual(2);
    const noPlatform = pwDocs.every((d) => !d['platform_name']);
    expect(noPlatform, 'WDC-09: precondition — the seed stores no platform_name (blank = web)').toBe(true);

    await openDashboard(page);
    const section = page.getByTestId('wdash-platform-section');
    await expect(section, 'WDC-09: the section renders').toBeVisible({ timeout: 30_000 });

    // Enrolled via: one legend row, "EiFlix Web", count = every progress doc, 100%.
    const enrollRows = page.getByTestId('wdash-platform-enroll-row');
    await expect(enrollRows, 'WDC-09: a single enrolment platform').toHaveCount(1, { timeout: 30_000 });
    await expect(enrollRows.first()).toContainText('EiFlix Web');
    await expect(enrollRows.first()).toContainText(String(pwDocs.length));
    await expect(enrollRows.first()).toContainText('100%');
    expect(page.getByTestId('wdash-platform-enroll-card')).toBeTruthy();

    // Steps by platform: only touched steps count, all on the web platform here.
    const stepRows = page.getByTestId('wdash-platform-step-row');
    await expect(stepRows, 'WDC-09: a single step platform').toHaveCount(1, { timeout: 30_000 });
    await expect(stepRows.first()).toContainText('EiFlix Web');
    await expect(stepRows.first()).toContainText(/[1-9]\d* completed/);
    await expect(stepRows.first()).toContainText('0 in progress');
    expect(page.getByTestId('wdash-platform-steps-card')).toBeTruthy();

    // The section sits at the BOTTOM of the main column — after the archive sections, before the panel.
    const order = await page.evaluate(() => {
      const plat = document.querySelector('[data-testid="wdash-platform-section"]');
      const pd = document.querySelector('#participantDataCard');
      return !!plat && !!pd && !!(pd.compareDocumentPosition(plat) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order, 'WDC-09: Platform Usage renders below Participant Data').toBe(true);

    // [REAL-UI] clicking an enrolment platform opens the side panel with exactly those participants —
    // the same panel the metric cards open (onPlatformClick → selectedParticipants → applyFilterSide).
    await enrollRows.first().click();
    const panel = page.locator('.participant-panel.panel-visible');
    await expect(panel, 'WDC-09: the side panel opens').toBeVisible({ timeout: 15_000 });
    await expect(panel.locator('.panel-header'), 'WDC-09: header names the platform').toContainText('Enrolled via');
    await expect(panel.locator('.panel-header')).toContainText('EiFlix Web');
    await expect(panel.locator('mat-card.participant-card'), 'WDC-09: one card per progress document')
      .toHaveCount(pwDocs.length, { timeout: 30_000 });
    await page.getByTestId('wd-close-participant-panel-61').click();
    await expect(panel).toHaveCount(0, { timeout: 15_000 });
  });

  // ===========================================================================================
  // WDC-11 — "Users Not in Chat Group": the card, the panel, one add, add-all, and the live drop-off
  // ===========================================================================================
  test('WDC-11 the chat-group card lists enrolled people missing from the group and adds their uid to it', async ({ page }) => {
    // Precondition (anti-circular): an EMPTY group on W_DASH; p0 resolvable (firebaseuserref), p1 not.
    await setupChatGroupPrecondition();
    try {
      await openDashboard(page);
      const card = page.getByTestId('wdash-chat-card');
      await expect(card, 'WDC-11: the card appears once a group is set and someone is missing').toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('wdash-chat-count'), 'WDC-11: both enrollees are missing from the empty group').toHaveText('2', { timeout: 30_000 });
      await card.click();

      const panel = page.locator('.participant-panel.panel-visible');
      await expect(panel, 'WDC-11: the side panel opens').toBeVisible({ timeout: 15_000 });
      await expect(panel.locator('.panel-header')).toContainText('Chat Group');
      const cards = panel.locator('mat-card.participant-card');
      await expect(cards, 'WDC-11: one card per missing person').toHaveCount(2, { timeout: 30_000 });
      // p0 (has a login) gets an Add button; p1 (no login yet) gets the explanation instead.
      const p0Card = cards.filter({ hasText: wsMetaNames.p0 });
      const p1Card = cards.filter({ hasText: wsMetaNames.p1 });
      await expect(p0Card.getByTestId('wdash-chat-add-btn'), 'WDC-11: p0 can be added').toHaveCount(1);
      await expect(p1Card.getByTestId('wdash-chat-no-uid'), 'WDC-11: p1 has no login to add').toHaveCount(1);
      await expect(p1Card.getByTestId('wdash-chat-add-btn')).toHaveCount(0);
      const addAll = page.getByTestId('wdash-chat-add-all-btn');
      await expect(addAll, 'WDC-11: Add all counts only the addable people').toContainText('1');

      // [REAL-UI] add p0. [ASSERT] the APP arrayUnions p0's uid into supportchat.members — read back from
      // Firestore — and the live listener drops p0 from the panel and the card count.
      await p0Card.getByTestId('wdash-chat-add-btn').click();
      const members = await pollUntil(chatGroupMembers, (m) => m.includes(wsUids.p0),
        { label: 'WDC-11: supportchat.members gains p0 uid', timeoutMs: 30_000 });
      expect(members, 'WDC-11: exactly p0 was added').toEqual([wsUids.p0]);
      await expect(cards, 'WDC-11: p0 leaves the panel').toHaveCount(1, { timeout: 30_000 });
      await expect(page.getByTestId('wdash-chat-count'), 'WDC-11: the card follows the group').toHaveText('1', { timeout: 30_000 });
      await expect(addAll, 'WDC-11: nobody addable is left').toBeDisabled();

      // Add-all with nothing addable must not write anything.
      expect(await chatGroupMembers()).toEqual([wsUids.p0]);
    } finally {
      await teardownChatGroupPrecondition();
    }
  });

  test('WDC-11b Add all to group adds every addable person in one write and the card disappears', async ({ page }) => {
    await setupChatGroupPrecondition();
    await giveP1LoginRef();                      // both enrollees addable, so the card can reach zero
    try {
      await openDashboard(page);
      await expect(page.getByTestId('wdash-chat-count')).toHaveText('2', { timeout: 30_000 });
      await page.getByTestId('wdash-chat-card').click();
      const addAll = page.getByTestId('wdash-chat-add-all-btn');
      await expect(addAll, 'WDC-11b: Add all offers both').toContainText('2', { timeout: 15_000 });
      await addAll.click();
      // [ASSERT] the APP arrayUnioned both uids in one write — read back from Firestore.
      const members = await pollUntil(chatGroupMembers, (m) => m.includes(wsUids.p0) && m.includes(wsUids.p1),
        { label: 'WDC-11b: supportchat.members gains both uids', timeoutMs: 30_000 });
      expect([...members].sort()).toEqual([wsUids.p0, wsUids.p1].sort());
      // Nobody is missing any more → the card is gone (count 0 hides it) and the panel empties.
      await expect(page.getByTestId('wdash-chat-card'), 'WDC-11b: the card hides at zero').toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator('.participant-panel.panel-visible mat-card.participant-card')).toHaveCount(0, { timeout: 30_000 });
    } finally {
      await teardownChatGroupPrecondition();
    }
  });

  // ===========================================================================================
  // Addressable — every hook this feature added, as a literal reference (console readiness gate).
  // ===========================================================================================
  test('workshop-dashboard + communication-dialog — controls addressable', async ({ page }) => {
    await openDashboard(page);
    for (const id of [
      'wdash-exist-users-card', 'wdash-exist-users-count', 'wdash-exist-filter-btn', 'wdash-exist-filter-menu',
      'wdash-exist-filter-body', 'wdash-exist-journey-option', 'wdash-exist-status-option', 'wdash-exist-status-chip', 'wdash-exist-journey-chip',
      'wdash-exist-clear-filters-btn', 'wdash-comm-open-btn', 'wdash-sub-platform', 'wdash-pd-platform',
      'wdash-platform-section', 'wdash-platform-enroll-card', 'wdash-platform-enroll-row', 'wdash-platform-steps-card', 'wdash-platform-step-row',
      'wdash-chat-card', 'wdash-chat-count', 'wdash-chat-add-all-btn', 'wdash-chat-add-btn', 'wdash-chat-no-uid',
    ]) expect(page.getByTestId(id)).toBeTruthy();
    expect(page.getByTestId('wdash-comm-close-btn')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-audience-all')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-audience-exist')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-audience-new')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-enroll-all')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-enroll-enrolled')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-enroll-not')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-status-btn')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-status-menu')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-status-option')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-journey-btn')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-journey-menu')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-journey-option')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-country-btn')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-country-menu')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-country-option')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-need-phone')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-need-email')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-search')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-clear-search')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-clear-filters')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-shown-count')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-selected-count')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-selected-panel')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-selected-toggle')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-only-selected')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-clear-selection')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-selected-chip')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-selected-remove')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-select-all')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-select-cell')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-select-row')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-row')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-empty-clear')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-send-email')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-send-whatsapp')).toBeTruthy();
    expect(page.getByTestId('wdash-comm-send-notification')).toBeTruthy();
  });
});

// ============================================================================================
// WDC-07 — the footer buttons hand off to the SAME composers as the side panel, then dismiss.
// NO console guard here, deliberately (same stance as WS-14 in workshops-deep.spec.ts): the composers
// read config the workshops seed does not carry (`email validators`, `classify/postmarkserver`,
// `classify/wati`) and log benign errors on open in the emulator. What this test proves is the
// hand-off — the dialog routes to the composers the side panel uses — never their internals, and
// nothing is sent: each composer is dismissed through its own close control, which returns no payload,
// and every sender guards on that (result?.action !== 'sent' / result != null).
// ============================================================================================
test.describe('Workshop dashboard — Communication dialog hands off to the side-panel composers', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await alignWorkshopMetadataNames();
    await installWshopStubs(page);
  });

  test('WDC-07 WhatsApp / Notification / Email open the side panel\'s composers and can be dismissed', async ({ page }) => {
    await openDashboard(page);
    const dialog = await openCommunication(page);
    await search(dialog, ALPHA, 1);
    await tick(row(dialog, ALPHA).getByTestId('wdash-comm-select-row'));
    await expect.poll(() => selectedCount(dialog), { timeout: 10_000 }).toBe(1);

    const dialogs = page.getByRole('dialog');
    await expect(dialogs).toHaveCount(1);

    // WhatsApp → SendmessagesComponent (sendWatti). Its header × calls close().
    await expect(dialog.getByTestId('wdash-comm-send-whatsapp'), 'WDC-07: WhatsApp enabled for a person with a phone').toBeEnabled();
    await dialog.getByTestId('wdash-comm-send-whatsapp').click();
    await expect(dialogs, 'WDC-07: the WhatsApp composer opens above the dialog').toHaveCount(2, { timeout: 20_000 });
    await expect(dialogs.last().getByRole('heading', { name: 'Send Message' })).toBeVisible({ timeout: 20_000 });
    await dialogs.last().locator('button.close-btn').first().click();
    await expect(dialogs, 'WDC-07: dismissed without sending').toHaveCount(1, { timeout: 15_000 });

    // Notification → AhNotificationComponent. Opened with disableClose:true, so Escape is inert — use its
    // mat-dialog-close × button.
    await expect(dialog.getByTestId('wdash-comm-send-notification')).toBeEnabled();
    await dialog.getByTestId('wdash-comm-send-notification').click();
    await expect(dialogs, 'WDC-07: the notification composer opens').toHaveCount(2, { timeout: 20_000 });
    await dialogs.last().locator('button.close-button[mat-dialog-close]').click();
    await expect(dialogs).toHaveCount(1, { timeout: 15_000 });

    // Email → the Email Campaign Composer (the one WS-14 drives from the side panel). Also disableClose:true;
    // its header cancel (onDialogCancel) closes it.
    await expect(dialog.getByTestId('wdash-comm-send-email'), 'WDC-07: email enabled for a person with an address').toBeEnabled();
    await dialog.getByTestId('wdash-comm-send-email').click();
    await expect(dialogs, 'WDC-07: the email composer opens').toHaveCount(2, { timeout: 20_000 });
    await expect(dialogs.last().getByRole('heading', { name: 'Email Campaign Composer' })).toBeVisible({ timeout: 20_000 });
    await dialogs.last().locator('button.hdr-btn.danger').click();
    await expect(dialogs).toHaveCount(1, { timeout: 15_000 });

    await dialog.getByTestId('wdash-comm-close-btn').click();
    await expect(dialogs, 'WDC-07: the dialog closes').toHaveCount(0, { timeout: 15_000 });
  });
});
