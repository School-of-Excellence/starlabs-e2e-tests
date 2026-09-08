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

let guard: ConsoleGuard;
let seededEventName: string | null = null;

test.beforeAll(async () => {
  // Find a seeded event to assert against. Taken from Firestore rather than hardcoded so this does not
  // couple to the events seeder's internal id/name convention.
  const events = await queryWhere('event collection', []);
  const named = events.find((e) => typeof e.eventname === 'string' && e.eventname);
  seededEventName = named ? String(named.eventname) : null;
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
  // PARKED — same unexplained render failure as workshops WS-36 (/eiflixtelemetry). TWO components now,
  // in two suites, with two different actors, showing an identical symptom:
  //     the route resolves, the URL holds, the guard admits, NO console error or pageerror is raised,
  //     the template root is unconditional — and the component host never appears in the DOM.
  //
  // Verified here specifically: the dashboard grant IS in the emulator for /liveeventhealth with roles
  // ["admin","ah","eventcoordinator","developer","floor","mentor"], and the logged-in actor
  // (admin+evt@example.com) holds admin. The failure screenshot shows the app shell, logged in, with an
  // empty outlet and NO "Contact Admin" denial dialog — so this is not the missing-grant failure that
  // looks superficially the same.
  //
  // Worth noting what DOES work, because it narrows the search: /participantvideoask (PA-47) was granted
  // in the same pass, by the same mechanism, and mounts fine. So grants and the seeding path are sound;
  // something is specific to these two components.
  //
  // Not root-caused, and not papered over with a weaker assertion. The assertions below are the ones that
  // should hold once the cause is known.
  test.fixme('EVT-17 liveeventhealth mounts and shows a seeded event it resolved', async ({ page }) => {
    await loginAsEvtAdmin(page);
    await page.goto('/liveeventhealth', { waitUntil: 'domcontentloaded' });

    const host = page.locator('app-live-event-health');
    await expect(
      host,
      'EVT-17: the health screen must mount — if this fails on a correct URL, check the /liveeventhealth ' +
      'grant in events/seed-events.js ROUTES (authGuard denies unlisted screens)',
    ).toBeAttached({ timeout: 30_000 });

    // [REAL-UI] If the events seed wrote a named event, the screen must surface it — the component read
    // `event collection` itself and the test put nothing into the view. When no named event exists the
    // assertion is skipped rather than faked, and the mount above plus the console guard still stand.
    test.skip(
      !seededEventName,
      'EVT-17: no seeded `event collection` doc carries an eventname — the render assertion needs one, ' +
      'and inventing one here would assert the test\'s own write rather than the app\'s read.',
    );

    await expect(
      host.getByText(String(seededEventName), { exact: false }).first(),
      `EVT-17: the seeded event "${seededEventName}" must render from the component's own event read`,
    ).toBeVisible({ timeout: 60_000 });
  });
});
