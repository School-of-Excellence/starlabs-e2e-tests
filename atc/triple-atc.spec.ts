// triple-atc.spec.ts — Triple ATC add / view / preview / edit (TRA, TRV, TRP, TRE), EMULATOR ONLY. Phase 2.
//
// A Triple ATC has three perceptual positions, each with its own adjustments. TRV-03 covers bug #4 (fixed
// 2026-10-17): the "Perceptual Position" link sent `atcid` while the preview reads `atcdocid`.
import { test, expect, Page } from '@playwright/test';
import {
  ATC2, PA, PF, NAME, PROC, PROC_NAME, MODEL, MODEL_DIRECTIVE, RUN, TRIPLE_QUEUE_NAME, installAtcGuards, assertNoRealDb,
  loginAsAtc, atcDb, atcDoc, atcDocs, defaultDb, waitFor, pickOptions, popupFrom, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const tripleFor = async (pid: string) => (await atcDb().collection('triple atc').where('profileid', '==', pid).get()).docs;
const pos = (page: Page, a: number) => page.locator(`[data-testid="tra-pos"][data-pos="${a}"]`);
const treAdj = (page: Page, a: number, i: number) => page.locator(`[data-testid="tre-adj"][data-pos="${a}"][data-adj="${i}"]`);
const assignment = async (id: string) => (await defaultDb().collection('big participants assignments').doc(id).get()).data();
async function newVersionOf(oldId: string) {
  return waitFor(async () => (await atcDb().collection('triple atc').get()).docs.find((d) => d.data().editedfrom?.id === oldId) || null, `new version of ${oldId}`);
}

test.describe('ATC — Triple ATC (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'triple atc: no fatal console errors');
  });

  // ---- Add ------------------------------------------------------------------------------------------------
  test('TRA-01 prescribing a Triple ATC writes three positions, their adjustments and procedures', async ({ page }) => {
    expect(await tripleFor(PF.tra), 'precondition: none yet').toHaveLength(0);
    await loginAsAtc(page, 'admin');
    await page.goto('/addtripleATC');
    await pickOptions(page, page.getByTestId('tra-participant'), [NAME.tra], false);
    await pickOptions(page, page.getByTestId('tra-author'), [NAME.admin]);
    await pickOptions(page, page.getByTestId('tra-queue'), [TRIPLE_QUEUE_NAME], false);
    await pickOptions(page, page.getByTestId('tra-product'), [MODEL.alpha], false);
    await expect(page.getByTestId('tra-directive')).toHaveText(MODEL_DIRECTIVE.alpha);
    for (let a = 0; a < 3; a++) {
      await pos(page, a).getByTestId('tra-pos-text').fill(`TRA position ${a + 1} ${RUN}`);
      await pos(page, a).getByTestId('tra-adj-text').first().fill(`TRA adjustment ${a + 1} ${RUN}`);
      await pickOptions(page, pos(page, a).getByTestId('tra-proc-name').first(), [a === 1 ? PROC_NAME.two : PROC_NAME.one], false);
    }
    await pos(page, 0).getByTestId('tra-proc-mandatory').first().locator('label').click();
    await page.getByTestId('tra-submit').click();
    await expect.poll(() => guard.dialogs.some((m) => /Triple ATC submitted successfully/.test(m)), { timeout: 45_000 }).toBe(true);

    const [t] = await waitFor(async () => { const d = await tripleFor(PF.tra); return d.length ? d : null; }, 'triple atc written');
    expect(t.data()).toMatchObject({ status: 'atc given', tripleatc: true, product: MODEL.alpha, directive: MODEL_DIRECTIVE.alpha });
    expect(t.data().perceptualposition).toEqual([1, 2, 3].map((n) => `TRA position ${n} ${RUN}`));
    const corr = await atcDocs(`${t.ref.path}/corrections`);
    expect(corr.map((c) => c.data.perceptualposition).sort()).toEqual([1, 2, 3].map((n) => `TRA position ${n} ${RUN}`).sort());
    const first = corr.find((c) => c.data.name === `TRA adjustment 1 ${RUN}`);
    const [p] = await atcDocs(`${first.path}/procedures`);
    expect(p.data.name.id).toBe(PROC.one);
    expect(p.data.mandatory).toBe(true);
  });

  test('TRA-02 submitting an incomplete Triple ATC is refused and nothing is written', async ({ page }) => {
    const before = (await atcDb().collection('triple atc').get()).size;
    await loginAsAtc(page, 'admin');
    await page.goto('/addtripleATC');
    await expect(page.getByTestId('tra-participant')).toBeVisible({ timeout: 45_000 });
    await page.getByTestId('tra-submit').click();
    await expect.poll(() => guard.dialogs.some((m) => /^alert: (Choose the author names|Select a Valid Profile Name|Select Event|Select a Product)/.test(m)),
      { timeout: 15_000 }).toBe(true);
    expect((await atcDb().collection('triple atc').get()).size).toBe(before);
  });

  test('TRA-03 a saved Triple ATC draft is offered and restored', async ({ page }) => {
    await loginAsAtc(page, 'dev');   // drafts are listed for developer / transcriber / the participant
    await page.goto('/addtripleATC');
    await pickOptions(page, page.getByTestId('tra-participant'), [NAME.tra2], false);
    await page.locator('[data-testid^="atco-draft-select-"]').first().click({ timeout: 30_000 });
    await expect(pos(page, 0).getByTestId('tra-pos-text')).toHaveValue(`TRA2 draft position 1 ${RUN}`, { timeout: 20_000 });
  });

  // ---- View -----------------------------------------------------------------------------------------------
  test('TRV-01 the list shows the Triple ATC; the participant filter opens its detail', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto('/viewtripleATC');
    await expect(page.locator(`[data-testid="trv-summary"][data-atc="${ATC2.TV1}"]`)).toBeVisible({ timeout: 45_000 });
    await pickOptions(page, page.getByTestId('trv-filter-participant'), [NAME.trv], false);
    const c = page.locator(`[data-testid="trv-card"][data-atc="${ATC2.TV1}"]`);
    await expect(c).toBeVisible({ timeout: 30_000 });
    await expect(c.getByTestId('trv-status')).toHaveText('atc given');
  });

  test('TRV-02 Edit ATC opens /edittripleATC/<id>', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto('/viewtripleATC');
    await pickOptions(page, page.getByTestId('trv-filter-participant'), [NAME.trv], false);
    const c = page.locator(`[data-testid="trv-card"][data-atc="${ATC2.TV1}"]`);
    const popup = await popupFrom(page, () => c.getByTestId('trv-edit').click());
    expect(new URL(popup.url()).pathname).toBe(`/edittripleATC/${ATC2.TV1}`);
    await popup.close();
  });

  test('TRV-03 the Perceptual Position link opens the preview of that ATC (bug #4 fixed)', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto('/viewtripleATC');
    await pickOptions(page, page.getByTestId('trv-filter-participant'), [NAME.trv], false);
    const c = page.locator(`[data-testid="trv-card"][data-atc="${ATC2.TV1}"]`);
    const popup = await popupFrom(page, () => c.getByTestId('trv-pos-link').first().click());
    expect(new URL(popup.url()).searchParams.get('atcdocid')).toBe(ATC2.TV1);
    await expect(popup.getByTestId('trp-pos')).toHaveCount(3, { timeout: 45_000 });
    await popup.close();
  });

  // ---- Preview --------------------------------------------------------------------------------------------
  test('TRP-01 the preview renders all three positions, adjustments and procedures', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto(`/previewtripleATC?atcdocid=${ATC2.TP1}&participantassignmentid=${PA.trpValidate}`);
    await expect(page.getByTestId('trp-pos')).toHaveCount(3, { timeout: 45_000 });
    await expect(page.getByTestId('trp-adj').first()).toContainText(`${ATC2.TP1} adjustment 1 ${RUN}`);
    await expect(page.getByTestId('trp-proc').first()).toContainText(PROC_NAME.one);
  });

  test('TRP-02 ATC Validated closes the assignment and validates the Triple ATC', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto(`/previewtripleATC?atcdocid=${ATC2.TP1}&participantassignmentid=${PA.trpValidate}`);
    await expect(page.getByTestId('trp-pos')).toHaveCount(3, { timeout: 45_000 });
    await page.getByTestId('trp-notes').fill(`TRP-02 notes ${RUN}`);
    await page.getByTestId('trp-validate').click();
    const a = await waitFor(async () => { const d = await assignment(PA.trpValidate); return d?.status === 'completed' ? d : null; }, 'assignment completed');
    expect(a.summary).toBe(`TRP-02 notes ${RUN}`);
    await waitFor(async () => (await atcDoc(`triple atc/${ATC2.TP1}`))?.status === 'validated', 'triple validated');
  });

  test('TRP-03 Mark for Rework moves the assignment to rework with a log entry', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto(`/previewtripleATC?atcdocid=${ATC2.TP2}&participantassignmentid=${PA.trpRework}`);
    await expect(page.getByTestId('trp-pos')).toHaveCount(3, { timeout: 45_000 });
    await page.getByTestId('trp-notes').fill(`TRP-03 rework ${RUN}`);
    await page.getByTestId('trp-rework').click();
    const a = await waitFor(async () => { const d = await assignment(PA.trpRework); return d?.status === 'rework' ? d : null; }, 'assignment rework');
    expect(a.activitylog.at(-1).notes).toBe(`TRP-03 rework ${RUN}`);
  });

  // ---- Edit -----------------------------------------------------------------------------------------------
  test('TRE-01 edit adjustment text, delete an adjustment, remove a procedure → a new version; old one retired', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto(`/edittripleATC/${ATC2.TE1}`);
    await expect(treAdj(page, 0, 0)).toBeVisible({ timeout: 45_000 });
    await treAdj(page, 0, 0).getByTestId('tre-adj-edit').click();
    await page.getByTestId('dbu-textarea').fill(`TRE-01 edited ${RUN}`);
    await page.getByTestId('dbu-submit').click();
    await expect(treAdj(page, 0, 0).getByTestId('tre-adj-text')).toHaveText(`TRE-01 edited ${RUN}`);
    await treAdj(page, 1, 0).getByTestId('tre-adj-delete').click();
    await treAdj(page, 2, 0).getByTestId('tre-proc-toggle').first().click();
    await page.getByTestId('tre-submit').click();
    await expect.poll(() => guard.dialogs.some((m) => /Updated Successfully/.test(m)), { timeout: 45_000 }).toBe(true);

    const nv = await newVersionOf(ATC2.TE1);
    const old = await atcDoc(`triple atc/${ATC2.TE1}`);
    expect(old).toMatchObject({ status: 'upgraded', isdelete: true });
    expect(old.upgradedto.id).toBe(nv.id);
    const corr = await atcDocs(`triple atc/${nv.id}/corrections`);
    expect(corr.some((c) => c.data.name === `TRE-01 edited ${RUN}` && c.data.isdelete === false), 'edited text saved').toBe(true);
    expect(corr.find((c) => c.data.name === `${ATC2.TE1} adjustment 2 ${RUN}`)?.data.isdelete, 'deleted adjustment').toBe(true);
    const third = corr.find((c) => c.data.name === `${ATC2.TE1} adjustment 3 ${RUN}`);
    const procs = await atcDocs(`${third.path}/procedures`);
    expect(procs.some((p) => p.data.isdelete === true), 'the removed procedure is marked deleted').toBe(true);
  });

  test('TRE-02 the directive edit is saved on the new version', async ({ page }) => {
    await loginAsAtc(page, 'admin');
    await page.goto(`/edittripleATC/${ATC2.TE2}`);
    await expect(page.getByTestId('tre-directive')).toBeVisible({ timeout: 45_000 });
    await page.getByTestId('tre-directive-btn').click();
    await page.getByTestId('dbu-textarea').fill(`TRE-02 directive ${RUN}`);
    await page.getByTestId('dbu-submit').click();
    await expect(page.getByTestId('tre-directive')).toHaveText(`TRE-02 directive ${RUN}`);
    await page.getByTestId('tre-submit').click();
    await expect.poll(() => guard.dialogs.some((m) => /Updated Successfully/.test(m)), { timeout: 45_000 }).toBe(true);
    const nv = await newVersionOf(ATC2.TE2);
    expect(nv.data().directive).toBe(`TRE-02 directive ${RUN}`);
  });

  test('TRE-03 a mentor picks an adjustment and creates the Final ATC (atc_alpha)', async ({ page }) => {
    await loginAsAtc(page, 'mentor');
    await page.goto(`/edittripleATC/${ATC2.TE3}`);
    await expect(treAdj(page, 0, 0)).toBeVisible({ timeout: 45_000 });
    await treAdj(page, 0, 0).getByTestId('tre-pick').locator('label').click();
    await page.getByTestId('tre-pick-final').click();
    await page.getByTestId('tre-create-final').click();
    const fin = await waitFor(async () => (await atcDb().collection('atc_alpha').get()).docs
      .find((d) => d.data().tripleatcfrom?.id === ATC2.TE3) || null, 'final ATC created');
    expect(fin.data()).toMatchObject({ status: 'validated', isdelete: false, profileid: PF.tre });
    const corr = await atcDocs(`atc_alpha/${fin.id}/corrections`);
    expect(corr.map((c) => c.data.name)).toEqual([`${ATC2.TE3} adjustment 1 ${RUN}`]);
    await waitFor(async () => (await atcDoc(`triple atc/${ATC2.TE3}`))?.status === 'validated', 'triple validated');
  });
});
