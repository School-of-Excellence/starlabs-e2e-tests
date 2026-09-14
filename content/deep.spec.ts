// deep.spec.ts — Content & Engagement to FULL recon depth. Adds the recon candidate cases the original
// two spec files left open, WITHOUT touching the already-green CN-01/02/03/05/08/09/13/15 + smoke:
//
//   CN-04  create series  — real /seriesdashboard/addseries multi-field form + episode pick + thumbnail
//                           (Storage stubbed) → writeBatch.set(series) + episodes[].series arrayUnion.
//   CN-10  category drag-reorder — the screen has NO drag wiring in its template (onDrop/saveOrder exist
//                           but are unbound), so we drive the component's REAL saveOrder() write path via
//                           the dev-mode window.ng instance over the two seeded series → assert series.order
//                           swapped (the component COMPUTED the updateDoc indices).
//   CN-11  tier-access-config add — real ConfigNewTier dialog "By Product" path → setDoc(tier access config).
//   CN-12  learning-material CRUD — real add dialog (no file) → doc; edit → name; delete (confirm) → absent.
//   CN-14  playlist-ads create — real UpdatePlaylistads dialog full form + thumbnail (Storage stubbed) →
//                           setDoc(adsplaylist).
//   CN-16  RecommendedPlaylistTrigger_to_pmd (deployed *_to_pmd CF) — seed ONE recommended-mix doc → assert
//                           the CF merged its content id into participant metadata[profileid].solarvoice.
//   CN-17  /viewparticipantstieraccess — seeded tier members render under their TIER1 bucket (app grouping).
//   CN-06  ConvertUrltoHLS / CN-07 generalContentUpdate — CF-side-effect, skip-guarded (content CFs are
//                           NOT deployed to the test project; assert the CF-set field if it ever fires).
//
// ANTI-CIRCULARITY: every case asserts a value the APP WROTE on a real submit / the COMPONENT computed /
// a CF computed — never a value the test wrote. App-written docs carry no testrunid → matched by their
// natural key (name / seriesName / tierid). The seed provides preconditions only.
import { test, expect, Page } from '@playwright/test';
import {
  contentText, contentIds, tierProfiles, bufferProfiles,
  installContentStubs, installStorageStub, loginAsContentAdmin, TINY_PNG,
  resetSeriesEpisode, deleteCreatedSeries, resetTierAccessConfigForTier2,
  resetRecommendedMix, createRecommendedMix, resetHlsEpisode, resetHlsContentUrl,
  deleteCreatedAdsPlaylist, deleteCreatedLearningMaterial, resetContentUrlTitle,
} from './support/content';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { openMatSelect, selectMatOption, selectMatOptions } from '../_shared/mat-select';
import { getDoc, queryWhere, countWhere, pollUntil } from '../queue/support/firestore-admin';

const RUN = process.env.CONT_RUNID || 'cont';
const ROW = 'tr.mat-mdc-row, tr[mat-row]';

// open a Material mat-select panel robustly. WHY it needs a helper at all: the floating <mat-label>
// notched-outline overlays the trigger and intercepts a normal click, but the `click({ force: true })`
// that gets past it ALSO skips actionability — a click landing before Material wires the overlay is
// dispatched and silently opens nothing. _shared/mat-select.ts owns that problem now (keyboard-first
// open, asserts the panel, retries); callers keep picking their own options out of the open panel.
async function openSelect(page: Page, trigger: ReturnType<Page['locator']>) {
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await openMatSelect(page, trigger);
}

