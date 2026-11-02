// atc-form-web-link.spec.ts — a participant / sponsor fills an ATC form in WEB from a link the specialist
// copies (WL-01..08), EMULATOR ONLY. Hook prefixes: vatc (View Prescribed ATC), for + ftp (the form screen
// and its preview dialog). Plan: specs/plans/2026-11-02-atc-form-web-link.md (app repo).
//
// World (seed-atc.js phase 9): twp is the participant, tws the sponsor, WL_MODEL has a participant form
// (part), a sponsor form (spon) and one already answered (edit). Four ATCs, one per request state —
// NEW (sent, no answerid), EDIT (sent, answerid), SPON (sponsor, sent), DONE (already submitted).
//
// What these cases pin: the link authorises from the atc_form_requests doc and the LOGIN, never from the URL;
// `formstatus` gates it and is closed on submit so the link is single-use; `answerid` makes it an edit through
// the existing patchdata workflow; and the draft carries the atcid so two ATCs of one form don't share it.
import { test, expect, Page } from '@playwright/test';
import {
  PF, EMAIL, RUN, DF_QUESTION, WLF, WLF_NAME, WLATC, WL_ANS, WL_TEXT,
  installAtcGuards, assertNoRealDb, loginAsAtc, atcDoc, formsDb, waitFor, pickOptions, tid, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

/** The link the Copy button builds: the request id, plus the same params the specialist's link carries. */
function linkFor(atcid: string, formid: string, extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ request: `${atcid}_${formid}`, id: formid, type: 'form', atcid, ...extra });
  return `/formtemplate?${p.toString()}`;
}
const requestDoc = (atcid: string, formid: string) => atcDoc(`atc_form_requests/${atcid}_${formid}`);
const answerDoc = async (id: string) => (await formsDb().collection('formsByClient').doc(id).get()).data();
const valueOf = (d: any) => d?.formarray?.find((f: any) => f.fieldname === DF_QUESTION)?.value;

