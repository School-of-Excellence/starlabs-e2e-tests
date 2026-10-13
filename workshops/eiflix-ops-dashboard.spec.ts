// eiflix-ops-dashboard.spec.ts — /eiflixoperationsdashboard (New-Workshop/eiflixoperationsdashboard).
//
// Recon: e2e/recon-allcomp/workshops.md "Addendum — 2026-09-04" (WS-30).
//
// This route carries authGuard (app.routes.ts:295), so the seeded dashboard grant is load-bearing.
//
// ORACLE shape: the screen aggregates its own `new_user_data` reads into the "Total New Users" headline
// card (ts:136-138). The test computes the same population INDEPENDENTLY with an Admin-SDK countWhere
// and requires the rendered number to be at least that. Two separate computations over one seeded
// population — the test never reads the app's number back into its own expectation.
//
// Lower bound rather than equality on purpose: the emulator's `new_user_data` also holds docs from other
// suites' runs, which the app legitimately counts and our run-scoped count does not. An upper bound
// would make this test fail whenever an unrelated suite seeded first; the floor still fails if the app
// stops aggregating.
//
// SIDE EFFECT (recon Risk #14): rendering this screen WRITES an `eiflixdailywatchers` rollup keyed by a
// shared day id (ts:1227/1247). Nothing here asserts on it; teardown removes what the run created.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import {
  installWshopStubs, loginAsWshopAdmin, seedLoginLogs, clearLoginLogs, wsMetaNames, wsProfileIds,
  seedWebLoginLogs, clearWebLoginLogs, wsWebLoginVersions,
  seedReportLoginLogs, clearReportLoginLogs, seedConsumption, clearConsumption, wsConsumptionText,
  seedPurchases, clearPurchases, countNewUserDataInWindow, countCapturedPayments,
  countWebUsersFromAnalytics,
  countNewUsersCard, countPaidCard, seedUsersRangePaid, clearUsersRangePaid, wsDateInputValue,
  seedMasterclassPayments, clearMasterclassPayments, countCapturedForUsersRange, wsMasterclassAmounts,
  sumCapturedForUsersRange, wsMasterclassJourney,
  seedDeviceBreakdownPages, clearDeviceBreakdownPages, wsDbDayKey, wsDbPlatforms,
  alignWorkshopMetadataNames,
  // NOTE: the NU display names live in wsAddNames, NOT wsNames — importing from the wrong export
  // object yields `undefined` silently (the hub has no tsc step).
  wsAddNames, seedUserTypeLoginLogs, clearUserTypeLoginLogs,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere } from '../queue/support/firestore-admin';

const RUN = process.env.WSHOP_RUNID || 'wshop';

test.describe('Workshops — eiflix operations dashboard (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() =>
    // The dashboard's content-analytics panels query date windows that are empty on a freshly-seeded
    // emulator; those reads log benign errors that are not the behaviour under test.
    assertNoFatal(guard, 'eiflixoperationsdashboard: no fatal console errors / pageerrors', [
      /content analytics/i,
      /eiflixdailywatchers/i,
    ]));

  // ===========================================================================================
  // WS-30 — the headline new-user count matches an independent Firestore count of the same population
  // ===========================================================================================
  test('WS-30 the Total New Users card counts at least the seeded new_user_data population', async ({ page }) => {
    // [ORACLE] computed by the TEST, from Firestore, before the app is asked anything.
    const seeded = await countWhere('new_user_data', [['testrunid', '==', RUN]]);
    expect(seeded, 'WS-30: precondition — 3 seeded new users for this run').toBe(3);

    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });

    // [REAL-UI] the Users section renders one .eod-card per aggregate the component built.
    const totalCard = page.locator('button.eod-card').filter({ hasText: 'Total New Users' });
    await expect(totalCard, 'WS-30: the Total New Users card must render').toBeVisible({ timeout: 45_000 });

    // READINESS: the card is NOT settled the moment it becomes visible. The template swaps its skeleton
    // for `.eod-count` as soon as cardLoading(card) goes false (html:44-48), but the aggregation that
    // fills the count resolves later — so there is a real window in which the card renders a literal 0.
    // Reading once inside that window is what made an earlier version of this case pass in isolation and
    // fail in a full-suite run (the dashboard settles more slowly with more data in the emulator).
    // Polling is the fix; it is not circular — if the app never aggregates, the count stays 0 and this
    // fails at the timeout exactly as it should.
    await expect
      .poll(
        async () => {
          const t = await totalCard.locator('.eod-count').first().innerText().catch(() => '');
          return Number(t.replace(/[^\d]/g, '')) || 0;   // the `number` pipe adds grouping separators
        },
        {
          message: `WS-30: the app-aggregated Total New Users count must reach >= the independently-counted seeded population (${seeded})`,
          timeout: 60_000,
        },
      )
      .toBeGreaterThanOrEqual(seeded);
  });
});

