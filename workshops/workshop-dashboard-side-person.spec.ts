// workshop-dashboard-side-person.spec.ts — the side panel's person menu (operator 2026-11-17).
//   WDP-01  A side-panel row no longer links to /userprofile: no such link, the name is not inside an <a>, and
//           clicking the name opens no new page and leaves the URL alone (it opens a menu instead)
//   WDP-02  The menu names the person; "View participant data" closes the panel and opens THAT person's
//           Participant Data (the same as clicking their row in the progress table), scrolled into view, with
//           keyboard focus moved to the Participant Data heading (not lost with the closing panel)
//   WDP-03  A not-started person (Not Started panel) has no data in this workshop: the item is disabled, says
//           so, and clicking it does nothing (the menu stays open)
//   WDP-04  Negative control: without the participant progress right (limited) the name is plain text
//   WDP-05  Share Clicked on a workshop of its own: a sharer with NO enrolled doc here reads "Not enrolled in this
//           workshop" (disabled; clicking leaves the menu open), although they are enrolled and started in ANOTHER
//           workshop; in the same panel the enrolled-not-started sharer reads "Not started — no data in this
//           workshop yet" and the started sharer's item is live and opens their Participant Data
//   WDP-06  The other panels that list people with no enrolled doc: Purchase (a buyer who never enrolled) and New
//           Users Not Enrolled (a still-new user) read "Not enrolled in this workshop"; the disabled item leaves the
//           menu open, and the side panel and the Participant Data already picked stay as they were
//
// HOW "clicking does nothing" is told apart from a live item (forceClickExpectInert): for a person with no progress
// row, viewPersonData() returns before it closes the side panel, and onParticipantClick() never selects someone with
// no enrolled doc here — so "the side panel stays open" and "Participant Data is unchanged" hold whether the item is
// disabled or not. They only describe behaviour. What differs is the MENU: a live mat-menu item's click bubbles to
// the menu panel's (click), which closes the menu even when viewPersonData() returned early; a disabled one is
// stopped (MatMenuItem._checkDisabled), so the menu stays open. Together with toBeDisabled() that is what fails if
// the item were always enabled. The click must also reach the item: while the menu's open animation runs the panel
// has `pointer-events: none` and a click at the item's centre lands on the overlay pane, so the helper first waits
// until a hit-test at the centre finds the item.
//
// NOT covered here: Sale Achieved. It no longer opens this side panel — its card opens a full-screen dialog
// (workshop-dashboard-sale-dialog.spec.ts, WSD-01..04). Its buyers come only from Watson, and the emulator build sets
// `watson: null` on purpose, so the emulator reaches only the dialog's "unavailable" state.
//
// Recon: starlabs-angular src/app/New-Workshop/workshop-dashboard/
//   • workshop-dashboard.component.html — the row (wd-a-84) is a plain <div>; the name is
//     `button.wdx-name.participant-name[data-testid=wd-side-person-name]` (a mat-menu trigger) when
//     can('participantprogress'), else a plain span; ONE shared <mat-menu #personMenu> (class wdx-pmenu) whose
//     item `wd-side-person-view` reads "View participant data" + "In <workshop title>" or, disabled, the
//     personMenuNoDataNote line (below).
//   • workshop-dashboard.component.ts — personHasData(p): the person has a row in participantProgressList
//     (the table's rows; only status 'enrolled' people get one). viewPersonData(p): closeParticipantPanel()
//     (the close button's handler), then onParticipantClick(row) → Participant Data + scroll to #participantDataCard;
//     550 ms later it focuses the section heading `h2.wdx-pd-focus` (tabindex -1). The disabled line's wording is
//     personMenuNoDataNote (engine): not enrolled / Not started / Started — no progress recorded yet (WDG-10).
//
// Hook prefix: `wd-*`. `wd-side-person-name` and `wd-side-person-view` are new with this change, so the hub-ahead
// guard (scripts/readiness/landed-specs.cjs) skips this FILE on app branches that predate it.
//
// THE WORLD (seed-workshops.js §5 + §6c, unchanged): on W_DASH, p0 is 'enrolled' with a participant workshop doc
// (a progress row) and p1 is 'enrollednotstarted' (no progress row). `limited` has ['qanda','export'] on
// W_DASH — no participant progress right. Names are the CF-owned metadata names (alignWorkshopMetadataNames).
//
// WDP-05/06 WORLD (seedPersonMenuWorld in support/wshop.ts — its OWN workshops; W_DASH is untouched):
//   PMENU  evergreen + paid (so Share Clicked and Purchase exist). Share Clicked = outsider, waiting, started;
//          Purchase = outsider. Enrolled docs here: waiting 'enrollednotstarted' (no participant workshop doc),
//          started 'enrolled' + participant workshop doc (a progress row). The outsider has NONE here.
//   OTHER  the outsider is enrolled and started there (so "this workshop" is what the wording is about).
//   New Users Not Enrolled on PMENU lists the base seed's still-new NU Alpha (never enrolled here).
// The panels' person sets and each person's enrolled doc are read back from Firestore first, so the wording each
// case expects follows from the data, not from the seed's intent.
import { test, expect, Page, Locator } from '@playwright/test';
import {
  wsIds, wsMetaNames, installWshopStubs, loginAsWshopAdmin, loginAsWshopLimited, alignWorkshopMetadataNames,
  resetParticipantWorkshopP0, wsLimitedGrants,
  wsPmenu, seedPersonMenuWorld, clearPersonMenuWorld, wsAddIds, wsAddNames,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, queryWhere, db } from '../queue/support/firestore-admin';

