/**
 * seed-lists-segments-tags.js — seeder extension for the UNTESTED profiles dialogs:
 * manage-participantlist-dialog (merge / de-merge), create-segments-dialog, tag-participants /
 * add-queue-tag, and the profile-summary issue + userprofile AEL cases.
 *
 * Companion to seed-profiles.js. Kept in its own module so the working seeder is untouched: wire it
 * with three lines (see WIRING at the bottom). Same contract as seed-profiles.js — every doc carries
 * `testrunid` so `seed.teardownCollections` sweeps it, and every doc id is run-prefixed.
 *
 * ============================================================================================
 * READ THIS BEFORE EDITING — the four field-name traps these screens set for a seeder.
 * ============================================================================================
 *
 * 1) `participant list` READS different field names than it WRITES.
 *    loadParticipantLists (manage-participantlist-dialog.component.ts:625-645) maps:
 *        doc.listname      -> model.name          (NOT `name`)
 *        doc.profilelist[] -> model.profileids    (NOT `profileids`)
 *        doc.segmentid[]   -> model.segmentid
 *        doc.live ?? false -> model.live
 *    A seed written as { name, profileids } renders a list whose name is undefined and whose
 *    membership is empty — and every merge case then silently passes for the wrong reason.
 *
 * 2) `participant tags` is read with orderBy('created','desc') (tag-participants:115).
 *    Firestore OMITS documents that lack the orderBy field. A tag seeded without `created` does not
 *    just sort oddly — it never appears in the dialog at all.
 *
 * 3) "Live" is not a flag on the segment. getMergeConflicts (:1548) derives it through three hops:
 *        queue generation  (queuestartdate <= now <= queueenddate)   -> queueId == the DOC ID
 *        queue planning    (where queueid == queueId)                -> planning[].segments[].segmentid
 *        segments/{id}     -> participantlistid[]
 *    ...plus, separately, ANY `participant list` with live === true. Both paths must be seeded to
 *    cover the rule; seeding only `live: true` skips the entire queue chain the app really walks.
 *
 * 4) Both reads are UNFILTERED. loadParticipantLists does getDocs(query(listsRef)) and
 *    getMergeConflicts does getDocs(collection(...,'queue generation')) with no testrunid clause.
 *    Every list and every queue in the project participates.
 *
 *    BUT the RESULT is still isolated, and this is the load-bearing fact for the whole suite:
 *    a conflict is only recorded when a live list's profilelist[] CONTAINS one of the profile ids
 *    being merged (:1612 `if (existingProfiles.includes(rawId))`). Our profile ids are run-prefixed,
 *    so no foreign list — queue suite, earlier run, anything — can contain `${TESTRUNID}_p0`.
 *    Foreign live queues inflate liveListMeta and cost a few reads; they contribute ZERO conflicts.
 *
 *    The rule that follows: assert on RUN-NAMESPACED ENTITIES, never on global counts. "p0 conflicts
 *    with List B" is isolated. "the dialog shows 4 lists" is not, and will break the first time
 *    another suite seeds a list.
 */

const T_ = () => require('firebase-admin').firestore.Timestamp;

const TESTRUNID = process.env.PROF_RUNID || 'prof';

// ---- deterministic doc ids (run-prefixed, same convention as seed-profiles.js ID) ---------------
const LIST_IDS = {
  // participant lists
  LIST_A: `${TESTRUNID}_LIST_A`,   // MERGE TARGET — starts empty, not live
  LIST_B: `${TESTRUNID}_LIST_B`,   // CONFLICT SOURCE — live via the queue->planning->segment chain
  LIST_C: `${TESTRUNID}_LIST_C`,   // CONTROL — referenced only by an EXPIRED queue, must never conflict
  LIST_D: `${TESTRUNID}_LIST_D`,   // CONTROL — live via the `live: true` flag path (no queue chain)
  // segments
  SEG_LIVE: `${TESTRUNID}_SEG_LIVE`,   // referenced by the live queue's planning -> makes LIST_B live
  SEG_PAST: `${TESTRUNID}_SEG_PAST`,   // referenced only by the EXPIRED queue -> LIST_C stays inert
  // queue chain
  QG_LIVE: `${TESTRUNID}_QG_LIVE`,     // queuestartdate <= now <= queueenddate
  QG_PAST: `${TESTRUNID}_QG_PAST`,     // ended yesterday — the negative case
  QP_LIVE: `${TESTRUNID}_QP_LIVE`,
  QP_PAST: `${TESTRUNID}_QP_PAST`,
  // tags
  TAG_ACTIVE:  `${TESTRUNID}_TAG_ACTIVE`,   // isActive true  — bulk assign/remove/replace source
  TAG_TARGET:  `${TESTRUNID}_TAG_TARGET`,   // isActive true  — bulk REPLACE destination
  TAG_DELETED: `${TESTRUNID}_TAG_DELETED`,  // isActive false — the addTag RESURRECTION case (PA-40)
  // misc
  ICX0: `${TESTRUNID}_ICX0`,   // interim crossover row for the AEL edit dialog (PA-26)
};

