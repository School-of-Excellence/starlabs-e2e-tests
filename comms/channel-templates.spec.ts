// channel-templates.spec.ts — /channel-templates LIST renders (REAL-UI, anti-circular).
//
// Recon: e2e/recon-allcomp/comms-notifications.md (CN-18 / CN-19 / CN-20).
//
// WHY THIS FILE EXISTS: the comms suite's `appPaths` glob already claimed
// `src/app/Channel Communication/**`, so a change there made the comms gate MANDATORY — but no spec
// ever opened the module's only route. The gate ran green while testing none of it. Found by
// scripts/check-route-coverage.mjs (2026-09-03 coverage pass); these cases make the claim true.
//
// Anti-circularity: every case asserts something the APP produced from its OWN
// getDocs(channeltemplates, orderBy('createddate','desc')) read (component ts:299-300) — a rendered row,
// an in-app `.filter(t => !t.delete)` exclusion (ts:302), or the `statusCounts` tally the component
// derived (ts:305-309 → html:93-95). The seed is a PRECONDITION only; no case asserts a value the test
// itself wrote into the view. The query is single-field orderBy — no composite index needed.
//
// SCOPE NOTE: the write-path cases (CN-21 approve / CN-22 rework / CN-23 duplicate) live in this suite too
// but are gated on native confirm()/prompt() dialogs — see the recon implementation notes. They are added
// only after these read-path cases are green, so a dialog-handling mistake can never be mistaken for a
// seed or wiring problem.
import { test, expect } from '@playwright/test';
import {
  installCommsStubs, loginAsCommsAdmin, channelTemplateNames, commsIds, resetChannelTemplates,
} from './support/comms';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { countWhere, getDoc, pollUntil } from '../queue/support/firestore-admin';

/**
 * /channel-templates DIVERGES BY APP BRANCH (recon risk #11, verified 2026-09-03):
 *   origin/development  present (app.routes.ts:325)
 *   origin/cicd-dev     present
 *   origin/cicd         ABSENT
 *
 * This is the CN-14 divergence inverted, and the fourth instance of this class in the repo after CN-14,
 * PA-09 and EVT-15/16. When the route is absent the app falls to the `**` catch-all
 * (ExceptionalroutingComponent → /EISDashboard) and `app-channeltemplates` can never mount — no test-side
 * timing change can fix that, and force-clicking through it chases the wrong layer (the EVT-15/16 lesson).
 *
 * So: read the LIVE Router config via the dev-build `ng` debug API and skip gracefully when the route does
 * not exist. This SELF-HEALS — the cases run for real the moment the branch under test carries the route.
 */
async function skipIfRouteAbsent(page: import('@playwright/test').Page): Promise<void> {
  const hasRoute = await page.evaluate(() => {
    const ng = (window as unknown as { ng?: { getComponent(el: Element | null): any } }).ng;
    const app = ng?.getComponent(document.querySelector('app-root'));
    const cfg: Array<{ path?: string }> = app?.router?.config ?? [];
    return cfg.some((r) => r.path === 'channel-templates');
  });
  test.skip(
    !hasRoute,
    '/channel-templates is absent from the app under test. The route exists on `development` and ' +
    '`cicd-dev` but NOT on `cicd`, so navigation falls to the ** catch-all and the screen cannot mount. ' +
    'Self-runs once the branch under test carries the route.',
  );
}

/**
 * EXACT-match locator for a template's name cell.
 *
 * `hasText` is a SUBSTRING match, so `hasText: 'Pending Channel comm'` also matches the
 * 'Pending Channel comm (Copy)' doc CN-23 makes the app create — a strict-mode violation the moment a copy
 * exists. Anchor the regex so each seeded name resolves to exactly one cell. (Found by running the suite
 * twice back-to-back; the first run was green.)
 */
const nameCell = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.template-name')
    .filter({ hasText: new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) });

/** Navigate to the screen and wait for the component the app mounts (not a bare URL check). */
async function openChannelTemplates(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/channel-templates', { waitUntil: 'domcontentloaded' });
  await skipIfRouteAbsent(page);
  await expect(page).toHaveURL(/channel-templates/, { timeout: 30_000 });
  await expect(
    page.locator('app-channeltemplates'),
    'channel-templates must mount',
  ).toBeVisible({ timeout: 30_000 });
}

