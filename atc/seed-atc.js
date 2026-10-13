// @ts-nocheck
/**
 * seed-atc.js — stand up the ATC world (Prescribe / Edit / View Prescribed ATC) in the FIREBASE EMULATOR.
 *
 * OPERATOR RULE (2026-10-13, absolute): NEVER test ATC against the development or production databases.
 * ATC data is seeded into the EMULATOR ONLY and never queried from a real database. This script therefore
 * REFUSES TO RUN unless the Firestore + Auth + Storage emulator hosts are set (guard G1 below) — there is no
 * cloud path, by design. It is the only seeder allowed to touch the `firestore-atc` named database, and only
 * the emulator's copy of it. Plan: specs/plans/2026-10-13-atc-prescribe-edit-view.md.
 *
 * Two databases:
 *   (default)      auth chain, dashboard grants, users_roles, bigactivity, procedures, procedure_recommend,
 *                  classify/adjustment_awareness, `atc model`, products — everything tagged {testrunid}.
 *   firestore-atc  atc_alpha / atc_to_validate (+ corrections/procedures sub-collections), atc_notes.
 *
 * WHY its own teardown (not seed.teardownCollections): that helper calls assertNoATC(), the CLOUD guard
 * that refuses any collection whose name contains "atc" (incl. `atc model`). Here the stronger guard is
 * G1 — the whole process is pinned to the emulator — so the ATC collections are cleared directly.
 *
 * Usage:  node atc/seed-atc.js --seed | --teardown   (only via the atc emulator globalSetup)
 */
'use strict';

// ---- G1: emulator-only, fail closed ------------------------------------------------------------------
const EMU_FS = process.env.FIRESTORE_EMULATOR_HOST;
const EMU_AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const EMU_STORAGE = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
if (!EMU_FS || !EMU_AUTH || !EMU_STORAGE) {
  console.error('🛑 seed-atc: REFUSING TO RUN — FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST and '
    + 'FIREBASE_STORAGE_EMULATOR_HOST must all be set. ATC is seeded into the EMULATOR ONLY (never a real DB).');
  process.exit(3);
}
if (!/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(EMU_FS) || !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(EMU_STORAGE)) {
  console.error(`🛑 seed-atc: emulator hosts must be local (got firestore=${EMU_FS}, storage=${EMU_STORAGE}).`);
  process.exit(3);
}

const { seed, seedDashboardRoutes, TAG, initAdminAuto } = require('../lib/seed-common');
const { getFirestore } = require('firebase-admin/firestore');

const RUN = process.env.ATC_RUNID || 'atc';
const ATC_DB_ID = 'firestore-atc';

// ---- actors -------------------------------------------------------------------------------------------
const PF = {
  admin: `${RUN}_pf_admin`,       // roles {admin} — prescriber / editor / super-role viewer
  eis: `${RUN}_pf_eis`,           // roles {eis}   — non-super viewer (sees only own-authored ATCs)
  agent1: `${RUN}_pf_agent1`,     // roles {changeagent} — change agent #1
  agent2: `${RUN}_pf_agent2`,     // roles {changeagent} — change agent #2
  mentor: `${RUN}_pf_mentor`,     // roles {mentor} — validator candidate (prescribe validator list)
  p0: `${RUN}_pf_p0`, p1: `${RUN}_pf_p1`, p2: `${RUN}_pf_p2`, p3: `${RUN}_pf_p3`, p4: `${RUN}_pf_p4`,
  // p5..p7: one participant per Prescribe case so a case's leftover draft never opens another case's picker
  p5: `${RUN}_pf_p5`, p6: `${RUN}_pf_p6`, p7: `${RUN}_pf_p7`,
};
const EMAIL = {
  admin: `admin+${RUN}@example.com`, eis: `eis+${RUN}@example.com`,
  agent1: `agent1+${RUN}@example.com`, agent2: `agent2+${RUN}@example.com`, mentor: `mentor+${RUN}@example.com`,
  p0: `participant0+${RUN}@example.com`, p1: `participant1+${RUN}@example.com`, p2: `participant2+${RUN}@example.com`,
  p3: `participant3+${RUN}@example.com`, p4: `participant4+${RUN}@example.com`,
  p5: `participant5+${RUN}@example.com`, p6: `participant6+${RUN}@example.com`, p7: `participant7+${RUN}@example.com`,
};

function roster() {
  const mk = (key, roles, role) => ({ uid: `${RUN}_u_${key}`, profileid: PF[key], email: EMAIL[key], role: role || key, roles });
  const staff = [
    mk('admin', ['admin'], 'admin'),
    mk('eis', ['eis'], 'eis'),
    mk('agent1', ['changeagent'], 'changeagent'),
    mk('agent2', ['changeagent'], 'changeagent'),
    mk('mentor', ['mentor'], 'mentor'),
  ];
  const participants = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map((k) => ({ uid: `${RUN}_u_${k}`, profileid: PF[k], email: EMAIL[k], role: 'participant' }));
  return { staff, participants };
}