// Collections this module writes — append to seed-profiles.js SEEDED so teardown sweeps them.
const SEEDED_LISTS = [
  'participant list', 'participant_list_log', 'segments',
  'participant tags', 'participant tag logs',
  // queue collections are only written when queueChain:true — harmless to sweep either way
  'queue generation', 'queue planning',
  'interim crossover',
  // NOTE: 'clientissue' is deliberately NOT seeded by default — see seedClientIssue() below.
];

/**
 * @param db    admin.firestore() — the DEFAULT database (none of this lives in a named DB)
 * @param tag   the { testrunid } spread used by seed-profiles.js (TAG(TESTRUNID))
 * @param PF    the profile-id map from seed-profiles.js ({ p0, p1, ... })
 * @param opts.queueChain  default FALSE. When false, LIST_B is made live by the `live: true` flag
 *        and NO `queue generation` / `queue planning` document is written at all.
 *
 * WHY THE DEFAULT IS FALSE — the one real cross-suite risk in this seeder.
 * `queue generation` and `queue planning` are the QUEUE suite's collections. getMergeConflicts
 * offers two INDEPENDENT ways for a list to be live (:1548-1602): the three-hop queue chain, and a
 * plain `live === true` on the list. Both reach the same conflict logic, so the exclusivity rule —
 * which is what PA-33/34/35/36 are actually about — is fully covered by the flag alone, with zero
 * footprint in another system's data.
 *
 * Turn queueChain on ONLY for the one case that exists to prove the derivation itself (the
 * date-window negative: an EXPIRED queue must not make its segment's list live). Run that case
 * against a freshly-seeded emulator, because a `${TESTRUNID}_QG_LIVE` doc left behind by a crashed
 * run would be visible to the queue suite's own unfiltered reads.
 */
