// @ts-nocheck
/**
 * seed-appointments.js — stand up the Appointment & Scheduling world on the dedicated disposable
 * test project (slabs-queue-e2e-exdcz), reusing the proven queue-suite primitives
 * (allowlist-guarded admin init, the staff auth chain, the dashboard route-grant doc shape).
 *
 * Mirrors e2e/queue/recon-... + e2e/recon-allcomp/appointments.md. PRODUCTION-SAFE BY CONSTRUCTION:
 * every write goes through seed-test-project.initAdmin() (hard-aborts off the test project), every
 * doc is tagged {testrunid:'appt', _testdata:true}, and NO ATC collection is ever touched (products
 * are seeded with atcmodel:null so the appointment-status / studio ATC branches are never entered).
 *
 * Actors (custom roster — appointments need an `eis` specialist role the queue roster lacks):
 *   admin+appt@example.com      roles {admin, ah}     — super-role: sees all appts/availability/offtime
 *   scheduler+appt@example.com  roles {scheduler}
 *   eis0+appt@example.com       roles {eis}           — specialist / appointment host
 *   eis1+appt@example.com       roles {eis}           — 2nd specialist
 *   participant0+appt@example.com roles {participant} — books / is booked
 *
 * Usage:  node e2e/appointments/seed-appointments.js --seed | --teardown
 */
'use strict';

// initAdminAuto is the SHARED emulator-aware admin init (lib/seed-common): emulator-pinned when
// FIRESTORE_EMULATOR_HOST is set, else the cloud allowlist-guarded seed.initAdmin(). One copy for all seeders.
const { seed, seedDashboardRoutes, TAG, initAdminAuto } = require('../lib/seed-common');

const TESTRUNID = process.env.APPT_RUNID || 'appt';

// ---- deterministic doc ids (run-prefixed) -------------------------------------------------------
const ID = {
  AT1: `${TESTRUNID}_AT1`,            // appointmenttype "Test Diagnostic" (ischangeworkrequired:false)
  AT2: `${TESTRUNID}_AT2`,            // appointmenttype "Test Implementation"
  AT2R: `${TESTRUNID}_AT2R`,          // appointmenttype "Test Two-Role" (2 required roles → slot merge)
  R1: `${TESTRUNID}_R1`,             // eisroles "Primary Specialist"
  R2: `${TESTRUNID}_R2`,             // eisroles "Secondary Specialist" (for the 2-role appt)
  RTE1: `${TESTRUNID}_RTE1`,          // Roles-To-EIS (R1 → eis0, eis1)
  RTE2: `${TESTRUNID}_RTE2`,          // Roles-To-EIS (R2 → eis1)
  ATR1: `${TESTRUNID}_ATR1`,          // AppointmentType-To-Roles (AT1 → [R1])
  ATR2R: `${TESTRUNID}_ATR2R`,        // AppointmentType-To-Roles (AT2R → [R1, R2])
  P1: `${TESTRUNID}_P1`,             // products (Priority Mode, atcmodel:null)
  PROSTER: `${TESTRUNID}_PROSTER`,    // products — DISTINCT name so the roster filter isolates APROSTER/APFUTURE
  PDS1: `${TESTRUNID}_PDS1`,          // productToDeliverySequence
  PP1: `${TESTRUNID}_PP1`,            // participantsproduct (p0)
  PP2: `${TESTRUNID}_PP2`,            // participantsproduct (p1 — the BOOKING subject)
  AV1: `${TESTRUNID}_AV1`,            // availability (eis0, 8h window, 2h booked → 25% utility)
  AVDASH: `${TESTRUNID}_AVDASH`,      // availability (eis1, TODAY, one FREE AT1 slot → dashboard count)
  AVBOOK: `${TESTRUNID}_AVBOOK`,      // availability (eis1, +2d, one FREE AT1 slot → booking commit)
  AVM1: `${TESTRUNID}_AVM1`,          // availability (eis0, +20d, FREE AT2R slot @10am → 2-role merge)
  AVM2: `${TESTRUNID}_AVM2`,          // availability (eis1, +20d, FREE AT2R slot @10am → 2-role merge)
  OT1: `${TESTRUNID}_OT1`,            // offtime to APPROVE (eis0)
  OT2: `${TESTRUNID}_OT2`,            // offtime to DENY    (eis1)
  AP1: `${TESTRUNID}_AP1`,            // appointment to mark ATTENDED (past, unmarked)
  AP2: `${TESTRUNID}_AP2`,            // appointment to mark CANCELLED (past, unmarked)
  APSTUDIO: `${TESTRUNID}_APSTUDIO`,  // appointment hosted by eis0 TODAY-future (→ studio card)
  APROSTER: `${TESTRUNID}_APROSTER`,  // appointment TODAY (→ roster default view; has `created`)
  APFUTURE: `${TESTRUNID}_APFUTURE`,  // appointment +10d (→ roster: hidden by default, shown on Get All)
  D1: `${TESTRUNID}_D1`,             // deliverable linked to AP1 (→ completed)
  D2: `${TESTRUNID}_D2`,             // deliverable linked to AP2 (→ ready)
  DB: `${TESTRUNID}_DB`,             // deliverable for p1 (→ flips ongoing on BOOKING commit)
  EZ1: `${TESTRUNID}_EZ1`,            // EISzoomcontact
  DT1: `${TESTRUNID}_DT1`,            // deliverytime (eis0 weekly hours)
  DT2: `${TESTRUNID}_DT2`,            // deliverytime (eis1 weekly hours — 2nd row)
  CEM1: `${TESTRUNID}_CEM1`,          // customer_eismapping (participant0)
};

// Actors. profileids are run-prefixed; emails follow the actors.ts convention `<role>+<run>@example.com`.
const PF = {
  admin: `${TESTRUNID}_pf_admin`,
  scheduler: `${TESTRUNID}_pf_scheduler`,
  eis0: `${TESTRUNID}_pf_eis0`,
  eis1: `${TESTRUNID}_pf_eis1`,
  p0: `${TESTRUNID}_pf_p0`,
  p1: `${TESTRUNID}_pf_p1`,
};
const EMAIL = {
  admin: `admin+${TESTRUNID}@example.com`,
  scheduler: `scheduler+${TESTRUNID}@example.com`,
  eis0: `eis0+${TESTRUNID}@example.com`,
  eis1: `eis1+${TESTRUNID}@example.com`,
  p0: `participant0+${TESTRUNID}@example.com`,
  p1: `participant1+${TESTRUNID}@example.com`,
};

