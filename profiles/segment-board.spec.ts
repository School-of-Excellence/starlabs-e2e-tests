// segment-board.spec.ts — /segmentboard: master segments built from participant metadata, their stored lists,
// manual placement, search and the archive lifecycle.
//
// Prefix: sgb — SegmentBoardComponent (segment-board.component.html + the engine it mounts,
// segment-board.engine.ts, which renders the board, dialogs and side panel as literal-hook HTML strings).
//
// Reference: starlabs-angular specs/journals/2026-09-25-segment-board-component.md (WHY of each rule) and
// specs/plans/2026-10-12-segment-board-feedback.md (testing feedback round 1, the rules SGB-02..06 pin).
//
// SEEDED WORLD (profiles/seed-segment-board.js, all run-named, on the run's own journey SB_J):
//   SB Alpha  active               → matches "journey SB_J + customer status Active"
//   SB Bravo  active               → matches; moved into the manual segment in SGB-03
//   SB Charlie non active          → excluded by the customer-status condition (NEGATIVE)
//   SB Delta  active on journey J1 → excluded by the journey setting (NEGATIVE)
//   (no name) active               → excluded from the whole board: no `name` field (NEGATIVE, rule #2)
//   SB Manual                      → an empty, active manual segment
//
// ANTI-CIRCULARITY: the test only clicks. Every assertion reads what the APP computed and wrote:
// segmentboardconfig (the rule the dialog built), segmentboardlist (the membership the app derived from
// participant metadata), and what the board renders. The seed writes participants and a manual segment
// config; it never writes a list, so every profilelist asserted here is the app's own output.
// Shared-project isolation: the board reads unfiltered collections, so cases only assert on run-named
// participants/segments (never a global count). The stats tiles are therefore registered, not asserted.
//
// SERIAL: SGB-02 creates the automated segment the later cases act on.
import { test, expect, Page } from '@playwright/test';
import { installProfileStubs, loginAsProfileAdmin } from './support/profiles';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil } from '../queue/support/firestore-admin';

const RUN = process.env.PROF_RUNID || 'prof';
const IDS = { J: `${RUN}_SB_J`, a: `${RUN}_sb_a`, b: `${RUN}_sb_b`, c: `${RUN}_sb_c`, d: `${RUN}_sb_d`, e: `${RUN}_sb_e`, MANUAL: `${RUN}_SB_MANUAL` };
const NAMES = { J: `SB Journey ${RUN}`, a: `SB Alpha ${RUN}`, b: `SB Bravo ${RUN}`, c: `SB Charlie ${RUN}`, MANUAL: `SB Manual ${RUN}`, AUTO: `SB Active ${RUN}` };
const EMAILS = { c: `sb-c+${RUN}@example.com`, e: `sb-e+${RUN}@example.com` };
/** The id the app gives a new segment (segIdFor in the engine): upper-case slug, 24 chars. */
const AUTO_ID = NAMES.AUTO.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24);

const listOf = async (id: string) => ((await getDoc('segmentboardlist', id))?.profilelist as string[] | undefined) ?? null;
const sameSet = (got: string[] | null, want: string[]) => !!got && got.length === want.length && want.every((x) => got.includes(x));

let guard: ConsoleGuard;

