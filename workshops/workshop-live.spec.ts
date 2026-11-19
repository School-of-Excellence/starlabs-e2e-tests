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
// Addition (the plan's last section, "Addition: pagination and search" — browser-side only, data loading unchanged):
//   WLV-08  20 rows a page, newest first: with 26 completions page 1 is exactly the 20 newest ("Page 1 of 2",
//           "Showing 1–20 of 26", Previous disabled); Next shows the 6 oldest (oldest last, "Showing 21–26 of 26", Next
//           disabled); Previous returns to page 1. The header count stays the whole feed. (WLV-03's 8 rows: no pager.)
//   WLV-09  Search by name, phone or email — case-insensitive and partial — shows exactly the matching person's
//           completions from EVERY page, newest first, and typing goes back to page 1: "CREW" (four people's emails,
//           21 rows → still two pages) typed on page 2 lands on page 1, and typing on (same 21 rows) from its page 2
//           lands on page 1 again; part of a name in mixed case ("qUINla"), part of an email ("ZENITH.Chen", the
//           new_user_data person), phone digits in other formats ("+91 91234-56780", "4123 45678"). The box's clear
//           button empties it and restores the full list on page 1
//   WLV-10  A search that matches nobody → "No completions match your search", no rows, no pager (not the empty
//           state); a challenge name is not searched (it matches nobody too); the no-match "Clear search" empties
//           the box and restores the full list on page 1
//   WLV-11  Live with pages: from exactly 20 completions (one page, no pager) an admin-SDK completion newer than all
//           tops page 1 and the pager appears ("Page 1 of 2", "Showing 1–20 of 21"); a second one on page 1 tops it
//           again and the total goes up; on page 2 a third one keeps the user on page 2 while its range and rows move
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
//   • Addition (pagination and search): in the ready state, `wlive-search` (the input; matches the person's name or
//     email in any case and part, or the term's digits within the phone's digits — spaces, "+", "-" ignored) with
//     `wlive-search-clear` inside it while it holds text; `wlive-no-match` ("No completions match your search") with
//     `wlive-no-match-clear` ("Clear search") when a search keeps nothing; `wlive-pager` only with more than one page,
//     holding `wlive-range` ("Showing A–B of N", an en dash; N = the searched rows), `wlive-prev` / `wlive-next`
//     (disabled at either end) and `wlive-page` ("Page X of Y"). Typing (a changed term) and either clear go to page
//     1; a live snapshot keeps the page (clamped to the last one). `wlive-count` stays the count of ALL completions.
//
// Hook prefixes: `wor-` (the /workshops list, WorkshopsComponent) and `wlive-` (WorkshopLiveComponent). `wor-live` and
// every `wlive-*` hook are new with this change, so the hub-ahead guard (scripts/readiness/landed-specs.cjs) skips
// this whole FILE on app branches that predate it — which is why these cases are a file of their own and not more
// cases in workshops-list.spec.ts. The addition's hooks (all `wlive-`, driven by WLV-08..11): wlive-search,
// wlive-search-clear, wlive-no-match, wlive-no-match-clear, wlive-pager, wlive-prev, wlive-next, wlive-page,
// wlive-range — they land with the live screen itself, in the same app change.
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
//   PAGED    (WLV-08..11 only: seedLivePagedWorld, removed in afterAll) app switch on, LIVE's steps; 26 completions by
//            five people with distinct names / emails / phones, one a day (completion i = person i % 5's sub ⌊i / 5⌋),
//            so each person has rows on both pages. Four people in participant metadata, one (Chen) only in
//            new_user_data; nobody has profile_data, so no CF rewrites a name. Four emails carry "crew", Emil's
//            does not. Farah (metadata only) is WLV-11's live arrival; seedLivePagedWorld(20) seeds just the 20 oldest.
//   Actors   admin (full access), limited (no list, no grant on LIVE) — both granted /workshoplive by the seed's ROUTES.
//
// Anti-circularity: what the screen must show is derived by the TEST — the completion table is pinned to what is
// actually in Firestore (the count of completed sub challenges in LIVE's participant docs, read back here), the order
// is the test's own sort of the known instants, dates are formatted in the browser the dashboard's way, people come
// from the test's admin-SDK reads of participant metadata / new_user_data (pinned to wsMetaNames and the seeded
// values), and the button's expected visibility is computed from each workshop doc's flags as read here. The live
// arrivals in WLV-04/06/11 are out-of-app writes the app must PICK UP; they are stimuli, never read back as results.
// Pages and searches (WLV-08..11): the expected rows are the test's own newest-first sort of PAGED's seeded instants,
// sliced 20 at a time by the test; each search's expected people are DECLARED here and pinned against the seeded
// names / emails / phones (the term occurs in exactly those people's field and in nobody's other fields); the pager
// texts are the test's arithmetic on those counts — nothing is read off the page to build an expectation.
import { test, expect, Page } from '@playwright/test';
import {
  wsIds, wsProfileIds, wsMetaNames, wsListFilterIds, wsListFilterTitles,
  installWshopStubs, loginAsWshopAdmin, loginAsWshopLimited, alignWorkshopMetadataNames,
  resetWorkshopInactive, seedListFilterWorkshops, clearListFilterWorkshops,
  wsLive, wsLiveSeededCompletions, wsLiveArrivals, LiveCompletion, LivePersonKey,
  seedLiveWorld, clearLiveWorld, completeLiveQuizForP1, addLiveLateParticipant, createLiveOtherWorkshop,
  wsLivePaged, wsLivePagedCompletions, wsLivePagedArrivals, PagedCompletion, PagedPersonKey,
  seedLivePagedWorld, addLivePagedArrivals, clearLivePagedWorld,
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
const newestFirst = <C extends { at: Date | null }>(rows: readonly C[]): C[] =>
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
  return rowsOracle(page, completions, personOracle);
}

