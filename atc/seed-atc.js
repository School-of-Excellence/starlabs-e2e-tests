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
const P2_KEYS = ['vua', 'vpa', 'pva', 'vaa', 'rfa', 'pfm', 'ate', 'lrx', 'lrx2', 'tra', 'tra2', 'trv', 'trp', 'tre', 'eia', 'eia2'];
const PF = {
  admin: `${RUN}_pf_admin`,       // roles {admin} — prescriber / editor / super-role viewer
  eis: `${RUN}_pf_eis`,           // roles {eis}   — non-super viewer (sees only own-authored ATCs)
  agent1: `${RUN}_pf_agent1`,     // roles {changeagent} — change agent #1
  agent2: `${RUN}_pf_agent2`,     // roles {changeagent} — change agent #2
  mentor: `${RUN}_pf_mentor`,     // roles {mentor} — validator candidate (prescribe validator list)
  p0: `${RUN}_pf_p0`, p1: `${RUN}_pf_p1`, p2: `${RUN}_pf_p2`, p3: `${RUN}_pf_p3`, p4: `${RUN}_pf_p4`,
  // p5..p7: one participant per Prescribe case so a case's leftover draft never opens another case's picker
  p5: `${RUN}_pf_p5`, p6: `${RUN}_pf_p6`, p7: `${RUN}_pf_p7`, p8: `${RUN}_pf_p8`,
  // phase 2 (2026-10-17): developer staff user (Add Triple drafts, EI AI View) + one participant per screen
  dev: `${RUN}_pf_dev`,
  ...Object.fromEntries(P2_KEYS.map((k) => [k, `${RUN}_pf_${k}`])),
};
const EMAIL = {
  admin: `admin+${RUN}@example.com`, eis: `eis+${RUN}@example.com`,
  agent1: `agent1+${RUN}@example.com`, agent2: `agent2+${RUN}@example.com`, mentor: `mentor+${RUN}@example.com`,
  p0: `participant0+${RUN}@example.com`, p1: `participant1+${RUN}@example.com`, p2: `participant2+${RUN}@example.com`,
  p3: `participant3+${RUN}@example.com`, p4: `participant4+${RUN}@example.com`,
  p5: `participant5+${RUN}@example.com`, p6: `participant6+${RUN}@example.com`, p7: `participant7+${RUN}@example.com`,
  p8: `participant8+${RUN}@example.com`,
  dev: `dev+${RUN}@example.com`,
  ...Object.fromEntries(P2_KEYS.map((k) => [k, `${k}+${RUN}@example.com`])),
};

function roster() {
  const mk = (key, roles, role) => ({ uid: `${RUN}_u_${key}`, profileid: PF[key], email: EMAIL[key], role: role || key, roles });
  const staff = [
    mk('admin', ['admin'], 'admin'),
    mk('eis', ['eis'], 'eis'),
    mk('agent1', ['changeagent'], 'changeagent'),
    mk('agent2', ['changeagent'], 'changeagent'),
    mk('mentor', ['mentor'], 'mentor'),
    mk('dev', ['developer'], 'developer'),
  ];
  const participants = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', ...P2_KEYS].map((k) => ({ uid: `${RUN}_u_${k}`, profileid: PF[k], email: EMAIL[k], role: 'participant' }));
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
  E7: `${RUN}_E7`,     // atc_alpha p2 — EATC-09 (directive, edit/delete adjustment, procedure toggle, mandatory, notes, preview Close)
  M1: `${RUN}_M1`,     // atc_alpha p1, mentoring + already 'validated' — VATC-08 (mentor filter, validated status)
  Q1: `${RUN}_Q1`,     // atc_alpha p1, beta, inside the seeded queue window — VATC-08 (queue filter)
  EV1: `${RUN}_EV1`,   // atc_to_validate 'atc given' p2 — EATC-04 (/validation route)
  N1: `${RUN}_N1`,     // atc_notes for A1
};
// Phase 2 (plan specs/plans/2026-10-17-atc-live-screens.md). All dated 30+ days ago so they never fall inside the
// phase-1 date / queue / mentor filter windows (VATC-02 day 5-6, VATC-08 queue day 19-21).
const ATC2 = {
  U_OLD: `${RUN}_U_old`, U_NEW: `${RUN}_U_new`,                        // VUA — version chain
  VPA1: `${RUN}_VPA1`, VPA2: `${RUN}_VPA2`, VPA3: `${RUN}_VPA3`,        // VPA — participant history
  PV_A: `${RUN}_PV_A`, PV_V: `${RUN}_PV_V`, PV_V2: `${RUN}_PV_V2`,     // PVA — preview (alpha / validation)
  AS1: `${RUN}_AS1`,                                                    // VAA — change-agent work queue
  RF_V: `${RUN}_RF_V`, RF_A: `${RUN}_RF_A`, RF_F1: `${RUN}_RF_F1`, RF_F2: `${RUN}_RF_F2`, RF_F3: `${RUN}_RF_F3`, // RFA
  PF_A: `${RUN}_PF_A`, PF_V: `${RUN}_PF_V`, PF_V2: `${RUN}_PF_V2`, PF_M: `${RUN}_PF_M`, // PFM
  ATE_A: `${RUN}_ATE_A`, ATE_V: `${RUN}_ATE_V`, ATE_C: `${RUN}_ATE_C`, ATE_U: `${RUN}_ATE_U`, // ATE (queue-scoped)
  TV1: `${RUN}_TV1`, TP1: `${RUN}_TP1`, TP2: `${RUN}_TP2`, TE1: `${RUN}_TE1`, TE2: `${RUN}_TE2`, TE3: `${RUN}_TE3`, // triple atc
};
const PA = { rework: `${RUN}_pa_rework`, activity: `${RUN}_pa_activity`, validated: `${RUN}_pa_validated`,
  trpValidate: `${RUN}_pa_trp_validate`, trpRework: `${RUN}_pa_trp_rework` };   // big participants assignments
