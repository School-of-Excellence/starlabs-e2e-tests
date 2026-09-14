// zoom-and-status.spec.ts — the two Scheduling routes this suite inherited (REAL-UI).
//
// Recon: e2e/recon-allcomp/appointments.md (APPT-19 / APPT-20 — 2026-09-08 coverage pass).
//
// WHY THESE ARE HERE AND NOT IN WORKSHOPS: src/app/Scheduling/** was claimed by the workshops suite while
// ZERO workshops specs touched a Scheduling route and three appointments specs did. The glob moved to this
// suite on 2026-09-08, which corrected a false-green — a Scheduling change had been making the workshops
// gate mandatory while the suite that actually exercises those screens was never triggered.
//
// APPT-19 resolves a REAL seeded appointment: /openappointmentzoom/:id reads
// `appointments/{id}` directly (appointment-zoom-view.component.ts:48-52), and this suite seeds that
// collection. The id is looked up at runtime rather than hardcoded, because appointments/support/appt.ts
// exports AT1/AVBOOK/etc but not the AP1/AP2 appointment ids the seeder writes.
//
// APPT-20 drives /appointment-status-update against a pinned UNMARKED appointment (see the beforeAll
// note): the screen reads `products` (seeded) and `zoomaccount` (seeded NOWHERE — the queue suite writes
// it in-spec for OP-15), and must still reach its ended-state dialog. Pinning that it renders rather than
// throwing on the absent collection is the honest assertion available, and it is the failure mode that
// took /bigProfile down elsewhere in this branch.
import { test, expect } from '@playwright/test';
import { apptDocIds, installApptStubs, loginAsApptAdmin, resetAppointmentUnmarked } from './support/appt';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, queryWhere } from '../queue/support/firestore-admin';

let guard: ConsoleGuard;
let appointmentId: string;

// ---------------------------------------------------------------------------------------------
// WHY THE APPOINTMENT IS PINNED (and not `appts[0]`) — 2026-09-13 root cause of the APPT-20 red.
//
// This file used to take `(await queryWhere('appointments', []))[0]`. An unordered admin query returns
// __name__ order, so that is ALWAYS `appt_AP1` — and status.spec.ts (alphabetically BEFORE this file,
// and the config is workers:1 / fullyParallel:false, so the order is deterministic) marks AP1 ATTENDED
// in APPT-05 and never restores it. Verified against the live emulator after the failing run:
//     appt_AP1 {cancelled:false, attended:true}    <- appts[0]
//     appt_AP2 {cancelled:true,  attended:false}   <- marked by APPT-06
// A marked appointment sends /appointment-status-update down its REDIRECT branch — not a render state:
// appointment-status-update.component.ts:98-108 does
//     if (!data['cancelled'] && !data['attended']) { …; this.loading = false }
//     else { this.router.navigateByUrl('/appointmentstudio') }
// so the host element DETACHES and `loading` stays true. That is the "third state" the old spec never
// anticipated. Same shape as evomap's EM-02: a sibling spec mutated the row this file's gate depends on.
//
// Fix: pin AP1 and re-assert its UNMARKED precondition with the suite's existing reset helper (a
// PRECONDITION write — anti-circular; the assertions below are on what the APP renders). It also leaves
// AP1/D1 back at their seeded values, so a re-run starts from the same state.
// ---------------------------------------------------------------------------------------------
test.beforeAll(async () => {
  const appts = await queryWhere('appointments', []);
  expect(appts.length, 'precondition: the appointments seed must write at least one appointment')
    .toBeGreaterThan(0);

  await resetAppointmentUnmarked(apptDocIds.AP1, apptDocIds.D1);
  const pre = await getDoc('appointments', apptDocIds.AP1);
  expect(pre, 'precondition: AP1 must exist after the unmarked reset').toBeTruthy();
  expect(
    pre!.cancelled === false && pre!.attended === false,
    'precondition: AP1 must be UNMARKED (cancelled:false, attended:false) — otherwise ' +
    '/appointment-status-update redirects to /appointmentstudio instead of rendering',
  ).toBe(true);

  appointmentId = apptDocIds.AP1;
});

// Leave the suite as we found it: AP1/D1 back at their seeded UNMARKED values.
test.afterAll(async () => {
  await resetAppointmentUnmarked(apptDocIds.AP1, apptDocIds.D1);
});

// Per-test benign-console allowlist (reset each test), same mechanism as deep.spec.ts.
let extraIgnore: RegExp[] = [];

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  extraIgnore = [];
  await installApptStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'zoom/status screens: no fatal console errors / pageerrors', extraIgnore));

