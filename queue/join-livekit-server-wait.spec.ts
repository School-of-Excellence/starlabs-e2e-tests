// join-livekit-server-wait.spec.ts — /joinroom/:roomid waiting states (REAL-UI, emulator).
//
// HOOK PREFIX: `lkj` (join-livekit-call — the same prefix the component's existing controls use; the
// `joinroom-*` ids are the older pre-join hooks owned by pages/join-room.page.ts).
//
// Recon / why: starlabs-angular specs/plans/2026-11-14-openvidu-call-fixes.md (items 2.1, 2.1b, 2.2,
// 3.1) and journal specs/journals/2026-11-15-openvidu-phases-1b-4.md. Production showed
// "Server Failed to start" whenever a call was opened while the OCI server was off or still booting.
// The join screen now (a) waits with "Starting the video server…" + elapsed time while the server is
// stopped / starting, (b) treats a server as usable only when a media node is READY
// (`media.instanceStates.ready`), not merely a running VM (`healthy`), (c) re-touches the room doc
// (`waitingForServerAt`) so the backend's wake-on-join still sees it, and (d) keeps retrying a token
// that answers 503 "Media node not ready" with an on-screen wait instead of giving up after 3 tries.
//
// SEEDED WORLD:
//   • OCI_System/instance_status — baseline "running, 1 ready node" (fixtures/seed-test-project.js,
//     OCI_STATUS_BASELINE). These cases DRIVE that doc through other states — it plays the part of the
//     5-minute CheckOciNodeStatus job, the only writer in production — and restore the baseline after
//     each case (afterEach), so SS-11b and other /joinroom specs see the baseline again.
//   • openviduroom/<run>_lkjwait_<case> — an active room per case, `mediaProvider: 'oci'`, created with
//     the same seedOpenViduRoom() stand-in SS-11b uses. Run-unique ids, so parallel runs cannot collide.
//
// ANTI-CIRCULARITY (what is seeded vs what the app computes):
//   • Seeded: the server status doc and the room doc. Asserted: which *ngIf branch the APP chose for
//     that status (lkj-server-starting vs joinroom-prejoin), that the APP's own elapsed counter moves,
//     the `waitingForServerAt` field the APP wrote to the room (read back with the Admin SDK — this
//     test never writes that field), and how many token requests the APP sent (counted at the network
//     boundary).
//   • Negative controls: in LKJ-01 the error branch (lkj-server-failed) and the pre-join must be ABSENT
//     while stopped; in LKJ-02 a status with healthy=1 but ready=0 must NOT open the pre-join — that is
//     exactly the "ordered/running but not ready" case 3.1 fixed, and it is what proves the app reads
//     `ready` rather than `healthy`; in LKJ-03 the join-error branch must be absent while it retries.
//
// NOT DRIVEN (registered in the ADDR block): the 20-minute server-failed branch (needs a 20-min wall
// clock), the momentary servercheck branch, the join-error branch, and "Tap to enable sound" (needs a
// real LiveKit connection — the browser autoplay block cannot occur without one).
import { test, expect, Page, Route } from '@playwright/test';
import { TESTRUNID } from './support/actors';
import { loginAsOperator } from './support/auth';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { db, getDoc, pollUntil } from './support/firestore-admin';
import { installAllExternalStubs, seedOpenViduRoom } from './stubs';
import { JoinRoomPage } from './pages/join-room.page';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { OCI_STATUS_BASELINE } = require('../fixtures/seed-test-project.js');

let guard: ConsoleGuard;

// The status doc is one shared singleton: run these cases one at a time.
test.describe.configure({ mode: 'serial' });

async function setOciStatus(master: string, states: { healthy: number; ready: number }): Promise<void> {
  await db().collection('OCI_System').doc('instance_status').set({
    master: { state: master },
    media: { instanceStates: { ...states, unhealthy: 0, pending: 0, terminating: 0, total: states.healthy } },
    lastUpdated: new Date(),
  }, { merge: true });
}

async function seedOciRoom(caseId: string): Promise<string> {
  const roomId = `${TESTRUNID}_lkjwait_${caseId}`;
  await seedOpenViduRoom(roomId, { title: `LKJ ${caseId} Room`, active: true });
  // mediaProvider 'oci' explicitly (the app would default to it anyway) + run tag for teardown.
  await db().collection('openviduroom').doc(roomId).set(
    { mediaProvider: 'oci', waitingForServerAt: null, testrunid: TESTRUNID, _testdata: true },
    { merge: true },
  );
  return roomId;
}

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  installAllExternalStubs(page);
});

test.afterEach(async () => {
  await db().collection('OCI_System').doc('instance_status').set(OCI_STATUS_BASELINE(new Date(), TESTRUNID), { merge: true });
  assertNoFatal(guard, 'join-livekit-server-wait: no fatal console errors / pageerrors');
});