// ---- reference data (default DB) ------------------------------------------------------------------------
const ACT = {
  author: `${RUN}_act_author`, observer: `${RUN}_act_observer`, mentoring: `${RUN}_act_mentoring`,
  ca: `${RUN}_act_ca`,         // assigned_to "Change Agent"  — sorts FIRST (legacy assigned_to maps here)
  sa: `${RUN}_act_sa`,         // assigned_to "Support Agent"
};
const ACT_NAME = {
  author: 'Author', observer: 'Observer', mentoring: 'Mentoring', ca: 'Change Agent', sa: 'Support Agent',
};
const PROC = { one: `${RUN}_proc_one`, two: `${RUN}_proc_two` };
const PROC_NAME = { one: `ATC Proc One ${RUN}`, two: `ATC Proc Two ${RUN}` };
const MODEL = { alpha: `ATC Model Alpha ${RUN}`, beta: `ATC Model Beta ${RUN}` };
const MODEL_DIRECTIVE = { alpha: `Alpha directive ${RUN}`, beta: `Beta directive ${RUN}` };
const AWARE = [{ aware: 'aware', value: 'Aware' }, { aware: 'unaware', value: 'Unaware' }];

// ---- ATC docs (firestore-atc) ---------------------------------------------------------------------------
const ATC = {
  A1: `${RUN}_A1`,     // atc_alpha  p1 — view list / full ATC / Edit link (read-mostly)
  V1: `${RUN}_V1`,     // atc_to_validate 'atc given' p1 — VATC-05a (pick validator)
  V2: `${RUN}_V2`,     // atc_to_validate 'atc given' p1 — VATC-05b (close without validator)
  B1: `${RUN}_B1`,     // atc_alpha  p1 — VATC-07 bulk Change Agent (4 procedure states + deleted adjustment)
  EIS1: `${RUN}_EIS1`, // atc_alpha  p3 authored by the eis user — VATC-06 scoping
  E1: `${RUN}_E1`, E2: `${RUN}_E2`, E3: `${RUN}_E3`, E4: `${RUN}_E4`, E5: `${RUN}_E5`, E6: `${RUN}_E6`, // atc_alpha p2 — EATC-*
  EV1: `${RUN}_EV1`,   // atc_to_validate 'atc given' p2 — EATC-04 (/validation route)
  N1: `${RUN}_N1`,     // atc_notes for A1
};
const ATC_COLLECTIONS = ['atc_alpha', 'atc_to_validate', 'atc_notes', 'temporary_ATC', 'temporary_edit_ATC', 'ai_generated_atc_summary'];

const ROUTES = [
  { route: '/prescribeATC', label: 'Prescribe ATC' },
  { route: '/editATC', label: 'Edit ATC' },
  { route: '/viewprescribedATC', label: 'View Prescribed ATC' },
];

// Default-DB collections this seed owns (testrunid-tagged; teardown sweeps by tag).
const DEFAULT_SEEDED = ['user_data', 'profile_data', 'users_roles', 'dashboard', 'bigactivity', 'procedures',
  'procedure_recommend', 'atc model', 'products', 'participant metadata'];

function atcDb(admin) { return getFirestore(admin.app(), ATC_DB_ID); }

