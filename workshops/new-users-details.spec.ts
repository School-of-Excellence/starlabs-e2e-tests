// new-users-details.spec.ts — /newusersprofile: a row opens the person's details; "Delivery on hold" is the one
// control in it that writes.
//
// Recon: starlabs-angular specs/plans/2026-11-18-new-user-details-dialog.md (approved 2026-11-18: "Show who and
// when", "Record every change"). The write rule under test: each flip of the toggle is ONE updateDoc on
// new_user_data/{id} with { deliveryonhold: <new value>, deliveryonholdby: { time: serverTimestamp(), user: <the
// signed-in admin's profile id> } } — on AND off both overwrite the record; no other field is ever written.
//
// Hooks — one prefix per component:
//   `new` = New-Workshop/newusersprofile/newusersprofile.component.html (new-row: a table row / phone card, the
//           click target; new-open-details: the name button; new-button-1 / new-event-2: the Tags filter pill and
//           panel, opened in NUD-03 to prove a click that closes a panel opens nothing else)
//   `nud` = New-Workshop/newusersprofile/new-user-details-dialog/new-user-details-dialog.component.html
//   (`atd` = the Assign tags dialog, only opened here as a negative control in NUD-03)
// This is its own file on purpose: every case keys on new-open-details / nud-*, so the hub-ahead guard
// (scripts/readiness/landed-specs.cjs) skips just this file on app branches that predate the dialog, while
// new-users-redesign.spec.ts keeps running on both sides.
//
// Anti-circularity: every value the dialog shows is compared with what the TEST derives from its own read of the
// seeded document (getDoc) with the table's own rules (enable → Enabled/Disabled as buildVm does; tag ids → names
// through the `newusersegments` tags, in stored order, unknown ids dropped), and dates are formatted by the test in
// the browser's time zone. The write cases read Firestore back (pollUntil) and check the record against the
// signed-in admin's seeded profile id and a clock window the test took itself; the caption's name comes from the
// test's read of profile_data / participant metadata (wsHoldByName), never from the screen. NUD-07's live case
// writes a value out of the app and checks the dialog picks it up — the read path, stated as such.
import { test, expect, Page } from '@playwright/test';
import {
  wsDetails, wsDetailsFullTagIds, wsProfileIds, wsAddIds, installWshopStubs, loginAsWshopAdmin,
  seedNewUserDetails, seedNewUserDetailsThrowaway, seedNewUserDetailsHolder, resetNewUserDetailsHold,
  clearNewUserDetails, wsHoldByName, setNewUserHoldExternally, deleteNewUser, newUserSegmentTags,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil } from '../queue/support/firestore-admin';

const D = wsDetails;
const DOT = '·';

const rowFor = (page: Page, name: string) => page.getByTestId('new-row').filter({ hasText: name });
/** A plain click on a row, away from every control: its Created cell (the card's date line on a phone). */
const rowBody = (page: Page, name: string) => rowFor(page, name).locator('td.nx-c-created');
/** The slide toggle's own switch (MDC renders a <button role="switch"> carrying aria-checked). */
const holdSwitch = (page: Page) => page.getByTestId('nud-hold-toggle').getByRole('switch');

async function openScreen(page: Page, waitFor: string): Promise<void> {
  await page.goto('/newusersprofile', { waitUntil: 'domcontentloaded' });
  await expect(rowFor(page, waitFor), 'the table must render').toHaveCount(1, { timeout: 30_000 });
}

/**
 * The dialog must NOT be there, and must not turn up for a while either: a toHaveCount(0) alone passes at once,
 * before a lazily-loaded dialog would have had time to open. Each case warms the dialog code up first.
 */
async function staysClosed(page: Page, why: string, ms = 1_500): Promise<void> {
  const until = Date.now() + ms;
  for (;;) {
    expect(await page.getByTestId('nud-dialog').count(), why).toBe(0);
    if (Date.now() >= until) return;
    await page.waitForTimeout(150);
  }
}

/** Exactly one dialog, and still exactly one for a while (polled, so a late second one or a late close shows). */
async function staysOne(page: Page, why: string, ms = 1_500): Promise<void> {
  const until = Date.now() + ms;
  for (;;) {
    expect(await page.getByTestId('nud-dialog').count(), why).toBe(1);
    if (Date.now() >= until) return;
    await page.waitForTimeout(150);
  }
}

