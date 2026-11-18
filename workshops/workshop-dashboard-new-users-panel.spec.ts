// workshop-dashboard-new-users-panel.spec.ts — the workshop dashboard's New Users panel lists exactly the people its
// card counts (2026-11-18): the still-new users enrolled on the workshop, each once, never a person moved to a full
// profile, however the panel is reached.
//
// Recon: starlabs-angular src/app/New-Workshop/workshop-dashboard/workshop-dashboard.component.ts. Every writer of the
// New Users list (onMetricClick('totalNewUsers'), the Referred / Subscriber rebuilds in applyFilterSide, then the tag,
// enrollment-date and name filters that only narrow) goes through isNewUserProfile, the same rule as the card count
// totalNewUsersEnrolled. The card counts PEOPLE, so the panel lists one row per person even when a person has two
// enrolled docs on the workshop (WNU-02). The 2026-11-17 "moved person listed in New Users" report came from a WDL-01
// edit that left its membership lines under the Total Enrolled panel (which lists everyone enrolled, correctly).
//
// THE RULE UNDER TEST (workshop-dashboard.component.ts → isNewUserProfile):
//   New   = a still-new user: a new_user_data doc WITHOUT movedtoexist: true.
//   Exist = everyone else — participant metadata people, and new_user_data people marked movedtoexist.
//
// Hooks: `wd-*` / `wdash-*` (one component: workshop-dashboard.component.html — the prefix family declared for it).
// WNU-01/02 add no hooks. WNU-03/04/05 drive the three loading hooks added on 2026-11-18 with the non-blocking load
// (wdash-exist-loading, wdash-new-loading, wdash-new-ne-loading) and the side filter's note `wd-side-filter-wait`
// (New / Exist still loading, or unavailable). The panel heading `wdash-panel-heading`, the panel
// count and those hooks are newer than many app branches, so the hub-ahead guard
// (scripts/readiness/landed-specs.cjs) skips this FILE on app branches without them. That is why these cases are not
// in workshop-dashboard-new-exist.spec.ts: there they would make the guard skip WNE-01..11 too.
//
// LOAD TIME (WNU-03/04, 2026-11-18). new_user_data is a large, growing collection read ONCE (not live). The dashboard
// no longer waits for it: the headline, progress and every other card paint from their own reads, and only the three
// cards that split New from Existing (Existing Participants, New Users, New Users Not Enrolled) show a quiet loading
// state and stay disabled until it lands — or show "—" and stay disabled if the read fails. When it lands, the
// numbers appear, the cards enable, and an already-open panel refreshes its names / New badges in place without
// losing its search. The side panel's New / Exist options need new_user_data too, so they are disabled (with a note)
// until it lands, and for good if it failed — never "New: nobody, Exist: everyone" (2026-11-18 review). The read is
// its own request (a Firestore Lite REST runQuery POST): the tests hold exactly that request with page.route — never
// the shared Listen channel, whose POSTs go one at a time, so holding one stalls every later read. A dropped read is
// tried again twice (after 1s, then 3s) before it counts as failed (WNU-04 sees all three attempts fail; WNU-05 sees
// the first fail and the retry fill the cards in). The 60s deadline for a stalled read is pinned by the app's unit
// tests (retryRead), not here: holding a read for a minute is not worth the run time. PROOF (2026-11-18):
// WNU-03 run against the app that still waited for new_user_data failed at "the Total Enrolled headline shows the
// real figure" (element not found while held); with the non-blocking load it passes.
//
// THE WORLD (seedEnrolledExportCase + tagEnrolledExportCase, on W_DASH):
//   p0     — participant metadata, stamped workshoponly: true (the OLD "New" condition) → Exist
//   moved  — new_user_data with movedtoexist: true and no metadata; enrolled; tagged [dead id, Segment] → Exist
//   NU     — NU Alpha: new_user_data, not moved; enrolled; tagged [Segment, Venue]          → New
//   NU Bravo / NU Charlie — still new and NOT referred (seed-workshops.js); NU Bravo is enrolled and removed while
//            the page is open (WNU-01), NU Charlie is never enrolled (New Users Not Enrolled positive control).
// WNU-01 adds: NU and moved are both "referred, not subscribed" (markNewUsersReferred), written before the page loads
//   (the dashboard reads new_user_data once). Finally the moved person's enrolment is deleted while the page is open
//   (a moved person who is NOT enrolled — the negative control for New Users Not Enrolled).
// WNU-02 adds: a second enrolled doc for NU on W_DASH (enrollNewUserTwice).
// WNU-03/04/05 add nothing: the base world already has a person of each kind (p0 / moved = Existing, NU = New enrolled,
//   NU Bravo / NU Charlie = New not enrolled). The oracle (peopleOracle) reads the figures straight from Firestore.
import { test, expect, Page, Route } from '@playwright/test';
import {
  wsIds, wsProfileIds, installWshopStubs, loginAsWshopAdmin, stampP0Workshoponly,
  seedEnrolledExportCase, clearEnrolledExportCase, tagEnrolledExportCase, wsExportPeople, wsExportIds, wsExportTags,
  setEnrolledTags, enrollSecondNewUser, clearSecondNewUser, wsAddNames, wsAddIds,
  markNewUsersReferred, clearNewUsersReferred, unenrollMovedPerson, enrollNewUserTwice, clearNewUserTwice,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, queryWhere, db } from '../queue/support/firestore-admin';

const cardNames = async (page: Page): Promise<string[]> =>
  (await page.locator('.participant-panel mat-card.participant-card .participant-name').allTextContents()).map(n => n.trim());
const nameOrder = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
const panelNames = async (page: Page) => (await cardNames(page)).sort(nameOrder);

const panelCard = (page: Page, name: string) =>
  page.locator('.participant-panel mat-card.participant-card').filter({ hasText: name });

