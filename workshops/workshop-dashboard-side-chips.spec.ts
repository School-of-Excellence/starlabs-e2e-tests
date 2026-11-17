// workshop-dashboard-side-chips.spec.ts — two side-panel card lines on the workshop dashboard (operator 2026-11-17):
//   WNE-11  New Users cards show the enrolled-doc tag chips (hook `wd-side-new-tag`), like Total Enrolled
//           (`wd-side-enrolled-tag`, WNE-04) and Existing Participants (`wd-side-exist-tag`, WNE-10).
//   WDL-02  Share Claimed cards read "Referred: <names>" (hook `wd-side-referred`; was "Enrolled via code: ...").
//
// Recon: starlabs-angular src/app/New-Workshop/workshop-dashboard/workshop-dashboard.component.html (the side panel
// card: `wd-side-referred` line + the three status-scoped tag-chip blocks) and workshop-dashboard.component.ts:
//   • onMetricClick('totalNewUsers') opens New Users; loadEnrolledTagNames fills enrolledTagNames (same map for
//     all three tag-chip panels: stored order, ids with no newusertags doc dropped).
//   • onMetricClick('shareClaimed') builds referredNames per claimed sharer: enrolled docs on this workshop whose
//     referralcode equals the sharer's workshopreferral.referralcode, minus the sharer, deduped, named from
//     mapProfile (participant metadata + still-new new_user_data) or the sharer name map (profile_data).
//     Share Clicked / Share Claimed only exist on an EVERGREEN workshop (setupWorkshopReferralSnapshot).
//
// Hook prefix: `wd-*` (workshop-dashboard.component.html). `wd-side-new-tag` and `wd-side-referred` are new with
// this change and land together, so the hub-ahead guard (scripts/readiness/landed-specs.cjs) skips this FILE on
// app branches without them. That is why these cases live here and not in the older dashboard files.
//
// THE WORLDS
//   WNE-11 (seedEnrolledExportCase + tagEnrolledExportCase + enrollSecondNewUser, on W_DASH):
//     NU     — NU Alpha, still new; tags [Venue, Segment] (stored order is NOT A-Z) → chips in that order
//     NU B   — NU Bravo, still new; tags [dead id, Segment] → just Segment; then untagged → no chips
//     moved  — movedtoexist; tags [dead id, Segment] → Existing Participants shows Segment (negative control
//              for the New Users hook). KNOWN pre-existing bug: the New Users panel ALSO lists this person,
//              so nothing here asserts the moved person's membership of New Users either way.
//   WDL-02 (seedReferralWorld — see support/wshop.ts §wsReferral, its own evergreen workshop):
//     p0 shares code USED (claimed): NU Alpha and p2 (twice) enrolled with it, and p0 itself did too
//     p1 shares code IDLE (claimed): nobody enrolled with it → no Referred line
//     p2 only clicked (claimed 0)   → Share Clicked, never a Referred line
//
// Anti-circularity: WNE-11's chip names come from the newusertags docs seed-workshops.js wrote (wsExportTags) and
// the stored order is read back from the enrolled doc. WDL-02's expected line is computed from independent
// Firestore reads of workshopreferral + workshop participant enrolled + the name sources, and that oracle is
// itself pinned to the seeded shape (NU Alpha + p2, not p0, not twice). Single-equality queries only.
import { test, expect, Page } from '@playwright/test';
import {
  wsIds, wsProfileIds, wsAddIds, wsAddNames, installWshopStubs, loginAsWshopAdmin, alignWorkshopMetadataNames,
  seedEnrolledExportCase, clearEnrolledExportCase, tagEnrolledExportCase, setEnrolledTags,
  enrollSecondNewUser, clearSecondNewUser, wsSecondNewUserEnrolledId,
  wsExportPeople, wsExportTags, wsExportIds,
  seedReferralWorld, clearReferralWorld, wsReferral,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, queryWhere, db } from '../queue/support/firestore-admin';

