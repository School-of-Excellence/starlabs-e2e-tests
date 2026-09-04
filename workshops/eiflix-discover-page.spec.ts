// eiflix-discover-page.spec.ts — /eiflixdiscoverpage (New-Workshop/eiflixdiscoverpage).
//
// Recon: e2e/recon-allcomp/workshops.md "Addendum — 2026-09-04" (WS-24 / WS-25).
//
// The screen manages ONE document end to end: `classify/eiflixdiscoverpage`. Every save is
// setDoc(..., { merge: true }) (ts:1196), and the payload is assembled from `allFields` only (ts:334).
//
// WS-25 is the case that earns its keep. A test that only asserted "the typed value is in Firestore
// afterwards" would pass just as well if the app had used a destructive setDoc — silently wiping every
// field the screen does not manage. So the seed plants `wsSentinel`, a field that is NOT an allFields
// key and therefore never appears in the save payload; the assertion requires it to SURVIVE. That is
// what actually pins `merge: true`.
//
// Field choice: `orientationbuttonname` is a textFields key (ts:180) and renders as a real
// <input matInput>. The richFields keys render as ngx-editor (ProseMirror) contenteditables instead,
// which are not fill()-able and store HTML rather than the typed string.
import { test, expect } from '@playwright/test';
import {
  wsAddIds, wsAddNames, installWshopStubs, loginAsWshopAdmin, resetClassifySentinel,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil } from '../queue/support/firestore-admin';

const RUN = process.env.WSHOP_RUNID || 'wshop';

/** The Orientation Button Name input — anchored on its section heading, since the formControlName is a
 *  property binding ([formControlName]="field.key") and therefore leaves NO attribute in the DOM. */
const ORIENTATION_INPUT = 'section.field-card:has(h3:text-is("Orientation Button Name")) input[matInput], section.field-card:has(h3:text-is("Orientation Button Name")) input';

test.describe('Workshops — eiflix discover page (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await resetClassifySentinel();      // PRECONDITION: sentinel present, text field at its seeded value
  });
  test.afterEach(() => assertNoFatal(guard, 'eiflixdiscoverpage: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // WS-24 — the form is patched from classify/eiflixdiscoverpage (app read → rendered input value)
  // ===========================================================================================
  test('WS-24 the discover form renders the value stored on classify/eiflixdiscoverpage', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.goto('/eiflixdiscoverpage', { waitUntil: 'domcontentloaded' });

    // [ASSERT] the input holds the KNOWN seeded value — app read → rendered output vs known input.
    await expect(
      page.locator(ORIENTATION_INPUT).first(),
      'WS-24: the app must patch the form from the classify doc it read',
    ).toHaveValue(wsAddNames.classifyText, { timeout: 30_000 });
  });

  // ===========================================================================================
  // WS-25 — save MERGES: the edited field is written and the untouched sibling field SURVIVES
  // ===========================================================================================
  test('WS-25 saving writes the typed value and does not clobber the untouched sentinel field', async ({ page }) => {
    // [PRECONDITION] both fields are at known values.
    const before = await getDoc('classify', wsAddIds.CLASSIFY_DOC);
    expect((before as any)!.wsSentinel, 'WS-25: the sentinel field must be present before the save')
      .toBe(wsAddNames.classifySentinel);

    await loginAsWshopAdmin(page);
    await page.goto('/eiflixdiscoverpage', { waitUntil: 'domcontentloaded' });

    const input = page.locator(ORIENTATION_INPUT).first();
    await expect(input).toHaveValue(wsAddNames.classifyText, { timeout: 30_000 });

    // [REAL-UI] type a NEW known value and save through the app's own button.
    const typed = `WS25 Orientation ${RUN} ${Date.now()}`;
    await input.fill(typed);
    await page.getByRole('button', { name: /Save changes/i }).click();

    // [ASSERT 1] the app wrote what we typed — app output vs KNOWN input.
    const after = await pollUntil(
      () => getDoc('classify', wsAddIds.CLASSIFY_DOC),
      (d) => !!d && (d as any).orientationbuttonname === typed,
      { label: 'WS-25: classify.orientationbuttonname === typed value', timeoutMs: 30_000 },
    );
    expect((after as any)!.orientationbuttonname, 'WS-25: the app persisted the typed value').toBe(typed);

    // [ASSERT 2] — the real point of this case. `wsSentinel` is not an allFields key, so it is absent
    // from the save payload. It may only still be there because the app used merge:true (ts:1196); a
    // destructive setDoc would have removed it and this assertion is the only thing that would notice.
    expect(
      (after as any)!.wsSentinel,
      'WS-25: a field the screen does not manage must SURVIVE the save (proves setDoc merge:true)',
    ).toBe(wsAddNames.classifySentinel);
  });
});
