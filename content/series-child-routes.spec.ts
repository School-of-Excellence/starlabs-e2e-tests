// series-child-routes.spec.ts — /seriesdashboard/addseries and /seriesdashboard/editseries.
//
// Recon: e2e/recon-allcomp/content.md "Addendum — 2026-09-07" (CN-21 / CN-22).
//
// Both routes are declared as `children` of `seriesdashboard` (app.routes.ts:120-123), but
// series-dashboard.component.html has NO <router-outlet> (grep of the whole series-dashboard/ tree: 0
// hits). So the guard admits, the URL holds, and the child component is never rendered — the user just
// sees the parent dashboard. That is why CN-04 (which drove the add-series form at this URL) sat under
// test.fixme since the initial commit: the form it filled cannot mount. CN-04 now drives the LIVE
// create path (ConfigureseriesdialogComponent) in deep.spec.ts; these two cases cover the routes honestly:
//   CN-21 — the positive half that IS true today: the guard admits the URL (no /login bounce).
//   CN-22 — the pinned half: the Add Series form must render. test.fail() until the outlet exists.
import { test, expect } from '@playwright/test';
import { contentIds, installContentStubs, loginAsContentAdmin } from './support/content';

test.describe('Content — series child routes', () => {
  test.beforeEach(async ({ page }) => { await installContentStubs(page); });

  // ===========================================================================================
  // CN-21 — authGuard admits both child URLs (authorised through the /seriesdashboard grant)
  // ===========================================================================================
  test('CN-21 /seriesdashboard/addseries and /editseries are admitted by the guard (URL holds)', async ({ page }) => {
    await loginAsContentAdmin(page);
    const bounced: string[] = [];
    for (const route of ['/seriesdashboard/addseries', `/seriesdashboard/editseries?id=${contentIds.SER1}`]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2_500); // bounded settle — the guard reads `dashboard` before deciding
      const url = page.url();
      if (/\/login/.test(url) || !url.includes('/seriesdashboard/')) bounced.push(`${route} -> ${url}`);
    }
    expect(bounced, `CN-21: child URLs must be admitted via the /seriesdashboard grant (auth.guard.ts:35). Bounced: ${bounced.join(', ')}`)
      .toHaveLength(0);
    // and the PARENT dashboard is what actually rendered (this is the symptom CN-22 pins)
    await expect(page.locator('h1.dash-title'), 'CN-21: the parent series dashboard renders at the child URL').toBeVisible({ timeout: 30_000 });
  });

  // ===========================================================================================
  // CN-22 — THE GAP: the child never renders (no <router-outlet> in the parent)
  // ===========================================================================================
  test('CN-22 /seriesdashboard/addseries must render the Add Series form', async ({ page }) => {
    test.fail(
      true,
      'KNOWN DEFECT (recon-allcomp/content.md → Addendum 2026-09-07): series-dashboard.component.html has no '
      + '<router-outlet>, so the addseries/editseries children declared at app.routes.ts:120-123 never mount. '
      + 'Remove this test.fail() once the outlet is added (or the dead child routes are removed).',
    );
    await loginAsContentAdmin(page);
    await page.goto('/seriesdashboard/addseries', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/seriesdashboard\/addseries/, { timeout: 30_000 });
    // add-series.component.html:7-12 — the Series name input is the form's first control.
    await expect(
      page.locator('input[name="name"][placeholder="Series"]'),
      'CN-22: the Add Series form must mount at its own URL',
    ).toBeVisible({ timeout: 15_000 });
  });
});