/** The radios live in a mat-menu that closes after each pick, so open it every time. */
async function pickFilter(page: Page, id: 'wd-side-filter-all' | 'wd-side-filter-new' | 'wd-side-filter-exist'): Promise<void> {
  await page.getByTestId('wd-button-63').click();
  if (id === 'wd-side-filter-all') await page.getByTestId('wd-side-filter-all').click();
  if (id === 'wd-side-filter-new') await page.getByTestId('wd-side-filter-new').click();
  if (id === 'wd-side-filter-exist') await page.getByTestId('wd-side-filter-exist').click();
  if (await page.locator('.mat-mdc-menu-panel').count()) await page.keyboard.press('Escape');
}

/** ORACLE, straight from Firestore: the still-new people (new_user_data without movedtoexist) enrolled on W_DASH, once each. */
async function stillNewEnrolled(): Promise<string[]> {
  const enrolled: any[] = await queryWhere('workshop participant enrolled',
    [['workshopref', '==', db().collection('workshopconfiguration').doc(wsIds.W_DASH)]]);
  const names: string[] = [];
  for (const pid of [...new Set(enrolled.map(e => String(e.profileid)))]) {
    const d: any = await getDoc('new_user_data', pid);
    if (d && d.movedtoexist !== true) names.push(String(d.name));
  }
  return names.sort(nameOrder);
}

/**
 * ORACLE for the figures, straight from Firestore (never from the page). The cards' rules, restated:
 *   totalEnrolled / started = enrolled DOCS on W_DASH (all / status 'enrolled');
 *   existEnrolled  = enrolled DOCS whose person is not still-new (Existing Participants counts docs);
 *   newEnrolled    = still-new PEOPLE enrolled (New Users);  newNotEnrolled = still-new people not enrolled.
 */
async function peopleOracle() {
  const enrolled: any[] = await queryWhere('workshop participant enrolled',
    [['workshopref', '==', db().collection('workshopconfiguration').doc(wsIds.W_DASH)]]);
  const all = await db().collection('new_user_data').get();
  const stillNew = new Set(all.docs.filter((d: any) => d.data()?.movedtoexist !== true).map((d: any) => d.id));
  const enrolledIds = new Set(enrolled.map(e => String(e.profileid)));
  const dash: any = await getDoc('workshopconfiguration', wsIds.W_DASH);
  return {
    totalEnrolled: enrolled.length,
    started: enrolled.filter(e => e.status === 'enrolled').length,
    existEnrolled: enrolled.filter(e => !stillNew.has(String(e.profileid))).length,
    newEnrolled: [...enrolledIds].filter(id => stillNew.has(id)).length,
    newNotEnrolled: [...stillNew].filter(id => !enrolledIds.has(id)).length,
    challenges: Array.isArray(dash?.challenges) ? dash.challenges.length : 0,
  };
}

/**
 * Holds the dashboard's one-time new_user_data read in the browser until the test says so. The read is a REST
 * runQuery POST of its own; only a POST whose structured query reads FROM new_user_data is held — every other
 * request (the Listen channel carrying the dashboard's live reads included) goes straight on. caught() counts the
 * attempts (the app retries a dropped read); release() lets them through, fail() aborts every one (a read that
 * keeps failing), failFirst() aborts only the first and lets the retry through (a dropped connection).
 */
async function holdNewUserDataRead(page: Page) {
  type How = 'release' | 'fail' | 'fail-first';
  let open!: (how: How) => void;
  const gate = new Promise<How>(r => { open = r; });
  let caught = 0;
  const pattern = '**/documents:runQuery**';
  const handler = async (route: Route) => {
    const req = route.request();
    let from = '';
    try { from = String(JSON.parse(req.postData() || '{}')?.structuredQuery?.from?.[0]?.collectionId || ''); } catch { from = ''; }
    if (req.method() !== 'POST' || from !== 'new_user_data') return route.fallback();
    const attempt = ++caught;
    const how = await gate;
    if (how === 'fail' || (how === 'fail-first' && attempt === 1)) return route.abort('failed').catch(() => undefined);
    return route.fallback().catch(() => undefined);
  };
  await page.route(pattern, handler);
  return {
    caught: () => caught,
    release: () => open('release'),
    fail: () => open('fail'),
    failFirst: () => open('fail-first'),
    dispose: () => page.unroute(pattern, handler),
  };
}

/** The Lite SDK logs each aborted request itself ("HTTP error has no status") — expected where a test aborts the read. */
const LITE_ABORT_LOG = /@firebase\/firestore: Firestore \([^)]*_lite\): RPC_ERROR/;

