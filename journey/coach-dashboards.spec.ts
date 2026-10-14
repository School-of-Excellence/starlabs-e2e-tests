// coach-dashboards.spec.ts — /opportunities + /sales-report render (REAL-UI, anti-circular).
//
// Recon: e2e/recon-allcomp/journey-products.md (JP-20 / JP-21 — 2026-09-08 coverage pass).
//
// WHY THESE TWO FIRST: journey was the largest remaining gap (9 routes). These are the two that read ONLY
// collections the seed already writes — `participantjourneyproduct` + `users_roles` for the opportunities
// dashboard, `journey` + `salesleads` for the sales report — so they need a dashboard grant and no new
// fixture data. Both were confirmed free of the external-service coupling that blocks two of journey's
// other routes (/onboarding-pipeline reads an external SalesCRM project; /overall-dashboard calls external
// Watson + SalesCRM endpoints).
//
// Anti-circularity: JP-20 is a true ORACLE — the screen tallies opportunities across every
// participantjourneyproduct document, and the test derives the same number independently through the Admin
// SDK. Two readers of the same data, and the test writes neither the tally nor the view.
import { test, expect } from '@playwright/test';
import { installJourneyStubs, attachJourneyGuard, loginAsJourneyAdmin, journeyNames, jcdAssuredLeads } from './support/journey';
import { assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { queryWhere } from '../queue/support/firestore-admin';

const RUN = process.env.JNY_RUNID || 'jny';

let guard: ConsoleGuard;

test.beforeEach(async ({ page }) => {
  guard = attachJourneyGuard(page);
  await installJourneyStubs(page);
});
// Per-test, tightly-anchored console patterns a case EXPECTS (JCD-05's deliberate failed-upload control).
let expectedErrors: RegExp[] = [];
test.beforeEach(() => { expectedErrors = []; });
test.afterEach(() => assertNoFatal(guard, 'coach dashboards: no fatal console errors / pageerrors', expectedErrors));

test.describe('Journey — coach dashboards (real UI, anti-circular)', () => {
  // ===========================================================================================
  // JP-20 — THE GAP: /opportunities is registered as a route but can only work as a dialog
  // ===========================================================================================
  //
  // JourneycoachOpportunitiesComponent injects MAT_DIALOG_DATA and MatDialogRef WITHOUT @Optional
  // (journeycoach-opportunities.component.ts:80-81). Those tokens only exist inside a MatDialog, so
  // routing to /opportunities throws before the component mounts:
  //     NullInjectorError: No provider for InjectionToken MatMdcDialogData
  // The route is registered (app.routes.ts) and now carries a dashboard grant, so the guard admits the
  // navigation and the screen then dies on injection — anyone opening this URL gets a blank page.
  //
  // `test.fail()` rather than skip, matching the convention content/content-upload-v2.spec.ts CN-20
  // already established for the identical defect in PlaylistConfigurationComponent: CI stays green while
  // the defect stands, and the day someone adds @Optional (or drops the route) this reports "expected to
  // fail, but passed" and forces the annotation off. The oracle below is written in full DELIBERATELY —
  // it is the assertion that should hold once the screen can mount, so the fix arrives with its test.
  test('JP-20 opportunities dashboard totals match an independent count of the source docs', async ({ page }) => {
    // Scoped INSIDE the test body on purpose. A bare `test.fail()` at describe scope applies to EVERY test
    // in the block — it marked JP-21 expected-to-fail too, and JP-21 passing was then reported as a
    // failure. Inside the body it annotates only this case.
    test.fail();

    // [ORACLE] The component sums `opportunities.length` over every row it renders, and buckets each entry
    // by name (journeycoach-opportunities.component.ts:181-194). Derive the same figures here from the
    // documents themselves — the test supplies neither the tally nor anything in the view.
    const docs = await queryWhere('participantjourneyproduct', []);
    const all = docs.flatMap((d) => (Array.isArray(d.opportunities) ? d.opportunities : []));
    const expected = {
      total: all.length,
      continuity: all.filter((o) => o === 'Continuity').length,
      upgrade: all.filter((o) => o === 'Upgrade').length,
    };

    await loginAsJourneyAdmin(page);
    await page.goto('/opportunities', { waitUntil: 'domcontentloaded' });

    const host = page.locator('app-journeycoach-opportunities');
    await expect(
      host,
      'JP-20: the dashboard must mount — if this fails on a correct URL, check the /opportunities grant in ' +
      'journey/seed-journey.js ROUTES (authGuard denies unlisted screens)',
    ).toBeAttached({ timeout: 30_000 });

    await expect(
      host.getByText(/Opportunities Dashboard/i).first(),
      'JP-20: the dashboard heading must render',
    ).toBeVisible({ timeout: 30_000 });

    // The four tiles the app computed. `.stat-number.available` holds the AVAILABLE figures in the order
    // total / continuity / upgrade (html:31, 49, 67).
    const tiles = host.locator('.stat-number.available');
    await expect(tiles.first(), 'JP-20: the stat tiles must render').toBeVisible({ timeout: 30_000 });

    await expect(
      tiles.nth(0),
      `JP-20: the total tile must equal the opportunities across all source docs (${expected.total})`,
    ).toHaveText(String(expected.total), { timeout: 30_000 });
    await expect(
      tiles.nth(1),
      `JP-20: the Continuity tile must equal the independently counted total (${expected.continuity})`,
    ).toHaveText(String(expected.continuity), { timeout: 30_000 });
    await expect(
      tiles.nth(2),
      `JP-20: the Upgrade tile must equal the independently counted total (${expected.upgrade})`,
    ).toHaveText(String(expected.upgrade), { timeout: 30_000 });
  });

  // ===========================================================================================
  // JP-21 — the sales report finishes loading and renders its own month label
  // ===========================================================================================
  //
  // SCOPE, stated plainly: this is a load-completion case, weaker than JP-20 above. The screen reads
  // `journey` + `salesleads` and renders a date-filtered report; the seeded leads are not dated to a fixed
  // month, so asserting a specific figure would pin the seed's clock rather than the app's arithmetic.
  // What IS asserted is that the loading state clears — the component holds a "Loading Dashboard.." panel
  // (html:4) until its reads resolve, so its disappearance proves both queries completed without throwing.
  test('JP-21 sales report clears its loading state and renders the report shell', async ({ page }) => {
    await loginAsJourneyAdmin(page);
    await page.goto('/sales-report', { waitUntil: 'domcontentloaded' });

    const host = page.locator('app-sales-dashboard-clone');
    await expect(
      host,
      'JP-21: the sales report must mount — check the /sales-report grant if this fails on a correct URL',
    ).toBeAttached({ timeout: 30_000 });

    // [REAL-UI] The loading panel is bound to the component's own in-flight state. It clearing is the app
    // reporting that its journey + salesleads reads both resolved.
    await expect(
      host.getByText(/Loading Dashboard/i),
      'JP-21: the loading panel must clear once the app\'s own reads resolve',
    ).toHaveCount(0, { timeout: 60_000 });
  });

  // ===========================================================================================
  // JCD-01..03 — the redesigned Participant Health board (app c67aae29 + the 6 fixes in c5477756)
  // ===========================================================================================
  //
  // The board is derived in loadCoachHealthAnalytics(): every `participant metadata` doc is the roster,
  // then healthtracker_healthstate / healthtracker_touchpoint / appointments / clientissue are read
  // scoped to those ids. The 2026-09-23 fixes changed three things these cases pin down: tickets are
  // now an OPEN-only server-side count, the Health board link opens in a NEW TAB, and the Outreach rows
  // carry priority.engine's reason string instead of a hand-rolled status line.
  //
  // ANTI-CIRCULARITY: the seed writes raw clientissue / metadata docs; every number and string asserted
  // is the app's own derivation, re-derived here from the same docs.
  test('JCD-01 the Participant Health tickets tile counts OPEN tickets only', async ({ page }) => {
    const issues = (await queryWhere('clientissue', [['testrunid', '==', RUN]])) as any[];
    const open = issues.filter((i) => (i.status?.status ?? '').toLowerCase() === 'open');
    expect([open.length, issues.length],
      'oracle sanity: one OPEN ticket seeded, plus a CLOSED one that must be excluded').toEqual([1, 2]);

    await loginAsJourneyAdmin(page);
    await page.goto('/JourneycoachDashboard-new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-journeycoach-dashboard'), 'JCD-01: the dashboard must mount').toBeAttached({ timeout: 30_000 });

    await expect(
      page.getByTestId('jcd-ph-tickets').locator('.v'),
      `JCD-01: the Tickets tile counts OPEN clientissue docs (${open.length}) — the closed one must not count`,
    ).toHaveText(String(open.length), { timeout: 60_000 });
  });

  test('JCD-02 the Health board link opens the JC-Health screen in a NEW TAB', async ({ page, context }) => {
    await loginAsJourneyAdmin(page);
    await page.goto('/JourneycoachDashboard-new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-journeycoach-dashboard')).toBeAttached({ timeout: 30_000 });

    const before = context.pages().length;
    const [popup] = await Promise.all([
      context.waitForEvent('page', { timeout: 30_000 }),
      page.getByTestId('jcd-ph-healthboard').click(),
    ]);
    expect(popup.url(), 'JCD-02: the new tab lands on the JC-Health dashboard').toContain('/journey-coach-health');
    expect(context.pages().length, 'JCD-02: a tab was ADDED — the dashboard is not navigated away from').toBe(before + 1);
    await expect(page.locator('app-journeycoach-dashboard'), 'JCD-02: the JE dashboard is still mounted in the original tab').toBeAttached();
    await popup.close();
  });

  test('JCD-03 an Outreach row states WHY, using the shared priority reason', async ({ page }) => {
    await loginAsJourneyAdmin(page);
    await page.goto('/JourneycoachDashboard-new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-journeycoach-dashboard')).toBeAttached({ timeout: 30_000 });

    // priority.engine builds "<driver> + <driver> -> <action>"; the hand-rolled status line it replaced
    // (e.g. "2 open tickets") never carried the arrow, so the arrow is what proves the swap.
    const row = page.getByTestId('jcd-ph-needsattn-row').first();
    await expect(row, 'JCD-03: at least one participant needs outreach in the seeded base').toBeVisible({ timeout: 60_000 });
    await expect(row, 'JCD-03: the row carries priority.engine\'s reason, not a bare status line').toContainText('→');
  });

  // JCD-04 — Assured Sales: an empty Journey cell falls back to the sale's product (app d86af3ea)
  //
  // formatCellValue() returned '-' for an empty `journey` on the sales tables; it now resolves the row's
  // productref through the dashboard's own products map. SEEDED: SLP (journey '', productref → P1) and the
  // control SLJ (journey J1 AND productref → P1), both assured (paymentplan set) this month.
  // ANTI-CIRCULARITY: the test writes ids only; both cell texts are names the app looks up itself — the
  // product name from `products`, the journey name from `journey`. SLJ proves the fallback fires ONLY on
  // an empty journey (otherwise its cell would read the product too).
  test('JCD-04 Assured Sales shows the product name when a sale has no journey — and the journey when it has one', async ({ page }) => {
    await loginAsJourneyAdmin(page);
    await page.goto('/JourneycoachDashboard-new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-journeycoach-dashboard')).toBeAttached({ timeout: 30_000 });

    await page.getByTestId('jcd-lnk-assured-table').click();
    const table = page.locator('table.jcd-table');
    // header text is "Journey" + the sort icon (⇅), so match the leading word
    const journeyCol = table.locator('th').filter({ hasText: /^\s*Journey\b/ });
    await expect(journeyCol, 'JCD-04: the Assured Sales table opens with a Journey column').toHaveCount(1, { timeout: 30_000 });
    // the column's position among the header cells (S.No is index 0 — it is a th too)
    const ths = await table.locator('thead th').allTextContents();
    const jIdx = ths.findIndex((t) => /^\s*Journey\b/.test(t));
    const journeyCell = (name: string) => table.locator('tr.jcd-tr').filter({ hasText: name }).locator('td').nth(jIdx);

    await page.getByTestId('jcd-inp-133').fill(`JCD Assured`);
    await expect(journeyCell(jcdAssuredLeads.productOnly), 'JCD-04: a product-only sale shows its PRODUCT in the Journey cell')
      .toHaveText(journeyNames.product1, { timeout: 60_000 });
    await expect(journeyCell(jcdAssuredLeads.withJourney), 'JCD-04: a sale with a journey keeps showing the JOURNEY')
      .toHaveText(journeyNames.journey1);
  });

  // JCD-06 — the Journey cell's product fallback also reads the sale's participantjourneyproduct (sashong 176ce857).
  // SLQ has no journey AND no productref of its own; only its PJP (salesleadsref → SLQ) carries productref → P2. The
  // app joins them itself (saleProductRefs, keyed by the salesleads doc id); SLP (own productref → P1) is the control.
  test('JCD-06 a sale with no product of its own shows the product of its participant journey product', async ({ page }) => {
    await loginAsJourneyAdmin(page);
    await page.goto('/JourneycoachDashboard-new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-journeycoach-dashboard')).toBeAttached({ timeout: 30_000 });
    await page.getByTestId('jcd-lnk-assured-table').click();
    const table = page.locator('table.jcd-table');
    await expect(table.locator('th').filter({ hasText: /^\s*Journey\b/ })).toHaveCount(1, { timeout: 30_000 });
    const jIdx = (await table.locator('thead th').allTextContents()).findIndex((t) => /^\s*Journey\b/.test(t));
    const journeyCell = (name: string) => table.locator('tr.jcd-tr').filter({ hasText: name }).locator('td').nth(jIdx);
    await page.getByTestId('jcd-inp-133').fill('JCD Assured');
    await expect(journeyCell(jcdAssuredLeads.pjpProduct), 'JCD-06: the PJP\'s product (P2) fills the empty Journey cell')
      .toHaveText(journeyNames.product2, { timeout: 60_000 });
    await expect(journeyCell(jcdAssuredLeads.productOnly), 'JCD-06: a sale with its own productref still shows its own product')
      .toHaveText(journeyNames.product1);
  });

  // JCD-05 — OnboardingRemark: a manually added attachment is uploaded to Storage and attached by its download URL
  // (sashong 176ce857; it used to be an in-memory data: URL, for which the template shows NO open link). Opened the
  // way users reach it: Mark Onboarded on a To-onboard row (markOnboarded → dialog). STORAGE IS STUBBED: every
  // firebasestorage.googleapis.com request is answered here, so no file reaches any bucket. Oracle: the upload went
  // to email-attachments/manual_<file>…, and the attachment row's open link carries the download URL built from the
  // stub's token. Control: a failed upload adds no attachment and tells the user. (Entry: To onboard → Mark Onboarded
