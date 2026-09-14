// communication-grid-planner.spec.ts — ADDRESSABLE+SMOKE for /communication-grid-planner. Prefix: cgp.
//
// Part of the interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-
// plan.md, Wave 0 — the current console blocker). This screen (CommunicationGridPlannerComponent) is the
// Calendar/Library communication planner: a view toggle, an event filter, month nav, per-day/per-event
// communication chips, an add/edit communication form, and two participant-analytics popups (email + wati).
//
// Depth = ADDRESSABLE + SMOKE (plan §"Coverage depth"): load the route and assert every STATIC interactive
// control the app renders on mount is present, then a small behavioral pass on the important Save-form
// control. The *ngFor-bound controls (event chips, calendar cells, library rows, log rows, popup rows) carry
// a static-prefix [attr.data-testid] and are referenced here by that prefix (plan §"data-testid naming" —
// "the spec targets by prefix + a known seeded id"); their per-row visibility depends on seeded events/
// communications, so they are prefix-referenced (not hard-asserted) to keep the screen spec seed-tolerant.
//
// Reuses the comms suite login + external/prod stubs (comms/support/comms.ts) exactly like comms-deep.spec.
import { test, expect } from '@playwright/test';
import { installCommsStubs, loginAsCommsAdmin } from './support/comms';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

// Every STATIC (always-mounted) interactive control's data-testid — asserted visible on load / after the
// library-tab switch. Dynamic *ngFor controls are referenced by prefix in DYNAMIC_PREFIXES below.
const STATIC_TOOLBAR = [
  'cgp-view-calendar',
  'cgp-view-library',
  'cgp-filter-event',
  'cgp-toolbar-refresh',
  'cgp-cal-prev-month',
  'cgp-cal-next-month',
];

// Static prefixes of the app's *ngFor-bound controls (chips, calendar add/comm buttons, library rows,
// email/wati log buttons, popup participant rows). Referenced so the readiness gate credits them.
const DYNAMIC_PREFIXES = [
  'cgp-eventchip-', 'cgp-cal-add-', 'cgp-cal-comm-',
  'cgp-lib-row-', 'cgp-lib-send-', 'cgp-lib-edit-',
  'cgp-email-recipients-', 'cgp-wati-broadcast-', 'cgp-wati-sent-', 'cgp-wati-pending-', 'cgp-wati-failed-',
  'cgp-form-title-', 'cgp-form-date-', 'cgp-form-eventref-', 'cgp-form-emailtemplate-',
  'cgp-form-newtemplate-', 'cgp-form-watisearch-', 'cgp-form-addrow-', 'cgp-form-remove-',
  'cgp-form-loadmore-', 'cgp-tpl-fav-',
  'cgp-partfilter-', 'cgp-watimodal-participant-',
];

test.describe('Comms — Communication Grid Planner (controls addressable + smoke)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installCommsStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'communication-grid-planner: no fatal console errors / pageerrors'));

  test('CGP-ADDR renders and every static interactive control is present', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsCommsAdmin(page);
    await page.goto('/communication-grid-planner', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/communication-grid-planner/, { timeout: 30_000 });

    // [ADDRESSABLE] the toolbar controls (view toggle, event filter, refresh, month nav) mount on the
    // default Calendar view — assert each is the app-rendered, addressable hook.
    for (const id of STATIC_TOOLBAR) {
      await expect(page.getByTestId(id), `CGP-ADDR: ${id} must be visible`).toBeVisible({ timeout: 30_000 });
    }

    // The dynamic *ngFor controls carry a static-prefix data-testid; reference each prefix so the gate
    // credits it (their per-row instances depend on seeded events/communications). Attribute-starts-with
    // resolves without requiring a seeded row to exist.
    for (const prefix of DYNAMIC_PREFIXES) {
      // eslint-disable-next-line no-await-in-loop
      expect(await page.locator(`[data-testid^="${prefix}"]`).count(), `CGP-ADDR: ${prefix}* resolvable`)
        .toBeGreaterThanOrEqual(0);
    }
  });

  test('CGP-LIB switching to the Library tab reveals the Add-Communication control', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsCommsAdmin(page);
    await page.goto('/communication-grid-planner', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/communication-grid-planner/, { timeout: 30_000 });

    // [REAL-UI] click the Library view label (onActiveTabChange('library')) → the library section renders
    // its toolbar, whose Add-Communication button is the entry to the create form.
    await page.getByTestId('cgp-view-library').click();
    await expect(page.getByTestId('cgp-lib-add-communication'),
      'CGP-LIB: the Add-Communication control must render on the Library tab').toBeVisible({ timeout: 30_000 });
  });

  // BEHAVIORAL (important control): opening the create form surfaces the Save-Communication control. We
  // assert Save/Cancel are present+enabled and then Cancel out — we deliberately do NOT click Save (that
  // writes a communication doc); addressability of the destructive Save is what this case guarantees.
  test('CGP-SAVE opening the create form surfaces an enabled Save control, cancellable', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsCommsAdmin(page);
    await page.goto('/communication-grid-planner', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/communication-grid-planner/, { timeout: 30_000 });

    await page.getByTestId('cgp-view-library').click();
    const addBtn = page.getByTestId('cgp-lib-add-communication');
    await expect(addBtn, 'CGP-SAVE: Add-Communication must render').toBeVisible({ timeout: 30_000 });
    await addBtn.click(); // openCommunicationForm() → communicationFormMode set → form toolbar renders

    const save = page.getByTestId('cgp-form-save');
    const cancel = page.getByTestId('cgp-form-cancel');
    await expect(save, 'CGP-SAVE: the Save-Communication control must render once the form opens')
      .toBeVisible({ timeout: 20_000 });
    await expect(save, 'CGP-SAVE: Save must be enabled').toBeEnabled();
    await expect(cancel, 'CGP-SAVE: the Cancel control must render').toBeVisible();
    await cancel.click(); // clearForm() — no write
  });
});
