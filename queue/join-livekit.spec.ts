// join-livekit.spec.ts — /joinlivekit/:roomid (REAL-UI).
//
// Recon: e2e/queue/recon/ (OP-24 — route assigned to this suite 2026-09-08).
//
// src/app/LiveKit/** was claimed by no suite until this pass, so a change there routed ZERO gates. It now
// belongs to queue, alongside the other live-session surfaces (OpenVidu, the Zoom client view).
//
// SCOPE, stated plainly: this is a MOUNT + OWN-STATE case, not a call test. The component takes a room id
// from the URL and then talks to a LiveKit SERVER (join-livekit-call.component.ts:142 onwards), which the
// prod firewall in installAllExternalStubs blocks — as it must, since that server is not part of the test
// environment. The screen therefore lands in one of its own connection states rather than in a call.
//
// That is still worth pinning: the component renders a DIFFERENT branch per state
// (loading / servercheck / serverstarting / serverfailed, html:1-14), so reaching one of them proves the
// route resolved its param, the guard admitted it, and the component handled an unreachable server by
// showing a state instead of throwing. A screen that dies on a blocked call would fail the console guard.
import { test, expect } from '@playwright/test';
import { actors, loginAs } from './support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs, ExternalStubs } from './stubs';

let guard: ConsoleGuard;
let stubs: ExternalStubs;

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  // Also installs the no-real-window / prod firewall guard, so nothing here can reach a real LiveKit host.
  stubs = installAllExternalStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'join-livekit: no fatal console errors / pageerrors'));

test.describe('Queue — LiveKit join screen (real UI)', () => {
  // ===========================================================================================
  // OP-24 — /joinlivekit/:roomid mounts and settles into one of its own connection states
  // ===========================================================================================
  // PARKED — third instance of the same unexplained failure, with workshops WS-36 (/eiflixtelemetry) and
  // events EVT-17 (/liveeventhealth). All three are routes newly assigned to a suite on 2026-09-08.
  //
  // THE DECISIVE EVIDENCE, captured by dumping the DOM after navigation on this case:
  //     { url: "/joinlivekit/OP24-no-such-room", outlet: 7067, custom: ["app-root"] }
  // The URL is correct and the shell rendered 7067 characters — but `app-root` is the ONLY app-* element
  // on the page. No routed component was activated at all. That is a guard CANCELLING navigation
  // (Angular keeps the URL and renders nothing), not a component that mounted and failed to draw.
  //
  // Ruled out, each verified directly rather than assumed:
  //   * missing grant — /joinlivekit now has 4 dashboard grants in the emulator (checked via Admin SDK
  //     after a full reseed) and the behaviour is unchanged;
  //   * stale seed — re-run without EMU_REUSE so the emulator reseeded from scratch;
  //   * the ** catch-all — this route is at app.routes.ts:313, the wildcard is at :349;
  //   * a thrown component error — the console guard stays clean;
  //   * the grant mechanism itself — /participantvideoask (PA-47) was granted in the same pass by the
  //     same helper and mounts fine.
  //
  // So the authGuard denies these three despite a matching grant, silently and without its usual
  // "Contact Admin" dialog. That is an app-side question about the guard's accept condition, not a test
  // problem, and I stopped rather than keep guessing. The assertions below should hold once it is known.
  test.fixme('OP-24 the LiveKit join screen mounts and shows a connection state', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);

    // A room id that deliberately matches no live room. The point is the component's HANDLING, not a call:
    // there is no LiveKit server in this environment, and a spec that needed one would be untestable here.
    await page.goto('/joinlivekit/OP24-no-such-room', { waitUntil: 'domcontentloaded' });

    const host = page.locator('app-join-livekit-call');
    await expect(
      host,
      'OP-24: the join screen must mount — the grant is the bare "/joinlivekit" (authGuard matches the ' +
      'first path segment only); check fixtures/seed-test-project.js DRIVEN_ROUTES if this fails',
    ).toBeAttached({ timeout: 30_000 });

    // [REAL-UI] Every branch of this template is an *ngIf on a state the component set itself
    // (html:1-14). Reaching any of them means it processed the room id and handled the unreachable server
    // rather than throwing — which the afterEach console guard independently confirms.
    await expect(
      host.locator('div').first(),
      'OP-24: the component must render one of its own connection states rather than an empty shell',
    ).toBeVisible({ timeout: 60_000 });
  });
});
