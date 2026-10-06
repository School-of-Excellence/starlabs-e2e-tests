// event-eligibility-cta.spec.ts — /create_event: the per-product ELIGIBILITY block on the event editor and
// the new "Configure CTA" dialog (starlabs-angular surya-development 0e8f5685 / 7b5b6c14, merged onto
// charan-release 2026-10-02).
//
// Hook prefixes (one per component):
//   evl  — EventListComponent          (event-list.component.html; Configure CTA button)
//   ued  — UpdateEventDetailComponent  (update-event-detail.component.html; eligibility block)
//   ecta — EventCtaConfigComponent     (event-cta-config.component.html; the CTA dialog)
//   epc  — EventParticipationConfirmationsComponent (overview row; eligibility buckets, surya 7835cb21)
//
// Reference: starlabs-angular specs/journals/2026-10-02-pull-surya-event-eligibility-cta.md.
//
// SEEDED WORLD (seed-events.js 9d / 9e):
//   journey  `EVL Elig Journey <run>` (label field `journey`)
//   big marathon LIVE (status 'live') + cohort `EVL Live Cohort <run>`
//   big marathon OLD  (status 'completed') + cohort `EVL Old Cohort <run>`   ← NEGATIVE CONTROL
//   classify/eventcta + classify/eventstatusmessage with run-unique strings
//   (9f) an event + arena product whose `eligibility` = journey EVL, status ['active']; six requesters:
//        ELIG (active, journey, owner) · UPG (journey mismatch) · ADD (not owner) · CONT (non active) ·
//        NE (discontinued) · APPR (approved — must land in NO bucket)
//
// ANTI-CIRCULARITY. UED-ELIG-01 only clicks and types a search term; which cohorts are offered is the
// app's own join (live marathons → cohorts by marathonref) — the OLD cohort proves the status filter ran.
// ECTA-01 asserts the dialog prefilled what the app READ from classify; ECTA-02's oracle is an Admin-SDK
// read of the docs the app WROTE (the test types one value and checks the rest survived the whole-doc
// setDoc), and that an invalid form writes nothing.
//
// EPC-ELIG-01: every bucket count is the app's own classification of joined docs (metadata status/journey ×
// product ownership × the arena's rules); the seed writes one requester per bucket and an APPROVED one that
// proves approved requesters are excluded (Requested stays 5, each bucket exactly 1).
//
// NOT COVERED: saving an event with eligibility (the editor's Save needs a full event + arena product +
// image pipeline); the funnel drill-down's new breakdown rows; the cohort / consumption rules in buckets.
import { test, expect, Page } from '@playwright/test';
import { installEvtStubs, loginAsEvtAdmin, evtEligibility as E, evtCta as C, restoreCtaConfig } from './support/events';

const RUN = process.env.EVT_RUNID || 'evt';
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

  test('EPC-ELIG-01 the confirmations overview splits requesters into Eligible / Upgrade / Addon / Continuity / Not eligible', async ({ page }) => {
    await page.goto('/event-participation-confirmation', { waitUntil: 'domcontentloaded' });
    const row = page.getByTestId('epc-overview-row').filter({ hasText: `EVL Bucket Product ${RUN}` });
    await expect(row, 'EPC-ELIG-01: the bucket arena event is listed (upcoming)').toHaveCount(1, { timeout: 60_000 });

    // column positions from the header (the row's cells line up with these th)
    const heads = (await page.locator('table th').allTextContents()).map((t) => t.trim());
    const cell = (label: string) => row.locator('td').nth(heads.indexOf(label));
    for (const label of ['Requested', 'Eligible', 'Upgrade', 'Addon', 'Continuity', 'Not eligible', 'Approved']) {
      expect(heads.indexOf(label), `EPC-ELIG-01: the overview has a "${label}" column`).toBeGreaterThan(-1);
    }
    await expect(cell('Eligible'), 'EPC-ELIG-01: active + journey + owner → Eligible').toHaveText('1', { timeout: 60_000 });
    await expect(cell('Upgrade'), 'EPC-ELIG-01: journey mismatch → Upgrade').toHaveText('1');
    await expect(cell('Addon'), 'EPC-ELIG-01: not an owner → Addon').toHaveText('1');
    await expect(cell('Continuity'), 'EPC-ELIG-01: non active + journey → Continuity').toHaveText('1');
    await expect(cell('Not eligible'), 'EPC-ELIG-01: neither active nor non active → Not eligible').toHaveText('1');
    await expect(cell('Requested'), 'EPC-ELIG-01: the approved requester is not counted as requested').toHaveText('5');
    await expect(cell('Approved'), 'EPC-ELIG-01: …it is counted as Approved').toHaveText('1');
  });

  test('EPC-ELIG-02 the funnel\'s Addon segment lists the non-owner with a reason and Assign product', async ({ page }) => {
    // surya 7a23f823: the Addon bucket's drill-down now behaves like "No product" — Reason column + Assign product.
    await page.goto('/event-participation-confirmation', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('epc-overview-row').filter({ hasText: `EVL Bucket Product ${RUN}` }).click();
    const addon = page.getByTestId('pf-breakdown-row').filter({ hasText: /^\s*Addon/ });
    await expect(addon, 'EPC-ELIG-02: the funnel offers an Addon segment').toHaveCount(1, { timeout: 60_000 });
    await addon.click();
    const addRow = page.locator('tr').filter({ hasText: `EVL Bucket ADD ${RUN}` });
    await expect(addRow, 'EPC-ELIG-02: the non-owner is in the Addon segment').toHaveCount(1, { timeout: 30_000 });
    await expect(addRow.getByTestId('pf-row-assign-product'), 'EPC-ELIG-02: …with Assign product').toBeVisible();
    await expect(page.locator('tr').filter({ hasText: `EVL Bucket ELIG ${RUN}` }), 'EPC-ELIG-02: an eligible owner is not in Addon').toHaveCount(0);
    await expect(page.locator('th').filter({ hasText: /^\s*Reason\s*$/ }), 'EPC-ELIG-02: the Addon table carries a Reason column').toHaveCount(1);
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
