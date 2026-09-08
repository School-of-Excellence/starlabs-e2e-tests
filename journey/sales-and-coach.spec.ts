// sales-and-coach.spec.ts — journey's remaining screens (REAL-UI, anti-circular).
//
// Recon: e2e/recon-allcomp/journey-products.md (JP-22..JP-26 — 2026-09-08 coverage pass).
//
// Closes out journey's workable routes. Two of the suite's nine are NOT here and are not closable inside
// the emulator boundary: /onboarding-pipeline reads an external SalesCRM Firebase project and
// /overall-dashboard calls external Watson + SalesCRM HTTP endpoints. They need a scope decision, not a
// spec.
//
// JP-22 documents a DEFECT rather than covering a screen — see its header. Found by
// scripts/check-routable-dialogs.mjs, which now lists every routed component that can only exist inside a
// MatDialog. Run it before writing a spec for any route that will not mount.
import { test, expect } from '@playwright/test';
import {
  journeyIds, salesTeamNames, installJourneyStubs, attachJourneyGuard, loginAsJourneyAdmin,
} from './support/journey';
import { assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { queryWhere } from '../queue/support/firestore-admin';

let guard: ConsoleGuard;

test.beforeEach(async ({ page }) => {
  guard = attachJourneyGuard(page);
  await installJourneyStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'sales/coach screens: no fatal console errors / pageerrors'));

test.describe('Journey — sales + coach screens (real UI, anti-circular)', () => {
  // ===========================================================================================
  // JP-22 — THE GAP: /onboardingremarks is a dialog registered as a route
  // ===========================================================================================
  //
  // OnboardingRemarkComponent injects MAT_DIALOG_DATA and MatDialogRef without @Optional
  // (onboarding-remark.component.ts:145-146), so the router cannot construct it and navigation throws
  // NullInjectorError before mount. The guard admits the navigation first, so the URL yields a blank page.
  //
  // THIRD instance of this exact defect (with PlaylistConfigurationComponent behind /add-playlist and
  // /edit-playlist, and JourneycoachOpportunitiesComponent behind /opportunities). Each of the first two
  // cost a full write-and-run cycle to diagnose, which is why scripts/check-routable-dialogs.mjs now finds
  // them mechanically.
  //
  // test.fail() scoped INSIDE the body — a bare test.fail() between tests applies to the whole describe
  // block and silently annotates every case in it.
  test('JP-22 onboardingremarks mounts its remark form', async ({ page }) => {
    test.fail();

    await loginAsJourneyAdmin(page);
    await page.goto('/onboardingremarks', { waitUntil: 'domcontentloaded' });

    // The assertion that should hold once the component is routable — kept whole so the fix arrives with
    // its test rather than needing one written afterwards.
    await expect(
      page.locator('app-onboarding-remark'),
      'JP-22: the remark screen must mount',
    ).toBeAttached({ timeout: 30_000 });
  });

  // ===========================================================================================
  // JP-23 — /sales-teams renders the teams the service read, and its own members fallback
  // ===========================================================================================
  test('JP-23 sales-teams lists the seeded teams and counts their members', async ({ page }) => {
    await loginAsJourneyAdmin(page);
    await page.goto('/sales-teams', { waitUntil: 'domcontentloaded' });

    const host = page.locator('app-sales-teams');
    await expect(
      host,
      'JP-23: sales-teams must mount — if this fails on a correct URL, check the /sales-teams grant in ' +
      'journey/seed-journey.js ROUTES',
    ).toBeAttached({ timeout: 30_000 });

    // [REAL-UI] SalesNumbersService.loadTeams() reads `sales_teams` and maps each doc to
    // { team: v.team ?? d.id, members: Array.isArray(v.members) ? v.members : [] }
    // (sales-numbers.service.ts:54-60). Both seeded teams must render as cards.
    for (const name of [salesTeamNames.alpha, salesTeamNames.beta]) {
      await expect(
        host.locator('.st-team').filter({ hasText: name }),
        `JP-23: the seeded team "${name}" must render from the service's own sales_teams read`,
      ).toBeVisible({ timeout: 30_000 });
    }

    // [ASSERT] the app's OWN fallback. Beta is seeded with NO `members` field at all, so the count it
    // renders can only come from the service defaulting to [] — a value the test never wrote.
    await expect(
      host.locator('.st-team').filter({ hasText: salesTeamNames.beta }).locator('.st-count'),
      'JP-23: a team seeded without a members array must render the app-derived "0 members"',
    ).toHaveText(/^\s*0 members\s*$/, { timeout: 30_000 });
  });

  // ===========================================================================================
  // JP-24 — /sales-numbers completes its multi-collection load
  // ===========================================================================================
  //
  // SCOPE: a load-completion case, weaker than JP-23, and labelled so. The dashboard aggregates
  // `salesleads` over a date window it picks itself; the seeded leads are not dated to a fixed month, so
  // asserting a figure would pin the seed's clock rather than the app's arithmetic. What IS asserted is
  // that the screen resolved its four reads (journey / sales_teams / salesleads / users_roles) and
  // rendered its own heading.
  test('JP-24 sales-numbers loads and renders its dashboard heading', async ({ page }) => {
    await loginAsJourneyAdmin(page);
    await page.goto('/sales-numbers', { waitUntil: 'domcontentloaded' });

    const host = page.locator('app-sales-numbers');
    await expect(host, 'JP-24: sales-numbers must mount').toBeAttached({ timeout: 30_000 });
    await expect(
      host.getByText(/Sales Numbers/i).first(),
      'JP-24: the dashboard heading must render',
    ).toBeVisible({ timeout: 60_000 });

    // Cross-check the source the picker is built from: the teams the service read are the same rows the
    // Admin SDK sees. Confirms JP-24 exercised a populated world, not an empty one.
    const teams = await queryWhere('sales_teams', []);
    expect(teams.length, 'JP-24: sales_teams must be seeded for this screen to aggregate by team')
      .toBeGreaterThanOrEqual(2);
  });

  // ===========================================================================================
  // JP-25 / JP-26 — the two coach dashboards mount over mostly-unseeded collections
  // ===========================================================================================
  //
  // SCOPE, stated plainly: mount cases. /delivery-dashboard reads appointments, availability,
  // AppointmentType-To-Roles and Roles-To-EIS; /journey-coach-health reads appointments, clientissue,
  // event participation request and healthtracker_*. The journey seed writes almost none of those, so
  // both render their empty state — which is exactly what a real coach sees before any activity exists,
  // and is worth pinning: it proves neither screen THROWS on empty data, the failure mode that took
  // /bigProfile and /bigchatscreen down elsewhere in this branch.
  //
  // Seeding those collections to assert populated dashboards is a fixture project, not a route-gap fix.
  for (const [id, route, host, heading] of [
    ['JP-25', '/delivery-dashboard', 'app-delivery-dashboard-clone', /Delivery Dashboard/i],
    ['JP-26', '/journey-coach-health', 'app-journey-coach-health-dashboard', /Journey Coach/i],
  ] as const) {
    test(`${id} ${route} mounts and renders its heading over empty data`, async ({ page }) => {
      await loginAsJourneyAdmin(page);
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      await expect(
        page.locator(host),
        `${id}: ${route} must mount — check its grant in journey/seed-journey.js ROUTES if this fails on ` +
        'a correct URL',
      ).toBeAttached({ timeout: 30_000 });

      await expect(
        page.locator(host).getByText(heading).first(),
        `${id}: the dashboard heading must render, which means the component survived its reads`,
      ).toBeVisible({ timeout: 60_000 });
    });
  }
});
