// workshop-live.spec.ts — Workshop Live (operator 2026-11-19): the Live button on /workshops and the live feed of
// completed sub challenges at /workshoplive/:id.
// Plan (the operator's decisions): starlabs-angular specs/plans/2026-11-19-workshop-live.md.
//   WLV-01  The Live button shows on Active rows only — app-only, web-only and EiFlix-mobile-only workshops that are
//           not completed (the green Active chip's rule) — and is hidden on an inactive one, a completed one with
//           every switch off, and a completed one whose switches are still ON (negative control: the button must
//           follow the chip, not "any switch on")
//   WLV-02  Clicking it opens /workshoplive/<that workshop's id> in a NEW tab (the list stays put), headed with the
//           workshop's title and listing its completions (the tab is firewalled and console-guarded from its start)
//   WLV-03  One row per completed sub challenge: name, phone, email, main challenge, sub challenge, completed date
//           and time — for every seeded completion, newest first, the undated one last with "—", the count in the
//           header. Names: existing users from participant metadata, a new user from new_user_data (camelCase
//           country code), "Unknown" + "—" for a person in neither. Challenge names from the CONFIG by id (a drifted
//           copy's stale names never show), the copy's own name for a step the config no longer has, `name` over
//           `heading`, `heading` when there is no name. Never a row: 'finished', 'inreview', a completed zoom call
//           (a main challenge), or a completion on another workshop — each stamped newer than every real one
//   WLV-04  Live: with the page open, the admin SDK completes another step with a newer time → it is the new top row,
//           the count goes up and "Updated" moves, with no reload; then a NEW participant doc (a person not on screen
//           yet) arrives with a completion → it tops the list and the person's name fills in. Each time EXACTLY the new
//           row is highlighted (a MutationObserver records every row that gains the highlight — p1's re-delivered
//           rows must not)
//   WLV-05  An active workshop whose one participant has touched steps but completed none → the empty state
//           ("No completed steps yet", 0 completions), no rows
//   WLV-06  A workshop id with no config doc → the error state ("Couldn't load the live list", the fallback heading,
//           no rows, no Live/count/Updated). The workshop is then created out of band and Retry recovers: its title
//           and its one completion (named from the participant's copy, since its config has no steps)
//   WLV-07  No extra access check (the operator's choice): `limited` — on no workshop admin list and with no grant on
//           this workshop — still sees the Live button and the full feed
//
// Recon: starlabs-angular
//   • src/app/New-Workshop/workshops/workshops.component.html — Actions column: `wor-live` (icon `sensors`, tooltip
//     "Live", *ngIf isActive(workshop) — isActiveWorkshop: not workshopcompleted AND any of active / webactive /
//     eiflixmobileactive), after Dashboard and before Edit; window.open('/workshoplive/' + id, '_blank').
//   • src/app/New-Workshop/workshop-live/workshop-live.component.{ts,html} — ONE onSnapshot on 'participant workshop'
//     where workshopref == doc('workshopconfiguration', id) (includeMetadataChanges); the config read once (title +
//     names); people by profileid from participant metadata, then new_user_data by id for whoever is missing.
//     States: wlive-loading / wlive-error (+ wlive-retry) / wlive-empty / the table of wlive-row. A missing config
//     doc is the error state with the heading "Workshop live". Rows arriving after the first snapshot carry
//     `wlv-row--fresh` for ~3 s. Name/phone/email cells show an empty skeleton until the person's lookup lands.
//   • workshop-live.engine.ts — completed = sub status === 'completed'; newest first, undated last ("—");
//     "+91 9999900000" phones (people-send rule, both spellings of the country code); formatDateTime dates;
//     "N completion(s)"; "Updated hh:mm:ss am".
//
// Hook prefixes: `wor-` (the /workshops list, WorkshopsComponent) and `wlive-` (WorkshopLiveComponent). `wor-live` and
// every `wlive-*` hook are new with this change, so the hub-ahead guard (scripts/readiness/landed-specs.cjs) skips
// this whole FILE on app branches that predate it — which is why these cases are a file of their own and not more
// cases in workshops-list.spec.ts.
//
// THE WORLD (seed-workshops.js + seedLiveWorld in support/wshop.ts; re-seeded before EVERY case, removed in afterAll):
//   LIVE     app switch on → p0 (3 dated completions incl. a step the config dropped, 1 undated), p1 (1 + 1, plus a
//            finished step, an in-review step and a completed zoom call), newUser (new_user_data only; a DRIFTED copy),
//            ghost (in no people collection). 8 completions.
//   EMPTY    web switch only → p0 with finished / in-review steps and a completed zoom call; 0 completions
//   DONE_ON  completed with the app and EiFlix mobile switches still on — the Live button's negative control
//   OTHER    no config doc; p0's NEWEST completion of all sits there, on a step id LIVE's config does not have (and the
//            base seed's PW_A sits on W_DASH)
//   + the base seed's Active Workshop / Inactive Workshop and seedListFilterWorkshops' web-only / mobile-only /
//     completed workshops for WLV-01. The new config docs carry NO testrunid (WS-01 counts exactly three).
//   Actors   admin (full access), limited (no list, no grant on LIVE) — both granted /workshoplive by the seed's ROUTES.
//
// Anti-circularity: what the screen must show is derived by the TEST — the completion table is pinned to what is
// actually in Firestore (the count of completed sub challenges in LIVE's participant docs, read back here), the order
// is the test's own sort of the known instants, dates are formatted in the browser the dashboard's way, people come
// from the test's admin-SDK reads of participant metadata / new_user_data (pinned to wsMetaNames and the seeded
// values), and the button's expected visibility is computed from each workshop doc's flags as read here. The live
// arrivals in WLV-04/06 are out-of-app writes the app must PICK UP; they are stimuli, never read back as results.
import { test, expect, Page } from '@playwright/test';
import {
  wsIds, wsProfileIds, wsMetaNames, wsListFilterIds, wsListFilterTitles,
  installWshopStubs, loginAsWshopAdmin, loginAsWshopLimited, alignWorkshopMetadataNames,
  resetWorkshopInactive, seedListFilterWorkshops, clearListFilterWorkshops,
  wsLive, wsLiveSeededCompletions, wsLiveArrivals, LiveCompletion, LivePersonKey,
  seedLiveWorld, clearLiveWorld, completeLiveQuizForP1, addLiveLateParticipant, createLiveOtherWorkshop,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { installProdFirewall } from '../_shared/prod-firewall';
import { getDoc, queryWhere, db } from '../queue/support/firestore-admin';

const RUN = process.env.WSHOP_RUNID || 'wshop';
const L = wsLive;
const NIL = '—';
const UNKNOWN = 'Unknown';
const FALLBACK_TITLE = 'Workshop live';

// ─── Locators ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A /workshops row by its EXACT title (substring matching would let "Active Workshop" match "Inactive Workshop"). */
const listRow = (page: Page, title: string) =>
  page.locator('table.workshops-table tr.mat-mdc-row, table.workshops-table tr[mat-row]')
    .filter({ has: page.getByText(title, { exact: true }) });

const feedRows = (page: Page) => page.getByTestId('wlive-row');

/** Exactly this text, whitespace-trimmed (a cell holds its value as a bare text node). */
const exactly = (s: string) => new RegExp(`^\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);

// ─── Oracles (admin SDK reads + the test's own sort/format) ───────────────────────────────────────────────────────

interface PersonCells { name: string; phone: string; email: string }

/** The phone as the screen must show it: "+91 9999900000"; the bare number with no code; "—" with no number. */
function phoneCell(d: any): string {
  const s = (v: any) => (v === null || v === undefined ? '' : String(v)).trim();
  const n = s(d?.phonenumber);
  let cc = s(d?.countrycode ?? d?.countryCode);
  if (cc && !cc.startsWith('+')) cc = '+' + cc;
  if (!n) return NIL;
  return cc ? `${cc} ${n.replace(/^\+/, '')}` : n;
}

const profileIdOf = (who: LivePersonKey): string =>
  who === 'p0' ? wsProfileIds.p0 : who === 'p1' ? wsProfileIds.p1 : L.people[who].id;

/**
 * [ORACLE] Who a row names, read from Firestore the way the plan says the screen looks people up: participant
 * metadata first, then new_user_data, else "Unknown" with "—". Each read is pinned to this run's seed, so an oracle
 * can never drift into agreeing with a wrong screen.
 */
async function personOracle(who: LivePersonKey): Promise<PersonCells> {
  const pid = profileIdOf(who);
  const meta: any = await getDoc('participant metadata', pid);
  const fresh: any = meta ? null : await getDoc('new_user_data', pid);
  const d = meta || fresh;
  if (who === 'ghost') {
    expect(d, 'precondition: the ghost is in neither people collection').toBeNull();
    return { name: UNKNOWN, phone: NIL, email: NIL };
  }
  expect(d, `precondition: ${who} has a people record`).toBeTruthy();
  const cells = { name: String(d.name ?? '').trim() || UNKNOWN, phone: phoneCell(d), email: String(d.email ?? '').trim() || NIL };
  if (who === 'p0' || who === 'p1') {
    expect(meta, `precondition: ${who} is an existing user (participant metadata)`).toBeTruthy();
    expect(cells.name, `precondition: ${who}'s CF-owned name`).toBe(wsMetaNames[who]);
    expect(cells.phone, `precondition: ${who}'s phone`).toBe('+91 9999900000');
  } else if (who === 'newUser') {
    expect(meta, 'precondition: the new user has NO participant metadata').toBeNull();
    expect(cells, 'precondition: the new user as seeded (camelCase country code)').toEqual({
      name: L.people.newUser.name, phone: `${L.people.newUser.cc} ${L.people.newUser.phone}`, email: L.people.newUser.email });
  } else if (who === 'late') {
    expect(cells, 'precondition: the late person as seeded').toEqual({
      name: L.people.late.name, phone: `${L.people.late.cc} ${L.people.late.phone}`, email: L.people.late.email });
  }
  return cells;
}

