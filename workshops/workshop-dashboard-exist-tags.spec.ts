// workshop-dashboard-exist-tags.spec.ts — Exist Users Enrolled cards show the enrolment-doc tag chips (2026-11-17).
//
// Recon: starlabs-angular src/app/New-Workshop/workshop-dashboard/workshop-dashboard.component.html — the side panel
// card renders `wd-side-enrolled-tag` on Total Enrolled (WNE-04) and, since 2026-11-17, `wd-side-exist-tag` on
// Exist Users Enrolled. Both read the same enrolledTagNames map (loadEnrolledTagNames, loaded for every Tag-filter
// panel), so the names, order and dead-id handling match Total Enrolled.
//
// Hooks: `wd-*` (workshop-dashboard.component.html). `wd-side-exist-tag` is new with this change, so the hub-ahead
// guard (scripts/readiness/landed-specs.cjs) skips this FILE on app branches without it. That is why the case lives
// here and not in workshop-dashboard-new-exist.spec.ts (that file would be skipped whole).
//
// THE WORLD (seedEnrolledExportCase + tagEnrolledExportCase, on W_DASH) — see workshop-dashboard-new-exist.spec.ts:
//   moved — new_user_data with movedtoexist: true → Exist; its enrolled doc carries a dead tag id + Segment
//   p0    — participant metadata → Exist; untagged (negative control)
//   NU    — still new → not in Exist Users; carries Segment + Venue (shows chips on Total Enrolled only)
import { test, expect, Page } from '@playwright/test';
import {
  wsIds, wsProfileIds, installWshopStubs, loginAsWshopAdmin,
  seedEnrolledExportCase, clearEnrolledExportCase, tagEnrolledExportCase, wsExportPeople, wsExportTags, wsExportIds,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc } from '../queue/support/firestore-admin';

const panelCard = (page: Page, name: string) =>
  page.locator('.participant-panel mat-card.participant-card').filter({ hasText: name });

test.describe('Workshop dashboard — Exist Users Enrolled tag chips', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await seedEnrolledExportCase();
    await tagEnrolledExportCase();
  });
  test.afterEach(async () => {
    await clearEnrolledExportCase();
    assertNoFatal(guard, 'exist tags: no fatal console errors / pageerrors');
  });

  test('WNE-10 Exist Users Enrolled cards show the enrolled-doc tag names; untagged people and other panels show none', async ({ page }) => {
    const { moved, nu } = wsExportPeople;
    const { segment, venue, ghost } = wsExportTags;
    // The moved person carries a deleted tag id AND a real one, so the card must drop just the dead id.
    await tagEnrolledExportCase([ghost, segment.id]);
    const p0Meta: any = await getDoc('participant metadata', wsProfileIds.p0);
    // Oracle: what the enrolled doc stores, read straight from Firestore.
    const movedEnrolled: any = await getDoc('workshop participant enrolled', wsExportIds.ENR_MOVED);
    expect(movedEnrolled?.tags, 'WNE-10 oracle: the stored ids are the dead one, then Segment').toEqual([ghost, segment.id]);

    await loginAsWshopAdmin(page);
    await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('wdash-exist-users-card').click({ timeout: 45_000 });
    await expect(panelCard(page, moved.name), 'WNE-10: the moved person is in Exist Users').toBeVisible({ timeout: 30_000 });
    await expect(panelCard(page, p0Meta.name), 'WNE-10: p0 is in Exist Users').toBeVisible();
    await expect(panelCard(page, nu.name), 'WNE-10: the still-new user is not in Exist Users').toHaveCount(0);

    await expect(panelCard(page, moved.name).getByTestId('wd-side-exist-tag'),
      'WNE-10: the real tag id shows its name; the deleted id shows nothing').toHaveText([segment.name], { timeout: 30_000 });
    await expect(panelCard(page, p0Meta.name).getByTestId('wd-side-exist-tag'), 'WNE-10: no tags → no chips')
      .toHaveCount(0);
    await expect(page.getByTestId('wd-side-enrolled-tag'), 'WNE-10: the Total Enrolled hook is not used here')
      .toHaveCount(0);

    // A second tag shows too, in stored order.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await tagEnrolledExportCase([venue.id, segment.id]);
    await page.getByTestId('wdash-exist-users-card').click();
    await expect(panelCard(page, moved.name).getByTestId('wd-side-exist-tag'), 'WNE-10: every tag, in stored order')
      .toHaveText([venue.name, segment.name], { timeout: 30_000 });

    // Negative control: Total Enrolled keeps its own chips and never draws the Exist Users hook.
    await page.getByTestId('wd-close-participant-panel-61').click();
    await page.getByTestId('wd-on-metric-click-6').click();
    await expect(panelCard(page, nu.name).getByTestId('wd-side-enrolled-tag'), 'WNE-10: Total Enrolled still shows NU\'s tags')
      .toHaveText([segment.name, venue.name], { timeout: 30_000 });
    await expect(page.getByTestId('wd-side-exist-tag'), 'WNE-10: Total Enrolled does not use the Exist Users hook')
      .toHaveCount(0);
  });
});
