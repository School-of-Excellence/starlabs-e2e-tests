// workshop-dashboard-side-person.spec.ts — the side panel's person menu (operator 2026-11-17).
//   WDP-01  A side-panel row no longer links to /userprofile: no such link, the name is not inside an <a>, and
//           clicking the name opens no new page and leaves the URL alone (it opens a menu instead)
//   WDP-02  The menu names the person; "View participant data" closes the panel and opens THAT person's
//           Participant Data (the same as clicking their row in the progress table), scrolled into view, with
//           keyboard focus moved to the Participant Data heading (not lost with the closing panel)
//   WDP-03  A not-started person (Not Started panel) has no data in this workshop: the item is disabled, says
//           so, and clicking it does nothing
//   WDP-04  Negative control: without the participant progress right (limited) the name is plain text
//
// Recon: starlabs-angular src/app/New-Workshop/workshop-dashboard/
//   • workshop-dashboard.component.html — the row (wd-a-84) is a plain <div>; the name is
//     `button.wdx-name.participant-name[data-testid=wd-side-person-name]` (a mat-menu trigger) when
//     can('participantprogress'), else a plain span; ONE shared <mat-menu #personMenu> (class wdx-pmenu) whose
//     item `wd-side-person-view` reads "View participant data" + "In <workshop title>" or, disabled,
//     "Not started — no data in this workshop yet".
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
import { test, expect, Page } from '@playwright/test';
import {
  wsIds, wsMetaNames, installWshopStubs, loginAsWshopAdmin, loginAsWshopLimited, alignWorkshopMetadataNames,
  resetParticipantWorkshopP0, wsLimitedGrants,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc } from '../queue/support/firestore-admin';

const panelCard = (page: Page, name: string) =>
  page.locator('.participant-panel mat-card.participant-card').filter({ hasText: name });

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
    await view.click({ force: true });
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