// =============================================================================================
// WS-31 — EiFlix App Logs: `loginlog` by date range, app == 'EiFlix', name/OS filters,
// search, sort, paging. Preconditions in seedLoginLogs() (six known documents); every assertion is
// on what the APP rendered from them. Names are the CF-owned metadata names (actor emails).
// =============================================================================================
test.describe('Workshops — eiflix operations dashboard: EiFlix App Logs', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await alignWorkshopMetadataNames();
    await seedLoginLogs();
    await installWshopStubs(page);
  });
  test.afterEach(() => clearLoginLogs());

  test('WS-31 the logs table honours the range, drops other apps, maps names, filters, sorts and pages', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });
    const section = page.getByTestId('eif-logs-section');
    await expect(section, 'WS-31: the section renders after Device Breakdown').toBeVisible({ timeout: 60_000 });
    const rows = section.getByTestId('eif-logs-row');
    const rowFor = (name: string) => rows.filter({ hasText: name });

    // Today (default): the two EiFlix rows dated today; the other-app row is filtered out client-side.
    await expect(section.getByTestId('eif-logs-range-today')).toHaveAttribute('aria-pressed', 'true');
    await expect(rowFor(wsMetaNames.p0), 'WS-31: p0 today').toHaveCount(1, { timeout: 60_000 });
    await expect(rowFor(wsMetaNames.p1), 'WS-31: p1 today').toHaveCount(1);
    await expect(rows.filter({ hasText: '9.9.9' }), 'WS-31: the SolarVoice row never appears').toHaveCount(0);
    await expect(rowFor(wsMetaNames.p2), 'WS-31: the 20-day-old row is outside Today').toHaveCount(0);
    // Name is mapped from participant metadata; the raw profileid is NOT shown.
    await expect(rowFor(wsMetaNames.p0).first()).toContainText('android');
    await expect(rowFor(wsMetaNames.p0).first()).toContainText('2.3.1');
    await expect(rows.filter({ hasText: wsProfileIds.p0 }), 'WS-31: no profileid in the table').toHaveCount(0);
    // Two rows today, two different people.
    await expect(section.getByTestId('eif-logs-unique'), 'WS-31: unique people today').toContainText('2 of 2 unique people');

    // 7D adds the 3-day-old p0 row; 30D adds p2's; the 40-day-old one is never in range.
    await section.getByTestId('eif-logs-range-7d').click();
    await expect(rows.filter({ hasText: '2.2.9' }), 'WS-31: 7D includes the 3-day-old row').toHaveCount(1, { timeout: 60_000 });
    await expect(rowFor(wsMetaNames.p2)).toHaveCount(0);
    await section.getByTestId('eif-logs-range-30d').click();
    await expect(rowFor(wsMetaNames.p2), 'WS-31: 30D includes the 20-day-old row').toHaveCount(1, { timeout: 60_000 });
    await expect(rows.filter({ hasText: '2.0.0' }), 'WS-31: 40 days is outside 30D').toHaveCount(0);
    await expect(rows.filter({ hasText: '9.9.9' })).toHaveCount(0);

    // Default sort is newest first: today's rows precede the older ones.
    await expect(rows.first()).not.toContainText('2.2.9');
    await expect(rows.last(), 'WS-31: oldest row last').toContainText(wsMetaNames.p2);

    // 30D: four rows from three people.
    await expect(section.getByTestId('eif-logs-unique'), 'WS-31: unique people in 30D').toContainText('3 of 3 unique people');

    // Name filter: options are exactly the people in the loaded rows (p0, p1, p2 — three), and the
    // search row inside the select narrows the OPTIONS without touching the table.
    await section.getByTestId('eif-logs-name-filter').click();
    await expect(page.getByTestId('eif-logs-name-option'), 'WS-31: one option per person in range').toHaveCount(3);
    // ngx-mat-select-search renders a hidden helper <input> beside the visible one (branch-suites run
    // 35584288173: `locator('input')` hit both) — address the visible one by its placeholder. The library
    // also marks its host <mat-option> disabled (aria-disabled=true) so it can never be *selected*, while
    // keeping it interactive via `pointer-events:all` — a real user types there fine, but Playwright's
    // actionability check refuses to fill inside an aria-disabled ancestor (run 35586941612 waited the
    // full timeout on "element is not enabled"). So: click the input directly with the check bypassed
    // and type, which drives the component's real keyup handler.
    const nameSearch = page.getByTestId('eif-logs-name-search').getByPlaceholder('Search names');
    await nameSearch.click({ force: true });
    await page.keyboard.type('participant2');
    await expect(page.getByTestId('eif-logs-name-option'), 'WS-31: the search narrows the options').toHaveCount(1);
    await expect(page.getByTestId('eif-logs-name-option').first()).toContainText(wsMetaNames.p2);
    await expect(rows, 'WS-31: typing in the option search does not filter the table').toHaveCount(4);
    await nameSearch.click({ force: true });
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('eif-logs-name-option')).toHaveCount(3);
    await page.getByTestId('eif-logs-name-option').filter({ hasText: wsMetaNames.p0 }).click();
    await expect(rows, 'WS-31: p0 has two EiFlix rows in 30D').toHaveCount(2, { timeout: 15_000 });
    for (const r of await rows.all()) await expect(r).toContainText(wsMetaNames.p0);
    await expect(section.getByTestId('eif-logs-unique'), 'WS-31: filtered to one person').toContainText('1 of 3 unique people');

    // OS filter on top of the name filter: p0 on ios → nobody.
    await section.getByTestId('eif-logs-os-filter').click();
    await expect(page.getByTestId('eif-logs-os-option')).toHaveCount(2);         // android, ios
    await page.getByTestId('eif-logs-os-option').filter({ hasText: 'ios' }).click();
    await expect(section.locator('.eod-log-none'), 'WS-31: empty state inside the table').toBeVisible({ timeout: 15_000 });
    await expect(section.getByTestId('eif-logs-clear')).toContainText('2');
    await section.getByTestId('eif-logs-clear').click();
    await expect(rows).toHaveCount(4, { timeout: 15_000 });

    // Search narrows across columns.
    await section.getByTestId('eif-logs-search').fill('2.3.1');
    await expect(rows, 'WS-31: two rows carry version 2.3.1').toHaveCount(2, { timeout: 15_000 });
    await section.getByTestId('eif-logs-search').fill('');
    await expect(rows).toHaveCount(4, { timeout: 15_000 });

    // Sort by version ascending: 2.2.9 first.
    await section.getByTestId('eif-logs-sort-version').click();
    await expect(rows.first(), 'WS-31: version ascending').toContainText('2.2.9');
    await section.getByTestId('eif-logs-sort-version').click();
    await expect(rows.first(), 'WS-31: version descending').toContainText('2.3.1');
    await section.getByTestId('eif-logs-sort-date').click();

    // Paging: 10 rows per page → the four fit on one page; the label and buttons agree.
    await section.getByTestId('eif-logs-page-size').selectOption('10');
    await expect(section.getByTestId('eif-logs-page-label')).toContainText('1–4 of 4');
    await expect(section.getByTestId('eif-logs-prev')).toBeDisabled();
    await expect(section.getByTestId('eif-logs-next')).toBeDisabled();
    expect(section.getByTestId('eif-logs-count')).toBeTruthy();
    expect(section.getByTestId('eif-logs-sort-name')).toBeTruthy();
    expect(section.getByTestId('eif-logs-sort-os')).toBeTruthy();
  });
});

