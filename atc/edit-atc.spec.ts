// edit-atc.spec.ts — /editATC/:atc/:type (EATC-01..08), EMULATOR ONLY.
//
// Opened by direct URL (every real entry point uses window.open into a new tab — VATC-04 covers that link).
// Each case edits its OWN seeded ATC (E1..E6, EV1) because a save UPGRADES the ATC: the old doc is retired
// (status 'upgraded', isdelete, upgradedto) and a NEW version doc is written with editedfrom → old. Assertions
// read that new version back from the emulator and compare it with what the test typed.
import { test, expect, Page } from '@playwright/test';
import {
  ATC, PF, NAME, ACT, PROC, PROC_NAME, MODEL, RUN, installAtcGuards, assertNoRealDb, loginAsAtc,
  atcDb, atcDoc, atcDocs, waitFor, pickOptions, selectText, tid, wavBuffer, pngBuffer, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

async function openEdit(page: Page, id: string, type: 'alpha' | 'validation' = 'alpha') {
  await loginAsAtc(page, 'admin');
  await page.goto(`/editATC/${id}/${type}`);
  await expect(page.locator(tid('eatc-exadj-0'))).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(tid('eatc-loading'))).toHaveCount(0, { timeout: 30_000 });
}
const exadj = (page: Page, i: number) => page.locator(tid(`eatc-exadj-${i}`));
const newadj = (page: Page, i: number) => page.locator(tid(`eatc-newadj-${i}`));
async function setYears(page: Page, i: number, v: string) {
  const f = exadj(page, i).locator(tid('eatc-exadj-years'));
  await f.fill(v);
  await f.blur();
}
async function addNewAdjustment(page: Page, i: number, text: string, procs: string[]) {
  await page.locator(tid('eatc-newadj-add')).click();
  const a = newadj(page, i);
  await a.locator(tid('eatc-newadj-text')).fill(text);
  await a.locator(tid('eatc-newadj-text')).blur();
  await pickOptions(page, a.locator(tid('eatc-newadj-awareness')), [/^\s*Aware\s*$/], false);
  await a.locator(tid('eatc-newadj-years')).fill('4');
  for (let j = 0; j < procs.length; j++) {
    if (j > 0) await a.locator(tid(`eatc-newproc-${j - 1}`)).locator(tid('eatc-newproc-add')).click();
    await pickOptions(page, a.locator(tid(`eatc-newproc-${j}`)).locator(tid('eatc-proc-name')), [procs[j]], false);
  }
}
async function submitEdit(page: Page, guard: AtcGuard) {
  await page.locator(tid('eatc-submit')).click();
  await page.locator(tid('pabs-submit')).click({ timeout: 30_000 });
  await expect.poll(() => guard.dialogs.some((m) => /Updated Successfully/.test(m)), { message: 'save confirmed by the app', timeout: 60_000 }).toBe(true);
}
/** The new version the app wrote for an edited ATC (found by editedfrom → old, never by an id we chose). */
async function newVersionOf(coll: string, oldId: string) {
  return waitFor(async () => {
    const s = await atcDb().collection(coll).get();
    return s.docs.find((d) => d.data().editedfrom?.id === oldId) || null;
  }, `new version of ${oldId}`);
}
async function expectRetired(coll: string, oldId: string, newId: string) {
  const old = await atcDoc(`${coll}/${oldId}`);
  expect(old.status, 'old version marked upgraded').toBe('upgraded');
  expect(old.isdelete).toBe(true);
  expect(old.upgradedto.id).toBe(newId);
  expect((await atcDoc(`temporary_edit_ATC/${oldId}`))?.delete, 'edit draft retired').toBe(true);
}

