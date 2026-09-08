// planner-screens.spec.ts — /queue-planner + /queue-planner-review render (REAL-UI, anti-circular).
//
// Recon: e2e/queue/recon/ (OP-18 / OP-19 — queue-system screens added by the 2026-09-04 coverage pass).
//
// WHY THIS FILE EXISTS: the last two flat routes in `queue system` that a spec may legitimately open.
// (Of the rest: /viewrubrics_scoring_atc and both evolution-prep screens are ATC readers and now
// denylisted; /arena/:queueid/:stage and /openmeeting/:id/:collectiontype take route params.)
//
// SEEDING: both screens read ~20 collections between them, most of which the shared queue seed does not
// write. That is fine and is the point of the assertion chosen here — the QUEUE PICKER each screen builds
// on load comes from `queue generation`, which IS seeded, while the downstream panels (cohorts queue
// planner, participant list, segments, email archive, wati archive, ...) simply render empty. So these
// cases needed a dashboard route grant and NO new fixture data. Asserting the picker keeps the cases
// honest about what is actually seeded rather than pretending the planner has a populated world.
//
// Anti-circularity: each case asserts the seeded queue NAME rendered in the list the component built from
// its own `queue generation` read (queue-planning html:18 / queue-planning-review html:19). The test never
// writes that string into the view, and the name comes off a doc the app fetched.
import { test, expect } from '@playwright/test';
import { QUEUE_NAME, actors, loginAs } from './support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs, ExternalStubs } from './stubs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fa = require('./support/firestore-admin');

let guard: ConsoleGuard;
let stubs: ExternalStubs;

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  stubs = installAllExternalStubs(page);
});

test.afterEach(() => assertNoFatal(guard, 'planner screens: no fatal console errors / pageerrors'));

/**
 * Both planners share the same shape: a heading, a queue picker fed by `queue generation`, and panels that
 * stay empty without their (unseeded) downstream collections. Drive them identically.
 */
async function assertQueuePickerRendersSeededQueue(
  page: import('@playwright/test').Page,
  host: string,
  caseId: string,
): Promise<void> {
  await expect(
    page.locator(host),
    `${caseId}: ${host} must mount — if this fails on a correct URL, check the dashboard route grant in ` +
    'fixtures/seed-test-project.js DRIVEN_ROUTES (authGuard denies unlisted screens)',
  ).toBeVisible({ timeout: 30_000 });

  // [REAL-UI] The picker renders one entry per `queue generation` doc the COMPONENT read. The seeded queue
  // must appear by name. Scoped to the host so it cannot match a heading elsewhere on the page.
  await expect(
    page.locator(host).getByText(QUEUE_NAME, { exact: false }).first(),
    `${caseId}: the seeded queue "${QUEUE_NAME}" must render in the picker the app built from its own ` +
    'queue-generation read',
  ).toBeVisible({ timeout: 60_000 });
}

test.describe('Queue — planner screens (real UI, anti-circular)', () => {
  // ===========================================================================================
  // OP-18 — /queue-planner
  // ===========================================================================================
  test('OP-18 queue-planner renders the seeded queue in its picker', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);
    await page.goto('/queue-planner', { waitUntil: 'domcontentloaded' });
    await assertQueuePickerRendersSeededQueue(page, 'app-queue-planning', 'OP-18');

    // Cross-check against the collection the component read: it cannot list more queues than exist.
    const queueDocs = await fa.countWhere('queue generation', []);
    expect(queueDocs, 'OP-18: the queue-generation collection must be seeded').toBeGreaterThanOrEqual(1);
  });

  // ===========================================================================================
  // OP-19 — /queue-planner-review (the merged view over the same picker)
  // ===========================================================================================
  test('OP-19 queue-planner-review renders the seeded queue in its picker', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);
    await page.goto('/queue-planner-review', { waitUntil: 'domcontentloaded' });
    await assertQueuePickerRendersSeededQueue(page, 'app-queue-planning-review', 'OP-19');

    // The review screen's heading is its own ("Queue Planning - Merged View", html:4) — assert it so the
    // case cannot pass against the sibling planner if a route ever mis-resolves.
    await expect(
      page.locator('app-queue-planning-review').getByText(/Merged View/i).first(),
      'OP-19: the merged-view heading must render (proves this is the review screen, not the planner)',
    ).toBeVisible({ timeout: 30_000 });
  });
});