// on PJP_SLQ — the notes cells open the same component read-only, without the composer.)
  test('JCD-05 an attachment added in the onboarding email is uploaded and linked by its download URL; a failed upload is refused', async ({ page }) => {
    const uploads: string[] = [];
    let failNext = false;
    // Storage is reached on the real host OR the local Storage EMULATOR (emulator build, since 2026-10-13) — stub both.
    await page.route(/^https?:\/\/(firebasestorage\.googleapis\.com|(localhost|127\.0\.0\.1):9199)\/v0\/b\//i, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const name = url.searchParams.get('name') || decodeURIComponent(url.pathname.split('/o/')[1] || '');
      if (req.method() === 'POST') {
        uploads.push(name);
        // 403 (storage/unauthorized) — not retried by the SDK, unlike 5xx which it retries with backoff for minutes
        if (failNext) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":{"code":403,"message":"stub denied"}}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        name, bucket: 'starlabs-cicd.appspot.com', generation: '1', contentType: 'application/pdf', size: '12', downloadTokens: 'e2e-token' }) });
    });
    const alerts: string[] = [];
    page.on('dialog', async (d) => { alerts.push(d.message()); await d.accept(); });

    await loginAsJourneyAdmin(page);
    await page.goto('/JourneycoachDashboard-new', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-journeycoach-dashboard')).toBeAttached({ timeout: 30_000 });
    // "To onboard" → the seeded PJP_SLQ row → Mark Onboarded: the dialog's email-composer ("Onboard Remark") mode,
    // the one that has Attachments (the notes cells open it as a read-only "View Note").
    await page.getByTestId('jcd-div-035').click();
    await page.getByTestId('jcd-inp-133').fill(jcdAssuredLeads.onboardPerson);
    await page.locator('tr.jcd-tr').filter({ hasText: jcdAssuredLeads.onboardPerson }).getByTestId('jcd-btn-153').click();
    const remark = page.locator('app-onboarding-remark');
    await expect(remark.getByText('Onboard Remark').first(), 'JCD-05: Mark Onboarded opens the onboarding email composer').toBeVisible({ timeout: 30_000 });

    // The composer (and its Attachments) renders once an email template is picked — same picker JP-09 drives;
    // re-type until the async template load has landed.
    const tmplInput = remark.getByTestId('jorm-inp-018');
    const tmplItem = remark.locator('.custom-dropdown-item').filter({ hasText: journeyNames.emailTemplate });
    await expect(async () => {
      await tmplInput.click();
      await tmplInput.fill('');
      await tmplInput.fill(journeyNames.emailTemplate);
      await expect(tmplItem).toBeVisible({ timeout: 3_000 });
    }, 'JCD-05: the seeded onboarding template is offered').toPass({ timeout: 30_000 });
    await tmplItem.click();
    await expect(remark.getByText('New Message'), 'JCD-05: the email composer renders').toBeVisible({ timeout: 15_000 });

    await remark.getByTestId('jorm-inp-035').setInputFiles({ name: 'welcome-pack.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 e2e') });
    const item = remark.locator('.gmail-attach-item').filter({ hasText: 'welcome-pack.pdf' });
    await expect(item, 'JCD-05: the attachment is listed').toHaveCount(1, { timeout: 30_000 });
    expect(uploads.some((n) => /^email-attachments\/manual_welcome-pack\.pdf_\d+$/.test(n)), `JCD-05: uploaded to email-attachments/manual_<name>_<ts> (saw ${uploads.join(', ')})`).toBe(true);
    await expect(item.getByTestId('jorm-a-036'), 'JCD-05: linked by its Storage download URL (a data: URL shows no link)')
      .toHaveAttribute('href', /(firebasestorage\.googleapis\.com|(localhost|127\.0\.0\.1):9199)\/v0\/b\/[^/]+\/o\/email-attachments%2Fmanual_welcome-pack\.pdf_\d+\?alt=media&token=e2e-token/);

    // the control below makes the app log its upload error and the browser log the stubbed 403 — both expected
    expectedErrors = [/onAddAttachment upload error/, /Failed to load resource: the server responded with a status of 403/];
    failNext = true;
    await remark.getByTestId('jorm-inp-035').setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 x') });
    await expect.poll(() => alerts.at(-1), { message: 'JCD-05: a failed upload is reported' }).toBe('Failed to upload "broken.pdf". Please try again.');
    await expect(remark.locator('.gmail-attach-item').filter({ hasText: 'broken.pdf' }), 'JCD-05: …and nothing is attached').toHaveCount(0);
  });
});