/** The rows as the screen must show them, in the given order after the newest-first sort; people via `personOf`. */
async function rowsOracle<K extends string>(
  page: Page, completions: readonly { who: K; main: string; sub: string; at: Date | null }[],
  personOf: (who: K) => Promise<PersonCells>,
): Promise<FeedOracle> {
  const sorted = newestFirst(completions);
  const people = new Map<K, PersonCells>();
  for (const c of sorted) if (!people.has(c.who)) people.set(c.who, await personOf(c.who));
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
  await expectRows(page, o, label);
  await expect(page.getByTestId('wlive-count'), `${label}: the header count`).toHaveText(countText(o.subs.length));
}

/** Every column of the rows on screen (the feed, or one page of it), in order; no header-count check. */
async function expectRows(page: Page, o: FeedOracle, label: string): Promise<void> {
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
}

async function openLive(page: Page, workshopId: string): Promise<void> {
  await page.goto(`/workshoplive/${workshopId}`, { waitUntil: 'domcontentloaded' });
  await expect(page, 'the live screen is on its own URL')
    .toHaveURL(new RegExp(`/workshoplive/${workshopId}$`), { timeout: 30_000 });
}

// ─── PAGED (WLV-08..11): 20 rows a page, and the search ───────────────────────────────────────────────────────────

const PG = wsLivePaged;
/** Rows a page — the plan's number ("show 20 1st"), not read from the app. */
const PAGE_SIZE = 20;

/**
 * [ORACLE] A PAGED person as a row must show them: their record read back from Firestore, pinned to the seeded values
 * (nobody on PAGED has profile_data, so no CF renames them) and to the ONE people collection they were put in.
 */
