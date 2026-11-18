// workshop-dashboard-clear-access.spec.ts — who gets the workshop dashboard's Clear button (2026-11-12).
//
// Recon: starlabs-angular specs/journals/2026-11-12-clear-button-access.md.
//
// THE RULE UNDER TEST (starlabs-angular workshop-access.model.ts → WorkshopAccess.can('clear')):
// Clear comes ONLY from
//   · "static meta data"/"Workshop Admin".clearworkshop — on every dashboard the person can already open, or
//   · workshopsettings/{workshop id}.dashboardaccess[profileid] containing 'clear' — that workshop only.
// Full dashboard access (workshopdashboardadmin) does NOT bring Clear, and the Clear list does not open a
// dashboard by itself.
// Also here: the editor's save REPLACES this workshop's grants map, so a person set to None (or removed)
// loses their stored actions — Clear included — even while someone else still has a row.
//
// Hooks: `wd-*` / `wdash-*` (workshop-dashboard.component.html) and `ws-access-*`
// (workshop-settingsv2.component.html). `ws-access-admins-help` landed with this rule, so the hub-ahead
// guard (scripts/readiness/landed-specs.cjs) skips this whole file on app branches that predate it.
//
// THE WORLD (seed-workshops.js §6c): admin and mover both have full dashboard access; only mover is on the
// Clear list. limited is on no shared list and has ['qanda','export'] on W_DASH. Every precondition write
// below is undone in a finally.
import { test, expect, Page } from '@playwright/test';
import {
  wsIds, wsMetaNames, wsProfileIds, wsLimitedGrants,
  installWshopStubs, loginAsWshopAdmin, loginAsWshopLimited, loginAsWshopMover, alignWorkshopMetadataNames,
  workshopDashboardAccess, resetDashboardAccess, resetWorkshopAdminLists, setWorkshopClearList, setDashboardGrants,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { pollUntil } from '../queue/support/firestore-admin';

const CHARLIE = wsMetaNames.p2;      // p2 — has metadata, is on no shared list

async function openDashboard(page: Page, workshopId: string): Promise<void> {
  await page.goto(`/workshop_dashboard/${workshopId}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${workshopId}`), { timeout: 30_000 });
}

