// event-eligibility-cta.spec.ts — /create_event: the per-product ELIGIBILITY block on the event editor and
// the new "Configure CTA" dialog (starlabs-angular surya-development 0e8f5685 / 7b5b6c14, merged onto
// charan-release 2026-10-02).
//
// Hook prefixes (one per component):
//   evl  — EventListComponent          (event-list.component.html; Configure CTA button)
//   ued  — UpdateEventDetailComponent  (update-event-detail.component.html; eligibility block)
//   ecta — EventCtaConfigComponent     (event-cta-config.component.html; the CTA dialog)
//
// Reference: starlabs-angular specs/journals/2026-10-02-pull-surya-event-eligibility-cta.md.
//
// SEEDED WORLD (seed-events.js 9d / 9e):
//   journey  `EVL Elig Journey <run>` (label field `journey`)
//   big marathon LIVE (status 'live') + cohort `EVL Live Cohort <run>`
//   big marathon OLD  (status 'completed') + cohort `EVL Old Cohort <run>`   ← NEGATIVE CONTROL
//   classify/eventcta + classify/eventstatusmessage with run-unique strings
//
// ANTI-CIRCULARITY. UED-ELIG-01 only clicks and types a search term; which cohorts are offered is the
// app's own join (live marathons → cohorts by marathonref) — the OLD cohort proves the status filter ran.
// ECTA-01 asserts the dialog prefilled what the app READ from classify; ECTA-02's oracle is an Admin-SDK
// read of the docs the app WROTE (the test types one value and checks the rest survived the whole-doc
// setDoc), and that an invalid form writes nothing.
//
// NOT COVERED: saving an event with eligibility (the editor's Save needs a full event + arena product +
// image pipeline); the eligibility BUCKETS on the confirmations screen (surya 573e1f59 — not wired yet).
import { test, expect, Page } from '@playwright/test';
import { installEvtStubs, loginAsEvtAdmin, evtEligibility as E, evtCta as C, restoreCtaConfig } from './support/events';
import { getDoc } from '../queue/support/firestore-admin';

test.beforeEach(async ({ page }) => {
  await installEvtStubs(page);
  await loginAsEvtAdmin(page);
});

/** Open a mat-select from the keyboard — the editor dialog's sticky header overlaps a scrolled-to select,
 *  so a pointer click lands on the header. Takes a Locator (gate rule: ids stay literal at the call site). */
async function openSelect(page: Page, select: import('@playwright/test').Locator) {
  await select.focus();
  await page.keyboard.press('Enter');
}

