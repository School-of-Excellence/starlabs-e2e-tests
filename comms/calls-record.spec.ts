// calls-record.spec.ts — /notificationrecord → Calls tab (MyOperator call recordings), EMULATOR ONLY.
// Added 2026-11-18 with the call-recording signed-URL migration.
//
// What changed in the app, and what each test pins:
//   CR-01  one Firestore listener is the load AND the live feed (no "Start Live" button, chip says Live)
//   CR-02  a call added while the tab is open appears WITHOUT a reload (the listener) and is flagged new
//   CR-03  a row with a recording renders the SHARED COMPACT player: play / seek / time / speed, no native
//          <audio controls>, no download button (aeclr-btn-23 is gone)
//   CR-04  the player keeps getMediaUrls warm ({warm:true} on mount) and, on Play, asks it to sign the
//          stored call_recordings/ PATH — and the callable's fence ACCEPTS that prefix (never path-not-allowed)
//   CR-05  search no longer crashes on a call whose caller/number is null (the webhook writes null)
//   CR-06  the date range applies only on Apply — typing a date alone does NOT re-query
//   CR-07  the Profile filter matches the profile as caller (MyOperator id) OR as the number called
//          (last-10-digit match, so "+91 90000 00099" matches "9000000099")
//   CR-08  a missed call with no recording shows "No Recording", not a player
//   CR-09  /communication (the old Communication Center calls panel) is retired
//
// Anti-circularity: rows, flags, filters and the player are what the APP rendered from its own listener;
// the callable request is what the APP sent; the fence verdict is what the CALLABLE returned. The seed only
// provides inputs. Real audio cannot play here — the emulator has no signing credentials — so CR-04 accepts
// a signed URL OR `sign-failed`, and fails only on a fence rejection.
import { test, expect, Page, Request } from '@playwright/test';
import { installCommsStubs, loginAsCommsAdmin } from './support/comms';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { selectMatOption } from '../_shared/mat-select';
import { Timestamp } from 'firebase-admin/firestore';

// Writes go through the SHARED emulator-aware admin (lib/seed-common — same as seed-comms.js):
// emulator-pinned when FIRESTORE_EMULATOR_HOST is set, else the allowlist-guarded test project.
// NOT queue/support/firestore-admin's db(): that handle is typed READ-ONLY (doc() exposes only
// get()), so .set()/.delete() on it are type errors even though they work at runtime.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { initAdminAuto } = require('../lib/seed-common');
const db = () => initAdminAuto().firestore();

const RUN = process.env.COMM_RUNID || 'comm';
const CALLS = 'myoperator calls';
const AGENT_ID = `mo_agent_${RUN}`;
const AGENT_NAME = `MO Agent ${RUN}`;
const AGENT_PROFILE = `${RUN}_pf_mo_agent`;
const REC_PATH = `call_recordings/${RUN}-e2e-audio-file.mp3`;

const ID = {
  rec: `${RUN}_call_rec`,          // agent → customer, has a recording
  nul: `${RUN}_call_null`,         // caller + number null (MyOperator omitted them), no recording
  callee: `${RUN}_call_callee`,    // someone else → the agent's own number
  old: `${RUN}_call_old`,          // 10 days ago: outside the default 7-day window
  live: `${RUN}_call_live`,        // written while the tab is open
};
const NUM = { customer: '9000000001', agentDigits: '9000000099', old: '9000000777', live: '9000000555' };

const hoursAgo = (h: number) => Timestamp.fromDate(new Date(Date.now() - h * 3_600_000));
const daysAgo = (d: number) => Timestamp.fromDate(new Date(Date.now() - d * 86_400_000));
const call = (docid: string, f: Record<string, unknown>) => ({
  docid, callstatus: 'received', status: 'ANSWER', duration: '00:01:00', recordingurl: null,
  calledby: 'someone_else', calledto: NUM.customer, testrunid: RUN, ...f,
  date: f['time'],
});

