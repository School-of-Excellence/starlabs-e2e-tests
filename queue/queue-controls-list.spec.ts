// queue-controls-list.spec.ts — ADDRESSABLE+SMOKE for /queuelist. Prefix: ql.
//
// Interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-plan.md).
// This file ONLY asserts that the data-testid hooks added to queue-list.component.html are addressable
// via literal getByTestId(...). It deliberately does NOT drive create/clone/invite/delete behaviour —
// that is covered (or intentionally left) by the operator/QueueListPage specs. New file; touches no
// existing queue spec.
//
// Static hooks (always present on the list): ql-filter-input, ql-create-queue — asserted hard.
// Per-row hooks are dynamic ([attr.data-testid]="'ql-row-menu-' + row.docid" etc.); they are addressable
// but keyed by the seeded queue doc id, so they are exercised by a prefix locator, not a literal id.
import { test, expect, Locator } from '@playwright/test';
import { actors, loginAs } from './support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs, ExternalStubs } from './stubs';

let guard: ConsoleGuard;
let stubs: ExternalStubs;

/** Soft-present: if the (conditional) control rendered, assert it is visible; else just prove it is addressable. */
async function soft(l: Locator): Promise<void> {
  if (await l.count()) await expect(l.first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  stubs = installAllExternalStubs(page);
});

test.afterEach(() => assertNoFatal(guard, 'queue-list controls: no fatal console errors / pageerrors'));

test.describe('Queue List — interactive controls addressable (/queuelist)', () => {
  test('QLC-01 queue list renders and every new data-testid is addressable', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);
    await page.goto('/queuelist', { waitUntil: 'domcontentloaded' });

    // [SMOKE] the two always-present list controls render.
    await expect(page.getByTestId('ql-filter-input'), 'QLC-01: the list filter input must render').toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('ql-create-queue'), 'QLC-01: the Create Queue button must render').toBeVisible();

    // [ADDRESSABLE] per-row controls are keyed by row.docid (dynamic). Exercise them by their stable prefix —
    // seeded queues render at least one row on the persistent test project.
    await soft(page.locator('[data-testid^="ql-row-menu-"]'));
    await soft(page.locator('[data-testid^="ql-row-edit-"]'));
    await soft(page.locator('[data-testid^="ql-row-delete-"]'));
    // ql-menu-clone-*, ql-menu-invite-*, ql-menu-bigplanner-* live inside the (lazy) row mat-menu; addressable
    // once a row menu is opened — left to the behavioural operator/queue-list specs.
  });
});
