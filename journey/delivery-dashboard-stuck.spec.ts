// delivery-dashboard-stuck.spec.ts — /delivery-dashboard → Participants → Stuck Cases, after the
// "stuck = last ATTENDED appointment >= 15 days ago" rule (starlabs-angular bb5bca74, mahalakshmi
// 2026-09-29, pulled onto charan-release 2026-10-01) and the new Subscription Start / End columns.
//
// Hook prefix: ddc — DeliveryDashboardCloneComponent (same prefix dashboards.spec.ts addresses).
// Reference: starlabs-angular specs/journals/2026-10-01-pull-delivery-dashboard-stuck-cases.md.
//
// SEEDED WORLD (seed-journey.js step 8, seedDdcStuck — own run tag `<run>_ddc`, own DFU product):
//   STALE   ongoing   · attended appt 18d ago + a newer UNattended appt 2d ago → the ONLY stuck row
//   RECENT  initiated · attended appt 3d ago                                   → excluded
//   NOAPPT  ongoing   · no appointment                                         → excluded
//   UNATT   ongoing   · only an unattended appt 30d ago                        → excluded
//   DONE    completed · attended appt 40d ago                                  → excluded (status)
// Every PP has a 20-day-old statusdate, so under the PREVIOUS rule (15 days since statusdate) all four
// active controls would be stuck: a green run cannot be the old rule, nor "there was nothing to drop".
//
// ANTI-CIRCULARITY. The test only clicks and types a name filter. The app derives membership from a
// join it runs itself (participantsproduct.docid ↔ appointments.participantproductid, attended filter,
// newest endtime), the DAYS value from that endtime, and the subscription dates from the PP doc; the
// name comes from `participant metadata`. The test asserts none of the values it wrote except the
// formatted subscription dates, and those only as "the column renders the PP's field".
//
// NOT COVERED: the participant-set cache (stuckKey) — it only changes WHEN the appointment read re-runs,
// which no assertion here can observe without counting reads. Subscription columns on the other three
// tables use the same header/row path; Stuck Cases is the one asserted.
import { test, expect, Page } from '@playwright/test';
import { installJourneyStubs, attachJourneyGuard, loginAsJourneyAdmin, ddcStuckWorld as W } from './support/journey';
import { assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

let guard: ConsoleGuard;
test.beforeEach(async ({ page }) => {
  guard = attachJourneyGuard(page);
  await installJourneyStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'delivery dashboard stuck cases: no fatal console errors / pageerrors'));

/** Open /delivery-dashboard → Participants → Stuck Cases; returns the Stuck Cases tab panel. Inactive
 *  panels keep their (identical) table in the DOM, so everything is scoped to this panel. */
async function openStuckCases(page: Page) {
  await loginAsJourneyAdmin(page);
  await page.goto('/delivery-dashboard', { waitUntil: 'domcontentloaded' });
  const host = page.locator('app-delivery-dashboard-clone');
  await expect(host, 'ddc must mount').toBeAttached({ timeout: 30_000 });
  await page.getByTestId('ddc-btn-017').click();   // outer tab strip: custom buttons, not mat-tabs
  await host.getByRole('tab', { name: /Stuck Cases/ }).click();
  const panel = host.getByRole('tabpanel', { name: /Stuck Cases/ });
  await expect(panel.locator('.pm-data-table th').filter({ hasText: 'SUBSCRIPTION START' }), 'the Stuck Cases headers render').toBeVisible({ timeout: 30_000 });
  return panel;
}

test.describe('Journey — Delivery dashboard Stuck Cases (last attended appointment >= 15 days; subscription columns)', () => {
  test('DDC-STK-01 only the participant whose last ATTENDED appointment is >= 15 days old is stuck', async ({ page }) => {
    const panel = await openStuckCases(page);
    const rows = panel.locator('tr.pm-table-row');

    // The appointment join is async and lands after the tab renders; the name filter re-reads the
    // tab's data on every input, so re-type until the app's join has landed.
    await expect(async () => {
      await page.getByTestId('ddc-inp-104').fill('');
      await page.getByTestId('ddc-inp-104').fill(W.tag);
      await expect(rows.filter({ hasText: W.names.STALE })).toHaveCount(1, { timeout: 3_000 });
    }, 'DDC-STK-01: STALE (attended 18d ago) must be a stuck row').toPass({ timeout: 90_000 });

    await expect(rows, 'DDC-STK-01: exactly one of the five seeded participants is stuck').toHaveCount(1);
    for (const k of ['RECENT', 'NOAPPT', 'UNATT', 'DONE'] as const) {
      await expect(rows.filter({ hasText: W.names[k] }), `DDC-STK-01: ${k} must not be stuck`).toHaveCount(0);
    }
    // DAYS comes from the last ATTENDED appointment (18d) — not the newer unattended one (2d), and not
    // the 20-day statusdate that DAYS STUCK (waitingperiod) shows in the same row.
    const badges = rows.first().locator('.pm-days-badge');
    await expect(badges.filter({ hasText: /^\s*18 DAYS\s*$/ }), 'DDC-STK-01: DAYS is counted from the last ATTENDED appointment').toHaveCount(1);
    await expect(badges.filter({ hasText: /^\s*2 DAYS\s*$/ }), 'DDC-STK-01: the unattended 2-day-old appointment is ignored').toHaveCount(0);
  });

  test('DDC-STK-02 the stuck row renders the PP subscription start and end dates', async ({ page }) => {
    const panel = await openStuckCases(page);
    await expect(panel.locator('.pm-data-table th').filter({ hasText: 'SUBSCRIPTION END' })).toBeVisible();
    const row = panel.locator('tr.pm-table-row').filter({ hasText: W.names.STALE });
    await expect(async () => {
      await page.getByTestId('ddc-inp-104').fill('');
      await page.getByTestId('ddc-inp-104').fill(W.names.STALE);
      await expect(row).toHaveCount(1, { timeout: 3_000 });
    }).toPass({ timeout: 90_000 });
    await expect(row.locator('.pm-date-text').filter({ hasText: W.subscription.start }), 'DDC-STK-02: SUBSCRIPTION START').toHaveCount(1);
    await expect(row.locator('.pm-date-text').filter({ hasText: W.subscription.end }), 'DDC-STK-02: SUBSCRIPTION END').toHaveCount(1);
  });
});
