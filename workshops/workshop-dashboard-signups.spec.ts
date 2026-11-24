// workshop-dashboard-signups.spec.ts — the workshop dashboard's "New Sign-ups" card and side panel, and the /workshops
// Completed switch saving the completion date (2026-11-21; starlabs-angular specs/plans/2026-11-21-dashboard-new-signups.md).
//   WSU-01  A completed workshop: the card counts the new_user_data docs created from the registration start to the
//           completion date (both inclusive), the window line ends at the completion date with "(completed)", and the
//           panel lists exactly those people, newest sign-up first — the Moved chip only on people moved to existing,
//           the New badge on the rest, each with their sign-up date; search, export (name / email / phone from
//           new_user_data) and the communication buttons work on it; the panel header takes the card's own colour
//   WSU-02  A workshop marked completed BEFORE the date was saved (no completion date) falls back to the planned end:
//           no "(completed)", and the people between the two ends are counted
//   WSU-03  Missing / wrong dates: no registration start, no end at all, start after end → "—", the reason, disabled,
//           opens nothing; a completion date with no planned end is still a window
//   WSU-04  /workshops Completed switch: ON writes workshopcompletedat (a server time inside the test's own before/after
//           bounds) and nothing else, and the OPEN dashboard's window end and count follow it live (no reload); OFF
//           removes the field and the dashboard returns to the planned end
//   WSU-05  Load time: while new_user_data is still loading the card shows the quiet loading bar and is disabled; it
//           fills in from that ONE read (the card adds no request of its own)
//   WSU-06  If the new_user_data read fails, the card says "—" and stays disabled
//   WSU-07  A planned end saved with no time (local midnight) counts the whole end day: noon that day is in, the next
//           midnight is out, and the window line names that day
//   WSU-08  A category-based workshop (no People group of its own) shows the card in a one-card People group, with the
//           same count, window and panel
//
// Recon: starlabs-angular src/app/New-Workshop/
//   • workshops/workshops.component.ts onWorkshopCompletedChange — after the existing confirm, ON writes
//     { workshopcompleted: true, workshopcompletedat: serverTimestamp() }, OFF { workshopcompleted: false,
//     workshopcompletedat: deleteField() }. Only an editor can flip it (admin is one).
//   • workshop-dashboard/ — the window comes from the workshop doc's live listener (detailpage.registrationStartDate;
//     root workshopcompletedat, else detailpage.workshopEndDate); the people from the new_user_data map the dashboard
//     already reads once (readNewUserData, a Firestore Lite runQuery) — no new read. The card sits in the People
//     group; onMetricClick opens the shared side panel (wdash-panel-heading / wdash-panel-title / .wdx-pn-count-n).
//
// Hooks — one prefix family per component, as declared for each:
//   `wdash-*` / `wd-*`  workshop-dashboard.component.html. New with this change (all driven here): wdash-signups-card,
//                       wdash-signups-count, wdash-signups-window, wdash-signups-loading, wdash-signup-moved (the
//                       plan's), and the panel row's wdash-signup-contact / wdash-signup-date (added with them). Reused:
//                       wdash-panel-heading, wdash-panel-title, wd-close-participant-panel-61, wd-side-search-85,
//                       wd-side-search-clear-86, wd-export-participants-62, wd-send-email-to-selected-paricipant-58,
//                       wd-send-watti-59, wd-send-notificationin-breakthrough-60, wdash-exist-users-card,
//                       wd-on-metric-click-19, wd-on-metric-click-20, wdash-new-loading,
//                       wd-on-category-based-metric-click-10 (the category-based layout's Active card).
//   `wor-*`             workshops.component.html. Reused: wor-change-on-workshop-completed-change-16.
// The new hooks are newer than many app branches, so the hub-ahead guard (scripts/readiness/landed-specs.cjs) skips
// this FILE on branches without them — which is why these cases are not added to an existing dashboard spec.
//
// THE WORLD (seedSignupsWorld in support/wshop.ts — its OWN workshops, no testrunid on them; W_DASH is untouched):
//   every date in 2020, so only the seeded new_user_data docs can fall inside a window (the emulator's other docs are
//   created "now" or days ago):
//     DONE         start 10 Mar 2020 09:00 · completed at 15 Apr 2020 17:30 · planned end 20 May 2020 18:00
//     LEGACY       same start and planned end, workshopcompleted: true, NO completion date
//     NOSTART / NOEND / BACKWARDS / DONE_NOPLAN — the date states of WSU-03; SWITCH — WSU-04's own workshop (= LEGACY's
//                  dates, not completed), put back exactly as seeded in WSU-04's finally
//     MIDNIGHT     start 11 Jun 2020 09:00 · planned end 20 Jun 2020 00:00 (no end time picked); CATEGORY — categorybased,
//                  DONE's dates and completion date
//   people (created): before 9 Mar · atStart 10 Mar 09:00 (exactly the start) · movedEarly 25 Mar (moved) · enrolledNew
//     11 Apr (enrolled on DONE) · movedLate 13 Apr (moved) · atCompleted 15 Apr 17:30 (exactly the completion) ·
//     between 28 Apr · atEnd 20 May 18:00 (exactly the planned end) · after 21 May · noCreated (no field) · badCreated
//     ('not a date') · endDayNoon 20 Jun 12:00 · dayAfterEnd 21 Jun 00:00 (MIDNIGHT's two controls)
//   → DONE / DONE_NOPLAN: atCompleted, movedLate, enrolledNew, movedEarly, atStart (between and atEnd are the negative
//     controls for "the completion date wins"); LEGACY / SWITCH: atEnd, between, + those five.
//   Names sort A→Z in neither sign-up order, so "newest first" cannot pass by sorting names.
//
// Anti-circularity: every expected count, name, order, chip and window line is computed here from the docs read back
// with the admin SDK (the plan's rule, restated in signupWindowOf / signupsOracle, independently of the app), and each
// oracle is first pinned to the seeded shape so a wrong seed cannot pass by agreeing with a wrong app. WSU-04's
// completion time is read with the admin SDK and bounded by the test's own clock, never taken from the page.
// Dates on screen are compared as the dashboard formats days (formatDate: en-IN, "07 Nov 2026"), rendered by the test
// browser's own Intl — the plan's "7 Nov 2026" is an example of the wording, not of the zero padding.
// No fixed sleeps: every wait is an expect / poll on a condition.
import { test, expect, Page, Locator, Route } from '@playwright/test';
import { readFileSync } from 'fs';
import {
  installWshopStubs, loginAsWshopAdmin, readCsvRows,
  wsSignups, SignupPersonKey, seedSignupsWorld, clearSignupsWorld, resetSignupSwitchWorkshop,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, queryWhere, pollUntil, db } from '../queue/support/firestore-admin';