async function open(page: Page) {
  await installProfileStubs(page);
  await loginAsProfileAdmin(page);
  page.on('dialog', (d) => d.accept());   // archive / delete / remove confirm with window.confirm
  await page.goto('/segmentboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('app-segment-board'), 'must mount — check the /segmentboard grant').toBeAttached({ timeout: 30_000 });
  await expect(page.getByTestId('sgb-new-seg'), 'the board finishes loading').toBeVisible({ timeout: 90_000 });
}
const card = (page: Page, name: string) => page.getByTestId('sgb-card').filter({ has: page.getByTestId('sgb-card-title').filter({ hasText: name }) });

test.describe.serial('Profiles — Segment Board (stored lists, manual placement, search, archive)', () => {
  test.beforeEach(async ({ page }) => { guard = attachConsoleGuard(page); });
  test.afterEach(() => assertNoFatal(guard, 'segment board: no fatal console errors / pageerrors'));

  test('SGB-01 the Add picker never offers a profile without a name, and finds a named one by email', async ({ page }) => {
    await open(page);
    await card(page, NAMES.MANUAL).getByTestId('sgb-card-add').click();
    const search = page.getByTestId('sgb-add-search');
    await search.fill(EMAILS.e);
    await expect(page.getByTestId('sgb-add-option'), 'SGB-01: the nameless doc is not loaded at all (orderBy name)').toHaveCount(0);
    await search.fill(EMAILS.c);
    await expect(page.getByTestId('sgb-add-option'), 'SGB-01: a named participant is found by email').toHaveCount(1);
    await page.keyboard.press('Escape');
  });

  test('SGB-02 creating an automated segment stores its rule and builds its list at once (no Refresh)', async ({ page }) => {
    await open(page);
    await page.getByTestId('sgb-new-seg').click();
    await page.getByTestId('sgb-dlg-name').fill(NAMES.AUTO);
    await page.getByTestId('sgb-dlg-journey').click();
    await page.locator('label', { hasText: NAMES.J }).getByTestId('sgb-dlg-journey-option').check();
    await page.getByTestId('sgb-dlg-add-cond').click();
    await page.getByTestId('sgb-dlg-cond-field').last().selectOption('customerStatus');
    await page.getByTestId('sgb-dlg-cond-values').last().click();
    await page.getByTestId('sgb-dlg-cond-option').and(page.locator('[value="ACTIVE"]')).check();
    await page.getByTestId('sgb-dlg-save').click();

    const cfg = await pollUntil(() => getDoc('segmentboardconfig', AUTO_ID), (d) => !!d, { label: `config ${AUTO_ID}` });
    expect(cfg!.journeys, 'SGB-02: the journey setting stores the journey doc id').toEqual([IDS.J]);
    expect(cfg!.rule, 'SGB-02: the rule is a plain condition list').toEqual([{ field: 'customerStatus', op: 'in', value: ['ACTIVE'] }]);
    const list = await pollUntil(() => listOf(AUTO_ID), (l) => sameSet(l, [IDS.a, IDS.b]),
      { label: 'auto list = Alpha + Bravo', timeoutMs: 60_000 });
    for (const out of [IDS.c, IDS.d, IDS.e]) expect(list, `SGB-02: ${out} is a negative control`).not.toContain(out);
  });

  test('SGB-03 moving someone into a manual segment takes them out of the automated list; IDs stay off screen', async ({ page }) => {
    await open(page);
    await card(page, NAMES.AUTO).getByTestId('sgb-card-viewall').click();
    const drawer = page.getByTestId('sgb-drawer');
    const rows = drawer.getByTestId('sgb-drawer-row');
    await expect(rows.filter({ hasText: NAMES.a })).toHaveCount(1);
    await expect(rows.filter({ hasText: IDS.a }), 'SGB-03: profile ids are not rendered next to names').toHaveCount(0);
    await rows.filter({ hasText: NAMES.b }).getByTestId('sgb-drawer-row-select').check();
    await drawer.getByTestId('sgb-bulk-move-manual').click();
    await page.locator('label', { hasText: NAMES.MANUAL }).getByTestId('sgb-move-target').check();
    await page.getByTestId('sgb-move-go').click();

    await pollUntil(() => listOf(IDS.MANUAL), (l) => sameSet(l, [IDS.b]), { label: 'manual list = Bravo' });
    await pollUntil(() => listOf(AUTO_ID), (l) => sameSet(l, [IDS.a]), { label: 'auto list drops Bravo' });
    await page.getByTestId('sgb-drawer-close').click();
  });

  test('SGB-04 search narrows the board to the segments holding a matching participant', async ({ page }) => {
    await open(page);
    await page.getByTestId('sgb-search').fill(NAMES.b);
    await expect(page.getByTestId('sgb-card-title'), 'SGB-04: Bravo is only in the manual segment now').toHaveText([NAMES.MANUAL]);
    await page.getByTestId('sgb-search').fill(NAMES.a);
    await expect(page.getByTestId('sgb-card-title')).toHaveText([NAMES.AUTO]);
  });

  test('SGB-05 a manual segment takes people by hand and gives them back on remove', async ({ page }) => {
    await open(page);
    await card(page, NAMES.MANUAL).getByTestId('sgb-card-add').click();
    await page.getByTestId('sgb-add-search').fill(EMAILS.c);
    await page.getByTestId('sgb-add-option').check();
    await page.getByTestId('sgb-add-go').click();
    await pollUntil(() => listOf(IDS.MANUAL), (l) => sameSet(l, [IDS.b, IDS.c]), { label: 'manual list = Bravo + Charlie' });

    await card(page, NAMES.MANUAL).getByTestId('sgb-card-viewall').click();
    const drawer = page.getByTestId('sgb-drawer');
    await drawer.getByTestId('sgb-drawer-row').filter({ hasText: NAMES.b }).getByTestId('sgb-drawer-row-select').check();
    await drawer.getByTestId('sgb-bulk-remove').click();
    await pollUntil(() => listOf(IDS.MANUAL), (l) => sameSet(l, [IDS.c]), { label: 'manual list = Charlie' });
    await pollUntil(() => listOf(AUTO_ID), (l) => sameSet(l, [IDS.a, IDS.b]), { label: 'Bravo matches the automated segment again' });
  });

  test('SGB-06 archive → Archived view → unarchive → archive → delete removes both docs', async ({ page }) => {
    await open(page);
    const archive = async () => {
      await card(page, NAMES.AUTO).getByTestId('sgb-card-edit').click();
      await page.getByTestId('sgb-dlg-archive').click();
      await pollUntil(() => getDoc('segmentboardconfig', AUTO_ID), (d) => d?.archived === true, { label: 'archived' });
    };
    await archive();
    await page.getByTestId('sgb-show-archived').click();
    const arch = page.getByTestId('sgb-arch-card').filter({ hasText: NAMES.AUTO });
    await expect(arch).toHaveCount(1);
    await arch.getByTestId('sgb-arch-unarchive').click();
    await pollUntil(() => getDoc('segmentboardconfig', AUTO_ID), (d) => !!d && d.archived === undefined, { label: 'unarchived' });
    await page.getByTestId('sgb-show-archived').click();
    await expect(card(page, NAMES.AUTO), 'SGB-06: back on the board').toHaveCount(1);

    await archive();
    await page.getByTestId('sgb-show-archived').click();
    await page.getByTestId('sgb-arch-card').filter({ hasText: NAMES.AUTO }).getByTestId('sgb-arch-delete').click();
    await pollUntil(() => getDoc('segmentboardconfig', AUTO_ID), (d) => d === null, { label: 'config deleted' });
    expect(await getDoc('segmentboardlist', AUTO_ID), 'SGB-06: its saved list goes with it').toBeNull();
  });

  // Hooks no case above drives: stats tiles (global counts, not run-scoped), refresh controls, the remaining
  // dialog controls, the side panel's export / compare / save-as-list, and the uP! / CPM count filters.
  test.fixme('SGB-ADDR1 board, dialog and side-panel controls addressable (deferred behavioral)', async ({ page }) => {
    await page.goto('/segmentboard', { waitUntil: 'domcontentloaded' });
    for (const l of [
      page.getByTestId('sgb-stat-total'), page.getByTestId('sgb-stat-inseg'), page.getByTestId('sgb-stat-unseg'),
      page.getByTestId('sgb-stat-dups'), page.getByTestId('sgb-refresh-all'), page.getByTestId('sgb-clear-filters'),
      page.getByTestId('sgb-card-refresh'), page.getByTestId('sgb-dlg-type-auto'), page.getByTestId('sgb-dlg-type-manual'),
      page.getByTestId('sgb-dlg-status-active'), page.getByTestId('sgb-dlg-status-inactive'),
      page.getByTestId('sgb-drawer-search'), page.getByTestId('sgb-drawer-export'), page.getByTestId('sgb-drawer-save-list'),
    ]) expect(l).toBeTruthy();
  });
  test.fixme('SGB-ADDR2 import & compare and count filters addressable (deferred behavioral)', async ({ page }) => {
    await page.goto('/segmentboard', { waitUntil: 'domcontentloaded' });
    for (const l of [
      page.getByTestId('sgb-drawer-compare'), page.getByTestId('sgb-cmp-file'), page.getByTestId('sgb-cmp-paste'),
      page.getByTestId('sgb-cmp-go'), page.getByTestId('sgb-cmp-tile'), page.getByTestId('sgb-cmp-export'),
      page.getByTestId('sgb-cmp-export-all'), page.getByTestId('sgb-filter-up-op'), page.getByTestId('sgb-filter-up-n'),
      page.getByTestId('sgb-filter-cpm-op'), page.getByTestId('sgb-filter-cpm-n'),
    ]) expect(l).toBeTruthy();
  });
});