test.describe('ATC — Edit ATC (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'edit atc: no fatal console errors');
  });

  test('EATC-01 the seeded ATC loads: participant, product, directive, adjustment and awareness', async ({ page }) => {
    await openEdit(page, ATC.E1);
    await expect(page.locator(tid('eatc-participant'))).toHaveText(NAME.p2);
    await expect(page.locator(tid('eatc-product'))).toHaveText(MODEL.alpha);
    await expect(page.locator(tid('eatc-directive-text'))).toHaveText(`Seed directive ${MODEL.alpha}`);
    await expect(exadj(page, 0)).toContainText(`${ATC.E1} adjustment ${RUN}`);
    await expect.poll(() => selectText(exadj(page, 0).locator(tid('eatc-exadj-awareness')))).toBe('Aware');
    await expect(exadj(page, 0).locator(tid('eatc-exadj-years'))).toHaveValue('2');
  });

  test('EATC-02 editing an existing adjustment upgrades the ATC to a new version with the edit', async ({ page }) => {
    await openEdit(page, ATC.E1);
    await pickOptions(page, exadj(page, 0).locator(tid('eatc-exadj-awareness')), ['Unaware'], false);
    await setYears(page, 0, '5');
    await submitEdit(page, guard);

    const nv = await newVersionOf('atc_alpha', ATC.E1);
    await expectRetired('atc_alpha', ATC.E1, nv.id);
    const corr = await atcDocs(`atc_alpha/${nv.id}/corrections`);
    expect(corr.map((c) => c.id)).toEqual(['adjustment 01']);
    expect(corr[0].data).toMatchObject({ name: `${ATC.E1} adjustment ${RUN}`, awareness: 'unaware', awarenessdetail: 'Unaware', potentialyears: 5 });
    const procs = await atcDocs(`atc_alpha/${nv.id}/corrections/adjustment 01/procedures`);
    expect(procs).toHaveLength(1);
    expect(procs[0].data.name.id).toBe(PROC.one);
  });

  test('EATC-03 a new adjustment + procedure is written to the new version, flagged newlyadded', async ({ page }) => {
    await openEdit(page, ATC.E2);
    await addNewAdjustment(page, 0, `EATC-03 new adjustment ${RUN}`, [PROC_NAME.two]);
    await submitEdit(page, guard);

    const nv = await newVersionOf('atc_alpha', ATC.E2);
    await expectRetired('atc_alpha', ATC.E2, nv.id);
    const corr = await atcDocs(`atc_alpha/${nv.id}/corrections`);
    expect(corr.map((c) => c.id).sort()).toEqual(['adjustment 01', 'adjustment 02']);
    const added = corr.find((c) => c.data.name === `EATC-03 new adjustment ${RUN}`);
    expect(added, 'the typed adjustment exists').toBeTruthy();
    expect(added.data).toMatchObject({ newlyadded: true, awareness: 'aware', potentialyears: 4 });
    const procs = await atcDocs(`${added.path}/procedures`);
    expect(procs).toHaveLength(1);
    expect(procs[0].data).toMatchObject({ newlyadded: true, isdelete: false });
    expect(procs[0].data.name.id).toBe(PROC.two);
  });

  test('EATC-04 /validation reads and writes atc_to_validate', async ({ page }) => {
    await openEdit(page, ATC.EV1, 'validation');
    await expect(exadj(page, 0)).toContainText(`EV1 adjustment ${RUN}`);
    await setYears(page, 0, '7');
    await submitEdit(page, guard);
    const nv = await newVersionOf('atc_to_validate', ATC.EV1);
    await expectRetired('atc_to_validate', ATC.EV1, nv.id);
    const corr = await atcDocs(`atc_to_validate/${nv.id}/corrections`);
    expect(corr[0].data.potentialyears).toBe(7);
    expect((await atcDb().collection('atc_alpha').get()).docs.some((d) => d.data().editedfrom?.id === ATC.EV1), 'nothing written to atc_alpha').toBe(false);
  });

  test('EATC-05 an existing adjustment missing awareness blocks the save; nothing is written', async ({ page }) => {
    await openEdit(page, ATC.E6);
    await page.locator(tid('eatc-submit')).click();
    await expect(page.locator('mat-snack-bar-container').last()).toContainText('Fill the missing Awareness Detail & Potential Years in the existing adjustments', { timeout: 30_000 });
    await expect(page.locator(tid('pabs-submit'))).toHaveCount(0);
    const e6 = await atcDoc(`atc_alpha/${ATC.E6}`);
    expect(e6.isdelete).toBe(false);
    expect(e6.status).toBeUndefined();
    expect((await atcDb().collection('atc_alpha').get()).docs.some((d) => d.data().editedfrom?.id === ATC.E6)).toBe(false);
  });

  test('EATC-06 bulk apply under NEW ADJUSTMENTS touches only new-adjustment procedures', async ({ page }) => {
    await openEdit(page, ATC.E3);
    await expect(page.locator(tid(`eatc-bulk-select-${ACT.ca}`)), 'box hidden until a new adjustment exists').toHaveCount(0);
    // a new procedure under the EXISTING adjustment (must stay untouched by bulk)
    await exadj(page, 0).locator(tid('eatc-exadj-addproc')).click();
    const exNew = exadj(page, 0).locator(tid('eatc-exproc-1'));
    await pickOptions(page, exNew.locator(tid('eatc-proc-name')), [PROC_NAME.two], false);
    await addNewAdjustment(page, 0, `EATC-06 new adjustment ${RUN}`, [PROC_NAME.one, PROC_NAME.two]);

    const apply = page.locator(tid(`eatc-bulk-apply-${ACT.ca}`));
    await expect(apply, 'Apply disabled with nothing selected').toBeDisabled();
    await pickOptions(page, page.locator(tid(`eatc-bulk-select-${ACT.ca}`)), [NAME.agent2]);
    await apply.click();
    expect(guard.dialogs.some((m) => /^confirm: Apply .* as Change Agent to all 2 procedures/.test(m)), 'confirm names activity + count').toBe(true);
    for (const j of [0, 1]) {
      await expect.poll(() => selectText(newadj(page, 0).locator(tid(`eatc-newproc-${j}`)).locator(tid(`eatc-proc-assigned-${ACT.ca}`)))).toBe(NAME.agent2);
    }
    expect(await selectText(exNew.locator(tid(`eatc-proc-assigned-${ACT.ca}`))), 'new procedure under the existing adjustment untouched').toBe('');
    await submitEdit(page, guard);

    const nv = await newVersionOf('atc_alpha', ATC.E3);
    const corr = await atcDocs(`atc_alpha/${nv.id}/corrections`);
    const added = corr.find((c) => c.data.name === `EATC-06 new adjustment ${RUN}`);
    const addedProcs = await atcDocs(`${added.path}/procedures`);
    expect(addedProcs).toHaveLength(2);
    for (const p of addedProcs) {
      expect(p.data.bigactivity, `${p.id}: Change Agent = agent2`).toEqual({ [ACT.ca]: [PF.agent2] });
      expect((p.data.assigned_to || []).map((r: any) => r.id)).toEqual([PF.agent2]);
    }
    const existing = await atcDocs(`atc_alpha/${nv.id}/corrections/adjustment 01/procedures`);
    expect(existing).toHaveLength(2);
    for (const p of existing) {
      expect((p.data.bigactivity || {})[ACT.ca] || [], `${p.id}: existing adjustment never receives the bulk agent`).not.toContain(PF.agent2);
    }
  });

  test('EATC-07 media: audio + note image + ATC image upload to the STORAGE EMULATOR on save', async ({ page }) => {
    await openEdit(page, ATC.E4);
    await page.locator(tid('eatc-audio-input')).setInputFiles({ name: 'edit-brief.wav', mimeType: 'audio/wav', buffer: wavBuffer() });
    await expect(page.locator(tid('eatc-audio-item'))).toHaveCount(1, { timeout: 15_000 });
    await page.locator(tid('eatc-noteimg-input')).setInputFiles({ name: `edit-note-${RUN}.png`, mimeType: 'image/png', buffer: pngBuffer() });
    await page.locator(tid('eatc-atcimg-input')).setInputFiles({ name: `edit-atc-${RUN}.png`, mimeType: 'image/png', buffer: pngBuffer() });
    await submitEdit(page, guard);

    const nv = await newVersionOf('atc_alpha', ATC.E4);
    const emu = /^http:\/\/(localhost|127\.0\.0\.1):9199\//;
    const notes = (await atcDb().doc(`atc_notes/${nv.data().notesid}`).get()).data();
    expect(notes.changeworkbrief).toHaveLength(1);
    expect(notes.changeworkbrief[0], 'audio served by the Storage EMULATOR').toMatch(emu);
    expect(notes.imagenotes).toHaveLength(1);
    expect(notes.imagenotes[0]).toMatch(emu);
    expect((nv.data().prescription_image || []).some((u: string) => emu.test(u)), 'ATC image served by the Storage EMULATOR').toBe(true);
  });

  test('EATC-08 two-device conflict on the edit draft: "keep this device" wins, the other version is archived', async ({ page }) => {
    await openEdit(page, ATC.E5);
    await page.locator(tid('eatc-casenotes')).fill('edit mine v1');
    await page.locator(tid('eatc-casenotes')).blur();
    await expect(page.locator(tid('eatc-draft-status'))).toHaveText(/Draft saved\./, { timeout: 30_000 });
    const ref = atcDb().doc(`temporary_edit_ATC/${ATC.E5}`);
    const d1 = await waitFor(async () => { const d = (await ref.get()).data(); return d?.notes === 'edit mine v1' ? d : null; }, 'edit draft saved');

    await ref.update({ rev: d1.rev + 1, notes: 'edit theirs from another device' });
    await page.locator(tid('eatc-casenotes')).fill('edit mine v2');
    await page.locator(tid('eatc-casenotes')).blur();
    await page.locator(tid('dcfl-keep-mine')).click({ timeout: 30_000 });

    await waitFor(async () => { const d = (await ref.get()).data(); return d.notes === 'edit mine v2' && d.rev > d1.rev + 1 ? d : null; }, 'this device wins');
    const archived = await atcDocs(`temporary_edit_ATC/${ATC.E5}/conflicts`);
    expect(archived).toHaveLength(1);
    expect(archived[0].data).toMatchObject({ notes: 'edit theirs from another device', reason: 'two-device-conflict' });
  });
});