async function openEditorWithProduct(page: Page) {
  await page.goto('/create_event', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('evl-create-event').click();
  await expect(page.getByTestId('ued-eventname')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('ued-add-arena-event').click();
  await expect(page.getByTestId('ued-product-journey').last(), 'a product block with an Eligibility section').toBeVisible();
}

test.describe('Events — event editor eligibility + Configure CTA (live-marathon cohorts; CTA prefill + save)', () => {
  test('UED-ELIG-01 eligibility offers journeys, only LIVE-marathon cohorts, status toggles and consumption rows', async ({ page }) => {
    await openEditorWithProduct(page);
    await expect(page.getByTestId('ued-marathon'), 'the event-level marathon picker renders').toBeAttached();

    // Customer status: 'active' is the default, 'non active' is not — and it toggles.
    const active = page.getByTestId('ued-product-status-active').last().locator('input[type=checkbox]');
    const nonActive = page.getByTestId('ued-product-status-nonactive').last().locator('input[type=checkbox]');
    await expect(active, 'UED-ELIG-01: Active is ticked by default').toBeChecked();
    await expect(nonActive).not.toBeChecked();
    await page.getByTestId('ued-product-status-nonactive').last().click();
    await expect(nonActive, 'UED-ELIG-01: Non Active can be added').toBeChecked();

    // Journeys: the whole journey collection, searchable.
    await openSelect(page, page.getByTestId('ued-product-journey').last());
    // the search box auto-focuses inside a mat-option that reports itself disabled, so type rather than fill()
    await expect(page.getByTestId('ued-product-journey-search')).toBeVisible();
    await page.keyboard.type(E.journey);
    await expect(page.getByRole('option', { name: E.journey }), 'UED-ELIG-01: the seeded journey is offered').toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');

    // Cohorts: only those under a LIVE marathon.
    await openSelect(page, page.getByTestId('ued-product-cohort').last());
    // the search box auto-focuses inside a mat-option that reports itself disabled, so type rather than fill()
    await expect(page.getByTestId('ued-product-cohort-search')).toBeVisible();
    await page.keyboard.type('EVL ');
    await expect(page.getByRole('option', { name: E.liveCohort }), 'UED-ELIG-01: the LIVE marathon\'s cohort is offered').toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('option', { name: E.oldCohort }), 'UED-ELIG-01: a completed marathon\'s cohort is NOT offered').toHaveCount(0);
    await page.keyboard.press('Escape');

    // Consumed-product rules: add a row, its three controls render, remove it.
    await expect(page.getByTestId('ued-consumption-product')).toHaveCount(0);
    await page.getByTestId('ued-consumption-add').last().click();
    await expect(page.getByTestId('ued-consumption-product'), 'UED-ELIG-01: Add Consumed Product adds a rule row').toHaveCount(1);
    await expect(page.getByTestId('ued-consumption-operator')).toHaveCount(1);
    await page.getByTestId('ued-consumption-count').fill('2');
    await expect(page.getByTestId('ued-consumption-count')).toHaveValue('2');
    await page.getByTestId('ued-consumption-remove').click();
    await expect(page.getByTestId('ued-consumption-product'), 'UED-ELIG-01: the rule row is removed').toHaveCount(0);
  });

  test.describe('Configure CTA', () => {
    test.afterAll(async () => { await restoreCtaConfig(); });

    async function openCta(page: Page) {
      await page.goto('/create_event', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('evl-configure-cta').click();
      await expect(page.getByTestId('ecta-submit')).toBeVisible({ timeout: 30_000 });
    }

    test('ECTA-01 the dialog prefills every field from classify/eventcta + eventstatusmessage', async ({ page }) => {
      await openCta(page);
      await expect(page.getByTestId('ecta-confirm-button'), 'ECTA-01: confirm button label').toHaveValue(C.confirmButton);
      await expect(page.getByTestId('ecta-nocta-description'), 'ECTA-01: no-CTA description').toHaveValue(C.nocta);
      await expect(page.getByTestId('ecta-requested'), 'ECTA-01: requested message').toHaveValue(C.requested);
      await expect(page.getByTestId('ecta-confirmationmessage'), 'ECTA-01: confirmation message').toHaveValue(C.confirmed);
      await expect(page.getByTestId('ecta-confirm-description')).not.toHaveValue('');
      await expect(page.getByTestId('ecta-addon-button')).not.toHaveValue('');
      await expect(page.getByTestId('ecta-addon-description')).not.toHaveValue('');
      await expect(page.getByTestId('ecta-upgrade-button')).not.toHaveValue('');
      await expect(page.getByTestId('ecta-upgrade-description')).not.toHaveValue('');
      await expect(page.getByTestId('ecta-continuity-button')).not.toHaveValue('');
      await expect(page.getByTestId('ecta-continuity-description')).not.toHaveValue('');
      await expect(page.getByTestId('ecta-nocta-button')).not.toHaveValue('');
      await page.getByTestId('ecta-close').click();
      await expect(page.getByTestId('ecta-submit'), 'ECTA-01: Close dismisses the dialog').toHaveCount(0);
    });

    test('ECTA-02 an empty field blocks Submit (nothing written); a valid Submit writes both docs and keeps the rest', async ({ page }) => {
      const alerts: string[] = [];
      page.on('dialog', async (d) => { alerts.push(d.message()); await d.accept(); });
      await openCta(page);
      await expect(page.getByTestId('ecta-requested')).toHaveValue(C.requested);

      await page.getByTestId('ecta-requested').fill('');
      await page.getByTestId('ecta-submit').click();
      await expect.poll(() => alerts.at(-1), 'ECTA-02: an empty required field is refused').toBe('Fill all Values');
      expect((await getDoc('classify', 'eventstatusmessage'))?.requested?.message, 'ECTA-02: nothing written on a refused Submit').toBe(C.requested);

      const next = `${C.requested} — edited`;
      await page.getByTestId('ecta-requested').fill(next);
      await page.getByTestId('ecta-submit').click();
      await expect.poll(() => alerts.at(-1), 'ECTA-02: the app reports success').toBe('Successfully updated event configuations');
      const msg = await getDoc('classify', 'eventstatusmessage');
      const cta = await getDoc('classify', 'eventcta');
      expect(msg?.requested?.message, 'ECTA-02: the edited message was written').toBe(next);
      expect(msg?.confirmationmessage?.message, 'ECTA-02: the untouched message survived the whole-doc write').toBe(C.confirmed);
      expect(cta?.confirmparticipation?.button, 'ECTA-02: the CTA doc was rewritten with the form values').toBe(C.confirmButton);
      await expect(page.getByTestId('ecta-submit'), 'ECTA-02: a successful Submit closes the dialog').toHaveCount(0);
    });

    test('ECTA-03 Cancel closes without writing', async ({ page }) => {
      await openCta(page);
      await page.getByTestId('ecta-requested').fill('should not be saved');
      await page.getByTestId('ecta-cancel').click();
      await expect(page.getByTestId('ecta-submit')).toHaveCount(0);
      expect((await getDoc('classify', 'eventstatusmessage'))?.requested?.message, 'ECTA-03: Cancel wrote nothing').not.toBe('should not be saved');
    });
  });
});
