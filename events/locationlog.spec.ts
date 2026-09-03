// locationlog.spec.ts — Location Log dashboard: mount + seeded-row render + real delete (real UI,
// ANTI-CIRCULAR). Closes the "never opened" gap flagged in the StarLabs route-coverage map
// (2026-09-03) for `/locationlog`.
//
// NOTE (flagged, not "fixed"): `/locationlog` carries NO `canActivate` guard in app.routes.ts — every
// neighbouring Events route has `[authGuard]`, this one doesn't. That reads as an accidental omission
// (it means the `dashboard` route-grant system is bypassed entirely for this screen), not a deliberate
// design choice — flag to the app owners, don't silently seed a grant that implies a guard exists.
// seed-events.js's ROUTES array deliberately does NOT include '/locationlog' for the same reason.
//
// Only the "All logs" tab is exercised here — it's a plain list/delete flow with no map or geocoding
// dependency. The "Live tracking" tab's reference-point picker opens a real Leaflet map (OpenStreetMap
// tiles) and calls the real Nominatim search API; this suite has no stub for either yet (there is no
// existing map/geocoding stub anywhere in queue/stubs/ to reuse), so picker-driven flows are explicitly
// OUT OF SCOPE for this first pass — do not open "Set location" / type into "Search for a place"
// without first adding a `page.route` stub for nominatim.openstreetmap.org and tile.openstreetmap.org
// (mirroring queue/stubs/zoom.stub.ts's shape), which is a separate, deliberate follow-up.
//
// Selectors were derived from static source review of locationlog.component.ts/.html and
// location-logs.component.ts/.html (the existing locationlog.component.spec.ts is the bare Angular CLI
// scaffold — it exercises none of this component's data path, see recon notes), not from a live DOM —
// expect to true these up against the emulator on first run.
import { test, expect } from '@playwright/test';
import { evtIds, installEvtStubs, loginAsEvtAdmin, ensureLocationLog } from './support/events';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc } from '../queue/support/firestore-admin';

test.describe('Location Log — live tracking render + All-logs delete (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installEvtStubs(page);
    // Precondition (anti-circular, re-runnable): LOC-03 deletes the seeded row for real — restore it
    // before every test in this file so each test starts from the same known state.
    await ensureLocationLog();
  });
  test.afterEach(() => assertNoFatal(guard, 'locationlog: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // LOC-01 — Live tracking tab renders the seeded participant's row, resolved to their real name
  // via `participant metadata` (not the "Unknown (id)" fallback the service uses when it's missing).
  // ===========================================================================================
  test('LOC-01 live tracking renders the seeded participant row with the app-resolved name', async ({ page }) => {
    await loginAsEvtAdmin(page);
    await page.goto('/locationlog', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Live Location Tracking', { exact: true }), 'LOC-01: live-tracking heading must render')
      .toBeVisible({ timeout: 30_000 });

    // [REAL-UI] the row's name cell is resolved by the service's resolveNames() from `participant
    // metadata/{profileid}.name` (seeded == the participant's email) — never the raw profileid.
    const row = page.locator('table[mat-table] tr.ll-row', { hasText: 'participant0+' });
    await expect(row, 'LOC-01: the seeded participant\'s row must render with its resolved name').toBeVisible({ timeout: 30_000 });
  });

  // ===========================================================================================
  // LOC-03 — "All logs" tab: delete the seeded row through the real confirm-dialog flow, then assert
  // against Firestore (admin read) that the app actually deleted it — not a UI-only optimistic update.
  // ===========================================================================================
  test('LOC-03 deleting a log in "All logs" removes the doc from Firestore', async ({ page }) => {
    // Precondition (anti-circular): the row must exist server-side before the UI action.
    expect((await getDoc('locationlogs', evtIds.loclog1))?.id, 'LOC-03: LOCLOG1 must exist before the delete').toBe(evtIds.loclog1);

    await loginAsEvtAdmin(page);
    await page.goto('/locationlog', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'All logs' }).click();

    // [REAL-UI] find the seeded row by the participant's resolved name, then delete it.
    const row = page.locator('table[mat-table] tr', { hasText: `participant0+` });
    await expect(row, 'LOC-03: the seeded log row must render in "All logs"').toBeVisible({ timeout: 30_000 });
    await row.getByRole('button', { name: /^Delete log for /i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog, 'LOC-03: the delete-confirmation dialog must open').toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: 'Delete permanently' }).click();

    // [ASSERT] the value the APP wrote (a deletion) — read back via the admin SDK, never the UI's own
    // optimistic re-render, so a delete that only updates the client state (and not Firestore) fails.
    await expect(async () => {
      const doc = await getDoc('locationlogs', evtIds.loclog1);
      expect(doc, 'LOC-03: the app must delete LOCLOG1 from Firestore').toBeNull();
    }).toPass({ timeout: 20_000 });
  });
});

// ===========================================================================================
// Route-mount smoke — /locationlog has no canActivate guard (see file header), so this only proves
// the screen renders for a logged-in admin without erroring, not a dashboard-grant admission.
// ===========================================================================================
test('locationlog route mounts for the super-role admin (no /login bounce)', async ({ page }) => {
  await installEvtStubs(page);
  await loginAsEvtAdmin(page);
  await page.goto('/locationlog', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  expect(page.url(), 'locationlog must not bounce to /login').not.toMatch(/\/login/);
});
