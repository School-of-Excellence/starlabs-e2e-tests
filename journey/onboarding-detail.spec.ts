// onboarding-detail.spec.ts — /journeyonboardingdetail table render (REAL-UI, anti-circular).
//
// Recon: e2e/recon-allcomp/journey-products.md (JP-18 / JP-19).
//
// WHY THIS FILE EXISTS: the journey suite's `appPaths` glob already claimed
// `src/app/journey-onboarding-detail/**`, so a change there made the journey gate MANDATORY — but no spec
// ever opened the module's only route. The gate ran green while testing none of it. Third and last of the
// false-green modules found by scripts/check-route-coverage.mjs (after comms /channel-templates and
// content /content-upload-v2). The screen has no in-app nav link, which is why it went unnoticed.
//
// Anti-circularity: the table is built by loadTable() from a live
// collectionData('journeyonboardingdetail') stream (component ts:1218). JP-18 asserts the journey TITLE,
// which is NOT stored on the onboarding doc — the app can only produce it by dereferencing the row's
// `journeyref` into journey/{id} and reading `journey ?? name ?? title ?? type ?? id` (ts:1222-1230).
// JP-19 asserts the app's own FALLBACKS for a bare row. Neither case asserts a value the test wrote into
// the cell it reads.
//
// NOTE: the stream is UNFILTERED — every doc in the collection renders, including other runs'. Every
// assertion here is scoped to a seeded docid or title; none asserts a row count.
import { test, expect } from '@playwright/test';
import {
  journeyIds, journeyNames, installJourneyStubs, attachJourneyGuard, loginAsJourneyAdmin,
} from './support/journey';
import { assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc } from '../queue/support/firestore-admin';

/** Navigate to the screen and wait for the component the app mounts (not a bare URL check). */
async function openOnboardingDetail(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/journeyonboardingdetail', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/journeyonboardingdetail/, { timeout: 30_000 });
  await expect(
    page.locator('app-journey-onboarding-detail'),
    'journeyonboardingdetail must mount — if this fails on a correct URL, check that the route has a ' +
    'dashboard grant in seed-journey.js ROUTES (authGuard denies unlisted screens)',
  ).toBeVisible({ timeout: 30_000 });
}

/** The table row whose journey cell renders exactly `title`. */
const rowWithTitle = (page: import('@playwright/test').Page, title: string) =>
  page.locator('tr.dash-row').filter({
    has: page.locator('.row-link', { hasText: new RegExp(`^\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }),
  });

test.describe('Journey — /journeyonboardingdetail table (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachJourneyGuard(page);
    await installJourneyStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'onboarding-detail: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // JP-18 — the row's journey title is produced by the app DEREFERENCING journeyref
  // ===========================================================================================
  test('JP-18 the list resolves each row title by dereferencing journeyref', async ({ page }) => {
    // [PRECONDITION] Prove the seeded doc carries ONLY a reference — the rendered title string must not
    // exist anywhere on it. This is what makes the assertion below non-circular rather than a round-trip.
    const seeded = await getDoc('journeyonboardingdetail', journeyIds.JOD1);
    expect(seeded, 'JP-18 precondition: the seeded onboarding doc must exist').toBeTruthy();
    expect(seeded?.journeyref, 'JP-18 precondition: the doc must carry a journeyref').toBeTruthy();
    expect(
      JSON.stringify(seeded ?? {}),
      `JP-18 precondition: the journey title "${journeyNames.journey1}" must NOT be stored on the ` +
      'onboarding doc — otherwise the render below would prove nothing',
    ).not.toContain(journeyNames.journey1);

    await loginAsJourneyAdmin(page);
    await openOnboardingDetail(page);

    // [ASSERT] loadTable() followed journeyref into journey/J1 and read `journey` off it. The app performed
    // a lookup the test never did; the string comes from a DIFFERENT document than the one that produced
    // the row.
    await expect(
      rowWithTitle(page, journeyNames.journey1),
      `JP-18: the row must render the journey title "${journeyNames.journey1}" resolved via journeyref`,
    ).toBeVisible({ timeout: 30_000 });
  });

  // ===========================================================================================
  // JP-19 — a bare row renders the app's OWN fallbacks (docid as title, '—' for audit cells)
  // ===========================================================================================
  test('JP-19 a row with no journeyref falls back to the docid and renders the app dashes', async ({ page }) => {
    // [PRECONDITION] The bare doc must exist AND must genuinely lack the fields whose fallbacks we assert.
    // Without this the case could pass because the doc was never seeded at all.
    const bare = await getDoc('journeyonboardingdetail', journeyIds.JOD2);
    expect(bare, 'JP-19 precondition: the bare onboarding doc must exist').toBeTruthy();
    expect(bare?.journeyref, 'JP-19 precondition: the bare doc must have NO journeyref').toBeFalsy();
    expect(bare?.lastUpdated, 'JP-19 precondition: the bare doc must have NO lastUpdated').toBeFalsy();

    await loginAsJourneyAdmin(page);
    await openOnboardingDetail(page);

    // [ASSERT 1] With no ref to resolve, loadTable() leaves journeyTitle at its initial value — the docid
    // (component ts:1220). That default is the COMPONENT's choice, not seeded data.
    const row = rowWithTitle(page, journeyIds.JOD2);
    await expect(
      row,
      `JP-19: the bare row must fall back to rendering its docid "${journeyIds.JOD2}" as the title`,
    ).toBeVisible({ timeout: 30_000 });

    // [ASSERT 2] `lastUpdated ?? '—'` / `updatedBy ?? '—'` (ts:1244-1245) — the em-dash is authored by the
    // component; the seed wrote neither field.
    expect(
      await row.innerText(),
      'JP-19: the bare row must render the app\'s em-dash placeholder for the empty audit fields',
    ).toContain('—');
  });
});