test.describe('Comms — /channel-templates list renders (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installCommsStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'channel-templates: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-18 — the list renders the seeded templates from the app's own getDocs(orderBy) read
  // ===========================================================================================
  test('CN-18 channel-templates list renders the seeded templates', async ({ page }) => {
    await loginAsCommsAdmin(page);
    await openChannelTemplates(page);

    // [REAL-UI] ngOnInit → loadTemplates() runs getDocs(channeltemplates, orderBy('createddate','desc')),
    // filters delete:true out IN THE APP, and renders a MatTable row per survivor. Each seeded
    // non-deleted template must appear in a .template-name cell the APP rendered from that stream.
    for (const name of [
      channelTemplateNames.approved,
      channelTemplateNames.pending,
      channelTemplateNames.rework,
    ]) {
      await expect(
        nameCell(page, name),
        `CN-18: seeded template "${name}" must render in the list`,
      ).toBeVisible({ timeout: 30_000 });
    }

    // The templateid cell on the same row is the app rendering a DIFFERENT seeded field of the same doc —
    // a non-tautological signal that the row came from Firestore rather than from a name match alone.
    const row = page.locator('tr.mat-mdc-row, tr[mat-row]')
      .filter({ hasText: channelTemplateNames.approved });
    expect(
      await row.innerText(),
      'CN-18: the approved row must also render its seeded category',
    ).toContain('Test');
  });

  // ===========================================================================================
  // CN-19 — a soft-deleted template is hidden by the app's OWN .filter(t => !t.delete)
  // ===========================================================================================
  test('CN-19 a soft-deleted template is excluded from the rendered list', async ({ page }) => {
    // [PRECONDITION] The deleted doc must genuinely EXIST in Firestore. Without this assertion the case
    // could not tell "the app filtered it out" (what we want to prove) from "the doc was never seeded"
    // (which would pass for the wrong reason). Deletion here is SOFT — component ts:461 sets delete:true
    // and never removes the doc.
    const deleted = await getDoc('channeltemplates', commsIds.CT_DELETED);
    expect(deleted, 'CN-19 precondition: the soft-deleted seed doc must exist').toBeTruthy();
    expect(deleted?.delete, 'CN-19 precondition: the seed doc must carry delete:true').toBe(true);

    await loginAsCommsAdmin(page);
    await openChannelTemplates(page);

    // Wait for the list to have actually rendered before asserting an ABSENCE — otherwise this passes
    // trivially against an empty table that simply had not loaded yet.
    await expect(
      nameCell(page, channelTemplateNames.approved),
      'CN-19: the list must have rendered before asserting the deleted row is absent',
    ).toBeVisible({ timeout: 30_000 });

    // [ASSERT] The app's own loadTemplates() filter dropped it: the name renders NOWHERE on the page.
    await expect(
      nameCell(page, channelTemplateNames.deleted),
      'CN-19: the soft-deleted template must NOT render — proves the app\'s own !t.delete filter ran',
    ).toHaveCount(0);
  });

  // ===========================================================================================
  // CN-20 — the status pills show the tallies the COMPONENT derived, not seeded numbers
  // ===========================================================================================
  test('CN-20 status pills show the app-computed pending/approved/rework tallies', async ({ page }) => {
    await loginAsCommsAdmin(page);
    await openChannelTemplates(page);

    await expect(
      page.locator('.status-pill').first(),
      'CN-20: the status pills must render',
    ).toBeVisible({ timeout: 30_000 });

    // [ORACLE] statusCounts is computed in loadTemplates() (ts:305-309) over the docs the app read and
    // filtered — the test never writes a count anywhere. Build the expected tally from Firestore via
    // admin (excluding soft-deleted docs, exactly as the app does) and assert the APP's rendered number
    // matches. Counts are project-wide, not run-scoped, because the component's own query is unfiltered —
    // scoping the expectation to testrunid would assert a number the app never computed.
    for (const status of ['pending', 'approved', 'rework'] as const) {
      const expected = await countWhere('channeltemplates', [
        ['status', '==', status],
        ['delete', '==', false],
      ]);
      const pill = page.locator('.status-pill', { hasText: new RegExp(`${status}$`, 'i') });
      await expect(
        pill.locator('b'),
        `CN-20: the "${status}" pill must show the app-computed tally (${expected})`,
      ).toHaveText(String(expected), { timeout: 30_000 });
    }
  });
});

