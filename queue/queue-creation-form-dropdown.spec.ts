// queue-creation-form-dropdown.spec.ts — queue-creation-v3 form dropdowns: which `delivery forms`
// are offered, and the search box on both form selects. Prefix: qcv3 (shared with the component).
//
// RECON / WHY: starlabs-angular specs/journals/2026-11-12-queue-creation-form-dropdown.md
// (commit 07d55dca on charan-release). The dialog loads `delivery forms` (DEFAULT db) with
// orderBy('formname') and kept a form only when `delete` was null/undefined, so live forms saved
// with `delete:false` (9 in prod, e.g. "CTD – Impact Valuation Activity") never appeared. The fix
// hides only `delete === true`. The same change added ngx-mat-select-search to:
//   • "Select Form Template" (Action Type = Form)  [attr.data-testid]="'qcv3-sel-35-' + i",
//     search host 'qcv3-inp-35s-' + i
//   • "Forms To Display" (multi)                   [attr.data-testid]="'qcv3-sel-47-' + i",
//     search host 'qcv3-inp-47s-' + i
// These ids are per-stage (dynamic), so — like the other queue specs — they are reached with a
// literal attribute locator for stage 0, not getByTestId (the readiness gate only scans literals).
//
// SEEDED WORLD (fixtures/seed-test-project.js seedReferenceData → QCV3-FD block; DEFAULT db):
//   QCV3FD <run> livefalse   delete:false   → must be offered      (the shape the bug hid)
//   QCV3FD <run> liveabsent  no delete      → must be offered      (unchanged behaviour)
//   QCV3FD <run> deleted     delete:true    → must NOT be offered  (negative control for the filter)
//   QCV3XO <run> other       delete:false   → offered unfiltered, must be DROPPED by a QCV3FD search
//                                             (negative control for the search)
// + the authoring preconditions (staff auth chain + one venue) via fixtures/authoring-precondition.js.
//
// ANTI-CIRCULARITY: the seed supplies only the inputs (four docs and their `delete` shapes). Which
// options render is computed by the APP (its Firestore query + client-side `delete` filter + its
// search filter); the test asserts the rendered <mat-option>s, never a value it wrote. The seeded
// `delete` shapes are re-read through the admin oracle first, so a seed drift (e.g. buildDoc dropping
// its `delete:false` default) fails as a precondition rather than as a false green.
//
// SCOPE: drives only the two form selects on stage 0. Does not save the queue (AUTH-01 covers save).

import { test, expect, Page, Locator } from '@playwright/test';
import { QueueCreationPage } from './pages/queue-creation.page';
import { loginAsOperator } from './support/auth';
import { TESTRUNID } from './support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs } from './stubs';
import { getDoc } from './support/firestore-admin';
import { openMatSelect, selectMatOption, isMatSelectOpen } from '../_shared/mat-select';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const precondition = require('../fixtures/authoring-precondition');

const NAME = {
  livefalse: `QCV3FD ${TESTRUNID} livefalse`,
  liveabsent: `QCV3FD ${TESTRUNID} liveabsent`,
  deleted: `QCV3FD ${TESTRUNID} deleted`,
  other: `QCV3XO ${TESTRUNID} other`,
};
const DOC = {
  livefalse: `${TESTRUNID}_qcv3form_livefalse`,
  liveabsent: `${TESTRUNID}_qcv3form_liveabsent`,
  deleted: `${TESTRUNID}_qcv3form_deleted`,
  other: `${TESTRUNID}_qcv3form_other`,
};
const SEARCH = `QCV3FD ${TESTRUNID}`;
const STAGE = 'Welcome';

let guard: ConsoleGuard;
let pre: { operatorEmail: string };

