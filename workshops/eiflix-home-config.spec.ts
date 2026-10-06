// eiflix-home-config.spec.ts — /eiflixhomeconfig (New-Workshop/upcomingworkshops).
//
// Recon: e2e/recon-allcomp/workshops.md "Addendum — 2026-09-04" (WS-18 / WS-19).
//
// The screen reads ONE collection (`eiflixhomewidgets`) and partitions it CLIENT-SIDE by `widgettype`
// into the "Upcoming Workshops" and "Ads" tabs (upcomingworkshops.component.ts:129,133). The route has
// NO canActivate (app.routes.ts:286), so nothing here asserts reachability.
//
// Anti-circularity — why the 'ads' doc must exist:
//   WS-18 asserts an ads-typed widget does NOT appear in the comingsoon tab. With no ads doc seeded,
//   that assertion passes trivially whether or not the partition runs. The seeded ads widget is the
//   negative control that makes the filter falsifiable.
import { test, expect } from '@playwright/test';
import {
  wsAddIds, wsAddNames, installWshopStubs, loginAsWshopAdmin, resetHomeWidgetAds,
  wsUpcomingCostTitle, cleanUpcomingCostWidget,
  wsHomeSeriesTitle, wsHomeSeriesFields, wsHomeSeriesEpisodeTitle, cleanHomeSeriesFieldsDoc,
  wsAudienceNames, eiflixHomeConfig, resetEiflixHomeConfig,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, queryWhere, pollUntil } from '../queue/support/firestore-admin';

