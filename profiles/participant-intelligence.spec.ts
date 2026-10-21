// participant-intelligence.spec.ts — /participant-intelligence after rounds 1–5 ("v5"): the shell, the
// filter rail against a seeded world, the round-5 insight cards, merged event options, audiences
// (lists / segments / saved filters), the tag remove-from-all → delete flow, and the bulk bar's scope rule.
//
// Prefix: pi — ParticipantIntelligenceComponent. The screen is ONE file
// (participant-intelligence.component.ts) whose child components (filter rail, chips, audience switcher,
// table, bulk bar, column config, signals panel, dialogs) all carry the same `pi-` prefix.
//
// Reference: starlabs-angular specs/plans/2026-09-25-participant-intelligence-*.md, 2026-09-29-…-round4.md,
// 2026-10-01-…-round5.md, specs/journals/2026-09-25-participant-intelligence-enhancements.md; hub journal
// specs/journals/2026-10-14-participant-intelligence-v5.md (what each retired id became, why the seed looks
// like this).
//
// DATA SOURCE: the screen reads REAL Firestore — ParticipantDataService.getDocs over `participant metadata`
// (orderBy name) and the catalog collections. The mock-by-default prototype is gone: there is no mock path
// in the component, so every number below comes from the seed.
//
// SEEDED WORLD (seed-profiles.js, PI block): six `participant metadata` docs named `${PI_SEARCH}<Word>`
// (Alpha … Foxtrot — the matrix is in the seed), three events (two share a name), an approved and a
// PENDING event request, two tags, two lists + a segment, a saved filter, and a live + an INACTIVE segment
// board segment. The top search box narrows the shared-project table to exactly these six first, so data
// other suites leave behind cannot move a count.
//
// ANTI-CIRCULARITY: every asserted count / row set is computed by the APP (applyFilters, the signal
// predicates, nameGroups, audience resolution) from seeded inputs; the seed never stores a count. Writes
// are read back through the independent admin oracle (firestore-admin getDoc / pollUntil): the tag removed
// from its holders and deleted, the saved filter's new statuses and label, a tag's new "tag for", a remark
// on the one participant the bulk scope allowed. resetPiMutables() only restores PRECONDITIONS.
//
// 2026-10-21 (rounds 1–5 of the audiences / pipelines work — starlabs-angular specs/journals/2026-10-21-
// participant-intelligence-audiences-columns-anyall.md; hub journal 2026-10-21-participant-intelligence-
// pipelines-psub.md):
//   • option rows are no longer one click-to-cycle button: the label (and an Include pill) includes, an
//     Exclude pill excludes, clicking the active pill clears. PI-05 drives the pills; every other case
//     includes through the Include pill (`include()`), never a row click.
//   • "Update with current filters" asks first, showing what is saved now vs after (PI-13, PI-20).
//   • PI-18 consumed rules Match all / Match any. PI-19 pipelines (two saved filters → columns, in every /
//     not in every as unique names, select + Communication menu, never sent). PI-21 product subscription
//     (its own four people — see PSUB in the seed). PI-22 soft delete: the doc stays, flagged isdeleted.
//
// NOT DRIVEN (registered in PI-ADDR1, see there): ATC / uP! / CPM count conditions and the subscription
// date-range picker. NOT SEEDED on purpose: queue tokens (the queue suite's data — onQueueStageChange fires
// on every queue_token write), so the queue section's switch is covered, its narrowing is not.
import { test, expect, Page, Locator } from '@playwright/test';
import { installProfileStubs, loginAsProfileAdmin } from './support/profiles';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil, db } from '../queue/support/firestore-admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ID, PI, PI_NAME, PI_SEARCH, PSUB_NAME, PSUB_SEARCH, PF, TESTRUNID, resetPiMutables } = require('./seed-profiles');

const N = PI_NAME as Record<string, string>;
const TOLERATE = [/requires an index/i];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exact = (s: string) => new RegExp(`^\\s*${esc(s)}\\s*$`);

async function open(page: Page) {
  await loginAsProfileAdmin(page);
  await page.goto('/participant-intelligence', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('app-participant-intelligence'),
    'must mount — check the /participant-intelligence grant if this fails').toBeAttached({ timeout: 30_000 });
  await expect(page.getByText('Loading participants…'), 'the initial load must finish').toHaveCount(0, { timeout: 60_000 });
}

const topSearch = (page: Page) => page.getByPlaceholder('Search name, email or phone…');

/** Narrow the table to the six seeded PI participants. */
async function narrow(page: Page) {
  await topSearch(page).fill(PI_SEARCH);
  await expectCount(page, 6);
}

/** "<shown> of <total> participants" — only the shown number is run-scoped, so only it is asserted. */
async function expectCount(page: Page, shown: number) {
  await expect(page.getByTestId('pi-count')).toHaveText(new RegExp(`^\\s*${shown} of [\\d,]+ participants\\s*$`));
}

/** The table's rows, in display order (default sort: name A–Z). */
async function expectRows(page: Page, names: string[]) {
  await expect(page.locator('app-participant-table .tbody .tr .name')).toHaveText(names.map(exact));
}

/** A filter-rail section by its visible label. */
const section = (page: Page, label: RegExp) =>
  page.locator('app-filter-rail .section').filter({ has: page.locator('.sec-label', { hasText: label }) });

/** A checkbox option inside a rail section, by its exact label. */
const option = (sec: Locator, label: string) =>
  sec.getByTestId('pi-filter-option').filter({ has: sec.page().locator('.opt-label', { hasText: new RegExp(`^\\s*${esc(label)}\\b`) }) });

/** Include / exclude an option through its pills (the row itself is a div now). */
const include = (opt: Locator) => opt.getByTestId('pi-filter-option-include').click();

const chip = (page: Page, text: string) => page.locator('app-active-filter-chips .chip').filter({ hasText: text });

/** Tick a seeded participant's row checkbox. The input is 0×0 (a styled box draws it), so click its label. */
async function select(page: Page, name: string) {
  const cb = page.getByRole('checkbox', { name: `Select ${name}`, exact: true });
  await cb.locator('xpath=..').click();
  await expect(cb).toBeChecked();
}

