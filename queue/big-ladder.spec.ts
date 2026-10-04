// big-ladder.spec.ts — /big-leaderboard: the B!G leaderboard (starlabs-angular surya 7a23f823, pulled onto
// charan-release 2026-10-05).
//
// Hook prefix: bld — BigLadderComponent (big-ladder.component.html; 56 literal hooks added on pull).
// Reference: starlabs-angular specs/journals/2026-10-05-pull-surya-big-ladder.md.
//
// SEEDED WORLD: fixtures/big-ladder-seed.ts (own run tag `<run>_bld`) + seedBigWorld for the mentor login and
// the /big-leaderboard route grant. Three people: Active (B!G journey), Nonactive (B!G via
// lastcompletedjourney) and Other (LYL journey — must never be listed), plus per-metric negative controls
// (a duplicate attended EPR, an attended NON-B!G event, an approved-not-attended EPR, an activity on a draft
// assignment, a repeat video, an incomplete log, a non-eiflix log).
//
// ANTI-CIRCULARITY: every asserted number is the app's own join over raw docs (distinct B!G events attended,
// "<completed> / <all>" activity, distinct complete eiflix videos, studio log count); the seed writes no
// metric, only the source docs and the controls each rule must exclude.
//
// NOT COVERED: cohort selection / grouping / ungrouping (savedCohortGroups is local UI state over active
// cohorts — registered in BLD-ADDR1), the side panel's per-tab content lists.
import { test, expect, Page } from '@playwright/test';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs } from './stubs';
import { loginAs, PASSWORD } from './support/actors';
import { seedBigWorld, BigSeedResult } from '../fixtures/big-seed';
import { seedBigLadder, teardownBigLadder, BigLadderWorld } from '../fixtures/big-ladder-seed';

let seed: BigSeedResult;
let W: BigLadderWorld;
let guard: ConsoleGuard;

test.beforeAll(async () => {
  seed = await seedBigWorld({ initiatedCount: 3, cohortSourceCount: 3, aelCount: 3, configRows: 2 });
  W = await seedBigLadder(seed.testrunid);
});
test.afterAll(async () => { await teardownBigLadder(seed.testrunid); });
test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  installAllExternalStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'big leaderboard: no fatal console errors / pageerrors'));

/** Log in, open the leaderboard and narrow the table to this run's people. */
async function openLadder(page: Page) {
  await loginAs(page, seed.mentorEmail, PASSWORD);
  await page.goto('/big-leaderboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.loading-overlay'), 'the leaderboard finishes loading').toHaveCount(0, { timeout: 60_000 });
  await page.getByTestId('bld-participant-search').fill(W.tag);
}
const row = (page: Page, name: string) => page.locator('.bl-rows').filter({ has: page.getByTestId('bld-row-name').getByText(name, { exact: true }) });