const panelCard = (page: Page, name: string) =>
  page.locator('.participant-panel mat-card.participant-card').filter({ hasText: name });

/**
 * Force-click a disabled "View participant data" and check the click was swallowed: the person menu is still open.
 * (See the header: the side panel and Participant Data cannot tell a disabled item from a live one for a person with
 * no progress row; the menu can, because a live item's click closes it.) First wait until the open animation is over
 * and a click at the item's centre hits the item itself, not the overlay pane under a `pointer-events: none` panel.
 */
async function forceClickExpectInert(page: Page, view: Locator, what: string): Promise<void> {
  const menu = page.locator('.mat-mdc-menu-panel.wdx-pmenu');
  await expect.poll(() => view.evaluate((el: Element) => {
    const panel = el.closest('.mat-mdc-menu-panel');
    if (!panel || panel.getAnimations().length || panel.classList.contains('mat-menu-panel-animating')) return 'animating';
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit && el.contains(hit) ? 'item' : `hit ${hit ? hit.tagName + '.' + hit.className : 'nothing'}`;
  }), `${what}: a click at the item's centre reaches the item`).toBe('item');
  await view.click({ force: true });
  await page.waitForTimeout(500);   // a live item's click would have closed the menu by now (exit animation ≤ 200 ms)
  await expect(menu, `${what}: the menu stays open (a live item's click closes it)`).toBeVisible();
  await expect(menu, `${what}: and is not closing`).not.toHaveClass(/mat-menu-panel-exit-animation/);
  await expect(view, `${what}: the item is still there, disabled`).toBeDisabled();
}

async function openDashboard(page: Page): Promise<void> {
  await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });
  await expect(page.locator('nav.wdx-nav'), 'the dashboard has loaded').toBeVisible({ timeout: 90_000 });
}