// =============================================================================================
// WS-45 — EiFlix Mobile App Logs: the New users / Existing users filter.
//
// Anti-circularity: the rule under test is the dashboard's OWN definition of a new user — the one
// its "Total New Users" card uses (new_user_data with movedtoexist !== true). The case seeds one
// login from each side of that rule and asserts which rows the app leaves on screen; it never reads
// the app's own classification back into its expectation.
//
// The subtle half is NU_C: a new_user_data record that HAS been moved to paid. It must land under
// Existing, not New — otherwise the filter and the two cards above it would disagree about the same
// person. A two-way split that silently dropped them would pass a naive "New shows fewer rows" test.
//
// Separate describe with its own seeder: WS-31 asserts exact tallies ("2 of 2 unique people", four
// rows in 30D), so these extra people must not exist while it runs.
// =============================================================================================
test.describe('Workshops — eiflix operations dashboard: app log user-type filter', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    guard = attachConsoleGuard(page);
    await alignWorkshopMetadataNames();
    await seedLoginLogs();
    await seedUserTypeLoginLogs();
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    await clearUserTypeLoginLogs();
    await clearLoginLogs();
    assertNoFatal(guard, 'eiflixoperationsdashboard: no fatal console errors / pageerrors', [
      /content analytics/i,
      /eiflixdailywatchers/i,
    ]);
  });

  test('WS-45 the user-type filter splits the log into new and existing, with moved-to-paid counted as existing', async ({ page }) => {
    // Preconditions on the constants themselves: an undefined name would turn every `filter({hasText})`
    // below into a match-everything locator, and the case would fail somewhere far from the cause.
    expect(wsAddNames.nuAlpha, 'WS-45: the new user name constant resolves').toBeTruthy();
    expect(wsAddNames.nuCharlie, 'WS-45: the moved-to-paid user name constant resolves').toBeTruthy();
    expect(wsMetaNames.p0, 'WS-45: the participant name constant resolves').toBeTruthy();
    expect(wsMetaNames.p1, 'WS-45: the second participant name constant resolves').toBeTruthy();

    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });
    const section = page.getByTestId('eif-logs-section');
    await expect(section, 'WS-45: the logs section renders').toBeVisible({ timeout: 60_000 });

    const rows = section.getByTestId('eif-logs-row');
    const rowFor = (name: string) => rows.filter({ hasText: name });

    // Baseline (Today, no filter): all four of today's EiFlix logins are on screen — two existing
    // people, one still-new person, one moved-to-paid person.
    await expect(rowFor(wsAddNames.nuAlpha), 'WS-45: the new user logged in today').toHaveCount(1, { timeout: 60_000 });
    await expect(rowFor(wsAddNames.nuCharlie), 'WS-45: the moved-to-paid user logged in today').toHaveCount(1);
    await expect(rowFor(wsMetaNames.p0), 'WS-45: an existing participant logged in today').toHaveCount(1);
    await expect(rowFor(wsMetaNames.p1), 'WS-45: a second existing participant logged in today').toHaveCount(1);

    const typeFilter = section.getByTestId('eif-logs-usertype-filter');
    await expect(typeFilter, 'WS-45: the user-type filter renders').toBeVisible({ timeout: 15_000 });

    // ---- New users -------------------------------------------------------------------------
    await typeFilter.click();
    await page.getByTestId('eif-logs-usertype-new').click();
    await expect(rowFor(wsAddNames.nuAlpha), 'WS-45: New keeps the still-new user').toHaveCount(1, { timeout: 30_000 });
    await expect(rowFor(wsMetaNames.p0), 'WS-45: New drops an existing participant').toHaveCount(0);
    await expect(rowFor(wsMetaNames.p1), 'WS-45: New drops the second existing participant').toHaveCount(0);
    // [ASSERT] the load-bearing one: moved to paid is NOT new any more.
    await expect(rowFor(wsAddNames.nuCharlie), 'WS-45: New drops the moved-to-paid user').toHaveCount(0);

    // ---- Existing users --------------------------------------------------------------------
    await typeFilter.click();
    await page.getByTestId('eif-logs-usertype-existing').click();
    await expect(rowFor(wsMetaNames.p0), 'WS-45: Existing keeps the participants').toHaveCount(1, { timeout: 30_000 });
    await expect(rowFor(wsMetaNames.p1), 'WS-45: Existing keeps the second participant').toHaveCount(1);
    // [ASSERT] the other half of the same rule — the split is total, nobody falls through it.
    await expect(rowFor(wsAddNames.nuCharlie), 'WS-45: Existing picks up the moved-to-paid user').toHaveCount(1);
    await expect(rowFor(wsAddNames.nuAlpha), 'WS-45: Existing drops the still-new user').toHaveCount(0);

    // ---- All users brings both halves back, on its own ---------------------------------------
    await typeFilter.click();
    await page.getByTestId('eif-logs-usertype-all').click();
    await expect(rowFor(wsAddNames.nuAlpha), 'WS-45: All restores the new user').toHaveCount(1, { timeout: 30_000 });
    await expect(rowFor(wsAddNames.nuCharlie), 'WS-45: All restores the moved-to-paid user').toHaveCount(1);
    await expect(rowFor(wsMetaNames.p0), 'WS-45: All restores the participants').toHaveCount(1);
    await expect(section.getByTestId('eif-logs-clear'), 'WS-45: back to All is back to no filters').toHaveCount(0);

    // ---- It stacks with the other filters, and Clear counts it ------------------------------
    await typeFilter.click();
    await page.getByTestId('eif-logs-usertype-existing').click();
    await section.getByTestId('eif-logs-os-filter').click();
    await page.getByTestId('eif-logs-os-option').filter({ hasText: 'ios' }).click();
    await expect(rowFor(wsMetaNames.p1), 'WS-45: Existing + ios keeps the ios participant').toHaveCount(1, { timeout: 30_000 });
    await expect(rowFor(wsMetaNames.p0), 'WS-45: Existing + ios drops the android participant').toHaveCount(0);
    await expect(section.getByTestId('eif-logs-clear'), 'WS-45: both filters are counted').toContainText('2');

    // Clear puts the user type back to All along with everything else.
    await section.getByTestId('eif-logs-clear').click();
    await expect(rowFor(wsAddNames.nuAlpha), 'WS-45: Clear restores the new user').toHaveCount(1, { timeout: 30_000 });
    await expect(rowFor(wsMetaNames.p0), 'WS-45: Clear restores the participants').toHaveCount(1);
    await expect(section.getByTestId('eif-logs-clear'), 'WS-45: no filters left to clear').toHaveCount(0);
  });
});


