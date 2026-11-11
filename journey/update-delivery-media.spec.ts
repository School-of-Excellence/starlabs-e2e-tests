// update-delivery-media.spec.ts — /deliveryactivities → edit a Form delivery → a video/audio field's
// pasted URL gets "Copy link" and "Play" (inline player) right under the chip field, and a long URL chip
// ellipsizes instead of overflowing the field.
//
// Hook prefix: ud — UpdateDeliveryComponent (the same prefix product-designer-addressable-dialogs.spec.ts
// registers; this file drives ud-copy-media-url-25, ud-toggle-media-26, ud-media-embed-27,
// ud-media-video-28, ud-media-audio-29).
// Reference: starlabs-angular specs/journals/2026-11-11-delivery-form-media-copy-play.md.
//
// SEEDED WORLD (seed-journey.js, ID.DFM — `Media Copy Play Form <run>`; route grant /deliveryactivities):
//   Watch Video  video · YouTube WATCH link (watch?v=…&t=7)  → Copy + Play; Play is an <iframe>
//   Direct Video video · long mp4 URL on a fake host          → Play is a <video>; the chip ellipsizes
//   Empty Video  video · no URL                               → negative control: no Copy / Play
//   Pick One     radio · options Yes / No                     → negative control: chips, no Copy / Play
//   Audio List   array · sub-field audio with a URL           → the sub-field render path: Play is <audio>
// The two negative controls are what make a green UDM-01 mean "the tools follow a media URL" rather than
// "every chip field gets the tools".
//
// ANTI-CIRCULARITY. The seed writes watch/mp4/mp3 URLs only. The app decides which fields get the tools,
// derives the YouTube EMBED URL from the watch link (the seed never writes /embed/), picks iframe vs
// <video> vs <audio>, and performs the copy; the clipboard is read back through the browser, not from
// what the test typed. No Firestore oracle: nothing here is meant to write, and the dialog's own
// autosave (formarray.valueChanges → submitForm) may rewrite the doc on open, so the doc is not a
// stable oracle — and for that reason no case removes a chip (a retry would find the URL gone).
//
// External media never loads: youtube.com/embed and media.example.test are fulfilled locally.
import { test, expect, Page, Locator } from '@playwright/test';
import { installJourneyStubs, attachJourneyGuard, loginAsJourneyAdmin, udmWorld as W } from './support/journey';
import { assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

let guard: ConsoleGuard;
test.beforeEach(async ({ page }) => {
  guard = attachJourneyGuard(page);
  await installJourneyStubs(page);
  // registered after the stubs, so these win for their hosts
  await page.route('https://www.youtube.com/embed/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }));
  await page.route('https://media.example.test/**', (r) => r.fulfill({ status: 200, contentType: 'application/octet-stream', body: '' }));
});
test.afterEach(() => assertNoFatal(guard, 'update-delivery media tools: no fatal console errors / pageerrors'));

/** /deliveryactivities → filter to the run's media form → edit. Returns the open dialog. */
async function openMediaForm(page: Page): Promise<Locator> {
  await loginAsJourneyAdmin(page);
  await page.goto('/deliveryactivities', { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Filter' }).fill(W.formName);
  const row = page.getByRole('row').filter({ hasText: W.formName });
  await expect(row, 'the seeded media form is listed').toHaveCount(1, { timeout: 30_000 });
  await row.getByTestId('ds1-edit-delivery-3').click();
  const dialog = page.getByRole('dialog');
  await expect(card(dialog, W.field.audioArray), 'the dialog built every seeded field').toBeVisible({ timeout: 30_000 });
  return dialog;
}

function card(dialog: Locator, fieldname: string): Locator {
  return dialog.locator('.fb-card').filter({ has: dialog.page().locator('.fb-card-name', { hasText: fieldname }) });
}

test.describe('Journey — Delivery Activities form editor (copy / play a pasted media URL)', () => {
  test('UDM-01 a YouTube watch link: Copy puts the link on the clipboard, Play embeds the app-derived /embed/ URL', async ({ page }) => {
    const dialog = await openMediaForm(page);
    const watch = card(dialog, W.field.watch);

    await watch.getByTestId('ud-copy-media-url-25').click();
    await expect(page.locator('mat-snack-bar-container'), 'UDM-01: copy confirms').toContainText('Link copied');
    expect(await page.evaluate(() => navigator.clipboard.readText()), 'UDM-01: the clipboard holds the pasted link').toBe(W.watchUrl);

    const toggle = watch.getByTestId('ud-toggle-media-26');
    await toggle.click();
    const frame = watch.getByTestId('ud-media-embed-27');
    await expect(frame, 'UDM-01: Play opens an inline player').toBeVisible();
    await expect(frame, 'UDM-01: watch?v= is converted to the embed URL').toHaveAttribute('src', W.embedUrl);
    await expect(watch.getByTestId('ud-media-video-28'), 'UDM-01: a YouTube link is never fed to <video>').toHaveCount(0);
    await expect(toggle).toContainText('Hide player');

    await toggle.click();
    await expect(frame, 'UDM-01: Hide player removes it').toHaveCount(0);
    await expect(toggle).toContainText('Play');
  });

  test('UDM-02 a direct mp4 plays in <video>, and its long URL chip ellipsizes inside the field', async ({ page }) => {
    const dialog = await openMediaForm(page);
    const mp4 = card(dialog, W.field.mp4);

    await mp4.getByTestId('ud-toggle-media-26').click();
    await expect(mp4.getByTestId('ud-media-video-28'), 'UDM-02: Play opens a <video>').toHaveAttribute('src', W.mp4Url);
    await expect(mp4.getByTestId('ud-media-embed-27'), 'UDM-02: a non-YouTube/Vimeo link gets no iframe').toHaveCount(0);

    const chip = mp4.locator('mat-chip-row');
    await expect(chip, 'UDM-02: hovering shows the full link').toHaveAttribute('title', W.mp4Url);
    const fit = await chip.evaluate((el) => {
      const field = el.closest('mat-form-field')!.getBoundingClientRect();
      const label = el.querySelector('.mdc-evolution-chip__text-label') as HTMLElement;
      return {
        insideField: el.getBoundingClientRect().right <= field.right + 1,
        truncated: label.scrollWidth > label.clientWidth,
        ellipsis: getComputedStyle(label).textOverflow,
      };
    });
    expect(fit.insideField, 'UDM-02: the chip stays inside the field').toBe(true);
    expect(fit.truncated, 'UDM-02: the long link is actually cut').toBe(true);
    expect(fit.ellipsis).toBe('ellipsis');
  });

  test('UDM-03 negative controls: no tools on a video field without a URL, nor on a radio field with options', async ({ page }) => {
    const dialog = await openMediaForm(page);
    // the watch card proves the tools rendered at all in this dialog
    await expect(card(dialog, W.field.watch).getByTestId('ud-copy-media-url-25')).toBeVisible();

    const empty = card(dialog, W.field.empty);
    await expect(empty.getByTestId('ud-copy-media-url-25'), 'UDM-03: empty video field has no Copy').toHaveCount(0);
    await expect(empty.getByTestId('ud-toggle-media-26'), 'UDM-03: empty video field has no Play').toHaveCount(0);

    const radio = card(dialog, W.field.radio);
    await expect(radio.locator('mat-chip-row'), 'UDM-03: the radio options render as chips').toHaveCount(2);
    await expect(radio.getByTestId('ud-copy-media-url-25'), 'UDM-03: option chips get no Copy').toHaveCount(0);
    await expect(radio.getByTestId('ud-toggle-media-26'), 'UDM-03: option chips get no Play').toHaveCount(0);
  });

  test('UDM-04 an audio sub-field inside an Array field gets the same tools and plays in <audio>', async ({ page }) => {
    const dialog = await openMediaForm(page);
    const sub = card(dialog, W.field.audioArray).locator('.fb-subrow');
    await expect(sub).toHaveCount(1);

    await expect(sub.getByTestId('ud-copy-media-url-25'), 'UDM-04: sub-field has Copy').toBeVisible();
    await sub.getByTestId('ud-toggle-media-26').click();
    await expect(sub.getByTestId('ud-media-audio-29'), 'UDM-04: Play opens an <audio>').toHaveAttribute('src', W.audioUrl);
    await expect(sub.getByTestId('ud-media-video-28')).toHaveCount(0);
  });
});