const PFM_M = `${RUN}_pfm_m`;                       // pick_for_mentoring doc already linked to PF_M
const LRX_DRAFT = `${RUN}_lrx_draft`;               // temporary_ATC draft for the live-prescription link
const TRA2_DRAFT = `${RUN}_tra2_draft`;             // temporary_tripleatc draft for the Add Triple picker
const EIA = { S1v1: `${RUN}_eia_s1v1`, S1v2: `${RUN}_eia_s1v2`, S2: `${RUN}_eia_s2`, S3: `${RUN}_eia_s3` };
const ATE_QUEUE = `${RUN}_ate_queue`;
const ATE_QUEUE_NAME = `ATC Education Queue ${RUN}`;
const TRIPLE_QUEUE = `${RUN}_triple_queue`;
const TRIPLE_QUEUE_NAME = `Triple Queue ${RUN}`;
const AI_ADJ = `AI adjustment ${RUN}`;
const ATC_COLLECTIONS = ['atc_alpha', 'atc_to_validate', 'atc_notes', 'temporary_ATC', 'temporary_edit_ATC', 'ai_generated_atc_summary',
  'triple atc', 'temporary_tripleatc', 'temporary_edit_tripleATC'];

const ROUTES = [
  { route: '/prescribeATC', label: 'Prescribe ATC' },
  { route: '/editATC', label: 'Edit ATC' },
  { route: '/viewprescribedATC', label: 'View Prescribed ATC' },
  // phase 2
  { route: '/previewATC', label: 'Preview ATC' }, { route: '/viewUpgradedATC', label: 'Upgraded ATC' },
  { route: '/view-participant-atc', label: 'View Participant ATC' }, { route: '/viewassignedATC', label: 'View Assigned ATC' },
  { route: '/reviewflagATC', label: 'ATC - Review/Flag' }, { route: '/pickformentoring', label: 'Pick ATC for Mentoring' },
  { route: '/atctrajectory', label: 'ATC Education' }, { route: '/liveprescription', label: 'Live Prescription' },
  { route: '/addtripleATC', label: 'Add Triple ATC' }, { route: '/viewtripleATC', label: 'View Triple ATC' },
  { route: '/previewtripleATC', label: 'Preview Triple ATC' }, { route: '/edittripleATC', label: 'Edit Triple ATC' },
  { route: '/viewaigeneratedatc', label: 'EI AI' },
];

// Default-DB collections this seed owns (testrunid-tagged; teardown sweeps by tag).
const DEFAULT_SEEDED = ['user_data', 'profile_data', 'users_roles', 'dashboard', 'bigactivity', 'procedures',
  'procedure_recommend', 'atc model', 'products', 'participant metadata', 'queue generation', 'arena events',
  'big participants assignments', 'pick_for_mentoring'];
