// queue-transfer.spec.ts — /queuetransfer render (REAL-UI, anti-circular).
//
// Recon: e2e/queue/recon/ (OP-20 — queue-system screen added by the 2026-09-04 coverage pass).
//
// WHY THIS FILE EXISTS: the last FLAT route left in `queue system`. The two that remain after it
// (/arena/:queueid/:stage, /openmeeting/:id/:collectiontype) take route params and are separate work.
//
// Anti-circularity: the source-queue picker is built from the component's own
// getDocs('queue generation') into `queueGenerationList`, rendered as
// <mat-option>{{queue.queuename}}</mat-option> (queue-transfer.component.html:25). Asserting the seeded
// queue name there is a value the APP fetched and rendered — the test never writes it into the view.
//
// NOTE ON THE DROPDOWN: mat-select panels have been unreliable to drive in this suite (see TODO(BIG-13b)
// in big-activity-screens.spec.ts, where four approaches all failed on a different screen). The mount and
// heading assertions therefore come FIRST and stand on their own; the option assertion is attempted after
// them, so if the panel ever regresses the failure is unambiguous about which part broke.
import { test, expect } from '@playwright/test';
import { QUEUE_NAME, actors, loginAs } from './support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs, ExternalStubs } from './stubs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fa = require('./support/firestore-admin');

let guard: ConsoleGuard;
let stubs: ExternalStubs;

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  stubs = installAllExternalStubs(page);
});

test.afterEach(() => assertNoFatal(guard, 'queue-transfer: no fatal console errors / pageerrors'));

test.describe('Queue — transfer screen (real UI, anti-circular)', () => {
  // ===========================================================================================
  // OP-20 — /queuetransfer mounts and offers the seeded queue as a transfer source
  // ===========================================================================================
  test('OP-20 queuetransfer offers the seeded queue as a transfer source', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);
    await page.goto('/queuetransfer', { waitUntil: 'domcontentloaded' });

    const host = page.locator('app-queue-transfer');
    await expect(
      host,
      'OP-20: queuetransfer must mount — if this fails on a correct URL, check the /queuetransfer ' +
      'dashboard grant in fixtures/seed-test-project.js DRIVEN_ROUTES (authGuard denies unlisted screens)',
    ).toBeVisible({ timeout: 30_000 });

    // The heading is rendered unconditionally by the component shell (html:6) — a stable mount signal that
    // does not depend on any of the eleven collections this screen reads.
    await expect(
      host.getByText(/Transfer Participants From Queue/i),
      'OP-20: the transfer heading must render',
    ).toBeVisible({ timeout: 30_000 });

    // [PRECONDITION] the picker can only offer what the collection holds.
    const queueDocs = await fa.countWhere('queue generation', []);
    expect(queueDocs, 'OP-20: the queue-generation collection must be seeded').toBeGreaterThanOrEqual(1);

    // [REAL-UI] Open the SOURCE queue select (the first on the screen, html:25) and assert the seeded queue
    // is offered — the component put it there from its own getDocs('queue generation') read.
    const select = host.locator('mat-select').first();
    await expect(select, 'OP-20: the source-queue select must render').toBeVisible({ timeout: 30_000 });

    // A SINGLE click is not enough on this screen, and the first version of this case shipped that way:
    // it passed twice in isolation and then failed in a batch run with the panel shut (the mount and the
    // select were both fine — see the failure screenshot). This component subscribes to ELEVEN
    // collections, and a subscription that lands just after the click re-renders the form and closes the
    // freshly-opened overlay. Retrying the open until an option is actually present makes the case
    // deterministic without weakening what it asserts.
    //
    // NOTE for whoever revisits TODO(BIG-13b) in big-activity-screens.spec.ts: this pattern is the likely
    // fix there too. The earlier conclusion that mat-select "works fine on other screens, so BIG-13 is
    // layout-specific" was WRONG — it is a re-render race, and it is not screen-specific.
    const wantedOption = page.locator('mat-option').filter({ hasText: QUEUE_NAME }).first();
    await expect(async () => {
      const anyOptionOpen = await page.locator('mat-option').first().isVisible().catch(() => false);
      if (!anyOptionOpen) await select.click();
      await expect(wantedOption).toBeVisible({ timeout: 3_000 });
    }, `OP-20: the seeded queue "${QUEUE_NAME}" must be offered as a transfer source, from the app's own ` +
       'queue-generation read').toPass({ timeout: 45_000 });

    // Close the overlay so a stray open panel cannot affect teardown or the console guard.
    await page.keyboard.press('Escape');
  });
});
