// mat-select.ts — deterministic Angular Material select interaction.
//
// WHY THIS EXISTS (JP-04, and 20+ other spec files that share the same pattern):
//
// Specs across every suite open a mat-select like this:
//
//     await trigger.click({ force: true });
//     await page.getByRole('listbox').getByRole('option', { name: 'Something' }).click();
//
// `force: true` is there for a real reason — the floating <mat-label> sits over the trigger, so a plain
// click lands on the label instead. But force ALSO skips Playwright's actionability checks, so if the
// click arrives before Material has wired up the overlay, the event is dispatched and SILENTLY DOES
// NOTHING. No panel opens. The next line then waits the full test timeout (120s) for an option that was
// never going to exist, and the suite reports an opaque "element(s) not found".
//
// docs/JOURNEY-PIPELINE-HANDOFF.md:97 records this for JP-04 — "mat-select panel intermittently doesn't
// open on click. Handled by --retries 1 (not a code bug)". That mitigation works only in CI: the emulator
// configs set `retries: process.env.CI ? 1 : 0`, so locally the same test fails every run with no retry.
// Retrying a whole 120s test to paper over a missed click is also an expensive way to buy determinism.
//
// THE FIX: never treat "I clicked" as "it opened". Assert the panel, and re-issue the click if it is not
// there. Worst case costs a few seconds; today's worst case is a two-minute timeout and a red suite.
//
// KEYBOARD FIRST: Material opens a focused mat-select on Enter/Space, which bypasses the label-interception
// problem entirely — no force, no overlay race. The click path stays as a fallback for any trigger that
// does not take focus.
import { Locator, Page, expect } from '@playwright/test';

/**
 * Open a mat-select and return its overlay listbox, or throw with a message that says what actually
 * happened rather than timing out on the option lookup.
 *
 * @param page     the page (the cdk overlay is a page-level sibling, not a child of the trigger)
 * @param trigger  the select's combobox locator, e.g. dialog.getByRole('combobox').nth(0)
 * @param attempts how many times to try before giving up (default 6 — see the budget note below)
 *
 * BUDGET: each attempt waits up to 2s for the panel plus a 500ms backoff, so the default is ~15s. That is
 * deliberately in the same order as the `.toPass({ timeout: 30_000 })` this helper replaced in
 * content/deep.spec.ts and events-deep — those budgets existed because a dialog's selects can take real
 * time to settle on a cold build. A 3-attempt (~7s) default was too tight and turned a slow settle into a
 * failure. Still far below the 120s a missed click used to cost.
 */
export async function openMatSelect(page: Page, trigger: Locator, attempts = 6): Promise<Locator> {
  const panel = page.getByRole('listbox');

  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    // The OPEN ACTION and the panel assertion are BOTH inside the try, deliberately.
    //
    // The action itself can throw for a reason that resolves on its own. The one that bit us: a trigger
    // locator matching several elements while the dialog is still settling — Playwright raises a strict
    // mode violation, and a moment later the DOM has collapsed to one element and the same locator is
    // fine. content/deep.spec.ts CN-04 is exactly that: `mat-select.cat-select` resolves to 3 until the
    // form type is chosen, then to 1. The code this helper replaced wrapped its click in
    // `.toPass({ timeout: 30_000 })`, which retried through any error — including that one. Retrying
    // only the assertion loses that tolerance and turns a self-healing wait into a hard failure.
    try {
      if (i === 1) {
        // Keyboard path: no label to intercept, so this is the reliable one where focus works.
        await trigger.focus();
        await page.keyboard.press('Enter');
      } else {
        // Click path, forced past the floating <mat-label>.
        await trigger.click({ force: true });
      }
      await panel.waitFor({ state: 'visible', timeout: 2_000 });
      return panel;
    } catch (e) {
      last = e;
      // Either the open did not take (Material had not wired the overlay) or the action threw on a
      // transient DOM state. Give the page a moment and try the other route.
      await page.waitForTimeout(500);
    }
  }

  throw new Error(
    `openMatSelect: the panel did not open after ${attempts} attempts (keyboard + forced click). ` +
    'This is the JP-04 failure mode — see _shared/mat-select.ts. If it persists, the trigger locator is ' +
    'probably wrong, matches several elements that never collapse to one, or the select is disabled — ' +
    `NOT flaky. Last error: ${(last as Error)?.message ?? last}`,
  );
}

/**
 * Open a mat-select and pick one option by exact name, waiting for the panel to detach afterwards.
 *
 * The detach wait matters for SINGLE selects: the panel closes on pick, and a leftover cdk overlay
 * backdrop will intercept the next trigger click on the same form — which is its own source of
 * "the click did nothing" further down a spec.
 */
export async function selectMatOption(page: Page, trigger: Locator, optionName: string | RegExp): Promise<void> {
  const panel = await openMatSelect(page, trigger);
  await panel.getByRole('option', { name: optionName, exact: typeof optionName === 'string' }).click();
  await expect(page.getByRole('listbox'), 'the mat-select panel should close after a single-select pick')
    .toHaveCount(0, { timeout: 5_000 });
}

/**
 * Pick several options from a MULTI select, then close the panel with Escape.
 *
 * A multi-select panel stays open between picks, so the single-select helper's detach wait does not apply;
 * closing explicitly leaves the page in the same state a user would.
 */
export async function selectMatOptions(page: Page, trigger: Locator, optionNames: (string | RegExp)[]): Promise<void> {
  const panel = await openMatSelect(page, trigger);
  for (const name of optionNames) {
    await panel.getByRole('option', { name, exact: typeof name === 'string' }).click();
  }
  // Only while a panel is open: an Escape with no overlay to consume it reaches the host MatDialog and
  // closes it (CN-04, branch-suites run 34959789430).
  if (await page.getByRole('listbox').count()) await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox'), 'the mat-select panel should close on Escape')
    .toHaveCount(0, { timeout: 5_000 });
}