test.describe('Workshop dashboard — the New Users panel lists exactly what its card counts', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await seedEnrolledExportCase();
    await tagEnrolledExportCase();
    await stampP0Workshoponly(true);
  });
  test.afterEach(async () => {
    await stampP0Workshoponly(false);
    await clearEnrolledExportCase();
    assertNoFatal(guard, 'new users panel: no fatal console errors / pageerrors');
  });

  test('WNU-01 New Users lists exactly the still-new enrolled people its card counts — on first open, after other panels, filters, live updates and reopening', async ({ page }) => {
    const { moved, nu } = wsExportPeople;
    const { segment, venue, ghost } = wsExportTags;
    // moved shares the real Segment tag with NU, so a tag pick cannot drop it for the wrong reason.
    await tagEnrolledExportCase([ghost, segment.id]);
    await markNewUsersReferred();
    try {
      const p0Meta: any = await getDoc('participant metadata', wsProfileIds.p0);
      expect(await stillNewEnrolled(), 'WNU-01 oracle: NU is the only still-new person enrolled on the dashboard workshop')
        .toEqual([nu.name]);
      const movedDoc: any = await getDoc('new_user_data', wsExportIds.MOVED);
      expect(movedDoc?.movedtoexist, 'WNU-01 precondition: the moved person is marked moved').toBe(true);
      expect(movedDoc?.refferedby, 'WNU-01 precondition: ...and referred, like NU').toBeTruthy();
      expect(await getDoc('new_user_data', wsProfileIds.p0), 'WNU-01 precondition: p0 has no new_user_data doc').toBeNull();
      const nub: any = await getDoc('new_user_data', wsAddIds.NU_B);
      expect(!!nub && nub.movedtoexist !== true && !nub.refferedby,
        'WNU-01 precondition: NU Bravo is still new and NOT referred (the Referred filter must drop it)').toBe(true);
      const nuc: any = await getDoc('new_user_data', wsAddIds.NU_C);
      expect(!!nuc && nuc.movedtoexist !== true && !nuc.refferedby,
        'WNU-01 precondition: NU Charlie is still new and NOT referred (Not Enrolled positive control)').toBe(true);
      const nuEnrolled: any = await getDoc('workshop participant enrolled', wsExportIds.ENR_NU);

      const newUsersCardN = page.getByTestId('wd-on-metric-click-19').locator('.metric-value');
      const notEnrolledCardN = page.getByTestId('wd-on-metric-click-20').locator('.metric-value');
      const existCardN = page.getByTestId('wdash-exist-users-count');
      const panelN = page.locator('.participant-panel .wdx-pn-count-n');
      const referredBox = page.getByTestId('wd-change-apply-filter-side-67').locator('input[type="checkbox"]');
      const never = [moved.name, p0Meta.name];

      /** The open New Users panel lists exactly `names`, never the moved person or p0, and (unfiltered) its count is the card's. */
      const expectNewUsers = async (step: string, names: string[], unfiltered = true) => {
        await expect(page.getByTestId('wdash-panel-heading'), `${step}: the New Users panel is open`)
          .toHaveText('New Users', { timeout: 30_000 });
        await expect.poll(() => panelNames(page), { message: `${step}: exactly the still-new enrolled people`, timeout: 30_000 })
          .toEqual([...names].sort(nameOrder));
        for (const n of never) await expect(panelCard(page, n), `${step}: never ${n}`).toHaveCount(0);
        await expect(panelN, `${step}: the panel count`).toHaveText(String(names.length));
        if (unfiltered) await expect(newUsersCardN, `${step}: the card counts the same people`).toHaveText(String(names.length));
      };
      const openNewUsers = async () => {
        if (await page.locator('.participant-panel.panel-visible').count()) {
          await page.getByTestId('wd-close-participant-panel-61').click();
        }
        await page.getByTestId('wd-on-metric-click-19').click();
      };

      await loginAsWshopAdmin(page);
      await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });

      // 1) First open, as soon as the card can be clicked. (Not a load-order race guard: on the emulator new_user_data
      //    is tiny and its read leaves first, so it always lands before the cards render.)
      await page.getByTestId('wd-on-metric-click-19').click({ timeout: 45_000 });
      await expectNewUsers('WNU-01 first open', [nu.name]);

      // 2) After Existing Participants (which DOES list the moved person and p0).
      await page.getByTestId('wd-close-participant-panel-61').click();
      await page.getByTestId('wdash-exist-users-card').click();
      await expect(panelCard(page, moved.name), 'WNU-01: Existing Participants lists the moved person').toBeVisible({ timeout: 30_000 });
      await expect(panelCard(page, p0Meta.name), 'WNU-01: ...and p0').toBeVisible();
      await expect(panelCard(page, nu.name), 'WNU-01: ...not the still-new user').toHaveCount(0);
      await expect(panelN, 'WNU-01: Existing Participants count equals its card').toHaveText(((await existCardN.textContent()) || '').trim());
      await openNewUsers();
      await expectNewUsers('WNU-01 after Existing Participants', [nu.name]);

      // 3) After Total Enrolled narrowed to Exist + Segment (only the moved person left in it).
      await page.getByTestId('wd-close-participant-panel-61').click();
      await page.getByTestId('wd-on-metric-click-6').click();
      await expect(panelCard(page, nu.name), 'WNU-01: Total Enrolled opened').toBeVisible({ timeout: 30_000 });
      await pickFilter(page, 'wd-side-filter-exist');
      await page.getByTestId('wd-button-63').click();
      await page.getByTestId('wd-side-tag-option').filter({ hasText: segment.name }).click();
      await page.keyboard.press('Escape');
      await expect.poll(() => panelNames(page), { message: 'WNU-01: Total Enrolled, Exist + Segment = the moved person only' })
        .toEqual([moved.name]);
      await openNewUsers();
      await expectNewUsers('WNU-01 after Total Enrolled (Exist + Segment)', [nu.name]);
      await expect(page.locator('.participant-panel h4', { hasText: /^Filter All/ }), 'WNU-01: New Users opens unfiltered').toBeVisible();

      // 4) New Users' own narrowing filters. Tags: only NU's tags are offered; Segment (which the moved person also
      //    carries) keeps NU only.
      await page.getByTestId('wd-button-65').click();
      await expect(page.getByTestId('wd-side-tag-option'), 'WNU-01: New Users offers its own people\'s tags')
        .toHaveText([segment.name, venue.name], { timeout: 30_000 });
      await page.getByTestId('wd-side-tag-option').filter({ hasText: segment.name }).click();
      await expectNewUsers('WNU-01 tag Segment', [nu.name], false);
      await page.getByTestId('wd-side-tag-clear').click();
      await page.keyboard.press('Escape');
      await expectNewUsers('WNU-01 tags cleared', [nu.name]);
      // Enrollment date: the day NU (and the moved person) enrolled.
      const nuDay = await page.evaluate((t) => {
        const d = new Date(t);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }, nuEnrolled.enrollmentdate.toMillis());
      await page.getByTestId('wd-side-enrolled-from').fill(nuDay);
      await expectNewUsers('WNU-01 enrolled from that day', [nu.name], false);
      await page.getByTestId('wd-side-enrolled-clear').click();
      await expectNewUsers('WNU-01 range cleared', [nu.name]);
      // Name search: the moved person's name finds nobody here; clearing brings NU back.
      await page.getByTestId('wd-side-search-85').fill(moved.name);
      await expectNewUsers('WNU-01 search for the moved person', [], false);
      await page.getByTestId('wd-side-search-clear-86').click();
      await expectNewUsers('WNU-01 search cleared', [nu.name]);

      // 5) Live updates while the page is open: NU Bravo enrols (the card follows), the moved person's enrolment is
      //    touched; the open list never gains the moved person; reopening matches the card again.
      try {
        await enrollSecondNewUser([]);
        await setEnrolledTags(wsExportIds.ENR_MOVED, [segment.id]);
        await expect(newUsersCardN, 'WNU-01: the card follows the new enrolment live').toHaveText('2', { timeout: 30_000 });
        for (const n of never) await expect(panelCard(page, n), `WNU-01 live update, panel open: never ${n}`).toHaveCount(0);
        await openNewUsers();
        await expectNewUsers('WNU-01 reopened after the live update', [nu.name, wsAddNames.nuBravo]);

        // Referred rebuilds the list from EVERY new_user_data doc: NU (referred) stays, NU Bravo (enrolled, not
        // referred) drops — proof the filter ran — and the moved person (referred, enrolled) never comes in.
        await page.getByTestId('wd-button-65').click();
        await expect(referredBox, 'WNU-01: Referred starts unticked').not.toBeChecked({ timeout: 30_000 });
        await page.getByTestId('wd-change-apply-filter-side-67').click();
        await expect(referredBox, 'WNU-01: Referred is ticked').toBeChecked();
        await expect(page.getByTestId('wd-button-65'), 'WNU-01: the filter button shows a filter is set').toHaveClass(/wdx-is-set/);
        await expectNewUsers('WNU-01 Referred on', [nu.name], false);
        await page.getByTestId('wd-change-apply-filter-side-67').click();
        await expect(referredBox, 'WNU-01: Referred is unticked again').not.toBeChecked();
        await expectNewUsers('WNU-01 Referred off', [nu.name, wsAddNames.nuBravo]);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('wd-button-65'), 'WNU-01: no filter set any more').not.toHaveClass(/wdx-is-set/);
      } finally {
        await clearSecondNewUser();
      }
      await expect(newUsersCardN, 'WNU-01: NU Bravo\'s enrolment removed → the card follows').toHaveText('1', { timeout: 30_000 });
      await openNewUsers();
      await expectNewUsers('WNU-01 reopened again', [nu.name]);

      // 6) The moved person's enrolment is deleted while the page is open: a moved person who is NOT enrolled.
      const existBefore = Number(((await existCardN.textContent()) || '').trim());
      await unenrollMovedPerson();
      await expect(existCardN, 'WNU-01: the live update arrived (Existing Participants lost the moved person)')
        .toHaveText(String(existBefore - 1), { timeout: 30_000 });
      await openNewUsers();
      await expectNewUsers('WNU-01 after the moved person left', [nu.name]);
      // New Users Not Enrolled uses the same rule: never the moved person (now not enrolled), NU (enrolled) or p0.
      await page.getByTestId('wd-close-participant-panel-61').click();
      await page.getByTestId('wd-on-metric-click-20').click();
      await expect(page.getByTestId('wdash-panel-heading'), 'WNU-01: the New Users Not Enrolled panel is open')
        .toHaveText('New Users Not Enrolled', { timeout: 30_000 });
      await expect(panelCard(page, wsAddNames.nuCharlie), 'WNU-01: a still-new user who is not enrolled is listed').toBeVisible({ timeout: 30_000 });
      for (const n of [moved.name, nu.name, p0Meta.name]) {
        await expect(panelCard(page, n), `WNU-01 Not Enrolled: never ${n}`).toHaveCount(0);
      }
      await expect(panelN, 'WNU-01: New Users Not Enrolled count equals its card')
        .toHaveText(((await notEnrolledCardN.textContent()) || '').trim());
      // Its Referred rebuild reads every new_user_data doc too. NU Charlie (not referred) drops — proof the filter
      // ran — and the moved, referred, not-enrolled person stays out.
      await page.getByTestId('wd-button-65').click();
      await page.getByTestId('wd-change-apply-filter-side-67').click();
      await expect(referredBox, 'WNU-01 Not Enrolled: Referred is ticked').toBeChecked();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('wd-button-65'), 'WNU-01 Not Enrolled: the filter button shows a filter is set').toHaveClass(/wdx-is-set/);
      await expect(page.locator('.participant-panel h4', { hasText: /^Filter All/ }), 'WNU-01: the Not Enrolled panel is still open').toBeVisible();
      await expect(panelCard(page, wsAddNames.nuCharlie), 'WNU-01 Not Enrolled, Referred: NU Charlie (not referred) drops').toHaveCount(0, { timeout: 30_000 });
      await expect(panelCard(page, wsAddNames.nuBravo), 'WNU-01 Not Enrolled, Referred: NU Bravo (not referred) drops').toHaveCount(0);
      await expect(panelCard(page, moved.name), 'WNU-01 Not Enrolled, Referred: never the moved person').toHaveCount(0);
      await expect(panelCard(page, nu.name), 'WNU-01 Not Enrolled, Referred: never the enrolled NU').toHaveCount(0);
      await expect(panelN, 'WNU-01 Not Enrolled, Referred: the count is what is listed')
        .toHaveText(String((await cardNames(page)).length));
    } finally {
      await clearNewUsersReferred();
    }
  });

  test('WNU-02 a still-new user enrolled twice on the workshop is listed once, and the panel count equals the card', async ({ page }) => {
    const { moved, nu } = wsExportPeople;
    const { segment } = wsExportTags;
    await enrollNewUserTwice();
    try {
      const nuDocs = await queryWhere('workshop participant enrolled', [
        ['workshopref', '==', db().collection('workshopconfiguration').doc(wsIds.W_DASH)],
        ['profileid', '==', wsAddIds.NU_A],
      ]);
      expect(nuDocs.length, 'WNU-02 precondition: NU has two enrolled docs on the dashboard workshop').toBe(2);
      expect(await stillNewEnrolled(), 'WNU-02 oracle: NU is the only still-new person enrolled, once').toEqual([nu.name]);

      const newUsersCardN = page.getByTestId('wd-on-metric-click-19').locator('.metric-value');
      const panelN = page.locator('.participant-panel .wdx-pn-count-n');

      await loginAsWshopAdmin(page);
      await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
      await expect(newUsersCardN, 'WNU-02: the card counts NU once').toHaveText('1', { timeout: 45_000 });
      await page.getByTestId('wd-on-metric-click-19').click();
      await expect(page.getByTestId('wdash-panel-heading'), 'WNU-02: the New Users panel is open')
        .toHaveText('New Users', { timeout: 30_000 });
      await expect.poll(() => panelNames(page), { message: 'WNU-02: NU is listed once', timeout: 30_000 }).toEqual([nu.name]);
      await expect(panelN, 'WNU-02: the panel count equals the card').toHaveText('1');
      await expect(panelCard(page, moved.name), 'WNU-02: never the moved person').toHaveCount(0);

      // A narrowing filter keeps the single row (the tag comes from NU's first enrolled doc).
      await page.getByTestId('wd-button-65').click();
      await page.getByTestId('wd-side-tag-option').filter({ hasText: segment.name }).click();
      await expect.poll(() => panelNames(page), { message: 'WNU-02: tag Segment keeps NU, once' }).toEqual([nu.name]);
      await expect(panelN, 'WNU-02: tag Segment, the count').toHaveText('1');
      await page.getByTestId('wd-side-tag-clear').click();
      await page.keyboard.press('Escape');

      // Reopened, still once.
      await page.getByTestId('wd-close-participant-panel-61').click();
      await page.getByTestId('wd-on-metric-click-19').click();
      await expect.poll(() => panelNames(page), { message: 'WNU-02: reopened, NU is listed once', timeout: 30_000 }).toEqual([nu.name]);
      await expect(panelN, 'WNU-02: reopened, the panel count equals the card').toHaveText('1');
    } finally {
      await clearNewUserTwice();
    }
  });

  test('WNU-03 the dashboard paints while new_user_data is still loading; only the three people cards wait, then fill in — and an open panel catches up without losing its search', async ({ page }) => {
    const { moved, nu } = wsExportPeople;
    const o = await peopleOracle();
    expect(o.newEnrolled, 'WNU-03 oracle: NU is the one still-new person enrolled').toBe(1);
    expect(o.existEnrolled, 'WNU-03 oracle: Existing people are enrolled (p0, p1, the moved person)').toBeGreaterThan(0);
    expect(o.newNotEnrolled, 'WNU-03 oracle: some still-new people are not enrolled (NU Charlie at least)').toBeGreaterThan(0);
    expect(o.challenges, 'WNU-03 oracle: the dashboard workshop has challenges to show progress for').toBeGreaterThan(0);
    expect(await getDoc('participant metadata', wsAddIds.NU_A), 'WNU-03 precondition: NU has no participant metadata, so only new_user_data names them').toBeNull();
    expect(await getDoc('participant metadata', wsExportIds.MOVED), 'WNU-03 precondition: nor does the moved person').toBeNull();

    const existCard = page.getByTestId('wdash-exist-users-card');
    const newCard = page.getByTestId('wd-on-metric-click-19');
    const neCard = page.getByTestId('wd-on-metric-click-20');
    const existLoading = page.getByTestId('wdash-exist-loading');
    const newLoading = page.getByTestId('wdash-new-loading');
    const neLoading = page.getByTestId('wdash-new-ne-loading');
    const panelOpen = page.locator('.participant-panel.panel-visible');
    const panelN = page.locator('.participant-panel .wdx-pn-count-n');
    const search = page.getByTestId('wd-side-search-85');

    await loginAsWshopAdmin(page);
    const hold = await holdNewUserDataRead(page);
    try {
      await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
      await expect.poll(() => hold.caught(), { message: 'WNU-03: the dashboard sends its new_user_data read as its own runQuery request, and it is held', timeout: 45_000 })
        .toBe(1);

      // ── While held ──────────────────────────────────────────────────────────────────────────────────────────
      // 1) The headline and the progress section are up, with real numbers (the load-time regression: they used to
      //    wait for the whole new_user_data read).
      await expect(page.getByTestId('wd-on-metric-click-6').locator('.metric-value'), 'WNU-03 held: the Total Enrolled headline shows the real figure')
        .toHaveText(String(o.totalEnrolled), { timeout: 30_000 });
      await expect(page.getByTestId('wd-on-metric-click-16').locator('.metric-value'), 'WNU-03 held: Total Started shows the real figure')
        .toHaveText(String(o.started));
      await expect(page.locator('#wdx-challenges .cpo-card'), 'WNU-03 held: the challenge progress section lists every challenge')
        .toHaveCount(o.challenges);
      await expect(page.locator('.wdx-hero .wdx-fig', { hasText: 'Average Progress' }).locator('.metric-value'), 'WNU-03 held: Average Progress shows a percentage')
        .toHaveText(/^\d+(\.\d+)?%$/);
      expect(hold.caught(), 'WNU-03: the read is still being held').toBe(1);

      // 2) Only the three people cards wait: loading in place of the number, labelled for screen readers, disabled,
      //    busy, labels and hooks kept.
      for (const [card, loading, label] of [
        [existCard, existLoading, 'Existing Participants'],
        [newCard, newLoading, 'New Users'],
        [neCard, neLoading, 'New Users Not Enrolled'],
      ] as const) {
        await expect(loading, `WNU-03 held: ${label} shows its loading state`).toBeVisible();
        await expect(loading, `WNU-03 held: ${label} loading is announced`).toContainText('Loading');
        await expect(card, `WNU-03 held: ${label} keeps its label`).toContainText(label);
        await expect(card, `WNU-03 held: ${label} is disabled`).toBeDisabled();
        await expect(card, `WNU-03 held: ${label} is marked busy`).toHaveAttribute('aria-busy', 'true');
      }
      await expect(page.getByTestId('wdash-exist-users-label'), 'WNU-03 held: the exist label hook stays').toHaveText('Existing Participants');
      await expect(page.getByTestId('wdash-new-users-label'), 'WNU-03 held: the new users label hook stays').toHaveText('New Users');
      await expect(page.getByTestId('wdash-exist-users-count'), 'WNU-03 held: no Existing figure is guessed').toHaveCount(0);
      await expect(newCard.locator('.metric-value'), 'WNU-03 held: no New Users figure is guessed').toHaveCount(0);
      await expect(neCard.locator('.metric-value'), 'WNU-03 held: no Not Enrolled figure is guessed').toHaveCount(0);
      // A click on a waiting card opens nothing.
      await newCard.click({ force: true });
      await existCard.click({ force: true });
      await expect(panelOpen, 'WNU-03 held: a waiting card opens no panel').toHaveCount(0);

      // 3) Every other card still opens its panel.
      await page.getByTestId('wd-on-metric-click-16').click();
      await expect(page.getByTestId('wdash-panel-heading'), 'WNU-03 held: Total Started opens').toHaveText('Total Started', { timeout: 30_000 });
      await expect(panelN, 'WNU-03 held: Total Started lists its people').toHaveText(String(o.started));
      await page.getByTestId('wd-close-participant-panel-61').click();
      await page.getByTestId('wd-on-metric-click-6').click();
      await expect(page.getByTestId('wdash-panel-heading'), 'WNU-03 held: Total Enrolled opens').toHaveText('Total Enrolled', { timeout: 30_000 });
      await expect(panelN, 'WNU-03 held: Total Enrolled lists everyone enrolled').toHaveText(String(o.totalEnrolled));
      // NU and the moved person are named only by new_user_data: not yet.
      await expect(panelCard(page, nu.name), 'WNU-03 held: NU\'s name is not known yet').toHaveCount(0);
      await expect(page.locator('.participant-panel .new-badge'), 'WNU-03 held: no New badge yet').toHaveCount(0);
      // New / Exist need new_user_data (it decides who is New): while it is out both options are disabled, with a
      // note — never "New: nobody, Exist: everyone". A forced click on New changes nothing: still All, still everyone.
      await page.getByTestId('wd-button-63').click();
      await expect(page.getByTestId('wd-side-filter-wait'), 'WNU-03 held: the filter says New / Exist are still loading').toContainText('loading');
      await expect(page.getByTestId('wd-side-filter-all').locator('input'), 'WNU-03 held: All stays available').toBeEnabled();
      await expect(page.getByTestId('wd-side-filter-new').locator('input'), 'WNU-03 held: New is disabled').toBeDisabled();
      await expect(page.getByTestId('wd-side-filter-exist').locator('input'), 'WNU-03 held: Exist is disabled').toBeDisabled();
      await page.getByTestId('wd-side-filter-new').click({ force: true });
      if (await page.locator('.mat-mdc-menu-panel').count()) await page.keyboard.press('Escape');
      await expect(page.locator('.participant-panel h4', { hasText: /^Filter All/ }), 'WNU-03 held: a click on New picks nothing').toBeVisible();
      await expect(page.locator('.participant-panel h4', { hasText: /^Filter New/ }), 'WNU-03 held: never a "New" heading').toHaveCount(0);
      await expect(panelN, 'WNU-03 held: still everyone enrolled, not "New: nobody"').toHaveText(String(o.totalEnrolled));
      // An active search for NU finds nobody yet.
      await search.fill(nu.name);
      await expect(panelN, 'WNU-03 held: the search for NU finds nobody yet').toHaveText('0');
      expect(hold.caught(), 'WNU-03: still held after all of that').toBe(1);

      // ── Release ─────────────────────────────────────────────────────────────────────────────────────────────
      hold.release();
      for (const loading of [existLoading, newLoading, neLoading]) {
        await expect(loading, 'WNU-03 released: the loading state goes').toHaveCount(0, { timeout: 30_000 });
      }
      await expect(page.getByTestId('wdash-exist-users-count'), 'WNU-03 released: Existing Participants == oracle').toHaveText(String(o.existEnrolled));
      await expect(newCard.locator('.metric-value'), 'WNU-03 released: New Users == oracle').toHaveText(String(o.newEnrolled));
      await expect(neCard.locator('.metric-value'), 'WNU-03 released: New Users Not Enrolled == oracle').toHaveText(String(o.newNotEnrolled));
      for (const card of [existCard, newCard, neCard]) {
        await expect(card, 'WNU-03 released: the card is enabled').toBeEnabled();
        await expect(card, 'WNU-03 released: no longer busy').not.toHaveAttribute('aria-busy', 'true');
      }

      // The Total Enrolled panel opened while held caught up in place: still open, search kept, NU found by name
      // with the New badge — without being reopened.
      await expect(page.getByTestId('wdash-panel-heading'), 'WNU-03 released: the same panel is still open').toHaveText('Total Enrolled');
      await expect(search, 'WNU-03 released: the search survived the refresh').toHaveValue(nu.name);
      await expect.poll(() => panelNames(page), { message: 'WNU-03 released: the search now finds NU by name', timeout: 30_000 })
        .toEqual([nu.name]);
      await expect(panelCard(page, nu.name).locator('.new-badge'), 'WNU-03 released: NU carries the New badge').toBeVisible();
      // New / Exist are available now, and split correctly — with the search still in place, then without it.
      await page.getByTestId('wd-button-63').click();
      await expect(page.getByTestId('wd-side-filter-wait'), 'WNU-03 released: the loading note goes').toHaveCount(0);
      await expect(page.getByTestId('wd-side-filter-new').locator('input'), 'WNU-03 released: New is enabled').toBeEnabled();
      await expect(page.getByTestId('wd-side-filter-exist').locator('input'), 'WNU-03 released: Exist is enabled').toBeEnabled();
      await page.keyboard.press('Escape');
      await pickFilter(page, 'wd-side-filter-new');
      await expect(page.locator('.participant-panel h4', { hasText: /^Filter New/ }), 'WNU-03 released: New is picked').toBeVisible();
      await expect(search, 'WNU-03 released: the pick kept the search').toHaveValue(nu.name);
      await expect.poll(() => panelNames(page), { message: 'WNU-03 released: search + New finds NU' }).toEqual([nu.name]);
      await page.getByTestId('wd-side-search-clear-86').click();
      await expect.poll(() => panelNames(page), { message: 'WNU-03 released: search cleared, New lists the still-new enrolled people only' })
        .toEqual([nu.name]);
      await expect(panelN, 'WNU-03 released: New == oracle').toHaveText(String(o.newEnrolled));
      await pickFilter(page, 'wd-side-filter-exist');
      await expect(panelN, 'WNU-03 released: Exist == oracle').toHaveText(String(o.existEnrolled));
      await expect(panelCard(page, nu.name), 'WNU-03 released: NU is not Exist').toHaveCount(0);
      await expect(panelCard(page, moved.name), 'WNU-03 released: the moved person is Exist').toBeVisible();
      await pickFilter(page, 'wd-side-filter-all');
      await expect(panelN, 'WNU-03 released: All, everyone enrolled again').toHaveText(String(o.totalEnrolled));
      await expect(panelCard(page, moved.name), 'WNU-03 released: the moved person is named now').toBeVisible();
      await expect(panelCard(page, moved.name).locator('.new-badge'), 'WNU-03 released: the moved person is not New').toHaveCount(0);
      await expect(panelCard(page, 'Unknown'), 'WNU-03 released: nobody is left "Unknown"').toHaveCount(0);
      await expect(page.locator('.participant-panel .new-badge'), 'WNU-03 released: exactly one New badge (NU)').toHaveCount(1);

      // The cards now open the right people.
      await page.getByTestId('wd-close-participant-panel-61').click();
      await existCard.click();
      await expect(page.getByTestId('wdash-panel-heading'), 'WNU-03: Existing Participants opens').toHaveText('Existing Participants', { timeout: 30_000 });
      await expect(panelCard(page, moved.name), 'WNU-03: the moved person is under Existing, by their real name').toBeVisible({ timeout: 30_000 });
      await expect(panelCard(page, 'Unknown'), 'WNU-03: never "Unknown"').toHaveCount(0);
      await expect(panelCard(page, nu.name), 'WNU-03: NU is not Existing').toHaveCount(0);
      await expect(panelN, 'WNU-03: Existing Participants lists what its card counts').toHaveText(String(o.existEnrolled));
      await page.getByTestId('wd-close-participant-panel-61').click();
      await newCard.click();
      await expect(page.getByTestId('wdash-panel-heading'), 'WNU-03: New Users opens').toHaveText('New Users', { timeout: 30_000 });
      await expect.poll(() => panelNames(page), { message: 'WNU-03: New Users lists NU', timeout: 30_000 }).toEqual([nu.name]);
      await page.getByTestId('wd-close-participant-panel-61').click();
      await neCard.click();
      await expect(page.getByTestId('wdash-panel-heading'), 'WNU-03: New Users Not Enrolled opens')
        .toHaveText('New Users Not Enrolled', { timeout: 30_000 });
      await expect(panelCard(page, wsAddNames.nuCharlie), 'WNU-03: a still-new person who is not enrolled is listed').toBeVisible({ timeout: 30_000 });
      await expect(panelN, 'WNU-03: New Users Not Enrolled lists what its card counts').toHaveText(String(o.newNotEnrolled));
      expect(hold.caught(), 'WNU-03: new_user_data was read exactly once').toBe(1);
    } finally {
      hold.release();
      await hold.dispose();
    }
  });

  test('WNU-04 if the new_user_data read fails, the three people cards say "—" and stay disabled — never an endless loading state', async ({ page }) => {
    const o = await peopleOracle();
    const existCard = page.getByTestId('wdash-exist-users-card');
    const newCard = page.getByTestId('wd-on-metric-click-19');
    const neCard = page.getByTestId('wd-on-metric-click-20');
    const panelOpen = page.locator('.participant-panel.panel-visible');

    await loginAsWshopAdmin(page);
    const hold = await holdNewUserDataRead(page);
    try {
      await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
      await expect.poll(() => hold.caught(), { message: 'WNU-04: the dashboard sends its new_user_data read as its own runQuery request, and it is held', timeout: 45_000 })
        .toBe(1);
      await expect(page.getByTestId('wdash-new-loading'), 'WNU-04: loading while the read is out').toBeVisible({ timeout: 30_000 });
      hold.fail();

      for (const loading of [page.getByTestId('wdash-exist-loading'), page.getByTestId('wdash-new-loading'), page.getByTestId('wdash-new-ne-loading')]) {
        await expect(loading, 'WNU-04: the loading state ends').toHaveCount(0, { timeout: 30_000 });
      }
      expect(hold.caught(), 'WNU-04: the read was tried three times (two retries) before it counted as failed').toBe(3);
      await expect(page.getByTestId('wdash-exist-users-count'), 'WNU-04: Existing Participants is unavailable').toHaveText('—');
      await expect(newCard.locator('.metric-value'), 'WNU-04: New Users is unavailable').toHaveText('—');
      await expect(neCard.locator('.metric-value'), 'WNU-04: New Users Not Enrolled is unavailable').toHaveText('—');
      for (const card of [existCard, newCard, neCard]) {
        await expect(card, 'WNU-04: the card stays disabled').toBeDisabled();
        await expect(card, 'WNU-04: and is not busy').not.toHaveAttribute('aria-busy', 'true');
      }
      await expect(page.getByTestId('wdash-exist-users-label'), 'WNU-04: labels stay').toHaveText('Existing Participants');
      await newCard.click({ force: true });
      await expect(panelOpen, 'WNU-04: an unavailable card opens no panel').toHaveCount(0);
      // The rest of the dashboard is unaffected.
      await expect(page.getByTestId('wd-on-metric-click-6').locator('.metric-value'), 'WNU-04: the headline is unaffected')
        .toHaveText(String(o.totalEnrolled));
      await page.getByTestId('wd-on-metric-click-6').click();
      await expect(page.getByTestId('wdash-panel-heading'), 'WNU-04: Total Enrolled still opens').toHaveText('Total Enrolled', { timeout: 30_000 });
      await expect(page.locator('.participant-panel .wdx-pn-count-n'), 'WNU-04: Total Enrolled lists everyone').toHaveText(String(o.totalEnrolled));
      // New / Exist cannot be told apart without new_user_data: disabled for good, and the note says so.
      await page.getByTestId('wd-button-63').click();
      await expect(page.getByTestId('wd-side-filter-wait'), 'WNU-04: the filter says New / Exist are unavailable').toContainText('unavailable');
      await expect(page.getByTestId('wd-side-filter-new').locator('input'), 'WNU-04: New stays disabled').toBeDisabled();
      await expect(page.getByTestId('wd-side-filter-exist').locator('input'), 'WNU-04: Exist stays disabled').toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(page.locator('.participant-panel h4', { hasText: /^Filter All/ }), 'WNU-04: still All').toBeVisible();
      // The failure is logged as before — expected here (the test aborted the read), so it is taken off the guard,
      // together with the Firestore Lite SDK's own log line for each aborted attempt (nothing else).
      await expect.poll(() => guard.all.some(m => /Error fetching new_user_data/.test(m)), { message: 'WNU-04: the failed read is logged' }).toBe(true);
      const expectedLogs = [/Error fetching new_user_data/, LITE_ABORT_LOG];
      for (let i = guard.fatals.length - 1; i >= 0; i--) if (expectedLogs.some(re => re.test(guard.fatals[i]))) guard.fatals.splice(i, 1);
    } finally {
      hold.release();
      await hold.dispose();
    }
  });

  test('WNU-05 a dropped new_user_data read is tried again: the three people cards still fill in, and nothing is logged as failed', async ({ page }) => {
    const { moved, nu } = wsExportPeople;
    const o = await peopleOracle();
    const existCard = page.getByTestId('wdash-exist-users-card');
    const newCard = page.getByTestId('wd-on-metric-click-19');
    const neCard = page.getByTestId('wd-on-metric-click-20');

    await loginAsWshopAdmin(page);
    const hold = await holdNewUserDataRead(page);
    try {
      await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
      await expect.poll(() => hold.caught(), { message: 'WNU-05: the new_user_data read is out, and held', timeout: 45_000 }).toBe(1);
      await expect(page.getByTestId('wdash-new-loading'), 'WNU-05: loading while the read is out').toBeVisible({ timeout: 30_000 });
      hold.failFirst();   // the first attempt drops; the retry goes through

      await expect.poll(() => hold.caught(), { message: 'WNU-05: the dropped read is tried again', timeout: 30_000 }).toBe(2);
      for (const loading of [page.getByTestId('wdash-exist-loading'), page.getByTestId('wdash-new-loading'), page.getByTestId('wdash-new-ne-loading')]) {
        await expect(loading, 'WNU-05: the loading state ends').toHaveCount(0, { timeout: 30_000 });
      }
      await expect(page.getByTestId('wdash-exist-users-count'), 'WNU-05: Existing Participants == oracle, not "—"').toHaveText(String(o.existEnrolled));
      await expect(newCard.locator('.metric-value'), 'WNU-05: New Users == oracle').toHaveText(String(o.newEnrolled));
      await expect(neCard.locator('.metric-value'), 'WNU-05: New Users Not Enrolled == oracle').toHaveText(String(o.newNotEnrolled));
      for (const card of [existCard, newCard, neCard]) await expect(card, 'WNU-05: the card is enabled').toBeEnabled();
      await newCard.click();
      await expect(page.getByTestId('wdash-panel-heading'), 'WNU-05: New Users opens').toHaveText('New Users', { timeout: 30_000 });
      await expect.poll(() => panelNames(page), { message: 'WNU-05: New Users lists NU', timeout: 30_000 }).toEqual([nu.name]);
      await expect(panelCard(page, moved.name), 'WNU-05: never the moved person').toHaveCount(0);
      expect(hold.caught(), 'WNU-05: one dropped attempt, one good one — no more').toBe(2);
      // The retry hid the drop: no "Error fetching new_user_data". Only the Lite SDK's own line for the one aborted
      // attempt is expected (taken off the guard; nothing else).
      expect(guard.all.some(m => /Error fetching new_user_data/.test(m)), 'WNU-05: the read is not logged as failed').toBe(false);
      for (let i = guard.fatals.length - 1; i >= 0; i--) if (LITE_ABORT_LOG.test(guard.fatals[i])) guard.fatals.splice(i, 1);
    } finally {
      hold.release();
      await hold.dispose();
    }
  });
});
