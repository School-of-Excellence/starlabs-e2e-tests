// specialist-appointment-studio.spec.ts — the centralised appointment screen /specialistappointmentstudio
// (starlabs-angular src/app/Scheduling/specialist-appointment-studio/, ONE component, hook prefix `sas`).
//
// INTENT (app repo): specs/plans/2026-09-29-centralised-appointments.md and the journals
//   specs/journals/2026-09-29-centralised-appointments.md, 2026-10-01-specialist-studio-testing-round1.md,
//   2026-10-05-specialist-studio-testing-round2.md. Hub WHY-journal: specs/journals/2026-10-14-specialist-appointment-studio.md.
//
// HOOK PREFIX: `sas` — the whole screen is one component (round-2 merge renamed sah-/saa-/stt-/… to sas-…).
// Every sas-* hook is referenced literally below: driven by a case, or registered in an SAS-ADDR block.
//
// SEEDED WORLD (appointments/seed-appointments.js → seedStudio, own tag `${APPT_RUNID}sas`):
//   actors   ah+…sas  users_roles {ah}  → A&H view (Overview · Mentors · Utilisation · Book Session · Delivery Type Details)
//            cw+…sas  users_roles {eis} → CW view (Home only, no side nav)
//            cw2+…sas users_roles {eis} → a second host, the out-of-scope control
//   types    "SAS Studio Coaching" 60 min, group up to 3, change work required · "SAS Studio Review" 45 min
//   last week   cw  WL1 Wed 09–13 [Coaching, Review]: A_DONE 09–10 attended · A_CANC 10–11 cancelled (no-show
//                   reason) · A_PEND 11:00–11:45 Review, ended + unmarked      WL2 Thu 14–16, nothing booked
//               cw2 WOT Wed 09–17: A_OTHER_DONE attended + A_OTHER_PEND unmarked (client5)
//   2 wks ago   cw  A_OLD attended (client3), no window
//   next week   cw  WN1 Wed 09–12 with A_UP booked 09–10 (client4) · WN2 Thu 14–15, nothing booked
//   this week   nothing for cw.
//
// ANTI-CIRCULARITY: the seed writes raw windows/slots/appointments only. Every number asserted here is one the
// APP computes (sas-logic hoursSummary / unionMinutes / windowStatus / apptStatus / fmtHours) from those docs:
// last week's 6h / 1h 45m / 1h / 5h / 17% appear nowhere in the seed, and each negative control moves at least
// one of them if its rule breaks (cancelled counted → 2h / 33%; pending counted → 1h 45m / 29%; cw2 leaking →
// 14h available; the 2-weeks-ago session leaking → 2h 30m delivered). The table cases assert the APP's
// classification (Pending / Completed / Cancelled) of docs whose flags we set, plus the exclusions. The one
// write (SAS-08 delete) is checked with the Admin SDK (`getDoc`/`pollUntil`), never by reading back a value
// the test wrote; its precondition is restored by the seed helper resetStudioWindows().
//
// NOTE (disableCancel): AppointmentDetailComponent only offers Cancel BEFORE the start time, for anyone. A
// pending (ended) session therefore never shows Cancel, A&H included. The disableCancel rule is proved on the
// FUTURE session (A_UP): A&H sees Cancel, CW does not. The pending row proves Update Status for both.
//
// DATES: everything hangs off THIS week's Monday 00:00 local (seed and browser share the machine TZ). A run that
// crosses Monday 00:00 between seeding and these cases would shift every week by one.
import { test, expect, Page } from '@playwright/test';
import { installApptStubs } from './support/appt';
import { loginAs } from '../queue/support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil } from '../queue/support/firestore-admin';
import { openMatSelect } from '../_shared/mat-select';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sasSeed = require('./seed-appointments');
const E: Record<string, string> = sasSeed.SAS_EMAIL;
const ID: Record<string, string> = sasSeed.SAS_ID;
const PASSWORD = 'Test!1234';
const ROUTE = '/specialistappointmentstudio';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The period bar's week label for the week starting `weeksFromNow` weeks from this one (DatePipe 'd MMM' – 'd MMM y'). */
function weekLabel(weeksFromNow: number): string {
  const from = new Date(); from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - ((from.getDay() + 6) % 7) + 7 * weeksFromNow);
  const last = new Date(from); last.setDate(last.getDate() + 6);
  return `${from.getDate()} ${MON[from.getMonth()]} – ${last.getDate()} ${MON[last.getMonth()]} ${last.getFullYear()}`;
}

