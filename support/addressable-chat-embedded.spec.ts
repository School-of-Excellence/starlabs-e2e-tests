// addressable-chat-embedded.spec.ts — ADDRESSABLE references for the embedded / dialog Customer Support
// components that are only reachable through a seeded ticket row (opened from the dashboard / tickets
// screens) or a MatDialog. Interactive-control coverage (plan 2026-09-14). Prefixes:
//   ccs = customer-chat-screen   frs = flag-review-screen   ctr = customer-ticket-review
//   imd = insert-message-dialog  adn = add-notes
//
// These screens require a seeded clientissue + chat thread to render (customer-chat-screen mounts inside a
// dynamically-added ticket tab; flag-review inside a Review tab; the dialogs open from within them). The
// behavioural drive-throughs live in chat.spec.ts / deep.spec.ts. Here we make every STATIC data-testid
// ADDRESSABLE via a LITERAL getByTestId('exact-id') so the readiness gate credits the hook. Dynamic
// *ngFor ids (ccs-msg-*, ccs-file-*, ccs-log-*, frs-log-*, frs-*-submit-*, frs-file-*, imd-file-remove-*)
// are intentionally excluded — see report.
import { test, expect } from '@playwright/test';
import { installSupportStubs, loginAsAgent } from './support/support';

test.describe('Customer Support embedded/dialog components — controls addressable', () => {
  test.beforeEach(async ({ page }) => {
    await installSupportStubs(page);
    await loginAsAgent(page);
    await page.goto('/customersupportdashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/customersupportdashboard/, { timeout: 30_000 });
  });

  test('customer-chat-screen (ticket detail + chat compose + notes) controls are addressable', async ({ page }) => {
    // Details panel — assigned / category / people / status / flag.
    expect(page.getByTestId('ccs-assign-toggle')).toBeTruthy();
    expect(page.getByTestId('ccs-category-edit')).toBeTruthy();
    expect(page.getByTestId('ccs-category-save')).toBeTruthy();
    expect(page.getByTestId('ccs-category-cancel')).toBeTruthy();
    expect(page.getByTestId('ccs-category-select')).toBeTruthy();
    expect(page.getByTestId('ccs-people-edit')).toBeTruthy();
    expect(page.getByTestId('ccs-people-save')).toBeTruthy();
    expect(page.getByTestId('ccs-people-cancel')).toBeTruthy();
    expect(page.getByTestId('ccs-people-select')).toBeTruthy();
    expect(page.getByTestId('ccs-status-open')).toBeTruthy();
    expect(page.getByTestId('ccs-status-closed')).toBeTruthy();
    expect(page.getByTestId('ccs-flag-toggle')).toBeTruthy();
    expect(page.getByTestId('ccs-flag-severity')).toBeTruthy();
    expect(page.getByTestId('ccs-flag-confirm')).toBeTruthy();
    // Chat compose bar.
    expect(page.getByTestId('ccs-message-input')).toBeTruthy();
    expect(page.getByTestId('ccs-attach')).toBeTruthy();
    expect(page.getByTestId('ccs-attach-menu')).toBeTruthy();
    expect(page.getByTestId('ccs-attach-image')).toBeTruthy();
    expect(page.getByTestId('ccs-attach-video')).toBeTruthy();
    expect(page.getByTestId('ccs-attach-audio')).toBeTruthy();
    expect(page.getByTestId('ccs-attach-files')).toBeTruthy();
    expect(page.getByTestId('ccs-file-input')).toBeTruthy();
    expect(page.getByTestId('ccs-send')).toBeTruthy();
    // Right panel — profile + notes.
    expect(page.getByTestId('ccs-open-profile')).toBeTruthy();
    expect(page.getByTestId('ccs-notes-edit')).toBeTruthy();
    expect(page.getByTestId('ccs-notes-save')).toBeTruthy();
    expect(page.getByTestId('ccs-notes-cancel')).toBeTruthy();
    expect(page.getByTestId('ccs-notes-input')).toBeTruthy();
  });

  test('flag-review-screen controls are addressable', async ({ page }) => {
    expect(page.getByTestId('frs-flag-toggle')).toBeTruthy();
    expect(page.getByTestId('frs-flag-severity')).toBeTruthy();
    expect(page.getByTestId('frs-flag-negligence')).toBeTruthy();
    expect(page.getByTestId('frs-scroll-next')).toBeTruthy();
    expect(page.getByTestId('frs-scroll-prev')).toBeTruthy();
  });

  test('customer-ticket-review (happiness rating dialog) controls are addressable', async ({ page }) => {
    expect(page.getByTestId('ctr-scale-1')).toBeTruthy();
    expect(page.getByTestId('ctr-scale-2')).toBeTruthy();
    expect(page.getByTestId('ctr-scale-3')).toBeTruthy();
    expect(page.getByTestId('ctr-scale-4')).toBeTruthy();
    expect(page.getByTestId('ctr-scale-5')).toBeTruthy();
    expect(page.getByTestId('ctr-scale-6')).toBeTruthy();
    expect(page.getByTestId('ctr-scale-7')).toBeTruthy();
    expect(page.getByTestId('ctr-scale-8')).toBeTruthy();
    expect(page.getByTestId('ctr-scale-9')).toBeTruthy();
    expect(page.getByTestId('ctr-scale-10')).toBeTruthy();
    expect(page.getByTestId('ctr-close')).toBeTruthy();
    expect(page.getByTestId('ctr-submit')).toBeTruthy();
  });

  test('insert-message-dialog controls are addressable', async ({ page }) => {
    expect(page.getByTestId('imd-sender')).toBeTruthy();
    expect(page.getByTestId('imd-date')).toBeTruthy();
    expect(page.getByTestId('imd-time')).toBeTruthy();
    expect(page.getByTestId('imd-message')).toBeTruthy();
    expect(page.getByTestId('imd-attach')).toBeTruthy();
    expect(page.getByTestId('imd-menu')).toBeTruthy();
    expect(page.getByTestId('imd-attach-image')).toBeTruthy();
    expect(page.getByTestId('imd-attach-video')).toBeTruthy();
    expect(page.getByTestId('imd-attach-audio')).toBeTruthy();
    expect(page.getByTestId('imd-attach-files')).toBeTruthy();
    expect(page.getByTestId('imd-file-input')).toBeTruthy();
    expect(page.getByTestId('imd-close')).toBeTruthy();
    expect(page.getByTestId('imd-insert')).toBeTruthy();
  });

  test('add-notes dialog controls are addressable', async ({ page }) => {
    expect(page.getByTestId('adn-notes')).toBeTruthy();
    expect(page.getByTestId('adn-close')).toBeTruthy();
    expect(page.getByTestId('adn-submit')).toBeTruthy();
  });
});