test.describe('BIG — Leaderboard (B!G-journey roster, per-participant metrics, status filter, side panel)', () => {
  test('BLD-01 lists only B!G-journey participants and computes each metric from its source docs', async ({ page }) => {
    await openLadder(page);
    await expect(page.locator('.bl-rows'), 'BLD-01: Active + Nonactive — the LYL-journey person is not listed').toHaveCount(2);
    await expect(row(page, W.names.other)).toHaveCount(0);

    const a = row(page, W.names.active);
    await expect(a.getByTestId('bld-row-attended'), 'BLD-01: one distinct B!G event attended (dup + non-B!G + approved excluded)').toHaveText('1');
    await expect(a.getByTestId('bld-row-activity'), 'BLD-01: 1 completed of 2 (the draft assignment\'s activity is not loaded)').toHaveText(/^\s*1\s*\/\s*2\s*$/);
    await expect(a.getByTestId('bld-row-studio'), 'BLD-01: two studio log docs').toHaveText('2');
    await expect(a.getByTestId('bld-row-eiflix'), 'BLD-01: one distinct complete eiflix video').toHaveText('1');
    await expect(a.getByTestId('bld-row-level'), 'BLD-01: no biglevel doc → Field Preparation').toContainText('Field Preparation');

    const n = row(page, W.names.nonActive);
    await expect(n.getByTestId('bld-row-attended'), 'BLD-01: an approved (not attended) request does not count').toHaveText('0');
    await expect(n.getByTestId('bld-row-activity')).toHaveText(/^\s*0\s*\/\s*0\s*$/);
  });

  test('BLD-02 the status buttons filter the table; Clear all resets search and status', async ({ page }) => {
    await openLadder(page);
    await page.getByTestId('bld-status-active').click();
    await expect(page.locator('.bl-rows'), 'BLD-02: Active → only the active participant').toHaveCount(1);
    await expect(row(page, W.names.active)).toHaveCount(1);
    await page.getByTestId('bld-status-nonactive').click();
    await expect(page.locator('.bl-rows'), 'BLD-02: Non Active → only the non-active participant').toHaveCount(1);
    await expect(row(page, W.names.nonActive)).toHaveCount(1);
    await page.getByTestId('bld-status-all').click();
    await expect(page.locator('.bl-rows')).toHaveCount(2);

    await expect(page.getByTestId('bld-chip-remove'), 'BLD-02: the search shows as a removable chip').toHaveCount(1);
    await page.getByTestId('bld-clear-all').click();
    await expect(page.getByTestId('bld-participant-search'), 'BLD-02: Clear all empties the search').toHaveValue('');
  });

  test('BLD-03 a participant opens the side panel; its tabs switch and Close dismisses it', async ({ page }) => {
    await openLadder(page);
    await row(page, W.names.active).getByTestId('bld-row-name').click();
    const panel = page.locator('.bl-sidebar');
    await expect(panel, 'BLD-03: the side panel opens on the participant').toContainText(W.names.active);
    await page.getByTestId('bld-side-tab-attended').click();
    await expect(page.getByTestId('bld-side-tab-attended')).toHaveClass(/active-sidetab/);
    await page.getByTestId('bld-side-tab-studio').click();
    await expect(page.getByTestId('bld-side-tab-studio')).toHaveClass(/active-sidetab/);
    await page.getByTestId('bld-side-tab-activity').click();
    await expect(page.getByTestId('bld-side-tab-activity')).toHaveClass(/active-sidetab/);
    await page.getByTestId('bld-side-tab-eiflix').click();
    await expect(page.getByTestId('bld-side-tab-eiflix')).toHaveClass(/active-sidetab/);
    await page.getByTestId('bld-side-tab-level').click();
    await expect(page.getByTestId('bld-side-tab-level')).toHaveClass(/active-sidetab/);
    await page.getByTestId('bld-side-close').click();
    await expect(panel, 'BLD-03: Close dismisses it').toHaveCount(0);
  });

  test.fixme('BLD-ADDR1 cohort, grouping, sort, paging and side-panel search hooks addressable (deferred behavioral)', async ({ page }) => {
    await page.goto('/big-leaderboard', { waitUntil: 'domcontentloaded' });
    for (const l of [
      page.getByTestId('bld-cohort-search'), page.getByTestId('bld-cat-educational'), page.getByTestId('bld-cat-studio'),
      page.getByTestId('bld-marathon-select'), page.getByTestId('bld-marathon-search'), page.getByTestId('bld-marathon-option'),
      page.getByTestId('bld-event-select'), page.getByTestId('bld-group'), page.getByTestId('bld-select-all'),
      page.getByTestId('bld-deselect-all'), page.getByTestId('bld-group-name'), page.getByTestId('bld-group-save'),
      page.getByTestId('bld-group-clear'), page.getByTestId('bld-cohort-group'), page.getByTestId('bld-group-rename'),
      page.getByTestId('bld-group-edit-save'), page.getByTestId('bld-group-expand'), page.getByTestId('bld-group-ungroup'),
      page.getByTestId('bld-group-add-cohort'), page.getByTestId('bld-group-remove-cohort'), page.getByTestId('bld-cohort'),
      page.getByTestId('bld-cohort-more'), page.getByTestId('bld-non-cohort'), page.getByTestId('bld-sort-impact'),
      page.getByTestId('bld-sort-attended'), page.getByTestId('bld-sort-studio'), page.getByTestId('bld-sort-activity'),
      page.getByTestId('bld-sort-eiflix'), page.getByTestId('bld-paginator'), page.getByTestId('bld-side-search-events'),
      page.getByTestId('bld-side-search-activity-atc'), page.getByTestId('bld-side-search-activities'),
      page.getByTestId('bld-side-pill-initiated'), page.getByTestId('bld-side-pill-review'), page.getByTestId('bld-side-pill-rework'),
      page.getByTestId('bld-side-pill-missed'), page.getByTestId('bld-side-pill-completed'), page.getByTestId('bld-side-search-content'),
    ]) expect(l).toBeTruthy();
  });
});
