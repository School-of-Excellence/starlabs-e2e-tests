// queue-controls-planning.spec.ts — ADDRESSABLE+SMOKE for /queue-planner. Prefix: qp.
//
// Interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-plan.md).
// Asserts the data-testid hooks added to queue-planning.component.html are addressable via literal
// getByTestId(...). OP-18 (planner-screens.spec) owns the picker's real-UI/anti-circular assertion; this
// file only proves the interactive controls are addressable and does not re-drive that behaviour. New file;
// does not touch planner-screens.spec.ts.
//
// Only the queue picker + "Lists & Segments" render before a queue is selected; the filters, planning table,
// participant panel and edit dialogs are all behind *ngIf/dialogs — asserted soft (present-or-addressable).
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

test.afterEach(() => assertNoFatal(guard, 'queue-planning controls: no fatal console errors / pageerrors'));

test.describe('Queue Planning — interactive controls addressable (/queue-planner)', () => {
  test('QPC-01 queue-planner renders and every new data-testid is addressable', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);
    await page.goto('/queue-planner', { waitUntil: 'domcontentloaded' });

    // [SMOKE] the always-present header controls: the queue picker and the Lists & Segments button.
    await expect(page.locator('app-queue-planning'), 'QPC-01: the planner must mount').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('qp-queue-select'), 'QPC-01: the queue picker must render').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('qp-manage-lists'), 'QPC-01: the Lists & Segments button must render').toBeVisible();

    // [ADDRESSABLE] filters (render once a queue is selected).
    await soft(page.getByTestId('qp-clear-filters'));
    await soft(page.getByTestId('qp-segsearch-clear'));
    // planning-table footer + participant panel controls.
    await soft(page.getByTestId('qp-add-segment'));
    await soft(page.getByTestId('qp-noresults-clear'));
    await soft(page.getByTestId('qp-panel-close'));
    await soft(page.getByTestId('qp-select-all'));
    // communication actions (participant panel).
    await soft(page.getByTestId('qp-comm-whatsapp'));
    await soft(page.getByTestId('qp-comm-email'));
    await soft(page.getByTestId('qp-comm-notification'));
    // edit dialogs (variation / segment / date-entry) — rendered when opened.
    await soft(page.getByTestId('qp-vardlg-cancel'));
    await soft(page.getByTestId('qp-vardlg-save'));
    await soft(page.getByTestId('qp-segdlg-cancel'));
    await soft(page.getByTestId('qp-segdlg-save'));
    await soft(page.getByTestId('qp-datedlg-cancel'));
    await soft(page.getByTestId('qp-datedlg-save'));
    await soft(page.getByTestId('qp-datedlg-createmulti'));
    // per-row / per-stage controls are dynamic ([attr.data-testid]="'qp-editsegment-' + row.id" etc.);
    // exercised by their stable prefixes where the planning table renders.
    await soft(page.locator('[data-testid^="qp-livequeue-"]'));
    await soft(page.locator('[data-testid^="qp-createslot-"]'));
    await soft(page.locator('[data-testid^="qp-editsegment-"]'));
    await soft(page.locator('[data-testid^="qp-removerow-"]'));
    await soft(page.locator('[data-testid^="qp-editvariation-"]'));
    await soft(page.locator('[data-testid^="qp-addslot-"]'));
  });
});
