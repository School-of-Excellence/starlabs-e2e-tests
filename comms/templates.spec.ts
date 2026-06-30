// templates.spec.ts — Email-template + One-Way-template LIST renders (REAL-UI, anti-circular).
//
// Recon: e2e/recon-allcomp/comms-notifications.md (CN-02 / CN-14).
// Anti-circularity: each case asserts a row the APP RENDERED from its OWN getDocs query
//   (email templates orderBy('date') / onewaytemplates orderBy('createddate')) — plus a derived value
//   the component COMPUTED from the seeded fields (the email status chip text getStatusText() → "Approved"
//   for templatevalidated:true). The seed is the precondition; the rendered row + computed label are the
//   app's. Neither query needs a composite index (single-field orderBy only).
//
// SCOPE NOTE: the email SEND broadcast + Postmark template-validation flows (recon CN-04/CN-05/CN-13) and
// the one-way CHANNEL broadcast (CN-15) write to a cross-project / Postmark boundary and/or drive a heavy
// ngx-editor create form with an async name validator + confirm() dialogs. They are left as TODO + recorded
// as blockers rather than shipped flaky. These LIST-render cases prove the screens mount and query.
import { test, expect } from '@playwright/test';
import { installCommsStubs, loginAsCommsAdmin } from './support/comms';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const RUN = process.env.COMM_RUNID || 'comm';

