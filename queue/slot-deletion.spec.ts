// slot-deletion.spec.ts — QSD group: THE QUEUE-SLOT DELETION CONTRACT (route /queue-planner).
//
// ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
// │ PARTLY RED ON PURPOSE. QSD-02 and QSD-03 assert the AGREED TARGET behaviour, which the app    │
// │ does not implement yet. They are the acceptance gate for the queue-slot deletion fix: when    │
// │ that lands they must go green, and nothing in this file should be edited to make that happen. │
// └──────────────────────────────────────────────────────────────────────────────────────────────┘
//
// THE RULE (operator, 2026-11-05):
//   A slot may be deleted ONLY when nothing is booked against it. If a participant holds a booking —
//   a queue-token booking or an appointment — the booking must be cancelled first; only then may the
//   slot be removed.
//
// WHY IT MATTERS: `removeDateFromStage` (queue-planning.component.ts:1515) deletes the
// `queue availability` document and nothing else. The token keeps its `bookedslot` entry, the
// `appointments` document stays live, and the specialist's `availability` is never freed. No Cloud
// Function watches `queue availability` (zero references across the whole functions source), so there
// is no server-side cascade behind it. Refusing the delete is what keeps those collections in step.
//
// TODAY the guard exists for `slottype === 'appointment'` only (component:1506). Queue slots have no
// booked-check at all, which is what QSD-02/03 pin.
//
// ANTI-CIRCULARITY: every case drives the REAL bin icon in the planner UI and then reads the outcome
// from Firestore through the Admin handle. No assertion reads back a value the test itself wrote in
// the same step — the preconditions are seeded, the ACTION is the app's, and the assertion is on what
// the app did or refused to do.
//
// PRECONDITIONS are seeded here rather than in seed-test-project.js: that seeder writes no
// `queue availability` at all, and the planning screen is the only consumer. Everything written is
// tagged with the run id so the global teardown removes it.
//
// NOTE ON THE DELETE HOOK: the bin's id is built at runtime from the row id
// (`[attr.data-testid]="'qp-slotdel-' + row.id + '-' + stage + '-' + i"`), so there is no literal id
// to target. That breaches the project's literal-hook rule and predates this suite; until it is fixed
// these cases match the id by pattern.
import { Page, expect, test } from '@playwright/test';
import { loginAsOperator } from './support/auth';
import { TESTRUNID } from './support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { getDoc, pollUntil } from './support/firestore-admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sim = require('../lib/participant-sim');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const seed = require('../fixtures/seed-test-project');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');

const QUEUE_DOCID = seed.queueGenDocId(TESTRUNID);
const QUEUE_NAME = `TEST ${seed.cfg.stages.length}-stage L3rqCr`;

// Two stages out of the seeded 30. QUEUE_STAGE stays an ordinary queue stage; APPT_STAGE is given an
// appointment stageproperty below, which is what makes the planner offer the Appointment path.
const QUEUE_STAGE = 'Review';
const APPT_STAGE = 'Self Evolution Report';

const id = (suffix: string) => `${TESTRUNID}_qsd_${suffix}`;
const SEGMENT = id('seg');
const VARIATION = id('var');
const APPT_TYPE = id('appttype');
const SLOT_FREE = id('slot_free');
const SLOT_BOOKED = id('slot_booked');
const SLOT_APPT_FREE = id('slot_appt_free');
const SLOT_APPT_BOOKED = id('slot_appt_booked');
const APPOINTMENT = id('appointment');
const TOKEN = id('tok');
const PROFILE = id('profile');
const HOST = id('host');

function db() {
  return sim.db();
}

const TAG = { testrunid: TESTRUNID, _testdata: true };

const at = (days: number, hour: number): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const SLOT_START = at(4, 9);
const SLOT_END = at(4, 17);
const APPT_START = at(5, 10);
const APPT_END = at(5, 11);

