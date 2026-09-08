// openmeeting.spec.ts — /openmeeting/:id/:collectiontype render (REAL-UI, anti-circular).
//
// Recon: e2e/queue/recon/ (OP-22 — the LAST uncovered `queue system` route).
//
// ⚠ HARD CONSTRAINT — DO NOT CLICK THE "Prescribe ATC" BUBBLE.
// This screen renders a host-only bubble whose handler does
// `window.open('/dynamicstudio?step=prescribe-atc')` (zoom-clientview.component.ts:1204).
// /dynamicstudio is on the D-001 denylist, and the popup opens in a SECOND WINDOW where
// assertNotExcluded() cannot see it — so a click would reach ATC data with no guardrail firing. The
// screen is testable; that control is not. See the ADJACENT-BUT-IN-SCOPE block in
// _support/excluded-routes.ts. Nothing below clicks anything.
//
// HOW THE ROUTE WORKS: `:collectiontype` is mapped to a collection — 'queue' -> `live assignment`,
// 'appointment' -> `appointments` (ts:151-154) — and `:id` is a document id in it. The component then
// getDoc()s that document and BRANCHES on existence (ts:156-165). Both cases below assert the branch the
// APP chose after its own read, never a value the test rendered.
//
// The dashboard grant is the bare '/openmeeting' — authGuard matches the first path segment only.
import { test, expect } from '@playwright/test';
import { actors, loginAs } from './support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs, ExternalStubs } from './stubs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fa = require('./support/firestore-admin');

let guard: ConsoleGuard;
let stubs: ExternalStubs;
let liveAssignmentId: string;

test.beforeAll(async () => {
  const rows = await fa.queryWhere('live assignment', []);
  expect(rows.length, 'precondition: the queue seed must write at least one `live assignment`')
    .toBeGreaterThan(0);
  liveAssignmentId = String(rows[0].id);
});

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  // The zoom stub matters here: installAllExternalStubs also installs the no-real-window guard, so nothing
  // this screen does can escape into a real Zoom popup.
  stubs = installAllExternalStubs(page);
});

test.afterEach(() => assertNoFatal(guard, 'openmeeting: no fatal console errors / pageerrors'));

test.describe('Queue — open-meeting client view (real UI, anti-circular)', () => {
  // ===========================================================================================
  // OP-22 — an id with no document makes the APP choose its 'notfound' branch
  // ===========================================================================================
  test('OP-22 openmeeting renders the app-chosen invalid-link state for a missing document', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);

    // A syntactically valid id that deliberately has NO document. The component maps collectiontype
    // 'queue' -> `live assignment`, reads that id, and on !snap.exists() sets
    // meetingEnded = true / endedReason = 'notfound' (ts:159-165) — a state the APP decided from its own
    // read. Confirm the absence via admin first so the case cannot pass because of a typo'd collection.
    const missingId = `${Date.now()}_no_such_live_assignment`;
    const absent = await fa.getDoc('live assignment', missingId);
    expect(absent, 'OP-22 precondition: the probe id must genuinely have no document').toBeNull();

    await page.goto(`/openmeeting/${missingId}/queue`, { waitUntil: 'domcontentloaded' });

    const host = page.locator('app-zoom-clientview');
    await expect(
      host,
      'OP-22: the client view must mount — if this fails on a correct URL, check the bare "/openmeeting" ' +
      'dashboard grant in fixtures/seed-test-project.js DRIVEN_ROUTES',
    ).toBeAttached({ timeout: 30_000 });

    // [ASSERT] the branch the app picked. This exact copy is only reachable via endedReason === 'notfound'
    // (html:44), so it cannot be produced by any other state of the screen.
    await expect(
      host.getByText(/This meeting link is no longer valid/i),
      'OP-22: the app must render its notfound branch after finding no live-assignment document',
    ).toBeVisible({ timeout: 30_000 });
  });

  // ===========================================================================================
  // OP-23 — a REAL seeded live assignment takes the app down its document-found path instead
  // ===========================================================================================
  test('OP-23 openmeeting does NOT show the invalid-link state for a real live assignment', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);

    await page.goto(`/openmeeting/${liveAssignmentId}/queue`, { waitUntil: 'domcontentloaded' });

    const host = page.locator('app-zoom-clientview');
    await expect(host, 'OP-23: the client view must mount').toBeAttached({ timeout: 30_000 });

    // [ASSERT] the OPPOSITE branch of OP-22, which is what makes the pair meaningful: with a document that
    // exists, the app must NOT choose 'notfound'. Asserting the negative here rather than a specific
    // joined/waiting state is deliberate — which card renders next depends on the assignment's status and
    // on the Zoom SDK, and pinning that would be asserting the stub's behaviour rather than the app's
    // decision. The two cases together prove the existence check actually drives the UI.
    await expect(
      host.getByText(/This meeting link is no longer valid/i),
      'OP-23: a real live-assignment id must NOT produce the notfound state',
    ).toHaveCount(0, { timeout: 30_000 });
  });
});
