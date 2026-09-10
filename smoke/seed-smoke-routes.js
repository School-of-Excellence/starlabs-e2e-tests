/**
 * seed-smoke-routes.js — extra `dashboard` route grants for the refactor smoke check ONLY.
 *
 * WHY THIS EXISTS: the authGuard (app auth.guard.ts:36) is DATA-DRIVEN. It looks the route up in the
 * `dashboard` collection and, finding no doc, opens a "Contact Admin — No roles or profiles configured for
 * screen: <route>" dialog and renders nothing. Four of the eight rewired screens sit on routes the journey
 * seed never grants, because no journey spec navigates to them. Without these grants the smoke check reports
 * a red screen that is really an unseeded ACL, which is exactly the kind of false signal this whole exercise
 * is meant to avoid.
 *
 * This runs AFTER journey/seed-journey.js and adds grants only. It writes nothing else, and it reuses the
 * journey run's own staff profile ids and the shared grant-doc shape, so the docs are indistinguishable from
 * the ones the journey seeder writes — and are removed by the same teardown, since they carry the same tag.
 *
 * Deliberately NOT added to journey/seed-journey.js: that seed feeds a CI-gated suite, and widening its ACL
 * surface to serve a one-off verification would change what the gate exercises.
 */
const { seedDashboardRoutes, initAdminAuto } = require('../lib/seed-common');

const RUN = process.env.JNY_RUNID || 'jny';

/** The four routes the journey seed does not grant, each home to a component rewired on 2026-09-10. */
const SMOKE_ROUTES = [
  { route: '/live_event_dashboard_v3',   label: 'Live Event Dashboard V3' },
  { route: '/customersupportdashboard',  label: 'Customer Support Dashboard' },
  { route: '/participants-analytics',    label: 'Participants Analytics' },
  { route: '/workshop_dashboard',        label: 'Workshop Dashboard' },
];

async function main() {
  const admin = initAdminAuto();
  const db = admin.firestore();

  // Mirror the journey roster: the same staff profile ids and the same role set the journey grants use, so
  // the guard admits admin+<run>@example.com here exactly as it does on /salesleads.
  const staffProfileIds = [`${RUN}_pf_admin`, `${RUN}_pf_journeycoach`, `${RUN}_pf_integrator`];
  const allRoles = ['admin', 'ah', '_testdata'];

  await seedDashboardRoutes(db, RUN, SMOKE_ROUTES, { staffProfileIds, allRoles });
  console.log(`[smoke] granted ${SMOKE_ROUTES.length} extra dashboard routes for run "${RUN}"`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
