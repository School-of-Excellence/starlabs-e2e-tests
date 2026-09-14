// live-event-health.spec.ts — /liveeventhealth, the Diagnostics Tool screen (REAL-UI).
//
// Recon: e2e/recon-allcomp/events-arena.md (EVT-17 — route assigned to this suite 2026-09-08).
//
// src/app/Diagnostics Tool/** was claimed by no suite until this pass, so a change there routed ZERO
// gates. It now belongs to events, which is the suite that already seeds the collections it reads.
//
// Anti-circularity: the screen reads `event collection`, `event participation request`,
// `participant metadata` and `participantsproduct` — and the events seed writes the first two. So unlike
// the mount-only cases elsewhere in this pass, this one can assert a value the APP resolved: the seeded
// event must appear on the health screen, having been read by the component rather than supplied to it.
import { test, expect } from '@playwright/test';
import { installEvtStubs, loginAsEvtAdmin } from './support/events';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { queryWhere } from '../queue/support/firestore-admin';

const RUN = process.env.EVT_RUNID || 'evt';
const EVENT1_NAME = `TEST Event ${RUN}`;

let guard: ConsoleGuard;
let seededEventName: string | null = null;

test.beforeAll(async () => {
  // Assert against THIS suite's OWN seeded event.
  //
  // The previous version took "the first `event collection` doc with an `eventname` field", which on a
  // shared project picked up whatever another suite happened to leave behind — it resolved to
  // "BIG Event wshop", a doc the WORKSHOPS seeder writes. That makes the case depend on which suites ran
  // first, the same cross-suite coupling that has bitten this repo repeatedly. It also read the wrong
  // FIELD: the autocomplete renders `e.name` (live-event-health.component.html:15), not `eventname`.
  //
  // Pin to our own event and fail loudly if the seed did not write it, rather than silently skipping on a
  // field name that no longer matches the component.
  const events = await queryWhere('event collection', []);
  const ours = events.find((e) => e.name === EVENT1_NAME);
  seededEventName = ours ? String(ours.name) : null;
});

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  await installEvtStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'live-event-health: no fatal console errors / pageerrors'));

test.describe('Events — live event health (real UI, anti-circular)', () => {
  // ===========================================================================================
  // EVT-17 — /liveeventhealth mounts and surfaces an event it read for itself
  // ===========================================================================================
  // UN-PARKED 2026-09-13. This was parked as an "unexplained render failure" — the component host
  // supposedly never appearing in the DOM despite the route resolving and the guard admitting. A direct
  // probe (log in as admin+evt, navigate, dump the DOM after settle) disproved that: the outlet's sibling
  // IS <app-live-event-health>, and the screen renders "Live Events Dashboard" plus its
  // "Select or Search Event" field. The mount was never the problem.
  //
  // What actually failed were the two things below, both spec-side:
  //   • the event name is only reachable through the mat-autocomplete PANEL, not in the host's text at
  //     rest, so a getByText on the host could never match;
  //   • the beforeAll picked "the first event with an `eventname` field" out of the shared collection,
  //     which resolved to another suite's doc ("BIG Event wshop") and read a field the component does not
  //     render anyway (it renders `e.name`).
  //
  // NOTE for whoever looks at workshops WS-36 (/eiflixtelemetry), which was parked with the SAME stated
  // symptom and cross-referenced this case: that shared diagnosis is now suspect. Re-probe it before
  // trusting the note — one of the two "identical" failures turned out not to be a mount failure at all.
  test('EVT-17 liveeventhealth mounts and shows a seeded event it resolved', async ({ page }) => {
    await loginAsEvtAdmin(page);
    await page.goto('/liveeventhealth', { waitUntil: 'domcontentloaded' });

    const host = page.locator('app-live-event-health');
    await expect(
      host,
      'EVT-17: the health screen must mount — if this fails on a correct URL, check the /liveeventhealth ' +
      'grant in events/seed-events.js ROUTES (authGuard denies unlisted screens)',
    ).toBeAttached({ timeout: 30_000 });

    expect(
      seededEventName,
      `EVT-17: the events seed must provide "${EVENT1_NAME}" in \`event collection\` — the render ` +
      'assertion below needs it, and falling back to another suite\'s event would make this case depend ' +
      'on run order.',
    ).toBe(EVENT1_NAME);

    // [REAL-UI] The event name is NOT on the page at load. The picker is a mat-autocomplete whose options
    // render `e.name` from the component's own `event collection` read (component.html:4-17), and an
    // autocomplete panel only materialises once the input is focused/typed into. The old assertion looked
    // for the name in the host's static text, which never contained it — the screen at rest shows only
    // "Live Events Dashboard" and the empty "Select or Search Event" field.
    //
    // Typing the name also drives the component's OWN filter (ts:297-312), so a matching option is
    // evidence the component read the event AND matched it — still the app's value, not ours.
    const eventInput = host.getByRole('combobox').first();
    await expect(eventInput, 'EVT-17: the event search input must render').toBeVisible({ timeout: 30_000 });
    // FOCUS, DO NOT CLICK. The floating <mat-label> "Select or Search Event" sits inside the notched
    // outline directly over the input, so a plain click is intercepted by the label and retries until the
    // test times out (this is the same interception _shared/mat-select.ts exists to work around). An input
    // does not need a click to open its autocomplete — focus plus real keystrokes is enough, and avoids
    // the force-click that would skip actionability entirely.
    await eventInput.focus();
    // pressSequentially, not fill(): the filter is driven by valueChanges on real key events, and fill()
    // sets the value in one shot without the keystrokes the autocomplete opens on.
    await eventInput.pressSequentially(EVENT1_NAME, { delay: 20 });

    await expect(
      page.getByRole('option', { name: EVENT1_NAME, exact: true }).first(),
      `EVT-17: the seeded event "${EVENT1_NAME}" must appear as an option the component resolved from ` +
      'its own `event collection` read',
    ).toBeVisible({ timeout: 30_000 });
  });
});
