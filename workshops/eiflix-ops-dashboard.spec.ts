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
import {
  installWshopStubs, loginAsWshopAdmin, seedLoginLogs, clearLoginLogs, wsMetaNames, wsProfileIds,
  seedWebLoginLogs, clearWebLoginLogs, wsWebLoginVersions,
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
