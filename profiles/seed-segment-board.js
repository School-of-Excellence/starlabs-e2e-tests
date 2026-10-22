// @ts-nocheck
/**
 * seed-segment-board.js — seeder extension for /segmentboard (segment-board.spec.ts, SGB-*).
 *
 * App: starlabs-angular src/app/Participants Profile Management/segment-board/ (SegmentBoardComponent).
 * App journal: specs/journals/2026-09-25-segment-board-component.md (the WHY of every rule asserted here).
 *
 * Companion to seed-profiles.js, wired like seed-lists-segments-tags.js (require + call + SEEDED spread).
 * Every doc carries `testrunid` (swept by seed.teardownCollections) and a run-prefixed id or name.
 *
 * WHAT THE SCREEN READS (all unfiltered — the e2e project holds other runs' data too):
 *   participant metadata  orderBy('name')   → docs WITHOUT a `name` field are not returned (rule #2)
 *   journey / products / modes              → the dialog's pickers
 *   segmentboardconfig                      → one doc per segment (doc id = segment id)
 *   segmentboardlist                        → one doc per segment list { segmentname, segmentid, profilelist, lastupdated }
 * So the spec only ever asserts on RUN-NAMESPACED entities: participants named `SB … ${run}`, the run's
 * own journey, and segments whose names carry the run id. Global counts are never asserted.
 *
 * THE WORLD (all on the run's own journey SB_J unless noted):
 *   sb_a  "SB Alpha"    active      → MATCHES  "journey SB_J + customer status Active"
 *   sb_b  "SB Bravo"    active      → MATCHES  (the spec moves it into the manual segment)
 *   sb_c  "SB Charlie"  non active  → EXCLUDED by customer status (its journey still resolves via lastcompletedjourney)
 *   sb_d  "SB Delta"    active, on the profiles seed's journey J1 → EXCLUDED by journey
 *   sb_e  (no name)     active      → EXCLUDED from the whole board: no `name` field (orderBy('name'))
 *   SB_MANUAL           a manual segment config (active, empty) for the move / add cases
 * Each exclusion is a negative control: without it, "the list has 2 people" could not tell a rule that
 * ran from a world that only ever had 2 people in it.
 *
 * SPEC-CREATED DOCS: the spec creates the automated segment through the dialog (that is the behaviour under
 * test), so its config + list docs are written by the APP and carry no testrunid. cleanupSpecSegments()
 * deletes them by their run-unique names at seed start (a previous failed run) and at teardown.
 */
'use strict';

const TESTRUNID = process.env.PROF_RUNID || 'prof';

const SB_IDS = {
  J: `${TESTRUNID}_SB_J`,                 // the run's own journey (journey doc id)
  a: `${TESTRUNID}_sb_a`, b: `${TESTRUNID}_sb_b`, c: `${TESTRUNID}_sb_c`, d: `${TESTRUNID}_sb_d`, e: `${TESTRUNID}_sb_e`,
  MANUAL: `${TESTRUNID}_SB_MANUAL`,       // seeded manual segment (config doc id = segment id)
};
const SB_NAMES = {
  J: `SB Journey ${TESTRUNID}`,
  a: `SB Alpha ${TESTRUNID}`, b: `SB Bravo ${TESTRUNID}`, c: `SB Charlie ${TESTRUNID}`, d: `SB Delta ${TESTRUNID}`,
  MANUAL: `SB Manual ${TESTRUNID}`,
  AUTO: `SB Active ${TESTRUNID}`,         // created by the spec through the dialog
  // segment groups SGB-07 creates through the app (segmentboardgroups docs carry no testrunid)
  G_REF: `SB Group Ref ${TESTRUNID}`, G_OPS: `SB Group Ops ${TESTRUNID}`, G_OPS2: `SB Group Ops Renamed ${TESTRUNID}`,
};
const SB_EMAILS = {
  a: `sb-a+${TESTRUNID}@example.com`, b: `sb-b+${TESTRUNID}@example.com`, c: `sb-c+${TESTRUNID}@example.com`,
  d: `sb-d+${TESTRUNID}@example.com`, e: `sb-e+${TESTRUNID}@example.com`,
};
// The app gives new segments Firestore auto ids, so app-created segments are found by their run-unique name.

const SEEDED_SEGMENT_BOARD = ['segmentboardconfig', 'segmentboardlist'];

/** Delete the docs the APP wrote for this run's segments (no testrunid on them). */
async function cleanupSpecSegments(db) {
  const names = [SB_NAMES.AUTO, SB_NAMES.MANUAL];
  for (const name of names) {
    // recursiveDelete: the app writes each segment's change history to segmentboardconfig/{id}/segmenthistory
    for (const s of (await db.collection('segmentboardconfig').where('name', '==', name).get()).docs) await db.recursiveDelete(s.ref);
    for (const s of (await db.collection('segmentboardlist').where('segmentname', '==', name).get()).docs) await s.ref.delete();
  }
  await db.collection('segmentboardlist').doc(SB_IDS.MANUAL).delete().catch(() => {});
  await db.recursiveDelete(db.collection('segmentboardconfig').doc(SB_IDS.MANUAL)).catch(() => {});
  // SGB-07's groups (+ their grouphistory). The app only soft-deletes a group; the seeder removes it for real.
  for (const name of [SB_NAMES.G_REF, SB_NAMES.G_OPS, SB_NAMES.G_OPS2]) {
    for (const g of (await db.collection('segmentboardgroups').where('name', '==', name).get()).docs) await db.recursiveDelete(g.ref);
  }
}

async function seedSegmentBoard(db, tag, J1) {
  await cleanupSpecSegments(db);

  await db.collection('journey').doc(SB_IDS.J).set({ id: SB_IDS.J, docid: SB_IDS.J, journey: SB_NAMES.J, sequence: 99, ...tag });

  const meta = (key, extra) => db.collection('participant metadata').doc(SB_IDS[key]).set({
    docid: SB_IDS[key], profileid: SB_IDS[key], email: SB_EMAILS[key],
    financialstatus: 'regular', currentjourneyonboarded: true, participantmode: 'Exploration Mode',
    activeproduct: [], consumedproducts: [], unconsumedproducts: [],
    atccount: null, atcmodel: null, ...extra, ...tag,
  });
  await meta('a', { name: SB_NAMES.a, customerstatus: 'active', activejourney: SB_IDS.J });
  await meta('b', { name: SB_NAMES.b, customerstatus: 'active', activejourney: SB_IDS.J });
  await meta('c', { name: SB_NAMES.c, customerstatus: 'non active', activejourney: null, lastcompletedjourney: SB_IDS.J });
  await meta('d', { name: SB_NAMES.d, customerstatus: 'active', activejourney: J1 });
  await meta('e', { customerstatus: 'active', activejourney: SB_IDS.J });   // deliberately NO `name` field

  // the manual segment: config only; its list is written by the app when the spec moves / adds people
  await db.collection('segmentboardconfig').doc(SB_IDS.MANUAL).set({
    id: SB_IDS.MANUAL, name: SB_NAMES.MANUAL, mode: 'manual', status: 'active', journeys: [],
    eligibility: null, displayIndex: 0, createdBy: 'seed', ...tag,
  });
}

module.exports = { SB_IDS, SB_NAMES, SB_EMAILS, SEEDED_SEGMENT_BOARD, seedSegmentBoard, cleanupSpecSegments };
