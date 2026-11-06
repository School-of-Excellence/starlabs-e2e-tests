// route-configuration-icon-select.spec.ts — the Create/Edit Route dialog's icon dropdowns
// ("Select Icon" rxd-mat-select-3, "Child Icon" rxd-mat-select-5) open and load the full icon list.
//
// Hook prefixes (owned elsewhere, driven here): rcx = route-configuration-duplicate table,
// rxd = its createroutedialog. No new hooks: this file drives hooks the addressable spec already registers.
//
// Journal: starlabs-angular specs/journals/2026-10-15-routeconfig-dialog-perf.md (2026-11-06 follow-up)
//          + this repo's specs/journals/2026-11-06-routeconfig-icon-select.md.
// The bug: IconOptionsPipe rendered ZERO options while the select was closed whenever the route had no
// icon or an icon outside iconList. MatSelect._canOpen() needs options.length > 0, so the panel never
// opened, (opened) never fired and the ~1000-icon list never rendered. RCI-01/03/04 fail on that build.
//
// Seeded world (seed-authroles.js → iconDocs(), all showInSidenav:false so the nav matrix is untouched):
//   ICON.none     route, icon ''                    → RCI-01
//   ICON.unknown  route, icon 'zz_not_a_material_icon' (not in iconList) → RCI-03
//   ICON.known    route, icon 'home'                → RCI-02, the CONTROL
//   ICON.parent   no route, one child with icon ''  → RCI-04
// Driven through EDIT because the seeded admin lacks the `developer` role that Create Route and
// Add Sub Component need. Editing a route with icon '' is the same component state as Create Route.
//
// Anti-circularity: the seed only writes an icon string. What is asserted is what the APP renders: whether
// mat-select can open at all, how many options the pipe hands it, which value the trigger displays, and
// whether a known icon appears once (no duplicate from the unknown-icon prepend). Nothing the test writes
// is read back, and the dialog is never saved.
import { test, expect, Page, Locator } from '@playwright/test';
import { installAuthStubs, loginAsAuthAdmin } from './support/authroles';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { openMatSelect } from '../_shared/mat-select';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ICON } = require('./seed-authroles') as {
  ICON: { none: string; unknown: string; known: string; parent: string; child: string; unknownName: string };
};

/** More than any closed state ever renders (0 or 1) and well under iconList's ~1000. */
const FULL_LIST_MIN = 500;

/** Narrow the table to one run-unique route label and open its Edit dialog. */
async function openEditDialog(page: Page, label: string): Promise<Locator> {
  await loginAsAuthAdmin(page);
  await page.goto('/routeconfiguration', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/routeconfiguration/, { timeout: 30_000 });
  // The filter listens on (keyup), which fill() never fires, so type it.
  await page.getByTestId('rcx-ex-dashboard').pressSequentially(label);
  const edit = page.getByTestId('rcx-editroute');
  await expect(edit, `exactly one editable row for "${label}"`).toHaveCount(1, { timeout: 30_000 });
  await edit.click();
  const dialog = page.locator('app-createroutedialog');
  await expect(dialog.getByTestId('rxd-save'), 'the Edit dialog finished loading').toBeVisible({ timeout: 30_000 });
  return dialog;
}

/** Open a select and wait until the pipe has swapped in the full icon list. */
async function openFullList(page: Page, trigger: Locator): Promise<Locator> {
  const panel = await openMatSelect(page, trigger);
  await expect.poll(() => panel.getByRole('option').count(), { timeout: 20_000 }).toBeGreaterThan(FULL_LIST_MIN);
  return panel;
}

test.describe('Auth & roles — Route Configuration icon dropdowns (open + full list for every icon state)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installAuthStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'route-configuration-icon-select: no fatal console errors / pageerrors'));

  test('RCI-01 a route with NO icon: Select Icon still opens and lists the full icon set', async ({ page }) => {
    const dialog = await openEditDialog(page, ICON.none);
    const panel = await openFullList(page, dialog.getByTestId('rxd-mat-select-3'));
    await expect(panel.getByRole('option', { name: 'home', exact: true }), 'RCI-01: a known icon is offered').toHaveCount(1);
  });

  test('RCI-02 CONTROL — a route with a known icon: trigger shows it, open list holds it exactly once', async ({ page }) => {
    const dialog = await openEditDialog(page, ICON.known);
    const trigger = dialog.getByTestId('rxd-mat-select-3');
    await expect(trigger, 'RCI-02: the closed trigger shows the saved icon').toContainText('home');
    const panel = await openFullList(page, trigger);
    await expect(panel.getByRole('option', { name: 'home', exact: true }), 'RCI-02: no duplicate of a known icon').toHaveCount(1);
  });

  test('RCI-03 a route whose icon is NOT in iconList: trigger keeps the saved name, open list puts it first', async ({ page }) => {
    const dialog = await openEditDialog(page, ICON.unknown);
    const trigger = dialog.getByTestId('rxd-mat-select-3');
    await expect(trigger, 'RCI-03: the closed trigger shows the saved (unknown) icon, not blank').toContainText(ICON.unknownName);
    const panel = await openFullList(page, trigger);
    await expect(panel.getByRole('option').first(), 'RCI-03: the saved icon leads the open list').toContainText(ICON.unknownName);
    await expect(trigger, 'RCI-03: the value survives opening').toContainText(ICON.unknownName);
  });

  test('RCI-04 a sub-route whose child has NO icon: Child Icon opens and lists the full icon set', async ({ page }) => {
    const dialog = await openEditDialog(page, ICON.parent);
    await expect(dialog.getByTestId('rxd-child-route'), 'RCI-04: the seeded child renders in the dialog').toHaveCount(1);
    await openFullList(page, dialog.getByTestId('rxd-mat-select-5'));
  });
});
