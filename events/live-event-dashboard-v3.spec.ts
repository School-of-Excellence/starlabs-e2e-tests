// live-event-dashboard-v3.spec.ts — Live Event Dashboard v3: mount + the app-computed hero
// "registered" count (real UI, ANTI-CIRCULAR). Closes the "never opened" gap flagged in the StarLabs
// route-coverage map (2026-09-03) for `/live_event_dashboard_v3`.
//
// Recon: recon-allcomp/events-arena.md (LED3-01 / LED3-02)
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
import { evtActors, evtIds, evtProfileIds, installEvtStubs, loginAsEvtAdmin, refTo, resetLed3MarkForP7 } from './support/events';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere, pollUntil, queryWhere } from '../queue/support/firestore-admin';

const RUN = process.env.EVT_RUNID || 'evt';
const EVENT_NAME = `TEST Event ${RUN}`;
const PRODUCT_NAME = `TEST Event Product ${RUN}`;

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

/**
 * Click EVENT1's ongoing chip and wait for it to become active. init() auto-selects
 * ongoingEvents[0] on mount — NOT necessarily EVENT1: EVENT2 ("TEST Initiate Event evt", seeded for
 * the EVT-10/11 deep-suite) is ALSO "ongoing" today and has a LATER end_date, so it sorts first in the
 * app's own `orderBy('end_date','desc')` query and wins the auto-select (verified live against the
 * emulator — a real finding, not a flaky selector).
 *
 * MUST wait for the FIRST `.chip.active` to appear before clicking — init()'s own `await
 * selectEvent(ongoingEvents[0])` is still in flight right after navigation, and racing it with our own
 * click (both call selectEvent) lets whichever resolves LAST silently win, reverting the selection
 * back to EVENT2 (reproduced live: an early click on EVENT1's chip appeared to succeed but the event
 * reverted moments later). Waiting for the initial auto-select to settle first removes the race.
 */
async function selectEvent1(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('.chip.active'), 'the initial auto-selected event chip must settle first').toBeVisible({ timeout: 30_000 });
  await page.locator('.chip', { hasText: EVENT_NAME }).click();
  await expect(page.locator('.chip.active', { hasText: EVENT_NAME }), 'EVENT1 must become (and stay) the active event chip').toBeVisible({ timeout: 30_000 });
  // The chip's `.active` class binds to `selectedEvent` (set synchronously, early in selectEvent()), but
  // `dayWiseAttendance` — what the day cards / "Unattended" drill-down actually read — is computed
  // later in the same async chain (generateDayWiseStructure(), right after `await loadParticipants()`).
  // A click right after the chip goes active can still land while that data is mid-flight, computed for
  // the PREVIOUS event and rendering a plausible-but-empty panel (reproduced live against the emulator).
  // registeredCount (the hero number) is set in the same `loadParticipants()` call, so waiting for it to
  // render a real number is a reliable proxy for "dayWiseAttendance is fresh too."
  await expect(page.locator('#heroNum'), 'the hero count must settle to a real number before reading day-card data').toHaveText(/^[0-9]+$/, { timeout: 30_000 });
}

// ===========================================================================================
// READ-PATH (LED3-01) — no dialog handling needed, fastest path to a first green run.
// ===========================================================================================
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
    // live-event-data.service.ts's own registered-universe query uses. EPR0/EPR1/EPR7 are approved
    // (EPR7 seeded specifically for LED3-02, arenaeventid:null so it does NOT also bump ESD-01/EPC-01's
    // arenaeventid-scoped oracles). EPR2 ("prove the filter" doc, status:'requested') must NOT count.
    // Floor, not exact equality: EPC-02 (event-participation-confirmation.spec.ts, same emulator run,
    // alphabetically earlier) approves p6 for real, adding a 4th approved EPR with the same eventref —
    // a genuine cross-spec interaction inside one seeded world, not a bug in either test. The UI-vs-
    // oracle comparison below stays exact against WHATEVER this count is at run time.
    const registeredOracle = await countWhere('event participation request', [
      ['eventref', '==', refTo('event collection', evtIds.event1)],
      ['status', 'in', ['approved', 'attended']],
    ]);
    expect(registeredOracle, 'LED3-01: seeded precondition — at least EPR0 + EPR1 + EPR7 are approved for EVENT1').toBeGreaterThanOrEqual(3);

    await loginAsEvtAdmin(page);
    await page.goto('/live_event_dashboard_v3', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/live_event_dashboard_v3/, { timeout: 30_000 });

    await selectEvent1(page);

    const hero = page.locator('#heroNum');
    await expect(hero, 'LED3-01: the hero registered-count element must render').toBeVisible({ timeout: 30_000 });
    await expect(hero, `LED3-01: hero count must equal the independent Firestore count (${registeredOracle})`)
      .toHaveText(String(registeredOracle), { timeout: 20_000 });
  });
});