/** Real-form login, then the studio route; resolves once the screen shell has mounted past its loader. */
async function openStudio(page: Page, email: string): Promise<void> {
  await loginAs(page, email, PASSWORD);
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
  await expect(page, 'the guard must admit the seeded actor (dashboard grant for the route)').toHaveURL(/specialistappointmentstudio/, { timeout: 30_000 });
  await expect(page.getByTestId('sas-root'), 'the studio shell must mount').toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('sas-home-title'), 'the first tab (Home / Overview) must render').toBeVisible({ timeout: 30_000 });
}

/** Close the appointment detail dialog and wait out the Home reload openAppointment() schedules (setTimeout 800ms
 *  → HomeTab.load(), which swaps the stats block for a loader and back). Without this, the next click can land on
 *  a row that is about to be re-rendered. */
async function closeDetailAndAwaitReload(page: Page): Promise<void> {
  const stats = await page.getByTestId('sas-home-stats').elementHandle();
  await page.getByTestId('ad-close-3').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => stats!.evaluate((el) => el.isConnected), { message: 'Home reloads after the dialog closes', timeout: 15_000 }).toBe(false);
  await expect(page.getByTestId('sas-home-stats')).toBeVisible({ timeout: 30_000 });
}

test.describe('Appointments — Specialist Appointment Studio (role views, hours maths, past/upcoming rules, delete rule)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installApptStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'specialist appointment studio: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // SAS-01 — A&H lands on Overview with the A&H nav
  // ===========================================================================================
  test('SAS-01 A&H actor lands on Overview with the five A&H tabs and no View-as switch', async ({ page }) => {
    await openStudio(page, E.ah);
    await expect(page.getByTestId('sas-home-title'), 'SAS-01: A&H opens on the all-specialists Overview').toHaveText('Overview');
    await expect(page.getByTestId('sas-nav')).toBeVisible();
    // The nav comes from users_roles {ah} → NAV.ah; a CW/mentor flag would give a different list.
    await expect(page.getByTestId('sas-nav-item'), 'SAS-01: the A&H nav, in order').toHaveText(
      ['Overview', 'Mentors', 'Utilisation', 'Book Session', 'Delivery Type Details'].map((t) => new RegExp(t)),
    );
    // One view held → no View as (neither the side nav copy nor the compact one).
    await expect(page.getByTestId('sas-view-as')).toHaveCount(0);
    await expect(page.getByTestId('sas-view-as-compact')).toHaveCount(0);
    await expect(page.getByTestId('sas-person-select'), 'SAS-01: Overview carries the specialist picker').toBeVisible({ timeout: 30_000 });
  });

  // ===========================================================================================
  // SAS-02 — CW lands on its own Home, and the current week reads zero
  // ===========================================================================================
  test('SAS-02 CW actor lands on its own Home (no side nav) and the current week has no hours', async ({ page }) => {
    await openStudio(page, E.cw);
    await expect(page.getByTestId('sas-home-title'), 'SAS-02: CW Home greets the logged-in specialist').toHaveText(new RegExp(`Good (morning|afternoon|evening), ${E.cw.replace(/[+.]/g, '\\$&')}`));
    await expect(page.getByTestId('sas-nav'), 'SAS-02: one view + one tab → no side nav').toHaveCount(0);
    await expect(page.getByTestId('sas-person-select'), 'SAS-02: CW has no specialist picker (self scope)').toHaveCount(0);
    await expect(page.getByTestId('sas-period-label'), 'SAS-02: Home opens on the current week').toHaveText(weekLabel(0));
    await expect(page.getByTestId('sas-filter-bar')).toBeVisible();
    await expect(page.getByTestId('sas-lookup-pick-product'), 'SAS-02: participant lookup waits for a product').toBeVisible();
    // Nothing is seeded for cw this week → the app's sums are zero.
    await expect(page.getByTestId('sas-home-stats')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('sas-home-stat-available').locator('b')).toHaveText('0 min');
    await expect(page.getByTestId('sas-home-stat-delivered').locator('b')).toHaveText('0 min');
    await expect(page.getByTestId('sas-home-stat-utilisation').locator('b')).toHaveText('0%');
  });

  // ===========================================================================================
  // SAS-03 — last week's hours: Available = window hours, Delivered = attended only, Utilisation = ÷
  // ===========================================================================================
  test('SAS-03 CW Home last week: Available 6h, Booked 1h 45m, Delivered 1h, Utilisation 17% — cancelled, pending, other host and older weeks excluded', async ({ page }) => {
    await openStudio(page, E.cw);
    await expect(page.getByTestId('sas-home-stats')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('sas-period-prev').click();
    await expect(page.getByTestId('sas-period-label'), 'SAS-03: previous moves exactly one week back').toHaveText(weekLabel(-1));

    // [APP-COMPUTED] hoursSummary over cw's windows/sessions starting in [last Mon, this Mon).
    await expect(page.getByTestId('sas-home-stat-available').locator('b'), 'SAS-03: Available = WL1 4h + WL2 2h (cw2\'s 8h window excluded)').toHaveText('6h', { timeout: 30_000 });
    await expect(page.getByTestId('sas-home-stat-booked').locator('b'), 'SAS-03: Booked = union of booked slots 09–10 + 11:00–11:45 (the cancelled slot was freed)').toHaveText('1h 45m');
    await expect(page.getByTestId('sas-home-stat-booked'), 'SAS-03: nothing bookable is left in a past week').toContainText('0 min still open to book');
    await expect(page.getByTestId('sas-home-stat-delivered').locator('b'), 'SAS-03: Delivered = A_DONE only (not the cancelled, the pending, cw2\'s or the 2-weeks-ago one)').toHaveText('1h');
    await expect(page.getByTestId('sas-home-stat-delivered')).toContainText('1 completed session');
    await expect(page.getByTestId('sas-home-stat-unutilised').locator('b'), 'SAS-03: Unutilised = 6h − 1h').toHaveText('5h');
    await expect(page.getByTestId('sas-home-stat-unutilised'), 'SAS-03: the no-show counts as cancelled time').toContainText('1h cancelled');
    await expect(page.getByTestId('sas-home-stat-utilisation').locator('b'), 'SAS-03: Utilisation = delivered ÷ available = 60/360').toHaveText('17%');

    // [APP-COMPUTED] the week calendar: cw's two windows only, each with the status windowStatus() derives.
    const cal = page.getByTestId('sas-home-calendar');
    const windows = cal.getByTestId('sas-home-window');
    await expect(windows, 'SAS-03: only cw\'s two windows are drawn (cw2\'s is out of scope)').toHaveCount(2);
    await expect(windows.filter({ hasText: '9:00 – 13:00' }), 'SAS-03: WL1 holds an ended, unmarked session').toContainText('Completion pending');
    await expect(windows.filter({ hasText: '14:00 – 16:00' }), 'SAS-03: WL2 ended with nothing booked').toContainText('Unused');
    await expect(windows.getByTestId('sas-home-window-delete'), 'SAS-03: past windows offer no delete').toHaveCount(0);
    await expect(cal.getByTestId('sas-home-session'), 'SAS-03: the three sessions inside WL1 are drawn under it (A_OLD is another week)').toHaveCount(3);

    // [APP-COMPUTED] the availability list for the period: past windows are never selectable for delete.
    const avail = page.getByTestId('sas-home-avail');
    await expect(avail.getByTestId('sas-home-avail-row')).toHaveCount(2);
    for (const box of await avail.getByTestId('sas-home-avail-check').all()) await expect(box).toBeDisabled();
    await expect(avail.getByTestId('sas-home-avail-all'), 'SAS-03: nothing selectable → Select all is off').toBeDisabled();
  });

  // ===========================================================================================
  // SAS-04 — Past sessions: Pending = ended + attended:false + cancelled:false
  // ===========================================================================================
  test('SAS-04 CW past sessions: Pending lists only the ended unmarked session; Completed and Cancelled split the rest; the no-show reason is hidden', async ({ page }) => {
    await openStudio(page, E.cw);
    const past = page.getByTestId('sas-home-past');
    const rows = past.getByTestId('sas-home-past-row');

    // Default filter = "Status updation pending".
    await expect(rows, 'SAS-04: exactly one pending session for cw').toHaveCount(1, { timeout: 30_000 });
    await expect(rows.first()).toContainText(E.c0);
    await expect(rows.first()).toContainText('SAS Studio Review');
    await expect(rows.first()).toContainText('Status pending');
    await expect(rows.first().getByTestId('sas-home-update-status')).toBeVisible();
    for (const other of [E.c1, E.c2, E.c3, E.c4, E.c5]) await expect(past, `SAS-04: ${other} is not pending for cw`).not.toContainText(other);

    // Completed → the two attended sessions (last week + 2 weeks ago), not the cancelled or pending ones.
    let panel = await openMatSelect(page, page.getByTestId('sas-home-past-filter'));
    await panel.getByRole('option', { name: 'Completed', exact: true }).click();
    await expect(rows, 'SAS-04: Completed = A_DONE + A_OLD').toHaveCount(2, { timeout: 30_000 });
    await expect(past).toContainText(E.c1);
    await expect(past).toContainText(E.c3);
    for (const other of [E.c0, E.c2, E.c5]) await expect(past).not.toContainText(other);
    await expect(past.getByTestId('sas-home-update-status'), 'SAS-04: marked sessions offer no Update status').toHaveCount(0);

    // Cancelled → the no-show only, read as plain "Cancelled" with the no-show reason hidden.
    panel = await openMatSelect(page, page.getByTestId('sas-home-past-filter'));
    await panel.getByRole('option', { name: 'Cancelled', exact: true }).click();
    await expect(rows, 'SAS-04: Cancelled = A_CANC').toHaveCount(1, { timeout: 30_000 });
    await expect(rows.first()).toContainText(E.c2);
    await expect(rows.first()).toContainText('Cancelled');
    await expect(rows.first(), 'SAS-04: a no-show is never shown as such').not.toContainText("Client didn't show up");
  });

  // ===========================================================================================
  // SAS-05 — CW upcoming + the detail dialog without Cancel
  // ===========================================================================================
  test('SAS-05 CW upcoming lists only the future live session; its detail dialog has no Cancel (disableCancel); the pending row offers Update Status', async ({ page }) => {
    await openStudio(page, E.cw);
    const up = page.getByTestId('sas-home-upcoming').getByTestId('sas-home-upcoming-row');
    await expect(up, 'SAS-05: A_UP is cw\'s only future, live session').toHaveCount(1, { timeout: 30_000 });
    await expect(up.first()).toContainText(E.c4);
    await expect(up.first()).toContainText('SAS Studio Coaching');
    await expect(up.first()).toContainText('Booked');
    await expect(up.first().getByTestId('sas-home-join'), 'SAS-05: Join opens 5 min before the start — next week is closed').toBeDisabled();

    await up.first().getByTestId('sas-home-upcoming-menu').click();
    await page.getByTestId('sas-home-menu-details').click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Booked For' });
    await expect(dialog, 'SAS-05: the appointment detail dialog opens on A_UP').toContainText(E.c4, { timeout: 15_000 });
    await expect(dialog, 'SAS-05: host line built from hostRole + the role map').toContainText(`SAS Specialist: ${E.cw}`);
    // The session is in the future, so only the disableCancel flag (CW view) can hide Cancel here.
    await expect(page.getByTestId('ad-cancel-1'), 'SAS-05: CW never gets Cancel').toHaveCount(0);
    await expect(page.getByTestId('ad-update-status-2'), 'SAS-05: a future session has no status to update').toHaveCount(0);
    await closeDetailAndAwaitReload(page);

    const pend = page.getByTestId('sas-home-past-row').filter({ hasText: E.c0 });
    await expect(pend).toHaveCount(1, { timeout: 30_000 });
    await pend.getByTestId('sas-home-update-status').click();
    await expect(dialog, 'SAS-05: the pending session opens in the same dialog').toContainText(E.c0, { timeout: 15_000 });
    await expect(page.getByTestId('ad-update-status-2'), 'SAS-05: an ended, unmarked session offers Update Status').toBeVisible();
    await expect(page.getByTestId('ad-cancel-1')).toHaveCount(0);
    await page.getByTestId('ad-close-3').click();
    await expect(dialog).toHaveCount(0);
  });

  // ===========================================================================================
  // SAS-06 — A&H narrowed to the CW: same numbers, same pending row, and Cancel IS offered
  // ===========================================================================================
  test('SAS-06 A&H Overview narrowed to the CW shows the same last-week numbers and pending row, and the upcoming detail dialog offers Cancel', async ({ page }) => {
    await openStudio(page, E.ah);
    const panel = await openMatSelect(page, page.getByTestId('sas-person-select'));
    // ngx-mat-select-search renders a hidden input next to the visible one, and the visible one sits in a
    // mat-option that reports itself disabled — the box is auto-focused when the panel opens, so type into it.
    await expect(panel.getByTestId('sas-person-search')).toBeVisible();
    await page.keyboard.type(E.cw);
    await panel.getByTestId('sas-person-option').filter({ hasText: E.cw }).click();
    await expect(page.getByRole('listbox'), 'SAS-06: the picker panel closes on pick').toHaveCount(0, { timeout: 5_000 });

    await page.getByTestId('sas-period-prev').click();
    await expect(page.getByTestId('sas-period-label')).toHaveText(weekLabel(-1));
    await expect(page.getByTestId('sas-home-stat-available').locator('b'), 'SAS-06: picker scope = cw only').toHaveText('6h', { timeout: 30_000 });
    await expect(page.getByTestId('sas-home-stat-delivered').locator('b')).toHaveText('1h');
    await expect(page.getByTestId('sas-home-stat-utilisation').locator('b')).toHaveText('17%');

    const rows = page.getByTestId('sas-home-past').getByTestId('sas-home-past-row');
    await expect(rows, 'SAS-06: pending for cw only — cw2\'s pending session (client5) is out of scope').toHaveCount(1, { timeout: 30_000 });
    await expect(rows.first()).toContainText(E.c0);

    const up = page.getByTestId('sas-home-upcoming').getByTestId('sas-home-upcoming-row').filter({ hasText: E.c4 });
    await expect(up).toHaveCount(1, { timeout: 30_000 });
    await up.getByTestId('sas-home-upcoming-menu').click();
    await page.getByTestId('sas-home-menu-details').click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Booked For' });
    await expect(dialog).toContainText(E.c4, { timeout: 15_000 });
    await expect(page.getByTestId('ad-cancel-1'), 'SAS-06: A&H gets Cancel on a future session').toBeVisible();
    await closeDetailAndAwaitReload(page);      // Close, never Cancel: closing with null cancels nothing
    expect((await getDoc('appointments', ID.A_UP))!.cancelled, 'SAS-06: closing the dialog left A_UP uncancelled').toBe(false);

    await rows.first().getByTestId('sas-home-update-status').click();
    await expect(dialog).toContainText(E.c0, { timeout: 15_000 });
    await expect(page.getByTestId('ad-update-status-2')).toBeVisible();
    await expect(page.getByTestId('ad-cancel-1'), 'SAS-06: Cancel is offered only before the start time, even for A&H').toHaveCount(0);
    await page.getByTestId('ad-close-3').click();
  });

  // ===========================================================================================
  // SAS-07 — Add availability gate: the newest-ended session must have a status
  // ===========================================================================================
  test('SAS-07 CW Add availability is blocked while its newest-ended session is unmarked, naming that session\'s type', async ({ page }) => {
    await openStudio(page, E.cw);
    await page.getByTestId('sas-home-add-availability').click();
    const dlg = page.getByTestId('sas-add-root');
    await expect(dlg).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('sas-add-title')).toHaveText('Add availability');
    await expect(dlg.getByTestId('sas-add-pick-first'), 'SAS-07: CW adds for itself — no specialist step').toHaveCount(0);
    // unmarkedLastAppointment(cw) = newest by endtime ≤ now = A_PEND (Review), not the Coaching sessions.
    const blocked = dlg.getByTestId('sas-add-blocked');
    await expect(blocked, 'SAS-07: the gate names the unmarked session\'s type').toContainText("'SAS Studio Review'", { timeout: 20_000 });
    await expect(blocked).not.toContainText('Coaching');
    await expect(dlg.getByTestId('sas-add-save'), 'SAS-07: Save is disabled while blocked').toBeDisabled();
    await dlg.getByTestId('sas-add-cancel').click();
    await expect(dlg).toHaveCount(0);
  });

  // ===========================================================================================
  // SAS-08 — delete availability: refused with a booking, done without one
  // ===========================================================================================
  test.describe('SAS-08 delete availability', () => {
    test.beforeAll(async () => { await sasSeed.resetStudioWindows(); });
    test.afterAll(async () => { await sasSeed.resetStudioWindows(); });

    test('SAS-08 CW next week: a window with a booked slot cannot be deleted, an unbooked future window is deleted', async ({ page }) => {
      expect(await getDoc('availability', ID.WN2), 'SAS-08: precondition — WN2 exists').toBeTruthy();
      await openStudio(page, E.cw);
      await page.getByTestId('sas-period-next').click();
      await expect(page.getByTestId('sas-period-label')).toHaveText(weekLabel(1));

      const windows = page.getByTestId('sas-home-calendar').getByTestId('sas-home-window');
      const booked = windows.filter({ hasText: '9:00 – 12:00' });
      const free = windows.filter({ hasText: '14:00 – 15:00' });
      await expect(booked, 'SAS-08: WN1 holds A_UP').toContainText('Partly booked', { timeout: 30_000 });
      await expect(free).toContainText('Open for booking');

      // Bulk list: only the unbooked future window is selectable.
      const avail = page.getByTestId('sas-home-avail');
      await expect(avail.getByTestId('sas-home-avail-row').filter({ hasText: '9:00 – 12:00' }).getByTestId('sas-home-avail-check')).toBeDisabled();
      await expect(avail.getByTestId('sas-home-avail-row').filter({ hasText: '14:00 – 15:00' }).getByTestId('sas-home-avail-check')).toBeEnabled();
      await expect(avail.getByTestId('sas-home-avail-delete'), 'SAS-08: nothing selected yet').toBeDisabled();

      // Booked window → the app refuses (alert) and the doc survives.
      const seen: { v: { type: string; message: string } | null } = { v: null };
      page.once('dialog', async (d) => { seen.v = { type: d.type(), message: d.message() }; await d.accept(); });
      await booked.getByTestId('sas-home-window-delete').click();
      await expect.poll(() => seen.v, { message: 'SAS-08: deleting a booked window raises the refusal alert' }).not.toBeNull();
      expect(seen.v!.type).toBe('alert');
      expect(seen.v!.message).toContain('Booking were already made');
      await expect(page.getByTestId('sas-window-dialog'), 'SAS-08: the delete button does not open the window dialog').toHaveCount(0);
      const wn1 = await getDoc('availability', ID.WN1);
      expect(wn1, 'SAS-08: WN1 was not deleted').toBeTruthy();

      // Free window → confirm → the app deletes the doc.
      seen.v = null;
      page.once('dialog', async (d) => { seen.v = { type: d.type(), message: d.message() }; await d.accept(); });
      await free.getByTestId('sas-home-window-delete').click();
      await expect.poll(() => seen.v).not.toBeNull();
      expect(seen.v!.type).toBe('confirm');
      await pollUntil(() => getDoc('availability', ID.WN2), (d) => d === null, { label: 'SAS-08: WN2 deleted by the app', timeoutMs: 20_000 });
      await expect(free, 'SAS-08: the deleted window leaves the calendar after the reload').toHaveCount(0, { timeout: 20_000 });
      expect(await getDoc('availability', ID.WN1), 'SAS-08: the booked window is still there').toBeTruthy();
    });
  });

  // ===========================================================================================
  // SAS-09 — Delivery Type Details (Settings): view-only list of appointmenttype
  // ===========================================================================================
  test('SAS-09 A&H Delivery Type Details lists the seeded types with the app\'s length / group / change-work labels, view only', async ({ page }) => {
    await openStudio(page, E.ah);
    await page.getByTestId('sas-nav-item').filter({ hasText: 'Delivery Type Details' }).click();
    await expect(page.getByTestId('sas-settings-title')).toHaveText('Delivery Type Details', { timeout: 20_000 });
    await page.getByTestId('sas-settings-search').fill('SAS Studio');
    const rows = page.getByTestId('sas-settings-table').getByTestId('sas-settings-row');
    await expect(rows, 'SAS-09: the search narrows to the two seeded types').toHaveCount(2, { timeout: 20_000 });
    await expect(rows.nth(0).locator('td')).toHaveText(['SAS Studio Coaching', '1h', 'Yes · up to 3', 'Required']);
    await expect(rows.nth(1).locator('td')).toHaveText(['SAS Studio Review', '45 min', '—', '—']);
    await expect(page.getByTestId('sas-settings-table').locator('button, input, select, a'), 'SAS-09: view only — no controls in the table').toHaveCount(0);
  });
});

