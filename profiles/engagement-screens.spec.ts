// engagement-screens.spec.ts — the three AppEngagement screens profiles claims (REAL-UI).
//
// Recon: e2e/recon-allcomp/profiles-analytics.md (PA-44..PA-46 — 2026-09-08 coverage pass).
//
// WHY THESE WERE LEFT: they are the last routes the profiles suite claims and never opened. Each needed a
// `dashboard` grant (authGuard matches the FIRST path segment, so all three needed their own) and none is
// a routed dialog — scripts/check-routable-dialogs.mjs reports all three clean.
//
// SCOPE, stated plainly: these are MOUNT + EMPTY-STATE cases, weaker than an oracle, and labelled as such
// rather than dressed up. Each screen reads collections this suite does not seed —
//   /communitymanager  : community category / community post / community post tags / event collection
//   /ahcrm             : arena events / big cohorts / event collection / event participation request
//   /atctaxonomy       : atc taxonomy
// so all three render their empty state. That is worth pinning for a specific reason: it proves none of
// them THROWS on absent data, which is the failure mode that took /bigProfile and /bigchatscreen down
// earlier in this branch, and which no test would have caught on these screens either.
//
// ON NOT SEEDING `atc taxonomy` (PA-46): the app CLAUDE.md lists it as reference-only config and therefore
// safe to READ, and check-atc-coupling.mjs agrees the route is in scope. The content seeder nonetheless
// deliberately does not seed it (seed-content.js header), and this follows that precedent: the screen is
// exercised against an absent taxonomy rather than us writing into an ATC-named collection to make a
// prettier assertion. Seeding it would be defensible; not seeding it needs no argument.
import { test, expect } from '@playwright/test';
import { installProfileStubs, loginAsProfileAdmin } from './support/profiles';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

let guard: ConsoleGuard;

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  await installProfileStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'engagement screens: no fatal console errors / pageerrors'));

test.describe('Profiles — AppEngagement screens (real UI)', () => {
  for (const [id, route, host, heading] of [
    ['PA-44', '/communitymanager', 'app-communitymanager', /Community Manager/i],
    ['PA-45', '/ahcrm', 'app-participant-list', /A&H CRM/i],
  ] as const) {
    test(`${id} ${route} mounts and renders its heading over empty data`, async ({ page }) => {
      await loginAsProfileAdmin(page);
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      await expect(
        page.locator(host),
        `${id}: ${route} must mount — if this fails on a correct URL, check its grant in ` +
        'profiles/seed-profiles.js ROUTES (authGuard denies unlisted screens)',
      ).toBeAttached({ timeout: 30_000 });

      await expect(
        page.locator(host).getByText(heading).first(),
        `${id}: the heading must render, which means the component survived its reads on empty data`,
      ).toBeVisible({ timeout: 60_000 });
    });
  }

  // ===========================================================================================
  // PA-46 — /atctaxonomy mounts against an unseeded (and deliberately unseeded) taxonomy
  // ===========================================================================================
  test('PA-46 atctaxonomy mounts with no taxonomy seeded', async ({ page }) => {
    await loginAsProfileAdmin(page);
    await page.goto('/atctaxonomy', { waitUntil: 'domcontentloaded' });

    // The component's only read is `atc taxonomy` — reference-only config the app CLAUDE.md marks safe to
    // read. Nothing seeds it, so the sole thing this can honestly assert is that the screen mounts and
    // does not fall over on an empty collection.
    await expect(
      page.locator('app-view-tags'),
      'PA-46: the taxonomy screen must mount — check the /atctaxonomy grant if this fails on a correct URL',
    ).toBeAttached({ timeout: 30_000 });
  });
});
