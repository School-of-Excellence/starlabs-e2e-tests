// ui.ts — small Material-UI drivers shared by the 2026-09-07 content specs (CN-19…CN-46).
//
// Every content screen paginates its MatTable at a small default page size (5–25 rows), so a "rows ==
// Admin-SDK count" assertion is only honest once the WHOLE collection is on one page. showAllRows() picks
// the largest page-size option the paginator offers; if the collection is bigger than that the count
// assertion fails loudly instead of silently comparing one page against the total.
import { Page, Locator, expect } from '@playwright/test';
import { openMatSelect } from '../../_shared/mat-select';

/** MatTable data rows across the two Material row markups used in this app. */
export const ROW = 'tr.mat-mdc-row, tr[mat-row], tr.data-row';

/**
 * Open a mat-select panel robustly. The floating <mat-label> notched outline overlays the trigger, so a
 * plain click lands on the label — but the `click({ force: true })` that gets past it skips Playwright's
 * actionability checks too, so a click arriving before Material wires the overlay silently opens nothing.
 * That is now _shared/mat-select.ts's job (keyboard-first open, asserts the panel, retries); callers here
 * keep picking their own options (paginator page sizes, etc.) out of the open panel.
 */
export async function openSelect(page: Page, trigger: Locator): Promise<void> {
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await openMatSelect(page, trigger);
}

/** Select the LARGEST page-size option of a mat-paginator (default: the first paginator on the page). */
export async function showAllRows(page: Page, paginator?: Locator): Promise<number> {
  const pag = paginator ?? page.locator('mat-paginator').first();
  await expect(pag).toBeVisible({ timeout: 30_000 });
  await openSelect(page, pag.locator('mat-select'));
  const options = page.locator('.cdk-overlay-pane mat-option');
  const texts = (await options.allTextContents()).map((t) => parseInt(t.trim(), 10)).filter((n) => !Number.isNaN(n));
  const max = Math.max(...texts);
  await options.filter({ hasText: new RegExp(`^\\s*${max}\\s*$`) }).first().click();
  // the panel closes on selection; wait for the overlay to go so later clicks are not intercepted
  await expect(page.locator('.cdk-overlay-backdrop')).toHaveCount(0, { timeout: 10_000 }).catch(() => {});
  return max;
}

/** Click a Material tab by its label. */
export async function openTab(page: Page, label: string | RegExp): Promise<void> {
  await page.getByRole('tab', { name: label }).click();
}

/**
 * Where the router actually left us after navigating to `route`. authGuard resolves asynchronously (it
 * reads the `dashboard` collection before deciding, auth.guard.ts:44), so a bounce lands a moment after
 * domcontentloaded — same bounded settle as workshops/route-guards.spec.ts.
 */
export async function landingPathFor(page: Page, route: string): Promise<string> {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2_500);
  return new URL(page.url()).pathname;
}
