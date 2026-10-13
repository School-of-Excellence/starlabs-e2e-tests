// @ts-nocheck
// atc.ts — actors, login, guards and Material helpers for the ATC suite (Prescribe / Edit / View Prescribed ATC).
//
// OPERATOR RULE (2026-10-13): NEVER test ATC against the development or production databases — emulator only.
// Three layers enforce it (plan §3):
//   G1  atc/seed-atc.js refuses to run without the emulator hosts (and so does this module — it requires it).
//   G2  installAtcGuards() aborts EVERY browser request to a real Firestore / Storage host and records it;
//       assertNoRealDb() fails the test if anything tried. A missing firestore-atc emulator wiring in main.ts
//       therefore shows up as a red test, never as a silent read of a real database.
//   G3  emulator-wiring.spec.ts proves a doc that exists ONLY in the emulator's firestore-atc renders.
import { Page, Locator, expect } from '@playwright/test';
import { loginAs } from '../../queue/support/actors';
import { installAllExternalStubs } from '../../queue/stubs';
import { installProdFirewall } from '../../_shared/prod-firewall';

const S = require('../seed-atc');
const { initAdminAuto } = require('../../lib/seed-common');
const { getFirestore } = require('firebase-admin/firestore');

export const RUN: string = S.RUN;
export const PF = S.PF;
export const EMAIL = S.EMAIL;
export const ACT = S.ACT;
export const ACT_NAME = S.ACT_NAME;
export const PROC = S.PROC;
export const PROC_NAME = S.PROC_NAME;
export const MODEL = S.MODEL;
export const MODEL_DIRECTIVE = S.MODEL_DIRECTIVE;
export const ATC = S.ATC;
export const PASSWORD = 'Test!1234';

/** users_roles.name == the actor's email (seedAuthChain), so that is the label every picker renders. */
export const NAME = EMAIL;

// ---- Admin SDK handles (EMULATOR — G1 has already verified the env in seed-atc) ------------------------
export function defaultDb() { return initAdminAuto().firestore(); }
export function atcDb() { return getFirestore(initAdminAuto().app(), S.ATC_DB_ID); }
export function storageBucket() { return initAdminAuto().storage().bucket(`${process.env.FIREBASE_PROJECT || 'starlabs-cicd'}.appspot.com`); }

export async function atcDoc(path: string): Promise<any | null> {
  const s = await atcDb().doc(path).get();
  return s.exists ? s.data() : null;
}
export async function atcDocs(path: string): Promise<{ id: string; path: string; data: any }[]> {
  const s = await atcDb().collection(path).get();
  return s.docs.map((d) => ({ id: d.id, path: d.ref.path, data: d.data() }));
}
/** Poll fn until it returns a truthy value (or throw with `what` after timeoutMs). */
export async function waitFor<T>(fn: () => Promise<T>, what: string, timeoutMs = 30_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  let last: T;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timed out after ${timeoutMs}ms waiting for: ${what}`);
}
/** Doc ids in an ATC collection, so a test can find the doc the APP created (anti-circular). */
export async function atcIds(coll: string): Promise<Set<string>> {
  return new Set((await atcDb().collection(coll).get()).docs.map((d) => d.id));
}

// ---- guards + stubs -----------------------------------------------------------------------------------
export interface AtcGuard { realDbHits: string[]; staticAssetBlocks: string[]; dialogs: string[]; confirmAnswer: boolean }

const REAL_DB = /^https?:\/\/(firestore|firebasestorage|storage)\.googleapis\.com\//i;
// The app shell hard-codes a few branding images (logo, default avatar) as download URLs on the production
// bucket (`…/o/<file>.png?alt=media&token=…`). They are ABORTED like everything else (nothing leaves the
// browser) but are not a database access, so they are recorded separately instead of failing the test.
// Anything else — any Firestore API call, any Storage upload / list / metadata call — fails it.
const STATIC_ASSET = /^https?:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/[^?]+\.(png|jpe?g|svg|gif|webp)\?alt=media/i;

/**
 * Install per-test safety + stubs. `guard.confirmAnswer` decides what a native confirm() returns (default OK;
 * a test may flip it mid-flow).
 * Every native alert/confirm message is recorded in guard.dialogs.
 */
export async function installAtcGuards(page: Page, opts: { confirmAnswer?: boolean } = {}): Promise<AtcGuard> {
  const guard: AtcGuard = { realDbHits: [], staticAssetBlocks: [], dialogs: [], confirmAnswer: opts.confirmAnswer !== false };
  await installProdFirewall(page);
  installAllExternalStubs(page);
  // G2 — EVERY request to a real Firestore/Storage backend is aborted. Database-shaped ones fail the test.
  await page.route(REAL_DB, (route) => {
    const req = route.request();
    if (req.method() === 'GET' && STATIC_ASSET.test(req.url())) guard.staticAssetBlocks.push(req.url());
    else guard.realDbHits.push(`${req.method()} ${req.url()}`);
    return route.abort();
  });
  // Connectivity probes the ATC screens poll (NetworkStatusService / ConnectivityGuardService). A sandbox
  // that blocks them would show "You're offline" and block submit — stub both as healthy.
  await page.route(/jsonplaceholder\.typicode\.com/i, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route(/gstatic\.com\/generate_204/i, (r) => r.fulfill({ status: 204, body: '' }));
  page.on('dialog', async (d) => {
    guard.dialogs.push(`${d.type()}: ${d.message()}`);
    try { d.type() === 'confirm' && !guard.confirmAnswer ? await d.dismiss() : await d.accept(); } catch { /* already handled */ }
  });
  return guard;
}

export function assertNoRealDb(guard: AtcGuard) {
  expect(guard.realDbHits, 'G2: the app must NEVER contact a real Firestore/Storage backend while testing ATC').toEqual([]);
}

export async function loginAsAtc(page: Page, who: keyof typeof EMAIL = 'admin') {
  await loginAs(page, EMAIL[who], PASSWORD);
}

// ---- Material helpers ---------------------------------------------------------------------------------
const tid = (id: string) => `[data-testid="${id}"]`;
export { tid };

/** Open a mat-select and click the option(s) whose text matches; closes a multi-select with Escape. */
export async function pickOptions(page: Page, select: Locator, labels: (string | RegExp)[], multiple = true) {
  // Click the enclosing mat-form-field (its container click opens the select): an empty outline field's
  // floating <mat-label> sits over the select and intercepts a direct click.
  const field = select.locator('xpath=ancestor::mat-form-field[1]');
  if (await field.count()) await field.click(); else await select.click();
  const panel = page.locator('.cdk-overlay-pane .mat-mdc-select-panel').last();
  await expect(panel).toBeVisible();
  for (const l of labels) {
    await panel.locator('mat-option').filter({ hasText: l }).first().click();
  }
  if (multiple) {
    await page.keyboard.press('Escape');
  }
  await expect(page.locator('.cdk-overlay-pane .mat-mdc-select-panel')).toHaveCount(0);
}

/** Selected-value text a mat-select currently shows. */
export async function selectText(select: Locator): Promise<string> {
  return ((await select.locator('.mat-mdc-select-value').innerText()) || '').trim();
}

/** Tiny valid WAV / PNG payloads for the media upload cases. */
export function wavBuffer(): Buffer {
  const sampleRate = 8000, n = 800;
  const b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i++) b[44 + i] = 128;
  return b;
}
export function pngBuffer(): Buffer {
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
}