/** Newest first, undated last (equal instants never occur in this world). */
const newestFirst = (rows: LiveCompletion[]) =>
  [...rows].sort((a, b) => (a.at && b.at ? b.at.getTime() - a.at.getTime() : a.at ? -1 : b.at ? 1 : 0));

/** A date as the screen must show it — formatted IN THE BROWSER exactly as the dashboard's formatDateTime does. */
async function whenCell(page: Page, at: Date | null): Promise<string> {
  if (!at) return NIL;
  return page.evaluate((ms) => {
    const d = new Date(ms);
    return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${
      d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }, at.getTime());
}

interface FeedOracle { names: string[]; phones: string[]; emails: string[]; mains: string[]; subs: string[]; whens: string[]; isos: string[] }

async function feedOracle(page: Page, completions: LiveCompletion[]): Promise<FeedOracle> {
  const sorted = newestFirst(completions);
  const people = new Map<LivePersonKey, PersonCells>();
  for (const c of sorted) if (!people.has(c.who)) people.set(c.who, await personOracle(c.who));
  const whens: string[] = [];
  for (const c of sorted) whens.push(await whenCell(page, c.at));
  return {
    names: sorted.map(c => people.get(c.who)!.name),
    phones: sorted.map(c => people.get(c.who)!.phone),
    emails: sorted.map(c => people.get(c.who)!.email),
    mains: sorted.map(c => c.main),
    subs: sorted.map(c => c.sub),
    whens,
    isos: sorted.filter(c => c.at).map(c => c.at!.toISOString()),
  };
}

/** "8 completions", "1 completion". */
const countText = (n: number) => `${n} ${n === 1 ? 'completion' : 'completions'}`;

/**
 * [ORACLE PIN] The completion table the spec expects must match what is really in Firestore: the number of sub
 * challenges with status 'completed' across LIVE's participant workshop docs, read here.
 */
async function completedSubsInFirestore(workshopId: string): Promise<{ docs: number; completed: number }> {
  const ref = db().collection('workshopconfiguration').doc(workshopId);
  const docs: any[] = await queryWhere('participant workshop', [['workshopref', '==', ref]]);
  let completed = 0;
  for (const d of docs) for (const m of (Array.isArray(d.challenges) ? d.challenges : []))
    for (const s of (Array.isArray(m?.challenges) ? m.challenges : [])) if (s?.status === 'completed') completed++;
  return { docs: docs.length, completed };
}

/** Every column of the feed, in order — exact count and order, retried until names and config names land. */
async function expectFeed(page: Page, o: FeedOracle, label: string): Promise<void> {
  await expect(feedRows(page), `${label}: one row per completion`).toHaveCount(o.subs.length, { timeout: 30_000 });
  await expect(page.getByTestId('wlive-sub'), `${label}: sub challenges, newest first`).toHaveText(o.subs, { timeout: 30_000 });
  await expect(page.getByTestId('wlive-main'), `${label}: main challenges`).toHaveText(o.mains);
  await expect(page.getByTestId('wlive-completed-at'), `${label}: completed date and time`).toHaveText(o.whens);
  await expect(page.getByTestId('wlive-name'), `${label}: names (filled in after the lookup)`).toHaveText(o.names, { timeout: 30_000 });
  await expect(page.getByTestId('wlive-phone'), `${label}: phones`).toHaveText(o.phones);
  await expect(page.getByTestId('wlive-email'), `${label}: emails`).toHaveText(o.emails);
  // The machine-readable instant of every dated row (the undated one has no <time>).
  await expect.poll(() => page.getByTestId('wlive-completed-at').locator('time')
    .evaluateAll(els => els.map(e => e.getAttribute('datetime'))), { message: `${label}: <time datetime>` }).toEqual(o.isos);
  await expect(page.getByTestId('wlive-count'), `${label}: the header count`).toHaveText(countText(o.subs.length));
}

async function openLive(page: Page, workshopId: string): Promise<void> {
  await page.goto(`/workshoplive/${workshopId}`, { waitUntil: 'domcontentloaded' });
  await expect(page, 'the live screen is on its own URL')
    .toHaveURL(new RegExp(`/workshoplive/${workshopId}$`), { timeout: 30_000 });
}

test.describe('Workshop Live — the Live button and /workshoplive/:id (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeAll(async () => { await alignWorkshopMetadataNames(); });
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await seedLiveWorld();
  });
  test.afterEach(() => assertNoFatal(guard, 'workshop live: no fatal console errors / pageerrors'));
  test.afterAll(async () => { await clearLiveWorld(); });

  // ===========================================================================================
  // WLV-01 — the Live button follows the Active chip's rule
  // ===========================================================================================
  test('WLV-01 the Live button shows on active rows (app, web or EiFlix mobile) and never on inactive or completed ones', async ({ page }) => {
    await resetWorkshopInactive();
    await seedListFilterWorkshops();
    try {
      const cases: { id: string; title: string; shows: boolean; why: string }[] = [
        { id: wsIds.W_ACTIVE, title: `Active Workshop ${RUN}`, shows: true, why: 'app switch on' },
        { id: wsListFilterIds.WEB, title: wsListFilterTitles.WEB, shows: true, why: 'web switch only' },
        { id: wsListFilterIds.MOBILE, title: wsListFilterTitles.MOBILE, shows: true, why: 'EiFlix mobile switch only' },
        { id: L.LIVE, title: L.titles.LIVE, shows: true, why: 'app switch on (the feed workshop)' },
        { id: wsIds.W_INACTIVE, title: `Inactive Workshop ${RUN}`, shows: false, why: 'every switch off' },
        { id: wsListFilterIds.DONE, title: wsListFilterTitles.DONE, shows: false, why: 'completed, every switch off' },
        { id: L.DONE_ON, title: L.titles.DONE_ON, shows: false, why: 'completed, app + EiFlix mobile switches still ON' },
      ];
      // [ORACLE] each expectation is the Active rule applied to the doc as stored — and must agree with the table.
      for (const c of cases) {
        const d: any = await getDoc('workshopconfiguration', c.id);
        expect(d, `precondition: ${c.title} exists`).toBeTruthy();
        const live = d.workshopcompleted !== true && (d.active === true || d.webactive === true || d.eiflixmobileactive === true);
        expect(live, `precondition: ${c.title} (${c.why}) is ${c.shows ? '' : 'not '}active as stored`).toBe(c.shows);
      }
      const doneOn: any = await getDoc('workshopconfiguration', L.DONE_ON);
      expect([doneOn.workshopcompleted, doneOn.active, doneOn.eiflixmobileactive], 'precondition: DONE_ON is completed with switches on')
        .toEqual([true, true, true]);

      await loginAsWshopAdmin(page);
      await page.goto('/workshops', { waitUntil: 'domcontentloaded' });
      for (const c of cases) {
        const row = listRow(page, c.title);
        await expect(row, `WLV-01: the ${c.title} row renders`).toHaveCount(1, { timeout: 30_000 });
        if (c.shows) {
          await expect(row.getByTestId('wor-live'), `WLV-01: Live button on ${c.title} (${c.why})`).toBeVisible();
          // Same rule as the green chip, so the two never disagree on a row.
          await expect(row.getByTestId('wor-active-chip'), `WLV-01: ${c.title} also has the Active chip`).toHaveText('Active');
        } else {
          await expect(row.getByTestId('wor-live'), `WLV-01: NO Live button on ${c.title} (${c.why})`).toHaveCount(0);
          await expect(row.getByTestId('wor-active-chip'), `WLV-01: ${c.title} has no Active chip either`).toHaveCount(0);
        }
      }
      // Placed after Dashboard and before Edit (Edit renders once the admin's edit right has loaded).
      await expect.poll(() => listRow(page, L.titles.LIVE).locator('button')
        .evaluateAll(els => els.map(e => e.getAttribute('data-testid')).filter(id => id && id.startsWith('wor-')).slice(0, 3)),
      { message: 'WLV-01: Dashboard, then Live, then Edit' }).toEqual(['wor-dashboard-navigation-17', 'wor-live', 'wor-route-18']);
    } finally {
      await clearListFilterWorkshops();
    }
  });

  // ===========================================================================================
  // WLV-02 — the Live button opens the workshop's live feed in a new tab
  // ===========================================================================================
  test('WLV-02 clicking Live opens /workshoplive/<id> in a new tab, headed with the workshop title', async ({ page, context }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/workshops', { waitUntil: 'domcontentloaded' });
    const button = listRow(page, L.titles.LIVE).getByTestId('wor-live');
    await expect(button, 'WLV-02: the Live button renders on the feed workshop').toBeVisible({ timeout: 30_000 });

    // The app opens the tab itself (window.open), and page.route() does not reach it: firewall the whole context
    // BEFORE the click, and guard the new tab from its first message (attached as the context announces it).
    await installProdFirewall(context);
    const tabGuards: ConsoleGuard[] = [];
    const guardTab = (p: Page) => { tabGuards.push(attachConsoleGuard(p)); };
    context.on('page', guardTab);
    const [live] = await Promise.all([
      context.waitForEvent('page'),
      button.click(),
    ]);
    context.off('page', guardTab);
    try {
      expect(tabGuards, 'WLV-02: exactly one new tab, guarded from its start').toHaveLength(1);
      await expect(live, 'WLV-02: the new tab is the live feed of THIS workshop').toHaveURL(new RegExp(`/workshoplive/${L.LIVE}$`), { timeout: 30_000 });
      await expect(page, 'WLV-02: the list stays where it was').toHaveURL(/\/workshops$/);
      await expect(live.getByTestId('wlive-title'), 'WLV-02: headed with the workshop title').toHaveText(L.titles.LIVE, { timeout: 30_000 });
      await expect(live.getByTestId('wlive-row'), 'WLV-02: its completions are listed').toHaveCount(wsLiveSeededCompletions.length, { timeout: 30_000 });
      await expect(live.getByTestId('wlive-live'), 'WLV-02: the Live indicator shows').toBeVisible();
      assertNoFatal(tabGuards[0], 'WLV-02: the new tab raised no fatal console errors');
    } finally {
      await live.close();
    }
  });

  // ===========================================================================================
  // WLV-03 — one row per completed sub challenge, newest first, with the person and the challenge names
  // ===========================================================================================
  test('WLV-03 the feed lists every completed sub challenge newest first, with name, phone, email, challenge names and time', async ({ page }) => {
    // [ORACLE PIN] the table the test expects is what Firestore holds: 4 people, 8 completed sub challenges.
    const store = await completedSubsInFirestore(L.LIVE);
    expect(store, 'precondition: LIVE holds 4 participant docs with 8 completed sub challenges').toEqual({ docs: 4, completed: wsLiveSeededCompletions.length });
    // [PIVOT PIN] the new user's copy really has drifted from the config (stale names, other order).
    const drifted: any = await getDoc('participant workshop', L.pw.newUser);
    expect(drifted.challenges[0].heading, 'precondition: the copy lists Module Two first, under a stale heading').toBe(L.sub.staleMain);
    expect(drifted.challenges[0].challenges.some((s: any) => s.name === L.sub.stale && s.status === 'completed'),
      'precondition: the completed step carries a stale name in the copy').toBe(true);

    await loginAsWshopAdmin(page);
    await openLive(page, L.LIVE);
    const o = await feedOracle(page, wsLiveSeededCompletions);
    await expect(page.getByTestId('wlive-title'), 'WLV-03: the workshop title').toHaveText(L.titles.LIVE, { timeout: 30_000 });
    await expectFeed(page, o, 'WLV-03');

    // Spelled out (each is already implied by the exact lists above):
    expect(o.whens[o.whens.length - 1], 'WLV-03: the oracle puts the undated step last').toBe(NIL);
    const last = feedRows(page).last();
    await expect(last.getByTestId('wlive-sub'), 'WLV-03: the undated completion is the last row').toHaveText(L.sub.bonus);
    await expect(last.getByTestId('wlive-completed-at'), 'WLV-03: …and shows "—" for its time').toHaveText(NIL);
    const ghost = feedRows(page).filter({ has: page.getByTestId('wlive-sub').filter({ hasText: exactly(L.sub.note) }) });
    await expect(ghost.getByTestId('wlive-name'), 'WLV-03: a person in no people collection reads Unknown').toHaveText(UNKNOWN);
    await expect(ghost.getByTestId('wlive-phone')).toHaveText(NIL);
    await expect(ghost.getByTestId('wlive-email')).toHaveText(NIL);
    // Never a row: the drifted copy's stale names, the other workshop's step, 'finished' / 'inreview' steps (p1's
    // First Reflection and Bonus Audio), the completed zoom call.
    await expect(page.getByTestId('wlive-sub').filter({ hasText: L.sub.stale }), 'WLV-03: stale copy name never shows').toHaveCount(0);
    await expect(page.getByTestId('wlive-main').filter({ hasText: L.sub.staleMain }), 'WLV-03: stale main heading never shows').toHaveCount(0);
    await expect(page.getByTestId('wlive-sub').filter({ hasText: L.sub.other }), 'WLV-03: another workshop\'s completion never shows').toHaveCount(0);
    await expect(page.getByTestId('wlive-main').filter({ hasText: 'Live Call' }), 'WLV-03: a completed zoom call is not a sub challenge row').toHaveCount(0);
    const p1Rows = feedRows(page).filter({ has: page.getByTestId('wlive-name').filter({ hasText: exactly(wsMetaNames.p1) }) });
    await expect(p1Rows.getByTestId('wlive-sub'), 'WLV-03: p1 has only their two completions (finished / in review left out)')
      .toHaveText([L.sub.form, L.sub.welcome]);

    // Settled: the header shows Live and an "Updated" clock; no loading / empty / error state is left over.
    await expect(page.getByTestId('wlive-live')).toHaveText(/Live/);
    await expect(page.getByTestId('wlive-updated')).toHaveText(/^Updated \d{2}:\d{2}:\d{2} (am|pm)$/);
    await expect(page.getByTestId('wlive-loading'), 'WLV-03: the loading state is gone once rows render').toHaveCount(0);
    await expect(page.getByTestId('wlive-empty')).toHaveCount(0);
    await expect(page.getByTestId('wlive-error')).toHaveCount(0);
    await expect(page.getByTestId('wlive-retry')).toHaveCount(0);
  });

  // ===========================================================================================
  // WLV-04 — completions written while the page is open arrive live, at the top, without a reload
  // ===========================================================================================
  test('WLV-04 a completion written while the page is open tops the list live; a new person\'s row fills in their name', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openLive(page, L.LIVE);
    const seeded = await feedOracle(page, wsLiveSeededCompletions);
    await expectFeed(page, seeded, 'WLV-04 before');
    await expect(page.locator('tr.wlv-row--fresh'), 'WLV-04: nothing is highlighted on first paint').toHaveCount(0);
    // [PIVOT PIN] the late person is not on screen yet.
    await expect(page.getByTestId('wlive-name').filter({ hasText: L.people.late.name })).toHaveCount(0);

    await page.evaluate(() => { (window as any).__wlvSamePage = 'kept'; });
    // Record every row that GAINS the highlight from here on (a MutationObserver: the ~3 s highlight cannot be missed,
    // and every highlighted row is seen — not just the top one).
    await page.evaluate(() => {
      const w = window as any;
      w.__wlvFresh = [] as string[];
      const note = (el: Element) => {
        if (!el.matches('tr[data-testid="wlive-row"].wlv-row--fresh')) return;
        const key = el.getAttribute('data-key') || '';
        if (!w.__wlvFresh.includes(key)) w.__wlvFresh.push(key);
      };
      new MutationObserver(muts => muts.forEach(m => {
        if (m.type === 'attributes') note(m.target as Element);
        m.addedNodes.forEach(n => {
          if (!(n instanceof Element)) return;
          note(n);
          n.querySelectorAll('tr[data-testid="wlive-row"]').forEach(note);
        });
      })).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    });
    const highlighted = () => page.evaluate(() => [...(window as any).__wlvFresh] as string[]);
    const updatedBefore = (await page.getByTestId('wlive-updated').innerText()).trim();
    // The "Updated" clock has one-second resolution: wait (on the browser's clock) until the second shown has passed.
    const shownSecond = await page.evaluate(() => Math.floor(Date.now() / 1000));
    await expect.poll(() => page.evaluate(() => Math.floor(Date.now() / 1000)),
      { message: 'WLV-04: the browser clock moved past the shown second', intervals: [100] }).toBeGreaterThan(shownSecond);

    // 1) p1 completes another step, newer than everything on screen (out-of-app write = the stimulus). The write
    //    rewrites p1's WHOLE steps list, so p1's other completions are re-delivered with their old times.
    await completeLiveQuizForP1();
    const top = feedRows(page).first();
    await expect(top.getByTestId('wlive-sub'), 'WLV-04: the new completion is the top row').toHaveText(L.sub.quiz, { timeout: 30_000 });
    const quizKey = await top.getAttribute('data-key');
    expect(quizKey, 'WLV-04: the top row carries its key').toBeTruthy();
    await expect.poll(highlighted, { message: 'WLV-04: exactly the new completion was highlighted (not p1\'s re-delivered rows)' })
      .toEqual([quizKey]);
    const afterOne = await feedOracle(page, [wsLiveArrivals.p1Quiz, ...wsLiveSeededCompletions]);
    await expectFeed(page, afterOne, 'WLV-04 after the first arrival');
    await expect(page.getByTestId('wlive-updated'), 'WLV-04: "Updated" moves with the snapshot').not.toHaveText(updatedBefore);
    expect(await page.evaluate(() => (window as any).__wlvSamePage), 'WLV-04: no reload happened').toBe('kept');
    expect(await highlighted(), 'WLV-04: nothing else was highlighted meanwhile').toEqual([quizKey]);

    // 2) Someone not on screen yet gets a participant doc with a completion.
    await page.evaluate(() => { (window as any).__wlvFresh.length = 0; });
    await addLiveLateParticipant();
    await expect(top.getByTestId('wlive-sub'), 'WLV-04: the newcomer\'s completion tops the list').toHaveText(L.sub.welcome, { timeout: 30_000 });
    await expect(top.getByTestId('wlive-name'), 'WLV-04: their name fills in').toHaveText(L.people.late.name, { timeout: 30_000 });
    const lateKey = await top.getAttribute('data-key');
    expect(lateKey, 'WLV-04: the newcomer\'s row is a new row').not.toBe(quizKey);
    await expect.poll(highlighted, { message: 'WLV-04: exactly the newcomer\'s row was highlighted' }).toEqual([lateKey]);
    const afterTwo = await feedOracle(page, [wsLiveArrivals.late, wsLiveArrivals.p1Quiz, ...wsLiveSeededCompletions]);
    await expectFeed(page, afterTwo, 'WLV-04 after the newcomer');
    expect(await page.evaluate(() => (window as any).__wlvSamePage), 'WLV-04: still no reload').toBe('kept');
    expect(await highlighted(), 'WLV-04: still only the newcomer\'s row').toEqual([lateKey]);
  });

  // ===========================================================================================
  // WLV-05 — the empty state: touched steps, none completed
  // ===========================================================================================
  test('WLV-05 an active workshop with no completed step shows the empty state', async ({ page }) => {
    // [PIVOT PIN] EMPTY is not empty of documents — its one participant touched steps, but completed none.
    const store = await completedSubsInFirestore(L.EMPTY);
    expect(store, 'precondition: one participant doc, zero completed sub challenges').toEqual({ docs: 1, completed: 0 });
    const pw: any = await getDoc('participant workshop', L.pw.emptyP0);
    const statuses = pw.challenges.flatMap((m: any) => (m.challenges || []).map((s: any) => s.status));
    expect(statuses, 'precondition: a finished and an in-review step').toEqual(expect.arrayContaining(['finished', 'inreview']));

    await loginAsWshopAdmin(page);
    await openLive(page, L.EMPTY);
    await expect(page.getByTestId('wlive-empty'), 'WLV-05: the empty state').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('wlive-empty')).toContainText('No completed steps yet');
    await expect(page.getByTestId('wlive-title'), 'WLV-05: still headed with the workshop').toHaveText(L.titles.EMPTY);
    await expect(page.getByTestId('wlive-count'), 'WLV-05: zero completions').toHaveText(countText(0));
    await expect(page.getByTestId('wlive-live'), 'WLV-05: still live (a completion would arrive)').toBeVisible();
    await expect(feedRows(page), 'WLV-05: no rows').toHaveCount(0);
    await expect(page.getByTestId('wlive-error')).toHaveCount(0);
    await expect(page.getByTestId('wlive-loading')).toHaveCount(0);
  });

  // ===========================================================================================
  // WLV-06 — a workshop that does not exist: the error state, then Retry once it does
  // ===========================================================================================
  test('WLV-06 a workshop id with no workshop shows the error state, and Retry recovers once the workshop exists', async ({ page }) => {
    expect(await getDoc('workshopconfiguration', L.OTHER), 'precondition: OTHER has no workshop doc').toBeNull();
    const other: any = await getDoc('participant workshop', L.pw.otherP0);
    expect(other?.workshopref?.id, 'precondition: p0 has a completion filed under OTHER').toBe(L.OTHER);

    await loginAsWshopAdmin(page);
    await openLive(page, L.OTHER);
    const error = page.getByTestId('wlive-error');
    await expect(error, 'WLV-06: the error state').toBeVisible({ timeout: 30_000 });
    await expect(error).toContainText("Couldn't load the live list");
    await expect(page.getByTestId('wlive-title'), 'WLV-06: the fallback heading').toHaveText(FALLBACK_TITLE);
    await expect(feedRows(page), 'WLV-06: no rows').toHaveCount(0);
    await expect(page.getByTestId('wlive-empty'), 'WLV-06: not the empty state').toHaveCount(0);
    await expect(page.getByTestId('wlive-live'), 'WLV-06: no Live indicator while failed').toHaveCount(0);
    await expect(page.getByTestId('wlive-count')).toHaveCount(0);
    await expect(page.getByTestId('wlive-updated')).toHaveCount(0);

    // The workshop now exists (title, no steps) → Retry reads it again and listens again.
    await createLiveOtherWorkshop();
    await page.getByTestId('wlive-retry').click();
    await expect(error, 'WLV-06: Retry clears the error').toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByTestId('wlive-title'), 'WLV-06: headed with the workshop now').toHaveText(L.titles.OTHER, { timeout: 30_000 });
    const p0 = await personOracle('p0');
    await expect(feedRows(page), 'WLV-06: its one completion').toHaveCount(1, { timeout: 30_000 });
    // The config has no steps, so both names come from p0's own copy.
    await expect(page.getByTestId('wlive-sub')).toHaveText([L.sub.other]);
    await expect(page.getByTestId('wlive-main')).toHaveText([L.main.one]);
    await expect(page.getByTestId('wlive-completed-at')).toHaveText([await whenCell(page, L.at.otherWorkshop)]);
    await expect(page.getByTestId('wlive-name'), 'WLV-06: the person is named').toHaveText([p0.name], { timeout: 30_000 });
    await expect(page.getByTestId('wlive-count')).toHaveText(countText(1));
  });

  // ===========================================================================================
  // WLV-07 — no extra access check: anyone the route admits sees the button and the feed
  // ===========================================================================================
  test('WLV-07 limited (no admin list, no grant on the workshop) still sees the Live button and the full feed', async ({ page }) => {
    const settings: any = await getDoc('workshopsettings', L.LIVE);
    expect(settings, 'precondition: LIVE has no per-workshop access doc (limited holds no grant there)').toBeNull();

    await loginAsWshopLimited(page);
    await page.goto('/workshops', { waitUntil: 'domcontentloaded' });
    await expect(listRow(page, L.titles.LIVE).getByTestId('wor-live'), 'WLV-07: the Live button is not gated')
      .toBeVisible({ timeout: 30_000 });
    await openLive(page, L.LIVE);
    await expect(feedRows(page), 'WLV-07: the full feed').toHaveCount(wsLiveSeededCompletions.length, { timeout: 30_000 });
    await expect(page.getByTestId('wlive-error')).toHaveCount(0);
  });
});
