// prescribe-atc.spec.ts — /prescribeATC (PATC-01..09), EMULATOR ONLY.
//
// Each case uses its OWN participant so one case's leftover draft can never open another case's draft
// picker. Assertions read back what the APP wrote to the emulator (firestore-atc / Storage) and compare it to
// the input the test typed — never a value the test wrote itself.
import { test, expect, Page, Browser } from '@playwright/test';
import {
  ATC, PF, NAME, ACT, PROC, PROC_NAME, MODEL, MODEL_DIRECTIVE, RUN, RECOMMEND_NAME, installAtcGuards, assertNoRealDb, loginAsAtc,
  atcDb, atcDocs, waitFor, pickOptions, selectText, tid, wavBuffer, pngBuffer, storageBucket, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const DRAFT_SAVED = /Draft saved\./;

async function openPrescribe(page: Page, who: 'admin' | 'agent1' = 'admin') {
  await loginAsAtc(page, who);
  await page.goto('/prescribeATC');
}
async function selectParticipant(page: Page, pfKey: keyof typeof NAME) {
  const sel = page.getByTestId('patc-participant');
  await expect(sel).toHaveAttribute('aria-disabled', 'false', { timeout: 45_000 });
  await pickOptions(page, sel, [NAME[pfKey]], false);
  await expect(page.getByTestId('patc-product')).toBeVisible({ timeout: 30_000 });
}
async function selectProduct(page: Page, model = MODEL.alpha) {
  await pickOptions(page, page.getByTestId('patc-product'), [model], false);
}
async function selectAuthor(page: Page) {
  await pickOptions(page, page.locator(tid(`patc-author-${ACT.author}`)), [NAME.admin]);
}
const adj = (page: Page, i: number) => page.locator(tid(`patc-adj-${i}`));
const proc = (page: Page, i: number, j: number) => adj(page, i).locator(tid(`patc-proc-${j}`));
async function fillAdjustment(page: Page, i: number, text: string, procs: string[]) {
  await adj(page, i).getByTestId('patc-adj-text').fill(text);
  await adj(page, i).getByTestId('patc-adj-text').blur();
  await pickOptions(page, adj(page, i).getByTestId('patc-adj-awareness'), [/^\s*Aware\s*$/], false);
  await adj(page, i).getByTestId('patc-adj-years').fill('3');
  await adj(page, i).getByTestId('patc-adj-years').blur();
  for (let j = 0; j < procs.length; j++) {
    if (j > 0) await proc(page, i, j - 1).getByTestId('patc-proc-add').click();
    await pickOptions(page, proc(page, i, j).getByTestId('patc-proc-name'), [procs[j]], false);
  }
}
// HOOK RULE (hub readiness check, scripts/readiness/lib.cjs TESTID_REF) — applies to every atc spec:
//   • STATIC hooks (a plain data-testid attribute in the app) → the literal getByTestId form, so the element
//     check sees them as referenced;
//   • BOUND hooks ([attr.data-testid] built from an index or key) → .locator(tid(...)), NEVER the literal
//     getByTestId form: the app holds no literal copy of the indexed id, so the drift check would report it as
//     "gone from the app". (Don't write a literal example of either form in a comment — the check reads comments.)
async function fillNotes(page: Page, tag: string) {
  await page.getByTestId('patc-points').fill(`points ${tag}`);
  await page.getByTestId('patc-points').blur();
  await page.getByTestId('patc-casenotes').fill(`notes ${tag}`);
  await page.getByTestId('patc-casenotes').blur();
}
async function waitDraftSaved(page: Page) {
  await expect(page.getByTestId('patc-draft-status')).toHaveText(DRAFT_SAVED, { timeout: 30_000 });
}
async function submitAndConfirm(page: Page) {
  await waitDraftSaved(page);
  await page.getByTestId('patc-submit').click();
  await page.getByTestId('aael-submit').click();
  await expect(page.locator('mat-snack-bar-container').filter({ hasText: 'The ATC has been submitted successfully' }))
    .toBeVisible({ timeout: 45_000 });
}
/** The ATCs the app has written for a participant (seeded ones excluded by id). */
async function appWrittenFor(coll: string, pid: string) {
  const seeded = new Set(Object.values(ATC));
  return (await atcDb().collection(coll).where('profileid', '==', pid).get()).docs.filter((d) => !seeded.has(d.id));
}
async function drafts(pid: string) {
  return (await atcDb().collection('temporary_ATC').where('profileid', '==', pid).get()).docs;
}

test.describe('ATC — Prescribe ATC (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'prescribe atc: no fatal console errors');
  });

  test('PATC-01 admin can open the screen; a change-agent-only user is denied and sent home', async ({ page, browser }) => {
    await openPrescribe(page, 'admin');
    await expect(page.getByTestId('patc-participant')).toHaveAttribute('aria-disabled', 'false', { timeout: 45_000 });

    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const p2 = await ctx.newPage();
    const g2 = await installAtcGuards(p2);
    await openPrescribe(p2, 'agent1');
    await expect.poll(() => g2.dialogs.some((m) => /Access for this screen is denied/.test(m)), { timeout: 30_000 }).toBe(true);
    await expect(p2).not.toHaveURL(/prescribeATC/, { timeout: 15_000 });
    assertNoRealDb(g2);
    await ctx.close();
  });

  test('PATC-02 happy path writes the ATC, its correction + procedure, notes, and retires the draft', async ({ page }) => {
    expect(await appWrittenFor('atc_alpha', PF.p0), 'precondition: no app-written ATC for p0').toHaveLength(0);
    await openPrescribe(page);
    await selectParticipant(page, 'p0');
    await selectProduct(page);
    await expect(page.getByTestId('patc-directive-text'), 'directive auto-filled from the atc model').toHaveText(MODEL_DIRECTIVE.alpha);
    await selectAuthor(page);
    await fillAdjustment(page, 0, `PATC-02 adjustment ${RUN}`, [PROC_NAME.one]);
    await fillNotes(page, 'PATC-02');
    await submitAndConfirm(page);

    const [atc] = await waitFor(async () => { const d = await appWrittenFor('atc_alpha', PF.p0); return d.length ? d : null; }, 'ATC for p0');
    const a = atc.data();
    expect(a.type).toBe('online');
    expect(a.product).toBe(MODEL.alpha);
    expect(a.directive).toBe(MODEL_DIRECTIVE.alpha);
    expect((a.author || []).map((r: any) => r.id)).toEqual([PF.admin]);
    const corr = await atcDocs(`${atc.ref.path}/corrections`);
    expect(corr.map((c) => c.id)).toEqual(['adjustment 01']);
    expect(corr[0].data).toMatchObject({ name: `PATC-02 adjustment ${RUN}`, awareness: 'aware', awarenessdetail: 'Aware', potentialyears: 3 });
    const procs = await atcDocs(`${atc.ref.path}/corrections/adjustment 01/procedures`);
    expect(procs.map((p) => p.id)).toEqual(['adjustment 01 - 1']);
    expect(procs[0].data.name.id).toBe(PROC.one);
    const notes = (await atcDb().doc(`atc_notes/${a.notesid}`).get()).data();
    expect(notes).toMatchObject({ consultationpoint: 'points PATC-02', notes: 'notes PATC-02' });
    const d = await drafts(PF.p0);
    expect(d.length, 'a draft was created by autosave').toBeGreaterThan(0);
    expect(d.every((x) => x.data().delete === true), 'PATC-02: the draft is retired on submit').toBe(true);
  });

  test('PATC-03 required fields block submit and nothing is written', async ({ page }) => {
    const before = (await atcDb().collection('atc_alpha').where('profileid', '==', PF.p7).get()).size;
    await openPrescribe(page);
    await selectParticipant(page, 'p7');
    await selectProduct(page);
    await waitDraftSaved(page);
    const snack = page.locator('mat-snack-bar-container').last();

    await page.getByTestId('patc-submit').click();
    await expect(snack).toContainText('Choose the author names');
    await selectAuthor(page);
    await page.getByTestId('patc-submit').click();
    await expect(snack).toContainText('Consultation points required');
    await fillNotes(page, 'PATC-03');
    await page.getByTestId('patc-submit').click();
    await expect(snack).toContainText('Transcription first field cannot be empty');
    await expect(page.getByTestId('aael-submit')).toHaveCount(0);
    expect((await atcDb().collection('atc_alpha').where('profileid', '==', PF.p7).get()).size).toBe(before);
    expect((await atcDb().collection('atc_to_validate').where('profileid', '==', PF.p7).get()).size).toBe(0);
  });

  test('PATC-04 validation required → written to atc_to_validate with status "atc given" and the validator', async ({ page }) => {
    await openPrescribe(page);
    await selectParticipant(page, 'p4');
    await selectProduct(page);
    await selectAuthor(page);
    await fillAdjustment(page, 0, `PATC-04 adjustment ${RUN}`, [PROC_NAME.two]);
    await fillNotes(page, 'PATC-04');
    await page.getByTestId('patc-visible-checkbox').locator('label').click();
    await pickOptions(page, page.getByTestId('patc-validator'), [NAME.mentor]);
    await submitAndConfirm(page);

    const [atc] = await waitFor(async () => { const d = await appWrittenFor('atc_to_validate', PF.p4); return d.length ? d : null; }, 'to-validate ATC for p4');
    expect(atc.data().status).toBe('atc given');
    expect((atc.data().validator || []).map((r: any) => r.id)).toEqual([PF.mentor]);
    expect(await appWrittenFor('atc_alpha', PF.p4), 'PATC-04: not also written to atc_alpha').toHaveLength(0);
  });

  test('PATC-05 draft resume: autosaved draft is offered on a fresh device and restores the fields', async ({ page, browser }) => {
    await openPrescribe(page);
    await selectParticipant(page, 'p2');
    await selectProduct(page);
    await adj(page, 0).getByTestId('patc-adj-text').fill(`PATC-05 draft text ${RUN}`);
    await adj(page, 0).getByTestId('patc-adj-text').blur();
    await waitDraftSaved(page);
    const saved = await waitFor(async () => {
      const d = (await drafts(PF.p2)).filter((x) => x.data().delete === false && x.data().transcript?.[0]?.adjustment === `PATC-05 draft text ${RUN}`);
      return d.length ? d : null;
    }, 'draft with the typed adjustment on the emulator');
    expect(saved).toHaveLength(1);

    // a FRESH browser context = a second device (empty IndexedDB) → the server draft is offered
    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const p2 = await ctx.newPage();
    const g2 = await installAtcGuards(p2);
    await openPrescribe(p2);
    const sel = p2.getByTestId('patc-participant');
    await expect(sel).toHaveAttribute('aria-disabled', 'false', { timeout: 45_000 });
    await pickOptions(p2, sel, [NAME.p2], false);
    await p2.locator(tid('atco-draft-select-0')).click({ timeout: 30_000 });
    await expect(p2.locator(tid('patc-adj-0')).getByTestId('patc-adj-text')).toHaveValue(`PATC-05 draft text ${RUN}`, { timeout: 30_000 });
    await expect(p2.getByTestId('patc-product')).toContainText(MODEL.alpha);
    assertNoRealDb(g2);
    await ctx.close();

    // a THIRD device declines the offered draft with Close → a fresh, empty ATC (the draft stays on the server)
    const ctx3 = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const p3 = await ctx3.newPage();
    const g3 = await installAtcGuards(p3);
    await openPrescribe(p3);
    const sel3 = p3.getByTestId('patc-participant');
    await expect(sel3).toHaveAttribute('aria-disabled', 'false', { timeout: 45_000 });
    await pickOptions(p3, sel3, [NAME.p2], false);
    // 2026-10-22: the dialog's way out when drafts are listed reads "Start fresh"; the fresh ATC then waits for
    // the product (the form below it stays hidden until participant AND product are chosen)
    await expect(p3.getByTestId('atco-close')).toContainText('Start fresh', { timeout: 30_000 });
    await p3.getByTestId('atco-close').click({ timeout: 30_000 });
    await expect(p3.getByTestId('patc-product'), 'Start fresh: the product is not chosen yet').toHaveAttribute('aria-disabled', 'false', { timeout: 30_000 });
    await expect(p3.locator(tid('patc-adj-0')), 'form hidden until a product is picked').toHaveCount(0);
    await pickOptions(p3, p3.getByTestId('patc-product'), [MODEL.alpha], false);
    await expect(p3.locator(tid('patc-adj-0')).getByTestId('patc-adj-text'), 'Start fresh gives an empty ATC').toHaveValue('', { timeout: 30_000 });
    expect((await drafts(PF.p2)).some((x) => x.data().delete === false && x.data().transcript?.[0]?.adjustment === `PATC-05 draft text ${RUN}`),
      'declining does not delete the existing draft').toBe(true);
    assertNoRealDb(g3);
    await ctx3.close();
  });

  test('PATC-06 bulk apply: disabled when empty, Cancel changes nothing, OK fills only that activity, new rows start empty', async ({ page }) => {
    await openPrescribe(page);
    await selectParticipant(page, 'p3');
    await selectProduct(page);
    await selectAuthor(page);
    await fillAdjustment(page, 0, `PATC-06 adj one ${RUN}`, [PROC_NAME.one, PROC_NAME.two]);
    await page.getByTestId('patc-adj-add').click();
    await fillAdjustment(page, 1, `PATC-06 adj two ${RUN}`, [PROC_NAME.one]);
    const cells = [[0, 0], [0, 1], [1, 0]];
    const caOf = (i: number, j: number) => proc(page, i, j).locator(tid(`patc-proc-assigned-${ACT.ca}`));
    const saOf = (i: number, j: number) => proc(page, i, j).locator(tid(`patc-proc-assigned-${ACT.sa}`));

    const apply = page.locator(tid(`patc-bulk-apply-${ACT.ca}`));
    await expect(apply, 'PATC-06: Apply disabled with nothing selected').toBeDisabled();
    await pickOptions(page, page.locator(tid(`patc-bulk-select-${ACT.ca}`)), [NAME.agent1]);
    await expect(apply).toBeEnabled();

    guard.confirmAnswer = false;                                   // Cancel
    await apply.click();
    await expect.poll(() => guard.dialogs.filter((m) => m.startsWith('confirm: Apply')).length).toBe(1);
    expect(guard.dialogs.at(-1)).toContain(`as Change Agent to all 3 procedures`);
    for (const [i, j] of cells) expect(await selectText(caOf(i, j)), `Cancel: proc ${i}.${j} unchanged`).toBe('');

    guard.confirmAnswer = true;                                    // OK
    await apply.click();
    for (const [i, j] of cells) {
      await expect.poll(() => selectText(caOf(i, j)), { message: `OK: proc ${i}.${j} got the agent` }).toBe(NAME.agent1);
      expect(await selectText(saOf(i, j)), `OK: proc ${i}.${j} other activity untouched`).toBe('');
    }
    // a procedure row added AFTER Apply starts empty until its changework is chosen (the inherit on choosing is
    // prescribe-atc-templates PTPL-04); remove it again so submit validation passes
    await proc(page, 1, 0).getByTestId('patc-proc-add').click();
    expect(await selectText(caOf(1, 1)), 'a new row starts empty until a changework is picked').toBe('');
    await proc(page, 1, 1).getByTestId('patc-proc-remove').click();
    await expect(proc(page, 1, 1)).toHaveCount(0);

    await fillNotes(page, 'PATC-06');
    await submitAndConfirm(page);
    const [atc] = await waitFor(async () => { const d = await appWrittenFor('atc_alpha', PF.p3); return d.length ? d : null; }, 'ATC for p3');
    for (const [adjId, n] of [['adjustment 01', 2], ['adjustment 02', 1]] as [string, number][]) {
      const procs = await atcDocs(`${atc.ref.path}/corrections/${adjId}/procedures`);
      expect(procs).toHaveLength(n);
      for (const p of procs) {
        expect(p.data.bigactivity, `${adjId}/${p.id}: only the Change Agent activity, set to agent1`).toEqual({ [ACT.ca]: [PF.agent1] });
        expect((p.data.assigned_to || []).map((r: any) => r.id)).toEqual([PF.agent1]);
      }
    }
  });

  test('PATC-07 media: audio + note image + ATC image upload to the STORAGE EMULATOR and land on the ATC', async ({ page }) => {
    await openPrescribe(page);
    await selectParticipant(page, 'p5');
    await selectProduct(page);
    await selectAuthor(page);
    await fillAdjustment(page, 0, `PATC-07 adjustment ${RUN}`, [PROC_NAME.one]);
    await fillNotes(page, 'PATC-07');
    await page.getByTestId('patc-audio-input').setInputFiles({ name: 'brief.wav', mimeType: 'audio/wav', buffer: wavBuffer() });
    await expect(page.getByTestId('patc-audio-item')).toHaveCount(1, { timeout: 15_000 });
    await page.getByTestId('patc-noteimg-input').setInputFiles({ name: `note-${RUN}.png`, mimeType: 'image/png', buffer: pngBuffer() });
    await page.getByTestId('patc-atcimg-input').setInputFiles({ name: `atc-${RUN}.png`, mimeType: 'image/png', buffer: pngBuffer() });
    // the media is uploaded by autosave; nudge one and wait for the URLs to be patched into the draft
    await page.getByTestId('patc-casenotes').focus();
    await page.getByTestId('patc-casenotes').blur();
    await waitFor(async () => {
      const d = (await drafts(PF.p5)).find((x) => x.data().delete === false);
      const v = d?.data();
      return v && (v.audioRecordings || []).length && (v.noteImageURLs || []).length && (v.atcImageURLs || []).length ? v : null;
    }, 'media URLs patched into the draft', 60_000);
    await submitAndConfirm(page);

    const [atc] = await waitFor(async () => { const d = await appWrittenFor('atc_alpha', PF.p5); return d.length ? d : null; }, 'ATC for p5');
    const notes = (await atcDb().doc(`atc_notes/${atc.data().notesid}`).get()).data();
    const emu = /^http:\/\/(localhost|127\.0\.0\.1):9199\//;
    expect(notes.changeworkbrief).toHaveLength(1);
    expect(notes.changeworkbrief[0], 'audio served by the Storage EMULATOR').toMatch(emu);
    expect(notes.imagenotes).toHaveLength(1);
    expect(notes.imagenotes[0]).toMatch(emu);
    expect(atc.data().prescription_image).toHaveLength(1);
    expect(atc.data().prescription_image[0]).toMatch(emu);
    const [files] = await storageBucket().getFiles({ prefix: `ATC_Audio_Notes/${PF.admin}/` });
    expect(files.length, 'audio object exists in the Storage emulator').toBeGreaterThan(0);
  });

  test('PATC-08 two-device conflict: dialog appears, "keep this device" wins, the other version is archived', async ({ page }) => {
    await openPrescribe(page);
    await selectParticipant(page, 'p6');
    await selectProduct(page);
    await page.getByTestId('patc-casenotes').fill('mine v1');
    await page.getByTestId('patc-casenotes').blur();
    await waitDraftSaved(page);
    const draft = await waitFor(async () => (await drafts(PF.p6)).find((x) => x.data().delete === false && x.data().notes === 'mine v1') || null, 'p6 draft saved');
    const rev = draft.data().rev;

    // "another device" edits the same draft on the emulator and advances rev
    await draft.ref.update({ rev: rev + 1, notes: 'theirs from another device' });
    // this device edits again → autosave sees remote rev > base rev with local dirty → conflict dialog
    await page.getByTestId('patc-casenotes').fill('mine v2');
    await page.getByTestId('patc-casenotes').blur();
    await page.locator(tid('dcfl-keep-mine')).click({ timeout: 30_000 });

    const winner = await waitFor(async () => { const d = (await draft.ref.get()).data(); return d.notes === 'mine v2' && d.rev > rev + 1 ? d : null; }, 'this device wins on the emulator');
    expect(winner.notes).toBe('mine v2');
    const archived = await atcDocs(`${draft.ref.path}/conflicts`);
    expect(archived.length, 'the other device version is archived, not lost').toBe(1);
    expect(archived[0].data).toMatchObject({ notes: 'theirs from another device', reason: 'two-device-conflict' });
  });

  test('PATC-09 edited directive, Recommended To, Mandatory + Completed and summary are saved; Go Back submits nothing', async ({ page }) => {
    await openPrescribe(page);
    await selectParticipant(page, 'p8');
    await selectProduct(page);
    await selectAuthor(page);

    // Edit Directive → UpdateDialog
    await page.getByTestId('patc-directive-btn').click();
    await page.getByTestId('dbu-textarea').fill(`PATC-09 directive ${RUN}`);
    await page.getByTestId('dbu-submit').click();
    await expect(page.getByTestId('patc-directive-text')).toHaveText(`PATC-09 directive ${RUN}`);

    await fillAdjustment(page, 0, `PATC-09 adjustment ${RUN}`, [PROC_NAME.one]);
    await pickOptions(page, proc(page, 0, 0).getByTestId('patc-proc-recommended'), [RECOMMEND_NAME], false);
    await proc(page, 0, 0).getByTestId('patc-proc-mandatory').locator('label').click();
    await proc(page, 0, 0).getByTestId('patc-proc-completed').locator('label').click();
    // a Mandatory procedure needs a Changework Brief for an admin prescriber
    await page.getByTestId('patc-audio-input').setInputFiles({ name: 'patc09.wav', mimeType: 'audio/wav', buffer: wavBuffer() });
    await page.getByTestId('patc-summary').fill(`summary PATC-09 ${RUN}`);
    await page.getByTestId('patc-summary').blur();
    await fillNotes(page, 'PATC-09');
    await waitFor(async () => {
      const d = (await drafts(PF.p8)).find((x) => x.data().delete === false);
      return (d?.data().audioRecordings || []).length ? d : null;
    }, 'audio patched into the p8 draft', 60_000);
    await waitDraftSaved(page);

    // Go Back on the confirmation → nothing is submitted
    await page.getByTestId('patc-submit').click();
    await expect(page.getByTestId('aael-message')).toContainText(NAME.p8);
    await page.getByTestId('aael-back').click();
    await expect(page.getByTestId('aael-message')).toHaveCount(0);
    await page.waitForTimeout(1500);
    expect(await appWrittenFor('atc_alpha', PF.p8), 'Go Back wrote nothing').toHaveLength(0);

    await submitAndConfirm(page);
    const [atc] = await waitFor(async () => { const d = await appWrittenFor('atc_alpha', PF.p8); return d.length ? d : null; }, 'ATC for p8');
    expect(atc.data().directive).toBe(`PATC-09 directive ${RUN}`);
    const [p] = await atcDocs(`${atc.ref.path}/corrections/adjustment 01/procedures`);
    expect(p.data.recommended_to?.id).toBe(`${RUN}_rec_1`);
    expect(p.data).toMatchObject({ mandatory: true, status: 'completed' });
    const notes = (await atcDb().doc(`atc_notes/${atc.data().notesid}`).get()).data();
    expect(notes).toMatchObject({ consultationsummary: `summary PATC-09 ${RUN}`, consultationpoint: 'points PATC-09' });
    expect(notes.changeworkbrief).toHaveLength(1);
  });
});