const S = wsSignups;
const P = S.people;

// ─── the oracle: the plan's rule, restated ────────────────────────────────────────────────────────────────────────
/**
 * Days as the dashboard writes them (its formatDate: en-IN, 2-digit day, short month, year — "07 Nov 2026"), formatted
 * by the TEST BROWSER's Intl so the viewer's zone and locale data are the app's (as WNE-03 does for formatDateTime).
 * Presentation only: which instants are shown comes from the oracle, never from the page.
 */
const dayLabels = (page: Page, ms: number[]): Promise<string[]> =>
  page.evaluate((ts) => ts.map(t => new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })), ms);

/**
 * A date value as epoch ms: Timestamp, Date, {seconds}, epoch ms, or a date string ('yyyy-mm-dd' is that LOCAL day);
 * anything else → null. Reads every shape the app reads, so a doc outside this world (WSU-04's oracle spans every
 * new_user_data doc since 2020) can never make the oracle and the app disagree on a format.
 */
function toMs(v: any): number | null {
  if (v === null || v === undefined || v === 0 || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000 + Math.floor((Number(v.nanoseconds) || 0) / 1e6);
  if (typeof v === 'object' && typeof v._seconds === 'number') return v._seconds * 1000 + Math.floor((Number(v._nanoseconds) || 0) / 1e6);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
    const [y, m, d] = v.trim().split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? null : t; }
  return null;
}

/** A planned end at local 00:00:00.000 was saved with no time: it means the whole day, to its last millisecond. */
function wholeDayIfNoTime(ms: number): number {
  const d = new Date(ms);
  if (d.getHours() || d.getMinutes() || d.getSeconds() || d.getMilliseconds()) return ms;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

type WinOk = { ok: true; start: number; end: number; completed: boolean };
type Win = WinOk | { ok: false; reason: string };

/**
 * Start = registration start; end = the completion date when set (exact), else the planned end (to the end of that
 * day when it was saved with no time); both inclusive.
 */
function signupWindowOf(w: any): Win {
  const start = toMs(w?.detailpage?.registrationStartDate);
  const completedAt = toMs(w?.workshopcompletedat);
  const plannedRaw = toMs(w?.detailpage?.workshopEndDate);
  const planned = plannedRaw === null ? null : wholeDayIfNoTime(plannedRaw);
  if (start === null) return { ok: false, reason: 'Registration start date is not set' };
  const end = completedAt ?? planned;
  if (end === null) return { ok: false, reason: 'Workshop end date is not set' };
  if (start > end) return { ok: false, reason: 'Dates are not set correctly' };
  return { ok: true, start, end, completed: completedAt !== null };
}
/** The window line (and the panel subtitle): "<start> – <end>", " (completed)" when the end is the completion date. */
async function windowText(page: Page, w: WinOk): Promise<string> {
  const [a, b] = await dayLabels(page, [w.start, w.end]);
  return `${a} – ${b}${w.completed ? ' (completed)' : ''}`;
}

interface SignupPerson { id: string; name: string; email: string; phone: string; moved: boolean; at: number }

/** Every new_user_data doc whose `created` falls inside the workshop's window, newest first (moved people included). */
async function signupsOracle(workshopId: string): Promise<{ win: Win; people: SignupPerson[] }> {
  const w: any = await getDoc('workshopconfiguration', workshopId);
  const win = signupWindowOf(w);
  if (!win.ok) return { win, people: [] };
  const snap = await db().collection('new_user_data').get();
  const people = snap.docs
    .map((d: any) => ({ d, at: toMs(d.data()?.created) }))
    .filter((x: any): x is { d: any; at: number } => x.at !== null && x.at >= win.start && x.at <= win.end)
    .sort((a: any, b: any) => b.at - a.at)
    .map(({ d, at }: any) => {
      const x = d.data() || {};
      return { id: d.id, name: String(x.name ?? ''), email: String(x.email ?? ''), phone: String(x.phonenumber ?? ''), moved: x.movedtoexist === true, at };
    });
  return { win, people };
}

const ids = (keys: SignupPersonKey[]) => keys.map(k => P[k].id);
/** The seeded shape each oracle is pinned to, newest first. */
const DONE_PEOPLE: SignupPersonKey[] = ['atCompleted', 'movedLate', 'enrolledNew', 'movedEarly', 'atStart'];
const PLANNED_PEOPLE: SignupPersonKey[] = ['atEnd', 'between', ...DONE_PEOPLE];

// ─── page helpers ─────────────────────────────────────────────────────────────────────────────────────────────────
async function openDashboard(page: Page, workshopId: string): Promise<void> {
  await page.goto(`/workshop_dashboard/${workshopId}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${workshopId}`), { timeout: 30_000 });
  await expect(page.locator('nav.wdx-nav'), 'the dashboard has loaded').toBeVisible({ timeout: 90_000 });
}