async function seedListsSegmentsTags(db, tag, PF, opts = {}) {
  const { queueChain = false } = opts;
  const Timestamp = T_();
  const now = Date.now();
  const ts = (msOffset) => Timestamp.fromDate(new Date(now + msOffset));
  const DAY = 24 * 60 * 60 * 1000;

  // ---------------------------------------------------------------------------------------------
  // 1) PARTICIPANT LISTS. Field names are the WRITE-side names the app reads back (trap 1 above).
  //    LIST_A is the merge target and starts EMPTY so PA-33's arrayUnion is unambiguous.
  //    LIST_B holds p0, and is made live through the queue chain — so merging p0 into A conflicts.
  //    p1 is in NO list, so merging p1 into A is the conflict-free path.
  // ---------------------------------------------------------------------------------------------
  await db.collection('participant list').doc(LIST_IDS.LIST_A).set({
    listname: `TEST List A ${TESTRUNID}`,
    profilelist: [],
    segmentid: [],
    live: false,
    createddate: ts(0), updateddate: ts(0),
    ...tag,
  });

  await db.collection('participant list').doc(LIST_IDS.LIST_B).set({
    listname: `TEST List B ${TESTRUNID}`,
    profilelist: [PF.p0],                     // <- the conflicting membership
    segmentid: queueChain ? [LIST_IDS.SEG_LIVE] : [],
    // live via the QUEUE CHAIN when queueChain is on; via the flag otherwise. Same conflict logic.
    live: !queueChain,
    createddate: ts(0), updateddate: ts(0),
    ...tag,
  });

  await db.collection('participant list').doc(LIST_IDS.LIST_C).set({
    listname: `TEST List C ${TESTRUNID}`,
    profilelist: [PF.p1],
    segmentid: [LIST_IDS.SEG_PAST],           // only reachable through the EXPIRED queue
    live: false,
    createddate: ts(0), updateddate: ts(0),
    ...tag,
  });

  // The OTHER live path: a list flagged live directly, with no queue/segment involvement at all
  // (getMergeConflicts:1600 — `list.live === true` is added to liveListMeta independently).
  await db.collection('participant list').doc(LIST_IDS.LIST_D).set({
    listname: `TEST List D ${TESTRUNID}`,
    profilelist: [],
    segmentid: [],
    live: true,
    createddate: ts(0), updateddate: ts(0),
    ...tag,
  });

  // ---------------------------------------------------------------------------------------------
  // 2) SEGMENTS. `segmentname` (not `name`); participantlistid[] is the link back to the lists.
  // ---------------------------------------------------------------------------------------------
  await db.collection('segments').doc(LIST_IDS.SEG_LIVE).set({
    docid: LIST_IDS.SEG_LIVE,
    segmentname: `TEST Segment Live ${TESTRUNID}`,
    participantlistid: [LIST_IDS.LIST_B],
    tagids: [LIST_IDS.TAG_ACTIVE],
    createddate: ts(0),
    ...tag,
  });

  await db.collection('segments').doc(LIST_IDS.SEG_PAST).set({
    docid: LIST_IDS.SEG_PAST,
    segmentname: `TEST Segment Past ${TESTRUNID}`,
    participantlistid: [LIST_IDS.LIST_C],
    tagids: [],
    createddate: ts(-30 * DAY),
    ...tag,
  });

  // ---------------------------------------------------------------------------------------------
  // 3) THE QUEUE CHAIN — the part that actually decides "live" (trap 3).
  //    queueid on `queue planning` is the queue-generation DOC ID as a STRING (getMergeConflicts
  //    uses `d.id`), matching the queue-suite convention.
  //    QG_LIVE brackets now, so SEG_LIVE -> LIST_B is live.
  //    QG_PAST ended yesterday, so SEG_PAST -> LIST_C must NOT be live. That negative is the case
  //    that proves the date window is honoured rather than the chain merely being walked.
  // ---------------------------------------------------------------------------------------------
  if (queueChain) {
    await db.collection('queue generation').doc(LIST_IDS.QG_LIVE).set({
      docid: LIST_IDS.QG_LIVE,
      queuestartdate: ts(-1 * DAY),
      queueenddate:   ts(+7 * DAY),
      ...tag,
    });
    await db.collection('queue generation').doc(LIST_IDS.QG_PAST).set({
      docid: LIST_IDS.QG_PAST,
      queuestartdate: ts(-30 * DAY),
      queueenddate:   ts(-1 * DAY),          // ended — outside the window
      ...tag,
    });

    await db.collection('queue planning').doc(LIST_IDS.QP_LIVE).set({
      docid: LIST_IDS.QP_LIVE,
      queueid: LIST_IDS.QG_LIVE,             // string doc-id, not a DocumentReference
      planning: [
        { variation: 'A', segments: [{ segmentid: LIST_IDS.SEG_LIVE }] },
      ],
      ...tag,
    });
    await db.collection('queue planning').doc(LIST_IDS.QP_PAST).set({
      docid: LIST_IDS.QP_PAST,
      queueid: LIST_IDS.QG_PAST,
      planning: [
        { variation: 'A', segments: [{ segmentid: LIST_IDS.SEG_PAST }] },
      ],
      ...tag,
    });

    // ---------------------------------------------------------------------------------------------
  }

  // 4) PARTICIPANT TAGS. `created` is MANDATORY (trap 2) — loadTags orders by it and Firestore drops
  //    documents that lack the field. `isActive` drives the active/soft-deleted split; TAG_DELETED
  //    exists so PA-40 can prove addTag RESURRECTS a soft-deleted name instead of duplicating it.
  // ---------------------------------------------------------------------------------------------
  const mkTag = (id, name, isActive) =>
    db.collection('participant tags').doc(id).set({
      id, name, isActive,
      tagsfor: 'participant',
      created: ts(0),                      // <- omit this and the tag is invisible to the dialog
      segmentid: [],
      ...tag,
    });

  await mkTag(LIST_IDS.TAG_ACTIVE,  `TEST Tag Active ${TESTRUNID}`,  true);
  await mkTag(LIST_IDS.TAG_TARGET,  `TEST Tag Target ${TESTRUNID}`,  true);
  await mkTag(LIST_IDS.TAG_DELETED, `TEST Tag Deleted ${TESTRUNID}`, false);

  // ---------------------------------------------------------------------------------------------
  // 5) INTERIM CROSSOVER — the doc ael-edit-dialog.save() updates (PA-26). `metric` is replaced
  //    wholesale; the spec asserts the new metric AND that `edited` (serverTimestamp) appeared.
  //    Seed WITHOUT `edited` so its presence afterwards is unambiguous.
  // ---------------------------------------------------------------------------------------------
  await db.collection('interim crossover').doc(LIST_IDS.ICX0).set({
    docid: LIST_IDS.ICX0,
    profileid: PF.p0,
    metric: ['seeded-point-1'],
    createddate: ts(-7 * DAY),
    ...tag,
  });
}

