// big-chat-screen.spec.ts — /bigchatscreen render (REAL-UI, anti-circular).
//
// Recon: e2e/queue/recon/big.md (BIG-15 — added by the 2026-09-04 coverage pass).
//
// WHY THIS ROUTE WAS NEVER DRIVEN: it is the only BIG screen absent from BigMiscPage's route union, and it
// takes FOUR query params (`assignemtnId` — the app's spelling — `profileId`, `assignmentprofileId`,
// `admins`). It also had no `dashboard` grant, so authGuard denied it outright.
//
// TWO TRAPS, both found by running it:
//
//  1. adminsCheck() does `if (mentorRole && this.adminsParam.includes(this.loggedInProfileId))`
//     (big-chat-screen.component.ts:150). With a mentor-flagged actor and no `admins` param, `adminsParam`
//     is undefined and `.includes` throws. A non-mentor short-circuits the && before that read. The
//     `admins` param is passed anyway so the case does not silently depend on that short-circuit.
//
//  2. THE ONE THAT ACTUALLY BOUNCED IT. A non-mentor gets `sender = 'participant'`, and the component
//     then requires `assignmentprofileId === loggedInProfileId` (ts:135). Anything else hits
//     `alert("You have no access to the screen")` + `router.navigateByUrl("/")` — the screen redirects
//     away, and the late `initializeAfterRoleCheck()` then builds a `bigchat/<undefined>/bigchatmessages`
//     path, surfacing as a Firestore `_ResourcePath.fromString` TypeError rather than as the access
//     denial it really is. So `assignmentprofileId` MUST be the LOGGED-IN operator's own profileid, which
//     this spec resolves from `profile_data` by email rather than hardcoding a seed-internal id.
//
// Anti-circularity: the assertion is the seeded marathon TITLE, rendered into `.marathon-title` from the
// component's own `big marathon` read (html:30). The URL carries ids only — never the title — so the
// string can only come from the document the app fetched.
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
let operatorProfileId: string;

test.beforeAll(async () => {
  seed = await seedBigWorld({ initiatedCount: 1, cohortSourceCount: 1, aelCount: 1, configRows: 1 });

  // Resolve the logged-in operator's OWN profileid — trap 2 above. Looked up by email from the seeded
  // auth chain (`profile_data.email`, seed-test-project.js:399) so this does not hardcode a seed-internal
  // id convention that could drift.
  const rows = await fa.queryWhere('profile_data', [['email', '==', actors.operatorAdmin.toLowerCase()]]);
  expect(rows.length, `precondition: profile_data must hold ${actors.operatorAdmin}`).toBeGreaterThan(0);
  operatorProfileId = String(rows[0].profileid ?? rows[0].id);
});

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  stubs = installAllExternalStubs(page);
});

test.afterEach(() => assertNoFatal(guard, 'big-chat-screen: no fatal console errors / pageerrors'));

test.describe('Queue BIG — chat screen (real UI, anti-circular)', () => {
  // ===========================================================================================
  // BIG-15 — /bigchatscreen renders the seeded marathon from its own `big marathon` read
  // ===========================================================================================
  // PARKED — not a flaky test, an unresolved APP-SIDE finding. Enable this once the deep-link init order
  // below is understood or fixed; everything else in the case is already correct and verified.
  //
  // WHAT WORKS: with the two traps in the file header handled, the screen MOUNTS — that assertion passes.
  //
  // WHAT DOES NOT: the component keeps throwing
  //     TypeError: Cannot read properties of undefined (reading 'indexOf')
  //     at _ResourcePath.fromString  ->  at doc(...)
  // twice per load. That is Firestore being handed `undefined` for a document id, and the only ids built
  // that way here are the `bigchat/<assignmentDocId>/bigchatmessages` paths (ts:165, 379, 478) plus
  // `doc('bigchat', assignmentDocId)` (ts:219, 399). `assignmentDocId` is assigned ONLY in
  // initializeAfterRoleCheck() (ts:189), which runs inside the getRoles() promise — so on a deep link
  // those subscriptions appear to be reached before the assignment id exists. A valid `assignemtnId` IS
  // being passed (the mount proves the params are accepted), so this is not a missing-parameter problem.
  //
  // The marathon list also never renders, which may be the same root cause or a second gate.
  //
  // Why this is PARKED rather than adjusted to pass: the only ways to make it green today are to weaken
  // the console guard or to drop the assertion entirely. Both would hide a real app-side error on a
  // screen no test has ever exercised — the error is exactly the kind of thing this coverage work exists
  // to surface. Needs an app-side look, not a test-side workaround.
  test.fixme('BIG-15 bigchatscreen renders the seeded marathon it read from Firestore', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);

    const pa = seed.participantAssignments[0];
    const qs = new URLSearchParams({
      assignemtnId: seed.assignmentId,          // the app's spelling — do NOT "correct" it
      profileId: pa.profileid,
      assignmentprofileId: operatorProfileId,   // MUST equal the logged-in profileid — see trap 2
      admins: '',                                // see trap 1
    }).toString();

    await page.goto(`/bigchatscreen?${qs}`, { waitUntil: 'domcontentloaded' });

    const host = page.locator('app-big-chat-screen');
    await expect(
      host,
      'BIG-15: bigchatscreen must mount — if this fails on a correct URL, check the /bigchatscreen ' +
      'dashboard grant in fixtures/seed-test-project.js DRIVEN_ROUTES',
    ).toBeVisible({ timeout: 30_000 });

    // [REAL-UI] The marathon list is built from the component's own `big marathon` read and rendered as
    // .marathon-title (html:30). The seeded marathon must appear there.
    await expect(
      host.locator('.marathon-title').filter({ hasText: seed.marathonTitle }),
      `BIG-15: the seeded marathon "${seed.marathonTitle}" must render from the app's own big-marathon ` +
      'read — the URL carries ids only, never the title',
    ).toBeVisible({ timeout: 30_000 });
  });
});