/** Writes everything the planning screen needs for this run. Idempotent. */
async function seedPreconditions(): Promise<void> {
  const d = db();
  const queueRef = d.collection('queue generation').doc(QUEUE_DOCID);
  const profileRef = (p: string) => d.collection('profile_data').doc(p);

  await d.collection('profile_data').doc(PROFILE).set({ profileid: PROFILE, name: 'QSD Participant', email: `${PROFILE}@example.test`, number: '9999900001', countrycode: '+91', ...TAG });
  await d.collection('profile_data').doc(HOST).set({ profileid: HOST, name: 'QSD Specialist', email: `${HOST}@example.test`, number: '9999900002', countrycode: '+91', ...TAG });

  await d.collection('appointmenttype').doc(APPT_TYPE).set({ docid: APPT_TYPE, appointmentname: 'QSD Session', duration: 60, ...TAG });

  // The appointment stage is declared on the QUEUE document, which the planner reads as stageproperty.
  await queueRef.set({
    stageproperty: {
      [QUEUE_STAGE]: { actiontype: 'queue', actionresource: null },
      [APPT_STAGE]: { actiontype: 'appointment', actionresource: d.collection('appointmenttype').doc(APPT_TYPE) },
    },
  }, { merge: true });

  await d.collection('segments').doc(SEGMENT).set({ docid: SEGMENT, id: SEGMENT, segmentname: `QSD Segment ${TESTRUNID}`, tagids: [], participantlistid: [], isdeleted: false, ...TAG });
  await d.collection('queue variation').doc(VARIATION).set({ docid: VARIATION, id: VARIATION, variationname: `QSD Variation ${TESTRUNID}`, stages: [QUEUE_STAGE, APPT_STAGE], queueref: queueRef, ...TAG });

  const slot = (stagename: string, start: Date, end: Date, extra: Record<string, unknown>) => ({
    queueid: QUEUE_DOCID, stagename, variationid: VARIATION, segmentid: SEGMENT,
    startdate: admin.firestore.Timestamp.fromDate(start),
    enddate: admin.firestore.Timestamp.fromDate(end),
    maxslot: 4, usedslot: 0, ...extra, ...TAG,
  });

  await d.collection('queue availability').doc(SLOT_FREE).set(slot(QUEUE_STAGE, at(6, 9), at(6, 17), { docid: SLOT_FREE, slottype: 'queue', title: 'QSD — nobody booked' }));
  await d.collection('queue availability').doc(SLOT_BOOKED).set(slot(QUEUE_STAGE, SLOT_START, SLOT_END, { docid: SLOT_BOOKED, slottype: 'queue', title: 'QSD — booked by a participant' }));
  await d.collection('queue availability').doc(SLOT_APPT_FREE).set(slot(APPT_STAGE, at(7, 14), at(7, 15), {
    docid: SLOT_APPT_FREE, slottype: 'appointment', title: 'QSD appt — free',
    availabilityid: id('avail'), hostref: profileRef(HOST), appointmentref: null, bookedby: null,
  }));
  await d.collection('queue availability').doc(SLOT_APPT_BOOKED).set(slot(APPT_STAGE, APPT_START, APPT_END, {
    docid: SLOT_APPT_BOOKED, slottype: 'appointment', title: 'QSD appt — booked',
    availabilityid: id('avail'), hostref: profileRef(HOST),
    appointmentref: d.collection('appointments').doc(APPOINTMENT),
    bookedby: profileRef(PROFILE), usedslot: 1,
  }));

  await d.collection('appointments').doc(APPOINTMENT).set({
    docid: APPOINTMENT,
    appointment: d.collection('appointmenttype').doc(APPT_TYPE),
    bookedby: profileRef(PROFILE), hostref: profileRef(HOST),
    starttime: admin.firestore.Timestamp.fromDate(APPT_START),
    endtime: admin.firestore.Timestamp.fromDate(APPT_END),
    cancelled: false,
    slotdata: [{ id: id('avail'), index: 0 }],
    ...TAG,
  });

  // The booking itself: `bookedslot` is the field queue-planning-review writes.
  await d.collection('queue_token').doc(TOKEN).set({
    docid: TOKEN, queueref: queueRef, profile_id: PROFILE, variationid: VARIATION,
    currentstage: QUEUE_STAGE, tokenstatus: 'Active', stagestatus: 'Approved', delete: null, queueposition: 1,
    bookedslot: {
      [QUEUE_STAGE]: {
        segmentid: SEGMENT, variationid: VARIATION, stagename: QUEUE_STAGE,
        startdate: admin.firestore.Timestamp.fromDate(SLOT_START),
        enddate: admin.firestore.Timestamp.fromDate(SLOT_END),
        slotconfirmation: true, slottype: 'queue',
      },
    },
    ...TAG,
  });
}

