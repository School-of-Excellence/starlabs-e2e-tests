// workshop-dashboard-sale-dialog.spec.ts — the workshop dashboard's Sale Achieved card and the FULL-SCREEN dialog it opens
// (2026-11-23; starlabs-angular specs/plans/2026-11-23-sale-achieved-dialog.md). Moved here from
// workshop-dashboard-communication.spec.ts, whose WDC-15/16 asserted the side-panel Sale Achieved mode the plan retires.
//   WSD-01  The card is a live-workshop card: W_DASH as seeded (no workshop type) shows none; made live it shows, and with no
//           Watson in this build its amount reads "—" (never a misleading ₹0) with no buyer count; no dialog exists until
//           the card is clicked                                                                      [was WDC-15, card half]
//   WSD-02  Clicking the card opens the full-screen dialog and NOT the side panel: exactly one dialog, filling the viewport,
//           focus inside it. Header: "Sale Achieved", the workshop's title, the purchase window (computed here from the
//           seeded dates), total and buyers "—". The unavailable state ("Sale data isn't available in this build") is the
//           only state shown, and nothing row-level renders — nor the New Sales / Funnel Sales / Upgrades split (summary
//           strip, the three sections, their figures and empty notes: they exist only on a loaded list). The tools are all
//           there and switched off with nothing to work
//           on: From / To blank and bounded by the window, the sort pair (Highest amount pressed, Most recent not), search,
//           and Export to Excel disabled with nothing shown; nothing to clear     [was WDC-15 panel half + WDC-16 bounds]
//   WSD-03  The ✕ (aria-label "Close") closes it, focus returns to the card, no side panel opens on the way; opening it again
//           gives a fresh dialog in the same state, From / To blank                                  [was WDC-16, last part]
//   WSD-04  Escape closes it and focus returns to the card
//
// Recon: starlabs-angular src/app/New-Workshop/workshop-dashboard/
//   • workshop-dashboard.component.{ts,html} — the card (wdash-sale-card, *ngIf isLiveWorkshop: workshoptype ===
//     'liveworkshop') opens the dialog lazily through MatDialog, as openCommunicationDialog does. loadSaleAchieved is
//     unchanged: it sets the window from detailpage.registrationStartDate .. detailpage.workshopEndDate + one calendar
//     month, then settles on 'unavailable' at once when the build has no Watson config — the emulator build never has
//     one (tests never reach the finance project). The dialog adds NO read: it is handed a LIVE source (getters over the
//     card's state), not a copy.
//   • sale-achieved-dialog/sale-achieved-dialog.component.{ts,html} — state(): 'unavailable' whenever the source says so;
//     toolsOn (range, sort, search) only on a loaded list with someone in it; the range / search clears render only when
//     something is picked / typed; Export renders on the dashboard's export right (the seeded admin has it — the side
//     panel's Export is driven with this admin in WSU-01) and is disabled while nothing is shown; total and buyers read
//     "—" when unavailable; the ✕ carries cdkFocusInitial.
//   • The list is split into three stacked sections (2026-11-23, plan section "Addition: New Sales, Funnel Sales and
//     Upgrades"): New Sales (a person's first purchase ever), Funnel Sales (bought again after a first purchase inside
//     the window), Upgrades (first purchase before the window), under a summary strip. All of it renders only in the
//     'list' state (*ngIf state === 'list'), so with no Watson none of it exists.
//   The Watson matching, the window rule, the first-sale split and the dialog's range / search / sort / totals / export
//   rows are unit-tested in the app (watson-purchases.spec.ts, sale-achieved-dialog/sale-achieved.unit.spec.ts,
//   sale-achieved-dialog.view.unit.spec.ts) — they need buyers, which only Watson can supply, so e2e proves the shell
//   around them.
//
// Hooks — one prefix per component, as declared for each:
//   `wdash-*`  workshop-dashboard.component.html. Kept and driven here: wdash-sale-card, wdash-sale-total, wdash-sale-count.
//              The side-panel sale hooks the plan retires (from / to / range clear / sort pair / amount / hover card /
//              panel total) are referenced nowhere in the hub any more.
//   `wsad-*`   sale-achieved-dialog.component.html (new). Every hook it declares is referenced here as a literal — driven or
//              asserted on (dialog, close, title, window, total, count, from, to, sort-amount, sort-recent, search, export,
//              unavailable) or asserted ABSENT in the unavailable state (range-clear, search-clear, loading, empty, no-match,
//              no-match-clear, row, row-toggle, name, email, phone, purchases, amount, latest, purchase, and the split:
//              summary, section-new, section-funnel, section-upgrade, section-total, section-count, section-empty): with no
//              Watson there is never a buyer, a range or a query to render them.
// The wsad- hooks are newer than most app branches, so the hub-ahead guard (scripts/readiness/landed-specs.cjs) skips this
// FILE on branches without the dialog — which is why these cases left the communication file instead of being edited in
// place there (older branches keep passing that file, which now names no Sale Achieved hook at all).
//
// THE WORLD — no new seed: W_DASH from seed-workshops.js (detailpage.registrationStartDate = seed day − 7,
// detailpage.workshopEndDate = seed day + 6, detailpage.title "Dashboard Workshop <run>"). Each case starts from W_DASH
// WITHOUT a workshop type (clearDashWorkshopType = as seeded) and puts it back that way afterwards;
// setDashWorkshopType('liveworkshop') is the only write, on that one root field of an existing doc (no new
// workshopconfiguration doc, no testrunid anywhere — WS-01 untouched). Single worker (the emulator config), so no other
// file sees W_DASH live.
//
// Anti-circularity: the window line and the From / To bounds are computed HERE from the seeded W_DASH dates read back with
// the admin SDK (saleWindowOracle restates the rule: registration start's day .. the workshop end's day one calendar month
// later, clamped to that month's last day) and formatted by the TEST BROWSER's Intl the way the dashboard formats days
// (en-IN, "07 Nov 2026") — never read back from the app. The workshop title is the seeded one. "Fills the viewport" is the
// dialog's own bounding box against the browser's viewport; focus is the browser's document.activeElement.
// No fixed sleeps: every wait is an expect / poll on a condition.
import { test, expect, Page, Locator } from '@playwright/test';
import {
  wsIds, installWshopStubs, loginAsWshopAdmin, alignWorkshopMetadataNames,
  setDashWorkshopType, clearDashWorkshopType,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc } from '../queue/support/firestore-admin';