test.describe('Queue — queue-creation-v3 form dropdowns (delete:false shown, delete:true hidden, search narrows)', () => {
  test.beforeAll(async () => {
    pre = await precondition.seedAuthoringPreconditions({ testrunid: TESTRUNID });
  });

  test.afterAll(async () => {
    await precondition.teardownAuthoring({ testrunid: TESTRUNID });
  });

  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    installAllExternalStubs(page);
  });

  test.afterEach(() => assertNoFatal(guard, 'queue-creation form dropdowns: no fatal console errors / pageerrors'));

  test('QCFD-01 seeded delete shapes are as the world says (precondition oracle)', async () => {
    const [f, a, d, o] = await Promise.all([
      getDoc('delivery forms', DOC.livefalse),
      getDoc('delivery forms', DOC.liveabsent),
      getDoc('delivery forms', DOC.deleted),
      getDoc('delivery forms', DOC.other),
    ]);
    expect(f?.['delete'], 'QCFD-01: livefalse must carry delete:false').toBe(false);
    expect(a && 'delete' in a, 'QCFD-01: liveabsent must have NO delete field').toBe(false);
    expect(d?.['delete'], 'QCFD-01: deleted must carry delete:true').toBe(true);
    expect(o?.['delete'], 'QCFD-01: other must carry delete:false').toBe(false);
  });

  test('QCFD-02 Select Form Template: delete:false offered, delete:true hidden, search narrows', async ({ page }) => {
    await reachStageZero(page, pre.operatorEmail);
    await chooseActionTypeForm(page);

    const select = page.locator('[data-testid="qcv3-sel-35-0"]');
    // openMatSelect: keyboard-first, so the floating <mat-label> can't swallow the click.
    const panel = await openMatSelect(page, select);

    // Unfiltered: the fix is visible without any search.
    await expect(option(panel, NAME.livefalse), 'QCFD-02: delete:false form must be offered').toHaveCount(1);
    await expect(option(panel, NAME.liveabsent), 'QCFD-02: form without delete must be offered').toHaveCount(1);
    await expect(option(panel, NAME.other), 'QCFD-02: other live form offered before searching').toHaveCount(1);
    await expect(option(panel, NAME.deleted), 'QCFD-02: delete:true form must NOT be offered').toHaveCount(0);

    // Search narrows to the run's QCV3FD forms; the QCV3XO form is dropped.
    await searchIn(page, 'qcv3-inp-35s-0', SEARCH);
    await expect(option(panel, NAME.other), 'QCFD-02: search must drop the non-matching form').toHaveCount(0);
    await expect(option(panel, NAME.livefalse)).toHaveCount(1);
    await expect(option(panel, NAME.liveabsent)).toHaveCount(1);
    await expect(option(panel, NAME.deleted), 'QCFD-02: search must not resurrect a deleted form').toHaveCount(0);

    // Pick the delete:false form; the trigger shows the app's label for it.
    await option(panel, NAME.livefalse).click();
    await expect(select, 'QCFD-02: the selected delete:false form must show on the trigger').toContainText(NAME.livefalse);
  });

  test('QCFD-03 Forms To Display: same filter + search, selections survive a search', async ({ page }) => {
    await reachStageZero(page, pre.operatorEmail);

    const select = page.locator('[data-testid="qcv3-sel-47-0"]');
    const panel = await openMatSelect(page, select);

    await expect(option(panel, NAME.livefalse), 'QCFD-03: delete:false form must be offered').toHaveCount(1);
    await expect(option(panel, NAME.deleted), 'QCFD-03: delete:true form must NOT be offered').toHaveCount(0);

    await searchIn(page, 'qcv3-inp-47s-0', SEARCH);
    await expect(option(panel, NAME.other), 'QCFD-03: search must drop the non-matching form').toHaveCount(0);
    await option(panel, NAME.livefalse).click();
    await option(panel, NAME.liveabsent).click();

    // Search for the OTHER token: both ticked forms stay listed (kept by returnFormTemplates) and the
    // QCV3XO form now appears.
    await searchIn(page, 'qcv3-inp-47s-0', `QCV3XO ${TESTRUNID}`);
    await expect(option(panel, NAME.other), 'QCFD-03: the QCV3XO form must match its own search').toHaveCount(1);
    await expect(option(panel, NAME.livefalse), 'QCFD-03: ticked form must stay listed mid-search').toHaveCount(1);
    await expect(option(panel, NAME.liveabsent), 'QCFD-03: ticked form must stay listed mid-search').toHaveCount(1);

    if (await isMatSelectOpen(select)) await page.keyboard.press('Escape');
    await expect(select, 'QCFD-03: both ticked forms must show on the trigger').toContainText(NAME.livefalse);
    await expect(select).toContainText(NAME.liveabsent);
  });
});

// ---------------------------------------------------------------------------------------------------

/** A real <mat-option> in the open panel whose text is exactly `name`. */
function option(panel: Locator, name: string): Locator {
  return panel.getByRole('option', { name, exact: true });
}