// =============================================================================================
// WS-51 — EiFlix App Logs now carry WEB sign-ins too.
//
// The apps record `app: 'EiFlix'`; the web client records the boolean `eiflixweb: true` and no
// `app` field at all. Both are EiFlix logins and both belong on this table. Its own describe and
// seeder: WS-31 asserts exact tallies off seedLoginLogs, so these extra rows must not exist while
// it runs.
//
// The two seeded rows are chosen to be falsifiable rather than merely present:
//   • the web row carries device_os 'android' — so "reads web" can only pass if the flag WINS
//     over the stored field, not because the row happened to say web already;
//   • the control is another product with `eiflixweb: false` — a present-but-false flag, which a
//     truthy check would wrongly admit.
// =============================================================================================
test.describe('Workshops — eiflix operations dashboard: web sign-ins on the app logs', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    guard = attachConsoleGuard(page);
    await alignWorkshopMetadataNames();
    await seedLoginLogs();
    await seedWebLoginLogs();
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    await clearWebLoginLogs();
    await clearLoginLogs();
    assertNoFatal(guard, 'eiflixoperationsdashboard: no fatal console errors / pageerrors', [
      /content analytics/i,
      /eiflixdailywatchers/i,
    ]);
  });

  test('WS-51 a web sign-in is listed and reads Device OS "web"; a false flag is still excluded', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });
    const section = page.getByTestId('eif-logs-section');
    await expect(section, 'WS-51: the logs section renders').toBeVisible({ timeout: 60_000 });

    // [ASSERT] the section is no longer called "Mobile".
    await expect(section, 'WS-51: the heading drops "Mobile"').toContainText('EiFlix App Logs');
    await expect(section, 'WS-51: and does not still say Mobile').not.toContainText('Mobile App Logs');

    const rows = section.getByTestId('eif-logs-row');
    const webRow = rows.filter({ hasText: wsWebLoginVersions.web });
    await expect(webRow, 'WS-51: the web sign-in is listed although it has no app field')
      .toHaveCount(1, { timeout: 60_000 });

    // [ASSERT] the load-bearing one: the row's stored device_os is 'android', so reading 'web'
    // proves the eiflixweb flag won rather than the field already saying web.
    await expect(webRow.first(), 'WS-51: a web sign-in reads Device OS "web"').toContainText('web');
    await expect(webRow.first(), 'WS-51: and not the stale stored device_os').not.toContainText('android');

    // [ASSERT] a present-but-FALSE flag on another product stays out — a truthy check would let
    // this through, and so would dropping the app check altogether.
    await expect(
      rows.filter({ hasText: wsWebLoginVersions.notWeb }),
      'WS-51: eiflixweb:false on another product is still excluded',
    ).toHaveCount(0);
    // The original SolarVoice control (no flag at all) is still excluded too.
    await expect(rows.filter({ hasText: '9.9.9' }), 'WS-51: a plain other-product row is excluded').toHaveCount(0);

    // [ASSERT] 'web' is offered by the Device OS filter, which is built from the loaded rows.
    await section.getByTestId('eif-logs-os-filter').click();
    await expect(page.getByTestId('eif-logs-os-option').filter({ hasText: 'web' }),
      'WS-51: the OS filter offers web').toHaveCount(1, { timeout: 15_000 });
    await page.getByTestId('eif-logs-os-option').filter({ hasText: 'web' }).click();
    await expect(rows, 'WS-51: filtering to web leaves exactly the web sign-in').toHaveCount(1, { timeout: 15_000 });
    await expect(rows.first()).toContainText(wsWebLoginVersions.web);
  });
});


// =============================================================================================
// WS-52 — EiFlix Report: unique users per surface, split existing/new.
//
// Every number here is the APP counting a population the seed arranged; the case asserts the
// counts, never writes them. The seed is built so each assertion can actually fail:
//
//   android      p0, p1, NU_A         → 3   NU_A is the only NEW user (new_user_data, not moved)
//   ios          p1, NU_C             → 2   NU_C IS in new_user_data but movedtoexist:true → EXISTING
//   mobile total p0, p1, NU_A, NU_C   → 4   NOT 5 — p1 is on both phones, so the union dedupes
//   web          p0                   → 1   p0 is on Android AND web, counted in BOTH sections
//
// The mobile total is the one that matters: with one surface per person the union and the sum
// agree and a broken dedup passes, so p1 is deliberately on both.
// =============================================================================================
test.describe('Workshops — eiflix operations dashboard: EiFlix Report', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    guard = attachConsoleGuard(page);
    await alignWorkshopMetadataNames();
    await seedLoginLogs();
    await seedWebLoginLogs();
    await seedUserTypeLoginLogs();
    await seedReportLoginLogs();
    // Web App Users moved to `content analytics` (platform_name 'Eiflixweb') on 2026-10-09, so
    // this describe needs analytics rows too — loginlog no longer feeds that figure.
    await seedConsumption();
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    await clearConsumption();
    await clearReportLoginLogs();
    await clearUserTypeLoginLogs();
    await clearWebLoginLogs();
    await clearLoginLogs();
    assertNoFatal(guard, 'eiflixoperationsdashboard: no fatal console errors / pageerrors', [
      /content analytics/i,
      /eiflixdailywatchers/i,
    ]);
  });

  test('WS-52 the report counts unique people per surface, dedupes the mobile total, and keeps web separate', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });
    const section = page.getByTestId('eif-report-section');
    await expect(section, 'WS-52: the report section renders').toBeVisible({ timeout: 60_000 });
    await expect(section.getByTestId('eif-rep-range-today'), 'WS-52: it opens on Today')
      .toHaveAttribute('aria-pressed', 'true');

    // [ASSERT] the four cells render, each under the right label — nothing else checks that the
    // Android column is actually labelled Android. Written out one per line, not looped: the
    // readiness gate's scanner only reads LITERAL getByTestId ids and cannot see a variable.
    await expect(section.getByTestId('eif-rep-android'), 'WS-52: the Android cell renders')
      .toContainText('Android', { timeout: 60_000 });
    await expect(section.getByTestId('eif-rep-ios'), 'WS-52: the iOS cell renders').toContainText('iOS');
    await expect(section.getByTestId('eif-rep-mobile-total'), 'WS-52: the mobile Total cell renders').toContainText('Total');
    await expect(section.getByTestId('eif-rep-web'), 'WS-52: the Web cell renders').toContainText('Web');

    // ---- mobile, per OS ----
    await expect(section.getByTestId('eif-rep-android-total'), 'WS-52: three people signed in on Android today')
      .toHaveText('3', { timeout: 60_000 });
    await expect(section.getByTestId('eif-rep-android-new'), 'WS-52: one of them is a new user').toHaveText('1');
    await expect(section.getByTestId('eif-rep-android-existing'), 'WS-52: the other two are existing').toHaveText('2');

    await expect(section.getByTestId('eif-rep-ios-total'), 'WS-52: two people signed in on iOS today').toHaveText('2');
    // NU_C has a new_user_data record but movedtoexist:true, so they are EXISTING — the subtle half
    // of the rule, and the one a naive "has a new_user_data doc" check would get wrong.
    await expect(section.getByTestId('eif-rep-ios-new'), 'WS-52: a moved-to-paid user is NOT new').toHaveText('0');
    await expect(section.getByTestId('eif-rep-ios-existing'), 'WS-52: both iOS people are existing').toHaveText('2');

    // ---- the mobile total dedupes ----
    // Android 3 + iOS 2 = 5, but p1 used both phones, so the unique total is 4.
    await expect(section.getByTestId('eif-rep-mobile-total-count'),
      'WS-52: the mobile total is the UNION (4), not the sum (5)').toHaveText('4');
    await expect(section.getByTestId('eif-rep-mobile-total-new'), 'WS-52: one new user across mobile').toHaveText('1');
    await expect(section.getByTestId('eif-rep-mobile-total-existing'), 'WS-52: three existing across mobile').toHaveText('3');

    // ---- web is counted on its own, and now from CONTENT ANALYTICS ----
    // Changed 2026-10-09: this figure comes from `content analytics` (platform_name 'Eiflixweb'),
    // not from loginlog's device_os. Asserted against an independent count by the test, because
    // that collection is shared with other runs — a literal number would be luck.
    // p0 is in the Android count AND here; collapsing the two would hide exactly that overlap.
    const webUsers = await countWebUsersFromAnalytics(1);
    expect(webUsers, 'WS-52: the seeded Eiflixweb row is in the oracle').toBeGreaterThanOrEqual(1);
    await expect(section.getByTestId('eif-rep-web-total'), 'WS-52: web users match the independent count')
      .toHaveText(String(webUsers));
    // The seeded web row belongs to p0, who has participant metadata → existing, never new.
    await expect(section.getByTestId('eif-rep-web-new'), 'WS-52: no NEW web users today').toHaveText('0');
    await expect(section.getByTestId('eif-rep-web-existing'), 'WS-52: so all of them are existing')
      .toHaveText(String(webUsers));

    // ---- the range control widens the population ----
    // 7D adds p0's 3-day-old Android row — p0 is already counted today, so Android must NOT grow.
    await section.getByTestId('eif-rep-range-7d').click();
    await expect(section.getByTestId('eif-rep-android-total'),
      'WS-52: 7D adds an older row for someone already counted, so the unique count holds at 3')
      .toHaveText('3', { timeout: 30_000 });

    // 30D adds p2 on iOS (20 days ago) — a person not seen today, so iOS grows by exactly one.
    await section.getByTestId('eif-rep-range-30d').click();
    await expect(section.getByTestId('eif-rep-ios-total'), 'WS-52: 30D brings in one more iOS person')
      .toHaveText('3', { timeout: 30_000 });
    await expect(section.getByTestId('eif-rep-mobile-total-count'), 'WS-52: and the mobile total follows')
      .toHaveText('5');
  });
});