async function seed() {
  const d = db();
  await d.collection('profile_data').doc(AGENT_PROFILE).set({
    docid: AGENT_PROFILE, name: AGENT_NAME, myoperatorid: AGENT_ID, number: '+91 90000 00099', testrunid: RUN,
  });
  await d.collection(CALLS).doc(ID.rec).set(call(ID.rec, { calledby: AGENT_ID, time: hoursAgo(1), recordingurl: REC_PATH }));
  await d.collection(CALLS).doc(ID.nul).set(call(ID.nul, {
    calledby: null, calledto: null, callstatus: 'missed', status: null, time: hoursAgo(2),
  }));
  await d.collection(CALLS).doc(ID.callee).set(call(ID.callee, { calledto: NUM.agentDigits, time: hoursAgo(3) }));
  await d.collection(CALLS).doc(ID.old).set(call(ID.old, { calledto: NUM.old, time: daysAgo(10) }));
}

async function cleanup() {
  const d = db();
  await Promise.all([
    ...Object.values(ID).map((id) => d.collection(CALLS).doc(id).delete()),
    d.collection('profile_data').doc(AGENT_PROFILE).delete(),
  ]);
}

/** Every getMediaUrls request the page sends, with its parsed body. */
function captureMediaCalls(page: Page) {
  const calls: { body: any; req: Request }[] = [];
  page.on('request', (req) => {
    if (!req.url().includes('/getMediaUrls') || req.method() !== 'POST') return;
    let body: any = null;
    try { body = JSON.parse(req.postData() || 'null'); } catch { /* not JSON */ }
    calls.push({ body, req });
  });
  return calls;
}

