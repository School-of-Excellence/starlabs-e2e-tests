// workshop-dashboard-redesign.spec.ts — the workshop dashboard redesign (2026-11-17, "Heritage Ledger"):
// the sticky section index under the header.
//
// Recon: starlabs-angular specs/journals/2026-11-17-workshop-dashboard-redesign.md and
// src/app/New-Workshop/workshop-dashboard/workshop-dashboard.component.html (the <nav class="wdx-nav">).
//
// Hook prefix: `wdash-nav-*` (workshop-dashboard.component.html — the section index; one hook per link:
// wdash-nav-glance, wdash-nav-journey, wdash-nav-challenges, wdash-nav-participants, wdash-nav-pdata,
// wdash-nav-submissions, wdash-nav-platform). Every other hook this file touches belongs to the same
// template (`wd-*`, `wdash-*`) and is already driven elsewhere. The seven nav hooks land with the redesign,
// so the hub-ahead guard (scripts/readiness/landed-specs.cjs) skips this FILE on app branches without it.
//
// The redesign is UI only: every number the index shows is a value the component already computed
// (challengeStatistics.length, participantProgressList.length) and every link only scrolls. So:
// Anti-circularity:
//   • WDR-01 compares the two counts in the index with INDEPENDENT Firestore reads: the workshop's
//     challenges[] length, and the `workshop participant enrolled` docs with status 'enrolled' that have a
//     `participant workshop` doc for the same workshop (the rows of the progress table). The test writes
//     neither. The table's own row count corroborates the second.
//   • WDR-02/05 prove each link MOVES the page: the target starts outside the landing band (just under
//     the sticky index) and ends inside it; the scroll is the app's, never the test's.
//   • WDR-03 is the conditional link's positive half (evergreen world seeded, day nodes counted against
//     evergreenWorkshopMeta.workshopDays in Firestore); WDR-01 holds its negative half (W_DASH is not
//     evergreen). WDR-04 is the access negative: `limited` (granted qanda + export only) gets no
//     Participant data / Submissions links and none of those sections, while the open links still render.
// All reads are single-equality queries or single-doc gets — NO composite index needed.
import { test, expect, Page, Locator } from '@playwright/test';
import {
  wsIds, wsEvergreenIds, installWshopStubs, loginAsWshopAdmin, loginAsWshopLimited,
  seedEvergreenExtended, clearEvergreenExtended,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, queryWhere, db } from '../queue/support/firestore-admin';

async function openDashboard(page: Page, workshopId: string): Promise<void> {
  await page.goto(`/workshop_dashboard/${workshopId}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${workshopId}`), { timeout: 30_000 });
  await expect(page.locator('nav.wdx-nav'), 'the section index renders once the dashboard has loaded')
    .toBeVisible({ timeout: 90_000 });
}

/** The page scrolls inside the app shell (mat-drawer-content), not the window. */
async function scrollShell(page: Page, to: 'top' | 'bottom'): Promise<void> {
  await page.locator('nav.wdx-nav').evaluate((nav, where) => {
    let el: HTMLElement | null = nav.parentElement;
    while (el && !(/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight)) {
      el = el.parentElement;
    }
    const s = el || (document.scrollingElement as HTMLElement);
    s.scrollTop = where === 'top' ? 0 : s.scrollHeight;
  }, to);
}

/** Top of `target` minus the bottom of the sticky index, in px. A section a link scrolled to lands at ~13. */
async function offsetUnderIndex(page: Page, target: Locator): Promise<number> {
  const navBottom = await page.locator('nav.wdx-nav').evaluate((e) => e.getBoundingClientRect().bottom);
  const top = await target.evaluate((e) => e.getBoundingClientRect().top);
  return Math.round(top - navBottom);
}

/** 'landed' once the section's top sits in the band a link scrolls it to (under the index, inside the
 *  60px scroll margin); otherwise the offset, so a failure says where the section stopped. */
async function landing(page: Page, target: Locator): Promise<string> {
  const off = await offsetUnderIndex(page, target);
  return off >= -2 && off <= 40 ? 'landed' : `offset ${off}px`;
}