test.describe('Participant Intelligence — v5 screen against the seeded PI world (filters, insights, audiences, tags, bulk scope)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installProfileStubs(page);
    await resetPiMutables(db());
  });
  test.afterEach(() => assertNoFatal(guard, 'participant-intelligence: no fatal console errors / pageerrors', TOLERATE));

  // ---------------------------------------------------------------------------------------------
  // Shell (PI-01..04 kept their ids; the controls behind them changed — see the journal's id map)
  // ---------------------------------------------------------------------------------------------

  test('PI-01 the filter rail closes to a reopen strip and the insights panel minimises to a bar', async ({ page }) => {
    await open(page);
    const rail = page.locator('aside.rail');
    await expect(rail, 'PI-01: the rail starts open').toBeVisible();
    await expect(page.getByTestId('pi-filter-open'), 'PI-01: no reopen strip while the rail is open').toHaveCount(0);

    // expand / collapse every section
    const toggleAll = page.getByTestId('pi-filter-toggle-all');
    await expect(page.locator('app-filter-rail .section.open'), 'PI-01: every section starts collapsed').toHaveCount(0);
    await expect(toggleAll).toHaveAttribute('title', 'Expand all');
    await toggleAll.click();
    await expect(toggleAll).toHaveAttribute('title', 'Collapse all');
    await expect(page.locator('app-filter-rail .section:not(.open)'), 'PI-01: Expand all opens every section').toHaveCount(0);
    await toggleAll.click();
    await expect(page.locator('app-filter-rail .section.open')).toHaveCount(0);

    await page.getByTestId('pi-filter-close').click();
    await expect(rail, 'PI-01: close removes the rail').toHaveCount(0);
    await expect(page.getByTestId('pi-filter-open')).toBeVisible();
    await page.getByTestId('pi-filter-open').click();
    await expect(rail, 'PI-01: the strip reopens it').toBeVisible();
    await expect(page.getByTestId('pi-filter-open')).toHaveCount(0);

    const insights = page.locator('app-signals-panel');
    await expect(insights, 'PI-01: insights start open').toBeVisible();
    await expect(page.getByTestId('pi-insights-expand')).toHaveCount(0);
    await page.getByTestId('pi-insights-minimize').click();
    await expect(insights).toHaveCount(0);
    await expect(page.getByTestId('pi-insights-expand'), 'PI-01: minimised insights leave a bar').toBeVisible();
    await page.getByTestId('pi-insights-expand').click();
    await expect(insights).toBeVisible();
    await expect(page.getByTestId('pi-insights-expand')).toHaveCount(0);
  });

  test('PI-02 the search narrows to the six seeded people, the pager fits them on one page, and clear restores the base', async ({ page }) => {
    await open(page);
    const count = page.getByTestId('pi-count');
    const clear = page.getByRole('button', { name: 'Clear search', exact: true });
    await expect(clear, 'PI-02: no term → no clear button').toHaveCount(0);
    await expect(count, 'PI-02: nothing filtered → shown equals total').toHaveText(/^\s*([\d,]+) of \1 participants\s*$/);
    const base = (await count.textContent())!.trim();

    await narrow(page);
    await expectRows(page, [N.AL, N.BR, N.CH, N.DE, N.EC, N.FX]);

    const pager = page.locator('app-participant-table .pager');
    await page.getByTestId('pi-page-size').selectOption('25');
    await expect(pager.locator('.range')).toHaveText(/^\s*1\s*–\s*6 of 6\s*$/);
    await expect(pager.locator('.page-no')).toHaveText('Page 1 of 1');
    for (const btn of [page.getByTestId('pi-page-first'), page.getByTestId('pi-page-prev'),
      page.getByTestId('pi-page-next'), page.getByTestId('pi-page-last')]) {
      await expect(btn, 'PI-02: one page → every pager button is disabled').toBeDisabled();
    }

    await expect(clear).toBeVisible();
    await clear.click();
    await expect(topSearch(page)).toHaveValue('');
    await expect(clear).toHaveCount(0);
    await expect(count, 'PI-02: clearing restores the full base').toHaveText(base);
  });

  test('PI-03 the checklists menu lists the Watson rules and the reconciliation checklists; R1 lists only its violators', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Checklists/ }).click();
    const watson = page.getByTestId('pi-watson-checklist-item');
    await expect(watson, 'PI-03: one item per Watson rule R1–R5').toHaveCount(5);
    // the reconciliation items lost their hook in v5 but still render
    await expect(page.getByRole('menuitem', { name: /Customer status/ })).toHaveCount(1);
    await expect(page.getByRole('menuitem', { name: /Higher-order purchase/ })).toHaveCount(1);

    // R1: Watson regular/defaulted/locked/fully paid must be subscription active or non active.
    await watson.filter({ hasText: 'R1 ·' }).click();
    const dlg = page.locator('app-checklist-viewer-dialog');
    await expect(dlg.locator('h2')).toHaveText(/^\s*R1 · /);
    const row = (name: string) => dlg.locator('tbody tr').filter({ has: page.locator('.nm', { hasText: exact(name) }) });
    // (the viewer shows the first 250 violators of the whole base; the disposable test project has far fewer)
    await expect(row(N.DE), 'PI-03: Delta (regular, no customer status) breaks R1').toHaveCount(1);
    await expect(row(N.DE).getByTestId('pi-watson-view-profile')).toHaveAttribute('href', `/userprofile/${PI.DE}`);
    for (const k of ['AL', 'BR', 'CH']) await expect(row(N[k]), `PI-03: ${k} is regular AND active/non active`).toHaveCount(0);
    await expect(row(N.EC), 'PI-03: Echo is discontinued but has no Watson status — not an R1 case').toHaveCount(0);
    await expect(row(N.FX), 'PI-03: Foxtrot has no Watson status').toHaveCount(0);

    const download = page.waitForEvent('download');
    await dlg.getByTestId('pi-watson-export').click();
    expect((await download).suggestedFilename()).toBe('watson-r1.csv');
    await dlg.getByRole('button', { name: 'Done' }).click();
    await expect(dlg).toHaveCount(0);
  });

  test('PI-04 comms opens the notification record in a new tab, refresh reloads, and export writes the filtered table', async ({ page }) => {
    await open(page);
    const nav = page.context().waitForEvent('request',
      (r) => r.isNavigationRequest() && new URL(r.url()).pathname === '/notificationrecord');
    const popup = page.context().waitForEvent('page');
    await page.getByTestId('pi-comms').click();
    await nav;
    await (await popup).close();

    await page.locator('header.topbar button.iconbtn').filter({ hasText: 'refresh' }).click();
    await expect(page.getByText('Refreshed'), 'PI-04: refresh confirms').toBeVisible();
    await expect(page.getByText('Loading participants…')).toHaveCount(0, { timeout: 60_000 });

    await narrow(page);
    await page.getByTestId('pi-export').click();
    await expect(page.getByTestId('pi-export-selection'), 'PI-04: no selection → Export Selection is disabled').toBeDisabled();
    const download = page.waitForEvent('download');
    await page.getByTestId('pi-export-table').click();
    expect((await download).suggestedFilename()).toMatch(/^participants_\d{4}-\d{2}-\d{2}\.xlsx$/);
    await expect(page.getByText('Exported 6 participants'), 'PI-04: the export covers exactly the filtered rows').toBeVisible();

    await page.getByTestId('pi-export').click();
    await page.getByTestId('pi-export-content').click();
    await expect(page.getByText('No content consumption for these participants'),
      'PI-04: none of the seeded people has a content analytics row').toBeVisible();
  });

  // ---------------------------------------------------------------------------------------------
  // Filter rail
  // ---------------------------------------------------------------------------------------------

  test('PI-05 a status option: Include and Exclude pills set it, clicking the active pill clears it, and the save prompts quote the filtered count', async ({ page }) => {
    await open(page);
    await narrow(page);
    const save = page.getByTestId('pi-filter-save');
    await expect(save, 'PI-05: nothing filtered → Save filter disabled').toBeDisabled();

    const sec = section(page, /^Customer status$/);
    await sec.locator('.sec-head').click();
    const nonActive = option(sec, 'Non active');
    const inc = nonActive.getByTestId('pi-filter-option-include');
    const exc = nonActive.getByTestId('pi-filter-option-exclude');
    await expect(inc).toHaveAttribute('aria-checked', 'false');
    await expect(exc).toHaveAttribute('aria-checked', 'false');

    // the label is the Include target
    await nonActive.locator('.opt-text').click();
    await expect(inc, 'PI-05: clicking the label includes').toHaveAttribute('aria-checked', 'true');
    await expect(exc).toHaveAttribute('aria-checked', 'false');
    await expectCount(page, 2);
    await expectRows(page, [N.CH, N.FX]);
    await expect(chip(page, 'Status: Non active')).toHaveCount(1);
    await expect(save).toBeEnabled();

    // both save entry points open the same prompt; cancelled, so nothing is written
    const prompt = page.locator('app-prompt-dialog');
    for (const entry of [page.getByTestId('pi-chips-save-filter'), save]) {
      await entry.click();
      await expect(prompt.locator('h2')).toHaveText('Save filter');
      await expect(prompt, 'PI-05: the prompt quotes the app-computed match count').toContainText('2 participants match the current filter.');
      await prompt.getByRole('button', { name: 'Cancel' }).click();
      await expect(prompt).toHaveCount(0);
    }

    // Exclude switches the same option over
    await exc.click();
    await expect(exc, 'PI-05: Exclude switches the option over').toHaveAttribute('aria-checked', 'true');
    await expect(inc).toHaveAttribute('aria-checked', 'false');
    await expectCount(page, 4);
    await expectRows(page, [N.AL, N.BR, N.DE, N.EC]);
    await expect(chip(page, 'Status: not Non active')).toHaveCount(1);

    // the reopen strip carries the active-filter count; the filter lives in the store, not the rail
    await page.getByTestId('pi-filter-close').click();
    await expect(page.getByTestId('pi-filter-open').locator('.pill')).toHaveText('1');
    await page.getByTestId('pi-filter-open').click();
    await sec.locator('.sec-head').click();
    await exc.click();
    await expect(exc, 'PI-05: clicking the active pill clears it').toHaveAttribute('aria-checked', 'false');
    await expect(inc).toHaveAttribute('aria-checked', 'false');
    await expectCount(page, 6);
  });

  test('PI-06 the age range keeps only readable ages inside it, and the Age column shows what the screen derived', async ({ page }) => {
    await open(page);
    await narrow(page);

    await page.getByRole('button', { name: /Columns/ }).click();
    await page.getByTestId('pi-col-search').fill('Age');
    // the add button lives in the column panel overlay, not under a .add-list wrapper — find it by its name
    await page.getByRole('button', { name: 'add Age', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('app-participant-table .thead .th-label').filter({ hasText: exact('Age') })).toHaveCount(1);
    const ageCell = (name: string) => page.locator('app-participant-table .tbody .tr')
      .filter({ has: page.locator('.name', { hasText: exact(name) }) }).locator('.td').nth(2);
    await expect(ageCell(N.BR), 'PI-06: DOB 30 years ago → 30').toHaveText(exact('30'));
    await expect(ageCell(N.CH)).toHaveText(exact('50'));
    await expect(ageCell(N.AL), 'PI-06: no DOB → no age').toHaveText(exact('—'));
    await expect(ageCell(N.FX), 'PI-06: an unreadable DOB → no age').toHaveText(exact('—'));

    const sec = section(page, /^Age$/);
    await sec.locator('.sec-head').click();
    await page.getByTestId('pi-filter-age-min').fill('40');
    await expectCount(page, 1);
    await expectRows(page, [N.CH]);
    await expect(chip(page, 'Age: 40 or older')).toHaveCount(1);

    await page.getByTestId('pi-filter-age-max').fill('35');
    await expect(sec, 'PI-06: a reversed range is flagged').toContainText('Min is larger than max.');
    await expectCount(page, 6); // …and not applied

    await page.getByTestId('pi-filter-age-min').fill('');
    await expectCount(page, 1);
    await expectRows(page, [N.BR]);
  });

  test('PI-07 the round-5 insight cards count only active / non-active people with the gap', async ({ page }) => {
    await open(page);
    const card = (label: string) => page.locator('app-signals-panel button.card').filter({ has: page.locator('.label', { hasText: exact(label) }) });
    const cases: [string, string[]][] = [
      // Bravo's onboarding is false (set); Delta / Echo are out by status
      ['Onboarding status not updated', [N.AL, N.CH]],
      // Foxtrot's DOB is unreadable; Delta / Echo have none but are out by status
      ['Age not updated', [N.AL, N.FX]],
      // Echo has no Watson status but is discontinued
      ['Active / non active customer, no finance status', [N.FX]],
    ];
    for (const [label, expected] of cases) {
      await card(label).click(); // starts a fresh view: filters and search are cleared
      await expect(card(label)).toHaveClass(/\bactive\b/);
      await expect(page.locator('.table-meta .insight')).toContainText(label);
      await topSearch(page).fill(PI_SEARCH);
      await expectCount(page, expected.length);
      await expectRows(page, expected);
      await page.getByTestId('pi-insight-clear').click();
      await expect(page.getByTestId('pi-insight-clear'), `PI-07: ${label} cleared`).toHaveCount(0);
      await expectCount(page, 6);
    }
  });

  test('PI-08 same-name events are one option; Attended matches either id, Confirmed only the approved request', async ({ page }) => {
    await open(page);
    await narrow(page);
    const sec = section(page, /^Event · /);
    await sec.locator('.sec-head').click();
    await expect(sec.locator('.sec-label')).toHaveText('Event · Attended');
    await sec.getByTestId('pi-filter-event-search').fill(PI_SEARCH);
    const opts = sec.getByTestId('pi-filter-option');
    await expect(opts, 'PI-08: three seeded events, two names → two options').toHaveCount(2);
    const shared = opts.filter({ hasText: N.EV_SHARED });
    await expect(shared.locator('.opt-count'), 'PI-08: Alpha (old id) + Bravo (new id) under one option').toHaveText('(2)');
    await expect(opts.filter({ hasText: N.EV_SOLO }).locator('.opt-count')).toHaveText('(1)');

    await include(shared);
    await expectCount(page, 2);
    await expectRows(page, [N.AL, N.BR]); // Charlie attended the other event
    await expect(chip(page, `Attended: ${N.EV_SHARED}`)).toHaveCount(1);

    await sec.getByTestId('pi-filter-event-confirmed').click();
    await expect(sec.locator('.sec-label')).toHaveText('Event · Confirmed');
    await expectCount(page, 1);
    await expectRows(page, [N.DE]); // Echo's request is pending; Alpha / Bravo only attended
    await expect(shared.locator('.opt-count')).toHaveText('(1)');
    await expect(chip(page, `Confirmed for: ${N.EV_SHARED}`)).toHaveCount(1);

    await sec.getByTestId('pi-filter-event-attended').click();
    await expectCount(page, 2);
  });

  test('PI-09 the queue section switches Completed ↔ Live and searches its own options', async ({ page }) => {
    await open(page);
    const sec = section(page, /^Queue · /);
    await sec.locator('.sec-head').click();
    await expect(sec.locator('.sec-label')).toHaveText('Queue · Completed');
    await expect(sec).toContainText('Participants who completed the ticked queues.');
    await sec.getByTestId('pi-filter-queue-live').click();
    await expect(sec.getByTestId('pi-filter-queue-live')).toHaveClass(/\bon\b/);
    await expect(sec.locator('.sec-label')).toHaveText('Queue · Live');
    await expect(sec).toContainText('Participants currently in the ticked queues.');
    await sec.getByTestId('pi-filter-queue-search').fill(PI_SEARCH);
    await expect(sec.getByTestId('pi-filter-option'), 'PI-09: no queue is seeded under the run prefix').toHaveCount(0);
    await expect(sec).toContainText('No matches.');
    await expect(page.getByTestId('pi-count'), 'PI-09: a switch with nothing ticked filters nothing')
      .toHaveText(/^\s*([\d,]+) of \1 participants\s*$/);
    await sec.getByTestId('pi-filter-queue-completed').click();
    await expect(sec.locator('.sec-label')).toHaveText('Queue · Completed');
  });

  test('PI-10 the rail search surfaces the live journey segment (never the inactive one) and its saved list filters', async ({ page }) => {
    await open(page);
    await narrow(page);
    await page.getByTestId('pi-filter-search').fill(PI_SEARCH);
    await expect(section(page, /^Customer status$/), 'PI-10: sections with no match are hidden').toHaveCount(0);
    const sec = section(page, /^Journey segment$/);
    const opts = sec.getByTestId('pi-filter-option');
    await expect(opts).toHaveCount(1);
    await expect(opts).toContainText(N.SB_ON);
    await expect(opts.locator('.opt-hint')).toHaveText(/^\s*updated /);
    await expect(page.locator('app-filter-rail'), 'PI-10: an inactive segment is never an option').not.toContainText(N.SB_OFF);

    await include(opts);
    await expectCount(page, 2);
    await expectRows(page, [N.BR, N.DE]); // Alpha is only in the inactive segment's stale list

    await page.getByRole('button', { name: 'Clear filter search', exact: true }).click();
    await expect(section(page, /^Customer status$/)).toHaveCount(1);
    await expectCount(page, 2);
  });

  test('PI-11 product-count rules: a consumed rule follows its condition, an incomplete one is ignored, unconsumed is separate', async ({ page }) => {
    await open(page);
    await narrow(page);
    await section(page, /^Product activity$/).locator('.sec-head').click();
    const consumed = page.getByTestId('pi-filter-consumed');
    await consumed.getByTestId('pi-filter-rule-add').click();
    const rule = consumed.getByTestId('pi-filter-rule');
    await expect(rule).toHaveCount(1);
    await rule.getByTestId('pi-filter-rule-product').selectOption(ID.P1);
    await expectCount(page, 2); // at least 1 (the default)
    await expectRows(page, [N.BR, N.CH]);

    await rule.getByTestId('pi-cond-a').fill('2');
    await expectRows(page, [N.BR]); // Bravo consumed P1 twice, Charlie once

    await rule.getByTestId('pi-cond-op').selectOption('exact');
    await rule.getByTestId('pi-cond-a').fill('1');
    await expectRows(page, [N.CH]);

    await rule.getByTestId('pi-cond-op').selectOption('between');
    await expect(rule.getByTestId('pi-cond-b')).toBeVisible();
    await expectCount(page, 6); // "between 1 and …" is incomplete → not applied
    await rule.getByTestId('pi-cond-b').fill('2');
    await expectRows(page, [N.BR, N.CH]);
    await expect(chip(page, ': between 1 and 2')).toHaveCount(1);

    await rule.getByTestId('pi-filter-rule-remove').click();
    await expect(rule).toHaveCount(0);
    await expectCount(page, 6);

    const unconsumed = page.getByTestId('pi-filter-unconsumed');
    await unconsumed.getByTestId('pi-filter-rule-add').click();
    await unconsumed.getByTestId('pi-filter-rule').getByTestId('pi-filter-rule-product').selectOption(ID.P1);
    await expectRows(page, [N.EC]);
    await expect(consumed.getByTestId('pi-filter-rule'), 'PI-11: the unconsumed rule did not land in the consumed block').toHaveCount(0);
  });

  // ---------------------------------------------------------------------------------------------
  // Audiences
  // ---------------------------------------------------------------------------------------------

  test('PI-12 a list narrows to its members, filters refine it, its chip drops it; a segment is the union of its lists', async ({ page }) => {
    await open(page);
    const trigger = page.getByTestId('pi-aud-trigger');
    await expect(trigger).toContainText('All participants');
    const item = (name: string) => page.locator('.aud-item').filter({ has: page.locator('.aud-name', { hasText: exact(name) }) });

    await trigger.click();
    const tabs = page.getByTestId('pi-aud-tab');
    await expect(tabs, 'PI-12: lists and segments only (saved filters live in the rail)').toHaveCount(2);
    await expect(tabs.first()).toHaveClass(/\bon\b/);
    await page.getByTestId('pi-aud-search').fill(PI_SEARCH);
    await expect(item(N.LIST).locator('.aud-count')).toHaveText('2');
    await item(N.LIST).click();
    await expect(page.getByTestId('pi-chip-audience')).toContainText(`List: ${N.LIST}`);
    await expectCount(page, 2);
    await expectRows(page, [N.AL, N.CH]);

    const sec = section(page, /^Customer status$/);
    await sec.locator('.sec-head').click();
    await include(option(sec, 'Non active'));
    await expectRows(page, [N.CH]);
    await expect(trigger, 'PI-12: the label says the list is refined').toContainText('+ 1 filter');

    await page.getByTestId('pi-chip-audience').click();
    await expect(page.getByTestId('pi-chip-audience')).toHaveCount(0);
    await topSearch(page).fill(PI_SEARCH);
    await expectRows(page, [N.CH, N.FX]); // the status filter stayed

    await trigger.click();
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveClass(/\bon\b/);
    await page.getByTestId('pi-aud-search').fill(PI_SEARCH);
    await expect(item(N.SEG).locator('.aud-count')).toHaveText('3');
    await item(N.SEG).click();
    await expect(page.getByTestId('pi-chip-audience')).toContainText(`Segment: ${N.SEG}`);
    await expectCount(page, 3);
    await expectRows(page, [N.AL, N.CH, N.EC]);
  });

  test('PI-13 a seeded saved filter loads from the rail, flags itself modified, and Update writes the new statuses', async ({ page }) => {
    await open(page);
    await page.getByTestId('pi-rail-saved-search').fill(PI_SEARCH);
    const saved = page.getByTestId('pi-rail-saved-item');
    await expect(saved).toHaveCount(1);
    await expect(saved).toContainText(N.SQ);
    await saved.click();
    await expect(saved).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('pi-aud-trigger')).toContainText(N.SQ);

    await topSearch(page).fill(PI_SEARCH);
    await expectRows(page, [N.CH, N.FX]);
    await expect(page.getByTestId('pi-aud-update'), 'PI-13: the search is not part of a saved filter').toHaveCount(0);

    const sec = section(page, /^Customer status$/);
    await sec.locator('.sec-head').click();
    await include(option(sec, 'Active'));
    await expectRows(page, [N.AL, N.BR, N.CH, N.FX]);
    await expect(saved).toContainText('modified');

    // Update asks first and shows saved-now vs after; Cancel writes nothing
    const confirm = page.locator('app-confirm-dialog');
    await page.getByTestId('pi-aud-update').click();
    await expect(confirm.getByTestId('pi-confirm-before'), 'PI-13: saved now').toContainText('Status: Non active');
    await expect(confirm.getByTestId('pi-confirm-added'), 'PI-13: the update adds Active').toHaveText(/Status: Active/);
    await expect(confirm.getByTestId('pi-confirm-removed'), 'PI-13: nothing removed').toHaveCount(0);
    await confirm.getByTestId('pi-confirm-cancel').click();
    await expect(confirm).toHaveCount(0);
    expect((await getDoc('searchquery', PI.SQ))!.customerstatus, 'PI-13: Cancel wrote nothing').toEqual(['non active']);
    await expect(page.getByTestId('pi-aud-update'), 'PI-13: still modified').toHaveCount(1);

    await page.getByTestId('pi-aud-update').click();
    await confirm.getByTestId('pi-confirm-ok').click();

    const doc = await pollUntil(
      () => getDoc('searchquery', PI.SQ),
      (d) => Array.isArray(d?.customerstatus) && (d!.customerstatus as string[]).includes('active'),
      { label: 'PI-13: the saved filter gains "active"', timeoutMs: 30_000 },
    );
    expect([...(doc!.customerstatus as string[])].sort()).toEqual(['active', 'non active']);
    expect(doc!.pifilter, 'PI-13: the screen-only keys are written alongside the analytics keys').toBeTruthy();
    expect(doc!.testrunid, 'PI-13: mergeFields keeps the run tag').toBe(TESTRUNID);
    await expect(page.getByTestId('pi-aud-update'), 'PI-13: saved → no longer modified').toHaveCount(0);
  });

  test('PI-14 Manage audiences opens on saved filters, renames one, and offers Update only for saved filters', async ({ page }) => {
    await open(page);
    await page.getByTestId('pi-rail-saved-manage').click();
    const dlg = page.locator('app-manage-audiences-dialog');
    const tabs = dlg.getByTestId('pi-manage-tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.first(), 'PI-14: opened from the rail → Saved filters tab').toHaveClass(/\bon\b/);
    const row = (name: string) => dlg.locator('tbody tr').filter({ has: page.locator('button.link', { hasText: exact(name) }) });

    await expect(row(N.SQ).getByTestId('pi-manage-update')).toHaveCount(1);
    await row(N.SQ).getByTestId('pi-manage-rename').click();
    const prompt = page.locator('app-prompt-dialog');
    const renamed = `${N.SQ} Renamed`;
    await prompt.locator('input').fill(renamed);
    await prompt.getByRole('button', { name: 'Rename' }).click();
    await pollUntil(() => getDoc('searchquery', PI.SQ), (d) => d?.label === renamed,
      { label: 'PI-14: the saved filter label is renamed', timeoutMs: 30_000 });
    await expect(row(renamed)).toHaveCount(1);

    await tabs.nth(1).click();
    await expect(row(N.LIST).getByTestId('pi-manage-rename')).toHaveCount(1);
    await expect(row(N.LIST).getByTestId('pi-manage-update'), 'PI-14: lists have no filter to update').toHaveCount(0);
    await tabs.nth(2).click();
    await expect(row(N.SEG)).toHaveCount(1);
    await expect(row(N.SEG).getByTestId('pi-manage-rename'), 'PI-14: segments cannot be renamed here').toHaveCount(0);
    await dlg.getByRole('button', { name: 'Done' }).click();
  });

  // ---------------------------------------------------------------------------------------------
  // Tags (round 5 #3) and the bulk bar
  // ---------------------------------------------------------------------------------------------

  async function openTagManager(page: Page) {
    await open(page);
    await narrow(page);
    await select(page, N.AL);
    await page.getByTestId('pi-bulk-org').click();
    await page.getByTestId('pi-bulk-tags').click();
    const dlg = page.locator('app-tag-manager-dialog');
    await expect(dlg).toBeVisible();
    const tagRow = (name: string) => dlg.locator('.tagrow').filter({ has: page.locator('.tname', { hasText: exact(name) }) });
    return { dlg, tagRow };
  }

  test('PI-15 a held tag cannot be deleted until "Remove from all" clears its holders; then Delete removes the doc', async ({ page }) => {
    const { dlg, tagRow } = await openTagManager(page);
    const held = tagRow(N.TAG_HELD);
    await expect(held.getByTestId('pi-tag-count'), 'PI-15: Alpha + Bravo hold it').toHaveText('2');
    await expect(tagRow(N.TAG_KEEP).getByTestId('pi-tag-count')).toHaveText('1');

    await held.getByTestId('pi-tag-edit-for').click();
    await expect(held.getByTestId('pi-tag-edit-for')).toHaveAttribute('aria-expanded', 'true');
    const del = dlg.getByTestId('pi-tag-delete');
    const removeAll = dlg.getByTestId('pi-tag-remove-all');
    await expect(del, 'PI-15: delete is gated while anyone holds the tag').toBeDisabled();
    await expect(removeAll).toContainText('Remove from all 2');

    await removeAll.click();
    await expect(dlg.locator('.tagdanger')).toContainText(`Remove “${N.TAG_HELD}” from all 2 participants?`);
    await dlg.getByTestId('pi-tag-cancel').click();
    await expect(removeAll).toBeVisible();
    expect((await getDoc('participant metadata', PI.AL))!.profiletags, 'PI-15: cancel writes nothing').toContain(PI.TAG_HELD);

    await removeAll.click();
    await dlg.getByTestId('pi-tag-confirm').click();
    for (const pid of [PI.AL, PI.BR]) {
      await pollUntil(() => getDoc('participant metadata', pid),
        (d) => Array.isArray(d?.profiletags) && !(d!.profiletags as string[]).includes(PI.TAG_HELD),
        { label: `PI-15: ${pid} no longer holds the tag`, timeoutMs: 30_000 });
    }
    expect((await getDoc('participant metadata', PI.CH))!.profiletags, 'PI-15: another tag is untouched').toEqual([PI.TAG_KEEP]);
    expect(await getDoc('participant tags', PI.TAG_HELD), 'PI-15: removing from all is not deleting').not.toBeNull();
    await expect(held.getByTestId('pi-tag-count')).toHaveText('0');
    await expect(removeAll).toHaveCount(0);
    await expect(del).toBeEnabled();

    await del.click();
    await expect(dlg.locator('.tagdanger')).toContainText(`Delete “${N.TAG_HELD}” permanently?`);
    await dlg.getByTestId('pi-tag-confirm').click();
    await pollUntil(() => getDoc('participant tags', PI.TAG_HELD), (d) => d === null,
      { label: 'PI-15: the tag doc is hard-deleted', timeoutMs: 30_000 });
    await expect(held).toHaveCount(0);
    expect(await getDoc('participant tags', PI.TAG_KEEP), 'PI-15: only that tag is deleted').not.toBeNull();
  });

  test('PI-16 a tag keeps at least one "tag for", edits persist, and create is gated on a fresh name + a "tag for"', async ({ page }) => {
    const { dlg, tagRow } = await openTagManager(page);
    const keep = tagRow(N.TAG_KEEP);
    await keep.getByTestId('pi-tag-edit-for').click();
    const opts = dlg.getByTestId('pi-tag-edit-option');
    const opt = (label: string) => opts.filter({ hasText: exact(label) });
    await expect(opts).toHaveCount(4);
    await expect(opt('live event')).toHaveAttribute('aria-pressed', 'true');
    await expect(opt('live event'), 'PI-16: the last "tag for" cannot be switched off').toBeDisabled();
    await expect(dlg.getByTestId('pi-tag-delete'), 'PI-16: Charlie holds it').toBeDisabled();

    await opt('queue event').click();
    await pollUntil(() => getDoc('participant tags', PI.TAG_KEEP),
      (d) => JSON.stringify(d?.tagsfor) === JSON.stringify(['live event', 'queue event']),
      { label: 'PI-16: tagsfor gains "queue event"', timeoutMs: 30_000 });
    await expect(opt('live event')).toBeEnabled();
    await expect(keep.locator('.forbadge')).toHaveText(['live event', 'queue event']);

    // create: gated, not clicked — persistNewTag writes `tg-<ms>` with no testrunid, which teardown cannot sweep
    const create = dlg.getByTestId('pi-tag-create');
    await expect(create).toBeDisabled();
    await dlg.getByPlaceholder('Tag name').fill(N.TAG_KEEP.toUpperCase());
    await dlg.getByTestId('pi-tag-for').first().click();
    await expect(dlg.getByTestId('pi-tag-for').first()).toHaveAttribute('aria-pressed', 'true');
    await expect(dlg.locator('.create .hint'), 'PI-16: names are unique case-insensitively').toContainText('already exists');
    await expect(create).toBeDisabled();
    await dlg.getByPlaceholder('Tag name').fill(`${PI_SEARCH}Fresh Tag`);
    await expect(create).toBeEnabled();
  });

  test('PI-17 bulk actions act on filtered ∩ selected only: the bar counts it, a remark lands only there, reports export it', async ({ page }) => {
    await open(page);
    await narrow(page);
    await select(page, N.AL);
    await select(page, N.CH);
    const bar = page.locator('app-bulk-action-bar .bar');
    await expect(bar.locator('.count .num')).toHaveText('2');

    const sec = section(page, /^Customer status$/);
    await sec.locator('.sec-head').click();
    await include(option(sec, 'Non active')); // hides Alpha
    await expectRows(page, [N.CH, N.FX]);
    await expect(bar.locator('.count .num'), 'PI-17: a selected row hidden by the filter is out of scope').toHaveText('1');
    await expect(bar.locator('.hidden')).toHaveText(/1 hidden by filters/);

    // each menu lists its actions (the composers they open are covered by the analytics suites)
    const menus: [Locator, Locator[]][] = [
      [page.getByTestId('pi-bulk-comm'), [page.getByTestId('pi-bulk-email'), page.getByTestId('pi-bulk-whatsapp'),
        page.getByTestId('pi-bulk-notify'), page.getByTestId('pi-bulk-wati-messages'), page.getByTestId('pi-bulk-broadcast'),
        page.getByTestId('pi-bulk-wati-config')]],
      [page.getByTestId('pi-bulk-org'), [page.getByTestId('pi-bulk-tags'), page.getByTestId('pi-bulk-make-list'),
        page.getByTestId('pi-bulk-manage-lists')]],
      [page.getByTestId('pi-bulk-app'), [page.getByTestId('pi-bulk-recommend'), page.getByTestId('pi-bulk-view-recommended'),
        page.getByTestId('pi-bulk-interim'), page.getByTestId('pi-bulk-wishlist'), page.getByTestId('pi-bulk-app-action-pending')]],
      [page.getByTestId('pi-bulk-upd'), [page.getByTestId('pi-bulk-remarks'), page.getByTestId('pi-bulk-subscription'),
        page.getByTestId('pi-bulk-add-product')]],
      [page.getByTestId('pi-bulk-reports'), [page.getByTestId('pi-bulk-evolution'), page.getByTestId('pi-bulk-export-selection'),
        page.getByTestId('pi-bulk-export-table'), page.getByTestId('pi-bulk-content')]],
    ];
    for (const [trigger, items] of menus) {
      await trigger.click();
      for (const it of items) await expect(it).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(items[0]).toBeHidden();
    }

    // View recommended needs no selection: it adds the three recommended-playlist columns
    await page.getByTestId('pi-bulk-app').click();
    await page.getByTestId('pi-bulk-view-recommended').click();
    await expect(page.locator('app-participant-table .thead .th-label').filter({ hasText: 'EIFLIX (recommended)' })).toHaveCount(1);

    // a remark goes to Charlie (in scope), never to Alpha (selected but filtered out)
    const note = `PI-17 remark ${Date.now()}`;
    await page.getByTestId('pi-bulk-upd').click();
    await page.getByTestId('pi-bulk-remarks').click();
    const remarks = page.locator('app-remarks-dialog');
    await expect(remarks).toContainText('Applies to 1 selected participant.');
    await remarks.locator('textarea').fill(note);
    await remarks.getByRole('button', { name: /Add to 1/ }).click();
    await pollUntil(() => getDoc('participant metadata', PI.CH),
      (d) => Array.isArray(d?.remarks) && (d!.remarks as { note?: string }[]).some((r) => r.note === note),
      { label: 'PI-17: Charlie gets the remark', timeoutMs: 30_000 });
    expect((await getDoc('participant metadata', PI.AL))!.remarks, 'PI-17: Alpha (hidden) gets nothing').toEqual([]);

    // reports
    await page.getByTestId('pi-bulk-reports').click();
    await page.getByTestId('pi-bulk-evolution').click();
    const evo = page.locator('app-evolution-dialog');
    await expect(evo.locator('tbody tr')).toHaveCount(1);
    await expect(evo.locator('tbody tr')).toContainText(N.CH);
    await evo.getByRole('button', { name: 'Close', exact: true }).click();

    let download = page.waitForEvent('download');
    await page.getByTestId('pi-bulk-reports').click();
    await page.getByTestId('pi-bulk-export-selection').click();
    expect((await download).suggestedFilename()).toMatch(/^participants_selection_\d{4}-\d{2}-\d{2}\.xlsx$/);
    await expect(page.getByText('Exported 1 participants')).toBeVisible();

    download = page.waitForEvent('download');
    await page.getByTestId('pi-bulk-reports').click();
    await page.getByTestId('pi-bulk-export-table').click();
    expect((await download).suggestedFilename()).toMatch(/^participants_\d{4}-\d{2}-\d{2}\.xlsx$/);
    await expect(page.getByText('Exported 2 participants'), 'PI-17: Export Table covers the filtered rows').toBeVisible();

    await page.getByTestId('pi-bulk-reports').click();
    await page.getByTestId('pi-bulk-content').click();
    await expect(page.getByText('No content consumption for these participants')).toBeVisible();
  });

  // ---------------------------------------------------------------------------------------------
  // 2026-10-21: match all / any, pipelines, confirm-before-update, product subscription, soft delete
  // ---------------------------------------------------------------------------------------------

  test('PI-18 two consumed rules: Match all needs both, Match any either, and the switch only shows with two rules', async ({ page }) => {
    await open(page);
    await narrow(page);
    await section(page, /^Product activity$/).locator('.sec-head').click();
    const consumed = page.getByTestId('pi-filter-consumed');
    const all = consumed.getByTestId('pi-filter-rule-match-all');
    const any = consumed.getByTestId('pi-filter-rule-match-any');
    const rules = consumed.getByTestId('pi-filter-rule');

    await consumed.getByTestId('pi-filter-rule-add').click();
    await rules.nth(0).getByTestId('pi-filter-rule-product').selectOption(ID.P1);
    await rules.nth(0).getByTestId('pi-cond-a').fill('2');
    await expectRows(page, [N.BR]);
    await expect(all, 'PI-18: one rule → no match switch').toHaveCount(0);

    await consumed.getByTestId('pi-filter-rule-add').click();
    await rules.nth(1).getByTestId('pi-filter-rule-product').selectOption(ID.P1);
    await rules.nth(1).getByTestId('pi-cond-op').selectOption('exact');
    await rules.nth(1).getByTestId('pi-cond-a').fill('1');
    await expect(all, 'PI-18: Match all is the default').toHaveClass(/\bon\b/);
    await expectCount(page, 0); // nobody consumed P1 both twice-or-more and exactly once

    await any.click();
    await expect(any).toHaveClass(/\bon\b/);
    await expectRows(page, [N.BR, N.CH]); // Bravo (2) or Charlie (1); the other four consumed none
    await expect(page.locator('app-active-filter-chips .chip').filter({ hasText: /\(any\)/ }), 'PI-18: each chip says it is one of several').toHaveCount(2);

    await all.click();
    await expectCount(page, 0);
  });

  test('PI-19 pipelines: two saved filters become two columns; in every / not in every list unique names to select and message', async ({ page }) => {
    await open(page);
    await page.getByTestId('pi-pipelines').click();
    const dlg = page.locator('app-pipelines-dialog');
    await expect(dlg.getByTestId('pi-pipe-empty'), 'PI-19: nothing picked yet').toBeVisible();

    await dlg.getByTestId('pi-pipe-filter-search').fill(`-${TESTRUNID}-`);
    const pick = (name: string) => dlg.getByTestId('pi-pipe-filter').filter({ hasText: exact(name) });
    await pick(N.SQ).click();
    await expect(dlg.getByTestId('pi-pipe-mode-every'), 'PI-19: one pipeline → no "every"').toBeDisabled();
    await expect(dlg.getByTestId('pi-pipe-mode-not-every')).toBeDisabled();
    await pick(N.SQ2).click();
    await dlg.getByTestId('pi-pipe-search').fill(PI_SEARCH); // the shared project has other matches; only the six count

    const cols = dlg.getByTestId('pi-pipe-column');
    await expect(cols, 'PI-19: one column per picked filter').toHaveCount(2);
    const names = async (col: Locator) => (await col.getByTestId('pi-pipe-name').allInnerTexts()).map((t) => t.trim()).sort();
    await expect(cols.nth(0).getByTestId('pi-pipe-column-count')).toHaveText('2');
    expect(await names(cols.nth(0)), 'PI-19: Saved Non Active = Charlie, Foxtrot').toEqual([N.CH, N.FX].sort());
    await expect(cols.nth(1).getByTestId('pi-pipe-column-count')).toHaveText('4');
    expect(await names(cols.nth(1)), 'PI-19: Regular = Alpha, Bravo, Charlie, Delta').toEqual([N.AL, N.BR, N.CH, N.DE].sort());
    await expect(dlg.getByTestId('pi-pipe-total')).toHaveText('5 unique names');
    await expect(dlg, 'PI-19: Echo is in neither pipeline').not.toContainText(N.EC);

    await dlg.getByTestId('pi-pipe-mode-every').click();
    const unique = dlg.getByTestId('pi-pipe-unique');
    await expect(unique.getByTestId('pi-pipe-unique-row'), 'PI-19: only Charlie is in both').toHaveText([new RegExp(esc(N.CH))]);
    await expect(dlg.getByTestId('pi-pipe-total')).toHaveText('1 unique name');

    await dlg.getByTestId('pi-pipe-mode-not-every').click();
    const rows = unique.getByTestId('pi-pipe-unique-row');
    await expect(rows.locator('.u-name'), 'PI-19: the rest, each once, A–Z').toHaveText([N.AL, N.BR, N.DE, N.FX].map(exact));
    await expect(rows.filter({ hasText: N.FX }).locator('.u-in .tag'), 'PI-19: Foxtrot is only in Saved Non Active').toHaveText([exact(N.SQ)]);

    await expect(dlg.getByTestId('pi-pipe-comm'), 'PI-19: nothing selected → no communication').toBeDisabled();
    await rows.first().getByTestId('pi-pipe-unique-check').check();
    await expect(dlg.getByTestId('pi-pipe-selected')).toHaveText('1 selected');
    await dlg.getByTestId('pi-pipe-select-all').check();
    await expect(dlg.getByTestId('pi-pipe-selected')).toHaveText('4 selected');
    await dlg.getByTestId('pi-pipe-comm').click();
    await expect(page.getByTestId('pi-pipe-email'), 'PI-19: the Communication menu offers the bulk channels').toBeVisible();
    await expect(page.getByTestId('pi-pipe-whatsapp')).toBeVisible();
    await page.keyboard.press('Escape'); // nothing is sent
    await expect(page.getByTestId('pi-pipe-email')).toHaveCount(0);

    // All names brings the columns back (and the unique list's selection footer goes)
    await dlg.getByTestId('pi-pipe-mode-all').click();
    await expect(cols, 'PI-19: All names → columns again').toHaveCount(2);
    await expect(dlg.getByTestId('pi-pipe-unique')).toHaveCount(0);
    await expect(dlg.getByTestId('pi-pipe-selected')).toHaveCount(0);
  });

  test('PI-20 Update from Manage audiences shows what it would remove, and says so when nothing changes', async ({ page }) => {
    await open(page);
    const manage = page.locator('app-manage-audiences-dialog');
    const confirm = page.locator('app-confirm-dialog');
    const row = (name: string) => manage.locator('tbody tr').filter({ has: page.locator('button.link', { hasText: exact(name) }) });

    // no filters applied → updating would drop the saved status
    await page.getByTestId('pi-rail-saved-manage').click();
    await row(N.SQ).getByTestId('pi-manage-update').click();
    await expect(confirm.getByTestId('pi-confirm-removed')).toHaveText(/Status: Non active/);
    await expect(confirm.getByTestId('pi-confirm-after')).toContainText('No filters');
    await expect(confirm.getByTestId('pi-confirm-unchanged')).toHaveCount(0);
    await confirm.getByTestId('pi-confirm-cancel').click();
    expect((await getDoc('searchquery', PI.SQ))!.customerstatus, 'PI-20: Cancel wrote nothing').toEqual(['non active']);
    await manage.getByRole('button', { name: 'Done' }).click();

    // the saved filter loaded as-is → nothing would change
    await page.getByTestId('pi-rail-saved-search').fill(PI_SEARCH);
    await page.getByTestId('pi-rail-saved-item').click();
    await page.getByTestId('pi-rail-saved-manage').click();
    await row(N.SQ).getByTestId('pi-manage-update').click();
    await expect(confirm.getByTestId('pi-confirm-unchanged'), 'PI-20: same filters → says so').toBeVisible();
    await expect(confirm.getByTestId('pi-confirm-added')).toHaveCount(0);
    await expect(confirm.getByTestId('pi-confirm-removed')).toHaveCount(0);
    await confirm.getByTestId('pi-confirm-cancel').click();
  });

  test('PI-21 product subscription: Start between keeps one row per person with a live doc starting in the range; cancelled and out-of-range docs drop', async ({ page }) => {
    await open(page);
    await topSearch(page).fill(PSUB_SEARCH);
    await expectCount(page, 4);
    const sec = section(page, /^Product subscription$/);
    await sec.locator('.sec-head').click();

    const product = `TEST Product ${TESTRUNID}`;
    const search = page.getByTestId('pi-filter-psub-product-search');
    await search.click();
    await search.fill(product);
    await page.getByTestId('pi-filter-psub-product-option').filter({ hasText: exact(product) }).click();
    await expect(sec, 'PI-21: a product alone applies nothing').toContainText('Pick a date range to apply it.');
    await expectCount(page, 4);

    await page.getByTestId('pi-filter-psub-relation').click();
    await page.getByTestId('pi-filter-psub-relation-option').filter({ hasText: exact('Start between') }).click();

    // the app's native date adapter reads M/D/YYYY; the seed dated the docs relative to today
    const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`; };
    await page.getByTestId('pi-filter-psub-from').fill(day(-15));
    await page.getByTestId('pi-filter-psub-from').press('Tab');
    await page.getByTestId('pi-filter-psub-to').fill(day(-5));
    await page.getByTestId('pi-filter-psub-to').press('Tab');

    // Alpha (starts -10) and Delta (two docs, -8 and -12 → one row); Bravo's doc is Cancelled, Charlie's starts -40
    await expectRows(page, [PSUB_NAME.A, PSUB_NAME.D]);
    await expect(chip(page, `${product} · Start between:`)).toHaveCount(1);

    await page.getByTestId('pi-filter-psub-clear').click();
    await expectCount(page, 4);
  });

  test('PI-22 deleting a saved filter asks first, then soft-deletes it: the doc stays, flagged, and the screen no longer lists it', async ({ page }) => {
    await open(page);
    const manage = page.locator('app-manage-audiences-dialog');
    const confirm = page.locator('app-confirm-dialog');
    const row = (name: string) => manage.locator('tbody tr').filter({ has: page.locator('button.link', { hasText: exact(name) }) });
    await page.getByTestId('pi-rail-saved-manage').click();
    await expect(row(N.SQ_DEL)).toHaveCount(1);

    await row(N.SQ_DEL).getByTestId('pi-manage-delete').click();
    await expect(confirm).toContainText(N.SQ_DEL);
    await confirm.getByTestId('pi-confirm-cancel').click();
    expect((await getDoc('searchquery', PI.SQ_DEL))!.isdeleted, 'PI-22: Cancel deletes nothing').toBeUndefined();
    await expect(row(N.SQ_DEL)).toHaveCount(1);

    await row(N.SQ_DEL).getByTestId('pi-manage-delete').click();
    await confirm.getByTestId('pi-confirm-ok').click();
    await expect(row(N.SQ_DEL), 'PI-22: gone from the dialog').toHaveCount(0);
    const d = await pollUntil(() => getDoc('searchquery', PI.SQ_DEL), (x) => x?.isdeleted === true,
      { label: 'PI-22: the doc is flagged isdeleted', timeoutMs: 30_000 });
    expect(d, 'PI-22: soft — the doc still exists').toBeTruthy();
    expect(d!.deletedby, 'PI-22: who deleted it').toBe(PF.admin);
    expect(d!.deleteddate, 'PI-22: when').toBeTruthy();
    expect(d!.label, 'PI-22: nothing else changed').toBe(N.SQ_DEL);

    await manage.getByRole('button', { name: 'Done' }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Loading participants…')).toHaveCount(0, { timeout: 60_000 });
    await page.getByTestId('pi-rail-saved-manage').click();
    await expect(row(N.SQ), 'PI-22: the dialog loaded').toHaveCount(1);
    await expect(row(N.SQ_DEL), 'PI-22: a soft-deleted filter is skipped on load').toHaveCount(0);
  });
});

// ADDR — hooks no case drives yet, and why:
//  • ATC / uP! / CPM counts: the seed keeps `atccount` null (ATC data is off-limits, and a number would
//    light up ATC branches on the analytics/profile screens), and uP!/CPM counts are derived from
//    production product ids (UP_LIVE_PRODUCT_IDS / CPM_PRODUCT_IDS) the test project does not seed.
//    The count-condition component itself is driven through the product rules in PI-11.
//  • Subscription dates: a Material date-range picker whose typed format follows the browser locale;
//    driving it needs the picker's calendar, and the legacy-range notice needs an analytics-shaped saved
//    filter with BOTH ranges. Both are deferred to a follow-up with a seeded subscription matrix.
test.fixme('PI-ADDR1 count and subscription-date filter hooks addressable (deferred behavioral)', async ({ page }) => {
  await page.goto('/participant-intelligence', { waitUntil: 'domcontentloaded' });
  expect(page.getByTestId('pi-filter-atc-count')).toBeTruthy();
  expect(page.getByTestId('pi-filter-up-status')).toBeTruthy();
  expect(page.getByTestId('pi-filter-up-count')).toBeTruthy();
  expect(page.getByTestId('pi-filter-cpm-count')).toBeTruthy();
  expect(page.getByTestId('pi-filter-sub-relation')).toBeTruthy();
  expect(page.getByTestId('pi-filter-sub-range')).toBeTruthy();
  expect(page.getByTestId('pi-filter-sub-from')).toBeTruthy();
  expect(page.getByTestId('pi-filter-sub-to')).toBeTruthy();
  expect(page.getByTestId('pi-filter-sub-legacy')).toBeTruthy();
  expect(page.getByTestId('pi-filter-sub-clear')).toBeTruthy();
});

// PI-ADDR2 — hooks restored on 2026-10-14 to controls v5 shipped without one (the rollout gate's "interactive element
// with no data-testid"). PI-02/03/04 already drive these controls by role/label; registered here by id.
test.fixme('PI-ADDR2 restored search-clear / checklists / refresh / checklist hooks addressable (driven by role in PI-02..04)', async ({ page }) => {
  await page.goto('/participant-intelligence', { waitUntil: 'domcontentloaded' });
  expect(page.getByTestId('pi-search-clear')).toBeTruthy();
  expect(page.getByTestId('pi-checklists')).toBeTruthy();
  expect(page.getByTestId('pi-refresh')).toBeTruthy();
  expect(page.getByTestId('pi-checklists-watson-heading')).toBeTruthy();
  expect(page.getByTestId('pi-checklists-recon-heading')).toBeTruthy();
  expect(page.getByTestId('pi-checklist-item')).toBeTruthy();
});

// PI-ADDR3 — 2026-10-21 hooks no case drives: the uP! attendance pills (uP! counts are not seeded), the
// Subscription-dates relation options (the date-range filter is not driven, see PI-ADDR1), the product
// subscription's field / range wrappers and its transient loading / index-missing states (the emulator
// needs no index, so the error never shows), the unticked-row checkbox path and the four remaining
// Communication menu items (opening one would start a send).
test.fixme('PI-ADDR3 2026-10-21 controls addressable (deferred behavioral)', async ({ page }) => {
  await page.goto('/participant-intelligence', { waitUntil: 'domcontentloaded' });
  expect(page.getByTestId('pi-filter-up-status-include')).toBeTruthy();
  expect(page.getByTestId('pi-filter-up-status-exclude')).toBeTruthy();
  expect(page.getByTestId('pi-filter-sub-relation-option')).toBeTruthy();
  expect(page.getByTestId('pi-filter-psub-product')).toBeTruthy();
  expect(page.getByTestId('pi-filter-psub-range')).toBeTruthy();
  expect(page.getByTestId('pi-filter-psub-loading')).toBeTruthy();
  expect(page.getByTestId('pi-filter-psub-error')).toBeTruthy();
  expect(page.getByTestId('pi-pipe-notify')).toBeTruthy();
  expect(page.getByTestId('pi-pipe-wati-messages')).toBeTruthy();
  expect(page.getByTestId('pi-pipe-broadcast')).toBeTruthy();
  expect(page.getByTestId('pi-pipe-wati-config')).toBeTruthy();
});