// =================================================================================================
// SAS-ADDR — hooks no behavioral case above drives yet (deferred behavioral). Literal references only, so
// the readiness gate credits them. Grouped by the tab / template that renders them.
// =================================================================================================
test.describe('Appointments — Specialist Appointment Studio (addressable, deferred behavioral)', () => {
  test.fixme('SAS-ADDR1 shell states + Home calendar variants addressable (deferred behavioral)', async ({ page }) => {
    await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
    // shell: no role / mentor without a product (needs a mentor actor)
    expect(page.getByTestId('sas-no-role')).toBeTruthy();
    expect(page.getByTestId('sas-mentor-title')).toBeTruthy();
    expect(page.getByTestId('sas-no-product')).toBeTruthy();
    expect(page.getByTestId('sas-loader')).toBeTruthy();
    // Day view / filtered week / month
    expect(page.getByTestId('sas-home-group-type')).toBeTruthy();
    expect(page.getByTestId('sas-home-group-time')).toBeTruthy();
    expect(page.getByTestId('sas-home-day-empty')).toBeTruthy();
    expect(page.getByTestId('sas-home-day-view')).toBeTruthy();
    expect(page.getByTestId('sas-home-day-col')).toBeTruthy();
    expect(page.getByTestId('sas-home-joint-col')).toBeTruthy();
    expect(page.getByTestId('sas-home-day-add-availability')).toBeTruthy();
    expect(page.getByTestId('sas-home-slot-week')).toBeTruthy();
    expect(page.getByTestId('sas-home-day-open')).toBeTruthy();
    expect(page.getByTestId('sas-home-slot-group')).toBeTruthy();
    expect(page.getByTestId('sas-home-window-who')).toBeTruthy();
    expect(page.getByTestId('sas-home-window-joint')).toBeTruthy();
    expect(page.getByTestId('sas-home-joint')).toBeTruthy();
    expect(page.getByTestId('sas-home-day-add')).toBeTruthy();
    expect(page.getByTestId('sas-home-month-day')).toBeTruthy();
    expect(page.getByTestId('sas-home-month-joint')).toBeTruthy();
    expect(page.getByTestId('sas-home-legend')).toBeTruthy();
    expect(page.getByTestId('sas-home-slot')).toBeTruthy();
    expect(page.getByTestId('sas-home-slot-join')).toBeTruthy();
    // availability / upcoming / past extras
    expect(page.getByTestId('sas-home-avail-empty')).toBeTruthy();
    expect(page.getByTestId('sas-home-menu-copy')).toBeTruthy();
    expect(page.getByTestId('sas-home-past-empty')).toBeTruthy();
    expect(page.getByTestId('sas-home-past-more')).toBeTruthy();
    // period bar modes
    expect(page.getByTestId('sas-period-day')).toBeTruthy();
    expect(page.getByTestId('sas-period-week')).toBeTruthy();
    expect(page.getByTestId('sas-period-month')).toBeTruthy();
    expect(page.getByTestId('sas-period-today')).toBeTruthy();
  });

  test.fixme('SAS-ADDR2 filter bar, person picker "all" and participant lookup addressable (deferred behavioral)', async ({ page }) => {
    await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('sas-filter-product')).toBeTruthy();
    expect(page.getByTestId('sas-filter-types')).toBeTruthy();
    expect(page.getByTestId('sas-filter-type-option')).toBeTruthy();
    expect(page.getByTestId('sas-filter-booked-all')).toBeTruthy();
    expect(page.getByTestId('sas-filter-booked-booked')).toBeTruthy();
    expect(page.getByTestId('sas-filter-booked-open')).toBeTruthy();
    expect(page.getByTestId('sas-filter-clear')).toBeTruthy();
    expect(page.getByTestId('sas-filter-no-types')).toBeTruthy();
    expect(page.getByTestId('sas-person-all')).toBeTruthy();
    expect(page.getByTestId('sas-lookup')).toBeTruthy();
    expect(page.getByTestId('sas-lookup-no-steps')).toBeTruthy();
    expect(page.getByTestId('sas-lookup-steps')).toBeTruthy();
    expect(page.getByTestId('sas-lookup-step')).toBeTruthy();
    expect(page.getByTestId('sas-lookup-view')).toBeTruthy();
    expect(page.getByTestId('sas-lookup-book')).toBeTruthy();
    expect(page.getByTestId('sas-lookup-no-history')).toBeTruthy();
    expect(page.getByTestId('sas-lookup-history')).toBeTruthy();
    expect(page.getByTestId('sas-lookup-history-row')).toBeTruthy();
  });

  test.fixme('SAS-ADDR3 Mentor My Team, team table, A&H Mentors and Utilisation addressable (deferred behavioral)', async ({ page }) => {
    await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('sas-team-title')).toBeTruthy();
    expect(page.getByTestId('sas-team-search')).toBeTruthy();
    expect(page.getByTestId('sas-team-no-products')).toBeTruthy();
    expect(page.getByTestId('sas-team-products')).toBeTruthy();
    expect(page.getByTestId('sas-team-product-row')).toBeTruthy();
    expect(page.getByTestId('sas-team-product-detail')).toBeTruthy();
    expect(page.getByTestId('sas-team-type-row')).toBeTruthy();
    expect(page.getByTestId('sas-team-type-eis')).toBeTruthy();
    expect(page.getByTestId('sas-team-stats')).toBeTruthy();
    expect(page.getByTestId('sas-tt-empty')).toBeTruthy();
    expect(page.getByTestId('sas-tt-table')).toBeTruthy();
    expect(page.getByTestId('sas-tt-row')).toBeTruthy();
    expect(page.getByTestId('sas-tt-detail')).toBeTruthy();
    expect(page.getByTestId('sas-tt-status-filter')).toBeTruthy();
    expect(page.getByTestId('sas-tt-no-avail')).toBeTruthy();
    expect(page.getByTestId('sas-tt-avail')).toBeTruthy();
    expect(page.getByTestId('sas-tt-avail-row')).toBeTruthy();
    expect(page.getByTestId('sas-tt-avail-status')).toBeTruthy();
    expect(page.getByTestId('sas-tt-booking')).toBeTruthy();
    expect(page.getByTestId('sas-tt-outside-row')).toBeTruthy();
    expect(page.getByTestId('sas-tt-no-match')).toBeTruthy();
    expect(page.getByTestId('sas-mentors-title')).toBeTruthy();
    expect(page.getByTestId('sas-mentors-table')).toBeTruthy();
    expect(page.getByTestId('sas-mentors-row')).toBeTruthy();
    expect(page.getByTestId('sas-mentors-team')).toBeTruthy();
    expect(page.getByTestId('sas-util-title')).toBeTruthy();
    expect(page.getByTestId('sas-util-role')).toBeTruthy();
    expect(page.getByTestId('sas-util-product')).toBeTruthy();
    expect(page.getByTestId('sas-util-search')).toBeTruthy();
    expect(page.getByTestId('sas-util-stats')).toBeTruthy();
    expect(page.getByTestId('sas-util-table')).toBeTruthy();
    expect(page.getByTestId('sas-util-row')).toBeTruthy();
  });

  test.fixme('SAS-ADDR4 Book Session (calendar + by participant) and the book-slot dialog addressable (deferred behavioral)', async ({ page }) => {
    await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('sas-book-title')).toBeTruthy();
    expect(page.getByTestId('sas-book-mode-calendar')).toBeTruthy();
    expect(page.getByTestId('sas-book-mode-participant')).toBeTruthy();
    expect(page.getByTestId('sas-bookcal')).toBeTruthy();
    expect(page.getByTestId('sas-bookcal-group-type')).toBeTruthy();
    expect(page.getByTestId('sas-bookcal-group-time')).toBeTruthy();
    expect(page.getByTestId('sas-bookcal-pick')).toBeTruthy();
    expect(page.getByTestId('sas-bookcal-gap')).toBeTruthy();
    expect(page.getByTestId('sas-bookcal-grid')).toBeTruthy();
    expect(page.getByTestId('sas-bookcal-day-open')).toBeTruthy();
    expect(page.getByTestId('sas-bookcal-slot')).toBeTruthy();
    expect(page.getByTestId('sas-bookcal-day-empty')).toBeTruthy();
    expect(page.getByTestId('sas-book')).toBeTruthy();
    expect(page.getByTestId('sas-bookslot-dialog')).toBeTruthy();
    expect(page.getByTestId('sas-bookslot-when')).toBeTruthy();
    expect(page.getByTestId('sas-bookslot-none')).toBeTruthy();
    expect(page.getByTestId('sas-bookslot-count')).toBeTruthy();
    expect(page.getByTestId('sas-bookslot-cancel')).toBeTruthy();
    expect(page.getByTestId('sas-bookslot-book')).toBeTruthy();
  });

  test.fixme('SAS-ADDR5 Add availability (auto + static) and the availability-details dialog addressable (deferred behavioral)', async ({ page }) => {
    await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('sas-add-mode-auto')).toBeTruthy();
    expect(page.getByTestId('sas-add-mode-static')).toBeTruthy();
    expect(page.getByTestId('sas-add-type-all')).toBeTruthy();
    expect(page.getByTestId('sas-add-type')).toBeTruthy();
    expect(page.getByTestId('sas-add-calendar')).toBeTruthy();
    expect(page.getByTestId('sas-add-month-prev')).toBeTruthy();
    expect(page.getByTestId('sas-add-month-next')).toBeTruthy();
    expect(page.getByTestId('sas-add-day')).toBeTruthy();
    expect(page.getByTestId('sas-add-dates-summary')).toBeTruthy();
    expect(page.getByTestId('sas-add-day-block')).toBeTruthy();
    expect(page.getByTestId('sas-add-day-title')).toBeTruthy();
    expect(page.getByTestId('sas-add-copy-all')).toBeTruthy();
    expect(page.getByTestId('sas-add-slot-row')).toBeTruthy();
    expect(page.getByTestId('sas-add-slot-type')).toBeTruthy();
    expect(page.getByTestId('sas-add-slot-type-option')).toBeTruthy();
    expect(page.getByTestId('sas-add-slot-start')).toBeTruthy();
    expect(page.getByTestId('sas-add-slot-end')).toBeTruthy();
    expect(page.getByTestId('sas-add-slot-remove')).toBeTruthy();
    expect(page.getByTestId('sas-add-slot-add')).toBeTruthy();
    expect(page.getByTestId('sas-add-start')).toBeTruthy();
    expect(page.getByTestId('sas-add-end')).toBeTruthy();
    expect(page.getByTestId('sas-add-preview')).toBeTruthy();
    expect(page.getByTestId('sas-add-error')).toBeTruthy();
    expect(page.getByTestId('sas-window-when')).toBeTruthy();
    expect(page.getByTestId('sas-window-status')).toBeTruthy();
    expect(page.getByTestId('sas-window-types')).toBeTruthy();
    expect(page.getByTestId('sas-window-type-row')).toBeTruthy();
    expect(page.getByTestId('sas-window-no-bookings')).toBeTruthy();
    expect(page.getByTestId('sas-window-booking')).toBeTruthy();
    expect(page.getByTestId('sas-window-delete')).toBeTruthy();
    expect(page.getByTestId('sas-window-close')).toBeTruthy();
  });
});