/** new_user_data has landed: the New Users sibling shows a number (not the loading bar, not "—"). */
async function peopleLanded(page: Page, what: string): Promise<void> {
  await expect(page.getByTestId('wdash-new-loading'), `${what}: new_user_data has landed`).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByTestId('wd-on-metric-click-19').locator('.metric-value'), `${what}: the People cards show numbers`)
    .toHaveText(/^\d+$/, { timeout: 30_000 });
}

const panelOpen = (page: Page) => page.locator('.participant-panel.panel-visible');
const panelN = (page: Page) => page.locator('.participant-panel .wdx-pn-count-n');
const panelCard = (page: Page, name: string) =>
  page.locator('.participant-panel mat-card.participant-card').filter({ hasText: name });
const panelNamesInOrder = async (page: Page): Promise<string[]> =>
  (await page.locator('.participant-panel mat-card.participant-card .participant-name').allTextContents()).map(n => n.trim());

/** Open the New Sign-ups panel and check it lists exactly `want`, newest first, with the right chip and date on each. */
async function expectSignupsPanel(page: Page, want: SignupPerson[], win: WinOk, what: string): Promise<void> {
  await page.getByTestId('wdash-signups-card').click();
  await expect(panelOpen(page), `${what}: the side panel opens`).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByTestId('wd-close-participant-panel-61'), `${what}: ...with its close button`).toBeVisible();
  await expect(page.getByTestId('wdash-panel-heading'), `${what}: the panel heading`).toHaveText('New Sign-ups');
  await expect(page.getByTestId('wdash-panel-title'), `${what}: the window is the panel subtitle`).toHaveText(await windowText(page, win));
  await expect(panelN(page), `${what}: the panel count is the card's`).toHaveText(String(want.length));
  await expect.poll(() => panelNamesInOrder(page), { message: `${what}: exactly these people, newest sign-up first`, timeout: 30_000 })
    .toEqual(want.map(p => p.name));
  await expect(page.locator('.participant-panel').getByTestId('wdash-signup-moved'), `${what}: one Moved chip per moved person`)
    .toHaveCount(want.filter(p => p.moved).length);
  const signedUp = await dayLabels(page, want.map(p => p.at));
  for (const [i, p] of want.entries()) {
    const c = panelCard(page, p.name);
    if (p.moved) {
      await expect(c.getByTestId('wdash-signup-moved'), `${what}: ${p.name} is moved to existing`).toHaveText('Moved to existing');
      await expect(c.locator('.new-badge'), `${what}: a moved person has no New badge`).toHaveCount(0);
    } else {
      await expect(c.getByTestId('wdash-signup-moved'), `${what}: ${p.name} is not moved`).toHaveCount(0);
      await expect(c.locator('.new-badge'), `${what}: ${p.name} carries the New badge`).toHaveText('New');
    }
    // Email and phone from new_user_data, then the sign-up date.
    await expect(c.getByTestId('wdash-signup-contact'), `${what}: ${p.name}'s email`).toContainText(p.email);
    await expect(c.getByTestId('wdash-signup-contact'), `${what}: ${p.name}'s phone`).toContainText(p.phone);
    await expect(c.getByTestId('wdash-signup-date'), `${what}: ${p.name}'s sign-up date`).toContainText(signedUp[i]);
  }
}

async function closePanel(page: Page, what: string): Promise<void> {
  await page.getByTestId('wd-close-participant-panel-61').click();
  await expect(page.locator('aside.participant-panel'), `${what}: panel closed`).not.toHaveClass(/panel-visible/);
}

/**
 * Holds the dashboard's one-time new_user_data read (a Firestore Lite REST runQuery POST of its own) until the test
 * says so — the same technique as workshop-dashboard-new-users-panel WNU-03/04. Every other request (the Listen channel
 * with the dashboard's live reads included) goes straight on. caught() counts the attempts (the app retries a dropped
 * read twice); release() lets them through; fail() aborts every one.
 */
