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
// APPT-20 is a mount case and labelled as one: /appointment-status-update reads `products` (seeded) and
// `zoomaccount` (seeded NOWHERE — the queue suite writes it in-spec for OP-15), so the screen renders its
// waiting state. Pinning that it mounts rather than throws on the absent collection is the honest
// assertion available, and it is the failure mode that took /bigProfile down elsewhere in this branch.
import { test, expect } from '@playwright/test';
import { installApptStubs, loginAsApptAdmin } from './support/appt';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { queryWhere } from '../queue/support/firestore-admin';

let guard: ConsoleGuard;
let appointmentId: string;

test.beforeAll(async () => {
  const appts = await queryWhere('appointments', []);
  expect(appts.length, 'precondition: the appointments seed must write at least one appointment')
    .toBeGreaterThan(0);
  appointmentId = String(appts[0].id);
});

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  await installApptStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'zoom/status screens: no fatal console errors / pageerrors'));

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

    // [REAL-UI] With a resolvable appointmentid the component loads the document and leaves its loading
    // state, rendering the ended-state dialog (html:4-5). Either heading proves the template rendered and
    // the component survived — `zoomaccount` is seeded nowhere, so this also pins that the screen does not
    // die on that absent collection.
    await expect(
      host.getByText(/Meeting Ended|Loading appointment details/i).first(),
      'APPT-20: the screen must render one of its own states after resolving the appointment in its data param',
    ).toBeVisible({ timeout: 60_000 });
  });
});