const QUEUE_NAME = `ATC Queue ${RUN}`;

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
    allRoles: ['admin', 'eis', 'changeagent', 'mentor', 'developer'],
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
    await db.collection('products').doc(`${RUN}_product_${k}`).set({ atcmodel: MODEL[k], directive: MODEL_DIRECTIVE[k], ...tag });
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
        isdelete: !!adj.isdelete, implementationagent: [PF.admin], created: daysAgo(3), ...(adj.extra || {}), ...tag,
      });
      for (let p = 0; p < adj.procedures.length; p++) {
        const pr = adj.procedures[p];
        const doc = {
          name: procRef(pr.proc || 'one'), recommended_to: null, level: {}, mandatory: !!pr.mandatory,
          status: pr.status || 'yet to start', cancelled: false, isdelete: !!pr.isdelete, autogeneralized: false,
          product: data.product, created: daysAgo(3), ...tag,
        };
        if (pr.bigactivity !== undefined) doc.bigactivity = pr.bigactivity;
        Object.assign(doc, pr.extra || {});
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

  await writeATC('atc_alpha', ATC.A1, { ...base(PF.p1, PF.admin, MODEL.alpha, 2), notesid: ATC.N1, totaladjustment: 1, totalprocedure: 2 }, [
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

  // M1 — mentored + already validated (VATC-08: mentor filter, 'validated' status text, summary totals)
  await writeATC('atc_alpha', ATC.M1, {
    ...base(PF.p1, PF.admin, MODEL.alpha, 15), status: 'validated', validator: [pref(PF.mentor)],
    bigactivity: { [ACT.author]: [PF.admin], [ACT.mentoring]: [PF.mentor] }, totaladjustment: 3, totalprocedure: 4,
  }, simpleAdj(`M1 adjustment ${RUN}`));
  // Q1 — beta model, 20 days ago: the ONLY listed ATC inside the seeded queue window + its product (VATC-08)
  await writeATC('atc_alpha', ATC.Q1, base(PF.p1, PF.admin, MODEL.beta, 20), simpleAdj(`Q1 adjustment ${RUN}`));
  await db.collection('queue generation').doc(`${RUN}_queue`).set({
    queuename: QUEUE_NAME, docid: `${RUN}_queue`, queuestartdate: daysAgo(21), queueenddate: daysAgo(19), ...tag,
  });
  await db.collection('arena events').doc(`${RUN}_event`).set({
    eventname: QUEUE_NAME, delete: false, productref: db.doc(`products/${RUN}_product_beta`), ...tag,
  });
  // E7 — two adjustments; adjustment 01 has two procedures (EATC-09)
  await writeATC('atc_alpha', ATC.E7, base(PF.p2, PF.admin, MODEL.alpha, 14), [
    { name: `E7 adjustment one ${RUN}`, procedures: [
      { proc: 'one', bigactivity: { [ACT.ca]: [PF.agent1] }, assigned: [PF.agent1] },
      { proc: 'two', bigactivity: { [ACT.ca]: [PF.agent1] }, assigned: [PF.agent1] },
    ] },
    { name: `E7 adjustment two ${RUN}`, procedures: [{ proc: 'one', bigactivity: { [ACT.ca]: [PF.agent1] }, assigned: [PF.agent1] }] },
  ]);

  for (const [i, id] of [ATC.E1, ATC.E2, ATC.E3, ATC.E4, ATC.E5].entries()) {
    await writeATC('atc_alpha', id, base(PF.p2, PF.admin, MODEL.alpha, 7 + i), simpleAdj(`${id} adjustment ${RUN}`));
  }
  // E6 — existing adjustment with NO awareness: the edit screen must refuse to save it (EATC-05).
  await writeATC('atc_alpha', ATC.E6, base(PF.p2, PF.admin, MODEL.alpha, 12), [
    { name: `E6 adjustment ${RUN}`, awareness: null, awarenessdetail: null, potentialyears: null,
      procedures: [{ proc: 'one', bigactivity: { [ACT.ca]: [PF.agent1] }, assigned: [PF.agent1] }] },
  ]);
  await writeATC('atc_to_validate', ATC.EV1, { ...base(PF.p2, PF.admin, MODEL.beta, 13), status: 'atc given' }, simpleAdj(`EV1 adjustment ${RUN}`));

  await seedPhase2({ db, adb, T, tag, daysAgo, pref, procRef, writeATC, base, simpleAdj });

  console.log(`[seed-atc] seeded run '${RUN}' — default-DB reference data + ${Object.keys(ATC).length} ATC docs in ${ATC_DB_ID} (EMULATOR ${EMU_FS})`);
}

async function seedPhase2({ db, adb, tag, daysAgo, pref, writeATC, base, simpleAdj }) {
  // VUA — an upgraded chain: U_NEW (listed) editedfrom → U_OLD (retired version, opened via the version button)
  await writeATC('atc_alpha', ATC2.U_OLD, { ...base(PF.vua, PF.admin, MODEL.alpha, 31), status: 'upgraded', isdelete: true,
    validator: [pref(PF.mentor)] }, simpleAdj(`U_OLD adjustment ${RUN}`));
  await writeATC('atc_alpha', ATC2.U_NEW, { ...base(PF.vua, PF.admin, MODEL.alpha, 30),
    editedfrom: adb.doc(`atc_alpha/${ATC2.U_OLD}`), lasteditedon: daysAgo(30) }, simpleAdj(`U_NEW adjustment ${RUN}`));
  await adb.doc(`atc_alpha/${ATC2.U_OLD}`).update({ upgradedto: adb.doc(`atc_alpha/${ATC2.U_NEW}`) });

  // VPA — one participant's history: alpha, alpha (same product, consecutive) then a pending beta
  await writeATC('atc_alpha', ATC2.VPA1, { ...base(PF.vpa, PF.admin, MODEL.alpha, 32), status: 'validated' }, simpleAdj(`VPA1 adjustment ${RUN}`));
  await writeATC('atc_alpha', ATC2.VPA2, { ...base(PF.vpa, PF.admin, MODEL.alpha, 33), status: 'validated' }, simpleAdj(`VPA2 adjustment ${RUN}`));
  await writeATC('atc_to_validate', ATC2.VPA3, { ...base(PF.vpa, PF.admin, MODEL.beta, 34), status: 'atc given' }, simpleAdj(`VPA3 adjustment ${RUN}`));

  // PVA — ATCs + the BIG participant assignments the preview closes
  await writeATC('atc_alpha', ATC2.PV_A, { ...base(PF.pva, PF.admin, MODEL.alpha, 35), notesid: `${RUN}_N_PVA` }, simpleAdj(`PV_A adjustment ${RUN}`));
  await adb.collection('atc_notes').doc(`${RUN}_N_PVA`).set({ atcid: ATC2.PV_A, consultationpoint: `PV_A consultation point ${RUN}`,
    consultationsummary: null, notes: `PV_A case notes ${RUN}`, changeworkbrief: [], imagenotes: [], from: 'alpha', ...tag });
  await writeATC('atc_to_validate', ATC2.PV_V, { ...base(PF.pva, PF.admin, MODEL.beta, 36), status: 'atc given' }, simpleAdj(`PV_V adjustment ${RUN}`));
  await writeATC('atc_to_validate', ATC2.PV_V2, { ...base(PF.pva, PF.admin, MODEL.beta, 37), status: 'atc given' }, simpleAdj(`PV_V2 adjustment ${RUN}`));
  for (const k of Object.keys(PA)) {
    await db.collection('big participants assignments').doc(PA[k]).set({ docid: PA[k], status: 'review', activitylog: [], ...tag });
  }

  // VAA — one ATC assigned to agent1 at every level, three procedures (to complete / auto-generalize / undo)
  await writeATC('atc_alpha', ATC2.AS1, { ...base(PF.vaa, PF.admin, MODEL.alpha, 38), implementationagent: [PF.agent1] }, [
    { name: `AS1 adjustment ${RUN}`, extra: { implementationagent: [PF.agent1] }, procedures: [
      { proc: 'one', bigactivity: { [ACT.ca]: [PF.agent1] }, assigned: [PF.agent1] },
      { proc: 'two', bigactivity: { [ACT.ca]: [PF.agent1] }, assigned: [PF.agent1] },
      { proc: 'one', status: 'completed', bigactivity: { [ACT.ca]: [PF.agent1] }, assigned: [PF.agent1],
        extra: { last_activity: daysAgo(2) } },
    ] },
  ]);

  // RFA — one per tab action
  await writeATC('atc_to_validate', ATC2.RF_V, { ...base(PF.rfa, PF.admin, MODEL.beta, 40), status: 'atc given' }, simpleAdj(`RF_V adjustment ${RUN}`));
  for (const id of [ATC2.RF_A, ATC2.RF_F1, ATC2.RF_F2, ATC2.RF_F3]) {
    await writeATC('atc_alpha', id, base(PF.rfa, PF.admin, MODEL.alpha, 41), simpleAdj(`${id} adjustment ${RUN}`));
  }

  // PFM — pick from each tab, validate, and add a note to an already-picked ATC
  await writeATC('atc_alpha', ATC2.PF_A, base(PF.pfm, PF.admin, MODEL.alpha, 42), simpleAdj(`PF_A adjustment ${RUN}`));
  await writeATC('atc_to_validate', ATC2.PF_V, { ...base(PF.pfm, PF.admin, MODEL.beta, 43), status: 'atc given' }, simpleAdj(`PF_V adjustment ${RUN}`));
  await writeATC('atc_to_validate', ATC2.PF_V2, { ...base(PF.pfm, PF.admin, MODEL.beta, 44), status: 'atc given' }, simpleAdj(`PF_V2 adjustment ${RUN}`));
  await writeATC('atc_alpha', ATC2.PF_M, { ...base(PF.pfm, PF.admin, MODEL.alpha, 45), mentoringid: PFM_M }, simpleAdj(`PF_M adjustment ${RUN}`));
  await db.collection('pick_for_mentoring').doc(PFM_M).set({ atcid: ATC2.PF_M, profileid: PF.pfm, from: 'alpha',
    mentoringnote: `Seed mentoring note ${RUN}`, mentorperson: PF.mentor, created: daysAgo(45), lastupdated: daysAgo(45), ...tag });

  // ATE — a (past) queue and its ATCs
  await db.collection('queue generation').doc(ATE_QUEUE).set({ docid: ATE_QUEUE, queuename: ATE_QUEUE_NAME,
    queuestartdate: daysAgo(52), queueenddate: daysAgo(50), changeworkperson: [], ...tag });
  const ateBase = (d) => ({ ...base(PF.ate, PF.admin, MODEL.alpha, d), queueid: ATE_QUEUE, stagename: `Stage ${RUN}` });
  await writeATC('atc_alpha', ATC2.ATE_A, { ...ateBase(50), status: 'validated' }, simpleAdj(`ATE_A adjustment ${RUN}`));
  await writeATC('atc_to_validate', ATC2.ATE_V, { ...ateBase(50), status: 'atc given' }, simpleAdj(`ATE_V adjustment ${RUN}`));
  await writeATC('atc_alpha', ATC2.ATE_C, { ...ateBase(51), status: 'validated' }, simpleAdj(`ATE_C adjustment ${RUN}`));
  await writeATC('atc_alpha', ATC2.ATE_U, { ...ateBase(51), status: 'validated' }, simpleAdj(`ATE_U adjustment ${RUN}`));

  // LRX — an in-progress Prescribe draft (temporary_ATC, the shape prescribe-atc autosaves)
  await adb.collection('temporary_ATC').doc(LRX_DRAFT).set({
    date: '2026-10-01', product: MODEL.alpha, atcdirective: MODEL_DIRECTIVE.alpha, profileid: PF.lrx,
    author: { [ACT.author]: [`profile_data/${PF.admin}`] }, observer: {}, mentor: {}, additionalactivity: [],
    transcript: [{ adjustment: `LRX adjustment ${RUN}`, awareness: null, potentialyears: null,
      procedure: [{ name: `procedures/${PROC.one}`, mandatory: true, completed: false, recommended_to: null,
        assignedMap: { [ACT.ca]: [`profile_data/${PF.agent1}`] } }] }],
    consultationsummary: `LRX summary ${RUN}`, consultationpoint: `LRX points ${RUN}`, notes: `LRX case notes ${RUN}`,
    mentornotes: null, delete: false, authorprofileid: [PF.admin], accountpid: PF.admin, ...tag,
  });

  // Triple ATC — a queue to pick, a draft for the picker, and triple atc docs for view / preview / edit
  await db.collection('queue generation').doc(TRIPLE_QUEUE).set({ docid: TRIPLE_QUEUE, queuename: TRIPLE_QUEUE_NAME,
    queuestartdate: daysAgo(62), queueenddate: daysAgo(60), changeworkperson: [], ...tag });
  await adb.collection('temporary_tripleatc').doc(TRA2_DRAFT).set({
    date: '2026-10-01', product: MODEL.alpha, atcdirective: MODEL_DIRECTIVE.alpha, profileid: PF.tra2,
    author: [`profile_data/${PF.admin}`], selectedqueueid: TRIPLE_QUEUE, accountuid: `${RUN}_u_dev`, accountpid: PF.dev,
    tripleatc: [1, 2, 3].map((n) => ({ position: `TRA2 draft position ${n} ${RUN}`,
      atc: [{ adjustment: `TRA2 draft adjustment ${n} ${RUN}`, procedure: [{ name: `procedures/${PROC.one}`,
        recommended_to: null, assigned_to: [], mandatory: false, completed: false }] }] })),
    delete: false, ...tag,
  });
  const triple = async (id, pid, d, extra = {}) => {
    const positions = [1, 2, 3].map((n) => `${id} position ${n} ${RUN}`);
    await writeATC('triple atc', id, { ...base(pid, PF.admin, MODEL.alpha, d), status: 'atc given', tripleatc: true,
      perceptualposition: positions, queueid: TRIPLE_QUEUE, ...extra },
    positions.map((p, i) => ({ name: `${id} adjustment ${i + 1} ${RUN}`, extra: { perceptualposition: p },
      procedures: [{ proc: i % 2 ? 'two' : 'one', assigned: [] }, { proc: 'two', assigned: [] }] })));
  };
  await triple(ATC2.TV1, PF.trv, 60);
  await triple(ATC2.TP1, PF.trp, 61);
  await triple(ATC2.TP2, PF.trp, 62);
  await triple(ATC2.TE1, PF.tre, 63);
  await triple(ATC2.TE2, PF.tre, 64);
  await triple(ATC2.TE3, PF.tre, 65);

  // EIA — AI summaries (two versions for one participant; one already turned into an ATC; one with no forms)
  const aiOutput = `AI summary for ${RUN}\n` + JSON.stringify({ ATC_Report: {
    Adjustments: [{ Adjustment: AI_ADJ, Outcome: 'Calmer', Procedures: [PROC_NAME.one] }],
    Areas_that_need_to_be_explored_more: ['Sleep'] } });
  await adb.collection('ai_generated_atc_summary').doc(EIA.S1v1).set({ profileid: PF.eia, version: 1, formdocids: [], output: aiOutput, ...tag });
  await adb.collection('ai_generated_atc_summary').doc(EIA.S1v2).set({ profileid: PF.eia, version: 2, formdocids: [], output: aiOutput, ...tag });
  await adb.collection('ai_generated_atc_summary').doc(EIA.S2).set({ profileid: PF.eia2, version: 1, formdocids: [],
    output: aiOutput, atcalpharef: adb.doc(`atc_alpha/${ATC.A1}`), atcsubmittedat: daysAgo(10), ...tag });
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
  const ours = Object.values(PF);
  for (let i = 0; i < ours.length; i += 30) {
    const snap = await db.collection('pick_for_mentoring').where('profileid', 'in', ours.slice(i, i + 30)).get();
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

module.exports = { RUN, PF, EMAIL, ACT, ACT_NAME, PROC, PROC_NAME, MODEL, MODEL_DIRECTIVE, ATC, ATC_DB_ID, QUEUE_NAME,
  ATC2, PA, PFM_M, LRX_DRAFT, TRA2_DRAFT, EIA, ATE_QUEUE_NAME, TRIPLE_QUEUE_NAME, AI_ADJ, seedATC, teardownATC };

if (require.main === module) {
  (async () => {
    const mode = process.argv[2];
    if (mode === '--seed') await seedATC();
    else if (mode === '--teardown') { const n = await teardownATC(); console.log('[seed-atc] torn down', n, 'default-DB docs + ATC collections for run', RUN); }
    else { console.log('usage: seed-atc.js --seed | --teardown'); process.exit(1); }
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
