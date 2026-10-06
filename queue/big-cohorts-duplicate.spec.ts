// big-cohorts-duplicate.spec.ts — /bigcohorts: "Duplicate selected cohorts into the same or another
// marathon" (starlabs-angular c9b8d320, pulled onto charan-release 2026-09-30).
//
// Hook prefixes (one per component):
//   cman — CohortManagementComponent (cohort-management.component.html)
//   mcoh — ManageCohertsComponent    (manage-coherts.component.html, the create/edit/duplicate dialog)
//
// Reference: starlabs-angular specs/journals/2026-09-30-bigcohorts-duplicate-cohorts.md.
//
// SEEDED WORLD (fixtures/big-seed.ts seedBigWorld): one `big marathon` (auto-selected — last by startdate),
// a SOURCE cohort holding participants and an EMPTY target cohort under it, and a mentor-flagged login that
// the /bigcohorts route grant admits. Nothing is added for this file.
//
// ANTI-CIRCULARITY. The test only clicks. What it asserts is derived by the app: the selection count in
// the dialog title, the target marathon pre-selected to the CURRENT one (so Continue is enabled without a
// choice), and the duplicate banner text the create-cohort dialog composes from the SOURCE cohort's name and
// the TARGET marathon's title — two different docs. The oracle for "nothing was written" is an Admin-SDK
// count of `big cohorts` for the run, read before and after.
// NEGATIVE CONTROLS: the unselected target cohort must not be counted ("1 cohort(s)"), and neither Cancel
// nor dismissing the per-cohort dialog may create a cohort (the app skips a cohort whose dialog is closed).
//
// NOT COVERED: the actual create (Continue → Save). It writes a `big cohorts` doc through the create form,
// which needs an event/mentor selection this seed does not provide, and would move the counts BIG-07/BIG-08
// read. Deferred with the BIG-08 page-object refit.
import { test, expect, Page } from '@playwright/test';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs } from './stubs';
import { loginAs, PASSWORD } from './support/actors';
import { countWhere } from './support/firestore-admin';
import { seedBigWorld, BigSeedResult } from '../fixtures/big-seed';

let seed: BigSeedResult;
let guard: ConsoleGuard;

test.beforeAll(async () => {
  seed = await seedBigWorld({ initiatedCount: 3, cohortSourceCount: 3, aelCount: 3, configRows: 2 });
});
test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  installAllExternalStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'big cohorts duplicate: no fatal console errors / pageerrors'));

const cohortCount = () => countWhere('big cohorts', [['testrunid', '==', seed.testrunid]]);

/** Log in as the run's mentor, open /bigcohorts, enter select mode and tick ONLY the source cohort. */
async function selectSourceCohort(page: Page) {
  // Real login form. NOT loginAsBigAdmin — that lands on the ATC-fenced /big-dashboard.
  await loginAs(page, seed.mentorEmail, PASSWORD);
  await page.goto('/bigcohorts', { waitUntil: 'domcontentloaded' });
  const card = page.locator('.cohort-card').filter({ has: page.getByTestId('cman-on-edit-cohort-41').getByText(seed.sourceCohortName, { exact: true }) });
  await expect(card, 'the seeded source cohort must render under the auto-selected marathon').toBeVisible({ timeout: 60_000 });
  await page.getByTestId('cman-toggle-select-mode-31').click();
  await card.getByTestId('cman-toggle-cohort-selected-40').click();
  await expect(card, 'the source cohort is ticked').toHaveClass(/\bchecked\b/);
}

test.describe('BIG — Cohorts duplicate (target-marathon dialog, per-cohort create dialog, no write on dismiss)', () => {
  test('BIG-12 Duplicate opens the target dialog for the selection, pre-set to the current marathon; Cancel writes nothing', async ({ page }) => {
    const before = await cohortCount();
    await selectSourceCohort(page);

    await page.getByTestId('cman-duplicate-selected-cohorts-83').click();
    const dialog = page.locator('mat-dialog-container').filter({ has: page.getByTestId('cman-duplicate-target-marathon-84') });
    await expect(dialog, 'BIG-12: the target-marathon dialog opens').toBeVisible();
    await expect(dialog, 'BIG-12: only the ticked cohort is counted — not the unselected target cohort').toContainText('Duplicate 1 cohort(s)');
    await expect(page.getByTestId('cman-duplicate-target-marathon-84'), 'BIG-12: the current marathon is pre-selected').toContainText(seed.marathonTitle);
    await expect(page.getByTestId('cman-duplicate-continue-86'), 'BIG-12: a pre-selected target enables Continue').toBeEnabled();

    await page.getByTestId('cman-duplicate-cancel-85').click();
    await expect(dialog, 'BIG-12: Cancel closes the dialog').toHaveCount(0);
    await expect(page.locator('app-manage-coherts'), 'BIG-12: Cancel opens no create dialog').toHaveCount(0);
    expect(await cohortCount(), 'BIG-12: Cancel created no cohort').toBe(before);
  });

  test('BIG-13 Continue opens the create dialog as a copy of the source cohort into the target marathon; dismissing it skips the cohort', async ({ page }) => {
    const before = await cohortCount();
    await selectSourceCohort(page);

    await page.getByTestId('cman-duplicate-selected-cohorts-83').click();
    await page.getByTestId('cman-duplicate-continue-86').click();

    const banner = page.getByTestId('mcoh-duplicate-target-35');
    await expect(banner, 'BIG-13: the create dialog opens in duplicate mode').toBeVisible({ timeout: 30_000 });
    await expect(banner, 'BIG-13: names the SOURCE cohort').toContainText(seed.sourceCohortName);
    await expect(banner, 'BIG-13: names the TARGET marathon').toContainText(seed.marathonTitle);
    await expect(banner).toContainText('The event is not carried over.');

    await page.getByTestId('mcoh-on-cancel-1').click();
    await expect(page.locator('app-manage-coherts'), 'BIG-13: the dialog closes').toHaveCount(0, { timeout: 15_000 });
    expect(await cohortCount(), 'BIG-13: a dismissed cohort is skipped — nothing created').toBe(before);
  });
});