test.describe('Workshop dashboard — side panel person menu', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await alignWorkshopMetadataNames();
    await resetParticipantWorkshopP0();
    // Preconditions: who has a progress row and who does not.
    const a: any = await getDoc('workshop participant enrolled', wsIds.ENR_A);
    const b: any = await getDoc('workshop participant enrolled', wsIds.ENR_B);
    expect(a?.status, 'precondition: p0 has started').toBe('enrolled');
    expect(b?.status, 'precondition: p1 has not started').toBe('enrollednotstarted');
  });
  test.afterEach(async () => {
    assertNoFatal(guard, 'side person menu: no fatal console errors / pageerrors');
  });

  test('WDP-01 the name opens a menu, not /userprofile in a new tab', async ({ page, context }) => {
    await loginAsWshopAdmin(page);
    await openDashboard(page);
    await page.getByTestId('wd-on-metric-click-6').click({ timeout: 45_000 });
    const card = panelCard(page, wsMetaNames.p0);
    await expect(card, 'WDP-01: p0 is in Total Enrolled').toBeVisible({ timeout: 30_000 });

    await expect(page.locator('.participant-panel a[href*="userprofile"]'), 'WDP-01: no link to /userprofile in the panel').toHaveCount(0);
    const name = card.getByTestId('wd-side-person-name');
    await expect(name, 'WDP-01: the name is the trigger').toHaveText(wsMetaNames.p0);
    await expect(name, 'WDP-01: it keeps the name class the hub reads').toHaveClass(/participant-name/);
    expect(await name.evaluate(el => el.tagName), 'WDP-01: a button').toBe('BUTTON');
    await expect(name.locator('xpath=ancestor::a'), 'WDP-01: not inside a link').toHaveCount(0);
    await expect(card.getByTestId('wd-a-84').locator('mat-icon', { hasText: 'open_in_new' }), 'WDP-01: no external-link icon').toHaveCount(0);

    let opened = 0;
    context.on('page', () => { opened++; });
    const url = page.url();
    await name.click();
    await expect(page.getByTestId('wd-side-person-view'), 'WDP-01: the menu opens').toBeVisible();
    await page.waitForTimeout(500);   // give a stray window.open/new tab the chance to appear
    expect(opened, 'WDP-01: no new page').toBe(0);
    expect(page.url(), 'WDP-01: the URL is unchanged').toBe(url);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('wd-side-person-view')).toHaveCount(0);
  });

  test('WDP-02 View participant data closes the panel and opens that person\'s Participant Data', async ({ page }) => {
    const w: any = await getDoc('workshopconfiguration', wsIds.W_DASH);
    const title = String(w?.detailpage?.title || '');
    expect(title, 'WDP-02 precondition: the workshop has a title').not.toBe('');

    await loginAsWshopAdmin(page);
    await openDashboard(page);
    const pd = page.locator('#participantDataCard');
    await expect(pd, 'WDP-02 precondition: nobody selected yet').toContainText('No Participant Selected', { timeout: 45_000 });
    await expect(pd, 'WDP-02 precondition: Participant Data is below the fold').not.toBeInViewport();

    await page.getByTestId('wd-on-metric-click-6').click();
    const card = panelCard(page, wsMetaNames.p0);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByTestId('wd-side-person-name').click();

    const menu = page.locator('.mat-mdc-menu-panel.wdx-pmenu');
    await expect(menu.locator('.wdx-pmenu-name'), 'WDP-02: the menu names the person').toHaveText(wsMetaNames.p0);
    const view = page.getByTestId('wd-side-person-view');
    await expect(view).toContainText('View participant data');
    await expect(view, 'WDP-02: it says which workshop').toContainText(`In ${title}`);
    await expect(view).toBeEnabled();
    await view.click();

    await expect(page.locator('aside.participant-panel'), 'WDP-02: the panel closes').not.toHaveClass(/panel-visible/);
    await expect(page.getByTestId('wd-side-person-view'), 'WDP-02: the menu closes').toHaveCount(0);
    await expect(pd.locator('.wdx-pd-name'), 'WDP-02: Participant Data shows THAT person').toContainText(wsMetaNames.p0, { timeout: 30_000 });
    await expect(pd, 'WDP-02: and is scrolled into view').toBeInViewport({ timeout: 10_000 });
    await expect(pd.locator('h2.wdx-pd-focus'), 'WDP-02: focus moves to the Participant Data heading').toBeFocused({ timeout: 5_000 });
    await expect(page.locator('tr[data-testid="wd-on-participant-click-39"].wdx-is-picked'),
      'WDP-02: the same person is picked in the table, as a row click would').toHaveCount(1);
  });

  test('WDP-03 a not-started person: the item is disabled, says why, and does nothing', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openDashboard(page);
    await page.getByTestId('wd-on-metric-click-17').click({ timeout: 45_000 });
    const card = panelCard(page, wsMetaNames.p1);
    await expect(card, 'WDP-03: p1 is in Not Started').toBeVisible({ timeout: 30_000 });
    await card.getByTestId('wd-side-person-name').click();

    const view = page.getByTestId('wd-side-person-view');
    await expect(view, 'WDP-03: disabled').toBeDisabled();
    await expect(view).toContainText('Not started — no data in this workshop yet');
    await expect(view).not.toContainText('In ');
    await forceClickExpectInert(page, view, 'WDP-03');
    await expect(page.locator('aside.participant-panel'), 'WDP-03: the panel stays open').toHaveClass(/panel-visible/);
    await expect(page.locator('#participantDataCard'), 'WDP-03: nobody was selected').toContainText('No Participant Selected');
    await expect(page.locator('#participantDataCard .wdx-pd-name')).toHaveCount(0);
  });

  test('WDP-04 without the participant progress right the name is plain text', async ({ page }) => {
    expect(wsLimitedGrants, 'WDP-04 precondition: limited has no participant progress right').not.toContain('participantprogress');
    await loginAsWshopLimited(page);
    await openDashboard(page);
    await page.getByTestId('wd-on-metric-click-6').click({ timeout: 45_000 });
    const card = panelCard(page, wsMetaNames.p0);
    await expect(card, 'WDP-04: p0 is listed').toBeVisible({ timeout: 30_000 });
    await expect(card.locator('.participant-name'), 'WDP-04: the name still shows').toHaveText(wsMetaNames.p0);
    expect(await card.locator('.participant-name').evaluate(el => el.tagName), 'WDP-04: as plain text').toBe('SPAN');
    await expect(page.getByTestId('wd-side-person-name'), 'WDP-04: no menu trigger anywhere').toHaveCount(0);
  });
});