async function holdNewUserDataRead(page: Page) {
  type How = 'release' | 'fail';
  let open!: (how: How) => void;
  const gate = new Promise<How>(r => { open = r; });
  let caught = 0;
  const pattern = '**/documents:runQuery**';
  const handler = async (route: Route) => {
    const req = route.request();
    let from = '';
    try { from = String(JSON.parse(req.postData() || '{}')?.structuredQuery?.from?.[0]?.collectionId || ''); } catch { from = ''; }
    if (req.method() !== 'POST' || from !== 'new_user_data') return route.fallback();
    caught++;
    const how = await gate;
    if (how === 'fail') return route.abort('failed').catch(() => undefined);
    return route.fallback().catch(() => undefined);
  };
  await page.route(pattern, handler);
  return {
    caught: () => caught,
    release: () => open('release'),
    fail: () => open('fail'),
    dispose: () => page.unroute(pattern, handler),
  };
}

/** The Lite SDK logs each aborted request itself — expected only where a test aborts the read. */
const LITE_ABORT_LOG = /@firebase\/firestore: Firestore \([^)]*_lite\): RPC_ERROR/;

test.describe('Workshop dashboard — New Sign-ups', () => {
  let guard: ConsoleGuard;
  test.beforeAll(async () => { await seedSignupsWorld(); });
  test.afterAll(async () => { await clearSignupsWorld(); });
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    assertNoFatal(guard, 'new sign-ups: no fatal console errors / pageerrors');
  });

  test('WSU-01 a completed workshop: count and window end at the completion date; the panel lists exactly those people, newest first, Moved chip only on moved people', async ({ page }) => {
    const o = await signupsOracle(S.ids.DONE);
    expect(o.win.ok, 'WSU-01 oracle: DONE has a window').toBe(true);
    const win = o.win as WinOk;
    // Pinned to the seeded shape first.
    expect(win.start, 'WSU-01 oracle: the window starts at the registration start').toBe(S.at.regStart.getTime());
    expect(win.end, 'WSU-01 oracle: ...and ends at the completion date, not the planned end').toBe(S.at.completedAt.getTime());
    expect(win.completed).toBe(true);
    expect(await windowText(page, win)).toBe('10 Mar 2020 – 15 Apr 2020 (completed)');
    const done: any = await getDoc('workshopconfiguration', S.ids.DONE);
    expect(toMs(done?.detailpage?.workshopEndDate), 'WSU-01 precondition: the planned end is AFTER the completion date')
      .toBe(S.at.plannedEnd.getTime());
    expect(o.people.map(p => p.id), 'WSU-01 oracle: both boundaries in, the people after the completion date out')
      .toEqual(ids(DONE_PEOPLE));
    for (const k of ['between', 'atEnd', 'before', 'after', 'noCreated', 'badCreated'] as SignupPersonKey[]) {
      expect(await getDoc('new_user_data', P[k].id), `WSU-01 precondition: the ${k} control exists`).not.toBeNull();
    }
    expect(o.people.filter(p => p.moved).map(p => p.id), 'WSU-01 oracle: two of them are moved to existing')
      .toEqual(ids(['movedLate', 'movedEarly']));
    const enrolled: any[] = await queryWhere('workshop participant enrolled', [['workshopref', '==', db().collection('workshopconfiguration').doc(S.ids.DONE)]]);
    expect(enrolled.map(e => e.profileid), 'WSU-01 precondition: only enrolledNew is enrolled on DONE (enrolment does not matter)')
      .toEqual([P.enrolledNew.id]);

    await loginAsWshopAdmin(page);
    await openDashboard(page, S.ids.DONE);
    const card = page.getByTestId('wdash-signups-card');
    await expect(card, 'WSU-01: the card is titled New Sign-ups').toContainText('New Sign-ups', { timeout: 30_000 });
    await expect(card.locator('xpath=ancestor::section[1]').locator('.wdx-eyebrow'), 'WSU-01: it sits in the People group')
      .toHaveText('People');
    await expect(page.getByTestId('wdash-signups-count'), 'WSU-01: the count').toHaveText(String(o.people.length), { timeout: 60_000 });
    await expect(page.getByTestId('wdash-signups-window'), 'WSU-01: the window, ending at the completion date').toHaveText(await windowText(page, win));
    await expect(card, 'WSU-01: the card can be opened').toBeEnabled();

    // Its own colour token, distinct from its People siblings.
    const toneOf = (el: Locator) => el.evaluate(e => getComputedStyle(e).getPropertyValue('--tone').trim());
    const tone = await toneOf(card);
    expect(tone, 'WSU-01: the card has a colour').not.toBe('');
    const siblings: [string, Locator][] = [
      ['Existing Participants', page.getByTestId('wdash-exist-users-card')],
      ['New Users', page.getByTestId('wd-on-metric-click-19')],
      ['New Users Not Enrolled', page.getByTestId('wd-on-metric-click-20')],
    ];
    for (const [label, sib] of siblings) {
      expect(await toneOf(sib), `WSU-01: its colour is its own (not ${label}'s)`).not.toBe(tone);
    }

    await expectSignupsPanel(page, o.people, win, 'WSU-01');
    // The panel header follows the card's colour.
    await expect.poll(() => page.locator('.participant-panel .wdx-pn-head').evaluate(el => getComputedStyle(el).getPropertyValue('--pn-tone').trim()),
      { message: 'WSU-01: the panel header takes the card\'s colour' }).toBe(tone);

    // The reused panel tools: communication buttons, search, export.
    await expect(page.getByTestId('wd-send-email-to-selected-paricipant-58'), 'WSU-01: email the people listed').toBeVisible();
    await expect(page.getByTestId('wd-send-watti-59'), 'WSU-01: WhatsApp the people listed').toBeVisible();
    await expect(page.getByTestId('wd-send-notificationin-breakthrough-60'), 'WSU-01: app notification').toBeVisible();

    const search = page.getByTestId('wd-side-search-85');
    await search.fill('Omar MovedLate');
    await expect.poll(() => panelNamesInOrder(page), { message: 'WSU-01: search narrows to one person' }).toEqual([P.movedLate.name]);
    await expect(panelN(page), 'WSU-01: search narrows the count').toHaveText('1');
    await page.getByTestId('wd-side-search-clear-86').click();
    await expect.poll(() => panelNamesInOrder(page), { message: 'WSU-01: clearing the search brings everyone back' })
      .toEqual(o.people.map(p => p.name));

    page.once('dialog', (d) => d.accept());   // "export participants as CSV?"
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByTestId('wd-export-participants-62').click(),
    ]);
    const file = test.info().outputPath('new-sign-ups.csv');
    await download.saveAs(file);
    const [header, ...rows] = readCsvRows(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    const col = (h: string) => header.indexOf(h);
    expect(header.slice(0, 3), 'WSU-01 export: the usual leading columns').toEqual(['Participant Name', 'Email', 'Phone']);
    expect(rows.map(r => [r[col('Participant Name')], r[col('Email')], r[col('Phone')]]),
      'WSU-01 export: exactly these people in the panel order, name / email / phone from new_user_data')
      .toEqual(o.people.map(p => [p.name, p.email, p.phone]));

    await closePanel(page, 'WSU-01');
  });

  test('WSU-02 a workshop completed before the date was saved falls back to the planned end', async ({ page }) => {
    const legacy: any = await getDoc('workshopconfiguration', S.ids.LEGACY);
    expect(legacy?.workshopcompleted, 'WSU-02 precondition: marked completed').toBe(true);
    expect(Object.prototype.hasOwnProperty.call(legacy, 'workshopcompletedat'), 'WSU-02 precondition: ...with no completion date').toBe(false);
    const o = await signupsOracle(S.ids.LEGACY);
    expect(o.win.ok, 'WSU-02 oracle: LEGACY has a window').toBe(true);
    const win = o.win as WinOk;
    expect(win.end, 'WSU-02 oracle: the end is the planned end').toBe(S.at.plannedEnd.getTime());
    expect(win.completed).toBe(false);
    expect(await windowText(page, win)).toBe('10 Mar 2020 – 20 May 2020');
    expect(o.people.map(p => p.id), 'WSU-02 oracle: the planned end and the people before it are in, the day after is out')
      .toEqual(ids(PLANNED_PEOPLE));

    await loginAsWshopAdmin(page);
    await openDashboard(page, S.ids.LEGACY);
    await expect(page.getByTestId('wdash-signups-count'), 'WSU-02: the count').toHaveText(String(o.people.length), { timeout: 60_000 });
    await expect(page.getByTestId('wdash-signups-window'), 'WSU-02: the window ends at the planned end').toHaveText(await windowText(page, win));
    await expect(page.getByTestId('wdash-signups-window'), 'WSU-02: the completed flag alone is not a completion date')
      .not.toContainText('(completed)');
    await expectSignupsPanel(page, o.people, win, 'WSU-02');
    await closePanel(page, 'WSU-02');
  });

  test('WSU-03 missing or wrong dates show "—" with the reason and the card stays shut; a completion date without a planned end is still a window', async ({ page }) => {
    test.setTimeout(240_000);
    const cases = [
      { id: S.ids.NOSTART, reason: 'Registration start date is not set' },
      { id: S.ids.NOEND, reason: 'Workshop end date is not set' },
      { id: S.ids.BACKWARDS, reason: 'Dates are not set correctly' },
    ];
    await loginAsWshopAdmin(page);
    for (const c of cases) {
      const o = await signupsOracle(c.id);
      expect(o.win, `WSU-03 oracle (${c.id}): pinned to the seed`).toEqual({ ok: false, reason: c.reason });

      await openDashboard(page, c.id);
      await peopleLanded(page, `WSU-03 (${c.reason})`);
      const card = page.getByTestId('wdash-signups-card');
      await expect(card, `WSU-03 (${c.reason}): the card keeps its title`).toContainText('New Sign-ups');
      await expect(page.getByTestId('wdash-signups-count'), `WSU-03 (${c.reason}): no number`).toHaveText('—');
      await expect(page.getByTestId('wdash-signups-window'), `WSU-03 (${c.reason}): the reason`).toHaveText(c.reason);
      await expect(page.getByTestId('wdash-signups-loading'), `WSU-03 (${c.reason}): not loading`).toHaveCount(0);
      await expect(card, `WSU-03 (${c.reason}): disabled`).toBeDisabled();
      await card.click({ force: true });
      await expect(panelOpen(page), `WSU-03 (${c.reason}): opens nothing`).toHaveCount(0);
    }

    // Only BOTH ends absent is "not set": a completion date with no planned end makes the window.
    const noPlan: any = await getDoc('workshopconfiguration', S.ids.DONE_NOPLAN);
    expect(noPlan?.detailpage?.workshopEndDate, 'WSU-03 precondition: DONE_NOPLAN has no planned end').toBeUndefined();
    const o = await signupsOracle(S.ids.DONE_NOPLAN);
    expect(o.win.ok, 'WSU-03 oracle: DONE_NOPLAN has a window').toBe(true);
    const win = o.win as WinOk;
    expect(await windowText(page, win)).toBe('10 Mar 2020 – 15 Apr 2020 (completed)');
    expect(o.people.map(p => p.id), 'WSU-03 oracle: the same five as DONE').toEqual(ids(DONE_PEOPLE));
    await openDashboard(page, S.ids.DONE_NOPLAN);
    await expect(page.getByTestId('wdash-signups-count'), 'WSU-03 (no planned end): the count').toHaveText(String(o.people.length), { timeout: 60_000 });
    await expect(page.getByTestId('wdash-signups-window'), 'WSU-03 (no planned end): the window ends at the completion date').toHaveText(await windowText(page, win));
    await expect(page.getByTestId('wdash-signups-card'), 'WSU-03 (no planned end): the card opens').toBeEnabled();
  });

  test('WSU-04 the /workshops Completed switch saves the completion date and the open dashboard follows it live; switching it off clears it', async ({ page, context }) => {
    test.setTimeout(240_000);
    const seeded: any = await getDoc('workshopconfiguration', S.ids.SWITCH);
    expect(seeded?.workshopcompleted, 'WSU-04 precondition: SWITCH is not completed').toBe(false);
    expect(Object.prototype.hasOwnProperty.call(seeded, 'workshopcompletedat'), 'WSU-04 precondition: ...and has no completion date').toBe(false);
    const planned = await signupsOracle(S.ids.SWITCH);
    expect(planned.win.ok, 'WSU-04 oracle: SWITCH has a window').toBe(true);
    const plannedWin = planned.win as WinOk;
    expect(await windowText(page, plannedWin), 'WSU-04 oracle: the planned window').toBe('10 Mar 2020 – 20 May 2020');
    expect(planned.people.map(p => p.id), 'WSU-04 oracle: the planned window\'s people').toEqual(ids(PLANNED_PEOPLE));
    /** Every field except the two the switch owns: the switch must write nothing else. */
    const rest = (d: any) => {
      const { workshopcompleted: _c, workshopcompletedat: _a, id: _i, ...others } = d || {};
      return others;
    };

    const count = page.getByTestId('wdash-signups-count');
    const windowLine = page.getByTestId('wdash-signups-window');
    let list: Page | null = null;
    try {
      await loginAsWshopAdmin(page);
      await openDashboard(page, S.ids.SWITCH);
      await expect(count, 'WSU-04 before: the planned count').toHaveText(String(planned.people.length), { timeout: 60_000 });
      await expect(windowLine, 'WSU-04 before: the planned window').toHaveText(await windowText(page, plannedWin));
      // A marker that only survives if the dashboard is never reloaded: what follows must arrive live.
      await page.evaluate(() => { (window as any).__wsuNoReload = true; });

      // The /workshops list in a second tab of the same signed-in browser.
      list = await context.newPage();
      const listGuard = attachConsoleGuard(list);
      await installWshopStubs(list);
      await list.goto('/workshops', { waitUntil: 'domcontentloaded' });
      const row = list.locator('table.workshops-table tr.mat-mdc-row').filter({ hasText: S.titles.SWITCH });
      const sw = row.getByTestId('wor-change-on-workshop-completed-change-16').locator('button[role="switch"]');
      await expect(sw, 'WSU-04: the Completed switch renders').toBeVisible({ timeout: 45_000 });
      await expect(sw, 'WSU-04: it shows the stored state (off)').toHaveAttribute('aria-checked', 'false');
      await expect(sw, 'WSU-04: an editor can flip it').toBeEnabled();

      // ── ON ──────────────────────────────────────────────────────────────────────────────────────────────────────
      const dialogs: string[] = [];
      list.once('dialog', (d) => { dialogs.push(d.message()); void d.accept(); });
      const before = Date.now();
      await sw.click();
      const on: any = await pollUntil(
        () => getDoc('workshopconfiguration', S.ids.SWITCH),
        (d: any) => !!d && d.workshopcompleted === true && typeof d.workshopcompletedat?.toMillis === 'function',
        { label: 'WSU-04: the app wrote workshopcompleted + workshopcompletedat', timeoutMs: 30_000 },
      );
      const after = Date.now();
      const at = on.workshopcompletedat.toMillis();
      expect(dialogs[0], 'WSU-04 ON: the existing confirm was shown').toContain(`mark "${S.titles.SWITCH}" as completed`);
      expect(at, 'WSU-04 ON: the completion date is the server time of the click (not before it)').toBeGreaterThanOrEqual(before);
      expect(at, 'WSU-04 ON: ...and not after the write was seen').toBeLessThanOrEqual(after);
      expect(rest(on), 'WSU-04 ON: no other field was written').toEqual(rest(seeded));
      await expect(sw, 'WSU-04 ON: the switch shows on').toHaveAttribute('aria-checked', 'true');

      const completed = await signupsOracle(S.ids.SWITCH);
      expect(completed.win.ok, 'WSU-04 oracle: still a window').toBe(true);
      const completedWin = completed.win as WinOk;
      expect(completedWin.end, 'WSU-04 oracle: the window now ends at the saved completion date').toBe(at);
      expect(completedWin.completed).toBe(true);
      expect(completed.people.map(p => p.id), 'WSU-04 oracle: the window grew — everyone in the planned window is still in')
        .toEqual(expect.arrayContaining(ids(PLANNED_PEOPLE)));
      expect(completed.people.map(p => p.id), 'WSU-04 oracle: ...the day after the planned end is now in too')
        .toContain(P.after.id);
      await expect(windowLine, 'WSU-04 ON: the open dashboard\'s window ends at the completion date, live')
        .toHaveText(await windowText(page, completedWin), { timeout: 30_000 });
      await expect(count, 'WSU-04 ON: the count follows the new window').toHaveText(String(completed.people.length));
      expect(await page.evaluate(() => (window as any).__wsuNoReload === true), 'WSU-04 ON: the dashboard was not reloaded').toBe(true);

      // ── OFF ─────────────────────────────────────────────────────────────────────────────────────────────────────
      list.once('dialog', (d) => { dialogs.push(d.message()); void d.accept(); });
      await sw.click();
      const off: any = await pollUntil(
        () => getDoc('workshopconfiguration', S.ids.SWITCH),
        (d: any) => !!d && d.workshopcompleted === false && !Object.prototype.hasOwnProperty.call(d, 'workshopcompletedat'),
        { label: 'WSU-04: the app wrote workshopcompleted false and removed workshopcompletedat', timeoutMs: 30_000 },
      );
      expect(dialogs[1], 'WSU-04 OFF: the existing confirm was shown').toContain(`mark "${S.titles.SWITCH}" as pending`);
      expect(Object.prototype.hasOwnProperty.call(off, 'workshopcompletedat'), 'WSU-04 OFF: the field is gone, not nulled').toBe(false);
      expect(rest(off), 'WSU-04 OFF: no other field was written').toEqual(rest(seeded));
      await expect(sw, 'WSU-04 OFF: the switch shows off').toHaveAttribute('aria-checked', 'false');

      await expect(windowLine, 'WSU-04 OFF: the dashboard returns to the planned end, live').toHaveText(await windowText(page, plannedWin), { timeout: 30_000 });
      await expect(windowLine, 'WSU-04 OFF: no "(completed)"').not.toContainText('(completed)');
      await expect(count, 'WSU-04 OFF: the planned count').toHaveText(String(planned.people.length));
      expect(await page.evaluate(() => (window as any).__wsuNoReload === true), 'WSU-04 OFF: still the same page').toBe(true);
      assertNoFatal(listGuard, 'new sign-ups /workshops tab: no fatal console errors / pageerrors');
    } finally {
      if (list) await list.close().catch(() => undefined);
      await resetSignupSwitchWorkshop();
    }
  });

  test('WSU-05 while new_user_data is loading the card waits (disabled, quiet bar), then fills in from that one read', async ({ page }) => {
    const o = await signupsOracle(S.ids.DONE);
    expect(o.people.map(p => p.id), 'WSU-05 oracle: DONE\'s five').toEqual(ids(DONE_PEOPLE));
    const card = page.getByTestId('wdash-signups-card');
    const loading = page.getByTestId('wdash-signups-loading');

    await loginAsWshopAdmin(page);
    const hold = await holdNewUserDataRead(page);
    try {
      await page.goto(`/workshop_dashboard/${S.ids.DONE}`, { waitUntil: 'domcontentloaded' });
      await expect.poll(() => hold.caught(), { message: 'WSU-05: the new_user_data read is out, and held', timeout: 45_000 }).toBe(1);
      await expect(loading, 'WSU-05 held: the card shows its loading state').toBeVisible({ timeout: 30_000 });
      await expect(loading, 'WSU-05 held: the loading state is announced').toContainText('Loading');
      await expect(card, 'WSU-05 held: the card keeps its title').toContainText('New Sign-ups');
      await expect(card, 'WSU-05 held: disabled').toBeDisabled();
      await expect(page.getByTestId('wdash-signups-count'), 'WSU-05 held: no number is guessed').toHaveCount(0);
      await card.click({ force: true });
      await expect(panelOpen(page), 'WSU-05 held: a waiting card opens nothing').toHaveCount(0);
      expect(hold.caught(), 'WSU-05: still held').toBe(1);

      hold.release();
      await expect(loading, 'WSU-05 released: the loading state goes').toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByTestId('wdash-signups-count'), 'WSU-05 released: the count').toHaveText(String(o.people.length));
      await expect(page.getByTestId('wdash-signups-window'), 'WSU-05 released: the window').toHaveText(await windowText(page, o.win as WinOk));
      await expect(card, 'WSU-05 released: enabled').toBeEnabled();
      await expectSignupsPanel(page, o.people, o.win as WinOk, 'WSU-05');
      expect(hold.caught(), 'WSU-05: the card added no new_user_data request of its own').toBe(1);
    } finally {
      hold.release();
      await hold.dispose();
    }
  });

  test('WSU-06 if the new_user_data read fails, the card says "—" and stays disabled', async ({ page }) => {
    const card = page.getByTestId('wdash-signups-card');
    await loginAsWshopAdmin(page);
    const hold = await holdNewUserDataRead(page);
    try {
      await page.goto(`/workshop_dashboard/${S.ids.DONE}`, { waitUntil: 'domcontentloaded' });
      await expect.poll(() => hold.caught(), { message: 'WSU-06: the new_user_data read is out, and held', timeout: 45_000 }).toBe(1);
      await expect(page.getByTestId('wdash-signups-loading'), 'WSU-06: loading while the read is out').toBeVisible({ timeout: 30_000 });
      hold.fail();

      await expect(page.getByTestId('wdash-signups-loading'), 'WSU-06: the loading state ends').toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByTestId('wdash-new-loading'), 'WSU-06: the siblings gave up too').toHaveCount(0);
      expect(hold.caught(), 'WSU-06: the read was tried three times (two retries) before it counted as failed').toBe(3);
      await expect(page.getByTestId('wdash-signups-count'), 'WSU-06: unavailable').toHaveText('—');
      await expect(card, 'WSU-06: the card keeps its title').toContainText('New Sign-ups');
      await expect(card, 'WSU-06: disabled').toBeDisabled();
      await card.click({ force: true });
      await expect(panelOpen(page), 'WSU-06: an unavailable card opens nothing').toHaveCount(0);
      // The failure is logged as before — expected here (the test aborted the read), so it is taken off the guard,
      // together with the Firestore Lite SDK's own log line for each aborted attempt (nothing else).
      await expect.poll(() => guard.all.some(m => /Error fetching new_user_data/.test(m)), { message: 'WSU-06: the failed read is logged' }).toBe(true);
      const expectedLogs = [/Error fetching new_user_data/, LITE_ABORT_LOG];
      for (let i = guard.fatals.length - 1; i >= 0; i--) if (expectedLogs.some(re => re.test(guard.fatals[i]))) guard.fatals.splice(i, 1);
    } finally {
      hold.release();
      await hold.dispose();
    }
  });

  test('WSU-07 a planned end saved with no time counts the whole end day', async ({ page }) => {
    const w: any = await getDoc('workshopconfiguration', S.ids.MIDNIGHT);
    expect(toMs(w?.detailpage?.workshopEndDate), 'WSU-07 precondition: the planned end is local midnight (no end time picked)')
      .toBe(S.at.midnightEnd.getTime());
    expect(Object.prototype.hasOwnProperty.call(w, 'workshopcompletedat'), 'WSU-07 precondition: no completion date').toBe(false);
    const o = await signupsOracle(S.ids.MIDNIGHT);
    expect(o.win.ok, 'WSU-07 oracle: MIDNIGHT has a window').toBe(true);
    const win = o.win as WinOk;
    expect(win.end, 'WSU-07 oracle: the window runs to the last moment of the end day')
      .toBe(new Date(2020, 5, 20, 23, 59, 59, 999).getTime());
    expect(win.completed).toBe(false);
    expect(await windowText(page, win)).toBe('11 Jun 2020 – 20 Jun 2020');
    expect(o.people.map(p => p.id), 'WSU-07 oracle: noon on the end day is in, the next midnight is out').toEqual(ids(['endDayNoon']));
    expect(await getDoc('new_user_data', P.dayAfterEnd.id), 'WSU-07 precondition: the next-midnight control exists').not.toBeNull();

    await loginAsWshopAdmin(page);
    await openDashboard(page, S.ids.MIDNIGHT);
    await expect(page.getByTestId('wdash-signups-count'), 'WSU-07: the end day\'s sign-up is counted').toHaveText(String(o.people.length), { timeout: 60_000 });
    await expect(page.getByTestId('wdash-signups-window'), 'WSU-07: the window names the end day').toHaveText(await windowText(page, win));
    await expectSignupsPanel(page, o.people, win, 'WSU-07');
    await closePanel(page, 'WSU-07');
  });

  test('WSU-08 a category-based workshop shows the card in its own People group', async ({ page }) => {
    const cat: any = await getDoc('workshopconfiguration', S.ids.CATEGORY);
    expect(cat?.categorybased, 'WSU-08 precondition: category-based').toBe(true);
    const o = await signupsOracle(S.ids.CATEGORY);
    expect(o.win.ok, 'WSU-08 oracle: CATEGORY has a window').toBe(true);
    const win = o.win as WinOk;
    expect(await windowText(page, win)).toBe('10 Mar 2020 – 15 Apr 2020 (completed)');
    expect(o.people.map(p => p.id), 'WSU-08 oracle: the same five as DONE').toEqual(ids(DONE_PEOPLE));

    await loginAsWshopAdmin(page);
    await openDashboard(page, S.ids.CATEGORY);
    // The category-based layout is the one drawn: its Participation card is there, the regular People cards are not.
    await expect(page.getByTestId('wd-on-category-based-metric-click-10'), 'WSU-08: the category-based layout').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('wd-on-metric-click-19'), 'WSU-08: no regular People group').toHaveCount(0);
    const card = page.getByTestId('wdash-signups-card');
    await expect(card, 'WSU-08: exactly one New Sign-ups card').toHaveCount(1);
    await expect(card.locator('xpath=ancestor::section[1]').locator('.wdx-eyebrow'), 'WSU-08: it sits in a People group')
      .toHaveText('People');
    await expect(page.getByTestId('wdash-signups-count'), 'WSU-08: the count').toHaveText(String(o.people.length), { timeout: 60_000 });
    await expect(page.getByTestId('wdash-signups-window'), 'WSU-08: the window').toHaveText(await windowText(page, win));
    await expect(card, 'WSU-08: the card can be opened').toBeEnabled();
    await expectSignupsPanel(page, o.people, win, 'WSU-08');
    await closePanel(page, 'WSU-08');
  });
});
