/**
 * no-retrigger-loop — the CF PREDEPLOY guard (plan L14, locked 2026-07-02).
 *
 * THE test case (operator): "a function must not retrigger the same CF and create a loop."
 * Unbounded self-retriggering in production = runaway invocations = quota/billing burn.
 *
 * GENERIC + MANIFEST-DRIVEN: reads functions-manifest.json from the deploying CF repo (CF_DIR),
 * takes every Firestore-trigger function with a known trigger path, seeds ONE create + ONE update
 * on each path in the local emulator, then watches the emulator log:
 *   1. GROWTH check — after the settle window, executions must STOP (flat between two samples).
 *   2. BOUND check  — total executions per function ≤ GUARD_MAX_EXECUTIONS (default 3:
 *      create + update + 1 margin). THRESHOLD-based, not zero-tolerance: one legitimate
 *      self-write (set-flag-then-guard) is a valid pattern; the disaster is unbounded growth.
 *
 * New functions are covered automatically — no per-function test authoring, ever.
 *
 * Env (set by scripts/cf-predeploy.sh):
 *   CF_DIR                    CF repo root (has functions-manifest.json)      [required]
 *   EMU_LOG                   functions-emulator log file                     [required]
 *   FIRESTORE_EMULATOR_HOST   e.g. localhost:8080                            [required]
 *   FIREBASE_PROJECT          emulator project id (default starlabs-cicd)
 *   GUARD_SETTLE_MS           first settle window (default 15000)
 *   GUARD_GROWTH_MS           growth-sample gap after settle (default 8000)
 *   GUARD_MAX_EXECUTIONS      per-function execution bound (default 3)
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

interface ManifestFn {
  name: string;
  type: string;
  file?: string;
  triggerPath?: string;
  database?: string;
}

const CF_DIR = process.env.CF_DIR || './starlabs-cloud-function';
const EMU_LOG = process.env.EMU_LOG || '';
const PROJECT = process.env.FIREBASE_PROJECT || 'starlabs-cicd';
const SETTLE_MS = Number(process.env.GUARD_SETTLE_MS || 15000);
const GROWTH_MS = Number(process.env.GUARD_GROWTH_MS || 8000);
const MAX_EXEC = Number(process.env.GUARD_MAX_EXECUTIONS || 3);

const FIRESTORE_TRIGGER_TYPES = new Set([
  'onDocumentCreated', 'onDocumentUpdated', 'onDocumentWritten', 'onDocumentDeleted',
  'onCreate', 'onUpdate', 'onWrite', 'onDelete',
]);

function loadManifest(): ManifestFn[] {
  const p = path.join(CF_DIR, 'functions-manifest.json');
  if (!fs.existsSync(p)) {
    throw new Error(
      `functions-manifest.json not found at ${p} — the CF predeploy hook must run ` +
      `\`npm run manifest\` (scripts/cicd/generate-manifest.js) before invoking this guard.`,
    );
  }
  const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
  return (parsed.functions ?? []) as ManifestFn[];
}

/** Count "Beginning execution of "…<name>"" lines in the emulator log (v1 + v2 formats). */
function countExecutions(log: string, name: string): number {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Function ids appear as "<name>" or "<region>-<name>" — anchor to the closing quote.
  const re = new RegExp(`Beginning execution of "[^"]*?${esc}"`, 'g');
  return (log.match(re) ?? []).length;
}

function readLog(): string {
  try { return fs.readFileSync(EMU_LOG, 'utf8'); } catch { return ''; }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Build a concrete doc path from a trigger template like "atc_alpha/{id}" or "a/{x}/b/{y}". */
function docPathFor(triggerPath: string, stamp: string): string | null {
  const p = triggerPath.replace(/\{[^}]+\}/g, `loopguard-${stamp}`);
  const segs = p.split('/').filter(Boolean);
  if (segs.length < 2 || segs.length % 2 !== 0) return null; // must resolve to a DOCUMENT path
  return segs.join('/');
}

