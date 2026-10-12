// zoom-backup-verify.spec.ts — /zoom-recording-dashboard: backup VERIFY, VERIFY ALL and MOVE TO ZOOM TRASH
// (starlabs-angular charan-release 2026-10-05, plan specs/plans/2026-10-02-zoom-backup-reliability.md Phase 4).
//
// Hook prefix: zrd — ZoomRecordingDashboardComponent (same prefix communication-center-controls-addressable uses).
// Reference: starlabs-angular specs/journals/2026-10-02-zoom-backup-reliability.md.
//
// SEEDED WORLD (comms/seed-comms.js §4), all startTime = today:
//   Completed Meeting  — completed, never verified          → trash BLOCKED ("Verify the backup first")
//   Failed Meeting     — failed                             → trash BLOCKED ("Only a completed backup…")
//   Verified Meeting   — completed + verification.ok + its meetinguid is in Zoom → the ONLY trashable row
//
// THE ZOOM-TO-DROPBOX SERVER IS STUBBED. The emulator build has no zoomMigrationApiUrl, so the dashboard calls
// relative /api/zoom/* on the app origin; page.route answers them. No Zoom or Dropbox call can leave the test,
// and nothing is ever trashed for real. What is asserted is the APP's side: which rows it allows to be trashed
// (its own gate over the seeded docs + the presence list), the exact docIds it sends, and how it renders the
// server's answers (verify message, verify-all tallies + problem list, trash result).
//
// ZRD-05..07 (Retry + duplicate cleanup): Retry is offered only on a failed / partial / verify_failed / stalled
// row (the Failed row here — never the completed ones); a server answer of `duplicate_removed` raises a page
// notice whose "View backup" opens the record that holds the full backup (keptDocId), and Verify all counts
// removed leftovers separately from verified.
//
// ZRD-08/09 (live cost rates): the cost line shows the server's USD→INR + egress price when /api/cost-rates
// answers (values the stub chose, distinct from the app's fallback constants) and "(fallback rate)" otherwise.
//
// ZRD-10 (sortable "In Zoom" column): one seeded row per presence state — Verified (its uuid is in the stubbed Zoom
// listing → In Zoom), Completed (uuid NOT listed → Not in Zoom), Failed (no uuid → unknown). Ascending must give
// In Zoom → Not in Zoom → unknown, and the second click the reverse; the default date order differs from both.
//
// NOT COVERED: the server itself (claims, heartbeats, re-upload) — that lives in zoom-dropbox-migration/; the
// "Queued…" migrate state (needs the Zoom panel's live recordings list).
import { test, expect, Page, Route } from '@playwright/test';
import { installCommsStubs, loginAsCommsAdmin, commsIds } from './support/comms';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const RUN = process.env.COMM_RUNID || 'comm';
const TOPIC = { done: `Completed Meeting ${RUN}`, fail: `Failed Meeting ${RUN}`, ok: `Verified Meeting ${RUN}` };

let guard: ConsoleGuard;
let calls: { path: string; body: any }[];
/** Per-test server behaviour for the duplicate-cleanup paths (ZRD-06/07); reset in stubZoomApi. */
let mode: { retry: 'queued' | 'duplicate'; batchDuplicateOf?: string; costRates: 'down' | 'live' };

/** Stub the zoom-to-dropbox API. `recordings` lists only the verified meeting as still present in Zoom. */
async function stubZoomApi(page: Page) {
  calls = [];
  mode = { retry: 'queued', costRates: 'down' };
  // /api/cost-rates (live FX + egress price). 'down' = server unreachable → the app must fall back.
  await page.route('**/api/cost-rates', (route: Route) => mode.costRates === 'live'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        usdToInr: 88.25, rateDate: '2026-10-05', rateSource: 'TEST-FX', egressUsdPerGb: 0.08,
        fetchedAt: new Date().toISOString(), stale: false }) })
    : route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' }));
  await page.route('**/api/zoom/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const body = route.request().postDataJSON?.() ?? null;
    calls.push({ path: url.pathname, body });
    const json = (o: any, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
    const okVerification = { ok: true, checkedAt: new Date().toISOString(), folderExists: true, zoomPresent: true, files: {}, zoomMissing: [] };
    switch (url.pathname) {
      case '/api/zoom/recordings':
        return json({ recordings: [{ uuid: `${RUN}_uuid_verified`, meetingId: 'zz-not-a-seeded-id' }] });
      case '/api/zoom/verify':
        return json({ success: true, status: 'completed', verification: okVerification });
      case '/api/zoom/verify-batch':
        return json({
          success: true,
          results: (body?.docIds ?? []).map((id: string) => id === commsIds.ZOOM_FAIL
            ? { docId: id, topic: TOPIC.fail, result: 'failed', problems: ['audio: missing in Dropbox'] }
            : id === mode.batchDuplicateOf
              ? { docId: id, topic: id, result: 'duplicate_removed', problems: [] }
              : { docId: id, topic: id, result: 'verified', problems: [] }),
        });
      case '/api/zoom/retry':
        return json(mode.retry === 'duplicate'
          ? { success: true, status: 'duplicate_removed', keptDocId: commsIds.ZOOM_VERIFIED }
          : { success: true, status: 'queued', dispatch: 'task' });
      case '/api/zoom/trash':
        return json({ success: true, verification: okVerification });
      default:
        return json({ error: 'unexpected' }, 404);
    }
  });
}

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  await installCommsStubs(page);
  await stubZoomApi(page);
  await loginAsCommsAdmin(page);
  await page.goto('/zoom-recording-dashboard', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('zrd-search').fill(`Meeting ${RUN}`);
  await expect(page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: TOPIC.ok }), 'the seeded rows render').toHaveCount(1, { timeout: 30_000 });
});
test.afterEach(() => assertNoFatal(guard, 'zoom backup verify: no fatal console errors / pageerrors'));

