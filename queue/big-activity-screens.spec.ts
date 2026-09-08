// big-activity-screens.spec.ts — /bigactivity + /bigactivitylog render (REAL-UI, anti-circular).
//
// Recon: e2e/queue/recon/big.md (BIG-12 / BIG-13; the screens are catalogued there under BIG-10).
//
// WHY THIS FILE EXISTS: queue's coverage pass (2026-09-04) found these two routes never opened by any
// spec, even though BigMiscPage already knows how to drive them (its route union lists `bigactivity` and
// `bigactivitylog`, with hosts + anchors, but no spec called open() for either). They are the cheapest
// remaining queue gaps: no new page object, no new seed collection.
//
// Anti-circularity: both screens read the SAME `bigactivity` collection seeded by fixtures/big-seed.ts
// (`TEST Activity <run>`), through two DIFFERENT app queries:
//   * /bigactivity      — collectionData(collection('bigactivity'))                 (big-activity.ts:42)
//   * /bigactivitylog   — collectionData(query(collection('bigactivity'), orderBy('activity')))
//                                                                          (big-activity-log.ts:109)
// Each case asserts a value the COMPONENT rendered from its own stream. The seed is a precondition; no
// case asserts a value the test wrote into the surface it reads.
//
// SCOPE NOTE: the other two uncovered big routes are NOT here.
//   * /bigProfile — the component does JSON.parse(params['data']) (big-profile.component.ts:60-61), so it
//     needs `?data={"profileid":...}` and THROWS on a bare navigation. BigMiscPage's docstring advertises
//     `{ profileid }` for this route, which would not satisfy the component — that path has never been
//     exercised. Recorded as a finding; needs its own slice.
//   * /bigchatscreen — not in BigMiscPage's route union at all, and takes four route params.
import { test, expect } from '@playwright/test';
import { BigMiscPage } from './pages/big-misc.page';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs, ExternalStubs } from './stubs';
import { seedBigWorld, BigSeedResult } from '../fixtures/big-seed';

let seed: BigSeedResult;
let guard: ConsoleGuard;
let stubs: ExternalStubs;

// One BIG world for the file — both cases are READ-ONLY, so nothing here mutates shared state and no
// resetBigMutableState() is needed between them.
test.beforeAll(async () => {
  seed = await seedBigWorld({ initiatedCount: 1, cohortSourceCount: 1, aelCount: 1, configRows: 1 });
});

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  // Synchronous (returns the recorders, not a promise) — matches big-analytics.spec.ts:58.
  stubs = installAllExternalStubs(page);
});

test.describe('Queue BIG — activity screens render (real UI, anti-circular)', () => {
  // ===========================================================================================
  // BIG-12 — /bigactivity renders the seeded activity from its own collectionData stream
  // ===========================================================================================
  test('BIG-12 bigactivity renders the seeded activity row with no fatal error', async ({ page }) => {
    const misc = new BigMiscPage(page);
    await misc.open('bigactivity');

    // [REAL-UI] The table's activity column is {{row["activity"]}} (big-activity.component.html:19), filled
    // from the component's own collectionData('bigactivity') subscription. big-seed.ts writes exactly one
    // activity doc for this run, named `TEST Activity <testrunid>` — assert the APP rendered that string.
    const activityName = `TEST Activity ${seed.testrunid}`;
    await expect(
      page.locator('app-big-activity').getByText(activityName, { exact: true }),
      `BIG-12: the seeded activity "${activityName}" must render in the table the app built from its stream`,
    ).toBeVisible({ timeout: 30_000 });

    // The rendered row count is the component's own dataSource length. The collection is NOT run-isolated
    // in the view (the table shows every doc), so assert a NON-ZERO lower bound rather than equality — the
    // same convention BIG-09a/09b use. A broken or silently-empty stream still fails this.
    const rows = await misc.readMetric('rows');
    expect(rows, 'BIG-12: the bigactivity table must render at least the seeded row').toBeGreaterThanOrEqual(1);

    await misc.loadsWithoutFatal(guard);
  });

  // ===========================================================================================
  // BIG-13 — /bigactivitylog renders the same activity through its ORDERED stream
  // ===========================================================================================
  // SCOPE — READ HONESTLY: this is a MOUNT + APP-COMPUTED-TALLY smoke, NOT a stream-content assertion.
  // It is deliberately weaker than BIG-12 and is labelled as such rather than dressed up.
  //
  // The stronger case was attempted and abandoned after four emulator runs. The screen re-reads the same
  // `bigactivity` collection through a DIFFERENT query — query(collection('bigactivity'),
  // orderBy('activity')) (big-activity-log.component.ts:109) — and binds it to `bigActivityList`, rendered
  // as <mat-option>{{option.activity}}</mat-option> (html:51). Asserting that option would prove the
  // ordered stream populated. It could not be driven reliably:
  //   * `.first()` on mat-select picks "Filter Queue" (the screen has six selects), never the activity one;
  //   * the <mat-label> is a SIBLING of the select inside <mat-form-field>, so filtering the mat-select by
  //     text matches nothing — the form field has to be filtered instead;
  //   * a pointer click on the correct select then stalls in Playwright's actionability wait until the test
  //     times out, with nothing visibly overlapping it;
  //   * focus() + Enter focuses the field (verified in the failure screenshot) but does not open the panel.
  // Rather than ship a flaky interaction, the route is covered at mount level and the gap is recorded.
  // TODO(BIG-13b): drive the activity select once the right handle exists — the cleanest fix is a
  // data-testid on that mat-select, which the test-hooks step never added for this screen.
  test('BIG-13 bigactivitylog mounts and renders its app-computed tallies', async ({ page }) => {
    const misc = new BigMiscPage(page);
    await misc.open('bigactivitylog');

    // [REAL-UI] The Matched / Not-Found tallies are computed by the COMPONENT from its own streams and
    // rendered into the heading row. Reading them proves the screen got past its subscriptions rather than
    // merely painting a shell: a component that threw mid-stream never renders these at all.
    const matched = await misc.readMetric('matched');
    const notFound = await misc.readMetric('notfound');
    expect(matched, 'BIG-13: the Matched tally must render as a number the app computed').toBeGreaterThanOrEqual(0);
    expect(notFound, 'BIG-13: the Not-Found tally must render as a number the app computed').toBeGreaterThanOrEqual(0);

    await misc.loadsWithoutFatal(guard);
  });
});

test.afterEach(() => {
  assertNoFatal(guard, 'big activity screens: no fatal console errors / pageerrors');
});