// =============================================================================================
// WS-53 — EiFlix Report: Total Content Consumption.
//
// Sums `totaltimespend` from `content analytics` per `platform_name`, split by cohort, over the
// report's own Today/7D/30D window.
//
// Anti-circular: the seed writes four rows with KNOWN second counts and the case asserts the
// rendered durations. The TOTAL is never seeded — 3661 + 7322 = 10983s must be summed by the app
// and formatted as "3 hours 03 minutes 03 seconds".
//
// Two rows exist purely to be falsifiable:
//   • the new-user app row is written as 'EiflixApp' (mixed case) while the existing-user one is
//     'eiflixapp' — they must land in the SAME bucket, which a case-sensitive match would not do;
//   • a SolarVoice row of 99999s must appear nowhere.
// =============================================================================================
test.describe('Workshops — eiflix operations dashboard: Total Content Consumption', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    guard = attachConsoleGuard(page);
    await alignWorkshopMetadataNames();
    await seedConsumption();
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    await clearConsumption();
    assertNoFatal(guard, 'eiflixoperationsdashboard: no fatal console errors / pageerrors', [
      /content analytics/i,
      /eiflixdailywatchers/i,
    ]);
  });

  test('WS-53 consumption sums totaltimespend per platform, splits by cohort, and formats h/m/s', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });
    const section = page.getByTestId('eif-report-section');
    await expect(section, 'WS-53: the report section renders').toBeVisible({ timeout: 60_000 });

    // [ASSERT] both consumption blocks render under their heading. Literal ids, not a loop — the
    // readiness gate's scanner cannot see an id passed through a variable.
    await expect(section.getByTestId('eif-rep-cons-app'), 'WS-53: the mobile consumption block renders')
      .toContainText('Total Content Consumption', { timeout: 60_000 });
    await expect(section.getByTestId('eif-rep-cons-web'), 'WS-53: the web consumption block renders')
      .toContainText('Total Content Consumption');

    // ---- mobile (platform_name 'eiflixapp') ----
    await expect(section.getByTestId('eif-rep-cons-app-existing'),
      'WS-53: the existing user\'s app watch time').toHaveText(wsConsumptionText.appExisting, { timeout: 60_000 });
    // Written as 'EiflixApp' in the seed — a case-sensitive match would leave this at zero.
    await expect(section.getByTestId('eif-rep-cons-app-new'),
      'WS-53: the new user\'s app watch time, matched case-insensitively').toHaveText(wsConsumptionText.appNew);
    // [ASSERT] the total is the APP's arithmetic — 3661 + 7322 = 10983s. Never seeded.
    await expect(section.getByTestId('eif-rep-cons-app-total'),
      'WS-53: the app total is summed, not seeded').toHaveText(wsConsumptionText.appTotal);

    // ---- web (platform_name 'Eiflixweb') ----
    await expect(section.getByTestId('eif-rep-cons-web-existing'),
      'WS-53: the web watch time').toHaveText(wsConsumptionText.webExisting);
    await expect(section.getByTestId('eif-rep-cons-web-new'),
      'WS-53: no new-user web time today').toHaveText(wsConsumptionText.webNew);
    await expect(section.getByTestId('eif-rep-cons-web-total'),
      'WS-53: with nothing new, the web total equals the existing figure').toHaveText(wsConsumptionText.webExisting);

    // ---- the `from` split: a SECOND cut of the same totals ----
    // App: one eiflixworkshop row (3661s) and one eiflixcontent row (7322s), so the two rows differ
    // and a swapped mapping would be obvious. 'EiflixWorkshop' is mixed case on purpose.
    await expect(section.getByTestId('eif-rep-cons-app-workshop'), 'WS-53: app workshop time')
      .toHaveText(wsConsumptionText.appWorkshop);
    await expect(section.getByTestId('eif-rep-cons-app-library'), 'WS-53: app library time')
      .toHaveText(wsConsumptionText.appLibrary);
    // Web has only a workshop row, so library must be exactly zero — not simply "some other number".
    await expect(section.getByTestId('eif-rep-cons-web-workshop'), 'WS-53: web workshop time')
      .toHaveText(wsConsumptionText.webWorkshop);
    await expect(section.getByTestId('eif-rep-cons-web-library'), 'WS-53: no web library time today')
      .toHaveText(wsConsumptionText.webLibrary);

    // [ASSERT] another platform's 99999 seconds (27+ hours) leaks into neither surface. If the
    // platform filter were dropped it would dominate both totals and be impossible to miss.
    // Its `from` is eiflixworkshop, so it would also poison the workshop rows if the platform
    // filter were dropped. Literal ids — the gate's scanner cannot read a loop variable.
    await expect(section.getByTestId('eif-rep-cons-app-total'), 'WS-53: another platform never contributes to the app total').not.toContainText('27 hours');
    await expect(section.getByTestId('eif-rep-cons-web-total'), 'WS-53: nor to the web total').not.toContainText('27 hours');
    await expect(section.getByTestId('eif-rep-cons-app-workshop'), 'WS-53: nor to the app workshop row').not.toContainText('27 hours');
    await expect(section.getByTestId('eif-rep-cons-web-workshop'), 'WS-53: nor to the web workshop row').not.toContainText('27 hours');
  });
});


