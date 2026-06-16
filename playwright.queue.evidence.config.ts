// Evidence variant of the CLOUD config (playwright.queue.config.ts → slabs-queue-e2e-exdcz).
// Forces capture on EVERY test (not just failures) so the HTML report has one screenshot per test —
// that report IS the screenshot-evidence artifact required by
// specs/journals/2026-06-08-complete-all-tests-cloud-evidence.md.
import { defineConfig } from '@playwright/test';
import base from './playwright.queue.config';

export default defineConfig({
  ...base,
  use: {
    ...base.use,
    screenshot: 'on',                 // B & C: a screenshot per test (pass AND fail) — cheap (~tens of ms)
    // Trace is the expensive bit (per-action recording + large artifacts), so it is the A/B/C lever:
    //   default (B, "cheap receipts"): on-first-retry → no recording tax on green tests, just screenshots
    //   TRACE=full (C, "full proof"):  on → record + keep a full trace for EVERY test (slower + large)
    trace: process.env.TRACE === 'full' ? 'on' : 'on-first-retry',
    video: 'retain-on-failure',
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'results.xml' }],
  ],
});