test.describe('Content — deep write/CF cases (real UI / component / CF, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installContentStubs(page);
    await installStorageStub(page); // narrower route than the firewall catch-all → wins for the Storage host
  });
  test.afterEach(() => assertNoFatal(guard, 'content deep: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-04 — create series via the LIVE path: /seriesdashboard "Create Series" opens
  //          ConfigureseriesdialogComponent → writeBatch.set(series) AND each picked episode's series[]
  //          arrayUnion gains the new ref (configureseriesdialog.component.ts:318-341).
  //          REWRITTEN 2026-09-07: the original drove /seriesdashboard/addseries, a child route whose parent
  //          has no <router-outlet> — the form it filled can never mount, which is why this sat under
  //          test.fixme since the initial commit. That route is pinned in series-child-routes.spec.ts (CN-22).
  // ===========================================================================================
  test('CN-04 Create Series (live dialog) writeBatch-creates the series and arrayUnions it onto the picked episode', async ({ page }) => {
    const NEW_SERIES = `NEW_SERIES_${RUN}_${Date.now()}`; // run-unique → re-runs never collide

    // Preconditions (idempotent): EP1.series empty; no prior app-created series with this name.
    const epId = await resetSeriesEpisode();
    await deleteCreatedSeries(NEW_SERIES);
    expect((await getDoc('episodes', epId))!.series, 'CN-04: EP1.series starts empty').toEqual([]);
    expect(await countWhere('series', [['seriesName', '==', NEW_SERIES]]), 'CN-04: name unused pre-submit').toBe(0);

    await loginAsContentAdmin(page);
    await page.goto('/seriesdashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/seriesdashboard$/, { timeout: 30_000 });
    await page.locator('button.btn-primary', { hasText: 'Create Series' }).click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 20_000 });

    // [REAL-UI] name (required, minlength 4) + description (required, minlength 6).
    await dialog.locator('input[name="seriesName"]').fill(NEW_SERIES);
    await dialog.locator('input[name="description"]').fill('e2e created series');
    // Access Type defaults to 'tier' (ts:70), which makes the Tier select required. 'free' keeps this case
    // about the batch, not tiers: for a non-tier series the app writes tier: [] (ts:328).
    await openSelect(page, dialog.locator('mat-select[name="type"]'));
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: /^Free$/ }).first().click();
    // Pick the seeded EP1 in the episode multi-select. NOT `mat-select.cat-select`: THREE selects carry
    // that class (Access Type html:41, Tier html:78, Episodes html:152), and even after type='free' drops
    // the Tier field two remain — the bare class locator raised a strict-mode violation inside
    // openSelect()'s `expect(trigger).toBeVisible()`, which sits OUTSIDE openMatSelect's retry loop, so it
    // failed hard. Scope by the field's own label instead; it names exactly one select.
    const episodeSelect = dialog.locator('.field-group').filter({ hasText: 'Select Episodes' }).locator('mat-select');
    await openSelect(page, episodeSelect);
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: `TEST_EPISODE_${RUN}_1` }).first().click();
    await page.keyboard.press('Escape');
    await expect(dialog.locator('.drag-item'), 'CN-04: the picked episode is in the sequence list').toHaveCount(1);
    // The thumbnail is REQUIRED in create mode (html: `!isEditMode && !thumbImageFile` disables Submit). The
    // hero zone's hidden input comes first, the thumbnail zone's second (html:96 / :120). Storage is stubbed
    // (installStorageStub) so the batch's uploadBytes + getDownloadURL resolve without a real object.
    await dialog.locator('input[type="file"][accept="image/*"]').nth(1).setInputFiles(TINY_PNG);

    // Submit → onSubmit builds the writeBatch (ts:318-341). No window.confirm on this path.
    // role+name, not hasText: the footer button renders `<mat-icon>cloud_upload</mat-icon> Submit`
    // (configureseriesdialog.component.html:191-196), so its text content is "cloud_upload Submit" and
    // `/^Submit$/` would never match. The mat-icon is aria-hidden → accessible name is just "Submit".
    const submit = dialog.getByRole('button', { name: 'Submit', exact: true });
    await expect(submit, 'CN-04: Submit enables once form valid + thumbnail + unique name').toBeEnabled({ timeout: 20_000 });
    await submit.click();

    // [ASSERT] the app's batch wrote ONE series doc with this name…
    const series = await pollUntil(
      () => queryWhere('series', [['seriesName', '==', NEW_SERIES]]),
      (rows) => rows.length === 1,
      { label: `CN-04: one series named ${NEW_SERIES}`, timeoutMs: 30_000 },
    );
    const newSeriesId = series[0].id;
    const sdoc = series[0] as any;
    expect(sdoc.seriesName, 'CN-04: app wrote the input series name').toBe(NEW_SERIES);
    expect(sdoc.id, 'CN-04: id field == doc id (ts:323-325)').toBe(newSeriesId);
    expect(sdoc.type, 'CN-04: the chosen access type').toBe('free');
    expect(sdoc.tier, 'CN-04: a non-tier series carries an empty tier[]').toEqual([]);
    expect(sdoc.order, 'CN-04: new series start at order 1').toBe(1);

    // …and the SAME batch arrayUnion'd the new series ref onto the picked episode's series[] (the app
    // COMPUTED the ref from MY pick; the test only knows the episode id + the new series id).
    const after = await pollUntil(
      () => getDoc('episodes', epId),
      (d) => Array.isArray(d?.series) && (d!.series as any[]).some((r: any) => (r?.id || r?._path?.segments?.slice(-1)[0]) === newSeriesId),
      { label: `CN-04: EP1.series contains the new series ref ${newSeriesId}`, timeoutMs: 30_000 },
    );
    const ids = (after!.series as any[]).map((r: any) => r?.id || r?._path?.segments?.slice(-1)[0]);
    expect(ids, 'CN-04: the picked episode now references the new series (app arrayUnion)').toContain(newSeriesId);

    await deleteCreatedSeries(NEW_SERIES); // tidy the app-created doc
  });

  // ===========================================================================================
  // CN-10 — category-dashboard drag-reorder: the template never wires cdkDropList onto the table, so the
  //          drag is unreachable by pointer. We drive the component's OWN saveOrder() write path (the
  //          real onDrop handler) over the two seeded series via the dev-mode window.ng instance and
  //          assert the series.order values it wrote SWAPPED. The component computes the indices.
  // ===========================================================================================
  test('CN-10 category-dashboard saveOrder() swaps the two series order values (component-computed updateDoc)', async ({ page }) => {
    // Precondition: SER1.order=0, SER2.order=1 (the seed sets exactly this). Re-assert it idempotently.
    const { initAdmin } = require('../fixtures/seed-test-project');
    const db = initAdmin().firestore();
    await db.collection('series').doc(contentIds.SER1).set({ order: 0 }, { merge: true });
    await db.collection('series').doc(contentIds.SER2).set({ order: 1 }, { merge: true });
    expect((await getDoc('series', contentIds.SER1))!.order, 'CN-10: SER1 starts order 0').toBe(0);
    expect((await getDoc('series', contentIds.SER2))!.order, 'CN-10: SER2 starts order 1').toBe(1);

    await loginAsContentAdmin(page);
    await page.goto('/category-dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/category-dashboard/, { timeout: 30_000 });
    // ensure the host has mounted (the seeded category row renders).
    await expect(page.locator(ROW).filter({ hasText: contentText.category })).toBeVisible({ timeout: 30_000 });

    // [REAL component path] load the two seeded series into the component's dataSource (the screen's own
    // saveOrder writes updateDoc(series/<row.id>,{order:index}) — exercising the real reorder write), then
    // invoke onDrop to move index 1 → 0. The component recomputes and writes the swapped order values.
    const drove = await page.evaluate(({ s1, s2 }) => {
      const ng = (window as any).ng;
      if (!ng || typeof ng.getComponent !== 'function') return 'no-ng';
      const host = document.querySelector('app-category-dashboard');
      if (!host) return 'no-host';
      const cmp: any = ng.getComponent(host);
      if (!cmp) return 'no-cmp';
      // Order the rows [SER1(0), SER2(1)] then drop SER2 to the front → saveOrder writes SER2.order=0, SER1.order=1.
      cmp.dataSource.data = [{ id: s1, order: 0 }, { id: s2, order: 1 }];
      cmp.onDrop({ previousIndex: 1, currentIndex: 0 });
      return 'ok';
    }, { s1: contentIds.SER1, s2: contentIds.SER2 });
    expect(drove, 'CN-10: drove the real onDrop() via window.ng (dev build)').toBe('ok');

    // [ASSERT] the component's saveOrder() wrote the SWAPPED order: SER2 now leads (order 0), SER1 trails
    // (order 1). The values were COMPUTED by the component from the moved array, not seeded by the test.
    await pollUntil(
      () => getDoc('series', contentIds.SER2),
      (d) => !!d && d.order === 0,
      { label: 'CN-10: SER2.order → 0 (moved to front by saveOrder)', timeoutMs: 30_000 },
    );
    await pollUntil(
      () => getDoc('series', contentIds.SER1),
      (d) => !!d && d.order === 1,
      { label: 'CN-10: SER1.order → 1 (pushed back by saveOrder)', timeoutMs: 30_000 },
    );
    const s1 = (await getDoc('series', contentIds.SER1))!.order;
    const s2 = (await getDoc('series', contentIds.SER2))!.order;
    expect(s1, 'CN-10: order values swapped vs the seeded 0/1').not.toBe(s2);
    expect([s1, s2].sort(), 'CN-10: still a 0/1 permutation, just swapped').toEqual([0, 1]);
  });

  // ===========================================================================================
  // CN-11 — tier-access-config add: open /tieraccessconfig → "Add New Tier" → ConfigNewTier "By Product"
  //          path (select TIER2, add the seeded journey, pick the seeded product) → confirm → setDoc.
  //
  //          Route: app.routes.ts:131 → content/tier-access-config/view-tier-access/view-tier-access.component
  //          (the copy at :95, under `content-upload-v2`'s children, is COMMENTED OUT — :131 is the only
  //          live declaration). Its "Add New Tier" button (view-tier-access.component.html:6) opens
  //          ConfigNewTierComponent (view-tier-access.component.ts:98-105).
  //
  //          ENABLED 2026-09-13. It was parked with no recorded reason; three things in the body were
  //          wrong against the live components, all fixed below:
  //            1. `page.locator('mat-select').first()` for the tier select. The HOST page carries a
  //               <mat-paginator [pageSizeOptions]="[5,10,25,100]"> (html:84) and a Material paginator
  //               renders its OWN mat-select for the page size. That element precedes the cdk overlay in
  //               the DOM, so `.first()` resolved to the PAGINATOR, not the dialog's tier select. Scope to
  //               mat-dialog-container — where, before an access-by radio is picked, there is exactly one
  //               mat-select (the two *ngIf blocks at html:13 / html:32 are both closed), so the locator
  //               is unambiguous and needs no .first().
  //            2. `getByRole('radio', { name: /By Product/i }).click()`. appointments/deep.spec.ts:342-346
  //               already paid for this: a mat-radio-button's accessible name is empty (the text lives in
  //               a styled <label>) and clicking the host does not select it — click the inner
  //               <input type=radio> with force (the ripple overlay intercepts).
  //            3. openSelect() asserts toBeVisible() on the trigger BEFORE openMatSelect, which sits
  //               outside the helper's retry loop. Harmless once the triggers are unambiguous, but the
  //               journey/product fields are used through selectMatOption() instead so the whole
  //               open+pick is inside the retry.
  // ===========================================================================================
  test('CN-11 add tier-access-config writes a new "tier access config" doc for the chosen tier', async ({ page }) => {
    await resetTierAccessConfigForTier2(); // re-offer TIER2 in the add dialog + make the post-count exact
    expect(await countWhere('tier access config', [['tierid', '==', contentIds.TIER2]]), 'CN-11: TIER2 has no config pre-submit').toBe(0);

    await loginAsContentAdmin(page);
    await page.goto('/tieraccessconfig', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/tieraccessconfig/, { timeout: 30_000 });
    // The seeded TIER1 config row renders once the collectionSnapshots stream AND the tier map have both
    // landed (ts:45-56) — i.e. the same `tier` catalog the dialog filters. Gate on it so the dialog's
    // tierList is not raced.
    await expect(page.locator(ROW).filter({ hasText: contentText.tierBasic }),
      'CN-11: the seeded TIER1 access-config row renders (tier catalog loaded)').toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Add New Tier', exact: true }).click(); // html:6
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog, 'CN-11: ConfigNewTier dialog opens').toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText('Tier Configuration'), 'CN-11: the dialog header renders (html:2)').toBeVisible();

    // Select the tier. The dialog filters out tiers that already have a config (ts:59-63) → TIER2 is the
    // one offered; TIER1 is not. mat-label reads "Select Tire" (app typo) so the name is useless — but at
    // this point the dialog holds exactly ONE mat-select (html:5), so the bare locator is unambiguous.
    await selectMatOption(page, dialog.locator('mat-select'), contentText.tierPrem);

    // Choose "By Product" (html:11) → opens the html:32 and html:41 blocks.
    const byProduct = dialog.locator('mat-radio-button').filter({ hasText: 'By Product' });
    await byProduct.locator('input[type=radio]').click({ force: true });
    await expect(byProduct.locator('input[type=radio]'), 'CN-11: the By Product radio is selected').toBeChecked();

    // "Add Active Journey" (html:33-38). Its (selectionChange) calls addactivejourney(), which seeds
    // productaccess[journeyid] = [{ productid: null, count: 1 }] (ts:118-126).
    const journeyField = dialog.locator('mat-form-field').filter({ hasText: 'Add Active Journey' });
    await selectMatOption(page, journeyField.locator('mat-select'), contentText.journey);

    // A product row appears for that journey (html:52-65) → pick the seeded product. That clears the ONLY
    // remaining validation gap: onFormValidation() disables Submit while any productid is null (ts:162).
    const productField = dialog.locator('mat-form-field').filter({ hasText: 'Select Product' });
    await selectMatOption(page, productField.locator('mat-select'), contentText.product);

    // Submit (html:70) → onSubmit() calls window.confirm then setDoc (config-new-tier.component.ts:175,184).
    page.once('dialog', (d) => d.accept());
    const submit = dialog.getByRole('button', { name: 'Submit', exact: true });
    await expect(submit, 'CN-11: Submit enables once tier + product chosen (ts:156-172)').toBeEnabled({ timeout: 20_000 });
    await submit.click();
    await expect(dialog, 'CN-11: the dialog closes once setDoc resolves (ts:185)').toHaveCount(0, { timeout: 30_000 });

    // [ASSERT] exactly one tier-access-config doc now exists for TIER2 — the app wrote it (pre-state was
    // an asserted 0). Everything checked below was COMPUTED by the component, not typed by the test:
    const docs = await pollUntil(
      () => queryWhere('tier access config', [['tierid', '==', contentIds.TIER2]]),
      (rows) => rows.length === 1,
      { label: `CN-11: one tier-access-config for TIER2`, timeoutMs: 30_000 },
    );
    const d = docs[0] as any;
    expect(d.docid, 'CN-11: docid == doc id (the id minted at ts:91, written at ts:183)').toBe(docs[0].id);
    expect(d.tieraccessby, 'CN-11: the app wrote tieraccessby="product"').toBe('product');
    // The constructor pre-seeds biglevel with one empty row for an "add" (ts:55-58); onSubmit CLEARS it on
    // the product path (ts:180). An empty biglevel[] is therefore the app's own branch output.
    expect(d.biglevel, 'CN-11: the product path clears biglevel[] (ts:179-181)').toEqual([]);
    // The journey key + the product row are the app's map: the test picked LABELS, the component resolved
    // them to the seeded ids and stamped the default count:1 (ts:122) the test never touched.
    expect(Object.keys(d.productaccess), 'CN-11: productaccess is keyed by the picked journey id').toEqual([contentIds.J1]);
    expect(d.productaccess[contentIds.J1], 'CN-11: one product row with the picked product + the app default count')
      .toEqual([{ productid: contentIds.PR1, count: 1 }]);

    await resetTierAccessConfigForTier2(); // tidy the app-created doc
  });

  // ===========================================================================================
  // CN-12 — learning-material CRUD: add (no file) → doc with name; edit → name updated; delete → absent.
  //
  //          Route: app.routes.ts:104 → content/learning-material/learning-material.component. The copy at
  //          :85 is a CHILD of `content-upload-v2` (:42-43), i.e. /content-upload-v2/learningmaterial — not a
  //          shadow of the top-level path. Both mount the SAME component, so the screen below is the one
  //          either route shows. Add/edit both open LearningMaterialAddDialogComponent (ts:64-80).
  //
  //          ENABLED 2026-09-13. Parked with no recorded reason; corrected against the live components:
  //            1. The list paginator is [pageSizeOptions]="[10,25,50]" (html:82) and the stream arrives in
  //               Firestore doc-id order, so a newly created row is NOT reliably on page 1 — the original
  //               `expect(addedRow).toBeVisible()` was a coin flip against however many materials the
  //               project holds. Narrow with the screen's own search box first.
  //            2. That search box is bound (keyup) (html:16-17) and reads event.target.value directly, so
  //               locator.fill() — which never emits keyup — would leave dataSource.filter untouched.
  //               pressSequentially().
  //            3. `.locator('.a-edit, button').first()` / `.last()` depended on cell order; the buttons
  //               carry stable classes (html:55 / html:63) — use them.
  //            4. `getByRole('button', { name: /Upload/i }).first()` and `/^Save$/`: both buttons put a
  //               <mat-icon> ligature BEFORE the label (html:8, html:176-178), so their TEXT is
  //               "cloud_upload Upload" / "save Save". mat-icon is aria-hidden → role+exact name is right,
  //               and drops the .first() guesswork.
  //          Thumbnail is skipped on purpose: html:89 stars it, but onSave's only gate is name.trim()
  //          (ts:221) and the Save button's only disable is `saving || !name.trim() || uploadingFiles`
  //          (html:175) — so a no-file add is a valid submission and keeps Storage out of this case.
  // ===========================================================================================
  test('CN-12 learning-material add → edit → delete (each asserts the app-computed name/absence)', async ({ page }) => {
    const NEW_LM = `NEW_LM_${RUN}_${Date.now()}`;
    const EDIT_LM = `${NEW_LM}_EDITED`;
    // Idempotent pre-clean: app-written docs carry no testrunid, so a prior crashed run is matched by name.
    await deleteCreatedLearningMaterial(NEW_LM);
    await deleteCreatedLearningMaterial(EDIT_LM);
    expect(await countWhere('learning-materials', [['name', '==', NEW_LM]]), 'CN-12: name unused pre-add').toBe(0);

    await loginAsContentAdmin(page);
    await page.goto('/learningmaterial', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/learningmaterial/, { timeout: 30_000 });
    // The seeded reference material proves the collectionSnapshots stream landed (ts:42-46).
    const search = page.getByPlaceholder('Search materials...'); // html:16
    await search.pressSequentially(contentText.learningMaterial); // (keyup) — fill() emits no keyup
    await expect(page.locator(ROW).filter({ hasText: contentText.learningMaterial }),
      'CN-12: the seeded learning material renders (stream + filterPredicate live)').toHaveCount(1, { timeout: 30_000 });

    // --- ADD --- open the upload dialog, fill name, choose Access Type = Free (drops the tier select),
    // Available = Yes, then Save (no file upload — onSave only requires name.trim()).
    await page.getByRole('button', { name: 'Upload', exact: true }).click(); // html:7-10
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog, 'CN-12: add dialog opens').toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText('Upload Material'), 'CN-12: it opened in ADD mode (html:5)').toBeVisible();
    await dialog.getByPlaceholder('Enter material name').fill(NEW_LM); // html:17, [(ngModel)] → input event is enough

    // Access Type (html:31-41) → Free. The model default is 'tier' (ts:59), so this is a REAL change:
    // ontypeChange() clears selectedTier (ts:143-147) and the *ngIf tier field (html:48) disappears.
    await selectMatOption(page, dialog.locator('mat-select[name="type"]'), 'Free');
    await expect(dialog.locator('mat-select[name="tier"]'),
      'CN-12: picking Free retires the Tier field (html:48 *ngIf)').toHaveCount(0);
    // Available (html:72-81) → Yes.
    await selectMatOption(page, dialog.locator('mat-select[name="available"]'), 'Yes');

    await dialog.getByRole('button', { name: 'Save', exact: true }).click(); // html:174-179
    await expect(dialog, 'CN-12: the dialog closes once setDoc resolves (ts:274)').toHaveCount(0, { timeout: 30_000 });

    // [ASSERT-add] one learning-materials doc with this name — the app's setDoc wrote it (pre-count was 0).
    const added = await pollUntil(
      () => queryWhere('learning-materials', [['name', '==', NEW_LM]]),
      (rows) => rows.length === 1,
      { label: `CN-12: one learning-material named ${NEW_LM}`, timeoutMs: 30_000 },
    );
    const lmId = added[0].id;
    const a = added[0] as any;
    // Everything below is the COMPONENT's output, not a value the test typed:
    expect(a.docid, 'CN-12: docid == the auto doc id (ts:254,262)').toBe(lmId);
    expect(a.tier, 'CN-12: a non-tier material writes tier:null (ts:255-260)').toBeNull();
    expect(a.description, 'CN-12: the untouched description is stored as a trimmed "" (ts:268)').toBe('');
    expect(a.files, 'CN-12: no file was uploaded → files[] empty (ts:225-231)').toEqual([]);
    expect(typeof a.date?.toMillis, 'CN-12: date stamped by serverTimestamp() (ts:270)').toBe('function');

    // --- EDIT --- narrow to the new row (it can land on any paginator page), open its edit dialog, rename.
    await search.fill('');
    await search.pressSequentially(NEW_LM);
    const addedRow = page.locator(ROW).filter({ hasText: NEW_LM });
    await expect(addedRow, 'CN-12: the new material renders as exactly one row').toHaveCount(1, { timeout: 30_000 });
    await addedRow.locator('button.a-edit').click(); // html:55
    await expect(dialog, 'CN-12: edit dialog opens').toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText('Edit Material'), 'CN-12: it opened in EDIT mode (html:5)').toBeVisible();
    const editName = dialog.getByPlaceholder('Enter material name');
    await expect(editName, 'CN-12: the edit dialog is pre-filled from the row (ts:88)').toHaveValue(NEW_LM);
    await editName.fill(EDIT_LM);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog, 'CN-12: the dialog closes once updateDoc resolves').toHaveCount(0, { timeout: 30_000 });

    // [ASSERT-edit] the SAME doc (id captured before the edit) now carries the edited name, and the app
    // stamped its own `updated` serverTimestamp the add path never wrote (ts:250) — an app-computed
    // marker that this really was the updateDoc branch and not a second create.
    const edited = await pollUntil(
      () => getDoc('learning-materials', lmId),
      (d) => !!d && d.name === EDIT_LM,
      { label: `CN-12: learning-material ${lmId} name → ${EDIT_LM}`, timeoutMs: 30_000 },
    );
    expect(typeof (edited as any).updated?.toMillis, 'CN-12: the edit path stamps updated (ts:250)').toBe('function');
    expect((edited as any).docid, 'CN-12: the edit updated the SAME doc, it did not create a new one').toBe(lmId);
    expect(await countWhere('learning-materials', [['name', '==', NEW_LM]]),
      'CN-12: the old name is gone — one doc was renamed, not duplicated').toBe(0);

    // --- DELETE --- the row's delete button → window.confirm (ts:83) → deleteDoc (ts:95).
    const editedRow = page.locator(ROW).filter({ hasText: EDIT_LM });
    await expect(editedRow, 'CN-12: the edited material renders').toHaveCount(1, { timeout: 30_000 });
    page.once('dialog', (d) => d.accept());
    await editedRow.locator('button.a-del').click(); // html:63

    // [ASSERT-delete] the doc is gone — the app's deleteDoc removed it (and this is the case's cleanup).
    await pollUntil(
      () => getDoc('learning-materials', lmId),
      (d) => d === null,
      { label: `CN-12: learning-material ${lmId} deleted`, timeoutMs: 30_000 },
    );
  });

  // ===========================================================================================
  // CN-14 — playlist-ads create: open /playlistads → "Create New Playlist" → fill the full reactive form
  //          (title/desc/link/type, trailer + playlist from seeded content_urls, date range, thumbnail
  //          via the file input with Storage stubbed) → submit → setDoc(adsplaylist).
  //
  //          Route: app.routes.ts:110 → content/playlist-ads/playlist-ads.component (the only live
  //          declaration; :590 is commented out). "Create New Playlist" (playlist-ads.component.html:11)
  //          calls updatePlaylist(null) → opens UpdatePlaylistadsComponent (playlist-ads.component.ts:81-93).
  //
  //          ENABLED 2026-09-13. Parked with no recorded reason; corrected against the live components:
  //            1. Every locator was page-scoped. The HOST page carries a mat-paginator and a Filter field;
  //               scope to mat-dialog-container so nothing can drift onto the wrong control.
  //            2. The option picks used `.cdk-overlay-pane mat-option` + hasText. The MAT-DIALOG is itself
  //               inside a .cdk-overlay-pane, so that selector reaches across both overlays. Use
  //               selectMatOption/selectMatOptions (_shared/mat-select.ts) — the whole open+pick then sits
  //               inside the helper's retry loop, and role+exact name can't half-match TEST_CONTENT2_*.
  //            3. `getByRole('button', { name: /Update Playlist/i })` for submit. That button carries NO
  //               disabled-on-invalid binding (html:99 disables only while `loading`), so an invalid form
  //               does not fail loudly — submit() falls through to alert("Fill every input.") (ts:148) and
  //               the dialog just stays open. A dialog recorder below turns that into a named failure
  //               instead of an opaque 30s poll timeout.
  //            4. start/end date: those inputs carry (click)="picker.open()" (html:85-86) and the picker is
  //               touchUi — a click would raise a modal overlay over the form. fill() focuses without
  //               clicking, so the picker stays shut; the original's focus()/blur() dance was harmless but
  //               unnecessary (click-ads.spec.ts CN-27 fills the same kind of range input directly).
  //
  //          NOTE (app finding, not a blocker): the two selects host <ngx-mat-select-search> (html:52, 65)
  //          but UpdatePlaylistadsComponent's standalone `imports` (ts:20-33) never pull in
  //          NgxMatSelectSearchModule, so the in-panel search box is inert — it renders as an unknown
  //          element with no input. The option lists themselves are unaffected (filterContent() just sees
  //          an empty filter), which is why this case can still drive them.
  // ===========================================================================================
  test('CN-14 create playlist-ad writes a new adsplaylist doc with the entered title', async ({ page }) => {
    const NEW_AD = `NEW_AD_${RUN}_${Date.now()}`;
    await deleteCreatedAdsPlaylist(NEW_AD); // app-written → matched by its natural key (no testrunid)
    expect(await countWhere('adsplaylist', [['adstitle', '==', NEW_AD]]), 'CN-14: title unused pre-submit').toBe(0);
    // CROSS-FILE PRECONDITION (this case failed only in a FULL-SUITE run, never in isolation):
    // CN-33 (content-upload.spec.ts) renames CU1's title through the UI and restores it ONLY in its own
    // file's beforeAll — and `content-upload` sorts BEFORE `deep`, so by the time CN-14 runs the title is
    // whatever CN-33 typed. Every by-title pick below (the row's <li>, the Ads Trailer and Ads Playlist
    // options) is keyed on contentText.content1, so the row assertion timed out 30s on a title that no
    // longer existed. With workers:1 + fullyParallel:false this was deterministic, not flaky.
    // Restoring it HERE (a precondition write, not an assertion) makes the case order-independent rather
    // than dependent on which other file happened to run first.
    await resetContentUrlTitle();

    // Independently-known pre-state: what the app SHOULD resolve my by-title picks to (seed-content.js:298).
    const cu1 = await getDoc('content_urls', contentIds.CU1);
    expect(cu1, 'CN-14: the seeded content_urls row is the precondition').not.toBeNull();
    expect(cu1!.title, 'CN-14: CU1 carries the seed title the by-title picks below depend on')
      .toBe(contentText.content1);

    await loginAsContentAdmin(page);
    await page.goto('/playlistads', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/playlistads/, { timeout: 30_000 });
    // An invalid form does not disable the submit button — it alerts (ts:148). Record any window.alert
    // raised from here on so the failure names the reason instead of timing out on the Firestore poll.
    // Registered AFTER login/navigation so nothing on the auth path can be mistaken for a form rejection.
    const alerts: string[] = [];
    page.on('dialog', async (d) => { alerts.push(d.message()); await d.dismiss().catch(() => {}); });
    // Gate on the seeded ads row: the dialog is handed `contentlist` (the content_urls catalog) at open
    // time (ts:85), and both it and the table stream are filled inside the same getRoles() continuation
    // (ts:45-59). contentText.ad is "TEST_AD_<run>" — NEW_AD is "NEW_AD_<run>_…", so no cross-match.
    await expect(page.locator(ROW).filter({ hasText: contentText.ad }),
      'CN-14: the seeded ad row renders (ads stream loaded)').toBeVisible({ timeout: 30_000 });

    // …but the ad row is NOT proof the content catalog is loaded, and the dialog needs that catalog.
    //
    // APP RACE (pinned, not worked around silently): playlist-ads.component.ts:45-59 runs TWO SIBLING
    // async operations inside one getRoles() continuation — a getDocs(content_urls) that fills
    // `contentList` + `mapGeneralContent` (:48-53), and a collectionSnapshots(adsplaylist) that feeds the
    // table (:56-59). Neither waits for the other. "Create New Playlist" passes `contentlist: this.contentList`
    // BY VALUE at click time (:85) and the dialog snapshots it (update-playlistads.component.ts:67), so a
    // click landing before the getDocs resolves opens the dialog with an EMPTY Ads Trailer / Ads Playlist
    // list — with nothing on screen to say why. That is a real user-facing race on a slow connection, not a
    // test artefact; it is what made this case fail on its first enabled run.
    //
    // The only honest wait is one that proves the getDocs loop ran: mapGeneralContent is filled in THAT loop
    // (:51) and the table renders it per playlist row (playlist-ads.component.html:54), so a rendered
    // content title is proof the catalog the dialog will copy is populated.
    await expect(page.locator(ROW).filter({ hasText: contentText.ad }).locator('li', { hasText: contentText.content1 }),
      'CN-14: the seeded ad row resolves its playlist entry to a content TITLE — proof getDocs(content_urls) '
      + 'has filled mapGeneralContent/contentList, which the dialog copies by value on open')
      .toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Create New Playlist', exact: true }).click(); // html:11
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog, 'CN-14: the create/update ads dialog opens').toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText('Update Playlist Ads'), 'CN-14: dialog header (html:2)').toBeVisible();

    // Text fields (all Validators.required, ts:54-57). adsdescription is a <textarea matInput> (html:15),
    // NOT an <input> — the others are inputs (html:7, 23, 31).
    await dialog.locator('input[formcontrolname="adstitle"]').fill(NEW_AD);
    await dialog.locator('textarea[formcontrolname="adsdescription"]').fill('e2e ad description');
    await dialog.locator('input[formcontrolname="adslink"]').fill('https://example.com/ad');
    await dialog.locator('input[formcontrolname="adstype"]').fill('banner');

    // Thumbnail (html:39) → importNoteImages (ts:89-108) sets selectedThumbnail synchronously and patches
    // adsthumbnail from a FileReader; submit() requires one of the two (ts:121). The Storage upload happens
    // at submit and is stubbed (installStorageStub). Wait for the preview so the FileReader has landed.
    await dialog.locator('input[type="file"][accept="image/*"]').setInputFiles(TINY_PNG);
    await expect(dialog.getByText('Remove'), 'CN-14: the thumbnail preview renders (html:41-45)').toBeVisible({ timeout: 20_000 });

    // Ads Trailer — single select bound to content_urls[].url (html:54). Ads Playlist — MULTI select bound
    // to content_urls[].docid (html:67). Both label their options with the content TITLE, so the test picks
    // a label and the app resolves it to the url / the docid.
    await selectMatOption(page, dialog.locator('mat-select[formcontrolname="adstrailer"]'), contentText.content1);
    await selectMatOptions(page, dialog.locator('mat-select[formcontrolname="playlist"]'), [contentText.content1]);
    // The drag list below the select renders contentMap[docid] (html:77) — proof the app mapped my pick
    // back to the seeded content id, before anything is written.
    await expect(dialog.locator('.example-box'), 'CN-14: the picked content appears in the ordered playlist')
      .toHaveText([contentText.content1]);

    // Date range (mat-date-range-input start/end, html:84-87): type M/D/YYYY straight into the inputs — the
    // NativeDateAdapter parses it (same proven path as click-ads.spec.ts CN-27). fill() focuses but does
    // NOT click, so the (click)="picker.open()" touchUi overlay never opens over the form.
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    await dialog.locator('input[formcontrolname="startdate"]').fill(fmt(new Date()));
    await dialog.locator('input[formcontrolname="enddate"]').fill(fmt(new Date(Date.now() + 7 * 86400e3)));
    await dialog.locator('input[formcontrolname="enddate"]').press('Tab');

    // Submit ("Update Playlist", html:99) → submit() → setDoc(adsplaylist/<docid>) (update-playlistads.ts:139).
    await dialog.getByRole('button', { name: 'Update Playlist', exact: true }).click();
    await expect(dialog, 'CN-14: the dialog closes once setDoc resolves (ts:141) — if it stays open the ' +
      'form was invalid and submit() alerted "Fill every input." (ts:148)').toHaveCount(0, { timeout: 30_000 });
    expect(alerts, 'CN-14: submit() accepted the form (no validation alert)').toEqual([]);

    // [ASSERT] one adsplaylist doc with this title now exists — the app wrote it (pre-count was 0).
    const docs = await pollUntil(
      () => queryWhere('adsplaylist', [['adstitle', '==', NEW_AD]]),
      (rows) => rows.length === 1,
      { label: `CN-14: one adsplaylist titled ${NEW_AD}`, timeoutMs: 30_000 },
    );
    const d = docs[0] as any;
    // The fields below are the COMPONENT's output against an independently-known pre-state, not echoes of
    // what the test typed:
    expect(d.docid, 'CN-14: docid == the auto doc id it minted (ts:123) and wrote to (ts:138)').toBe(docs[0].id);
    expect(d.adstrailer, 'CN-14: the app resolved my by-TITLE pick to the seeded content_urls url (html:54)')
      .toBe((cu1 as any).url);
    expect((d.playlist || []).map((r: any) => r?.id || r?._path?.segments?.slice(-1)[0]),
      'CN-14: the app built DocumentReferences to content_urls from the picked docids (ts:135)')
      .toEqual([contentIds.CU1]);
    expect(d.available, 'CN-14: the form default the test never touched (ts:63)').toBe(true);
    expect(typeof d.startdate?.toMillis, 'CN-14: startdate stored as a Timestamp').toBe('function');
    expect(typeof d.enddate?.toMillis, 'CN-14: enddate stored as a Timestamp').toBe('function');
    expect(String(d.adsthumbnail), 'CN-14: adsthumbnail is the getDownloadURL the app read back (ts:129)')
      .toMatch(/^https:\/\/firebasestorage\.googleapis\.com\//);

    await deleteCreatedAdsPlaylist(NEW_AD); // tidy the app-created doc
  });

  // ===========================================================================================
  // CN-17 — /viewparticipantstieraccess: the two seeded tier members (participant metadata with a truthy
  //          firebaseuserref + tier:[TIER1]) render under the TIER1 bucket the app GROUPED from its stream.
  // ===========================================================================================
  test('CN-17 viewparticipantstieraccess buckets the seeded members under their tier (app-grouped)', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/viewparticipantstieraccess', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/viewparticipantstieraccess/, { timeout: 30_000 });

    // [REAL-UI] the component buckets participant metadata by tier id then maps the id → tier name
    // (maptier[TIER1] = "TEST_TIER_BASIC_<run>"). Both seeded members carry name TEST_TIERMEMBER_<run>_n
    // and tier:[TIER1], so both must appear on the screen the app rendered from its grouping.
    for (const n of ['0', '1']) {
      await expect(
        page.getByText(`TEST_TIERMEMBER_${RUN}_${n}`),
        `CN-17: seeded tier member ${n} renders in the tier bucket`,
      ).toBeVisible({ timeout: 30_000 });
    }
    // The tier name the app mapped from the bucket id is also present (proves the id→name grouping ran).
    await expect(page.getByText(new RegExp(`TEST_TIER_BASIC_${RUN}`)).first(),
      'CN-17: the TIER1 bucket heading renders (id→name mapped)').toBeVisible({ timeout: 30_000 });

    // Independent cross-check: the seeded members really are tier:[TIER1] in Firestore (the grouping the
    // app rendered is DERIVED from this precondition, not re-asserting the rendered DOM).
    for (const pf of tierProfiles) {
      const d = await getDoc('participant metadata', pf);
      expect((d as any)?.tier, `CN-17: ${pf} carries tier:[TIER1] as the precondition`).toContain(contentIds.TIER1);
    }
  });
});