/** Open the "Upcoming Workshops" tab — tab 1 is "Create / Assign EiFlix Home", not a table. */
async function openComingSoonTab(page: import('@playwright/test').Page) {
  await page.getByRole('tab', { name: 'Upcoming Workshops' }).click();
  await expect(page.locator('table.upcoming-table').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('Workshops — eiflix home config (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'eiflixhomeconfig: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // WS-18 — the widgettype partition is real: comingsoon renders, ads does NOT (same collection)
  // ===========================================================================================
  test('WS-18 the comingsoon tab shows comingsoon widgets and excludes ads widgets', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixhomeconfig', { waitUntil: 'domcontentloaded' });
    await openComingSoonTab(page);

    // [REAL-UI] the comingsoon-typed widget the app drew from its stream.
    await expect(
      page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: wsAddNames.hwFirst }),
      'WS-18: a widgettype:comingsoon widget must render in the Upcoming Workshops tab',
    ).toHaveCount(1, { timeout: 30_000 });

    // [ASSERT] the ads-typed widget from the SAME collection must be absent here. This is the whole
    // case: both docs live in `eiflixhomewidgets`, so the only thing that can keep them apart is the
    // app's own `w.widgettype === 'comingsoon'` filter (ts:129).
    await expect(
      page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: wsAddNames.hwAds }),
      'WS-18: a widgettype:ads widget must NOT leak into the comingsoon tab (partition, ts:129)',
    ).toHaveCount(0);

    // And it IS present in the Ads tab — proving the doc exists and only the partition moved it.
    await page.getByRole('tab', { name: 'Ads' }).click();
    await expect(
      page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: wsAddNames.hwAds }),
      'WS-18: the same ads widget MUST render in the Ads tab (proves it was seeded, not missing)',
    ).toHaveCount(1, { timeout: 30_000 });
  });

  // ===========================================================================================
  // WS-19 — rows render in `order` sequence; a widget with NO order field sorts last
  // ===========================================================================================
  test('WS-19 comingsoon rows sort by order, and an order-less widget sorts last', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixhomeconfig', { waitUntil: 'domcontentloaded' });
    await openComingSoonTab(page);

    await expect(
      page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: wsAddNames.hwFirst }),
    ).toHaveCount(1, { timeout: 30_000 });

    // [ASSERT] read the rendered row sequence and check OUR three widgets' relative positions. The seed
    // stores order:1, order:2 and NO order at all; the sequence is the app's sort (ts:130) with
    // orderOf() falling back to MAX_SAFE_INTEGER for the missing field (ts:260). The "sorts last"
    // behaviour is a real branch — it is only observable because one seeded doc omits `order`.
    const rows = await page.locator('table.upcoming-table tr.mat-mdc-row, table.upcoming-table tr[mat-row]').allTextContents();
    const idx = (needle: string) => rows.findIndex((r) => r.includes(needle));
    const iFirst = idx(wsAddNames.hwFirst);
    const iSecond = idx(wsAddNames.hwSecond);
    const iUnordered = idx(wsAddNames.hwUnordered);

    expect(iFirst, 'WS-19: the order:1 widget rendered').toBeGreaterThanOrEqual(0);
    expect(iSecond, 'WS-19: the order:2 widget rendered').toBeGreaterThanOrEqual(0);
    expect(iUnordered, 'WS-19: the order-less widget rendered').toBeGreaterThanOrEqual(0);
    expect(iFirst, `WS-19: order:1 (${iFirst}) must precede order:2 (${iSecond})`).toBeLessThan(iSecond);
    expect(
      iSecond,
      `WS-19: order:2 (${iSecond}) must precede the order-less widget (${iUnordered}) — orderOf() falls back to MAX_SAFE_INTEGER`,
    ).toBeLessThan(iUnordered);
  });

  // ===========================================================================================
  // WS-20 — deleting a widget accepts the confirm() and removes the doc (write path)
  // ===========================================================================================
  // DIALOG TRAP: deleteFrom() early-returns unless window.confirm returns true (ts:381). Playwright
  // AUTO-DISMISSES an unhandled dialog, so with no handler the deleteDoc never runs and a test that
  // merely checked "no error appeared" would still go green. The handler is registered before the
  // click, and the assertion is the Firestore post-state — which an auto-dismissed dialog cannot produce.
  //
  // Deletes the ADS widget rather than a comingsoon one: it is the disposable member of the seed (its
  // other job, as WS-18's negative control, is re-established by the reset helper on every run).
  test('WS-20 deleting an ads widget removes the eiflixhomewidgets doc', async ({ page }) => {
    // [PRECONDITION] re-create the target so the case is order- and re-run-independent.
    await resetHomeWidgetAds();
    const before = await getDoc('eiflixhomewidgets', wsAddIds.HW_ADS);
    expect(before, 'WS-20: the delete target must exist before the action').toBeTruthy();

    await loginAsWshopAdmin(page);
    await page.goto('/eiflixhomeconfig', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Ads' }).click();

    const row = page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: wsAddNames.hwAds });
    await expect(row, 'WS-20: the ads row must render').toHaveCount(1, { timeout: 30_000 });

    page.once('dialog', (d) => d.accept());   // deleteFrom()'s confirm (ts:381) — see DIALOG TRAP above
    await row.locator('button.del-btn').click();

    // [ASSERT] the doc is gone — the post-state the APP produced via deleteDoc (ts:383).
    const after = await pollUntil(
      () => getDoc('eiflixhomewidgets', wsAddIds.HW_ADS),
      (d) => d === null,
      { label: 'WS-20: eiflixhomewidgets doc deleted by the app', timeoutMs: 30_000 },
    );
    expect(after, 'WS-20: the app deleted the widget doc').toBeNull();
    await expect(row, 'WS-20: the deleted row must leave the table').toHaveCount(0, { timeout: 15_000 });

    // Restore it so a later WS-18 run still has its negative control (suite order is serial, but this
    // keeps the file independent of ordering).
    await resetHomeWidgetAds();
  });
  // ===========================================================================================
  // WS-38 — Cost is optional on an upcoming workshop, and an unset Cost is stored as ""
  // ===========================================================================================
  // Two branches in one action, both falsifiable:
  //   · Cost carried Validators.required until 2026-09-24. If it still did, save() would
  //     early-return on form.invalid (createupcomingworkshops.component.ts:777) and NO document
  //     would ever appear — the poll below would time out rather than pass.
  //   · The save normalises with `(raw.cost || '').toLowerCase()` (ts:808). A strict toBe('')
  //     fails on null, on undefined and on a missing field, which is exactly the distinction
  //     asked for: empty string, never null.
  // The Cost control is never touched — this is the "did not select anything" path.
  test('WS-38 an upcoming workshop saves with no Cost chosen, and stores it as an empty string', async ({ page }) => {
    // [PRECONDITION] no leftover from an earlier run; the app generates the id, so title is the handle.
    await cleanUpcomingCostWidget();

    await loginAsWshopAdmin(page);
    await page.goto('/eiflixhomeconfig', { waitUntil: 'domcontentloaded' });
    await openComingSoonTab(page);

    await page.getByTestId('upc-open-dialog-1').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog, 'WS-38: the add dialog must open').toBeVisible({ timeout: 30_000 });

    // Event date — the input is readonly and opens the picker; take today's cell.
    await dialog.getByTestId('cre-picker-2').click();
    await page.locator('.mat-calendar-body-today').first().click();
    await expect(dialog.getByTestId('cre-picker-2'), 'WS-38: a date was chosen').not.toHaveValue('');

    // The other two required fields. Cost is deliberately left alone.
    await dialog.locator('input[formcontrolname="type"]').fill('workshop');
    await dialog.locator('input[formcontrolname="title"]').fill(wsUpcomingCostTitle);

    // [REAL-UI] with Cost untouched, the form is submittable — the button is the app's own
    // readout of the remaining validators.
    const submit = dialog.getByTestId('cre-button-9');
    await expect(submit, 'WS-38: Cost does not block the save').toBeEnabled();
    await submit.click();
    await expect(dialog, 'WS-38: the dialog closes on a successful save').toBeHidden({ timeout: 30_000 });

    // [ASSERT] the document the APP created, found by the title we typed — read back from
    // Firestore, never from the screen.
    const created = await pollUntil(
      async () => (await queryWhere('eiflixhomewidgets', [['title', '==', wsUpcomingCostTitle]]))[0] || null,
      (d: any) => d !== null,
      { label: 'WS-38: the app created the upcoming workshop', timeoutMs: 30_000 },
    );
    expect(created, 'WS-38: the save went through with no Cost chosen').toBeTruthy();
    expect((created as any).widgettype, 'WS-38: it is a comingsoon widget').toBe('comingsoon');
    // The whole point: an empty string, and not null, undefined or a missing key.
    expect((created as any).cost, 'WS-38: an unset Cost is stored as an empty string').toBe('');
    expect((created as any).cost, 'WS-38: an unset Cost is NOT null').not.toBeNull();

    await cleanUpcomingCostWidget();
  });
  // ===========================================================================================
  // WS-39 — the Add Home Series dialog carries the six series-level fields, and saves them
  // ===========================================================================================
  // Added 2026-09-29: pickoftheweek (toggle) + heading / headleft / headright / subtitle /
  // buttontext (inputs), beside the series Title. This Subtitle belongs to the SERIES — each episode card in the same
  // dialog has its own `subtitle`, and the two must not be confused, so the case asserts the series
  // subtitle at the TOP level of the document while the episode row keeps its own.
  //
  // Anti-circularity: every value below is typed BY the test and read back out of Firestore from
  // the document the APP created. The seed writes none of them, so a passing assertion can only
  // come from the dialog's own save path (homeseries.component.ts:206).
  test('WS-39 Add Home Series stores pick of the week, heading, head left, head right, subtitle and button text', async ({ page }) => {
    // [PRECONDITION] no leftover from an earlier run; the app generates the id, so title is the handle.
    await cleanHomeSeriesFieldsDoc();

    await loginAsWshopAdmin(page);
    await page.goto('/eiflixhomeconfig', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Home Series' }).click();

    await page.getByTestId('upc-open-home-series-dialog-8').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog, 'WS-39: the Add Home Series dialog must open').toBeVisible({ timeout: 30_000 });

    // Series title, then the five fields under test.
    await dialog.locator('input[formcontrolname="title"]').first().fill(wsHomeSeriesTitle);
    await dialog.getByTestId('hom-heading').fill(wsHomeSeriesFields.heading);
    await dialog.getByTestId('hom-subtitle').fill(wsHomeSeriesFields.subtitle);
    await dialog.getByTestId('hom-headleft').fill(wsHomeSeriesFields.headleft);
    await dialog.getByTestId('hom-headright').fill(wsHomeSeriesFields.headright);
    await dialog.getByTestId('hom-buttontext').fill(wsHomeSeriesFields.buttontext);

    // The toggle is a mat-slide-toggle: click its own button, then read the app's state back.
    const pick = dialog.getByTestId('hom-pickoftheweek');
    await pick.locator('button[role="switch"]').click();
    await expect(pick.locator('button[role="switch"]'), 'WS-39: the toggle turned on')
      .toHaveAttribute('aria-checked', 'true');

    // At least one episode is required before the dialog will save (ts:188).
    await dialog.locator('mat-select[formcontrolname="selectedEpisodes"]').click();
    const option = page.getByRole('option', { name: wsHomeSeriesEpisodeTitle });
    await expect(option, 'WS-39: the seeded episode must be offered').toBeVisible({ timeout: 30_000 });
    await option.click();
    await page.keyboard.press('Escape');

    await dialog.getByTestId('hom-button-5').click();
    await expect(dialog, 'WS-39: the dialog closes on a successful save').toBeHidden({ timeout: 30_000 });

    // [ASSERT] the document the APP created, found by the title we typed.
    const created: any = await pollUntil(
      async () => (await queryWhere('eiflixhomeseries', [['title', '==', wsHomeSeriesTitle]]))[0] || null,
      (d: any) => d !== null,
      { label: 'WS-39: the app created the home series', timeoutMs: 30_000 },
    );
    expect(created, 'WS-39: the save went through').toBeTruthy();

    // The six fields, each compared to the value this test supplied.
    expect(created.pickoftheweek, 'WS-39: pick of the week is stored as a boolean true').toBe(true);
    expect(created.heading, 'WS-39: heading is stored').toBe(wsHomeSeriesFields.heading);
    expect(created.headleft, 'WS-39: head left is stored').toBe(wsHomeSeriesFields.headleft);
    expect(created.headright, 'WS-39: head right is stored').toBe(wsHomeSeriesFields.headright);
    expect(created.subtitle, 'WS-39: the SERIES subtitle is stored at the top level')
      .toBe(wsHomeSeriesFields.subtitle);
    expect(created.buttontext, 'WS-39: button text is stored').toBe(wsHomeSeriesFields.buttontext);

    // [ASSERT] the per-episode row still owns its own subtitle — the series subtitle did not
    // overwrite it, and the episode picked is the one we chose.
    expect(Array.isArray(created.homeseries), 'WS-39: the episode rows are still written').toBe(true);
    expect(created.homeseries.length, 'WS-39: one episode was picked').toBe(1);
    expect(created.homeseries[0].subtitle, 'WS-39: the episode row keeps its own (empty) subtitle').toBe('');

    await cleanHomeSeriesFieldsDoc();
  });
  // ===========================================================================================
  // WS-40 — a home row is narrowed to journeys OR tiers, never both, and stores document ids
  // ===========================================================================================
  // Added 2026-09-29 to the "Create / Assign EiFlix Home" tab, after Show to: a two-way chooser
  // (Journey / Tier) and a searchable multi-select of whichever was picked.
  //
  // The two halves that are easy to get wrong, and are therefore what this case pins:
  //   · the dropdown shows `journey.journey` / `tier.tier` but must store the DOCUMENT ID. The
  //     seeded name and id differ visibly, so storing the label instead would fail here.
  //   · the two are exclusive. The case picks a journey, saves, then switches the SAME row to
  //     Tier and saves again — the journey array must come back empty, which a test that only
  //     ever set one of them could never detect.
  test('WS-40 an EiFlix Home row stores journey ids, then swaps to tier ids exclusively', async ({ page }) => {
    // [PRECONDITION] the seeded ids must actually exist. Without this, a constant
    // read from the wrong export object is `undefined`, and the assertions below
    // compare ['someid'] against [undefined] — a confusing one-element diff rather
    // than a clear failure (this is what run 99045513373 reported).
    expect(wsAddIds.JRN_AUD, 'WS-40: the seeded journey id must be defined').toBeTruthy();
    expect(wsAddIds.TIER_AUD, 'WS-40: the seeded tier id must be defined').toBeTruthy();

    // [PRECONDITION] start from an empty home config so the row under test is index 0.
    await resetEiflixHomeConfig();

    await loginAsWshopAdmin(page);
    await page.goto('/eiflixhomeconfig', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Create / Assign EiFlix Home' }).click();

    // Add one static widget from the library — the tab refuses to save with no rows.
    const libItem = page.getByTestId('eif2-add-option-1').first();
    await expect(libItem, 'WS-40: the library must offer a widget').toBeVisible({ timeout: 30_000 });
    await libItem.click();

    // ── Journey ──
    await page.getByTestId('eif2-audience-journey').first().click();
    const journeySelect = page.getByTestId('eif2-journey-select').first();
    await expect(journeySelect, 'WS-40: choosing Journey reveals the journey picker').toBeVisible();
    await expect(page.getByTestId('eif2-tier-select'), 'WS-40: and not the tier picker').toHaveCount(0);

    await journeySelect.click();
    // The search box narrows the list — the feature asked for, and the fastest way to the option.
    // ngx-mat-select-search marks its host <mat-option> aria-disabled (so it can never be SELECTED)
    // while keeping it interactive, and renders a hidden helper <input> beside the visible one. A
    // plain `fill` therefore waits the full timeout on "element is not enabled" (this is what failed
    // run 99003855355, and the same trap cost WS-31 a run earlier). Address the visible input by its
    // placeholder, click with the actionability check bypassed, and type — which drives the
    // component's real keyup handler.
    const journeySearch = page.getByPlaceholder('Search journeys');
    await journeySearch.click({ force: true });
    await page.keyboard.type(wsAudienceNames.journey);
    const journeyOption = page.getByRole('option', { name: wsAudienceNames.journey });
    await expect(journeyOption, 'WS-40: the seeded journey is offered by NAME').toBeVisible({ timeout: 15_000 });
    await journeyOption.click();
    await page.keyboard.press('Escape');

    await page.getByTestId('eif2-button-4').click();

    // [ASSERT] the app stored the journey's DOCUMENT ID, and left tier empty.
    const afterJourney: any = await pollUntil(
      async () => (await eiflixHomeConfig())[0] || null,
      (e: any) => e !== null && e.audiencetype === 'journey',
      { label: 'WS-40: the app saved a journey audience', timeoutMs: 30_000 },
    );
    expect(afterJourney.audiencetype, 'WS-40: the chosen kind is stored').toBe('journey');
    expect(afterJourney.journey, 'WS-40: the journey DOCUMENT ID is stored, not its name')
      .toEqual([wsAddIds.JRN_AUD]);
    expect(afterJourney.tier, 'WS-40: the other list is written empty, not left out').toEqual([]);

    // ── Tier, on the SAME row ──
    await page.getByTestId('eif2-audience-tier').first().click();
    const tierSelect = page.getByTestId('eif2-tier-select').first();
    await expect(tierSelect, 'WS-40: choosing Tier reveals the tier picker').toBeVisible();
    await expect(page.getByTestId('eif2-journey-select'), 'WS-40: and hides the journey picker').toHaveCount(0);

    await tierSelect.click();
    // Same ngx-mat-select-search handling as the journey picker above.
    const tierSearch = page.getByPlaceholder('Search tiers');
    await tierSearch.click({ force: true });
    await page.keyboard.type(wsAudienceNames.tier);
    const tierOption = page.getByRole('option', { name: wsAudienceNames.tier });
    await expect(tierOption, 'WS-40: the seeded tier is offered by NAME').toBeVisible({ timeout: 15_000 });
    await tierOption.click();
    await page.keyboard.press('Escape');

    await page.getByTestId('eif2-button-4').click();

    // [ASSERT] the swap is real: tier now holds the id and the journey list was CLEARED.
    const afterTier: any = await pollUntil(
      async () => (await eiflixHomeConfig())[0] || null,
      (e: any) => e !== null && e.audiencetype === 'tier',
      { label: 'WS-40: the app saved a tier audience', timeoutMs: 30_000 },
    );
    expect(afterTier.audiencetype, 'WS-40: the chosen kind swapped').toBe('tier');
    expect(afterTier.tier, 'WS-40: the tier DOCUMENT ID is stored').toEqual([wsAddIds.TIER_AUD]);
    expect(afterTier.journey, 'WS-40: the previous journey selection was cleared — the two are exclusive')
      .toEqual([]);

    await resetEiflixHomeConfig();
  });
});
