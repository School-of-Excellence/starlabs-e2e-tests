// workshop-dashboard.spec.ts — Workshop dashboard: the app-computed enrolled metric, the app-computed
// progress percentage, and a REAL manual move-next WRITE. Plus a route-mount smoke for the whole group.
//
// Recon: e2e/recon-allcomp/workshops.md (WS-07 / WS-11 / WS-12).
// Anti-circularity:
//   • WS-07: the dashboard streams `workshop participant enrolled where workshopref==ref` and renders a
//     "Total Enrolled" metric it computed; we compare it to an INDEPENDENT Firestore countWhere.
//   • WS-11: the dashboard computes progressPercentage = completed/total sub-challenges from the
//     `participant workshop` doc; we assert the RENDERED % equals the ratio implied by the seeded
//     precondition (1 of 2 = 50%) — the app computed it, we only supplied the inputs.
//   • WS-12: drive the real "Move Next" button and assert the value the APP WROTE to `participant
//     workshop` (manualcompletion:true + status 'completed' on the current sub-challenge) — never a
//     value the test wrote; the test only resets the precondition.
//   • WS-41: the Email column's expected value is READ BACK from `participant metadata` (CF-owned
//     field, see wsMetaNames) — the test never chooses the address it then asserts on.
//   • WS-43: p0's name and email are normally the same string, so the case first stamps a name that
//     shares nothing with the email; the row surviving a search for the email's local part can then
//     only mean the app searched the email. Restored via alignWorkshopMetadataNames().
//     This case is ALSO the regression test for the crash it found on 2026-10-01: the predicate
//     dereferenced a sub-challenge's `name` bare, and the seeded sub-challenges carry `heading`
//     instead — so typing in the box threw, MatTableDataSource aborted the filter pass, and the
//     table silently stopped responding. The console guard catches the throw; the negative-control-
//     first ordering catches the silence.
//   • WS-44: the tag's condition (`workshoponly`) is a precondition write; the assertion is on what
//     the app RENDERED from it — a text element with a painted background, and no new.png anywhere.
//
// Hook prefix: this screen's hooks are `wd-*` (workshop-dashboard.component.html).
//
// The dashboard query (`workshop participant enrolled where workshopref==<ref>`) and the participant-
// workshop query are single-equality reads — NO composite index needed.
import { test, expect, Locator } from '@playwright/test';
import {
  wsActors, wsIds, wsProfileIds, installWshopStubs, loginAsWshopAdmin, loginAsWshopMover,
  resetParticipantWorkshopP0, alignWorkshopMetadataNames, p0MetadataEmail, stampP0DistinctName,
  stampP0Workshoponly, wsP0SearchName,
  WS_EVERGREEN_DAYS_LEFT, clearEvergreenExtended, seedEvergreenExtended, wsEvergreenIds, wsMetaNames,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, countWhere, pollUntil } from '../queue/support/firestore-admin';

const RUN = process.env.WSHOP_RUNID || 'wshop';

/**
 * Put a term in the progress-table search box the way a person does.
 *
 * The input is bound to `(keyup)="applyFilter($event)"` — Playwright's fill() dispatches `input` only,
 * so it sets the value and the filter never runs. Clearing with fill('') is fine (the keyups that
 * follow carry the complete value), but the term itself must arrive as real key events.
 */
async function typeSearch(search: Locator, term: string): Promise<void> {
  await search.fill('');
  await search.pressSequentially(term, { delay: 10 });
}