// ===========================================================================================
// WRITE-PATH (LED3-02) — Mark attendance. Written only after LED3-01 (the read-path harness, and the
// ATC guard) is known-good.
//
// DIALOG NOTE — the trap this suite's earlier comms work flagged: confirmMark() (component.ts:2295-97)
// gates the write behind a NATIVE `window.confirm('Mark <name> present for <day>?')` — verified by
// grepping the component for `window.confirm`/`window.prompt` (one hit, this one). Playwright
// auto-dismisses an unhandled native dialog, which would make confirmMark() return early and
// markAttendanceForProducts() NEVER RUN — a silent no-op the test would otherwise read as a false
// green if it only checked "no error was thrown." This test installs `page.once('dialog', ...)`
// BEFORE clicking "Confirm", exactly like the existing EVT-04 case in events.spec.ts.
// ===========================================================================================
test.describe('Live Event Dashboard v3 — Mark attendance (real UI, write-path, anti-circular, ATC-guarded)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installEvtStubs(page);
    await assertNoProjectWideOngoingQueue();
    // Precondition (anti-circular, re-runnable): delete any arena e-ticket log the app wrote for p7's
    // manual mark on a prior run, so this test starts from a known "unattended today" state.
    await resetLed3MarkForP7();
  });
  test.afterEach(() => assertNoFatal(guard, 'live-event-dashboard-v3 (mark attendance): no fatal console errors / pageerrors'));

  test('LED3-02 marking p7 present writes an arena e-ticket log row with markedmanually:true', async ({ page }) => {
    // Precondition (anti-circular): p7 must start with zero manual-mark log rows.
    const before = await countWhere('arena e-ticket log', [
      ['profileid', '==', evtProfileIds.p7],
      ['markedmanually', '==', true],
    ]);
    expect(before, 'LED3-02: p7 must start unattended (no manual mark yet)').toBe(0);

    await loginAsEvtAdmin(page);
    await page.goto('/live_event_dashboard_v3', { waitUntil: 'domcontentloaded' });
    await selectEvent1(page);

    // [REAL-UI] open today's "Unattended" drill-down (sets panelMarkable=true) — the ONLY place the
    // "Mark attendance" button renders. Scoped to today's card (`.day-card.today`) so this test never
    // depends on which day column layout is showing.
    //
    // `#panelList` in the component is an Angular @ViewChild TEMPLATE-REF variable, not an HTML id
    // attribute — verified live against the emulator (no element with id="panelList" exists in the
    // rendered DOM). The actual rendered container is `.panel.open`.
    //
    // MUST wait for data.dayWiseAttendance BEFORE clicking, not retry the click: openAttAbsent(day)
    // takes a plain-array SNAPSHOT of day.absentProfileIds at click time (openPanelRows) — an
    // already-open panel does not reactively refresh, and (reproduced live against the emulator)
    // re-clicking the stat did not reliably fix an empty snapshot either. `absentProfileIds` is only
    // correct once subscribeToAttendance()'s OWN async `arena e-ticket log` snapshot — a separate,
    // LATER Firestore round-trip than the one selectEvent1() already waited on (registeredCount) —
    // resolves and calls recomputeAttendanceDays(). Poll the component's own data (via Angular
    // DevTools' `ng.getOwningComponent`, available on this dev build) for the exact condition instead
    // of guessing a delay.
    await page.waitForFunction(
      (p7id) => {
        const el = document.getElementById('heroNum');
        const comp = (window as unknown as { ng: { getOwningComponent(e: Element): { data: { dayWiseAttendance: { isToday: boolean; absentProfileIds: string[] }[] } } } }).ng.getOwningComponent(el!);
        const today = comp?.data?.dayWiseAttendance?.find((d) => d.isToday);
        return !!today && today.absentProfileIds.includes(p7id);
      },
      evtProfileIds.p7,
      { timeout: 30_000 },
    );

    await page.locator('.day-card.today').first().locator('.day-stat', { hasText: 'Unattended' }).click();
    const panel = page.locator('.panel.open');
    await expect(panel, 'LED3-02: the Unattended drill-down list must open').toBeVisible({ timeout: 30_000 });
    const p7Row = panel.locator('.p-row', { hasText: evtActors.participant7 });
    await expect(p7Row, 'LED3-02: p7\'s unattended row must render').toBeVisible({ timeout: 10_000 });
    await p7Row.getByRole('button', { name: 'Mark attendance' }).click();

    // openMarkPicker() does an async e-ticket lookup then expands `.mark-picker` as p7Row's NEXT
    // sibling (not a descendant of p7Row — same *ngFor iteration, two adjacent template blocks). At
    // most one `.mark-picker` is ever open at a time (gated on markPickerId===p.profileid), so scoping
    // to the whole panel is unambiguous.
    const picker = panel.locator('.mark-picker');
    await expect(picker, 'LED3-02: the product picker must expand (p7\'s active P1 e-ticket was found)').toBeVisible({ timeout: 20_000 });
    await picker.locator('label.mark-opt', { hasText: PRODUCT_NAME }).locator('input[type="checkbox"]').check();

    // [REAL-UI] the confirm is a NATIVE dialog — see the file-header DIALOG NOTE. Must be armed BEFORE
    // the click; Playwright's default (auto-dismiss) would make this a false green.
    page.once('dialog', (d) => d.accept());
    await picker.getByRole('button', { name: 'Confirm' }).click();

    // [ASSERT] the value the APP wrote on the real click — read back via the admin SDK, never the UI's
    // own optimistic "Marked" label.
    const rows = await pollUntil(
      () => queryWhere('arena e-ticket log', [
        ['profileid', '==', evtProfileIds.p7],
        ['markedmanually', '==', true],
      ]),
      (r) => r.length >= 1,
      { label: 'LED3-02: an arena e-ticket log row for p7 with markedmanually:true', timeoutMs: 30_000 },
    );
    expect(rows.length, 'LED3-02: exactly one log row for the single product checked').toBe(1);
  });
});