/** Epoch ms of an admin-SDK Timestamp (or a Date); null when missing. */
function msOf(v: any): number | null {
  if (!v) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return null;
}

/**
 * 'd MMM y, h:mm a' ("12 Nov 2026, 9:40 AM") — Angular's DatePipe pattern — computed by the TEST in the BROWSER's
 * time zone (the app renders there), with a fixed month table so no ICU month spelling can creep in.
 */
async function fmt(page: Page, ms: number): Promise<string> {
  return page.evaluate((t) => {
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(t);
    const h = d.getHours() % 12 || 12;
    return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}, ${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  }, ms);
}

/** The values the dialog must show for a new_user_data document, derived by the TEST (see the header). */
async function expectedFor(page: Page, doc: any) {
  const cc = (doc.countryCode ?? '').toString().trim();
  const num = (doc.phonenumber ?? '').toString().trim();
  const status = typeof doc.status === 'string' && doc.status.trim() ? doc.status.trim() : '';
  const created = msOf(doc.created);
  const lastLogin = msOf(doc.last_login);
  const movedOn = msOf(doc.movedon);
  const names = new Map((await newUserSegmentTags()).map(t => [t.id, t.name] as [string, string]));
  return {
    name: (doc.name ?? '').toString().trim() || '—',
    email: (doc.email ?? '').toString().trim() || '—',
    phone: num ? (cc ? `${cc} ${num}` : num) : '—',
    status: status ? status[0].toUpperCase() + status.slice(1) : '—',
    account: doc.enable ? 'Enabled' : 'Disabled',                  // buildVm: enabled = !!u.enable
    created: created === null ? '—' : await fmt(page, created),
    lastLogin: lastLogin === null ? 'Never' : await fmt(page, lastLogin),
    movedOn: movedOn === null ? '—' : await fmt(page, movedOn),
    converted: doc.movedtoexist === true ? 'Yes' : 'No',
    tags: (Array.isArray(doc.tags) ? doc.tags : []).map((id: string) => names.get(id) || '').filter(Boolean) as string[],
  };
}

/** Admin-SDK Timestamp a is strictly later than b (seconds, then nanoseconds). */
const laterThan = (a: any, b: any) => a.seconds > b.seconds || (a.seconds === b.seconds && a.nanoseconds > b.nanoseconds);

