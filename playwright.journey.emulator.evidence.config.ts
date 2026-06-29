// Evidence variant of the EMULATOR config (playwright.journey.emulator.config.ts → hermetic emulator).
// Forces a screenshot + trace on EVERY journey test (pass AND fail), so the gate produces a browsable,
// screenshot-per-test HTML report that record-run.cjs uploads to Storage + indexes in Firestore cicd-audit.
// Mirrors playwright.queue.emulator.evidence.config.ts. Pass `config: playwright.journey.emulator.evidence.config.ts`
// + `evidence: '1'` from the journey caller to select it (run-isolated.sh honors a passed CONFIG in EVIDENCE=1).
import { defineConfig } from '@playwright/test';
import base from './playwright.journey.emulator.config';

export default defineConfig({
  ...base,
  use: {
    ...base.use,
    screenshot: 'on',                 // a screenshot per test (pass AND fail) — not only-on-failure
    // Trace is the expensive bit (per-action recording + large artifacts), so it is the cheap/full lever:
    //   default ("cheap receipts"): on-first-retry → no recording tax on green tests, just screenshots
    //   TRACE=full ("full proof"):  on → record + keep a full trace for EVERY test (slower + large)
    trace: process.env.TRACE === 'full' ? 'on' : 'on-first-retry',
    video: 'retain-on-failure',
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'results.xml' }],
  ],
});
