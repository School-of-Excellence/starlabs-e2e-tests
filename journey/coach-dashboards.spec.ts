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
  test.fail();
  test('JP-20 opportunities dashboard totals match an independent count of the source docs', async ({ page }) => {
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
});
