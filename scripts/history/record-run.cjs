#!/usr/bin/env node
/*
 * record-run.cjs — APPEND-ONLY CI/CD run history (the report-overwrite fix).
 *
 * Problem: Playwright writes to playwright-report/ every run, so each run clobbers the last. This script
 * captures a run as an IMMUTABLE record keyed by run-id + SHA + branch + author + timestamp, and stores it in
 * the `starlabs-cicd` project: the HTML report + any attachments (e.g. the seed snapshot) go to Cloud Storage,
 * and a queryable index doc goes to Firestore `cicd-audit`. Nothing is ever overwritten — a duplicate run-id
 * is REFUSED. Local CLI runs and CI runs write to the SAME store (distinguished by `source`).
 *
 * Usage (env-driven; all optional except a service-account file):
 *   STARLABS_CICD_SA=/abs/sa.json \      # or GOOGLE_APPLICATION_CREDENTIALS — the starlabs-cicd SA
 *   REPO=starlabs-angular BRANCH=feature/x SHA=$(git rev-parse HEAD) ACTOR=vignesh-027 \
 *   SOURCE=ci RESULT=pass SUITE=queue STAGE=gate \
 *   REPORT_DIR=playwright-report ATTACH=fixtures/sample-queue-config.json,fixtures/firestore-seed.json \
 *   node scripts/history/record-run.cjs
 *
 * Behavior:
 *   - No SA file present  → logs and exits 0 (non-fatal; history is best-effort so it never blocks a gate).
 *   - Duplicate run-id    → exits 1 (immutability guard). Pass a unique RUN_ID to retry.
 *   - On any other error  → exits 0 unless HISTORY_STRICT=1 (so a flaky upload doesn't red a green gate).
 */
const fs = require('fs');
const path = require('path');

const env = (k, d) => {
  const v = process.env[k];
  return v === undefined || v === '' ? d : v;
};
const STRICT = env('HISTORY_STRICT', '0') === '1';
const die = (code, msg) => { if (msg) console.error(msg); process.exit(STRICT ? code : 0); };

const SA = env('STARLABS_CICD_SA') || env('GOOGLE_APPLICATION_CREDENTIALS');
if (!SA || !fs.existsSync(SA)) {
  console.log('[history] no service-account file (STARLABS_CICD_SA / GOOGLE_APPLICATION_CREDENTIALS) — skipping history write (non-fatal).');
  process.exit(0);
}

let admin;
try { admin = require('firebase-admin'); }
catch (e) { console.log('[history] firebase-admin not installed — skipping history write (non-fatal).'); process.exit(0); }

const PROJECT = env('HISTORY_PROJECT', 'starlabs-cicd');
const BUCKET = env('HISTORY_BUCKET', `${PROJECT}.appspot.com`);

const meta = {
  repo: env('REPO', 'unknown'),
  suite: env('SUITE', 'queue'),
  stage: env('STAGE', 'gate'),
  branch: env('BRANCH', 'unknown'),
  sha: env('SHA', 'unknown'),
  author: env('ACTOR', 'unknown'),
  source: env('SOURCE', 'local'),   // ci | local
  result: env('RESULT', 'unknown'), // pass | fail | unknown
  // GitHub Actions run id — lets the release console deep-link this report from a
  // workflow_run webhook (which only carries the numeric run id). See console gateRun.
  githubRunId: env('GITHUB_RUN_ID', ''),
  createdAt: new Date().toISOString(),
};
const runId = (env('RUN_ID') || `${meta.repo}-${meta.branch}-${meta.sha.slice(0, 7)}-${Date.now()}`)
  .replace(/[^A-Za-z0-9._-]/g, '-');
meta.runId = runId;

function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else out.push(p);
    }
  };
  walk(dir);
  return out;
}

(async () => {
  admin.initializeApp({
    credential: admin.credential.cert(require(path.resolve(SA))),
    storageBucket: BUCKET,
    projectId: PROJECT,
  });
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  // Immutability guard: never overwrite an existing run record.
  const docRef = db.collection('cicd-audit').doc(runId);
  if ((await docRef.get()).exists) {
    return die(1, `[history] cicd-audit/${runId} already exists — refusing to overwrite (append-only). Pass a unique RUN_ID.`);
  }

  const base = `cicd-audit/${meta.repo}/${runId}`;
  const uploadInto = async (localPath, subdir) => {
    const urls = [];
    if (!localPath || !fs.existsSync(localPath)) return urls;
    const isDir = fs.statSync(localPath).isDirectory();
    const files = isDir ? listFiles(localPath) : [localPath];
    for (const f of files) {
      const rel = isDir ? path.relative(localPath, f) : path.basename(f);
      const dest = `${base}/${subdir}/${rel}`;
      await bucket.upload(f, { destination: dest, resumable: false });
      urls.push(`gs://${bucket.name}/${dest}`);
    }
    return urls;
  };

  const report = await uploadInto(env('REPORT_DIR', 'playwright-report'), 'report');
  const attachments = [];
  for (const a of env('ATTACH', '').split(',').map((s) => s.trim()).filter(Boolean)) {
    attachments.push(...await uploadInto(a, `attach/${path.basename(a)}`));
  }

  await docRef.set({ ...meta, storage: { base: `gs://${bucket.name}/${base}`, report, attachments } });
  console.log(`[history] ✓ cicd-audit/${runId}  (${report.length} report files, ${attachments.length} attachments)  → gs://${bucket.name}/${base}`);
  process.exit(0);
})().catch((e) => die(1, `[history] FAILED: ${e && e.message ? e.message : e}`));
