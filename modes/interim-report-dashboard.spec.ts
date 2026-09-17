// interim-report-dashboard.spec.ts — BEHAVIORAL coverage of tab 3 of /interimreportlog, the embedded
// <app-interim-report-dashboard>. Prefix: ird (the dashboard renders inside a ShadowRoot; Playwright's
// selectors pierce open shadow roots, so getByTestId resolves through it unchanged).
//
// Recon: starlabs-angular specs/journals/2026-09-11-interim-report-dashboard-tab.md (09-11 → 09-16) and
//        specs/plans/2026-09-16-interim-dashboard-filters-export.md.
// This file ADDS to interim-report.spec.ts (PM-13/14/15, tabs 0 and 2) and interim-report-tabs.spec.ts
// (IRT-LL, IRT-DASH addressable); it never re-asserts those.
//
// The world (seed-modes.js §12b, all createdon = now so the dashboard's default current-month range holds):
//   p0 · IRL_COMPLETED   submitted   · interim crossover + interim evolutionprogress + love letter
//   p1 · IRL_ONGOING     ongoing     · ask AH (both asks), NO crossover
//   p1 · IRL_NOTSTARTED  not started · reports[] empty
//   journeys A (p0.activejourney) and B (p1.lastcompletedjourney) · one event p0 ATTENDED and p1 only REGISTERED
//
// Anti-circularity:
//   • Every case first narrows the screen with the PARTICIPANT filter to one seeded, run-unique actor
//     email, so the assertions cannot be perturbed by anything else on the shared test project.
//   • IRD-01..06 assert what the app COMPUTED from the seeded documents (its counts, its matrix, its
//     drill-down rows, what each filter kept or dropped) — never a value the test wrote.
//   • The two filter cases carry a NEGATIVE CONTROL that must disappear: p1 holds journey B only in
//     `lastcompletedjourney` (so selecting B proves the activejourney → lastcompletedjourney →
//     lastsubscribedjourney fall-through actually runs) and p1's event request is status 'registered'
//     (so the event filter proves it keeps 'attended' only). Without those a green test could not tell
//     "the filter ran" from "there was nothing else to drop".
//   • IRD-07/08/09 seed every tag false / notes empty (resetLoveLetterIrd) and assert the tag,
//     resolveddetails and notes entry the APP wrote, with .user == the logged-in admin's profileid.
//   • IRD-10/11 assert the browser-level effect the app asked for (a .xlsx download; a NEW tab at
//     /userprofile/<profileid>) — nothing is written.
// All reads are single-equality — NO composite index needed.
import { test, expect, Page, Locator } from '@playwright/test';
import {
  installModeStubs, loginAsModeAdmin, modeActors, modeContent, modeIds, modeProfileIds, resetLoveLetterIrd,
} from './support/modes';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, countWhere, pollUntil } from '../queue/support/firestore-admin';

/** Open /interimreportlog and activate tab 3; resolves once the dashboard's first paint has landed. */
async function openDashboard(page: Page): Promise<void> {
  await loginAsModeAdmin(page);
  await page.goto('/interimreportlog', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/interimreportlog/, { timeout: 30_000 });
  await page.getByRole('tab', { name: /Interim Report Dashboard/i }).click();
  await expect(page.getByTestId('ird-strip-all'), 'the dashboard strip must render').toBeVisible({ timeout: 60_000 });
}

/** Narrow every section to one seeded actor (the app filters on profile_data.name == the actor email). */
async function filterToParticipant(page: Page, email: string): Promise<void> {
  await page.getByTestId('ird-filter-participant').fill(email);
  await expect(page.getByTestId('ird-strip-all').locator('.n')).not.toHaveText('0', { timeout: 30_000 });
}

const stripCount = async (page: Page, id: string): Promise<number> =>
  parseInt((await page.getByTestId(id).locator('.n').innerText()).replace(/[^0-9]/g, ''), 10);