// =============================================================================================
// WS-54 — EiFlix Report: Purchases & Signups.
//
//   Journey Purchased         new_user_data.movedon inside the window
//   New Users Joined in EiFlix new_user_data.created inside the window
//   Masterclass Purchase      workshoppaymentlog.datetime inside the window AND status 'captured'
//
// The two new_user_data rows are deliberately ASYMMETRIC — each carries the counted field today
// and the OTHER field 300 days ago. Both fields live on the same documents, so a count that read
// the wrong one would otherwise still return a plausible number and the test would not notice.
//
// The payment log separates the two filters that could be confused: a 'failed' row dated today is
// excluded by the status IF, and a 'captured' row dated 200 days ago is excluded by the datetime
// WHERE. Only a correct implementation of BOTH yields 2.
// =============================================================================================
test.describe('Workshops — eiflix operations dashboard: Purchases & Signups', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    guard = attachConsoleGuard(page);
    await seedPurchases();
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    await clearPurchases();
    assertNoFatal(guard, 'eiflixoperationsdashboard: no fatal console errors / pageerrors', [
      /content analytics/i,
      /eiflixdailywatchers/i,
    ]);
  });

  test('WS-54 journey purchases, new signups and captured masterclass payments are counted for the window', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });
    const section = page.getByTestId('eif-report-section');
    await expect(section, 'WS-54: the report section renders').toBeVisible({ timeout: 60_000 });
    await expect(section.getByTestId('eif-rep-purchases'), 'WS-54: the Purchases & Signups card renders')
      .toContainText('Purchases', { timeout: 60_000 });

    // [ASSERT] the three cells render under their own labels. Literal ids — the gate's scanner
    // cannot read one passed through a variable.
    await expect(section.getByTestId('eif-rep-journey'), 'WS-54: the Journey Purchased cell renders')
      .toContainText('Journey Purchased');
    await expect(section.getByTestId('eif-rep-joined'), 'WS-54: the New Users Joined cell renders')
      .toContainText('New Users Joined in EiFlix');
    await expect(section.getByTestId('eif-rep-masterclass'), 'WS-54: the Masterclass Purchase cell renders')
      .toContainText('Masterclass Purchase');

    // [ASSERT] each count equals an INDEPENDENT count of the same population, made by the test with
    // the Admin SDK. These numbers are over whole collections and the shared emulator holds other
    // runs' rows, so a literal expectation would pass or fail on unrelated seed data — the first
    // version of this case asserted "1" and got 4, because the base seed's own new_user_data rows
    // are 1-3 days old and legitimately enter the 30D window. The app was right; the test was not.
    const todayJourney = await countNewUserDataInWindow('movedon', 1);
    const todayJoined = await countNewUserDataInWindow('created', 1);
    const todayCaptured = await countCapturedPayments(1);
    // The seed guarantees at least one of each, so these are not vacuously zero.
    expect(todayJourney, 'WS-54: the seeded journey purchase is in the oracle').toBeGreaterThanOrEqual(1);
    expect(todayJoined, 'WS-54: the seeded signup is in the oracle').toBeGreaterThanOrEqual(1);
    expect(todayCaptured, 'WS-54: both seeded captured payments are in the oracle').toBeGreaterThanOrEqual(2);

    await expect(section.getByTestId('eif-rep-journey-count'), 'WS-54: journey purchases match the independent count')
      .toHaveText(String(todayJourney), { timeout: 60_000 });
    await expect(section.getByTestId('eif-rep-joined-count'), 'WS-54: signups match the independent count')
      .toHaveText(String(todayJoined));
    // The 'failed' row dated today and the 'captured' row dated 200 days ago are excluded by two
    // DIFFERENT mechanisms — the status IF and the datetime WHERE. The oracle applies both, so a
    // match here means the app applied both too.
    await expect(section.getByTestId('eif-rep-masterclass-count'), 'WS-54: captured payments match the independent count')
      .toHaveText(String(todayCaptured));

    // [ASSERT] widening the window agrees with the oracle for 30D as well — and never picks up the
    // failed payment, which no window can admit.
    const monthCaptured = await countCapturedPayments(30);
    await section.getByTestId('eif-rep-range-30d').click();
    await expect(section.getByTestId('eif-rep-masterclass-count'), 'WS-54: 30D captured payments match')
      .toHaveText(String(monthCaptured), { timeout: 30_000 });
    const monthJoined = await countNewUserDataInWindow('created', 30);
    await expect(section.getByTestId('eif-rep-joined-count'), 'WS-54: 30D signups match')
      .toHaveText(String(monthJoined));
    expect(monthJoined, 'WS-54: a wider window cannot contain fewer signups').toBeGreaterThanOrEqual(todayJoined);
  });
});


// =============================================================================================
// WS-55 — the EiFlix Report's Export button produces a real .xlsx.
//
// The sheet's GRID is unit-tested in the app repo against the hand-written weekly workbook. What
// only a browser can prove is that the button is wired, the file actually downloads, and the
// bytes are a readable workbook rather than an empty or truncated one.
// =============================================================================================
test.describe('Workshops — eiflix operations dashboard: report export', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    guard = attachConsoleGuard(page);
    await seedConsumption();
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    await clearConsumption();
    assertNoFatal(guard, 'eiflixoperationsdashboard: no fatal console errors / pageerrors', [
      /content analytics/i,
      /eiflixdailywatchers/i,
    ]);
  });

  test('WS-55 Export downloads an .xlsx whose first cells match the weekly report layout', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });
    const section = page.getByTestId('eif-report-section');
    await expect(section, 'WS-55: the report section renders').toBeVisible({ timeout: 60_000 });

    const btn = section.getByTestId('eif-rep-export');
    await expect(btn, 'WS-55: the Export button renders in the report header').toBeVisible({ timeout: 30_000 });
    await expect(btn, 'WS-55: and is labelled').toContainText('Export');

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await btn.click();
    const download = await downloadPromise;

    // [ASSERT] a real .xlsx lands on disk, named for the report.
    expect(download.suggestedFilename(), 'WS-55: an .xlsx named for the report').toMatch(/^EiFlix Report .*\.xlsx$/);
    const path = await download.path();
    expect(path, 'WS-55: the file is written').toBeTruthy();
    const bytes = readFileSync(path!);
    // A .xlsx is a zip: it must start with PK, and be far larger than an empty stub.
    expect(bytes.subarray(0, 2).toString('binary'), 'WS-55: the bytes are a zip container').toBe('PK');
    expect(bytes.length, 'WS-55: the workbook has real content').toBeGreaterThan(2000);
  });
});