/** How far (CSS px) the dialog's box may sit from each viewport edge and still "fill" it. A centred modal misses by far
 *  more (the Communication dialog is 1180px / 96vw / 92vh — 60px+ short of a 1280 × 720 viewport's edges). */
const FULL_TOL = 16;

async function openDashboard(page: Page): Promise<void> {
  await loginAsWshopAdmin(page);
  await page.goto(`/workshop_dashboard/${wsIds.W_DASH}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`workshop_dashboard/${wsIds.W_DASH}`), { timeout: 30_000 });
}

/** W_DASH made live, the dashboard open, and the card settled in its no-Watson state ("—"). */
async function openLiveDashboard(page: Page): Promise<Locator> {
  await setDashWorkshopType('liveworkshop');
  await openDashboard(page);
  const card = page.getByTestId('wdash-sale-card');
  await expect(card, 'a live workshop shows Sale Achieved').toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('wdash-sale-total'), 'the lookup has settled (no Watson in this build -> "—")').toHaveText('—', { timeout: 30_000 });
  return card;
}

/** Clicks the card and waits for the dialog. Returns the dialog element and its MatDialog container (role=dialog). */
async function openSaleDialog(page: Page, card: Locator): Promise<{ dialog: Locator; container: Locator }> {
  await card.click();
  const dialog = page.getByTestId('wsad-dialog');
  await expect(dialog, 'the card opens the Sale Achieved dialog').toBeVisible({ timeout: 30_000 });
  const container = page.getByRole('dialog').filter({ has: dialog });
  await expect(container, 'the dialog sits in a MatDialog container').toHaveCount(1);
  return { dialog, container };
}

/** Whether the browser's focused element is inside `container` (or is it). */
const focusInside = (container: Locator) => () => container.evaluate((el) => el.contains(document.activeElement));

/** The side panel the card used to open. Its <aside> is always in the DOM; it is open only with .panel-visible. */
const openSidePanel = (page: Page) => page.locator('.participant-panel.panel-visible');

/** The Sale Achieved window, restated from the plan and the old WDC-16 — see the header's anti-circularity note. */
async function saleWindowOracle(page: Page): Promise<{ label: string; min: string; max: string }> {
  const ws: any = await getDoc('workshopconfiguration', wsIds.W_DASH);
  const regStart: Date | undefined = ws?.detailpage?.registrationStartDate?.toDate?.();
  const wsEnd: Date | undefined = ws?.detailpage?.workshopEndDate?.toDate?.();
  expect(regStart && wsEnd, 'precondition: W_DASH is seeded with a registration start and a workshop end').toBeTruthy();
  expect(wsEnd!.getTime(), 'precondition: the seeded workshop end is after the registration start').toBeGreaterThan(regStart!.getTime());
  // Computed in the browser so the days are the viewer's days, as the app computes them.
  return page.evaluate(([s, e]) => {
    const S = new Date(s);
    const E = new Date(e);
    const start = new Date(S.getFullYear(), S.getMonth(), S.getDate());
    const lastDayNextMonth = new Date(E.getFullYear(), E.getMonth() + 2, 0).getDate();
    const end = new Date(E.getFullYear(), E.getMonth() + 1, Math.min(E.getDate(), lastDayNextMonth));
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return { label: `Bought ${day(start)} – ${day(end)}`, min: ymd(start), max: ymd(end) };
  }, [regStart!.getTime(), wsEnd!.getTime()] as [number, number]);
}

/** Largest distance (px) between the element's box and the viewport's edges; Infinity while it has no box. */
async function offViewport(page: Page, el: Locator): Promise<number> {
  const vp = page.viewportSize();
  const b = await el.boundingBox();
  if (!vp || !b) return Infinity;
  return Math.max(Math.abs(b.x), Math.abs(b.y), Math.abs(b.x + b.width - vp.width), Math.abs(b.y + b.height - vp.height));
}

test.describe('Workshop dashboard — Sale Achieved full-screen dialog (live workshops, no Watson in this build)', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    guard = attachConsoleGuard(page);
    await alignWorkshopMetadataNames();
    await clearDashWorkshopType();   // W_DASH as seeded: no workshop type
    await installWshopStubs(page);
  });
  test.afterEach(async () => {
    await clearDashWorkshopType();
    assertNoFatal(guard, 'sale achieved dialog: no fatal console errors / pageerrors');
  });

  // ===========================================================================================
  // WSD-01 — the card: live workshops only; "—" and no buyer count without Watson
  // ===========================================================================================
  test('WSD-01 Sale Achieved appears only on a live workshop, and without Watson its amount reads "—" with no buyer count', async ({ page }) => {
    // [NEGATIVE CONTROL] W_DASH as seeded has no workshop type -> no card.
    await openDashboard(page);
    await expect(page.getByText('Total Enrolled').first(), 'WSD-01: the dashboard rendered').toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('wdash-sale-card'), 'WSD-01: not a live workshop -> no Sale Achieved card').toHaveCount(0);

    // The header's Opt-in line (the registration window, operator 2026-11-23) — restated from the seeded W_DASH
    // registration start / end read back with the admin SDK, formatted in the browser as the app formats days.
    const ws: any = await getDoc('workshopconfiguration', wsIds.W_DASH);
    const regStart: Date | undefined = ws?.detailpage?.registrationStartDate?.toDate?.();
    const regEnd: Date | undefined = ws?.detailpage?.registrationEndDate?.toDate?.();
    expect(regStart && regEnd, 'WSD-01 precondition: W_DASH is seeded with a registration start and end').toBeTruthy();
    const optin = await page.evaluate(([s, e]) => {
      const day = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return `Opt-in${day(s)} – ${day(e)}`;
    }, [regStart!.getTime(), regEnd!.getTime()] as [number, number]);
    await expect(page.getByTestId('wdash-optin-dates'), 'WSD-01: the header shows the registration window as Opt-in').toHaveText(optin);

    // Live workshop -> the card is there.
    await setDashWorkshopType('liveworkshop');
    await page.reload({ waitUntil: 'domcontentloaded' });   // already signed in — just reload
    const card = page.getByTestId('wdash-sale-card');
    await expect(card, 'WSD-01: a live workshop shows Sale Achieved').toBeVisible({ timeout: 45_000 });
    // The amount is the headline: without Watson it reads "—", never a misleading ₹0, and the buyer count only
    // appears once a lookup has answered.
    await expect(page.getByTestId('wdash-sale-total'), 'WSD-01: no Watson in this build -> "—"').toHaveText('—', { timeout: 30_000 });
    await expect(page.getByTestId('wdash-sale-count'), 'WSD-01: no Watson -> no buyer count').toHaveCount(0);
    // [NEGATIVE CONTROL] nothing of the dialog exists until the card is clicked.
    await expect(page.getByTestId('wsad-dialog'), 'WSD-01: no dialog before the card is clicked').toHaveCount(0);
  });

  // ===========================================================================================
  // WSD-02 — the card opens the full-screen dialog (not the side panel), in its unavailable state
  // ===========================================================================================
  test('WSD-02 the card opens a full-screen dialog, not the side panel, showing the window, the unavailable state and its tools', async ({ page }) => {
    const card = await openLiveDashboard(page);
    const win = await saleWindowOracle(page);
    const ws: any = await getDoc('workshopconfiguration', wsIds.W_DASH);
    const workshopTitle: string = ws?.detailpage?.title;
    expect(workshopTitle, 'WSD-02 precondition: W_DASH carries a seeded title').toBeTruthy();

    const { dialog, container } = await openSaleDialog(page, card);

    // A dialog, the only one, and no side panel.
    await expect(page.getByRole('dialog'), 'WSD-02: exactly one dialog is open').toHaveCount(1);
    await expect(openSidePanel(page), 'WSD-02: the card no longer opens the side panel').toHaveCount(0);
    // Full screen: the dialog's own box meets the viewport's four edges (polled: the open animation scales it in).
    await expect.poll(() => offViewport(page, dialog), {
      message: `WSD-02: the dialog fills the viewport (every edge within ${FULL_TOL}px)`, timeout: 15_000,
    }).toBeLessThanOrEqual(FULL_TOL);
    await expect.poll(focusInside(container), { message: 'WSD-02: focus moves into the dialog', timeout: 15_000 }).toBe(true);

    // Header: title, workshop, window, figures.
    await expect(page.getByTestId('wsad-title'), 'WSD-02: the title reads "Sale Achieved", not a raw key').toHaveText('Sale Achieved');
    await expect(dialog, 'WSD-02: the header names the workshop').toContainText(workshopTitle);
    await expect(page.getByTestId('wsad-window'), 'WSD-02: the window line, computed from the seeded dates').toHaveText(win.label);
    await expect(page.getByTestId('wsad-total'), 'WSD-02: no Watson -> the total reads "—", not ₹0').toHaveText('—');
    await expect(page.getByTestId('wsad-count'), 'WSD-02: no Watson -> the buyer count reads "—", not 0').toHaveText('—');

    // The unavailable state — and only it.
    const unavailable = page.getByTestId('wsad-unavailable');
    await expect(unavailable, 'WSD-02: no Watson in this build -> the unavailable state').toBeVisible({ timeout: 30_000 });
    await expect(unavailable, 'WSD-02: it says why, in words').toHaveText(/^\s*Sale data isn['’]t available in this build\s*$/);
    await expect(page.getByTestId('wsad-loading'), 'WSD-02: not loading once unavailable').toHaveCount(0);
    await expect(page.getByTestId('wsad-empty'), 'WSD-02: "unavailable" is not "nobody bought"').toHaveCount(0);
    await expect(page.getByTestId('wsad-no-match'), 'WSD-02: "unavailable" is not "no buyers match"').toHaveCount(0);
    await expect(page.getByTestId('wsad-no-match-clear')).toHaveCount(0);

    // No buyers: nothing row-level renders.
    await expect(page.getByTestId('wsad-row'), 'WSD-02: no buyer rows without Watson').toHaveCount(0);
    await expect(page.getByTestId('wsad-row-toggle'), 'WSD-02: no expand buttons').toHaveCount(0);
    await expect(page.getByTestId('wsad-name')).toHaveCount(0);
    await expect(page.getByTestId('wsad-email')).toHaveCount(0);
    await expect(page.getByTestId('wsad-phone')).toHaveCount(0);
    await expect(page.getByTestId('wsad-purchases')).toHaveCount(0);
    await expect(page.getByTestId('wsad-amount')).toHaveCount(0);
    await expect(page.getByTestId('wsad-latest')).toHaveCount(0);
    await expect(page.getByTestId('wsad-purchase'), 'WSD-02: no purchase lines').toHaveCount(0);

    // No buyers: no New Sales / Funnel Sales / Upgrades split either — it renders only on a loaded list.
    await expect(page.getByTestId('wsad-summary'), 'WSD-02: no summary strip without buyers').toHaveCount(0);
    await expect(page.getByTestId('wsad-section-new'), 'WSD-02: no New Sales section without buyers').toHaveCount(0);
    await expect(page.getByTestId('wsad-section-funnel'), 'WSD-02: no Funnel Sales section without buyers').toHaveCount(0);
    await expect(page.getByTestId('wsad-section-upgrade'), 'WSD-02: no Upgrades section without buyers').toHaveCount(0);
    await expect(page.getByTestId('wsad-section-total')).toHaveCount(0);
    await expect(page.getByTestId('wsad-section-count')).toHaveCount(0);
    await expect(page.getByTestId('wsad-section-empty'), 'WSD-02: "unavailable" is not "None in this window"').toHaveCount(0);
    // No buyers, so no "EiFlix New User" chip either (it sits after a buyer's name; unit-tested in sale-achieved.unit.spec.ts).
    await expect(page.getByTestId('wsad-eiflix-new'), 'WSD-02: no EiFlix New User chip without buyers').toHaveCount(0);

    // The tools are there, switched off: there is nothing for them to work on.
    const from = page.getByTestId('wsad-from');
    const to = page.getByTestId('wsad-to');
    const byAmount = page.getByTestId('wsad-sort-amount');
    const byRecent = page.getByTestId('wsad-sort-recent');
    const search = page.getByTestId('wsad-search');
    const exportBtn = page.getByTestId('wsad-export');
    for (const [tool, what] of [[from, 'From'], [to, 'To'], [byAmount, 'Highest amount'], [byRecent, 'Most recent'], [search, 'search'], [exportBtn, 'Export to Excel']] as [Locator, string][]) {
      await expect(tool, `WSD-02: the ${what} tool is in the dialog`).toBeVisible();
      await expect(tool, `WSD-02: the ${what} tool is disabled with nothing shown`).toBeDisabled();
    }
    await expect(byAmount, 'WSD-02: the sort reads "Highest amount"').toHaveText(/Highest amount/);
    await expect(byRecent, 'WSD-02: the sort reads "Most recent"').toHaveText(/Most recent/);
    await expect(byAmount, 'WSD-02: Highest amount is the default order').toHaveAttribute('aria-pressed', 'true');
    await expect(byRecent, 'WSD-02: Most recent is not pressed').toHaveAttribute('aria-pressed', 'false');
    await expect(exportBtn, 'WSD-02: Export names its format').toContainText('Export to Excel');
    await expect(search, 'WSD-02: the search box is empty').toHaveValue('');

    // From / To start blank (the whole window) and are bounded by it.
    await expect(from, 'WSD-02: From starts blank (the whole window)').toHaveValue('');
    await expect(to, 'WSD-02: To starts blank').toHaveValue('');
    await expect(from, 'WSD-02: From cannot go before registration start').toHaveAttribute('min', win.min);
    await expect(from, 'WSD-02: with no To, From is capped at the window end').toHaveAttribute('max', win.max);
    await expect(to, 'WSD-02: with no From, To is floored at the window start').toHaveAttribute('min', win.min);
    await expect(to, 'WSD-02: To cannot go past one month after the workshop end').toHaveAttribute('max', win.max);
    // [NEGATIVE CONTROL] nothing picked or typed -> nothing to clear.
    await expect(page.getByTestId('wsad-range-clear'), 'WSD-02: no range to clear').toHaveCount(0);
    await expect(page.getByTestId('wsad-search-clear'), 'WSD-02: no search to clear').toHaveCount(0);

    // Still no side panel behind it.
    await expect(openSidePanel(page), 'WSD-02: the dialog never opened the side panel').toHaveCount(0);
  });

  // ===========================================================================================
  // WSD-03 — ✕ closes, focus returns to the card, and a re-open is a fresh dialog
  // ===========================================================================================
  test('WSD-03 the close button shuts the dialog, focus returns to the card, and re-opening gives a fresh dialog', async ({ page }) => {
    const card = await openLiveDashboard(page);
    const { dialog } = await openSaleDialog(page, card);
    await expect(page.getByTestId('wsad-unavailable'), 'WSD-03: the dialog has settled').toBeVisible({ timeout: 30_000 });

    const close = page.getByTestId('wsad-close');
    await expect(close, 'WSD-03: the close button is named for screen readers').toHaveAttribute('aria-label', 'Close');
    await close.click();
    await expect(dialog, 'WSD-03: ✕ closes the dialog').toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole('dialog'), 'WSD-03: no dialog is left open').toHaveCount(0);
    await expect(card, 'WSD-03: focus returns to the card').toBeFocused({ timeout: 15_000 });
    await expect(openSidePanel(page), 'WSD-03: closing does not open the side panel either').toHaveCount(0);

    // Re-open: a fresh dialog, same state, on the whole window.
    await openSaleDialog(page, card);
    await expect(page.getByRole('dialog'), 'WSD-03: one dialog again, not two').toHaveCount(1);
    await expect(page.getByTestId('wsad-unavailable'), 'WSD-03: the re-opened dialog shows the same state').toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('wsad-from'), 'WSD-03: re-opening starts with no From').toHaveValue('');
    await expect(page.getByTestId('wsad-to'), 'WSD-03: … and no To').toHaveValue('');
  });

  // ===========================================================================================
  // WSD-04 — Escape closes, focus returns to the card
  // ===========================================================================================
  test('WSD-04 Escape shuts the dialog and focus returns to the card', async ({ page }) => {
    const card = await openLiveDashboard(page);
    const { dialog, container } = await openSaleDialog(page, card);
    await expect.poll(focusInside(container), { message: 'WSD-04: focus is inside the dialog before Escape', timeout: 15_000 }).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog, 'WSD-04: Escape closes the dialog').toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole('dialog'), 'WSD-04: no dialog is left open').toHaveCount(0);
    await expect(card, 'WSD-04: focus returns to the card').toBeFocused({ timeout: 15_000 });
    await expect(openSidePanel(page), 'WSD-04: no side panel opened').toHaveCount(0);
  });
});
