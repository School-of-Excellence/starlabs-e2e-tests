// workshops-list.spec.ts — Workshops list + workshop-configuration: list render, active-status filter,
// the activate slide-toggle WRITE, and the detail-page title SAVE. All drive REAL Angular screens with
// ANTI-CIRCULAR assertions and need NO composite index (the workshops list reads the whole
// `workshopconfiguration` collection client-side; the toggle/save are single-doc updates).
//
// Recon: e2e/recon-allcomp/workshops.md (WS-01 / WS-03 / WS-04 / WS-05).
// Anti-circularity:
//   • WS-01: the app renders rows from its own collectionData stream; we lower-bound the visible count
//     against a Firestore countWhere — never assert a row the test wrote.
//   • WS-04: assert the value the APP wrote to workshopconfiguration.active on a real toggle+confirm
//     (polled from Firestore), starting from a seeded inactive precondition.
//   • WS-05: assert workshopconfiguration.detailpage.title === the title we TYPED, read back from
//     Firestore (app output vs known input) — the seed only supplies the pre-existing doc.
import { test, expect } from '@playwright/test';
import {
  wsActors, wsIds, installWshopStubs, loginAsWshopAdmin, resetWorkshopInactive,
  clearPopupBanner, seedListFilterWorkshops, clearListFilterWorkshops, wsListFilterTitles,
  countLiveNotCompletedWorkshops, wsListFilterIds, popupBannerArray, popupBannerDoc, seedLegacyPopupBanner, wsPopupBannerLegacy,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, countWhere, pollUntil, queryWhere, db } from '../queue/support/firestore-admin';

const RUN = process.env.WSHOP_RUNID || 'wshop';

