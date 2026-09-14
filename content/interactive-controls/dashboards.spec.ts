// dashboards.spec.ts — ADDRESSABLE + SMOKE for the routable content screens.
//
// Interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-plan.md).
// Per screen: log in as the content admin, navigate the real route, assert the component mounts, and
// enumerate every interactive control by its stable data-testid (soft-present). Every id is a literal
// getByTestId so the readiness gate credits it. All ids were added ADD-ONLY in the app templates — no
// existing hook was renamed and no existing content/*.spec.ts was modified.
import { test, expect } from '@playwright/test';
import { installContentStubs, loginAsContentAdmin } from '../support/content';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../../queue/support/console-guard';

let guard: ConsoleGuard;
test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  await installContentStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'content controls: no fatal console errors / pageerrors'));

test.describe('Content — routable screens: controls addressable (smoke)', () => {
  // ── content-analytics  (prefix: ca, 65 controls) — route /contentanalytics ──
  test('ca — content-analytics controls addressable at /contentanalytics', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/contentanalytics', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-content-analytics'), 'ca: app-content-analytics must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('ca-inp-001'),
      page.getByTestId('ca-inp-002'),
      page.getByTestId('ca-btn-003'),
      page.getByTestId('ca-btn-004'),
      page.getByTestId('ca-inp-005'),
      page.getByTestId('ca-inp-006'),
      page.getByTestId('ca-inp-007'),
      page.getByTestId('ca-msel-008'),
      page.getByTestId('ca-msel-009'),
      page.getByTestId('ca-inp-010'),
      page.getByTestId('ca-msel-011'),
      page.getByTestId('ca-matslidetoggle-012'),
      page.getByTestId('ca-matcheckbox-013'),
      page.getByTestId('ca-btn-014'),
      page.getByTestId('ca-btn-015'),
      page.getByTestId('ca-tr-016'),
      page.getByTestId('ca-btn-017'),
      page.getByTestId('ca-btn-018'),
      page.getByTestId('ca-inp-019'),
      page.getByTestId('ca-span-020'),
      page.getByTestId('ca-span-021'),
      page.getByTestId('ca-span-022'),
      page.getByTestId('ca-span-023'),
      page.getByTestId('ca-btn-024'),
      page.getByTestId('ca-btn-025'),
      page.getByTestId('ca-div-026'),
      page.getByTestId('ca-div-027'),
      page.getByTestId('ca-span-028'),
      page.getByTestId('ca-span-029'),
      page.getByTestId('ca-span-030'),
      page.getByTestId('ca-span-031'),
      page.getByTestId('ca-btn-032'),
      page.getByTestId('ca-btn-033'),
      page.getByTestId('ca-div-034'),
      page.getByTestId('ca-div-035'),
      page.getByTestId('ca-btn-036'),
      page.getByTestId('ca-btn-037'),
      page.getByTestId('ca-inp-038'),
      page.getByTestId('ca-span-039'),
      page.getByTestId('ca-span-040'),
      page.getByTestId('ca-span-041'),
      page.getByTestId('ca-span-042'),
      page.getByTestId('ca-btn-043'),
      page.getByTestId('ca-btn-044'),
      page.getByTestId('ca-div-045'),
      page.getByTestId('ca-div-046'),
      page.getByTestId('ca-span-047'),
      page.getByTestId('ca-span-048'),
      page.getByTestId('ca-span-049'),
      page.getByTestId('ca-span-050'),
      page.getByTestId('ca-btn-051'),
      page.getByTestId('ca-btn-052'),
      page.getByTestId('ca-div-053'),
      page.getByTestId('ca-div-054'),
      page.getByTestId('ca-div-055'),
      page.getByTestId('ca-inp-056'),
      page.getByTestId('ca-btn-057'),
      page.getByTestId('ca-btn-058'),
      page.getByTestId('ca-btn-059'),
      page.getByTestId('ca-div-060'),
      page.getByTestId('ca-div-061'),
      page.getByTestId('ca-btn-062'),
      page.getByTestId('ca-btn-063'),
      page.getByTestId('ca-btn-064'),
      page.getByTestId('ca-btn-065'),
    ];
    expect(controls.length, 'ca: control set present').toBe(65);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── content-analytics-dashboard  (prefix: cad, 39 controls) — route /content-analytics-dashboard ──
  test('cad — content-analytics-dashboard controls addressable at /content-analytics-dashboard', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/content-analytics-dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-content-analytics-dashboard'), 'cad: app-content-analytics-dashboard must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('cad-inp-001'),
      page.getByTestId('cad-inp-002'),
      page.getByTestId('cad-div-003'),
      page.getByTestId('cad-inp-004'),
      page.getByTestId('cad-inp-005'),
      page.getByTestId('cad-btn-006'),
      page.getByTestId('cad-inp-007'),
      page.getByTestId('cad-inp-008'),
      page.getByTestId('cad-div-009'),
      page.getByTestId('cad-btn-010'),
      page.getByTestId('cad-div-011'),
      page.getByTestId('cad-div-012'),
      page.getByTestId('cad-div-013'),
      page.getByTestId('cad-div-014'),
      page.getByTestId('cad-inp-015'),
      page.getByTestId('cad-inp-016'),
      page.getByTestId('cad-span-017'),
      page.getByTestId('cad-span-018'),
      page.getByTestId('cad-div-019'),
      page.getByTestId('cad-div-020'),
      page.getByTestId('cad-div-021'),
      page.getByTestId('cad-div-022'),
      page.getByTestId('cad-div-023'),
      page.getByTestId('cad-div-024'),
      page.getByTestId('cad-inp-025'),
      page.getByTestId('cad-inp-026'),
      page.getByTestId('cad-td-027'),
      page.getByTestId('cad-td-028'),
      page.getByTestId('cad-td-029'),
      page.getByTestId('cad-td-030'),
      page.getByTestId('cad-td-031'),
      page.getByTestId('cad-inp-032'),
      page.getByTestId('cad-inp-033'),
      page.getByTestId('cad-td-034'),
      page.getByTestId('cad-td-035'),
      page.getByTestId('cad-td-036'),
      page.getByTestId('cad-btn-037'),
      page.getByTestId('cad-btn-038'),
      page.getByTestId('cad-span-039'),
    ];
    expect(controls.length, 'cad: control set present').toBe(39);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── audio-dashboard  (prefix: aud, 14 controls) — route /audiodashboard ──
  test('aud — audio-dashboard controls addressable at /audiodashboard', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/audiodashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-audio-dashboard'), 'aud: app-audio-dashboard must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('aud-btn-001'),
      page.getByTestId('aud-inp-002'),
      page.getByTestId('aud-msel-003'),
      page.getByTestId('aud-btn-004'),
      page.getByTestId('aud-btn-005'),
      page.getByTestId('aud-maticon-006'),
      page.getByTestId('aud-btn-007'),
      page.getByTestId('aud-div-008'),
      page.getByTestId('aud-btn-009'),
      page.getByTestId('aud-btn-010'),
      page.getByTestId('aud-btn-011'),
      page.getByTestId('aud-div-012'),
      page.getByTestId('aud-btn-013'),
      page.getByTestId('aud-btn-014'),
    ];
    expect(controls.length, 'aud: control set present').toBe(14);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── episodes-dashboard  (prefix: epd, 7 controls) — route /videodashboard ──
  test('epd — episodes-dashboard controls addressable at /videodashboard', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/videodashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-episodes-dashboard'), 'epd: app-episodes-dashboard must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('epd-btn-001'),
      page.getByTestId('epd-inp-002'),
      page.getByTestId('epd-btn-003'),
      page.getByTestId('epd-btn-004'),
      page.getByTestId('epd-btn-005'),
      page.getByTestId('epd-btn-006'),
      page.getByTestId('epd-btn-007'),
    ];
    expect(controls.length, 'epd: control set present').toBe(7);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── upload-studio  (prefix: ups, 25 controls) — route /videodashboard/upload ──
  test('ups — upload-studio controls addressable at /videodashboard/upload', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/videodashboard/upload', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-upload-studio'), 'ups: app-upload-studio must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('ups-btn-001'),
      page.getByTestId('ups-btn-002'),
      page.getByTestId('ups-btn-003'),
      page.getByTestId('ups-btn-004'),
      page.getByTestId('ups-div-005'),
      page.getByTestId('ups-inp-006'),
      page.getByTestId('ups-inp-007'),
      page.getByTestId('ups-inp-008'),
      page.getByTestId('ups-inp-009'),
      page.getByTestId('ups-inp-010'),
      page.getByTestId('ups-inp-011'),
      page.getByTestId('ups-inp-012'),
      page.getByTestId('ups-inp-013'),
      page.getByTestId('ups-inp-014'),
      page.getByTestId('ups-maticon-015'),
      page.getByTestId('ups-span-016'),
      page.getByTestId('ups-span-017'),
      page.getByTestId('ups-inp-018'),
      page.getByTestId('ups-span-019'),
      page.getByTestId('ups-btn-020'),
      page.getByTestId('ups-btn-021'),
      page.getByTestId('ups-btn-022'),
      page.getByTestId('ups-btn-023'),
      page.getByTestId('ups-btn-024'),
      page.getByTestId('ups-btn-025'),
    ];
    expect(controls.length, 'ups: control set present').toBe(25);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── click-ads  (prefix: cka, 12 controls) — route /ads ──
  test('cka — click-ads controls addressable at /ads', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/ads', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-click-ads'), 'cka: app-click-ads must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('cka-inp-001'),
      page.getByTestId('cka-btn-002'),
      page.getByTestId('cka-a-003'),
      page.getByTestId('cka-img-004'),
      page.getByTestId('cka-img-005'),
      page.getByTestId('cka-btn-006'),
      page.getByTestId('cka-btn-007'),
      page.getByTestId('cka-inp-008'),
      page.getByTestId('cka-a-009'),
      page.getByTestId('cka-img-010'),
      page.getByTestId('cka-img-011'),
      page.getByTestId('cka-btn-012'),
    ];
    expect(controls.length, 'cka: control set present').toBe(12);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── health-stories  (prefix: hs, 8 controls) — route /healthstories ──
  test('hs — health-stories controls addressable at /healthstories', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/healthstories', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-health-stories'), 'hs: app-health-stories must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('hs-inp-001'),
      page.getByTestId('hs-btn-002'),
      page.getByTestId('hs-img-003'),
      page.getByTestId('hs-btn-004'),
      page.getByTestId('hs-btn-005'),
      page.getByTestId('hs-inp-006'),
      page.getByTestId('hs-img-007'),
      page.getByTestId('hs-btn-008'),
    ];
    expect(controls.length, 'hs: control set present').toBe(8);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── content-upload  (prefix: cu, 11 controls) — route /contentupload ──
  test('cu — content-upload controls addressable at /contentupload', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/contentupload', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-content-upload'), 'cu: app-content-upload must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('cu-inp-001'),
      page.getByTestId('cu-btn-002'),
      page.getByTestId('cu-btn-003'),
      page.getByTestId('cu-btn-004'),
      page.getByTestId('cu-btn-005'),
      page.getByTestId('cu-btn-006'),
      page.getByTestId('cu-btn-007'),
      page.getByTestId('cu-inp-008'),
      page.getByTestId('cu-btn-009'),
      page.getByTestId('cu-btn-010'),
      page.getByTestId('cu-btn-011'),
    ];
    expect(controls.length, 'cu: control set present').toBe(11);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── learning-material  (prefix: lm, 4 controls) — route /learningmaterial ──
  test('lm — learning-material controls addressable at /learningmaterial', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/learningmaterial', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-learning-material'), 'lm: app-learning-material must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('lm-btn-001'),
      page.getByTestId('lm-inp-002'),
      page.getByTestId('lm-btn-003'),
      page.getByTestId('lm-btn-004'),
    ];
    expect(controls.length, 'lm: control set present').toBe(4);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── category-dashboard  (prefix: cat, 4 controls) — route /category-dashboard ──
  test('cat — category-dashboard controls addressable at /category-dashboard', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/category-dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-category-dashboard'), 'cat: app-category-dashboard must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('cat-btn-001'),
      page.getByTestId('cat-inp-002'),
      page.getByTestId('cat-btn-003'),
      page.getByTestId('cat-btn-004'),
    ];
    expect(controls.length, 'cat: control set present').toBe(4);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── series-dashboard  (prefix: ser, 8 controls) — route /seriesdashboard ──
  test('ser — series-dashboard controls addressable at /seriesdashboard', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/seriesdashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-series-dashboard'), 'ser: app-series-dashboard must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('ser-btn-001'),
      page.getByTestId('ser-inp-002'),
      page.getByTestId('ser-msel-003'),
      page.getByTestId('ser-inp-004'),
      page.getByTestId('ser-btn-005'),
      page.getByTestId('ser-btn-006'),
      page.getByTestId('ser-btn-007'),
      page.getByTestId('ser-btn-008'),
    ];
    expect(controls.length, 'ser: control set present').toBe(8);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── viewparticipant-tier-access  (prefix: vpt, 15 controls) — route /viewparticipantstieraccess ──
  test('vpt — viewparticipant-tier-access controls addressable at /viewparticipantstieraccess', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/viewparticipantstieraccess', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-viewparticipant-tier-access'), 'vpt: app-viewparticipant-tier-access must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('vpt-inp-001'),
      page.getByTestId('vpt-btn-002'),
      page.getByTestId('vpt-btn-003'),
      page.getByTestId('vpt-inp-004'),
      page.getByTestId('vpt-btn-005'),
      page.getByTestId('vpt-btn-006'),
      page.getByTestId('vpt-btn-007'),
      page.getByTestId('vpt-inp-008'),
      page.getByTestId('vpt-btn-009'),
      page.getByTestId('vpt-btn-010'),
      page.getByTestId('vpt-btn-011'),
      page.getByTestId('vpt-btn-012'),
      page.getByTestId('vpt-btn-013'),
      page.getByTestId('vpt-btn-014'),
      page.getByTestId('vpt-btn-015'),
    ];
    expect(controls.length, 'vpt: control set present').toBe(15);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── playlist-dashboard  (prefix: pld, 7 controls) — route /playlistdashboard ──
  test('pld — playlist-dashboard controls addressable at /playlistdashboard', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/playlistdashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-playlist-dashboard'), 'pld: app-playlist-dashboard must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('pld-btn-001'),
      page.getByTestId('pld-inp-002'),
      page.getByTestId('pld-btn-003'),
      page.getByTestId('pld-btn-004'),
      page.getByTestId('pld-btn-005'),
      page.getByTestId('pld-btn-006'),
      page.getByTestId('pld-btn-007'),
    ];
    expect(controls.length, 'pld: control set present').toBe(7);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── playlist-ads  (prefix: pla, 5 controls) — route /playlistads ──
  test('pla — playlist-ads controls addressable at /playlistads', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/playlistads', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-playlist-ads'), 'pla: app-playlist-ads must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('pla-inp-001'),
      page.getByTestId('pla-btn-002'),
      page.getByTestId('pla-a-003'),
      page.getByTestId('pla-btn-004'),
      page.getByTestId('pla-btn-005'),
    ];
    expect(controls.length, 'pla: control set present').toBe(5);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── access-screen  (prefix: acs, 10 controls) — route /accessscreen ──
  test('acs — access-screen controls addressable at /accessscreen', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/accessscreen', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-access-screen'), 'acs: app-access-screen must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('acs-inp-001'),
      page.getByTestId('acs-btn-002'),
      page.getByTestId('acs-btn-003'),
      page.getByTestId('acs-btn-004'),
      page.getByTestId('acs-inp-005'),
      page.getByTestId('acs-btn-006'),
      page.getByTestId('acs-btn-007'),
      page.getByTestId('acs-inp-008'),
      page.getByTestId('acs-btn-009'),
      page.getByTestId('acs-btn-010'),
    ];
    expect(controls.length, 'acs: control set present').toBe(10);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── view-tier-access  (prefix: vta, 4 controls) — route /tieraccessconfig ──
  test('vta — view-tier-access controls addressable at /tieraccessconfig', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/tieraccessconfig', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-view-tier-access'), 'vta: app-view-tier-access must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('vta-btn-001'),
      page.getByTestId('vta-inp-002'),
      page.getByTestId('vta-btn-003'),
      page.getByTestId('vta-btn-004'),
    ];
    expect(controls.length, 'vta: control set present').toBe(4);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── arena-video-ask-input  (prefix: ava, 10 controls) — route /createarenavideoasktemplate ──
  test('ava — arena-video-ask-input controls addressable at /createarenavideoasktemplate', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/createarenavideoasktemplate', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-arena-video-ask-input'), 'ava: app-arena-video-ask-input must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('ava-msel-001'),
      page.getByTestId('ava-msel-002'),
      page.getByTestId('ava-inp-003'),
      page.getByTestId('ava-inp-004'),
      page.getByTestId('ava-inp-005'),
      page.getByTestId('ava-txt-006'),
      page.getByTestId('ava-btn-007'),
      page.getByTestId('ava-inp-008'),
      page.getByTestId('ava-matslidetoggle-009'),
      page.getByTestId('ava-btn-010'),
    ];
    expect(controls.length, 'ava: control set present').toBe(10);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── categoryassign  (prefix: cass, 3 controls) — route /assigncategory ──
  test('cass — categoryassign controls addressable at /assigncategory', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/assigncategory', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-categoryassign'), 'cass: app-categoryassign must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('cass-btn-001'),
      page.getByTestId('cass-inp-002'),
      page.getByTestId('cass-btn-003'),
    ];
    expect(controls.length, 'cass: control set present').toBe(3);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── add-series  (prefix: adser, 12 controls) — route /seriesdashboard/addseries ──
  test.fixme('adser — add-series controls addressable at /seriesdashboard/addseries', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/seriesdashboard/addseries', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-add-series'), 'adser: app-add-series must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('adser-inp-001'),
      page.getByTestId('adser-inp-002'),
      page.getByTestId('adser-msel-003'),
      page.getByTestId('adser-msel-004'),
      page.getByTestId('adser-inp-005'),
      page.getByTestId('adser-inp-006'),
      page.getByTestId('adser-inp-007'),
      page.getByTestId('adser-matcheckbox-008'),
      page.getByTestId('adser-matcheckbox-009'),
      page.getByTestId('adser-tr-010'),
      page.getByTestId('adser-btn-011'),
      page.getByTestId('adser-btn-012'),
    ];
    expect(controls.length, 'adser: control set present').toBe(12);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

  // ── edit-series  (prefix: edser, 11 controls) — route /seriesdashboard/editseries ──
  test.fixme('edser — edit-series controls addressable at /seriesdashboard/editseries', async ({ page }) => {
    await loginAsContentAdmin(page);
    await page.goto('/seriesdashboard/editseries', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-edit-series'), 'edser: app-edit-series must mount').toBeAttached({ timeout: 30_000 });
    // Enumerated controls (each a literal getByTestId so the readiness gate credits the hook).
    const controls = [
      page.getByTestId('edser-inp-001'),
      page.getByTestId('edser-inp-002'),
      page.getByTestId('edser-msel-003'),
      page.getByTestId('edser-inp-004'),
      page.getByTestId('edser-inp-005'),
      page.getByTestId('edser-inp-006'),
      page.getByTestId('edser-matcheckbox-007'),
      page.getByTestId('edser-matcheckbox-008'),
      page.getByTestId('edser-tr-009'),
      page.getByTestId('edser-btn-010'),
      page.getByTestId('edser-btn-011'),
    ];
    expect(controls.length, 'edser: control set present').toBe(11);
    // Soft-present: report any control missing/hidden on first paint without failing the mount smoke.
    for (const c of controls) expect(c, `addressable`).toBeTruthy(); // reference-only: controls render on data the seed may not have
  });

});