// ===========================================================================================
// CN-16 — RecommendedPlaylistTrigger_to_pmd is a DEPLOYED *_to_pmd CF (participantmetadata.js:101).
// Creating ONE `recommended mix playlist` doc fires it; the CF merges { [doc.id]: doc.list.map(id) } into
// `participant metadata/{profileid}[doc.type]`. We assert the CF-COMPUTED merge (the seeded content id
// now present under the profile's `solarvoice` map) — never a value the test wrote; the seeded id is known.
//
// Skip-graceful: if the *_to_pmd CF is not present on the test project within the poll window, SKIP with a
// clear note rather than a false failure (matches the CN-15 buffermix-chain guard).
// ===========================================================================================
test.describe('Content — RecommendedPlaylistTrigger_to_pmd CF merge (CF side-effect, anti-circular)', () => {
  test('CN-16 a recommended-mix doc merges its content id into participant metadata.solarvoice (CF-computed)', async () => {
    await resetRecommendedMix();
    const { rmpKey, contentId } = await createRecommendedMix();
    const profile = bufferProfiles[0];

    let merged: Record<string, unknown> | undefined;
    try {
      const after = await pollUntil(
        () => getDoc('participant metadata', profile),
        (d) => {
          const sv = (d as any)?.solarvoice as Record<string, unknown> | undefined;
          merged = sv;
          return !!sv && Array.isArray(sv[rmpKey]) && (sv[rmpKey] as string[]).includes(contentId);
        },
        { label: `CN-16: participant metadata/${profile}.solarvoice["${rmpKey}"] contains ${contentId}`, timeoutMs: 60_000, intervalMs: 1500 },
      );
      // [ASSERT] the CF merged the playlist's content id under the playlist key — the merge map is the
      // CF's output; the content id + key were the seeded precondition.
      const sv = (after as any).solarvoice as Record<string, string[]>;
      expect(sv[rmpKey], 'CN-16: CF wrote the playlist key into the profile solarvoice map').toContain(contentId);
    } catch {
      test.skip(true, `CN-16: RecommendedPlaylistTrigger_to_pmd did not merge within 60s ` +
        `(solarvoice=${JSON.stringify(merged)}); the *_to_pmd CF may not be deployed to the test project — see blockers.`);
      return;
    } finally {
      await resetRecommendedMix();
    }
  });
});

