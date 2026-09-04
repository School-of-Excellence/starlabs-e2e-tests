// campaign-dashboard.spec.ts — /campaigndashboard (New-Workshop/campaigndashboard).
//
// Recon: e2e/recon-allcomp/workshops.md "Addendum — 2026-09-04" (WS-31).
//
// Why this screen is worth a REAL case rather than a mount smoke: /campaigndashboard is declared with
// NO canActivate (app.routes.ts:296), so "the route loads for an admin" would still pass with the guard
// deleted — it asserts nothing about the product. Everything asserted here is instead a value the APP
// DERIVED and that appears NOWHERE in the seed:
//   • the status chip  — statusOf() compares start/end against today (ts:188-194); the seed stores DATES
//   • the progress %   — round(achieved/expected*100) (ts:162); the seed stores two rupee amounts
//   • the segment name — a join from campaign.segment (a newusertags doc id) to that tag's `name` (ts:169)
//   • the card order   — live before scheduled before ended (STATUS_ORDER, ts:143-149)
//
// Anti-circularity: the seed deliberately never stores a status string or a percentage. If the app
// stopped computing them the assertions could not pass by echoing seeded data back.
import { test, expect } from '@playwright/test';
import { wsAddNames, installWshopStubs, loginAsWshopAdmin } from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.describe('Workshops — campaign dashboard (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'campaign dashboard: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // WS-31 — status chip, progress % and segment name are COMPUTED by the app from the raw doc
  // ===========================================================================================
  test('WS-31 campaign cards render app-computed status, progress % and segment name', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/campaigndashboard', { waitUntil: 'domcontentloaded' });

    // [REAL-UI] one .cc card per eiflixcampaign doc the app streamed (campaigndashboard.html:14).
    const liveCard = page.locator('.cc').filter({ hasText: wsAddNames.campLive });
    await expect(liveCard, 'WS-31: the seeded live campaign card must render from the live stream')
      .toBeVisible({ timeout: 30_000 });

    // [ASSERT 1] STATUS is derived from dates, never stored. The seed gave CAMP_LIVE start=-2d/end=+5d;
    // "Live" is the app's conclusion (statusOf, ts:188).
    await expect(liveCard.locator('.schip'), 'WS-31: start<=today<=end must be classified Live')
      .toHaveText(/Live/, { timeout: 15_000 });
    await expect(
      page.locator('.cc').filter({ hasText: wsAddNames.campSched }).locator('.schip'),
      'WS-31: a start date in the future must be classified Scheduled',
    ).toHaveText(/Scheduled/, { timeout: 15_000 });
    await expect(
      page.locator('.cc').filter({ hasText: wsAddNames.campEnded }).locator('.schip'),
      'WS-31: an end date in the past must be classified Ended',
    ).toHaveText(/Ended/, { timeout: 15_000 });

    // [ASSERT 2] PROGRESS % is arithmetic the app performed: achieved 150000 / expected 200000 = 75.
    // 75 appears nowhere in the seed — only the two rupee amounts do.
    await expect(
      liveCard.locator('.cc-prog-lbl'),
      'WS-31: 150000/200000 must render as the app-computed 75%',
    ).toContainText('75%', { timeout: 15_000 });

    // [ASSERT 3] SEGMENT NAME is a JOIN the app performed: the doc stores a newusertags id, the card
    // shows that tag's `name` (ts:169). Asserting the NAME proves the join ran, not just a field echo.
    await expect(
      liveCard.locator('.cc-seg'),
      'WS-31: campaign.segment (a tag id) must be resolved to the tag name',
    ).toHaveText(wsAddNames.segment, { timeout: 15_000 });

    // [ASSERT 4] ORDER is the app's sort (live → scheduled → ended, ts:143-149). Read the rendered
    // sequence and assert our three seeded cards appear in that relative order.
    const names = await page.locator('.cc .cc-n').allTextContents();
    const iLive = names.indexOf(wsAddNames.campLive);
    const iSched = names.indexOf(wsAddNames.campSched);
    const iEnded = names.indexOf(wsAddNames.campEnded);
    expect(iLive, 'WS-31: the live card rendered').toBeGreaterThanOrEqual(0);
    expect(iLive, `WS-31: live (${iLive}) must sort before scheduled (${iSched})`).toBeLessThan(iSched);
    expect(iSched, `WS-31: scheduled (${iSched}) must sort before ended (${iEnded})`).toBeLessThan(iEnded);
  });
});