test.describe('Workshops — list + configuration (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'workshops list/config: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // WS-01 — authenticated admin lands on /workshops (no /login bounce) and the seeded workshop renders
  // ===========================================================================================
  test('WS-01 /workshops renders the live workshopconfiguration stream (seeded workshop appears)', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/workshops', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/workshops/, { timeout: 30_000 });

    // [REAL-UI] the component subscribes to collectionData('workshopconfiguration') and renders one
    // MatTable row per doc. Wait for the seeded "Dashboard Workshop" title the app drew from its stream.
    const dashRow = page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: `Dashboard Workshop ${RUN}` });
    await expect(dashRow, 'WS-01: the seeded workshop row must render from the live stream').toBeVisible({ timeout: 30_000 });

    // [ASSERT] the visible row count is a lower bound on the Firestore collection count: the app shows
    // every doc it streamed (all=no filter), so renderedRows >= the count of OUR seeded run docs (3).
    // We compare the app-rendered table to an INDEPENDENT Firestore count — never to a value we wrote.
    const seededCount = await countWhere('workshopconfiguration', [['testrunid', '==', RUN]]);
    expect(seededCount, 'WS-01: precondition — 3 seeded workshops for this run').toBe(3);
    const renderedRows = await page.locator('table.workshops-table tr.mat-mdc-row, table.workshops-table tr[mat-row]').count();
    expect(renderedRows, `WS-01: app rendered ${renderedRows} rows; must be >= ${seededCount} seeded`).toBeGreaterThanOrEqual(seededCount);
  });

  // ===========================================================================================
  // WS-03 — the 'active' status filter shows only active workshops; visible <= Firestore active count
  // ===========================================================================================
  test('WS-03 active-status filter never shows more rows than the live count of active workshops', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/workshops', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/workshops/, { timeout: 30_000 });

    // Wait for the table to populate before filtering.
    await expect(page.locator('tr.mat-mdc-row, tr[mat-row]').first()).toBeVisible({ timeout: 30_000 });

    // [REAL-UI] click the "Active" filter chip; it keeps not-completed workshops with ANY of the app,
    // web or EiFlix mobile switches on (2026-10-15).
    await page.getByRole('button', { name: /^Active$/ }).click();

    // The seeded inactive workshop must DISAPPEAR (the filter is the app computing over its stream).
    await expect(
      page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: `Inactive Workshop ${RUN}` }),
      'WS-03: the inactive workshop must be filtered out of the active view',
    ).toHaveCount(0, { timeout: 15_000 });

    // [ASSERT] the app's active view shows no MORE rows than Firestore's independent count of live
    // (non-completed) workshops. Upper-bound only — the stream may lag, but it can't invent actives.
    const firestoreActive = await countLiveNotCompletedWorkshops();
    const visibleActive = await page.locator('table.workshops-table tr.mat-mdc-row, table.workshops-table tr[mat-row]').count();
    expect(visibleActive, `WS-03: visible active rows (${visibleActive}) must be <= Firestore active count (${firestoreActive})`).toBeLessThanOrEqual(firestoreActive);
    // And the active workshop we seeded should be present (sanity that the filter didn't nuke everything).
    await expect(page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: `Active Workshop ${RUN}` })).toBeVisible({ timeout: 15_000 });
  });

  // ===========================================================================================
  // WS-64 — Status counts web and EiFlix mobile as live; Type filters CP / Workshop / Evergreen
  // ===========================================================================================
  test.describe('WS-64 status + type filters', () => {
    test.beforeEach(async () => { await resetWorkshopInactive(); await seedListFilterWorkshops(); });
    test.afterEach(async () => { await clearListFilterWorkshops(); });

    test('WS-64 Active includes web-only and mobile-only workshops, Inactive is all switches off, Type narrows the list', async ({ page }) => {
      await loginAsWshopAdmin(page);
      await page.goto('/workshops', { waitUntil: 'domcontentloaded' });
      const rows = page.locator('table.workshops-table tr.mat-mdc-row, table.workshops-table tr[mat-row]');
      const row = (t: string) => rows.filter({ hasText: t });
      const web = row(wsListFilterTitles.WEB), mobile = row(wsListFilterTitles.MOBILE), done = row(wsListFilterTitles.DONE);
      const inactive = row(`Inactive Workshop ${RUN}`), active = row(`Active Workshop ${RUN}`);
      await expect(web, 'WS-64: the web-only workshop renders under All').toBeVisible({ timeout: 30_000 });
      await expect(mobile).toBeVisible();
      await expect(done).toBeVisible();

      // The Active column (Breakthroughs App / Web / EiFlix Mobile switches + the Completed label) is
      // hidden for now (operator 2026-10-15): none of its controls render on any row.
      await expect(page.getByTestId('wor-change-on-workshop-status-change-14'), 'WS-64: Active column hidden').toHaveCount(0);
      await expect(page.getByTestId('wor-change-on-workshop-web-status-change-15')).toHaveCount(0);
      await expect(page.getByTestId('wor-change-on-workshop-mobile-status-change')).toHaveCount(0);
      await expect(page.getByTestId('wor-completed-pill')).toHaveCount(0);

      // Green Active chip: the same rule as the Active filter (any switch on, not completed).
      await expect(web.getByTestId('wor-active-chip'), 'WS-64: web-only shows the Active chip').toHaveText('Active');
      await expect(mobile.getByTestId('wor-active-chip'), 'WS-64: mobile-only shows the Active chip').toHaveText('Active');
      await expect(active.getByTestId('wor-active-chip'), 'WS-64: app-active shows the Active chip').toHaveText('Active');
      await expect(inactive.getByTestId('wor-active-chip'), 'WS-64: all switches off, no chip').toHaveCount(0);
      await expect(done.getByTestId('wor-active-chip'), 'WS-64: completed, no chip').toHaveCount(0);
      // The row's green left line follows the same rule as the chip.
      await expect(web, 'WS-64: web-only row has the green line').toHaveClass(/\brow-active\b/);
      await expect(mobile, 'WS-64: mobile-only row has the green line').toHaveClass(/\brow-active\b/);
      await expect(inactive, 'WS-64: all switches off, no green line').not.toHaveClass(/\brow-active\b/);
      await expect(done, 'WS-64: completed, no green line').not.toHaveClass(/\brow-active\b/);

      // Active: app, web or mobile switch on, and not completed.
      await page.getByTestId('wor-status-filter-8').click();
      await expect(web, 'WS-64: web-only is active').toBeVisible({ timeout: 15_000 });
      await expect(mobile, 'WS-64: mobile-only is active').toBeVisible();
      await expect(active, 'WS-64: app-active is still active').toBeVisible();
      await expect(inactive, 'WS-64: all switches off is not active').toHaveCount(0);
      await expect(done, 'WS-64: completed is not active').toHaveCount(0);

      // Inactive: every switch off and not completed.
      await page.getByTestId('wor-status-filter-9').click();
      await expect(inactive, 'WS-64: all switches off is inactive').toBeVisible({ timeout: 15_000 });
      await expect(web, 'WS-64: web-only is not inactive').toHaveCount(0);
      await expect(mobile, 'WS-64: mobile-only is not inactive').toHaveCount(0);
      await expect(done, 'WS-64: completed is not inactive').toHaveCount(0);

      // Type, with Status back on All.
      await page.getByTestId('wor-status-filter-7').click();
      await page.getByTestId('wor-type-filter-cp').click();
      await expect(web, 'WS-64: CP Workshop shows the cpworkshop').toBeVisible({ timeout: 15_000 });
      await expect(mobile).toHaveCount(0);
      await expect(done).toHaveCount(0);
      await expect(inactive).toHaveCount(0);

      await page.getByTestId('wor-type-filter-evergreen').click();
      await expect(mobile, 'WS-64: Evergreen shows the evergreenworkshop').toBeVisible({ timeout: 15_000 });
      await expect(web).toHaveCount(0);
      await expect(done).toHaveCount(0);

      await page.getByTestId('wor-type-filter-live').click();
      await expect(done, 'WS-64: Workshop shows the liveworkshop').toBeVisible({ timeout: 15_000 });
      await expect(inactive, 'WS-64: a seed with no type falls back to Workshop').toBeVisible();
      await expect(web).toHaveCount(0);
      await expect(mobile).toHaveCount(0);

      // Status and Type combine: Active + CP is the web-only workshop alone among ours.
      await page.getByTestId('wor-status-filter-8').click();
      await page.getByTestId('wor-type-filter-cp').click();
      await expect(web).toBeVisible({ timeout: 15_000 });
      await expect(active).toHaveCount(0);

      await page.getByTestId('wor-type-filter-all').click();
      await expect(active, 'WS-64: All types brings the rest back').toBeVisible({ timeout: 15_000 });
    });

    // Active column hidden in the list for now (operator 2026-10-15); restore with the column.
    test.skip('WS-65 the EiFlix Mobile toggle writes eiflixmobileactive and moves the workshop between Active and Inactive', async ({ page }) => {
      const before = await getDoc('workshopconfiguration', wsListFilterIds.MOBILE);
      expect(before!.eiflixmobileactive, 'WS-65: starts live on EiFlix mobile only').toBe(true);
      await loginAsWshopAdmin(page);
      await page.goto('/workshops', { waitUntil: 'domcontentloaded' });
      const row = page.locator('table.workshops-table tr.mat-mdc-row').filter({ hasText: wsListFilterTitles.MOBILE });
      const toggle = row.getByTestId('wor-change-on-workshop-mobile-status-change');
      await expect(toggle, 'WS-65: the EiFlix Mobile toggle renders').toBeVisible({ timeout: 30_000 });
      await expect(toggle.locator('button[role="switch"]'), 'WS-65: it shows the stored state').toHaveAttribute('aria-checked', 'true');

      page.once('dialog', (d) => d.accept()); // onWorkshopMobileStatusChange() opens window.confirm
      await toggle.locator('button[role="switch"]').click();
      const after = await pollUntil(
        () => getDoc('workshopconfiguration', wsListFilterIds.MOBILE),
        (d) => !!d && d.eiflixmobileactive === false,
        { label: 'WS-65: eiflixmobileactive -> false', timeoutMs: 30_000 },
      );
      expect(after!.eiflixmobileactive).toBe(false);
      expect(after!.active, 'WS-65: Active untouched').toBe(false);
      expect(after!.webactive, 'WS-65: Web untouched').toBe(false);

      // All three off now: Inactive shows it, Active does not.
      await page.getByTestId('wor-status-filter-9').click();
      await expect(row, 'WS-65: switched off everywhere -> Inactive').toBeVisible({ timeout: 15_000 });
      await page.getByTestId('wor-status-filter-8').click();
      await expect(row, 'WS-65: no longer Active').toHaveCount(0);
    });
  });

  // ===========================================================================================
  // WS-66 — EiFlix Banner: Title and Description are optional (operator 2026-10-16)
  // ===========================================================================================
  test('WS-66 the EiFlix Banner dialog saves a banner with no title and no description', async ({ page }) => {
    // Anti-circular: the app writes the new doc; the test only notes which banners existed before.
    const before = new Set((await queryWhere('eiflixbanner')).map((d) => d.id));
    let created: string[] = [];
    try {
      await loginAsWshopAdmin(page);
      await page.goto('/workshops', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('wor-actions-menu').click();   // header actions live in one menu (2026-10-16)
      await page.getByTestId('wor-open-eiflix-banner-dialog-4').click();

      const dialog = page.locator('mat-dialog-container');
      const title = dialog.locator('input[formcontrolname="title"]');
      const description = dialog.locator('textarea[formcontrolname="description"]');
      await expect(title, 'WS-66: the banner form opens').toBeVisible({ timeout: 30_000 });
      await expect(title).toHaveValue('');
      await expect(description).toHaveValue('');
      // Neither field is marked required any more (no asterisk on its label).
      await expect(title.locator('xpath=ancestor::mat-form-field[1]').locator('.mat-mdc-form-field-required-marker'),
        'WS-66: Title is not marked required').toHaveCount(0);
      await expect(description.locator('xpath=ancestor::mat-form-field[1]').locator('.mat-mdc-form-field-required-marker'),
        'WS-66: Description is not marked required').toHaveCount(0);

      await dialog.getByTestId('eb-submit-6').click();
      await expect(page.getByText('Please fill all fields'), 'WS-66: no "fill all fields" stop').toHaveCount(0);

      const added = await pollUntil(
        async () => (await queryWhere('eiflixbanner')).filter((d) => !before.has(d.id)),
        (list) => list.length === 1,
        { label: 'WS-66: the app wrote one new eiflixbanner doc', timeoutMs: 30_000 },
      );
      created = added.map((d) => d.id);
      expect((added[0] as any).title, 'WS-66: title stored as blank text').toBe('');
      expect((added[0] as any).description, 'WS-66: description stored as blank text').toBe('');
    } finally {
      // Cleanup only what this case created (the post-condition was already asserted).
      await Promise.all(created.map((id) => db().collection('eiflixbanner').doc(id).delete()));
    }
  });

  // ===========================================================================================
  // WS-67 — the header has ONE Actions button; the former header buttons are its menu items
  // ===========================================================================================
  test('WS-67 the header shows one Actions button whose menu lists every workshop action', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/workshops', { waitUntil: 'domcontentloaded' });
    const trigger = page.getByTestId('wor-actions-menu');
    await expect(trigger, 'WS-67: the Actions button renders').toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.header-actions > button'), 'WS-67: it is the only header button').toHaveCount(1);
    // Closed menu: none of the actions are on the page.
    await expect(page.getByTestId('wor-open-popup-banner-dialog-1'), 'WS-67: actions hidden until opened').toHaveCount(0);
    await expect(page.getByTestId('wor-route-6')).toHaveCount(0);

    await trigger.click();
    const items = page.locator('.mat-mdc-menu-panel [mat-menu-item], .mat-mdc-menu-panel .mat-mdc-menu-item');
    // The admin may create workshops and open New Users, so all six actions are listed, New Workshop first.
    await expect(items, 'WS-67: six actions for the admin').toHaveText(
      [/New Workshop/, /Popup Banner/, /New Users/, /Referral Code/, /EiFlix Banner/, /Products/], { timeout: 15_000 });
    await expect(page.getByTestId('wor-route-6')).toBeVisible();
    await expect(page.getByTestId('wor-open-new-users-tab-2')).toBeVisible();
    await expect(page.getByTestId('wor-open-refferalcode-dialog-3')).toBeVisible();
    await expect(page.getByTestId('wor-route-to-products-5')).toBeVisible();

    // An item still does its job: New Workshop opens the editor on a fresh id in a new tab.
    const [editor] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByTestId('wor-route-6').click(),
    ]);
    await expect(editor, 'WS-67: New Workshop opens the workshop editor').toHaveURL(/\/workshopconfig\/[^/]+$/, { timeout: 30_000 });
    await editor.close();
  });

  // ===========================================================================================
  // WS-04 — toggling a workshop inactive→active WRITES active:true to Firestore (not just optimistic UI)
  // ===========================================================================================
  // Active column hidden in the list for now (operator 2026-10-15); restore with the column.
  // While it is hidden the row's first switch is Completed, so this case must not run.
  test.skip('WS-04 activating a workshop via the slide-toggle writes active:true to Firestore', async ({ page }) => {
    // Precondition (anti-circular): force the pivot workshop back to inactive (idempotent re-runs).
    await resetWorkshopInactive();
    const before = await getDoc('workshopconfiguration', wsIds.W_INACTIVE);
    expect(before, 'WS-04: seeded inactive workshop must exist').toBeTruthy();
    expect(before!.active, 'WS-04: starts inactive').toBe(false);

    await loginAsWshopAdmin(page);
    await page.goto('/workshops', { waitUntil: 'domcontentloaded' });

    // [REAL-UI] find the inactive workshop's row, accept the confirm(), flip its Active slide-toggle.
    const row = page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: `Inactive Workshop ${RUN}` });
    await expect(row, 'WS-04: the inactive workshop row must render').toBeVisible({ timeout: 30_000 });
    page.once('dialog', (d) => d.accept()); // onWorkshopStatusChange() opens window.confirm
    // The Active column is the first cell; its mat-slide-toggle's clickable button toggles state.
    await row.locator('mat-slide-toggle button, mat-slide-toggle input[type="checkbox"], mat-slide-toggle').first().click();

    // [ASSERT] the app's updateDoc wrote active:true (workshops.component.ts:199). Polled — the value the
    // PRODUCT wrote on the real toggle, not the value the test wrote (the test only reset it to false).
    const after = await pollUntil(
      () => getDoc('workshopconfiguration', wsIds.W_INACTIVE),
      (d) => !!d && d.active === true,
      { label: 'WS-04: workshopconfiguration.active → true', timeoutMs: 30_000 },
    );
    expect(after!.active, 'WS-04: active flipped to true').toBe(true);
  });

  // ===========================================================================================
  // WS-05 — workshop-config detail-page save WRITES detailpage.title to Firestore (output vs input)
  // ===========================================================================================
  test('WS-05 workshopconfig detail-page save writes the typed title to Firestore', async ({ page }) => {
    // /workshopconfig/:id is UNGUARDED — but we log in anyway so the component's guard.getRoles()
    // profile-map calls in the constructor resolve a real profile.
    await loginAsWshopAdmin(page);
    await page.goto(`/workshopconfig/${wsIds.W_INACTIVE}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`workshopconfig/${wsIds.W_INACTIVE}`), { timeout: 30_000 });

    // The detail-page form is on the default "Enrollment Page" tab. Wait for the title input the app
    // patched from the seeded doc, then type a NEW known title.
    //
    // V2 EDITOR (app.routes.ts:287-289): /workshopconfig/:id now loads WorkshopConfigurationv2Component;
    // the legacy editor this case was written against moved to /workshopconfigold/:id. The V2 markup uses
    // formControlName="title" in two places (component.html:199 = the workshop title, :556 = a testimonial
    // title inside a section that is not rendered here), so scope to the visible first match rather than
    // relying on only one being in the DOM.
    const titleInput = page.locator('input[formcontrolname="title"]').first();
    await expect(titleInput, 'WS-05: the detail-page title input must render').toBeVisible({ timeout: 30_000 });
    await expect(titleInput).toHaveValue(/Inactive Workshop/, { timeout: 15_000 }); // patched from Firestore

    const newTitle = `WS05 Renamed ${RUN} ${Date.now()}`;
    await titleInput.fill(newTitle);

    // [REAL-UI] REQUIRED GATE — the save bar refuses to save an Enrollment page while the workshop has no
    // type. `workshoptypeCtrl` is `new FormControl('', Validators.required)` (component.ts:71) and
    // saveState returns 'blocked' whenever it is invalid (ts:521), which renders a DISABLED "Save
    // Enrollment" button (component.html:690-694). W_INACTIVE is seeded without a workshoptype, so before
    // this step the click waited out the full 120s timeout on a permanently disabled button.
    //
    // This is correct app behaviour, not a defect: the type "decides how the workshop is created and
    // delivered" and is stored on the workshop itself. Choosing it through the UI is what a user does, and
    // saveDetailPage() then writes { detailpage, workshoptype } in ONE updateDoc (ts:564) — so the title
    // assertion below is unaffected.
    await page.getByRole('button', { name: 'Live workshop', exact: true }).click();

    // [REAL-UI] the save bar's enabled "Save Enrollment" button ((click)="saveDetailPage()",
    // component.html:680). Assert it is enabled first, so a future gate regression reports "still
    // disabled" instead of timing out inside click().
    const saveBtn = page.getByRole('button', { name: /Save Enrollment/i });
    await expect(saveBtn, 'WS-05: picking a workshop type must unblock the save bar').toBeEnabled({ timeout: 15_000 });
    await saveBtn.click();

    // [ASSERT] the app's updateDoc wrote { detailpage: { ..., title: newTitle } } (ts:1518). Read it back
    // from Firestore and compare to the KNOWN typed input — app output vs known input (anti-circular).
    const after = await pollUntil(
      () => getDoc('workshopconfiguration', wsIds.W_INACTIVE),
      (d) => !!d && (d as any).detailpage?.title === newTitle,
      { label: 'WS-05: detailpage.title === typed title', timeoutMs: 30_000 },
    );
    expect((after as any)!.detailpage.title, 'WS-05: the app persisted the typed title').toBe(newTitle);
  });
});

// =============================================================================================
// WS-46 — Popup banner: `classify/eiflixpopupbanner` now stores a `popupbanner` ARRAY OF MAPS.
//
// Anti-circularity: the case drives the real dialog and then reads the document back with the
// Admin SDK, asserting the shape the APP wrote — never a value the test put there.
//
// Two things are load-bearing and neither is obvious:
//   • MIGRATION. The seed plants the PRE-ARRAY flat banner, which is what production holds today.
//     The dialog must adopt it as the first entry; if it read only the new array it would show an
//     empty editor whose first save replaced a live banner with nothing.
//   • The legacy flat fields must SURVIVE the save. The Flutter app that renders the popup reads
//     them (popup_banner_model.dart fromMap: m['enable'], m['desktop'], m['header'] …) and knows
//     nothing about `popupbanner`, so clearing them would take the live banner down on first save.
// =============================================================================================

test.describe('Workshops — popup banner stores an array of banners', () => {
  test.beforeEach(async () => { await seedLegacyPopupBanner(); });
  test.afterEach(async () => { await clearPopupBanner(); });

  test('WS-46 the dialog adopts the pre-array banner, adds a second, and saves both as an array', async ({ page }) => {
    // [PRECONDITION] the document is in the pre-array state the migration must handle.
    expect(await popupBannerArray(), 'WS-46: no popupbanner array before the first save').toBeNull();

    await loginAsWshopAdmin(page);
    await page.goto('/workshops', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('wor-actions-menu').click();   // header actions live in one menu (2026-10-16)
    await page.getByTestId('wor-open-popup-banner-dialog-1').click();

    // [ASSERT] the live flat banner was adopted, so the operator sees it rather than an empty editor.
    const picks = page.getByTestId('pb-select-banner-10');
    await expect(picks, 'WS-46: the pre-array banner is adopted as the only entry').toHaveCount(1, { timeout: 30_000 });
    await expect(picks.first(), 'WS-46: and is labelled by its title').toContainText(`WS Legacy Banner ${RUN}`);

    // Add a second banner and save both.
    await page.getByTestId('pb-add-banner-9').click();
    await expect(picks, 'WS-46: a second banner is added to the list').toHaveCount(2, { timeout: 15_000 });
    await page.getByTestId('pb-save-8').click();

    // [ASSERT] the APP wrote an array of maps under `popupbanner`.
    const arr = await pollUntil(
      () => popupBannerArray(),
      (a) => Array.isArray(a) && a.length === 2,
      { label: 'WS-46: the app writes a two-entry popupbanner array', timeoutMs: 30_000 },
    );
    expect(Array.isArray(arr), 'WS-46: popupbanner is an array').toBe(true);
    expect(arr!.length, 'WS-46: one map per banner').toBe(2);
    expect(typeof arr![0], 'WS-46: each entry is a map').toBe('object');
    // The adopted banner kept its content through the migration — this is the value the APP carried
    // across from the flat fields, not one the test wrote into the array.
    expect(arr![0]['title'], 'WS-46: the adopted banner keeps its title').toBe(wsPopupBannerLegacy.title);
    expect(arr![0]['button1link'], 'WS-46: and its link').toBe(wsPopupBannerLegacy.button1link);
    expect(arr![0]['enable'], 'WS-46: and its switch').toBe(true);
    // A new banner starts empty and OFF, so adding one can never put something live by accident.
    expect(arr![1]['enable'], 'WS-46: the added banner starts switched off').toBe(false);
    expect(arr![1]['title'], 'WS-46: and empty').toBe('');

    // [ASSERT] the legacy flat fields are STILL on the document. The app that renders the popup reads
    // them and knows nothing about the array, so dropping them would take the live banner down.
    const docAfter = await popupBannerDoc();
    expect(docAfter['title'], 'WS-46: the legacy flat title survives the save').toBe(wsPopupBannerLegacy.title);
    expect(docAfter['enable'], 'WS-46: and the legacy flat switch').toBe(true);
  });

  // ===========================================================================================
  // WS-47 — the master-detail behaviour, which is where the risk in this change actually sits.
  //
  // One set of six ProseMirror editors is shared across every banner, so the form is only ever a
  // working copy of the SELECTED one. commitForm() writes it back before any selection change; get
  // that wrong and switching banners silently discards whatever was just typed. WS-46 proves the
  // stored SHAPE — this proves nothing is lost on the way there.
  //
  // The edit is made in `button1link`, a plain <input>. The other per-banner fields are ngx-editor
  // (ProseMirror) contenteditables, which no spec in this hub drives — eiflix-discover-page.spec.ts
  // avoids them for the same reason. A plain input proves the same rule without the flake.
  // ===========================================================================================
  test('WS-47 switching between banners keeps each one\'s edits, and removing one drops only it', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/workshops', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('wor-actions-menu').click();   // header actions live in one menu (2026-10-16)
    await page.getByTestId('wor-open-popup-banner-dialog-1').click();

    const picks = page.getByTestId('pb-select-banner-10');
    const link = page.getByTestId('pb-button1link-12');
    await expect(picks, 'WS-47: the adopted banner is the only one to start with').toHaveCount(1, { timeout: 30_000 });
    await expect(link, 'WS-47: banner 1 shows the adopted link').toHaveValue(wsPopupBannerLegacy.button1link, { timeout: 15_000 });

    // Add a second banner; it becomes the selected one and starts empty.
    await page.getByTestId('pb-add-banner-9').click();
    await expect(picks, 'WS-47: two banners now').toHaveCount(2, { timeout: 15_000 });
    await expect(link, 'WS-47: a new banner starts empty').toHaveValue('');

    const second = `https://example.com/second-${RUN}`;
    await link.fill(second);
    // Each banner has its own switch; turn the new one on.
    await page.getByTestId('pb-toggle-enable-3').click();

    // [ASSERT] switching away shows banner 1's OWN value, not the one just typed...
    await picks.nth(0).click();
    await expect(link, 'WS-47: banner 1 still shows its own link').toHaveValue(wsPopupBannerLegacy.button1link, { timeout: 15_000 });

    // ...and switching back restores banner 2's edit. This is the assertion that fails if
    // commitForm() does not run before a selection change, or patchForm() does not refill the form.
    await picks.nth(1).click();
    await expect(link, 'WS-47: banner 2 kept the edit made before switching away').toHaveValue(second, { timeout: 15_000 });

    await page.getByTestId('pb-save-8').click();

    // [ASSERT] both banners are stored, each with its own link and its own switch.
    const arr = await pollUntil(
      () => popupBannerArray(),
      (a) => Array.isArray(a) && a.length === 2,
      { label: 'WS-47: two banners saved', timeoutMs: 30_000 },
    );
    expect(arr![0]['button1link'], 'WS-47: banner 1 keeps the adopted link').toBe(wsPopupBannerLegacy.button1link);
    expect(arr![1]['button1link'], 'WS-47: banner 2 keeps the typed link').toBe(second);
    expect(arr![0]['enable'], 'WS-47: banner 1 stays as it was').toBe(true);
    expect(arr![1]['enable'], 'WS-47: banner 2 was switched on independently').toBe(true);

    // [ASSERT] removing one drops ONLY it. window.confirm guards the remove, so answer it first.
    page.once('dialog', d => d.accept());
    await page.getByTestId('pb-remove-banner-11').nth(1).click();
    await expect(picks, 'WS-47: back to one banner').toHaveCount(1, { timeout: 15_000 });
    await page.getByTestId('pb-save-8').click();

    const after = await pollUntil(
      () => popupBannerArray(),
      (a) => Array.isArray(a) && a.length === 1,
      { label: 'WS-47: one banner left after the remove', timeoutMs: 30_000 },
    );
    expect(after![0]['button1link'], 'WS-47: the one left is the one not removed').toBe(wsPopupBannerLegacy.button1link);
  });
});