function roster() {
  const mk = (key, roles, role) => ({ uid: `${TESTRUNID}_u_${key}`, profileid: PF[key], email: EMAIL[key], role: role || key, roles });
  const staff = [
    mk('admin', ['admin', 'ah'], 'admin'),
    mk('scheduler', ['scheduler'], 'scheduler'),
    mk('eis0', ['eis'], 'eis'),
    mk('eis1', ['eis'], 'eis'),
  ];
  const participants = [mk('p0', ['participant'], 'participant'), mk('p1', ['participant'], 'participant')];
  return { staff, operators: [], participants };
}

// Routes the appointment specs navigate to (each needs a dashboard route-config grant).
const ROUTES = [
  { route: '/appointmentstatuspending', label: 'Appointment Status Pending' },
  { route: '/capacityutilization', label: 'Capacity Utilization' },
  { route: '/approveofftime', label: 'Approve Offtime' },
  { route: '/appointmentavailability', label: 'Appointment Availability' },
  { route: '/roster', label: 'Roster' },
  { route: '/teamdeliveryhours', label: 'Team Delivery Hours' },
  { route: '/appointmentstudio', label: 'Appointment Studio' },
  { route: '/appointment-dashboard', label: 'Appointment Dashboard' },
  { route: '/bookappointment', label: 'Book Appointment' },
  { route: '/mapclienteis', label: 'Map Client EIS' },
  { route: '/EISzoom', label: 'EIS Zoom' },
  { route: '/appointmentrole', label: 'Appointment Role' },
  { route: '/eisappointmentrole', label: 'EIS Appointment Role' },
  { route: '/mapappointmentrole', label: 'Map Appointment Role' },
  { route: '/offtime', label: 'Offtime' },
  { route: '/appointmentcalendar', label: 'Appointment Calendar' },
  // 2026-09-08 — the two Scheduling routes reassigned to this suite (APPT-19/20).
  { route: '/openappointmentzoom', label: 'Appointment Zoom View' },
  { route: '/appointment-status-update', label: 'Appointment Status Update' },
  { route: '/mycalendar', label: 'My Calendar' },
];

