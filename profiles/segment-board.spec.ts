// segment-board.spec.ts — /segmentboard: master segments built from participant metadata, their stored lists,
// manual placement, search, the archive lifecycle (no hard delete), the per-segment change history and
// segment groups (segmentboardgroups, soft delete, grouphistory subcollection)
// (segmentboardconfig/{id}/segmenthistory, written by the app in the same batch as each change).
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
//   SB Import                      → a second empty manual segment: the Import & move target (SGB-08)
//
// SGB-08 (Import & move) imports a Name/Email CSV of 5 rows into SB Import:
//   Alpha (in the automated segment)  → ticked by default, moved
//   Charlie (placed in SB Manual)     → unticked by default; the case ticks it, so it leaves SB Manual
//   the nameless doc's email          → Not found (it is never loaded: NEGATIVE, rule #2)
//   an email nobody has               → Not found (NEGATIVE)
//   Alpha again, upper case           → Repeated (NEGATIVE)
//   Bravo is left out of the file     → must stay in the automated list (NEGATIVE)
// Oracles: the three segmentboardlist docs and the members-added / members-removed history the app wrote.
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
import { getDoc, pollUntil, queryWhere } from '../queue/support/firestore-admin';

const RUN = process.env.PROF_RUNID || 'prof';
const IDS = { J: `${RUN}_SB_J`, a: `${RUN}_sb_a`, b: `${RUN}_sb_b`, c: `${RUN}_sb_c`, d: `${RUN}_sb_d`, e: `${RUN}_sb_e`, MANUAL: `${RUN}_SB_MANUAL`, IMPORT: `${RUN}_SB_IMPORT` };
const NAMES = { J: `SB Journey ${RUN}`, a: `SB Alpha ${RUN}`, b: `SB Bravo ${RUN}`, c: `SB Charlie ${RUN}`, MANUAL: `SB Manual ${RUN}`, AUTO: `SB Active ${RUN}`,
  GA: `SB Group A ${RUN}`, GB: `SB Group B ${RUN}`, GB2: `SB Group B2 ${RUN}` };
const EMAILS = { a: `sb-a+${RUN}@example.com`, c: `sb-c+${RUN}@example.com`, e: `sb-e+${RUN}@example.com`, none: `sb-none+${RUN}@example.com` };
/** The app gives a new segment a Firestore auto id: find it by its run-unique name (the live doc, never a migrated copy). */
let autoIdCache = '';
async function autoId(): Promise<string> {
  if (autoIdCache) return autoIdCache;
  const docs = await pollUntil(() => queryWhere('segmentboardconfig', [['name', '==', NAMES.AUTO]]), (r) => r.some((d) => !d['migratedto']),
    { label: 'auto segment config by name' });
  return (autoIdCache = docs.find((d) => !d['migratedto'])!.id);
}

const listOf = async (id: string) => ((await getDoc('segmentboardlist', id))?.profilelist as string[] | undefined) ?? null;
const sameSet = (got: string[] | null, want: string[]) => !!got && got.length === want.length && want.every((x) => got.includes(x));

let guard: ConsoleGuard;

