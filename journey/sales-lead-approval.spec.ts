// sales-lead-approval.spec.ts — /salesleads APPROVAL path (REAL-UI, anti-circular).
//
// Recon: e2e/recon-allcomp/journey-products.md. Cases JP-27..JP-32.
//
// WHY THIS IS THE MOST IMPORTANT GAP IN JOURNEY: this is the money path — a sales lead becoming an
// approved purchase. JP-10 already covers REJECT; approve was untested end to end, and it is the branch
// that triggers updateDeliverySequence, writes the balances, and fires the SalesCRM hand-off.
//
// THE SEEDED PRECONDITION, and why it exists (operator decision, option A, 2026-09-10):
//   submitValidation() (create-watson-profile.component.ts:1170) keeps Submit DISABLED unless
//   `initialpaymentapproved === true`. That flag is set only by saleslead.component.ts initialPayment(),
//   which gates on a HARDCODED UID ALLOWLIST keyed by Firebase project — six uids for fir-sample-aae4a,
//   two for starlabs-test. The emulator project (starlabs-cicd) matches NEITHER, so `users` is empty and
//   every actor gets alert("Your Roll is not eligible..."). SL2 is therefore seeded with the flag already
//   true. These cases consciously do NOT cover the payment-approval gate itself; that needs the allowlist
//   moved into roles data, which is an app change and a separate decision.
//
// ANTI-CIRCULARITY: the seed is the PRECONDITION (status null, flag true). Every assertion below is a
// value the APP wrote on a real click — status 'Approved', statusupdateddate, the balance normalisation —
// checked against the known pre-state, never against something the test itself wrote.
//
// EXTERNAL BOUNDARY: approving fires breakthroughapprovedleads on a live Cloud Functions URL. The prod
// firewall in installJourneyStubs blocks it, as it must. So these assert the FIRESTORE write, which is the
// part this app owns; the HTTP hand-off is out of scope for the gate.
import { test, expect } from '@playwright/test';
import {
  attachJourneyGuard,
  installJourneyStubs,
  journeyIds,
  journeyNames,
  loginAsJourneyAdmin,
  resetSalesLeadForApproval,
} from './support/journey';
import { assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc } from '../queue/support/firestore-admin';

let guard: ConsoleGuard;

/** Narrow the salesleads table to the approval lead and hand back its row. */
const approvalRow = (page: any) =>
  page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: journeyNames.salesLeadApprove });

/**
 * The Watson review dialog, disambiguated.
 *
 * getByRole('dialog') alone is a strict-mode violation here: reviewLead() opens LoadingProgressComponent
 * as well, so up to three dialog roles can be on screen at once. Filter to the one carrying Submit.
 */
const watsonDialog = (page: any) =>
  page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /^Submit$/i }) });

/** Poll for the app's write; the dialog closes and the updateDoc lands asynchronously. */
const awaitStatus = async (want: string, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const d = await getDoc('salesleads', journeyIds.SL2);
    if (d?.status === want) return d;
    if (Date.now() >= deadline) return d;
    await new Promise((r) => setTimeout(r, 800));
  }
};

