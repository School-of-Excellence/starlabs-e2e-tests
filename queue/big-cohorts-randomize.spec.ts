// big-cohorts-randomize.spec.ts — /bigcohorts: "Randomize into cohorts" (the select bar button + the dialog).
//
// Hook prefixes (one per component):
//   cman — CohortManagementComponent (the select bar button)
//   crnd — CohortRandomizeDialogComponent (cohort-randomize-dialog.component.html)
//
// Reference: starlabs-angular specs/journals/2026-11-01-bigcohorts-randomize.md, specs/plans/2026-11-01-bigcohorts-randomize.md.
// Hub journal: specs/journals/2026-11-01-big-cohorts-randomize.md.
//
// SEEDED WORLD (fixtures/big-seed.ts seedBigRandomizeWorld, on top of seedBigWorld): SRC (educational, six people),
// T1 (educational, empty), T2 (operational, holds OLD, has a group chat), T3 (educational, empty), SPEC (educational:
// S0, S1 + P0, who is also a participant), an event today with check-ins for P0, P1 and S0. The base world's cohorts
// are `studio`: the category negative control. resetBigRandomizeWorld() restores the groups before each case.
//
// CRND-01..04 stop at the preview and write nothing. CRND-05 (saving went on 2026-11-01) really saves: the first
// run of applyRandomizePlan() anywhere, on the emulator only.
//
// ANTI-CIRCULARITY: the seed writes member lists and check-ins, never a count. Every number asserted (available,
// attended of N, people per card, added / stay / removed) is computed by the dialog. CRND-05 reads back what the APP
// wrote, through the Admin SDK: the member lists, the `big cohorts log` rows and the chat members.
// NEGATIVE CONTROLS in CRND-05: the source, the specialist cohort and the unpicked T3 must not change, no cohort is
// created, and OLD must leave T2 and its chat while nobody else does.
import { test, expect, Page } from '@playwright/test';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs } from './stubs';
import { loginAs, PASSWORD } from './support/actors';
import { getDoc, pollUntil, queryWhere } from './support/firestore-admin';
import { seedBigWorld, seedBigRandomizeWorld, resetBigRandomizeWorld, BigSeedResult, BigRandomizeWorld } from '../fixtures/big-seed';

let seed: BigSeedResult;
let w: BigRandomizeWorld;
let guard: ConsoleGuard;

test.beforeAll(async () => {
  seed = await seedBigWorld({ initiatedCount: 3, cohortSourceCount: 3, aelCount: 3, configRows: 2 });
  w = await seedBigRandomizeWorld(seed);
});
test.beforeEach(async ({ page }) => {
  await resetBigRandomizeWorld(seed, w);
  guard = attachConsoleGuard(page);
  installAllExternalStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'big cohorts randomize: no fatal console errors / pageerrors'));

const cardOf = (page: Page, name: string) =>
  page.locator('.cohort-card').filter({ has: page.getByTestId('cman-on-edit-cohort-41').getByText(name, { exact: true }) });

async function openScreen(page: Page) {
  await loginAs(page, seed.mentorEmail, PASSWORD);
  await page.goto('/bigcohorts', { waitUntil: 'domcontentloaded' });
  await expect(cardOf(page, w.srcName), 'the seeded source cohort must render').toBeVisible({ timeout: 60_000 });
  await page.getByTestId('cman-toggle-select-mode-31').click();
}
const tick = async (page: Page, name: string) => {
  await cardOf(page, name).getByTestId('cman-toggle-cohort-selected-40').click();
  await expect(cardOf(page, name)).toHaveClass(/\bchecked\b/);
};
async function openDialog(page: Page) {
  await openScreen(page);
  await tick(page, w.srcName);
  await page.getByTestId('cman-randomize-cohort-87').click();
  await expect(page.getByTestId('crnd-mode-summary'), 'the dialog starts on the mode choice').toContainText('Start by choosing');
}
const pickGroup = async (page: Page, name: string) => {
  await page.getByTestId('crnd-target-row').filter({ hasText: name }).getByTestId('crnd-target-checkbox').check();
};
const previewCard = (page: Page, name: string) => page.getByTestId('crnd-preview-card').filter({ hasText: name });
/** Every run cohort's member list, keyed by id — the "nothing was written" oracle. */
const cohortLists = async () => Object.fromEntries(
  (await queryWhere('big cohorts', [['testrunid', '==', seed.testrunid]])).map((c: any) => [c.docid, [...(c.participantidlist ?? [])].sort()]),
);

