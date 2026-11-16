// eiflix-upcoming-confirmed.spec.ts — /eiflixhomeconfig, Upcoming Workshops tab: the Confirmed column counts the
// people who responded, the same people the View dialog lists (2026-11-13).
//
// Recon: starlabs-angular specs/journals/2026-11-13-eiflix-confirmed-vs-responses.md.
//
// Before: the column showed the number stored on the widget (`confirmed`), which EiFlix bumps when someone taps
// Notify Me, but which nothing keeps in step when responses are deleted or the number is edited by hand. It
// could disagree with View. Now the column counts the `upcomingworkshopsresponse` docs that reference the widget,
// exactly as View does. The stored number is NOT changed (EiFlix still shows it to participants).
//
// Hooks: `upc-*` (upcomingworkshops.component.html) and `upc1-*` (upcomingworkshopresponses.component.html).
// `upc-confirmed-count` landed with this change, and `upc1-workshop-title` / `upc1-export` with the dialog's
// layout + export (2026-11-16), so the hub-ahead guard (scripts/readiness/landed-specs.cjs) skips this file on
// app branches that predate them.
import { test, expect, Page } from '@playwright/test';
import {
  installWshopStubs, loginAsWshopAdmin, wsProfileIds, readCsvRows,
  wsUpcomingConfirmed, seedUpcomingConfirmed, clearUpcomingConfirmed, addUpcomingResponse,
} from './support/wshop';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc } from '../queue/support/firestore-admin';
import { readFileSync } from 'fs';

const row = (page: Page, title: string) => page.locator('table.upcoming-table tr.mat-mdc-row, table.upcoming-table tr[mat-row]').filter({ hasText: title });

async function openUpcomingTab(page: Page): Promise<void> {
  await page.goto('/eiflixhomeconfig', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Upcoming Workshops' }).click();
  await expect(page.locator('table.upcoming-table').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('Workshops — eiflix home config: Confirmed counts the responses', () => {
  let guard: ConsoleGuard;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    await installWshopStubs(page);
    await seedUpcomingConfirmed();
  });
  test.afterEach(async () => {
    await clearUpcomingConfirmed();
    assertNoFatal(guard, 'eiflix upcoming confirmed: no fatal console errors / pageerrors');
  });

  test('UCC-01 Confirmed equals the View count, not the stored number; a non-reference response counts nowhere', async ({ page }) => {
    const W = wsUpcomingConfirmed;
    await loginAsWshopAdmin(page);
    await openUpcomingTab(page);

    const counted = row(page, W.counted.title);
    await expect(counted, 'UCC-01: the seeded widget renders').toHaveCount(1, { timeout: 30_000 });
    await expect(counted.getByTestId('upc-confirmed-count'), 'UCC-01: two responses, not the stored 99').toHaveText('2', { timeout: 30_000 });
    await expect(row(page, W.empty.title).getByTestId('upc-confirmed-count'),
      'UCC-01: a response that holds a plain string instead of a reference is not counted, and the stored 5 is not shown').toHaveText('0');

    // View lists the same people.
    await counted.getByTestId('upc-open-responses-2').click();
    await expect(page.locator('.count').filter({ hasText: /responses?/ }), 'UCC-01: View lists the same two').toHaveText(/^\s*2 responses\s*$/, { timeout: 30_000 });
    await page.getByTestId('upc1-close-1').click();

    // The stored number is left exactly as it was.
    expect((await getDoc('eiflixhomewidgets', W.counted.id) as any)?.confirmed, 'UCC-01: stored number untouched').toBe(W.counted.stored);
  });

  test('UCC-02 a new response shows up after the View list closes; the stored number is not touched', async ({ page }) => {
    const W = wsUpcomingConfirmed;
    await loginAsWshopAdmin(page);
    await openUpcomingTab(page);
    const counted = row(page, W.counted.title);
    await expect(counted.getByTestId('upc-confirmed-count'), 'UCC-02 precondition: two responses').toHaveText('2', { timeout: 30_000 });

    await addUpcomingResponse(wsProfileIds.p2);
    await counted.getByTestId('upc-open-responses-2').click();
    await expect(page.locator('.count').filter({ hasText: /responses?/ }), 'UCC-02: View sees the third').toHaveText(/^\s*3 responses\s*$/, { timeout: 30_000 });
    await page.getByTestId('upc1-close-1').click();
    await expect(counted.getByTestId('upc-confirmed-count'), 'UCC-02: the column counts again when View closes').toHaveText('3', { timeout: 30_000 });
    expect((await getDoc('eiflixhomewidgets', W.counted.id) as any)?.confirmed, 'UCC-02: stored number untouched').toBe(W.counted.stored);
  });

  test('UCC-03 Responses: the workshop title is centred and bold, edges line up, and Export downloads what is listed', async ({ page }) => {
    const W = wsUpcomingConfirmed;
    const p0: any = await getDoc('participant metadata', wsProfileIds.p0);
    const p1: any = await getDoc('participant metadata', wsProfileIds.p1);
    await loginAsWshopAdmin(page);
    await openUpcomingTab(page);
    await row(page, W.counted.title).getByTestId('upc-open-responses-2').click();
    await expect(page.locator('.count').filter({ hasText: /responses?/ }), 'UCC-03: the list loaded').toHaveText(/^\s*2 responses\s*$/, { timeout: 30_000 });

    const title = page.getByTestId('upc1-workshop-title');
    await expect(title, 'UCC-03: the workshop title is shown').toHaveText(W.counted.title);
    expect(await title.evaluate(el => getComputedStyle(el).textAlign), 'UCC-03: centred').toBe('center');
    expect(Number(await title.evaluate(el => getComputedStyle(el).fontWeight)), 'UCC-03: bold').toBeGreaterThanOrEqual(600);
    // "Responses" and the table start at the same inset.
    const headX = (await page.locator('.resp-title').boundingBox())!.x;
    const tableX = (await page.locator('.table-wrap').boundingBox())!.x;
    expect(Math.abs(headX - tableX), `UCC-03: heading and table line up (${headX} vs ${tableX})`).toBeLessThan(2);

    const exportCsv = async (name: string) => {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30_000 }),
        page.getByTestId('upc1-export').click(),
      ]);
      expect(download.suggestedFilename(), 'UCC-03: a CSV named after the workshop').toMatch(/^responses-hc-confirmed-counted-.*\.csv$/);
      const file = test.info().outputPath(name);
      await download.saveAs(file);
      return readCsvRows(readFileSync(file, 'utf8').replace(/^﻿/, ''));
    };

    const [header, ...data] = await exportCsv('all.csv');
    expect(header, 'UCC-03: the export columns').toEqual(
      ['Name', 'Country Code', 'Phone', 'Email', 'Customer Status', 'Subscription Start', 'Subscription End', 'Created']);
    const emails = data.map(r => r[header.indexOf('Email')]).sort();
    expect(emails, 'UCC-03: every listed responder, nobody else').toEqual([p0.email, p1.email].sort());

    // The search narrows the export too.
    await page.getByPlaceholder('Search responses').fill(p1.email);
    await expect(page.locator('table.resp-table tr.mat-mdc-row'), 'UCC-03: the search leaves one row').toHaveCount(1);
    const [, ...narrowed] = await exportCsv('search.csv');
    expect(narrowed.map(r => r[header.indexOf('Email')]), 'UCC-03: the export follows the search').toEqual([p1.email]);

    // Nothing listed → nothing to export.
    await page.getByPlaceholder('Search responses').fill('zz no such responder zz');
    await expect(page.getByTestId('upc1-export'), 'UCC-03: Export is off when nothing is listed').toBeDisabled();
  });
});