// ─── WDP-05/06: who reads "Not enrolled in this workshop" (seedPersonMenuWorld — its OWN workshops) ─────────────
const PM = wsPmenu;
const NOT_ENROLLED = 'Not enrolled in this workshop';
const NOT_STARTED = 'Not started — no data in this workshop yet';
const STARTED_NO_ROW = 'Started — no progress recorded yet';

/** The enrolled docs on a workshop, keyed by profileid (first doc wins, as the dashboard reads them). */
async function enrolledOn(workshopId: string): Promise<Map<string, any>> {
  const docs: any[] = await queryWhere('workshop participant enrolled',
    [['workshopref', '==', db().collection('workshopconfiguration').doc(workshopId)]]);
  const out = new Map<string, any>();
  for (const d of docs) if (d.profileid && !out.has(d.profileid)) out.set(d.profileid, d);
  return out;
}

async function openPmenuDashboard(page: Page): Promise<void> {
  await page.goto(`/workshop_dashboard/${PM.WORKSHOP}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${PM.WORKSHOP}`), { timeout: 30_000 });
  await expect(page.locator('nav.wdx-nav'), 'the dashboard has loaded').toBeVisible({ timeout: 90_000 });
  // Both the enrolled and the progress snapshots have delivered: the started person's row is in the table.
  await expect(page.getByTestId('wd-on-participant-click-39').filter({ hasText: PM.people.started.name }),
    'the started person has a progress row').toHaveCount(1, { timeout: 60_000 });
}

const panelNames = (page: Page) => page.locator('.participant-panel mat-card.participant-card .participant-name');

/**
 * Open a panel from its card until it lists exactly `names` (any order). The sharer / buyer names are read after
 * the ids arrive and the panel is built on click, so reopen until they are there (a load race, never a different set).
 */
async function openPanelListing(page: Page, card: Locator, names: string[], what: string): Promise<void> {
  await expect(async () => {
    if (await page.locator('aside.participant-panel.panel-visible').count()) {
      await page.getByTestId('wd-close-participant-panel-61').click();
    }
    await card.click();
    await expect.poll(async () => (await panelNames(page).allTextContents()).map(n => n.trim()).sort(), { timeout: 5_000 })
      .toEqual([...names].sort());
  }, what).toPass({ timeout: 60_000 });
}

/** Open the person menu from a panel row and check it is this person's. */
async function openPersonMenu(page: Page, name: string): Promise<Locator> {
  await panelCard(page, name).getByTestId('wd-side-person-name').click();
  await expect(page.locator('.mat-mdc-menu-panel.wdx-pmenu .wdx-pmenu-name'), `the menu is ${name}'s`).toHaveText(name);
  return page.getByTestId('wd-side-person-view');
}

async function closePersonMenu(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('wd-side-person-view')).toHaveCount(0);
}

