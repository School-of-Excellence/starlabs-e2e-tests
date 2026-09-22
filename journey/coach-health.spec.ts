// coach-health.spec.ts — /journey-coach-health: finance tiles, the Needs-attention rule, A&H tags,
// the slide-over A&H sections, the theme toggle and the Schedule split (REAL-UI, anti-circular).
//
// Hook prefixes (one per component):
//   jchd — JourneyCoachHealthDashboardComponent (journey-coach-health-dashboard.component.html)
//   jcso — ParticipantSlideoverComponent        (participant-slideover.component.ts, inline template)
//   afl  — AhFlagListDialogComponent            (ah-flag-list-dialog.component.ts, inline template)
//
// Reference: starlabs-angular specs/journals/2026-09-22-jc-health-pull-joshua-sep22.md — the merge that
// brought Joshua's JC-health features (A&H tags, single Needs-attention rule, Defaulted/Missed tiles,
// JC-vs-Onboarding Schedule, dark/light theme, slide-over Love Letter / Ask A&H) onto this branch.
// Before this file the screen had only a mount smoke (JP-26) and an addressable block whose
// `expect(locator).toBeTruthy()` can never fail — nothing asserted behaviour.
//
// SEEDED WORLD (seed-journey.js step 6). The journeycoach logs in, so the dashboard opens scoped to that
// coach's base (full mode) — the shared All view is never read, and only these docs can move a number:
//   A active · 'Defaulted' (capital D)  · unresolved critical Love Letter (10d)
//   B active · 'late'                   · unresolved tagged Ask A&H (3d)
//   C active · 'locked'                 · critical Love Letter, RESOLVED
//   D DISCONTINUED · 'defaulted'
//   E active · regular                  · critical Love Letter 200d old + a 'liked' one
//   F active · 'late', nothing else
//   X OFF-BASE (coached by admin) · 'defaulted' + critical Love Letter
//   Appointments: JC tomorrow (A), Onboarding tomorrow (B), JC yesterday unattended (C),
//                 JC tomorrow CANCELLED (A), JC yesterday ATTENDED (B).
//
// ANTI-CIRCULARITY. The seed writes raw source docs only (customerstatus, financialstatus, A&H flags,
// appointment state). Every figure asserted is something the APP derives: tile counts, the
// Needs-attention set, which rows carry which chip, the Schedule buckets. The expected counts are
// re-derived here from the source docs through the Admin SDK — two readers of the same data; the test
// writes neither the tally nor the view. Each rule has a seeded participant it must EXCLUDE:
//   Defaulted tile  — D (discontinued, outside the Active default) and X (another coach's base)
//   Case-insensitive finance filter — A is 'Defaulted', the tile filters on 'defaulted'
//   A&H chips       — C (resolved), E (older than 180 days / only 'liked')
//   Needs attention — E (nothing live), F ('late' alone is not needs-attention), D, X
//   Schedule        — the cancelled and the attended appointment
//
// NOT COVERED HERE: the emulator's Firestore rules are fully permissive (ci/overlay/firestore.rules), so a
// coach who is DENIED `love letter` / `ask AH` (the dashboard then drops A&H signals silently) cannot be
// reproduced in this lane.
import { test, expect, Page } from '@playwright/test';
import { installJourneyStubs, attachJourneyGuard, loginAsJourneyCoach, journeyProfileIds, jchParticipants as P, jchTexts } from './support/journey';
import { assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { queryWhere } from '../queue/support/firestore-admin';

const RUN = process.env.JNY_RUNID || 'jny';
const COACH = journeyProfileIds.journeycoach;

let guard: ConsoleGuard;
test.beforeEach(async ({ page }) => {
  guard = attachJourneyGuard(page);
  await installJourneyStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'coach health: no fatal console errors / pageerrors'));

// ---- independent oracle over the seeded source docs ------------------------------------------------
type Meta = { id: string; coachedby?: any; customerstatus?: string; financialstatus?: string };
const refId = (x: any): string | null => (typeof x === 'string' ? x : x?.id ?? x?._path?.segments?.slice(-1)[0] ?? null);
const onCoach = (m: Meta) => (Array.isArray(m.coachedby) ? m.coachedby : [m.coachedby]).some((x) => refId(x) === COACH);
const isActive = (m: Meta) => (m.customerstatus ?? '').toLowerCase().trim() === 'active';
const fin = (m: Meta) => (m.financialstatus ?? '').toLowerCase();

async function coachBase(): Promise<Meta[]> {
  const docs = (await queryWhere('participant metadata', [['testrunid', '==', RUN]])) as Meta[];
  return docs.filter(onCoach);
}
/** profileids with an unresolved critical / tagged A&H entry created in the last 180 days. */
async function ahFlagged(): Promise<{ critical: Set<string>; attention: Set<string> }> {
  const since = Date.now() - 180 * 86400e3;
  const critical = new Set<string>(); const attention = new Set<string>();
  for (const coll of ['love letter', 'ask AH']) {
    for (const d of await queryWhere(coll, [['testrunid', '==', RUN]]) as any[]) {
      const created = d.created?.toMillis?.() ?? 0;
      if (d.resolved === true || created < since) continue;
      if (d.critical === true) critical.add(d.profileid);
      if (d.tagged === true) attention.add(d.profileid);
    }
  }
  return { critical, attention };
}

/** Every seeded A&H source doc inside the card's 180-day window, tagged with its collection. */
async function ahDocsInWindow(): Promise<any[]> {
  const since = Date.now() - 180 * 86400e3;
  const out: any[] = [];
  for (const coll of ['ask AH', 'love letter']) {
    for (const d of (await queryWhere(coll, [['testrunid', '==', RUN]])) as any[]) {
      if ((d.created?.toMillis?.() ?? 0) >= since) out.push({ ...d, _coll: coll });
    }
  }
  return out;
}

async function openDashboard(page: Page) {
  await loginAsJourneyCoach(page);
  await page.goto('/journey-coach-health', { waitUntil: 'domcontentloaded' });
  const host = page.locator('app-journey-coach-health-dashboard');
  await expect(host, 'the dashboard must mount — check the /journey-coach-health grant if this fails').toBeAttached({ timeout: 30_000 });
  return host;
}
async function openParticipants(page: Page) {
  await page.getByTestId('jchd-matbuttontogglegroup-001').getByText('Participants', { exact: true }).click();
  await expect(page.getByTestId('jchd-tr-070').filter({ hasText: P.A.name }), 'the coach base must render in the table').toBeVisible({ timeout: 30_000 });
}
const row = (page: Page, name: string) => page.getByTestId('jchd-tr-070').filter({ hasText: name });

test.describe('Journey — JC Health (finance tiles, Needs-attention rule, A&H tags, slide-over, schedule)', () => {
  test('JCH-01 Defaulted and Missed tiles count the coach\'s active base, case-insensitively', async ({ page }) => {
    const base = await coachBase();
    const defaulted = base.filter((m) => isActive(m) && fin(m) === 'defaulted').length;   // A only (D discontinued, X off-base)
    const missed = base.filter((m) => isActive(m) && fin(m) === 'late').length;           // B + F
    expect(defaulted, 'oracle sanity: the seed must give exactly one active defaulted participant').toBe(1);
    expect(missed, 'oracle sanity: the seed must give exactly two active late participants').toBe(2);

    await openDashboard(page);
    await expect(page.getByTestId('jchd-kpi-defaulted').locator('.ios2-n'),
      `JCH-01: Defaulted = active base with financialstatus 'defaulted' in any case (${defaulted})`).toHaveText(String(defaulted), { timeout: 45_000 });
    await expect(page.getByTestId('jchd-kpi-missed').locator('.ios2-n'),
      `JCH-01: Missed = active base with financialstatus 'late' (${missed})`).toHaveText(String(missed), { timeout: 45_000 });
  });

  test('JCH-02 the Defaulted tile opens Participants filtered to exactly the defaulted participant', async ({ page }) => {
    await openDashboard(page);
    await expect(page.getByTestId('jchd-kpi-defaulted').locator('.ios2-n')).toHaveText('1', { timeout: 45_000 });
    await page.getByTestId('jchd-kpi-defaulted').click();

    const rows = page.getByTestId('jchd-tr-070');
    await expect(rows.filter({ hasText: P.A.name }), 'JCH-02: A (\'Defaulted\', capital D) must match the lowercase filter').toBeVisible({ timeout: 30_000 });
    await expect(rows, 'JCH-02: only A — not D (discontinued), X (off-base), C (locked) or the late pair').toHaveCount(1);
  });

  test('JCH-03 A&H chips show only for unresolved critical / needs-attention entries from the last 180 days', async ({ page }) => {
    const ah = await ahFlagged();
    expect([...ah.critical].sort(), 'oracle sanity: critical = A and X').toEqual([P.A.pf, P.X.pf].sort());
    expect([...ah.attention], 'oracle sanity: attention = B').toEqual([P.B.pf]);

    await openDashboard(page);
    await openParticipants(page);
    await expect(row(page, P.A.name).getByTestId('jchd-ah-critical'), 'JCH-03: A has an unresolved critical Love Letter').toBeVisible({ timeout: 30_000 });
    await expect(row(page, P.B.name).getByTestId('jchd-ah-attention'), 'JCH-03: B has an unresolved tagged Ask A&H').toBeVisible();
    for (const [who, why] of [[P.C, 'its critical letter is resolved'], [P.E, 'its critical letter is 200 days old; the other is only liked']] as const) {
      await expect(row(page, who.name).getByTestId('jchd-ah-critical'), `JCH-03: no critical chip on ${who.name} — ${why}`).toHaveCount(0);
      await expect(row(page, who.name).getByTestId('jchd-ah-attention'), `JCH-03: no attention chip on ${who.name}`).toHaveCount(0);
    }
  });

  test('JCH-04 Needs attention = lapsed / not started / tickets / locked-or-defaulted / A&H — not late alone', async ({ page }) => {
    const base = (await coachBase()).filter(isActive);
    const ah = await ahFlagged();
    const expected = base.filter((m) => ['locked', 'defaulted'].includes(fin(m)) || ah.critical.has(m.id) || ah.attention.has(m.id)).length;
    expect(expected, 'oracle sanity: A (defaulted + A&H), B (A&H only), C (locked) — not E, F, D or X').toBe(3);

    await openDashboard(page);
    await expect(page.getByTestId('jchd-btn-014').locator('.ios2-big'),
      `JCH-04: the Needs-attention hero must count A, B, C (${expected})`).toHaveText(String(expected), { timeout: 45_000 });
  });

  test('JCH-05 the slide-over lists the participant\'s Love Letter and Ask A&H entries with their tags', async ({ page }) => {
    await openDashboard(page);
    await openParticipants(page);

    await row(page, P.A.name).click();
    const so = page.locator('app-participant-slideover');
    await expect(so, 'JCH-05: clicking a row opens the slide-over').toBeVisible({ timeout: 30_000 });
    const letter = so.getByTestId('jcso-ll-row').filter({ hasText: jchTexts.criticalLetter });
    await expect(letter, 'JCH-05: A\'s letter text comes from the `loveletter` field').toBeVisible({ timeout: 30_000 });
    await expect(letter, 'JCH-05: the critical tag renders as a chip').toContainText('critical');
    await so.getByTestId('jcso-ll-toggle').click();
    await expect(so.getByTestId('jcso-ll-row'), 'JCH-05: the section header collapses the list').toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(so).toHaveCount(0, { timeout: 10_000 });

    await row(page, P.B.name).click();
    const ask = page.locator('app-participant-slideover').getByTestId('jcso-ah-row').filter({ hasText: jchTexts.askQuestion });
    await expect(ask, 'JCH-05: B\'s Ask A&H entry renders').toBeVisible({ timeout: 30_000 });
    await expect(ask, 'JCH-05: tagged renders as "needs attention"').toContainText('needs attention');
  });

  test('JCH-06 the theme toggle switches dark/light and the choice survives a reload', async ({ page }) => {
    await openDashboard(page);
    const wrap = page.locator('app-journey-coach-health-dashboard .jchd-wrap');
    await page.getByTestId('jchd-theme-toggle').click();
    await expect(wrap, 'JCH-06: first toggle from the (light) default sets dark').toHaveAttribute('data-theme', 'dark');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(wrap, 'JCH-06: the choice is read back from localStorage').toHaveAttribute('data-theme', 'dark', { timeout: 30_000 });
    await page.getByTestId('jchd-theme-toggle').click();
    await expect(wrap).toHaveAttribute('data-theme', 'light');
  });

  // KNOWN DEFECT — expected to fail until fixed (convention: JP-20 / CN-20).
  // In a coach's own scope (full mode) the dashboard never runs loadContactEvents(): it is only called
  // from the All/Unassigned background load and from the Coaches tab. jcPendingEvents stays empty and
  // contactDataLoaded never flips, so the Schedule card sits on "loading…" with zeros (the JC pipeline
  // card has the same gap). When the load is fixed this starts passing and test.fail() must come off.
  test('JCH-07 Schedule splits Journey Coaching from Onboarding and drops cancelled / attended sessions', async ({ page }) => {
    test.fail();
    await openDashboard(page);
    const card = page.getByTestId('jchd-sched-card');
    await expect(card, 'JCH-07: the Schedule card renders on the Summary view').toBeVisible({ timeout: 30_000 });
    await expect(card.getByText('loading…'), 'JCH-07: the appointments read must complete in coach scope').toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByTestId('jchd-sched-jc-today').locator('.jcp-num'), 'JCH-07: nothing is due today').toHaveText('0');
    await expect(page.getByTestId('jchd-sched-jc-week').locator('.jcp-num'), 'JCH-07: JC tomorrow (A); the cancelled one is dropped').toHaveText('1');
    await expect(page.getByTestId('jchd-sched-jc-overdue').locator('.jcp-num'), 'JCH-07: JC yesterday unattended (C); the attended one is dropped').toHaveText('1');
    await expect(page.getByTestId('jchd-sched-ob-today').locator('.jcp-num')).toHaveText('0');
    await expect(page.getByTestId('jchd-sched-ob-week').locator('.jcp-num'), 'JCH-07: onboarding tomorrow (B) goes to the Onboarding column').toHaveText('1');
    await expect(page.getByTestId('jchd-sched-ob-overdue').locator('.jcp-num')).toHaveText('0');
    await expect(page.getByTestId('jchd-sched-jc-row'), 'JCH-07: two JC rows (tomorrow + overdue)').toHaveCount(2);
    await expect(page.getByTestId('jchd-sched-ob-row'), 'JCH-07: one Onboarding row').toHaveCount(1);
  });

  // ===== Joshua's 2026-09-22 follow-ups: A&H analytics card + its drill-down, NA reason chips =====

  test('JCH-08 the A&H analytics card counts source documents in the 180-day window, by flag and source', async ({ page }) => {
    const docs = await ahDocsInWindow();
    const n = (coll: 'ask AH' | 'love letter' | 'both', pred: (d: any) => boolean) =>
      docs.filter((d) => (coll === 'both' || d._coll === coll) && pred(d)).length;
    const expected = {
      loveCritical: n('love letter', (d) => d.critical === true),          // A + C(resolved) + X
      askTagged: n('ask AH', (d) => d.tagged === true),                    // B
      combinedOpportunity: n('both', (d) => d.opportunity === true),       // none seeded
      resolvedCritical: n('both', (d) => d.critical === true && d.resolved === true),   // C
      unflagged: n('both', (d) => !d.liked && !d.tagged && !d.opportunity && !d.critical),
    };
    expect(expected, 'oracle sanity: the seeded A&H world (E\'s 200-day-old critical letter is OUTSIDE the window)')
      .toEqual({ loveCritical: 3, askTagged: 1, combinedOpportunity: 0, resolvedCritical: 1, unflagged: 1 });

    await openDashboard(page);
    await expect(page.getByTestId('jchd-ahcell-critical-love'),
      'JCH-08: Love Letter · Critical counts unresolved AND resolved critical letters, but not the 200-day-old one')
      .toHaveText(String(expected.loveCritical), { timeout: 45_000 });
    await expect(page.getByTestId('jchd-ahcell-tagged-ask'), 'JCH-08: Ask AH · Needs Attention').toHaveText(String(expected.askTagged));
    await expect(page.getByTestId('jchd-ahcell-opportunity-both'), 'JCH-08: nothing seeded carries the opportunity flag').toHaveText('0');
    await expect(page.getByTestId('jchd-ahcell-critical-res'), 'JCH-08: the Resolved column counts only resolved docs').toHaveText(String(expected.resolvedCritical));
    await expect(page.getByTestId('jchd-ahmini-unflagged').locator('.ah-mini-n'), 'JCH-08: the plain letter is the only unflagged doc').toHaveText(String(expected.unflagged));
  });

  test('JCH-09 clicking an A&H count lists one row per source document and opens the participant', async ({ page }) => {
    await openDashboard(page);
    const critical = page.getByTestId('jchd-ahcell-critical-love');
    await expect(critical).toHaveText('3', { timeout: 45_000 });
    await critical.click();

    const dialog = page.locator('app-ah-flag-list-dialog');
    await expect(dialog, 'JCH-09: the drill-down dialog opens').toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByTestId('afl-count'), 'JCH-09: the dialog header repeats the clicked count').toHaveText('3');
    await expect(dialog.getByTestId('afl-row'),
      'JCH-09: ONE row per source document (C has a resolved letter, X is on another base) — the list reconciles the cell')
      .toHaveCount(3);

    await dialog.getByTestId('afl-row').filter({ hasText: P.A.name }).click();
    await expect(dialog, 'JCH-09: picking a row closes the dialog').toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('app-participant-slideover').getByText(P.A.name).first(),
      'JCH-09: …and opens that participant\'s slide-over').toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('app-participant-slideover')).toHaveCount(0, { timeout: 10_000 });

    // a zero cell has nothing to show — the dashboard must not open an empty dialog
    await page.getByTestId('jchd-ahcell-opportunity-both').click();
    await expect(page.locator('app-ah-flag-list-dialog'), 'JCH-09: a 0 count opens nothing').toHaveCount(0);
  });

  test('JCH-10 Needs-attention rows carry a chip per live condition, and clean rows carry none', async ({ page }) => {
    await openDashboard(page);
    await openParticipants(page);
    const chipsOf = (name: string) => row(page, name).getByTestId('jchd-na-reason');
    await expect(chipsOf(P.A.name), 'JCH-10: A is defaulted AND A&H critical — one chip each')
      .toHaveText(['Payments defaulted', 'Critical'], { timeout: 30_000 });
    await expect(chipsOf(P.B.name), 'JCH-10: B reaches Needs attention through its Ask A&H tag alone (late is not a condition)')
      .toHaveText(['Needs Attention']);
    await expect(chipsOf(P.C.name), 'JCH-10: C is locked').toHaveText(['Payments locked']);
    await expect(chipsOf(P.F.name), 'JCH-10: F is only late — not a needs-attention condition, so no chips').toHaveCount(0);
    await expect(chipsOf(P.E.name), 'JCH-10: E has nothing live').toHaveCount(0);
  });

  // ---- hooks no case drives yet ----
  test.fixme('JCH-ADDR1 A&H opportunity chip, drill-down Close, source pills, slide-over show-all / Ask A&H toggle addressable (deferred behavioral)', async ({ page }) => {
    await page.goto('/journey-coach-health', { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('jchd-ah-opportunity')).toBeTruthy();
    expect(page.getByTestId('jchd-ahsrc-ask')).toBeTruthy();
    expect(page.getByTestId('jchd-ahsrc-love')).toBeTruthy();
    expect(page.getByTestId('jchd-ahcell-liked-ask')).toBeTruthy();
    expect(page.getByTestId('jchd-ahcell-liked-love')).toBeTruthy();
    expect(page.getByTestId('jchd-ahcell-liked-both')).toBeTruthy();
    expect(page.getByTestId('jchd-ahcell-liked-res')).toBeTruthy();
    expect(page.getByTestId('jchd-ahcell-tagged-love')).toBeTruthy();
    expect(page.getByTestId('jchd-ahcell-tagged-both')).toBeTruthy();
    expect(page.getByTestId('jchd-ahcell-tagged-res')).toBeTruthy();
    expect(page.getByTestId('jchd-ahcell-opportunity-ask')).toBeTruthy();
    expect(page.getByTestId('jchd-ahcell-opportunity-love')).toBeTruthy();
    expect(page.getByTestId('jchd-ahcell-opportunity-res')).toBeTruthy();
    expect(page.getByTestId('jchd-ahcell-critical-ask')).toBeTruthy();
    expect(page.getByTestId('jchd-ahcell-critical-both')).toBeTruthy();
    expect(page.getByTestId('jchd-ahmini-positive')).toBeTruthy();
    expect(page.getByTestId('jchd-ahmini-critattn')).toBeTruthy();
    expect(page.getByTestId('afl-close')).toBeTruthy();
    expect(page.getByTestId('jcso-ll-showall')).toBeTruthy();
    expect(page.getByTestId('jcso-ah-toggle')).toBeTruthy();
    expect(page.getByTestId('jcso-ah-showall')).toBeTruthy();
  });
});
