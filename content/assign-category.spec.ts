// assign-category.spec.ts — /assigncategory (series-dashboard/categoryassign).
//
// Recon: e2e/recon-allcomp/content.md "Addendum — 2026-09-07" (CN-23 / CN-24 / CN-25).
//
// The screen combineLatest()s `category` and `series`, then for each category keeps ONLY the `sequence`
// entries that are DocumentReferences whose target series exists (categoryassign.component.ts:86-89).
// The seed gives CAT2 three entries — a ref to SER1 (resolves), a ref to a series that does not exist,
// and a plain string — so the rendered chip count is falsifiable: delete the filter and CAT2 shows 2 or 3
// chips (or throws on the string). That is the negative control CN-23 rests on.
//
// The route has NO canActivate (app.routes.ts:125). Reachability is covered by route-guards.spec.ts
// (CN-45/46); nothing here asserts who may open the screen.
import { test, expect } from '@playwright/test';
import { contentIds, contentText, deleteCreatedCategory, installContentStubs, loginAsContentAdmin } from './support/content';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere, pollUntil, queryWhere } from '../queue/support/firestore-admin';
import { ROW, openSelect, showAllRows } from './support/ui';

const RUN = process.env.CONT_RUNID || 'cont';
const refId = (r: any): string => r?.id || r?._path?.segments?.slice(-1)[0] || '';

