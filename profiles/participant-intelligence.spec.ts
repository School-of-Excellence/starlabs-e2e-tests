// participant-intelligence.spec.ts — /participant-intelligence: the top-bar controls of the Participant
// Intelligence shell (search clear, insights + filter-rail toggles, checklists menu, comms menu, refresh).
//
// Prefix: pi — ParticipantIntelligenceComponent (participant-intelligence.component.html).
//
// Reference: starlabs-angular specs/journals/2026-09-24-participant-intelligence-folder-restructure.md and
// memory note "Participant Intelligence status": a partial prototype of the participants-analytics
// redesign (several bulk actions are stubs). This file covers the shell the screen always renders; the
// inline-template sub-components (filter rail, table, bulk bar, dialogs) carry no hooks yet and are not
// asserted.
//
// SEEDED WORLD: the profiles seed's admin, its participant metadata, and the /participant-intelligence grant.
//
// ANTI-CIRCULARITY: every assertion is a state the COMPONENT derives from a click — the rail/insights panels
// appearing and disappearing with their signals, the clear button existing only while a search term does,
// the checklist menu listing the component's own CHECKLISTS definitions. The test never writes app state.
// NOT COVERED: the table's numbers against Firestore (the list is the full `participant metadata`
// collection, shared with every other profiles case — no run-scoped oracle exists for it yet).
import { test, expect, Page } from '@playwright/test';
import { installProfileStubs, loginAsProfileAdmin } from './support/profiles';

async function open(page: Page) {
  await installProfileStubs(page);
  await loginAsProfileAdmin(page);
  await page.goto('/participant-intelligence', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('app-participant-intelligence'),
    'must mount — check the /participant-intelligence grant if this fails').toBeAttached({ timeout: 30_000 });
  await expect(page.getByText('Loading participants…'), 'the initial load must finish').toHaveCount(0, { timeout: 60_000 });
}

test.describe('Participant Intelligence — shell controls (toggles, search, menus, refresh)', () => {
  test('PI-01 the filter rail and insights toggles show and hide their panels', async ({ page }) => {
    await open(page);
    const rail = page.locator('aside.rail');
    const railBtn = page.getByTestId('pi-toggle-rail');
    await expect(rail, 'PI-01: the rail starts open').toBeVisible();
    await expect(railBtn).toHaveClass(/\bactive\b/);
    await railBtn.click();
    await expect(rail).toHaveCount(0);
    await expect(railBtn).not.toHaveClass(/\bactive\b/);
    await railBtn.click();
    await expect(rail, 'PI-01: toggling again restores it').toBeVisible();

    const insights = page.locator('app-signals-panel');
    const insightsBtn = page.getByTestId('pi-toggle-insights');
    await expect(insights, 'PI-01: insights start open').toBeAttached();
    await insightsBtn.click();
    await expect(insights).toHaveCount(0);
    await expect(insightsBtn).not.toHaveClass(/\bactive\b/);
    await insightsBtn.click();
    await expect(insights).toBeAttached();
  });

  test('PI-02 the search clear button exists only while there is a term, and clears it', async ({ page }) => {
    await open(page);
    const input = page.getByPlaceholder('Search name, email or phone…');
    await expect(page.getByTestId('pi-search-clear'), 'PI-02: no term → no clear button').toHaveCount(0);
    await input.fill('zz-no-such-participant');
    await expect(page.getByTestId('pi-search-clear')).toBeVisible();
    await page.getByTestId('pi-search-clear').click();
    await expect(input).toHaveValue('');
    await expect(page.getByTestId('pi-search-clear')).toHaveCount(0);
  });

  test('PI-03 the checklists menu lists the reconciliation checklists', async ({ page }) => {
    await open(page);
    await page.getByTestId('pi-checklists').click();
    const items = page.getByTestId('pi-checklist-item');
    await expect(items.first()).toBeVisible();
    await expect(items.filter({ hasText: 'Customer status' })).toHaveCount(1);
    await expect(items.filter({ hasText: 'Higher-order purchase' })).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(items).toHaveCount(0);
  });

  test('PI-04 the comms menu opens its analytics panel, and refresh reloads', async ({ page }) => {
    await open(page);
    await page.getByTestId('pi-comms').click();
    await expect(page.locator('app-comms-analytics-panel'), 'PI-04: the comms panel opens in the menu').toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('pi-refresh').click();
    await expect(page.getByText('Refreshed'), 'PI-04: refresh confirms').toBeVisible();
  });
});