/** Opens a link and returns the alert text the screen refused it with (null when it let us in). */
async function refusalFrom(page: Page, url: string): Promise<string | null> {
  let message: string | null = null;
  page.once('dialog', (d) => { message = d.message(); d.dismiss().catch(() => {}); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Settle on one of the two real outcomes: the screen refused us (alert, then home), or it let us in and
  // rendered the form. Checking the URL instead would pass instantly — goto has already put us on the link.
  await expect(async () => {
    const letIn = await page.locator('.form-content input').first().isVisible().catch(() => false);
    expect(message !== null || letIn).toBe(true);
  }).toPass({ timeout: 30_000 });
  return message;
}

async function fillAndSubmit(page: Page, text: string, button: 'for-on-submit-15' | 'for-on-update-16') {
  const input = page.locator('.form-content input').first();
  await expect(input).toBeVisible({ timeout: 45_000 });
  await input.fill(text);
  await page.getByTestId(button).click();
  await page.getByTestId('ftp-on-confirm-2').click();
}

test.describe('ATC — participant / sponsor form fill in web (emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'atc form web link: no fatal console errors');
  });

  test('WL-01 the specialist sees Copy link beside Withdraw on a pending request, and it copies the request link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await loginAsAtc(page, 'admin');
    await page.goto('/viewprescribedATC');
    await expect(page.getByTestId('vatc-count')).toBeVisible({ timeout: 45_000 });
    // the list is long: filter to this participant first, as every other View ATC case does
    await pickOptions(page, page.getByTestId('vatc-filter-participant'), [EMAIL.twp]);
    const row = page.locator(tid(`vatc-row-${WLATC.OTHER}`));
    await expect(row).toBeVisible({ timeout: 45_000 });
    await row.getByTestId('vatc-toggle-full').click();
    await expect(row.getByTestId('vatc-forms-card')).toBeVisible({ timeout: 30_000 });

    const part = row.getByTestId('vatc-form-row').filter({ hasText: WLF_NAME.part });
    await expect(part.getByTestId('vatc-form-status')).toHaveText('Waiting for participant');
    await expect(part.locator('.form-actions button'), 'Copy link sits beside Withdraw').toHaveText(['Copy link', 'Withdraw']);

    await part.getByTestId('vatc-form-copy').click();
    const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    expect(copied.pathname).toBe('/formtemplate');
    expect(Object.fromEntries(copied.searchParams)).toEqual({
      request: `${WLATC.OTHER}_${WLF.part}`, id: WLF.part, type: 'form', atcid: WLATC.OTHER,
    });

    // a submitted request offers neither button, so there is no link to hand out
    const done = page.locator(tid(`vatc-row-${WLATC.DONE}`));
    await done.getByTestId('vatc-toggle-full').click();
    await expect(done.getByTestId('vatc-forms-card')).toBeVisible({ timeout: 30_000 });
    await expect(done.getByTestId('vatc-form-copy'), 'nothing to copy once submitted').toHaveCount(0);
  });

  test('WL-02 participant: fills from the link, answer is theirs and tagged participant, ATC + request updated, lands on the dashboard', async ({ page }) => {
    await loginAsAtc(page, 'twp');
    await page.goto(linkFor(WLATC.NEW, WLF.part));
    const text = `Participant web answer ${RUN}`;
    await fillAndSubmit(page, text, 'for-on-submit-15');

    const atc = await waitFor(async () => {
      const d = await atcDoc(`atc_alpha/${WLATC.NEW}`);
      return d?.formsubmitted?.[WLF.part] ? d : null;
    }, 'formsubmitted recorded on the ATC');
    const answer = await answerDoc(atc.formsubmitted[WLF.part]);
    expect(valueOf(answer)).toBe(text);
    expect(answer.formid).toBe(WLF.part);
    expect(answer.atcid).toBe(WLATC.NEW);
    expect(answer.filledby, 'the request tag, not specialist').toBe('participant');
    expect(answer.profileid, 'the logged-in participant').toBe(PF.twp);
    expect(answer.submittedin).toBe('starlabs');
    expect(answer.delete, 'the draft flag must not reach the answer').toBeUndefined();

    const request = await waitFor(async () => {
      const d = await requestDoc(WLATC.NEW, WLF.part);
      return d?.formstatus === 'submitted' ? d : null;
    }, 'request closed');
    expect(request.formstatus).toBe('submitted');

    await page.waitForURL(/EISDashboard/, { timeout: 30_000 });
    const drafts = await formsDb().collection('temporary_forms').where('atcid', '==', WLATC.NEW).get();
    expect(drafts.size, 'the draft is gone once the answer is recorded').toBe(0);
  });

  test('WL-03 the link is single-use: re-opening it after submitting is refused', async ({ page }) => {
    await loginAsAtc(page, 'twp');
    expect(await refusalFrom(page, linkFor(WLATC.DONE, WLF.part))).toContain('already been submitted');
    await page.waitForURL(/EISDashboard/, { timeout: 30_000 });
  });

  test('WL-04 someone else\'s link is refused, even for a valid participant', async ({ page }) => {
    await loginAsAtc(page, 'tws');   // the sponsor opening the participant's link
    expect(await refusalFrom(page, linkFor(WLATC.OTHER, WLF.part))).toContain('sent to someone else');
    await page.waitForURL(/EISDashboard/, { timeout: 30_000 });
    expect((await requestDoc(WLATC.OTHER, WLF.part)).formstatus, 'untouched').toBe('sent');
  });

  test('WL-05 a withdrawn request (no doc) is refused', async ({ page }) => {
    await loginAsAtc(page, 'twp');
    expect(await refusalFrom(page, linkFor(WLATC.OTHER, WLF.spon))).toContain('no longer valid');
    await page.waitForURL(/EISDashboard/, { timeout: 30_000 });
  });

  test('WL-06 sponsor: fills from their own link, answer tagged sponsor under their profile', async ({ page }) => {
    await loginAsAtc(page, 'tws');
    await page.goto(linkFor(WLATC.SPON, WLF.spon));
    const text = `Sponsor web answer ${RUN}`;
    await fillAndSubmit(page, text, 'for-on-submit-15');

    const atc = await waitFor(async () => {
      const d = await atcDoc(`atc_alpha/${WLATC.SPON}`);
      return d?.formsubmitted?.[WLF.spon] ? d : null;
    }, 'sponsor answer recorded');
    const answer = await answerDoc(atc.formsubmitted[WLF.spon]);
    expect(valueOf(answer)).toBe(text);
    expect(answer.filledby).toBe('sponsor');
    expect(answer.profileid, 'the sponsor, not the participant').toBe(PF.tws);
    expect((await requestDoc(WLATC.SPON, WLF.spon)).formstatus).toBe('submitted');
  });

  test('WL-07 answerid on the request: the saved answer opens prefilled and the SAME doc is updated', async ({ page }) => {
    await loginAsAtc(page, 'twp');
    await page.goto(linkFor(WLATC.EDIT, WLF.edit, { patchdata: `formsByClient/${WL_ANS.edit}` }));

    const input = page.locator('.form-content input').first();
    await expect(input, 'prefilled from the answer the request points at').toHaveValue(WL_TEXT(WL_ANS.edit), { timeout: 45_000 });
    await expect(page.getByTestId('for-on-submit-15'), 'an edit has no new-submit button').toHaveCount(0);

    const edited = `Participant web edit ${RUN}`;
    await fillAndSubmit(page, edited, 'for-on-update-16');

    const answer = await waitFor(async () => {
      const d = await answerDoc(WL_ANS.edit);
      return valueOf(d) === edited ? d : null;
    }, 'the same answer doc updated');
    expect(answer.filledby, 'an edit leaves the tag alone').toBe('participant');
    expect((await atcDoc(`atc_alpha/${WLATC.EDIT}`)).formsubmitted, 'still the same answer id')
      .toEqual({ [WLF.edit]: WL_ANS.edit });
    const logs = await formsDb().collection('formsByClient log').where('docid', '==', WL_ANS.edit).get();
    expect(logs.docs.map((d) => valueOf(d.data())), 'the replaced answer kept in the log').toContain(WL_TEXT(WL_ANS.edit));
    const extra = await formsDb().collection('formsByClient').where('atcid', '==', WLATC.EDIT).get();
    expect(extra.size, 'no second answer created').toBe(1);
    expect((await requestDoc(WLATC.EDIT, WLF.edit)).formstatus).toBe('submitted');
  });

  test('WL-08 the draft of an ATC form carries its atcid and delete:false, and is offered back on a reopen', async ({ page }) => {
    // Locally every suite shares one emulator (CI gives each run a fresh one), so a draft left by an earlier
    // run would open the draft picker instead of a blank form. Clear this pair first, then expect exactly one.
    const stale = await formsDb().collection('temporary_forms').where('atcid', '==', WLATC.DRAFT).get();
    for (const d of stale.docs) await d.ref.delete();

    await loginAsAtc(page, 'twp');
    await page.goto(linkFor(WLATC.DRAFT, WLF.part));
    const typed = `Draft in progress ${RUN}`;
    const input = page.locator('.form-content input').first();
    await expect(input).toBeVisible({ timeout: 45_000 });
    // A text field autosaves on (keyup) (formtemplate.component.html:183), so the draft has to be TYPED —
    // fill() dispatches input/change only and would leave the status on "Draft not saved yet".
    await input.pressSequentially(typed, { delay: 15 });
    await input.blur();

    const draft = await waitFor(async () => {
      const s = await formsDb().collection('temporary_forms').where('atcid', '==', WLATC.DRAFT).get();
      if (!s.size) return null;
      expect(s.size, 'one draft per fill').toBe(1);
      return s.docs[0].data();
    }, 'draft written with its atcid', 60_000);
    expect(draft.atcid, 'scoped to this ATC so two ATCs of one form never share a draft').toBe(WLATC.DRAFT);
    expect(draft.delete, 'what the app\'s draft query filters on').toBe(false);
    expect(draft.profileid).toBe(PF.twp);
    expect(draft.formid).toBe(WLF.part);
    expect(valueOf(draft)).toBe(typed);
  });
});
