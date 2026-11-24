// participant-videoask.spec.ts — /participantvideoask (REAL-UI).
//
// Recon: e2e/recon-allcomp/profiles-analytics.md (PA-47 — route assigned to this suite 2026-09-08).
//
// The module was unclaimed by any suite until this pass: a change to src/app/participant-videoask/**
// routed ZERO gates. It now belongs to profiles.
//
// SCOPE: a mount + empty-state case, labelled as one. The screen reads `arenavideoask`,
// `event collection`, `participant tags` and `participant tag logs`; this suite seeds none of them, so it
// renders its empty state. That is worth pinning because it proves the screen does not THROW on absent
// data — the failure mode that took /bigProfile and /bigchatscreen down elsewhere in this branch, both
// found only once someone finally opened the route.
//
// PA-48..PA-50 (2026-11-24) — productref. seed-profiles.js §3c seeds a productref world: P_VA (delivery
// sequence has an arenavideoask step), P_NOVA (negative control: appointmenttype step only), a mapping with
// no deliverysequence, and four participantvideoask rows (productref only, workshopref+productref,
// workshopref only, productref -> P_NOVA).
//
// PA-51 (2026-11-24) — signed-URL migration M-5: rows play only the Publitio 480p file (hls.id);
// fileurl (now a Storage path) is never a video source; the old "Not converted yet" text is gone.
// PA-52 (2026-11-24) — converted rows show only the video; unconverted rows show ONE status line + Retry (read-only).
// PA-53 (2026-11-24) — a failed row: "Conversion failed", hlserror on hover, Retry; a Retry on a row whose
// status changed meanwhile shows pva-retry-error and writes nothing.
//
// Hook prefix: pva (app-participant-videoask).
import { test, expect, Page } from '@playwright/test';
import { installProfileStubs, loginAsProfileAdmin, setVideoAskFields, getVideoAskDoc } from './support/profiles';
const { TESTRUNID, ID } = require('./seed-profiles');
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

let guard: ConsoleGuard;

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  await installProfileStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'participant-videoask: no fatal console errors / pageerrors'));

