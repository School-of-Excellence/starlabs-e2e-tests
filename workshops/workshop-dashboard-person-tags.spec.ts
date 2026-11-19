// workshop-dashboard-person-tags.spec.ts — "Manage tag" in the side panel's person menu (operator 2026-11-19).
// Plan (the operator's decisions): starlabs-angular specs/plans/2026-11-19-dashboard-person-manage-tag.md.
//   WPT-01  On the Clear list: the person menu shows View participant data, THEN Manage tag; Manage tag opens the
//           segment tags (newusertags type newusersegments, blank names left out) A→Z ignoring case, each a
//           menuitemcheckbox ticked when the person's enrolment here carries it. Calendar-type, location and
//           blank-named tags are never offered (negative controls)
//   WPT-02  Add: an unticked tag is added to THAT person's enrolled doc here (arrayUnion: appended); their other
//           tags (a location tag included) and every other field stay; every other enrolled doc is untouched;
//           the item then reads ticked
//   WPT-03  Remove: a ticked tag is taken off (arrayRemove); the rest stay in order; the item reads unticked
//   WPT-04  Access is the Clear LIST alone, never can('clear'):
//           a  full dashboard access, not on the list → View participant data, no Manage tag
//           b  this workshop's own Clear tick (+ participant progress), not on the list → Clear shows, Manage tag
//              does not; the same person put on the list → Manage tag (positive control)
//           c  mover on the list → Manage tag; the list emptied, same person → none
//   WPT-05  A person with no enrolment here (New Users Not Enrolled): Manage tag is shown disabled with a reason,
//           opens nothing, and nothing is written. Positive control: an enrolled-not-started person (no
//           participant data yet) CAN be tagged — the rule is the enrolment, not the data
//   WPT-06  The open Total Enrolled panel's chips for that person follow an add and a remove without reopening the
//           panel; Top tags gains / loses the tag; another person's chips stay
//   WPT-07  A person with a second enrolled doc here: both docs get the same add, then the same remove; each keeps
//           its own other tags; nobody else is touched
//   WPT-08  The ✓ follows the person's CURRENT tags: a tag added elsewhere while the submenu is open reads ticked
//           without reopening, and choosing it then REMOVES it (no stale ✓ deciding the change)
//   WPT-09  A second click while a choice is saving is ignored: with the app's write held in flight the item is
//           busy and disabled, a double-click and a forced click add nothing more, and once released the tag is
//           added exactly once (never added-then-removed)
//   WPT-10  Keyboard: ArrowRight on Manage tag opens the list with the first tag focused; ArrowDown + Enter adds,
//           Enter again removes; the submenu stays open and focus stays on the item throughout
//   WPT-11  Lazy read: no segment-tag read before any person menu opens (first paint never waits on it); the first
//           person-menu open reads it once; later opens use the copy already read
//   WPT-12  Users Not in Chat Group: a choice there keeps both menus open, although the live enrolled snapshot
//           rebuilds that panel's people (the rows are kept, so the name's menu is never torn down under it)
//   WPT-13  Total Enrolled with a Tag filter ticked: removing that tag drops the person from the panel and closes
//           the person menu AND the submenu with it (nothing left floating); the next person's menu works
//
// Recon: starlabs-angular src/app/New-Workshop/workshop-dashboard/
//   • workshop-dashboard.component.html — the panel row's name `wd-side-person-name` is a mat-menu trigger (with the
//     participant progress right) for ONE shared <mat-menu #personMenu class="… wdx-pmenu">; its first item is
//     `wd-side-person-view`. Manage tag (`wd-side-person-tags`, only when canManageTags) comes after it and opens a
//     nested mat-menu (#personTagMenu) of `wd-side-person-tag` items (role menuitemcheckbox, aria-checked; a tick
//     icon + the name); `wd-side-person-tags-note` is that submenu's loading / empty / failed line, shown INSTEAD of
//     the list. For someone with no enrolled doc here the item is a plain disabled button (no submenu trigger) whose
//     second line reads "Not enrolled in this workshop".
//     Total Enrolled cards draw `wd-side-enrolled-tag` chips from enrolledTagNames[profileid] (stored order, names
//     from newusertags, ids with no name dropped); Top tags is `wdash-top-tag` / `-name` / `-count`.
//   • workshop-dashboard.component.ts — the enrolled snapshot (workshopref == this workshop) carries each doc's id
//     and tags; access is WorkshopAccess (workshop-access.model.ts). Manage tag is its own list-only check there,
//     NOT a WORKSHOP_ACCESS_KEYS entry (that would be a tick in Dashboard Access).
//   • The plan lets the build choose whether the submenu stays open after a choice (if Material allows it cleanly)
//     or closes. This build keeps it open (togglePersonTag stops the click before the panel's close), and
//     expectSubmenuStaysOpen() PINS that after every choice (2026-11-19 review: it used to only record it).
//   • The panel rows are tracked by person (trackPanelPerson), and the person menu is closed when its person leaves
//     the list (closePersonMenuIfGone): Material does not close a menu whose trigger is destroyed (WPT-12/13).
//
// Hook prefixes: `wd-*` (the person menu, side panel, metric cards) and `wdash-*` (Top tags), as in
// workshop-dashboard-side-person.spec.ts. `wd-side-person-tags`, `wd-side-person-tag` and `wd-side-person-tags-note`
// are new with this change, so the hub-ahead guard (scripts/readiness/landed-specs.cjs) skips this whole FILE on app
// branches that predate it. That is why these cases are a file of their own and not more cases in
// workshop-dashboard-side-person.spec.ts: the guard skips per file, and the side-person cases must keep running there.
//
// THE WORLD (seed-workshops.js §5 + §6c, plus seedPersonTagWorld in support/wshop.ts):
//   W_DASH  p0 'enrolled' (ENR_A, a progress row), p1 'enrollednotstarted' (ENR_B, no progress row). Each test sets
//           ENR_A.tags = [keep, venue] and ENR_B.tags = [keep] first and removes them after (the base seed has none).
//   Actors  mover — full dashboard access AND on "static meta data"/"Workshop Admin".clearworkshop (the tagging actor)
//           admin — full dashboard access, NOT on the list;  limited — no list, ['qanda','export'] on W_DASH.
//           WPT-04 changes the list / W_DASH's grants and restores both in a finally (as the clear-access spec does).
//   NU Alpha (base seed) — a still-new user never enrolled on W_DASH → New Users Not Enrolled.
//   p0 is also enrolled on ANOTHER workshop (wsPersonTagOtherEnrolledId, carrying keep): WPT-02/03 prove that doc is
//   byte-identical after a choice, so a write keyed on the profile id alone would show.
//   WPT-12 points W_DASH at an empty support-chat group (setupChatGroupPrecondition) and removes it in a finally.
//
// Anti-circularity: every expectation comes from the test's OWN admin-SDK reads — the tag list from newusertags
// (type == newusersegments, read here and sorted here), who is on the list from the Workshop Admin doc, the people
// and their tags from the enrolled docs — and each oracle is first pinned to this run's seed so it cannot be empty
// or drift silently. The writes asserted on are the APP's (polled back from Firestore after a click in the menu);
// the test's own writes are preconditions only and are never read back as the result.
import { test, expect, Page, Locator, Route } from '@playwright/test';
import {
  wsIds, wsMetaNames, wsProfileIds, wsAddIds, wsAddNames, wsLimitedGrants,
  installWshopStubs, loginAsWshopAdmin, loginAsWshopLimited, loginAsWshopMover, alignWorkshopMetadataNames,
  workshopAdminLists, workshopDashboardAccess, resetDashboardAccess, resetWorkshopAdminLists, setWorkshopClearList,
  setDashboardGrants, setEnrolledTags,
  wsPersonTags, wsPersonTagDupEnrolledId, seedPersonTagWorld, clearPersonTagWorld, enrollP1Twice, clearP1Twice,
  wsPersonTagOtherEnrolledId, wsPersonTagOtherWorkshopId, setupChatGroupPrecondition, teardownChatGroupPrecondition,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, queryWhere, db, pollUntil } from '../queue/support/firestore-admin';