async function seedAppointments() {
  const admin = initAdminAuto();
  const db = admin.firestore();
  const auth = admin.auth();
  const T = admin.firestore.Timestamp;
  const tag = TAG(TESTRUNID);

  const { staff, operators, participants } = roster();

  // 1) Auth chain for the custom roster (Auth users + user_data + profile_data + users_roles + the
  //    queue DRIVEN_ROUTES grants). Reused verbatim from the queue seeder.
  await seed.seedAuthChain(db, auth, TESTRUNID, { staff, operators, participants });

  // 2) Dashboard grants for THIS group's routes.
  const staffProfileIds = staff.map((s) => s.profileid);
  const allRoles = [...new Set(staff.flatMap((s) => s.roles))];
  const participantProfileIds = participants.map((p) => p.profileid);
  await seedDashboardRoutes(db, TESTRUNID, ROUTES, { staffProfileIds, allRoles, participantProfileIds });

  // --- refs ---
  const profileRef = (pf) => db.collection('profile_data').doc(pf);
  const apptTypeRef = (id) => db.collection('appointmenttype').doc(id);
  const roleRef = (id) => db.collection('eisroles').doc(id);
  const productRef = (id) => db.collection('products').doc(id);
  const apptRef = (id) => db.collection('appointments').doc(id);

  // --- date helpers (seed-time Node Date — same machine/TZ as the test browser) ---
  const at = (dayOffset, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return T.fromDate(d); };
  const hoursAgo = (h) => T.fromMillis(Date.now() - h * 3600e3);
  const hoursFromNow = (h) => T.fromMillis(Date.now() + h * 3600e3);

  // 3) CONFIG (appointment types, roles, mappings, products) — all non-ATC.
  //    NB: `id` mirrors the doc id — the dashboard reads activityData['id'] as the appointment-type id
  //    (appointment-dashboard.component.ts:157), and capacity reads doc[appointments[j].id]; both need it.
  await apptTypeRef(ID.AT1).set({ docid: ID.AT1, id: ID.AT1, appointmenttype: 'Test Diagnostic', duration: 60, ischangeworkrequired: false, ...tag });
  await apptTypeRef(ID.AT2).set({ docid: ID.AT2, id: ID.AT2, appointmenttype: 'Test Implementation', duration: 90, ischangeworkrequired: false, ...tag });
  // AT2R — a TWO-required-role appointment type (R1+R2): used by the slot-merge case (APPT-18). Its own
  // product/delivery is NOT seeded (dashboard must keep showing exactly one type for P1), so it never
  // appears on the dashboard; it is reached only via /bookappointment for p1 (no customer_eismapping).
  await apptTypeRef(ID.AT2R).set({ docid: ID.AT2R, id: ID.AT2R, appointmenttype: 'Test Two-Role', duration: 60, ischangeworkrequired: false, ...tag });
  await roleRef(ID.R1).set({ docid: ID.R1, role: 'Primary Specialist', experiencestage: 'S1', experiencelevel: 'L1', ...tag });
  await roleRef(ID.R2).set({ docid: ID.R2, role: 'Secondary Specialist', experiencestage: 'S2', experiencelevel: 'L1', ...tag });
  await db.collection('Roles-To-EIS').doc(ID.RTE1).set({ docid: ID.RTE1, assigned_role_ref: roleRef(ID.R1), assigned_eis: [profileRef(PF.eis0), profileRef(PF.eis1)], ...tag });
  // R2 → ONLY eis1, so the 2-role appt resolves R1→{eis0,eis1}, R2→{eis1}; the only same-time pair that
  // survives the merge's `eisprofile != eisprofile` filter is (eis0 as R1, eis1 as R2) → exactly 1 slot.
  await db.collection('Roles-To-EIS').doc(ID.RTE2).set({ docid: ID.RTE2, assigned_role_ref: roleRef(ID.R2), assigned_eis: [profileRef(PF.eis1)], ...tag });
  await db.collection('AppointmentType-To-Roles').doc(ID.ATR1).set({ docid: ID.ATR1, assigned_appttype_ref: apptTypeRef(ID.AT1), required_role: [roleRef(ID.R1)], additional_role: [], ...tag });
  await db.collection('AppointmentType-To-Roles').doc(ID.ATR2R).set({ docid: ID.ATR2R, assigned_appttype_ref: apptTypeRef(ID.AT2R), required_role: [roleRef(ID.R1), roleRef(ID.R2)], additional_role: [], ...tag });
  await productRef(ID.P1).set({ docid: ID.P1, product: 'Test WiSH Priority', mode: 'Priority Mode', atcmodel: null, ...tag });
  // Distinct product whose name appears ONLY on the two roster appointments (APROSTER/APFUTURE), so the
  // roster Search box isolates exactly them — the past AP1/AP2 carry P1 and won't match this filter.
  // NOT 'Priority Mode' → it never appears on the appointment-dashboard (which would change APPT-14's count).
  await productRef(ID.PROSTER).set({ docid: ID.PROSTER, product: 'Test Roster Only', mode: 'Event Mode', atcmodel: null, ...tag });
  await db.collection('productToDeliverySequence').doc(ID.PDS1).set({
    docid: ID.PDS1, product: productRef(ID.P1),
    deliveryoptions: [{ deliverysequence: [{ activity: apptTypeRef(ID.AT1) }] }], ...tag,
  });

  // 4) RUNTIME: participant product + delivery sequence + the two unmarked appointments + deliverables.
  await db.collection('participantsproduct').doc(ID.PP1).set({ docid: ID.PP1, profileid: PF.p0, productref: productRef(ID.P1), status: 'initiated', ...tag });
  await db.collection('participantdeliverysequence').doc(PF.p0).set({
    docid: PF.p0, profileid: PF.p0,
    products: [{ participantproductid: ID.PP1, productref: productRef(ID.P1), delivery: [
      { type: 'appointment', status: 'ready', sequenceref: db.collection('deliverables').doc(ID.D1) },
    ] }], ...tag,
  });

  // 4a) PARTICIPANT METADATA for the booked participants (p0, p1). In prod these docs are auto-created by a
  //     Cloud Function (queuesystem.js) as participants move through flows; the emulator doesn't run that CF,
  //     so — exactly like every sibling suite's seed — we create them here. The appointment-studio screen
  //     enriches EVERY appointment via mapProfileMeta[bookedby.id].activejourney
  //     (appointment-studio.component.ts:173/280, un-guarded), so a booked participant WITHOUT a metadata doc
  //     crashes the studio (APPT-12/13 — was passing only on a dirty local emulator that had accumulated
  //     these docs; failed on CI's fresh one). `name` is REQUIRED — getParticipantMetaMap() reads
  //     participant metadata with orderBy('name'), which drops docs missing that field.
  for (const [pf, email] of [[PF.p0, EMAIL.p0], [PF.p1, EMAIL.p1]]) {
    await db.collection('participant metadata').doc(pf).set({
      docid: pf, profileid: pf, name: email, activejourney: null, ...tag,
    }, { merge: true });
  }

  // 4b) BOOKING SUBJECT (p1): a SECOND participant product + delivery sequence whose bookable appointment
  //     (AT1, status "ready") drives the keystone booking flow (APPT-02/03/18). p1 deliberately has NO
  //     customer_eismapping → booking falls through to Roles-To-EIS (eis0+eis1 for R1). Reset helper
  //     `resetBookingSubject()` restores this precondition so the write-mutation cases are re-runnable.
  await seedBookingSubject(db, T, { productRef, apptTypeRef });

  // hostRole is keyed by the ROLE REF PATH (status-pending reads hostRole[role.path]).
  const rolePath = roleRef(ID.R1).path; // "eisroles/appt_R1"
  const mkAppt = (id, bookedPf) => ({
    docid: id,
    appointment: apptTypeRef(ID.AT1),
    appointmentrole: [roleRef(ID.R1)],
    hostRole: { [rolePath]: [profileRef(PF.eis0)] },
    hosts: [profileRef(PF.eis0)],
    bookedby: profileRef(bookedPf),
    starttime: hoursAgo(2), endtime: hoursAgo(1),
    cancelled: false, attended: false,
    journeycoach: false, onboarding: false,
    // `created` + `productid` + `slotdata` are required by the roster stream (it reads created.toDate()
    // for EVERY cancelled==false appointment, incl. these past ones); without them the roster subscribe
    // throws and renders nothing (APPT-07). They are inert for the status-pending screen (APPT-04/05/06).
    productid: ID.P1, created: T.now(), slotdata: [{ id: ID.AV1, index: 0 }],
    ...tag,
  });
  // AP1 booked by p0 (→ mark ATTENDED, APPT-05); AP2 booked by p1 (→ mark CANCELLED, APPT-06).
  // Distinct clients make the two status-pending rows distinguishable in the UI.
  await apptRef(ID.AP1).set(mkAppt(ID.AP1, PF.p0));
  await apptRef(ID.AP2).set(mkAppt(ID.AP2, PF.p1));

  // Deliverables linked to each appointment via fileref (updateDeliveryStatus targets fileref
  // array-contains apptRef). NO participantproductid → mark-status's last-delivery extension prompt
  // loop `continue`s (no extra dialog). status starts "ongoing".
  await db.collection('deliverables').doc(ID.D1).set({ docid: ID.D1, profileid: PF.p0, type: 'appointment', status: 'ongoing', deliveryref: apptTypeRef(ID.AT1), fileref: [apptRef(ID.AP1)], ...tag });
  await db.collection('deliverables').doc(ID.D2).set({ docid: ID.D2, profileid: PF.p0, type: 'appointment', status: 'ongoing', deliveryref: apptTypeRef(ID.AT1), fileref: [apptRef(ID.AP2)], ...tag });

  // 5) AVAILABILITY for capacity utilization (APPT-08): 8h window today (09:00–17:00), one 2h booked
  //    slot (10:00–12:00) → utility = floor(2/8*100) = 25%. The slot array is keyed by the appt-type
  //    DOC id (capacity reads doc[appointments[j].id]). KEEP THIS the only eis0 TODAY window so the
  //    25% assertion stays exact (free slots for the other cases live on eis1 / future dates).
  await db.collection('availability').doc(ID.AV1).set({
    docid: ID.AV1, profileref: profileRef(PF.eis0),
    starttime: at(0, 9), endtime: at(0, 17),
    appointments: [apptTypeRef(ID.AT1)],
    [ID.AT1]: [{ slotstart: at(0, 10), slotend: at(0, 12), booked: true, available: false }],
    ...tag,
  });

  // 5b) DASHBOARD slot (APPT-14): eis1, +1 day, a 09:00–17:00 window with one FREE AT1 slot. The dashboard
  //     component never sets superRole (it stays false), so its lower bound for the slot query is the
  //     WINDOW starttime >= rangeStart, where rangeStart for a NON-today date is that date at 00:00. So we
  //     place the window on +1d (window start 09:00 ≥ +1d-00:00) and the spec drives the date range to +1d.
  //     This sidesteps the "today → rangeStart=now" trap that hides a same-day window once now passes its
  //     start. eis0's +1d has no AT1 window, so the AT1 chip count == this single free slot.
  await db.collection('availability').doc(ID.AVDASH).set({
    docid: ID.AVDASH, profileref: profileRef(PF.eis1),
    starttime: at(1, 9), endtime: at(1, 17),
    appointments: [apptTypeRef(ID.AT1)],
    [ID.AT1]: [{ slotstart: at(1, 14), slotend: at(1, 15), booked: false, available: true }],
    ...tag,
  });

  // 5c) BOOKING slot (APPT-02/03): eis1, +2 days, one FREE AT1 slot. Super-role admin can book from
  //     today; we pick +2d in the spec. eis0 has NO availability that day, so the slot list contains
  //     exactly this single eis1 slot. APPT-02 books it (slot flips booked:true); APPT-03 re-opens the
  //     booking screen for the same date and asserts ZERO free slots. `resetBookingSlot()` restores it.
  await seedBookingSlot(db, T, profileRef, apptTypeRef);

  // 5d) 2-ROLE MERGE slots (APPT-18): eis0 (as R1) and eis1 (as R2), +3 days, BOTH free at 10:00–11:00
  //     for AT2R. The merge intersects same-start slots from distinct specialists → exactly 1 entry
  //     "10:00 with <eis0>, <eis1>". Read-only (the case asserts the merged list; it does not book).
  await db.collection('availability').doc(ID.AVM1).set({
    docid: ID.AVM1, profileref: profileRef(PF.eis0),
    starttime: at(20, 9), endtime: at(20, 17),
    appointments: [apptTypeRef(ID.AT2R)],
    [ID.AT2R]: [{ slotstart: at(20, 10), slotend: at(20, 11), booked: false, available: true }],
    ...tag,
  });
  await db.collection('availability').doc(ID.AVM2).set({
    docid: ID.AVM2, profileref: profileRef(PF.eis1),
    starttime: at(20, 9), endtime: at(20, 17),
    appointments: [apptTypeRef(ID.AT2R)],
    [ID.AT2R]: [{ slotstart: at(20, 10), slotend: at(20, 11), booked: false, available: true }],
    ...tag,
  });

  // 6) OFFTIME — two future requests, status:null. OT1(eis0) approved, OT2(eis1) denied.
  await db.collection('offtime').doc(ID.OT1).set({ docid: ID.OT1, profileid: PF.eis0, date: at(3, 0), starttime: at(3, 9), endtime: at(3, 11), fullday: false, status: null, ...tag });
  await db.collection('offtime').doc(ID.OT2).set({ docid: ID.OT2, profileid: PF.eis1, date: at(4, 0), starttime: at(4, 9), endtime: at(4, 11), fullday: false, status: null, ...tag });

  // 6b) STUDIO card (APPT-12): an appointment hosted by eis0 with endtime in the FUTURE (so the studio's
  //     `endTime >= now` filter keeps it) and not cancelled/attended. starttime today+future. p0 is the
  //     client (p0 has a `participant metadata` doc → the studio's activejourney lookup won't crash).
  await apptRef(ID.APSTUDIO).set({
    docid: ID.APSTUDIO,
    appointment: apptTypeRef(ID.AT1),
    appointmentrole: [roleRef(ID.R1)],
    hostRole: { [rolePath]: [profileRef(PF.eis0)] },
    hosts: [profileRef(PF.eis0)],
    bookedby: profileRef(PF.p0),
    starttime: at(0, 23), endtime: hoursFromNow(26), // start late today, end ~tomorrow → always future
    cancelled: false, attended: false, journeycoach: false, onboarding: false,
    created: T.now(), slotdata: [{ id: ID.AVDASH, index: 0 }],
    ...tag,
  });

  // 6c) ROSTER (APPT-07): roster streams appointments(cancelled==false) and DEFAULT-filters to
  //     today→+3d; "Get All" lifts the window. Seed one TODAY (visible by default) + one +10d (hidden
  //     by default, revealed by Get All). Both need `created` (roster reads created.toDate()) and the
  //     same product P1 so the run-unique product name "Test WiSH Priority" identifies our rows.
  const mkRoster = (id, dayOffset) => ({
    docid: id,
    appointment: apptTypeRef(ID.AT1),
    appointmentrole: [roleRef(ID.R1)],
    hostRole: { [rolePath]: [profileRef(PF.eis0)] },
    hosts: [profileRef(PF.eis0)],
    bookedby: profileRef(PF.p0),
    starttime: at(dayOffset, 13), endtime: at(dayOffset, 14),
    // attended:true keeps these in the roster (which streams cancelled==false, ignoring attended) but
    // EXCLUDES them from the status-pending board (cancelled==false && attended==false && starttime<=now)
    // — otherwise APROSTER (p0, today-past) becomes a 2nd participant0 row and breaks APPT-04/05 (strict mode).
    cancelled: false, attended: true, journeycoach: false, onboarding: false,
    productid: ID.PROSTER, created: T.now(), slotdata: [{ id: ID.AVDASH, index: 0 }],
    ...tag,
  });
  await apptRef(ID.APROSTER).set(mkRoster(ID.APROSTER, 0));   // today → default roster view
  await apptRef(ID.APFUTURE).set(mkRoster(ID.APFUTURE, 10));  // +10d → only via "Get All"

  // 7) Misc config (EISzoom / mapclienteis / team-delivery-hours).
  await db.collection('EISzoomcontact').doc(ID.EZ1).set({ docid: ID.EZ1, name: `Zoom EIS0 ${TESTRUNID}`, email: EMAIL.eis0, zoomid: '999-000-111', profileref: profileRef(PF.eis0), ...tag });

  // mapclienteis (APPT-15) reads customer_eismapping and renders ONLY docs with a non-empty `roles[]`:
  //   profilename = mapProfile[doc.profile_ref.id]; eisrole = roles.map(r => mapRole[r.id] + " - " +
  //   eisroles[r.path].map(s => mapProfile[s.id])). So this doc needs profile_ref (a ref), roles (role
  //   refs), and eisroles keyed by ROLE PATH. (Keyed by id — used elsewhere by booking — is NOT read here.)
  await db.collection('customer_eismapping').doc(PF.p0).set({
    docid: PF.p0, profileid: PF.p0,
    profile_ref: profileRef(PF.p0),
    roles: [roleRef(ID.R1)],
    eisroles: { [roleRef(ID.R1).path]: [profileRef(PF.eis0)] },
    ...tag,
  });

  // team-delivery-hours (APPT-11): two `deliverytime` rows (eis0 + eis1) → the table renders 2 named
  //   rows (name joined from the profile map). Weekday keys are lowercase (template reads row[day]).
  const dtDays = { monday: [{ starttime: '09:00', endtime: '17:00' }], wednesday: [{ starttime: '09:00', endtime: '17:00' }] };
  await db.collection('deliverytime').doc(ID.DT1).set({ docid: ID.DT1, profileid: PF.eis0, ...dtDays, ...tag });
  await db.collection('deliverytime').doc(ID.DT2).set({ docid: ID.DT2, profileid: PF.eis1, ...dtDays, ...tag });

  // 8) SPECIALIST APPOINTMENT STUDIO world (/specialistappointmentstudio) — its OWN tag (SAS_RUN), see below.
  await seedStudio(db, auth, T);

  return { TESTRUNID, ID, PF, EMAIL, counts: { appointments: 5, availability: 5, offtime: 2, deliverytime: 2, studio: { appointments: 7, availability: 5 } } };
}

