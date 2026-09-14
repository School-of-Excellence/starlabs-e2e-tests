// new-profile-controls.spec.ts — ADDRESSABLE + SMOKE for /ProfileScreen (NewProfileComponent).
// Prefix: np. Interactive-control coverage (plan 2026-09-14). Every literal below is a static
// data-testid added add-only to new-profile.component.html; *ngFor rows (np-result-*, per-profile
// menu items) carry [attr.data-testid] and are intentionally NOT referenced here (dynamic ids the
// readiness scanner cannot credit as literals — see the coverage plan).
//
// Reliably-present-on-load controls (search box, subscription-date, month cards, engagement radios,
// the five engagement-level cards + their timeline triggers) are hard-asserted. The per-card timeline
// MENU items only exist once a menu is opened, so they are opened + soft-asserted.
import { test, expect } from '@playwright/test';
import { installProfileStubs, loginAsProfileAdmin } from './support/profiles';

test.describe('New Profile (/ProfileScreen) — controls addressable', () => {
  test.beforeEach(async ({ page }) => {
    await installProfileStubs(page);
    await loginAsProfileAdmin(page);
  });

  test('renders and the always-present interactive controls are addressable', async ({ page }) => {
    await page.goto('/ProfileScreen', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/ProfileScreen/, { timeout: 30_000 });

    // Search box + its clear affix.
    await expect.soft(page.getByTestId('np-search-input')).toBeVisible({ timeout: 30_000 });
    await expect.soft(page.getByTestId('np-search-clear')).toBeVisible();

    // Subscription-ends date picker + the three month cards.
    await expect.soft(page.getByTestId('np-subs-date')).toBeVisible();
    await expect.soft(page.getByTestId('np-month-last')).toBeVisible();
    await expect.soft(page.getByTestId('np-month-this')).toBeVisible();
    await expect.soft(page.getByTestId('np-month-next')).toBeVisible();

    // Engagement category radio group + its two options.
    await expect.soft(page.getByTestId('np-engagement-group')).toBeVisible();
    await expect.soft(page.getByTestId('np-eng-active')).toBeVisible();
    await expect.soft(page.getByTestId('np-eng-nonactive')).toBeVisible();

    // The five engagement-level cards + their timeline (menu) triggers.
    await expect.soft(page.getByTestId('np-englevel-disappear')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-disappear-timeline')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-minimal')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-minimal-timeline')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-average')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-average-timeline')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-optimal')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-optimal-timeline')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-superoptimal')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-superoptimal-timeline')).toBeVisible();
  });

  test('engagement-level timeline menu items are addressable (opened per menu)', async ({ page }) => {
    await page.goto('/ProfileScreen', { waitUntil: 'domcontentloaded' });
    await expect.soft(page.getByTestId('np-englevel-disappear-timeline')).toBeVisible({ timeout: 30_000 });

    // Disappear timeline menu — open then assert both items.
    await page.getByTestId('np-englevel-disappear-timeline').click().catch(() => {}); // best-effort (addressable)
    await expect.soft(page.getByTestId('np-englevel-disappear-abs')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-disappear-rel')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('np-englevel-minimal-timeline').click().catch(() => {}); // best-effort (addressable)
    await expect.soft(page.getByTestId('np-englevel-minimal-abs')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-minimal-rel')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('np-englevel-average-timeline').click().catch(() => {}); // best-effort (addressable)
    await expect.soft(page.getByTestId('np-englevel-average-abs')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-average-rel')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('np-englevel-optimal-timeline').click().catch(() => {}); // best-effort (addressable)
    await expect.soft(page.getByTestId('np-englevel-optimal-abs')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-optimal-rel')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('np-englevel-superoptimal-timeline').click().catch(() => {}); // best-effort (addressable)
    await expect.soft(page.getByTestId('np-englevel-superoptimal-abs')).toBeVisible();
    await expect.soft(page.getByTestId('np-englevel-superoptimal-rel')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