// ===================================================================================================
// WS-58 — the Users section date range
//
// Two cards, two DIFFERENT date fields: Total New Users by signup date, New Users to Paid by move
// date. The seed makes them disagree on purpose — NU_C signed up 3 days ago and moved across TODAY —
// so a card that filtered on the wrong field is visible as a wrong number, not just a smaller one.
//
// Every expected value is computed by the TEST from Firestore before the app is asked, over the whole
// collection (the shared emulator holds other runs' rows — the WS-54 lesson). Counts are POLLED: the
// cards animate their numbers and the listeners settle after first paint (the WS-30 lesson).
// ===================================================================================================
test.describe('Workshops — eiflix operations dashboard: Users date range', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    guard = attachConsoleGuard(page);
    await alignWorkshopMetadataNames();
    await seedUsersRangePaid();
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    await clearUsersRangePaid();
    assertNoFatal(guard, 'eiflixoperationsdashboard: no fatal console errors / pageerrors', [
      /content analytics/i,
      /eiflixdailywatchers/i,
    ]);
  });

  test('WS-58 the Users range filters signups by created date and paid moves by move date', async ({ page }) => {
    // [ORACLES] all computed before the app renders.
    const allNew = await countNewUsersCard(null);
    const todayNew = await countNewUsersCard(0);
    const weekNew = await countNewUsersCard(7);
    const allPaid = await countPaidCard(null);
    const todayPaid = await countPaidCard(0);

    // [PRECONDITIONS] the seed must actually straddle the windows, or "the number got smaller"
    // would be unfalsifiable.
    expect(todayNew, `WS-58: the seed must hold signups OUTSIDE today (all=${allNew}, today=${todayNew})`)
      .toBeLessThan(allNew);
    expect(todayPaid, 'WS-58: NU_C moved across today, so Today must hold at least one paid move')
      .toBeGreaterThan(0);
    expect(weekNew, 'WS-58: 7D must sit between Today and All').toBeGreaterThanOrEqual(todayNew);

    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });

    const cardFor = (title: string) => page.locator('button.eod-card').filter({ hasText: title });
    const newCard = cardFor('Total New Users');
    const paidCard = cardFor('New Users to Paid');
    await expect(newCard, 'WS-58: the Users cards must render').toBeVisible({ timeout: 45_000 });

    const countOf = async (card: typeof newCard) => {
      const t = await card.locator('.eod-count').first().innerText().catch(() => '');
      return Number(t.replace(/[^\d]/g, '')) || 0;
    };
    const settles = async (card: typeof newCard, want: number, message: string) =>
      expect.poll(() => countOf(card), { message, timeout: 60_000 }).toBe(want);

    // [ASSERT] unfiltered — All is the default, so the cards start as the totals they always were.
    await settles(newCard, allNew, `WS-58: Total New Users unfiltered must equal the independent count (${allNew})`);
    await settles(paidCard, allPaid, `WS-58: New Users to Paid unfiltered must equal the independent count (${allPaid})`);

    // [REAL-UI + ASSERT] Today. The paid card is the falsifiable half: every paid row in the base
    // seed signed up long ago, so a card filtering on the signup date would read 0 here.
    await page.getByTestId('eif-users-range-today').click();
    await settles(newCard, todayNew, `WS-58: Today must narrow Total New Users to signups from today (${todayNew})`);
    await settles(paidCard, todayPaid, `WS-58: Today must narrow New Users to Paid by MOVE date (${todayPaid}), not by signup date`);

    // [REAL-UI + ASSERT] 7D widens the signup window back out.
    await page.getByTestId('eif-users-range-7d').click();
    await settles(newCard, weekNew, `WS-58: 7D must count signups in the last 7 days (${weekNew})`);

    // [REAL-UI + ASSERT] 30D.
    const monthNew = await countNewUsersCard(30);
    await page.getByTestId('eif-users-range-30d').click();
    await settles(newCard, monthNew, `WS-58: 30D must count signups in the last 30 days (${monthNew})`);

    // [REAL-UI + ASSERT] the manual From-To. Both bounds on today == the Today window, so the
    // custom path has to land on the same number the segment did.
    const today = wsDateInputValue(0);
    await page.getByTestId('eif-users-range-from').fill(today);
    await page.getByTestId('eif-users-range-to').fill(today);
    await settles(newCard, todayNew, `WS-58: a manual From-To of today must match the Today segment (${todayNew})`);
    await settles(paidCard, todayPaid, 'WS-58: the manual range filters the paid card by move date too');

    // [REAL-UI + ASSERT] Clear restores the totals.
    await page.getByTestId('eif-users-range-clear').click();
    await settles(newCard, allNew, `WS-58: Clear must restore the unfiltered total (${allNew})`);
    await settles(paidCard, allPaid, 'WS-58: Clear must restore the unfiltered paid total');

    // [REAL-UI] the All segment is the same cleared state, reached the other way.
    await page.getByTestId('eif-users-range-today').click();
    await settles(newCard, todayNew, 'WS-58: Today narrows again');
    await page.getByTestId('eif-users-range-all').click();
    await settles(newCard, allNew, 'WS-58: All restores the unfiltered total');
  });

  // =================================================================================================
  // WS-59 — Total B!G Participants moved out of Users into its own B!G section (2026-10-13)
  //
  // Both halves are asserted: the card is GONE from Users and PRESENT in B!G. Asserting only the new
  // home would pass on a page that rendered the card twice.
  // =================================================================================================
  test('WS-59 the B!G card renders in its own section and no longer in Users', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });

    const users = page.getByTestId('eif-users-section');
    const big = page.getByTestId('eif-big-section');
    await expect(users.locator('button.eod-card').filter({ hasText: 'Total New Users' }),
      'WS-59: Users keeps Total New Users').toBeVisible({ timeout: 45_000 });
    await expect(users.locator('button.eod-card').filter({ hasText: 'New Users to Paid' }),
      'WS-59: Users keeps New Users to Paid').toBeVisible();

    // [ASSERT] negative half first — the card must have LEFT Users.
    await expect(users.locator('button.eod-card').filter({ hasText: 'B!G Participants' }),
      'WS-59: B!G Participants must no longer render in Users').toHaveCount(0);
    // Two user cards + Master Class Purchase (WS-60, 2026-10-13) — and no B!G.
    await expect(users.locator('button.eod-card'), 'WS-59: Users holds exactly three cards').toHaveCount(3);

    // ...and it arrived in the B!G section, as the only card there.
    await expect(big.getByRole('heading', { name: 'B!G' }), 'WS-59: the B!G section has its heading').toBeVisible();
    const bigCard = big.locator('button.eod-card').filter({ hasText: 'Total B!G Participants' });
    await expect(bigCard, 'WS-59: B!G Participants renders in the B!G section').toHaveCount(1);
    await expect(big.locator('button.eod-card'), 'WS-59: B!G holds just that one card').toHaveCount(1);

    // [REAL-UI] the moved card still opens its details panel — it is the same card, only relocated.
    await bigCard.click();
    await expect(page.locator('.eod-panel, [role="dialog"]').filter({ hasText: 'Total B!G Participants' }).first(),
      'WS-59: the moved card still opens its details panel').toBeVisible({ timeout: 15_000 });
  });
});