// =================================================================================================
// SPECIALIST APPOINTMENT STUDIO (SAS) world — appointments/specialist-appointment-studio.spec.ts.
//
// WHY ITS OWN TAG (`${TESTRUNID}sas`): the studio's numbers are sums over a specialist's windows and
// sessions, and its tables list a specialist's sessions. Every doc here hangs off NEW actors (ah / cw / cw2
// and clients c0..c5) so nothing the other appointment specs count or filter on moves — their row filters
// key on `eis0+appt@…` / `participant0+appt@…`, which none of these emails contain as a substring. The
// separate tag keeps the world's teardown/reset independent of the main seed (teardownStudio()).
//
// WHY THE AUTH CHAIN IS WRITTEN HERE and not via seed.seedAuthChain: seedAuthChain also writes the queue
// DRIVEN_ROUTES `dashboard` grants under the run tag, and authguard.routeConfig() lets the LAST matching
// dashboard doc win (doc-id order). `apptsas_dash_*` sorts after `appt_dash_*`, so those grants would
// REPLACE the main seed's for every queue route with an ah/eis-only role list. Only the studio route is granted.
//
// TIME LAYOUT — all relative to THIS week's Monday 00:00 local (Home opens on the current week):
//   last week  Wed (-5)  WL1 cw  09:00–13:00 [Coaching, Review]  A_DONE 09–10 attended (c1)
//                                                            A_CANC 10–11 cancelled, no-show reason (c2)
//                                                            A_PEND 11:00–11:45 Review, UNMARKED (c0)
//              Wed (-5)  WOT cw2 09:00–17:00 [Coaching]      A_OTHER_DONE 09–10 attended, A_OTHER_PEND 13–14 (c5)
//              Thu (-4)  WL2 cw  14:00–16:00 [Coaching]      nothing booked
//   2 weeks ago Wed (-12)          A_OLD 09:00–10:30 attended (c3) — no window, outside last week
//   next week  Wed (+9)  WN1 cw  09:00–12:00 [Coaching]      A_UP 09–10 booked, future (c4)
//              Thu (+10) WN2 cw  14:00–15:00 [Coaching]      nothing booked (the deletable window)
//   this week: NOTHING for cw (the default period must read zero).
// Last week, the app must compute for cw: Available 6h (240+120) · Booked 1h 45m (union of the booked
// slots 09–10 + 11:00–11:45) · Delivered 1h (A_DONE only) · 1h cancelled · Unutilised 5h · Utilisation 17%.
// Each control moves a number if its rule breaks: A_CANC → Delivered 2h/33%; A_PEND → 1h 45m/29%;
// cw2 leaking in → Available 14h; A_OLD leaking in → Delivered 2h 30m.
// A_PEND is cw's NEWEST-ENDED session and is a "SAS Studio Review" (the others are "Coaching"), so the
// add-availability gate (unmarkedLastAppointment) must name Review.
// =================================================================================================
const SAS_RUN = `${TESTRUNID}sas`;
const SAS_ID = {
  AT: `${SAS_RUN}_AT`,       // appointmenttype "SAS Studio Coaching" 60 min, group (max 3), change work required
  AT2: `${SAS_RUN}_AT2`,     // appointmenttype "SAS Studio Review" 45 min, no group, no change work
  R1: `${SAS_RUN}_R1`,       // eisroles "SAS Specialist"
  RTE1: `${SAS_RUN}_RTE1`,   // Roles-To-EIS R1 → cw, cw2
  ATR1: `${SAS_RUN}_ATR1`,   // AppointmentType-To-Roles AT → [R1]
  ATR2: `${SAS_RUN}_ATR2`,   // AppointmentType-To-Roles AT2 → [R1]
  PROD: `${SAS_RUN}_PROD`,   // products "SAS Studio Product" (atcmodel:null, not Priority Mode → off the dashboard)
  WL1: `${SAS_RUN}_WL1`, WL2: `${SAS_RUN}_WL2`, WOT: `${SAS_RUN}_WOT`, WN1: `${SAS_RUN}_WN1`, WN2: `${SAS_RUN}_WN2`,
  A_DONE: `${SAS_RUN}_A_DONE`, A_CANC: `${SAS_RUN}_A_CANC`, A_PEND: `${SAS_RUN}_A_PEND`, A_OLD: `${SAS_RUN}_A_OLD`,
  A_UP: `${SAS_RUN}_A_UP`, A_OTHER_DONE: `${SAS_RUN}_A_OTHER_DONE`, A_OTHER_PEND: `${SAS_RUN}_A_OTHER_PEND`,
};
const SAS_KEYS = ['ah', 'cw', 'cw2', 'c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
const SAS_PF = Object.fromEntries(SAS_KEYS.map((k) => [k, `${SAS_RUN}_pf_${k}`]));
const SAS_EMAIL = {
  ah: `ah+${SAS_RUN}@example.com`,        // users_roles {ah}  → A&H view (Overview, Mentors, Utilisation, Book, Settings)
  cw: `cw+${SAS_RUN}@example.com`,        // users_roles {eis} → CW view (Home only)
  cw2: `cw2+${SAS_RUN}@example.com`,      // users_roles {eis} → the OTHER host (negative control)
  ...Object.fromEntries(['c0', 'c1', 'c2', 'c3', 'c4', 'c5'].map((k) => [k, `client${k.slice(1)}+${SAS_RUN}@example.com`])),
};
const SAS_ROUTES = [{ route: '/specialistappointmentstudio', label: 'Specialist Appointment Studio' }];
// Every collection the studio world writes (teardownStudio sweeps these by testrunid == SAS_RUN).
const SAS_SEEDED = [
  'appointmenttype', 'eisroles', 'Roles-To-EIS', 'AppointmentType-To-Roles', 'products',
  'appointments', 'availability', 'participant metadata',
  'user_data', 'profile_data', 'users_roles', 'dashboard',
];

/** Local time `dayOffset` days from THIS week's Monday 00:00 (sas-logic mondayOf), at h:m. */
function sasAt(T, dayOffset, h, m = 0) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + dayOffset);
  d.setHours(h, m, 0, 0);
  return T.fromDate(d);
}

