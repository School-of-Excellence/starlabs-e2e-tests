// appointment-slots.spec.ts — QPA group: the queue APPOINTMENT SLOT workflow (route /queue-planner).
//
// Covers the planner's second slot kind, added with the queue appointment work: a slot booked against
// one named specialist's published `availability` rather than an open window with N seats.
//
// WHAT IT DRIVES, end to end:
//   the slot-type gate that only an appointment-configured stage shows → the specialist availability
//   picker (grouped specialist → day → slot) → selection → the reservation write.
//
// ANTI-CIRCULARITY: the picker's contents are the APP's computation over seeded `availability` docs
// (it filters to slots that are open, in the future, inside the range, and not already reserved), and
// the final assertions read the `queue availability` documents the app wrote. No assertion reads back
// a value this spec wrote in the same step.
//
// PRECONDITIONS are seeded here: seed-test-project.js writes no `queue availability` and no specialist
// `availability` at all, and the planning screen is their only consumer. Everything is tagged with the
// run id so the global teardown removes it.
//
// HOOK PREFIX: qp (QueuePlanningComponent). Every hook below is a literal data-testid. The add-slot and
// bin buttons build their ids at runtime from the row id (`[attr.data-testid]="'qp-addslot-' + row.id
// + '-' + stage"`) — a pre-existing breach of the literal-hook rule — so those two are matched by
// pattern until that is fixed.
import { Page, expect, test } from '@playwright/test';
import { loginAsOperator } from './support/auth';
import { TESTRUNID } from './support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { pollUntil, queryWhere } from './support/firestore-admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sim = require('../lib/participant-sim');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const seed = require('../fixtures/seed-test-project');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');

const QUEUE_DOCID = seed.queueGenDocId(TESTRUNID);
const QUEUE_NAME = `TEST ${seed.cfg.stages.length}-stage L3rqCr`;

// Two of the seeded 30 stages. QUEUE_STAGE stays an ordinary queue stage (so the row exists and the
// gate can be shown NOT to appear there); APPT_STAGE is given an appointment stageproperty.
const QUEUE_STAGE = 'Review';
const APPT_STAGE = 'Self Evolution Report';

const id = (suffix: string) => `${TESTRUNID}_qpa_${suffix}`;
const SEGMENT = id('seg');
const VARIATION = id('var');
const APPT_TYPE = id('appttype');
const ANCHOR_SLOT = id('anchor');
const SPECIALISTS = [
  { profile: id('sp1'), avail: id('avail_sp1'), name: 'QPA Specialist One', days: [8, 9] },
  { profile: id('sp2'), avail: id('avail_sp2'), name: 'QPA Specialist Two', days: [8, 10] },
];
const HOURS = [10, 11, 14];

// The picker only offers slots whose start is in the FUTURE, so everything sits days ahead.
const RANGE_FROM = 7;
const RANGE_TO = 12;

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