test.describe('Workshop dashboard — enrolled metric + progress + move-next (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'workshop dashboard: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // WS-07 — "Total Enrolled" metric equals the live count of enrolled docs for this workshop
  // ===========================================================================================
  test('WS-07 dashboard Total Enrolled equals the Firestore count of enrolled docs (app-computed)', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });

    // [REAL-UI] the "Total Enrolled" metric card renders {{ totalEnrolled }} = the length of the live
    // `workshop participant enrolled where workshopref==ref` stream (updateMetrics, ts:1054). Wait for
    // the card the app built, then read the number it computed.
    const card = page.locator('mat-card.metric-card').filter({ hasText: 'Total Enrolled' });
    await expect(card, 'WS-07: the Total Enrolled metric card must render').toBeVisible({ timeout: 30_000 });

    // [ASSERT] independent Firestore count of enrolled docs for the dashboard workshop. Every enrolled
    // doc seeded for THIS run points at W_DASH's workshopref (seed-workshops.js), so the run-tag count
    // is exactly the count of enrolled docs the dashboard streams for this workshop — an independent
    // oracle, never a value the test wrote. The app counts all statuses for the Total Enrolled metric.
    const seededEnrolled = await countWhere('workshop participant enrolled', [['testrunid', '==', RUN]]);
    expect(seededEnrolled, 'WS-07: precondition — 2 enrolled docs seeded for this run (both → W_DASH)').toBe(2);

    const value = await pollUntil(
      async () => {
        const txt = (await card.locator('.metric-value, h2').first().innerText()).trim();
        return parseInt(txt.replace(/[^0-9]/g, ''), 10);
      },
      (n) => Number.isFinite(n) && n === seededEnrolled,
      { label: `WS-07: Total Enrolled renders ${seededEnrolled}`, timeoutMs: 30_000 },
    );
    expect(value, 'WS-07: app-computed Total Enrolled == Firestore enrolled count').toBe(seededEnrolled);
  });

  // ===========================================================================================
  // WS-11 — the progress bar renders the app-computed percentage (1 of 2 sub-challenges = 50%)
  // ===========================================================================================
  test('WS-11 the participant progress row renders the app-computed 50% (1 of 2 sub-challenges)', async ({ page }) => {
    // Precondition (anti-circular): reset p0 to the 1-of-2-complete state so the computed % is 50.
    await resetParticipantWorkshopP0();

    await loginAsWshopAdmin(page);
    await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });

    // [REAL-UI] the progress table includes only status==='enrolled' participants — exactly one here (p0;
    // p1 is 'enrollednotstarted' and excluded). Locate the single data row by POSITION, not by the
    // participant name: the name comes from mapProfile[profileid].name, which the component fills only after
    // an awaited `participant metadata` query (workshop-dashboard.component.ts:1216) that runs separately
    // from the progress-row snapshot. Under a degraded CI emulator that query lags, so the row renders with
    // a blank name for a while — a name-text locator then finds nothing even though the row is present. The
    // row's OWN data (the 50% progress-text) is the oracle and is asserted below, so identifying the row
    // positionally loses no coverage.
    const p0Row = page.locator('table.progress-table tr.mat-mdc-row, table.progress-table tr[mat-row]').first();
    await expect(p0Row, 'WS-11: the enrolled participant progress row must render').toBeVisible({ timeout: 90_000 });

    // [ASSERT] the app computed progressPercentage = completed/total = 1/2 = 50% from the participant-
    // workshop doc it streamed; the rendered progress-text must read "50%". Known inputs (1 of 2) →
    // app output (50%); we never assert a value the test wrote.
    const pctText = p0Row.locator('.progress-text');
    await expect(pctText, 'WS-11: progress text renders the computed 50%').toHaveText(/\b50%/, { timeout: 15_000 });
    // The completed/total columns corroborate: 1 completed of 2.
    const rowText = (await p0Row.innerText()).replace(/\s+/g, ' ');
    expect(rowText, `WS-11: row shows the 1-of-2 completed ratio. Row="${rowText}"`).toMatch(/\b50%/);
  });

  // ===========================================================================================
  // WS-12 — manual move-next WRITES manualcompletion:true + status 'completed' on the current sub-challenge
  // ===========================================================================================
  test('WS-12 manual "Move Next" writes manualcompletion:true + status "completed" to participant workshop', async ({ page }) => {
    // Precondition (anti-circular): p0 at sub-challenge[0]=completed, [1]='' (current). The move marks [1].
    await resetParticipantWorkshopP0();
    const before = await getDoc('participant workshop', wsIds.PW_A);
    expect(before, 'WS-12: seeded participant workshop must exist').toBeTruthy();
    const beforeSub1 = (before as any)!.challenges[0].challenges[1];
    expect(beforeSub1.status ?? '', 'WS-12: sub-challenge[1] starts not-completed').not.toBe('completed');
    expect(beforeSub1.manualcompletion ?? null, 'WS-12: sub-challenge[1] starts without manualcompletion').not.toBe(true);

    // The move-next button only renders/runs for the hardcoded allow-list of profileids — log in as the
    // seeded "mover" whose profileid IS one of them (workshop-dashboard.component.ts:1688).
    await loginAsWshopMover(page);
    await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });

    // Locate the single enrolled row positionally (see WS-11): the participant name lags behind the row
    // render under a degraded CI emulator, so a name-text locator flakes; the row is the delivery target.
    const p0Row = page.locator('table.progress-table tr.mat-mdc-row, table.progress-table tr[mat-row]').first();
    await expect(p0Row, 'WS-12: the enrolled participant row must render').toBeVisible({ timeout: 90_000 });

    // [REAL-UI] click the "Move Next" action button (moveParticipantToNext()).
    const moveBtn = p0Row.getByRole('button', { name: /Move Next/i });
    await expect(moveBtn, 'WS-12: the Move Next button must render for the allow-listed mover').toBeVisible({ timeout: 15_000 });
    await moveBtn.click();

    // [ASSERT] the app's updateDoc wrote status:'completed' + manualcompletion:true on sub-challenge[1]
    // (updateChallengeProgress, ts:1758). Polled from Firestore — the value the PRODUCT wrote, not the
    // test's reset value (which left [1] uncompleted).
    const after = await pollUntil(
      () => getDoc('participant workshop', wsIds.PW_A),
      (d) => !!d && (d as any).challenges?.[0]?.challenges?.[1]?.status === 'completed',
      { label: 'WS-12: participant-workshop sub-challenge[1] → status "completed"', timeoutMs: 30_000 },
    );
    const afterSub1 = (after as any)!.challenges[0].challenges[1];
    expect(afterSub1.status, 'WS-12: sub-challenge[1] marked completed by the app').toBe('completed');
    expect(afterSub1.manualcompletion, 'WS-12: app set manualcompletion:true').toBe(true);
  });

  // ===========================================================================================
  // WS-41 — the Email column sits immediately after Participant and renders the stored address
  // ===========================================================================================
  test('WS-41 Participant Progress Details shows an Email column right after Participant, with the stored address', async ({ page }) => {
    // Precondition: the CF and the seed both write `participant metadata`.email, so read back whichever
    // landed — the oracle is Firestore, never a literal in this file.
    const storedEmail = await p0MetadataEmail();
    expect(storedEmail, 'WS-41: precondition — p0 has a stored email').toBeTruthy();
    expect(storedEmail, 'WS-41: precondition — the stored email looks like an address').toContain('@');

    await loginAsWshopAdmin(page);
    await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });

    // [REAL-UI] header row of the progress table, scoped to that table — "Total Enrolled" is a metric
    // card elsewhere on the page and an unscoped header lookup would collide with the shell.
    const headers = page.locator('table.progress-table tr[mat-header-row] th, table.progress-table th[mat-header-cell]');
    await expect(headers.first(), 'WS-41: the progress table header must render').toBeVisible({ timeout: 90_000 });
    const headerText = (await headers.allInnerTexts()).map((t) => t.trim()).filter(Boolean);

    // [ASSERT] Email is a column, and it is the one straight after Participant. W_DASH is
    // categorybased:false (seed-workshops.js), so the runtime-spliced "Type" column is absent here.
    const pIdx = headerText.findIndex((t) => /^Participant$/i.test(t));
    const eIdx = headerText.findIndex((t) => /^Email$/i.test(t));
    expect(pIdx, `WS-41: a Participant header exists. Headers=${JSON.stringify(headerText)}`).toBeGreaterThanOrEqual(0);
    expect(eIdx, `WS-41: an Email header exists. Headers=${JSON.stringify(headerText)}`).toBeGreaterThanOrEqual(0);
    expect(eIdx, `WS-41: Email comes directly after Participant. Headers=${JSON.stringify(headerText)}`).toBe(pIdx + 1);

    // [ASSERT] the cell renders the address the app read from `participant metadata` — compared to the
    // Firestore value above, which this test did not write.
    const p0Row = page.locator('table.progress-table tr.mat-mdc-row, table.progress-table tr[mat-row]').first();
    await expect(p0Row, 'WS-41: the enrolled participant row must render').toBeVisible({ timeout: 90_000 });
    await expect(p0Row.locator('.participant-email'), 'WS-41: the Email cell renders the stored address')
      .toHaveText(storedEmail, { timeout: 30_000 });
  });

  // ===========================================================================================
  // WS-42 — Total / Status / Assignment are parked: no header, no cell, and Move Next still there
  // ===========================================================================================
  test('WS-42 the Total, Status and Assignment columns are not rendered (and Action survives)', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });

    const headers = page.locator('table.progress-table tr[mat-header-row] th, table.progress-table th[mat-header-cell]');
    await expect(headers.first(), 'WS-42: the progress table header must render').toBeVisible({ timeout: 90_000 });
    const headerText = (await headers.allInnerTexts()).map((t) => t.trim()).filter(Boolean);

    // [ASSERT] exact-match each parked header. A substring test would be wrong in both directions:
    // "Total" is inside the "Total Enrolled" metric card, and "Current Challenge" contains neither.
    for (const parked of ['Total', 'Status', 'Assignment']) {
      expect(headerText.some((t) => t.toLowerCase() === parked.toLowerCase()),
        `WS-42: "${parked}" is parked and must not be a column. Headers=${JSON.stringify(headerText)}`).toBe(false);
    }
    // The Review button lived only in the Assignment cell, so it goes with the column.
    await expect(page.getByTestId('wd-review-assignment-38'), 'WS-42: the Assignment cell Review button is gone with its column')
      .toHaveCount(0);

    // [ASSERT] the columns that stayed are still there — this is a parking change, not a table rewrite.
    for (const kept of ['Participant', 'Email', 'Current Challenge', 'Progress', 'Completed', 'Action']) {
      expect(headerText.some((t) => t.toLowerCase() === kept.toLowerCase()),
        `WS-42: "${kept}" must still be a column. Headers=${JSON.stringify(headerText)}`).toBe(true);
    }
    // mat-table throws "Could not find column with id" if a displayed id lost its cell definition; a
    // rendered data row with the same cell count as the header proves every kept column still has one.
    const p0Row = page.locator('table.progress-table tr.mat-mdc-row, table.progress-table tr[mat-row]').first();
    await expect(p0Row, 'WS-42: the data row must render').toBeVisible({ timeout: 90_000 });
    // Against the raw header count, not headerText.length — that array drops blank labels.
    expect(await p0Row.locator('td').count(), 'WS-42: one data cell per header column').toBe(await headers.count());
  });

  // ===========================================================================================
  // WS-43 — the search box matches on email, not just on name
  // ===========================================================================================
  test('WS-43 searching the participant list by email keeps the matching row and a miss empties it', async ({ page }) => {
    // Precondition (anti-circular): p0's name and email are normally the SAME string (the CF sets
    // metadata.name from profile_data.name, which the auth seed sets to the actor's email). Give p0 a
    // name that shares nothing with the email, so only the email path can satisfy the search.
    const storedEmail = await p0MetadataEmail();
    expect(storedEmail, 'WS-43: precondition — p0 has a stored email').toBeTruthy();
    await stampP0DistinctName();
    try {
      await loginAsWshopAdmin(page);
      await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });

      const rows = page.locator('table.progress-table tr.mat-mdc-row, table.progress-table tr[mat-row]');
      await expect(rows.first(), 'WS-43: the enrolled participant row must render').toBeVisible({ timeout: 90_000 });
      // The stamped name must actually be on screen before searching, or the search proves nothing about
      // which field matched.
      await expect(rows.first().locator('.participant-name'), 'WS-43: the row shows the stamped distinct name')
        .toHaveText(wsP0SearchName, { timeout: 30_000 });
      const baseline = await rows.count();
      expect(baseline, 'WS-43: at least one row before filtering').toBeGreaterThanOrEqual(1);

      // Scoped to the participants card: "Search by name or email" is a placeholder several other
      // screens use too, and the dashboard opens dialogs that carry it (group chat, cohort picker).
      const search = page.locator('mat-card.participants-card').getByPlaceholder('Search by name or email');
      await expect(search, 'WS-43: the search field must render').toBeVisible({ timeout: 15_000 });

      // [ASSERT] the email's local part is absent from the stamped name, from the profileid and from
      // every other searched field — so the row surviving means the app searched the email.
      const localPart = storedEmail.split('@')[0];
      expect(wsP0SearchName.toLowerCase().includes(localPart.toLowerCase()),
        `WS-43: precondition — the stamped name must not contain "${localPart}"`).toBe(false);
      expect(wsProfileIds.p0.toLowerCase().includes(localPart.toLowerCase()),
        `WS-43: precondition — the profileid must not contain "${localPart}"`).toBe(false);
      // TRAP: the input is wired to (keyup), and Playwright's fill() dispatches only `input` — it would
      // set the box and never run applyFilter(). pressSequentially() sends real key events per character.
      //
      // ORDER MATTERS, and this is the lesson from the 2026-10-01 CI run. The negative control goes
      // FIRST. A filterPredicate that throws leaves filteredData untouched, so every row stays — which
      // is indistinguishable from "the email matched" if the positive case runs first. Proving the
      // filter can REMOVE the row is what makes the positive case afterwards mean anything.
      await typeSearch(search, `nosuchparticipant-${RUN}-zzz`);
      await expect(rows, 'WS-43: a term in no field filters every row out (filter is live, not throwing)')
        .toHaveCount(0, { timeout: 15_000 });

      // [ASSERT] now the row comes BACK for a term that exists only in the email — so the match is the
      // app reading the email, and not a filter that never ran.
      await typeSearch(search, localPart);
      await expect(rows, 'WS-43: the row returns, matched on its email alone').toHaveCount(baseline, { timeout: 15_000 });
    } finally {
      await alignWorkshopMetadataNames();
    }
  });

  // ===========================================================================================
  // WS-44 — the "New" marker is a highlighted text tag, not the assets/new.png image
  // ===========================================================================================
  test('WS-44 a new participant is marked with a highlighted "New" text tag, no image', async ({ page }) => {
    // Precondition: `workshoponly` is the flag the tag renders on. Not CF-owned, so this write stands.
    await stampP0Workshoponly(true);
    try {
      await loginAsWshopAdmin(page);
      await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });

      const p0Row = page.locator('table.progress-table tr.mat-mdc-row, table.progress-table tr[mat-row]').first();
      await expect(p0Row, 'WS-44: the enrolled participant row must render').toBeVisible({ timeout: 90_000 });

      // [ASSERT] the tag is text the app rendered from the flag, in the participant cell.
      const badge = p0Row.locator('.new-badge');
      await expect(badge, 'WS-44: the flagged participant carries a New tag').toBeVisible({ timeout: 30_000 });
      await expect(badge, 'WS-44: the tag is the word New').toHaveText(/^New$/i);

      // [ASSERT] it is a real element, not an <img> — the old marker was assets/new.png, and the point of
      // the change is that the tag no longer depends on an image loading.
      expect(await badge.evaluate((el) => el.tagName.toLowerCase()), 'WS-44: the tag is not an image').not.toBe('img');
      await expect(p0Row.locator('img[src*="new.png"]'), 'WS-44: no new.png image anywhere in the row').toHaveCount(0);

      // [ASSERT] and it is actually highlighted — a background the app painted, not the default
      // transparent. Read from the live computed style, not from the stylesheet.
      const bg = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg, `WS-44: the tag has a highlight background. Got "${bg}"`).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/);
    } finally {
      await stampP0Workshoponly(false);
    }
  });
});