async function seedStudio(db, auth, T) {
  const tag = TAG(SAS_RUN);
  const profileRef = (pf) => db.collection('profile_data').doc(pf);
  const typeRef = (id) => db.collection('appointmenttype').doc(id);
  const roleRef = (id) => db.collection('eisroles').doc(id);

  // 1) Auth chain: same shape as seed.seedAuthChain (login needs profile_data by email + number + role_ref;
  //    getRoles() resolves profile_data by user_ref → role_ref → users_roles flags, which pick the view).
  const flags = { ah: { ah: true }, cw: { eis: true }, cw2: { eis: true } };
  for (const k of SAS_KEYS) {
    const uid = `${SAS_RUN}_u_${k}`, email = SAS_EMAIL[k], staff = !!flags[k];
    await auth.createUser({ uid, email, password: 'Test!1234', displayName: email })
      .catch((e) => { if (e.code !== 'auth/uid-already-exists') throw e; });
    await auth.setCustomUserClaims(uid, { testrunid: SAS_RUN, role: staff ? (k === 'ah' ? 'ah' : 'eis') : 'participant' });
    const userDataRef = db.collection('user_data').doc(uid);
    const roleDocRef = db.collection('users_roles').doc(`${SAS_RUN}_role_${uid}`);
    await userDataRef.set({ name: email, email, number: '9999900000', ...tag });
    await roleDocRef.set({ id: roleDocRef.id, name: email, participant: !staff, profile_ref: profileRef(SAS_PF[k]), ...(flags[k] || {}), ...tag });
    await profileRef(SAS_PF[k]).set({
      docid: SAS_PF[k], profileid: SAS_PF[k], email: email.toLowerCase(), name: email,
      number: '9999900000', countrycode: '+91', user_ref: userDataRef, role_ref: roleDocRef, ...tag,
    });
    // Clients need a `participant metadata` doc (with `name`): the /appointmentstudio screen derefs
    // mapProfileMeta[bookedby.id] for every appointment it lists (see 4a above).
    if (!staff) await db.collection('participant metadata').doc(SAS_PF[k]).set({ docid: SAS_PF[k], profileid: SAS_PF[k], name: email, activejourney: null, ...tag });
  }
  await seedDashboardRoutes(db, SAS_RUN, SAS_ROUTES, { staffProfileIds: [SAS_PF.ah, SAS_PF.cw, SAS_PF.cw2], allRoles: ['ah', 'eis'] });

  // 2) Config. Settings (Delivery Type Details) renders these straight from appointmenttype: the spec
  //    asserts the APP's formatting of them (fmtHours, "Yes · up to 3", "Required"), never the raw fields.
  await typeRef(SAS_ID.AT).set({ docid: SAS_ID.AT, id: SAS_ID.AT, appointmenttype: 'SAS Studio Coaching', duration: 60, groupappointment: true, maxbooking: 3, ischangeworkrequired: true, ...tag });
  await typeRef(SAS_ID.AT2).set({ docid: SAS_ID.AT2, id: SAS_ID.AT2, appointmenttype: 'SAS Studio Review', duration: 45, groupappointment: false, ischangeworkrequired: false, ...tag });
  await roleRef(SAS_ID.R1).set({ docid: SAS_ID.R1, role: 'SAS Specialist', experiencestage: 'S1', experiencelevel: 'L1', ...tag });
  await db.collection('Roles-To-EIS').doc(SAS_ID.RTE1).set({ docid: SAS_ID.RTE1, assigned_role_ref: roleRef(SAS_ID.R1), assigned_eis: [profileRef(SAS_PF.cw), profileRef(SAS_PF.cw2)], ...tag });
  await db.collection('AppointmentType-To-Roles').doc(SAS_ID.ATR1).set({ docid: SAS_ID.ATR1, assigned_appttype_ref: typeRef(SAS_ID.AT), required_role: [roleRef(SAS_ID.R1)], additional_role: [], ...tag });
  await db.collection('AppointmentType-To-Roles').doc(SAS_ID.ATR2).set({ docid: SAS_ID.ATR2, assigned_appttype_ref: typeRef(SAS_ID.AT2), required_role: [roleRef(SAS_ID.R1)], additional_role: [], ...tag });
  await db.collection('products').doc(SAS_ID.PROD).set({ docid: SAS_ID.PROD, product: 'SAS Studio Product', mode: 'Event Mode', atcmodel: null, ...tag });

  // 3) Availability (last week + the cw2 control). Slot arrays are keyed by the type DOC id
  //    (service.parseWindow reads d[typeId]). The cancelled 10–11 slot is free again (cancel reopens it).
  const slot = (day, h1, m1, h2, m2, booked) => ({ slotstart: sasAt(T, day, h1, m1), slotend: sasAt(T, day, h2, m2), booked, available: !booked });
  const win = (id, pf, day, h1, h2, types) => ({ docid: id, id, profileref: profileRef(SAS_PF[pf]), starttime: sasAt(T, day, h1), endtime: sasAt(T, day, h2), appointments: Object.keys(types).map(typeRef), ...types, ...tag });
  await db.collection('availability').doc(SAS_ID.WL1).set(win(SAS_ID.WL1, 'cw', -5, 9, 13, {
    [SAS_ID.AT]: [slot(-5, 9, 0, 10, 0, true), slot(-5, 10, 0, 11, 0, false), slot(-5, 12, 0, 13, 0, false)],
    [SAS_ID.AT2]: [slot(-5, 11, 0, 11, 45, true)],
  }));
  await db.collection('availability').doc(SAS_ID.WL2).set(win(SAS_ID.WL2, 'cw', -4, 14, 16, {
    [SAS_ID.AT]: [slot(-4, 14, 0, 15, 0, false), slot(-4, 15, 0, 16, 0, false)],
  }));
  await db.collection('availability').doc(SAS_ID.WOT).set(win(SAS_ID.WOT, 'cw2', -5, 9, 17, {
    [SAS_ID.AT]: [slot(-5, 9, 0, 10, 0, true), slot(-5, 13, 0, 14, 0, true), slot(-5, 15, 0, 16, 0, false)],
  }));
  await seedStudioNextWeek(db, T);

  // 4) Appointments. hosts + hostRole (keyed by ROLE PATH) like every booking path writes; `created` is
  //    read by AppointmentDetailComponent's template and the roster stream; `cancelledon` by the detail
  //    template when cancelled. productid/slotdata keep the roster stream (APPT-07) from throwing.
  const appt = (id, host, client, typeId, day, h1, m1, h2, m2, state = {}) => ({
    docid: id,
    appointment: typeRef(typeId),
    appointmentrole: [roleRef(SAS_ID.R1)],
    hostRole: { [roleRef(SAS_ID.R1).path]: [profileRef(SAS_PF[host])] },
    hosts: [profileRef(SAS_PF[host])],
    bookedby: profileRef(SAS_PF[client]),
    starttime: sasAt(T, day, h1, m1), endtime: sasAt(T, day, h2, m2),
    cancelled: false, attended: false, cancelledon: null, cancelledreason: null,
    journeycoach: false, onboarding: false,
    // slotdata = [{availability doc id, index in that type's slot array}] — what booking writes and
    // guard.cancelAppointment() reads to reopen the slot. A_OLD has no window → [].
    productid: SAS_ID.PROD, created: sasAt(T, day - 7, 9), slotdata: [],
    ...state, ...tag,
  });
  const A = db.collection('appointments');
  await A.doc(SAS_ID.A_DONE).set(appt(SAS_ID.A_DONE, 'cw', 'c1', SAS_ID.AT, -5, 9, 0, 10, 0, { attended: true, slotdata: [{ id: SAS_ID.WL1, index: 0 }] }));
  await A.doc(SAS_ID.A_CANC).set(appt(SAS_ID.A_CANC, 'cw', 'c2', SAS_ID.AT, -5, 10, 0, 11, 0,
    { cancelled: true, cancelledon: sasAt(T, -5, 11, 5), cancelledreason: "Client didn't show up", slotdata: [{ id: SAS_ID.WL1, index: 1 }] }));
  await A.doc(SAS_ID.A_PEND).set(appt(SAS_ID.A_PEND, 'cw', 'c0', SAS_ID.AT2, -5, 11, 0, 11, 45, { slotdata: [{ id: SAS_ID.WL1, index: 0 }] }));
  await A.doc(SAS_ID.A_OLD).set(appt(SAS_ID.A_OLD, 'cw', 'c3', SAS_ID.AT, -12, 9, 0, 10, 30, { attended: true }));
  await A.doc(SAS_ID.A_UP).set(appt(SAS_ID.A_UP, 'cw', 'c4', SAS_ID.AT, 9, 9, 0, 10, 0, { slotdata: [{ id: SAS_ID.WN1, index: 0 }] }));
  await A.doc(SAS_ID.A_OTHER_DONE).set(appt(SAS_ID.A_OTHER_DONE, 'cw2', 'c5', SAS_ID.AT, -5, 9, 0, 10, 0, { attended: true, slotdata: [{ id: SAS_ID.WOT, index: 0 }] }));
  await A.doc(SAS_ID.A_OTHER_PEND).set(appt(SAS_ID.A_OTHER_PEND, 'cw2', 'c5', SAS_ID.AT, -5, 13, 0, 14, 0, { slotdata: [{ id: SAS_ID.WOT, index: 1 }] }));
}