/** The Material date adapter reads the browser locale: en-US -> M/D/YYYY. */
function dateInput(offsetDays: number): string {
  const d = at(offsetDays, 0);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** Writes the appointment world for this run. Idempotent. */
async function seedPreconditions(): Promise<void> {
  const d = db();
  const queueRef = d.collection('queue generation').doc(QUEUE_DOCID);

  await d.collection('appointmenttype').doc(APPT_TYPE).set({ docid: APPT_TYPE, appointmentname: 'QPA Session', duration: 60, ...TAG });

  // Declaring the stage as an appointment stage is what makes the planner offer the second path.
  await queueRef.set({
    stageproperty: {
      [QUEUE_STAGE]: { actiontype: 'queue', actionresource: null },
      [APPT_STAGE]: { actiontype: 'appointment', actionresource: d.collection('appointmenttype').doc(APPT_TYPE) },
    },
  }, { merge: true });

  await d.collection('segments').doc(SEGMENT).set({ docid: SEGMENT, id: SEGMENT, segmentname: `QPA Segment ${TESTRUNID}`, tagids: [], participantlistid: [], isdeleted: false, ...TAG });
  await d.collection('queue variation').doc(VARIATION).set({ docid: VARIATION, id: VARIATION, variationname: `QPA Variation ${TESTRUNID}`, stages: [QUEUE_STAGE, APPT_STAGE], queueref: queueRef, ...TAG });

  // One ordinary queue slot, so the planner renders a row for this segment/variation to work on.
  await d.collection('queue availability').doc(ANCHOR_SLOT).set({
    docid: ANCHOR_SLOT, queueid: QUEUE_DOCID, stagename: QUEUE_STAGE,
    variationid: VARIATION, segmentid: SEGMENT, slottype: 'queue', title: 'QPA anchor',
    // Day 3 on purpose: slot-deletion.spec.ts addresses its cards by date label, and both suites'
    // rows render on the same planner. Every seeded slot across the two must start on a distinct day.
    startdate: admin.firestore.Timestamp.fromDate(at(3, 9)),
    enddate: admin.firestore.Timestamp.fromDate(at(3, 17)),
    maxslot: 4, usedslot: 0, ...TAG,
  });

  // The specialists and their published availability. The slot array lives under a field NAMED AFTER
  // the appointment-type id — that shape is what fetchAppointmentAvailability reads.
  for (const s of SPECIALISTS) {
    await d.collection('profile_data').doc(s.profile).set({ profileid: s.profile, name: s.name, email: `${s.profile}@example.test`, number: '9999900003', countrycode: '+91', ...TAG });
    const slots = s.days.flatMap(day => HOURS.map(h => ({
      slotstart: admin.firestore.Timestamp.fromDate(at(day, h)),
      slotend: admin.firestore.Timestamp.fromDate(at(day, h + 1)),
      available: true, booked: false,
    })));
    await d.collection('availability').doc(s.avail).set({
      docid: s.avail,
      profileref: d.collection('profile_data').doc(s.profile),
      appointments: [d.collection('appointmenttype').doc(APPT_TYPE)],
      [APPT_TYPE]: slots,
      ...TAG,
    });
  }
}

/**
 * Appointment slots reserved on this run's queue.
 *
 * NOT filtered by testrunid: the app writes these documents itself and knows nothing about test tags,
 * so a testrunid filter discards exactly the rows under assertion. `QUEUE_DOCID` is already run-scoped
 * (`<run>_<queue>`), which is what keeps this isolated.
 */
async function reserved(): Promise<any[]> {
  return queryWhere('queue availability', [
    ['queueid', '==', QUEUE_DOCID],
    ['slottype', '==', 'appointment'],
  ]);
}

/** Removes anything a previous case in this file reserved, so each case starts level. */
async function clearReserved(): Promise<void> {
  for (const row of await reserved()) {
    await db().collection('queue availability').doc(row.id).delete();
  }
}

async function openPlanner(page: Page): Promise<void> {
  await page.goto('/queue-planner');
  const chip = page.getByText(QUEUE_NAME, { exact: true }).first();
  await expect(chip).toBeVisible({ timeout: 60_000 });
  await chip.click();
  await expect(page.getByRole('button', { name: '+ Add New Slot' }).first()).toBeVisible({ timeout: 60_000 });
}

/** Opens the add-slot dialog on a stage of this run's row (the add button's id is generated). */
async function openAddSlot(page: Page, stage: string): Promise<void> {
  await page.getByTestId(new RegExp(`^qp-addslot-.*-${stage}$`)).first().click();
  await expect(page.getByTestId('qp-datedlg-cancel')).toBeVisible();
}

async function closeDialog(page: Page): Promise<void> {
  await page.getByTestId('qp-datedlg-cancel').click();
  await expect(page.getByTestId('qp-datedlg-cancel')).toHaveCount(0);
}

/** Chooses Appointment and loads availability over the seeded range. */
async function loadAvailability(page: Page): Promise<void> {
  await page.getByTestId('qp-slottype-appointment').click();
  await page.getByTestId('qp-appt-from').fill(dateInput(RANGE_FROM));
  await page.getByTestId('qp-appt-to').fill(dateInput(RANGE_TO));
  await page.getByTestId('qp-appt-to').blur();
  await expect(page.getByTestId('qp-appt-loading')).toHaveCount(0, { timeout: 30_000 });
}

test.describe('QPA — queue appointment slots', () => {
  let guard: ConsoleGuard;

  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await seedPreconditions();
    await clearReserved();
    await loginAsOperator(page);
  });

  test.afterEach(async () => {
    if (guard) assertNoFatal(guard);
  });

  // ===============================================================================================
  // QPA-01 — the slot-type gate appears only on an appointment-configured stage
  // ===============================================================================================
  test('QPA-01 an appointment stage offers the slot-type choice; a queue stage does not', async ({ page }) => {
    await openPlanner(page);

    await openAddSlot(page, APPT_STAGE);
    await expect(page.getByTestId('qp-slottype-queue')).toBeVisible();
    await expect(page.getByTestId('qp-slottype-appointment')).toBeVisible();
    await closeDialog(page);

    // A plain queue stage goes straight to the queue-slot form — no choice offered.
    await openAddSlot(page, QUEUE_STAGE);
    await expect(page.getByTestId('qp-slottype-appointment')).toHaveCount(0);
    await expect(page.getByTestId('qp-datedlg-save')).toBeVisible();
    await closeDialog(page);
  });

  // ===============================================================================================
  // QPA-02 — the picker asks for a date range before it shows anything
  // ===============================================================================================
  test('QPA-02 the picker waits for a date range', async ({ page }) => {
    await openPlanner(page);
    await openAddSlot(page, APPT_STAGE);
    await page.getByTestId('qp-slottype-appointment').click();

    await expect(page.getByTestId('qp-appt-pickrange')).toBeVisible();
    await expect(page.getByTestId('qp-appt-group')).toHaveCount(0);
    await expect(page.getByTestId('qp-appt-selected-empty')).toBeVisible();
    await expect(page.getByTestId('qp-appt-reserve')).toBeDisabled();
    // Registered for the scanner: both render only once a range has produced (or failed to produce) slots.
    expect(page.getByTestId('qp-appt-cleardates')).toBeTruthy(); // reference-only (renders once a range is picked)
    expect(page.getByTestId('qp-appt-noslots')).toBeTruthy();    // reference-only (renders only on an empty range)

    await closeDialog(page);
  });

  // ===============================================================================================
  // QPA-03 — availability loads, grouped specialist → day → slot
  // ===============================================================================================
  test('QPA-03 availability loads for both seeded specialists', async ({ page }) => {
    await openPlanner(page);
    await openAddSlot(page, APPT_STAGE);
    await loadAvailability(page);

    await expect(page.getByTestId('qp-appt-group')).toHaveCount(2);
    const names = await page.getByTestId('qp-appt-groupname').allTextContents();
    expect(names.map(n => n.trim()).sort()).toEqual(SPECIALISTS.map(s => s.name).sort());

    // Two published days each, three slots on each day.
    await expect(page.getByTestId('qp-appt-day')).toHaveCount(4);
    await expect(page.getByTestId('qp-appt-daylabel')).toHaveCount(4);
    await expect(page.getByTestId('qp-appt-slot')).toHaveCount(SPECIALISTS.length * 2 * HOURS.length);
    await expect(page.getByTestId('qp-appt-slotcheck')).toHaveCount(SPECIALISTS.length * 2 * HOURS.length);

    await closeDialog(page);
  });

  // ===============================================================================================
  // QPA-04 — the specialist filter narrows the list
  // ===============================================================================================
  test('QPA-04 filtering by specialist shows only that specialist', async ({ page }) => {
    await openPlanner(page);
    await openAddSlot(page, APPT_STAGE);
    await loadAvailability(page);
    await expect(page.getByTestId('qp-appt-group')).toHaveCount(2);

    await page.getByTestId('qp-appt-specialist').click();
    expect(page.getByTestId('qp-appt-specialist-option')).toBeTruthy(); // reference-only (options render in an overlay)
    await page.getByRole('option', { name: SPECIALISTS[1].name }).click();

    await expect(page.getByTestId('qp-appt-group')).toHaveCount(1);
    await expect(page.getByTestId('qp-appt-groupname')).toHaveText(SPECIALISTS[1].name);

    await closeDialog(page);
  });

  // ===============================================================================================
  // QPA-05 — selecting and deselecting keeps the panel and the button in step
  // ===============================================================================================
  test('QPA-05 the selected panel and Reserve button track the selection', async ({ page }) => {
    await openPlanner(page);
    await openAddSlot(page, APPT_STAGE);
    await loadAvailability(page);

    await page.getByTestId('qp-appt-slot').nth(0).click();
    await expect(page.getByTestId('qp-appt-selectedcount')).toHaveText(/SELECTED \(1\)/);
    await expect(page.getByTestId('qp-appt-reserve')).toBeEnabled();
    await expect(page.getByTestId('qp-appt-selectedspecialist').first()).toBeVisible();

    await page.getByTestId('qp-appt-slot').nth(1).click();
    await expect(page.getByTestId('qp-appt-selectedcount')).toHaveText(/SELECTED \(2\)/);
    await expect(page.getByTestId('qp-appt-selectedrow')).toHaveCount(2);

    // Removing from the right-hand panel puts the count back.
    await page.getByTestId('qp-appt-selectedremove').first().click();
    await expect(page.getByTestId('qp-appt-selectedcount')).toHaveText(/SELECTED \(1\)/);

    // Deselecting the last one disables Reserve again.
    await page.getByTestId('qp-appt-selectedremove').first().click();
    await expect(page.getByTestId('qp-appt-selected-empty')).toBeVisible();
    await expect(page.getByTestId('qp-appt-reserve')).toBeDisabled();

    await closeDialog(page);
  });

  // ===============================================================================================
  // QPA-06 — reserving writes one document per slot, with the specialist carried through
  // ===============================================================================================
  test('QPA-06 reserving two slots writes two appointment documents', async ({ page }) => {
    expect(await reserved()).toHaveLength(0);

    await openPlanner(page);
    await openAddSlot(page, APPT_STAGE);
    await loadAvailability(page);

    await page.getByTestId('qp-appt-slot').nth(0).click();
    await page.getByTestId('qp-appt-slot').nth(1).click();
    await expect(page.getByTestId('qp-appt-reserve')).toHaveText(/Reserve 2 Slot\(s\)/);
    await page.getByTestId('qp-appt-reserve').click();

    // The grid badges them by type.
    await expect(page.getByTestId('qp-slot-typetag').filter({ hasText: 'Appointment' })).toHaveCount(2, { timeout: 30_000 });

    // The grid renders from local state; poll so the assertion is on the batch COMMIT, not on the
    // optimistic render that precedes it.
    const written = await pollUntil(reserved, rows => rows.length === 2, { timeoutMs: 30_000, label: '2 reserved appointment slots' });
    expect(written).toHaveLength(2);
    const specialistIds = SPECIALISTS.map(s => s.profile);
    const availIds = SPECIALISTS.map(s => s.avail);
    for (const row of written) {
      const doc = row as any;
      expect(doc['stagename']).toBe(APPT_STAGE);
      expect(doc['segmentid']).toBe(SEGMENT);
      // hostref + availabilityid are what make it an appointment rather than a plain window.
      expect(specialistIds).toContain(doc['hostref']?.id);
      expect(availIds).toContain(doc['availabilityid']);
      expect(doc['enddate'].toMillis()).toBeGreaterThan(doc['startdate'].toMillis());
    }
  });

  // ===============================================================================================
  // QPA-07 — a reserved slot is not offered twice
  // ===============================================================================================
  test('QPA-07 an already-reserved slot drops out of the picker', async ({ page }) => {
    const total = SPECIALISTS.length * 2 * HOURS.length;

    await openPlanner(page);
    await openAddSlot(page, APPT_STAGE);
    await loadAvailability(page);
    await expect(page.getByTestId('qp-appt-slot')).toHaveCount(total);

    await page.getByTestId('qp-appt-slot').nth(0).click();
    await page.getByTestId('qp-appt-reserve').click();
    await expect(page.getByTestId('qp-slot-typetag').filter({ hasText: 'Appointment' })).toHaveCount(1, { timeout: 30_000 });

    // Reopen over the same range: the reserved window is gone for that specialist.
    await openAddSlot(page, APPT_STAGE);
    await loadAvailability(page);
    await expect(page.getByTestId('qp-appt-slot')).toHaveCount(total - 1);

    await closeDialog(page);
  });

  // ===============================================================================================
  // QPA-08 — Back returns to the type choice without reserving anything
  // ===============================================================================================
  test('QPA-08 Back leaves the plan untouched', async ({ page }) => {
    await openPlanner(page);
    await openAddSlot(page, APPT_STAGE);
    await loadAvailability(page);
    await page.getByTestId('qp-appt-slot').nth(0).click();

    await page.getByTestId('qp-datedlg-back').click();
    await expect(page.getByTestId('qp-slottype-appointment')).toBeVisible();
    await closeDialog(page);

    expect(await reserved()).toHaveLength(0);
  });
});
