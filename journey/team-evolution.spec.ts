// team-evolution.spec.ts — /team-evolution-dashboard (the FTO dashboard): the DFU product picker, the
// status tiles (Ongoing / Not started / Completed / Needs attention / Awaiting sign-off), the per-member
// product rows with their delivery stepper, and the A&H Participants tab (REAL-UI, anti-circular).
//
// Hook prefix (one component): jted — TeamEvolutionDashboardComponent (team-evolution-dashboard.component.html)
//
// Reference: starlabs-angular specs/journals/2026-09-24-fto-dashboard-pull-mahalakshmi.md — the pull of
// Mahalakshmi's three FTO commits (41ac096e, dac660a1, 521ce153) onto charan-release. That pull replaced
// the mock overview with a product-driven one and left the Participants tab reading an undefined
// `ahParticipantCards` (the tab threw on open); the getter was added in the same change. Before this
// file the screen had only an addressable block (onboarding-controls/dashboards.spec.ts) whose
// `expect(locator).toBeTruthy()` can never fail.
//
// SEEDED WORLD (seed-journey.js step 7, own run tag `<run>_fto`, see seedFto()). The admin logs in; the
// screen scopes itself to users_roles.ahmember == true, then to the chosen DFU product:
//   ONG      AH · active on FTO · PP ongoing + a COMPLETED PP · 3 delivery steps (completed / ready / none)
//   NS       AH · active on FTO (DocumentReference) · 'EI Diagnostics' step READY
//   DIAGDONE AH · active on FTO · 'EI Diagnostics' COMPLETED, a session READY
//   DONE     AH · active + CONSUMED on FTO · no ongoing PP
//   NOSTEPS  AH · active on FTO · PP ongoing, no delivery-sequence doc
//   OTHER    AH · active on a NON-DFU product only
//   NOTAH    no users_roles doc      · active on FTO (+ a diagnostics-ready sequence)
//   ROLEOFF  users_roles ahmember:false · active on FTO
//
// ANTI-CIRCULARITY. The seed writes raw source docs only (role flags, active/consumed product lists,
// participantsproduct status, delivery steps with their status). Everything asserted is DERIVED by the
// app: which DFU products the picker offers, who is in the product's list, the five tile counts, which
// row carries which tag, how many products a member shows, the step names it resolves through two refs
// (deliverables → appointmenttype / delivery forms). Expected sets are re-derived below from the same
// source docs via the Admin SDK — two readers of one dataset; the test writes neither. Each rule has
// something it must EXCLUDE:
//   AH scope        — NOTAH (no role doc), ROLEOFF (flag false: the flag decides, not the doc)
//   Product scope   — OTHER (active on a non-DFU product only)
//   DFU picker      — the NDFU product, and the suite's untyped P1
//   Not started     — DIAGDONE (diagnostics done; the READY step is not a diagnostic), NOTAH (not AH)
//   Completed       — every AH member active but not consumed
//   Product count   — ONG's second participantsproduct is 'completed' (query keeps ongoing|initiated)
//
// NOT COVERED — deliberately (test.fixme below, with the reason):
//   Needs attention: the rule reads `appointmentend`/`endtime` off the deliverable's deliveryref, and in
//   real data deliveryref points at the `appointmenttype` activity doc, which carries neither — so the
//   tile cannot move. Seeding an end time onto appointmenttype would make it pass against fiction.
//   Awaiting sign-off: nothing in the component sets `awaitingsignoff`, so the tile is always 0.
import { test, expect, Page, Locator } from '@playwright/test';
import { installJourneyStubs, attachJourneyGuard, loginAsJourneyAdmin, ftoWorld as W, journeyNames } from './support/journey';
import { assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { queryWhere } from '../queue/support/firestore-admin';

const P = W.people;
// The component's own diagnostics list — the Not-started rule is defined against these names.
const DIAGNOSTICS = ['EI Diagnostics', 'WiSH Diagnostics', 'EI Starter Pack Diagnostics',
  'Custom Solutions Diagnostics', 'Critical Support Diagnostics', 'A&H Light Diagnostics'];

let guard: ConsoleGuard;
test.beforeEach(async ({ page }) => {
  guard = attachJourneyGuard(page);
  await installJourneyStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'team evolution: no fatal console errors / pageerrors'));

// ---- independent oracle over the seeded source docs ------------------------------------------------
const refId = (x: any): string | null =>
  (typeof x === 'string' ? x.split('/').pop()! : x?.id ?? x?._path?.segments?.slice(-1)[0] ?? null);
const byRun = (coll: string) => queryWhere(coll, [['testrunid', '==', W.RUN]]) as Promise<any[]>;

type Oracle = { members: string[]; completed: string[]; notStarted: string[]; ppCount: Record<string, number> };
async function oracle(): Promise<Oracle> {
  const ah = new Set((await byRun('users_roles')).filter((r) => r.ahmember === true).map((r) => refId(r.profile_ref)));
  const metas = (await byRun('participant metadata'))
    .filter((m) => ah.has(m.profileid) && (m.activeproduct || []).some((v: any) => refId(v) === W.P_DFU));
  const pps = (await byRun('participantsproduct'))
    .filter((p) => refId(p.productref) === W.P_DFU && ['ongoing', 'initiated'].includes(p.status));
  const activity = new Map((await byRun('appointmenttype')).map((a) => [a.id, a.appointmenttype]));
  const deliverable = new Map((await byRun('deliverables')).map((d) => [d.id, d]));
  const seqs = await byRun('participantdeliverysequence');

  const notStarted = metas.filter((m) => pps.filter((p) => p.profileid === m.profileid).some((p) => {
    const steps = seqs.filter((s) => s.profileid === m.profileid)
      .flatMap((s) => s.products).find((x: any) => x.participantproductid === p.id)?.delivery || [];
    return steps.some((st: any) => {
      const d = deliverable.get(refId(st.sequenceref)!);
      return d?.type === 'appointment' && DIAGNOSTICS.includes(activity.get(refId(d.deliveryref)!)) && st.status === 'ready';
    });
  }));
  const ppCount: Record<string, number> = {};
  for (const m of metas) ppCount[m.name] = pps.filter((p) => p.profileid === m.profileid).length;
  return {
    members: metas.map((m) => m.name).sort(),
    completed: metas.filter((m) => (m.consumedproducts || []).some((v: any) => refId(v) === W.P_DFU)).map((m) => m.name),
    notStarted: notStarted.map((m) => m.name),
    ppCount,
  };
}

// ---- page helpers --------------------------------------------------------------------------------
async function openDashboard(page: Page) {
  await loginAsJourneyAdmin(page);
  await page.goto('/team-evolution-dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('app-team-evolution-dashboard'),
    'the dashboard must mount — check the /team-evolution-dashboard grant if this fails').toBeAttached({ timeout: 30_000 });
}
async function pickFto(page: Page) {
  const picker = page.getByTestId('jted-sel-dfuproduct');
  await expect(picker.locator('option', { hasText: W.names.product }), 'the FTO product must be offered').toBeAttached({ timeout: 30_000 });
  await picker.selectOption({ label: W.names.product });
  await expect(page.getByTestId('jted-stat-ongoing'), 'the tiles render once the product has loaded').toBeVisible({ timeout: 45_000 });
}
const tileNum = (page: Page, id: 'jted-stat-ongoing' | 'jted-stat-notstarted' | 'jted-stat-completed' | 'jted-stat-signoff') =>
  page.getByTestId(id).locator('.num');
const memberRow = (page: Page, name: string) => page.getByTestId('jted-ov-row').filter({ hasText: name });
/** The product rows are siblings that FOLLOW a member row (one <tr> per product). */
const productRowAfter = (row: Locator) => row.locator('xpath=following-sibling::tr[1]');
const detailRowAfter = (row: Locator) => row.locator('xpath=following-sibling::tr[2]');

async function renderedNames(page: Page): Promise<string[]> {
  const names = await page.getByTestId('jted-ov-row').locator('.name-strong').evaluateAll(
    (els) => els.map((e) => (e.childNodes[0]?.textContent || '').trim()));
  return names.filter((n) => n.startsWith('FTO ')).sort();
}

test.describe('Journey — Team Evolution / FTO dashboard (DFU picker, status tiles, delivery steps, A&H cards)', () => {
  test('JTED-01 the product picker offers DFU products only', async ({ page }) => {
    const dfu = (await byRun('products')).filter((p) => p.type === 'DFU').map((p) => p.product);
    expect(dfu, 'JTED-01: the seed must carry exactly one DFU product for this run').toEqual([W.names.product]);

    await openDashboard(page);
    const options = page.getByTestId('jted-sel-dfuproduct').locator('option');
    await expect(options.filter({ hasText: W.names.product }), 'JTED-01: the DFU product is offered').toHaveCount(1, { timeout: 30_000 });
    await expect(options.filter({ hasText: W.names.nonDfu }), 'JTED-01: an NDFU product is never offered').toHaveCount(0);
    await expect(options.filter({ hasText: journeyNames.product1 }), 'JTED-01: an untyped product is never offered').toHaveCount(0);
    await expect(page.getByTestId('jted-stat-ongoing'), 'JTED-01: no tiles before a product is chosen').toHaveCount(0);
  });

  test('JTED-02 choosing a product lists only A&H members active on it, and Ongoing counts them', async ({ page }) => {
    const o = await oracle();
    expect(o.members.length, 'JTED-02: oracle sanity — five A&H members are active on the product').toBe(5);

    await openDashboard(page);
    await pickFto(page);
    await expect(tileNum(page, 'jted-stat-ongoing'), 'JTED-02: Ongoing = A&H members active on the product').toHaveText(String(o.members.length));
    await expect(page.getByTestId('jted-ov-sub'), 'JTED-02: the panel sub-title agrees').toContainText(`Ongoing · ${o.members.length} participants`);
    expect(await renderedNames(page), 'JTED-02: exactly the oracle\'s members, nobody else').toEqual(o.members);
    for (const [who, why] of [[P.NOTAH, 'has no users_roles doc'], [P.ROLEOFF, 'has ahmember:false'], [P.OTHER, 'is only on a non-DFU product']] as const) {
      await expect(memberRow(page, who.name), `JTED-02: ${who.name} ${why}`).toHaveCount(0);
    }
  });

  test('JTED-03 Completed counts consumed products, and its tile filters the table', async ({ page }) => {
    const o = await oracle();
    await openDashboard(page);
    await pickFto(page);
    await expect(tileNum(page, 'jted-stat-completed'), 'JTED-03: Completed = consumed on the product').toHaveText(String(o.completed.length));

    await page.getByTestId('jted-stat-completed').click();
    await expect(page.getByTestId('jted-stat-completed'), 'JTED-03: the clicked tile is selected').toHaveClass(/\bsel\b/);
    await expect(page.getByTestId('jted-ov-sub')).toContainText(`Completed · ${o.completed.length} participants`);
    expect(await renderedNames(page), 'JTED-03: only the consumed member').toEqual(o.completed);
    await expect(memberRow(page, P.DONE.name).getByTestId('jted-ov-tag-completed'), 'JTED-03: DONE carries the Completed tag').toBeVisible();
  });

  test('JTED-04 Not started = a READY diagnostics step; a completed diagnostic does not count', async ({ page }) => {
    const o = await oracle();
    expect(o.notStarted, 'JTED-04: oracle sanity').toEqual([P.NS.name]);

    await openDashboard(page);
    await pickFto(page);
    await expect(tileNum(page, 'jted-stat-notstarted'), 'JTED-04: Not started count').toHaveText(String(o.notStarted.length));
    await expect(memberRow(page, P.DIAGDONE.name).getByTestId('jted-ov-tag-notstarted'),
      'JTED-04: DIAGDONE finished its diagnostic — its READY step is a session').toHaveCount(0);

    await page.getByTestId('jted-stat-notstarted').click();
    expect(await renderedNames(page), 'JTED-04: the tile filters to the not-started member').toEqual(o.notStarted);
    await expect(memberRow(page, P.NS.name).getByTestId('jted-ov-tag-notstarted')).toBeVisible();
  });

  test('JTED-05 a member\'s product row expands to its delivery steps, resolved through two refs', async ({ page }) => {
    const o = await oracle();
    await openDashboard(page);
    await pickFto(page);

    const ong = memberRow(page, P.ONG.name);
    await expect(ong, 'JTED-05: ONG keeps ONE product — its completed participantsproduct is not ongoing')
      .toContainText(`${o.ppCount[P.ONG.name]} product`);
    expect(o.ppCount[P.ONG.name]).toBe(1);
    const totalProducts = Object.values(o.ppCount).reduce((a, b) => a + b, 0);
    await expect(page.getByTestId('jted-ov-product'), 'JTED-05: one product row per ongoing|initiated participantsproduct')
      .toHaveCount(totalProducts);

    const product = productRowAfter(ong);
    await expect(product).toHaveAttribute('data-testid', 'jted-ov-product');
    await expect(product).toContainText(W.names.product);
    await expect(detailRowAfter(ong).getByTestId('jted-ov-steps'), 'JTED-05: collapsed until clicked').toHaveCount(0);
    await product.click();

    const steps = detailRowAfter(ong).getByTestId('jted-ov-step');
    await expect(steps, 'JTED-05: three steps').toHaveCount(3);
    await expect(steps.nth(0)).toContainText(W.names.session);     // deliverable → appointmenttype.appointmenttype
    await expect(steps.nth(1)).toContainText(W.names.form);        // deliverable → delivery forms.formname
    await expect(steps.nth(2)).toContainText(W.names.session);
    await expect(steps.nth(0).locator('.stepper-circle')).toHaveClass(/step-completed/);
    await expect(steps.nth(1).locator('.stepper-circle')).toHaveClass(/step-ready/);
    await expect(steps.nth(2).locator('.stepper-circle')).toHaveClass(/step-pending/);

    await product.click();
    await expect(detailRowAfter(ong).getByTestId('jted-ov-steps'), 'JTED-05: a second click collapses it').toHaveCount(0);

    // A product with no delivery-sequence doc says so rather than rendering an empty stepper.
    const noSteps = memberRow(page, P.NOSTEPS.name);
    await productRowAfter(noSteps).click();
    await expect(detailRowAfter(noSteps).getByTestId('jted-ov-nosteps')).toContainText('No delivery steps yet.');
  });

  test('JTED-06 a tile with nobody in it shows the empty state', async ({ page }) => {
    await openDashboard(page);
    await pickFto(page);
    await page.getByTestId('jted-stat-signoff').click();
    await expect(page.getByTestId('jted-ov-empty'), 'JTED-06: no rows → the empty row').toContainText('No participants match.');
    await expect(page.getByTestId('jted-ov-row')).toHaveCount(0);
    await page.getByTestId('jted-stat-ongoing').click();
    await expect(page.getByTestId('jted-ov-empty'), 'JTED-06: back on Ongoing the list returns').toHaveCount(0);
  });

  // Needs attention can't move on real-shaped data — see the file header. Un-fixme once the rule reads
  // the completed step's end time from the booked appointment rather than the activity doc.
  test.fixme('JTED-07 Needs attention flags a member whose next step has waited 7+ days (deferred: rule reads a field real data lacks)', async ({ page }) => {
    await openDashboard(page);
    await pickFto(page);
    await page.getByTestId('jted-stat-attention').click();
    await expect(memberRow(page, P.ONG.name).getByTestId('jted-ov-tag-attention')).toBeVisible();
  });

  test('JTED-08 Participants tab: one card per A&H member, with product chips, search and profile link', async ({ page, context }) => {
    const ah = new Set((await byRun('users_roles')).filter((r) => r.ahmember === true).map((r) => refId(r.profile_ref)));
    const expected = (await byRun('participant metadata')).filter((m) => ah.has(m.profileid)).map((m) => m.name).sort();
    expect(expected.length, 'JTED-08: oracle sanity — six A&H members carry metadata').toBe(6);

    await openDashboard(page);
    await page.getByTestId('jted-a-002').click();   // before 2026-09-24 this threw on the undefined card list
    await expect(page.getByTestId('jted-ppl-card').first(), 'JTED-08: the tab renders cards').toBeVisible({ timeout: 30_000 });
    const names = (await page.getByTestId('jted-a-020').allTextContents()).map((t) => t.trim()).filter((t) => t.startsWith('FTO ')).sort();
    expect(names, 'JTED-08: exactly the A&H members — not NOTAH, not ROLEOFF').toEqual(expected);

    const ongCard = page.getByTestId('jted-ppl-card').filter({ hasText: P.ONG.name });
    await expect(ongCard.getByTestId('jted-ppl-product'), 'JTED-08: the active DFU product resolves to its name').toHaveText([W.names.product]);

    const search = page.getByTestId('jted-inp-019');
    await search.fill(P.ONG.name);
    await expect(page.getByTestId('jted-ppl-card'), 'JTED-08: search narrows to one card').toHaveCount(1);
    await search.fill(`nobody-${W.RUN}`);
    await expect(page.getByTestId('jted-ppl-empty'), 'JTED-08: no match → empty state').toBeVisible();
    await expect(page.getByTestId('jted-ppl-card')).toHaveCount(0);

    await search.fill(P.ONG.name);
    const [popup] = await Promise.all([context.waitForEvent('page'), page.getByTestId('jted-a-020').click()]);
    await expect(popup, 'JTED-08: the name opens that member\'s profile in a new tab').toHaveURL(new RegExp(`/userprofile/${P.ONG.pf}$`));
    await popup.close();
  });

  // Registered, not driven: the loading line is transient, and the attention / sign-off tags cannot
  // render (see the file header).
  test.fixme('JTED-ADDR1 transient + unreachable hooks addressable (deferred behavioral)', async ({ page }) => {
    await page.goto('/team-evolution-dashboard', { waitUntil: 'domcontentloaded' });
    expect(page.getByTestId('jted-ov-loading')).toBeTruthy();
    expect(page.getByTestId('jted-ov-tag-signoff')).toBeTruthy();
  });
});