/** Next week's two cw windows: WN1 holds A_UP's booked slot (delete must be REFUSED), WN2 is free (delete
 *  must SUCCEED). Also the precondition reset SAS-08 runs first (its delete removes WN2). PRECONDITION only. */
async function seedStudioNextWeek(db, T) {
  const tag = TAG(SAS_RUN);
  const pref = db.collection('profile_data').doc(SAS_PF.cw);
  const at = db.collection('appointmenttype').doc(SAS_ID.AT);
  const slot = (day, h1, h2, booked) => ({ slotstart: sasAt(T, day, h1), slotend: sasAt(T, day, h2), booked, available: !booked });
  await db.collection('availability').doc(SAS_ID.WN1).set({
    docid: SAS_ID.WN1, id: SAS_ID.WN1, profileref: pref, starttime: sasAt(T, 9, 9), endtime: sasAt(T, 9, 12), appointments: [at],
    [SAS_ID.AT]: [slot(9, 9, 10, true), slot(9, 10, 11, false), slot(9, 11, 12, false)], ...tag,
  });
  await db.collection('availability').doc(SAS_ID.WN2).set({
    docid: SAS_ID.WN2, id: SAS_ID.WN2, profileref: pref, starttime: sasAt(T, 10, 14), endtime: sasAt(T, 10, 15), appointments: [at],
    [SAS_ID.AT]: [slot(10, 14, 15, false)], ...tag,
  });
}

