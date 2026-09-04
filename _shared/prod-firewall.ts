// prod-firewall.ts — SAFETY: block every request to a PRODUCTION endpoint so a non-queue spec that
// drives a screen with a hardcoded prod URL can never invoke a real production Cloud Function or write
// production data.
//
// WHY (memory: e2e-prod-endpoint-firewall): the e2e app build's DATA plane is the disposable test
// project slabs-queue-e2e-exdcz (environment.firebase). But ~41 source files hardcode
// `https://us-central1-fir-sample-aae4a.cloudfunctions.net/<fn>` HTTPS endpoints (sendBatchEmail,
// resentAppointmentEmail, appointmentLinkRegenarate, studioZoomLinkRegenerate, workshopprogressmessage…).
// Clicking the button that fires one would hit PRODUCTION. The queue suite avoids those buttons; the
// new suites (appointments, comms, workshops, events) will reach them, so they MUST firewall prod.
//
// This is also a stub: an aborted/short-circuited request means "no real network" — the spec then
// asserts the Firestore state the app wrote on the TEST project (anti-circular), never a prod response.

import type { Page } from '@playwright/test';

/** Hostnames / URL fragments that indicate a PRODUCTION (or other non-test) Firebase project endpoint. */
const PROD_PATTERNS = [
  /us-central1-fir-sample-aae4a\.cloudfunctions\.net/i,
  /fir-sample-aae4a\.cloudfunctions\.net/i,
  /us-central1-launch-your-legacy-development\.cloudfunctions\.net/i,
  /watsonproduction-becde/i,
  /salesleadcrm/i,
  // a bare cloud-functions host pinned to any project that is NOT the test project
  /https?:\/\/[a-z0-9-]*-(?!slabs-queue-e2e-exdcz)[a-z0-9-]+\.cloudfunctions\.net/i,
  // 2nd-GEN Cloud Functions are served from Cloud Run, NOT *.cloudfunctions.net — every pattern above
  // misses them and the request used to fall through to the real endpoint. Found 2026-09-02 in the
  // profiles glob: Participants Profile Management/participants-analytics/wati-input:161-162 pins
  // `sendwhatsappbroadcast-{rhdwzw46ya,kakybqnyrq}-uc.a.run.app` — driving that dialog's onSubmit
  // would have sent a REAL WhatsApp broadcast to production recipients.
  /https?:\/\/[a-z0-9-]+\.a\.run\.app/i,
  /https?:\/\/[a-z0-9-]+\.run\.app/i,
];

/** Hosts the harness legitimately talks to. Only consulted when `denyUnknownHosts` is on. */
const ALLOWED_HOST_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i,   // the app under test + emulators
  /^https?:\/\/[a-z0-9.-]*slabs-queue-e2e-exdcz[a-z0-9.-]*\//i,      // the disposable test project
  /\.googleapis\.com\//i,                                            // Firestore / Auth / Storage SDK
  /\.gstatic\.com\//i,
  /\.google\.com\/recaptcha\//i,
  /fonts\.googleapis\.com\//i,
  /^data:|^blob:/i,
];

export interface ProdFirewallOptions {
  /** Also block any *.cloudfunctions.net call (even the test project's HTTPS callables). Default false —
   *  the test project's own deployed CFs are fine to call; only prod/other-project endpoints are blocked. */
  blockAllFunctions?: boolean;
  /** Record blocked URLs for assertions ("no prod email was attempted"). */
  onBlock?: (url: string) => void;
  /**
   * FENCE (default OFF): block every host that is not on ALLOWED_HOST_PATTERNS, instead of only the
   * hosts someone remembered to enumerate in PROD_PATTERNS. The allowlist-of-known-bad-hosts above
   * fails OPEN on every host nobody thought of — which is exactly how the *.a.run.app broadcast
   * endpoints got through. Turn this on per-suite once that suite has been run green with it.
   */
  denyUnknownHosts?: boolean;
}

/**
 * Install a route handler that short-circuits any request to a production endpoint with a benign
 * empty-200 (so app code awaiting the fetch resolves rather than hanging/erroring the console guard).
 * Returns a list that captures every blocked URL for optional assertions.
 */
export async function installProdFirewall(page: Page, opts: ProdFirewallOptions = {}): Promise<string[]> {
  const blocked: string[] = [];
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const isProd = PROD_PATTERNS.some((re) => re.test(url));
    const isFn = /cloudfunctions\.net/i.test(url);
    const isUnknown =
      !!opts.denyUnknownHosts && !ALLOWED_HOST_PATTERNS.some((re) => re.test(url));
    if (isProd || isUnknown || (opts.blockAllFunctions && isFn)) {
      blocked.push(url);
      opts.onBlock?.(url);
      // Empty JSON 200 — app code that does `fetch(url).then(r=>r.json())` gets {} instead of a real
      // prod response, and a real prod side-effect (email/link-regen) never fires.
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.continue();
  });
  return blocked;
}