const panelCard = (page: Page, name: string) =>
  page.locator('.participant-panel mat-card.participant-card').filter({ hasText: name });
const cardNames = async (page: Page): Promise<string[]> =>
  (await page.locator('.participant-panel mat-card.participant-card .participant-name').allTextContents()).map(n => n.trim());

/** The name the dashboard gives an enrolled person: a still-new user's new_user_data name, else participant metadata. */
async function enrolledNameOf(profileId: string): Promise<string> {
  const nu: any = await getDoc('new_user_data', profileId);
  if (nu && nu.movedtoexist !== true && nu.name) return String(nu.name);
  const meta: any = await getDoc('participant metadata', profileId);
  if (meta?.name) return String(meta.name);
  const pd: any = await getDoc('profile_data', profileId);
  return String(pd?.name || 'Unknown');
}

test.describe('Workshop dashboard — side panel tag chips on New Users', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await seedEnrolledExportCase();
    await tagEnrolledExportCase([wsExportTags.ghost, wsExportTags.segment.id]);
  });
  test.afterEach(async () => {
    await clearSecondNewUser();
    await clearEnrolledExportCase();
    assertNoFatal(guard, 'side chips (new users): no fatal console errors / pageerrors');
  });

  test('WNE-11 New Users cards show the enrolled-doc tag names in stored order; dead ids and untagged people show none', async ({ page }) => {
    const { moved, nu } = wsExportPeople;
    const { segment, venue, ghost } = wsExportTags;
    // NU's tags in NON-alphabetical stored order, so the chips can only pass by keeping that order.
    await setEnrolledTags(wsExportIds.ENR_NU, [venue.id, segment.id]);
    await enrollSecondNewUser([ghost, segment.id]);
    // Oracle: what the enrolled docs store, read straight from Firestore.
    const nuEnrolled: any = await getDoc('workshop participant enrolled', wsExportIds.ENR_NU);
    expect(nuEnrolled?.tags, 'WNE-11 oracle: NU stores Venue, then Segment').toEqual([venue.id, segment.id]);
    const nubEnrolled: any = await getDoc('workshop participant enrolled', wsSecondNewUserEnrolledId);
    expect(nubEnrolled?.tags, 'WNE-11 oracle: NU Bravo stores the dead id, then Segment').toEqual([ghost, segment.id]);
    expect(await getDoc('newusertags', ghost), 'WNE-11 oracle: the dead id has no tag doc').toBeNull();
    const nub: any = await getDoc('new_user_data', wsAddIds.NU_B);
    expect(nub?.movedtoexist === true, 'WNE-11 precondition: NU Bravo is still new').toBe(false);

    await loginAsWshopAdmin(page);
    await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('wd-on-metric-click-19').click({ timeout: 45_000 });
    await expect(panelCard(page, nu.name), 'WNE-11: NU is in New Users').toBeVisible({ timeout: 30_000 });
    await expect(panelCard(page, wsAddNames.nuBravo), 'WNE-11: NU Bravo is in New Users').toBeVisible();

    await expect(panelCard(page, nu.name).getByTestId('wd-side-new-tag'), 'WNE-11: every tag name, in stored order')
      .toHaveText([venue.name, segment.name], { timeout: 30_000 });
    await expect(panelCard(page, wsAddNames.nuBravo).getByTestId('wd-side-new-tag'),
      'WNE-11: the real tag shows its name; the deleted id shows nothing').toHaveText([segment.name]);
    // Negative controls: the other two panels' hooks never render here.
    await expect(page.getByTestId('wd-side-enrolled-tag'), 'WNE-11: the Total Enrolled hook is not used on New Users')
      .toHaveCount(0);
    await expect(page.getByTestId('wd-side-exist-tag'), 'WNE-11: the Existing Participants hook is not used on New Users')
      .toHaveCount(0);

    // Untagged: NU Bravo with no tags field at all → still listed, no chips.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await setEnrolledTags(wsSecondNewUserEnrolledId, null);
    await page.getByTestId('wd-on-metric-click-19').click();
    await expect(panelCard(page, nu.name).getByTestId('wd-side-new-tag'), 'WNE-11: reopened, NU keeps its chips')
      .toHaveText([venue.name, segment.name], { timeout: 30_000 });
    await expect(panelCard(page, wsAddNames.nuBravo), 'WNE-11: the untagged new user is still listed').toBeVisible();
    await expect(panelCard(page, wsAddNames.nuBravo).getByTestId('wd-side-new-tag'), 'WNE-11: no tags → no chips')
      .toHaveCount(0);

    // Negative control: Total Enrolled keeps its own chips and never draws the New Users hook.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wd-on-metric-click-6').click();
    await expect(panelCard(page, nu.name).getByTestId('wd-side-enrolled-tag'), 'WNE-11: Total Enrolled still shows NU\'s tags')
      .toHaveText([venue.name, segment.name], { timeout: 30_000 });
    await expect(page.getByTestId('wd-side-new-tag'), 'WNE-11: Total Enrolled does not use the New Users hook')
      .toHaveCount(0);

    // Negative control: Existing Participants keeps its own chips and never draws the New Users hook.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wdash-exist-users-card').click();
    await expect(panelCard(page, moved.name).getByTestId('wd-side-exist-tag'), 'WNE-11: Existing Participants shows the moved person\'s tag')
      .toHaveText([segment.name], { timeout: 30_000 });
    await expect(page.getByTestId('wd-side-new-tag'), 'WNE-11: Existing Participants does not use the New Users hook')
      .toHaveCount(0);
  });
});