test.describe('BIG — Cohorts randomize (category gate, split + warnings, attendance, specialists, save)', () => {
  test('CRND-01 Randomize is offered only when every ticked cohort is educational or operational', async ({ page }) => {
    await openScreen(page);
    const button = page.getByTestId('cman-randomize-cohort-87');
    await tick(page, w.srcName);
    await expect(button, 'CRND-01: educational → offered').toBeVisible();
    await tick(page, w.t2Name);
    await expect(button, 'CRND-01: educational + operational → still offered').toBeVisible();
    await tick(page, seed.sourceCohortName);
    await expect(button, 'CRND-01: a studio cohort in the selection → not offered').toHaveCount(0);
  });

  test('CRND-02 without specialists: splits everyone once, spreads extras, warns who leaves a group, and writes nothing', async ({ page }) => {
    const before = await cohortLists();
    await openDialog(page);
    await page.getByTestId('crnd-mode-without').click();
    await expect(page.getByTestId('crnd-mode-summary')).toContainText('Without specialists');
    await expect(page.getByTestId('crnd-step'), 'CRND-02: event day, participants, groups').toHaveCount(3);
    await expect(page.getByTestId('crnd-stat-specialists'), 'CRND-02: no specialists stat in this mode').toHaveCount(0);
    await expect(page.getByTestId('crnd-preview-empty'), 'CRND-02: no preview until the steps are done').toBeVisible();

    await page.getByTestId('crnd-skip-attendance').click();
    await expect(page.getByTestId('crnd-attendance-not-used'), 'CRND-02: skipping sets attendance to All').toBeVisible();
    await expect(page.getByTestId('crnd-stat-participants')).toContainText('6');

    await page.getByTestId('crnd-target-search').fill(w.search);
    await expect(page.getByTestId('crnd-target-row').filter({ hasText: w.srcName }), 'CRND-02: one role per cohort — the source is not a group option').toHaveCount(0);
    await pickGroup(page, w.t1Name);
    await pickGroup(page, w.t2Name);
    await expect(page.getByTestId('crnd-target-count')).toContainText('2');
    await expect(page.getByTestId('crnd-stat-groups')).toContainText('2');

    // 2 groups of 4 cannot be filled from 6 people: a problem, and no preview
    await page.getByTestId('crnd-size-input').fill('4');
    await expect(page.getByTestId('crnd-problem').first(), 'CRND-02: too few people is explained').toBeVisible();
    await expect(page.getByTestId('crnd-preview-empty')).toBeVisible();
    await expect(page.getByTestId('crnd-confirm'), 'CRND-02: nothing to confirm yet').toBeDisabled();

    // 2 groups of 2 from 6 people: the two extras are spread → 3 and 3
    await page.getByTestId('crnd-size-input').fill('2');
    await expect(page.getByTestId('crnd-participant-split')).toBeVisible();
    const cards = page.getByTestId('crnd-preview-card');
    await expect(cards).toHaveCount(2);
    await expect(previewCard(page, w.t1Name).locator('.crnd-card-count')).toHaveText('3 people');
    await expect(previewCard(page, w.t2Name).locator('.crnd-card-count')).toHaveText('3 people');
    const placed = async () => (await page.getByTestId('crnd-preview-card').locator('.crnd-person').allInnerTexts()).map((t) => t.trim()).sort();
    expect(await placed(), 'CRND-02: everyone placed exactly once').toEqual([...w.people].sort());

    // T2 holds OLD, who is not in the source: the dialog must say they leave, and T1 has nobody to lose
    await expect(page.getByTestId('crnd-removal-warning')).toContainText('1 person will be removed');
    await expect(previewCard(page, w.t1Name).getByTestId('crnd-card-diff')).toContainText('3 added · 0 stay');
    await expect(previewCard(page, w.t1Name).getByTestId('crnd-view-removed')).toHaveCount(0);
    await previewCard(page, w.t2Name).getByTestId('crnd-view-removed').click();
    await expect(previewCard(page, w.t2Name).getByTestId('crnd-removed-list')).toHaveText(new RegExp(w.oldName));

    await page.getByTestId('crnd-reshuffle').click();
    expect(await placed(), 'CRND-02: Reshuffle still places everyone exactly once').toEqual([...w.people].sort());

    // closing without confirming writes nothing
    await expect(page.getByTestId('crnd-confirm'), 'CRND-02: Confirm says what it will do').toContainText('add 6, remove 1');
    await expect(page.getByTestId('crnd-confirm')).toBeEnabled();
    await page.getByTestId('crnd-cancel').click();
    await expect(page.getByTestId('crnd-mode-summary')).toHaveCount(0);
    expect(await cohortLists(), 'CRND-02: no cohort changed').toEqual(before);
  });

  test('CRND-03 attendance: the event day narrows the source, Not attended is the rest, and unmarked people can be ticked in', async ({ page }) => {
    await openDialog(page);
    await page.getByTestId('crnd-mode-without').click();

    await page.getByTestId('crnd-event-select').click();
    await page.getByTestId('crnd-event-search').fill(w.search);
    await page.getByTestId('crnd-event-option').filter({ hasText: w.eventName }).click();
    await page.getByTestId('crnd-day-select').click();
    const day = page.getByTestId('crnd-day-option');
    await expect(day, 'CRND-03: one event day').toHaveCount(1);
    await expect(day, 'CRND-03: the day counts every check-in, specialist included').toContainText('3 checked in');
    await day.click();

    const summary = page.getByTestId('crnd-match-summary');
    await expect(summary, 'CRND-03: P0 and P1 checked in; S0 is not in the source').toContainText('2 available');
    await expect(summary).toContainText('2 of 6 attended');
    await page.getByTestId('crnd-view-matched').click();
    await expect(page.getByTestId('crnd-name-list').locator('li')).toHaveText([w.people[0], w.people[1]]);

    await expect(page.getByTestId('crnd-unmarked-count'), 'CRND-03: the other four have no attendance').toContainText('(4)');
    await page.getByTestId('crnd-unmarked-search').fill('Person 5');
    await expect(page.getByTestId('crnd-unmarked-row')).toHaveCount(1);
    await page.getByTestId('crnd-unmarked-checkbox').check();
    await expect(page.getByTestId('crnd-unmarked-picked')).toContainText('1 included');
    await expect(summary, 'CRND-03: a ticked person joins the shuffle').toContainText('3 available');
    await page.getByTestId('crnd-unmarked-clear').click();
    await expect(summary).toContainText('2 available');

    await page.getByTestId('crnd-attendance-select').click();
    await page.getByTestId('crnd-attendance-not-attended').click();
    await expect(summary, 'CRND-03: Not attended = the four with no check-in').toContainText('4 of 6 absent');
    await expect(page.getByTestId('crnd-unmarked-section'), 'CRND-03: the tick list only shows with Attended').toHaveCount(0);
    await page.getByTestId('crnd-attendance-select').click();
    await page.getByTestId('crnd-attendance-all').click();
    await expect(summary).toContainText('6 available');
  });

  test('CRND-04 with specialists: placed first, per group; non-participants are picked first and an overlap leaves the shuffle', async ({ page }) => {
    await openDialog(page);
    await page.getByTestId('crnd-mode-with').click();
    await expect(page.getByTestId('crnd-mode-summary')).toContainText('With specialists');
    await expect(page.getByTestId('crnd-step'), 'CRND-04: event day, groups, specialists, participants').toHaveCount(4);
    await page.getByTestId('crnd-skip-attendance').click();

    await page.getByTestId('crnd-target-search').fill(w.search);
    await pickGroup(page, w.t1Name);
    await pickGroup(page, w.t2Name);
    await page.getByTestId('crnd-specialist-cohort-select').click();
    await page.getByTestId('crnd-specialist-search').fill(w.specName);
    await page.getByTestId('crnd-specialist-option').filter({ hasText: w.specName }).click();
    await expect(page.getByTestId('crnd-available-count')).toContainText('3 available');

    // 2 per group × 2 groups needs 4 of the 3 available
    await page.getByTestId('crnd-specialists-per-group-input').fill('2');
    await expect(page.getByTestId('crnd-problem').first(), 'CRND-04: too few specialists is explained').toBeVisible();

    await page.getByTestId('crnd-specialists-per-group-input').fill('1');
    await expect(page.getByTestId('crnd-specialist-split')).toBeVisible();
    await page.getByTestId('crnd-size-input').fill('2');
    await expect(page.getByTestId('crnd-stat-specialists')).toContainText('2');
    await expect(page.getByTestId('crnd-stat-participants'), 'CRND-04: S0 and S1 are not participants, so all six stay in the shuffle').toContainText('6');
    const stars = page.getByTestId('crnd-preview-card').locator('.crnd-specialist');
    await expect(stars).toHaveCount(2);
    const starred = (await stars.allInnerTexts()).map((t) => t.replace('★', '').trim()).sort();
    expect(starred, 'CRND-04: the two who are only specialists are picked first').toEqual([...w.specialists].sort());
    await expect(previewCard(page, w.t1Name).locator('.crnd-card-count'), 'CRND-04: 1 specialist on top of 3 participants').toHaveText('4 people');

    // a third group needs a third specialist: P0, who then leaves the participant shuffle
    await pickGroup(page, w.t3Name);
    await expect(page.getByTestId('crnd-stat-groups')).toContainText('3');
    await expect(page.getByTestId('crnd-stat-specialists')).toContainText('3');
    await expect(page.getByTestId('crnd-stat-participants'), 'CRND-04: P0 is now a specialist').toContainText('5');
    // the 5 left can't fill 3 groups of 2: the dialog says so, and offers no preview
    await expect(page.getByTestId('crnd-participant-split'), 'CRND-04: 3 groups of 2 from 5 is not offered').toHaveCount(0);
    await expect(page.getByTestId('crnd-preview-empty')).toBeVisible();
    await page.getByTestId('crnd-size-input').fill('1');
    await expect(page.getByTestId('crnd-participant-split')).toContainText('1 person is already placed as specialists');

    await page.getByTestId('crnd-toggle-selected-groups').click();
    await expect(page.getByTestId('crnd-target-chip')).toHaveCount(3);
    await page.getByTestId('crnd-target-chip').filter({ hasText: w.t3Name }).getByTestId('crnd-target-chip-remove').click();
    await expect(page.getByTestId('crnd-stat-groups')).toContainText('2');

    expect(await getDoc('big cohorts', w.t1Id).then((c: any) => c.participantidlist), 'CRND-04: nothing was saved').toEqual([]);
    await page.getByTestId('crnd-close').click();
    await expect(page.getByTestId('crnd-mode-summary')).toHaveCount(0);
  });

  test('CRND-05 Confirm overwrites the picked groups, logs who was added and removed, updates the chat, and changes nothing else', async ({ page }) => {
    const before = await cohortLists();
    await openDialog(page);
    await page.getByTestId('crnd-mode-without').click();
    await page.getByTestId('crnd-skip-attendance').click();
    await page.getByTestId('crnd-target-search').fill(w.search);
    await pickGroup(page, w.t1Name);
    await pickGroup(page, w.t2Name);
    await page.getByTestId('crnd-size-input').fill('2');
    await expect(page.getByTestId('crnd-confirm')).toContainText('add 6, remove 1');
    await page.getByTestId('crnd-confirm').click();
    await expect(page.getByTestId('crnd-mode-summary'), 'CRND-05: Confirm closes the dialog').toHaveCount(0);

    // the groups: everyone placed exactly once, 3 and 3, and OLD gone
    const t2 = await pollUntil(() => getDoc('big cohorts', w.t2Id), (c) => !(c?.participantidlist as string[]).includes(w.oldId),
      { label: 'CRND-05: T2 is overwritten', timeoutMs: 30_000 });
    const t1 = await getDoc('big cohorts', w.t1Id);
    const t1List = t1!.participantidlist as string[]; const t2List = t2!.participantidlist as string[];
    expect([t1List.length, t2List.length], 'CRND-05: 3 and 3').toEqual([3, 3]);
    expect([...t1List, ...t2List].sort(), 'CRND-05: everyone placed exactly once').toEqual([...w.peopleIds].sort());

    // the logs the app wrote: an `added` row per placed person, one `removed` row for OLD, none for anyone else
    const logs = async (cohortid: string, status: string) =>
      ((await queryWhere('big cohorts log', [['cohortid', '==', cohortid], ['status', '==', status]])) as any[]).map((l) => l.profileid).sort();
    const removed = await pollUntil(() => logs(w.t2Id, 'removed'), (r) => r.length > 0, { label: 'CRND-05: the removed log', timeoutMs: 30_000 });
    expect(removed, 'CRND-05: only OLD is logged as removed').toEqual([w.oldId]);
    expect(await pollUntil(() => logs(w.t2Id, 'added'), (r) => r.length === 3, { label: 'CRND-05: T2 added logs', timeoutMs: 30_000 }), 'CRND-05: T2 added').toEqual([...t2List].sort());
    expect(await pollUntil(() => logs(w.t1Id, 'added'), (r) => r.length === 3, { label: 'CRND-05: T1 added logs', timeoutMs: 30_000 }), 'CRND-05: T1 added').toEqual([...t1List].sort());
    expect(await logs(w.t1Id, 'removed'), 'CRND-05: T1 had nobody to remove').toEqual([]);

    // T2's group chat follows the list: the placed people join, OLD leaves
    const chat = await getDoc('supportchat', w.chatId);
    expect([...(chat!.members as string[])].sort(), 'CRND-05: the chat matches the group').toEqual(t2List.map((id) => `${id}_uid`).sort());

    // nothing else moved: copy, not move, and no cohort is created
    const after = await cohortLists();
    for (const id of [w.srcId, w.specId, w.t3Id, seed.sourceCohortId, seed.targetCohortId]) {
      expect(after[id], `CRND-05: ${id} is unchanged`).toEqual(before[id]);
    }
    expect(Object.keys(after).sort(), 'CRND-05: no cohort was created').toEqual(Object.keys(before).sort());
  });

  // Hooks no case above drives: secondary tools and states the five cases do not need.
  test.fixme('CRND-ADDR1 remaining dialog controls addressable (deferred behavioral)', async ({ page }) => {
    await page.goto('/bigcohorts', { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('crnd-specialist-marathons-label')).toBeTruthy();
    expect(page.getByTestId('crnd-source-marathons-label')).toBeTruthy();
    expect(page.getByTestId('crnd-change-mode')).toBeTruthy();
    expect(page.getByTestId('crnd-step-header')).toBeTruthy();
    expect(page.getByTestId('crnd-attendance-retry')).toBeTruthy();
    expect(page.getByTestId('crnd-select-all-targets')).toBeTruthy();
    expect(page.getByTestId('crnd-clear-targets')).toBeTruthy();
    expect(page.getByTestId('crnd-all-marathons')).toBeTruthy();
    expect(page.getByTestId('crnd-selected-targets')).toBeTruthy();
    expect(page.getByTestId('crnd-target-empty')).toBeTruthy();
    expect(page.getByTestId('crnd-all-marathons-specialists')).toBeTruthy();
    expect(page.getByTestId('crnd-specialist-attendance-select')).toBeTruthy();
    expect(page.getByTestId('crnd-specialist-attendance-attended')).toBeTruthy();
    expect(page.getByTestId('crnd-specialist-attendance-not-attended')).toBeTruthy();
    expect(page.getByTestId('crnd-specialist-attendance-all')).toBeTruthy();
    expect(page.getByTestId('crnd-source-select')).toBeTruthy();
    expect(page.getByTestId('crnd-source-search')).toBeTruthy();
    expect(page.getByTestId('crnd-all-marathons-sources')).toBeTruthy();
    expect(page.getByTestId('crnd-source-option')).toBeTruthy();
    expect(page.getByTestId('crnd-attendance-attended')).toBeTruthy();
    expect(page.getByTestId('crnd-unmarked-select-all')).toBeTruthy();
    expect(page.getByTestId('crnd-unmarked-no-results')).toBeTruthy();
    expect(page.getByTestId('crnd-unmarked-empty')).toBeTruthy();
    expect(page.getByTestId('crnd-todo-list')).toBeTruthy();
    expect(page.getByTestId('crnd-todo')).toBeTruthy();
    expect(page.getByTestId('crnd-panel')).toBeTruthy();
    expect(page.getByTestId('crnd-preview-more')).toBeTruthy();
  });
});
