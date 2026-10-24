// prescribe-atc-templates.spec.ts — /prescribeATC 2026-10-22 changes (PTPL-01..05), EMULATOR ONLY.
//
// Hook prefix: patc (PrescribeAtcComponent); the draft picker it opens uses atco, the directive editor dbu, the
// submit confirm aael.
// Plan: starlabs-angular specs/plans/2026-10-22-prescribe-atc-product-check.md (+ journal of the same date).
//
// What changed and is driven here:
//   • participant → product gating: the rest of the form shows only once both are chosen; both lock (not-allowed)
//   • WiSH / EI Solution → the specialists come from the closest PAST appointment the logged-in specialist hosted
//     for this participant (AppointmentType-To-Roles atcrolemap → bigactivity atcproperty); assigned_to is skipped
//   • any other model → the existing live-queue flow; the queue refs are kept in the draft and patched back as-is
//   • a draft without a queue session leaves queue mode (Open & Continue Another Draft)
//   • change agent "set for all procedures": a procedure chosen after Apply inherits the agents (kept in the draft)
//   • EI Solution Ask section (ask), right-hand panel (draft status, Ready to submit), directive text opens the editor
//
// Each case uses its OWN participant (tpg/tpe/tpn/tpb/tpq, seed-atc.js phase 3). Assertions read back what the APP
// wrote to the emulator — never a value the test wrote.
import { test, expect, Page, Browser, Locator } from '@playwright/test';
import {
  PF, NAME, ACT, PROC_NAME, MODEL, MODEL_DIRECTIVE, RUN, TPL, TPL_MODEL, TPL_DIRECTIVE, LIVE_QUEUE_NAME, LIVE_STAGE,
  installAtcGuards, assertNoRealDb, loginAsAtc, atcDb, atcDocs, waitFor, pickOptions, selectText, tid, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const DRAFT_SAVED = /Draft saved\./;

async function openPrescribe(page: Page) {
  await loginAsAtc(page, 'admin');
  await page.goto('/prescribeATC');
}
async function pickParticipant(page: Page, pfKey: keyof typeof NAME) {
  const sel = page.getByTestId('patc-participant');
  await expect(sel).toHaveAttribute('aria-disabled', 'false', { timeout: 45_000 });
  await pickOptions(page, sel, [NAME[pfKey]], false);
}
async function startFresh(page: Page) {
  await expect(page.getByTestId('atco-close')).toContainText('Start fresh', { timeout: 30_000 });
  await page.getByTestId('atco-close').click();
}
async function pickProduct(page: Page, model: string) {
  await expect(page.getByTestId('patc-product')).toHaveAttribute('aria-disabled', 'false', { timeout: 30_000 });
  await pickOptions(page, page.getByTestId('patc-product'), [model], false);
}
async function selectAuthor(page: Page) {
  await pickOptions(page, page.locator(tid(`patc-author-${ACT.author}`)), [NAME.admin]);
}
const adj = (page: Page, i: number) => page.locator(tid(`patc-adj-${i}`));
const proc = (page: Page, i: number, j: number) => adj(page, i).locator(tid(`patc-proc-${j}`));
const caOf = (page: Page, i: number, j: number) => proc(page, i, j).locator(tid(`patc-proc-assigned-${ACT.ca}`));
async function fillAdjustmentHead(page: Page, i: number, text: string) {
  await adj(page, i).getByTestId('patc-adj-text').fill(text);
  await adj(page, i).getByTestId('patc-adj-text').blur();
  await pickOptions(page, adj(page, i).getByTestId('patc-adj-awareness'), [/^\s*Aware\s*$/], false);
  await adj(page, i).getByTestId('patc-adj-years').fill('3');
  await adj(page, i).getByTestId('patc-adj-years').blur();
}
async function pickProcedure(page: Page, i: number, j: number, name: string) {
  await pickOptions(page, proc(page, i, j).getByTestId('patc-proc-name'), [name], false);
}
async function fillNotes(page: Page, tag: string) {
  await page.getByTestId('patc-points').fill(`points ${tag}`);
  await page.getByTestId('patc-points').blur();
  await page.getByTestId('patc-casenotes').fill(`notes ${tag}`);
  await page.getByTestId('patc-casenotes').blur();
}
async function waitDraftSaved(page: Page) {
  await expect(page.getByTestId('patc-draft-status')).toHaveText(DRAFT_SAVED, { timeout: 30_000 });
}
const snack = (page: Page, text: string | RegExp) => page.locator('mat-snack-bar-container').filter({ hasText: text });
const readyItem = (page: Page, label: string) => page.locator('.ready-item').filter({ hasText: label });
/** Top edge of an element, to check the screen order of sections. */
async function topOf(l: Locator): Promise<number> {
  const box = await l.boundingBox();
  if (!box) throw new Error('element not rendered');
  return box.y;
}
/** Ready-to-submit labels in screen order. */
async function checklistLabels(page: Page): Promise<string[]> {
  return (await page.locator('.ready-item').allInnerTexts()).map((t) => t.replace(/check_circle|radio_button_unchecked/g, '').trim());
}
const pathIds = (paths: any[]) => (paths || []).map((p: any) => (typeof p === 'string' ? p : p?.path || '').split('/').pop());

/** The live (not deleted) drafts the app has written for a participant. */
async function liveDrafts(pid: string) {
  return (await atcDb().collection('temporary_ATC').where('profileid', '==', pid).get()).docs.filter((d) => d.data().delete === false);
}
async function draftWhere(pid: string, ok: (d: any) => boolean, what: string) {
  return waitFor(async () => (await liveDrafts(pid)).find((d) => ok(d.data())) || null, what);
}
async function appWrittenFor(coll: string, pid: string) {
  return (await atcDb().collection(coll).where('profileid', '==', pid).get()).docs;
}
/** A second device: fresh context (empty IndexedDB), guarded, logged in on /prescribeATC. */
async function secondDevice(browser: Browser) {
  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const p = await ctx.newPage();
  const g = await installAtcGuards(p);
  await openPrescribe(p);
  return { ctx, p, g };
}
/** Continue the draft whose card shows `model` in the draft picker. */
async function continueDraft(page: Page, model: string) {
  const card = page.locator('.atco-card').filter({ hasText: model });
  await expect(card).toHaveCount(1, { timeout: 30_000 });
  await card.locator('[data-testid^="atco-draft-select-"]').click();
  await expect(page.locator('.atco-card')).toHaveCount(0, { timeout: 15_000 });
}
/** No value chosen: the select shows only its placeholder (selectText would return the placeholder text). */
async function expectEmptySelect(select: Locator, message?: string) {
  await expect(select.locator('.mat-mdc-select-value-text'), message).toHaveCount(0);
}
async function cursorOf(l: Locator) {
  return l.evaluate((el) => getComputedStyle(el).cursor);
}

test.describe('ATC — Prescribe ATC 2026-10-22: product check, Ask, panel (emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'prescribe atc templates: no fatal console errors');
  });

  test('PTPL-01 form waits for the product; both pick fields lock (not-allowed); panel checklist + draft status; directive text opens the editor', async ({ page }) => {
    await openPrescribe(page);
    await pickParticipant(page, 'tpg');

    // participant chosen, product not yet: the panel shows, the rest of the form does not
    await expect(page.getByTestId('patc-draft-status')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.side-participant-name')).toContainText(NAME.tpg);
    await expect(page.getByTestId('patc-participant'), 'participant locks once chosen').toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('patc-directive-btn'), 'form hidden until a product is picked').toHaveCount(0);
    await expect(page.locator(tid('patc-adj-0'))).toHaveCount(0);
    await expect(page.getByTestId('patc-submit'), 'Ready to submit waits for the product').toHaveCount(0);
    expect(await cursorOf(page.locator('#atcfield-profile .mat-form-field-disabled')), 'locked participant: not-allowed').toBe('not-allowed');

    await pickProduct(page, MODEL.alpha);
    await expect(page.getByTestId('patc-product'), 'product locks once chosen').toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('patc-product')).toContainText(MODEL.alpha);
    expect(await cursorOf(page.locator('#atcfield-product .mat-form-field-disabled')), 'locked product: not-allowed').toBe('not-allowed');
    await expect(page.getByTestId('patc-directive-text')).toHaveText(MODEL_DIRECTIVE.alpha);
    await expect(page.getByTestId('patc-ask-card'), 'Ask is EI Solution only').toHaveCount(0);
    await expect(page.getByTestId('patc-ai-section'), 'not an AI ATC: no Areas to explore / AI summary').toHaveCount(0);

    // Ready to submit mirrors submit(): done items tick, the author item ticks once an author is chosen
    await expect(page.getByTestId('patc-submit')).toBeVisible();
    await expect(readyItem(page, 'Choose the participant')).toHaveClass(/ready-done/);
    await expect(readyItem(page, 'Choose what the ATC is given for')).toHaveClass(/ready-done/);
    await expect(readyItem(page, 'Add at least one author')).not.toHaveClass(/ready-done/);
    await expect(readyItem(page, 'Add at least one complete ask'), 'no ask item outside EI Solution').toHaveCount(0);
    await selectAuthor(page);
    await expect(readyItem(page, 'Add at least one author')).toHaveClass(/ready-done/);

    // clicking the directive TEXT opens the same editor as Edit Directive
    await page.getByTestId('patc-directive-open').click();
    await page.getByTestId('dbu-textarea').fill(`PTPL-01 directive ${RUN}`);
    await page.getByTestId('dbu-submit').click();
    await expect(page.getByTestId('patc-directive-text')).toHaveText(`PTPL-01 directive ${RUN}`);

    await waitDraftSaved(page);
    const d = await draftWhere(PF.tpg, (x) => x.atcdirective === `PTPL-01 directive ${RUN}`, 'tpg draft with the edited directive');
    expect(d.data().product).toBe(MODEL.alpha);
    expect(d.data().appointmentid, 'a non-WiSH/EI model never looks at appointments').toBeNull();
    expect(d.data().queueid, 'tpg has no live queue session').toBeNull();
  });

  test('PTPL-02 EI Solution: specialists come from the closest past appointment I hosted; asks are kept; ATC carries appointmentid + ask', async ({ page }) => {
    expect(await appWrittenFor('atc_alpha', PF.tpe), 'precondition: no ATC for tpe').toHaveLength(0);
    await openPrescribe(page);
    await pickParticipant(page, 'tpe');
    await pickProduct(page, TPL_MODEL.ei);

    // apPast (1 day ago): diag role = admin → author; shadow role = agent2 → observer AND change agent (2026-10-23:
    // assigned_to hosts become the "set for all procedures" agents). Older / cancelled / future / not-hosted /
    // other-type appointments lose.
    await expect.poll(() => selectText(page.locator(tid(`patc-author-${ACT.author}`))), { timeout: 30_000 }).toBe(NAME.admin);
    await expect.poll(() => selectText(page.locator(tid(`patc-observer-${ACT.observer}`))), { timeout: 30_000 }).toBe(NAME.agent2);
    await expect.poll(() => selectText(page.locator(tid(`patc-bulk-select-${ACT.ca}`))), { message: 'Change Agent "set for all" = the shadow host' }).toBe(NAME.agent2);
    await expectEmptySelect(page.locator(tid(`patc-bulk-select-${ACT.sa}`)), 'Support Agent is not mapped → stays empty');
    expect(await selectText(caOf(page, 0, 0)), 'the procedure row already on screen got it').toBe(NAME.agent2);
    await expect(page.getByTestId('patc-directive-text')).toHaveText(TPL_DIRECTIVE.ei);
    // 2026-10-23 order: directive first, then Ask, then the specialists — on screen AND in Ready to submit
    expect(await topOf(page.locator('#atcfield-directive')), 'directive above Ask').toBeLessThan(await topOf(page.getByTestId('patc-ask-card')));
    expect(await topOf(page.getByTestId('patc-ask-card')), 'Ask above Authors').toBeLessThan(await topOf(page.locator('#atcfield-author')));
    const eiList = await checklistLabels(page);
    expect(eiList.indexOf('Write the ATC directive'), 'checklist: directive before ask').toBeLessThan(eiList.indexOf('Add at least one complete ask'));
    expect(eiList.indexOf('Add at least one author'), 'checklist: author stays first (prototype)').toBeLessThan(eiList.indexOf('Write the ATC directive'));
    await waitDraftSaved(page);
    const d = await draftWhere(PF.tpe, (x) => x.appointmentid != null, 'tpe draft with the appointment id');
    expect(d.data().appointmentid, 'the closest PAST appointment I hosted').toBe(TPL.apPast);
    expect(pathIds(d.data().observer?.[ACT.observer])).toEqual([PF.agent2]);
    expect(pathIds(d.data().bulkapplied?.[ACT.ca]), 'applied → kept in the draft').toEqual([PF.agent2]);

    // Ask: one empty row to start; two complete rows + one empty row → "2 complete"
    await expect(page.getByTestId('patc-ask-card')).toBeVisible();
    await expect(page.getByTestId('patc-ask-count')).toHaveText('0 complete');
    await expect(page.getByTestId('patc-ask-by')).toHaveCount(1);
    await expect(readyItem(page, 'Add at least one complete ask')).not.toHaveClass(/ready-done/);
    await pickOptions(page, page.getByTestId('patc-ask-by').nth(0), ['Self'], false);
    await page.getByTestId('patc-ask-for').nth(0).fill('for health');
    await page.getByTestId('patc-ask-for').nth(0).blur();
    await page.getByTestId('patc-ask-add').click();
    await pickOptions(page, page.getByTestId('patc-ask-by').nth(1), ['Spouse'], false);
    await page.getByTestId('patc-ask-for').nth(1).fill('  calm home  ');
    await page.getByTestId('patc-ask-for').nth(1).blur();
    await page.getByTestId('patc-ask-add').click();
    await expect(page.getByTestId('patc-ask-by')).toHaveCount(3);
    await expect(page.getByTestId('patc-ask-count')).toHaveText('2 complete');
    await expect(readyItem(page, 'Add at least one complete ask')).toHaveClass(/ready-done/);

    await fillAdjustmentHead(page, 0, `PTPL-02 adjustment ${RUN}`);
    await pickProcedure(page, 0, 0, PROC_NAME.one);
    // a procedure added later inherits the appointment's change agent once its changework is picked
    await proc(page, 0, 0).getByTestId('patc-proc-add').click();
    await expect(caOf(page, 0, 1)).toBeVisible({ timeout: 15_000 });
    await pickProcedure(page, 0, 1, PROC_NAME.two);
    await expect.poll(() => selectText(caOf(page, 0, 1)), { message: 'new procedure inherits it' }).toBe(NAME.agent2);
    await fillNotes(page, 'PTPL-02');
    await waitDraftSaved(page);
    await page.getByTestId('patc-submit').click();
    await page.getByTestId('aael-submit').click();
    await expect(snack(page, 'The ATC has been submitted successfully')).toBeVisible({ timeout: 45_000 });

    const [atc] = await waitFor(async () => { const x = await appWrittenFor('atc_alpha', PF.tpe); return x.length ? x : null; }, 'ATC for tpe');
    const a = atc.data();
    expect(a.product).toBe(TPL_MODEL.ei);
    expect(a.appointmentid).toBe(TPL.apPast);
    expect(a.ask, 'only complete rows, trimmed').toEqual([{ askedby: 'self', askedfor: 'for health' }, { askedby: 'spouse', askedfor: 'calm home' }]);
    expect((a.author || []).map((r: any) => r.id)).toEqual([PF.admin]);
    expect(a.queueid, 'no queue on an appointment ATC').toBeUndefined();
    // both procedures carry the appointment's change agent
    const procs = await atcDocs(`${atc.ref.path}/corrections/adjustment 01/procedures`);
    expect(procs).toHaveLength(2);
    for (const p of procs) {
      expect(p.data.bigactivity, `${p.id}: Change Agent from the appointment`).toEqual({ [ACT.ca]: [PF.agent2] });
      expect((p.data.assigned_to || []).map((r: any) => r.id)).toEqual([PF.agent2]);
    }
  });

  test('PTPL-03 EI Solution with no appointment: pickers stay empty; ask validation blocks submit; a half-filled ask survives a reopen', async ({ page, browser }) => {
    await openPrescribe(page);
    await pickParticipant(page, 'tpn');
    await pickProduct(page, TPL_MODEL.ei);
    await waitDraftSaved(page);
    const d = await draftWhere(PF.tpn, (x) => x.product === TPL_MODEL.ei, 'tpn draft');
    expect(d.data().appointmentid, 'no appointment → nothing found, no id').toBeNull();
    await expectEmptySelect(page.locator(tid(`patc-author-${ACT.author}`)), 'no appointment → author left for the user');
    await expectEmptySelect(page.locator(tid(`patc-observer-${ACT.observer}`)));

    await selectAuthor(page);
    await page.getByTestId('patc-submit').click();
    await expect(snack(page, 'Add at least one complete ask')).toBeVisible({ timeout: 15_000 });

    await pickOptions(page, page.getByTestId('patc-ask-by').nth(0), ['Family'], false);
    await page.getByTestId('patc-submit').click();
    await expect(snack(page, 'Fill both asked by and asked for')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('patc-ask-card')).toContainText('Fill both asked by and asked for');

    // removing the last row clears it (one row always stays)
    await page.getByTestId('patc-ask-remove').nth(0).click();
    await expect(page.getByTestId('patc-ask-by')).toHaveCount(1);
    await expectEmptySelect(page.getByTestId('patc-ask-by').nth(0), 'the last row is cleared, not removed');

    // a half-filled row is kept in the draft as typed …
    await pickOptions(page, page.getByTestId('patc-ask-by').nth(0), ['Friends'], false);
    await waitDraftSaved(page);
    const partial = await draftWhere(PF.tpn, (x) => x.ask?.[0]?.askedby === 'friends', 'tpn draft with the half-filled ask');
    expect(partial.data().ask).toEqual([{ askedby: 'friends', askedfor: '' }]);
    expect(await appWrittenFor('atc_alpha', PF.tpn), 'blocked submits wrote nothing').toHaveLength(0);

    // … and comes back on another device
    const { ctx, p, g } = await secondDevice(browser);
    await pickParticipant(p, 'tpn');
    await continueDraft(p, TPL_MODEL.ei);
    await expect(p.getByTestId('patc-ask-card')).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => selectText(p.getByTestId('patc-ask-by').nth(0)), { timeout: 15_000 }).toBe('Friends');
    await expect(p.getByTestId('patc-ask-for').nth(0)).toHaveValue('');
    await expect(p.getByTestId('patc-product')).toHaveAttribute('aria-disabled', 'true');
    assertNoRealDb(g);
    await ctx.close();
  });

  test('PTPL-04 change agent set for all procedures: a procedure chosen later inherits it, a manual pick is kept, and it survives a reopen', async ({ page, browser }) => {
    await openPrescribe(page);
    await pickParticipant(page, 'tpb');
    await pickProduct(page, MODEL.alpha);
    await selectAuthor(page);
    await fillAdjustmentHead(page, 0, `PTPL-04 adj one ${RUN}`);
    await pickProcedure(page, 0, 0, PROC_NAME.one);

    await pickOptions(page, page.locator(tid(`patc-bulk-select-${ACT.ca}`)), [NAME.agent1]);
    await page.locator(tid(`patc-bulk-apply-${ACT.ca}`)).click();
    await expect.poll(() => guard.dialogs.filter((m) => m.startsWith('confirm: Apply')).length).toBe(1);
    await expect.poll(() => selectText(caOf(page, 0, 0))).toBe(NAME.agent1);

    // a new row is empty until its changework is chosen — then it inherits the applied agent
    await proc(page, 0, 0).getByTestId('patc-proc-add').click();
    expect(await selectText(caOf(page, 0, 1))).toBe('');
    await pickProcedure(page, 0, 1, PROC_NAME.two);
    await expect.poll(() => selectText(caOf(page, 0, 1)), { message: 'new procedure inherits the applied change agent' }).toBe(NAME.agent1);

    // a procedure whose change agent was set by hand keeps it
    await page.getByTestId('patc-adj-add').click();
    await fillAdjustmentHead(page, 1, `PTPL-04 adj two ${RUN}`);
    await pickOptions(page, caOf(page, 1, 0), [NAME.agent2]);
    await pickProcedure(page, 1, 0, PROC_NAME.one);
    await page.waitForTimeout(500);
    expect(await selectText(caOf(page, 1, 0)), 'a manual pick is not overwritten').toBe(NAME.agent2);

    await waitDraftSaved(page);
    const d = await draftWhere(PF.tpb, (x) => (x.bulkapplied?.[ACT.ca] || []).length != 0, 'tpb draft with bulkapplied');
    expect(pathIds(d.data().bulkapplied[ACT.ca])).toEqual([PF.agent1]);
    expect(pathIds(d.data().transcript?.[0]?.procedure?.[1]?.assignedMap?.[ACT.ca])).toEqual([PF.agent1]);
    expect(pathIds(d.data().transcript?.[1]?.procedure?.[0]?.assignedMap?.[ACT.ca])).toEqual([PF.agent2]);

    // another device: the applied agent still fills a procedure chosen there
    const { ctx, p, g } = await secondDevice(browser);
    await pickParticipant(p, 'tpb');
    await continueDraft(p, MODEL.alpha);
    await expect(p.locator(tid('patc-adj-0')).getByTestId('patc-adj-text')).toHaveValue(`PTPL-04 adj one ${RUN}`, { timeout: 30_000 });
    await proc(p, 0, 1).getByTestId('patc-proc-add').click();
    await pickProcedure(p, 0, 2, PROC_NAME.one);
    await expect.poll(() => selectText(caOf(p, 0, 2)), { message: 'reopened draft: still inherits' }).toBe(NAME.agent1);
    assertNoRealDb(g);
    await ctx.close();
  });

  test('PTPL-05 live queue: refs kept in the draft and restored as-is; a non-queue draft leaves queue mode; submit carries the queue', async ({ page, browser }) => {
    expect(await appWrittenFor('atc_to_validate', PF.tpq), 'precondition: no ATC for tpq').toHaveLength(0);
    await openPrescribe(page);
    await pickParticipant(page, 'tpq');
    await startFresh(page);                                   // tpq already has a non-queue beta draft
    await pickProduct(page, MODEL.alpha);

    // the live assignment pairs admin with tpq; agent1 filled the author activity in the session
    await expect.poll(() => selectText(page.locator(tid(`patc-author-${ACT.author}`))), { timeout: 30_000 }).toBe(NAME.agent1);
    await expect(page.getByTestId('patc-visible-checkbox'), 'queue mode: no visibility checkbox').toHaveCount(0);
    await waitDraftSaved(page);
    const d = await draftWhere(PF.tpq, (x) => x.liveassignmentid != null && x.queuename != null, 'tpq draft with the queue refs');
    expect(d.data()).toMatchObject({ queueid: TPL.liveQueue, stagename: LIVE_STAGE, liveassignmentid: TPL.liveAssignment, queuename: LIVE_QUEUE_NAME, product: MODEL.alpha });
    expect(d.data().appointmentid).toBeNull();

    // another device reopens it: queue mode comes back from the draft (no re-check)
    const { ctx, p, g } = await secondDevice(browser);
    await pickParticipant(p, 'tpq');
    await continueDraft(p, MODEL.alpha);
    await expect.poll(() => selectText(p.locator(tid(`patc-author-${ACT.author}`))), { timeout: 30_000 }).toBe(NAME.agent1);
    await expect(p.getByTestId('patc-visible-checkbox')).toHaveCount(0);

    // Open & Continue Another Draft → the non-queue beta draft: queue mode is left behind
    await p.getByRole('button', { name: /Open & Continue Another Draft/ }).click();
    await continueDraft(p, MODEL.beta);
    await expect(p.getByTestId('patc-product')).toContainText(MODEL.beta, { timeout: 30_000 });
    await expect(p.getByTestId('patc-visible-checkbox'), 'beta draft: back to the non-queue form').toBeVisible({ timeout: 15_000 });

    // … and back to the queue draft, fill it in and submit: the confirm names the queue, the ATC keeps the refs
    await p.getByRole('button', { name: /Open & Continue Another Draft/ }).click();
    await continueDraft(p, MODEL.alpha);
    await expect(p.getByTestId('patc-visible-checkbox')).toHaveCount(0, { timeout: 15_000 });
    await fillAdjustmentHead(p, 0, `PTPL-05 adjustment ${RUN}`);
    await pickProcedure(p, 0, 0, PROC_NAME.one);
    await fillNotes(p, 'PTPL-05');
    await waitDraftSaved(p);
    await p.getByTestId('patc-submit').click();
    await expect(p.getByTestId('aael-message')).toContainText(LIVE_QUEUE_NAME, { timeout: 15_000 });
    await expect(p.getByTestId('aael-message')).toContainText(LIVE_STAGE);
    await p.getByTestId('aael-submit').click();

    const [atc] = await waitFor(async () => {
      const x = [...await appWrittenFor('atc_to_validate', PF.tpq), ...await appWrittenFor('atc_alpha', PF.tpq)];
      return x.length ? x : null;
    }, 'ATC for tpq', 45_000);
    expect(atc.data()).toMatchObject({ queueid: TPL.liveQueue, stagename: LIVE_STAGE, liveassignmentid: TPL.liveAssignment, product: MODEL.alpha });
    expect((atc.data().author || []).map((r: any) => r.id)).toEqual([PF.agent1]);
    assertNoRealDb(g);
    await ctx.close();
  });

  test('PTPL-06 WiSH: immediate-outcome look, directive → outcomes order, outcome rows, checks, `outcomes` on draft + ATC', async ({ page }) => {
    expect(await appWrittenFor('atc_alpha', PF.tpw), 'precondition: no ATC for tpw').toHaveLength(0);
    await openPrescribe(page);
    await pickParticipant(page, 'tpw');
    await pickProduct(page, TPL_MODEL.wish);

    // the WiSH directive look (UI only — same editor, same `directive`)
    const directive = page.locator('#atcfield-directive');
    await expect(directive).toContainText('IMMEDIATE OUTCOME EXPECTED FROM WiSH');
    await expect(directive).toContainText("Elaborate with the participant's life situation.");
    await expect(page.getByTestId('patc-directive-text')).toHaveText(TPL_DIRECTIVE.wish);
    await expect(page.getByTestId('patc-directive-btn')).toHaveText(/Edit Immediate Outcome/);
    // the empty-state example text shows only while nothing is written (here the ATC model filled it)
    await expect(page.getByTestId('patc-directive-placeholder')).toHaveCount(0);

    // order: directive → WiSH outcomes → Authors; no Ask for WiSH
    const card = page.getByTestId('patc-outcome-card');
    expect(await topOf(directive)).toBeLessThan(await topOf(card));
    expect(await topOf(card)).toBeLessThan(await topOf(page.locator('#atcfield-author')));
    await expect(page.getByTestId('patc-ask-card')).toHaveCount(0);
    await expect(card).toContainText('One row per outcome area. At least one is required; empty rows are dropped.');
    await expect(page.getByTestId('patc-outcome-area'), 'five empty rows to start').toHaveCount(5);
    await expect(page.getByTestId('patc-outcome-count')).toHaveText('0 filled');
    await expect(card).toContainText('01');
    const list = await checklistLabels(page);
    expect(list.indexOf('Add at least one author')).toBeLessThan(list.indexOf('Write the immediate outcome'));
    expect(list.indexOf('Write the immediate outcome'), 'directive before outcomes').toBeLessThan(list.indexOf('Add at least one complete WiSH outcome'));
    expect(list, 'WiSH wording, no EI ask item').not.toContain('Write the ATC directive');

    // everything else filled, so the outcome checks are what blocks
    await selectAuthor(page);
    await fillAdjustmentHead(page, 0, `PTPL-06 adjustment ${RUN}`);
    await pickProcedure(page, 0, 0, PROC_NAME.one);
    await fillNotes(page, 'PTPL-06');
    await page.getByTestId('patc-submit').click();
    await expect(snack(page, 'Add at least one complete WiSH outcome')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('patc-outcome-area').nth(0).fill(`Wish Super Money ${RUN}`);
    await page.getByTestId('patc-outcome-area').nth(0).blur();
    await page.getByTestId('patc-submit').click();
    await expect(snack(page, 'Fill both outcome area and outcomes expected')).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText('Fill both outcome area and outcomes expected');

    // remove rows 5 → 1; removing the last one clears it instead
    for (let k = 4; k >= 1; k--) await page.getByTestId('patc-outcome-remove').nth(k).click();
    await expect(page.getByTestId('patc-outcome-area')).toHaveCount(1);
    await expect(page.getByTestId('patc-outcome-area').nth(0)).toHaveValue(`Wish Super Money ${RUN}`);
    await page.getByTestId('patc-outcome-remove').nth(0).click();
    await expect(page.getByTestId('patc-outcome-area')).toHaveCount(1);
    await expect(page.getByTestId('patc-outcome-area').nth(0), 'the last row is cleared, not removed').toHaveValue('');

    // two complete rows (one with spaces to trim) + one empty row
    await page.getByTestId('patc-outcome-area').nth(0).fill(`Wish Super Money ${RUN}`);
    await page.getByTestId('patc-outcome-expected').nth(0).fill('  Save six months of expenses  ');
    await page.getByTestId('patc-outcome-expected').nth(0).blur();
    await page.getByTestId('patc-outcome-add').click();
    await page.getByTestId('patc-outcome-area').nth(1).fill(`Wish Super Fitness ${RUN}`);
    await page.getByTestId('patc-outcome-expected').nth(1).fill('Run 5K by March');
    await page.getByTestId('patc-outcome-expected').nth(1).blur();
    await page.getByTestId('patc-outcome-add').click();
    await expect(page.getByTestId('patc-outcome-area')).toHaveCount(3);
    await expect(page.getByTestId('patc-outcome-count')).toHaveText('2 filled');
    await expect(readyItem(page, 'Add at least one complete WiSH outcome')).toHaveClass(/ready-done/);
    await waitDraftSaved(page);
    const d = await draftWhere(PF.tpw, (x) => (x.outcomes || []).length === 3, 'tpw draft with three outcome rows');
    expect(d.data().outcomes[2], 'the draft keeps every row, the empty one too').toEqual({ outcomearea: '', outcomeexpected: '' });

    await page.getByTestId('patc-submit').click();
    await page.getByTestId('aael-submit').click();
    await expect(snack(page, 'The ATC has been submitted successfully')).toBeVisible({ timeout: 45_000 });
    const [atc] = await waitFor(async () => { const x = await appWrittenFor('atc_alpha', PF.tpw); return x.length ? x : null; }, 'ATC for tpw');
    expect(atc.data().product).toBe(TPL_MODEL.wish);
    expect(atc.data().outcomes, 'complete rows only, trimmed').toEqual([
      { outcomearea: `Wish Super Money ${RUN}`, outcomeexpected: 'Save six months of expenses' },
      { outcomearea: `Wish Super Fitness ${RUN}`, outcomeexpected: 'Run 5K by March' },
    ]);
    expect(atc.data().ask, 'no Ask on a WiSH ATC').toBeUndefined();
  });

  test('PTPL-07 a mentoring prescriber sees "Directives for Micro ATC" for a regular model, but not for EI Solution or WiSH', async ({ page }) => {
    await loginAsAtc(page, 'emen');      // an EIS who also mentors: can prescribe AND sees the micro ATC section
    const micro = page.getByTestId('patc-micro-section');
    const checks: [keyof typeof NAME, string, boolean][] = [
      ['tpg', MODEL.beta, true],          // a regular model: the section and its checklist item are there
      ['tpn', TPL_MODEL.ei, false],       // EI Solution: hidden
      ['tpw', TPL_MODEL.wish, false],     // WiSH: hidden
    ];
    for (const [pf, model, shown] of checks) {
      await page.goto('/prescribeATC');
      await pickParticipant(page, pf);
      if (await page.getByTestId('atco-close').waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
        await page.getByTestId('atco-close').click();
      }
      await pickProduct(page, model);
      await expect(page.getByTestId('patc-submit')).toBeVisible({ timeout: 30_000 });
      await expect(micro, `${model}: micro ATC section ${shown ? 'shown' : 'hidden'}`).toHaveCount(shown ? 1 : 0);
      await expect(readyItem(page, 'Micro ATC directives have an assignee')).toHaveCount(shown ? 1 : 0);
    }
  });
});
