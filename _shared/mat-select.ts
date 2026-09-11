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
 * @param attempts how many times to try before giving up (default 3)
 */
export async function openMatSelect(page: Page, trigger: Locator, attempts = 3): Promise<Locator> {
  const panel = page.getByRole('listbox');

  for (let i = 1; i <= attempts; i++) {
    if (i === 1) {
      // Keyboard path: no label to intercept, so this is the reliable one where focus works.
      await trigger.focus().catch(() => { /* not focusable — fall through to the click path */ });
      await page.keyboard.press('Enter').catch(() => { /* ignore; the click path follows */ });
    } else {
      // Click path, forced past the floating <mat-label>.
      await trigger.click({ force: true });
    }

    try {
      await panel.waitFor({ state: 'visible', timeout: 2_000 });
      return panel;
    } catch {
      // The open did not take. Material had not finished wiring the overlay, or focus went elsewhere.
      // Loop and try the other route rather than letting the caller burn its whole timeout.
    }
  }

  throw new Error(
    `openMatSelect: the panel did not open after ${attempts} attempts (keyboard + forced click). ` +
    'This is the JP-04 failure mode — see _shared/mat-select.ts. If it persists, the trigger locator is ' +
    'probably wrong or the select is disabled, NOT flaky.',
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
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox'), 'the mat-select panel should close on Escape')
    .toHaveCount(0, { timeout: 5_000 });
}
