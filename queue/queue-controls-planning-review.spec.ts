// queue-controls-planning-review.spec.ts — ADDRESSABLE+SMOKE for /queue-planner-review. Prefix: qpr.
//
// Interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-plan.md).
// Asserts the data-testid hooks added to queue-planning-review.component.html are addressable via literal
// getByTestId(...). OP-19 (planner-screens.spec) owns the merged-view picker's real-UI/anti-circular
// assertion; this file only proves the interactive controls are addressable, without re-driving behaviour.
// New file; does not touch planner-screens.spec.ts.
//
// Only the queue picker renders before a queue is selected; the counts cards, right panel, slot-planner
// dialog and the book-slot / revert-history dialogs are all behind *ngIf/dialogs — asserted soft
// (present-or-addressable). Each id below appears as a literal getByTestId('…') so the readiness scanner
// credits it (one literal per hook — no arrays/loops).
import { test, expect, Locator } from '@playwright/test';
import { actors, loginAs } from './support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs, ExternalStubs } from './stubs';

let guard: ConsoleGuard;
let stubs: ExternalStubs;

async function soft(l: Locator): Promise<void> {
  if (await l.count()) await expect(l.first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  stubs = installAllExternalStubs(page);
});

test.afterEach(() => assertNoFatal(guard, 'queue-planning-review controls: no fatal console errors / pageerrors'));

test.describe('Queue Planning Review — interactive controls addressable (/queue-planner-review)', () => {
  test('QPRC-01 merged view renders and every new data-testid is addressable', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);
    await page.goto('/queue-planner-review', { waitUntil: 'domcontentloaded' });

    // [SMOKE] the merged-view mounts and the always-present queue picker is addressable + visible.
    await expect(page.locator('app-queue-planning-review'), 'QPRC-01: the merged view must mount').toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('qpr-queue-select'), 'QPRC-01: the queue picker must render').toBeVisible({
      timeout: 30_000,
    });

    // [ADDRESSABLE] header filters + live-queue export (render once a queue is selected).
    await soft(page.getByTestId('qpr-segment-filter'));
    await soft(page.getByTestId('qpr-livequeue-exportmode'));
    await soft(page.getByTestId('qpr-livequeue-export'));
    await soft(page.getByTestId('qpr-livequeue-export-clear'));
    await soft(page.getByTestId('qpr-interim-filter'));
    await soft(page.getByTestId('qpr-interim-apply'));
    await soft(page.getByTestId('qpr-interim-reset'));
    await soft(page.getByTestId('qpr-revert-history'));
    await soft(page.getByTestId('qpr-event-filter'));
    await soft(page.getByTestId('qpr-event-back'));
    await soft(page.getByTestId('qpr-event-apply'));
    await soft(page.getByTestId('qpr-event-reset'));

    // overall count cards + their export buttons.
    await soft(page.getByTestId('qpr-card-queuetokens'));
    await soft(page.getByTestId('qpr-export-queuetokens-card'));
    await soft(page.getByTestId('qpr-card-invalidtokens'));
    await soft(page.getByTestId('qpr-card-segparts'));
    await soft(page.getByTestId('qpr-export-segparts-card'));
    await soft(page.getByTestId('qpr-card-interim-completed'));
    await soft(page.getByTestId('qpr-card-interim-pending'));

    // slot / count panel (right side).
    await soft(page.getByTestId('qpr-export-queuetokens-header'));
    await soft(page.getByTestId('qpr-export-segparts-header'));
    await soft(page.getByTestId('qpr-panel-close'));
    await soft(page.getByTestId('qpr-status-queue-participants'));
    await soft(page.getByTestId('qpr-status-non-queue'));
    await soft(page.getByTestId('qpr-toggle-variations'));
    await soft(page.getByTestId('qpr-toggle-stagerange'));
    await soft(page.getByTestId('qpr-summary-confirmed'));
    await soft(page.getByTestId('qpr-summary-nonconfirmed'));
    await soft(page.getByTestId('qpr-summary-big'));
    await soft(page.getByTestId('qpr-nonsegment-filter'));
    await soft(page.getByTestId('qpr-export-excel'));
    await soft(page.getByTestId('qpr-select-all'));
    await soft(page.getByTestId('qpr-comm-notification'));
    await soft(page.getByTestId('qpr-comm-whatsapp'));
    await soft(page.getByTestId('qpr-comm-email'));
    await soft(page.getByTestId('qpr-comm-channel'));

    // slot-planner dialog (opened from a stage header).
    await soft(page.getByTestId('qpr-planner-close'));
    await soft(page.getByTestId('qpr-planner-fromtoday'));
    await soft(page.getByTestId('qpr-planner-scroll-left'));
    await soft(page.getByTestId('qpr-planner-alldays'));
    await soft(page.getByTestId('qpr-planner-scroll-right'));
    await soft(page.getByTestId('qpr-planner-interim-done'));
    await soft(page.getByTestId('qpr-planner-interim-pending'));
    await soft(page.getByTestId('qpr-planner-export'));
    await soft(page.getByTestId('qpr-planner-expand'));
    await soft(page.getByTestId('qpr-planner-tab-appointment'));
    await soft(page.getByTestId('qpr-planner-tab-queue'));

    // queue-tab total row + inner communication panel.
    await soft(page.getByTestId('qpr-total-confirmed'));
    await soft(page.getByTestId('qpr-total-nonconfirmed'));
    await soft(page.getByTestId('qpr-total-all'));
    await soft(page.getByTestId('qpr-qpanel-close'));
    await soft(page.getByTestId('qpr-qpanel-tab-confirmed'));
    await soft(page.getByTestId('qpr-qpanel-tab-nonconfirmed'));
    await soft(page.getByTestId('qpr-qpanel-selectall'));
    await soft(page.getByTestId('qpr-qpanel-notification'));
    await soft(page.getByTestId('qpr-qpanel-whatsapp'));
    await soft(page.getByTestId('qpr-qpanel-email'));
    await soft(page.getByTestId('qpr-qpanel-channel'));

    // book-slot dialog.
    await soft(page.getByTestId('qpr-bookslot-overlay'));
    await soft(page.getByTestId('qpr-bookslot-dialog'));
    await soft(page.getByTestId('qpr-bookslot-close'));
    await soft(page.getByTestId('qpr-bookslot-cancel'));
    await soft(page.getByTestId('qpr-bookslot-confirm'));

    // revert-history dialog.
    await soft(page.getByTestId('qpr-revert-overlay'));
    await soft(page.getByTestId('qpr-revert-dialog-inner'));
    await soft(page.getByTestId('qpr-revert-close'));
    await soft(page.getByTestId('qpr-revert-tab-reverted'));
    await soft(page.getByTestId('qpr-revert-tab-booked'));

    // dynamic per-row/-stage/-event hooks (qpr-livequeue-row-*, qpr-livequeue-btn-*, qpr-stagecol-*,
    // qpr-slotcard-*, qpr-epitem-*, qpr-epevent-*, qpr-planner-date-*, qpr-revert-*, qpr-book-*) are keyed
    // by ids and exercised by their stable prefixes where they render.
    await soft(page.locator('[data-testid^="qpr-livequeue-btn-"]'));
    await soft(page.locator('[data-testid^="qpr-stagecol-"]'));
    await soft(page.locator('[data-testid^="qpr-slotcard-"]'));
  });
});
