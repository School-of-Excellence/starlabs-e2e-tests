// event-participation-confirmation.spec.ts — Event Participation Confirmations overview + product
// funnel: mount + the app-computed "Potential" and "Approved" funnel counts (real UI, ANTI-CIRCULAR).
// Closes the "never opened" gap flagged in the StarLabs route-coverage map (2026-09-03) for
// `/event-participation-confirmation`.
//
// Recon: recon-allcomp/events-arena.md (EPC-01 / EPC-02)
//
// Anti-circularity: `counts.potential`/`counts.approved` in product-funnel.component.ts are not stored
// fields — they're computed client-side from joined `participantsproduct`/`event participation
// request` reads. We assert them against INDEPENDENT server-side counts of the same predicates, never
// against a value this test wrote.
//
// Selectors were derived from static source review of event-participation-confirmations.component.ts
// and product-funnel.component.ts/.html (no Angular unit test exists for either to cross-check
// against, and this suite has never opened the route before), not from a live DOM — expect to true
// these up against the emulator on first run.
import { test, expect } from '@playwright/test';
import { evtActors, evtIds, evtNames, evtProfileIds, installEvtStubs, loginAsEvtAdmin, refTo, resetPpEpc } from './support/events';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { selectMatOption } from '../_shared/mat-select';
import { countWhere, getDoc, pollUntil, queryWhere } from '../queue/support/firestore-admin';

const RUN = process.env.EVT_RUNID || 'evt';
const EVENT_NAME = `TEST Event ${RUN}`;
const PRODUCT_NAME = `TEST Event Product ${RUN}`;

// ===========================================================================================
// READ-PATH (EPC-01) — no dialog handling needed, fastest path to a first green run.
// ===========================================================================================
test.describe('Event Participation Confirmations — overview + funnel (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installEvtStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'event-participation-confirmation: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // EPC-01 — open the seeded arena's funnel and assert the app's own "Potential" + "Approved"
  // segment counts against independent Firestore counts of the same predicates.
  // ===========================================================================================
  test('EPC-01 the product funnel renders the app-computed Potential + Approved counts (== independent Firestore counts)', async ({ page }) => {
    // Oracles (independent computation):
    // - "Potential" = participantsproduct where productref==P1 && status==null. Only PP_EPC (p6)
    //   matches — p0/p1 are already "approved" via an EPR but carry no participantsproduct doc.
    const potentialOracle = await countWhere('participantsproduct', [
      ['productref', '==', refTo('products', evtIds.product1)],
      ['status', '==', null],
    ]);
    expect(potentialOracle, 'EPC-01: seeded precondition — PP_EPC is the sole owner-with-no-EPR row').toBe(1);
    // - "Approved" = event participation request where arenaeventid==ARENAEVT1 && status=='approved'.
    const approvedOracle = await countWhere('event participation request', [
      ['arenaeventid', '==', evtIds.arenaEvent1],
      ['status', '==', 'approved'],
    ]);
    // Floor, not exact equality: EPC-02 (this same file, runs before this test alphabetically-adjacent
    // in a full-file run and reruns) approves p6 for real, writing an EXTRA approved EPR with a fresh
    // auto-id and NO testrunid — reseeding can't sweep it, so it can persist across runs. The UI-vs-
    // oracle comparison below stays exact against WHATEVER this count is at run time.
    expect(approvedOracle, 'EPC-01: seeded precondition — at least EPR0 + EPR1 are approved').toBeGreaterThanOrEqual(2);
    // "Prove the filter" doc (mirrors comms' delete:true channeltemplates row): EPR2 shares
    // ARENAEVT1 but is status:'requested' — a same-arena EPR that must never count as "Approved".
    const totalEprForArena = await countWhere('event participation request', [['arenaeventid', '==', evtIds.arenaEvent1]]);
    expect(totalEprForArena, 'EPC-01: EPR2 (requested) must not be counted as approved').toBe(approvedOracle + 1);

    await loginAsEvtAdmin(page);
    await page.goto('/event-participation-confirmation', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/event-participation-confirmation/, { timeout: 30_000 });
    await expect(page.getByText('Event participation confirmations', { exact: true }), 'EPC-01: overview heading must render')
      .toBeVisible({ timeout: 30_000 });

    // [REAL-UI] the overview row is a keyboard-activatable "button" role, aria-labelled by the app
    // with the product + event name it resolved from the arena/product docs it streamed.
    const row = page.getByRole('button', { name: `Open ${PRODUCT_NAME} ${EVENT_NAME}` });
    await expect(row, 'EPC-01: the seeded arena row must render on the overview').toBeVisible({ timeout: 30_000 });
    await row.click();

    // The funnel opens in its own dynamic tab (tab label combines product + event name).
    const funnelTab = page.getByRole('tab', { name: new RegExp(PRODUCT_NAME) });
    await expect(funnelTab, 'EPC-01: the funnel tab must open').toBeVisible({ timeout: 30_000 });

    // [ASSERT] the app-computed "Potential" and "Approved" funnel cards.
    const potentialCard = page.locator('button.sx-bd-row').filter({ hasText: 'Potential' });
    await expect(potentialCard, 'EPC-01: the Potential funnel card must render').toBeVisible({ timeout: 30_000 });
    await expect(potentialCard.locator('.sx-bd-num'), `EPC-01: Potential must equal the independent count (${potentialOracle})`)
      .toHaveText(String(potentialOracle), { timeout: 20_000 });

    const approvedCard = page.locator('button.sx-bd-row').filter({ hasText: 'Approved' }).filter({ hasNotText: 'not' });
    await expect(approvedCard, 'EPC-01: the Approved funnel card must render').toBeVisible({ timeout: 20_000 });
    await expect(approvedCard.locator('.sx-bd-num'), `EPC-01: Approved must equal the independent count (${approvedOracle})`)
      .toHaveText(String(approvedOracle), { timeout: 20_000 });
  });
});

