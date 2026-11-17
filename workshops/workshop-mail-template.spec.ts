// workshop-mail-template.spec.ts — /workshopconfig/:id → Settings → Mail template → "Email template":
// pick an active, approved `email templates` doc and choose what fills each of its variables.
//
// Recon: starlabs-angular specs/plans/2026-11-17-workshop-mail-template-mapping.md (operator's request and
// the "map by variable" shape chosen in chat), src/app/New-Workshop/workshop-configurationv2/settings/
// mail-template-map.ts (helpers) and the "Mail template · email template" section of
// workshop-settingsv2.component.ts.
//
// Hooks — one prefix per component:
//   `ws`  = New-Workshop/workshop-configurationv2/settings/workshop-settingsv2.component.html  (under test)
//   `wc2` = New-Workshop/workshop-configurationv2/workshop-configurationv2.component.html      (leave dialog)
// Every case keys on the ws-mail-* hooks that land with this feature, so the hub-ahead guard
// (scripts/readiness/landed-specs.cjs) skips this whole file on app branches that predate it. That is why
// these cases live in their own file and not in workshop-dashboard-access.spec.ts.
//
// THE STORED SHAPE (workshopsettings/{workshop id}, written with setDoc + mergeFields ['workshopid','mail']):
//   mail: { templateid: <email templates doc id>,
//           emailData: { <variable>: { type: 'name'|'workshopname'|'workshopurl' }
//                                  | { type: 'static', value: <text> } } }
//
// The seeded world (support/wshop.ts → wsMail), all run-tagged and removed in afterAll:
//   · a workshop of our own (copy of W_INACTIVE) whose workshopsettings doc carries a Dashboard Access map,
//     so every save can be checked for leaving that map — and workshopconfiguration — alone;
//   · six templates: welcome (active+approved; 'name' twice and a #each/each section in its model),
//     reminder (active+approved; shares 'name'), plain (active+approved; no variables), nomodel
//     (active+approved with NO templatemodel field — the shape communication.component.ts writes), and two
//     NEGATIVE controls whose names also say "Reminder" — pending (active, postmark pending) and retired
//     (approved, inactive) — so a search for "reminder" would show them if the filter let them through.
//   · two stored ids that resolve to nothing: `gone` (a deleted template) and `unreadableId` (an id the app
//     cannot read at all), so both failure shapes of the saved-template read are driven for real.
//
// Anti-circularity:
//   · The picker list is compared with the TEST's own query of `email templates` (active == true, then
//     postmarkstatus 'approved'), which also covers other suites' docs in the shared emulator.
//   · Writes are read back out of Firestore with the admin SDK and compared with the choices the test made
//     in the UI (WMT-04/06/07/10); nothing seeded is ever the value a write case asserts.
//   · The read path is checked against SEEDED shapes the UI never wrote (WMT-05/08/09), so a bug that
//     wrote and read the same wrong thing cannot pass both halves.
import { test, expect, Page, Locator } from '@playwright/test';
import {
  wsMail, wsMailAccess, installWshopStubs, loginAsWshopAdmin,
  seedMailWorkshop, seedMailTemplates, resetMailSettings, setMailTemplateActive,
  workshopSettingsDoc, workshopConfigStamp, activeApprovedTemplateNames, cleanMailWorld,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { pollUntil } from '../queue/support/firestore-admin';

const RUN = process.env.WSHOP_RUNID || 'wshop';
const W = wsMail.workshopId;
const N = wsMail.names;
const SOURCES = ['Name', 'Workshop name', 'Workshop URL', 'Static value'];
const BLOCKED_NEW = 'Save the Enrollment page first — it creates the workshop';

const byName = (a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase());
const exact = (s: string) => new RegExp(`^\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);

/** Open the workshop editor's Settings tab and wait for the Email template block to finish loading. */
async function openMailSection(page: Page, workshopId: string = W): Promise<void> {
  await page.goto(`/workshopconfig/${workshopId}`, { waitUntil: 'domcontentloaded' });
  const settingsTab = page.locator('.tabs .tab', { hasText: 'Settings' });
  await expect(settingsTab, 'the Settings tab must render for someone who can edit').toBeVisible({ timeout: 30_000 });
  await settingsTab.click();
  const block = page.getByTestId('ws-mail-map');
  await expect(block, 'the Email template block sits at the end of the Mail template section').toBeVisible({ timeout: 30_000 });
  await block.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('ws-mail-template-pick'), 'the saved choice must finish loading').toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ws-mail-loading'), 'the loading line goes once the saved choice is read').toHaveCount(0);
}

const counter = (page: Page) => page.getByTestId('ws-mail-map').locator('.mt-head .counter');
const option = (page: Page, name: string) => page.getByTestId('ws-mail-template-option').filter({ hasText: name });

async function optionNames(page: Page): Promise<string[]> {
  return (await page.getByTestId('ws-mail-template-option').locator('.n').allTextContents()).map(s => s.trim());
}

/** Open the template picker and wait for its list (read on first open). */
async function openPicker(page: Page): Promise<void> {
  await page.getByTestId('ws-mail-template-pick').click();
  await expect(page.getByTestId('ws-mail-template-pop'), 'the picker opens').toBeVisible();
  await expect(page.getByTestId('ws-mail-template-option').first(), 'the picker lists templates').toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ws-mail-templates-loading'), 'the list has finished loading').toHaveCount(0);
}

/** Pick a template by its name, through the search box. */
async function pickTemplate(page: Page, name: string): Promise<void> {
  await openPicker(page);
  await page.getByTestId('ws-mail-template-search').fill(name);
  const opt = option(page, name);
  await expect(opt, `"${name}" must be offered`).toHaveCount(1);
  await opt.click();
  await expect(page.getByTestId('ws-mail-template-pop'), 'picking closes the picker').toHaveCount(0);
  await expect(page.getByTestId('ws-mail-template-pick'), 'the picker shows the chosen name').toContainText(name);
}

/** One variable's row, matched on its whole `{{variable}}` token. */
const varRow = (page: Page, v: string): Locator => page.getByTestId('ws-mail-var-row')
  .filter({ has: page.getByTestId('ws-mail-var-name').filter({ hasText: exact(`{{${v}}}`) }) });

/** Choose what fills a variable, by the option's on-screen label. */
async function chooseSource(page: Page, v: string, label: string): Promise<void> {
  const row = varRow(page, v);
  await row.getByTestId('ws-mail-var-pick').click();
  await row.getByTestId('ws-mail-var-option').filter({ hasText: exact(label) }).click();
  await expect(row.getByTestId('ws-mail-var-option'), 'choosing closes the menu').toHaveCount(0);
  await expect(row.getByTestId('ws-mail-var-pick'), `{{${v}}} shows "${label}"`).toHaveText(exact(label));
}

/** The welcome template, filled the way the plan's example is. */
async function fillWelcome(page: Page, signoff = 'Team A&H'): Promise<void> {
  await chooseSource(page, 'name', 'Name');
  await chooseSource(page, 'workshop', 'Workshop name');
  await chooseSource(page, 'workshop_link', 'Workshop URL');
  await chooseSource(page, 'signoff', 'Static value');
  await varRow(page, 'signoff').getByTestId('ws-mail-var-static').fill(signoff);
}

const WELCOME_SAVED = {
  templateid: wsMail.tpl.welcome,
  emailData: {
    name: { type: 'name' },
    workshop: { type: 'workshopname' },
    workshop_link: { type: 'workshopurl' },
    signoff: { type: 'static', value: 'Team A&H' },
  },
};

/** Wait for the app's write of `mail` to satisfy `ok`, and return it. */
async function storedMail(label: string, ok: (m: any) => boolean): Promise<any> {
  return pollUntil(async () => (await workshopSettingsDoc(W))?.mail, (m: any) => ok(m), { timeoutMs: 30_000, label });
}

test.describe('Workshop Settings — email template mapping (real UI, Firestore oracle)', () => {
  let guard: ConsoleGuard;
  test.beforeAll(async () => {
    await cleanMailWorld();
    await seedMailWorkshop();
  });
  test.beforeEach(async ({ page }) => {
    await seedMailTemplates();
    await resetMailSettings();
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'email template mapping: no fatal console errors / pageerrors'));
  test.afterAll(async () => { await cleanMailWorld(); });

  // ===========================================================================================
  // WMT-01 — the picker offers exactly the active, approved templates; search narrows; no match says so
  // ===========================================================================================
  test('WMT-01 only active, approved templates are offered; search narrows by name; an empty search result is labelled', async ({ page }) => {
    const expected = (await activeApprovedTemplateNames()).sort(byName);
    expect(expected, 'WMT-01: precondition — the three positives are active and approved').toEqual(expect.arrayContaining([N.welcome, N.reminder, N.plain]));
    expect(expected, 'WMT-01: precondition — pending is not approved').not.toContain(N.pending);
    expect(expected, 'WMT-01: precondition — retired is not active').not.toContain(N.retired);

    await loginAsWshopAdmin(page);
    await openMailSection(page);

    // [REAL-UI] nothing chosen yet: a placeholder, no counter, no rows, nothing to save or remove.
    await expect(page.getByTestId('ws-mail-template-pick')).toContainText('Choose a template');
    await expect(counter(page), 'WMT-01: no counter before a template is chosen').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-vars')).toHaveCount(0);
    await expect(page.getByTestId('ws-mail-template-remove'), 'WMT-01: nothing to remove').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-dirty')).toHaveCount(0);
    await expect(page.getByTestId('ws-mail-save'), 'WMT-01: nothing to save').toBeDisabled();

    await openPicker(page);
    const shown = await optionNames(page);
    // [ASSERT] the list is the test's own active+approved population — no more, no less.
    expect([...shown].sort(byName), 'WMT-01: the picker offers exactly the active, approved templates').toEqual(expected);
    expect(shown, 'WMT-01: an active template Postmark has not approved is not offered').not.toContain(N.pending);
    expect(shown, 'WMT-01: an approved template that is no longer active is not offered').not.toContain(N.retired);
    // [ASSERT] sorted by name: our three appear in alphabetical order.
    const at = [N.welcome, N.reminder, N.plain].map(n => shown.indexOf(n));
    expect(at, 'WMT-01: options are in name order').toEqual([...at].sort((a, b) => a - b));
    // [ASSERT] each option counts its DISTINCT variables; control tags are not variables.
    await expect(option(page, N.welcome).locator('.c'), 'WMT-01: welcome has 4 distinct variables').toHaveText('4 variables');
    await expect(option(page, N.reminder).locator('.c')).toHaveText('2 variables');
    await expect(option(page, N.plain).locator('.c')).toHaveText('0 variables');
    // [ASSERT] a template with no variable list at all is not passed off as having none.
    await expect(option(page, N.nomodel).locator('.c'), 'WMT-01: unrecorded variables are said, not shown as 0').toHaveText('Variables not recorded');

    // [REAL-UI] search narrows by name, case-insensitively.
    const search = page.getByTestId('ws-mail-template-search');
    await search.fill('REMINDER');
    const narrowed = expected.filter(n => n.toLowerCase().includes('reminder'));
    await expect(page.getByTestId('ws-mail-template-option'), 'WMT-01: search narrows the list').toHaveCount(narrowed.length);
    const afterSearch = await optionNames(page);
    expect([...afterSearch].sort(byName)).toEqual(narrowed);
    expect(afterSearch, 'WMT-01: the matching approved template stays').toContain(N.reminder);
    expect(afterSearch, 'WMT-01: a template whose name does not match goes').not.toContain(N.welcome);
    expect(afterSearch, 'WMT-01: the pending negative matches the search and is still not offered').not.toContain(N.pending);
    expect(afterSearch, 'WMT-01: the inactive negative matches the search and is still not offered').not.toContain(N.retired);

    // [REAL-UI] a search nothing matches says so.
    await search.fill(`zz no such template ${RUN}`);
    await expect(page.getByTestId('ws-mail-template-option')).toHaveCount(0);
    await expect(page.getByTestId('ws-mail-template-empty'), 'WMT-01: no match is labelled').toHaveText('No template matches.');
    await search.fill('');
    await expect(page.getByTestId('ws-mail-template-option'), 'WMT-01: clearing the search restores the list').toHaveCount(expected.length);
    await expect(page.getByTestId('ws-mail-template-empty')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('ws-mail-template-pop'), 'WMT-01: Escape closes the picker').toHaveCount(0);
    // [ASSERT] browsing writes nothing.
    expect((await workshopSettingsDoc(W))?.mail, 'WMT-01: opening the picker stores nothing').toBeUndefined();
  });

  // ===========================================================================================
  // WMT-02 — one row per distinct variable, four sources each, Static value brings a textarea
  // ===========================================================================================
  test('WMT-02 picking a template lists one row per distinct variable with the four sources; Static value shows a textarea', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openMailSection(page);
    await pickTemplate(page, N.welcome);

    // [ASSERT] 'name' appears twice in the model and '#each items' / '/each' are control tags: 4 rows, in order.
    await expect(page.getByTestId('ws-mail-vars')).toBeVisible();
    await expect(page.getByTestId('ws-mail-var-row'), 'WMT-02: one row per distinct variable').toHaveCount(wsMail.welcomeVars.length);
    await expect(page.getByTestId('ws-mail-var-name'), 'WMT-02: rows follow the template order, written as tokens')
      .toHaveText(wsMail.welcomeVars.map(v => `{{${v}}}`));
    await expect(page.getByTestId('ws-mail-var-pick'), 'WMT-02: nothing is chosen yet').toHaveText(Array(4).fill('Choose…'));
    await expect(counter(page)).toHaveText('0 of 4 set');
    await expect(page.getByTestId('ws-mail-no-vars'), 'WMT-02: a template with variables is not labelled empty').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-var-static')).toHaveCount(0);

    // [ASSERT] every row offers exactly the four sources, in this order.
    for (const v of wsMail.welcomeVars) {
      const row = varRow(page, v);
      await row.getByTestId('ws-mail-var-pick').click();
      await expect(row.getByTestId('ws-mail-var-option'), `WMT-02: {{${v}}} offers the four sources`).toHaveText(SOURCES);
      await page.keyboard.press('Escape');
      await expect(row.getByTestId('ws-mail-var-option')).toHaveCount(0);
    }

    // [REAL-UI] Static value opens a textarea on that row only.
    await chooseSource(page, 'signoff', 'Static value');
    await expect(varRow(page, 'signoff').getByTestId('ws-mail-var-static'), 'WMT-02: Static value shows a textarea').toBeVisible();
    await expect(page.getByTestId('ws-mail-var-static'), 'WMT-02: only on the static row').toHaveCount(1);
    await expect(counter(page), 'WMT-02: a Static value with no text is not set yet').toHaveText('0 of 4 set');
    await varRow(page, 'signoff').getByTestId('ws-mail-var-static').fill('   ');
    await expect(counter(page), 'WMT-02: spaces are no text').toHaveText('0 of 4 set');
    await varRow(page, 'signoff').getByTestId('ws-mail-var-static').fill('Bye');
    await expect(counter(page), 'WMT-02: with text it counts').toHaveText('1 of 4 set');

    // [REAL-UI] a non-static source explains itself instead.
    await chooseSource(page, 'name', 'Name');
    await expect(varRow(page, 'name').getByTestId('ws-mail-var-static')).toHaveCount(0);
    await expect(varRow(page, 'name').locator('.mt-value'), 'WMT-02: the source hint replaces the textarea').toHaveText("The person's name");
    await expect(counter(page)).toHaveText('2 of 4 set');

    // [REAL-UI] moving the static row to another source takes its textarea away.
    await chooseSource(page, 'signoff', 'Workshop URL');
    await expect(page.getByTestId('ws-mail-var-static'), 'WMT-02: no static row, no textarea').toHaveCount(0);
    await expect(counter(page)).toHaveText('2 of 4 set');

    await expect(page.getByTestId('ws-mail-dirty'), 'WMT-02: the edit is flagged as unsaved').toBeVisible();
    await expect(page.getByTestId('ws-mail-template-remove'), 'WMT-02: a chosen template can be removed').toBeVisible();
    expect((await workshopSettingsDoc(W))?.mail, 'WMT-02: nothing is stored before Save').toBeUndefined();
  });

  // ===========================================================================================
  // WMT-03 — Save waits for a complete mapping; spaces are not text
  // ===========================================================================================
  test('WMT-03 Save stays disabled, saying why, until every variable is chosen and every static value has text', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openMailSection(page);
    await pickTemplate(page, N.welcome);

    const save = page.getByTestId('ws-mail-save');
    const blocker = page.getByTestId('ws-mail-blocker');
    await expect(save).toBeDisabled();
    await expect(blocker, 'WMT-03: four unchosen variables').toHaveText('Choose a value for 4 variables');

    await chooseSource(page, 'name', 'Name');
    await expect(blocker).toHaveText('Choose a value for 3 variables');
    await chooseSource(page, 'workshop', 'Workshop name');
    await expect(blocker).toHaveText('Choose a value for 2 variables');
    await chooseSource(page, 'workshop_link', 'Workshop URL');
    await expect(blocker, 'WMT-03: singular for one').toHaveText('Choose a value for 1 variable');
    await expect(save).toBeDisabled();

    await chooseSource(page, 'signoff', 'Static value');
    await expect(blocker, 'WMT-03: every variable chosen, but the static text is empty').toHaveText('Type the text for 1 static value');
    await expect(save).toBeDisabled();

    const text = varRow(page, 'signoff').getByTestId('ws-mail-var-static');
    await text.fill('   ');
    await expect(blocker, 'WMT-03: spaces only is still no text').toHaveText('Type the text for 1 static value');
    await expect(save, 'WMT-03: spaces only does not unlock Save').toBeDisabled();

    await text.fill('Team A&H');
    await expect(blocker, 'WMT-03: nothing is missing').toHaveCount(0);
    await expect(save, 'WMT-03: a complete mapping can be saved').toBeEnabled();

    await text.fill('');
    await expect(blocker, 'WMT-03: emptying the text blocks Save again').toHaveText('Type the text for 1 static value');
    await expect(save).toBeDisabled();
    expect((await workshopSettingsDoc(W))?.mail, 'WMT-03: nothing is stored without Save').toBeUndefined();
  });

  // ===========================================================================================
  // WMT-04 — the WRITE: the stored map is exactly the choices; neighbours untouched; reads back
  // ===========================================================================================
  test('WMT-04 Save stores exactly the chosen map, leaves Dashboard Access and the workshop alone, and reads back after reload', async ({ page }) => {
    const before = await workshopConfigStamp(W);
    expect(before.exists, 'WMT-04: precondition — the workshop document exists').toBe(true);

    await loginAsWshopAdmin(page);
    await openMailSection(page);
    await pickTemplate(page, N.welcome);
    await fillWelcome(page);
    await expect(page.getByTestId('ws-mail-dirty')).toBeVisible();
    await page.getByTestId('ws-mail-save').click();

    // [REAL-UI] the block confirms and settles.
    await expect(page.getByTestId('ws-mail-saved'), 'WMT-04: the block says it saved').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ws-mail-dirty')).toHaveCount(0);
    await expect(page.getByTestId('ws-mail-save'), 'WMT-04: nothing left to save').toBeDisabled();
    await expect(page.getByTestId('ws-mail-save-error'), 'WMT-04: no save error').toHaveCount(0);

    // [ASSERT] the APP's write, read back with the admin SDK, against the choices made above.
    const mail = await storedMail('WMT-04 app write of mail', m => !!m?.templateid);
    expect(mail, 'WMT-04: the stored map is exactly the choices').toEqual(WELCOME_SAVED);
    expect(Object.keys(mail).sort(), 'WMT-04: mail holds templateid and emailData only').toEqual(['emailData', 'templateid']);
    expect(Object.keys(mail.emailData).sort(), 'WMT-04: one entry per distinct variable').toEqual([...wsMail.welcomeVars].sort());
    for (const v of ['name', 'workshop', 'workshop_link']) {
      expect(Object.keys(mail.emailData[v]), `WMT-04: {{${v}}} carries no value`).toEqual(['type']);
    }

    // [ASSERT] the rest of workshopsettings/{id} survives the save (mergeFields).
    const settings = await workshopSettingsDoc(W);
    expect(settings.dashboardaccess, 'WMT-04: Dashboard Access in the same document is unchanged').toEqual(wsMailAccess);
    expect(settings.workshopid, 'WMT-04: the document names its workshop').toBe(W);
    expect(settings.testrunid, 'WMT-04: a field outside the merge survives').toBe(RUN);
    // [ASSERT] the workshop document itself was not written.
    const after = await workshopConfigStamp(W);
    expect(after.updated, 'WMT-04: workshopconfiguration was not written').toBe(before.updated);
    expect(after.data, 'WMT-04: workshopconfiguration is unchanged').toEqual(before.data);

    // [REAL-UI] reload: the saved choice is drawn back from Firestore.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.tabs .tab', { hasText: 'Settings' }).click();
    await expect(page.getByTestId('ws-mail-template-pick'), 'WMT-04: the saved template is shown by name')
      .toContainText(N.welcome, { timeout: 30_000 });
    await expect(page.getByTestId('ws-mail-var-pick')).toHaveText(['Name', 'Workshop name', 'Workshop URL', 'Static value']);
    await expect(varRow(page, 'signoff').getByTestId('ws-mail-var-static')).toHaveValue('Team A&H');
    await expect(counter(page)).toHaveText('4 of 4 set');
    // [ASSERT] a screen reader hears the field and the current choice, not just the variable.
    await expect(page.getByTestId('ws-mail-template-pick'), 'WMT-04: the picker is named').toHaveAttribute('aria-label', `Email template: ${N.welcome}`);
    await expect(varRow(page, 'workshop_link').getByTestId('ws-mail-var-pick'), 'WMT-04: the variable picker names its value')
      .toHaveAttribute('aria-label', 'Value for workshop_link: Workshop URL');
    await expect(page.getByTestId('ws-mail-dirty'), 'WMT-04: a fresh load is not dirty').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-save')).toBeDisabled();
  });

  // ===========================================================================================
  // WMT-05 — the READ path, against a seeded map the UI never wrote
  // ===========================================================================================
  test('WMT-05 a stored mapping is drawn back: template name, each source, the static text, not dirty', async ({ page }) => {
    // Exactly what the screen would store for reminder (a stored map with extra keys is WMT-15).
    await resetMailSettings({
      templateid: wsMail.tpl.reminder,
      emailData: {
        name: { type: 'static', value: 'Dear friend' },
        date: { type: 'workshopname' },
      },
    });
    await loginAsWshopAdmin(page);
    await openMailSection(page);

    await expect(page.getByTestId('ws-mail-template-pick'), 'WMT-05: the picker shows the stored template by name').toContainText(N.reminder);
    await expect(page.getByTestId('ws-mail-var-name'), 'WMT-05: one row per template variable')
      .toHaveText(['{{name}}', '{{date}}']);
    await expect(varRow(page, 'name').getByTestId('ws-mail-var-pick')).toHaveText('Static value');
    await expect(varRow(page, 'name').getByTestId('ws-mail-var-static'), 'WMT-05: the stored text').toHaveValue('Dear friend');
    await expect(varRow(page, 'date').getByTestId('ws-mail-var-pick')).toHaveText('Workshop name');
    await expect(varRow(page, 'date').locator('.mt-value')).toHaveText("This workshop's name");
    await expect(counter(page)).toHaveText('2 of 2 set');
    await expect(page.getByTestId('ws-mail-template-warn'), 'WMT-05: an active, approved template carries no warning').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-dirty')).toHaveCount(0);
    await expect(page.getByTestId('ws-mail-blocker')).toHaveCount(0);
    await expect(page.getByTestId('ws-mail-save'), 'WMT-05: nothing to save on arrival').toBeDisabled();
    await expect(page.getByTestId('ws-mail-template-remove')).toBeVisible();

    // [ASSERT] the open picker marks the stored template as selected.
    await openPicker(page);
    await expect(option(page, N.reminder), 'WMT-05: the stored template is the selected option').toHaveAttribute('aria-selected', 'true');
    await expect(option(page, N.welcome)).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('Escape');
  });

  // ===========================================================================================
  // WMT-06 — switching templates keeps shared choices only, and the save replaces the whole map
  // ===========================================================================================
  test('WMT-06 switching template keeps the shared variable and drops the rest; the save replaces the stored map', async ({ page }) => {
    await resetMailSettings({
      templateid: wsMail.tpl.welcome,
      emailData: {
        name: { type: 'static', value: 'Dear friend' },
        workshop: { type: 'workshopname' },
        workshop_link: { type: 'workshopurl' },
        signoff: { type: 'static', value: 'Team A&H' },
      },
    });
    await loginAsWshopAdmin(page);
    await openMailSection(page);
    await expect(counter(page), 'WMT-06: precondition — the stored welcome mapping is complete').toHaveText('4 of 4 set');

    await pickTemplate(page, N.reminder);
    await expect(page.getByTestId('ws-mail-var-name')).toHaveText(['{{name}}', '{{date}}']);
    await expect(varRow(page, 'name').getByTestId('ws-mail-var-pick'), 'WMT-06: the shared variable keeps its source').toHaveText('Static value');
    await expect(varRow(page, 'name').getByTestId('ws-mail-var-static'), 'WMT-06: and its text').toHaveValue('Dear friend');
    await expect(varRow(page, 'date').getByTestId('ws-mail-var-pick'), 'WMT-06: the new variable starts unchosen').toHaveText('Choose…');
    await expect(counter(page)).toHaveText('1 of 2 set');
    await expect(page.getByTestId('ws-mail-blocker')).toHaveText('Choose a value for 1 variable');

    // [REAL-UI] back to welcome: only 'name' came along; the others were dropped, not remembered.
    await pickTemplate(page, N.welcome);
    await expect(varRow(page, 'name').getByTestId('ws-mail-var-pick')).toHaveText('Static value');
    for (const v of ['workshop', 'workshop_link', 'signoff']) {
      await expect(varRow(page, v).getByTestId('ws-mail-var-pick'), `WMT-06: {{${v}}} was dropped on the switch`).toHaveText('Choose…');
    }
    await expect(counter(page)).toHaveText('1 of 4 set');

    await pickTemplate(page, N.reminder);
    await chooseSource(page, 'date', 'Workshop URL');
    await page.getByTestId('ws-mail-save').click();
    await expect(page.getByTestId('ws-mail-saved')).toBeVisible({ timeout: 30_000 });

    // [ASSERT] the stored map is replaced whole: welcome's other variables are gone from Firestore.
    const mail = await storedMail('WMT-06 app write of the switched mail', m => m?.templateid === wsMail.tpl.reminder);
    expect(mail, 'WMT-06: only the reminder variables are stored').toEqual({
      templateid: wsMail.tpl.reminder,
      emailData: { name: { type: 'static', value: 'Dear friend' }, date: { type: 'workshopurl' } },
    });
    expect((await workshopSettingsDoc(W)).dashboardaccess, 'WMT-06: Dashboard Access unchanged').toEqual(wsMailAccess);
  });

  // ===========================================================================================
  // WMT-07 — Remove + Save deletes `mail` and nothing else
  // ===========================================================================================
  test('WMT-07 Remove then Save deletes the stored mapping and keeps the rest of the document', async ({ page }) => {
    await resetMailSettings(WELCOME_SAVED);
    await loginAsWshopAdmin(page);
    await openMailSection(page);
    await expect(page.getByTestId('ws-mail-template-pick')).toContainText(N.welcome);

    await page.getByTestId('ws-mail-template-remove').click();
    await expect(page.getByTestId('ws-mail-template-pick'), 'WMT-07: back to the placeholder').toContainText('Choose a template');
    await expect(page.getByTestId('ws-mail-vars'), 'WMT-07: the rows go with the template').toHaveCount(0);
    await expect(counter(page)).toHaveCount(0);
    await expect(page.getByTestId('ws-mail-template-remove')).toHaveCount(0);
    await expect(page.getByTestId('ws-mail-dirty'), 'WMT-07: removal is an unsaved change').toBeVisible();
    await expect(page.getByTestId('ws-mail-blocker'), 'WMT-07: nothing blocks saving a removal').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-save')).toBeEnabled();
    expect((await workshopSettingsDoc(W)).mail, 'WMT-07: Remove alone stores nothing').toEqual(WELCOME_SAVED);

    await page.getByTestId('ws-mail-save').click();
    await expect(page.getByTestId('ws-mail-saved')).toBeVisible({ timeout: 30_000 });

    // [ASSERT] the field is deleted (not emptied), and the rest of the document stays.
    const doc = await pollUntil(async () => workshopSettingsDoc(W), (d: any) => !!d && !('mail' in d),
      { timeoutMs: 30_000, label: 'WMT-07 app deletion of mail' });
    expect('mail' in doc, 'WMT-07: the mail field is deleted').toBe(false);
    expect(doc.dashboardaccess, 'WMT-07: Dashboard Access survives').toEqual(wsMailAccess);
    expect(doc.workshopid).toBe(W);
    expect(doc.testrunid, 'WMT-07: other fields survive').toBe(RUN);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.tabs .tab', { hasText: 'Settings' }).click();
    await expect(page.getByTestId('ws-mail-template-pick'), 'WMT-07: after reload nothing is chosen')
      .toContainText('Choose a template', { timeout: 30_000 });
    await expect(page.getByTestId('ws-mail-template-warn')).toHaveCount(0);
    await expect(page.getByTestId('ws-mail-save')).toBeDisabled();
  });

  // ===========================================================================================
  // WMT-08 — a saved template that is no longer active still shows, with a warning
  // ===========================================================================================
  test('WMT-08 a saved template later made inactive is shown with a warning and keeps its rows', async ({ page }) => {
    await resetMailSettings({
      templateid: wsMail.tpl.reminder,
      emailData: { name: { type: 'name' }, date: { type: 'workshopname' } },
    });
    await setMailTemplateActive(wsMail.tpl.reminder, false);
    await loginAsWshopAdmin(page);
    await openMailSection(page);

    await expect(page.getByTestId('ws-mail-template-pick'), 'WMT-08: still shown by name').toContainText(N.reminder);
    await expect(page.getByTestId('ws-mail-template-warn'), 'WMT-08: the screen says why it would not be offered today')
      .toHaveText('This template is no longer active.');
    await expect(page.getByTestId('ws-mail-var-name'), 'WMT-08: its rows are still listed').toHaveText(['{{name}}', '{{date}}']);
    await expect(page.getByTestId('ws-mail-var-pick')).toHaveText(['Name', 'Workshop name']);
    await expect(page.getByTestId('ws-mail-dirty')).toHaveCount(0);
    await expect(page.getByTestId('ws-mail-save')).toBeDisabled();

    // [ASSERT] and it is no longer offered for a new pick.
    await openPicker(page);
    await expect(option(page, N.reminder), 'WMT-08: an inactive template is not offered').toHaveCount(0);
    await expect(option(page, N.welcome)).toHaveCount(1);
    await page.keyboard.press('Escape');
  });

  // ===========================================================================================
  // WMT-09 — a saved template whose document was deleted
  // ===========================================================================================
  test('WMT-09 a saved template that was deleted reads "Deleted template" with a warning, and can be replaced', async ({ page }) => {
    await resetMailSettings({ templateid: wsMail.tpl.gone, emailData: { name: { type: 'name' } } });
    await loginAsWshopAdmin(page);
    await openMailSection(page);

    await expect(page.getByTestId('ws-mail-template-pick'), 'WMT-09: the picker says the template is gone').toContainText('Deleted template');
    await expect(page.getByTestId('ws-mail-template-warn'))
      .toHaveText('The saved template has been deleted. Choose another, or remove it.');
    await expect(page.getByTestId('ws-mail-vars'), 'WMT-09: no template, no rows').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-no-vars'), 'WMT-09: and not the no-variables line either').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-template-remove'), 'WMT-09: it can be removed').toBeVisible();
    await expect(page.getByTestId('ws-mail-save')).toBeDisabled();

    // [REAL-UI] choosing a live template clears the warning.
    await pickTemplate(page, N.plain);
    await expect(page.getByTestId('ws-mail-template-warn'), 'WMT-09: a live template carries no warning').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-no-vars')).toBeVisible();
    expect((await workshopSettingsDoc(W)).mail, 'WMT-09: nothing stored without Save')
      .toEqual({ templateid: wsMail.tpl.gone, emailData: { name: { type: 'name' } } });
  });

  // ===========================================================================================
  // WMT-10 — a template with no variables saves an empty emailData
  // ===========================================================================================
  test('WMT-10 a template with no variables says so and saves with an empty emailData', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openMailSection(page);
    await pickTemplate(page, N.plain);

    await expect(page.getByTestId('ws-mail-no-vars'), 'WMT-10: no variables is said, not left blank')
      .toHaveText('This template has no variables to fill.');
    await expect(page.getByTestId('ws-mail-vars')).toHaveCount(0);
    await expect(counter(page)).toHaveText('0 of 0 set');
    await expect(page.getByTestId('ws-mail-blocker'), 'WMT-10: nothing to fill, nothing blocks').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-save')).toBeEnabled();
    await page.getByTestId('ws-mail-save').click();
    await expect(page.getByTestId('ws-mail-saved')).toBeVisible({ timeout: 30_000 });

    const mail = await storedMail('WMT-10 app write of a no-variable mail', m => m?.templateid === wsMail.tpl.plain);
    expect(mail, 'WMT-10: templateid and an empty emailData').toEqual({ templateid: wsMail.tpl.plain, emailData: {} });
    expect((await workshopSettingsDoc(W)).dashboardaccess).toEqual(wsMailAccess);
  });

  // ===========================================================================================
  // WMT-11 — the block saves on its own: not in the Save Settings bar, not in the leave guard
  // ===========================================================================================
  test('WMT-11 mail edits leave the Save Settings bar idle and do not trigger the leave dialog', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openMailSection(page);
    await expect(page.getByTestId('ws-button-91'), 'WMT-11: precondition — the Save Settings bar is idle').toBeVisible();

    await pickTemplate(page, N.welcome);
    await fillWelcome(page, 'Kind regards');
    await expect(page.getByTestId('ws-mail-dirty'), 'WMT-11: the block knows it has unsaved changes').toBeVisible();

    // [ASSERT] the Settings bar does not: still "No changes", its Save stays the disabled idle one.
    // Scoped to the Settings component: the Challenges tab (kept mounted, hidden) has a save bar of its own.
    await expect(page.locator('app-workshop-settingsv2 .savebar .pill-mute'), 'WMT-11: the Settings bar still says No changes')
      .toHaveText('No changes');
    await expect(page.getByTestId('ws-button-91')).toBeDisabled();
    await expect(page.getByTestId('ws-save-settings-93'), 'WMT-11: the Settings bar is not dirty').toHaveCount(0);

    // [ASSERT] leaving the tab does not ask, and the draft is still there on return (the tab stays mounted).
    await page.locator('.tabs .tab', { hasText: 'Enrollment Page' }).click();
    await expect(page.locator('.tabs .tab.on'), 'WMT-11: the tab switch went through').toHaveText(/Enrollment Page/);
    await expect(page.getByTestId('wc2-answer-leave-65'), 'WMT-11: no leave dialog for a mail draft').toHaveCount(0);
    await page.locator('.tabs .tab', { hasText: 'Settings' }).click();
    await expect(page.getByTestId('ws-mail-dirty'), 'WMT-11: the draft survives the tab switch').toBeVisible();
    await expect(varRow(page, 'signoff').getByTestId('ws-mail-var-static')).toHaveValue('Kind regards');
    expect((await workshopSettingsDoc(W))?.mail, 'WMT-11: nothing was saved').toBeUndefined();
  });

  // ===========================================================================================
  // WMT-12 — a new workshop cannot save a mapping until the Enrollment save creates it
  // ===========================================================================================
  test('WMT-12 on a new, unsaved workshop the mapping cannot be saved', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openMailSection(page, wsMail.newWorkshopId);
    await expect(page.getByText('New workshop · not saved yet'), 'WMT-12: precondition — the editor is in new mode').toBeVisible();

    await pickTemplate(page, N.plain);
    await expect(page.getByTestId('ws-mail-dirty')).toBeVisible();
    await expect(page.getByTestId('ws-mail-blocker'), 'WMT-12: the block says what to do first').toHaveText(BLOCKED_NEW);
    await expect(page.getByTestId('ws-mail-save'), 'WMT-12: Save is blocked').toBeDisabled();

    // [ASSERT] nothing was created for a workshop that does not exist.
    expect(await workshopSettingsDoc(wsMail.newWorkshopId), 'WMT-12: no workshopsettings document').toBeNull();
    expect((await workshopConfigStamp(wsMail.newWorkshopId)).exists, 'WMT-12: no workshop document').toBe(false);
  });

  // ===========================================================================================
  // WMT-13 — states the emulator cannot put on screen: read and save failures (the emulator's rules are
  // open and it does not fail reads). Their hooks are registered here; on a healthy screen each must be
  // ABSENT, which is asserted. The two loading lines are asserted gone once their reads finish.
  // ===========================================================================================
  test('WMT-13 error and loading states stay away on a healthy screen (reference for states the emulator cannot drive)', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openMailSection(page);
    await expect(page.getByTestId('ws-mail-loading')).toHaveCount(0);            // gone once the saved choice is read
    await expect(page.getByTestId('ws-mail-load-error')).toHaveCount(0);         // reference-only: saved-choice read error
    await expect(page.getByTestId('ws-mail-load-retry')).toHaveCount(0);         // reference-only: saved-choice read error
    await expect(page.getByTestId('ws-mail-save-error')).toHaveCount(0);         // reference-only: save error
    await openPicker(page);
    await expect(page.getByTestId('ws-mail-templates-loading')).toHaveCount(0);  // gone once the list is read
    await expect(page.getByTestId('ws-mail-templates-error')).toHaveCount(0);    // reference-only: list read error
    await expect(page.getByTestId('ws-mail-templates-retry')).toHaveCount(0);    // reference-only: list read error
    await page.keyboard.press('Escape');
  });

  // ===========================================================================================
  // WMT-14 — a saved mapping that is no longer complete (the template gained a variable) says so on arrival
  // ===========================================================================================
  test('WMT-14 a saved mapping missing a variable the template now has is flagged without any edit, and can be completed', async ({ page }) => {
    // Saved when reminder had only 'name'; its model now also has 'date'.
    await resetMailSettings({ templateid: wsMail.tpl.reminder, emailData: { name: { type: 'name' } } });
    await loginAsWshopAdmin(page);
    await openMailSection(page);

    await expect(page.getByTestId('ws-mail-var-name')).toHaveText(['{{name}}', '{{date}}']);
    await expect(varRow(page, 'name').getByTestId('ws-mail-var-pick')).toHaveText('Name');
    await expect(varRow(page, 'date').getByTestId('ws-mail-var-pick'), 'WMT-14: the new variable is unchosen').toHaveText('Choose…');
    await expect(counter(page)).toHaveText('1 of 2 set');
    // [ASSERT] nothing was edited, yet the gap is said — the stored map would send a blank {{date}}.
    await expect(page.getByTestId('ws-mail-blocker'), 'WMT-14: an incomplete saved mapping is flagged on arrival')
      .toHaveText('Choose a value for 1 variable');
    await expect(page.getByTestId('ws-mail-dirty'), 'WMT-14: nothing was edited, and nothing stored would change').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-save')).toBeDisabled();

    await chooseSource(page, 'date', 'Workshop name');
    await expect(page.getByTestId('ws-mail-blocker')).toHaveCount(0);
    await expect(page.getByTestId('ws-mail-dirty')).toHaveText('Unsaved template changes');
    await page.getByTestId('ws-mail-save').click();
    await expect(page.getByTestId('ws-mail-saved')).toBeVisible({ timeout: 30_000 });

    const mail = await storedMail('WMT-14 app write of the completed mail', m => !!m?.emailData?.date);
    expect(mail, 'WMT-14: the stored map is now complete').toEqual({
      templateid: wsMail.tpl.reminder,
      emailData: { name: { type: 'name' }, date: { type: 'workshopname' } },
    });
  });

  // ===========================================================================================
  // WMT-15 — a stored map with entries the template does not have (or the older flat shape) is out of date
  // ===========================================================================================
  test('WMT-15 stored entries the template does not have, and the older flat shape, read as out of date and a save writes it clean', async ({ page }) => {
    await resetMailSettings({
      templateid: wsMail.tpl.reminder,
      emailData: {
        name: { type: 'name' },
        date: 'workshopname',                   // the older flat shape: not a choice the screen can read
        retired_var: { type: 'workshopurl' },   // a variable reminder does not have
      },
    });
    await loginAsWshopAdmin(page);
    await openMailSection(page);

    await expect(page.getByTestId('ws-mail-var-name'), 'WMT-15: rows come from the template, not the stored keys')
      .toHaveText(['{{name}}', '{{date}}']);
    await expect(varRow(page, 'name').getByTestId('ws-mail-var-pick')).toHaveText('Name');
    await expect(varRow(page, 'date').getByTestId('ws-mail-var-pick'), 'WMT-15: a flat entry is not read as a choice').toHaveText('Choose…');
    await expect(counter(page)).toHaveText('1 of 2 set');
    await expect(page.getByTestId('ws-mail-dirty'), 'WMT-15: saving now would change what is stored')
      .toHaveText('Saved choice is out of date');
    await expect(page.getByTestId('ws-mail-blocker')).toHaveText('Choose a value for 1 variable');
    await expect(page.getByTestId('ws-mail-save')).toBeDisabled();

    await chooseSource(page, 'date', 'Workshop URL');
    await expect(page.getByTestId('ws-mail-dirty'), 'WMT-15: an edit is an ordinary unsaved change').toHaveText('Unsaved template changes');
    await expect(page.getByTestId('ws-mail-save')).toBeEnabled();
    await page.getByTestId('ws-mail-save').click();
    await expect(page.getByTestId('ws-mail-saved')).toBeVisible({ timeout: 30_000 });

    // [ASSERT] the whole map was replaced: the stray key and the flat entry are gone from Firestore.
    const mail = await storedMail('WMT-15 app write of the cleaned mail', m => !('retired_var' in (m?.emailData || {})));
    expect(mail, 'WMT-15: only the template variables, in the map shape').toEqual({
      templateid: wsMail.tpl.reminder,
      emailData: { name: { type: 'name' }, date: { type: 'workshopurl' } },
    });
    expect((await workshopSettingsDoc(W)).dashboardaccess).toEqual(wsMailAccess);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.tabs .tab', { hasText: 'Settings' }).click();
    await expect(counter(page), 'WMT-15: after reload the mapping is complete').toHaveText('2 of 2 set', { timeout: 30_000 });
    await expect(page.getByTestId('ws-mail-dirty'), 'WMT-15: and no longer out of date').toHaveCount(0);
  });

  // ===========================================================================================
  // WMT-16 — a template whose variables were never recorded cannot be mapped (or saved as "no variables")
  // ===========================================================================================
  test('WMT-16 a template with no recorded variable list says so and cannot be saved', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openMailSection(page);
    await pickTemplate(page, N.nomodel);

    await expect(page.getByTestId('ws-mail-vars-unknown'), 'WMT-16: the screen says the variables are unknown')
      .toHaveText("This template's variables were not recorded, so they cannot be filled here. Open it in the template editor and save it again, then choose it here.");
    await expect(page.getByTestId('ws-mail-no-vars'), 'WMT-16: not passed off as a template with no variables').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-vars')).toHaveCount(0);
    await expect(counter(page), 'WMT-16: no "0 of 0 set"').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-blocker')).toHaveText("This template's variables were not recorded");
    await expect(page.getByTestId('ws-mail-save'), 'WMT-16: an empty map is not saved for it').toBeDisabled();
    expect((await workshopSettingsDoc(W))?.mail, 'WMT-16: nothing stored').toBeUndefined();

    // [REAL-UI] a template with a variable list takes its place normally.
    await pickTemplate(page, N.plain);
    await expect(page.getByTestId('ws-mail-vars-unknown')).toHaveCount(0);
    await expect(page.getByTestId('ws-mail-no-vars')).toBeVisible();
  });

  // ===========================================================================================
  // WMT-17 — a saved template that cannot be read does not lock the section
  // ===========================================================================================
  test('WMT-17 a saved template that cannot be read is named as such and can still be removed', async ({ page }) => {
    await resetMailSettings({ templateid: wsMail.unreadableId, emailData: { name: { type: 'name' } } });
    await loginAsWshopAdmin(page);
    await openMailSection(page);

    await expect(page.getByTestId('ws-mail-load-error'), 'WMT-17: the section does not fall back to the load error').toHaveCount(0);
    await expect(page.getByTestId('ws-mail-template-pick')).toContainText('Saved template (could not be read)');
    await expect(page.getByTestId('ws-mail-template-warn')).toHaveText('Could not read the saved template. Choose another, or remove it.');
    await expect(page.getByTestId('ws-mail-vars')).toHaveCount(0);
    await expect(page.getByTestId('ws-mail-dirty')).toHaveCount(0);

    await page.getByTestId('ws-mail-template-remove').click();
    await expect(page.getByTestId('ws-mail-template-warn'), 'WMT-17: Remove clears the warning').toHaveCount(0);
    await page.getByTestId('ws-mail-save').click();
    await expect(page.getByTestId('ws-mail-saved')).toBeVisible({ timeout: 30_000 });
    const d = await pollUntil(async () => workshopSettingsDoc(W), (x: any) => !!x && !('mail' in x),
      { timeoutMs: 30_000, label: 'WMT-17 app deletion of the unreadable mail' });
    expect('mail' in d, 'WMT-17: the unreadable choice is deleted').toBe(false);
    expect(d.dashboardaccess, 'WMT-17: Dashboard Access survives').toEqual(wsMailAccess);
  });
});
