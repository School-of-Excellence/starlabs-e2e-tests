// behavioral.spec.ts — a small number of behavioral cases for DESTRUCTIVE / important Journey Onboarding
// controls. Kept minimal per the coverage plan. These drive real writes, so they are staged as
// test.fixme with an explicit oracle until seeded against the journey world; the journey WRITE paths
// themselves already have dedicated coverage (JP-08/09 onboard, JP-10/27..32 sales-lead approve/reject,
// JP-06 purchase) in journey/journey-deep.spec.ts and journey/sales-lead-approval.spec.ts.
import { test, expect } from '@playwright/test';
import { installJourneyStubs, attachJourneyGuard, loginAsJourneyAdmin } from '../support/journey';

test.describe('Journey Onboarding — destructive controls (behavioral)', () => {
  test.beforeEach(async ({ page }) => { attachJourneyGuard(page); await installJourneyStubs(page); });

  // saleslead Reject (jsl-btn-014 -> rejectSale(row)) is destructive: it sets the lead status.
  // Full behavioral coverage of reject/approve already lives in journey/sales-lead-approval.spec.ts.
  test.fixme('jsl — Reject writes the rejected status for the seeded lead', async ({ page }) => {
    await loginAsJourneyAdmin(page);
    await page.goto('/salesleads', { waitUntil: 'domcontentloaded' });
    // ORACLE: clicking Reject calls rejectSale(row); the salesleads doc's status becomes the rejected state.
    await page.getByTestId('jsl-btn-014').first().click();
  });

  // onboarding-remark Submit (jorm-btn-054 -> onSubmit) marks a participant onboarded and writes the
  // onboarding report. Blocked today by the dialog-as-route defect (JP-22); staged with its oracle.
  test.fixme('jorm — Submit marks the participant onboarded (onboardingreport written)', async ({ page }) => {
    await loginAsJourneyAdmin(page);
    // Driven via the parent onboarding flow that opens OnboardingRemarkComponent as a dialog.
    await expect(page.getByTestId('jorm-btn-054')).toBeAttached();
  });

});
