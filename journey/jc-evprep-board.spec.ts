// jc-evprep-board.spec.ts — /journey-coach-health → Ev. Prep tab → the live "New Participants" board
// (JcEvprepBoardComponent, Joshua 2026-11, pulled onto charan-release 2026-11-18 —
// starlabs-angular specs/journals/2026-11-18-pull-joshua-jc-health-delivery-v4.md).
//
// Hook prefix (one per component):
//   evp — JcEvprepBoardComponent (jc-evprep-board.component.html)
//   (the tab itself and the panel host are JC Health's: jchd-tab-evprep / jchd-panel-evprep, coach-health.spec.ts)
//
// WHAT THE BOARD READS: `evolution prep variation` (stage columns), `journey` (names), participantjourneyproduct with
// onboardedtime >= EVPREP_LIVE_FROM (2026-10-01 IST) filtered to onboarded + journeytype 'new', the salesleads behind
// them (a rejected sale removes the card), and a LIVE `evolution prep` stream (initiated | ongoing | completed).
// Columns: Onboarded (yet to start) | each variation stage, keyed 'st-<kebab>' | Ready for SE.
//
// SEEDED WORLD (seed-journey.js step 9, seedEvprep — own run tag `<run>_evp`; one variation with two run-unique stages):
//   YET  onboarded · new · 5 days ago                     → Onboarded            (EVP-02 starts its prep)
//   CAN  onboarded · new · 10 days ago + CANCELLED prep    → Onboarded            (a cancelled prep returns the card)
//   ACT  prep ongoing at Stage Two, stage since 4 days     → Stage Two, "In stage 4d", variation chip
//   DONE prep completed                                    → Ready for SE
//   OLD  onboarded before the live date · RET returning journey · REJ rejected sale · NOB not onboarded → nowhere
//
// ANTI-CIRCULARITY. The seed writes raw PJP / prep / variation / sale docs only. Which column a card lands in, the
// "In stage" days, and the exclusions are the APP's derivation (yetToStart, prepColumn, isRemovedSale, liveStages).
// EVP-02's write is read back through the Admin SDK — the test never writes the prep it asserts. The board shows
// every onboarding in the shared project, so every assertion is scoped to a run-unique card (data-profile) or column.
//
// NOT COVERED: drag-and-drop (cdkDrag) — Next/back open the same move box and run the same confirmMove(); the
// "Returning" preview board is commented out in the app (only the live board renders), so evp-preview is never shown.
import { test, expect, Page } from '@playwright/test';
import { installJourneyStubs, attachJourneyGuard, loginAsJourneyCoach, evpWorld as W, deleteDocsByField } from './support/journey';
import { assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { queryWhere, pollUntil } from '../queue/support/firestore-admin';

let guard: ConsoleGuard;
test.beforeEach(async ({ page }) => {
  guard = attachJourneyGuard(page);
  await installJourneyStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'ev. prep board: no fatal console errors / pageerrors'));

/** Open JC Health → Ev. Prep and wait for the live board to finish loading. */
async function openBoard(page: Page) {
  await loginAsJourneyCoach(page);
  await page.goto('/journey-coach-health', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('app-journey-coach-health-dashboard'), 'the dashboard must mount').toBeAttached({ timeout: 30_000 });
  await page.getByTestId('jchd-tab-evprep').click();
  const board = page.getByTestId('evp-root').getByTestId('evp-board');
  await expect(board, 'the live board renders').toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('evp-loading'), 'the board finishes loading').toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByTestId('evp-error'), 'no load error').toHaveCount(0);
  return board;
}
const cardOf = (page: Page, pf: string) => page.getByTestId('evp-card').and(page.locator(`[data-profile="${pf}"]`));
const colOf = (page: Page, key: string) => page.getByTestId('evp-col').and(page.locator(`[data-stage="${key}"]`));

