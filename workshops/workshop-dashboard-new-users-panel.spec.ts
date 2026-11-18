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
// Hooks: `wd-*` / `wdash-*` (one component: workshop-dashboard.component.html). No new hooks. The panel heading
// `wdash-panel-heading` and the panel count are from the 2026-11-17 redesign, so the hub-ahead guard
// (scripts/readiness/landed-specs.cjs) skips this FILE on app branches without them. That is why these cases are not
// in workshop-dashboard-new-exist.spec.ts: there they would make the guard skip WNE-01..11 too.
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
import { test, expect, Page } from '@playwright/test';
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
});