const TG = wsPersonTags;
const P0 = wsMetaNames.p0;
const P1 = wsMetaNames.p1;
const ENROLLED = 'workshop participant enrolled';
const NOT_ENROLLED = 'Not enrolled in this workshop';
const NOT_STARTED = 'Not started — no data in this workshop yet';

const panelCard = (page: Page, name: string) =>
  page.locator('.participant-panel mat-card.participant-card').filter({ hasText: name });
const tagItems = (page: Page) => page.getByTestId('wd-side-person-tag');
const tagItem = (page: Page, name: string) => page.getByTestId('wd-side-person-tag').filter({ hasText: name });
const enrolledChips = (page: Page, name: string) => panelCard(page, name).first().getByTestId('wd-side-enrolled-tag');
const topTagRow = (page: Page, name: string) => page.getByTestId('wdash-top-tag').filter({ hasText: name });

/** Exactly this text (the tick / saving spinner next to a tag name is an icon with no text). */
const exactly = (s: string) => new RegExp(`^\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);

// ─── Oracles (admin SDK reads) ────────────────────────────────────────────────────────────────────────────────────

/**
 * [ORACLE] What Manage tag must offer: segment tags with a non-blank (trimmed) name, A→Z ignoring case. Names equal
 * once lower-cased keep the query's order (document id), as a stable sort of the app's own read would.
 */
async function segmentTagOracle(): Promise<{ id: string; name: string }[]> {
  const docs: any[] = await queryWhere('newusertags', [['type', '==', 'newusersegments']]);
  return docs.map(d => ({ id: String(d.id), name: String(d.name ?? '').trim() }))
    .filter(t => t.name)
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

/** [ORACLE] Names of the non-segment tags (calendar types, locations) — never offered. */
async function nonSegmentTagNames(): Promise<string[]> {
  const cal: any[] = await queryWhere('newusertags', [['type', '==', 'wccalendar']]);
  const loc: any[] = await queryWhere('newusertags', [['type', '==', 'location']]);
  return [...cal, ...loc].map(d => String(d.name ?? '').trim()).filter(Boolean);
}

/** Firestore values as plain, comparable JSON (Timestamps → millis, references → paths). */
function plain(v: any): any {
  if (v && typeof v.toMillis === 'function') return { ts: v.toMillis() };
  if (v && typeof v.path === 'string' && v.firestore) return { ref: v.path };
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, plain(v[k])]));
  return v;
}
const withoutTags = (d: any) => { const { tags, ...rest } = d || {}; void tags; return plain(rest); };

async function enrolledDoc(id: string): Promise<any> { return (await getDoc(ENROLLED, id)) as any; }

/** Every enrolled doc on W_DASH, id → its whole content (plain), optionally leaving some ids out. */
async function dashEnrolled(except: string[] = []): Promise<Record<string, any>> {
  const docs: any[] = await queryWhere(ENROLLED, [['workshopref', '==', db().collection('workshopconfiguration').doc(wsIds.W_DASH)]]);
  return Object.fromEntries(docs.filter(d => !except.includes(d.id)).map(d => [d.id, plain(d)]));
}

/**
 * Poll one enrolled doc until its tags are exactly `tags` (the APP's write). Then, with the submenu still open (the
 * default), wait until the chosen item has finished saving and reads the tick that result implies, and read the doc
 * again. No sleep: the tick comes from the live enrolled snapshot, which already includes every write the page still
 * has in flight, so a second (double) toggle queued behind the first would show as the wrong tick here, and would
 * then land on the doc.
 */
async function expectTagsLand(page: Page, tag: { id: string; name: string }, id: string, tags: string[], label: string,
  opts: { menuOpen?: boolean } = {}): Promise<any> {
  const same = (d: any) => JSON.stringify(Array.isArray(d?.tags) ? d.tags : null) === JSON.stringify(tags);
  const after = await pollUntil(() => enrolledDoc(id), same, { timeoutMs: 20_000, label });
  if (opts.menuOpen !== false) {
    const item = tagItem(page, tag.name);
    await expect(item, `${label}: the item has finished saving`).not.toHaveAttribute('aria-busy', 'true', { timeout: 20_000 });
    await expect(item, `${label}: and reads ${tags.includes(tag.id) ? 'ticked' : 'unticked'}`)
      .toHaveAttribute('aria-checked', tags.includes(tag.id) ? 'true' : 'false');
  }
  expect((await enrolledDoc(id))?.tags, `${label}: and it stays so`).toEqual(tags);
  return after;
}

// ─── UI helpers ──────────────────────────────────────────────────────────────────────────────────────────────────

async function openDashboard(page: Page): Promise<void> {
  await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });
  await expect(page.locator('nav.wdx-nav'), 'the dashboard has loaded').toBeVisible({ timeout: 90_000 });
}

async function openTotalEnrolled(page: Page): Promise<void> {
  await page.getByTestId('wd-on-metric-click-6').click({ timeout: 45_000 });
  await expect(panelCard(page, P0), 'p0 is in Total Enrolled').toBeVisible({ timeout: 30_000 });
}

/** Open the person menu from a panel row and check it is this person's. */
async function openPersonMenu(page: Page, name: string): Promise<void> {
  await panelCard(page, name).first().getByTestId('wd-side-person-name').click();
  await expect(page.locator('.mat-mdc-menu-panel.wdx-pmenu .wdx-pmenu-name').first(), `the menu is ${name}'s`).toHaveText(name);
  await expect(page.getByTestId('wd-side-person-view'), 'the person menu is open').toBeVisible();
}