// ===============================================================================================
// WRITE-PATH cases. Separate describe because they need resetChannelTemplates() as a precondition
// and the read-path cases must stay independent of anything these write.
// ===============================================================================================
test.describe('Comms — /channel-templates approval actions (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;

  test.beforeEach(async ({ page }) => {
    // PRECONDITION: put the write targets back to pending / empty timeline and prune app-created copies.
    // Without this these cases pass VACUOUSLY on a second run — the asserted values would already be there
    // from the previous run rather than written by the app during this one.
    await resetChannelTemplates();
    guard = attachConsoleGuard(page);
    await installCommsStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'channel-templates actions: no fatal console errors'));

  /** The action buttons for one template, scoped to its own MatTable row. */
  const rowFor = (page: import('@playwright/test').Page, name: string) =>
    page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: name });

  // ===========================================================================================
  // CN-21 — approving a pending template writes status:'approved' + an 'Approved' timeline entry
  // ===========================================================================================
  test('CN-21 approving a pending template writes approved status and a timeline entry', async ({ page }) => {
    await loginAsCommsAdmin(page);
    await openChannelTemplates(page);

    const row = rowFor(page, channelTemplateNames.pending);
    await expect(row, 'CN-21: the pending template row must render').toBeVisible({ timeout: 30_000 });

    // approveTemplate() opens a NATIVE confirm() (component ts:418). Playwright AUTO-DISMISSES dialogs when
    // no handler is registered — the approve would then silently no-op and this test would still PASS.
    // Registering the handler is what makes the case real; assert the dialog actually appeared.
    let sawDialog = false;
    page.once('dialog', async (d) => { sawDialog = true; await d.accept(); });

    await row.locator('.approve-btn').click();

    // [ASSERT] Every asserted field here is written BY THE APP (ts:421-429) — the test supplies none of them.
    const doc = await pollUntil(
      () => getDoc('channeltemplates', commsIds.CT_PENDING),
      (d) => d?.status === 'approved',
      { timeoutMs: 20_000, label: 'CN-21: app writes status=approved' },
    );
    expect(sawDialog, 'CN-21: the confirm() dialog must have been raised and accepted').toBe(true);
    expect(doc?.status, 'CN-21: the app must write status=approved').toBe('approved');
    expect(doc?.approvedby, 'CN-21: the app must stamp approvedby from the signed-in uid').toBeTruthy();

    const timeline = (doc?.timeline ?? []) as Array<{ action?: string }>;
    expect(
      timeline.some((t) => t.action === 'Approved'),
      `CN-21: the app must append an 'Approved' timeline entry (got ${JSON.stringify(timeline)})`,
    ).toBe(true);

    // [REAL-UI] loadTemplates() re-runs after the write, so the app must also re-render the row's chip.
    await expect(
      rowFor(page, channelTemplateNames.pending),
      'CN-21: the re-rendered row must show the app-computed "Approved" chip',
    ).toContainText(/approved/i, { timeout: 30_000 });
  });

  // ===========================================================================================
  // CN-22 — sending for rework writes status:'rework' + the typed note into the timeline
  // ===========================================================================================
  test('CN-22 sending a template for rework writes rework status and the typed note', async ({ page }) => {
    await loginAsCommsAdmin(page);
    await openChannelTemplates(page);

    const row = rowFor(page, channelTemplateNames.reworkTarget);
    await expect(row, 'CN-22: the rework-target row must render').toBeVisible({ timeout: 30_000 });

    // reworkTemplate() opens a NATIVE prompt() (component ts:438) and uses the entered text as the timeline
    // note. accept(text) supplies it — the note is the ONLY test-authored value in this case; the surrounding
    // doc shape, the action label and the arrayUnion are all the app's (ts:445-448).
    const NOTE = `CN-22 rework note ${Date.now()}`;
    let sawDialog = false;
    page.once('dialog', async (d) => { sawDialog = true; await d.accept(NOTE); });

    await row.locator('.rework-btn').click();

    const doc = await pollUntil(
      () => getDoc('channeltemplates', commsIds.CT_REWORK_TARGET),
      (d) => d?.status === 'rework',
      { timeoutMs: 20_000, label: 'CN-22: app writes status=rework' },
    );
    expect(sawDialog, 'CN-22: the prompt() dialog must have been raised and accepted').toBe(true);
    expect(doc?.status, 'CN-22: the app must write status=rework').toBe('rework');

    const timeline = (doc?.timeline ?? []) as Array<{ action?: string; notes?: string }>;
    const entry = timeline.find((t) => t.action === 'Rework');
    expect(entry, `CN-22: the app must append a 'Rework' timeline entry (got ${JSON.stringify(timeline)})`)
      .toBeTruthy();
    expect(entry?.notes, 'CN-22: the app must carry the typed note into the timeline entry').toBe(NOTE);
  });

  // ===========================================================================================
  // CN-23 — duplicating creates exactly ONE new pending ' (Copy)' doc
  // ===========================================================================================
  test('CN-23 duplicating a template creates exactly one new pending copy', async ({ page }) => {
    // [PRECONDITION] resetChannelTemplates() pruned prior copies, so the before-count is 0 and the delta is
    // purely the doc the APP writes. Asserting the delta (not the absolute count) also keeps this honest if
    // another run leaves a copy behind.
    const before = await countWhere('channeltemplates', [
      ['templatename', '==', channelTemplateNames.pendingCopy],
    ]);

    await loginAsCommsAdmin(page);
    await openChannelTemplates(page);

    const row = rowFor(page, channelTemplateNames.pending);
    await expect(row, 'CN-23: the source template row must render').toBeVisible({ timeout: 30_000 });

    // duplicateTemplate() takes NO confirm() — it writes immediately (ts:471-489).
    await row.locator('.duplicate-btn').click();

    // [ASSERT] the count of the APP's own write. The ' (Copy)' name, the '_copy' templateid and the reset to
    // status:'pending' are all decided by the component — the test never writes this doc.
    const after = await pollUntil(
      () => countWhere('channeltemplates', [['templatename', '==', channelTemplateNames.pendingCopy]]),
      (n) => n > before,
      { timeoutMs: 20_000, label: 'CN-23: app writes one (Copy) doc' },
    );
    expect(after - before, 'CN-23: the app must create exactly ONE copy').toBe(1);

    // The copy's own fields are the app's decisions — assert the two it computes rather than inherits.
    const copies = await countWhere('channeltemplates', [
      ['templatename', '==', channelTemplateNames.pendingCopy],
      ['status', '==', 'pending'],
    ]);
    expect(copies, 'CN-23: the app must reset the copy to status=pending').toBe(1);
  });
});