test.describe('Queue — LiveKit join screen waits for a ready video server (real UI)', () => {
  test('LKJ-01 server stopped: shows "Starting the video server" with a running clock and touches the room for wake-on-join', async ({ page }) => {
    await setOciStatus('stopped', { healthy: 0, ready: 0 });
    const roomId = await seedOciRoom('01');

    await loginAsOperator(page);
    await new JoinRoomPage(page).open(roomId);

    const starting = page.getByTestId('lkj-server-starting');
    await expect(starting, 'LKJ-01: a stopped server must show the starting message, not an error').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('lkj-server-failed'), 'LKJ-01: the error branch must NOT show while waiting').toHaveCount(0);
    await expect(page.getByTestId('joinroom-prejoin'), 'LKJ-01: no pre-join while the server is down').toHaveCount(0);

    // The app's own elapsed counter moves (its 1 s ticker) — "Waiting 0:00" → "Waiting 0:0N".
    const elapsed = page.getByTestId('lkj-server-wait-elapsed');
    const first = (await elapsed.textContent())?.trim();
    await expect(elapsed, 'LKJ-01: the elapsed time must tick').not.toHaveText(first ?? '', { timeout: 10_000 });

    // Independent oracle: the APP wrote waitingForServerAt on the room (seeded as null by this test).
    const touched = await pollUntil(
      async () => (await getDoc('openviduroom', roomId))?.waitingForServerAt ?? null,
      (v: unknown) => v != null,
      { timeoutMs: 20_000, intervalMs: 1_000, label: 'LKJ-01 waitingForServerAt written by the app' },
    );
    expect(touched, 'LKJ-01: the join screen must touch the room so the 5-minute job wakes the server').toBeTruthy();
  });

  test('LKJ-02 running VM is not enough: waits until a media node is READY, then opens the pre-join by itself', async ({ page }) => {
    await setOciStatus('starting', { healthy: 0, ready: 0 });
    const roomId = await seedOciRoom('02');

    await loginAsOperator(page);
    await new JoinRoomPage(page).open(roomId);
    await expect(page.getByTestId('lkj-server-starting')).toBeVisible({ timeout: 30_000 });

    // NEGATIVE CONTROL — master running, VM up (healthy=1) but media software not ready (ready=0).
    // Before plan item 3.1 the app opened the pre-join here and the call then hit "Media node not ready".
    await setOciStatus('running', { healthy: 1, ready: 0 });
    await page.waitForTimeout(5_000); // give the Firestore listener time to deliver the change
    await expect(page.getByTestId('lkj-server-starting'), 'LKJ-02: healthy-but-not-ready must keep waiting').toBeVisible();
    await expect(page.getByTestId('joinroom-prejoin'), 'LKJ-02: no pre-join until a node is ready').toHaveCount(0);

    // The node becomes ready → the same tab moves on to the pre-join without a reload.
    await setOciStatus('running', { healthy: 1, ready: 1 });
    await expect(page.getByTestId('joinroom-prejoin'), 'LKJ-02: a ready node must open the pre-join automatically').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('lkj-server-starting')).toHaveCount(0);
  });

  test('LKJ-03 token says "Media node not ready": keeps retrying with "Getting a video server ready" instead of failing', async ({ page }) => {
    test.setTimeout(150_000);
    const roomId = await seedOciRoom('03'); // baseline status: running + 1 ready node

    // Network-boundary stub registered AFTER installAllExternalStubs, so it takes precedence: every
    // token request answers the real 503 contract of createOpenViduToken (openVidu.js, OCI branch).
    let tokenRequests = 0;
    await page.route('**/createOpenViduToken*', async (route: Route) => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, body: '' }); return; }
      tokenRequests++;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ success: false, code: 'SCALING_IN_PROGRESS', message: 'Media node not ready. Please retry.', retryAfter: 60 }),
      });
    });

    await loginAsOperator(page);
    const join = new JoinRoomPage(page);
    await join.open(roomId);
    await expect(join.prejoin).toBeVisible({ timeout: 30_000 });
    await join.clickEnableAccess();
    await join.clickJoinCall();

    await expect(page.getByTestId('lkj-connecting')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('lkj-token-wait-elapsed'), 'LKJ-03: the token wait must show its own message + clock').toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('lkj-join-error'), 'LKJ-03: no error while still inside the wait window').toHaveCount(0);

    // The app retries on its own: the retry gap is capped at 30 s (server says 60), so a second request
    // arrives well inside 45 s. Counted at the network boundary — the test never calls the endpoint.
    await expect.poll(() => tokenRequests, { timeout: 45_000, message: 'LKJ-03: the app must retry the token request' }).toBeGreaterThanOrEqual(2);
    await expect(page.getByTestId('lkj-connecting'), 'LKJ-03: still waiting, not dropped to an error').toBeVisible();
  });

  // ---- Hooks this file does not drive (addressable registration for the readiness gate) ----
  test.fixme('LKJ-ADDR1 server-check / server-failed / join-error / enable-sound addressable (deferred behavioral)', async ({ page }: { page: Page }) => {
    await page.goto('/joinroom/lkj-addr-probe', { waitUntil: 'domcontentloaded' });
    // Momentary branch before the first status snapshot arrives.
    expect(page.getByTestId('lkj-server-check')).toBeTruthy();
    // Only after SERVER_WAIT_LIMIT_MS (20 min) without a ready node.
    expect(page.getByTestId('lkj-server-failed')).toBeTruthy();
    // After the 12-min token wait runs out, or a non-503 token failure.
    expect(page.getByTestId('lkj-join-error')).toBeTruthy();
    // Needs a real LiveKit connection whose audio the browser refuses to autoplay.
    expect(page.getByTestId('lkj-enablesound')).toBeTruthy();
  });
});
