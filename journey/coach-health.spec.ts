// coach-health.spec.ts — /journey-coach-health: finance tiles, the Needs-attention rule, A&H tags,
// the slide-over A&H sections, the theme toggle and the Schedule split (REAL-UI, anti-circular).
//
// Hook prefixes (one per component):
//   jchd — JourneyCoachHealthDashboardComponent (journey-coach-health-dashboard.component.html)
//   jcso — ParticipantSlideoverComponent        (participant-slideover.component.ts, inline template)
//   (the A&H drill-down was a MatDialog with its own `afl` prefix until 2026-09-23; Joshua replaced it
//    with a native in-component overlay, so those hooks moved under `jchd` — see jchd-ahd-* below.)
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
// 2026-11-18 PULL (starlabs-angular specs/journals/2026-11-18-pull-joshua-jc-health-delivery-v4.md): Joshua's
// Journey tabs (Overall Summary / Onboarding / Ev. Prep / Journey Planning), Overall Summary cards, follow-ups
// (Schedule card + slide-over + row Due chip), the mini-card Defaulted filter, trend chips. His `jx-*`, `ov-*`,
// `sched-*` ids were renamed under `jchd-` and the slide-over's `so-*` under `jcso-` (one prefix per component).
// The embedded Ev. Prep board is its own component (prefix `evp`) and has its own spec, jc-evprep-board.spec.ts.
//   Needs attention: finance (locked / defaulted) is OUT since Joshua's 3ccd560d — JCH-04 / JCH-10 assert that;
//   the Defaulted figure moved to the hero finance chip (.ios2-fin-n).
//   Follow-ups world (seed step 6): A overdue · B today · C in 3 days · E in 20 days (beyond the horizon) ·
//   F closed by a schedule_done · X off-base. Expected buckets are re-derived from those docs (JCH-15).
//
// NOT COVERED HERE: the emulator's Firestore rules are fully permissive (ci/overlay/firestore.rules), so a
// coach who is DENIED `love letter` / `ask AH` (the dashboard then drops A&H signals silently) cannot be
// reproduced in this lane.
import { test, expect, Page } from '@playwright/test';
import { installJourneyStubs, attachJourneyGuard, loginAsJourneyCoach, journeyProfileIds, jchParticipants as P, jchTexts, jchFollowUps as FU, deleteDocsByField } from './support/journey';
import { assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { queryWhere, pollUntil } from '../queue/support/firestore-admin';

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
    await expect(page.getByTestId('jchd-kpi-defaulted').locator('.ios2-fin-n'),
      `JCH-01: Defaulted = active base with financialstatus 'defaulted' in any case (${defaulted})`).toHaveText(String(defaulted), { timeout: 45_000 });
    await expect(page.getByTestId('jchd-kpi-missed').locator('.ios2-n'),
      `JCH-01: Missed = active base with financialstatus 'late' (${missed})`).toHaveText(String(missed), { timeout: 45_000 });
  });

  test('JCH-02 the Defaulted tile opens Participants filtered to exactly the defaulted participant', async ({ page }) => {
    await openDashboard(page);
    await expect(page.getByTestId('jchd-kpi-defaulted').locator('.ios2-fin-n')).toHaveText('1', { timeout: 45_000 });
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

  test('JCH-04 Needs attention = lapsed / not started / tickets / A&H — not finance, not late alone', async ({ page }) => {
    const base = (await coachBase()).filter(isActive);
    const ah = await ahFlagged();
    // Finance is OUT of Needs attention since Joshua's 3ccd560d (2026-11-11, pulled 2026-11-18): locked / defaulted
    // have their own hero finance chips. C (locked only) is therefore the negative control for that rule now.
    const expected = base.filter((m) => ah.critical.has(m.id) || ah.attention.has(m.id)).length;
    expect(expected, 'oracle sanity: A (A&H critical), B (A&H attention) — not C (locked only), E, F, D or X').toBe(2);

    await openDashboard(page);
    await expect(page.getByTestId('jchd-btn-014').locator('.ios2-big'),
      `JCH-04: the Needs-attention hero must count A and B — C is only locked (${expected})`).toHaveText(String(expected), { timeout: 45_000 });
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

  // Was test.fail() until 2026-09-23: a coach's own scope never ran loadContactEvents() (only the
  // All/Unassigned background load and the Coaches tab did), so this card sat on "loading…" with zeros.
  // loadFullPortfolio now kicks the same background load, and the case asserts the real buckets.
  test('JCH-07 Schedule splits Journey Coaching from Onboarding and drops cancelled / attended sessions', async ({ page }) => {
    await openDashboard(page);
    const card = page.getByTestId('jchd-sched-card');
    await expect(card, 'JCH-07: the Schedule card renders on the Summary view').toBeVisible({ timeout: 30_000 });
    await expect(card.getByText('loading…'), 'JCH-07: the appointments read must complete in coach scope').toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByTestId('jchd-sched-jc-today').locator('.jcp-num'), 'JCH-07: nothing is due today').toHaveText('0');
    await expect(page.getByTestId('jchd-sched-jc-week').locator('.jcp-num'), 'JCH-07: JC tomorrow (A); the cancelled one is dropped').toHaveText('1');
    await expect(page.getByTestId('jchd-sched-jc-overdue').locator('.jcp-num'), 'JCH-07: JC yesterday unattended (C); the attended one is dropped').toHaveText('1');
    await expect(page.getByTestId('jchd-sched-ob-today').locator('.jcp-num')).toHaveText('0');
    await expect(page.getByTestId('jchd-sched-ob-week').locator('.jcp-num'), 'JCH-07: onboarding tomorrow (B) goes to the Onboarding column').toHaveText('1');
    await expect(page.getByTestId('jchd-sched-ob-overdue').locator('.jcp-num')).toHaveText('0');
    await expect(page.getByTestId('jchd-sched-jc-col').getByTestId('jchd-sched-jc-row'),
      'JCH-07: two rows in the Journey Coaching column (tomorrow + overdue)').toHaveCount(2);
    await expect(page.getByTestId('jchd-sched-ob-col').getByTestId('jchd-sched-ob-row'),
      'JCH-07: one row in the Onboarding column').toHaveCount(1);
  });

  // ===== Joshua's 2026-09-22 follow-ups: A&H analytics card + its drill-down, NA reason chips =====

  test('JCH-08 the A&H analytics card counts the COACH\'S OWN base inside the 180-day window', async ({ page }) => {
    // Scoped since 2026-09-23: the card used to read org-wide and showed a coach other coaches' numbers.
    const base = new Set((await coachBase()).map((m) => m.id));
    const docs = (await ahDocsInWindow()).filter((d) => base.has(d.profileid));
    const n = (coll: 'ask AH' | 'love letter' | 'both', pred: (d: any) => boolean) =>
      docs.filter((d) => (coll === 'both' || d._coll === coll) && pred(d)).length;
    const expected = {
      loveCritical: n('love letter', (d) => d.critical === true),          // A + C(resolved); X is off-base
      askTagged: n('ask AH', (d) => d.tagged === true),                    // B
      combinedOpportunity: n('both', (d) => d.opportunity === true),       // none seeded
      resolvedCritical: n('both', (d) => d.critical === true && d.resolved === true),   // C
      unflagged: n('both', (d) => !d.liked && !d.tagged && !d.opportunity && !d.critical),
    };
    expect(expected, 'oracle sanity: the coach\'s base only (X is on the admin\'s base; E\'s 200-day-old letter is outside the window)')
      .toEqual({ loveCritical: 2, askTagged: 1, combinedOpportunity: 0, resolvedCritical: 1, unflagged: 1 });

    await openDashboard(page);
    await expect(page.getByTestId('jchd-ahcell-critical-love'),
      'JCH-08: Love Letter · Critical counts unresolved AND resolved critical letters on THIS coach\'s base — not the 200-day-old one, not X')
      .toHaveText(String(expected.loveCritical), { timeout: 45_000 });
    await expect(page.getByTestId('jchd-ahcell-tagged-ask'), 'JCH-08: Ask AH · Needs Attention').toHaveText(String(expected.askTagged));
    await expect(page.getByTestId('jchd-ahcell-opportunity-both'), 'JCH-08: nothing seeded carries the opportunity flag').toHaveText('0');
    await expect(page.getByTestId('jchd-ahcell-critical-res'), 'JCH-08: the Resolved column counts only resolved docs').toHaveText(String(expected.resolvedCritical));
    await expect(page.getByTestId('jchd-ahmini-unflagged').locator('.ah-mini-n'), 'JCH-08: the plain letter is the only unflagged doc').toHaveText(String(expected.unflagged));
  });

  test('JCH-09 clicking an A&H count lists one row per source document and opens the participant', async ({ page }) => {
    await openDashboard(page);
    const critical = page.getByTestId('jchd-ahcell-critical-love');
    await expect(critical, 'the scoped count: A + C, not X').toHaveText('2', { timeout: 45_000 });
    await critical.click();

    const overlay = page.getByTestId('jchd-ahd-overlay');
    await expect(overlay, 'JCH-09: the native drill overlay opens (was a MatDialog before 2026-09-23)').toBeVisible({ timeout: 30_000 });
    await expect(overlay.getByTestId('jchd-ahd-count'), 'JCH-09: the overlay header repeats the clicked count').toHaveText('2');
    await expect(overlay.getByTestId('jchd-ahd-row'),
      'JCH-09: ONE row per source document (C\'s resolved letter counts; X is on another base and must not appear) — the list reconciles the cell')
      .toHaveCount(2);
    await expect(overlay.getByTestId('jchd-ahd-row').filter({ hasText: P.X.name }),
      'JCH-09: a coach cannot drill into another coach\'s participant').toHaveCount(0);

    await overlay.getByTestId('jchd-ahd-row').filter({ hasText: P.A.name }).click();
    await expect(overlay, 'JCH-09: picking a row closes the overlay').toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('app-participant-slideover').getByText(P.A.name).first(),
      'JCH-09: …and opens that participant\'s slide-over').toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('app-participant-slideover')).toHaveCount(0, { timeout: 10_000 });

    // a zero cell has nothing to show — the dashboard must not open an empty overlay
    await page.getByTestId('jchd-ahcell-opportunity-both').click();
    await expect(page.getByTestId('jchd-ahd-overlay'), 'JCH-09: a 0 count opens nothing').toHaveCount(0);

    // and both dismissals work: the Close button, and a click on the backdrop outside the panel
    await page.getByTestId('jchd-ahcell-critical-love').click();
    await expect(page.getByTestId('jchd-ahd-overlay')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('jchd-ahd-close').click();
    await expect(page.getByTestId('jchd-ahd-overlay'), 'JCH-09: Close dismisses the overlay').toHaveCount(0);

    await page.getByTestId('jchd-ahcell-critical-love').click();
    await expect(page.getByTestId('jchd-ahd-overlay')).toBeVisible({ timeout: 15_000 });
    // Click the backdrop at its LEFT EDGE, MID-HEIGHT. Not the top-left corner: the backdrop is
    // z-index 60 and the app's mat-toolbar sits above it, so a click up there lands on the toolbar
    // ("<mat-toolbar …> intercepts pointer events" — the real failure this replaces). Mid-height the
    // backdrop is genuinely the top-most element, and the panel is centred, so the point is outside it.
    const backdrop = page.getByTestId('jchd-ahd-backdrop');
    const box = await backdrop.boundingBox();
    await backdrop.click({ position: { x: 8, y: Math.round((box?.height ?? 600) / 2) } });
    await expect(page.getByTestId('jchd-ahd-overlay'), 'JCH-09: a click outside the panel dismisses it').toHaveCount(0);
  });

  test('JCH-10 Needs-attention rows carry a chip per live condition, and clean rows carry none', async ({ page }) => {
    await openDashboard(page);
    await openParticipants(page);
    const chipsOf = (name: string) => row(page, name).getByTestId('jchd-na-reason');
    await expect(chipsOf(P.A.name), 'JCH-10: A is A&H critical — its defaulted status is a finance chip, not a Needs-attention reason (3ccd560d)')
      .toHaveText(['Critical'], { timeout: 30_000 });
    await expect(chipsOf(P.B.name), 'JCH-10: B reaches Needs attention through its Ask A&H tag alone (late is not a condition)')
      .toHaveText(['Needs Attention']);
    await expect(chipsOf(P.C.name), 'JCH-10: C is only locked — finance is not a Needs-attention reason').toHaveCount(0);
    await expect(chipsOf(P.F.name), 'JCH-10: F is only late — not a needs-attention condition, so no chips').toHaveCount(0);
    await expect(chipsOf(P.E.name), 'JCH-10: E has nothing live').toHaveCount(0);
  });

  // ===== 2026-09-23 fixes: coach-dropdown re-scope, and "JC done" excluding onboarding =====

  test('JCH-11 changing the Viewing scope re-scopes the Participants table', async ({ page }) => {
    await openDashboard(page);
    await openParticipants(page);
    const table = page.getByTestId('jchd-participants-table');
    await expect(table.getByTestId('jchd-tr-070').filter({ hasText: P.X.name }),
      'JCH-11: X is on the admin\'s base — invisible in the coach\'s own scope').toHaveCount(0);
    const scoped = await table.getByTestId('jchd-tr-070').count();

    // Fix 2026-09-23: two-way [(ngModel)] pre-wrote selectedCoachId, so onCoachChange's same-coach
    // guard no-op'd and the table never rebuilt. Switching scope must now rebuild it.
    await page.getByTestId('jchd-sel-002').selectOption({ label: 'All participants' });
    await expect(table.getByTestId('jchd-tr-070').filter({ hasText: P.X.name }),
      'JCH-11: the All scope must rebuild the table and bring in off-base participants').toHaveCount(1, { timeout: 45_000 });
    expect(await table.getByTestId('jchd-tr-070').count(),
      'JCH-11: All is a superset of the coach\'s own base').toBeGreaterThan(scoped);
  });

  test('JCH-12 "JC done" counts coaching sessions only — an attended onboarding call is excluded', async ({ page }) => {
    // Seeded attended journey-coach appointments in the last 7 days: APT_DONE (coaching, B) and
    // APT_OB_DONE (ONBOARDING, A). The JC pipeline must count the first and drop the second.
    const attended = (await queryWhere('appointments', [['testrunid', '==', RUN], ['attended', '==', true]])) as any[];
    const coaching = attended.filter((a) => a.onboarding !== true && a.cancelled !== true).length;
    expect([coaching, attended.length],
      'oracle sanity: 2 attended appointments seeded, exactly 1 of them a coaching session').toEqual([1, 2]);

    // Runs in the coach's own scope: since the 2026-09-23 fix that view loads the appointments too
    // (before it, the pipeline card only ever filled in the ALL view — see JCH-07).
    await openDashboard(page);
    await expect(page.getByTestId('jchd-btn-025').locator('.jcp-num'),
      `JCH-12: JC done last week = attended COACHING sessions only (${coaching}) — the onboarding call is not one`)
      .toHaveText(String(coaching), { timeout: 60_000 });
  });


  // ===== 2026-11-18: Joshua's Journey tabs, Overall Summary, follow-ups, mini-card filter =====

  test('JCH-13 the Journey tabs mount on first visit; Onboarding and Ev. Prep stay alive off-screen, Overall is rebuilt', async ({ page }) => {
    await openDashboard(page);
    await expect(page.getByTestId('jchd-tabbar'), 'JCH-13: the tab bar renders').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('jchd-tab-planning'), 'JCH-13: Journey Planning is the default tab').toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('jchd-panel-onboarding'), 'JCH-13: nothing else mounts before its first visit').toHaveCount(0);
    await expect(page.getByTestId('jchd-panel-evprep')).toHaveCount(0);
    await expect(page.getByTestId('jchd-panel-overall')).toHaveCount(0);

    await page.getByTestId('jchd-tab-evprep').click();
    await expect(page.getByTestId('jchd-tab-evprep')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('jchd-panel-evprep'), 'JCH-13: Ev. Prep mounts on its first visit').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('jchd-evprep-board').getByTestId('evp-root'), 'JCH-13: …with the board inside').toBeAttached();
    await expect(page.getByTestId('jchd-kpi-defaulted'), 'JCH-13: the Planning screen is not rendered under another tab').toHaveCount(0);

    await page.getByTestId('jchd-tab-planning').click();
    await expect(page.getByTestId('jchd-kpi-defaulted'), 'JCH-13: back on Planning').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('jchd-panel-evprep'), 'JCH-13: Ev. Prep stays mounted (no re-read on the next visit)…').toHaveCount(1);
    await expect(page.getByTestId('jchd-panel-evprep'), 'JCH-13: …but hidden').toBeHidden();

    await page.getByTestId('jchd-tab-onboarding').click();
    await expect(page.getByTestId('jchd-panel-onboarding'), 'JCH-13: Onboarding mounts on its first visit').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('jchd-onboarding-sales'), 'JCH-13: …the embedded onboarding dashboard').toBeAttached();

    await page.getByTestId('jchd-tab-overall').click();
    await expect(page.getByTestId('jchd-panel-overall'), 'JCH-13: Overall Summary renders').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('jchd-panel-onboarding'), 'JCH-13: Overall reads the SAME onboarding instance — kept, hidden').toBeHidden();
    await expect(page.getByTestId('jchd-panel-onboarding')).toHaveCount(1);

    await page.getByTestId('jchd-tab-planning').click();
    await expect(page.getByTestId('jchd-panel-overall'), 'JCH-13: Overall is destroyed when you leave it').toHaveCount(0);
    await expect(page.getByTestId('jchd-panel-onboarding'), 'JCH-13: the onboarding instance survives').toHaveCount(1);
  });

  test('JCH-14 Overall Summary: schedule tiles match the seeded bookings; plans need a single coach; the month steps', async ({ page }) => {
    await openDashboard(page);
    await page.getByTestId('jchd-tab-overall').click();
    await expect(page.getByTestId('jchd-panel-overall')).toBeVisible({ timeout: 30_000 });
    for (const card of [page.getByTestId('jchd-ov-sales'), page.getByTestId('jchd-ov-onboarding'), page.getByTestId('jchd-ov-schedule'),
      page.getByTestId('jchd-ov-plan'), page.getByTestId('jchd-ov-health'), page.getByTestId('jchd-ov-ah')]) {
      await expect(card, 'JCH-14: every Overall card renders').toBeVisible({ timeout: 60_000 });
    }

    // Same seed and predicates as JCH-07 (coach scope): JC tomorrow (A) — the cancelled one is dropped; onboarding tomorrow (B).
    const sched = page.getByTestId('jchd-ov-schedule');
    await expect(sched.getByText('loading…'), 'JCH-14: the appointments read completes').toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByTestId('jchd-ov-jc-today').locator('.jcp-num'), 'JCH-14: no JC session today').toHaveText('0');
    await expect(page.getByTestId('jchd-ov-jc-week').locator('.jcp-num'), 'JCH-14: JC next 7 days = A tomorrow (cancelled dropped)').toHaveText('1');
    await expect(page.getByTestId('jchd-ov-jc-month').locator('.jcp-num'), 'JCH-14: next 30 days includes the next 7').toHaveText('1');
    await expect(page.getByTestId('jchd-ov-obs-today').locator('.jcp-num')).toHaveText('0');
    await expect(page.getByTestId('jchd-ov-obs-week').locator('.jcp-num'), 'JCH-14: onboarding tomorrow (B) counts on the Onboarding row').toHaveText('1');
    await expect(page.getByTestId('jchd-ov-obs-month').locator('.jcp-num')).toHaveText('1');

    // Plans read only for ONE coach's roster: the coach's own scope shows the grid, the All scope asks for a coach.
    await expect(page.getByTestId('jchd-ov-plan-pick'), 'JCH-14: coach scope → no "pick a coach" note').toHaveCount(0);
    await expect(page.getByTestId('jchd-ov-plan-grid'), 'JCH-14: the plan grid loads for the coach').toBeVisible({ timeout: 45_000 });
    await page.getByTestId('jchd-ov-viewing-select').selectOption({ label: 'All participants' });
    await expect(page.getByTestId('jchd-ov-plan-pick'), 'JCH-14: All scope → plans are not read; the card asks for a coach').toBeVisible({ timeout: 45_000 });

    // The month picker is the shared onboarding dashboard's range: next month moves the label, previous brings it back.
    const label = page.getByTestId('jchd-ov-date-label');
    await expect(label).toBeVisible({ timeout: 30_000 });
    const before = (await label.textContent())?.trim();
    await page.getByTestId('jchd-ov-date-next').click();
    await expect(label, 'JCH-14: › moves the range a month on').not.toHaveText(before ?? '', { timeout: 15_000 });
    await page.getByTestId('jchd-ov-date-prev').click();
    await expect(label, 'JCH-14: ‹ brings it back').toHaveText(before ?? '', { timeout: 15_000 });
  });

  test('JCH-15 follow-ups: the Schedule card buckets OPEN dated follow-ups of the coach\'s base; rows carry a Due chip', async ({ page }) => {
    // Re-arm B (JCH-16 marks it done; a retry of this case must not see that close).
    await deleteDocsByField('healthtracker_activity', 'scheduleId', FU.ids.B);

    // [ORACLE] open = type 'schedule' with no schedule_done pointing at it; on the coach's base; bucket by due day.
    const base = new Set((await coachBase()).map((m) => m.id));
    const evs = (await queryWhere('healthtracker_activity', [['testrunid', '==', RUN]])) as any[];
    const closed = new Set(evs.filter((e) => e.type === 'schedule_done').map((e) => e.scheduleId));
    const day0 = new Date(); day0.setHours(0, 0, 0, 0);
    const t0 = day0.getTime();
    const dayOf = (e: any) => { const d = e.dueDate.toDate(); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const open = evs.filter((e) => e.type === 'schedule' && !closed.has(e.id) && base.has(e.profileid));
    const expected = {
      overdue: open.filter((e) => dayOf(e) < t0).length,
      today: open.filter((e) => dayOf(e) === t0).length,
      week: open.filter((e) => dayOf(e) > t0 && dayOf(e) <= t0 + 7 * 86400e3).length,
    };
    expect(expected, 'oracle sanity: A overdue, B today, C in 3 days — E beyond 7 days, F closed, X off-base').toEqual({ overdue: 1, today: 1, week: 1 });

    await openDashboard(page);
    await expect(page.getByTestId('jchd-sched-fu'), 'JCH-15: the Follow-ups column renders on the Schedule card').toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('jchd-sched-fu-overdue').locator('.jcp-num'), 'JCH-15: Overdue = A').toHaveText(String(expected.overdue), { timeout: 45_000 });
    await expect(page.getByTestId('jchd-sched-fu-today').locator('.jcp-num'), 'JCH-15: Today = B').toHaveText(String(expected.today));
    await expect(page.getByTestId('jchd-sched-fu-week').locator('.jcp-num'), 'JCH-15: Next 7 days = C (E is 20 days out)').toHaveText(String(expected.week));

    const items = page.getByTestId('jchd-sched-fu-list').getByTestId('jchd-sched-fu-item');
    await expect(items, 'JCH-15: the list holds the three in-horizon follow-ups').toHaveCount(3);
    await expect(items.first(), 'JCH-15: earliest due first (A, overdue)').toContainText(P.A.name);
    for (const who of [P.E, P.F, P.X]) {
      await expect(items.filter({ hasText: who.name }), `JCH-15: ${who.name} must not be listed`).toHaveCount(0);
    }
    await page.getByTestId('jchd-sched-fu-overdue').click();
    await expect(items, 'JCH-15: the Overdue tile filters the list to A').toHaveCount(1);
    await expect(items.first()).toContainText(FU.note('A'));
    await page.getByTestId('jchd-sched-fu-overdue').click();
    await expect(items, 'JCH-15: clicking the active tile again shows all three').toHaveCount(3);

    // Row chip: the earliest OPEN DATED follow-up, whatever the horizon (E's 20-day one still shows); none for F (closed).
    await openParticipants(page);
    await expect(row(page, P.A.name).getByTestId('jchd-row-due'), 'JCH-15: A\'s chip is overdue').toHaveClass(/is-overdue/, { timeout: 30_000 });
    await expect(row(page, P.B.name).getByTestId('jchd-row-due'), 'JCH-15: B\'s chip (due today) is not overdue').not.toHaveClass(/is-overdue/);
    await expect(row(page, P.E.name).getByTestId('jchd-row-due'), 'JCH-15: E has a chip — the horizon only limits the card').toHaveCount(1);
    await expect(row(page, P.F.name).getByTestId('jchd-row-due'), 'JCH-15: F\'s only follow-up is closed').toHaveCount(0);
  });

  test('JCH-16 the slide-over lists a participant\'s open follow-ups and Mark done closes one', async ({ page }) => {
    await deleteDocsByField('healthtracker_activity', 'scheduleId', FU.ids.B);
    await openDashboard(page);
    await openParticipants(page);

    await row(page, P.F.name).click();
    const so = page.locator('app-participant-slideover');
    await expect(so.getByTestId('jcso-fu-empty'), 'JCH-16: F\'s only follow-up is closed → "No open follow-ups"').toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');
    await expect(so).toHaveCount(0, { timeout: 10_000 });

    await row(page, P.B.name).click();
    const item = so.getByTestId('jcso-fu-list').getByTestId('jcso-fu-item');
    await expect(item, 'JCH-16: B has one open follow-up').toHaveCount(1, { timeout: 30_000 });
    await expect(item).toContainText(FU.note('B'));
    await item.getByTestId('jcso-fu-done').click();
    await expect(so.getByTestId('jcso-fu-empty'), 'JCH-16: Mark done removes it from the list').toBeVisible({ timeout: 30_000 });

    // [ORACLE] the close is a schedule_done event pointing at B's follow-up — written by the app, read back here.
    const done = await pollUntil(async () => (await queryWhere('healthtracker_activity', [['scheduleId', '==', FU.ids.B]])).filter((d: any) => d.type === 'schedule_done'),
      (rows) => rows.length === 1, { timeoutMs: 30_000 });
    expect(done.length, 'JCH-16: exactly one schedule_done for B').toBe(1);

    await page.keyboard.press('Escape');
    await expect(row(page, P.B.name).getByTestId('jchd-row-due'), 'JCH-16: B\'s row chip goes with it').toHaveCount(0, { timeout: 15_000 });
    await deleteDocsByField('healthtracker_activity', 'scheduleId', FU.ids.B);   // leave the world as seeded
  });

  test('JCH-17 the Defaulted mini card filters Participants to the defaulted participant and says how many show', async ({ page }) => {
    await openDashboard(page);
    await openParticipants(page);
    const card = page.getByTestId('jchd-mc-defaulted');
    await expect(card.locator('.mc-num'), 'JCH-17: same population as the Defaulted tile (JCH-01)').toHaveText('1', { timeout: 45_000 });
    await card.click();
    await expect(page.getByTestId('jchd-tr-070'), 'JCH-17: only A remains').toHaveCount(1, { timeout: 30_000 });
    await expect(page.getByTestId('jchd-tr-070').first()).toContainText(P.A.name);
    await expect(page.getByTestId('jchd-diag-showing'), 'JCH-17: the diag line reports the filtered count').toContainText('showing 1');
    await card.click();
    await expect(page.getByTestId('jchd-diag-showing'), 'JCH-17: clicking the active card clears the filter').toHaveCount(0);
  });

  test.fixme('JCH-ADDR2 trend / "new since yesterday" chips, finance hero, Overall drill tiles, range inputs, sales / onboarding / plan / health rows addressable (deferred behavioral)', async ({ page }) => {
    await page.goto('/journey-coach-health', { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('jchd-new-na')).toBeTruthy();
    expect(page.getByTestId('jchd-new-gq')).toBeTruthy();
    expect(page.getByTestId('jchd-mc-new-na')).toBeTruthy();
    expect(page.getByTestId('jchd-mc-new-gq')).toBeTruthy();
    expect(page.getByTestId('jchd-row-new')).toBeTruthy();
    expect(page.getByTestId('jchd-trend')).toBeTruthy();
    expect(page.getByTestId('jchd-trend-delta')).toBeTruthy();
    expect(page.getByTestId('jchd-trend-spark')).toBeTruthy();
    expect(page.getByTestId('jchd-hero-finance')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-date-month-mode')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-date-range-mode')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-date-month')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-date-start')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-date-end')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-sales-row')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-sales-total')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ob-tobe')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ob-le7')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ob-gt7')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ob-onboarded')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ob-avg')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-jc-done')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-obs-done')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-plan-error')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-plan-row')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-plan-cell')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-health-total')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ah-needsattention-combined')).toBeTruthy();
    // Overall drill buttons (sales per journey + totals, health states, A&H source pills / cells / minis) — 2026-11-18 hooks
    expect(page.getByTestId('jchd-ov-ahcell-critical-ask')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-critical-both')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-critical-love')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-critical-res')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-liked-ask')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-liked-both')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-liked-love')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-liked-res')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-opportunity-ask')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-opportunity-both')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-opportunity-love')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-opportunity-res')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-tagged-ask')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-tagged-love')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahcell-tagged-res')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahmini-critattn')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahmini-positive')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahmini-unflagged')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahsrc-ask')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-ahsrc-love')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-health-atrisk')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-health-critical')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-health-happy')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-health-neutral')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-health-unassessed')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-health-unhappy')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-sales-add')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-sales-all')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-sales-new')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-sales-tot-add')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-sales-tot-new')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-sales-tot-up')).toBeTruthy();
    expect(page.getByTestId('jchd-ov-sales-up')).toBeTruthy();
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
    expect(page.getByTestId('jcso-ll-showall')).toBeTruthy();
    expect(page.getByTestId('jcso-ah-toggle')).toBeTruthy();
    expect(page.getByTestId('jcso-ah-showall')).toBeTruthy();
  });
});