async function open(page: Page) {
  await installProfileStubs(page);
  await loginAsProfileAdmin(page);
  page.on('dialog', (d) => d.accept());   // archive / remove confirm with window.confirm
  await page.goto('/segmentboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('app-segment-board'), 'must mount — check the /segmentboard grant').toBeAttached({ timeout: 30_000 });
  await expect(page.getByTestId('sgb-new-seg'), 'the board finishes loading').toBeVisible({ timeout: 90_000 });
}
const card = (page: Page, name: string) => page.getByTestId('sgb-card').filter({ has: page.getByTestId('sgb-card-title').filter({ hasText: name }) });
/** The card's edit pencil is shown on hover / focus only (design pass 2026-10-12): hover the card, then click it. */
async function editCard(page: Page, name: string) {
  await card(page, name).hover();
  await card(page, name).getByTestId('sgb-card-edit').click();
}

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

    const AUTO_ID = await autoId();
    expect(AUTO_ID, 'SGB-02: a new segment gets a random (auto) id, not a slug of its name').toMatch(/^[A-Za-z0-9]{20}$/);
    const cfg = await getDoc('segmentboardconfig', AUTO_ID);
    expect(cfg!.id, 'SGB-02: the id field matches the doc id').toBe(AUTO_ID);
    expect(String(cfg!.createdBy ?? ''), 'SGB-02: createdBy is a profile id, not an email').not.toContain('@');
    expect(cfg!.journeys, 'SGB-02: the journey setting stores the journey doc id').toEqual([IDS.J]);
    expect(cfg!.rule, 'SGB-02: the rule is a plain condition list').toEqual([{ field: 'customerStatus', op: 'in', value: ['ACTIVE'] }]);
    const list = await pollUntil(() => listOf(AUTO_ID), (l) => sameSet(l, [IDS.a, IDS.b]),
      { label: 'auto list = Alpha + Bravo', timeoutMs: 60_000 });
    expect((await getDoc('segmentboardlist', AUTO_ID))?.segmentid, 'SGB-02: the list doc id and segmentid are the config id').toBe(AUTO_ID);
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
    const AUTO_ID = await autoId();
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
    await pollUntil(async () => listOf(await autoId()), (l) => sameSet(l, [IDS.a, IDS.b]), { label: 'Bravo matches the automated segment again' });
  });

  test('SGB-06 archive → unarchive → archive: no hard delete, and every step is in the segment history', async ({ page }) => {
    const AUTO_ID = await autoId();
    const hist = (action: string) => queryWhere(`segmentboardconfig/${AUTO_ID}/segmenthistory`, [['action', '==', action]]);
    await open(page);
    const archive = async () => {
      await editCard(page, NAMES.AUTO);
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

    // the history the app wrote (same batch as each change): create (SGB-02), archive, unarchive
    await pollUntil(() => hist('unarchive'), (r) => r.length === 1, { label: 'unarchive entry' });
    expect((await hist('create')).length, 'SGB-06: the create from SGB-02 is recorded').toBe(1);
    const [a1] = await hist('archive');
    expect(a1?.changes?.archived, 'SGB-06: archive records archived false → true').toEqual({ from: false, to: true });
    expect(a1?.updatedby, 'SGB-06: who changed it (updatedby = profile id)').toBeTruthy();
    expect(String(a1?.updatedby ?? ''), 'SGB-06: updatedby is a profile id, not an email').not.toContain('@');
    expect(a1?.updatedat, 'SGB-06: when (updatedat, server time)').toBeTruthy();
    // the side panel History tab lists them
    await card(page, NAMES.AUTO).getByTestId('sgb-card-viewall').click();
    await page.getByTestId('sgb-drawer').getByTestId('sgb-drawer-tab-history').click();
    await expect(page.getByTestId('sgb-drawer').getByTestId('sgb-history-item').first(), 'SGB-06: History tab shows entries').toBeVisible();
    expect(await page.getByTestId('sgb-drawer').getByTestId('sgb-history-item').count()).toBeGreaterThanOrEqual(3);
    await page.getByTestId('sgb-drawer-close').click();

    // archiving is the only delete: the Archived view has no Delete, and the config + list stay
    await archive();
    await page.getByTestId('sgb-show-archived').click();
    await expect(page.getByTestId('sgb-arch-card').filter({ hasText: NAMES.AUTO })).toHaveCount(1);
    await pollUntil(() => hist('archive'), (r) => r.length === 2, { label: 'second archive entry' });
    expect(await getDoc('segmentboardlist', AUTO_ID), 'SGB-06: the stored list is kept').not.toBeNull();
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
  test('SGB-07 groups: create, assign, move, rename (segments untouched), soft delete (groupid removed, histories written)', async ({ page }) => {
    const groupId = async (name: string) => (await pollUntil(() => queryWhere('segmentboardgroups', [['name', '==', name]]), (r) => r.length === 1, { label: `group ${name}` }))[0].id;
    const gh = (gid: string, action: string) => queryWhere(`segmentboardgroups/${gid}/grouphistory`, [['action', '==', action]]);
    const cfg = () => getDoc('segmentboardconfig', IDS.MANUAL);
    await open(page);
    // groups live in the always-visible left panel; its pencil opens the create / rename / delete dialog
    const nav = page.getByTestId('sgb-gnav');
    await nav.getByTestId('sgb-groups-manage').click();
    const dlg = page.getByTestId('sgb-grp-dlg');
    for (const n of [NAMES.GA, NAMES.GB]) {
      await dlg.getByTestId('sgb-grp-new-name').fill(n);
      await dlg.getByTestId('sgb-grp-create').click();
      await expect(dlg.getByTestId('sgb-grp-row').filter({ has: page.locator(`input[value="${n}"]`) })).toHaveCount(1);
    }
    const GA = await groupId(NAMES.GA), GB = await groupId(NAMES.GB);
    expect((await gh(GA, 'create')).length, 'SGB-07: the group records its creation').toBe(1);
    await page.keyboard.press('Escape');

    const pick = async (label: string) => {
      await editCard(page, NAMES.MANUAL);
      await page.getByTestId('sgb-dlg-group').selectOption({ label });
      await page.getByTestId('sgb-dlg-save').click();
    };
    await pick(NAMES.GA);
    await pollUntil(cfg, (d) => d?.groupid === GA, { label: 'segment in group A' });
    await expect(card(page, NAMES.MANUAL).getByTestId('sgb-card-group'), 'SGB-07: the card shows its group').toHaveText(NAMES.GA);
    await pick(NAMES.GB);
    await pollUntil(cfg, (d) => d?.groupid === GB, { label: 'segment moved to group B' });
    await pollUntil(() => gh(GA, 'segment-removed'), (r) => r.length === 1, { label: 'A records the segment leaving' });
    const added = await gh(GB, 'segment-added');
    expect(added.map((e) => e['segmentid']), 'SGB-07: B records the segment joining').toEqual([IDS.MANUAL]);
    expect(String(added[0]?.['updatedby'] ?? ''), 'SGB-07: group history updatedby is a profile id').not.toContain('@');
    expect(added[0]?.['updatedat'], 'SGB-07: group history updatedat').toBeTruthy();

    // left panel: B counts 1 segment; Not grouped is listed; clicking B shows only its card; Select fills the send bar
    const navB = nav.getByTestId('sgb-gnav-item').filter({ hasText: NAMES.GB });
    await expect(navB.getByTestId('sgb-gnav-count'), 'SGB-07: the panel counts the segments in the group').toHaveText('1');
    await expect(nav.getByTestId('sgb-gnav-none'), 'SGB-07: the panel lists Not grouped').toHaveCount(1);
    await navB.getByRole('button', { name: NAMES.GB }).click();
    await expect(page.getByTestId('sgb-card'), 'SGB-07: choosing the group shows only its segments').toHaveCount(1);
    await expect(card(page, NAMES.MANUAL)).toHaveCount(1);
    await navB.getByTestId('sgb-gnav-select').click();
    await expect(page.getByTestId('sgb-selbar-label'), 'SGB-07: Select fills the send bar with the group').toContainText(`Group: ${NAMES.GB}`);
    await page.locator('#selbar [data-act="clear-cardsel"]').click();
    await nav.getByTestId('sgb-gnav-all').click();
    await expect(page.getByTestId('sgb-card').filter({ hasText: NAMES.MANUAL })).toHaveCount(1);
    await nav.getByTestId('sgb-groups-manage').click();

    // rename: only the group doc changes
    const rowB = dlg.getByTestId('sgb-grp-row').filter({ has: page.locator(`input[value="${NAMES.GB}"]`) });
    await rowB.getByTestId('sgb-grp-name').fill(NAMES.GB2);
    await rowB.getByTestId('sgb-grp-rename').click();
    await pollUntil(() => getDoc('segmentboardgroups', GB), (d) => d?.name === NAMES.GB2, { label: 'group renamed' });
    expect((await cfg())?.groupid, 'SGB-07: rename leaves the segment untouched').toBe(GB);
    expect((await gh(GB, 'rename')).length).toBe(1);
    // the dialog re-renders with the new name, so find the row again by it
    const rowB2 = dlg.getByTestId('sgb-grp-row').filter({ has: page.locator(`input[value="${NAMES.GB2}"]`) });
    await rowB2.getByTestId('sgb-grp-hist').click();
    await expect(dlg.getByTestId('sgb-history-item').first(), 'SGB-07: the group History lists its events').toBeVisible();

    // delete: soft — the group doc stays as deleted, the segment loses its groupid, both histories record it
    await dlg.getByTestId('sgb-grp-row').filter({ has: page.locator(`input[value="${NAMES.GB2}"]`) }).getByTestId('sgb-grp-delete').click();
    await pollUntil(() => getDoc('segmentboardgroups', GB), (d) => d?.deleted === true, { label: 'group soft-deleted' });
    expect(await getDoc('segmentboardgroups', GB), 'SGB-07: the group doc is never deleted').not.toBeNull();
    await pollUntil(cfg, (d) => !!d && d.groupid === undefined, { label: 'groupid removed from the segment' });
    expect((await gh(GB, 'delete')).length).toBe(1);
    const segRemoved = await queryWhere(`segmentboardconfig/${IDS.MANUAL}/segmenthistory`, [['changedfields', 'array-contains', 'groupid']]);
    expect(segRemoved.some((h) => (h['changes'] as any)?.groupid?.from === GB && (h['changes'] as any)?.groupid?.to === null),
      'SGB-07: the segment history records the group removal').toBe(true);
    await page.keyboard.press('Escape');
    await expect(card(page, NAMES.MANUAL).getByTestId('sgb-card-group'), 'SGB-07: no label after the delete').toHaveCount(0);
  });

  test('SGB-08 import & move: review list (default ticks, not matched), move into a manual segment, lists + history', async ({ page }) => {
    const AUTO_ID = await autoId();
    const hist = (seg: string, action: string) => queryWhere(`segmentboardconfig/${seg}/segmenthistory`, [['action', '==', action]]);
    await open(page);
    // SGB-06 left the automated segment archived: bring it back so Alpha and Bravo are "in an automated segment"
    await page.getByTestId('sgb-show-archived').click();
    await page.getByTestId('sgb-arch-card').filter({ hasText: NAMES.AUTO }).getByTestId('sgb-arch-unarchive').click();
    await pollUntil(() => getDoc('segmentboardconfig', AUTO_ID), (d) => !!d && d.archived === undefined, { label: 'unarchived for SGB-08' });
    await page.getByTestId('sgb-show-archived').click();
    await expect(card(page, NAMES.AUTO)).toHaveCount(1);

    await page.getByTestId('sgb-import-move').click();
    const dlg = page.getByTestId('sgb-imv-dlg');
    await dlg.getByTestId('sgb-imv-target').selectOption(IDS.IMPORT);
    // the template's own headers (Name, Email); the app finds the Email column itself
    const csv = ['Name,Email', `SB Alpha,${EMAILS.a}`, `SB Charlie,${EMAILS.c}`, `No name,${EMAILS.e}`, `Nobody,${EMAILS.none}`, `SB Alpha again,${EMAILS.a.toUpperCase()}`].join('\n');
    await dlg.getByTestId('sgb-imv-file').setInputFiles({ name: 'sgb-import.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect(dlg.getByTestId('sgb-imv-review')).toBeEnabled();
    await dlg.getByTestId('sgb-imv-review').click();

    // the review list: 1 ticked · 1 unticked · 0 already there · 3 not matched
    await expect(dlg.getByTestId('sgb-imv-tile').locator('b'), 'SGB-08: review counts').toHaveText(['1', '1', '0', '3']);
    const rows = dlg.getByTestId('sgb-imv-row');
    await expect(rows.filter({ hasText: NAMES.a }), 'SGB-08: Alpha is in an automated segment').toHaveAttribute('data-imv-status', 'auto');
    await expect(rows.filter({ hasText: NAMES.a }).getByTestId('sgb-imv-tick'), 'SGB-08: … and ticked by default').toBeChecked();
    await dlg.getByTestId('sgb-imv-tile').nth(3).click();
    await expect(rows.and(page.locator('[data-imv-status="notfound"]')), 'SGB-08: the nameless doc and the unknown email are not found').toHaveCount(2);
    await expect(rows.and(page.locator('[data-imv-status="dup"]')), 'SGB-08: the repeated email is flagged once').toHaveCount(1);
    await expect(rows.getByTestId('sgb-imv-tick'), 'SGB-08: not-matched rows cannot be ticked').toHaveCount(0);
    await dlg.getByTestId('sgb-imv-tile').nth(1).click();
    const charlie = rows.filter({ hasText: NAMES.c });
    await expect(charlie, 'SGB-08: Charlie is in another manual segment').toHaveAttribute('data-imv-status', 'manual');
    await expect(charlie.getByTestId('sgb-imv-tick'), 'SGB-08: … and unticked by default').not.toBeChecked();
    await charlie.getByTestId('sgb-imv-tick').check();
    await expect(dlg.getByTestId('sgb-imv-move')).toHaveText('Move 2 participants');
    await dlg.getByTestId('sgb-imv-move').click();
    await expect(dlg.getByTestId('sgb-imv-done'), 'SGB-08: the dialog confirms the move').toContainText('Moved 2 participants');

    // oracles: what the app wrote
    await pollUntil(() => listOf(IDS.IMPORT), (l) => sameSet(l, [IDS.a, IDS.c]), { label: 'import target = Alpha + Charlie' });
    await pollUntil(() => listOf(IDS.MANUAL), (l) => sameSet(l, []), { label: 'Charlie left SB Manual' });
    await pollUntil(() => listOf(AUTO_ID), (l) => sameSet(l, [IDS.b]), { label: 'automated list keeps Bravo only' });
    const [added] = (await pollUntil(() => hist(IDS.IMPORT, 'members-added'), (r) => r.length === 1, { label: 'members-added entry' })) as any[];
    expect(sameSet(added?.changes?.members?.to ?? null, [IDS.a, IDS.c]), 'SGB-08: members-added lists who joined').toBe(true);
    expect(added?.source?.source, 'SGB-08: the entry names the file').toBe('sgb-import.csv');
    expect(String(added?.updatedby ?? ''), 'SGB-08: updatedby is a profile id').not.toContain('@');
    expect(added?.updatedat, 'SGB-08: updatedat').toBeTruthy();
    const [removed] = (await pollUntil(() => hist(IDS.MANUAL, 'members-removed'), (r) => r.length === 1, { label: 'members-removed entry' })) as any[];
    expect(removed?.changes?.members?.from, 'SGB-08: SB Manual records Charlie leaving').toEqual([IDS.c]);

    // the same file again: both are now "Already there", nothing is movable
    await dlg.locator('[data-act="imv-back"]').click();
    await dlg.getByTestId('sgb-imv-review').click();
    await expect(dlg.getByTestId('sgb-imv-tile').locator('b'), 'SGB-08: a re-import finds them already there').toHaveText(['0', '0', '2', '3']);
    await expect(dlg.getByTestId('sgb-imv-move')).toBeDisabled();
  });

  // The one-time id migration rewrites every text-id segment on the project. On the shared test project that would
  // move other runs' and real segments too, so it is registered here and never driven by a case.
  test.fixme('SGB-ADDR3 id migration controls addressable (never driven: project-wide one-time write)', async ({ page }) => {
    await page.goto('/segmentboard', { waitUntil: 'domcontentloaded' });
    for (const l of [
      page.getByTestId('sgb-mig-open'), page.getByTestId('sgb-mig-dlg'), page.getByTestId('sgb-mig-row'),
      page.getByTestId('sgb-mig-run'), page.getByTestId('sgb-mig-done'),
      // the dialog's inline "New group…" (SGB-07 creates groups from Manage groups instead)
      page.getByTestId('sgb-dlg-group-new'), page.getByTestId('sgb-dlg-group-add'),
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
  // Import & move controls SGB-08 does not drive: the paste box, search, tick-all, the Name/Email template download and export
  test.fixme('SGB-ADDR4 import & move secondary controls addressable (deferred behavioral)', async ({ page }) => {
    await page.goto('/segmentboard', { waitUntil: 'domcontentloaded' });
    for (const l of [
      page.getByTestId('sgb-imv-paste'), page.getByTestId('sgb-imv-search'), page.getByTestId('sgb-imv-tick-all'),
      page.getByTestId('sgb-imv-template'), page.getByTestId('sgb-imv-export'),
    ]) expect(l).toBeTruthy();
  });
});