test.describe('Content — /assigncategory (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installContentStubs(page);
    await loginAsContentAdmin(page);
    await page.goto('/assigncategory', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/assigncategory/, { timeout: 30_000 });
    await expect(page.locator('h1.dash-title', { hasText: 'Category Assignment' })).toBeVisible({ timeout: 30_000 });
  });
  test.afterEach(() => assertNoFatal(guard, 'assigncategory: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-23 — rows == category count; CAT2 shows exactly the ONE chip whose ref resolves
  // ===========================================================================================
  test('CN-23 rows == category count and only resolvable series refs render as chips', async ({ page }) => {
    await expect(page.locator(ROW).first()).toBeVisible({ timeout: 30_000 });
    await showAllRows(page);

    // [ASSERT] every category doc is a row — the screen applies no filter to the category stream.
    const expectedRows = await countWhere('category');
    await expect(page.locator(ROW), 'CN-23: one row per `category` doc (no client filter)').toHaveCount(expectedRows, { timeout: 30_000 });

    // [ASSERT] CAT2: sequence = [ref SER1, ref <missing series>, 'not-a-ref'] → exactly ONE chip, and it
    // is SER1's name. The other two entries are the negative controls for the filter at ts:86-89.
    const cat2 = page.locator(ROW).filter({ hasText: contentText.category2 });
    await expect(cat2, 'CN-23: the CAT2 row renders').toHaveCount(1);
    await expect(cat2.locator('span.chip'), 'CN-23: only the ref that resolves to an existing series becomes a chip')
      .toHaveCount(1);
    await expect(cat2.locator('span.chip').first()).toHaveText(new RegExp(contentText.seriesFree));

    // [ASSERT] CAT1 has no sequence at all → "No series assigned", zero chips (ts:83 `sequence || []`).
    const cat1 = page.locator(ROW).filter({ hasText: new RegExp(`${contentText.category}(?!2)`) });
    await expect(cat1, 'CN-23: the CAT1 row renders').toHaveCount(1);
    await expect(cat1.locator('span.chip'), 'CN-23: a category without `sequence` renders no chips').toHaveCount(0);
  });

  // ===========================================================================================
  // CN-24 — Create Category → setDoc(category/{auto}, {id, category, date: serverTimestamp(), sequence})
  // ===========================================================================================
  test('CN-24 Create Category writes a category doc with id == docId and the picked series as refs', async ({ page }) => {
    const NEW_NAME = `NEW_CAT_${RUN}_${Date.now()}`; // run-unique → re-runs never collide
    await deleteCreatedCategory(NEW_NAME);
    expect(await countWhere('category', [['category', '==', NEW_NAME]]), 'CN-24: name unused pre-submit').toBe(0);

    // [REAL-UI] open the create dialog (no row → create mode, categoryassign.component.ts:122-131).
    await page.locator('button.btn-primary', { hasText: 'Create Category' }).click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await dialog.locator('input.ib-input[placeholder="Type a new category name..."]').fill(NEW_NAME);

    // pick ONE seeded series in the multi-select; the app builds the DocumentReference from the option id
    await openSelect(page, dialog.locator('mat-select.cat-select'));
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: contentText.seriesFree }).first().click();
    await page.keyboard.press('Escape');
    await expect(dialog.locator('.drag-item'), 'CN-24: the picked series appears in the ordered list').toHaveCount(1);

    // No window.confirm on this path (assigncategorydialog.ts:167-196) — a plain click is correct.
    // The footer button is `<button class="btn-primary"><mat-icon>save</mat-icon> Save </button>`
    // (assigncategorydialog.component.html:72-77). Playwright's hasText matches TEXT CONTENT, and the
    // mat-icon ligature contributes the literal lowercase word "save" AHEAD of the label — so the text is
    // "save Save" and a `/^Save/` filter never matches. MatIcon marks itself aria-hidden, so the ACCESSIBLE
    // NAME is the clean "Save"; role+name is the locator that survives the icon.
    const save = dialog.getByRole('button', { name: 'Save', exact: true });
    await expect(save).toBeEnabled();
    await save.click();

    // [ASSERT] the doc the dialog wrote. id/date/sequence shape are the app's, the name is the only input.
    const docs = await pollUntil(
      () => queryWhere('category', [['category', '==', NEW_NAME]]),
      (rows) => rows.length === 1,
      { label: `CN-24: one category named ${NEW_NAME}`, timeoutMs: 30_000 },
    );
    const d = docs[0] as any;
    expect(d.id, 'CN-24: the app stamps id == doc id (assigncategorydialog.ts:183)').toBe(docs[0].id);
    expect(typeof d.date?.toMillis, 'CN-24: date is a Firestore Timestamp (serverTimestamp)').toBe('function');
    expect((d.sequence as any[]).map(refId), 'CN-24: sequence holds the picked series as a ref').toEqual([contentIds.SER1]);

    // and the live table now shows it with exactly that one chip
    await expect(page.locator(ROW).filter({ hasText: NEW_NAME }).locator('span.chip')).toHaveCount(1, { timeout: 30_000 });
    await deleteCreatedCategory(NEW_NAME); // tidy the app-created doc
  });

  // ===========================================================================================
  // CN-25 — duplicate-name guard is case/whitespace-insensitive (ts:122-131)
  // ===========================================================================================
  test('CN-25 typing an existing category name in another case disables Save', async ({ page }) => {
    await page.locator('button.btn-primary', { hasText: 'Create Category' }).click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 20_000 });

    // The duplicate check is the pool the PARENT hands in: categoryassign passes its live `allCategories`
    // as MAT_DIALOG_DATA (categoryassign.component.ts:122-131, built at ts:77-80), and the dialog snapshots it in the
    // constructor (assigncategorydialog.component.ts:68). So the seeded category is already in the pool
    // the moment the dialog opens — nothing async has to settle first.
    const name = dialog.locator('input.ib-input[placeholder="Type a new category name..."]');
    await expect(name).toBeVisible({ timeout: 10_000 });

    // FOCUS ORDER MATTERS. MatDialog's config defaults to autoFocus:'first-tabbable' +
    // delayFocusTrap:true, so the focus trap runs only when the ENTER ANIMATION finishes
    // (MatDialogContainer._openAnimationDone → _trapFocus) — i.e. AFTER the container is already
    // visible and typable. The first tabbable element in this dialog is the header close button
    // `<button class="a-btn" mat-dialog-close>` (assigncategorydialog.component.html:7). Typing
    // immediately therefore starts in the input and is then hijacked mid-string, and because the
    // padded name ENDS in a space, that trailing space arrives as a keypress on a focused BUTTON —
    // which activates mat-dialog-close and tears the whole dialog down. That is what used to fail
    // here: not a wrong hint string, not a missed keyup — the dialog was simply gone, with
    // newCategoryName holding only the two leading spaces (trim() === '' → duplicateError false).
    // Wait for the trap to land, THEN take the caret back and prove we own it.
    await expect(dialog.locator('button.a-btn[mat-dialog-close]').first(), 'CN-25: the focus trap has fired')
      .toBeFocused({ timeout: 10_000 });
    await name.click();
    await expect(name, 'CN-25: the caret is in the name field, not on the close button').toBeFocused();

    // the seeded name, upper-cased and padded — only the app's normalisation can recognise it.
    // MUST be TYPED, not filled: the duplicate check is wired to (keyup) on this input
    // (assigncategorydialog.component.html:22 → onCategoryNameType(), ts:122-131). locator.fill() sets the
    // value and dispatches `input` only — ngModel picks the value up, but keyup never fires, so
    // duplicateError stays false and the hint never renders. pressSequentially emits a real key per char.
    const typed = `  ${contentText.category.toUpperCase()}  `;
    await name.pressSequentially(typed, { delay: 10 });
    // [PRECONDITION] not an outcome — it separates "the keystrokes never landed" from "the app's
    // normalisation failed", so a future regression names itself instead of pointing at the hint.
    await expect(name, 'CN-25: every keystroke landed in the field').toHaveValue(typed);

    // [ASSERT] the app rendered its own duplicate hint: allCategories carries the seeded CAT1 doc
    // (category === contentText.category), and ts:123-130 trim()+toLowerCase()es BOTH sides, so the
    // padded upper-case spelling still resolves to the same key → duplicateError true → html:24 renders.
    await expect(dialog.getByText('This category already exists'), 'CN-25: the duplicate hint shows').toBeVisible({ timeout: 10_000 });
    // role+name, not hasText: the footer button's text content is "save Save" (mat-icon ligature first).
    await expect(dialog.getByRole('button', { name: 'Save', exact: true }), 'CN-25: Save is disabled on a duplicate').toBeDisabled();
    await dialog.locator('button.btn-cancel', { hasText: 'Cancel' }).click();
  });
});