test.describe('Appointments — zoom view + status update (real UI)', () => {
  // ===========================================================================================
  // APPT-19 — /openappointmentzoom/:id resolves the appointment behind the id in its URL
  // ===========================================================================================
  test('APPT-19 the zoom view mounts for a real seeded appointment id', async ({ page }) => {
    await loginAsApptAdmin(page);
    await page.goto(`/openappointmentzoom/${encodeURIComponent(appointmentId)}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      page.locator('app-appointment-zoom-view'),
      'APPT-19: the zoom view must mount — the grant is the bare "/openappointmentzoom" (authGuard matches ' +
      'the first path segment only); check appointments/seed-appointments.js ROUTES if this fails',
    ).toBeAttached({ timeout: 30_000 });

    // The component getDoc()s appointments/{id} in its constructor with no existence guard, so a component
    // that mounts and produces no fatal console error is the app reporting it resolved that document. The
    // afterEach console guard is what makes this assertion mean something rather than being a bare mount.
    await expect(
      page.locator('app-appointment-zoom-view'),
      'APPT-19: the view must still be attached after its appointment read settles',
    ).toBeAttached({ timeout: 30_000 });
  });

  // ===========================================================================================
  // APPT-20 — /appointment-status-update mounts over its partly-unseeded reads
  // ===========================================================================================
  test('APPT-20 the status-update screen resolves the appointment named in its data param', async ({ page }) => {
    // [APP FINDING — benign, app-caught] loadProductType() reads `this.mapAppointment`, which the
    // CONSTRUCTOR fills without awaiting (`getAppointmentMap().then(...)`, component.ts:74) while
    // ngOnInit races ahead into loadAppointmentData() → loadProductType() (component.ts:78-105). When the
    // single-doc getDoc(appointments/{id}) wins against the appointmenttype getDocs, mapAppointment is
    // still {} and component.ts:124 calls .toLowerCase() on undefined. The component's OWN try/catch
    // swallows it (component.ts:135-137 → console.error('Error loading product type:')), productType
    // stays null (its info row is *ngIf'd away) and the screen renders normally — so this is app-caught
    // startup noise, not the behaviour under test. Anchored to the exact app string; a genuine error on
    // this screen is still fatal.
    extraIgnore = [/Error loading product type:/i];

    await loginAsApptAdmin(page);

    // This screen takes its input as a JSON BLOB in a query param — ngOnInit does
    // `JSON.parse(decodeURIComponent(params['data']))` and then reads `meetingData.appointmentid`
    // (appointment-status-update.component.ts:80-92). With no `data` param the subscribe body never runs,
    // nothing resolves, and the page renders as an empty dark overlay — which is what a bare navigation
    // produced on the first attempt here.
    //
    // Same convention as /bigProfile in the queue suite (BIG-14). Two screens now take a JSON blob this
    // way, so it is worth recognising rather than rediscovering.
    const data = encodeURIComponent(JSON.stringify({ appointmentid: appointmentId }));
    await page.goto(`/appointment-status-update?data=${data}`, { waitUntil: 'domcontentloaded' });

    const host = page.locator('app-appointment-status-update');
    await expect(
      host,
      'APPT-20: the status-update screen must mount — check its grant in ' +
      'appointments/seed-appointments.js ROUTES if this fails on a correct URL',
    ).toBeAttached({ timeout: 30_000 });

    // [REAL-UI] With an UNMARKED, resolvable appointmentid the component leaves its loading state
    // (component.ts:105) and renders the ended-state dialog heading (html:4-5). `zoomaccount` is seeded
    // nowhere and `hostemail` is absent from the data blob, so this also pins that the screen survives
    // performCleanupOperations() over that absent collection (component.ts:222-229 early-returns).
    //
    // [APP BUG — dead loading state] The old form of this assertion also accepted "Loading appointment
    // details". That state is UNREACHABLE: the template's <div class="dialog-content" *ngIf="!loading">
    // (html:4) is never closed before the loading block — html:33 opens a stray <div> that html:62 closes,
    // so the *ngIf="loading" block at html:65-69 is nested INSIDE the *ngIf="!loading" element. While
    // loading is true the whole subtree (including the spinner) is removed and the screen is a blank dark
    // overlay; the spinner can only appear once loading is false, when "Meeting Ended" is showing anyway.
    // Asserting the single reachable state is the stronger assertion, so the OR is gone.
    await expect(
      host.getByRole('heading', { name: /Meeting Ended/i }),
      'APPT-20: the screen must render its ended-state dialog after resolving the appointment in its data param',
    ).toBeVisible({ timeout: 60_000 });

    // The screen must NOT have bounced to /appointmentstudio — that redirect (component.ts:107) is the
    // marked-appointment branch and would mean the unmarked precondition did not hold.
    await expect(page, 'APPT-20: the screen must stay on /appointment-status-update (no redirect)')
      .toHaveURL(/appointment-status-update/);
  });
});
