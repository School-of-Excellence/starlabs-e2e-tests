// workshop-dashboard-glance.spec.ts — the six At a glance additions on the workshop dashboard (2026-11-17):
//   WDG-01  Workshop timeline, running: "Day 12 of 24" · "12 days left" · Running, with the Today marker
//   WDG-02  Workshop timeline, the other worlds: Upcoming / Ended / Evergreen wording, and the strip hidden
//           when a non-evergreen workshop has no end date
//   WDG-03  Completed, Joined recently (count, delta, 14 day bars) and Needs attention (stuck / inactive)
//           against a Firestore-derived oracle; the two attention lists never overlap
//   WDG-04  Each card opens the side panel with exactly its people, under its own title
//   WDG-05  Top tags: order, counts, percentages, the entire long name (never an ellipsis); empty state;
//           the zero states (Joined 0, muted Stuck / Inactive)
//   WDG-06  A Top tags row opens Total Enrolled with ONLY that tag ticked and the list filtered to it
//   WDG-07  Not gated: a limited-access user sees the same cards (no glance figure is behind a permission)
//
// Recon: starlabs-angular src/app/New-Workshop/workshop-dashboard/
//   • workshop-dashboard.glance.ts — the pure rules (workshopTimeline, joinedRecently, needsAttention,
//     latestStepFinishedMs, topTags). Calendar days are the viewer's LOCAL days, both ends flattened to
//     midnight; lengths count both the start and the end day.
//   • workshop-dashboard.component.ts recomputeGlance() — runs at the end of updateMetrics(); progress is the
//     progress table's number; stuck/inactive/joined go into metrics under startedStuck / inactiveRecently /
//     joinedRecently, which onMetricClick's generic branch opens; onTopTagClick opens totalEnrolled and ticks
//     the tag after that panel's own tag-name load.
//   • workshop-dashboard.component.html — the strip (first child of the glance sheet), the 4th Participation
//     cell, and the new row after the groups block. Bars: span.wdx-gl-sp-b with title "dd Mon: n joined".
//   • Step-finish time = each step's `completed` Timestamp on the participant workshop doc (the field
//     stampParticipantWorkshopP0Completed writes); fallback `workshopStartedAt` on the enrolled doc.
//
// Hook prefix: `wdash-*` (workshop-dashboard.component.html). All 18 hooks are new with this change, so the
// hub-ahead guard (scripts/readiness/landed-specs.cjs) skips this FILE on app branches that predate it.
//
// THE WORLD (seedGlanceWorld in support/wshop.ts — its OWN run-tagged workshops; W_DASH is untouched):
//   LIVE  start = today-11 09:00, end = today+12 09:00 → Day 12 of 24, 12 days left
//         people (joined / status / steps finished / workshopStartedAt / tag ids):
//           active    1d  enrolled     1 of 2, finished 1d ago    10d   alpha, alpha (dup), beta, delta
//           stuck     2d  enrolled     0 of 2                      2d   alpha, beta, long
//           idle      9d  enrolled     1 of 2, finished 5d ago     1d   beta, alpha
//           done     20d  enrolled     2 of 2 (15d, 14d ago)      19d   gamma, alpha
//           fallback 10d  enrolled     1 of 2, NO finish time      6d   dead id, gamma, long
//           waiting   3d  enrollednotstarted                       —    delta, epsilon
//         → Joined +3 (active, stuck, waiting), the week before 2 (idle, fallback) → "▲ 1"; done is in neither
//         → Stuck = stuck; Inactive = idle (the step wins over a recent start) + fallback (start time used);
//           active is NOT inactive (its step is 1d old, although it started 10d ago); done is 100% → Completed
//         → Top tags: Alpha 4, Beta 3, then the three 2s A→Z (Delta, Gamma, Leadership…); Epsilon (1) is 6th, cut
//   SOON  start = today+3, 24 days long; one person whose only tag id is dead → "No tags on enrolled people yet."
//   DONE  today-27 → today-4; nobody enrolled → the zero states
//   EVER  evergreen, workshopDays 8 → "8-day journey"
//   NOEND a start date and no end date → no strip
//
// Anti-circularity: every expected number/string is computed from the docs read back from Firestore (the
// rules above, re-derived here independently of the app), and each oracle is first pinned to the seeded
// shape (e.g. "Day 12 of 24", stuck = [stuck]) so a wrong seed cannot pass by agreeing with a wrong app.
// Single-equality queries only.
import { test, expect, Page, Locator } from '@playwright/test';
import {
  wsIds, installWshopStubs, loginAsWshopAdmin, loginAsWshopLimited,
  wsGlanceIds, wsGlancePeople, wsGlanceTags, GlancePersonKey, seedGlanceWorld, clearGlanceWorld,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, queryWhere, db } from '../queue/support/firestore-admin';