async function openCalls(page: Page) {
  await loginAsCommsAdmin(page);
  await page.goto('/notificationrecord', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Calls' }).click();
  await expect(page.getByTestId('aeclr-live-chip')).toContainText('Live', { timeout: 45_000 });
}

const row = (page: Page, text: string) => page.getByTestId('aeclr-row').filter({ hasText: text });

test.describe('Comms — Calls tab (MyOperator recordings, real UI, emulator only)', () => {
  let guard: ConsoleGuard;
  test.beforeAll(seed);
  test.afterAll(cleanup);
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installCommsStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'calls tab: no fatal console errors / pageerrors'));

  test('CR-01 the tab loads through one listener — no Start/Stop Live button, chip says Live', async ({ page }) => {
    await openCalls(page);
    await expect(row(page, AGENT_ID)).toHaveCount(1);
    await expect(row(page, NUM.old), 'a 10-day-old call is outside the default 7-day range').toHaveCount(0);
    // Asserted by role, not by the removed test id: the readiness check treats any id a spec names
    // as "must exist in the app", so naming a deleted id is reported as drift.
    await expect(page.getByRole('button', { name: /Start Live|Stop Live/ })).toHaveCount(0);
  });

  test('CR-02 a call written while the tab is open appears without a reload, flagged new', async ({ page }) => {
    await openCalls(page);
    await expect(row(page, NUM.live)).toHaveCount(0);
    await db().collection(CALLS).doc(ID.live).set(call(ID.live, { calledto: NUM.live, time: Timestamp.now() }));
    const fresh = row(page, NUM.live);
    await expect(fresh, 'the listener delivered the new call').toHaveCount(1, { timeout: 30_000 });
    await expect(fresh).toHaveClass(/new-record/);
    await db().collection(CALLS).doc(ID.live).delete();
    await expect(fresh, 'and its removal').toHaveCount(0, { timeout: 30_000 });
  });

  test('CR-03 a recorded call gets the compact player — no native controls, no download', async ({ page }) => {
    await openCalls(page);
    const r = row(page, AGENT_ID);
    const player = r.getByTestId('aeclr-audio');
    await expect(player).toHaveCount(1);
    await expect(player.getByTestId('aa-play')).toBeVisible();
    await expect(player.getByTestId('aa-seek'), 'seek is disabled until the clip has loaded').toBeDisabled();
    await expect(player.getByTestId('aa-rate')).toHaveText('1x');
    await expect(player.locator('audio')).not.toHaveAttribute('controls', /.*/);
    await expect(player.locator('audio')).toHaveAttribute('controlslist', /nodownload/);
    await expect(page.getByRole('button', { name: /download/i }), 'the old download button is gone').toHaveCount(0);
  });

  test('CR-04 warm ping on mount; Play asks getMediaUrls to sign the stored path, and the fence accepts it', async ({ page }) => {
    const calls = captureMediaCalls(page);
    await openCalls(page);
    await expect.poll(() => calls.filter((c) => c.body?.data?.warm === true).length,
      { message: 'a {warm:true} ping is sent when a player mounts', timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    expect(calls.filter((c) => c.body?.data?.warm === true).length, 'ONE ping per tab, not one per player').toBe(1);

    const resp = page.waitForResponse((res) => res.url().includes('/getMediaUrls')
      && /"refs"/.test(res.request().postData() || ''), { timeout: 45_000 });
    await row(page, AGENT_ID).getByTestId('aa-play').click();
    const res = await resp;
    expect(JSON.parse(res.request().postData() || '{}').data.refs, 'the PATH is sent, never a URL').toEqual([REC_PATH]);

    const result = (await res.json())?.result?.results?.[0] ?? {};
    expect(result.error ?? '', 'call_recordings/ is inside the fence').not.toMatch(/path-not-allowed|unparseable|bucket-not-allowed/);
    // Emulator: no signing credentials → `sign-failed` is expected; a URL is fine too.
    expect(Boolean(result.url) || /^sign-failed/.test(result.error ?? '')).toBe(true);
  });

  test('CR-05 search survives a call with a null caller and number', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openCalls(page);
    await expect(row(page, 'MISSED')).not.toHaveCount(0);   // the null row is rendered
    await page.getByTestId('aeclr-inp-8').fill(AGENT_NAME.toLowerCase());
    await expect(row(page, AGENT_ID)).toHaveCount(1);
    await expect(page.getByTestId('aeclr-row')).toHaveCount(1);
    await page.getByTestId('aeclr-inp-8').fill(NUM.agentDigits);
    await expect(row(page, NUM.agentDigits)).toHaveCount(1);
    expect(errors.filter((m) => /toLowerCase|includes|of null/.test(m)), 'no null crash').toEqual([]);
  });

  test('CR-06 a typed date range applies only on Apply', async ({ page }) => {
    await openCalls(page);
    const twelveDaysAgo = new Date(Date.now() - 12 * 86_400_000).toLocaleDateString('en-US');
    await page.getByTestId('aeclr-inp-1').fill(twelveDaysAgo);
    await page.getByTestId('aeclr-inp-1').blur();
    await page.waitForTimeout(2_000);
    await expect(row(page, NUM.old), 'typing a date alone does not re-query').toHaveCount(0);
    await page.getByTestId('aeclr-btn-9').click();
    await expect(row(page, NUM.old), 'Apply re-queries the wider range').toHaveCount(1, { timeout: 30_000 });
  });

  test('CR-07 the Profile filter matches the profile as caller OR as the number called', async ({ page }) => {
    await openCalls(page);
    await selectMatOption(page, page.getByTestId('aeclr-sel-6'), new RegExp(AGENT_NAME));
    await expect(row(page, AGENT_ID), 'as caller (MyOperator id)').toHaveCount(1);
    await expect(row(page, NUM.agentDigits), 'as callee ("+91 90000 00099" ≡ 9000000099)').toHaveCount(1);
    await expect(page.getByTestId('aeclr-row')).toHaveCount(2);
  });

  test('CR-08 a call without a recording shows "No Recording", not a player', async ({ page }) => {
    await openCalls(page);
    const r = row(page, 'MISSED');
    await expect(r.getByText('No Recording')).toBeVisible();
    await expect(r.getByTestId('aeclr-audio')).toHaveCount(0);
  });

  test('CR-09 /communication is retired — the old calls panel no longer mounts', async ({ page }) => {
    await loginAsCommsAdmin(page);
    await page.goto('/communication', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_500);
    expect(page.url()).not.toMatch(/\/login/);
    await expect(page.getByTestId('cmm-search')).toHaveCount(0);
    await expect(page.locator('app-communication')).toHaveCount(0);
  });
});