test.describe('Workshop dashboard — person menu: "Not enrolled in this workshop"', () => {
  let guard: ConsoleGuard;
  test.beforeAll(async () => { await seedPersonMenuWorld(); });
  test.afterAll(async () => { await clearPersonMenuWorld(); });
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    assertNoFatal(guard, 'person menu (not enrolled): no fatal console errors / pageerrors');
  });

  test('WDP-05 Share Clicked: no enrolled doc here reads "Not enrolled in this workshop"; not started and started do not', async ({ page }) => {
    // [ORACLE] who Share Clicked lists, and what each one has on THIS workshop — read back, then pinned to the seed.
    const ws: any = await getDoc('workshopconfiguration', PM.WORKSHOP);
    expect(ws?.evergreenWorkshop, 'WDP-05 precondition: Share Clicked only exists on an evergreen workshop').toBe(true);
    const title = String(ws?.detailpage?.title || '');
    expect(title, 'WDP-05 precondition: the workshop has a title').not.toBe('');
    const refs: any[] = await queryWhere('workshopreferral', [['workshopref', '==', db().collection('workshopconfiguration').doc(PM.WORKSHOP)]]);
    const clicked = refs.filter(r => r.profileid && !((Number(r.claimed) || 0) > 0)).map(r => r.profileid as string);
    const { outsider, waiting, started } = PM.people;
    expect(clicked.sort(), 'WDP-05 oracle: Share Clicked = outsider, waiting, started')
      .toEqual([outsider.id, waiting.id, started.id].sort());
    const here = await enrolledOn(PM.WORKSHOP);
    expect(here.has(outsider.id), 'WDP-05 oracle: the outsider has NO enrolled doc on this workshop').toBe(false);
    expect(here.get(waiting.id)?.status, 'WDP-05 oracle: waiting is enrolled, not started').toBe('enrollednotstarted');
    expect(here.get(started.id)?.status, 'WDP-05 oracle: started is enrolled (started)').toBe('enrolled');
    const pw: any[] = await queryWhere('participant workshop', [['profileid', '==', started.id]]);
    expect(pw.filter(d => d.workshopref?.id === PM.WORKSHOP), 'WDP-05 oracle: started has a participant workshop doc here').toHaveLength(1);
    // The outsider IS enrolled and started elsewhere, so a lookup that ignored the workshop would say "Started".
    expect((await enrolledOn(PM.OTHER)).get(outsider.id)?.status, 'WDP-05 oracle: the outsider started ANOTHER workshop').toBe('enrolled');
    const names = await Promise.all(clicked.map(async id => String(((await getDoc('profile_data', id)) as any)?.name || '')));
    expect(names.sort(), 'WDP-05 oracle: the sharer names (profile_data)').toEqual([outsider.name, waiting.name, started.name].sort());

    await loginAsWshopAdmin(page);
    await openPmenuDashboard(page);
    const pd = page.locator('#participantDataCard');
    await expect(pd, 'WDP-05 precondition: nobody selected yet').toContainText('No Participant Selected');
    await expect(page.getByTestId('wd-on-metric-click-21').locator('.metric-value'), 'WDP-05: Share Clicked counts the three')
      .toHaveText(String(clicked.length), { timeout: 60_000 });
    await openPanelListing(page, page.getByTestId('wd-on-metric-click-21'), names, 'WDP-05: Share Clicked lists the three sharers');

    // [POSITIVE CONTROL] the started sharer has a progress row: the item is live and names the workshop.
    let view = await openPersonMenu(page, started.name);
    await expect(view, 'WDP-05: started → enabled').toBeEnabled();
    await expect(view).toContainText(`In ${title}`);
    await closePersonMenu(page);

    // [NEGATIVE CONTROL] enrolled but not started: disabled, and NOT the "not enrolled" wording.
    view = await openPersonMenu(page, waiting.name);
    await expect(view, 'WDP-05: not started → disabled').toBeDisabled();
    await expect(view, 'WDP-05: not started wording').toContainText(NOT_STARTED);
    await expect(view).not.toContainText(NOT_ENROLLED);
    await closePersonMenu(page);

    // [ASSERT] no enrolled doc on this workshop: disabled, "Not enrolled in this workshop" — never "Not started" or
    // "Started" (the outsider's enrolled + started doc on OTHER must not leak in), never "In <title>".
    view = await openPersonMenu(page, outsider.name);
    await expect(view, 'WDP-05: not enrolled → disabled').toBeDisabled();
    await expect(view, 'WDP-05: the not-enrolled wording').toContainText(NOT_ENROLLED);
    await expect(view).not.toContainText(NOT_STARTED);
    await expect(view).not.toContainText(STARTED_NO_ROW);
    await expect(view).not.toContainText('In ');
    await forceClickExpectInert(page, view, 'WDP-05 outsider');
    await expect(page.locator('aside.participant-panel'), 'WDP-05: the panel stays open').toHaveClass(/panel-visible/);
    await expect(pd, 'WDP-05: nobody was selected').toContainText('No Participant Selected');
    await expect(pd.locator('.wdx-pd-name')).toHaveCount(0);
    await closePersonMenu(page);

    // The same item on the started sharer does act (so "does nothing" above is the disabled state, not a dead menu).
    view = await openPersonMenu(page, started.name);
    await view.click();
    await expect(page.locator('aside.participant-panel'), 'WDP-05: started → the panel closes').not.toHaveClass(/panel-visible/);
    await expect(pd.locator('.wdx-pd-name'), 'WDP-05: started → their Participant Data').toContainText(started.name, { timeout: 30_000 });
  });

  test('WDP-06 Purchase and New Users Not Enrolled read "Not enrolled in this workshop"; the picked Participant Data stays', async ({ page }) => {
    // [ORACLE] Purchase = the buyers on this workshop; New Users Not Enrolled includes the still-new NU Alpha.
    const ws: any = await getDoc('workshopconfiguration', PM.WORKSHOP);
    expect(ws?.evergreenWorkshop === true && ws?.payment === true, 'WDP-06 precondition: Purchase only exists on an evergreen paid workshop').toBe(true);
    const pays: any[] = await queryWhere('workshoppaymentlog', [['workshopref', '==', db().collection('workshopconfiguration').doc(PM.WORKSHOP)]]);
    const buyers = [...new Set(pays.map(p => p.profileid).filter(Boolean))];
    const { outsider, started } = PM.people;
    expect(buyers, 'WDP-06 oracle: the outsider is the only buyer').toEqual([outsider.id]);
    const here = await enrolledOn(PM.WORKSHOP);
    expect(here.has(outsider.id), 'WDP-06 oracle: the buyer never enrolled here').toBe(false);
    const nu: any = await getDoc('new_user_data', wsAddIds.NU_A);
    expect(nu?.name, 'WDP-06 oracle: NU Alpha is a new user').toBe(wsAddNames.nuAlpha);
    expect(nu?.movedtoexist === true, 'WDP-06 oracle: NU Alpha is still new').toBe(false);
    expect(here.has(wsAddIds.NU_A), 'WDP-06 oracle: NU Alpha is not enrolled here').toBe(false);

    await loginAsWshopAdmin(page);
    await openPmenuDashboard(page);
    // Pick the started person from the table first, so "nothing changes" has something to keep.
    const pd = page.locator('#participantDataCard');
    await page.getByTestId('wd-on-participant-click-39').filter({ hasText: started.name }).click();
    await expect(pd.locator('.wdx-pd-name'), 'WDP-06 precondition: the started person is picked').toContainText(started.name, { timeout: 30_000 });

    // Purchase: the buyer with no enrolled doc here.
    await expect(page.getByTestId('wd-on-metric-click-23').locator('.metric-value'), 'WDP-06: Purchase counts the one buyer')
      .toHaveText('1', { timeout: 60_000 });
    await openPanelListing(page, page.getByTestId('wd-on-metric-click-23'), [outsider.name], 'WDP-06: Purchase lists the buyer');
    let view = await openPersonMenu(page, outsider.name);
    await expect(view, 'WDP-06: Purchase, not enrolled → disabled').toBeDisabled();
    await expect(view, 'WDP-06: Purchase, the not-enrolled wording').toContainText(NOT_ENROLLED);
    await expect(view).not.toContainText(NOT_STARTED);
    await expect(view).not.toContainText(STARTED_NO_ROW);
    await forceClickExpectInert(page, view, 'WDP-06 Purchase');
    await expect(page.locator('aside.participant-panel'), 'WDP-06: the panel stays open').toHaveClass(/panel-visible/);
    await expect(pd.locator('.wdx-pd-name'), 'WDP-06: the picked Participant Data is unchanged').toContainText(started.name);
    await closePersonMenu(page);
    await page.getByTestId('wd-close-participant-panel-61').click();

    // New Users Not Enrolled: a still-new user who never enrolled here.
    await page.getByTestId('wd-on-metric-click-20').click();
    const nuCard = panelCard(page, wsAddNames.nuAlpha);
    await expect(nuCard, 'WDP-06: NU Alpha is in New Users Not Enrolled').toHaveCount(1, { timeout: 30_000 });
    view = await openPersonMenu(page, wsAddNames.nuAlpha);
    await expect(view, 'WDP-06: new user, not enrolled → disabled').toBeDisabled();
    await expect(view, 'WDP-06: new user, the not-enrolled wording').toContainText(NOT_ENROLLED);
    await expect(view).not.toContainText(NOT_STARTED);
    await forceClickExpectInert(page, view, 'WDP-06 new user');
    await expect(page.locator('aside.participant-panel'), 'WDP-06: the panel stays open').toHaveClass(/panel-visible/);
    await expect(pd.locator('.wdx-pd-name'), 'WDP-06: still the picked person').toContainText(started.name);
    await closePersonMenu(page);
  });
});