/** Close the submenu and the person menu (Escape closes one level at a time). */
async function closePersonMenu(page: Page): Promise<void> {
  await expect(async () => {
    if (await page.getByTestId('wd-side-person-view').count()) await page.keyboard.press('Escape');
    await expect(page.getByTestId('wd-side-person-view')).toHaveCount(0, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/** Open Manage tag and wait until it lists exactly `names`, in that order. */
async function openTagMenu(page: Page, names: string[]): Promise<void> {
  const trigger = page.getByTestId('wd-side-person-tags');
  await expect(trigger, 'Manage tag is live').toBeEnabled();
  await trigger.click();
  await expect(page.getByTestId('wd-side-person-tag'), 'Manage tag lists the segment tags A→Z')
    .toHaveText(names.map(exactly), { timeout: 30_000 });
}

/** The Manage tag submenu's panel (the person menu's panel carries wdx-pmenu without wdx-ptags). */
const tagMenuPanel = (page: Page) => page.locator('.mat-mdc-menu-panel.wdx-ptags');

/**
 * After a choice the submenu STAYS OPEN — this build's choice under the plan (togglePersonTag stops the click before
 * the menu panel's close), so several tags can be set in a row. Pinned, not just recorded (2026-11-19 review): the
 * item has finished saving, every tag is still listed, the panel is not running its exit animation, and the person
 * menu behind it is still open.
 */
async function expectSubmenuStaysOpen(page: Page, tagName: string, names: string[], what: string): Promise<Locator> {
  const item = tagItem(page, tagName);
  await expect(item, `${what}: the item has finished saving`).not.toHaveAttribute('aria-busy', 'true', { timeout: 20_000 });
  await expect(tagItems(page), `${what}: the submenu stays open after a choice`).toHaveCount(names.length);
  await expect(tagMenuPanel(page), `${what}: one submenu, and it is not closing`).toHaveCount(1);
  await expect(tagMenuPanel(page)).not.toHaveClass(/mat-menu-panel-exit-animation/);
  await expect(page.getByTestId('wd-side-person-view'), `${what}: and the person menu behind it stays open`).toBeVisible();
  return item;
}

/**
 * Force a click and a hover on a DISABLED Manage tag and check nothing opened. (A live trigger opens its submenu on
 * either; a disabled one is stopped: no click event on a disabled button, and Material's hover stream skips disabled
 * items.) First wait until the menu's open animation is over and a hit-test at the item's centre finds the item
 * itself — while it runs the panel has `pointer-events: none` (see workshop-dashboard-side-person.spec.ts).
 */
async function forceOpenTagsExpectInert(page: Page, what: string): Promise<void> {
  const tags = page.getByTestId('wd-side-person-tags');
  await expect.poll(() => tags.evaluate((el: Element) => {
    const panel = el.closest('.mat-mdc-menu-panel');
    if (!panel || panel.getAnimations().length || panel.classList.contains('mat-menu-panel-animating')) return 'animating';
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit && el.contains(hit) ? 'item' : `hit ${hit ? hit.tagName + '.' + hit.className : 'nothing'}`;
  }), `${what}: a click at the item's centre reaches the item`).toBe('item');
  // Structural, so no waiting is needed: a submenu trigger always carries aria-haspopup (MatMenuTrigger sets it);
  // the disabled item is a plain button with no menu behind it.
  await expect(tags, `${what}: the disabled item opens no menu at all`).not.toHaveAttribute('aria-haspopup', /.+/);
  await tags.hover({ force: true });
  await tags.click({ force: true });
  await expect(page.getByTestId('wd-side-person-tag'), `${what}: no tag list opened`).toHaveCount(0);
  await expect(page.getByTestId('wd-side-person-tags-note'), `${what}: not even its loading line`).toHaveCount(0);
  await expect(page.getByTestId('wd-side-person-view'), `${what}: the person menu is still open`).toBeVisible();
  await expect(tags, `${what}: and Manage tag is still disabled`).toBeDisabled();
}

/** A Firestore channel POST's body, URL-decoded (the full SDK sends its messages form-encoded on WebChannel). */
function channelBody(postData: string | null): string {
  const raw = postData || '';
  try { return decodeURIComponent(raw.replace(/\+/g, ' ')); } catch { return raw; }
}

/**
 * Hold the APP's write that carries `marker` (a tag id) on its way to the emulator, so the choice stays "saving" for
 * as long as the test needs (WPT-09). The full SDK sends writes as POSTs on its Write channel: only a POST whose body
 * carries the marker is held; every other request on that channel goes straight on, and reads (the Listen channel)
 * are not routed at all. Always release() before dispose().
 */
async function holdWrite(page: Page, marker: string) {
  let release!: () => void;
  const released = new Promise<void>(r => { release = r; });
  let caught = 0;
  const pattern = '**/google.firestore.v1.Firestore/Write/channel**';
  const handler = async (route: Route) => {
    const req = route.request();
    if (req.method() === 'POST' && channelBody(req.postData()).includes(marker)) { caught++; await released; }
    await route.continue();
  };
  await page.route(pattern, handler);
  return { caught: () => caught, release: () => release(), dispose: () => page.unroute(pattern, handler) };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

test.describe('Workshop dashboard — person menu: Manage tag', () => {
  let guard: ConsoleGuard;
  test.beforeAll(async () => { await seedPersonTagWorld(); });
  test.afterAll(async () => {
    await clearPersonTagWorld();
    await resetDashboardAccess();      // backstops for WPT-04's finally blocks
    await resetWorkshopAdminLists();
  });
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await alignWorkshopMetadataNames();
    await clearP1Twice();
    // Known tags before the page loads (the enrolled snapshot then delivers them): p0 one segment + one location
    // tag, p1 the same segment tag.
    await setEnrolledTags(wsIds.ENR_A, [TG.keep.id, TG.venue.id]);
    await setEnrolledTags(wsIds.ENR_B, [TG.keep.id]);
    const a = await enrolledDoc(wsIds.ENR_A);
    const b = await enrolledDoc(wsIds.ENR_B);
    expect(a?.profileid === wsProfileIds.p0 && a?.status === 'enrolled', 'precondition: ENR_A is p0, started').toBe(true);
    expect(b?.profileid === wsProfileIds.p1 && b?.status === 'enrollednotstarted', 'precondition: ENR_B is p1, not started').toBe(true);
  });
  test.afterEach(async () => {
    await clearP1Twice();
    await setEnrolledTags(wsIds.ENR_A, null);
    await setEnrolledTags(wsIds.ENR_B, null);
    assertNoFatal(guard, 'person tags: no fatal console errors / pageerrors');
  });

  test('WPT-01 on the Clear list: Manage tag follows View participant data and lists the segment tags A→Z, ticked as stored', async ({ page }) => {
    // [ORACLE] who may tag, and what the list must be — read here, then pinned to this run's seed.
    const lists = await workshopAdminLists();
    expect(lists.clearWorkshop, 'WPT-01 oracle: mover is on the Clear list').toContain(wsProfileIds.mover);
    const segs = await segmentTagOracle();
    const names = segs.map(t => t.name);
    for (const t of [TG.apple, TG.banana, TG.add, TG.drop, TG.keep]) expect(names, `WPT-01 oracle: ${t.name} is a segment`).toContain(t.name);
    const blank: any = await getDoc('newusertags', TG.blank.id);
    expect(blank?.type === 'newusersegments' && blank?.name === '', 'WPT-01 oracle: a blank-named segment exists').toBe(true);
    expect(segs.map(s => s.id), 'WPT-01 oracle: and is left out').not.toContain(TG.blank.id);
    // Ignoring case, lower-case "wpt apple" sits between "WPT Add" and "WPT Banana" (a case-sensitive sort puts it last).
    expect(names.indexOf(TG.add.name) < names.indexOf(TG.apple.name) && names.indexOf(TG.apple.name) < names.indexOf(TG.banana.name),
      'WPT-01 oracle: A→Z ignoring case').toBe(true);
    const others = (await nonSegmentTagNames()).filter(n => !names.some(s => s.includes(n)));
    expect(others, 'WPT-01 oracle: the calendar-type and location tags exist').toEqual(expect.arrayContaining([TG.calendar.name, TG.venue.name]));
    const stored = (await enrolledDoc(wsIds.ENR_A))?.tags as string[];
    const checked = new Set(segs.filter(s => stored.includes(s.id)).map(s => s.name));
    expect([...checked], 'WPT-01 oracle: of the segments, p0 carries only keep').toEqual([TG.keep.name]);

    await loginAsWshopMover(page);
    await openDashboard(page);
    await openTotalEnrolled(page);
    await openPersonMenu(page, P0);

    const view = page.getByTestId('wd-side-person-view');
    const tags = page.getByTestId('wd-side-person-tags');
    await expect(tags, 'WPT-01: Manage tag is in the menu').toBeVisible();
    await expect(tags).toContainText('Manage tag');
    await expect(tags, 'WPT-01: live for an enrolled person').toBeEnabled();
    expect(await tags.evaluate(el => !!el.closest('.wdx-pmenu')), 'WPT-01: in the person menu').toBe(true);
    const tagsHandle = await tags.elementHandle();
    expect(await view.evaluate((v, t) => !!(v.compareDocumentPosition(t as Node) & Node.DOCUMENT_POSITION_FOLLOWING), tagsHandle),
      'WPT-01: View participant data comes first, then Manage tag').toBe(true);

    // [ASSERT] exactly the oracle, in its order.
    await tags.click();
    const items = tagItems(page);
    await expect(items, 'WPT-01: the segment tags, A→Z ignoring case').toHaveText(names.map(exactly), { timeout: 30_000 });
    await expect(page.getByTestId('wd-side-person-tags-note'), 'WPT-01: no loading / empty / failed line once listed').toHaveCount(0);

    // [NEGATIVE CONTROLS] calendar-type, location and blank-named tags are not offered.
    const texts = (await items.allTextContents()).map(t => t.trim());
    expect(texts.every(Boolean), 'WPT-01: no blank item').toBe(true);
    for (const n of others) expect(texts.join('\n'), `WPT-01: "${n}" (not a segment) is not offered`).not.toContain(n);

    // Ticks: a checkbox item per tag; only the segment p0's enrolment carries is ticked.
    const states = await items.evaluateAll(els => els.map(e => [e.getAttribute('role'), e.getAttribute('aria-checked')]));
    expect(states.map(s => s[0]), 'WPT-01: each tag is a checkbox menu item').toEqual(names.map(() => 'menuitemcheckbox'));
    expect(states.map(s => s[1]), 'WPT-01: ticked exactly where the enrolment carries the tag')
      .toEqual(names.map(n => (checked.has(n) ? 'true' : 'false')));

    // Opening the menus wrote nothing.
    expect((await enrolledDoc(wsIds.ENR_A))?.tags, 'WPT-01: looking changes nothing').toEqual([TG.keep.id, TG.venue.id]);
  });

  test("WPT-02 add: an unticked tag goes onto that person's enrolment here; their other tags and everyone else stay", async ({ page }) => {
    const names = (await segmentTagOracle()).map(t => t.name);
    expect(names, 'WPT-02 oracle').toContain(TG.add.name);

    await loginAsWshopMover(page);
    await openDashboard(page);
    await openTotalEnrolled(page);
    await openPersonMenu(page, P0);
    await openTagMenu(page, names);
    const add = tagItem(page, TG.add.name);
    await expect(add, 'WPT-02: one item for the tag').toHaveCount(1);
    await expect(add, 'WPT-02: unticked before').toHaveAttribute('aria-checked', 'false');

    const before = await enrolledDoc(wsIds.ENR_A);
    expect(before?.tags, 'WPT-02 precondition: p0 carries keep + venue').toEqual([TG.keep.id, TG.venue.id]);
    const othersBefore = await dashEnrolled([wsIds.ENR_A]);
    expect(Object.keys(othersBefore), 'WPT-02 precondition: p1 is another enrolled doc here').toContain(wsIds.ENR_B);
    const otherWs: any = await enrolledDoc(wsPersonTagOtherEnrolledId);
    expect(otherWs?.profileid === wsProfileIds.p0 && otherWs?.workshopref?.id === wsPersonTagOtherWorkshopId,
      'WPT-02 precondition: p0 is also enrolled on another workshop').toBe(true);
    const otherWsBefore = plain(otherWs);

    await add.click();

    // [ASSERT] the APP's write: appended to p0's tags, nothing else on the doc changed.
    const after = await expectTagsLand(page, TG.add, wsIds.ENR_A, [TG.keep.id, TG.venue.id, TG.add.id], 'WPT-02 add lands on ENR_A');
    expect(withoutTags(after), 'WPT-02: only the tags field is written').toEqual(withoutTags(before));
    // [NEGATIVE CONTROL] every other enrolled doc on this workshop (p1 carries keep too) is exactly as it was.
    expect(await dashEnrolled([wsIds.ENR_A]), 'WPT-02: nobody else is touched').toEqual(othersBefore);
    // [NEGATIVE CONTROL] and p0's own enrolment on another workshop is untouched: the write is this workshop's only.
    expect(plain(await enrolledDoc(wsPersonTagOtherEnrolledId)), 'WPT-02: p0\'s other-workshop enrolment is untouched').toEqual(otherWsBefore);

    const item = await expectSubmenuStaysOpen(page, TG.add.name, names, 'WPT-02');
    await expect(item, 'WPT-02: the item now reads ticked').toHaveAttribute('aria-checked', 'true');
    await expect(tagItem(page, TG.keep.name), 'WPT-02: keep is still ticked').toHaveAttribute('aria-checked', 'true');
    await expect(tagItem(page, TG.drop.name), 'WPT-02: an untouched tag stays unticked').toHaveAttribute('aria-checked', 'false');
  });

  test('WPT-03 remove: a ticked tag comes off the enrolment; the rest stay in order', async ({ page }) => {
    await setEnrolledTags(wsIds.ENR_A, [TG.keep.id, TG.venue.id, TG.drop.id]);
    const names = (await segmentTagOracle()).map(t => t.name);
    expect(names, 'WPT-03 oracle').toContain(TG.drop.name);

    await loginAsWshopMover(page);
    await openDashboard(page);
    await openTotalEnrolled(page);
    await openPersonMenu(page, P0);
    await openTagMenu(page, names);
    const drop = tagItem(page, TG.drop.name);
    await expect(drop, 'WPT-03: ticked before').toHaveAttribute('aria-checked', 'true');

    const before = await enrolledDoc(wsIds.ENR_A);
    expect(before?.tags, 'WPT-03 precondition').toEqual([TG.keep.id, TG.venue.id, TG.drop.id]);
    const othersBefore = await dashEnrolled([wsIds.ENR_A]);
    const otherWsBefore = plain(await enrolledDoc(wsPersonTagOtherEnrolledId));
    expect(otherWsBefore?.tags, 'WPT-03 precondition: p0\'s other-workshop enrolment carries keep').toEqual([TG.keep.id]);

    await drop.click();

    const after = await expectTagsLand(page, TG.drop, wsIds.ENR_A, [TG.keep.id, TG.venue.id], 'WPT-03 remove lands on ENR_A');
    expect(withoutTags(after), 'WPT-03: only the tags field is written').toEqual(withoutTags(before));
    expect(await dashEnrolled([wsIds.ENR_A]), 'WPT-03: nobody else is touched').toEqual(othersBefore);
    expect(plain(await enrolledDoc(wsPersonTagOtherEnrolledId)), 'WPT-03: p0\'s other-workshop enrolment is untouched').toEqual(otherWsBefore);

    const item = await expectSubmenuStaysOpen(page, TG.drop.name, names, 'WPT-03');
    await expect(item, 'WPT-03: the item now reads unticked').toHaveAttribute('aria-checked', 'false');
    await expect(tagItem(page, TG.keep.name), 'WPT-03: keep is still ticked').toHaveAttribute('aria-checked', 'true');
  });

  test('WPT-04a full dashboard access but not on the Clear list: View participant data, no Manage tag', async ({ page }) => {
    const lists = await workshopAdminLists();
    expect(lists.dashboardAdmins, 'WPT-04a oracle: admin has full dashboard access').toContain(wsProfileIds.admin);
    expect(lists.clearWorkshop, 'WPT-04a oracle: admin is not on the Clear list').not.toContain(wsProfileIds.admin);

    await loginAsWshopAdmin(page);
    await openDashboard(page);
    await openTotalEnrolled(page);
    await openPersonMenu(page, P0);
    // [REAL-UI] the menu rendered (View participant data), so the absence below cannot pass on an empty screen.
    await expect(page.getByTestId('wd-side-person-view')).toContainText('View participant data');
    await expect(page.getByTestId('wd-side-person-tags'), 'WPT-04a: full access alone gives no Manage tag').toHaveCount(0);
  });

  test("WPT-04b this workshop's own Clear tick is not enough; the same person on the list gets Manage tag", async ({ page }) => {
    await setDashboardGrants({ [wsProfileIds.limited]: [...wsLimitedGrants, 'participantprogress', 'clear'] });
    try {
      const lists = await workshopAdminLists();
      expect(lists.clearWorkshop, 'WPT-04b oracle: limited is not on the Clear list').not.toContain(wsProfileIds.limited);
      expect(lists.dashboardAdmins, 'WPT-04b oracle: nor a full-access admin').not.toContain(wsProfileIds.limited);
      const grants = await workshopDashboardAccess(wsIds.W_DASH);
      expect(grants[wsProfileIds.limited], 'WPT-04b oracle: Clear + participant progress ticked on this workshop')
        .toEqual(expect.arrayContaining(['clear', 'participantprogress']));

      await loginAsWshopLimited(page);
      await openDashboard(page);
      // can('clear') is true here — the Clear button shows — yet Manage tag must not.
      await expect(page.getByTestId('wd-open-clear-dialog-4'), 'WPT-04b: the tick gives Clear').toBeVisible({ timeout: 45_000 });
      await openTotalEnrolled(page);
      await openPersonMenu(page, P0);
      await expect(page.getByTestId('wd-side-person-tags'), 'WPT-04b: the Clear tick gives no Manage tag').toHaveCount(0);
      await closePersonMenu(page);

      // [POSITIVE CONTROL] the same person and grants, now on the list.
      await setWorkshopClearList([wsProfileIds.mover, wsProfileIds.limited]);
      await openDashboard(page);
      await openTotalEnrolled(page);
      await openPersonMenu(page, P0);
      await expect(page.getByTestId('wd-side-person-tags'), 'WPT-04b: on the list → Manage tag').toBeVisible();
      await expect(page.getByTestId('wd-side-person-tags')).toBeEnabled();
    } finally {
      await resetDashboardAccess();
      await resetWorkshopAdminLists();
    }
  });

  test('WPT-04c the list is what grants it: mover loses Manage tag when the list is emptied', async ({ page }) => {
    const lists = await workshopAdminLists();
    expect(lists.clearWorkshop, 'WPT-04c oracle: mover is on the Clear list').toContain(wsProfileIds.mover);

    await loginAsWshopMover(page);
    await openDashboard(page);
    await openTotalEnrolled(page);
    await openPersonMenu(page, P0);
    await expect(page.getByTestId('wd-side-person-tags'), 'WPT-04c: on the list → Manage tag').toBeVisible();
    await closePersonMenu(page);

    await setWorkshopClearList([]);
    try {
      await openDashboard(page);
      await expect(page.getByTestId('wd-manualenroll-5'), 'WPT-04c: still full access').toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('wd-open-clear-dialog-4'), 'WPT-04c: off the list → no Clear either').toHaveCount(0);
      await openTotalEnrolled(page);
      await openPersonMenu(page, P0);
      await expect(page.getByTestId('wd-side-person-tags'), 'WPT-04c: off the list → no Manage tag').toHaveCount(0);
    } finally {
      await resetWorkshopAdminLists();
    }
  });

  test('WPT-05 not enrolled here: Manage tag is disabled with a reason and writes nothing; not started is still taggable', async ({ page }) => {
    // [ORACLE] NU Alpha is a still-new user with no enrolment on this workshop; p1 is enrolled but not started.
    const nu: any = await getDoc('new_user_data', wsAddIds.NU_A);
    expect(nu?.name, 'WPT-05 oracle: NU Alpha is a new user').toBe(wsAddNames.nuAlpha);
    expect(nu?.movedtoexist === true, 'WPT-05 oracle: still new').toBe(false);
    const dashBefore = await dashEnrolled();
    expect(Object.values(dashBefore).some((d: any) => d.profileid === wsAddIds.NU_A), 'WPT-05 oracle: NU Alpha is not enrolled here').toBe(false);
    const nuTagsBefore = plain(nu?.tags ?? null);
    const names = (await segmentTagOracle()).map(t => t.name);

    await loginAsWshopMover(page);
    await openDashboard(page);

    // [POSITIVE CONTROL] enrolled, not started: no participant data, but Manage tag is live and lists the tags.
    await page.getByTestId('wd-on-metric-click-17').click({ timeout: 45_000 });
    await expect(panelCard(page, P1).first(), 'WPT-05: p1 is in Not Started').toBeVisible({ timeout: 30_000 });
    await openPersonMenu(page, P1);
    await expect(page.getByTestId('wd-side-person-view'), 'WPT-05: p1 has no participant data').toBeDisabled();
    await expect(page.getByTestId('wd-side-person-view')).toContainText(NOT_STARTED);
    await expect(page.getByTestId('wd-side-person-tags'), 'WPT-05: a live Manage tag is a submenu trigger')
      .toHaveAttribute('aria-haspopup', 'menu');
    await openTagMenu(page, names);
    await closePersonMenu(page);
    await page.getByTestId('wd-close-participant-panel-61').click();

    // [ASSERT] New Users Not Enrolled: no enrolment here → disabled, with a reason, opens nothing.
    await page.getByTestId('wd-on-metric-click-20').click({ timeout: 45_000 });
    await expect(panelCard(page, wsAddNames.nuAlpha), 'WPT-05: NU Alpha is in New Users Not Enrolled').toHaveCount(1, { timeout: 30_000 });
    await openPersonMenu(page, wsAddNames.nuAlpha);
    await expect(page.getByTestId('wd-side-person-view')).toContainText(NOT_ENROLLED);
    const tags = page.getByTestId('wd-side-person-tags');
    await expect(tags, 'WPT-05: Manage tag is shown').toBeVisible();
    await expect(tags).toContainText('Manage tag');
    await expect(tags, 'WPT-05: disabled').toBeDisabled();
    const reason = (await tags.innerText()).replace(/manage tag/i, '').trim();
    expect(reason, 'WPT-05: with a short reason').not.toBe('');
    await expect(tags, 'WPT-05: the same wording as View participant data').toContainText(NOT_ENROLLED);
    expect(reason, 'WPT-05: in plain words (no field or collection names)').not.toMatch(/workshop participant enrolled|newusertags|profileid|workshopref/i);
    await forceOpenTagsExpectInert(page, 'WPT-05 NU Alpha');
    await closePersonMenu(page);

    // [ASSERT] nothing was written: no enrolment appeared, NU Alpha's own tags and every enrolled doc are unchanged.
    // (The disabled item has no menu and no click handler that writes — proven structurally above — so no wait.)
    expect(await dashEnrolled(), 'WPT-05: no enrolled doc on this workshop changed or appeared').toEqual(dashBefore);
    expect(plain(((await getDoc('new_user_data', wsAddIds.NU_A)) as any)?.tags ?? null), 'WPT-05: NU Alpha\'s own tags are unchanged')
      .toEqual(nuTagsBefore);
  });

  test("WPT-06 the open panel's chips and Top tags follow an add and a remove", async ({ page }) => {
    const names = (await segmentTagOracle()).map(t => t.name);
    // [ORACLE] the tag names on W_DASH's enrolled docs, plus the one to add, fit in Top tags (5 rows) — so the new
    // row cannot be cut off by leftovers.
    const ids = new Set<string>(Object.values(await dashEnrolled()).flatMap((d: any) => (Array.isArray(d.tags) ? d.tags : [])));
    ids.add(TG.add.id);
    const tagNames = new Set<string>();
    for (const id of ids) { const t: any = await getDoc('newusertags', id); const n = String(t?.name ?? '').trim(); if (n) tagNames.add(n); }
    expect(tagNames.size, `WPT-06 precondition: at most 5 tag names on this workshop (${[...tagNames].join(', ')})`).toBeLessThanOrEqual(5);

    await loginAsWshopMover(page);
    await openDashboard(page);
    await expect(topTagRow(page, TG.keep.name), 'WPT-06 precondition: Top tags has loaded (keep)').toHaveCount(1, { timeout: 30_000 });
    await expect(topTagRow(page, TG.add.name), 'WPT-06 precondition: nobody carries add yet').toHaveCount(0);

    await openTotalEnrolled(page);
    await expect(enrolledChips(page, P0), 'WPT-06 precondition: p0 chips in stored order').toHaveText([TG.keep.name, TG.venue.name], { timeout: 30_000 });
    await expect(enrolledChips(page, P1), 'WPT-06 precondition: p1 chips').toHaveText([TG.keep.name]);

    await openPersonMenu(page, P0);
    await openTagMenu(page, names);
    await tagItem(page, TG.add.name).click();
    await expectTagsLand(page, TG.add, wsIds.ENR_A, [TG.keep.id, TG.venue.id, TG.add.id], 'WPT-06 add lands on ENR_A');

    // [ASSERT] the open panel (never reopened) and Top tags catch up.
    await expect(page.locator('aside.participant-panel'), 'WPT-06: the panel is still open').toHaveClass(/panel-visible/);
    await expect(enrolledChips(page, P0), 'WPT-06: p0 chips gain the tag, in stored order').toHaveText([TG.keep.name, TG.venue.name, TG.add.name]);
    await expect(enrolledChips(page, P1), 'WPT-06: p1 chips stay').toHaveText([TG.keep.name]);
    await expect(topTagRow(page, TG.add.name), 'WPT-06: Top tags gains the tag').toHaveCount(1);
    await expect(topTagRow(page, TG.add.name).getByTestId('wdash-top-tag-count'), 'WPT-06: carried by one person').toHaveText(/^\s*1 · \d+%\s*$/);

    // And back: remove it.
    const item = await expectSubmenuStaysOpen(page, TG.add.name, names, 'WPT-06');
    await expect(item).toHaveAttribute('aria-checked', 'true');
    await item.click();
    await expectTagsLand(page, TG.add, wsIds.ENR_A, [TG.keep.id, TG.venue.id], 'WPT-06 remove lands on ENR_A');
    await expectSubmenuStaysOpen(page, TG.add.name, names, 'WPT-06 after the remove');
    await expect(page.locator('aside.participant-panel'), 'WPT-06: the panel is still open').toHaveClass(/panel-visible/);
    await expect(enrolledChips(page, P0), 'WPT-06: p0 chips lose the tag').toHaveText([TG.keep.name, TG.venue.name]);
    await expect(topTagRow(page, TG.add.name), 'WPT-06: Top tags loses the tag').toHaveCount(0);
    await expect(enrolledChips(page, P1), 'WPT-06: p1 chips still stay').toHaveText([TG.keep.name]);
  });

  test('WPT-07 a second enrolment here gets the same add and the same remove', async ({ page }) => {
    await enrollP1Twice([TG.venue.id]);
    const names = (await segmentTagOracle()).map(t => t.name);
    // [ORACLE] p1 has exactly two enrolled docs on W_DASH: ENR_B (keep) and the second one (venue).
    const p1Docs = Object.entries(await dashEnrolled()).filter(([, d]: [string, any]) => d.profileid === wsProfileIds.p1).map(([id]) => id).sort();
    expect(p1Docs, 'WPT-07 oracle: p1 is enrolled here twice').toEqual([wsIds.ENR_B, wsPersonTagDupEnrolledId].sort());
    const bBefore = await enrolledDoc(wsIds.ENR_B);
    const dupBefore = await enrolledDoc(wsPersonTagDupEnrolledId);
    expect(bBefore?.tags, 'WPT-07 precondition').toEqual([TG.keep.id]);
    expect(dupBefore?.tags, 'WPT-07 precondition').toEqual([TG.venue.id]);

    await loginAsWshopMover(page);
    await openDashboard(page);
    await page.getByTestId('wd-on-metric-click-17').click({ timeout: 45_000 });
    await expect(panelCard(page, P1).first(), 'WPT-07: p1 is in Not Started').toBeVisible({ timeout: 30_000 });
    await openPersonMenu(page, P1);
    await openTagMenu(page, names);
    await expect(tagItem(page, TG.add.name), 'WPT-07: unticked before').toHaveAttribute('aria-checked', 'false');
    const othersBefore = await dashEnrolled([wsIds.ENR_B, wsPersonTagDupEnrolledId]);

    await tagItem(page, TG.add.name).click();
    // [ASSERT] both of p1's docs gain it; each keeps its own other tags; only tags are written; nobody else is touched.
    const bAdded = await expectTagsLand(page, TG.add, wsIds.ENR_B, [TG.keep.id, TG.add.id], 'WPT-07 add lands on ENR_B');
    const dupAdded = await expectTagsLand(page, TG.add, wsPersonTagDupEnrolledId, [TG.venue.id, TG.add.id], 'WPT-07 add lands on the second doc');
    expect(withoutTags(bAdded), 'WPT-07: ENR_B only tags').toEqual(withoutTags(bBefore));
    expect(withoutTags(dupAdded), 'WPT-07: the second doc only tags').toEqual(withoutTags(dupBefore));
    expect(await dashEnrolled([wsIds.ENR_B, wsPersonTagDupEnrolledId]), 'WPT-07: nobody else is touched').toEqual(othersBefore);

    const item = await expectSubmenuStaysOpen(page, TG.add.name, names, 'WPT-07');
    await expect(item, 'WPT-07: ticked').toHaveAttribute('aria-checked', 'true');
    await item.click();
    await expectTagsLand(page, TG.add, wsIds.ENR_B, [TG.keep.id], 'WPT-07 remove lands on ENR_B');
    await expectTagsLand(page, TG.add, wsPersonTagDupEnrolledId, [TG.venue.id], 'WPT-07 remove lands on the second doc');
    expect(await dashEnrolled([wsIds.ENR_B, wsPersonTagDupEnrolledId]), 'WPT-07: still nobody else').toEqual(othersBefore);
  });

  test('WPT-08 the tick follows a change made elsewhere while the submenu is open; choosing it then removes it', async ({ page }) => {
    const names = (await segmentTagOracle()).map(t => t.name);
    expect(names, 'WPT-08 oracle').toContain(TG.add.name);

    await loginAsWshopMover(page);
    await openDashboard(page);
    await openTotalEnrolled(page);
    await openPersonMenu(page, P0);
    await openTagMenu(page, names);
    const add = tagItem(page, TG.add.name);
    await expect(add, 'WPT-08: unticked before').toHaveAttribute('aria-checked', 'false');

    // Someone else adds it meanwhile (the admin SDK stands in for another dashboard).
    await setEnrolledTags(wsIds.ENR_A, [TG.keep.id, TG.venue.id, TG.add.id]);
    await expect(add, 'WPT-08: reads ticked without reopening').toHaveAttribute('aria-checked', 'true', { timeout: 20_000 });
    await expect(tagItems(page), 'WPT-08: the submenu is still open').toHaveCount(names.length);

    // [ASSERT] the choice follows the CURRENT tags: a remove, not a second add (arrayUnion would leave it on).
    await add.click();
    await expectTagsLand(page, TG.add, wsIds.ENR_A, [TG.keep.id, TG.venue.id], 'WPT-08 the choice removes it');
    await expectSubmenuStaysOpen(page, TG.add.name, names, 'WPT-08');
  });

  test('WPT-09 a second click while a choice is saving is ignored: the tag is added once, never added then removed', async ({ page }) => {
    const names = (await segmentTagOracle()).map(t => t.name);

    await loginAsWshopMover(page);
    await openDashboard(page);
    await openTotalEnrolled(page);
    await openPersonMenu(page, P0);
    await openTagMenu(page, names);
    const add = tagItem(page, TG.add.name);
    await expect(add, 'WPT-09: unticked before').toHaveAttribute('aria-checked', 'false');

    const hold = await holdWrite(page, TG.add.id);
    try {
      await add.dblclick();
      await expect.poll(() => hold.caught(), { message: 'WPT-09: the app sends its write, and it is held', timeout: 20_000 }).toBe(1);
      // Saving: busy and disabled, and already ticked (the live snapshot includes the write in flight).
      await expect(add, 'WPT-09: busy while it saves').toHaveAttribute('aria-busy', 'true');
      await expect(add, 'WPT-09: disabled while it saves').toBeDisabled();
      await expect(add, 'WPT-09: ticked from the write in flight').toHaveAttribute('aria-checked', 'true');
      // More clicks on the saving item: a guard that let one through would plan a REMOVE from that tick.
      await add.click({ force: true });
      await add.dblclick({ force: true });
      expect(hold.caught(), 'WPT-09: still the one write').toBe(1);
    } finally {
      hold.release();
    }
    try {
      // [ASSERT] once released: added exactly once, and the tick (which includes anything still queued) agrees.
      await expectTagsLand(page, TG.add, wsIds.ENR_A, [TG.keep.id, TG.venue.id, TG.add.id], 'WPT-09 added once');
      await expectSubmenuStaysOpen(page, TG.add.name, names, 'WPT-09');
    } finally {
      await hold.dispose();
    }
  });

  test('WPT-10 keyboard: ArrowRight opens Manage tag, ArrowDown + Enter adds, Enter again removes, focus stays on the item', async ({ page }) => {
    const names = (await segmentTagOracle()).map(t => t.name);
    const idx = names.indexOf(TG.add.name);
    expect(idx, 'WPT-10 oracle').toBeGreaterThanOrEqual(0);

    await loginAsWshopMover(page);
    await openDashboard(page);
    await openTotalEnrolled(page);
    await openPersonMenu(page, P0);
    // Let the list load first (opened once, then closed with ArrowLeft), so the keyboard open lands on a full list.
    await openTagMenu(page, names);
    await page.keyboard.press('ArrowLeft');
    await expect(tagItems(page), 'WPT-10: ArrowLeft closes the tag list').toHaveCount(0);
    const tags = page.getByTestId('wd-side-person-tags');
    await expect(page.getByTestId('wd-side-person-view'), 'WPT-10: the person menu stays').toBeVisible();

    await tags.focus();
    await page.keyboard.press('ArrowRight');
    await expect(tagItems(page), 'WPT-10: ArrowRight opens the tag list').toHaveText(names.map(exactly), { timeout: 30_000 });
    await expect(tagItems(page).first(), 'WPT-10: with the first tag focused').toBeFocused();
    for (let i = 0; i < idx; i++) await page.keyboard.press('ArrowDown');
    const add = tagItem(page, TG.add.name);
    await expect(add, 'WPT-10: ArrowDown reaches the tag').toBeFocused();

    await page.keyboard.press('Enter');
    await expectTagsLand(page, TG.add, wsIds.ENR_A, [TG.keep.id, TG.venue.id, TG.add.id], 'WPT-10 Enter adds');
    await expectSubmenuStaysOpen(page, TG.add.name, names, 'WPT-10 after Enter');
    await expect(add, 'WPT-10: focus is back on the item once it has saved').toBeFocused();

    await page.keyboard.press('Enter');
    await expectTagsLand(page, TG.add, wsIds.ENR_A, [TG.keep.id, TG.venue.id], 'WPT-10 Enter again removes');
    await expectSubmenuStaysOpen(page, TG.add.name, names, 'WPT-10 after Enter again');
    await expect(add, 'WPT-10: and focus is still on the item').toBeFocused();
  });

  test('WPT-11 the tag list is read lazily: not on first paint, once on the first person-menu open, not again', async ({ page }) => {
    const names = (await segmentTagOracle()).map(t => t.name);
    // Every Listen-channel message that asks for the segment tags (the full SDK's reads go out as form-encoded POSTs).
    const reads: string[] = [];
    page.on('request', req => {
      if (req.method() === 'POST' && req.url().includes('/google.firestore.v1.Firestore/Listen/channel')
        && channelBody(req.postData()).includes('newusersegments')) reads.push(req.url());
    });

    await loginAsWshopMover(page);
    await openDashboard(page);
    await openTotalEnrolled(page);
    // The dashboard has painted and resolved its tag NAMES (the chips) — without the segment list.
    await expect(enrolledChips(page, P0), 'WPT-11: the dashboard is loaded, tag names included').toHaveText([TG.keep.name, TG.venue.name], { timeout: 30_000 });
    await expect(topTagRow(page, TG.keep.name), 'WPT-11: Top tags too').toHaveCount(1, { timeout: 30_000 });
    expect(reads.length, 'WPT-11: no segment-tag read before any person menu opens').toBe(0);

    // [POSITIVE CONTROL] the first person-menu open sends it (so the zero above is not a blind spot).
    await openPersonMenu(page, P0);
    await expect.poll(() => reads.length, { message: 'WPT-11: the first person-menu open reads the tag list', timeout: 20_000 }).toBe(1);
    await openTagMenu(page, names);
    await closePersonMenu(page);

    // Another person, another open: the list read once is used again.
    await openPersonMenu(page, P1);
    await openTagMenu(page, names);
    expect(reads.length, 'WPT-11: read once per visit').toBe(1);
  });

  test('WPT-12 Users Not in Chat Group: a choice keeps both menus open while the live snapshot rebuilds the panel', async ({ page }) => {
    const names = (await segmentTagOracle()).map(t => t.name);
    await setupChatGroupPrecondition();   // an EMPTY group on W_DASH: p0 and p1 are both missing from it
    try {
      await loginAsWshopMover(page);
      await openDashboard(page);
      const chatCard = page.getByTestId('wdash-chat-card');
      await expect(chatCard, 'WPT-12 precondition: the card shows for the empty group').toBeVisible({ timeout: 30_000 });
      await chatCard.click();
      await expect(page.locator('.participant-panel.panel-visible .panel-header'), 'WPT-12: the Not in Chat Group panel is open')
        .toContainText('Chat Group', { timeout: 15_000 });
      await expect(panelCard(page, P0), 'WPT-12: p0 is listed').toHaveCount(1, { timeout: 30_000 });
      // p0's row element: one rebuilt under the open menu would be a new element, taking the menu's trigger with it.
      await panelCard(page, P0).first().evaluate(el => { (window as any).__wptRow = el; });

      await openPersonMenu(page, P0);
      await openTagMenu(page, names);
      // Each choice changes the enrolled doc, so the live snapshot recomputes this panel's people (new entries).
      await tagItem(page, TG.add.name).click();
      await expectTagsLand(page, TG.add, wsIds.ENR_A, [TG.keep.id, TG.venue.id, TG.add.id], 'WPT-12 add lands on ENR_A');
      await expectSubmenuStaysOpen(page, TG.add.name, names, 'WPT-12 after the add');
      // A second choice: by the time it has landed, the panel has long been recomputed for the first one.
      await tagItem(page, TG.add.name).click();
      await expectTagsLand(page, TG.add, wsIds.ENR_A, [TG.keep.id, TG.venue.id], 'WPT-12 remove lands on ENR_A');
      await expectSubmenuStaysOpen(page, TG.add.name, names, 'WPT-12 after the remove');
      expect(await panelCard(page, P0).first().evaluate(el => el === (window as any).__wptRow),
        "WPT-12: p0's row was kept, never rebuilt under the menu").toBe(true);
      await expect(panelCard(page, P1), 'WPT-12: p1 is still listed').toHaveCount(1);
    } finally {
      await teardownChatGroupPrecondition();
    }
  });

  test('WPT-13 a ticked Tag filter: removing that tag drops the person and closes both menus, nothing left floating', async ({ page }) => {
    const names = (await segmentTagOracle()).map(t => t.name);
    // [ORACLE] keep's carriers on W_DASH are exactly p0 and p1 (the beforeEach), so the filtered panel is those two.
    const carriers = Object.values(await dashEnrolled())
      .filter((d: any) => Array.isArray(d.tags) && d.tags.includes(TG.keep.id)).map((d: any) => d.profileid).sort();
    expect(carriers, 'WPT-13 oracle: keep is on p0 and p1 only').toEqual([wsProfileIds.p0, wsProfileIds.p1].sort());

    await loginAsWshopMover(page);
    await openDashboard(page);
    await openTotalEnrolled(page);
    await expect(enrolledChips(page, P0), 'WPT-13 precondition: chips loaded').toHaveText([TG.keep.name, TG.venue.name], { timeout: 30_000 });
    await page.getByTestId('wd-button-63').click();
    await page.getByTestId('wd-side-tag-option').filter({ hasText: TG.keep.name }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('wd-side-tag-filter'), 'WPT-13: the filter menu has closed').toHaveCount(0);
    const cards = page.locator('.participant-panel mat-card.participant-card');
    await expect(cards, 'WPT-13: the Keep filter lists its two carriers').toHaveCount(2, { timeout: 15_000 });
    await expect(panelCard(page, P0)).toHaveCount(1);
    await expect(panelCard(page, P1)).toHaveCount(1);

    await openPersonMenu(page, P0);
    await openTagMenu(page, names);
    await expect(tagItem(page, TG.keep.name), 'WPT-13: keep is ticked').toHaveAttribute('aria-checked', 'true');
    await tagItem(page, TG.keep.name).click();
    await expectTagsLand(page, TG.keep, wsIds.ENR_A, [TG.venue.id], 'WPT-13 remove lands on ENR_A', { menuOpen: false });

    // [ASSERT] p0 no longer matches the filter and leaves; the menus close with the row, none left floating.
    await expect(panelCard(page, P0), 'WPT-13: p0 leaves the filtered panel').toHaveCount(0, { timeout: 15_000 });
    await expect(panelCard(page, P1), 'WPT-13: p1 stays').toHaveCount(1);
    await expect(tagItems(page), 'WPT-13: the tag submenu closed').toHaveCount(0);
    await expect(page.getByTestId('wd-side-person-view'), 'WPT-13: so did the person menu').toHaveCount(0);
    await expect(page.locator('.mat-mdc-menu-panel.wdx-pmenu'), 'WPT-13: no menu panel is left on the page').toHaveCount(0);
    await expect(page.locator('.cdk-overlay-backdrop'), 'WPT-13: nor a backdrop').toHaveCount(0);

    // [POSITIVE CONTROL] the next person's menu opens and works as usual.
    await openPersonMenu(page, P1);
    await openTagMenu(page, names);
    await expect(tagItem(page, TG.keep.name), 'WPT-13: p1 still carries keep').toHaveAttribute('aria-checked', 'true');
  });
});
