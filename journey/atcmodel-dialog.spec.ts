// atcmodel-dialog.spec.ts — the Create ATC model dialog's own controls (image, name, evolution type, categories,
// description, directive, content videos, close, save), EMULATOR. Hook prefixes: va (view-atcmodel), ca (create-atcmodel).
// The forms config of the same dialog is atcmodel-forms.spec.ts.
//
// Anti-circularity: the saved model is read back from the emulator with the Admin SDK; the image rules are checked on
// the message the app shows for files it rejects. No image is saved (nothing is uploaded to Storage).
import { test, expect, Page } from '@playwright/test';
import { installJourneyStubs, loginAsJourneyAdmin } from './support/journey';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const seed = require('../fixtures/seed-test-project');
const RUN = process.env.JNY_RUNID || 'jny';
const db = () => seed.initAdmin().firestore();

const EXISTING = `AMD Existing model ${RUN}`;
const NEW_NAME = `AMD New model ${RUN}`;
const VIDEO_ID = `${RUN}_amd_video`;
const VIDEO_TITLE = `AMD Video ${RUN}`;
const png = (b64: string) => Buffer.from(b64, 'base64');
const SQUARE = png('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='); // 1 × 1
const WIDE = png('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADUlEQVR4nGP4z8AARAAI/gH/xp559wAAAABJRU5ErkJggg==');   // 2 × 1

async function openCreate(page: Page) {
  await loginAsJourneyAdmin(page);
  await page.goto('/atcmodel', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('va-on-open-dialog-1').click();
  await expect(page.getByTestId('ca-name-input')).toBeVisible({ timeout: 20_000 });
}
async function savedByName(name: string) {
  const q = await db().collection('atc model').where('atcmodel', '==', name).get();
  return q.docs[0] || null;
}

test.describe('Product Designer — Create ATC model dialog controls (real UI, emulator)', () => {
  test.beforeAll(async () => {
    await db().collection('atc model').doc(`${RUN}_amd_existing`).set({ docid: `${RUN}_amd_existing`, atcmodel: EXISTING, evolutiontype: 'full', testrunid: RUN });
    await db().collection('content_urls').doc(VIDEO_ID).set({ title: VIDEO_TITLE, testrunid: RUN });
  });
  test.afterAll(async () => {
    await db().collection('atc model').doc(`${RUN}_amd_existing`).delete().catch(() => {});
    await db().collection('content_urls').doc(VIDEO_ID).delete().catch(() => {});
    const made = await savedByName(NEW_NAME);
    if (made) await made.ref.delete().catch(() => {});
  });
  test.beforeEach(async ({ page }) => { await installJourneyStubs(page); });

  test('AMD-01 image rules: wrong type and non-square are refused with a message; a square image previews, replaces and removes', async ({ page }) => {
    await openCreate(page);
    await expect(page.getByTestId('ca-image-pick')).toBeVisible();
    await page.getByTestId('ca-image-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
    await expect(page.getByTestId('ca-image-error')).toHaveText('Use a PNG, JPG, or WebP image.');
    await page.getByTestId('ca-image-input').setInputFiles({ name: 'wide.png', mimeType: 'image/png', buffer: WIDE });
    await expect(page.getByTestId('ca-image-error')).toHaveText('This image is 2 × 1. Upload a square (1:1) image.');
    await expect(page.getByTestId('ca-image-preview')).toHaveCount(0);

    await page.getByTestId('ca-image-input').setInputFiles({ name: 'square.png', mimeType: 'image/png', buffer: SQUARE });
    await expect(page.getByTestId('ca-image-preview')).toBeVisible();
    await expect(page.getByTestId('ca-image-error')).toHaveCount(0);
    await expect(page.getByTestId('ca-image-pick')).toHaveCount(0);
    // Replace opens the file picker again
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('ca-image-replace').click()]);
    await chooser.setFiles({ name: 'square2.png', mimeType: 'image/png', buffer: SQUARE });
    await expect(page.getByTestId('ca-image-preview')).toBeVisible();
    await page.getByTestId('ca-image-remove').click();
    await expect(page.getByTestId('ca-image-preview')).toHaveCount(0);
    await expect(page.getByTestId('ca-image-pick')).toBeVisible();
  });

  test('AMD-02 name, duplicate check, evolution type, categories, description, directive and videos are saved', async ({ page }) => {
    await openCreate(page);
    await page.getByTestId('ca-name-input').fill(EXISTING.toUpperCase());
    await page.getByTestId('ca-name-input').blur();
    await expect(page.getByTestId('ca-name-duplicate')).toContainText('already exists');
    await page.getByTestId('ca-name-input').fill(NEW_NAME);
    await page.getByTestId('ca-name-input').blur();
    await expect(page.getByTestId('ca-name-duplicate')).toHaveCount(0);

    await page.getByTestId('ca-evolution-type').click();
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: 'Specialised' }).click();

    for (const c of [`Cat A ${RUN}`, `Cat B ${RUN}`]) {
      await page.getByTestId('ca-category-input').fill(c);
      await page.getByTestId('ca-category-input').press('Enter');
    }
    await expect(page.getByTestId('ca-category-remove')).toHaveCount(2);
    await page.getByTestId('ca-category-remove').first().click();
    await expect(page.getByTestId('ca-category-remove')).toHaveCount(1);

    await page.getByTestId('ca-description').fill(`AMD description ${RUN}`);
    await page.getByTestId('ca-directive').fill(`AMD directive ${RUN}`);

    await page.getByTestId('ca-video-input').fill('AMD Video');
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: VIDEO_TITLE }).click();
    await expect(page.getByTestId('ca-video-remove')).toHaveCount(1);
    await page.getByTestId('ca-video-remove').click();
    await expect(page.getByTestId('ca-video-remove')).toHaveCount(0);
    await page.getByTestId('ca-video-input').fill('AMD Video');
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: VIDEO_TITLE }).click();

    await page.getByTestId('ca-on-submit-2').click();
    await expect(page.getByTestId('ca-name-input'), 'the dialog closes on a successful save').toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId('ca-save-error'), 'no save error').toHaveCount(0);
    await expect.poll(async () => !!(await savedByName(NEW_NAME)), { timeout: 20_000 }).toBe(true);
    const saved = (await savedByName(NEW_NAME)).data();
    expect(saved.evolutiontype).toBe('specialised');
    expect(saved.category).toEqual([`Cat B ${RUN}`]);
    expect(saved.description).toBe(`AMD description ${RUN}`);
    expect(saved.directive).toBe(`AMD directive ${RUN}`);
    expect((saved.videourl || []).map((v: any) => v.id)).toEqual([VIDEO_ID]);
    expect(saved.forms).toEqual([]);
    expect(saved.image, 'no image saved').toBeUndefined();
  });

  test('AMD-03 Close leaves without saving', async ({ page }) => {
    await openCreate(page);
    await page.getByTestId('ca-name-input').fill(`AMD Closed ${RUN}`);
    await page.getByTestId('ca-close').click();
    await expect(page.getByTestId('ca-name-input')).toHaveCount(0);
    expect(await savedByName(`AMD Closed ${RUN}`)).toBeNull();
  });
});
