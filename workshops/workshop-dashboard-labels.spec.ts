// workshop-dashboard-labels.spec.ts — the workshop dashboard's renamed metric cards (operator 2026-11-17):
//   "Exist Users Enrolled" → "Existing Participants", "New Users Enrolled" → "New Users",
// and the side-panel heading each card opens now repeats the card's name:
//   "All Participants - Existing Participants", "All Participants - New Users".
//
// Recon: starlabs-angular src/app/New-Workshop/workshop-dashboard/workshop-dashboard.component.{html,ts}
// (metric-label <p>s, onMetricClick('existUsersEnrolled' | 'totalNewUsers') → selectedStatusInfo).
//
// Hooks: `wdash-*` (workshop-dashboard.component.html). `wdash-exist-users-label`, `wdash-new-users-label` and
// `wdash-panel-title`, `wdash-panel-heading` are new with the rename, so the hub-ahead guard (scripts/readiness/landed-specs.cjs) skips this
// FILE on app branches without it. WDC-01 (workshop-dashboard-communication.spec.ts) accepts either wording.
import { test, expect, Page } from '@playwright/test';
import {
  wsIds, installWshopStubs, loginAsWshopAdmin,
  seedEnrolledExportCase, clearEnrolledExportCase, wsExportPeople,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const panelCard = (page: Page, name: string) =>
  page.locator('.participant-panel mat-card.participant-card').filter({ hasText: name });

test.describe('Workshop dashboard — renamed Existing Participants / New Users cards', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await seedEnrolledExportCase();
  });
  test.afterEach(async () => {
    await clearEnrolledExportCase();
    assertNoFatal(guard, 'labels: no fatal console errors / pageerrors');
  });

  test('WDL-01 cards read "Existing Participants" and "New Users"; each panel heading repeats the card name', async ({ page }) => {
    const { moved, nu } = wsExportPeople;
    await loginAsWshopAdmin(page);
    await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('wdash-exist-users-label'), 'WDL-01: the exist card label')
      .toHaveText('Existing Participants', { timeout: 45_000 });
    await expect(page.getByTestId('wdash-new-users-label'), 'WDL-01: the new users card label').toHaveText('New Users');
    await expect(page.getByTestId('wdash-exist-users-card'), 'WDL-01: the old wording is gone')
      .not.toContainText('Exist Users Enrolled');
    await expect(page.getByTestId('wd-on-metric-click-19'), 'WDL-01: the old wording is gone')
      .not.toContainText('New Users Enrolled');

    // Existing Participants → its panel, headed with the same name, listing the moved (exist) person only.
    await page.getByTestId('wdash-exist-users-card').click();
    await expect(page.getByTestId('wdash-panel-heading'), 'WDL-01: the exist panel title (was the raw key, "Existusersenrolled")')
      .toHaveText('Existing Participants', { timeout: 30_000 });
    await expect(page.getByTestId('wdash-panel-title'), 'WDL-01: the exist panel heading')
      .toHaveText('All Participants - Existing Participants');
    await expect(panelCard(page, moved.name), 'WDL-01: the moved person is an existing participant').toBeVisible({ timeout: 30_000 });
    await expect(panelCard(page, nu.name), 'WDL-01: the still-new user is not').toHaveCount(0);
    await page.getByTestId('wd-close-participant-panel-61').click();

    // New Users → its panel, headed with the same name, listing the still-new user only.
    await page.getByTestId('wd-on-metric-click-19').click();
    await expect(page.getByTestId('wdash-panel-heading'), 'WDL-01: the new users panel title (was "Totalnewusers")')
      .toHaveText('New Users', { timeout: 30_000 });
    await expect(page.getByTestId('wdash-panel-title'), 'WDL-01: the new users panel heading')
      .toHaveText('All Participants - New Users');

    // Negative control: another panel keeps its titlecased heading.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wd-on-metric-click-6').click();
    await expect(page.getByTestId('wdash-panel-heading'), 'WDL-01: Total Enrolled keeps its own heading')
      .not.toHaveText(/Existing Participants|^New Users$/, { timeout: 30_000 });
    await expect(panelCard(page, nu.name), 'WDL-01: the still-new user is listed').toBeVisible({ timeout: 30_000 });
    // (Membership is not under test here: the moved person also shows in this panel today — noted 2026-11-17, see
    // the starlabs-angular journal 2026-11-17-workshop-mail-template-mapping.md.)
  });
});
