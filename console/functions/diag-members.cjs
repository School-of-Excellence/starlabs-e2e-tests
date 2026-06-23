#!/usr/bin/env node
/**
 * Inspect (and optionally seed) the CICD-Users collection in starlabs-cicd.
 *
 * Inspect:  SA=/path/to/serviceAccount.json node diag-members.cjs
 * Seed:     SA=/path/to/serviceAccount.json SEED=1 node diag-members.cjs vignesh.s@soexcellence.com "Vignesh"
 *
 * SA path is read from $SA, $STARLABS_CICD_SA, or $GOOGLE_APPLICATION_CREDENTIALS.
 * Members live one-doc-per-member in the top-level `CICD-Users` collection
 * (doc id = lowercased email) in the (default) database — what the console reads.
 */
const path = require('path');
const admin = require('firebase-admin');

const saPath = process.env.SA || process.env.STARLABS_CICD_SA || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!saPath) {
  console.error('No service account. Run:  SA=/path/to/serviceAccount.json node diag-members.cjs');
  process.exit(1);
}

const TARGET = (process.argv[2] || 'vignesh.s@soexcellence.com').toLowerCase();
const DISPLAY = process.argv[3] || 'Vignesh';
const SEED = process.env.SEED === '1';

admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(saPath))),
  projectId: 'starlabs-cicd',
});

(async () => {
  const db = admin.firestore(); // (default) database
  const col = db.collection('CICD-Users');

  if (SEED) {
    await col.doc(TARGET).set(
      {
        email: TARGET,
        displayName: DISPLAY,
        roles: ['admin', 'developer', 'tester'],
        active: true,
        addedBy: 'bootstrap',
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`SEEDED  CICD-Users/${TARGET}  (admin, developer, tester, active)\n`);
  }

  const snap = await col.doc(TARGET).get();
  console.log(`GATE LOOKUP  CICD-Users/${TARGET}`);
  console.log(`  exists: ${snap.exists}`);
  if (snap.exists) console.log('  data:  ', JSON.stringify(snap.data()));
  console.log('');

  const all = await col.listDocuments();
  console.log(`CICD-Users — ${all.length} doc(s): ${all.map((d) => d.id).join(', ') || '(none)'}`);

  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e && e.message ? e.message : e);
  process.exit(1);
});