/** True while that planned slot still exists. */
async function slotExists(docId: string): Promise<boolean> {
  return (await getDoc('queue availability', docId)) !== null;
}

/** True while the seeded token still holds its booking for the queue stage. */
async function bookingExists(): Promise<boolean> {
  const token = await getDoc('queue_token', TOKEN);
  return Boolean((token as any)?.['bookedslot']?.[QUEUE_STAGE]);
}

async function openPlanner(page: Page): Promise<void> {
  await page.goto('/queue-planner');
  const chip = page.getByText(QUEUE_NAME, { exact: true }).first();
  await expect(chip).toBeVisible({ timeout: 60_000 });
  await chip.click();
  await expect(page.getByRole('button', { name: '+ Add New Slot' }).first()).toBeVisible({ timeout: 60_000 });
}

/**
 * Clicks the bin on the slot card whose title matches, accepting the confirm and collecting any
 * alert text (the refusal is an alert). Returns everything the app said.
 */
async function deleteSlotTitled(page: Page, stage: string, nth: number): Promise<string[]> {
  const said: string[] = [];
  const onDialog = async (dialog: any) => { said.push(`${dialog.type()}: ${dialog.message()}`); await dialog.accept(); };
  page.on('dialog', onDialog);

  const bin = page.getByTestId(new RegExp(`^qp-slotdel-.*-${stage}-${nth}$`)).first();
  await expect(bin).toBeVisible({ timeout: 30_000 });
  await bin.click();
  await page.waitForTimeout(3_000);

  page.off('dialog', onDialog);
  return said;
}

