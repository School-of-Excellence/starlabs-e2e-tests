// wc-calendar.spec.ts — /wccalendar (New-Workshop/wccalendar).
//
// Recon: e2e/recon-allcomp/workshops.md "Addendum — 2026-09-04" (WS-32 / WS-33).
//
// /wccalendar has NO canActivate (app.routes.ts:297), so a mount smoke would prove nothing. Both cases
// below assert app-COMPUTED calendar structure instead:
//   WS-32  the soft-delete filter (`deleted !== true`, ts:181) and the multi-day span expansion
//          (`start <= day <= end`, ts:321)
//   WS-33  the overflow collapse: MAX_CHIPS is 3 (ts:107), so a 5-event day renders 3 chips + "+2 more"
//          (ts:327,346) — the "2" is 5-3 computed by the app and appears nowhere in the seed.
//
// Anti-circularity note on WS-32: the soft-deleted doc is the whole point. Without a `deleted:true` doc
// in Firestore, "the deleted event is not on the calendar" is indistinguishable from "no such doc was
// ever seeded" — the assertion would pass with the filter deleted. The seed puts the soft-deleted event
// on the SAME day as a visible sibling so one day cell proves both halves at once.
import { test, expect } from '@playwright/test';
import { wsAddNames, installWshopStubs, loginAsWshopAdmin } from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc } from '../queue/support/firestore-admin';
import { wsAddIds } from './support/wshop';

test.describe('Workshops — workshop/campaign calendar (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'wccalendar: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // WS-32 — soft-deleted events never render; a multi-day event renders on every day it spans
  // ===========================================================================================
  test('WS-32 the deleted:true event is filtered out and the 3-day event spans 3 day cells', async ({ page }) => {
    // [PRECONDITION] the soft-deleted doc must actually EXIST in Firestore — that is what makes the
    // negative assertion below meaningful rather than vacuous.
    const deletedDoc = await getDoc('workshopcampaigncalendar', wsAddIds.CAL_DELETED);
    expect(deletedDoc, 'WS-32: the soft-deleted event doc must exist in Firestore').toBeTruthy();
    expect((deletedDoc as any)!.deleted, 'WS-32: ...and carry deleted:true').toBe(true);

    await loginAsWshopAdmin(page);
    await page.goto('/wccalendar', { waitUntil: 'domcontentloaded' });

    // [REAL-UI] the calendar renders 3 stacked months from the current month (MONTHS_SHOWN, ts:108).
    await expect(page.locator('.cal-month').first(), 'WS-32: the month grid must render')
      .toBeVisible({ timeout: 30_000 });

    // The single-day event and its soft-deleted sibling were seeded on the SAME day (today+3).
    await expect(
      page.locator('.cal-event').filter({ hasText: wsAddNames.calSingle }),
      'WS-32: the live single-day event must render',
    ).toHaveCount(1, { timeout: 30_000 });

    // [ASSERT] the soft-deleted sibling is absent — the app's `deleted !== true` filter ran (ts:181).
    await expect(
      page.locator('.cal-event').filter({ hasText: wsAddNames.calDeleted }),
      'WS-32: a deleted:true event must NEVER render (soft-delete filter, wccalendar.component.ts:181)',
    ).toHaveCount(0);

    // [ASSERT] the 3-day event (today+5 → today+7) renders on EXACTLY 3 day cells. Only in-month cells
    // get chips (leading/trailing cells are built with chips:[], ts:313/355), so there is no double
    // count across the stacked months. 3 is the app expanding a start/end pair it read (ts:321) — the
    // seed stores two Timestamps, never a per-day list.
    await expect(
      page.locator('.cal-event').filter({ hasText: wsAddNames.calSpan }),
      'WS-32: a start..end span must be expanded onto every day it covers',
    ).toHaveCount(3, { timeout: 30_000 });
  });

  // ===========================================================================================
  // WS-33 — a day with more events than MAX_CHIPS collapses the overflow into "+N more"
  // ===========================================================================================
  test('WS-33 a 5-event day renders 3 chips and an app-computed "+2 more"', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/wccalendar', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cal-month').first()).toBeVisible({ timeout: 30_000 });

    // All five stacked events share one start date, so the app's chip sort (startdate, then title —
    // ts:322-325) puts "Cal Stack 1" first; it is therefore always among the 3 visible chips and is a
    // stable anchor for finding the day cell.
    const stackDay = page.locator('.cal-day').filter({ hasText: wsAddNames.calStack(1) });
    await expect(stackDay, 'WS-33: the stacked day cell must render').toHaveCount(1, { timeout: 30_000 });

    // [ASSERT] exactly MAX_CHIPS(3) chips render, not all 5 (ts:327).
    await expect(
      stackDay.locator('.cal-event'),
      'WS-33: only MAX_CHIPS (3) of the 5 events may render as chips',
    ).toHaveCount(3);

    // [ASSERT] the overflow label. moreCount = dayEvents.length - visible.length = 5 - 3 = 2 (ts:346).
    // "2" is arithmetic the app did; the seed contains only five separate docs.
    await expect(
      stackDay.locator('.cal-more'),
      'WS-33: the overflow count must be the app-computed 5-3 = 2',
    ).toHaveText('+2 more', { timeout: 15_000 });
  });
});
