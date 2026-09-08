// route-guards.spec.ts — route-level access control across the Content group.
//
// Recon: e2e/recon-allcomp/content.md "Addendum — 2026-09-07" → "Guard finding".
//
// Same shape and the same reasoning as workshops/route-guards.spec.ts (WS-34/35): every other content spec
// logs in as the super-role admin and asserts what a screen COMPUTES; none of them says who may open the
// screen. A "mounts for an admin" smoke is vacuous on an unguarded route — it passes just as happily with
// the guard deleted. The falsifiable direction is the negative one: an authenticated user WITHOUT the
// grant must not reach an operator screen.
//
// The actor is the seeded participant (roles ['participant'], full auth chain, seed-content.js roster).
// No ROUTES entry in seed-content.js is participant-flagged, so p0 is in neither the roles[] nor the
// profileid[] of any content grant — a working authGuard MUST deny it.
//
// SCOPE: route-level access control only. The emulator runs permissive Firestore rules (firestore.rules),
// so anything a participant can see HERE proves only that the route let them in — not that production
// would. Whether prod rules independently protect `category` / `series` is not answerable from this repo.
import { test, expect } from '@playwright/test';
import { installContentStubs, loginAsContentParticipant } from './support/content';
import { landingPathFor } from './support/ui';

/** Content routes that DO declare canActivate:[authGuard] (app.routes.ts:111,117,119,145). */
const GUARDED_ROUTES = ['/ads', '/contentanalytics', '/accessscreen', '/createarenavideoasktemplate'];

/** The one content route declared with NO canActivate (app.routes.ts:125). */
const UNGUARDED_ROUTES = ['/assigncategory'];

test.describe('Content — route-level access control (non-admin actor)', () => {
  test.beforeEach(async ({ page }) => {
    await installContentStubs(page);
    await loginAsContentParticipant(page);
  });

  // ===========================================================================================
  // CN-45 — POSITIVE CONTROL: the participant is denied every route that declares authGuard
  // ===========================================================================================
  // This is what gives CN-46 its meaning: it proves the actor really is unprivileged, that the seed really
  // withheld the grants, and that this file's assertion style can detect a guard that works.
  test('CN-45 a participant is bounced off every GUARDED content route', async ({ page }) => {
    const reached: string[] = [];
    for (const route of GUARDED_ROUTES) {
      const landed = await landingPathFor(page, route);
      if (landed.startsWith(route)) reached.push(`${route} -> ${landed}`);
    }
    expect(reached, `CN-45: authGuard must deny an ungranted participant. Reached anyway: ${reached.join(', ')}`).toHaveLength(0);
  });

  // ===========================================================================================
  // CN-46 — THE GAP: the same participant reaches /assigncategory (no canActivate)
  // ===========================================================================================
  // EXPECTED TO FAIL TODAY — a real, open defect pinned executably. While the route stays unguarded the
  // assertion fails, the test reports as expected-failure, and CI stays green. The moment someone adds
  // canActivate:[authGuard] at app.routes.ts:125 the assertion passes and Playwright reports "Expected to
  // fail, but passed" — the signal to delete the test.fail() line, after which this is a permanent
  // regression test. Pinning the unguarded behaviour as "correct" would point the alarm the wrong way.
  test('CN-46 a participant must be bounced off the UNGUARDED /assigncategory route', async ({ page }) => {
    test.fail(
      true,
      'KNOWN DEFECT (recon-allcomp/content.md → Addendum 2026-09-07 → Guard finding): /assigncategory is '
      + 'declared at app.routes.ts:125 with NO canActivate, so any authenticated user reaches it. Remove '
      + 'this test.fail() once the guard is added.',
    );
    const reached: string[] = [];
    for (const route of UNGUARDED_ROUTES) {
      const landed = await landingPathFor(page, route);
      if (landed.startsWith(route)) reached.push(route);
    }
    expect(reached, `CN-46: an ungranted participant must not reach operator screens. Reached: ${reached.join(', ')}`).toHaveLength(0);
  });
});