test.describe('Journey — sales lead APPROVAL (real UI, anti-circular)', () => {
  test.beforeEach(async ({ page }) => {
    // attachJourneyGuard, NOT the generic queue guard: this suite runs without the 'watson'/'salescrm'
    // Firebase apps, so those init errors are BY DESIGN here and are on the journey ignore list.
    guard = attachJourneyGuard(page);
    await installJourneyStubs(page);
    await resetSalesLeadForApproval(journeyIds.SL2);
  });
  test.afterEach(async () => {
    await resetSalesLeadForApproval(journeyIds.SL2);   // leave the row re-runnable
    assertNoFatal(guard, 'sales-lead-approval: no fatal console errors / pageerrors');
  });

  // ===========================================================================================
  // JP-31 — the Review button's own enablement is a read-only assertion
  // ===========================================================================================
  // validateApprove() (saleslead.component.ts:1838) disables Review unless purchasedate,
  // totalpurchasevalue, initialpayment AND installmentamount are all present. SL2 is seeded with all
  // four, so the button must be live. This runs first because every case below depends on it.
  test('JP-31 the seeded approval lead offers an enabled Review button', async ({ page }) => {
    await loginAsJourneyAdmin(page);
    await page.goto('/salesleads', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/salesleads/, { timeout: 30_000 });

    await page.getByRole('textbox', { name: /Search/i }).fill(journeyNames.salesLeadApprove);
    const row = approvalRow(page);
    await expect(row, 'JP-31: the seeded approval lead must render').toBeVisible({ timeout: 30_000 });

    const review = row.getByRole('button', { name: /^Review$/i });
    await expect(review, 'JP-31: Review must render for a pending lead').toBeVisible();
    await expect(
      review,
      'JP-31: Review must be ENABLED — validateApprove() requires purchasedate, totalpurchasevalue, ' +
      'initialpayment and installmentamount, all of which seed-journey.js writes on SL2',
    ).toBeEnabled();
  });

  // ###########################################################################################
  // JP-27 / JP-30 / JP-32 ARE BLOCKED BY THE TEST ENVIRONMENT — root-caused 2026-09-10.
  // ###########################################################################################
  // These three all begin by clicking Review, which opens CreateWatsonProfileComponent. Its CONSTRUCTOR
  // (create-watson-profile.component.ts:149-153) does:
  //
  //     this.guard.initializeWatson().then(async () => {
  //       const loadingRef = this.dialog.open(LoadingProgressComponent, { data: { msg: "loading..." } });
  //       this.watsonDatabase = getFirestore(getApp("watson"));      // <-- THROWS HERE
  //       ...                                                        // loadingRef.close() never reached
  //     });
  //
  // environment.emulator.ts sets `watson: null` DELIBERATELY (line 36, with its own comment), so
  // AuthguardService.initializeWatson() (authguard.service.ts:1163) skips initializeApp entirely and
  // getApp("watson") throws inside the .then(). The spinner opened one line earlier is never closed and
  // the rest of the constructor — the async work that populates the dialog body — never runs.
  //
  // The observable result is a permanent "loading..." spinner and NO Watson dialog. Confirmed against the
  // failure screenshot: the salesleads table renders correctly behind a stuck LoadingProgressComponent.
  //
  // THIS IS NOT FLAKE, CONTENTION, OR TEST ORDER. Three earlier theories (emulator contention, repeated
  // logins in one file, order dependence) were each tested and each disproved; JP-27 fails identically
  // when run entirely alone against a quiet machine and a warm emulator.
  //
  // IT ALSO CONTRADICTS THIS SUITE'S OWN STANDING ASSUMPTION. journey/support/journey.ts says the
  // Watson/SalesCRM init failures "only fail the init silently inside a .then() ... never a functional
  // break". That is true of every screen JP-01..JP-26 exercises. It is FALSE on the approval path, which
  // is the one place Watson is load-bearing rather than cosmetic. attachJourneyGuard therefore SWALLOWS
  // the very error that breaks these cases — worth knowing before adding any further Watson-path case.
  //
  // WHAT WOULD UNBLOCK THEM (an app/environment decision, not a spec change):
  //   - give environment.emulator.ts a real `watson` config AND connect that second app to the emulator,
  //     so getFirestore(getApp("watson")) resolves to emulator storage rather than a cloud project; or
  //   - make the constructor tolerate a missing 'watson' app (guard the getApp, close the spinner in a
  //     catch) so the dialog still opens with the Watson-sourced fields absent.
  // The first is the honest one for coverage; the second is arguably a real robustness bug in its own
  // right, since today ANY Watson init failure in production leaves the user staring at a dead spinner.
  //
  // JP-31 below is UNAFFECTED and stays live: it asserts Review's enablement without opening the dialog.
  // ###########################################################################################

  // ===========================================================================================
  // JP-27 — Review → Watson dialog opens on a lead whose payment is approved
  // ===========================================================================================
  test.fixme('JP-27 Review opens the Watson review dialog with a Submit control', async ({ page }) => {
    await loginAsJourneyAdmin(page);
    await page.goto('/salesleads', { waitUntil: 'domcontentloaded' });
    await page.getByRole('textbox', { name: /Search/i }).fill(journeyNames.salesLeadApprove);
    await approvalRow(page).getByRole('button', { name: /^Review$/i }).click();

    const dialog = watsonDialog(page);
    await expect(dialog, 'JP-27: the Watson review dialog must open').toBeVisible({ timeout: 30_000 });

    // The dialog is CreateWatsonProfileComponent; Submit is the control the whole approval hinges on.
    await expect(
      dialog.getByRole('button', { name: /^Submit$/i }),
      'JP-27: the review dialog must offer Submit',
    ).toBeVisible({ timeout: 20_000 });

    // Nothing is written by merely opening the dialog — the lead is still pending.
    const stillPending = await getDoc('salesleads', journeyIds.SL2);
    expect(stillPending?.status, 'JP-27: opening the dialog must write nothing').toBeNull();
  });

  // ===========================================================================================
  // JP-30 — cancelling writes NOTHING (the negative case that gives JP-32 its meaning)
  // ===========================================================================================
  // reviewLead() only acts `if (result != null)`. Without this case, a JP-32 that passed because the app
  // writes 'Approved' on ANY dialog close would look identical to one that passed correctly.
  test.fixme('JP-30 cancelling the review dialog leaves the lead untouched', async ({ page }) => {
    await loginAsJourneyAdmin(page);
    await page.goto('/salesleads', { waitUntil: 'domcontentloaded' });
    await page.getByRole('textbox', { name: /Search/i }).fill(journeyNames.salesLeadApprove);
    await approvalRow(page).getByRole('button', { name: /^Review$/i }).click();

    const dialog = watsonDialog(page);
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole('button', { name: /^Cancel$/i }).first().click();
    await expect(dialog, 'JP-30: the dialog must close on Cancel').toBeHidden({ timeout: 20_000 });

    // Give any stray write a chance to land before asserting its absence.
    await page.waitForTimeout(2_000);
    const after = await getDoc('salesleads', journeyIds.SL2);
    expect(after?.status, 'JP-30: Cancel must not approve the lead').toBeNull();
    expect(after?.statusupdateddate, 'JP-30: Cancel must not stamp an update time').toBeFalsy();
  });

  // ===========================================================================================
  // JP-32 — Submit approves: the write the APP makes
  // ===========================================================================================
  // The core case. Asserts the three things reviewLead()'s updateDoc owns:
  //   status -> 'Approved'  (the pre-state was null, so this value is unambiguously the app's)
  //   statusupdateddate     -> stamped
  //   the balance fields    -> NORMALISED: '' / undefined become null, never the empty string
  // The last one is a real rule, not incidental: `[null, undefined, ''].includes(x) ? null : x`.
  test.fixme('JP-32 Submit writes status Approved, a status date, and normalised balances', async ({ page }) => {
    const before = await getDoc('salesleads', journeyIds.SL2);
    expect(before?.status, 'JP-32: the lead must start pending').toBeNull();
    expect(before?.initialpaymentapproved, 'JP-32: the seeded precondition must hold').toBe(true);

    await loginAsJourneyAdmin(page);
    await page.goto('/salesleads', { waitUntil: 'domcontentloaded' });
    await page.getByRole('textbox', { name: /Search/i }).fill(journeyNames.salesLeadApprove);
    await approvalRow(page).getByRole('button', { name: /^Review$/i }).click();

    const dialog = watsonDialog(page);
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    const submit = dialog.getByRole('button', { name: /^Submit$/i });
    await expect(
      submit,
      'JP-32: Submit must be enabled — submitValidation() requires initialpaymentapproved:true (seeded) ' +
      'and no commoncheckpoint in an error state. If this fails, read the checkpoint list in the dialog: ' +
      'a Watson/SalesCRM checkpoint erroring under the emulator is an app-boundary finding, not a flake.',
    ).toBeEnabled({ timeout: 20_000 });
    await submit.click();

    const after = await awaitStatus('Approved');
    expect(after?.status, 'JP-32: the approval must write status Approved').toBe('Approved');
    expect(after?.statusupdateddate, 'JP-32: the approval must stamp statusupdateddate').toBeTruthy();

    // Both balance fields were left blank in the dialog, so the app must store null — not '' — because
    // downstream readers test for null. This is the normalisation rule, asserted on the app's own write.
    expect(after?.initialpaymentbalance, 'JP-32: a blank initial balance must normalise to null').toBeNull();
    expect(after?.pendingbalanceamount, 'JP-32: a blank pending balance must normalise to null').toBeNull();
  });

  // ===========================================================================================
  // JP-28 / JP-29 — PARKED, with the reason stated
  // ===========================================================================================
  // JP-28 (the updateDeliverySequence fan-out on a purchase carrying ppData) and JP-29 (the `cancelled`
  // journeytype branch, which writes a different payload built from canceldocid) both need a DIFFERENT
  // seeded lead shape than SL2: JP-28 needs a participant purchase with delivery-sequence rows attached,
  // JP-29 needs a lead whose journeytype is 'cancelled' plus the cancel/watson id chain.
  //
  // Seeding those is a fixture change, not a spec change, and inventing the shape here would assert the
  // test's own scaffolding rather than the app's behaviour. Left explicit so the gap is visible rather
  // than silently absent from the suite.
  test.fixme('JP-28 approving a purchase with ppData triggers the delivery-sequence update', async () => {});
  test.fixme('JP-29 approving a cancelled-type lead writes the cancelled payload', async () => {});
});
