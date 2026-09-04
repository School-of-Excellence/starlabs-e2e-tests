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
  // Added 2026-09-04 (operator decision, coverage pass). /viewrubrics_scoring_atc loads
  // `queue system/atc-generated-from-queue-stage` — the ATC generated from a queue stage, i.e. an ATC
  // READER living outside src/app/ATC/**. The app CLAUDE.md constraint is explicit: "Exclude all
  // src/app/ATC/** components AND ATC readers from the test pipeline." It was the last unopened
  // `queue system` route that no spec may legitimately close, so it belongs here rather than sitting in
  // the coverage report as a gap someone will keep trying to fill.
  '/viewrubrics_scoring_atc',
  // Also 2026-09-04. Both evolution-prep screens are ATC readers despite their non-ATC names — found only
  // by opening them:
  //   /evolution-prep-participants ("Diagnostics Queue — Participant Flow") reads
  //     `queue_atc_generation` and `queue_atc_generation_backup` from a SEPARATE ATC database handle.
  //     That is ATC generation data, not the reference-only config CLAUDE.md permits.
  //   /evolution-prep-participants-v2 renders as "ATC Transcript Ops" — "attach a Dropbox recording where
  //     the transcript is missing, and watch the ATC doc through to completion" — and filters by
  //     `atcrequiredstages` / ATC stage.
  // A spec for the v1 screen was written and PASSING before this was noticed; it was deleted rather than
  // kept for the coverage number. Neither route has a `dashboard` grant in seed-test-project.js, so the
  // authGuard denies them to test actors — the exclusion is enforced at the seed as well as here.
  '/evolution-prep-participants', '/evolution-prep-participants-v2',
];

/**
 * ADJACENT-BUT-IN-SCOPE (2026-09-04). Routes that look ATC-ish but were REVIEWED and deliberately left
 * testable. Recorded so the review is not repeated. Several were surfaced by
 * `scripts/check-atc-coupling.mjs`'s WEAK tier ("presents as ATC in its own headings"); the
 * live_event_dashboard_v3 entry came from the events coverage pass on the `manoja` line of work.
 *
 *  /openmeeting/:id/:collectiontype — the Zoom client view. Reads NO ATC collection. It renders a
 *      host-only "Prescribe ATC" bubble which does `window.open('/dynamicstudio?step=prescribe-atc')`
 *      (zoom-clientview.component.ts:1204). The SCREEN is testable; the BUTTON is not — /dynamicstudio is
 *      denylisted above, and clicking it opens that route in a second window where assertNotExcluded()
 *      cannot see it. Any spec for this route MUST leave the prescribe bubble alone.
 *
 *  /atcmodel, /modellevelconfig — "ATC Model" reference config, which the app CLAUDE.md explicitly calls
 *      safe ("Reference-only config (atc taxonomy, atc model, atcmodel level config) is safe").
 *      /modellevelconfig is already covered by BIG-09b.
 *
 *  /eiflixdiscoverpage — heading text only ("ATC — Head"); no ATC collection read.
 *
 *  /live_event_dashboard_v3 — NOT route-excluded, unlike its v1/v2 siblings in the list above. Only three
 *      functions in live-event-data.service.ts touch the firestore-atc database — subscribeToAtcAlpha(),
 *      subscribeToAtcToValidate(), subscribeToDraftAtc() — all called exclusively from
 *      subscribeToArenaOverview(), itself called only from selectEvent() and toggleQueue(). The route and
 *      every OTHER read on it (registered count, attendance, video-ask tags, zones, customer support,
 *      arena calling, …) is default-DB-only and fine to test. See events/live-event-dashboard-v3.spec.ts's
 *      header for the exact guard a test MUST carry before calling selectEvent — and never call
 *      toggleQueue at all.
 *
 * The shape of these two is the same and worth naming: a screen can be testable while a specific CONTROL
 * or CODE PATH on it is not. /openmeeting must not have its button clicked; live_event_dashboard_v3 must
 * not reach toggleQueue. Excluding the whole route in either case would give up real coverage; ignoring
 * the constraint would touch ATC. The guard belongs in the spec, and the reason belongs here.
 */

/** Throws if a test tries to navigate to an ATC-excluded route — a guardrail, not a UI assertion. */
export function assertNotExcluded(route: string): void {
  const hit = ATC_EXCLUDED_ROUTES.find(r => route === r || route.startsWith(r + '/'));
  if (hit) throw new Error(`ATC-EXCLUDED route "${route}" must not be exercised in CI E2E (matches ${hit}).`);
}