test.describe('Workshop dashboard — Share Claimed "Referred" line', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await alignWorkshopMetadataNames();
    await seedReferralWorld();
  });
  test.afterEach(async () => {
    await clearReferralWorld();
    assertNoFatal(guard, 'side chips (referred): no fatal console errors / pageerrors');
  });

  test('WDL-02 Share Claimed cards read "Referred: <names>"; an unused code, the sharer and Share Clicked show none', async ({ page }) => {
    const W = wsReferral.WORKSHOP;
    const ws: any = await getDoc('workshopconfiguration', W);
    expect(ws?.evergreenWorkshop, 'WDL-02 precondition: the referral cards only exist on an evergreen workshop').toBe(true);

    // [ORACLE] independent reads: claimed sharers → people enrolled here with their code, minus the sharer, deduped.
    const wsRef = db().collection('workshopconfiguration').doc(W);
    const referrals: any[] = await queryWhere('workshopreferral', [['workshopref', '==', wsRef]]);
    const enrolled: any[] = await queryWhere('workshop participant enrolled', [['workshopref', '==', wsRef]]);
    const claimed = referrals.filter(r => r.profileid && (Number(r.claimed) || 0) > 0);
    const clickedOnly = referrals.filter(r => r.profileid && !((Number(r.claimed) || 0) > 0));
    const referredIdsOf = (r: any): string[] => {
      const code = String(r.referralcode || '').trim();
      if (!code) return [];
      const out: string[] = [];
      for (const e of enrolled) {
        if (String(e.referralcode || '').trim() === code && e.profileid && e.profileid !== r.profileid && !out.includes(e.profileid)) {
          out.push(e.profileid);
        }
      }
      return out;
    };
    const used = claimed.find(r => r.profileid === wsProfileIds.p0);
    const idle = claimed.find(r => r.profileid === wsProfileIds.p1);
    expect(claimed.map(r => r.profileid).sort(), 'WDL-02 oracle: p0 and p1 claimed').toEqual([wsProfileIds.p0, wsProfileIds.p1].sort());
    expect(clickedOnly.map(r => r.profileid), 'WDL-02 oracle: p2 only clicked').toEqual([wsProfileIds.p2]);
    const usedIds = referredIdsOf(used);
    // Pin the oracle to the seeded shape: NU Alpha then p2 (doc-id order), p0 (self) out, p2 once.
    expect(usedIds, 'WDL-02 oracle: p0\'s code brought NU Alpha and p2 — not p0, not p2 twice').toEqual([wsAddIds.NU_A, wsProfileIds.p2]);
    expect(referredIdsOf(idle), 'WDL-02 oracle: nobody enrolled with p1\'s code').toEqual([]);
    const usedNames = await Promise.all(usedIds.map(enrolledNameOf));
    const p0Name = await enrolledNameOf(wsProfileIds.p0);
    const sharerName = async (id: string) => String(((await getDoc('profile_data', id)) as any)?.name || await enrolledNameOf(id));
    const p0Card = await sharerName(wsProfileIds.p0);
    const p1Card = await sharerName(wsProfileIds.p1);
    const p2Card = await sharerName(wsProfileIds.p2);
    expect(usedNames, 'WDL-02 oracle: two distinct names').toHaveLength(2);

    await loginAsWshopAdmin(page);
    await page.goto(`/workshop_dashboard/${W}`, { waitUntil: 'domcontentloaded' });
    const claimedCard = page.getByTestId('wd-on-metric-click-22');
    await expect(claimedCard.locator('.metric-value'), 'WDL-02: Share Claimed counts the claimed sharers')
      .toHaveText(String(claimed.length), { timeout: 60_000 });

    // The names come from maps the dashboard loads asynchronously; the line is built when the card is clicked, so
    // reopen until the panel has them (a load race, never a different answer).
    const referred = page.getByTestId('wd-side-referred');
    await expect(async () => {
      if (await page.getByTestId('wd-close-participant-panel-61').isVisible()) {
        await page.getByTestId('wd-close-participant-panel-61').click();
      }
      await claimedCard.click();
      await expect(referred).toHaveText([`Referred: ${usedNames.join(', ')}`], { timeout: 5_000 });
    }, 'WDL-02: the Referred line lists who enrolled with the sharer\'s code').toPass({ timeout: 60_000 });

    // [ASSERT] exactly the two claimed sharers are cards; the line sits on p0's card, p1's card has none.
    expect((await cardNames(page)).sort(), 'WDL-02: Share Claimed lists the claimed sharers only').toEqual([p0Card, p1Card].sort());
    const p0Line = page.locator('.participant-panel mat-card.participant-card')
      .filter({ has: page.locator('.participant-name', { hasText: p0Card }) }).getByTestId('wd-side-referred');
    await expect(p0Line, 'WDL-02: the line is on the sharer\'s own card').toHaveText(`Referred: ${usedNames.join(', ')}`);
    await expect(p0Line, 'WDL-02: the sharer is not listed as their own referral').not.toContainText(p0Name);
    const p1CardLoc = page.locator('.participant-panel mat-card.participant-card')
      .filter({ has: page.locator('.participant-name', { hasText: p1Card }) });
    await expect(p1CardLoc, 'WDL-02: p1 is a Share Claimed card').toHaveCount(1);
    await expect(p1CardLoc.getByTestId('wd-side-referred'), 'WDL-02: a code nobody used → no Referred line').toHaveCount(0);
    await expect(page.locator('body'), 'WDL-02: the old wording is gone').not.toContainText('Enrolled via code');

    // Negative control: Share Clicked lists p2 and never draws the Referred line.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wd-on-metric-click-21').click();
    await expect(page.locator('.participant-panel mat-card.participant-card .participant-name'), 'WDL-02: Share Clicked lists p2')
      .toHaveText([p2Card], { timeout: 30_000 });
    await expect(page.getByTestId('wd-side-referred'), 'WDL-02: Share Clicked has no Referred line').toHaveCount(0);
    await expect(page.locator('body'), 'WDL-02: no "Enrolled via code" anywhere').not.toContainText('Enrolled via code');
  });
});