test.describe('Comms — template list renders (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installCommsStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'comms templates: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-02 — /email-templates list renders the seeded approved template with its computed status
  // ===========================================================================================
  test('CN-02 email-templates list renders the approved template as "Approved"/"Validated"', async ({ page }) => {
    await loginAsCommsAdmin(page);
    await page.goto('/email-templates', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/email-templates/, { timeout: 30_000 });

    // [REAL-UI] viewMode defaults to 'list'; ngOnInit → loadExistingTemplates() runs
    // getDocs(email templates, orderBy('date','desc')) and renders a MatTable. The approved template row
    // (unique name) must appear, and getStatusText() computed "Approved" from templatevalidated:true.
    const approvedRow = page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: `Approved Email ${RUN}` });
    await expect(approvedRow, 'CN-02: the seeded approved email template row must render').toBeVisible({ timeout: 30_000 });

    const rowText = (await approvedRow.innerText()).replace(/\s+/g, ' ');
    // The component maps templatevalidated:true → status chip "Approved" + validation label "Validated"
    // (getStatusText, html:216/239) — values the app COMPUTED from the seeded boolean, not seeded strings.
    expect(rowText, `CN-02: status chip must read the app-computed "Approved". Row="${rowText}"`).toContain('Approved');
    // The validation label renders uppercase ("VALIDATED") via the component's status pipe — match case-insensitively.
    expect(rowText, 'CN-02: validation label must read the app-computed "Validated"').toMatch(/validated/i);

    // The pending template renders too, with the app computing "Pending" — corroborates the column is a
    // real per-row computation (not a constant), without asserting on the send selector (out of scope).
    const pendingRow = page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: `Pending Email ${RUN}` });
    await expect(pendingRow, 'CN-02: the seeded pending email template row must render').toBeVisible({ timeout: 30_000 });
    expect((await pendingRow.innerText())).toContain('Pending');
  });

  // ===========================================================================================
  // CN-14 — /onewaytemplates list renders the seeded one-way template (app's loadTemplates query)
  // ===========================================================================================
  test('CN-14 onewaytemplates list renders the seeded template', async ({ page }) => {
    await loginAsCommsAdmin(page);

    // ROOT CAUSE (CI-only — re-derived from the failing run's Playwright TRACE, not the earlier guess).
    // The authGuard (auth.guard.ts) runs THREE sequential Firestore reads on EVERY navigation —
    // getRoles() [getDocs(profile_data)+getDoc(role_ref)], username() [getDocs(profile_data)] and
    // routeConfig() [getDocs(dashboard)]. On the COLD first deep-link right after login, those reads
    // stall (the Firestore client + the app's many onSnapshot listeners are still warming), so CanActivate
    // never resolves and the target never mounts. Firestore here uses the DEFAULT MEMORY cache
    // (app.config.ts: `provideFirestore(() => getFirestore())`, no persistentLocalCache) — so a
    // `page.goto` reload tears down the page, gives a fresh COLD client, and re-hits the same stall. That
    // is why the prior retry-`page.goto` never cleared CI (every retry reloads → re-cold).
    // The trace also disproved the old "heaviest-chunk delays the guard" note: canActivate runs BEFORE
    // loadComponent, the onewaytemplates chunk is never even fetched, and a stray programmatic
    // navigateByUrl can resolve to the `**` catch-all (ExceptionalroutingComponent → redirects to
    // /EISDashboard after 1.5s), which is the observed "bounce".
    //
    // FIX: (1) WARM the guard's read path IN THIS PAGE SESSION on a LIGHT guarded route (/email-templates —
    // CN-02 proves it admits on a fresh-login deep link). Waiting for its component to fully MOUNT proves
    // all three guard reads completed → the Firestore client is warm. (Not /communication: it throws a
    // runtime `profilelist` error on the emulator seed and would trip the console guard.) (2) Reach
    // /onewaytemplates via an IN-APP Angular Router navigation so the warm client is PRESERVED (no reload),
    // RETRYING the in-app nav until the host mounts — because a single programmatic navigateByUrl can land
    // on the `**` catch-all, but a retry (still no reload, so still warm) converges. This is a fresh-login
    // deep-link hardening only; real menu-driven navigation is unaffected.
    await page.goto('/email-templates', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/email-templates/, { timeout: 30_000 });
    await expect(
      page.locator('app-create-email-template'),
      'CN-14 warm-up: /email-templates must fully mount (all three authGuard reads completed → warm)',
    ).toBeVisible({ timeout: 30_000 });

    // Preload the heavy onewaytemplates lazy chunk via its route loader so the navigation itself only has
    // to run the (now-warm) guard, not also fetch+transform ngx-editor/emoji-mart. Best-effort.
    await page.evaluate(async () => {
      const ng = (window as unknown as { ng: any }).ng;
      const app = ng.getComponent(document.querySelector('app-root'));
      const route = (app.router.config || []).find((r: any) => r.path === 'onewaytemplates');
      if (route?.loadComponent) { try { await route.loadComponent(); } catch { /* preload best-effort */ } }
    });

    // IN-APP navigation, retried (NO page.goto = no reload = warm Firestore client preserved across retries).
    // Each attempt fires navigateByUrl (timeout-guarded so a stalled guard can't hang the retry loop) and
    // checks the host mounted; if it bounced to /EISDashboard or the `**` catch-all, toPass re-issues it.
    await expect(async () => {
      await page.evaluate(async () => {
        const ng = (window as unknown as { ng: any }).ng;
        const app = ng.getComponent(document.querySelector('app-root'));
        await Promise.race([
          app.router.navigateByUrl('/onewaytemplates').catch(() => {}),
          new Promise((r) => setTimeout(r, 8000)),
        ]);
      });
      await expect(
        page.locator('app-oneway-templates'),
        'CN-14: onewaytemplates must mount (guard admits — not bounced to /EISDashboard or the ** route)',
      ).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: 90_000, intervals: [1_000, 2_000, 3_000] });
    await expect(page).toHaveURL(/onewaytemplates/, { timeout: 30_000 });

    // [REAL-UI] viewMode defaults to 'list'; ngOnInit → loadTemplates() runs
    // getDocs(onewaytemplates, orderBy('createddate','desc')).filter(!delete) and renders a MatTable. The
    // seeded template (unique name) must appear in the .template-name cell the app rendered.
    const name = page.locator('.template-name', { hasText: `Seeded Oneway ${RUN}` });
    await expect(name, 'CN-14: the seeded one-way template must render in the list').toBeVisible({ timeout: 30_000 });

    // Its category cell is the app rendering the seeded field on the same row (a non-tautological signal).
    const row = page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: `Seeded Oneway ${RUN}` });
    expect((await row.innerText())).toContain('Test');
  });
});
