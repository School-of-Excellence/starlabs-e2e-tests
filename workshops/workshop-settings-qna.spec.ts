// workshop-settings-qna.spec.ts — Settings → Dashboard Access → Q&A (2026-11-24).
//
// Hook prefix: ws (workshop-settingsv2 component) — this file drives its ws-qna-* hooks.
// App: starlabs-angular src/app/New-Workshop/workshop-configurationv2/settings/qna-settings.ts and
//      workshop-settingsv2.component.{ts,html}. Plan: specs/plans/2026-11-24-workshop-settings-qna.md.
//
// THE RULE UNDER TEST: a Q&A block inside Dashboard Access edits a title, an admin text, a list of admins
// (participants only — new users are never offered, several may be picked) and four switches (split, video
// time, same question, allow like). Save Access stores them in workshopsettings/{workshop id} as ONE map
// named `q&a`:  { title, admintext, admin: [profileid…], enablesplit, enablevideotime, samequestion, allowlike }
// replaced whole, and written only when it changed — saving access alone never creates it.
//
// Anti-circularity:
//   · WSQ-01 and WSQ-03 start from resetDashboardAccess(), a whole-document set with NO q&a field, so any
//     map read back afterwards can only be the APP's write. The expected values are the ones the test
//     typed and picked in the UI, never a seed value.
//   · WSQ-02 seeds a map (precondition write), asserts the screen RENDERED it, then edits it and asserts
//     the app's write replaced it whole (the removed admin is gone, every field is the edited one).
// Negative controls:
//   · NU Alpha is a still-new user (new_user_data only, no participant metadata row): the admins picker
//     says "Nobody matches." for that name, while a participant's name in the same box does match.
//   · WSQ-03: saving a grant change with Q&A untouched leaves the document without a q&a field.
//   · The seeded grant for `limited` survives every Q&A save (the save touches only its own field).
// All reads are single-doc gets — NO composite index needed.
import { test, expect, Page } from '@playwright/test';
import {
  wsIds, wsMetaNames, wsProfileIds, wsAddNames, wsLimitedGrants,
  installWshopStubs, loginAsWshopAdmin, alignWorkshopMetadataNames,
  workshopDashboardAccess, resetDashboardAccess, workshopQna, seedWorkshopQna,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { pollUntil } from '../queue/support/firestore-admin';

/** Picker labels are the `participant metadata` names (the CF rewrites them to the actor email). */
const LIMITED_NAME = wsMetaNames.limited;
const CHARLIE = wsMetaNames.p2;
const MOVER_NAME = wsMetaNames.mover;

/** Open the workshop editor's Settings tab and expand Dashboard Access (it starts collapsed). */
async function openAccessSection(page: Page): Promise<void> {
  await page.goto(`/workshopconfig/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
  const settingsTab = page.locator('.tabs .tab', { hasText: 'Settings' });
  await expect(settingsTab, 'the Settings tab must render for someone who can edit').toBeVisible({ timeout: 30_000 });
  await settingsTab.click();
  const head = page.getByTestId('ws-access-section');
  await expect(head, 'the Dashboard Access section header must render').toBeVisible({ timeout: 30_000 });
  if (!(await page.getByTestId('ws-access-state').isVisible().catch(() => false))) await head.click();
  await expect(page.getByTestId('ws-access-state'), 'the section must finish loading its people')
    .toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('ws-qna-section'), 'the Q&A block renders inside Dashboard Access')
    .toBeVisible({ timeout: 15_000 });
}

/** Type a name into the (already open) admins picker and click the matching option. */
async function pickQnaAdmin(page: Page, name: string): Promise<void> {
  await page.getByTestId('ws-qna-admins-search').fill(name);
  const option = page.getByTestId('ws-qna-admins-option').filter({ hasText: name }).first();
  await expect(option, `"${name}" must be offered in the Q&A admins picker`).toBeVisible({ timeout: 15_000 });
  await option.click();
}

const qnaChip = (page: Page, name: string) => page.getByTestId('ws-qna-admins-chip').filter({ hasText: name });

test.describe('Workshop Settings — Q&A in Dashboard Access (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await alignWorkshopMetadataNames();
    await resetDashboardAccess();
  });
  test.afterEach(async () => {
    await resetDashboardAccess();
    assertNoFatal(guard, 'settings Q&A: no fatal console errors / pageerrors');
  });

  // ===========================================================================================
  // WSQ-01 — fill everything on a workshop with no Q&A yet; the save writes exactly that map
  // ===========================================================================================
  test('WSQ-01 title, admin text, admins and switches are saved as the q&a map', async ({ page }) => {
    expect(await workshopQna(wsIds.W_DASH), 'WSQ-01: precondition — W_DASH has no q&a map').toBeNull();
    await loginAsWshopAdmin(page);
    await openAccessSection(page);

    // [REAL-UI] empty on arrival: nothing stored, nothing shown.
    await expect(page.getByTestId('ws-qna-title'), 'WSQ-01: title starts empty').toHaveValue('');
    await expect(page.getByTestId('ws-qna-admintext'), 'WSQ-01: admin text starts empty').toHaveValue('');
    await expect(page.getByTestId('ws-qna-admins-count'), 'WSQ-01: no admins yet').toHaveText(/^\s*0 selected\s*$/);
    await expect(page.getByTestId('ws-qna-split'), 'WSQ-01: split starts off').not.toHaveClass(/\bon\b/);
    await expect(page.getByTestId('ws-qna-videotime'), 'WSQ-01: video time starts off').not.toHaveClass(/\bon\b/);
    await expect(page.getByTestId('ws-qna-samequestion'), 'WSQ-01: same question starts off').not.toHaveClass(/\bon\b/);
    await expect(page.getByTestId('ws-qna-allowlike'), 'WSQ-01: allow like starts off').not.toHaveClass(/\bon\b/);

    await page.getByTestId('ws-qna-title').fill('Q&A');
    await page.getByTestId('ws-qna-admintext').fill('A&H Team');

    await page.getByTestId('ws-qna-admins-picker').click();
    // [ASSERT] NEGATIVE CONTROL first: a still-new user is never offered…
    await page.getByTestId('ws-qna-admins-search').fill(wsAddNames.nuAlpha);
    await expect(page.getByTestId('ws-qna-admins-option'), 'WSQ-01: a new user is not offered').toHaveCount(0);
    await expect(page.locator('.pop').getByText('Nobody matches.'), 'WSQ-01: the picker says nobody matches')
      .toBeVisible({ timeout: 15_000 });
    // …while participants in the same box are, and more than one can be picked.
    await pickQnaAdmin(page, LIMITED_NAME);
    await pickQnaAdmin(page, CHARLIE);
    await page.getByTestId('ws-qna-admins-done').click();
    await expect(page.getByTestId('ws-qna-admins-chip'), 'WSQ-01: both picked admins show as chips').toHaveCount(2);
    await expect(page.getByTestId('ws-qna-admins-count')).toHaveText(/^\s*2 selected\s*$/);

    await page.getByTestId('ws-qna-split').click();
    await expect(page.getByTestId('ws-qna-split'), 'WSQ-01: split is on').toHaveClass(/\bon\b/);
    await page.getByTestId('ws-qna-samequestion').click();
    await expect(page.getByTestId('ws-qna-samequestion'), 'WSQ-01: same question is on').toHaveClass(/\bon\b/);
    await page.getByTestId('ws-qna-allowlike').click();
    await expect(page.getByTestId('ws-qna-allowlike'), 'WSQ-01: allow like is on').toHaveClass(/\bon\b/);

    await page.getByTestId('ws-access-save').click();

    // [ASSERT] the APP's write, read back with the admin SDK, is exactly what was typed and picked.
    const written = await pollUntil(
      () => workshopQna(wsIds.W_DASH),
      (v: any) => !!v && typeof v === 'object',
      { timeoutMs: 30_000, label: 'WSQ-01 app write of q&a' },
    );
    expect(written, 'WSQ-01: the stored q&a map').toEqual({
      title: 'Q&A',
      admintext: 'A&H Team',
      admin: [wsProfileIds.limited, wsProfileIds.p2],
      enablesplit: true,
      enablevideotime: false,
      samequestion: true,
      allowlike: true,
    });
    // [ASSERT] the save touched only its own field: the seeded grant is still there.
    expect((await workshopDashboardAccess(wsIds.W_DASH))[wsProfileIds.limited], 'WSQ-01: an unrelated grant survives')
      .toEqual(wsLimitedGrants);
  });

  // ===========================================================================================
  // WSQ-02 — a stored map renders; editing it replaces the map whole
  // ===========================================================================================
  test('WSQ-02 a stored q&a map is shown, and an edit replaces it whole', async ({ page }) => {
    await seedWorkshopQna(wsIds.W_DASH, {
      title: 'Old title', admintext: 'Old team', admin: [wsProfileIds.p2, wsProfileIds.mover],
      enablesplit: true, enablevideotime: false, samequestion: true, allowlike: false,
    });
    await loginAsWshopAdmin(page);
    await openAccessSection(page);

    // [REAL-UI] the screen renders the stored map.
    await expect(page.getByTestId('ws-qna-title'), 'WSQ-02: stored title shown').toHaveValue('Old title');
    await expect(page.getByTestId('ws-qna-admintext'), 'WSQ-02: stored admin text shown').toHaveValue('Old team');
    await expect(qnaChip(page, CHARLIE), 'WSQ-02: stored admin p2 shown by name').toHaveCount(1);
    await expect(qnaChip(page, MOVER_NAME), 'WSQ-02: stored admin mover shown by name').toHaveCount(1);
    await expect(page.getByTestId('ws-qna-split'), 'WSQ-02: stored split shown on').toHaveClass(/\bon\b/);
    await expect(page.getByTestId('ws-qna-videotime'), 'WSQ-02: stored video time shown off').not.toHaveClass(/\bon\b/);
    await expect(page.getByTestId('ws-qna-samequestion'), 'WSQ-02: stored same question shown on').toHaveClass(/\bon\b/);
    await expect(page.getByTestId('ws-qna-allowlike'), 'WSQ-02: stored allow like shown off').not.toHaveClass(/\bon\b/);

    // Edit every kind of field: text, remove an admin, flip all four switches.
    await page.getByTestId('ws-qna-title').fill('New title');
    await qnaChip(page, CHARLIE).getByTestId('ws-qna-admins-remove').click();
    await expect(qnaChip(page, CHARLIE), 'WSQ-02: the removed admin leaves the chips').toHaveCount(0);
    await page.getByTestId('ws-qna-split').click();
    await page.getByTestId('ws-qna-videotime').click();
    await page.getByTestId('ws-qna-samequestion').click();
    await page.getByTestId('ws-qna-allowlike').click();

    await page.getByTestId('ws-access-save').click();

    // [ASSERT] the map was replaced whole: p2 is gone, the untouched admin text is kept, all four switches flipped.
    const written = await pollUntil(
      () => workshopQna(wsIds.W_DASH),
      (v: any) => v?.title === 'New title',
      { timeoutMs: 30_000, label: 'WSQ-02 app write of the edited q&a' },
    );
    expect(written, 'WSQ-02: the stored q&a map after the edit').toEqual({
      title: 'New title',
      admintext: 'Old team',
      admin: [wsProfileIds.mover],
      enablesplit: false,
      enablevideotime: true,
      samequestion: false,
      allowlike: true,
    });
    expect((await workshopDashboardAccess(wsIds.W_DASH))[wsProfileIds.limited], 'WSQ-02: an unrelated grant survives')
      .toEqual(wsLimitedGrants);
  });

  // ===========================================================================================
  // WSQ-03 — NEGATIVE CONTROL: saving access with Q&A untouched never creates the q&a map
  // ===========================================================================================
  test('WSQ-03 saving only a grant change leaves the workshop without a q&a map', async ({ page }) => {
    expect(await workshopQna(wsIds.W_DASH), 'WSQ-03: precondition — W_DASH has no q&a map').toBeNull();
    await loginAsWshopAdmin(page);
    await openAccessSection(page);

    // [REAL-UI] change only a grant: All on the seeded person's row.
    const row = page.getByTestId('ws-access-row').filter({ hasText: LIMITED_NAME });
    await expect(row, 'WSQ-03: the seeded person is listed').toBeVisible({ timeout: 15_000 });
    await row.getByTestId('ws-access-grant-all').click();
    const allCount = await row.locator('.acc-tick').count();
    expect(allCount, 'WSQ-03: precondition — All ticks more than the two seeded actions').toBeGreaterThan(wsLimitedGrants.length);

    await page.getByTestId('ws-access-save').click();

    // [ASSERT] the positive half: the save really ran (the grant change landed)…
    await pollUntil(
      async () => (await workshopDashboardAccess(wsIds.W_DASH))[wsProfileIds.limited],
      // All also stores actions hidden on a non-evergreen workshop, so compare with the seeded count, not allCount.
      (v: any) => Array.isArray(v) && v.length > wsLimitedGrants.length,
      { timeoutMs: 30_000, label: 'WSQ-03 app write of the grant change' },
    );
    // …and the negative: it did not create a q&a map nobody filled in.
    expect(await workshopQna(wsIds.W_DASH), 'WSQ-03: no q&a map is written when Q&A was not touched').toBeNull();
  });
});