async function pagedPersonOracle(who: PagedPersonKey): Promise<PersonCells> {
  const p = PG.people[who];
  const meta: any = await getDoc('participant metadata', p.id);
  const fresh: any = await getDoc('new_user_data', p.id);
  const [d, other] = p.source === 'metadata' ? [meta, fresh] : [fresh, meta];
  expect(d, `precondition: ${who} is in ${p.source}`).toBeTruthy();
  expect(other, `precondition: ${who} is in no other people collection`).toBeNull();
  if (p.source === 'metadata') expect(d.profileid, `precondition: ${who}'s metadata carries their profileid`).toBe(p.id);
  const cells = { name: String(d.name ?? '').trim(), phone: phoneCell(d), email: String(d.email ?? '').trim() };
  expect(cells, `precondition: ${who} as seeded`).toEqual({ name: p.name, phone: `${p.cc} ${p.phone}`, email: p.email });
  return cells;
}

/** Page `n` (1-based) of the rows, newest first — the test's own sort and slice. */
const pageOf = (rows: readonly PagedCompletion[], n: number): PagedCompletion[] =>
  newestFirst(rows).slice((n - 1) * PAGE_SIZE, n * PAGE_SIZE);

/** The pager on page `n` of `total` rows: "Showing A–B of N" (en dash), "Page X of Y", the ends disabled. */
async function expectPager(page: Page, n: number, total: number, label: string): Promise<void> {
  const pages = Math.ceil(total / PAGE_SIZE);
  const from = (n - 1) * PAGE_SIZE + 1;
  const to = Math.min(n * PAGE_SIZE, total);
  await expect(page.getByTestId('wlive-pager'), `${label}: the pagination bar`).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('wlive-range'), `${label}: the range`).toHaveText(`Showing ${from}–${to} of ${total}`, { timeout: 30_000 });
  await expect(page.getByTestId('wlive-page'), `${label}: the page`).toHaveText(`Page ${n} of ${pages}`);
  const prev = page.getByTestId('wlive-prev');
  const next = page.getByTestId('wlive-next');
  if (n === 1) await expect(prev, `${label}: Previous is disabled on page 1`).toBeDisabled();
  else await expect(prev, `${label}: Previous is enabled`).toBeEnabled();
  if (n === pages) await expect(next, `${label}: Next is disabled on the last page`).toBeDisabled();
  else await expect(next, `${label}: Next is enabled`).toBeEnabled();
}

/**
 * Page `n` of `rows` on screen: every column of exactly that slice, plus the pager — or, when the rows fit on one
 * page, NO pagination bar at all.
 */
async function expectPagedView(page: Page, rows: readonly PagedCompletion[], n: number, label: string): Promise<void> {
  if (rows.length > PAGE_SIZE) await expectPager(page, n, rows.length, label);
  else {
    expect(n, `${label}: the oracle asks for page 1 of a single page`).toBe(1);
    await expect(page.getByTestId('wlive-pager'), `${label}: ${rows.length} rows fit on one page — no pagination bar`).toHaveCount(0, { timeout: 30_000 });
  }
  await expectRows(page, await rowsOracle(page, pageOf(rows, n), pagedPersonOracle), label);
  await expect(page.getByTestId('wlive-no-match'), `${label}: not the no-match state`).toHaveCount(0);
}

type SearchField = 'name' | 'email' | 'phone';
interface PagedSearch { term: string; field: SearchField; who: PagedPersonKey[] }
const digitsOf = (s: string) => s.replace(/\D+/g, '');

/**
 * [PIVOT PIN] A search's expected people, DECLARED by the test, checked against the seeded people of PAGED: the term
 * occurs in exactly `who`'s `field` (case-insensitive; for a phone, its digits within the shown number's digits) and
 * in no other field of anyone — so the rows a search keeps can only be explained by that field.
 */
function pinSearch(s: PagedSearch): void {
  const holds = (k: PagedPersonKey, f: SearchField): boolean => {
    const p = PG.people[k];
    if (f === 'phone') return !!digitsOf(s.term) && digitsOf(`${p.cc} ${p.phone}`).includes(digitsOf(s.term));
    return (f === 'name' ? p.name : p.email).toLowerCase().includes(s.term.toLowerCase());
  };
  for (const f of ['name', 'email', 'phone'] as SearchField[]) {
    expect(PG.order.filter(k => holds(k, f)), `precondition: "${s.term}" in the ${f} of exactly ${f === s.field ? s.who.join(', ') : 'nobody'}`)
      .toEqual(f === s.field ? s.who : []);
  }
}