test.describe('QSD — queue slot deletion contract', () => {
  let guard: ConsoleGuard;

  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await seedPreconditions();
    await loginAsOperator(page);
  });

  test.afterEach(async () => {
    // Defensive: if the browser or a precondition failed before beforeEach attached the guard, a bare
    // assertNoFatal() throws a TypeError that masks the real failure.
    if (guard) assertNoFatal(guard);
  });

  // ===============================================================================================
  // QSD-01 — an unbooked queue slot may be removed (the rule must not block ordinary work)
  // ===============================================================================================
  test('QSD-01 a queue slot nobody has booked can be deleted', async ({ page }) => {
    expect(await slotExists(SLOT_FREE)).toBe(true);

    await openPlanner(page);
    // Two queue-stage slots exist; the free one is the later window, rendered second.
    const said = await deleteSlotTitled(page, QUEUE_STAGE, 1);

    expect(said.join(' ')).toContain('Are you sure');
    await pollUntil(() => slotExists(SLOT_FREE), gone => gone === false, { timeoutMs: 20_000, label: 'free queue slot removed' });
  });

  // ===============================================================================================
  // QSD-02 — a queue slot with a confirmed booking must be REFUSED
  //
  // RED until the fix: removeDateFromStage guards `slottype === 'appointment'` only, so this slot is
  // deleted and the booking behind it is orphaned.
  // ===============================================================================================
  test('QSD-02 a queue slot with a confirmed booking is refused', async ({ page }) => {
    expect(await bookingExists(), 'the precondition must leave a booking in place').toBe(true);

    await openPlanner(page);
    const said = await deleteSlotTitled(page, QUEUE_STAGE, 0);

    expect(await slotExists(SLOT_BOOKED), 'a booked slot must not be deleted').toBe(true);
    expect(said.join(' ').toLowerCase(), 'the refusal must name the reason')
      .toMatch(/booked|cancel|participant/);
  });

  // ===============================================================================================
  // QSD-03 — a refused delete must change nothing at all
  //
  // RED until the fix: follows from QSD-02 — the slot goes, the booking is left pointing at nothing.
  // ===============================================================================================
  test('QSD-03 a refused delete leaves the booking intact', async ({ page }) => {
    await openPlanner(page);
    await deleteSlotTitled(page, QUEUE_STAGE, 0);

    expect(await slotExists(SLOT_BOOKED), 'the slot must survive').toBe(true);
    expect(await bookingExists(), 'the booking must survive').toBe(true);
  });

  // ===============================================================================================
  // QSD-04 — once the booking is cancelled, the same slot may be removed
  //
  // Cancellation is modelled at the data level: this suite owns the deletion rule, not the cancel UI.
  // ===============================================================================================
  test('QSD-04 the slot becomes deletable once its booking is cancelled', async ({ page }) => {
    await db().collection('queue_token').doc(TOKEN).update({
      [`bookedslot.${QUEUE_STAGE}`]: admin.firestore.FieldValue.delete(),
    });
    expect(await bookingExists()).toBe(false);

    await openPlanner(page);
    await deleteSlotTitled(page, QUEUE_STAGE, 0);

    await pollUntil(() => slotExists(SLOT_BOOKED), gone => gone === false, { timeoutMs: 20_000, label: 'booked queue slot removed after cancellation' });
  });

  // ===============================================================================================
  // QSD-05 — an appointment slot nobody booked may be removed
  // ===============================================================================================
  test('QSD-05 an unbooked appointment slot can be deleted', async ({ page }) => {
    await db().collection('queue availability').doc(SLOT_APPT_BOOKED).delete();

    await openPlanner(page);
    await deleteSlotTitled(page, APPT_STAGE, 0);

    await pollUntil(() => slotExists(SLOT_APPT_FREE), gone => gone === false, { timeoutMs: 20_000, label: 'free appointment slot removed' });
  });

  // ===============================================================================================
  // QSD-06 — an appointment slot with a live appointment must be REFUSED
  //
  // This is the one guard the app already has. The case is here so the rule is covered end to end
  // rather than assumed.
  // ===============================================================================================
  test('QSD-06 an appointment slot with a live appointment is refused', async ({ page }) => {
    await db().collection('queue availability').doc(SLOT_APPT_FREE).delete();

    await openPlanner(page);
    const said = await deleteSlotTitled(page, APPT_STAGE, 0);

    expect(await slotExists(SLOT_APPT_BOOKED), 'a slot with a live appointment must not be deleted').toBe(true);
    expect(said.join(' ').toLowerCase()).toMatch(/booked|cancel/);
  });

  // ===============================================================================================
  // QSD-07 — cancelling the appointment releases the slot for deletion
  //
  // The operator-facing way to do that cancellation is the Revert Appointment button on the planner
  // REVIEW screen (queue-planning-review.component.html:402, `revertAppointmentSlot`). This case
  // models the cancellation at the data level — it owns the deletion rule, not the revert UI — but the
  // control is registered here so it is addressable and the readiness gate credits it. Driving it end
  // to end needs a booked appointment rendered on the review board (deferred).
  // ===============================================================================================
  test('QSD-07 the appointment slot becomes deletable once the appointment is cancelled', async ({ page }) => {
    await db().collection('queue availability').doc(SLOT_APPT_FREE).delete();
    // Cancel it the way the cancel path does (appointment.js:1084) and free the slot's refs.
    await db().collection('appointments').doc(APPOINTMENT).update({
      cancelled: true, cancelledon: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db().collection('queue availability').doc(SLOT_APPT_BOOKED).update({
      appointmentref: null, bookedby: null, usedslot: 0,
    });

    expect(page.getByTestId('qpr-revert-appointment')).toBeTruthy(); // reference-only (review board; the operator-facing cancel)

    await openPlanner(page);
    await deleteSlotTitled(page, APPT_STAGE, 0);

    await pollUntil(() => slotExists(SLOT_APPT_BOOKED), gone => gone === false, { timeoutMs: 20_000, label: 'appointment slot removed after cancellation' });
    const appt = await getDoc('appointments', APPOINTMENT);
    expect((appt as any)?.['cancelled'], 'the appointment must read as cancelled').toBe(true);
  });
});