const rowOf = (page: Page, topic: string) => page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: topic });

test.describe('Comms — Zoom backup verify / verify all / move to Zoom trash (server stubbed)', () => {
  test('ZRD-01 only a completed, verified backup still in Zoom can be moved to trash; the others say why', async ({ page }) => {
    await expect(rowOf(page, TOPIC.ok).getByTestId('zrd-trash-row'), 'ZRD-01: the verified row is trashable').toBeEnabled({ timeout: 30_000 });
    await expect(rowOf(page, TOPIC.ok), 'ZRD-01: …and shows ✓ verified').toContainText('✓ verified');
    const done = rowOf(page, TOPIC.done).getByTestId('zrd-trash-row');
    await expect(done, 'ZRD-01: an unverified backup is blocked').toBeDisabled();
    await expect(done).toHaveAttribute('title', /Verify the backup first/);
    const fail = rowOf(page, TOPIC.fail).getByTestId('zrd-trash-row');
    await expect(fail, 'ZRD-01: a failed backup is blocked').toBeDisabled();
    await expect(fail).toHaveAttribute('title', /Only a completed backup/);
  });

  test('ZRD-02 Verify backup posts the record id and reports the server\'s verdict', async ({ page }) => {
    await rowOf(page, TOPIC.done).getByTestId('zrd-openfilemodel').click();
    await page.getByTestId('zrd-verify').click();
    await expect(page.getByText('All files are in Dropbox with the exact size Zoom reports.'), 'ZRD-02: the ok verdict is shown').toBeVisible();
    expect(calls.find((c) => c.path === '/api/zoom/verify')?.body, 'ZRD-02: it verified THIS record').toEqual({ docId: commsIds.ZOOM_DONE });
    await expect(page.getByTestId('zrd-trash'), 'ZRD-02: the modal\'s trash stays blocked until the doc itself is verified').toBeDisabled();
  });

  test('ZRD-03 Verify all sends every listed record and tallies verified / failed with the problem text', async ({ page }) => {
    await expect(page.getByTestId('zrd-verifyall'), 'ZRD-03: three listed targets').toContainText('Verify all (3)');
    await page.getByTestId('zrd-verifyall').click();
    await expect(page.getByText('✓ 2 verified'), 'ZRD-03: two verified').toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('⚠ 1 failed'), 'ZRD-03: one failed').toBeVisible();
    await expect(page.getByText(`⚠ ${TOPIC.fail} — audio: missing in Dropbox`), 'ZRD-03: the failure names the meeting and the problem').toBeVisible();
    const sent = calls.filter((c) => c.path === '/api/zoom/verify-batch').flatMap((c) => c.body?.docIds ?? []).sort();
    expect(sent, 'ZRD-03: exactly the three listed records were sent').toEqual([commsIds.ZOOM_DONE, commsIds.ZOOM_FAIL, commsIds.ZOOM_VERIFIED].sort());
    await expect(page.getByTestId('zrd-verifyall-stop'), 'ZRD-03: Stop is only offered while running').toHaveCount(0);
  });

  test('ZRD-04 Move to Zoom trash asks first, then trashes ONLY the confirmed record', async ({ page }) => {
    let prompted = '';
    page.once('dialog', async (d) => { prompted = d.message(); await d.dismiss(); });
    await rowOf(page, TOPIC.ok).getByTestId('zrd-trash-row').click();
    await expect.poll(() => prompted, { message: 'ZRD-04: a confirm names the meeting' }).toContain(TOPIC.ok);
    expect(calls.some((c) => c.path === '/api/zoom/trash'), 'ZRD-04: dismissing the confirm sends nothing').toBe(false);

    page.once('dialog', (d) => d.accept());
    await rowOf(page, TOPIC.ok).getByTestId('zrd-trash-row').click();
    await expect(rowOf(page, TOPIC.ok), 'ZRD-04: the row reports the result').toContainText('Moved to Zoom trash.');
    expect(calls.filter((c) => c.path === '/api/zoom/trash').map((c) => c.body), 'ZRD-04: one trash call, for this record').toEqual([{ docId: commsIds.ZOOM_VERIFIED }]);
  });

  test('ZRD-05 Retry is offered only on the failed row, posts that record and reports it queued', async ({ page }) => {
    await expect(rowOf(page, TOPIC.done).getByTestId('zrd-retry-row'), 'ZRD-05: no Retry on a completed backup').toHaveCount(0);
    await expect(rowOf(page, TOPIC.ok).getByTestId('zrd-retry-row'), 'ZRD-05: no Retry on a verified backup').toHaveCount(0);
    await rowOf(page, TOPIC.fail).getByTestId('zrd-retry-row').click();
    await expect(rowOf(page, TOPIC.fail), 'ZRD-05: the row reports the restart').toContainText('Queued — the backup restarts shortly');
    expect(calls.filter((c) => c.path === '/api/zoom/retry').map((c) => c.body), 'ZRD-05: one retry, for the failed record').toEqual([{ docId: commsIds.ZOOM_FAIL }]);
  });

  test('ZRD-06 a Retry that finds a leftover duplicate raises a page notice whose View backup opens the kept record', async ({ page }) => {
    mode.retry = 'duplicate';
    await rowOf(page, TOPIC.fail).getByTestId('zrd-retry-row').click();
    await expect(page.getByText(`Removed a leftover duplicate of "${TOPIC.fail}"`), 'ZRD-06: the page notice names the meeting').toBeVisible();
    await page.getByTestId('zrd-notice-view').click();
    await expect(page.locator('.modal-head h2'), 'ZRD-06: View backup opens the record that holds the full backup').toHaveText(TOPIC.ok);
    await page.getByTestId('zrd-closefilemodel-2').click();
    await expect(page.locator('.modal-head h2'), 'ZRD-06: the modal closes').toHaveCount(0);
    await page.getByTestId('zrd-notice-close').click();
    await expect(page.getByText(`Removed a leftover duplicate of "${TOPIC.fail}"`), 'ZRD-06: the notice dismisses').toHaveCount(0);
  });

  test('ZRD-07 Verify all counts removed leftover duplicates apart from verified ones', async ({ page }) => {
    mode.batchDuplicateOf = commsIds.ZOOM_DONE;
    await page.getByTestId('zrd-verifyall').click();
    await expect(page.getByText('1 leftover duplicate(s) removed'), 'ZRD-07: the duplicate is counted as removed').toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('✓ 1 verified'), 'ZRD-07: …and not as verified').toBeVisible();
    await expect(page.getByText('⚠ 1 failed')).toBeVisible();
  });

  test('ZRD-08 with the cost-rate server down, the cost line says it is using the fallback rate', async ({ page }) => {
    const basis = page.locator('.cost-basis');
    await expect(basis, 'ZRD-08: fallback is announced').toContainText('(fallback rate)');
    await expect(basis, 'ZRD-08: …and the live source is not claimed').not.toContainText('TEST-FX');
    await expect(basis).not.toContainText('live rate');
  });

  test('ZRD-09 a live cost-rate answer replaces the fallback FX rate and egress price on the cost line', async ({ page }) => {
    mode.costRates = 'live';
    await page.reload({ waitUntil: 'domcontentloaded' });
    const basis = page.locator('.cost-basis');
    await expect(basis, 'ZRD-09: the server\'s USD→INR rate').toContainText('₹88.25/$', { timeout: 30_000 });
    await expect(basis, 'ZRD-09: the server\'s egress price').toContainText('$0.08/GB');
    await expect(basis, 'ZRD-09: marked live, with the rate date').toContainText('(live rate, Oct 5)');
    await expect(basis).not.toContainText('(fallback rate)');
  });

  test('ZRD-10 sorting by In Zoom orders In Zoom → Not in Zoom → unknown, and reverses on the second click', async ({ page }) => {
    const order = async () => (await page.locator('tr.mat-mdc-row, tr[mat-row]').allInnerTexts())
      .map((t) => [TOPIC.ok, TOPIC.done, TOPIC.fail].find((topic) => t.includes(topic)))
      .filter(Boolean);
    const header = page.getByRole('columnheader', { name: /In Zoom/ });
    // presence must be known before the sort means anything
    await expect(rowOf(page, TOPIC.done), 'ZRD-10: the completed row is marked Not in Zoom').toContainText('Not in Zoom', { timeout: 30_000 });
    await header.click();
    await expect.poll(order, { message: 'ZRD-10: ascending — In Zoom, then Not in Zoom, then unknown' }).toEqual([TOPIC.ok, TOPIC.done, TOPIC.fail]);
    await header.click();
    await expect.poll(order, { message: 'ZRD-10: descending — unknown first' }).toEqual([TOPIC.fail, TOPIC.done, TOPIC.ok]);
  });
});
