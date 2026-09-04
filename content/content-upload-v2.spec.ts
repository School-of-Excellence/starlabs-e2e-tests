// content-upload-v2.spec.ts — /content-upload-v2 "Content Status Overview" home (REAL-UI, anti-circular).
//
// Recon: e2e/recon-allcomp/content.md (CN-19 / CN-20).
//
// WHY THIS FILE EXISTS: the content suite's `appPaths` glob already claimed
// `src/app/content-upload-version2/**`, so a change there made the content gate MANDATORY — but no spec
// ever opened the module's only route. The gate ran green while testing none of it. Same false-green class
// as comms /channel-templates. Found by scripts/check-route-coverage.mjs (coverage pass 2026-09-03).
//
// Anti-circularity: the home's cards are filled by loadAll() -> loadLast(), five independent
// getDocs(query(collection, orderBy(<field>,'desc'), limit(1))) reads (component ts:71-88). CN-19 asserts
// the card TEXT the app resolved from the doc ITS OWN query selected (`title ?? name ?? subject`,
// ts:98-101 — the seed writes `name`, never a card value). CN-20 asserts the "ago" badge, which the app
// COMPUTES from the doc's timestamp via daysAgoInfo() (ts:143-157) — the test supplies a date, never a
// label. No case asserts a value the test wrote into the view.
import { test, expect } from '@playwright/test';
import { installContentStubs, loginAsContentAdmin } from './support/content';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { queryWhere } from '../queue/support/firestore-admin';

// Must match seed-content.js / support/content.ts exactly — the env var is CONT_RUNID (not CONTENT_RUNID);
// getting it wrong silently falls back to 'cont' and the seeded-doc lookups quietly find nothing.
const RUN = process.env.CONT_RUNID || 'cont';

/** Navigate to the shell and wait for the component the app mounts (not a bare URL check). */
async function openContentUploadV2(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/content-upload-v2', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/content-upload-v2/, { timeout: 30_000 });
  await expect(
    page.locator('app-content-upload-version2'),
    'content-upload-v2 must mount — if this fails on a correct URL, check that /content-upload-v2 has a ' +
    'dashboard route grant in seed-content.js ROUTES (authGuard denies unlisted screens)',
  ).toBeVisible({ timeout: 30_000 });
}

/** The overview card for one screen title (the .card-title text is static app config). */
const cardFor = (page: import('@playwright/test').Page, title: string) =>
  page.locator('.card').filter({ has: page.locator('.card-title', { hasText: new RegExp(`^\\s*${title}\\s*$`) }) });

test.describe('Content — /content-upload-v2 status overview (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installContentStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'content-upload-v2: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-19 — the Solar Voice card shows the last-item title from the app's OWN limit(1) read
  // ===========================================================================================
  test('CN-19 content-upload-v2 home renders the last audio title from its own query', async ({ page }) => {
    // [PRECONDITION] The seeded audios must exist, or the card would be empty for the wrong reason
    // (*ngIf="s.lastItemTitle" simply drops the element). Admin-read them; the test never writes here.
    const audios = await queryWhere('solar voice audios', [['testrunid', '==', RUN]]);
    expect(
      audios.length,
      `CN-19 precondition: seeded solar-voice audios must exist for run ${RUN}`,
    ).toBeGreaterThan(0);

    await loginAsContentAdmin(page);
    await openContentUploadV2(page);

    // [REAL-UI] isHome is true on the bare route (ts:64), so the overview cards render.
    const card = cardFor(page, 'Solar Voice');
    await expect(card, 'CN-19: the Solar Voice card must render').toBeVisible({ timeout: 30_000 });

    // [ASSERT] .card-item is `lastItemTitle` — the app resolved it as title ?? name ?? subject from the ONE
    // doc its orderBy('date','desc') limit(1) query selected. The seed writes `name` only.
    //
    // NOT pinned to a specific doc ON PURPOSE: all three seeded audios are written with date: now() in a
    // loop, so which one limit(1) returns depends on sub-millisecond write ordering. Asserting the seeded
    // NAME PATTERN proves the app rendered a value from its own query without encoding that race.
    const item = card.locator('.card-item');
    await expect(item, 'CN-19: the Solar Voice card must show a last-item title').toBeVisible({ timeout: 30_000 });
    await expect(
      item,
      `CN-19: the card title must be an audio NAME the app read from Firestore (run ${RUN})`,
    ).toHaveText(new RegExp(`^\\s*TEST_AUDIO_${RUN}_[0-9]+\\s*$`), { timeout: 30_000 });

    // Cross-check: whatever the app rendered must be one of the seeded names, not arbitrary text.
    const rendered = (await item.innerText()).trim();
    const seededNames = audios.map((a) => String(a.name));
    expect(
      seededNames,
      `CN-19: the rendered title "${rendered}" must be one of the seeded audio names`,
    ).toContain(rendered);
  });

  // ===========================================================================================
  // CN-20 — the "ago" badge is the app's OWN arithmetic over the seeded timestamp
  // ===========================================================================================
  test('CN-20 the card ago-badge is computed by the app from the seeded date', async ({ page }) => {
    // [PRECONDITION] seed-content.js writes the audios with `date: now()`, so daysAgoInfo() must compute
    // diff <= 0 -> 'Today' (ts:150-152). Confirm the seeded date really is today before asserting the
    // label, otherwise a stale emulator would fail this for a reason that has nothing to do with the app.
    const audios = await queryWhere('solar voice audios', [['testrunid', '==', RUN]]);
    expect(audios.length, 'CN-20 precondition: seeded audios must exist').toBeGreaterThan(0);
    const newestMs = Math.max(...audios.map((a) => {
      const d = a.date as { toMillis?: () => number } | undefined;
      return typeof d?.toMillis === 'function' ? d.toMillis() : 0;
    }));
    const daysOld = Math.floor((Date.now() - newestMs) / 86_400_000);
    expect(daysOld, 'CN-20 precondition: the newest seeded audio must be dated today').toBeLessThanOrEqual(0);

    await loginAsContentAdmin(page);
    await openContentUploadV2(page);

    const card = cardFor(page, 'Solar Voice');
    await expect(card, 'CN-20: the Solar Voice card must render').toBeVisible({ timeout: 30_000 });

    // [ORACLE] The test supplied a TIMESTAMP; the app produced the LABEL. daysAgoInfo() returns
    // {value:'Today', label:''} for diff <= 0 — so .ago-value must read exactly "Today".
    await expect(
      card.locator('.ago-value'),
      'CN-20: the app must compute "Today" from the seeded timestamp',
    ).toHaveText(/^\s*Today\s*$/, { timeout: 30_000 });
  });
});
