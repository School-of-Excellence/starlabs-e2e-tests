/**
 * big-ladder-seed.ts — the world for queue/big-ladder.spec.ts (/big-leaderboard, surya 7a23f823).
 *
 * OWN RUN TAG `<testrunid>_bld`: seedBigWorld's docs are counted exactly by other big specs, so nothing here
 * hangs off its participants. The leaderboard lists every `participant metadata` whose active (or last
 * completed) journey is a B!G journey (journey.atcmodel == 'B!G') and joins per profile:
 *   events attended   = distinct B!G events (event collection.atcmodel 'B!G') with an EPR status 'attended'
 *   activity          = big participants assignments whose assignmentref is a `big assignment` with status
 *                       initiated|ongoing|completed → "<completed> / <all>"
 *   studio            = count of `queue activity log` docs
 *   eiflix            = DISTINCT videoid over `content analytics` status 'complete' of an eiflix type
 * Every rule has a doc that must be excluded (see NEG markers).
 * `big assignment` is the plain B!G assignment collection (also seeded by big-seed.ts) — NOT the ATC-fenced
 * `big assignment_*` / `atc_*` families.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { db } = require('../queue/support/firestore-admin');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const adminSdk = require('firebase-admin');

export const BLD_COLLECTIONS = [
  'journey', 'participant metadata', 'event collection', 'event participation request', 'big assignment',
  'big participants assignments', 'queue activity log', 'content analytics',
];

export interface BigLadderWorld {
  tag: string;
  names: { active: string; nonActive: string; other: string };
}

export async function seedBigLadder(testrunid: string): Promise<BigLadderWorld> {
  const RUN = `${testrunid}_bld`;
  const T = adminSdk.firestore.Timestamp;
  const d = db();
  const tag = { testrunid: RUN, _testdata: true };
  const set = (c: string, id: string, data: any) => d.collection(c).doc(id).set({ docid: id, ...data, ...tag });
  const ref = (c: string, id: string) => d.collection(c).doc(id);
  const label = `BLD-${testrunid}`;
  const names = { active: `${label} Active`, nonActive: `${label} Nonactive`, other: `${label} Other` };
  const pf = { active: `${RUN}_pf_active`, nonActive: `${RUN}_pf_nonactive`, other: `${RUN}_pf_other` };

  await set('journey', `${RUN}_j_big`, { id: `${RUN}_j_big`, journey: `${label} B!G Journey`, atcmodel: 'B!G' });
  await set('journey', `${RUN}_j_lyl`, { id: `${RUN}_j_lyl`, journey: `${label} LYL Journey`, atcmodel: 'LYL' }); // NEG
  await set('participant metadata', pf.active, { profileid: pf.active, name: names.active, customerstatus: 'active', activejourney: `${RUN}_j_big`, extendedlifeimpact: 7 });
  await set('participant metadata', pf.nonActive, { profileid: pf.nonActive, name: names.nonActive, customerstatus: 'non active', activejourney: '', lastcompletedjourney: `${RUN}_j_big` });
  await set('participant metadata', pf.other, { profileid: pf.other, name: names.other, customerstatus: 'active', activejourney: `${RUN}_j_lyl` }); // NEG: not B!G

  await set('event collection', `${RUN}_ev_big`, { name: `${label} B!G Event`, atcmodel: 'B!G' });
  await set('event collection', `${RUN}_ev_lyl`, { name: `${label} LYL Event`, atcmodel: 'LYL' });
  const epr = (id: string, who: string, ev: string, status: string) =>
    set('event participation request', `${RUN}_${id}`, { profileid: who, eventref: ref('event collection', `${RUN}_${ev}`), status });
  await epr('epr_big', pf.active, 'ev_big', 'attended');
  await epr('epr_big_dup', pf.active, 'ev_big', 'attended');     // NEG: same event twice → still 1
  await epr('epr_lyl', pf.active, 'ev_lyl', 'attended');         // NEG: non-B!G event
  await epr('epr_req', pf.nonActive, 'ev_big', 'approved');      // NEG: not attended

  await set('big assignment', `${RUN}_a_on`, { title: `${label} Assignment`, status: 'ongoing', enddate: T.fromMillis(Date.now() + 7 * 86400e3) });
  await set('big assignment', `${RUN}_a_draft`, { title: `${label} Draft`, status: 'draft' }); // NEG: status not read
  const act = (id: string, a: string, status: string) =>
    set('big participants assignments', `${RUN}_${id}`, { profileid: pf.active, assignmentref: ref('big assignment', `${RUN}_${a}`), status });
  await act('pa_done', 'a_on', 'completed');
  await act('pa_review', 'a_on', 'review');
  await act('pa_draft', 'a_draft', 'completed');                  // NEG: its assignment isn't loaded

  await set('queue activity log', `${RUN}_qal_1`, { profileid: pf.active });
  await set('queue activity log', `${RUN}_qal_2`, { profileid: pf.active });

  const ca = (id: string, videoid: string, status: string, type = 'eiflix') =>
    set('content analytics', `${RUN}_${id}`, { profileid: pf.active, videoid, status, type });
  await ca('ca_1', `${RUN}_v1`, 'complete');
  await ca('ca_1b', `${RUN}_v1`, 'complete');                     // NEG: same video → distinct count 1
  await ca('ca_2', `${RUN}_v2`, 'incomplete');                    // NEG: not complete
  await ca('ca_3', `${RUN}_v3`, 'complete', 'workshop');          // NEG: not an eiflix type

  return { tag: label, names };
}

export async function teardownBigLadder(testrunid: string): Promise<void> {
  const d = db();
  for (const c of BLD_COLLECTIONS) {
    const snap = await d.collection(c).where('testrunid', '==', `${testrunid}_bld`).get();
    for (const doc of snap.docs) await doc.ref.delete();
  }
}