/**
 * Drive one section link: start from the far end of the page so the section is NOT under the index,
 * click the link (as given — a literal getByTestId at the call site), and wait for the app's smooth
 * scroll to land the section just below the sticky index (scroll-margin-top clears its 46px).
 */
async function linkLandsSection(page: Page, link: Locator, target: Locator, startAt: 'top' | 'bottom', what: string): Promise<void> {
  await expect(target, `${what}: the target section exists`).toHaveCount(1, { timeout: 30_000 });
  await scrollShell(page, startAt);
  await expect.poll(async () => Math.abs(await offsetUnderIndex(page, target)), {
    message: `${what}: precondition — the section starts away from the index`, timeout: 5_000,
  }).toBeGreaterThan(60);
  await link.click();
  await expect.poll(() => landing(page, target), {
    message: `${what}: the link brings the section up to just under the index`, timeout: 10_000,
  }).toBe('landed');
  // The index is sticky: it is still on screen after the jump, so the next section is one click away.
  await expect(page.locator('nav.wdx-nav'), `${what}: the index stays in view`).toBeInViewport();
}

test.describe('Workshop dashboard redesign — section index (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'workshop dashboard redesign: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // WDR-01 — the index lists every section once, with the challenge and participant counts
  // ===========================================================================================
  test('WDR-01 the section index shows the sections a full-access admin has, with Firestore-true counts', async ({ page }) => {
    // [ORACLE] independent reads: challenges in the workshop doc; rows the progress table can have.
    const ws: any = await getDoc('workshopconfiguration', wsIds.W_DASH);
    const challengeCount = (ws?.challenges || []).length;
    expect(challengeCount, 'WDR-01: precondition — W_DASH carries challenges').toBeGreaterThan(0);
    expect(ws?.evergreenWorkshop === true, 'WDR-01: precondition — W_DASH is not evergreen').toBe(false);
    const dashRef = (db() as any).collection('workshopconfiguration').doc(wsIds.W_DASH);
    const started = await queryWhere('workshop participant enrolled', [['workshopref', '==', dashRef], ['status', '==', 'enrolled']]);
    const withProgress = new Set((await queryWhere('participant workshop', [['workshopref', '==', dashRef]])).map((d: any) => d.profileid));
    const participantCount = started.filter((d: any) => withProgress.has(d.profileid)).length;
    expect(participantCount, 'WDR-01: precondition — at least one participant has progress').toBeGreaterThan(0);

    await loginAsWshopAdmin(page);
    await openDashboard(page, wsIds.W_DASH);

    // [ASSERT] the six links a full-access admin has on a regular workshop, in page order.
    const nav = page.locator('nav.wdx-nav');
    await expect(page.getByTestId('wdash-nav-glance'), 'WDR-01: At a glance').toHaveText('At a glance');
    await expect(page.getByTestId('wdash-nav-challenges'), 'WDR-01: Challenge progress').toContainText('Challenge progress');
    await expect(page.getByTestId('wdash-nav-participants'), 'WDR-01: Participants').toContainText('Participants');
    await expect(page.getByTestId('wdash-nav-pdata'), 'WDR-01: Participant data (participant progress right)').toHaveText('Participant data');
    await expect(page.getByTestId('wdash-nav-submissions'), 'WDR-01: Submissions (archive rights)').toHaveText('Submissions');
    await expect(page.getByTestId('wdash-nav-platform'), 'WDR-01: Platform usage').toHaveText('Platform usage');
    await expect(nav.locator('button'), 'WDR-01: nothing else in the index').toHaveCount(6);
    // [ASSERT] negative half of WDR-03: no journey on a workshop that is not evergreen — link and section.
    await expect(page.getByTestId('wdash-nav-journey'), 'WDR-01: no Participant journey link on a regular workshop').toHaveCount(0);
    await expect(page.locator('section[aria-label="Participant Journey"]')).toHaveCount(0);

    // [ASSERT] the counts are the app's, compared with Firestore.
    await expect(page.getByTestId('wdash-nav-challenges').locator('.wdx-nav-n'), 'WDR-01: challenge count = challenges[] in Firestore')
      .toHaveText(String(challengeCount), { timeout: 30_000 });
    await expect(page.getByTestId('wdash-nav-participants').locator('.wdx-nav-n'), 'WDR-01: participant count = started enrolments with progress in Firestore')
      .toHaveText(String(participantCount), { timeout: 60_000 });
    const rows = page.locator('table.progress-table tr.mat-mdc-row, table.progress-table tr[mat-row]');
    await expect(rows, 'WDR-01: the progress table holds the same people').toHaveCount(participantCount, { timeout: 60_000 });
  });

  // ===========================================================================================
  // WDR-02 — every link scrolls its own section up under the index
  // ===========================================================================================
  test('WDR-02 each section link brings its section up under the sticky index', async ({ page }) => {
    test.setTimeout(150_000);
    await loginAsWshopAdmin(page);
    await openDashboard(page, wsIds.W_DASH);
    // Let the data settle so the page height is final before measuring.
    await expect(page.locator('table.progress-table tr.mat-mdc-row, table.progress-table tr[mat-row]').first())
      .toBeVisible({ timeout: 90_000 });

    await linkLandsSection(page, page.getByTestId('wdash-nav-glance'),
      page.locator('section[aria-label="At a glance"]'), 'bottom', 'WDR-02 At a glance');
    await expect(page.getByTestId('wd-on-metric-click-6'), 'WDR-02: At a glance lands on the headline figures').toBeInViewport();

    await linkLandsSection(page, page.getByTestId('wdash-nav-challenges'),
      page.locator('#wdx-challenges'), 'bottom', 'WDR-02 Challenge progress');
    await expect(page.getByTestId('wd-toggle-challenge-panel-27').first()).toBeInViewport();

    await linkLandsSection(page, page.getByTestId('wdash-nav-participants'),
      page.locator('#wdx-participants'), 'top', 'WDR-02 Participants');
    await expect(page.locator('mat-card.participants-card').getByPlaceholder('Search by name or email')).toBeInViewport();

    await linkLandsSection(page, page.getByTestId('wdash-nav-pdata'),
      page.locator('#participantDataCard'), 'top', 'WDR-02 Participant data');

    await linkLandsSection(page, page.getByTestId('wdash-nav-submissions'),
      page.locator('#wdx-submissions'), 'top', 'WDR-02 Submissions');
    await expect(page.locator('h2.arc-title', { hasText: 'All Assignments' })).toBeInViewport();

    // Platform usage is the last section: the page bottom stops it short of the index on a short
    // page, so the oracle is "off screen before, on screen after" rather than the landing band.
    const platform = page.getByTestId('wdash-platform-section');
    await scrollShell(page, 'top');
    await expect(platform, 'WDR-02 Platform usage: precondition — off screen at the top of the page').not.toBeInViewport();
    await page.getByTestId('wdash-nav-platform').click();
    await expect(platform, 'WDR-02 Platform usage: the link brings the section on screen').toBeInViewport({ ratio: 0.5, timeout: 10_000 });
    await expect(page.locator('nav.wdx-nav')).toBeInViewport();
  });

  // ===========================================================================================
  // WDR-03 — the Participant journey link: evergreen only, and it reaches the day track
  // ===========================================================================================
  test.describe('evergreen world', () => {
    test.beforeEach(async () => { await seedEvergreenExtended(); });
    test.afterEach(async () => { await clearEvergreenExtended(); });

    test('WDR-03 an evergreen workshop adds Participant journey, which scrolls to the day track', async ({ page }) => {
      const ws: any = await getDoc('workshopconfiguration', wsEvergreenIds.WORKSHOP);
      const days = Number(ws?.evergreenWorkshopMeta?.workshopDays) || 0;
      expect(ws?.evergreenWorkshop, 'WDR-03: precondition — the seeded workshop is evergreen').toBe(true);
      expect(days, 'WDR-03: precondition — it has a day count').toBeGreaterThan(0);

      await loginAsWshopAdmin(page);
      await openDashboard(page, wsEvergreenIds.WORKSHOP);

      // [ASSERT] the link appears, second in the index (right after At a glance), and the section exists.
      const link = page.getByTestId('wdash-nav-journey');
      await expect(link, 'WDR-03: Participant journey link on an evergreen workshop').toHaveText('Participant journey', { timeout: 60_000 });
      await expect(page.locator('nav.wdx-nav button').nth(1), 'WDR-03: it sits right after At a glance').toHaveText('Participant journey');
      const journey = page.locator('section[aria-label="Participant Journey"]');
      // [ASSERT] the day track has one node per workshop day — the Firestore day count.
      await expect(page.getByTestId('wd-on-day-click-24'), 'WDR-03: one day node per workshop day').toHaveCount(days, { timeout: 60_000 });

      await linkLandsSection(page, link, journey, 'bottom', 'WDR-03 Participant journey');
      await expect(page.getByTestId('wd-on-day-click-24').first(), 'WDR-03: the day track is on screen').toBeInViewport();
    });
  });

  // ===========================================================================================
  // WDR-04 — links follow the access gate: no Participant data / Submissions without those rights
  // ===========================================================================================
  test('WDR-04 limited access hides the Participant data and Submissions links with their sections', async ({ page }) => {
    await loginAsWshopLimited(page);
    await openDashboard(page, wsIds.W_DASH);

    // [REAL-UI] the positive half: the links nobody needs a right for are there for this person.
    await expect(page.getByTestId('wdash-nav-glance'), 'WDR-04: At a glance renders for limited').toBeVisible();
    await expect(page.getByTestId('wdash-nav-challenges')).toBeVisible();
    await expect(page.getByTestId('wdash-nav-participants')).toBeVisible();
    await expect(page.getByTestId('wdash-nav-platform')).toBeVisible();

    // [ASSERT] no link to a section the person cannot see, and the sections really are absent.
    await expect(page.getByTestId('wdash-nav-pdata'), 'WDR-04: no Participant data link without the participant progress right').toHaveCount(0);
    await expect(page.locator('#participantDataCard')).toHaveCount(0);
    await expect(page.getByTestId('wdash-nav-submissions'), 'WDR-04: no Submissions link without an archive right').toHaveCount(0);
    await expect(page.locator('#wdx-submissions')).toHaveCount(0);
    await expect(page.locator('h2.arc-title')).toHaveCount(0);
    await expect(page.locator('nav.wdx-nav button'), 'WDR-04: four links in all').toHaveCount(4);

    // The remaining links still work for this person.
    await linkLandsSection(page, page.getByTestId('wdash-nav-participants'),
      page.locator('#wdx-participants'), 'top', 'WDR-04 Participants');
  });

  // ===========================================================================================
  // WDR-05 — the links are real buttons: reachable and usable from the keyboard
  // ===========================================================================================
  test('WDR-05 a section link works from the keyboard', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openDashboard(page, wsIds.W_DASH);
    await expect(page.locator('table.progress-table tr.mat-mdc-row, table.progress-table tr[mat-row]').first())
      .toBeVisible({ timeout: 90_000 });

    const link = page.getByTestId('wdash-nav-challenges');
    await expect(link, 'WDR-05: the link is a button (keyboard focusable, no href to leave the page)')
      .toHaveJSProperty('tagName', 'BUTTON');
    const target = page.locator('#wdx-challenges');
    await scrollShell(page, 'bottom');
    await expect.poll(async () => Math.abs(await offsetUnderIndex(page, target)), { timeout: 5_000 }).toBeGreaterThan(60);
    await link.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => landing(page, target), {
      message: 'WDR-05: Enter on the focused link scrolls like a click', timeout: 10_000,
    }).toBe('landed');
    // The URL never changes: the links scroll, they do not navigate (no #hash, no reload).
    await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}$`));
  });
});