// ===========================================================================================
// Route-mount smoke — every workshop route mounts for the super-role admin (guard admits, no bounce
// to /login, the screen renders). Proves the dashboard route-grants seeded. Skips assertNoFatal: the
// engagement/capacity dashboards do heavy cross-feature reads that may log benign errors on a sparse
// test project; this smoke only asserts the route does not bounce to /login.
// ===========================================================================================
test.describe('Workshops — route-mount smoke (guard admits super-role admin)', () => {
  const ROUTES = [
    '/workshops',
    `/workshopconfig/${wsIds.W_INACTIVE}`,
    `/workshop_dashboard/${wsIds.W_DASH}`,
    '/create-workshop',
    '/productpageworkshop',
    '/engagementdashboard',
    '/bigengagementdashboard',
  ];
  test('every seeded workshop route mounts (no /login bounce)', async ({ page }) => {
    await installWshopStubs(page);
    await loginAsWshopAdmin(page);
    const bounced: string[] = [];
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800); // bounded settle (networkidle hangs on camera/iframe/stream routes)
      const url = page.url();
      if (/\/login/.test(url)) bounced.push(`${route} -> ${url}`);
    }
    expect(bounced, `routes that bounced to /login (missing dashboard grant): ${bounced.join(', ')}`).toHaveLength(0);
  });
});

