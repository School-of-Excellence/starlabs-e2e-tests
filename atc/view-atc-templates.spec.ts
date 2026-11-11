// view-atc-templates.spec.ts — Ask / WiSH outcomes on the read-only ATC screens (VATT-01..02), EMULATOR ONLY.
//
// Hook prefixes: vatc (ViewPrescribedATCComponent), pva (AtcPreviewComponent) — each declared by its own screen.
// Plan: starlabs-angular specs/plans/2026-10-23-atc-overnight-goal.md §3 — View Prescribed's full ATC and the
// /previewATC page show "Ask · area of focus" / "WiSH outcomes" only when the ATC has them, and label a WiSH
// directive "Immediate outcome". The ATCs are seed-atc.js phase 4 (tvv: vEI, vWish) — read-only here; a plain ATC
// (A1) is the negative control.
import { test, expect, Page } from '@playwright/test';
import {
  ATC, PA, PF, NAME, RUN, TPL, TPL_ASKS, TPL_OUTCOMES, REVIEW, installAtcGuards, assertNoRealDb, loginAsAtc, pickOptions, tid, atcDoc, waitFor, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

async function openView(page: Page) {
  await loginAsAtc(page, 'admin');
  await page.goto('/viewprescribedATC');
  await expect(page.getByTestId('vatc-count')).toBeVisible({ timeout: 45_000 });
  // only tvv's ATCs (they are dated far back, past page 1 of the unfiltered list)
  await pickOptions(page, page.getByTestId('vatc-filter-participant'), [NAME.tvv]);
  await expect(page.getByTestId('vatc-count')).toHaveText(/Showing 3 ATCs/, { timeout: 30_000 });
}
const row = (page: Page, id: string) => page.locator(tid(`vatc-row-${id}`));
async function openFull(page: Page, id: string) {
  const r = row(page, id);
  await expect(r).toBeVisible({ timeout: 45_000 });
  await r.getByTestId('vatc-toggle-full').click();
  await expect(r.locator(tid('vatc-adj-0'))).toBeVisible({ timeout: 45_000 });
  return r;
}
async function openPreview(page: Page, id: string, signIn = true) {
  if (signIn) await loginAsAtc(page, 'admin');      // a signed-in page sent to '/' skips the login form
  await page.goto(`/previewATC?type=alpha&atcdocid=${id}&participantassignmentid=${PA.activity}`);
  await expect(page.getByTestId('pva-participant')).toBeVisible({ timeout: 45_000 });
}

test.describe('ATC — Ask / WiSH outcomes on View Prescribed + Preview (emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);   // three full ATCs / three preview pages per case
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'view atc templates: no fatal console errors');
  });

  test('VATT-01 View Prescribed: EI shows its asks, WiSH its outcomes + "Immediate outcome"; a plain ATC shows neither', async ({ page }) => {
    await openView(page);
    const ei = await openFull(page, TPL.vEI);
    await expect(ei).toContainText('ATC Directive:');
    await expect(ei.getByTestId('vatc-ask-card')).toContainText('Ask · area of focus');
    await expect(ei.getByTestId('vatc-ask-row')).toHaveCount(2);
    await expect(ei.getByTestId('vatc-ask-row').nth(0)).toContainText('Self');
    await expect(ei.getByTestId('vatc-ask-row').nth(0)).toContainText(TPL_ASKS[0].askedfor);
    await expect(ei.getByTestId('vatc-ask-row').nth(1)).toContainText('Spouse');
    await expect(ei.getByTestId('vatc-outcome-card')).toHaveCount(0);

    const wish = await openFull(page, TPL.vWish);
    await expect(wish).toContainText('Immediate outcome:');
    await expect(wish).not.toContainText('ATC Directive:');
    await expect(wish.getByTestId('vatc-outcome-card')).toContainText('WiSH outcomes');
    await expect(wish.getByTestId('vatc-outcome-row')).toHaveCount(2);
    await expect(wish.getByTestId('vatc-outcome-row').nth(0)).toContainText('01');
    await expect(wish.getByTestId('vatc-outcome-row').nth(0)).toContainText(TPL_OUTCOMES[0].outcomearea);
    await expect(wish.getByTestId('vatc-outcome-row').nth(1)).toContainText(TPL_OUTCOMES[1].outcomeexpected);
    await expect(wish.getByTestId('vatc-ask-card')).toHaveCount(0);

    const plain = await openFull(page, TPL.vPlain);
    await expect(plain.getByTestId('vatc-ask-card')).toHaveCount(0);
    await expect(plain.getByTestId('vatc-outcome-card')).toHaveCount(0);
    // the Review log is EI Solution only
    await expect(ei.getByTestId('vatc-review-card')).toBeVisible();
    await expect(wish.getByTestId('vatc-review-card')).toHaveCount(0);
    await expect(plain.getByTestId('vatc-review-card')).toHaveCount(0);
    await expect(wish.getByTestId('vatc-review-count')).toHaveCount(0);
  });

  test('VATT-02 /previewATC: the same cards and labels; a plain ATC shows neither', async ({ page }) => {
    await openPreview(page, TPL.vEI);
    await expect(page.getByTestId('pva-directive')).toBeVisible();
    await expect(page.getByText('ATC Directive', { exact: true })).toBeVisible();
    await expect(page.getByTestId('pva-ask-card')).toBeVisible();
    await expect(page.getByTestId('pva-ask-row')).toHaveCount(2);
    await expect(page.getByTestId('pva-ask-row').nth(0)).toContainText('Self');
    await expect(page.getByTestId('pva-ask-row').nth(0)).toContainText(TPL_ASKS[0].askedfor);
    await expect(page.getByTestId('pva-outcome-card')).toHaveCount(0);

    await openPreview(page, TPL.vWish, false);
    await expect(page.getByText('Immediate outcome', { exact: true })).toBeVisible();
    await expect(page.getByTestId('pva-outcome-row')).toHaveCount(2);
    await expect(page.getByTestId('pva-outcome-row').nth(1)).toContainText(TPL_OUTCOMES[1].outcomearea);
    await expect(page.getByTestId('pva-ask-card')).toHaveCount(0);

    await openPreview(page, ATC.A1, false);
    await expect(page.getByTestId('pva-ask-card')).toHaveCount(0);
    await expect(page.getByTestId('pva-outcome-card')).toHaveCount(0);
  });

  test('VATT-03 Review log (EI): list + show deleted, empty error, add (newest first, counts), delete with confirm, survives a reload', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto('/viewprescribedATC');
    await expect(page.getByTestId('vatc-count')).toBeVisible({ timeout: 45_000 });
    await pickOptions(page, page.getByTestId('vatc-filter-participant'), [NAME.trl]);
    const sum = page.getByTestId('vatc-sum-reviews');
    await expect(sum).toHaveText(/\d+/, { timeout: 30_000 });
    const sumBefore = Number(await sum.innerText());
    const r = await openFull(page, TPL.rEI);
    await expect(r.getByTestId('vatc-review-count')).toHaveText('1 reviews');
    const card = r.getByTestId('vatc-review-card');
    await expect(card).toContainText('Hidden in the participant app');
    const rows = card.getByTestId('vatc-review-row');
    await expect(rows, 'the deleted review is hidden').toHaveCount(1);
    await expect(rows.nth(0)).toContainText(NAME.agent2);
    await expect(card.getByTestId('vatc-review-note').nth(0)).toHaveText(REVIEW.active);
    // Show deleted (1) brings the soft-deleted one back, marked
    await card.getByTestId('vatc-review-show-deleted').locator('input').check();
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: REVIEW.deleted })).toContainText('Deleted');
    await card.getByTestId('vatc-review-show-deleted').locator('input').uncheck();
    await expect(rows).toHaveCount(1);

    // empty → message; then add → newest first, counts go up, written by me
    await card.getByTestId('vatc-review-add').click();
    await expect(card.getByTestId('vatc-review-error')).toHaveText('Write the review first.');
    await card.getByTestId('vatc-review-text').fill(`  VATT-03 review ${RUN}  `);
    await card.getByTestId('vatc-review-add').click();
    await expect(rows).toHaveCount(2, { timeout: 20_000 });
    await expect(card.getByTestId('vatc-review-note').nth(0), 'newest first, trimmed').toHaveText(`VATT-03 review ${RUN}`);
    await expect(r.getByTestId('vatc-review-count')).toHaveText('2 reviews');
    await expect(sum).toHaveText(String(sumBefore + 1));
    const added = await waitFor(async () => ((await atcDoc(`atc_alpha/${TPL.rEI}`))?.reviewlog || []).find((x: any) => x.note === `VATT-03 review ${RUN}`) || null, 'review on the ATC doc');
    expect(added).toMatchObject({ createdby: PF.admin, isdelete: false });
    expect(typeof added.id).toBe('string');

    // delete: Cancel first, then confirm → soft delete (who), counts back down
    await rows.nth(0).getByTestId('vatc-review-delete').click();
    await expect(card.getByTestId('vatc-review-confirm')).toContainText("Delete this review? It's hidden from the log but kept on the ATC.");
    await card.getByTestId('vatc-review-cancel').click();
    await expect(card.getByTestId('vatc-review-confirm')).toHaveCount(0);
    await rows.nth(0).getByTestId('vatc-review-delete').click();
    await card.getByTestId('vatc-review-confirm-delete').click();
    await expect(rows).toHaveCount(1, { timeout: 20_000 });
    await expect(r.getByTestId('vatc-review-count')).toHaveText('1 reviews');
    const gone = await waitFor(async () => ((await atcDoc(`atc_alpha/${TPL.rEI}`))?.reviewlog || []).find((x: any) => x.id === added.id && x.isdelete) || null, 'soft delete on the ATC doc');
    expect(gone.deletedby).toBe(PF.admin);
    expect(((await atcDoc(`atc_alpha/${TPL.rEI}`)).reviewlog || []).length, 'never removed').toBe(3);

    // a reload shows the same log
    await page.reload();
    await expect(page.getByTestId('vatc-count')).toBeVisible({ timeout: 45_000 });
    await pickOptions(page, page.getByTestId('vatc-filter-participant'), [NAME.trl]);
    const r2 = await openFull(page, TPL.rEI);
    await expect(r2.getByTestId('vatc-review-row')).toHaveCount(1);
    await expect(r2.getByTestId('vatc-review-show-deleted')).toContainText('Show deleted (2)');

    // undelete (no confirmation): back in the log, counts up, delete fields cleared (no audit trail)
    await r2.getByTestId('vatc-review-show-deleted').locator('input').check();
    const mine = r2.getByTestId('vatc-review-row').filter({ hasText: `VATT-03 review ${RUN}` });
    await expect(mine).toContainText('Deleted');
    await expect(mine.getByTestId('vatc-review-delete')).toHaveCount(0);
    await mine.getByTestId('vatc-review-undelete').click();
    await expect(mine).not.toContainText('Deleted', { timeout: 20_000 });
    await expect(r2.getByTestId('vatc-review-count')).toHaveText('2 reviews');
    await expect(r2.getByTestId('vatc-review-show-deleted')).toContainText('Show deleted (1)');
    const back = await waitFor(async () => ((await atcDoc(`atc_alpha/${TPL.rEI}`))?.reviewlog || []).find((x: any) => x.id === added.id && x.isdelete === false) || null, 'undelete on the ATC doc');
    expect(back.deletedby).toBeNull();
    expect(back.deletedon).toBeNull();
  });

  test('VATT-04 the ATC author (no admin / mentor role) may add a review', async ({ page }) => {
    await loginAsAtc(page, 'eis');
    await page.goto('/viewprescribedATC');
    await expect(page.getByTestId('vatc-count')).toBeVisible({ timeout: 45_000 });
    const r = await openFull(page, TPL.rEIS);
    const card = r.getByTestId('vatc-review-card');
    await expect(card.getByTestId('vatc-review-empty')).toBeVisible();
    await card.getByTestId('vatc-review-text').fill(`VATT-04 author review ${RUN}`);
    await card.getByTestId('vatc-review-add').click();
    await expect(card.getByTestId('vatc-review-note').nth(0)).toHaveText(`VATT-04 author review ${RUN}`, { timeout: 20_000 });
    const log = await waitFor(async () => { const l = (await atcDoc(`atc_alpha/${TPL.rEIS}`))?.reviewlog || []; return l.length ? l : null; }, 'author review written');
    expect(log[0]).toMatchObject({ createdby: PF.eis, note: `VATT-04 author review ${RUN}` });
  });
});