async function resetStudioWindows() {
  const admin = initAdminAuto();
  await seedStudioNextWeek(admin.firestore(), admin.firestore.Timestamp);
}

async function teardownStudio(admin) {
  const n = await seed.teardownCollections(admin.firestore(), SAS_SEEDED, SAS_RUN);
  for (const k of SAS_KEYS) await admin.auth().deleteUser(`${SAS_RUN}_u_${k}`).catch(() => {});
  return n;
}

/** Seed (or reset) the p1 booking subject: participantsproduct(ongoing) + participantdeliverysequence
 *  with a single AT1 delivery item (status "ready") + its deliverable (status "ready", empty fileref).
 *  PRECONDITION only — APPT-02 asserts the values the APP writes on commit, never these. */
async function seedBookingSubject(db, T, { productRef, apptTypeRef }) {
  await db.collection('participantsproduct').doc(ID.PP2).set(
    { docid: ID.PP2, profileid: PF.p1, productref: productRef(ID.P1), status: 'initiated', ...TAG(TESTRUNID) }, { merge: false },
  );
  await db.collection('participantdeliverysequence').doc(PF.p1).set({
    docid: PF.p1, profileid: PF.p1,
    products: [{ participantproductid: ID.PP2, productref: productRef(ID.P1), delivery: [
      { type: 'appointment', status: 'ready', sequenceref: db.collection('deliverables').doc(ID.DB) },
    ] }], ...TAG(TESTRUNID),
  }, { merge: false });
  await db.collection('deliverables').doc(ID.DB).set(
    { docid: ID.DB, profileid: PF.p1, participantproductid: ID.PP2, type: 'appointment', status: 'ready', deliveryref: apptTypeRef(ID.AT1), fileref: [], ...TAG(TESTRUNID) }, { merge: false },
  );
}