/** Pick a row in one of the two searchable filter dropdowns (journey / event). */
async function pickFilter(page: Page, kind: 'journey' | 'event', label: string): Promise<void> {
  await page.getByTestId(kind === 'journey' ? 'ird-filter-journey' : 'ird-filter-event').click();
  await page.getByTestId(`ird-${kind}-search`).fill(label);
  const option = page.getByTestId(`ird-${kind}-option`).filter({ hasText: label }).first();
  await expect(option, `${kind} dropdown: the seeded "${label}" row must be searchable`).toBeVisible({ timeout: 30_000 });
  await option.click();
  await expect(page.getByTestId(`ird-${kind}-count`), `${kind} filter must report its match count`)
    .toBeVisible({ timeout: 30_000 });
}

/** The Love Letters list, opened from the section's big count. */
async function openLetters(page: Page): Promise<Locator> {
  await page.getByTestId('ird-letters-all').click();
  const letter = page.getByTestId('ird-letter-row').filter({ hasText: modeContent.loveLetterIrd });
  await expect(letter, 'the seeded love letter must be listed').toBeVisible({ timeout: 30_000 });
  return letter;
}

test.describe('Modes — Interim Report Dashboard (counts, filters, tagging, export)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installModeStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'interim-report dashboard: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // IRD-01 — the summary strip classifies each seeded log: submitted / ongoing / not started.
  // ===========================================================================================
  test('IRD-01 the strip classifies the seeded reports (submitted, ongoing, not started)', async ({ page }) => {
    test.setTimeout(120_000);
    await openDashboard(page);

    // p0 has ONE log, status 'completed' → Submitted.
    await filterToParticipant(page, modeActors.participant0);
    expect(await stripCount(page, 'ird-strip-all'), 'IRD-01: p0 has one interim report in range').toBe(1);
    expect(await stripCount(page, 'ird-strip-submitted'), 'IRD-01: it is the submitted one').toBe(1);
    expect(await stripCount(page, 'ird-strip-ongoing')).toBe(0);
    expect(await stripCount(page, 'ird-strip-notstarted')).toBe(0);

    // p1 has TWO logs: reports[] non-empty + no status → Ongoing; reports[] empty → Not started.
    await filterToParticipant(page, modeActors.participant1);
    expect(await stripCount(page, 'ird-strip-all'), 'IRD-01: p1 has two interim reports in range').toBe(2);
    expect(await stripCount(page, 'ird-strip-submitted')).toBe(0);
    expect(await stripCount(page, 'ird-strip-ongoing'), 'IRD-01: the log with steps saved is Ongoing').toBe(1);
    expect(await stripCount(page, 'ird-strip-notstarted'), 'IRD-01: the empty log is Not started').toBe(1);
  });

  // ===========================================================================================
  // IRD-02 — the Crossover Meter counts ONLY participants who have an `interim crossover` record.
  // Oracle: p1 has two reports on screen (IRD-01) and ZERO crossover docs, so every cell must read 0.
  // ===========================================================================================
  test('IRD-02 the Crossover Meter leaves out participants with no crossover record', async ({ page }) => {
    test.setTimeout(120_000);
    // Independent oracle — the crossover doc belongs to p0's log, and p1 has none.
    expect(await countWhere('interim crossover', [['interimlogid', '==', modeIds.IRL_COMPLETED]]),
      'IRD-02: p0 has exactly one crossover record').toBe(1);
    expect(await countWhere('interim crossover', [['interimlogid', '==', modeIds.IRL_ONGOING]]),
      'IRD-02: p1 has none').toBe(0);

    await openDashboard(page);

    // p0 — one crossover record, so each life-area row totals exactly 1 across the four bands.
    await filterToParticipant(page, modeActors.participant0);
    expect(await page.getByTestId('ird-cross-business-b3').innerText(), 'IRD-02: Business 9 lands in the 8–10 band').toBe('1');
    expect(await page.getByTestId('ird-cross-career-b2').innerText(), 'IRD-02: Career 5 lands in 4–7').toBe('1');
    expect(await page.getByTestId('ird-cross-family-b1').innerText(), 'IRD-02: Family 2 lands in 1–3').toBe('1');
    expect(await page.getByTestId('ird-cross-health-b0').innerText(), 'IRD-02: Health 0 is Not progressed').toBe('1');
    expect(await page.getByTestId('ird-cross-personal-genius-b0').innerText(),
      'IRD-02: an unfilled area is Not progressed too').toBe('1');

    // p1 — two reports on screen, no crossover record: every cell 0, including "Not progressed".
    await filterToParticipant(page, modeActors.participant1);
    expect(await stripCount(page, 'ird-strip-all'), 'IRD-02: p1 is on screen').toBe(2);
    for (const id of ['ird-cross-business-b0', 'ird-cross-business-b3', 'ird-cross-health-b0', 'ird-cross-career-b2']) {
      // eslint-disable-next-line no-await-in-loop
      expect(await page.getByTestId(id).innerText(),
        `IRD-02: ${id} must be 0 — a participant without a crossover record is not counted`).toBe('0');
    }
  });

  // ===========================================================================================
  // IRD-03 — a crossover cell opens the participants in that band, with their goal and level jump.
  // ===========================================================================================
  test('IRD-03 a crossover cell drills down to the goal and the level it jumped from', async ({ page }) => {
    test.setTimeout(120_000);
    await openDashboard(page);
    await filterToParticipant(page, modeActors.participant0);

    await page.getByTestId('ird-cross-business-b3').click();
    const row = page.getByTestId('ird-modal-row');
    await expect(row, 'IRD-03: exactly the one seeded participant is in the 8–10 band').toHaveCount(1, { timeout: 30_000 });
    // The app renders metric.startpoint → metric.endpoint as the goal, and metric.jumpedfrom beside it.
    await expect(row.first(), 'IRD-03: the row carries the goal the crossover doc holds').toContainText('Crisis');
    await expect(row.first()).toContainText('Stable');
    await expect(row.first(), 'IRD-03: and the level the participant jumped from').toContainText('Just out of Crisis');
    await page.getByTestId('ird-modal-close').click();
  });

  // ===========================================================================================
  // IRD-04 — Evolution Progress: the seeded answers land in the right share band, and the drill-down
  // states how many adjustments are behind the percentage (2 of 4 = 50% → the 26–50% column).
  // ===========================================================================================
  test('IRD-04 an evolution cell drills down to the adjustments behind the percentage', async ({ page }) => {
    test.setTimeout(120_000);
    await openDashboard(page);
    await filterToParticipant(page, modeActors.participant0);

    // 4 answered adjustments: 1 No Change (25% → 1–25%), 1 Somewhat Change (25%), 2 Changed (50% → 26–50%).
    expect(await page.getByTestId('ird-evo-none-q1').innerText(), 'IRD-04: 1 of 4 No Change = 25%').toBe('1');
    expect(await page.getByTestId('ird-evo-some-q1').innerText(), 'IRD-04: 1 of 4 Somewhat Change = 25%').toBe('1');
    expect(await page.getByTestId('ird-evo-lot-q2').innerText(), 'IRD-04: 2 of 4 Changed = 50%').toBe('1');

    // Total years saved is the stored summary.savedyears — the dashboard shows it, it never recomputes it.
    await expect(page.getByTestId('ird-strip-years'), 'IRD-04: the stored years saved is shown to 1 decimal')
      .toContainText('10.5');

    await page.getByTestId('ird-evo-lot-q2').click();
    const row = page.getByTestId('ird-modal-row');
    await expect(row, 'IRD-04: one participant in that cell').toHaveCount(1, { timeout: 30_000 });
    await expect(row.first(), 'IRD-04: the share the app computed').toContainText('50%');
    await expect(row.first(), 'IRD-04: and the adjustments behind it, out of the ones answered')
      .toContainText(/2\s*of\s*4\s*adjustments/);
    await page.getByTestId('ird-modal-close').click();
  });

  // ===========================================================================================
  // IRD-05 — JOURNEY filter. Journey A is p0's `activejourney`; journey B is on p1 ONLY as
  // `lastcompletedjourney`, so selecting B proves the fall-through order runs.
  // ===========================================================================================
  test('IRD-05 the journey filter resolves activejourney, then lastcompletedjourney', async ({ page }) => {
    test.setTimeout(120_000);
    await openDashboard(page);

    // Journey A + p0 → kept (activejourney).
    await filterToParticipant(page, modeActors.participant0);
    await pickFilter(page, 'journey', modeContent.journeyA);
    expect(await stripCount(page, 'ird-strip-all'), 'IRD-05: p0 is on journey A through activejourney').toBe(1);
    await expect(page.getByTestId('ird-journey-count')).toContainText('1 participant');

    // Journey B + p0 → dropped (p0 is on A). The negative control: the filter really narrows.
    await pickFilter(page, 'journey', modeContent.journeyB);
    await expect(page.getByTestId('ird-empty'), 'IRD-05: p0 is not on journey B')
      .toContainText(/No participants match/i, { timeout: 30_000 });

    // Journey B + p1 → kept, resolved from lastcompletedjourney (p1 has no activejourney at all).
    await page.getByTestId('ird-filter-participant').fill(modeActors.participant1);
    await expect(page.getByTestId('ird-strip-all').locator('.n'), 'IRD-05: p1 is on journey B through lastcompletedjourney')
      .toHaveText('2', { timeout: 30_000 });
  });

  // ===========================================================================================
  // IRD-06 — EVENT filter. p0 ATTENDED the seeded event, p1 only REGISTERED for it: selecting the
  // event must keep p0 and drop p1, and the badge reads "<matches> of <attendees> attended".
  // ===========================================================================================
  test('IRD-06 the event filter keeps the attendees and drops the merely registered', async ({ page }) => {
    test.setTimeout(120_000);
    // Independent oracle: both requests point at the same event, only one of them is 'attended'.
    expect(await countWhere('event participation request', [['status', '==', 'attended']]),
      'IRD-06: at least the seeded attended request exists').toBeGreaterThanOrEqual(1);

    await openDashboard(page);
    await filterToParticipant(page, modeActors.participant0);
    await pickFilter(page, 'event', modeContent.eventIrd);
    expect(await stripCount(page, 'ird-strip-all'), 'IRD-06: p0 attended, so p0 stays').toBe(1);
    await expect(page.getByTestId('ird-event-count'), 'IRD-06: the badge shows matches of total attendees')
      .toContainText(/1 of \d+ attended/);

    // p1 registered but never attended → the event filter must drop them.
    await page.getByTestId('ird-filter-participant').fill(modeActors.participant1);
    await expect(page.getByTestId('ird-empty'), 'IRD-06: a registered-but-not-attended participant is dropped')
      .toContainText(/No participants match/i, { timeout: 30_000 });
  });

  // ===========================================================================================
  // IRD-07 — tagging a love letter from the dashboard writes the tag + who set it.
  // ===========================================================================================
  test('IRD-07 tagging a love letter writes liked:true + likedetails.user == the logged-in admin', async ({ page }) => {
    test.setTimeout(120_000);
    await resetLoveLetterIrd();
    const before = await getDoc('love letter', modeIds.LL_IRD);
    expect(before!.liked, 'IRD-07: the seeded letter starts untagged').toBe(false);

    await openDashboard(page);
    await filterToParticipant(page, modeActors.participant0);
    const letter = await openLetters(page);
    await letter.getByTestId('ird-tag-happy').click();

    const after = await pollUntil(
      () => getDoc('love letter', modeIds.LL_IRD),
      (d) => !!d && d.liked === true,
      { timeoutMs: 30_000, label: 'IRD-07: the app writes liked:true on the love letter' },
    );
    expect(after!.liked, 'IRD-07: the APP wrote the tag').toBe(true);
    expect((after!.likedetails as any)?.user, 'IRD-07: stamped with the logged-in admin profileid')
      .toBe(modeProfileIds.admin);
  });

  // ===========================================================================================
  // IRD-08 — Resolved is its own control and asks first: Cancel writes nothing, Yes writes.
  // ===========================================================================================
  test('IRD-08 marking resolved asks for confirmation — Cancel writes nothing, Yes writes', async ({ page }) => {
    test.setTimeout(120_000);
    await resetLoveLetterIrd();

    await openDashboard(page);
    await filterToParticipant(page, modeActors.participant0);
    const letter = await openLetters(page);

    // Ask, then cancel → no write. The dashboard writes on click, so a short settle is enough for a
    // write to have shown up in Firestore had one been made.
    await letter.getByTestId('ird-resolve-ask').click();
    await expect(letter.getByTestId('ird-resolve-confirm'), 'IRD-08: the confirmation must appear first')
      .toBeVisible({ timeout: 10_000 });
    await letter.getByTestId('ird-resolve-cancel').click();
    await page.waitForTimeout(3_000);
    const afterCancel = await getDoc('love letter', modeIds.LL_IRD);
    expect(afterCancel!.resolved, 'IRD-08: Cancel must not resolve the letter').toBe(false);

    // Ask, then confirm → the app writes resolved + who resolved it.
    await letter.getByTestId('ird-resolve-ask').click();
    await letter.getByTestId('ird-resolve-confirm').click();
    const afterYes = await pollUntil(
      () => getDoc('love letter', modeIds.LL_IRD),
      (d) => !!d && d.resolved === true,
      { timeoutMs: 30_000, label: 'IRD-08: the app writes resolved:true after the confirmation' },
    );
    expect((afterYes!.resolveddetails as any)?.user, 'IRD-08: stamped with the logged-in admin profileid')
      .toBe(modeProfileIds.admin);
  });

  // ===========================================================================================
  // IRD-09 — a note typed on the dashboard is appended to the same `notes` array the tabs write.
  // ===========================================================================================
  test('IRD-09 a note is appended to the love letter with the author profileid', async ({ page }) => {
    test.setTimeout(120_000);
    await resetLoveLetterIrd();
    const text = `IRD e2e note ${Date.now()}`;

    await openDashboard(page);
    await filterToParticipant(page, modeActors.participant0);
    const letter = await openLetters(page);

    await letter.getByTestId('ird-notes-toggle').click();
    await letter.getByTestId('ird-note-text').fill(text);
    await letter.getByTestId('ird-note-save').click();

    const after = await pollUntil(
      () => getDoc('love letter', modeIds.LL_IRD),
      (d) => Array.isArray(d?.notes) && (d!.notes as any[]).some((n) => n?.notes === text),
      { timeoutMs: 30_000, label: 'IRD-09: the app appends the note' },
    );
    const note = (after!.notes as any[]).find((n) => n?.notes === text);
    expect(note?.user, 'IRD-09: the note carries the logged-in admin profileid').toBe(modeProfileIds.admin);
  });

  // ===========================================================================================
  // IRD-10 — every list exports: the By participant table hands the browser an .xlsx download.
  // ===========================================================================================
  test('IRD-10 By participant exports the rows on screen as an .xlsx download', async ({ page }) => {
    test.setTimeout(120_000);
    await openDashboard(page);
    await filterToParticipant(page, modeActors.participant0);
    await page.getByTestId('ird-view-people').click();
    await expect(page.getByTestId('ird-people-row'), 'IRD-10: the participant row must render')
      .toHaveCount(1, { timeout: 30_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByTestId('ird-people-export').click(),
    ]);
    expect(download.suggestedFilename(), 'IRD-10: the app writes a spreadsheet').toMatch(/\.xlsx$/);
  });

  // ===========================================================================================
  // IRD-11 — a participant's name opens their profile screen in a NEW tab (never in place).
  // ===========================================================================================
  test('IRD-11 a participant name opens /userprofile in a new tab', async ({ page, context }) => {
    test.setTimeout(120_000);
    await openDashboard(page);
    await filterToParticipant(page, modeActors.participant0);
    await page.getByTestId('ird-view-people').click();

    const [profile] = await Promise.all([
      context.waitForEvent('page', { timeout: 60_000 }),
      page.getByTestId('ird-participant-name').first().click(),
    ]);
    await expect(profile, 'IRD-11: the new tab lands on that participant profile')
      .toHaveURL(new RegExp(`userprofile/${modeProfileIds.participant0}`), { timeout: 30_000 });
    // The dashboard tab itself must not have navigated away.
    await expect(page, 'IRD-11: the dashboard stays put').toHaveURL(/interimreportlog/);
    await profile.close();
  });
});
