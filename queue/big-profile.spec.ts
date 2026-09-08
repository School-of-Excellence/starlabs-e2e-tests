// big-profile.spec.ts — /bigProfile render (REAL-UI, anti-circular).
//
// Recon: e2e/queue/recon/big.md (BIG-14 — added by the 2026-09-04 coverage pass).
//
// WHY THIS ROUTE WAS NEVER DRIVEN, despite BigMiscPage listing it in its route union since it was written:
//
//  1. It takes its input as a JSON BLOB in a query param. ngOnInit does
//     `JSON.parse(params['data'])` (big-profile.component.ts:60-61) with no guard, so a bare
//     navigation to /bigProfile throws before anything renders. BigMiscPage's docstring advertises
//     `{ profileid }` for this route — that would NOT satisfy the component. Nothing has ever exercised
//     that path, so the docstring was never contradicted. This spec navigates directly with the correct
//     `?data={"profileid":"..."}` rather than through the page object; fixing the page object is a
//     separate change to shared code and is left to its owner.
//
//  2. It hard-requires a `participantdashboard/{profileid}` doc. That read (ts:86-88) does
//     `var element = value.data()` then `element["subscriptionend"]` with NO existence check — a missing
//     doc is `undefined` and the property access throws an unhandled rejection, which the console guard
//     correctly reports as fatal. `participantdashboard` is seeded NOWHERE in the queue fixture, so the
//     screen could not load green even with the right URL. This spec seeds it as a precondition.
//
// Anti-circularity: the assertion is the participant NAME, which the app resolves by reading
// `profile_data/{profileid}` (ts:65-68) — a DIFFERENT document from the one the URL names and from the
// participantdashboard doc this spec writes. The test supplies an id; the app performs the lookup and
// renders the name off the seeded BIG world.
import { test, expect } from '@playwright/test';
import { actors, loginAs } from './support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs, ExternalStubs } from './stubs';
import { seedBigWorld, BigSeedResult } from '../fixtures/big-seed';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fa = require('./support/firestore-admin');

let seed: BigSeedResult;
let guard: ConsoleGuard;
let stubs: ExternalStubs;
let subjectId: string;
let subjectName: string;

test.beforeAll(async () => {
  seed = await seedBigWorld({ initiatedCount: 1, cohortSourceCount: 2, aelCount: 1, configRows: 1 });
  const subject = seed.cohortParticipants[0];
  subjectId = subject.profileid;
  subjectName = subject.name;

  // [PRECONDITION] the participantdashboard doc the component dereferences without a guard (ts:86-88).
  // `subscriptionend` is a real Timestamp because the component calls .toDate() on it when present.
  await fa.db().collection('participantdashboard').doc(subjectId).set({
    docid: subjectId,
    profileid: subjectId,
    subscriptionend: new Date(Date.now() + 30 * 86_400_000),
    evolutionprogress: {},
    testrunid: seed.testrunid,
    _testdata: true,
  });
});

test.afterAll(async () => {
  // The shared emulator teardown does not know this collection — this is the ONLY cleanup. Do not drop it.
  await fa.db().collection('participantdashboard').doc(subjectId).delete().catch(() => {});
});

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  stubs = installAllExternalStubs(page);
});

test.afterEach(() => assertNoFatal(guard, 'big-profile: no fatal console errors / pageerrors'));

test.describe('Queue BIG — participant profile (real UI, anti-circular)', () => {
  // ===========================================================================================
  // BIG-14 — /bigProfile resolves the participant from the id in its `data` param
  // ===========================================================================================
  test('BIG-14 bigProfile renders the participant it resolved from profile_data', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);

    // The component parses this param as JSON — anything else throws before render (see file header).
    const data = encodeURIComponent(JSON.stringify({ profileid: subjectId }));
    await page.goto(`/bigProfile?data=${data}`, { waitUntil: 'domcontentloaded' });

    const host = page.locator('app-big-profile');
    await expect(
      host,
      'BIG-14: bigProfile must mount — a bare /bigProfile (no ?data=) throws in ngOnInit, and a missing ' +
      'participantdashboard doc throws on the ungarded element["subscriptionend"] read',
    ).toBeVisible({ timeout: 30_000 });

    await expect(
      host.locator('.profile-card'),
      'BIG-14: the profile card must render',
    ).toBeVisible({ timeout: 30_000 });

    // [ASSERT] The name is NOT in the URL and NOT in the doc this spec wrote — the component fetched
    // profile_data/{profileid} and rendered it. The URL carried only an id.
    await expect(
      host.getByText(subjectName, { exact: false }).first(),
      `BIG-14: the app must resolve and render "${subjectName}" from profile_data — the URL carried only ` +
      'the profileid, and the participantdashboard precondition doc does not contain the name',
    ).toBeVisible({ timeout: 30_000 });
  });
});