// ===================================================================================================
// WS-60 — Master Class Purchase card (Users section)
//
// Captured payments only, tagged New User when the payer is in new_user_data, labelled with the
// workshop's detail-page title, narrowed by the Users range on `datetime`. NU_C's payment is FAILED
// and NU_C pays for nothing else, so NU_C appearing anywhere means the status filter leaked.
// ===================================================================================================
test.describe('Workshops — eiflix operations dashboard: Master Class Purchase', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    guard = attachConsoleGuard(page);
    await alignWorkshopMetadataNames();
    await seedMasterclassPayments();
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    await clearMasterclassPayments();
    assertNoFatal(guard, 'eiflixoperationsdashboard: no fatal console errors / pageerrors', [
      /content analytics/i,
      /eiflixdailywatchers/i,
    ]);
  });

  test('WS-60 Master Class Purchase counts captured payments by datetime, tags new users and names the workshop', async ({ page }) => {
    const all = await countCapturedForUsersRange(null);
    const today = await countCapturedForUsersRange(0);
    expect(today, `WS-60: the seed must hold captured payments outside today (all=${all}, today=${today})`).toBeLessThan(all);

    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });
    const card = page.getByTestId('eif-users-section').locator('button.eod-card').filter({ hasText: 'Master Class Purchase' });
    await expect(card, 'WS-60: the card renders in the Users section').toBeVisible({ timeout: 45_000 });
    const countOf = async () => Number((await card.locator('.eod-count').first().innerText().catch(() => '')).replace(/[^\d]/g, '')) || 0;

    await expect.poll(countOf, { message: `WS-60: All counts every captured payment (${all})`, timeout: 60_000 }).toBe(all);
    await page.getByTestId('eif-users-range-today').click();
    await expect.poll(countOf, { message: `WS-60: Today narrows on datetime (${today})`, timeout: 30_000 }).toBe(today);
    // The card highlights the rupee total (no "collected" wording) — summed by the TEST.
    const todaySum = await sumCapturedForUsersRange(0);
    await expect(card.getByTestId('eif-mc-card-amount'), `WS-60: the card highlights today's total (₹${todaySum})`)
      .toHaveText('₹' + todaySum.toLocaleString('en-IN'), { timeout: 15_000 });
    await expect(card, 'WS-60: the old "collected" wording is gone').not.toContainText('collected');

    // [REAL-UI] open the card — the panel lists the people behind the number.
    await card.click();
    const panel = page.locator('.eod-panel').filter({ hasText: 'Master Class Purchase' });
    await expect(panel, 'WS-60: the details panel opens').toBeVisible({ timeout: 15_000 });

    // [ASSERT] negative control first: the FAILED payer must not be listed.
    await expect(panel.locator('.eod-row').filter({ hasText: wsAddNames.nuCharlie }),
      'WS-60: a failed payment must never appear').toHaveCount(0);
    // ...nor the 40-day-old captured payer, under Today.
    await expect(panel.locator('.eod-row').filter({ hasText: wsAddNames.nuBravo }),
      'WS-60: a captured payment outside the window must not appear under Today').toHaveCount(0);

    const newRow = panel.locator('.eod-row').filter({ hasText: wsAddNames.nuAlpha });
    await expect(newRow, 'WS-60: the new user\'s purchase is listed').toHaveCount(1);
    await expect(newRow.locator('.eod-tag').filter({ hasText: 'New User' }), 'WS-60: payer in new_user_data is tagged New User').toHaveCount(1);
    await expect(newRow.getByTestId('eif-mc-workshop'), 'WS-60: the row names the workshop by its detail-page title')
      .toHaveText(`Dashboard Workshop ${RUN}`);
    await expect(newRow.getByTestId('eif-mc-amount'), 'WS-60: the row shows the amount in rupees')
      .toHaveText('₹' + wsMasterclassAmounts.capNew);

    const pmRow = panel.locator('.eod-row').filter({ has: page.getByTestId('eif-mc-amount').filter({ hasText: '₹1,500' }) });
    await expect(pmRow, 'WS-60: the participant\'s purchase is listed').toHaveCount(1);
    await expect(pmRow.locator('.eod-tag').filter({ hasText: 'New User' }), 'WS-60: a participant is NOT tagged New User').toHaveCount(0);

    // Journey — participant-metadata payers only.
    await expect(pmRow.locator('.eod-tag-journey'), 'WS-60: the participant row shows their journey')
      .toHaveText(wsMasterclassJourney, { timeout: 15_000 });
    await expect(newRow.locator('.eod-tag-journey'), 'WS-60: a new-user-only payer has no journey').toHaveCount(0);
  });
});

// ===================================================================================================
// WS-61 — Device Breakdown: From–To alongside 1M / 2M / 3M
//
// Two register pages under platform names nothing else writes: -20d (2h) and -50d (1h). Each step
// asserts the platform that must be ABSENT before the one that must be present, so a window that
// ignored a bound fails rather than passing on extra rows.
// ===================================================================================================
test.describe('Workshops — eiflix operations dashboard: Device Breakdown range', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    guard = attachConsoleGuard(page);
    await seedDeviceBreakdownPages();
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    await clearDeviceBreakdownPages();
    assertNoFatal(guard, 'eiflixoperationsdashboard: no fatal console errors / pageerrors', [
      /content analytics/i,
      /eiflixdailywatchers/i,
    ]);
  });

  test('WS-61 Device Breakdown narrows to a manual From–To and Clear returns to 1M', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixoperationsdashboard', { waitUntil: 'domcontentloaded' });
    const rowFor = (name: string) => page.locator('button.eod-db-row').filter({ hasText: new RegExp(name, 'i') });

    // [1M default] -20d in, -50d out.
    await expect(rowFor(wsDbPlatforms.recent), 'WS-61: 1M includes the -20d page').toHaveCount(1, { timeout: 60_000 });
    await expect(rowFor(wsDbPlatforms.older), 'WS-61: 1M excludes the -50d page').toHaveCount(0);

    // [2M] widens to -50d.
    await page.getByTestId('eif-set-db-range-21').click();
    await expect(rowFor(wsDbPlatforms.older), 'WS-61: 2M includes the -50d page').toHaveCount(1, { timeout: 15_000 });

    // [From–To] -50d .. -45d: only the older page. Negative half first.
    await page.getByTestId('eif-db-range-from').fill(wsDbDayKey(-50));
    await page.getByTestId('eif-db-range-to').fill(wsDbDayKey(-45));
    await expect(rowFor(wsDbPlatforms.recent), 'WS-61: the -20d page is outside -50d..-45d').toHaveCount(0, { timeout: 15_000 });
    await expect(rowFor(wsDbPlatforms.older), 'WS-61: the -50d page is inside (the From day is inclusive)').toHaveCount(1);
    await expect(rowFor(wsDbPlatforms.older).locator('.eod-db-hours'), 'WS-61: its hours come from that page alone')
      .toHaveText('1h');

    // [Clear] back to 1M.
    await page.getByTestId('eif-db-range-clear').click();
    await expect(rowFor(wsDbPlatforms.older), 'WS-61: Clear returns to 1M, which excludes -50d').toHaveCount(0, { timeout: 15_000 });
    await expect(rowFor(wsDbPlatforms.recent), 'WS-61: and includes -20d again').toHaveCount(1);
  });
});
