// view-prescribed-atc-activities.spec.ts — delivery / queue forms in the View ATC Forms card (VATCA-01..04),
// EMULATOR ONLY. Hook prefix: vatc (View Prescribed ATC). Plan: specs/plans/2026-11-01-atc-delivery-queue-forms.md
// (app repo).
//
// World (seed-atc.js phase 7): tfp did WiSH twice — ATC_A (purchase a: 3 answers, Life Check twice) and ATC_B
// (purchase b: 1 answer) — and has a queue ATC (ATC_Q: 1 answer in its queue). Since the one forms query (plan
// 2026-11-02) the purchase clause has no profileid match, so another participant's answer carrying purchase a SHOWS
// (duplicate ids stay visible); the queue clause matches the participant. Negative controls: tfp's answer with no
// purchase id, tfp's answer in another queue, another participant's answer in tfp's queue. Anti-circularity: the rows on screen are compared with what the emulator holds for the ATC's
// participantproductid / queueid (Admin SDK), never with a list typed into the spec.
import { test, expect, Page } from '@playwright/test';
import {
  EMAIL, FATC, DQ, DQ_QUEUE_NAME, DQ_STAGE, DQ_FORM, DQ_ANS, DQ_TEXT,
  installAtcGuards, assertNoRealDb, loginAsAtc, atcDoc, formsDb, pickOptions, tid, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

async function openFor(page: Page, participant: 'tfp' | 'tfa') {
  await loginAsAtc(page, 'admin');
  await page.goto('/viewprescribedATC');
  await expect(page.getByTestId('vatc-count')).toBeVisible({ timeout: 45_000 });
  await pickOptions(page, page.getByTestId('vatc-filter-participant'), [EMAIL[participant]]);
}
const row = (page: Page, id: string) => page.locator(tid(`vatc-row-${id}`));
async function openFull(page: Page, id: string) {
  const r = row(page, id);
  await expect(r).toBeVisible({ timeout: 45_000 });
  await r.getByTestId('vatc-toggle-full').click();
  await expect(r.getByTestId('vatc-forms-card')).toBeVisible({ timeout: 30_000 });
  return r;
}
// the date line the screen writes (Angular DatePipe 'd MMM y', en-US)
const dmy = (d: Date) => `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
/** The answers the emulator holds for one clause of the forms query (plan 2026-11-02), newest first: { id, name, note }.
 *  purchase: participantproductid only (one participant's purchase); queue: queueref AND the ATC's participant. */
async function expected(profileid: string | null, field: 'participantproductid' | 'queueref', value: any) {
  let q = formsDb().collection('formsByClient').where(field, '==', value);
  if (profileid) q = q.where('profileid', '==', profileid);
  const snap = await q.get();
  return snap.docs.map((d) => {
    const a = d.data();
    const date: Date = a.date.toDate();
    const filledin = a.submittedin === 'breakthroughs' ? 'in the app' : a.submittedin === 'starlabs' ? 'on web' : null;
    return { id: d.id, name: a.formname, date, note: [dmy(date), a.stagename, filledin].filter((x) => x).join(' · ') };
  }).sort((x, y) => y.date.getTime() - x.date.getTime());
}
async function rowsOf(part: ReturnType<Page['locator']>) {
  const rows = part.getByTestId('vatc-activity-row');
  const n = await rows.count();
  const out: { name: string; note: string }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ name: (await rows.nth(i).getByTestId('vatc-activity-name').innerText()).trim(),
      note: (await rows.nth(i).getByTestId('vatc-activity-note').innerText()).trim() });
  }
  return out;
}

test.describe('ATC — View Prescribed ATC delivery / queue forms (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'view prescribed atc activities: no fatal console errors');
  });

  test('VATCA-01 Delivery activities: every answer of the ATC\'s purchase, newest first; View answer opens it', async ({ page }) => {
    const atc = await atcDoc(`atc_alpha/${DQ.ATC_A}`);
    expect(atc.participantproductid, 'precondition: the ATC carries its purchase').toBe(DQ.ppA);
    const want = await expected(null, 'participantproductid', atc.participantproductid);
    // purchase a: tfp's three answers + the seeded answer of another participant carrying the same purchase id — the
    // purchase clause has no profileid match (plan 2026-11-02), so that duplicate-id answer shows and stays visible
    expect(want.map((w) => w.id), 'precondition: purchase a holds four answers').toEqual([DQ_ANS.xPp, DQ_ANS.a3, DQ_ANS.a2, DQ_ANS.a1]);

    await openFor(page, 'tfp');
    const r = await openFull(page, DQ.ATC_A);
    const part = r.getByTestId('vatc-forms-part-delivery');
    await expect(part).toBeVisible({ timeout: 30_000 });
    await expect(part).toContainText('Delivery activities');
    await expect(r.getByTestId('vatc-forms-delivery-count')).toHaveText(`${want.length} answers`);
    expect(await rowsOf(part), 'all answers, the same form twice included, newest first').toEqual(want.map((w) => ({ name: w.name, note: w.note })));
    // negative control: tfp's answer without a purchase id
    await expect(r).not.toContainText(DQ_FORM.noPp);
    // no queue on this ATC, and the WiSH model has no forms → only the delivery part
    await expect(r.getByTestId('vatc-forms-part-queue')).toHaveCount(0);
    await expect(r.getByTestId('vatc-forms-part-atc')).toHaveCount(0);

    await part.getByTestId('vatc-activity-row').nth(1).getByTestId('vatc-activity-view').click(); // a3 (xPp is newer)
    await expect(page.getByTestId('fov-panel-3')).toContainText(DQ_TEXT(DQ_ANS.a3), { timeout: 15_000 });
  });

  test('VATCA-02 the second purchase of the same product shows only its own answers', async ({ page }) => {
    const atc = await atcDoc(`atc_alpha/${DQ.ATC_B}`);
    const want = await expected(null, 'participantproductid', atc.participantproductid);
    expect(want.map((w) => w.id)).toEqual([DQ_ANS.b1]);

    await openFor(page, 'tfp');
    const r = await openFull(page, DQ.ATC_B);
    const part = r.getByTestId('vatc-forms-part-delivery');
    await expect(r.getByTestId('vatc-forms-delivery-count')).toHaveText('1 answer', { timeout: 30_000 });
    expect(await rowsOf(part)).toEqual(want.map((w) => ({ name: w.name, note: w.note })));
    await expect(r).not.toContainText(DQ_FORM.intake);
    await expect(r).not.toContainText(DQ_FORM.life);
  });

  test('VATCA-03 Queue activities: the answers filled in the ATC\'s queue, with the stage', async ({ page }) => {
    const atc = await atcDoc(`atc_alpha/${DQ.ATC_Q}`);
    expect(atc.queueid, 'precondition: a queue ATC').toBe(DQ.queue);
    expect(atc.participantproductid, 'a queue ATC carries no purchase').toBeUndefined();
    const want = await expected(atc.profileid, 'queueref', formsDb().doc(`queue generation/${atc.queueid}`));
    expect(want.map((w) => w.id)).toEqual([DQ_ANS.q1]);

    await openFor(page, 'tfp');
    const r = await openFull(page, DQ.ATC_Q);
    const part = r.getByTestId('vatc-forms-part-queue');
    await expect(part).toBeVisible({ timeout: 30_000 });
    await expect(part).toContainText(`Filled in the queue · ${DQ_QUEUE_NAME}`);
    await expect(r.getByTestId('vatc-forms-queue-count')).toHaveText('1 answer');
    const rows = await rowsOf(part);
    expect(rows).toEqual(want.map((w) => ({ name: w.name, note: w.note })));
    expect(rows[0].note).toContain(DQ_STAGE);
    // negative controls: tfp's answer in another queue, another participant's answer in this queue
    await expect(r).not.toContainText(DQ_FORM.otherQ);
    await expect(r).not.toContainText(DQ_FORM.otherQp);
    await expect(r.getByTestId('vatc-forms-part-delivery')).toHaveCount(0);
  });

  test('VATCA-04 an ATC with neither a purchase nor a queue shows no delivery / queue part', async ({ page }) => {
    const atc = await atcDoc(`atc_alpha/${FATC.V1}`);
    expect(atc.participantproductid).toBeUndefined();
    expect(atc.queueid).toBeUndefined();
    await openFor(page, 'tfa');
    const r = await openFull(page, FATC.V1);                   // its ATC forms still show (validated model with forms)
    await expect(r.getByTestId('vatc-forms-part-atc')).toBeVisible();
    await expect(r.getByTestId('vatc-forms-part-delivery')).toHaveCount(0);
    await expect(r.getByTestId('vatc-forms-part-queue')).toHaveCount(0);
  });
});
