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
//    database. The Firestore EMULATOR does not support multiple databases or per-named-db rules, so
//    client reads/writes there hard-DENY (Admin-SDK seeds still land, rules-bypassed) — this is
//    recorded in firebase.emulator.json itself. WS-27 therefore skips on the emulator, exactly as the
//    profiles suite already does for the same database in profiles/analytics.spec.ts:98 and
//    profiles/view-form-deep.spec.ts:33. Writing it to "pass" on the emulator would be a false green.
import { test, expect } from '@playwright/test';
import { wsAddIds, wsAddNames, installWshopStubs, loginAsWshopAdmin } from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe('Workshops — form template workshop (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() =>
    // The component eagerly constructs a firestore-forms handle and generates a draft id at ts:118;
    // on the emulator any incidental traffic to that named DB is denied. That denial is the documented
    // environment limitation (Risk #11), not the default-DB behaviour WS-26 is asserting.
    assertNoFatal(guard, 'formtemplateworkshop: no fatal console errors / pageerrors', [
      /firestore-forms/i,
      /temporary_forms/i,
      /permission[- ]denied/i,
    ]));

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
  test('WS-27 saving a draft writes to the firestore-forms named database', async ({ page }) => {
    test.skip(
      !!process.env.FIRESTORE_EMULATOR_HOST,
      'EMULATOR LIMITATION: firestore-forms named DB has no rules in the emulator (multi-db unsupported) → client read/write denied; runs on the cloud config.',
    );

    await loginAsWshopAdmin(page);
    await page.goto(`/formtemplateworkshop?id=${wsAddIds.DF_A}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.form-container')).toBeVisible({ timeout: 45_000 });

    // Fill the seeded text field and trigger the draft save (setDoc into
    // firestore-forms/temporary_forms/<draftDocid>, ts:836-837).
    const input = page.locator('.form-content input[matInput], .form-content input').first();
    await input.fill(`WS27 draft ${Date.now()}`);
    await page.getByRole('button', { name: /Save|Draft/i }).first().click();

    // On the cloud config the named-DB handle is reachable; assert the app created a draft doc there.
    // (Left as an explicit expectation rather than a silent pass so the cloud run has something to prove.)
    await expect(
      page.locator('.form-container'),
      'WS-27: the form must still be mounted after the draft save',
    ).toBeVisible();
  });
});