/** Seed (or reset) the +2-day eis1 booking slot to FREE. PRECONDITION only. */
async function seedBookingSlot(db, T, profileRef, apptTypeRef) {
  const at = (dayOffset, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return T.fromDate(d); };
  await db.collection('availability').doc(ID.AVBOOK).set({
    docid: ID.AVBOOK, profileref: profileRef(PF.eis1),
    starttime: at(2, 9), endtime: at(2, 17),
    appointments: [apptTypeRef(ID.AT1)],
    [ID.AT1]: [{ slotstart: at(2, 10), slotend: at(2, 11), booked: false, available: true }],
    ...TAG(TESTRUNID),
  }, { merge: false });
}

// Collections this seed writes (for teardown).
const SEEDED = [
  'appointmenttype', 'eisroles', 'Roles-To-EIS', 'AppointmentType-To-Roles', 'products',
  'productToDeliverySequence', 'participantsproduct', 'participantdeliverysequence', 'deliverables',
  'appointments', 'availability', 'offtime', 'EISzoomcontact', 'customer_eismapping', 'deliverytime',
  'participant metadata',
  // auth-chain + dashboard (shared shape; testrunid-scoped so queue 'run1' is untouched)
  'user_data', 'profile_data', 'users_roles', 'dashboard',
];

async function teardownAppointments() {
  const admin = initAdminAuto();
  const db = admin.firestore();
  const n = await seed.teardownCollections(db, SEEDED, TESTRUNID);
  // Also delete the Auth users (emails carry the run id).
  const auth = admin.auth();
  for (const key of Object.keys(PF)) {
    await auth.deleteUser(`${TESTRUNID}_u_${key}`).catch(() => {});
  }
  // The studio world carries its own tag (SAS_RUN) — swept separately.
  return n + await teardownStudio(admin);
}

/** Re-runnable precondition resets for the booking write-mutation cases (APPT-02/03). Restores the p1
 *  subject (product/sequence/deliverable → "ready", empty fileref) AND the +2d eis1 slot → FREE, so the
 *  booking can be performed again. Anti-circular: these are SETUP writes; the test asserts only the
 *  values the APP writes on commit. */
async function resetBookingSubject() {
  const admin = initAdminAuto();
  const db = admin.firestore();
  const T = admin.firestore.Timestamp;
  const productRef = (id) => db.collection('products').doc(id);
  const apptTypeRef = (id) => db.collection('appointmenttype').doc(id);
  await seedBookingSubject(db, T, { productRef, apptTypeRef });
  await seedBookingSlot(db, T, (pf) => db.collection('profile_data').doc(pf), apptTypeRef);
  // Clear ONLY the app-created bookings a prior run made for p1 (no testrunid). Keyed by bookedby+AT1,
  // but EXCLUDING the seeded fixtures that share that key (AP2 is bookedby p1 + AT1 → must survive for
  // the APPT-06 cancel case). App-written docs carry no testrunid, so exclude anything tagged 'appt'.
  const seededIds = new Set([ID.AP1, ID.AP2, ID.APSTUDIO, ID.APROSTER, ID.APFUTURE]);
  const snap = await db.collection('appointments')
    .where('bookedby', '==', db.collection('profile_data').doc(PF.p1))
    .where('appointment', '==', apptTypeRef(ID.AT1)).get();
  for (const d of snap.docs) {
    if (seededIds.has(d.id) || d.data().testrunid === TESTRUNID) continue;
    await d.ref.delete().catch(() => {});
  }
  // Also clear any AT2R booking a prior APPT-18 run created for p1 + the on-the-fly DB2R deliverable.
  const snap2 = await db.collection('appointments')
    .where('bookedby', '==', db.collection('profile_data').doc(PF.p1))
    .where('appointment', '==', apptTypeRef(ID.AT2R)).get();
  for (const d of snap2.docs) { if (d.data().testrunid !== TESTRUNID) await d.ref.delete().catch(() => {}); }
}

module.exports = {
  TESTRUNID, ID, PF, EMAIL, ROUTES, SEEDED, seedAppointments, teardownAppointments, resetBookingSubject,
  SAS_RUN, SAS_ID, SAS_PF, SAS_EMAIL, SAS_SEEDED, seedStudio, resetStudioWindows,
};

if (require.main === module) {
  const mode = process.argv[2];
  (async () => {
    if (mode === '--seed') { const r = await seedAppointments(); console.log('[seed-appointments] seeded', JSON.stringify(r.counts), 'run=', r.TESTRUNID); }
    else if (mode === '--teardown') { const n = await teardownAppointments(); console.log('[seed-appointments] torn down', n, 'docs for run', TESTRUNID); }
    else { console.log('usage: seed-appointments.js --seed | --teardown'); process.exit(1); }
    process.exit(0);
  })().catch((e) => { console.error('FAILED:', e.message || e); process.exit(1); });
}