test('no Cloud Function retriggers itself into a loop (predeploy gate)', async () => {
  expect(EMU_LOG, 'EMU_LOG must point at the functions-emulator log').toBeTruthy();
  expect(process.env.FIRESTORE_EMULATOR_HOST, 'must run against the local emulator').toBeTruthy();

  // GUARD_ONLY (operator lock 2026-07-03): a scoped `firebase deploy --only functions:…` guards
  // ONLY the deploying functions; empty = full deploy = guard everything.
  const ONLY = (process.env.GUARD_ONLY ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const fns = loadManifest().filter(
    (f) =>
      FIRESTORE_TRIGGER_TYPES.has(f.type) &&
      !!f.triggerPath &&
      (ONLY.length === 0 || ONLY.includes(f.name)),
  );
  if (ONLY.length > 0) {
    console.log(`[cf-guard] scoped to deploying functions: ${ONLY.join(', ')}`);
  }
  test.info().annotations.push({
    type: 'coverage',
    description: `${fns.length} Firestore-trigger function(s) under guard`,
  });
  if (fns.length === 0) {
    console.log('[cf-guard] no Firestore-trigger functions in the manifest — nothing to guard.');
    return;
  }

  const app: App = getApps()[0] ?? initializeApp({ projectId: PROJECT });
  const stamp = String(Date.now());
  const dbs = new Map<string, Firestore>();
  const dbFor = (id?: string): Firestore => {
    const key = id && id !== '(default)' ? id : '(default)';
    if (!dbs.has(key)) dbs.set(key, key === '(default)' ? getFirestore(app) : getFirestore(app, key));
    return dbs.get(key)!;
  };

  // Baseline BEFORE seeding — the emulator may have logged executions during boot/discovery.
  const baseline = readLog();
  const baseCounts = new Map(fns.map((f) => [f.name, countExecutions(baseline, f.name)]));

  // Seed: one CREATE + one UPDATE per trigger path (covers created/updated/written triggers).
  const seeded: { fn: ManifestFn; ref: FirebaseFirestore.DocumentReference }[] = [];
  for (const fn of fns) {
    const docPath = docPathFor(fn.triggerPath!, stamp);
    if (!docPath) {
      console.log(`[cf-guard] SKIP ${fn.name}: trigger path "${fn.triggerPath}" does not resolve to a document`);
      continue;
    }
    try {
      const ref = dbFor(fn.database).doc(docPath);
      await ref.set({ __loopguard: true, seededAt: stamp });
      await ref.update({ __loopguardTouch: stamp });
      seeded.push({ fn, ref });
      console.log(`[cf-guard] seeded ${fn.name} ← ${docPath}${fn.database ? ` (db ${fn.database})` : ''}`);
    } catch (e) {
      console.log(`[cf-guard] SKIP ${fn.name}: seed failed (${(e as Error).message?.slice(0, 120)})`);
    }
  }
  expect(seeded.length, 'at least one trigger must be seedable').toBeGreaterThan(0);

  // Settle, sample, then sample again — a loop shows up as GROWTH between the two samples.
  console.log(`[cf-guard] settling ${SETTLE_MS}ms …`);
  await sleep(SETTLE_MS);
  const sample1 = readLog();
  await sleep(GROWTH_MS);
  const sample2 = readLog();

  const failures: string[] = [];
  let uncovered = 0;
  for (const { fn } of seeded) {
    const base = baseCounts.get(fn.name) ?? 0;
    const c1 = countExecutions(sample1, fn.name) - base;
    const c2 = countExecutions(sample2, fn.name) - base;
    const growth = c2 - c1;
    if (c2 === 0) {
      // COVERAGE HONESTY: the emulator boots the FILTERED entry (index.emulator.js) — a trigger not
      // exported there never executes, which is "no coverage", NOT "passed". Widen index.emulator.js
      // to widen the guard.
      uncovered++;
      console.log(`[cf-guard] ${fn.name}: ⚠ 0 executions — not loaded in index.emulator.js? NO COVERAGE (not a pass)`);
      continue;
    }
    console.log(`[cf-guard] ${fn.name}: executions=${c2} (settle=${c1}, growth=+${growth}, max=${MAX_EXEC})`);
    if (growth > 0) {
      failures.push(`${fn.name}: STILL EXECUTING after the settle window (+${growth} in ${GROWTH_MS}ms) — self-retrigger loop`);
    } else if (c2 > MAX_EXEC) {
      failures.push(`${fn.name}: ${c2} executions for 1 create + 1 update (bound ${MAX_EXEC}) — retrigger cascade`);
    }
  }
  if (uncovered > 0) {
    console.log(`[cf-guard] coverage: ${seeded.length - uncovered}/${seeded.length} seeded triggers actually executed`);
  }

  // Cleanup (best-effort — emulator data is disposable anyway).
  for (const { ref } of seeded) { try { await ref.delete(); } catch { /* ignore */ } }

  expect(
    failures,
    `LOOP GUARD FAILED — deploy must be blocked:\n  ${failures.join('\n  ')}\n` +
    `Fix: add a before/after diff guard (early return) to the function, then redeploy.`,
  ).toEqual([]);
});