/** Type into an ngx-mat-select-search box (host carries the stage-indexed data-testid). */
async function searchIn(page: Page, hostTestId: string, text: string): Promise<void> {
  // ngx-mat-select-search renders a hidden placeholder <input class="mat-select-search-hidden"> first;
  // the real, typeable box is inside .mat-select-search-inner.
  const input = page.locator(`[data-testid="${hostTestId}"] .mat-select-search-inner input`).first();
  await expect(input, `${hostTestId}: search input must render inside the open panel`).toBeVisible({ timeout: 10_000 });
  // The search box sits inside a mat-option that ngx-mat-select-search marks aria-disabled (so it can't be
  // picked as a value); Playwright inherits that and refuses fill(). A user types into it normally, so
  // focus it and type with the real keyboard, replacing any previous search.
  await input.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(text);
  await expect(input, `${hostTestId}: the search box must hold the typed text`).toHaveValue(text);
}

/** Set stage 0's Action Type to "Form" (renders the Select Form Template select). */
async function chooseActionTypeForm(page: Page): Promise<void> {
  await selectMatOption(page, page.locator('[data-testid="qcv3-sel-34-0"]'), 'Form');
  await expect(page.locator('[data-testid="qcv3-sel-35-0"]')).toBeVisible({ timeout: 10_000 });
}

/**
 * Open the stepper, fill step 0, add one stage on step 1, advance to step 2 "Stage Creation".
 * Mirrors authoring.spec.ts AUTH-01 (same page object, same chip-input anchor, same step-0 wait).
 */
async function reachStageZero(page: Page, operatorEmail: string): Promise<void> {
  const creation = new QueueCreationPage(page);
  await loginAsOperator(page, { email: operatorEmail });
  await creation.openStepper();
  await creation.fillQueueName(`E2E QCFD ${TESTRUNID} ${Date.now()}`);
  await creation.pickFirstProfile('queueadmin');
  await creation.pickFirstProfile('queuementor');
  await creation.setDates(futureDate(7), futureDate(21));
  await creation.pickFirstVenue();
  await creation.fillRequiredDetails();
  await waitForStepZeroValid(page);

  const host = page.locator('app-queue-creation-v3');
  const chipGrid = host.locator('mat-chip-grid[formcontrolname="stages"]');
  if (!(await chipGrid.isVisible().catch(() => false))) {
    await host.getByRole('button', { name: /Proceed to Product Mapping/ }).first().click();
  }
  await expect(chipGrid, 'step-1 chip grid never mounted').toBeVisible({ timeout: 15_000 });
  const chipInput = chipGrid.locator('input.mat-mdc-chip-input');
  await chipInput.focus({ timeout: 10_000 });
  await chipInput.fill(STAGE);
  await chipInput.press('Enter');
  await expect(chipGrid.locator('mat-chip-row').filter({ hasText: STAGE }).first()).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('qcv3-btn-29').click(); // Product Mapping → Stage Creation
  await expect(page.locator('[data-testid="qcv3-sel-34-0"]'), 'stage 0 Action Type select never rendered').toBeVisible({
    timeout: 15_000,
  });
}

function futureDate(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 86400e3);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** Same gate list as authoring.spec.ts (queue-creation-v3 proceedToNextstage, step 0). */
const STEP0_GATE_CONTROLS = [
  'queuename', 'queuementor', 'queueadmin', 'queuestartdate', 'queueenddate', 'venue',
  'description', 'introdescription', 'queuetargetcapacity', 'totalcapacity',
  'queuewelcometemplate', 'queuedmessage', 'lastregistrationdate', 'waitingmessage',
  'queuewelcometitle', 'queuewelcomedescription',
] as const;

async function waitForStepZeroValid(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate((controls) => {
          const ng = (window as unknown as { ng?: { getComponent?: (el: Element) => unknown } }).ng;
          if (!ng || typeof ng.getComponent !== 'function') return ['<window.ng.getComponent unavailable>'];
          const host = document.querySelector('app-queue-creation-v3');
          if (!host) return ['<app-queue-creation-v3 host not mounted>'];
          const cmp = ng.getComponent(host) as { queueform?: { get?: (n: string) => { valid?: boolean } | null } } | null;
          const form = cmp?.queueform;
          if (!form || typeof form.get !== 'function') return ['<queueform not ready>'];
          return controls.filter((name) => form.get!(name)?.valid !== true);
        }, [...STEP0_GATE_CONTROLS]),
      { timeout: 20_000, message: 'step-0 "Queue Details" never became valid (listed controls stayed invalid)' },
    )
    .toEqual([]);
}