async function seedATC() {
  const admin = initAdminAuto();
  const db = admin.firestore();
  const adb = atcDb(admin);
  const auth = admin.auth();
  const T = admin.firestore.Timestamp;
  const tag = TAG(RUN);
  const daysAgo = (d) => T.fromMillis(Date.now() - d * 86400e3);
  const { staff, participants } = roster();

  // 1) auth chain (user_data <- profile_data.user_ref; profile_data.role_ref -> users_roles) + route grants
  await seed.seedAuthChain(db, auth, RUN, { staff, participants });
  await seedDashboardRoutes(db, RUN, ROUTES, {
    staffProfileIds: staff.map((s) => s.profileid),
    allRoles: ['admin', 'eis', 'changeagent', 'mentor'],
  });

  // 2) reference data the three screens read
  for (const k of Object.keys(ACT)) {
    const atcproperty = { author: 'author', observer: 'observer', mentoring: 'mentoring', ca: 'assigned_to', sa: 'assigned_to' }[k];
    await db.collection('bigactivity').doc(ACT[k]).set({ docid: ACT[k], activity: ACT_NAME[k], atcproperty, ...tag });
  }
  for (const k of Object.keys(PROC)) await db.collection('procedures').doc(PROC[k]).set({ name: PROC_NAME[k], ...tag });
  await db.collection('procedure_recommend').doc(`${RUN}_rec_1`).set({ name: `Recommend Self ${RUN}`, ...tag });
  await db.collection('classify').doc('adjustment_awareness').set({
    label: 'Awareness', potentialyearlabel: 'Potential Years', awarenesslist: AWARE, ...tag,
  });
  for (const k of Object.keys(MODEL)) {
    await db.collection('atc model').doc(`${RUN}_model_${k}`).set({ atcmodel: MODEL[k], directive: MODEL_DIRECTIVE[k], ...tag });
    await db.collection('products').doc(`${RUN}_product_${k}`).set({ atcmodel: MODEL[k], ...tag });
  }

  // 3) ATC docs — firestore-atc (EMULATOR). Refs that the app compares against doc(firestoreATC, …) MUST be
  //    created on the ATC database instance (a reference value carries its database id).
  const pref = (pid) => adb.doc(`profile_data/${pid}`);
  const procRef = (k) => adb.doc(`procedures/${PROC[k]}`);

  async function writeATC(coll, id, data, adjustments) {
    const ref = adb.collection(coll).doc(id);
    await ref.set({
      atcid: id, isdelete: false, type: 'online', notesid: null, mentoringid: null, mentorref: [], mentee: [],
      observer: null, validator: null, prescription_image: null, ...data, ...tag,
    });
    for (let a = 0; a < adjustments.length; a++) {
      const adj = adjustments[a];
      const adjId = `adjustment ${String(a + 1).padStart(2, '0')}`;
      const adjRef = ref.collection('corrections').doc(adjId);
      await adjRef.set({
        name: adj.name, awareness: adj.awareness === undefined ? 'aware' : adj.awareness,
        awarenessdetail: adj.awarenessdetail === undefined ? 'Aware' : adj.awarenessdetail,
        potentialyears: adj.potentialyears === undefined ? 2 : adj.potentialyears,
        isdelete: !!adj.isdelete, implementationagent: [PF.admin], created: daysAgo(3), ...tag,
      });
      for (let p = 0; p < adj.procedures.length; p++) {
        const pr = adj.procedures[p];
        const doc = {
          name: procRef(pr.proc || 'one'), recommended_to: null, level: {}, mandatory: !!pr.mandatory,
          status: pr.status || 'yet to start', cancelled: false, isdelete: !!pr.isdelete, autogeneralized: false,
          product: data.product, created: daysAgo(3), ...tag,
        };
        if (pr.bigactivity !== undefined) doc.bigactivity = pr.bigactivity;
        doc.assigned_to = (pr.assigned || []).map(pref);
        await adjRef.collection('procedures').doc(`${adjId} - ${p + 1}`).set(doc);
      }
    }
    return ref;
  }

  const base = (pid, author, product, d) => ({
    profileid: pid, product, directive: `Seed directive ${product}`, prescription_date: daysAgo(d),
    author: [pref(author)], bigactivity: { [ACT.author]: [author] },
  });
  const simpleAdj = (name) => [{ name, procedures: [{ proc: 'one', bigactivity: { [ACT.ca]: [PF.agent1] }, assigned: [PF.agent1] }] }];

  await writeATC('atc_alpha', ATC.A1, { ...base(PF.p1, PF.admin, MODEL.alpha, 2), notesid: ATC.N1 }, [
    { name: `A1 adjustment one ${RUN}`, procedures: [
      { proc: 'one', bigactivity: { [ACT.ca]: [PF.agent1] }, assigned: [PF.agent1] },
      { proc: 'two', status: 'completed', bigactivity: { [ACT.ca]: [PF.agent2] }, assigned: [PF.agent2] },
    ] },
  ]);
  await adb.collection('atc_notes').doc(ATC.N1).set({
    atcid: ATC.A1, consultationpoint: `A1 consultation point ${RUN}`, consultationsummary: `A1 summary ${RUN}`,
    notes: `A1 case notes ${RUN}`, changeworkbrief: [], imagenotes: [], from: 'alpha', created: daysAgo(2), ...tag,
  });
  await writeATC('atc_to_validate', ATC.V1, { ...base(PF.p1, PF.admin, MODEL.beta, 4), status: 'atc given' }, simpleAdj(`V1 adjustment ${RUN}`));
  await writeATC('atc_to_validate', ATC.V2, { ...base(PF.p1, PF.admin, MODEL.beta, 5), status: 'atc given' }, simpleAdj(`V2 adjustment ${RUN}`));

  // B1 — the bulk Change Agent target. Adjustment 01 carries the four procedure states VATC-07 asserts on;
  // adjustment 02 is DELETED and holds an otherwise-open procedure that bulk must also skip.
  await writeATC('atc_alpha', ATC.B1, base(PF.p1, PF.admin, MODEL.alpha, 6), [
    { name: `B1 adjustment one ${RUN}`, procedures: [
      { proc: 'one', bigactivity: { [ACT.ca]: [PF.agent1] }, assigned: [PF.agent1] },                         // 1 open (CA only)
      { proc: 'two', bigactivity: { [ACT.ca]: [PF.agent1], [ACT.sa]: [PF.agent2] }, assigned: [PF.agent1, PF.agent2] }, // 2 open (CA + SA)
      { proc: 'one', status: 'completed', bigactivity: { [ACT.ca]: [PF.agent2] }, assigned: [PF.agent2] },   // 3 completed
      { proc: 'two', isdelete: true, bigactivity: { [ACT.ca]: [PF.agent2] }, assigned: [PF.agent2] },        // 4 deleted
      { proc: 'one', assigned: [PF.agent2] },                                                                // 5 legacy (assigned_to only)
    ] },
    { name: `B1 adjustment two (deleted) ${RUN}`, isdelete: true, procedures: [
      { proc: 'one', bigactivity: { [ACT.ca]: [PF.agent2] }, assigned: [PF.agent2] },
    ] },
  ]);

  await writeATC('atc_alpha', ATC.EIS1, base(PF.p3, PF.eis, MODEL.alpha, 3), simpleAdj(`EIS1 adjustment ${RUN}`));

  for (const [i, id] of [ATC.E1, ATC.E2, ATC.E3, ATC.E4, ATC.E5].entries()) {
    await writeATC('atc_alpha', id, base(PF.p2, PF.admin, MODEL.alpha, 7 + i), simpleAdj(`${id} adjustment ${RUN}`));
  }
  // E6 — existing adjustment with NO awareness: the edit screen must refuse to save it (EATC-05).
  await writeATC('atc_alpha', ATC.E6, base(PF.p2, PF.admin, MODEL.alpha, 12), [
    { name: `E6 adjustment ${RUN}`, awareness: null, awarenessdetail: null, potentialyears: null,
      procedures: [{ proc: 'one', bigactivity: { [ACT.ca]: [PF.agent1] }, assigned: [PF.agent1] }] },
  ]);
  await writeATC('atc_to_validate', ATC.EV1, { ...base(PF.p2, PF.admin, MODEL.beta, 13), status: 'atc given' }, simpleAdj(`EV1 adjustment ${RUN}`));

  console.log(`[seed-atc] seeded run '${RUN}' — default-DB reference data + ${Object.keys(ATC).length} ATC docs in ${ATC_DB_ID} (EMULATOR ${EMU_FS})`);
}