test.describe('Workshops — new users: the person details dialog and Delivery on hold', () => {
  let guard: ConsoleGuard;
  test.beforeAll(async () => {
    await seedNewUserDetails();
  });
  test.afterAll(async () => {
    await clearNewUserDetails();
  });
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await resetNewUserDetailsHold();   // every case starts from "never put on hold", re-runs included
  });
  test.afterEach(() => assertNoFatal(guard, 'new users details: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // NUD-01 — a click on the row opens ONE dialog, and every value equals what the test derives from the document.
  // The full person carries six tag ids: four segment tags in non-alphabetical order, a calendar-type tag and an id
  // with no tag doc — the dialog must name exactly the four, in stored order (the table's rule).
  // ===========================================================================================
  test('NUD-01 a row click opens the details; every value matches the stored document', async ({ page }) => {
    const doc: any = await getDoc('new_user_data', D.full.id);
    expect(doc, 'NUD-01 precondition: the full person is seeded').not.toBeNull();
    expect(doc.tags, 'NUD-01 precondition: the stored tag order').toEqual(wsDetailsFullTagIds());
    // The calendar-type tag must really exist with a name: otherwise it would behave like the ghost id, and a dialog
    // that named every newusertags doc (not only the segment ones) would still pass.
    const cal: any = await getDoc('newusertags', wsAddIds.NUT_CAL_A);
    expect(cal, 'NUD-01 precondition: the calendar-type tag doc exists (seed-workshops.js)').not.toBeNull();
    expect(cal.type, 'NUD-01 precondition: ...and is not a segment tag').not.toBe('newusersegments');
    expect((cal.name || '').toString().trim(), 'NUD-01 precondition: ...and has a name').not.toBe('');
    await loginAsWshopAdmin(page);
    await openScreen(page, D.full.name);
    const want = await expectedFor(page, doc);
    expect(want.tags, 'NUD-01 precondition: the calendar tag and the unknown id are not names').toEqual(D.tags.map(t => t.name));
    await expect(rowFor(page, D.full.name).getByTestId('new-tag-more'), 'NUD-01 precondition: the row shows "+1"').toHaveText('+1');

    const dialog = page.getByTestId('nud-dialog');
    await expect(dialog, 'NUD-01: nothing is open before the click').toHaveCount(0);
    await rowBody(page, D.full.name).click();
    await expect(dialog, 'NUD-01: the row opens the details').toBeVisible({ timeout: 20_000 });
    await expect(dialog, 'NUD-01: exactly one dialog').toHaveCount(1);

    await expect(page.getByTestId('nud-name')).toHaveText(want.name);
    await expect(page.getByTestId('nud-email')).toHaveText(want.email);
    await expect(page.getByTestId('nud-phone'), 'NUD-01: country code, a space, the number').toHaveText(want.phone);
    await expect(page.getByTestId('nud-status'), 'NUD-01: status, first letter capitalised').toHaveText(want.status);
    await expect(page.getByTestId('nud-account'), 'NUD-01: the table\'s Enabled rule').toHaveText(want.account);
    await expect(page.getByTestId('nud-created')).toHaveText(want.created);
    await expect(page.getByTestId('nud-last-login'), 'NUD-01: the fixed last-login instant').toHaveText(want.lastLogin);
    await expect(page.getByTestId('nud-converted')).toHaveText(want.converted);
    await expect(page.getByTestId('nud-moved-on'), 'NUD-01: the fixed moved-on instant').toHaveText(want.movedOn);
    await expect(page.getByTestId('nud-tags')).toBeVisible();
    await expect(page.getByTestId('nud-tag'), 'NUD-01: one pill per named tag, in stored order').toHaveText(want.tags);

    // Delivery on hold: off (no field yet), editable, no record, no error, labelled in plain words.
    await expect(page.getByTestId('nud-hold-toggle')).toContainText('Delivery on hold');
    await expect(page.getByTestId('nud-hold-toggle').getByRole('switch', { name: 'Delivery on hold' }), 'NUD-01: the switch is named').toHaveCount(1);
    await expect(holdSwitch(page), 'NUD-01: a missing field reads as off').toHaveAttribute('aria-checked', 'false');
    await expect(holdSwitch(page)).toBeEnabled();
    await expect(page.getByTestId('nud-hold-by'), 'NUD-01: no caption before anything was recorded').toHaveCount(0);
    await expect(page.getByTestId('nud-missing')).toHaveCount(0);
    await expect(page.getByTestId('nud-close')).toHaveAttribute('aria-label', 'Close');

    await page.getByTestId('nud-close').click();
    await expect(dialog, 'NUD-01: ✕ closes').toHaveCount(0);
  });

  // ===========================================================================================
  // NUD-02 — a person with a name and a created date only: every other value is the empty wording.
  // ===========================================================================================
  test('NUD-02 a bare person shows "—", "Never", "No", Disabled and no tags', async ({ page }) => {
    const doc: any = await getDoc('new_user_data', D.bare.id);
    expect(Object.keys(doc || {}).sort(), 'NUD-02 precondition: name and created only (plus the run tags)')
      .toEqual(['_testdata', 'created', 'id', 'name', 'testrunid']);
    await loginAsWshopAdmin(page);
    await openScreen(page, D.bare.name);
    const want = await expectedFor(page, doc);
    expect([want.email, want.phone, want.status, want.lastLogin, want.converted, want.account],
      'NUD-02 precondition: the oracle\'s empty values').toEqual(['—', '—', '—', 'Never', 'No', 'Disabled']);

    await rowBody(page, D.bare.name).click();
    await expect(page.getByTestId('nud-dialog')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('nud-name')).toHaveText(D.bare.name);
    await expect(page.getByTestId('nud-email')).toHaveText(want.email);
    await expect(page.getByTestId('nud-phone')).toHaveText(want.phone);
    await expect(page.getByTestId('nud-status')).toHaveText(want.status);
    await expect(page.getByTestId('nud-account'), 'NUD-02: no enable field is Disabled, as in the table').toHaveText(want.account);
    await expect(page.getByTestId('nud-created')).toHaveText(want.created);
    await expect(page.getByTestId('nud-last-login')).toHaveText('Never');
    await expect(page.getByTestId('nud-converted')).toHaveText('No');
    await expect(page.getByTestId('nud-moved-on')).toHaveText('—');
    await expect(page.getByTestId('nud-tag'), 'NUD-02: no tag pills').toHaveCount(0);
    await expect(page.getByTestId('nud-tags'), 'NUD-02: the tags line says none').toContainText('—');
    await expect(page.getByTestId('nud-hold-by')).toHaveCount(0);
    await expect(holdSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('nud-dialog')).toHaveCount(0);
    await expect(rowFor(page, D.bare.name).getByTestId('new-open-details'),
      'NUD-02: after a row click, Escape gives focus to that row\'s name (not the page body)').toBeFocused();
  });

  // ===========================================================================================
  // NUD-03 — clicks that belong to a control in the row never open the details: the selection checkbox, "+1",
  // the tag edit button (it opens Assign tags instead), and a drag that selects text. A click that only closes an
  // open filter panel opens nothing either. A double-click on a row leaves ONE dialog open (its second click lands
  // on the new backdrop), and a later backdrop click still closes it. A first open/close loads the lazy dialog code,
  // so a wrongly-opened dialog would show inside staysClosed's window; a final plain click proves the row still
  // opens it.
  // ===========================================================================================
  test('NUD-03 the checkbox, the tag buttons and a text selection do not open the details', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openScreen(page, D.full.name);
    const row = rowFor(page, D.full.name);
    const dialog = page.getByTestId('nud-dialog');

    // Warm-up (positive): the dialog code is loaded.
    await rowBody(page, D.full.name).click();
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('nud-close').click();
    await expect(dialog).toHaveCount(0);

    const box = row.getByTestId('new-change-selection-24').locator('input');
    await box.click();
    await expect(box, 'NUD-03: the checkbox still ticks').toBeChecked();
    await staysClosed(page, 'NUD-03: [NEGATIVE CONTROL] the checkbox does not open the details');

    await row.getByTestId('new-tag-more').click();
    await staysClosed(page, 'NUD-03: [NEGATIVE CONTROL] "+1" does not open the details');

    // Outcome check, not a probe of the row's button rule: Assign tags opening first would block the details anyway
    // (one dialog at a time). "+1" above is the button that proves the rule.
    await row.getByTestId('new-open-tags-25').click();
    await expect(page.getByTestId('atd-dialog-title'), 'NUD-03: the edit button opens Assign tags').toHaveText('Assign tags', { timeout: 20_000 });
    await staysClosed(page, 'NUD-03: the edit button opens Assign tags only, not the details as well');
    await page.getByTestId('atd-cancel-9').click();
    await expect(page.getByTestId('atd-dialog-title')).toHaveCount(0);
    await staysClosed(page, 'NUD-03: closing Assign tags does not open the details');

    // A drag across the email selects text; the click it ends must not open anything.
    const email = row.locator('td.nx-c-email .nx-email');
    const eb = await email.boundingBox();
    expect(eb, 'NUD-03 precondition: the email is on screen').not.toBeNull();
    await page.mouse.move(eb!.x + 2, eb!.y + eb!.height / 2);
    await page.mouse.down();
    await page.mouse.move(eb!.x + eb!.width - 2, eb!.y + eb!.height / 2, { steps: 8 });
    await page.mouse.up();
    expect(await page.evaluate(() => (window.getSelection()?.toString() || '').length), 'NUD-03 precondition: text is selected')
      .toBeGreaterThan(0);
    await staysClosed(page, 'NUD-03: [NEGATIVE CONTROL] a click that ends a text selection does not open the details');
    await page.evaluate(() => window.getSelection()?.removeAllRanges());

    // An open filter panel has no backdrop: the click that closes it reaches the row too, and must only close it.
    await page.getByTestId('new-button-1').click();
    const panel = page.getByTestId('new-event-2');
    await expect(panel, 'NUD-03 precondition: the Tags panel is open').toBeVisible();
    // The panel covers the middle of the table, so click any row's plain cell (phone / email / created) that is on
    // screen, outside the panel, and the topmost element at that point (a click there would open that row).
    const pb = await panel.boundingBox();
    expect(pb, 'NUD-03 precondition: the panel has a box').not.toBeNull();
    const spot = await page.getByTestId('new-row').locator('td.nx-c-phone, td.nx-c-email, td.nx-c-created')
      .evaluateAll((tds: Element[], p: { x: number; y: number; width: number; height: number }) => {
        for (const td of tds) {
          const r = td.getBoundingClientRect();
          const x = r.left + r.width / 2;
          const y = r.top + r.height / 2;
          if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
          if (x >= p.x - 4 && x <= p.x + p.width + 4 && y >= p.y - 4 && y <= p.y + p.height + 4) continue;
          const hit = document.elementFromPoint(x, y);
          if (!hit || !td.contains(hit) || hit.closest('button, a, input, label')) continue;
          return { x, y };
        }
        return null;
      }, pb!);
    expect(spot, 'NUD-03 precondition: a row cell outside the open panel is on screen').not.toBeNull();
    await page.mouse.click(spot!.x, spot!.y);
    await expect(panel, 'NUD-03: the click closes the panel').toHaveCount(0);
    await staysClosed(page, 'NUD-03: [NEGATIVE CONTROL] ...and does not open the details as well');

    // A double-click: the first click opens the details, the second lands on the backdrop that has just appeared.
    await rowBody(page, D.full.name).dblclick();
    await expect(dialog, 'NUD-03: a double-click opens the details').toBeVisible({ timeout: 20_000 });
    await staysOne(page, 'NUD-03: [NEGATIVE CONTROL] ...and its second click does not close them again');
    await page.mouse.click(4, 4);   // the backdrop, away from the centred dialog
    await expect(dialog, 'NUD-03: a later click on the backdrop still closes the details').toHaveCount(0);

    await expect(box, 'NUD-03: the row is still ticked').toBeChecked();
    await rowBody(page, D.full.name).click();
    await expect(dialog, 'NUD-03: a plain click on the row still opens it').toBeVisible({ timeout: 20_000 });
    await expect(dialog).toHaveCount(1);
    await expect(page.getByTestId('nud-name')).toHaveText(D.full.name);
  });

  // ===========================================================================================
  // NUD-04 — keyboard: the name is a real button reached by Tab from the row's checkbox; Enter opens one dialog;
  // Escape and ✕ close it and give focus back to the name.
  // ===========================================================================================
  test('NUD-04 Tab to the name, Enter opens; Escape and ✕ close and focus returns to the name', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openScreen(page, D.full.name);
    const row = rowFor(page, D.full.name);
    const opener = row.getByTestId('new-open-details');
    const dialog = page.getByTestId('nud-dialog');

    await expect(opener, 'NUD-04: one name button per row').toHaveCount(1);
    await expect(opener, 'NUD-04: a real button').toHaveJSProperty('tagName', 'BUTTON');
    await expect(opener).toHaveAttribute('type', 'button');
    await expect(opener, 'NUD-04: it holds the name').toContainText(D.full.name);
    await expect(row.locator('.nx-person .nx-name'), 'NUD-04: the name markup is kept').toHaveText(D.full.name);

    await row.getByTestId('new-change-selection-24').locator('input').focus();
    await page.keyboard.press('Tab');
    await expect(opener, 'NUD-04: Tab from the checkbox reaches the name').toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog, 'NUD-04: Enter opens the details').toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('nud-name')).toHaveText(D.full.name);
    // Outcome only: Enter clicks the button and that click bubbles to the row; one dialog must result (the screen
    // also never opens a second dialog while one is open, so this does not isolate the row's button rule).
    await staysOne(page, 'NUD-04: Enter on the name opens ONE dialog');

    await page.keyboard.press('Escape');
    await expect(dialog, 'NUD-04: Escape closes').toHaveCount(0);
    await expect(opener, 'NUD-04: focus is back on the name').toBeFocused();

    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('nud-close').click();
    await expect(dialog, 'NUD-04: ✕ closes').toHaveCount(0);
    await expect(opener, 'NUD-04: focus is back on the name after ✕ too').toBeFocused();
  });

  // ===========================================================================================
  // NUD-05 — turning it on writes { deliveryonhold: true, deliveryonholdby: { time, user } } on THIS person only:
  // user is the signed-in admin's profile id, time is a server timestamp inside the test's own clock window, and no
  // other field changes. The caption names the admin (profile_data, read by the test) and that time.
  // ===========================================================================================
  test('NUD-05 turning it on records who and when, on that person only, and writes nothing else', async ({ page }) => {
    const before: any = await getDoc('new_user_data', D.full.id);
    const control0: any = await getDoc('new_user_data', D.control.id);
    expect(before, 'NUD-05 precondition: never on hold').not.toHaveProperty('deliveryonhold');
    expect(before).not.toHaveProperty('deliveryonholdby');
    const adminName = await wsHoldByName(wsProfileIds.admin);
    expect(adminName, 'NUD-05 precondition: the admin\'s profile has a name').not.toBe('');
    await loginAsWshopAdmin(page);
    await openScreen(page, D.full.name);
    await rowBody(page, D.full.name).click();
    await expect(page.getByTestId('nud-dialog')).toBeVisible({ timeout: 20_000 });
    await expect(holdSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(holdSwitch(page), 'NUD-05: enabled once the admin is known').toBeEnabled();

    const t0 = Date.now();
    await holdSwitch(page).click();
    const after: any = await pollUntil(() => getDoc('new_user_data', D.full.id), (d: any) => d?.deliveryonhold === true,
      { label: 'NUD-05: deliveryonhold true on the full person', timeoutMs: 30_000 });
    const by = after.deliveryonholdby;
    expect(by && typeof by === 'object', 'NUD-05: a record map is written').toBe(true);
    expect(Object.keys(by).sort(), 'NUD-05: the record holds time and user only').toEqual(['time', 'user']);
    expect(by.user, 'NUD-05: user = the signed-in admin\'s profile id').toBe(wsProfileIds.admin);
    expect(typeof by.time?.toMillis, 'NUD-05: time is a Firestore Timestamp').toBe('function');
    const at = by.time.toMillis();
    expect(at, 'NUD-05: time is the save time (lower bound)').toBeGreaterThanOrEqual(t0 - 120_000);
    expect(at, 'NUD-05: time is the save time (upper bound)').toBeLessThanOrEqual(Date.now() + 120_000);
    const { deliveryonhold: _on, deliveryonholdby: _by, ...rest } = after;
    expect(rest, 'NUD-05: no other field was written').toEqual(before);

    const control: any = await getDoc('new_user_data', D.control.id);
    expect(control, 'NUD-05: [NEGATIVE CONTROL] another person is untouched').toEqual(control0);
    expect(control).not.toHaveProperty('deliveryonhold');
    expect(control).not.toHaveProperty('deliveryonholdby');

    await expect(holdSwitch(page), 'NUD-05: the switch shows on').toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('nud-hold-by'), 'NUD-05: who and when')
      .toHaveText(`Turned on by ${adminName} ${DOT} ${await fmt(page, at)}`);
    await expect(page.getByTestId('nud-hold-error'), 'NUD-05: a successful save shows no error').toHaveCount(0);
  });

  // ===========================================================================================
  // NUD-06 — turning it off writes false and OVERWRITES the record (a later time, same admin); the caption says
  // "Turned off by"; after a reload the dialog still shows off and the same caption (read from Firestore).
  // ===========================================================================================
  test('NUD-06 turning it off overwrites the record; after a reload it is still off with "Turned off by"', async ({ page }) => {
    const adminName = await wsHoldByName(wsProfileIds.admin);
    await loginAsWshopAdmin(page);
    await openScreen(page, D.full.name);
    await rowBody(page, D.full.name).click();
    await expect(page.getByTestId('nud-dialog')).toBeVisible({ timeout: 20_000 });

    await holdSwitch(page).click();
    const on: any = await pollUntil(() => getDoc('new_user_data', D.full.id), (d: any) => d?.deliveryonhold === true,
      { label: 'NUD-06: on first', timeoutMs: 30_000 });
    await expect(holdSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(holdSwitch(page), 'NUD-06: the first save has finished').toBeEnabled();

    await holdSwitch(page).click();
    const off: any = await pollUntil(() => getDoc('new_user_data', D.full.id), (d: any) => d?.deliveryonhold === false,
      { label: 'NUD-06: deliveryonhold false', timeoutMs: 30_000 });
    expect(off.deliveryonholdby?.user, 'NUD-06: turning off records the admin too').toBe(wsProfileIds.admin);
    expect(Object.keys(off.deliveryonholdby).sort()).toEqual(['time', 'user']);
    expect(laterThan(off.deliveryonholdby.time, on.deliveryonholdby.time), 'NUD-06: the record was overwritten with a later time')
      .toBe(true);
    const offText = `Turned off by ${adminName} ${DOT} ${await fmt(page, off.deliveryonholdby.time.toMillis())}`;
    await expect(holdSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('nud-hold-by'), 'NUD-06: the caption says who turned it off').toHaveText(offText);

    await openScreen(page, D.full.name);
    await rowBody(page, D.full.name).click();
    await expect(page.getByTestId('nud-dialog')).toBeVisible({ timeout: 20_000 });
    await expect(holdSwitch(page), 'NUD-06: after a reload it is still off').toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('nud-hold-by'), 'NUD-06: ...with the stored record').toHaveText(offText);
  });

  // ===========================================================================================
  // NUD-07 — the open dialog follows the document: a hold written outside the app shows at once (the second
  // profile's name, found on the participant-metadata branch of the lookup); a person deleted while open says so
  // and the switch is disabled (an update could only fail; it must never re-create the person).
  // ===========================================================================================
  test('NUD-07 the open dialog follows the document: an outside change shows live; a deleted person disables the switch', async ({ page }) => {
    await seedNewUserDetailsThrowaway();
    await seedNewUserDetailsHolder();
    const holderName = await wsHoldByName(D.holder.id);
    expect(holderName, 'NUD-07 precondition: the second profile\'s name is known').toBe(D.holder.name);
    await loginAsWshopAdmin(page);
    await openScreen(page, D.full.name);
    await expect(rowFor(page, D.throwaway.name), 'NUD-07 precondition: the throwaway person is listed').toHaveCount(1);

    await rowBody(page, D.full.name).click();
    await expect(page.getByTestId('nud-dialog')).toBeVisible({ timeout: 20_000 });
    await expect(holdSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('nud-hold-by')).toHaveCount(0);

    await setNewUserHoldExternally(D.full.id, true, D.holder.id, D.holdAt);
    await expect(holdSwitch(page), 'NUD-07: the outside change shows without a reload').toHaveAttribute('aria-checked', 'true', { timeout: 20_000 });
    await expect(page.getByTestId('nud-hold-by'), 'NUD-07: ...naming the second profile and its time')
      .toHaveText(`Turned on by ${holderName} ${DOT} ${await fmt(page, D.holdAt.getTime())}`);
    const still: any = await getDoc('new_user_data', D.full.id);
    expect(still.deliveryonholdby?.user, 'NUD-07: [NEGATIVE CONTROL] showing a change writes nothing back').toBe(D.holder.id);
    await page.getByTestId('nud-close').click();
    await expect(page.getByTestId('nud-dialog')).toHaveCount(0);

    await rowBody(page, D.throwaway.name).click();
    await expect(page.getByTestId('nud-dialog')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('nud-name')).toHaveText(D.throwaway.name);
    await expect(holdSwitch(page), 'NUD-07 precondition: editable while the person exists').toBeEnabled();
    await expect(page.getByTestId('nud-missing')).toHaveCount(0);

    await deleteNewUser(D.throwaway.id);
    await expect(page.getByTestId('nud-missing'), 'NUD-07: the deletion is announced').toHaveText('This person is no longer in New Users.', { timeout: 20_000 });
    await expect(holdSwitch(page), 'NUD-07: ...and the switch is disabled').toBeDisabled();
    await expect(page.getByTestId('nud-name'), 'NUD-07: the last known details stay').toHaveText(D.throwaway.name);
    expect(await getDoc('new_user_data', D.throwaway.id), 'NUD-07: the person stays deleted').toBeNull();
  });

  // ===========================================================================================
  // NUD-08 — a phone (390px): tapping the card opens the details, which fit the width (no sideways scroll on the
  // page or inside the dialog), and the switch can be reached.
  // ===========================================================================================
  test('NUD-08 at 390px a tap on the card opens the details, which fit the screen with the switch reachable', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openScreen(page, D.full.name);
    await expect(page.getByTestId('new-card-bar'), 'NUD-08 precondition: the phone card layout is on').toBeVisible();
    await rowBody(page, D.full.name).click();
    const dialog = page.getByTestId('nud-dialog');
    await expect(dialog, 'NUD-08: the card opens the details').toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('nud-name')).toHaveText(D.full.name);
    await expect(page.getByTestId('nud-tag').first()).toBeVisible();

    const doc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(doc.sw, `NUD-08: no sideways page scroll (${doc.sw} > ${doc.cw})`).toBeLessThanOrEqual(doc.cw);
    // Every box that scrolls or clips: an overflow-hidden box still reports its full content width in scrollWidth,
    // so a value cut off at the edge shows here even though nothing scrolls.
    const boxes = await dialog.evaluate((root: Element) => [root, ...Array.from(root.querySelectorAll('.nud-head, .nud-body, .nud-hold'))]
      .map(el => ({ cls: (el as HTMLElement).className, sw: el.scrollWidth, cw: el.clientWidth })));
    expect(boxes.length, 'NUD-08 precondition: the root, header, body and hold section are measured').toBe(4);
    for (const bx of boxes) {
      expect(bx.sw, `NUD-08: nothing in "${bx.cls}" overflows sideways (${bx.sw} > ${bx.cw})`).toBeLessThanOrEqual(bx.cw);
    }
    const b = await dialog.boundingBox();
    expect(b, 'NUD-08: the dialog has a box').not.toBeNull();
    expect(b!.x, 'NUD-08: the dialog starts on screen').toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width, 'NUD-08: the dialog ends on screen').toBeLessThanOrEqual(390.5);

    await expect(page.getByTestId('nud-close'), 'NUD-08: ✕ is on screen').toBeInViewport();
    await holdSwitch(page).scrollIntoViewIfNeeded();
    await expect(holdSwitch(page), 'NUD-08: the switch can be reached').toBeInViewport();
    await expect(holdSwitch(page)).toBeEnabled();
  });

  // ===========================================================================================
  // NUD-09 — Delivery on hold is the ONLY control that can change anything: one switch, no text inputs, text areas,
  // selects or editable regions; and no field name appears anywhere in the dialog's words or labels.
  // ===========================================================================================
  test('NUD-09 one switch is the only editable control, and no field names are shown', async ({ page }) => {
    await loginAsWshopAdmin(page);
    await openScreen(page, D.full.name);
    await rowBody(page, D.full.name).click();
    const dialog = page.getByTestId('nud-dialog');
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('nud-tag').first()).toBeVisible();

    await expect(dialog.locator('[role="switch"]'), 'NUD-09: exactly one switch').toHaveCount(1);
    await expect(page.getByTestId('nud-hold-toggle').locator('[role="switch"]'), 'NUD-09: ...the Delivery on hold one').toHaveCount(1);
    const inputs = await dialog.locator('input:not([type="hidden"])').count();
    const toggleInputs = await page.getByTestId('nud-hold-toggle').locator('input:not([type="hidden"])').count();
    expect(inputs - toggleInputs, 'NUD-09: no input besides the switch\'s own').toBe(0);
    await expect(dialog.locator('textarea, select, [contenteditable]:not([contenteditable="false"])'), 'NUD-09: nothing else to type in').toHaveCount(0);

    const words = await dialog.evaluate((el: Element) => {
      const attrs = Array.from(el.querySelectorAll('[title], [aria-label], [placeholder]'))
        .flatMap(n => ['title', 'aria-label', 'placeholder'].map(a => n.getAttribute(a) || ''));
      return [(el as HTMLElement).innerText, ...attrs].join(' ').toLowerCase();
    });
    for (const field of ['deliveryonhold', 'movedtoexist', 'last_login', 'countrycode', 'phonenumber', 'movedon', 'new_user_data', 'profileid']) {
      expect(words, `NUD-09: the field name "${field}" is never shown`).not.toContain(field);
    }

    // Reference-only: a failed save. Not drivable on the emulator — its rules are open, and a write that cannot
    // reach the server is retried by the SDK rather than rejected — so on a healthy dialog it must be absent.
    await expect(page.getByTestId('nud-hold-error')).toHaveCount(0);   // reference-only: updateDoc rejected
  });
});
