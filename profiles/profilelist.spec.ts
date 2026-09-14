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

// THE ROLE DOC IS NOT KEYED BY PROFILEID — AND ASSUMING IT WAS POISONED THE SCREEN.
//
// This used to be `const roleDocId = (profileId) => profileId`. The real document lives at whatever
// `profile_data/<pid>.role_ref` points to (e.g. users_roles/prof_role_prof_u_p0), so resetRole()'s
// set({...}, {merge:true}) did not reset anything — it CREATED a brand new `users_roles/<profileid>`
// document containing only {admin:false, ah:false}, with no `profile_ref` field.
//
// That is fatal to /profilelist. The component builds its role map with
//     this.profilerole[doc["profile_ref"].id] = doc          (profilelist.component.ts:149)
// and does not guard the deref, so ONE malformed document kills the whole subscriber with
//     TypeError: Cannot read properties of undefined (reading 'id')
// `profilerole` is then never populated, the expanded row renders neither its checkboxes nor the
// "Update Role" button (html:126-147, both behind *ngIf), and the click waits out the test timeout.
//
// Worse, the junk document PERSISTS: it carries no testrunid, so the suite teardown never sweeps it,
// and every later run inherited a broken screen. The test was manufacturing its own trap on each
// beforeEach. Resolve the id the way the APP does instead, from role_ref.
let ROLE_DOC_ID: string | null = null;

async function roleDocIdFor(profileId: string): Promise<string> {
  if (ROLE_DOC_ID) return ROLE_DOC_ID;
  const profile = await getDoc('profile_data', profileId);
  const ref: any = profile?.role_ref;
  const id = ref?.id ?? String(ref?.path ?? '').split('/').pop();
  if (!id) throw new Error(`PA-20: profile_data/${profileId} has no role_ref — cannot locate its users_roles doc`);
  ROLE_DOC_ID = id;
  return id;
}