async function teardownATC() {
  const admin = initAdminAuto();
  const db = admin.firestore();
  const adb = atcDb(admin);
  let n = 0;
  // default DB — only this run's tagged docs
  for (const col of DEFAULT_SEEDED) {
    const snap = await db.collection(col).where('testrunid', '==', RUN).get();
    for (const d of snap.docs) { await d.ref.delete(); n++; }
  }
  const aw = await db.collection('classify').doc('adjustment_awareness').get();
  if (aw.exists && aw.data().testrunid === RUN) { await aw.ref.delete(); n++; }
  // firestore-atc (EMULATOR ONLY — G1 above): clear the ATC collections entirely, incl. app-written docs
  // (new versions, drafts, conflicts) that carry no testrunid.
  for (const col of ATC_COLLECTIONS) { await adb.recursiveDelete(adb.collection(col)); }
  // Storage emulator: media the app uploaded during the run.
  try {
    const bucket = admin.storage().bucket(`${process.env.FIREBASE_PROJECT || 'starlabs-cicd'}.appspot.com`);
    for (const prefix of ['ATC_Audio_Notes/', 'Uploaded ATC/', 'Online ATC Images/']) {
      await bucket.deleteFiles({ prefix, force: true }).catch(() => {});
    }
  } catch { /* storage emulator not reachable — nothing to clean */ }
  return n;
}

module.exports = { RUN, PF, EMAIL, ACT, ACT_NAME, PROC, PROC_NAME, MODEL, MODEL_DIRECTIVE, ATC, ATC_DB_ID, seedATC, teardownATC };

if (require.main === module) {
  (async () => {
    const mode = process.argv[2];
    if (mode === '--seed') await seedATC();
    else if (mode === '--teardown') { const n = await teardownATC(); console.log('[seed-atc] torn down', n, 'default-DB docs + ATC collections for run', RUN); }
    else { console.log('usage: seed-atc.js --seed | --teardown'); process.exit(1); }
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