test.describe('Profiles — participant videoask (real UI)', () => {
  // ===========================================================================================
  // PA-47 — /participantvideoask mounts over its four unseeded reads
  // ===========================================================================================
  test('PA-47 participantvideoask mounts without throwing on empty collections', async ({ page }) => {
    await loginAsProfileAdmin(page);
    await page.goto('/participantvideoask', { waitUntil: 'domcontentloaded' });

    await expect(
      page.locator('app-participant-videoask'),
      'PA-47: the screen must mount — if this fails on a correct URL, check the /participantvideoask ' +
      'grant in profiles/seed-profiles.js ROUTES (authGuard denies unlisted screens)',
    ).toBeAttached({ timeout: 30_000 });

    // The afterEach console guard is what gives this case its teeth: mounting proves the route resolves,
    // and a clean console proves none of the four reads threw on an absent collection.
    await expect(
      page.locator('app-participant-videoask'),
      'PA-47: the screen must still be attached once its reads settle',
    ).toBeAttached({ timeout: 30_000 });
  });

  // ===========================================================================================
  // PA-48..PA-50 — productref: Product filter options, OR with the event group, every ref shown
  // ===========================================================================================
  const VA_PRODUCT = `TEST VA Product ${TESTRUNID}`;
  const NOVA_PRODUCT = `TEST NoVA Product ${TESTRUNID}`;
  const VA_WORKSHOP = `TEST VA Workshop ${TESTRUNID}`;

  async function openScreen(page: Page) {
    await loginAsProfileAdmin(page);
    await page.goto('/participantvideoask', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Showing newest \d+/), 'bootstrap + default load must finish').toBeVisible({ timeout: 60_000 });
  }

  /**
   * The table pages at 5 rows by default (pageSizeOptions [5,10,25,50,100]); the default load holds 7 seeded
   * rows (PA-48..50's four + PVA_HLS, PVA_NOHLS, PVA_FAILED), so rows 6–7 sit on page 2. The status cases
   * need every seeded row on screen: pick 100 rows per page through the real paginator control.
   */
  async function showAllRows(page: Page) {
    // Material puts a transparent .mat-mdc-paginator-touch-target over the page-size select (a larger tap
    // area); it is what a real click lands on, and it intercepts pointer events on the mat-select itself.
    await page.locator('app-participant-videoask mat-paginator .mat-mdc-paginator-touch-target').click();
    await page.getByRole('option', { name: '100', exact: true }).click();
    await expect(page.locator('app-participant-videoask mat-paginator mat-select'),
      'page size switched to 100').toContainText('100');
  }

  test('PA-48 Product filter offers only products with a videoask step in their delivery sequence', async ({ page }) => {
    await openScreen(page);
    await page.getByTestId('pva-product').click();
    await expect(page.getByRole('option', { name: VA_PRODUCT }), 'PA-48: P_VA has an arenavideoask step').toBeVisible();
    await expect(page.getByRole('option', { name: NOVA_PRODUCT }), 'PA-48: P_NOVA has no videoask step').toHaveCount(0);

    await page.getByTestId('pva-type-to-search-6').fill('NoVA');
    await expect(page.getByRole('option', { name: VA_PRODUCT }), 'PA-48: search narrows the product options').toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  test('PA-49 Event cell shows every reference a row carries', async ({ page }) => {
    await openScreen(page);
    const bothRow = page.locator('tr')
      .filter({ has: page.getByTestId('pva-eventref').filter({ hasText: `${VA_WORKSHOP} (Workshop)` }) })
      .filter({ has: page.getByTestId('pva-eventref').filter({ hasText: `${VA_PRODUCT} (Product)` }) });
    await expect(bothRow, 'PA-49: the workshopref+productref row lists both refs').toHaveCount(1);
    await expect(
      page.getByTestId('pva-eventref').filter({ hasText: `${VA_PRODUCT} (Product)` }),
      'PA-49: the productref-only row and the workshop+product row both name the product',
    ).toHaveCount(2);
    // P_NOVA is not a videoask product, so it is never loaded: shown as-is, by its raw id.
    await expect(
      page.getByTestId('pva-eventref').filter({ hasText: `${TESTRUNID}_P_NOVA (Product)` }),
      'PA-49: a product outside the videoask set shows its raw id',
    ).toHaveCount(1);
  });

  test('PA-50 Product filter ORs with Workshop', async ({ page }) => {
    await openScreen(page);

    // Product alone: the productref-only row and the workshop+product row.
    await page.getByTestId('pva-product').click();
    await page.getByRole('option', { name: VA_PRODUCT }).click();
    await page.keyboard.press('Escape');
    await page.getByTestId('pva-onsearch').click();
    await expect(page.getByText('Loaded 2 videos'), 'PA-50: product filter alone').toBeVisible({ timeout: 30_000 });

    // + Workshop: OR adds the workshop-only row; the P_NOVA row stays out.
    await page.getByTestId('pva-workshop').click();
    await page.getByRole('option', { name: VA_WORKSHOP }).click();
    await page.keyboard.press('Escape');
    await page.getByTestId('pva-onsearch').click();
    await expect(page.getByText('Loaded 3 videos'), 'PA-50: product OR workshop').toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByTestId('pva-eventref').filter({ hasText: NOVA_PRODUCT }),
      'PA-50: the P_NOVA row matches neither filter',
    ).toHaveCount(0);
  });

  // ===========================================================================================
  // PA-51 — signed-URL migration (M-5): play ONLY the Publitio 480p (hls.id) file, never fileurl
  // ===========================================================================================
  // seed-profiles.js §3c adds PVA_HLS (Storage path + hls.id) and PVA_NOHLS (Storage path, no hls).
  // fileurl is a bare Storage path now — if the screen ever put it in <source>, the browser would request
  // it relative to the app origin. Publitio is stubbed so the case never leaves the emulator network.
  test('PA-51 plays the HLS file; a Storage path is never used as the video source', async ({ page }) => {
    await page.route('https://media.publit.io/**', (route) =>
      route.fulfill({ status: 200, contentType: 'video/mp4', body: '' }));
    await openScreen(page);
    await showAllRows(page);

    await expect(page.getByTestId('pva-playvideo'), 'PA-51: only the converted row offers Play').toHaveCount(1);
    await expect(page.getByText('Not converted yet'), 'PA-51: the old duplicate text is gone').toHaveCount(0);

    await page.getByTestId('pva-playvideo').click();
    const source = page.locator('app-participant-videoask video source');
    await expect(source, 'PA-51: clicking Play mounts the player').toHaveCount(1);
    await expect(source, 'PA-51: the source is the Publitio 480p file built from hls.id')
      .toHaveAttribute('src', `https://media.publit.io/file/h_480/E2EHLS${TESTRUNID}.mp4`);
    await expect(page.locator('app-participant-videoask video source[src*="videoask/videoask/"]'),
      'PA-51: the Storage path in fileurl is never a video source').toHaveCount(0);
  });

  // ===========================================================================================
  // PA-52 — conversion status + Retry (M-5): Retry only where the record is not converted
  // ===========================================================================================
  // Read-only on purpose: clicking Retry writes hlsstatus and starts the videoAskHLS trigger, which
  // belongs to the CF unit tests and the manual test on starlabs-test, not to this UI suite.
  test('PA-52 shows the conversion status and offers Retry only on an unconverted record', async ({ page }) => {
    await page.route('https://media.publit.io/**', (route) =>
      route.fulfill({ status: 200, contentType: 'video/mp4', body: '' }));
    await openScreen(page);
    await showAllRows(page);

    const convertedCell = page.locator('td').filter({ has: page.getByTestId('pva-playvideo') });
    await expect(convertedCell, 'PA-52: the converted row').toHaveCount(1);
    await expect(convertedCell.getByTestId('pva-hlsstatus'), 'PA-52: a converted row shows only the video, no status text').toHaveCount(0);
    await expect(convertedCell.getByTestId('pva-retry'), 'PA-52: no Retry on a converted row').toHaveCount(0);

    // Unconverted rows with no status: PVA_NOHLS + the four PA-48..50 rows. (PVA_FAILED is PA-53's.)
    // Each shows ONE status line ("Not converted") and an enabled Retry — never a second text line.
    const pendingCells = page.locator('td').filter({
      has: page.getByTestId('pva-hlsstatus').filter({ hasText: /^\s*Not converted\s*$/ }),
    });
    await expect(pendingCells, 'PA-52: every unconverted row without a status shows "Not converted"').toHaveCount(5);
    for (const cell of await pendingCells.all()) {
      await expect(cell.getByTestId('pva-hlsstatus'), 'PA-52: exactly one status line').toHaveCount(1);
      await expect(cell.getByTestId('pva-hlsstatus')).toHaveText('Not converted');
      await expect(cell, 'PA-52: status + Retry and nothing else').toHaveText(/^\s*Not converted\s*Retry\s*$/);
      await expect(cell.getByTestId('pva-retry'), 'PA-52: Retry offered and enabled').toBeEnabled();
    }
  });

  // ===========================================================================================
  // PA-53 — failed conversion: status, hlserror on hover, Retry; a stale Retry shows pva-retry-error
  // ===========================================================================================
  // PVA_FAILED is seeded with hlsstatus 'failed' + hlserror and NO fileurl, so the real videoAskHLS trigger
  // in the emulator leaves it alone. The concurrent change below is a precondition write (admin SDK): it
  // stands in for "another admin / the function finished meanwhile". What is asserted is the APP's
  // behaviour: the Retry transaction re-reads the record, refuses, shows pva-retry-error and writes nothing.
  test('PA-53 shows a conversion failure with its error and Retry; a Retry on a changed record is refused', async ({ page }) => {
    const docId = ID.PVA_FAILED;
    const hlserror = `E2E forced failure ${TESTRUNID}`;
    await setVideoAskFields(docId, { hlsstatus: 'failed', hlserror });   // re-run safe precondition
    await openScreen(page);
    await showAllRows(page);

    const failedCell = page.locator('td').filter({
      has: page.getByTestId('pva-hlsstatus').filter({ hasText: 'Conversion failed' }),
    });
    await expect(failedCell, 'PA-53: exactly one failed row').toHaveCount(1);
    await expect(failedCell.getByTestId('pva-hlsstatus'), 'PA-53: one status line').toHaveCount(1);
    await expect(failedCell.getByTestId('pva-retry'), 'PA-53: Retry offered and enabled').toBeEnabled();
    await expect(failedCell.getByTestId('pva-retry-error'), 'PA-53: no error before a click').toHaveCount(0);

    // hlserror on hover (matTooltip on the status line).
    await failedCell.getByTestId('pva-hlsstatus').hover();
    await expect(page.locator('.mat-mdc-tooltip, .mdc-tooltip').filter({ hasText: hlserror }),
      'PA-53: hovering the status shows hlserror').toBeVisible({ timeout: 10_000 });

    // Meanwhile the record converts (status changes after this page loaded it).
    await setVideoAskFields(docId, { hlsstatus: 'success', hlserror: null });
    await failedCell.getByTestId('pva-retry').click();

    await expect(failedCell.getByTestId('pva-retry-error'), 'PA-53: the stale Retry is refused with a message')
      .toHaveText('Status changed — reload to see it', { timeout: 15_000 });
    expect((await getVideoAskDoc(docId))?.hlsstatus, 'PA-53: the app did NOT queue a retry').toBe('success');

    await setVideoAskFields(docId, { hlsstatus: 'failed', hlserror });   // leave the seed as found
  });
});
