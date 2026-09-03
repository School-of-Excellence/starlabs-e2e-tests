// live-event-dashboard-v3.spec.ts — Live Event Dashboard v3: mount + the app-computed hero
// "registered" count (real UI, ANTI-CIRCULAR). Closes the "never opened" gap flagged in the StarLabs
// route-coverage map (2026-09-03) for `/live_event_dashboard_v3`.
//
// ============================================================================================
// ATC SCOPE — READ BEFORE TOUCHING THIS FILE. Operator rule: the firestore-atc database is never
// touched by a test — not deferred, not worked around (see memory: never-touch-firestore-atc).
//
// Exactly THREE functions in live-event-data.service.ts open that database:
//   subscribeToAtcAlpha() / subscribeToAtcToValidate() / subscribeToDraftAtc()
// All three are called EXCLUSIVELY from subscribeToArenaOverview(), which is itself called from
// exactly two places:
//   1. selectEvent() — line ~449, UNCONDITIONALLY once `this.selectedQueues.length > 0`.
//   2. toggleQueue() — line ~472, when a queue chip is checked.
// This suite NEVER calls toggleQueue (no test in this file may click a queue chip/checkbox on this
// screen, ever). That still leaves path (1): selectEvent() auto-selects a queue for whichever event it
// opens — first any queue sharing that event's eventref, and IF NONE MATCH, it falls back to
// `ongoingQueues[0]` — the first "ongoing" queue **project-wide**, out of the FULL `queue generation`
// collection (no eventref filter, no testrunid scope; this is a shared disposable test project other
// suites seed into too). So whether opening ANY event here reaches firestore-atc depends on ambient
// state this file does not control.
//
// selectEvent() is also called AUTOMATICALLY by init() (→ ngOnInit, unconditionally on mount) for
// `ongoingEvents[0]` if one exists — and EVENT1 (this suite's own seeded event, start -2d/end +7d) IS
// "ongoing" by design (qr-scanner.ts needs it to be). So simply navigating here already risks it.
//
// The guard: assertNoProjectWideOngoingQueue() below reads the FULL `queue generation` collection (the
// exact same unfiltered read + isOngoing predicate the app itself uses) and THROWS — failing the test
// loudly, not skipping it silently — if any doc's [queuestartdate, queueenddate] window contains today.
// Only once that returns clean is it safe for this file to call selectEvent (via clicking an event).
// If this guard ever fails in CI, that means the shared project currently has a live queue and this
// suite's whole live_event_dashboard_v3 coverage is void for that run — investigate, don't bypass it.
// ============================================================================================
import { test, expect } from '@playwright/test';
import { evtIds, installEvtStubs, loginAsEvtAdmin, refTo } from './support/events';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere, queryWhere } from '../queue/support/firestore-admin';

const RUN = process.env.EVT_RUNID || 'evt';
const EVENT_NAME = `TEST Event ${RUN}`;

/**
 * Exact reproduction of live-event-data.service.ts's own ongoing-queue predicate (init(), the
 * eventsQueuesP block): a full, unfiltered `queue generation` scan, `queuestartdate <= today <=
 * queueenddate` (midnight-floored start, end-of-day end — same as the app). Throws (does not return
 * false) when any doc matches, so a violation fails the test instead of silently narrowing coverage.
 */
async function assertNoProjectWideOngoingQueue(): Promise<void> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const toDate = (v: unknown): Date => {
    const anyV = v as { toDate?(): Date };
    return anyV && typeof anyV.toDate === 'function' ? anyV.toDate() : new Date(v as never);
  };
  const queues = await queryWhere('queue generation', []);
  const ongoing = queues.filter((q) => {
    const start = toDate(q['queuestartdate']); start.setHours(0, 0, 0, 0);
    const end = toDate(q['queueenddate']); end.setHours(23, 59, 59, 999);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= todayEnd && today <= end;
  });
  if (ongoing.length > 0) {
    throw new Error(
      `ATC-GUARD: ${ongoing.length} project-wide "ongoing" queue doc(s) exist right now ` +
      `(${ongoing.map((q) => q.id).join(', ')}). live-event-dashboard-v3's selectEvent() would auto-select ` +
      'one of these as a fallback and fire subscribeToAtcAlpha/AtcToValidate/DraftAtc against ' +
      "firestore-atc — cancelled per the never-touch-firestore-atc rule, not run. Do not bypass this guard.",
    );
  }
}

test.describe('Live Event Dashboard v3 — hero count (real UI, anti-circular, ATC-guarded)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installEvtStubs(page);
    await assertNoProjectWideOngoingQueue();
  });
  test.afterEach(() => assertNoFatal(guard, 'live-event-dashboard-v3: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // LED3-01 — mounting auto-selects the seeded ongoing event (init() → selectEvent()); assert the
  // app-computed hero count against an independent Firestore count of the same predicate the SERVICE
  // itself queries (eventref==EVENT1, status in [approved,attended]) — never a value this test wrote.
  // ===========================================================================================
  test('LED3-01 the hero count renders the app-computed registered universe (== independent Firestore count)', async ({ page }) => {
    // Oracle: eventref==EVENT1 && status in [approved,attended] — the exact predicate
    // live-event-data.service.ts's own registered-universe query uses.
    const registeredOracle = await countWhere('event participation request', [
      ['eventref', '==', refTo('event collection', evtIds.event1)],
      ['status', 'in', ['approved', 'attended']],
    ]);
    expect(registeredOracle, 'LED3-01: seeded precondition — EPR0 + EPR1 are approved for EVENT1').toBe(2);

    await loginAsEvtAdmin(page);
    await page.goto('/live_event_dashboard_v3', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/live_event_dashboard_v3/, { timeout: 30_000 });

    // [REAL-UI] wait for the auto-selected event's name to appear anywhere on the shell (proves
    // selectEvent(EVENT1) completed) before reading the hero number it drives.
    await expect(page.getByText(EVENT_NAME), 'LED3-01: the auto-selected seeded event must render').toBeVisible({ timeout: 30_000 });

    const hero = page.locator('#heroNum');
    await expect(hero, 'LED3-01: the hero registered-count element must render').toBeVisible({ timeout: 30_000 });
    await expect(hero, `LED3-01: hero count must equal the independent Firestore count (${registeredOracle})`)
      .toHaveText(String(registeredOracle), { timeout: 20_000 });
  });
});