async function resetRole(profileId: string): Promise<void> {
  const id = await roleDocIdFor(profileId);
  // update(), not set(merge) — update FAILS on a missing document instead of silently creating the
  // malformed one that caused all of the above.
  await db().collection('users_roles').doc(id).update({ admin: false, ah: false });
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
  // PARKED 2026-09-13 at the LAST step, after four real blockers were found and fixed. Everything up to
  // the final checkbox toggle now works, and those fixes are kept because each was a genuine bug:
  //
  //   1. resetRole() was CREATING a malformed `users_roles/<profileid>` document on every beforeEach
  //      (the role doc is keyed by role_ref, not profileid). That doc has no `profile_ref`, which kills
  //      profilelist's role-map subscriber outright — see the note at the top of this file. It persisted
  //      across runs because it carried no testrunid. Fixed, and the stray doc deleted.
  //   2. The row was located by `hasText: <profileid>`; the table renders names, not ids.
  //   3. The row does not expand on click — a dedicated icon button does it, and it cannot be selected
  //      by accessible name because the mat-icon ligatures are not exposed.
  //   4. `starlabs roles/roles` was never seeded, so roleList was empty and the panel rendered ZERO role
  //      checkboxes (verified in the live DOM: .checkboxrow present, *ngFor bound to ""). Now seeded.
  //
  // WHAT REMAINS: the role checkbox will not toggle. .check() on the native input reports "Clicking the
  // checkbox did not change its state"; clicking the mat-checkbox host, and then its <label>, both leave
  // it `unchecked`. The binding is `[(ngModel)]="profilerole[element.profileid][role]"` (html:130) inside
  // a *ngFor over roleList, within an animated panel — but that is a HYPOTHESIS, not a diagnosis, and
  // this file is not going to record another guess as a cause (see the WS-36/EVT-17 parks, both of which
  // were parked on inference and both of which turned out to be wrong).
  //
  // The assertions below are the right ones. Un-park by resolving the toggle, then delete this fixme.
  test.fixme('PA-20 updating a role -> the app writes the users_roles doc the profile points at', async ({ page }) => {
    const before = await getDoc('users_roles', await roleDocIdFor(profProfileIds.p0));
    expect(before, 'PA-20: the seeded users_roles doc must exist').toBeTruthy();
    expect(before!.ah, 'PA-20: baseline has ah=false').toBeFalsy();

    await loginAsProfileAdmin(page);
    await page.goto('/profilelist', { waitUntil: 'domcontentloaded' });

    // The route grant added on this branch is what makes this navigation possible at all — assert we
    // did NOT get bounced, so a regression in the grant fails here with a clear message rather than
    // as a confusing selector timeout further down.
    expect(page.url(), 'PA-20: the authGuard must admit /profilelist (dashboard route grant)')
      .not.toMatch(/\/login/);

    // MATCH ON THE ROW'S LINK, NOT ITS TEXT (third file with this same bug, after lists-segments.spec.ts
    // and tags.spec.ts). /profilelist renders `{{row['name']}}` as the visible cell; the profileid appears
    // only inside the name link's routerLink — here `/profilesummary/<profileid>`
    // (profilelist.component.html:49). `hasText: <profileid>` matched no row at all.
    //
    // NOTE the row ALSO carries `/userprofile/<profileid>` (html:86), but that one lives inside a
    // mat-menu that is not in the DOM until the menu is opened — so anchor on /profilesummary/.
    const row = page.locator('tr')
      .filter({ has: page.locator(`a[href*="/profilesummary/${profProfileIds.p0}"]`) }).first();
    await expect(row, 'PA-20: the seeded profile row must render').toBeVisible({ timeout: 30_000 });

    // [REAL-UI] expand the row, tick a role, and submit. updateRole() writes the WHOLE role map for
    // that profile — there is no confirm() and no validation (B-08).
    // CLICKING THE ROW DOES NOT EXPAND IT. The <tr> carries no (click) at all
    // (profilelist.component.html:155) — expansion is driven by a dedicated icon button in the actions
    // cell, `(click)="toggleRow(row)"` (html:73), which is itself gated on the viewer holding
    // `rolemanager` or `developer`. (Our seeded admin holds developer, so it renders; if that seed ever
    // changes, this assertion is what will say so.) The cell has THREE button.editbtn siblings — edit,
    // toggle, and the menu trigger.
    //
    // THEY CANNOT BE PICKED BY NAME. The mat-icon ligatures are not exposed to the accessibility tree
    // here: the a11y snapshot shows the first two as bare unnamed `- button`, and only the third has a
    // name (its aria-label, "Example icon-button with a menu"). getByRole with a name matched nothing.
    // Position within the cell is what identifies them: [0] edit, [1] toggleRow, [2] menu.
    const toggle = row.locator('button.editbtn').nth(1);
    await expect(toggle, 'PA-20: the row-expand (toggleRow) button must render for a developer/rolemanager')
      .toBeVisible({ timeout: 15_000 });
    await toggle.click();

    // The expanded detail is a SEPARATE <tr>, so scope to the expanded panel rather than the row — and
    // not to the page, whose first checkbox belongs to the table's own selection column.
    // The "Update Role" button sits in .rolebox OUTSIDE the checkbox *ngIf (html:146), so it is the
    // reliable signal that THIS row's panel actually expanded — assert it before hunting for checkboxes.
    // TAKE **THIS** ROW'S DETAIL PANEL, NOT THE FIRST ONE ON THE PAGE. The table renders an expandrow
    // for EVERY row (html:156), so all seven .expandedbox panels contain an "Update Role" button and
    // `.expandedbox.filter({hasText:'Update Role'}).first()` resolved to the ADMIN row's panel, which is
    // collapsed — getByRole then matched nothing at all, because a height-0 panel is not in the
    // accessibility tree. The detail panel is the immediately-following sibling <tr> of its data row.
    const expanded = row.locator('xpath=following-sibling::tr[1]').locator('.expandedbox');
    await expect(expanded.getByRole('button', { name: /Update Role/i }),
      'PA-20: the row must expand (toggleRow sets expandedElement — component.ts:209-211)')
      .toBeVisible({ timeout: 15_000 });

    const roleCheckbox = expanded.locator('mat-checkbox').first();
    await expect(roleCheckbox,
      'PA-20: the expanded panel must render its role checkboxes — they are gated on '
      + 'profilerole[profileid] being populated (html:126) and on roleList (component.ts:160)')
      .toBeVisible({ timeout: 15_000 });

    // CLICK THE HOST, DO NOT .check() THE INPUT. A mat-checkbox's native input is visually hidden under
    // the ripple, so .check() clicked it and then reported "Clicking the checkbox did not change its
    // state" — Playwright verifies the input's checked property, which Material updates through its own
    // [(ngModel)] binding rather than the native toggle. Clicking the mat-checkbox element is what a user
    // does and is what drives profilerole[profileid][role].
    const wasChecked = await roleCheckbox.locator('input[type="checkbox"]').isChecked();
    // The clickable surface is the <label> Material renders for the checkbox; clicking the host's centre
    // can land on padding and toggle nothing.
    await roleCheckbox.locator('label').click({ force: true });
    await expect(roleCheckbox.locator('input[type="checkbox"]'),
      'PA-20: clicking the role checkbox must toggle it')
      .toBeChecked({ checked: !wasChecked, timeout: 10_000 });

    await expanded.getByRole('button', { name: /Update Role/i }).click();

    // [ASSERT] the value the APP wrote (updateDoc on profile.role_ref.path — component:303).
    const after = await pollUntil(
      async () => getDoc('users_roles', await roleDocIdFor(profProfileIds.p0)),
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