// =============================================================================================
// WS-49 — Extended Participants dialog: days remaining per profile.
//
// Anti-circularity: the seed writes an extension running to 23:59 exactly
// WS_EVERGREEN_DAYS_LEFT calendar days out, and the case asserts the APP rendered "12 days left".
// The test supplies the date; the arithmetic is the app's. A second participant's extension is
// seeded in the past, so the lapsed branch is a real negative control rather than an absence.
//
// Nothing else in this suite seeds an evergreen workshop — the dialog's trigger only renders when
// evergreenWorkshop === true AND evergreenWorkshopMeta.workshopDays > 0.
// =============================================================================================
test.describe('Workshop dashboard — evergreen Extended Participants: days remaining', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    guard = attachConsoleGuard(page);
    await alignWorkshopMetadataNames();
    await seedEvergreenExtended();
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    await clearEvergreenExtended();
    assertNoFatal(guard, 'evergreen extended timeline: no fatal console errors');
  });

  test('WS-49 each extended profile shows how many days are left, and a lapsed one reads Expired', async ({ page }) => {
    expect(WS_EVERGREEN_DAYS_LEFT, 'WS-49: the seeded day count resolves').toBeGreaterThan(1);

    await loginAsWshopAdmin(page);
    await page.goto(`/workshop_dashboard/${wsEvergreenIds.WORKSHOP}`, { waitUntil: 'domcontentloaded' });

    // The Extended node only renders when the app actually bucketed somebody as extended.
    const openBtn = page.getByTestId('wd-open-extended-timeline-26');
    await expect(openBtn, 'WS-49: the Extended node renders for an evergreen workshop').toBeVisible({ timeout: 90_000 });
    await expect(openBtn, 'WS-49: it counts both extended participants').toContainText('2');
    await openBtn.click();

    const cards = page.locator('.ext-dialog .ext-card');
    await expect(cards, 'WS-49: both extended participants are listed').toHaveCount(2, { timeout: 30_000 });

    // [ASSERT] the still-running extension reads the app-computed day count. The name arrives from
    // the metadata map, which lags on a slow emulator, so wait for the card before reading its pill.
    const activeCard = cards.filter({ hasText: wsMetaNames.p0 });
    await expect(activeCard, 'WS-49: the active participant has a card').toHaveCount(1, { timeout: 60_000 });
    await expect(activeCard.getByTestId('et-days-left-5'), `WS-49: the app computed ${WS_EVERGREEN_DAYS_LEFT} days left`)
      .toHaveText(`${WS_EVERGREEN_DAYS_LEFT} days left`, { timeout: 30_000 });

    // [ASSERT] the lapsed one reads Expired rather than a negative number of days.
    const lapsedCard = cards.filter({ hasText: wsMetaNames.p1 });
    await expect(lapsedCard, 'WS-49: the lapsed participant has a card').toHaveCount(1);
    await expect(lapsedCard.getByTestId('et-days-left-5'), 'WS-49: a lapsed extension reads Expired')
      .toHaveText('Expired', { timeout: 30_000 });

    // [ASSERT] the pill is not just text — it is styled differently for the two states, which is
    // what makes the list scannable. Active is not the expired grey.
    const activeBg = await activeCard.getByTestId('et-days-left-5')
      .evaluate(el => getComputedStyle(el).backgroundColor);
    const lapsedBg = await lapsedCard.getByTestId('et-days-left-5')
      .evaluate(el => getComputedStyle(el).backgroundColor);
    expect(activeBg, `WS-49: the two states are told apart visually. active=${activeBg} lapsed=${lapsedBg}`)
      .not.toBe(lapsedBg);
  });
});
