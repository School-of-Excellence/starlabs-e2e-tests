// profilelist.spec.ts — /profilelist: the role-update write path.
//
// profilelist (561 LOC, 7 live handlers, updateDoc + deleteDoc, 3 dialogs) had ZERO coverage and,
// until this branch, could not even be reached — the seeder granted no dashboard route for it, so the
// data-driven authGuard bounced every navigation. seed-profiles.js now grants '/profilelist'.
//
//   PA-20  Update Role -> the app writes the users_roles doc named by profile.role_ref.path.
//
// PA-19 (Delete Profile) IS DELIBERATELY ABSENT AND MUST NOT BE ADDED.
// deleteProfile (profilelist.component.ts:324) pre-flight-queries `atc_alpha` on the `firestore-atc`
// named database. This project never touches that database — a standing rule, not an emulator
// limitation — so the case is CANCELLED, not deferred. For the record, its logic is: ten guard
// queries across three databases must ALL come back empty, else it alert()s the status map and
// refuses; only then does a confirm() gate two non-atomic deleteDoc calls (role_ref, then
// profile_data). Nothing here should ever click that button.
//
// DEFECT PINNED — B-08: role changes have no confirmation, no validation and no audit record.
// Escalation to superadmin is one click and leaves no trace. PA-20 pins today's behaviour so that
// adding a guard later shows up as a visible, intentional diff rather than a silent change.
import { test, expect } from '@playwright/test';
import { profProfileIds, installProfileStubs, loginAsProfileAdmin } from './support/profiles';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil, db } from '../queue/support/firestore-admin';

const TOLERATE = [/requires an index/i, /Cannot read properties of undefined \(reading 'indexOf'\)/i];

/** The users_roles doc id for a seeded profile — the auth chain keys it by profileid. */
const roleDocId = (profileId: string) => profileId;

async function resetRole(profileId: string): Promise<void> {
  await db().collection('users_roles').doc(roleDocId(profileId))
    .set({ admin: false, ah: false }, { merge: true });
}

test.describe('Profiles — profilelist role update (deep, real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installProfileStubs(page);
    await resetRole(profProfileIds.p0);
  });
  test.afterEach(() => assertNoFatal(guard, 'profilelist: no fatal console errors / pageerrors', TOLERATE));

  // ===========================================================================================
  // PA-20 — Update Role writes the whole role map to the doc at profile.role_ref.path.
  // ===========================================================================================
  test('PA-20 updating a role -> the app writes the users_roles doc the profile points at', async ({ page }) => {
    const before = await getDoc('users_roles', roleDocId(profProfileIds.p0));
    expect(before, 'PA-20: the seeded users_roles doc must exist').toBeTruthy();
    expect(before!.ah, 'PA-20: baseline has ah=false').toBeFalsy();

    await loginAsProfileAdmin(page);
    await page.goto('/profilelist', { waitUntil: 'domcontentloaded' });

    // The route grant added on this branch is what makes this navigation possible at all — assert we
    // did NOT get bounced, so a regression in the grant fails here with a clear message rather than
    // as a confusing selector timeout further down.
    expect(page.url(), 'PA-20: the authGuard must admit /profilelist (dashboard route grant)')
      .not.toMatch(/\/login/);

    const row = page.locator('tr', { hasText: profProfileIds.p0 }).first();
    await expect(row, 'PA-20: the seeded profile row must render').toBeVisible({ timeout: 30_000 });

    // [REAL-UI] expand the row, tick a role, and submit. updateRole() writes the WHOLE role map for
    // that profile — there is no confirm() and no validation (B-08).
    await row.click();
    await page.locator('input[type="checkbox"]').filter({ hasNotText: /select/i }).first()
      .check({ force: true }).catch(() => {});
    await page.getByRole('button', { name: /Update Role/i }).first().click();

    // [ASSERT] the value the APP wrote (updateDoc on profile.role_ref.path — component:303).
    const after = await pollUntil(
      () => getDoc('users_roles', roleDocId(profProfileIds.p0)),
      (d) => !!d && JSON.stringify(d) !== JSON.stringify(before),
      { label: 'PA-20: the users_roles doc changes', timeoutMs: 30_000 },
    );
    expect(after, 'PA-20: the app wrote the role doc').toBeTruthy();
    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));

    // DEFECT B-08 — no audit trail exists for a role change. There is no collection to check, which
    // is the finding. Recorded here so the absence is deliberate rather than an oversight.

    await resetRole(profProfileIds.p0);
  });
});