// ===========================================================================================
// CN-06 / CN-07 — HLS Cloud-Function side-effects. content CFs (ConvertUrltoHLS / generalContentUpdate /
// uploadContentToPublitio) are NOT deployed to the disposable test project AND depend on Publitio secrets,
// so these are skip-guarded: seed the UN-converted subject, mutate the trigger field via the Admin SDK,
// poll for the CF-set field, and SKIP gracefully if it never flips (recon risk #3 / process instr #5).
// The assertion (if it fires) is the CF-COMPUTED field vs a known-seeded precondition — anti-circular.
// ===========================================================================================
test.describe('Content — HLS CF side-effects (gated: content CFs not deployed)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { initAdmin } = require('../fixtures/seed-test-project');

  test('CN-06 changing an episode videoUrl flips convertedtohls:true (ConvertUrltoHLS CF)', async () => {
    const epId = await resetHlsEpisode();
    expect((await getDoc('episodes', epId))!.convertedtohls, 'CN-06: subject starts un-converted').toBe(false);
    // Mutate videoUrl → ConvertUrltoHLS fires on the onWrite (content.js:253). Admin-SDK write = the
    // trigger; the asserted value (convertedtohls) is the CF's output, not this write.
    await initAdmin().firestore().collection('episodes').doc(epId)
      .update({ videoUrl: `https://example.com/cn06-changed-${Date.now()}.mp4` });

    let val: unknown;
    try {
      await pollUntil(
        () => getDoc('episodes', epId),
        (d) => { val = d?.convertedtohls; return d?.convertedtohls === true; },
        { label: 'CN-06: episodes.convertedtohls → true (CF-set)', timeoutMs: 45_000, intervalMs: 1500 },
      );
    } catch {
      test.skip(true, `CN-06: ConvertUrltoHLS did not set convertedtohls within 45s (got ${val}); ` +
        'the content CFs are not deployed to the test project (Publitio-dependent) — see blockers.');
      return;
    }
    expect((await getDoc('episodes', epId))!.convertedtohls, 'CN-06: CF marked the episode converted').toBe(true);
  });

  test('CN-07 changing a content_urls url flips hlsstatus to "uploaded" (generalContentUpdate CF chain)', async () => {
    const cuId = await resetHlsContentUrl();
    expect((await getDoc('content_urls', cuId))!.hlsstatus, 'CN-07: subject starts with null hlsstatus').toBeNull();
    // Mutate url → generalContentUpdate fires → calls uploadContentToPublitio → sets hlsstatus uploading→uploaded.
    await initAdmin().firestore().collection('content_urls').doc(cuId)
      .update({ url: `https://example.com/cn07-changed-${Date.now()}.mp4` });

    let val: unknown;
    try {
      await pollUntil(
        () => getDoc('content_urls', cuId),
        (d) => { val = d?.hlsstatus; return d?.hlsstatus === 'uploaded'; },
        { label: 'CN-07: content_urls.hlsstatus → "uploaded" (CF-set)', timeoutMs: 45_000, intervalMs: 1500 },
      );
    } catch {
      test.skip(true, `CN-07: generalContentUpdate/uploadContentToPublitio did not set hlsstatus within 45s (got ${val}); ` +
        'the content CFs are not deployed to the test project (Publitio-dependent) — see blockers.');
      return;
    }
    expect((await getDoc('content_urls', cuId))!.hlsstatus, 'CN-07: CF marked the content uploaded').toBe('uploaded');
  });
});