/** Open the workshop editor's Settings tab and expand Dashboard Access (it starts collapsed). */
async function openDashboardAccessSection(page: Page): Promise<void> {
  await page.goto(`/workshopconfig/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
  const settingsTab = page.locator('.tabs .tab', { hasText: 'Settings' });
  await expect(settingsTab, 'the Settings tab must render for someone who can edit').toBeVisible({ timeout: 30_000 });
  await settingsTab.click();
  const head = page.getByTestId('ws-access-section');
  await expect(head, 'the Dashboard Access section header must render').toBeVisible({ timeout: 30_000 });
  if (!(await page.getByTestId('ws-access-state').isVisible().catch(() => false))) await head.click();
  await expect(page.getByTestId('ws-access-state'), 'the section must finish loading its people')
    .toBeVisible({ timeout: 60_000 });
}

const rowFor = (page: Page, name: string) => page.getByTestId('ws-access-row').filter({ hasText: name });

test.describe('Workshop dashboard — Clear access', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await alignWorkshopMetadataNames();
  });
  test.afterEach(() => assertNoFatal(guard, 'clear access: no fatal console errors / pageerrors'));

  test('WCA-01 the editor says full dashboard access excludes Clear', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openDashboardAccessSection(page);
    await expect(page.getByTestId('ws-access-admins-help'), 'WCA-01: the Full dashboard access help names the exception')
      .toContainText(/except Clear/i);
  });

  test('WCA-02 full dashboard access alone does not give Clear', async ({ page }) => {
    // admin: full dashboard access, NOT on the Clear list, no tick on W_DASH.
    await loginAsWshopAdmin(page);
    await openDashboard(page, wsIds.W_DASH);
    // [REAL-UI] the positive half — the header rendered with full access — so the negative cannot pass on a blank screen.
    await expect(page.getByTestId('wd-manualenroll-5'), 'WCA-02: Enroll renders for full access').toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('wd-open-diagnose-dialog-3'), 'WCA-02: Diagnose renders for full access').toBeVisible();
    await expect(page.getByTestId('wd-open-clear-dialog-4'), 'WCA-02: no Clear without the list or a tick').toHaveCount(0);
  });

  test('WCA-03 the Clear list gives a full-access person Clear, and taking them off takes it away', async ({ page }) => {
    await loginAsWshopMover(page);
    await openDashboard(page, wsIds.W_DASH);
    await expect(page.getByTestId('wd-manualenroll-5'), 'WCA-03: the dashboard rendered for mover').toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('wd-open-clear-dialog-4'), 'WCA-03: on the Clear list → Clear').toBeVisible();

    // [ASSERT] the same person, same workshop, list emptied → no Clear. This is what proves the list (and
    // not mover's identity) is what grants it.
    await setWorkshopClearList([]);
    try {
      await openDashboard(page, wsIds.W_DASH);
      await expect(page.getByTestId('wd-manualenroll-5'), 'WCA-03: still full access after the list change')
        .toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('wd-open-clear-dialog-4'), 'WCA-03: off the Clear list → no Clear').toHaveCount(0);
    } finally {
      await resetWorkshopAdminLists();
    }
  });

  test("WCA-04 this workshop's own Clear tick gives Clear, and nothing more", async ({ page }) => {
    await setDashboardGrants({ [wsProfileIds.limited]: [...wsLimitedGrants, 'clear'] });
    try {
      await loginAsWshopLimited(page);
      await openDashboard(page, wsIds.W_DASH);
      await expect(page.getByTestId('wd-open-qadialog-2'), 'WCA-04: the dashboard rendered for limited')
        .toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('wd-open-clear-dialog-4'), 'WCA-04: the Clear tick shows Clear').toBeVisible();
      await expect(page.getByTestId('wd-open-diagnose-dialog-3'), 'WCA-04: still no ungranted action').toHaveCount(0);
    } finally {
      await resetDashboardAccess();
    }
  });

  test('WCA-05 the Clear list gives Clear where the person can get in, and opens no other dashboard', async ({ page }) => {
    await setWorkshopClearList([wsProfileIds.mover, wsProfileIds.limited]);
    try {
      await loginAsWshopLimited(page);
      await openDashboard(page, wsIds.W_DASH);
      await expect(page.getByTestId('wd-open-qadialog-2'), 'WCA-05: the dashboard rendered for limited')
        .toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('wd-open-clear-dialog-4'), 'WCA-05: on the Clear list → Clear without a tick')
        .toBeVisible();
      await expect(page.getByTestId('wd-open-diagnose-dialog-3'), 'WCA-05: still no ungranted action').toHaveCount(0);

      // [ASSERT] W_ACTIVE grants limited nothing: the list does not open it.
      await openDashboard(page, wsIds.W_ACTIVE);
      await expect(page.getByTestId('wdash-no-access'), 'WCA-05: the Clear list opens no dashboard by itself')
        .toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('wd-open-clear-dialog-4'), 'WCA-05: no Clear there').toHaveCount(0);
    } finally {
      await resetWorkshopAdminLists();
    }
  });

  test("WCA-06 None on one person removes their stored actions (Clear included) while another person keeps theirs", async ({ page }) => {
    // Two people on W_DASH, so the saved map is never empty — the case a deep merge used to get wrong.
    await setDashboardGrants({
      [wsProfileIds.limited]: [...wsLimitedGrants],
      [wsProfileIds.p2]: ['qanda', 'clear'],
    });
    try {
      await loginAsWshopAdmin(page);
      await openDashboardAccessSection(page);
      const row = rowFor(page, CHARLIE);
      await expect(row, 'WCA-06: the seeded second person is listed').toBeVisible({ timeout: 15_000 });
      await row.getByTestId('ws-access-grant-none').click();
      await expect(row.locator('.acc-tick.on'), 'WCA-06: None clears the row').toHaveCount(0);
      await page.getByTestId('ws-access-save').click();

      // [ASSERT] the APP's write dropped p2 from the stored map, and left limited exactly as it was.
      await pollUntil(
        async () => await workshopDashboardAccess(wsIds.W_DASH),
        (m: Record<string, string[]>) => m[wsProfileIds.p2] === undefined && Array.isArray(m[wsProfileIds.limited]),
        { timeoutMs: 30_000, label: 'WCA-06 app write replacing the grants map' },
      );
      const after = await workshopDashboardAccess(wsIds.W_DASH);
      expect(after[wsProfileIds.p2], 'WCA-06: p2 no longer holds Clear on this workshop').toBeUndefined();
      expect(after[wsProfileIds.limited], 'WCA-06: the other person is untouched').toEqual(wsLimitedGrants);
    } finally {
      await resetDashboardAccess();
    }
  });
});
