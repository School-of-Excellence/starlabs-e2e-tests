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
import { installJourneyStubs, attachJourneyGuard, loginAsJourneyAdmin } from './support/journey';
import { assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { queryWhere } from '../queue/support/firestore-admin';

const RUN = process.env.JNY_RUNID || 'jny';

let guard: ConsoleGuard;

test.beforeEach(async ({ page }) => {
  guard = attachJourneyGuard(page);
  await installJourneyStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'coach dashboards: no fatal console errors / pageerrors'));

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
});
