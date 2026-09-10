// refactor-smoke.spec.ts — MOUNT verification for the 2026-09-10 engine-extraction refactor.
//
// WHY THIS EXISTS: eleven Firestore-bound components had methods deleted and rewired to delegate to new
// pure `*.engine.ts` siblings. `tsc` is clean and 1,894 unit tests pass — but unit tests exercise the
// ENGINES, not the components. Two failure modes survive both checks:
//   1. a TEMPLATE still binding a method that was deleted from the class (templates are not type-checked
//      the way class code is, so this compiles and fails only at render), and
//   2. a delegation that passes arguments in the wrong order or shape — which compiles when the types are
//      loose (`any` rows out of Firestore) and only shows up when the view actually runs.
// Both are mount-time crashes. This file catches exactly those.
//
// WHAT THIS DOES NOT PROVE: the journey seed carries no queue/workshop/event data, so several of these
// screens render an EMPTY state. That still exercises the component's constructor, ngOnInit, and the whole
// template — which is the risk class above — but it does NOT prove a delegation returns the right ANSWER on
// real rows. That is what the engines' own unit tests are for. Read a pass here as "nothing is broken",
// not as "the numbers are right".
//
// THREE OF THE ELEVEN ARE NOT HERE, because they are unreachable in the running app:
//   - DeliveryDashboardComponent      — the only reference is a COMMENTED-OUT route (app.routes.ts:690).
//                                       The live /delivery-dashboard route serves the CLONE component.
//   - PlanningTabComponent            — selector `app-planning-tab` appears in no template anywhere.
//   - WorkshopDashboardV2Component    — selector `app-workshop-dashboardv2` appears in no template, and the
//                                       class is referenced by nothing outside its own file.
// They were refactored anyway (they type-check and their rules are unit-tested), but no browser can reach
// them, so no smoke case can cover them. That is a finding about the codebase, not a gap in this file.
//
// This is a ONE-OFF verification of a refactor, deliberately kept out of every gated suite: it has its own
// config (playwright.smoke.config.ts) and its own testDir, so no existing suite picks it up.
import { test, expect } from '@playwright/test';
import {
  attachJourneyGuard,
  installJourneyStubs,
  loginAsJourneyAdmin,
} from '../journey/support/journey';
import { assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

/** The eight REACHABLE screens whose components were rewired. */
const SCREENS: { name: string; path: string; note?: string }[] = [
  { name: 'ArenaBoardComponent',              path: '/arena/smoke_q/smoke_stage', note: 'params are deliberately unseeded — an empty board must still mount' },
  { name: 'DynamicStudioV2Component',         path: '/dynamicstudio' },
  { name: 'LiveEventDashboardV3Component',    path: '/live_event_dashboard_v3' },
  { name: 'CustomerSupportDashboardComponent', path: '/customersupportdashboard' },
  { name: 'ProductInitiationDashboardComponent', path: '/productinitiated-dashboard' },
  { name: 'SalesDashboardCloneComponent',     path: '/sales-report' },
  { name: 'ParticipantsAnalyticsComponent',   path: '/participants-analytics' },
  { name: 'WorkshopDashboardComponent',       path: '/workshop_dashboard/smoke_ws', note: 'param deliberately unseeded' },
];

let guard: ConsoleGuard;

test.describe('Engine-extraction refactor — every rewired screen still mounts', () => {
  test.beforeEach(async ({ page }) => {
    guard = attachJourneyGuard(page);
    await installJourneyStubs(page);
  });

  for (const screen of SCREENS) {
    test(`${screen.name} mounts and renders content at ${screen.path}`, async ({ page }) => {
      await loginAsJourneyAdmin(page);
      await page.goto(screen.path, { waitUntil: 'domcontentloaded' });

      // The app shell (toolbar) renders even when the routed component dies, so asserting "the page has a
      // body" would pass on a crash. Assert instead that something rendered INSIDE the router outlet.
      const outletContent = page.locator('router-outlet ~ *');
      await expect(
        outletContent.first(),
        `${screen.name}: the routed component must render something below the shell. A blank area under a ` +
        `working toolbar is the exact signature of a template binding a method that no longer exists.`,
      ).toBeAttached({ timeout: 45_000 });

      // Give ngOnInit's async Firestore work a beat to throw if it is going to.
      await page.waitForTimeout(3_000);

      assertNoFatal(guard, `${screen.name}: no fatal console error / pageerror on mount`);
    });
  }
});
