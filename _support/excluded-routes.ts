// ATC-integrating / ATC-folder routes that MUST be excluded from CI E2E (sensitive ATC data — D-001).
// Source: specs/operator-screens.md §C + the ATC route group in DOCS.md. Tests must never navigate to these.
export const ATC_EXCLUDED_ROUTES: string[] = [
  // ATC route group
  '/addtripleATC', '/atctrajectory', '/editATC', '/edittripleATC', '/liveprescription',
  '/pickformentoring', '/prescribeATC', '/previewATC', '/previewtripleATC', '/reviewflagATC',
  '/view-participant-atc', '/viewassignedATC', '/viewprescribedATC', '/viewtripleATC',
  '/viewUpgradedATC', '/viewaigeneratedatc',
  // Non-ATC-folder screens that integrate ATC data (operator-screens.md §C)
  '/updateprofiletaxonomy', '/overall_event_dashboard', '/big-dashboard', '/profilelist',
  '/JourneycoachDashboard-new', '/ecosystem', '/live_event_dashboard', '/first_timers_dashboard',
  '/queueeventhealth', '/arenadesigninsights', '/dynamicstudio', '/dynamicqueuemanager',
  '/participantAEL',
];

// NOTE on '/live_event_dashboard_v3' (NOT route-excluded, unlike its v1/v2 siblings above): only three
// functions in live-event-data.service.ts touch the firestore-atc database — subscribeToAtcAlpha(),
// subscribeToAtcToValidate(), subscribeToDraftAtc() (all called exclusively from
// subscribeToArenaOverview(), itself called only from selectEvent() and toggleQueue()). The route and
// every OTHER read on it (registered count, attendance, video-ask tags, zones, customer support, arena
// calling, …) is default-DB-only and fine to test. See events/live-event-dashboard-v3.spec.ts's header
// for the exact guard a test MUST carry before calling selectEvent (never call toggleQueue at all).

/** Throws if a test tries to navigate to an ATC-excluded route — a guardrail, not a UI assertion. */
export function assertNotExcluded(route: string): void {
  const hit = ATC_EXCLUDED_ROUTES.find(r => route === r || route.startsWith(r + '/'));
  if (hit) throw new Error(`ATC-EXCLUDED route "${route}" must not be exercised in CI E2E (matches ${hit}).`);
}