// ===========================================================================================
// WRITE-PATH (EPC-02) — Approve. Written only after EPC-01 (the read-path harness) is known-good.
//
// DIALOG NOTE: approveSelected() confirms via `this.dialog.open(this.confirmTpl, ...)` — an Angular
// Material dialog (real DOM, `MatDialogRef`), NOT a native `window.confirm()`. Verified by grepping
// product-funnel.component.ts for `window.confirm`/`window.prompt` — zero matches. So there is no
// Playwright `page.on('dialog')` auto-dismiss trap here (unlike live-event-dashboard-v3's Mark
// Attendance, which DOES use a native confirm() — see live-event-dashboard-v3.spec.ts LED3-02); a plain
// `dialog.getByRole('button', ...).click()` on the rendered `mat-dialog-actions` button is correct and
// sufficient. Still written its own describe block, after the read-path, per the same "prove the
// harness before adding a write" ordering the comms channel-templates work used.
// ===========================================================================================
test.describe('Event Participation Confirmations — Approve (real UI, write-path, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installEvtStubs(page);
    // Precondition (anti-circular, re-runnable): restore PP_EPC to status:null and delete any EPR the
    // app created for p6 on a prior run, so this test starts from the same known "eligible" state.
    await resetPpEpc();
  });
  test.afterEach(() => assertNoFatal(guard, 'event-participation-confirmation (approve): no fatal console errors / pageerrors'));

  test('EPC-02 approving the sole eligible participant flips participantsproduct to "initiated" and creates an approved EPR', async ({ page }) => {
    // Precondition (anti-circular): PP_EPC must be a clean, uninitiated owner before the click.
    const before = await getDoc('participantsproduct', evtIds.ppEpc);
    expect(before?.status ?? null, 'EPC-02: PP_EPC starts status:null (owned, uninitiated)').toBeNull();
    const priorEprForP6 = await countWhere('event participation request', [['profileid', '==', evtProfileIds.p6]]);
    expect(priorEprForP6, 'EPC-02: p6 must start with no event participation request').toBe(0);

    await loginAsEvtAdmin(page);
    await page.goto('/event-participation-confirmation', { waitUntil: 'domcontentloaded' });
    const row = page.getByRole('button', { name: `Open ${PRODUCT_NAME} ${EVENT_NAME}` });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click();
    await expect(page.getByRole('tab', { name: new RegExp(PRODUCT_NAME) })).toBeVisible({ timeout: 30_000 });

    // [REAL-UI] switch to the "Not requested" segment. Verified live against the emulator: p6 (owns
    // P1, no request, no queue token) lands in "Not requested" (count 1), not "Eligible" (count 0) —
    // "Eligible" is a narrower bucket than the name suggests. Both "eligible" and "notRequested" put
    // the component in selectionMode 'approve' (product-funnel.component.ts:846), so either works;
    // this one is where p6 actually is.
    await page.locator('button.sx-bd-row').filter({ hasText: 'Not requested' }).click();

    const p6Row = page.locator('tr, .sx-row', { hasText: evtActors.participant6 });
    await expect(p6Row, 'EPC-02: p6\'s eligible row must render').toBeVisible({ timeout: 30_000 });
    await p6Row.locator('mat-checkbox, input[type="checkbox"]').first().click();

    // Pick the seeded delivery sequence (required — canApprove() is false without it). The mat-form-field's
    // floating <mat-label> sits over the mat-select trigger and intercepts a normal click (verified live
    // against the emulator), which is why this forced the click; but force also skips actionability, so the
    // click can land before Material wires the overlay and silently open nothing. _shared/mat-select.ts
    // opens, asserts the panel and picks inside it — same CDK-overlay quirk as EVT-09 in events.spec.ts.
    const deliverySelect = page.getByRole('combobox', { name: 'Delivery sequence' });
    await selectMatOption(page, deliverySelect, evtNames.deliverySet);

    const approveBtn = page.getByRole('button', { name: 'Approve 1' });
    await expect(approveBtn, 'EPC-02: the Approve button must show readyCount==1').toBeEnabled({ timeout: 20_000 });
    await approveBtn.click();

    // [REAL-UI] the confirm dialog is a mat-dialog (see file header note) — a real button, no
    // page.on('dialog') needed.
    const confirmDialog = page.getByRole('dialog').filter({ hasText: 'Approve participants' });
    await expect(confirmDialog, 'EPC-02: the confirm dialog must open').toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole('button', { name: 'Approve 1' }).click();

    // [ASSERT] the values the APP wrote on the real click — read back via the admin SDK, never the
    // UI's own optimistic state.
    await pollUntil(
      () => getDoc('participantsproduct', evtIds.ppEpc),
      (d) => d?.['status'] === 'initiated',
      { label: 'EPC-02: PP_EPC -> status "initiated"', timeoutMs: 30_000 },
    );
    const newEprs = await pollUntil(
      () => queryWhere('event participation request', [['profileid', '==', evtProfileIds.p6]]),
      (rows) => rows.length >= 1,
      { label: 'EPC-02: a new event participation request created for p6', timeoutMs: 30_000 },
    );
    expect(newEprs[0]['status'], 'EPC-02: the new EPR must be status "approved"').toBe('approved');
    expect(newEprs[0]['arenaeventid'], 'EPC-02: the new EPR must be scoped to ARENAEVT1').toBe(evtIds.arenaEvent1);
  });
});

// ===========================================================================================
// Route-mount smoke — proves the dashboard route-grant seeded (ROUTES in seed-events.js) and the
// guard admits the super-role admin.
// ===========================================================================================
test('event-participation-confirmation route mounts for the super-role admin (no /login bounce)', async ({ page }) => {
  await installEvtStubs(page);
  await loginAsEvtAdmin(page);
  await page.goto('/event-participation-confirmation', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  expect(page.url(), 'event-participation-confirmation must not bounce to /login').not.toMatch(/\/login/);
});