test.describe('Journey — JC Health Ev. Prep board (live columns, exclusions, start-prep with a required note)', () => {
  test('EVP-01 cards land in the column their PJP / prep implies, and excluded onboardings never show', async ({ page }) => {
    const board = await openBoard(page);
    const one = W.stageKey(W.names.one), two = W.stageKey(W.names.two);
    await expect(colOf(page, one), 'EVP-01: the variation\'s first stage is a column').toHaveCount(1);
    await expect(colOf(page, two), 'EVP-01: …and its second').toHaveCount(1);
    await expect(board.getByTestId('evp-board-total'), 'EVP-01: the board total renders').toContainText('Total');

    await expect(colOf(page, 'onboarded').getByTestId('evp-card').and(page.locator(`[data-profile="${W.people.YET.pf}"]`)),
      'EVP-01: YET (onboarded 5 days ago, no prep) is yet to start').toHaveCount(1, { timeout: 30_000 });
    await expect(colOf(page, 'onboarded').getByTestId('evp-card').and(page.locator(`[data-profile="${W.people.CAN.pf}"]`)),
      'EVP-01: CAN\'s prep was cancelled → back in yet to start').toHaveCount(1);
    const act = colOf(page, two).getByTestId('evp-card').and(page.locator(`[data-profile="${W.people.ACT.pf}"]`));
    await expect(act, 'EVP-01: ACT sits on its prep\'s current stage').toHaveCount(1);
    await expect(act.getByTestId('evp-card-variation'), 'EVP-01: the card names its variation').toHaveText(W.names.variation);
    await expect(act.getByTestId('evp-card-days'), 'EVP-01: In stage counts from stagesince (4 days)').toContainText('4d');
    await expect(colOf(page, 'readyforse').getByTestId('evp-card').and(page.locator(`[data-profile="${W.people.DONE.pf}"]`)),
      'EVP-01: a completed prep is Ready for SE').toHaveCount(1);

    for (const k of ['OLD', 'RET', 'REJ', 'NOB'] as const) {
      await expect(cardOf(page, W.people[k].pf), `EVP-01: ${k} must not be on the board`).toHaveCount(0);
    }
    await expect(colOf(page, one).getByTestId('evp-col-count'), 'EVP-01: column counts render').toBeVisible();
  });

  test('EVP-02 Start prep needs a variation and a note, then writes an initiated prep at the first stage', async ({ page }) => {
    // Idempotent precondition: no app-written prep for YET (a retry would otherwise find it already started).
    await deleteDocsByField('evolution prep', 'profileid', W.people.YET.pf);
    await openBoard(page);

    const yet = cardOf(page, W.people.YET.pf);
    await expect(yet).toHaveCount(1, { timeout: 30_000 });
    await expect(yet.getByTestId('evp-card-back'), 'EVP-02: the first column has no back button').toHaveCount(0);
    await yet.getByTestId('evp-card-next').click();

    const move = page.getByTestId('evp-move');
    await expect(move.getByTestId('evp-modal'), 'EVP-02: the move box opens').toBeVisible();
    await move.getByTestId('evp-move-save').click();
    await expect(move.getByText('Pick a variation to start.'), 'EVP-02: no variation → refused').toBeVisible();
    await expect(move.getByText('A note is required to move a card.'), 'EVP-02: no note → refused').toBeVisible();
    await move.getByTestId('evp-move-cancel').click();
    await expect(page.getByTestId('evp-move'), 'EVP-02: Cancel closes without writing').toHaveCount(0);
    expect((await queryWhere('evolution prep', [['profileid', '==', W.people.YET.pf]])).length, 'EVP-02: nothing written yet').toBe(0);

    await yet.getByTestId('evp-card-next').click();
    await move.getByTestId('evp-move-variation').selectOption({ value: W.VAR });
    await move.getByTestId('evp-move-note').fill(`EVP start note ${W.RUN}`);
    await expect(move.getByTestId('evp-move-error'), 'EVP-02: a valid start shows no block').toHaveCount(0);
    await move.getByTestId('evp-move-save').click();
    await expect(page.getByTestId('evp-move'), 'EVP-02: saving closes the box').toHaveCount(0, { timeout: 30_000 });

    // [ORACLE] the app's write, read back: one initiated prep at the variation's FIRST stage, carrying the note.
    const preps = await pollUntil(() => queryWhere('evolution prep', [['profileid', '==', W.people.YET.pf]]), (r) => r.length === 1,
      { timeoutMs: 30_000, label: 'one evolution prep for YET' });
    const p: any = preps[0];
    expect([p.status, p.currentstage, p.variationid], 'EVP-02: status / stage / variation').toEqual(['initiated', W.names.one, W.VAR]);
    expect(p.notes?.[0]?.note, 'EVP-02: the note is stored on the prep').toBe(`EVP start note ${W.RUN}`);

    // The live stream moves the card without a reload.
    await expect(colOf(page, W.stageKey(W.names.one)).getByTestId('evp-card').and(page.locator(`[data-profile="${W.people.YET.pf}"]`)),
      'EVP-02: YET now sits on Stage One').toHaveCount(1, { timeout: 30_000 });
    await expect(colOf(page, 'onboarded').getByTestId('evp-card').and(page.locator(`[data-profile="${W.people.YET.pf}"]`)),
      'EVP-02: …and left yet to start').toHaveCount(0);
    await deleteDocsByField('evolution prep', 'profileid', W.people.YET.pf);   // leave the world as seeded
  });

  test.fixme('EVP-ADDR1 empty column, design-preview banner, load error + Retry addressable (deferred — need an empty variation stage / a failing read)', async ({ page }) => {
    await page.goto('/journey-coach-health', { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('evp-empty')).toBeTruthy();
    expect(page.getByTestId('evp-preview')).toBeTruthy();
    expect(page.getByTestId('evp-retry')).toBeTruthy();
  });
});
