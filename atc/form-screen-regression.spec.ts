// form-screen-regression.spec.ts — the form screen's OTHER systems still behave after the ATC web-link change
// (FSR-01..02), EMULATOR ONLY. Hook prefix: for (the form screen). Plan:
// specs/plans/2026-11-02-atc-form-web-link.md (app repo).
//
// WHY this lives here and not in the queue suite: the web-link change touches exactly two lines that are NOT
// behind `if (this.atcFormRequest)` — the draft payload in _performAutoSave and the atcid filter in
// getFormsOption. Both are on /formtemplate, which this suite owns. Driving the screen with queue and B!G
// params exercises them without booting the queue suite's Cloud Functions.
//
// What would break if the change were wrong: a queue or B!G draft losing its ids, a draft written before the
// change no longer being offered (Firestore `== null` matches only docs that HAVE the field), or the
// `?profileid=` on-behalf lever being overridden for systems that still rely on it.
import { test, expect, Page } from '@playwright/test';
import {
  PF, RUN, DQ, PA, DF_QUESTION,
  installAtcGuards, assertNoRealDb, loginAsAtc, formsDb, waitFor, AtcGuard,
} from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const valueOf = (d: any) => d?.formarray?.find((f: any) => f.fieldname === DF_QUESTION)?.value;

/** Locally all suites share one emulator, so a case clears its own drafts before counting them. */
async function clearDrafts(formid: string, profileid: string) {
  const s = await formsDb().collection('temporary_forms').where('formid', '==', formid).where('profileid', '==', profileid).get();
  for (const d of s.docs) await d.ref.delete();
}

/** A text field autosaves on (keyup) (formtemplate.component.html:183), so a draft has to be TYPED. */
async function typeFirstField(page: Page, text: string) {
  const input = page.locator('.form-content input').first();
  await expect(input).toBeVisible({ timeout: 45_000 });
  await input.pressSequentially(text, { delay: 15 });
  await input.blur();
}

async function draftFor(formid: string, profileid: string) {
  return waitFor(async () => {
    const s = await formsDb().collection('temporary_forms').where('formid', '==', formid).where('profileid', '==', profileid).get();
    if (!s.size) return null;
    expect(s.size, 'one draft per fill').toBe(1);
    return s.docs[0].data();
  }, `draft for ${formid}`, 60_000);
}

test.describe('Form screen — queue and B!G regression after the ATC web link (emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'form screen regression: no fatal console errors');
  });

  test('FSR-01 a queue form still drafts with its queueid, no atcid, and the draft is still offered on a reopen', async ({ page }) => {
    await clearDrafts(DQ.form, PF.tfp);
    await loginAsAtc(page, 'tfp');
    const url = `/formtemplate?id=${DQ.form}&type=form&queueid=${DQ.queue}`;
    await page.goto(url);
    const typed = `Queue draft ${RUN}`;
    await typeFirstField(page, typed);

    const draft = await draftFor(DQ.form, PF.tfp);
    expect(valueOf(draft)).toBe(typed);
    expect(draft.queueid, 'the queue id the screen was opened for').toBe(DQ.queue);
    expect(draft.atcid, 'a queue form has no ATC').toBeNull();
    expect(draft.delete, 'written so the app can see web drafts too').toBe(false);

    // the atcid filter is conditional: without an atcid the query must still find this draft
    await page.goto(url);
    await expect(page.getByTestId('for-select-draft-1'), 'the saved draft is offered back').toBeVisible({ timeout: 45_000 });
  });

  test('FSR-02 a B!G activity form still drafts on behalf of the participant, not the signed-in staff', async ({ page }) => {
    await clearDrafts(DQ.form, PF.trp);
    await loginAsAtc(page, 'admin');
    await page.goto(`/formtemplate?id=${DQ.form}&type=form&queueid=${PA.trpRework}`
      + `&profileid=${PF.trp}&participantAssignmentId=${PA.trpRework}&source=participant`);
    const typed = `BIG activity draft ${RUN}`;
    await typeFirstField(page, typed);

    const draft = await draftFor(DQ.form, PF.trp);
    expect(valueOf(draft)).toBe(typed);
    expect(draft.profileid, 'on behalf of trp, not the admin who is signed in').toBe(PF.trp);
    expect(draft.profileid).not.toBe(PF.admin);
    expect(draft.atcid, 'not an ATC form').toBeNull();
    expect(draft.delete).toBe(false);
  });
});