/**
 * OPTIONAL and MUTUALLY EXCLUSIVE with PA-23's "first issue is 1001" case.
 *
 * addcustomersupportissue (profile-summary:386) seeds issueno at **1001 when `clientissue` is
 * EMPTY**, and max+1 otherwise. Those are two different assertions over the same collection, and a
 * seeder cannot satisfy both in one run:
 *
 *   • Leave clientissue unseeded  -> the next issue is 1001            (PA-23a)
 *   • Call this with 1500         -> the next issue is 1501            (PA-23b)
 *
 * Pick one per run, or run PA-23b in a separate PROF_RUNID. Do NOT seed it by default — the empty
 * case is the cheaper and more surprising of the two.
 *
 * Caveat: the app's query is orderBy('issueno','desc').limit(1) across the WHOLE collection, with no
 * testrunid clause, so a leftover issue doc from any previous run changes the expected number.
 */
async function seedClientIssue(db, tag, PF, issueno = 1500) {
  const Timestamp = T_();
  const id = `${TESTRUNID}_ISSUE0`;
  await db.collection('clientissue').doc(id).set({
    docid: id,
    issueno,
    profileid: PF.p0,
    profilesummary: true,
    status: 'open',
    created: Timestamp.fromDate(new Date()),
    ...tag,
  });
  return id;
}

module.exports = { TESTRUNID, LIST_IDS, SEEDED_LISTS, seedListsSegmentsTags, seedClientIssue };

/* =================================================================================================
 * WIRING — three edits to profiles/seed-profiles.js
 * =================================================================================================
 *
 * 1. near the other requires:
 *      const { LIST_IDS, SEEDED_LISTS, seedListsSegmentsTags } = require('./seed-lists-segments-tags');
 *
 * 2. at the END of seedProfiles(), after step 9:
 *      // 10) lists / segments / tags for the dialog suites (PA-33..PA-43) + AEL (PA-26).
 *      await seedListsSegmentsTags(db, tag, PF);
 *
 * 3. extend the teardown list:
 *      const SEEDED = [ ...existing..., ...SEEDED_LISTS ];
 *
 * and re-export LIST_IDS from module.exports so the specs can import the ids.
 *
 * =================================================================================================
 * ISOLATION — the one thing that is NOT solved by this file
 * =================================================================================================
 * `loadParticipantLists` and `getMergeConflicts` read `participant list` and `queue generation`
 * WITHOUT a testrunid filter. On the shared emulator, the queue suite's live queues and any list
 * left by a previous run take part in the conflict computation, so a merge case can see conflicts it
 * never seeded and fail for reasons unrelated to the code under test.
 *
 * A spec cannot fix this. Two options, in order of preference:
 *   (a) FENCE: run the lists/segments specs against a FRESH emulator (no EMU_REUSE), so
 *       `participant list` and `queue generation` contain only what this seeder wrote. This is the
 *       only option that makes the assertion exact.
 *   (b) FILTER: assert relatively — capture the conflict set before the merge and assert the DELTA,
 *       rather than asserting an absolute conflict count. Weaker, but survives a shared emulator.
 * ================================================================================================= */