// ─── the oracle's day arithmetic (local calendar days, as the notes define) ───────────────────────────────
const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayStart = (ms: number) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const calDays = (from: number, to: number) => Math.round((dayStart(to) - dayStart(from)) / DAY);
const shortDay = (ms: number) => { const d = new Date(ms); return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`; };
const weekdayDay = (ms: number) => `${WEEKDAYS[new Date(ms).getDay()]} ${shortDay(ms)}`;
const daysWord = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
const ms = (v: any): number | null => (v && typeof v.toMillis === 'function' ? v.toMillis() : null);

type Strip = { title: string; sub: string; pill: string } | null;

/** The strip a workshop doc should show at `now` (null = hidden). */
function expectedStrip(w: any, now: number): Strip {
  if (w?.evergreenWorkshop === true) {
    const n = Number(w?.evergreenWorkshopMeta?.workshopDays) || 0;
    return n > 0 ? { title: `${n}-day journey`, sub: 'Evergreen · each participant starts on their own day', pill: 'Evergreen' } : null;
  }
  const s = ms(w?.detailpage?.workshopStartDate);
  const e = ms(w?.detailpage?.workshopEndDate);
  if (s === null || e === null) return null;
  const total = calDays(s, e) + 1;
  if (total < 1) return null;
  if (now < s) {
    const until = Math.max(0, calDays(now, s));
    return {
      title: until === 0 ? 'Starts today' : until === 1 ? 'Starts tomorrow' : `Starts in ${until} days`,
      sub: `${weekdayDay(s)} · ${daysWord(total)} long`, pill: 'Upcoming',
    };
  }
  const day = calDays(s, now) + 1;
  if (day <= total) {
    const left = total - day;
    return { title: `Day ${day} of ${total}`, sub: left === 0 ? 'Ends today' : `${daysWord(left)} left`, pill: 'Running' };
  }
  const ago = calDays(e, now);
  return {
    title: ago === 1 ? 'Ended yesterday' : `Ended ${ago} days ago`,
    sub: `Ran ${daysWord(total)} · ${shortDay(s)} – ${shortDay(e)}`, pill: 'Ended',
  };
}

const workshopRef = (id: string) => db().collection('workshopconfiguration').doc(id);

/** Everything the cards should show for a workshop, derived from its docs in Firestore. */
async function glanceOracle(workshopId: string, now: number) {
  const enrolled: any[] = await queryWhere('workshop participant enrolled', [['workshopref', '==', workshopRef(workshopId)]]);
  const first = new Map<string, any>();
  for (const e of enrolled) if (e.profileid && !first.has(e.profileid)) first.set(e.profileid, e);
  const people = [...first.values()];

  // joined: (now-7d, now] and (now-14d, now-7d]; 14 calendar-day bars, oldest → today
  const joined: string[] = [];
  let prev = 0;
  const counts = new Array<number>(14).fill(0);
  for (const p of people) {
    const t = ms(p.enrollmentdate);
    if (t === null) continue;
    if (t > now - 7 * DAY) joined.push(p.profileid); else if (t > now - 14 * DAY) prev++;
    const back = Math.max(0, calDays(t, now));
    if (back <= 13) counts[13 - back]++;
  }
  const today = new Date(now);
  const barLabels = counts.map((n, i) =>
    `${shortDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (13 - i)).getTime())}: ${n} joined`);
  const diff = joined.length - prev;
  const delta = joined.length === 0 ? `${prev} the week before`
    : diff > 0 ? `▲ ${diff} vs the week before` : diff < 0 ? `▼ ${-diff} vs the week before` : '• same as the week before';

  // progress = finished steps / steps, for started people (status 'enrolled')
  const stuck: string[] = [];
  const inactive: string[] = [];
  const completed: string[] = [];
  for (const p of people.filter(x => x.status === 'enrolled')) {
    const pw: any = p.participantworkshopref ? await getDoc('participant workshop', p.participantworkshopref.id) : null;
    const steps = (pw?.challenges || []).flatMap((c: any) => (c?.type === 'challenge' ? c.challenges || [] : []));
    const progress = steps.length ? (steps.filter((s: any) => s.status === 'completed').length / steps.length) * 100 : 0;
    if (progress >= 100) { completed.push(p.profileid); continue; }
    if (progress <= 0) { stuck.push(p.profileid); continue; }
    const finishes = steps.map((s: any) => ms(s.completed)).filter((t: number | null): t is number => t !== null);
    const last = finishes.length ? Math.max(...finishes) : ms(p.workshopStartedAt);
    if (last !== null && now - last >= 3 * DAY) inactive.push(p.profileid);
  }

  // top tags: names per person (deduped), count people, desc then A→Z, top 5; pct over Total Enrolled (docs)
  const nameOf = new Map<string, string>();
  const tagCount = new Map<string, number>();
  for (const p of people) {
    const mine = new Set<string>();
    for (const id of Array.isArray(p.tags) ? p.tags : []) {
      if (!nameOf.has(id)) { const t: any = await getDoc('newusertags', id); nameOf.set(id, (t?.name ?? '').toString().trim()); }
      if (nameOf.get(id)) mine.add(nameOf.get(id)!);
    }
    for (const n of mine) tagCount.set(n, (tagCount.get(n) || 0) + 1);
  }
  const top = [...tagCount].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0])).slice(0, 5)
    .map(([name, n]) => ({ name, n, pct: Math.round((n / enrolled.length) * 100) }));

  return { totalEnrolled: enrolled.length, joined, prev, delta, barLabels, stuck, inactive, completed, top };
}

async function openDashboard(page: Page, workshopId: string): Promise<void> {
  await page.goto(`/workshop_dashboard/${workshopId}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${workshopId}`), { timeout: 30_000 });
  await expect(page.locator('nav.wdx-nav'), 'the dashboard has loaded').toBeVisible({ timeout: 90_000 });
}

const P = wsGlancePeople;
const nameOfPerson = (pid: string) => Object.values(P).find(p => p.id === pid)?.name ?? `?${pid}`;
const sorted = (a: string[]) => [...a].sort((x, y) => x.localeCompare(y));
const panelNames = async (page: Page) =>
  sorted((await page.locator('.participant-panel mat-card.participant-card .participant-name').allTextContents()).map(n => n.trim()));

/** Click a card, then: the panel's heading, and exactly these people in it. */
async function expectPanel(page: Page, card: Locator, heading: string, pids: string[], what: string): Promise<void> {
  await card.click();
  await expect(page.getByTestId('wd-close-participant-panel-61'), `${what}: the side panel opens`).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('wdash-panel-heading'), `${what}: panel heading`).toHaveText(heading);
  await expect(page.getByTestId('wdash-panel-title'), `${what}: panel subtitle`).toContainText(heading);
  const want = sorted(pids.map(nameOfPerson));
  await expect.poll(() => panelNames(page), { message: `${what}: exactly these people`, timeout: 30_000 }).toEqual(want);
  await page.getByTestId('wd-close-participant-panel-61').click();
  await expect(page.locator('aside.participant-panel'), `${what}: panel closed`).not.toHaveClass(/panel-visible/);
}

test.describe('Workshop dashboard — At a glance additions', () => {
  let guard: ConsoleGuard;
  test.beforeAll(async () => { await seedGlanceWorld(); });
  test.afterAll(async () => { await clearGlanceWorld(); });
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    assertNoFatal(guard, 'glance: no fatal console errors / pageerrors');
  });

  test('WDG-01 the timeline strip on a running workshop: Day 12 of 24, 12 days left, Running, Today marker', async ({ page }) => {
    const w: any = await getDoc('workshopconfiguration', wsGlanceIds.LIVE);
    const want = expectedStrip(w, Date.now());
    expect(want, 'WDG-01 oracle: the seeded running workshop').toEqual({ title: 'Day 12 of 24', sub: '12 days left', pill: 'Running' });

    await loginAsWshopAdmin(page);
    await openDashboard(page, wsGlanceIds.LIVE);
    const strip = page.getByTestId('wdash-timeline');
    await expect(strip, 'WDG-01: the strip renders').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('wdash-timeline-title')).toHaveText(want!.title);
    await expect(page.getByTestId('wdash-timeline-sub')).toHaveText(want!.sub);
    await expect(page.getByTestId('wdash-timeline-pill')).toHaveText(want!.pill);
    await expect(strip.locator('.wdx-gl-tl-today'), 'WDG-01: a running workshop shows the Today marker').toHaveCount(1);
    // It sits first in the glance sheet, before the hero figures.
    const firstIsStrip = await page.locator('section[aria-label="At a glance"]').evaluate(
      (s) => !!s.firstElementChild?.querySelector('[data-testid="wdash-timeline"]'));
    expect(firstIsStrip, 'WDG-01: the strip is the first thing in At a glance').toBe(true);
  });

  test('WDG-02 the timeline strip on upcoming, ended and evergreen workshops; hidden without an end date', async ({ page }) => {
    const pins: Record<string, Strip> = {
      [wsGlanceIds.SOON]: { title: 'Starts in 3 days', sub: '', pill: 'Upcoming' },
      [wsGlanceIds.DONE]: { title: 'Ended 4 days ago', sub: '', pill: 'Ended' },
      [wsGlanceIds.EVER]: { title: '8-day journey', sub: 'Evergreen · each participant starts on their own day', pill: 'Evergreen' },
    };
    await loginAsWshopAdmin(page);
    for (const id of [wsGlanceIds.SOON, wsGlanceIds.DONE, wsGlanceIds.EVER]) {
      const w: any = await getDoc('workshopconfiguration', id);
      const want = expectedStrip(w, Date.now());
      expect(want?.title, `WDG-02 oracle (${id}): title pinned to the seed`).toBe(pins[id]!.title);
      expect(want?.pill, `WDG-02 oracle (${id}): pill pinned to the seed`).toBe(pins[id]!.pill);
      if (id === wsGlanceIds.SOON) expect(want?.sub, 'WDG-02 oracle: 24 days long').toMatch(/^\w{3} \d{2} \w{3} · 24 days long$/);
      if (id === wsGlanceIds.DONE) expect(want?.sub, 'WDG-02 oracle: ran 24 days').toMatch(/^Ran 24 days · \d{2} \w{3} – \d{2} \w{3}$/);

      await openDashboard(page, id);
      await expect(page.getByTestId('wdash-timeline'), `WDG-02 (${want!.pill}): the strip renders`).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('wdash-timeline-title'), `WDG-02 (${want!.pill}): title`).toHaveText(want!.title);
      await expect(page.getByTestId('wdash-timeline-sub'), `WDG-02 (${want!.pill}): sub-line`).toHaveText(want!.sub);
      await expect(page.getByTestId('wdash-timeline-pill'), `WDG-02 (${want!.pill}): pill`).toHaveText(want!.pill);
      await expect(page.getByTestId('wdash-timeline').locator('.wdx-gl-tl-today'), `WDG-02 (${want!.pill}): no Today marker`).toHaveCount(0);
      if (id === wsGlanceIds.EVER) {
        await expect(page.getByTestId('wdash-timeline').locator('.wdx-gl-tl-track'), 'WDG-02: evergreen has no track').toHaveCount(0);
      }
    }

    // Hidden: a non-evergreen workshop without an end date. The glance itself still renders.
    const noEnd: any = await getDoc('workshopconfiguration', wsGlanceIds.NOEND);
    expect(noEnd?.detailpage?.workshopEndDate, 'WDG-02 precondition: no end date').toBeUndefined();
    expect(expectedStrip(noEnd, Date.now()), 'WDG-02 oracle: no end date → hidden').toBeNull();
    await openDashboard(page, wsGlanceIds.NOEND);
    await expect(page.getByTestId('wdash-completed-card'), 'WDG-02: the glance renders').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('wdash-timeline'), 'WDG-02: no end date → no strip').toHaveCount(0);
  });

  test('WDG-03 Completed, Joined recently and Needs attention match the Firestore oracle', async ({ page }) => {
    const o = await glanceOracle(wsGlanceIds.LIVE, Date.now());
    // Pinned to the seeded shape first.
    expect(o.totalEnrolled, 'WDG-03 oracle: six enrolled').toBe(6);
    expect(sorted(o.joined), 'WDG-03 oracle: joined in the last 7 days').toEqual(sorted([P.active.id, P.stuck.id, P.waiting.id]));
    expect(o.prev, 'WDG-03 oracle: the week before').toBe(2);
    expect(o.delta).toBe('▲ 1 vs the week before');
    expect(o.stuck, 'WDG-03 oracle: stuck').toEqual([P.stuck.id]);
    expect(sorted(o.inactive), 'WDG-03 oracle: inactive (step finish wins; start time as fallback)').toEqual(sorted([P.idle.id, P.fallback.id]));
    expect(o.completed, 'WDG-03 oracle: completed').toEqual([P.done.id]);
    expect(o.stuck.filter(id => o.inactive.includes(id)), 'WDG-03 oracle: the lists never overlap').toEqual([]);

    await loginAsWshopAdmin(page);
    await openDashboard(page, wsGlanceIds.LIVE);
    await expect(page.getByTestId('wdash-completed-count'), 'WDG-03: Completed').toHaveText(String(o.completed.length), { timeout: 30_000 });
    await expect(page.getByTestId('wdash-completed-card'), 'WDG-03: "of N enrolled"').toContainText(`of ${o.totalEnrolled} enrolled`);

    await expect(page.getByTestId('wdash-joined-count'), 'WDG-03: Joined +N').toHaveText(`+${o.joined.length}`);
    await expect(page.getByTestId('wdash-joined-delta'), 'WDG-03: delta vs the week before').toHaveText(o.delta);
    await expect(page.getByTestId('wdash-joined-delta'), 'WDG-03: an increase is drawn as up').toHaveClass(/wdx-gl-up/);
    await expect(page.getByTestId('wdash-joined-card'), 'WDG-03: sub-line').toContainText('in the last 7 days');
    const bars = page.getByTestId('wdash-joined-card').locator('.wdx-gl-sp-b');
    await expect(bars, 'WDG-03: 14 day bars').toHaveCount(14);
    expect(await bars.evaluateAll(els => els.map(e => e.getAttribute('title'))), 'WDG-03: each bar is its day and count, oldest first')
      .toEqual(o.barLabels);
    expect(await bars.evaluateAll(els => els.map(e => e.classList.contains('wdx-gl-sp-b--wk'))), 'WDG-03: the last 7 bars are darker')
      .toEqual([...Array(7).fill(false), ...Array(7).fill(true)]);

    await expect(page.getByTestId('wdash-stuck-count'), 'WDG-03: Started but stuck').toHaveText(String(o.stuck.length));
    await expect(page.getByTestId('wdash-inactive-count'), 'WDG-03: Inactive for 3+ days').toHaveText(String(o.inactive.length));
    await expect(page.getByTestId('wdash-stuck-card')).toContainText('started, still at 0%');
    await expect(page.getByTestId('wdash-inactive-card')).toContainText('no step finished in 3 days');
    await expect(page.getByTestId('wdash-stuck-card'), 'WDG-03: a non-zero count is not muted').not.toHaveClass(/wdx-gl-zero/);
    await expect(page.getByTestId('wdash-inactive-card')).not.toHaveClass(/wdx-gl-zero/);
  });

  test('WDG-04 each card opens the side panel with exactly its people', async ({ page }) => {
    const o = await glanceOracle(wsGlanceIds.LIVE, Date.now());
    await loginAsWshopAdmin(page);
    await openDashboard(page, wsGlanceIds.LIVE);
    await expect(page.getByTestId('wdash-stuck-count'), 'WDG-04: the numbers have landed').toHaveText(String(o.stuck.length), { timeout: 30_000 });

    await expectPanel(page, page.getByTestId('wdash-completed-card'), 'Completed', o.completed, 'WDG-04 Completed');
    await expectPanel(page, page.getByTestId('wdash-joined-card'), 'Joined in the last 7 days', o.joined, 'WDG-04 Joined');
    await expectPanel(page, page.getByTestId('wdash-stuck-card'), 'Started but stuck', o.stuck, 'WDG-04 Stuck');
    await expectPanel(page, page.getByTestId('wdash-inactive-card'), 'Inactive for 3+ days', o.inactive, 'WDG-04 Inactive');
  });

  test('WDG-05 Top tags: order, counts and percentages; the whole long name; empty and zero states', async ({ page }) => {
    const G = wsGlanceTags;
    const o = await glanceOracle(wsGlanceIds.LIVE, Date.now());
    expect(o.top.map(t => t.name), 'WDG-05 oracle: 4, 3, then the 2s A→Z; the 6th (Epsilon) is cut')
      .toEqual([G.alpha.name, G.beta.name, G.delta.name, G.gamma.name, G.long.name]);
    expect(o.top.map(t => `${t.n} · ${t.pct}%`)).toEqual(['4 · 67%', '3 · 50%', '2 · 33%', '2 · 33%', '2 · 33%']);
    expect(await getDoc('newusertags', G.ghost), 'WDG-05 precondition: the dead id has no tag doc').toBeNull();

    await loginAsWshopAdmin(page);
    await openDashboard(page, wsGlanceIds.LIVE);
    const card = page.getByTestId('wdash-top-tags');
    await expect(card, 'WDG-05: the Top tags card').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('wdash-top-tag'), 'WDG-05: five rows').toHaveCount(5, { timeout: 30_000 });
    await expect(page.getByTestId('wdash-top-tag-name'), 'WDG-05: names in order').toHaveText(o.top.map(t => t.name));
    await expect(page.getByTestId('wdash-top-tag-count'), 'WDG-05: "<n> · <pct>%"').toHaveText(o.top.map(t => `${t.n} · ${t.pct}%`));
    await expect(card, 'WDG-05: the hint').toContainText('click a tag to open its people');
    await expect(page.getByTestId('wdash-top-tags-empty'), 'WDG-05: no empty line when there are tags').toHaveCount(0);

    // The long name is shown whole: exact text, no ellipsis, nothing clipped — at desktop and phone width.
    const long = page.getByTestId('wdash-top-tag-name').filter({ hasText: 'Leadership' });
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(vp);
      await expect(long, `WDG-05 (${vp.width}): the entire tag name`).toHaveText(G.long.name);
      const m = await long.evaluate((el) => ({
        sw: el.scrollWidth, cw: el.clientWidth, to: getComputedStyle(el).textOverflow,
        row: (el.closest('[data-testid="wdash-top-tag"]') as HTMLElement).getBoundingClientRect().width,
        right: el.getBoundingClientRect().right,
        rowRight: (el.closest('[data-testid="wdash-top-tag"]') as HTMLElement).getBoundingClientRect().right,
      }));
      expect(m.to, `WDG-05 (${vp.width}): no ellipsis`).not.toBe('ellipsis');
      expect(m.sw, `WDG-05 (${vp.width}): the chip is not truncated`).toBeLessThanOrEqual(m.cw + 1);
      expect(m.right, `WDG-05 (${vp.width}): the chip stays inside its row`).toBeLessThanOrEqual(m.rowRight + 1);
      const countRows = await page.getByTestId('wdash-top-tag-count').evaluateAll(els => els.map(e => e.getClientRects().length));
      expect(countRows.every(n => n === 1), `WDG-05 (${vp.width}): the count never wraps`).toBe(true);
    }
    await page.setViewportSize({ width: 1280, height: 720 });

    // Empty: SOON's only person carries a dead tag id.
    await openDashboard(page, wsGlanceIds.SOON);
    await expect(page.getByTestId('wdash-top-tags-empty'), 'WDG-05: empty state').toHaveText('No tags on enrolled people yet.', { timeout: 30_000 });
    await expect(page.getByTestId('wdash-top-tag'), 'WDG-05: no rows').toHaveCount(0);
    await expect(page.getByTestId('wdash-top-tags')).not.toContainText('click a tag to open its people');

    // Zero states: DONE has nobody enrolled.
    const z = await glanceOracle(wsGlanceIds.DONE, Date.now());
    expect(z.totalEnrolled, 'WDG-05 oracle: nobody on DONE').toBe(0);
    await openDashboard(page, wsGlanceIds.DONE);
    await expect(page.getByTestId('wdash-joined-count'), 'WDG-05: Joined zero').toHaveText('0', { timeout: 30_000 });
    await expect(page.getByTestId('wdash-joined-count')).toHaveClass(/wdx-gl-mo-n--zero/);
    await expect(page.getByTestId('wdash-joined-delta'), 'WDG-05: "P the week before"').toHaveText(z.delta);
    await expect(page.getByTestId('wdash-joined-card')).toContainText('No one joined in the last 7 days');
    await expect(page.getByTestId('wdash-stuck-count')).toHaveText('0');
    await expect(page.getByTestId('wdash-inactive-count')).toHaveText('0');
    await expect(page.getByTestId('wdash-stuck-card'), 'WDG-05: zero renders muted').toHaveClass(/wdx-gl-zero/);
    await expect(page.getByTestId('wdash-inactive-card'), 'WDG-05: zero renders muted').toHaveClass(/wdx-gl-zero/);
    await expect(page.getByTestId('wdash-completed-count')).toHaveText('0');
  });

  test('WDG-06 a Top tags row opens Total Enrolled filtered to that tag, with only it ticked', async ({ page }) => {
    const G = wsGlanceTags;
    // Gamma (a tie member): carried by done and fallback only.
    const carriers = (Object.keys(P) as GlancePersonKey[]).filter(k => ['done', 'fallback'].includes(k)).map(k => P[k].id);
    const enrolled: any[] = await queryWhere('workshop participant enrolled', [['workshopref', '==', workshopRef(wsGlanceIds.LIVE)]]);
    expect(sorted(enrolled.filter(e => (e.tags || []).includes(G.gamma.id)).map(e => e.profileid)),
      'WDG-06 oracle: who carries Gamma').toEqual(sorted(carriers));
    const allNames = sorted([...new Set(enrolled.flatMap(e => e.tags || []))]
      .map(id => Object.values(G).find(t => typeof t !== 'string' && t.id === id) as { name: string } | undefined)
      .filter((t): t is { name: string } => !!t).map(t => t.name));

    await loginAsWshopAdmin(page);
    await openDashboard(page, wsGlanceIds.LIVE);
    await expect(page.getByTestId('wdash-top-tag'), 'WDG-06: rows loaded').toHaveCount(5, { timeout: 30_000 });
    await page.getByTestId('wdash-top-tag').filter({ hasText: G.gamma.name }).click();

    await expect(page.getByTestId('wd-close-participant-panel-61'), 'WDG-06: the panel opens').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('wdash-panel-heading'), 'WDG-06: it is Total Enrolled').toHaveText('Total Enrolled');
    await expect.poll(() => panelNames(page), { message: 'WDG-06: only Gamma\'s people', timeout: 30_000 })
      .toEqual(sorted(carriers.map(nameOfPerson)));

    await page.getByTestId('wd-button-63').click();
    const option = page.getByTestId('wd-side-tag-option');
    await expect(option, 'WDG-06: every tag in the panel is offered, A→Z').toHaveText(allNames, { timeout: 30_000 });
    const ticked = await option.evaluateAll(els => els.filter(e => (e.querySelector('input[type="checkbox"]') as HTMLInputElement)?.checked)
      .map(e => (e.textContent || '').trim()));
    expect(ticked, 'WDG-06: only Gamma is ticked').toEqual([G.gamma.name]);
    await page.keyboard.press('Escape');
  });

  test('WDG-07 not gated: a limited-access user sees the same cards on the dashboard they can open', async ({ page }) => {
    const w: any = await getDoc('workshopconfiguration', wsIds.W_DASH);
    const want = expectedStrip(w, Date.now());
    expect(want?.pill, 'WDG-07 oracle: W_DASH is running').toBe('Running');

    await loginAsWshopLimited(page);
    await openDashboard(page, wsIds.W_DASH);
    await expect(page.getByTestId('wdash-timeline-title'), 'WDG-07: the strip').toHaveText(want!.title, { timeout: 30_000 });
    await expect(page.getByTestId('wdash-completed-card'), 'WDG-07: Completed renders for limited').toBeVisible();
    await expect(page.getByTestId('wdash-joined-card'), 'WDG-07: Joined recently renders for limited').toBeVisible();
    await expect(page.getByTestId('wdash-stuck-card'), 'WDG-07: Started but stuck renders for limited').toBeVisible();
    await expect(page.getByTestId('wdash-inactive-card'), 'WDG-07: Inactive renders for limited').toBeVisible();
    await expect(page.getByTestId('wdash-top-tags'), 'WDG-07: Top tags renders for limited').toBeVisible();
  });
});
