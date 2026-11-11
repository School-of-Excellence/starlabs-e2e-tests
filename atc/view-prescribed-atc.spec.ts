// view-prescribed-atc.spec.ts — /viewprescribedATC (VATC-01..08), EMULATOR ONLY.
//
// Anti-circularity: every expectation is either a value the APP rendered compared against an independent
// Admin-SDK read of the emulator, or a document the APP wrote compared against the input the test gave it.
// Counts are computed LIVE from the emulator (other ATC specs add/upgrade ATCs), never hard-coded.
import { test, expect, Page } from '@playwright/test';
import {
  ATC, PF, EMAIL, NAME, ACT, PROC_NAME, MODEL, RUN, QUEUE_NAME, installAtcGuards, assertNoRealDb, loginAsAtc, atcDb, atcDoc, atcDocs, defaultDb,
  waitFor, pickOptions, selectText, tid, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

/** What the screen lists for a super-role: alpha (not deleted, online) + to-validate still 'atc given'. */
async function expectedListed(filter: (d: any) => boolean = () => true) {
  const alpha = (await atcDb().collection('atc_alpha').where('isdelete', '==', false).where('type', '==', 'online').get()).docs;
  const tov = (await atcDb().collection('atc_to_validate').where('isdelete', '==', false).where('type', '==', 'online')
    .where('status', '==', 'atc given').get()).docs;
  const all = new Map<string, any>();
  [...alpha, ...tov].forEach((d) => all.set(d.id, d.data()));
  return [...all.entries()].filter(([, d]) => filter(d));
}

/** The seeded queue's window, read from the emulator (default DB). */
async function defaultQueue() {
  const d = (await defaultDb().collection('queue generation').where('queuename', '==', QUEUE_NAME).get()).docs[0].data();
  return { start: d.queuestartdate.toDate(), end: d.queueenddate.toDate() };
}

async function openView(page: Page, who: 'admin' | 'eis' = 'admin') {
  await loginAsAtc(page, who);
  await page.goto('/viewprescribedATC');
  await expect(page.getByTestId('vatc-count')).toBeVisible({ timeout: 45_000 });
}
const row = (page: Page, id: string) => page.locator(tid(`vatc-row-${id}`));
const shownCount = async (page: Page) => Number(((await page.getByTestId('vatc-count').innerText()).match(/\d+/) || ['-1'])[0]);

test.describe('ATC — View Prescribed ATC (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'view prescribed atc: no fatal console errors');
  });

  test('VATC-01 list renders every listed ATC; count + summary match the emulator', async ({ page }) => {
    await openView(page);
    await expect(row(page, ATC.A1)).toBeVisible({ timeout: 45_000 });
    await expect(row(page, ATC.V1)).toBeVisible();
    const expected = await expectedListed();
    await expect.poll(() => shownCount(page), { message: 'VATC-01: "Showing N ATCs" == emulator count', timeout: 20_000 }).toBe(expected.length);
    const unvalidated = expected.filter(([, d]) => d.status === 'atc given').length;
    await expect(page.getByTestId('vatc-sum-total')).toHaveText(String(expected.length));
    await expect(page.getByTestId('vatc-sum-unvalidated')).toHaveText(String(unvalidated));
    await expect(page.getByTestId('vatc-sum-validated')).toHaveText(String(expected.length - unvalidated));
    // Adjustments / Change Work totals are the sums of the per-ATC counters the app reads
    const sum = (f: string) => expected.reduce((n, [, d]) => n + (d[f] || 0), 0);
    expect(sum('totaladjustment'), 'precondition: seeded counters').toBeGreaterThan(0);
    await expect(page.getByTestId('vatc-sum-adjustments')).toHaveText(String(sum('totaladjustment')));
    await expect(page.getByTestId('vatc-sum-procedures')).toHaveText(String(sum('totalprocedure')));
    await expect(page.getByTestId('vatc-loading'), 'loading bar is gone once the list has loaded').toHaveCount(0);
    // status text per collection
    await expect(row(page, ATC.A1).getByTestId('vatc-status-visible')).toBeVisible();
    await expect(row(page, ATC.V1).getByTestId('vatc-status-pending')).toBeVisible();
  });

  test('VATC-02 participant / ATC-model / date filters narrow the list to what the emulator holds', async ({ page }) => {
    await openView(page);
    await expect(row(page, ATC.A1)).toBeVisible({ timeout: 45_000 });

    // participant p3 → only EIS1
    await pickOptions(page, page.getByTestId('vatc-filter-participant'), [NAME.p3]);
    const p3 = await expectedListed((d) => d.profileid === PF.p3);
    await expect.poll(() => shownCount(page), { timeout: 20_000 }).toBe(p3.length);
    await expect(row(page, ATC.EIS1)).toBeVisible();
    await expect(row(page, ATC.A1)).toHaveCount(0);
    await page.getByTestId('vatc-clear-filter').click();
    await expect(row(page, ATC.A1)).toBeVisible({ timeout: 20_000 });

    // model beta → only beta rows
    await pickOptions(page, page.getByTestId('vatc-filter-model'), [MODEL.beta]);
    const beta = await expectedListed((d) => d.product === MODEL.beta);
    expect(beta.length, 'VATC-02: precondition — beta ATCs are seeded').toBeGreaterThan(0);
    await expect.poll(() => shownCount(page), { timeout: 20_000 }).toBe(beta.length);
    await expect(row(page, ATC.A1)).toHaveCount(0);
    await page.getByTestId('vatc-clear-filter').click();
    await expect(row(page, ATC.A1)).toBeVisible({ timeout: 20_000 });

    // date range: [day-6 00:00, day-5 00:00] — B1 was prescribed 6 days ago
    const day = (n: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    const [from, to] = [day(6), day(5)];
    await page.getByTestId('vatc-filter-start').fill(fmt(from));
    await page.getByTestId('vatc-filter-end').fill(fmt(to));
    await page.getByTestId('vatc-filter-end').blur();
    const inRange = await expectedListed((d) => { const t = d.prescription_date.toDate(); return t >= from && t <= to; });
    expect(inRange.map(([id]) => id), 'VATC-02: precondition — B1 falls in the range').toContain(ATC.B1);
    await expect.poll(() => shownCount(page), { timeout: 20_000 }).toBe(inRange.length);
    await expect(row(page, ATC.B1)).toBeVisible();
  });

  test('VATC-03 View Full ATC shows the seeded adjustments, procedures and notes', async ({ page }) => {
    await openView(page);
    const r = row(page, ATC.A1);
    await expect(r).toBeVisible({ timeout: 45_000 });
    await r.getByTestId('vatc-toggle-full').click();
    await expect(r.locator(tid('vatc-adj-0'))).toContainText(`A1 adjustment one ${RUN}`, { timeout: 20_000 });
    await expect(r.locator(tid('vatc-adj-0')).getByTestId('vatc-proc-name').first()).toContainText(PROC_NAME.one);
    await expect(r.locator(tid('vatc-adj-0')).getByTestId('vatc-proc-name').nth(1)).toContainText(PROC_NAME.two);
    await expect(r).toContainText(`A1 consultation point ${RUN}`);
    await expect(r).toContainText(`A1 case notes ${RUN}`);
    const assigned = r.locator(tid('vatc-adj-0')).getByTestId('vatc-proc-assigned').first();
    await expect(assigned).toContainText('1 assigned');
    await expect(assigned).toContainText(NAME.agent1);
  });

  test('VATC-04 Edit ATC opens /editATC/<id>/alpha in a new tab', async ({ page, context }) => {
    await openView(page);
    const r = row(page, ATC.A1);
    await expect(r).toBeVisible({ timeout: 45_000 });
    const [popup] = await Promise.all([context.waitForEvent('page'), r.getByTestId('vatc-edit').click()]);
    await popup.waitForLoadState('domcontentloaded');
    expect(new URL(popup.url()).pathname).toBe(`/editATC/${ATC.A1}/alpha`);
    await popup.close();
  });

  test('VATC-05a Mark as Validated with a validator → status validated, validator set, row leaves the list', async ({ page }) => {
    await openView(page);
    const r = row(page, ATC.V1);
    await expect(r).toBeVisible({ timeout: 45_000 });
    await r.getByTestId('vatc-mark-validated').click();
    await pickOptions(page, page.getByTestId('selv-select'), [NAME.mentor]);
    await page.getByTestId('selv-submit').click();
    const v = await waitFor(async () => { const d = await atcDoc(`atc_to_validate/${ATC.V1}`); return d?.status === 'validated' ? d : null; }, 'V1 validated');
    expect((v.validator || []).map((x: any) => x.id), 'VATC-05a: validator written').toEqual([PF.mentor]);
    await expect(r).toHaveCount(0, { timeout: 20_000 });
  });

  test('VATC-05b Mark as Validated, Close without a validator → still validated (validator optional)', async ({ page }) => {
    await openView(page);
    const r = row(page, ATC.V2);
    await expect(r).toBeVisible({ timeout: 45_000 });
    await r.getByTestId('vatc-mark-validated').click();
    await page.getByTestId('selv-close').click();
    const v = await waitFor(async () => { const d = await atcDoc(`atc_to_validate/${ATC.V2}`); return d?.status === 'validated' ? d : null; }, 'V2 validated');
    expect(v.validator, 'VATC-05b: no validator chosen → empty validator list').toEqual([]);
    await expect(r).toHaveCount(0, { timeout: 20_000 });
  });

  test('VATC-06 an eis-only user sees only ATCs they authored; Author filter disabled', async ({ page }) => {
    await openView(page, 'eis');
    await expect(row(page, ATC.EIS1)).toBeVisible({ timeout: 45_000 });
    const own = await expectedListed((d) => (d.author || []).some((a: any) => a.id === PF.eis));
    await expect.poll(() => shownCount(page), { timeout: 20_000 }).toBe(own.length);
    await expect(row(page, ATC.A1)).toHaveCount(0);
    await expect(page.getByTestId('vatc-filter-author')).toHaveAttribute('aria-disabled', 'true');
  });

  test('VATC-07 bulk Change Agent: only open procedures change, only that activity, legacy mapped, selection clears', async ({ page }) => {
    await openView(page);
    const r = row(page, ATC.B1);
    await expect(r).toBeVisible({ timeout: 45_000 });
    await r.getByTestId('vatc-toggle-full').click();
    // open = adj01 procs 1, 2, 5 (legacy); skipped = 3 completed, 4 deleted, and adj02 (deleted adjustment)
    await expect(r.getByTestId('vatc-bulk-box')).toBeVisible({ timeout: 30_000 });
    await expect(r.getByTestId('vatc-bulk-note')).toHaveText(/Applies to 3 procedures/, { timeout: 30_000 });
    const submit = r.locator(tid(`vatc-bulk-submit-${ACT.sa}`));
    await expect(submit, 'VATC-07: Submit disabled with an empty selection').toBeDisabled();

    const before = await atcDocs(`atc_alpha/${ATC.B1}/corrections/adjustment 01/procedures`);
    const beforeAdj2 = await atcDocs(`atc_alpha/${ATC.B1}/corrections/adjustment 02/procedures`);

    await pickOptions(page, r.locator(tid(`vatc-bulk-select-${ACT.sa}`)), [NAME.eis]);
    await expect(submit).toBeEnabled();
    await submit.click();

    const P = (n: number) => `adjustment 01 - ${n}`;
    const after = await waitFor(async () => {
      const docs = await atcDocs(`atc_alpha/${ATC.B1}/corrections/adjustment 01/procedures`);
      const p1 = docs.find((d) => d.id === P(1));
      return (p1?.data.bigactivity || {})[ACT.sa]?.[0] === PF.eis ? docs : null;
    }, 'bulk update landed on procedure 1');
    const byId = (docs: any[], id: string) => docs.find((d) => d.id === id).data;
    const ids = (refs: any[]) => [...new Set((refs || []).map((x: any) => x.id))].sort();

    // 1 open (CA only): SA added, CA untouched
    expect(byId(after, P(1)).bigactivity).toEqual({ [ACT.ca]: [PF.agent1], [ACT.sa]: [PF.eis] });
    expect(ids(byId(after, P(1)).assigned_to)).toEqual([PF.agent1, PF.eis].sort());
    // 2 open (CA + SA): SA replaced, CA untouched
    expect(byId(after, P(2)).bigactivity).toEqual({ [ACT.ca]: [PF.agent1], [ACT.sa]: [PF.eis] });
    expect(ids(byId(after, P(2)).assigned_to)).toEqual([PF.agent1, PF.eis].sort());
    // 3 completed, 4 deleted: untouched
    expect(byId(after, P(3))).toEqual(byId(before, P(3)));
    expect(byId(after, P(4))).toEqual(byId(before, P(4)));
    // 5 legacy (assigned_to only): legacy agent mapped under the FIRST activity (Change Agent), SA added
    expect(byId(after, P(5)).bigactivity).toEqual({ [ACT.ca]: [PF.agent2], [ACT.sa]: [PF.eis] });
    expect(ids(byId(after, P(5)).assigned_to)).toEqual([PF.agent2, PF.eis].sort());
    // deleted adjustment's procedure: untouched
    expect(await atcDocs(`atc_alpha/${ATC.B1}/corrections/adjustment 02/procedures`)).toEqual(beforeAdj2);

    // selection clears after success
    await expect.poll(() => selectText(r.locator(tid(`vatc-bulk-select-${ACT.sa}`))), { timeout: 15_000 }).toBe('');
    expect(guard.dialogs.some((m) => /^confirm: Update Support Agent to/.test(m)), 'VATC-07: confirm() named the activity').toBe(true);
  });

  test('VATC-08 mentor + queue filters narrow the list; an already-validated ATC shows its validator', async ({ page }) => {
    await openView(page);
    await expect(row(page, ATC.A1)).toBeVisible({ timeout: 45_000 });

    // M1 is the only ATC with a Mentoring activity naming the mentor; it is also already 'validated'
    await pickOptions(page, page.getByTestId('vatc-filter-mentor'), [NAME.mentor]);
    const mentored = await expectedListed((d) => (d.bigactivity?.[ACT.mentoring] || []).includes(PF.mentor));
    await expect.poll(() => shownCount(page), { timeout: 20_000 }).toBe(mentored.length);
    await expect(row(page, ATC.M1)).toBeVisible();
    await expect(row(page, ATC.A1)).toHaveCount(0);
    const validated = row(page, ATC.M1).getByTestId('vatc-status-validated');
    await expect(validated).toContainText('validated');
    await expect(validated).toContainText(NAME.mentor);
    await page.getByTestId('vatc-clear-filter').click();
    await expect(row(page, ATC.A1)).toBeVisible({ timeout: 20_000 });

    // queue → its date window + the ATC model of its arena event's product → only Q1
    await pickOptions(page, page.getByTestId('vatc-filter-queue'), [QUEUE_NAME]);
    const q = (await defaultQueue());
    const inQueue = await expectedListed((d) => {
      const t = d.prescription_date.toDate();
      return d.product === MODEL.beta && t >= q.start && t <= q.end;
    });
    expect(inQueue.map(([id]) => id), 'precondition: Q1 is inside the queue window').toEqual([ATC.Q1]);
    await expect.poll(() => shownCount(page), { timeout: 20_000 }).toBe(1);
    await expect(row(page, ATC.Q1)).toBeVisible();
  });
});
