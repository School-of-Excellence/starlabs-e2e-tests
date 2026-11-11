// form-template-workshop.spec.ts — /formtemplateworkshop (New-Workshop/form-assignment).
//
// Recon: e2e/recon-allcomp/workshops.md "Addendum — 2026-09-04" (WS-26 / WS-27), Risk #11.
//
// TWO THINGS TO KNOW BEFORE CHANGING THIS FILE
//
// 1. The screen is ENTIRELY query-param driven. A bare /formtemplateworkshop renders nothing —
//    `showcontent` stays false and ngAfterViewInit:260 in fact THROWS, because it dereferences
//    `this.participantformtemplateid.formid` when no `?id=` is supplied. The only path that stays in
//    the DEFAULT database is `?id=<delivery forms docid>` with no `patchdata` (ts:260-290); that is
//    what WS-26 drives. This also means a "does the route mount" smoke here would be actively
//    misleading — the route does not mount without a param.
//
// 2. The draft/submit paths go through `getFirestore('firestore-forms')` (ts:102-103), a NAMED
//    database. Since 2026-10-17 the emulator build connects it (src/main.ts), so WS-27 runs on the
//    emulator: the draft lands in the firestore-forms EMULATOR db. (The old skip — "the emulator cannot
//    serve a named DB, client access is denied" — was a misdiagnosis: the app simply never connected it.)
import { test, expect } from '@playwright/test';
import { wsAddIds, wsAddNames, installWshopStubs, loginAsWshopAdmin, formDraftsFor, deleteFormDraftsFor } from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe('Workshops — form template workshop (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'formtemplateworkshop: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // WS-26 — the default-DB path: ?id=<delivery forms docid> renders that form's content
  // ===========================================================================================
  test('WS-26 /formtemplateworkshop?id= renders the delivery form read from the default DB', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto(`/formtemplateworkshop?id=${wsAddIds.DF_A}`, { waitUntil: 'domcontentloaded' });

    // [REAL-UI] showcontent only flips true after the `delivery forms` getDoc resolves AND the component
    // has walked formarray registering a FormControl per entry (ts:270-290). Seeing the header at all
    // therefore proves the whole default-DB read+parse path ran.
    await expect(
      page.locator('.form-container'),
      'WS-26: the form container renders only once the delivery-forms read resolved',
    ).toBeVisible({ timeout: 45_000 });

    // [ASSERT] the app rendered the KNOWN seeded form name — app output vs known seed input.
    await expect(
      page.locator('.form-header h1'),
      'WS-26: the app must render the formname from the doc it read',
    ).toHaveText(wsAddNames.deliveryForm, { timeout: 20_000 });

    // ...and a field the app built from the seeded formarray, proving it parsed the array, not just the
    // scalar header fields.
    await expect(
      page.locator('.form-content'),
      'WS-26: the seeded formarray entry must render as a field card',
    ).toContainText(`WS Form Section ${process.env.WSHOP_RUNID || 'wshop'}`, { timeout: 20_000 });
  });

  // ===========================================================================================
  // WS-27 — draft save writes a temporary_forms doc in the firestore-forms NAMED DB
  // ===========================================================================================
  test('WS-27 typing an answer autosaves a draft to the firestore-forms named database', async ({ page }) => {
    // The template autosaves on every keyup — autoSave() setDoc's firestore-forms/temporary_forms/<draftDocid>
    // with each field's value (form-assignment.component.ts:804-837). No Save button exists.
    await deleteFormDraftsFor(wsAddIds.DF_A);   // precondition: no draft for this form yet
    try {
      await loginAsWshopAdmin(page);
      await page.goto(`/formtemplateworkshop?id=${wsAddIds.DF_A}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.form-container')).toBeVisible({ timeout: 45_000 });

      const question = `WS Form Question ${process.env.WSHOP_RUNID || 'wshop'}`;
      const answer = `WS27 draft ${Date.now()}`;
      // pressSequentially, not fill(): the save is bound to (keyup), which fill() never fires
      await page.getByPlaceholder(`Enter ${question}`).pressSequentially(answer);

      // [ASSERT] the app wrote the draft — read back from the firestore-forms EMULATOR db, not the page.
      await expect.poll(async () => {
        const drafts = await formDraftsFor(wsAddIds.DF_A);
        return drafts.flatMap((d) => d.formarray || []).find((f: any) => f.fieldname === question)?.value ?? null;
      }, { message: 'WS-27: the draft in firestore-forms/temporary_forms holds the typed answer', timeout: 30_000 }).toBe(answer);
      const [draft] = await formDraftsFor(wsAddIds.DF_A);
      expect(draft.formname, 'WS-27: the draft is a copy of the seeded delivery form').toBe(wsAddNames.deliveryForm);
    } finally {
      await deleteFormDraftsFor(wsAddIds.DF_A);   // the app writes drafts untagged — clean up here
    }
  });
});
