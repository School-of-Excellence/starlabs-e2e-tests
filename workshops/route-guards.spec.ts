// route-guards.spec.ts — route-level access control across the Workshops group.
//
// Recon: e2e/recon-allcomp/workshops.md "Addendum — 2026-09-04" → "Guard finding".
//
// WHY THIS FILE EXISTS SEPARATELY FROM THE OTHER WORKSHOP SPECS
//
// Every other spec in this suite logs in as the super-role admin and asserts what the screen COMPUTES.
// None of them says anything about who is allowed to open the screen in the first place. Those are two
// different properties, and only this file tests the second one.
//
// The distinction that matters: a "the route mounts for an admin without bouncing to /login" smoke is
// VACUOUS on an unguarded route — it passes just as happily with the guard deleted, because there is
// nothing to delete. The falsifiable direction is the negative one: an authenticated user WITHOUT the
// grant must not reach an operator screen. That is what WS-34/WS-35 assert.
//
// The actor is a seeded participant (roles ['participant']). None of the ROUTES entries in
// seed-workshops.js set `participant: true`, so the participant is in neither the route's roles[] nor
// its profileid[] — a working authGuard MUST deny them.
//
// SCOPE — what these cases do and do not prove:
//   They test ROUTE-LEVEL access control only. They say nothing about whether Firestore security rules
//   independently protect the underlying documents in production. The emulator runs deliberately
//   permissive rules (`allow read, write: if true`, firestore.rules), so any data a participant can see
//   HERE proves only that the route let them in — not that production would. Whether prod rules provide
//   defence-in-depth for `new_user_data` / `participant metadata` is UNVERIFIED and needs someone with
//   access to the production ruleset; it is not answerable from this repo.
import { test, expect } from '@playwright/test';
import { installWshopStubs, loginAsWshopParticipant } from './support/wshop';

/** Workshop-group routes that DO declare canActivate:[authGuard] (app.routes.ts:186/294/295). */
const GUARDED_ROUTES = [
  '/createworkshop',
  '/bigeventmentor',
  '/eiflixoperationsdashboard',
];

/** Workshop-group routes declared with NO canActivate at all (app.routes.ts:286/287/288/290/296/297). */
const UNGUARDED_ROUTES = [
  '/eiflixhomeconfig',
  '/newusersprofile',        // renders bulk new-user PII (name / email / phone)
  '/eiflixdiscoverpage',     // read AND write of classify/eiflixdiscoverpage
  '/formtemplateworkshop',
  '/campaigndashboard',
  '/wccalendar',
];

/** Navigate and report where the router actually left us. */
async function landingPathFor(page: import('@playwright/test').Page, route: string): Promise<string> {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  // authGuard resolves asynchronously (it reads the `dashboard` collection before deciding, auth.guard
  // .ts:44), so a bounce lands a moment after domcontentloaded. Give it a bounded settle.
  await page.waitForTimeout(2_500);
  return new URL(page.url()).pathname;
}

test.describe('Workshops — route-level access control (non-admin actor)', () => {
  test.beforeEach(async ({ page }) => {
    await installWshopStubs(page);
    await loginAsWshopParticipant(page);
  });

  // ===========================================================================================
  // WS-34 — POSITIVE CONTROL: a participant is denied every route that declares authGuard
  // ===========================================================================================
  // This case is what gives WS-35 its meaning. It proves the actor really is unprivileged, that the
  // seed really did withhold the grant, and that this file's assertion style can detect a guard that
  // works. Without it, WS-35 failing would be indistinguishable from a broken test.
  test('WS-34 a participant is bounced off every GUARDED workshop route', async ({ page }) => {
    const reached: string[] = [];
    for (const route of GUARDED_ROUTES) {
      const landed = await landingPathFor(page, route);
      if (landed.startsWith(route)) reached.push(`${route} -> ${landed}`);
    }
    expect(
      reached,
      `WS-34: authGuard must deny an ungranted participant. Reached anyway: ${reached.join(', ')}`,
    ).toHaveLength(0);
  });

  // ===========================================================================================
  // WS-35 — THE GAP: the same participant reaches every route that ships without canActivate
  // ===========================================================================================
  // EXPECTED TO FAIL TODAY — this is a real, open defect, pinned executably rather than only described
  // in a document. `test.fail()` is deliberate:
  //   • while the routes stay unguarded the assertion fails, the test reports as expected-failure, and
  //     CI stays green — this does not block anyone;
  //   • the moment someone adds canActivate:[authGuard] to those six routes, the assertion starts
  //     passing and Playwright reports "Expected to fail, but passed". THAT is the signal to delete the
  //     test.fail() line below, at which point this becomes a permanent regression test.
  // Writing it the other way round (pinning the current unguarded behaviour as "correct") would go
  // green today and then turn red when the app is FIXED — the wrong direction for the alarm to point.
  test('WS-35 a participant must be bounced off the UNGUARDED workshop routes', async ({ page }) => {
    test.fail(
      true,
      'KNOWN DEFECT (recon-allcomp/workshops.md → Guard finding): /eiflixhomeconfig, /newusersprofile, '
      + '/eiflixdiscoverpage, /formtemplateworkshop, /campaigndashboard and /wccalendar are declared in '
      + 'app.routes.ts:286-297 with NO canActivate, so any authenticated user reaches them. Remove this '
      + 'test.fail() once the guards are added.',
    );

    const reached: string[] = [];
    for (const route of UNGUARDED_ROUTES) {
      const landed = await landingPathFor(page, route);
      if (landed.startsWith(route)) reached.push(route);
    }
    expect(
      reached,
      `WS-35: an ungranted participant must not reach operator screens. Reached: ${reached.join(', ')}`,
    ).toHaveLength(0);
  });
});
