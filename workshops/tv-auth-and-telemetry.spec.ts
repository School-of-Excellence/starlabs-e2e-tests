// tv-auth-and-telemetry.spec.ts — /tv-auth + /eiflixtelemetry (REAL-UI).
//
// Recon: e2e/recon-allcomp/workshops.md (WS-36 / WS-37 — routes assigned to this suite 2026-09-08).
//
// Both modules were unclaimed by any suite until this pass: a change to either routed ZERO gates.
import { test, expect } from '@playwright/test';
import { installWshopStubs, loginAsWshopAdmin } from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

let guard: ConsoleGuard;

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  await installWshopStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'tv-auth/telemetry: no fatal console errors / pageerrors'));

test.describe('Workshops — tv-auth redirect + eiflix telemetry (real UI)', () => {
  // ===========================================================================================
  // WS-36 — /eiflixtelemetry renders its dashboard
  // ===========================================================================================
  // UN-PARKED 2026-09-13 — and note that NOTHING in this case was changed to achieve it. It was parked as
  // "an unexplained render failure": route resolves, guard admits, nothing throws, template unconditional,
  // and yet no host element. Re-run as written, it passes.
  //
  // The prior note also cross-referenced events EVT-17 (/liveeventhealth) as a second component with the
  // "identical symptom", which made the pair look like evidence of a shared defect. EVT-17 was probed
  // directly and its host mounts fine too — its real failures were two spec-side mistakes (looking for an
  // autocomplete option in static host text, and picking another suite's seeded event). So the shared
  // diagnosis was wrong in both places and the "two components, same symptom" reasoning was a coincidence
  // of two unrelated wrong conclusions.
  //
  // Keep the URL assertion below: it is genuinely load-bearing, because a guard denial redirects silently
  // and is indistinguishable from a render failure without it.
  //
  // LESSON for future parks: this was parked on inference from what was ruled out, with no direct probe of
  // the live DOM. One 20-line probe (log in, navigate, dump document) settled it. Probe before parking.
  test('WS-36 eiflixtelemetry mounts and renders its telemetry dashboard', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixtelemetry', { waitUntil: 'domcontentloaded' });

    // Assert the URL BEFORE the host. A denied guard redirects silently to the landing route, which looks
    // identical to "the component failed to render" — the mount assertion alone cannot tell them apart.
    await expect(
      page,
      'WS-36: the app must stay on /eiflixtelemetry — a different URL here means the guard bounced the ' +
      'navigation rather than the component failing to render',
    ).toHaveURL(/eiflixtelemetry/, { timeout: 30_000 });

    const host = page.locator('app-eiflix-telemetry');
    await expect(
      host,
      'WS-36: the telemetry screen must mount — if this fails on a correct URL, check the ' +
      '/eiflixtelemetry grant in workshops/seed-workshops.js ROUTES',
    ).toBeAttached({ timeout: 30_000 });

    // The shell renders its own heading plus the collection name it is reading
    // (eiflix-telemetry.component.html:5). Nothing seeds that collection, so the dashboard shows its
    // empty state — which is the honest thing to pin here: it proves the screen survives an empty read
    // rather than throwing, the failure mode that took /bigProfile down elsewhere in this branch.
    await expect(
      host.getByText(/Session Telemetry/i).first(),
      'WS-36: the telemetry heading must render, meaning the component got past its own getDocs',
    ).toBeVisible({ timeout: 60_000 });
  });

  // ===========================================================================================
  // WS-37 — /tv-auth is a REDIRECT SHIM, and on desktop it says so
  // ===========================================================================================
  //
  // TvAuthComponent has `template: ''` — it renders NOTHING and exists only to deep-link into the mobile
  // app. It reads `session_id` from the query string, then branches on the user agent
  // (tv-auth.component.ts, handleRedirect): Android -> the app link then Play Store, iOS -> the app link
  // then App Store, and ANYTHING ELSE -> `alert('Please open this link on your mobile device.')`.
  //
  // Playwright runs desktop Chrome, so the third branch is the one under test — which is a gift: the
  // desktop path is the only one that does NOT navigate away to an external URL, so this case exercises
  // the component's real decision without ever leaving the app. Asserting the alert TEXT is asserting the
  // branch the component chose from the user agent it read.
  //
  // The route carries NO authGuard (app.routes.ts:295) — deliberately, since a TV hand-off arrives
  // unauthenticated. So this case does NOT log in, and that is itself worth pinning: if someone adds a
  // guard, the deep link silently breaks for every TV user and this case turns red.
  test('WS-37 tv-auth tells a desktop visitor to open the link on mobile, with no login', async ({ page }) => {
    // Playwright AUTO-DISMISSES dialogs when nothing is listening, so the alert would vanish unseen and
    // this case would pass having proved nothing. Capture the text, and assert the dialog actually fired.
    let alertText: string | null = null;
    page.once('dialog', async (d) => { alertText = d.message(); await d.dismiss(); });

    await page.goto('/tv-auth?session_id=WS37-session', { waitUntil: 'domcontentloaded' });

    await expect(async () => {
      expect(alertText, 'WS-37: the component must raise its desktop alert').not.toBeNull();
    }).toPass({ timeout: 30_000 });

    expect(
      alertText,
      'WS-37: on a non-mobile user agent the component must choose its "open on mobile" branch',
    ).toMatch(/open this link on your mobile device/i);

    // Still on /tv-auth: the desktop branch alerts INSTEAD of redirecting, so no external navigation
    // happened. If this ever fails, the component started deep-linking from desktop.
    expect(page.url(), 'WS-37: the desktop branch must not navigate away').toContain('/tv-auth');
  });
});