/** The completions a search must keep: the declared people's, from the whole feed. */
const keptBy = (s: PagedSearch, rows: readonly PagedCompletion[]) => rows.filter(c => s.who.includes(c.who));

test.describe('Workshop Live — the Live button and /workshoplive/:id (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeAll(async () => { await alignWorkshopMetadataNames(); });
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await seedLiveWorld();
  });
  test.afterEach(() => assertNoFatal(guard, 'workshop live: no fatal console errors / pageerrors'));
  test.afterAll(async () => { await Promise.all([clearLiveWorld(), clearLivePagedWorld()]); });

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
    // The addition: 8 rows fit on one page, so there is no pagination bar; the search box is there, empty.
    await expect(page.getByTestId('wlive-pager'), 'WLV-03: 8 rows fit on one page — no pagination bar').toHaveCount(0);
    await expect(page.getByTestId('wlive-search'), 'WLV-03: the search box, empty').toHaveValue('');
    await expect(page.getByTestId('wlive-no-match')).toHaveCount(0);
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

  // ===========================================================================================
  // WLV-08 — 20 rows a page, newest first, Previous / Next disabled at either end
  // ===========================================================================================
  test('WLV-08 page 1 is the 20 newest completions; Next shows the oldest ones and Previous comes back, each disabled at its end', async ({ page }) => {
    await seedLivePagedWorld();
    const all = wsLivePagedCompletions;
    // [ORACLE PIN] what the two pages must add up to is what Firestore holds: 5 people, 26 completed sub challenges.
    expect(await completedSubsInFirestore(PG.ID), 'precondition: PAGED holds 5 participant docs with 26 completed sub challenges')
      .toEqual({ docs: 5, completed: all.length });
    expect(all.length, 'precondition: 26 completions — a full page and 6 more').toBe(26);
    expect(new Set(all.map(c => c.at.getTime())).size, 'precondition: every completion has its own instant (a total order)').toBe(all.length);

    await loginAsWshopAdmin(page);
    await openLive(page, PG.ID);
    await expect(page.getByTestId('wlive-title'), 'WLV-08: the workshop title').toHaveText(PG.title, { timeout: 30_000 });

    // Page 1 — the 20 newest.
    await expectPagedView(page, all, 1, 'WLV-08 page 1');
    await expect(page.getByTestId('wlive-range'), 'WLV-08: spelled out').toHaveText('Showing 1–20 of 26');
    await expect(page.getByTestId('wlive-page')).toHaveText('Page 1 of 2');
    await expect(page.getByTestId('wlive-prev')).toHaveText('Previous');
    await expect(page.getByTestId('wlive-next')).toHaveText('Next');
    await expect(page.getByTestId('wlive-count'), 'WLV-08: the header counts the whole feed, not the page').toHaveText(countText(all.length));
    await expect(page.getByTestId('wlive-search'), 'WLV-08: no search yet').toHaveValue('');

    // Next — the 6 oldest, the oldest last.
    await page.getByTestId('wlive-next').click();
    await expectPagedView(page, all, 2, 'WLV-08 page 2');
    await expect(page.getByTestId('wlive-range'), 'WLV-08: spelled out').toHaveText('Showing 21–26 of 26');
    await expect(page.getByTestId('wlive-page')).toHaveText('Page 2 of 2');
    const oldest = newestFirst(all)[all.length - 1];
    expect(oldest, 'WLV-08: the oracle\'s oldest is the first seeded completion').toBe(all[0]);
    await expect(feedRows(page).last().getByTestId('wlive-completed-at'), 'WLV-08: the oldest completion is the last row')
      .toHaveText(await whenCell(page, oldest.at));
    await expect(page.getByTestId('wlive-count'), 'WLV-08: still the whole feed').toHaveText(countText(all.length));

    // Previous — page 1 again.
    await page.getByTestId('wlive-prev').click();
    await expectPagedView(page, all, 1, 'WLV-08 back on page 1');
  });

  // ===========================================================================================
  // WLV-09 — search by part of a name, an email or a phone; typing goes back to page 1; clear restores
  // ===========================================================================================
  test('WLV-09 searching part of a name, an email or a phone (any format) keeps exactly that person\'s completions, newest first, from page 1', async ({ page }) => {
    await seedLivePagedWorld();
    const all = wsLivePagedCompletions;
    const crew: PagedSearch = { term: 'CREW', field: 'email', who: ['asha', 'meera', 'chen', 'dora'] };
    const crewOn: PagedSearch = { ...crew, term: 'CREW.' };
    const singles: PagedSearch[] = [
      { term: 'qUINla', field: 'name', who: ['meera'] },                 // part of a name, mixed case
      { term: 'ZENITH.Chen', field: 'email', who: ['chen'] },            // part of an email (a new_user_data person)
      { term: '+91 91234-56780', field: 'phone', who: ['dora'] },        // the whole number, with "+", code and a dash
      { term: '4123 45678', field: 'phone', who: ['emil'] },             // digits with a space, no code
    ];
    for (const s of [crew, crewOn, ...singles]) pinSearch(s);
    expect(keptBy(crew, all).length, 'precondition: "crew" keeps 21 rows — still two pages').toBe(21);
    // [PIVOT PIN] every person has rows on BOTH pages, so a search that looked only at the page on screen would miss some.
    const full = newestFirst(all);
    for (const k of PG.order) {
      expect([full.slice(0, PAGE_SIZE).some(c => c.who === k), full.slice(PAGE_SIZE).some(c => c.who === k)],
        `precondition: ${k} has rows on page 1 and on page 2`).toEqual([true, true]);
    }

    await loginAsWshopAdmin(page);
    await openLive(page, PG.ID);
    await expectPagedView(page, all, 1, 'WLV-09 before');
    // On page 2 first: typing must bring the list back to page 1.
    await page.getByTestId('wlive-next').click();
    await expectPager(page, 2, all.length, 'WLV-09 on page 2');

    const box = page.getByTestId('wlive-search');
    await box.fill(crew.term);
    await expectPagedView(page, keptBy(crew, all), 1, 'WLV-09 "CREW" typed on page 2 → page 1 of the 21 matches');
    await expect(page.getByTestId('wlive-range'), 'WLV-09: spelled out').toHaveText('Showing 1–20 of 21');
    await expect(page.getByTestId('wlive-count'), 'WLV-09: the header still counts the whole feed').toHaveText(countText(all.length));
    await expect(page.getByTestId('wlive-search-clear'), 'WLV-09: the clear button shows while the box holds text').toBeVisible();
    await page.getByTestId('wlive-next').click();
    await expectPagedView(page, keptBy(crew, all), 2, 'WLV-09 "CREW" page 2');
    // Typing on from page 2 — the same 21 rows match — goes back to page 1 again.
    await box.press('End');
    await box.pressSequentially('.');
    await expect(box).toHaveValue(crewOn.term);
    await expectPagedView(page, keptBy(crewOn, all), 1, 'WLV-09 "CREW." typed on page 2 → page 1');

    for (const s of singles) {
      await box.fill(s.term);
      await expectPagedView(page, keptBy(s, all), 1, `WLV-09 "${s.term}" (${s.field}) → ${s.who.join(', ')} only`);
      await expect(page.getByTestId('wlive-name'), `WLV-09 "${s.term}": every row is ${s.who[0]}'s`)
        .toHaveText(keptBy(s, all).map(() => PG.people[s.who[0]].name));
    }

    // The box's clear button: empty box, the full list, page 1.
    await page.getByTestId('wlive-search-clear').click();
    await expect(box, 'WLV-09: the box is empty').toHaveValue('');
    await expect(page.getByTestId('wlive-search-clear'), 'WLV-09: no clear button on an empty box').toHaveCount(0);
    await expectPagedView(page, all, 1, 'WLV-09 cleared → the full list on page 1');
  });

  // ===========================================================================================
  // WLV-10 — a search that matches nobody: the no-match state, and its Clear search
  // ===========================================================================================
  test('WLV-10 a search that matches nobody shows "No completions match your search"; Clear search restores the full list', async ({ page }) => {
    await seedLivePagedWorld();
    const all = wsLivePagedCompletions;
    const nobody = 'zz nobody qx';
    // A challenge name the full list shows on page 1 — but the search reads people's names, phones and emails only.
    const challenge = L.sub.quiz;
    expect(pageOf(all, 1).some(c => c.sub === challenge), `precondition: "${challenge}" rows are on page 1`).toBe(true);
    for (const term of [nobody, challenge]) {
      expect(PG.order.filter(k => `${PG.people[k].name}\n${PG.people[k].email}`.toLowerCase().includes(term.toLowerCase())),
        `precondition: "${term}" is in nobody's name or email`).toEqual([]);
      expect(digitsOf(term), `precondition: "${term}" has no digits to match a phone`).toBe('');
    }

    await loginAsWshopAdmin(page);
    await openLive(page, PG.ID);
    await expectPagedView(page, all, 1, 'WLV-10 before');
    await page.getByTestId('wlive-next').click();
    await expectPager(page, 2, all.length, 'WLV-10 on page 2');

    const box = page.getByTestId('wlive-search');
    const none = page.getByTestId('wlive-no-match');
    for (const term of [nobody, challenge]) {
      await box.fill(term);
      await expect(none, `WLV-10 "${term}": the no-match state`).toBeVisible({ timeout: 30_000 });
      await expect(none).toContainText('No completions match your search');
      await expect(feedRows(page), `WLV-10 "${term}": no rows`).toHaveCount(0);
      await expect(page.getByTestId('wlive-pager'), `WLV-10 "${term}": no pagination bar`).toHaveCount(0);
      await expect(page.getByTestId('wlive-empty'), `WLV-10 "${term}": not the empty state (the workshop has completions)`).toHaveCount(0);
      await expect(page.getByTestId('wlive-count'), `WLV-10 "${term}": the header still counts the whole feed`).toHaveText(countText(all.length));
    }

    const clear = page.getByTestId('wlive-no-match-clear');
    await expect(clear).toHaveText('Clear search');
    await clear.click();
    await expect(box, 'WLV-10: the box is empty').toHaveValue('');
    await expect(none, 'WLV-10: the no-match state is gone').toHaveCount(0);
    await expectPagedView(page, all, 1, 'WLV-10 cleared → the full list on page 1');
  });

  // ===========================================================================================
  // WLV-11 — live arrivals with pages: the pager appears past 20; page 1 gets the new top row; page 2 stays put
  // ===========================================================================================
  test('WLV-11 a live completion tops page 1 (the pager appears past 20) and, on page 2, the user stays on page 2', async ({ page }) => {
    await seedLivePagedWorld(PAGE_SIZE);
    const seeded = wsLivePagedCompletions.slice(0, PAGE_SIZE);
    const [a1, a2, a3] = wsLivePagedArrivals;
    // [ORACLE PIN] exactly one full page in Firestore; Farah (the arrival) has no participant doc yet.
    expect(await completedSubsInFirestore(PG.ID), 'precondition: PAGED holds exactly 20 completions — one full page')
      .toEqual({ docs: 5, completed: PAGE_SIZE });
    expect(await getDoc('participant workshop', PG.pw('farah')), 'precondition: Farah is not on PAGED yet').toBeNull();
    const newestSeeded = Math.max(...seeded.map(c => c.at.getTime()));
    expect([a1.at.getTime() > newestSeeded, a2.at.getTime() > a1.at.getTime(), a3.at.getTime() > a2.at.getTime()],
      'precondition: each arrival is newer than everything before it')
      .toEqual([true, true, true]);
    // [PIVOT PIN] each arrival's sub challenge differs from the top row it displaces, so a top-row check waits for it.
    expect([newestFirst(seeded)[0].sub !== a1.sub, a1.sub !== a2.sub, a2.sub !== a3.sub],
      'precondition: every arrival changes the top row\'s sub challenge').toEqual([true, true, true]);

    await loginAsWshopAdmin(page);
    await openLive(page, PG.ID);
    await expectPagedView(page, seeded, 1, 'WLV-11 20 rows (one page, no pager)');
    await expect(page.getByTestId('wlive-count')).toHaveText(countText(PAGE_SIZE));
    await page.evaluate(() => { (window as any).__wlvSamePage = 'kept'; });
    const top = feedRows(page).first();

    // 1) A 21st completion, on page 1: it is the new top row and the pager appears.
    await addLivePagedArrivals(1);
    let feed = [...seeded, a1];
    await expect(top.getByTestId('wlive-sub'), 'WLV-11: the arrival tops page 1').toHaveText(a1.sub, { timeout: 30_000 });
    await expect(top.getByTestId('wlive-name'), 'WLV-11: the arrival\'s name fills in').toHaveText(PG.people.farah.name, { timeout: 30_000 });
    await expectPagedView(page, feed, 1, 'WLV-11 after the 21st');
    await expect(page.getByTestId('wlive-range'), 'WLV-11: spelled out').toHaveText('Showing 1–20 of 21');
    await expect(page.getByTestId('wlive-page'), 'WLV-11: a second page now').toHaveText('Page 1 of 2');
    await expect(page.getByTestId('wlive-count')).toHaveText(countText(21));

    // 2) Another, still on page 1: on top again, the total goes up.
    await addLivePagedArrivals(2);
    feed = [...seeded, a1, a2];
    await expect(page.getByTestId('wlive-range'), 'WLV-11: the total goes up').toHaveText('Showing 1–20 of 22', { timeout: 30_000 });
    await expect(top.getByTestId('wlive-sub'), 'WLV-11: the second arrival tops page 1').toHaveText(a2.sub);
    await expectPagedView(page, feed, 1, 'WLV-11 after the 22nd');

    // 3) On page 2, a third arrives: the user stays on page 2 while its range and rows move.
    await page.getByTestId('wlive-next').click();
    await expectPagedView(page, feed, 2, 'WLV-11 page 2 before the 23rd');
    await addLivePagedArrivals(3);
    feed = [...seeded, a1, a2, a3];
    await expect(page.getByTestId('wlive-range'), 'WLV-11: still page 2, one more row on it').toHaveText('Showing 21–23 of 23', { timeout: 30_000 });
    await expectPagedView(page, feed, 2, 'WLV-11 page 2 after the 23rd');
    await expect(page.getByTestId('wlive-page'), 'WLV-11: the user stays on page 2').toHaveText('Page 2 of 2');
    await expect(page.getByTestId('wlive-name').filter({ hasText: PG.people.farah.name }), 'WLV-11: the arrivals are not on page 2').toHaveCount(0);
    await expect(page.getByTestId('wlive-count')).toHaveText(countText(23));
    expect(await page.evaluate(() => (window as any).__wlvSamePage), 'WLV-11: no reload happened').toBe('kept');

    // Back to page 1: the newest arrival on top.
    await page.getByTestId('wlive-prev').click();
    await expectPagedView(page, feed, 1, 'WLV-11 back on page 1');
    await expect(top.getByTestId('wlive-sub'), 'WLV-11: the third arrival tops page 1').toHaveText(a3.sub);
  });
});
