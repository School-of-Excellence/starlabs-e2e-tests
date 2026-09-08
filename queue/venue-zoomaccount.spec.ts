// venue-zoomaccount.spec.ts — /queuevenue + /zoomaccount render (REAL-UI, anti-circular).
//
// Recon: e2e/queue/recon/ (OP-14 / OP-15 — queue-system screens added by the 2026-09-04 coverage pass).
//
// WHY THIS FILE EXISTS: `queue system` sat at 6/16 opened routes — the largest remaining gap in the repo
// after the false-green modules were closed. These are the two cheapest flat routes in it: both are
// read-only list screens gated only by the generic authGuard, with no route params and no wizard to drive.
//
// Anti-circularity: each case asserts a value the COMPONENT rendered from its OWN Firestore read.
//   * /queuevenue  — getDocs(collection('queue generation')) (queue-venue.component.ts:44), then renders
//                    {{item.queuedata.queuename}} per radio button (html:47). The name comes off the doc
//                    the APP fetched; the test never puts it in the view.
//   * /zoomaccount — collectionData(query(collection('zoomaccount'), orderBy('lastname')))
//                    (zoom-account.component.ts:47) into a MatTable of {{row[element]}} cells (html:24).
//
// SEEDING NOTE: `queue generation` is already seeded by the shared queue seed, so OP-14 needs no new data —
// only the `dashboard` route grant added to DRIVEN_ROUTES. `zoomaccount` is NOT seeded anywhere, so OP-15
// seeds one doc HERE as a precondition (the same in-spec pattern big-analytics.spec.ts uses via
// seedBigWorld) and removes it afterwards, rather than growing the shared fixture for a single screen.
import { test, expect } from '@playwright/test';
import { QUEUE_NAME, actors } from './support/actors';
import { loginAs } from './support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs, ExternalStubs } from './stubs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fa = require('./support/firestore-admin');

const RUN = process.env.TESTRUNID || 'run1';
const ZOOM_DOC_ID = `${RUN}_zoomacct_0`;
const ZOOM_LASTNAME = `ZoomLast${RUN}`;
const ZOOM_EMAIL = `zoomacct+${RUN}@example.com`;

let guard: ConsoleGuard;
let stubs: ExternalStubs;

test.beforeAll(async () => {
  // [PRECONDITION] one zoomaccount row for OP-15. Tagged with the run id so it is unambiguous, and
  // removed in afterAll — the shared emulator teardown does not know this collection.
  await fa.db().collection('zoomaccount').doc(ZOOM_DOC_ID).set({
    docid: ZOOM_DOC_ID,
    email: ZOOM_EMAIL,
    firstname: 'ZoomFirst',
    lastname: ZOOM_LASTNAME,
    inuse: false,
    accounttype: 'licensed',
    testrunid: RUN,
    _testdata: true,
  });
});

test.afterAll(async () => {
  await fa.db().collection('zoomaccount').doc(ZOOM_DOC_ID).delete().catch(() => {});
});

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  stubs = installAllExternalStubs(page);
});

test.afterEach(() => assertNoFatal(guard, 'venue/zoomaccount: no fatal console errors / pageerrors'));

test.describe('Queue — venue + zoom-account list screens (real UI, anti-circular)', () => {
  // ===========================================================================================
  // OP-14 — /queuevenue renders the seeded queue name from its own `queue generation` read
  // ===========================================================================================
  test('OP-14 queuevenue lists the seeded queue from its own queue-generation read', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);
    await page.goto('/queuevenue', { waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('app-queue-venue'),
      'OP-14: queuevenue must mount — if this fails on a correct URL, check the /queuevenue dashboard ' +
      'grant in fixtures/seed-test-project.js DRIVEN_ROUTES (authGuard denies unlisted screens)',
    ).toBeVisible({ timeout: 30_000 });

    // The screen shows a spinner until the getDocs resolves (`loading` flag, html:23/27), and the queue
    // list is behind `hide == true` — which is the DEFAULT (component ts:35), so no interaction is needed.
    const radio = page.locator('app-queue-venue mat-radio-button').filter({ hasText: QUEUE_NAME });
    await expect(
      radio,
      `OP-14: the seeded queue "${QUEUE_NAME}" must render as an option built from the app's own ` +
      'getDocs(queue generation) — the test never writes this string into the view',
    ).toBeVisible({ timeout: 30_000 });

    // Cross-check against the collection the component read: the rendered option count must not exceed the
    // docs that exist. (Lower bound only — the screen lists every queue, not just this run's.)
    const queueDocs = await fa.countWhere('queue generation', []);
    const rendered = await page.locator('app-queue-venue mat-radio-button').count();
    expect(
      rendered,
      'OP-14: the app cannot render more queue options than there are queue-generation docs',
    ).toBeLessThanOrEqual(queueDocs);
    expect(rendered, 'OP-14: at least the seeded queue must render').toBeGreaterThanOrEqual(1);
  });

  // ===========================================================================================
  // OP-15 — /zoomaccount renders the seeded account from its ordered stream
  // ===========================================================================================
  test('OP-15 zoomaccount renders the seeded account row from its ordered stream', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);
    await page.goto('/zoomaccount', { waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('app-zoom-account'),
      'OP-15: zoomaccount must mount — check the /zoomaccount dashboard grant if this fails on a correct URL',
    ).toBeVisible({ timeout: 30_000 });

    // [REAL-UI] The table binds collectionData(query('zoomaccount', orderBy('lastname'))) into
    // {{row[element]}} cells for the declared columns (email / firstname / lastname / inuse / accounttype).
    // orderBy('lastname') means a doc WITHOUT a lastname would be dropped by Firestore — the seeded row
    // carries one, so its presence also proves the ordered query returned it.
    const row = page.locator('app-zoom-account tr.mat-mdc-row, app-zoom-account tr[mat-row]')
      .filter({ hasText: ZOOM_LASTNAME });
    await expect(
      row,
      `OP-15: the seeded zoom account "${ZOOM_LASTNAME}" must render in the table the app built from its ` +
      'orderBy(lastname) stream',
    ).toBeVisible({ timeout: 30_000 });

    // The same row must also render a DIFFERENT seeded field — a non-tautological signal that the row came
    // from the doc rather than from a single text match.
    expect(
      await row.innerText(),
      'OP-15: the rendered row must also show the seeded email from the same doc',
    ).toContain(ZOOM_EMAIL);
  });
});
