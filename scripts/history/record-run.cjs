#!/usr/bin/env node
/*
 * record-run.cjs — APPEND-ONLY CI/CD run history.
 *
 * Captures a run as an IMMUTABLE record keyed by run-id + SHA + branch + author + timestamp, stored in the
 * `starlabs-cicd` project: the HTML report + any attachments go to Cloud Storage, and a queryable index doc
 * goes to Firestore `cicd-audit`. Nothing is overwritten — a duplicate run-id is REFUSED.
 *
 * STORAGE UPLOAD (why raw REST, not admin.storage().bucket().upload):
 *   The @google-cloud/storage SDK bundled under firebase-admin uses an old gaxios/JWT stack whose token fetch
 *   intermittently dies with ERR_STREAM_PREMATURE_CLOSE on CI runners. We bypass it: we mint an access token
 *   via firebase-admin's OWN credential (admin's token path, modern endpoint — the path that works for
 *   Firestore) and PUT each file to the GCS JSON upload API directly. No @google-cloud/storage auth involved.
 *
 * RESILIENCE: the Storage upload is best-effort and DECOUPLED from the Firestore write — a failed upload never
 *   loses the record. The Firestore doc is ALWAYS written (with whatever uploaded, plus RUN_URL), so the run is
 *   captured even if Storage is unreachable. If/when Storage auth is healthy the same code populates GCS too.
 *
 * Usage (env-driven; all optional except a service-account file):
 *   STARLABS_CICD_SA=/abs/sa.json REPO=… BRANCH=… SHA=… ACTOR=… SOURCE=ci RESULT=pass SUITE=queue STAGE=gate \
 *   REPORT_DIR=playwright-report ATTACH=a.json,b.json RUN_URL=https://github.com/…/actions/runs/123 \
 *   node scripts/history/record-run.cjs
 *
 * Behavior:
 *   - No SA file present  → logs and exits 0 (non-fatal; history is best-effort so it never blocks a gate).
 *   - Duplicate run-id    → exits 1 (immutability guard). Pass a unique RUN_ID to retry.
 *   - On any other error  → exits 0 unless HISTORY_STRICT=1 (so a flaky write doesn't red a green gate).
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
const PREFIX = env('HISTORY_PREFIX', 'cicd-audit'); // top-level "folder" (object-name prefix) inside the bucket

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

const MIME = {
  '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webm': 'video/webm', '.zip': 'application/zip', '.txt': 'text/plain', '.md': 'text/markdown',
  '.svg': 'image/svg+xml', '.xml': 'application/xml', '.woff2': 'font/woff2', '.map': 'application/json',
};
const mimeOf = (f) => MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';

(async () => {
  const credential = admin.credential.cert(require(path.resolve(SA)));
  admin.initializeApp({ credential, storageBucket: BUCKET, projectId: PROJECT });
  const db = admin.firestore();

  // Immutability guard: never overwrite an existing run record. (Firestore over gRPC — the working auth path.)
  const docRef = db.collection('cicd-audit').doc(runId);
  if ((await docRef.get()).exists) {
    return die(1, `[history] cicd-audit/${runId} already exists — refusing to overwrite (append-only). Pass a unique RUN_ID.`);
  }

  const base = `${PREFIX}/${meta.repo}/${runId}`;

  // Upload via the GCS JSON API using firebase-admin's own access token (bypasses the broken @google-cloud/storage auth).
  const uploadInto = async (localPath, subdir) => {
    const urls = [];
    if (!localPath || !fs.existsSync(localPath)) return urls;
    const isDir = fs.statSync(localPath).isDirectory();
    const files = isDir ? listFiles(localPath) : [localPath];
    const { access_token: token } = await credential.getAccessToken();
    for (const f of files) {
      const rel = isDir ? path.relative(localPath, f) : path.basename(f);
      const dest = `${base}/${subdir}/${rel}`.split(path.sep).join('/');
      const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(BUCKET)}/o?uploadType=media&name=${encodeURIComponent(dest)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeOf(f) },
        body: fs.readFileSync(f),
      });
      if (!res.ok) throw new Error(`GCS upload ${res.status} for ${dest}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
      urls.push(`gs://${BUCKET}/${dest}`);
    }
    return urls;
  };

  // Best-effort + DECOUPLED: a Storage failure must NOT prevent the Firestore record from being written.
  let report = [];
  try { report = await uploadInto(env('REPORT_DIR', 'playwright-report'), 'report'); }
  catch (e) { console.error(`[history] report upload to GCS failed (non-fatal; Firestore record still written): ${e && e.message}`); }

  const attachments = [];
  for (const a of env('ATTACH', '').split(',').map((s) => s.trim()).filter(Boolean)) {
    try { attachments.push(...await uploadInto(a, `attach/${path.basename(a)}`)); }
    catch (e) { console.error(`[history] attachment upload failed (non-fatal): ${a}: ${e && e.message}`); }
  }

  await docRef.set({
    ...meta,
    runUrl: env('RUN_URL', ''),
    storage: { base: `gs://${BUCKET}/${base}`, report, attachments },
  });
  console.log(`[history] ✓ cicd-audit/${runId}  (${report.length} report files, ${attachments.length} attachments)  → gs://${BUCKET}/${base}`);
  process.exit(0);
})().catch((e) => die(1, `[history] FAILED: ${e && e.stack ? e.stack : e}`));
