// pick-for-mentoring.spec.ts — /pickformentoring (PFM-01..05), EMULATOR ONLY. Phase 2, plan 2026-10-17.
//
// PFM-03 covers bug #5 (fixed 2026-10-17): the Yet-to-Validate tab checked `atc.mentoring` (never set) instead of
// `mentoringid`, so it never showed "Picked" and a re-click created a duplicate mentoring doc.
import { test, expect, Page } from '@playwright/test';
import {
  ATC2, PF, PFM_M, NAME, RUN, installAtcGuards, assertNoRealDb, loginAsAtc, defaultDb, atcDoc, waitFor, pickOptions, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const tab = (page: Page, name: RegExp) => page.getByRole('tab', { name });
const alphaPanel = (page: Page, id: string) => page.locator(`[data-testid="pfm-panel-alpha"][data-atc="${id}"]`);
const validatePanel = (page: Page, id: string) => page.locator(`[data-testid="pfm-panel-validate"][data-atc="${id}"]`);
const mentorPanel = (page: Page, id: string) => page.locator(`[data-testid="pfm-panel-mentor"][data-atc="${id}"]`);
const picksFor = async (atcid: string) => (await defaultDb().collection('pick_for_mentoring').where('atcid', '==', atcid).get()).docs;
// Every tab pages 10 ATCs newest-first and the PFM ATCs are dated 40+ days ago, so filter to the PFM participant
// first (the screen's own Filter Client — it narrows all three tabs) to bring them onto page 1.
async function open(page: Page) {
  await loginAsAtc(page, 'admin');
  await page.goto('/pickformentoring');
  await expect(tab(page, /^Validated ATC/)).toBeVisible({ timeout: 45_000 });
  await pickOptions(page, page.getByRole('combobox', { name: 'Filter Client' }), [NAME.pfm], false);
}

test.describe('ATC — Pick for Mentoring (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'pick for mentoring: no fatal console errors');
  });

  test('PFM-01 the three tabs list the seeded ATCs and the existing mentoring note', async ({ page }) => {
    await open(page);
    await expect(alphaPanel(page, ATC2.PF_A)).toBeVisible({ timeout: 30_000 });
    await tab(page, /Yet to Validated/).click();
    await expect(validatePanel(page, ATC2.PF_V)).toBeVisible({ timeout: 20_000 });
    await tab(page, /Picked For Mentoring/).click();
    await expect(mentorPanel(page, ATC2.PF_M).getByTestId('pfm-mentor-note')).toContainText(`Seed mentoring note ${RUN}`, { timeout: 20_000 });
  });

  test('PFM-02 Pick For Mentoring (validated ATC) creates the mentoring doc and links it', async ({ page }) => {
    await open(page);
    const p = alphaPanel(page, ATC2.PF_A);
    await p.getByTestId('pfm-pick').click();
    const [pick] = await waitFor(async () => { const d = await picksFor(ATC2.PF_A); return d.length ? d : null; }, 'pick doc');
    expect(pick.data()).toMatchObject({ profileid: PF.pfm, from: 'alpha', mentorperson: PF.admin });
    await waitFor(async () => (await atcDoc(`atc_alpha/${ATC2.PF_A}`))?.mentoringid === pick.id, 'mentoringid linked');
    await expect(p.getByTestId('pfm-picked')).toBeVisible({ timeout: 20_000 });
  });

  test('PFM-03 Yet to Validated: after picking it shows "Picked" — no second pick (bug #5 fixed)', async ({ page }) => {
    await open(page);
    await tab(page, /Yet to Validated/).click();
    const p = validatePanel(page, ATC2.PF_V);
    await p.getByTestId('pfm-pick').click();
    await expect(p.getByTestId('pfm-picked')).toBeVisible({ timeout: 20_000 });
    await expect(p.getByTestId('pfm-pick'), 'the Pick button is gone, so a duplicate cannot be created').toHaveCount(0);
    const picks = await waitFor(async () => { const d = await picksFor(ATC2.PF_V); return d.length ? d : null; }, 'pick doc');
    expect(picks).toHaveLength(1);
    expect((await atcDoc(`atc_to_validate/${ATC2.PF_V}`)).mentoringid).toBe(picks[0].id);
  });

  test('PFM-04 Add Note updates the mentoring note and keeps the old one as a revision', async ({ page }) => {
    await open(page);
    await tab(page, /Picked For Mentoring/).click();
    const p = mentorPanel(page, ATC2.PF_M);
    await p.click();
    await p.getByTestId('pfm-note-text').fill(`PFM-04 new note ${RUN}`);
    await p.getByTestId('pfm-add-note').click();
    const ref = defaultDb().collection('pick_for_mentoring').doc(PFM_M);
    await waitFor(async () => (await ref.get()).data()?.mentoringnote === `PFM-04 new note ${RUN}`, 'note updated');
    const revisions = (await ref.collection('revision').get()).docs.map((d) => d.data());
    expect(revisions.some((r) => r.mentoringnote === `Seed mentoring note ${RUN}`), 'the previous note is kept as a revision').toBe(true);
  });

  test('PFM-05 Validate ATC marks it validated with the reviewer as validator', async ({ page }) => {
    await open(page);
    await tab(page, /Yet to Validated/).click();
    const p = validatePanel(page, ATC2.PF_V2);
    await p.click();
    // Edit / Validate show only while the ATC is still 'atc given' (template :111) — check Edit before validating
    await expect(p.getByTestId('pfm-edit')).toBeVisible({ timeout: 30_000 });
    await p.getByTestId('pfm-validate').click();
    const d = await waitFor(async () => { const x = await atcDoc(`atc_to_validate/${ATC2.PF_V2}`); return x?.status === 'validated' ? x : null; }, 'validated');
    expect((d.validator || []).map((r: any) => r.id)).toContain(PF.admin);
    // the tab lists status 'atc given' only, so a validated ATC leaves it
    await expect(p, 'validated → no longer Yet to Validated').toHaveCount(0, { timeout: 20_000 });
  });
});
