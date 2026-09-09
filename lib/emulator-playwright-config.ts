import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * emulator-playwright-config.ts — SHARED Playwright config factory for the hermetic emulator runs.
 *
 * Every emulator-gated suite's playwright.<sys>.emulator.config.ts is identical except for the suite name
 * (testDir ./<sys>, globalSetup/teardown under ./<sys>/support, metadata.suite, project name). So those are
 * the single `suite` parameter here; the rest (timeouts, single-worker determinism, emulator-wired webServer
 * on :4200, reporters, project=starlabs-cicd) is shared. makeEmulatorConfig({ suite: 'authroles' }) reproduces
 * the hand-written authroles/journey configs verbatim. The handoff's "config-only" lever for ranks 3–10.
 *
 *   // playwright.<sys>.emulator.config.ts
 *   import { makeEmulatorConfig } from './lib/emulator-playwright-config';
 *   export default makeEmulatorConfig({ suite: '<sys>' });
 *
 * Run locally (emulator + app already up):
 *   export JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.11.10-hotspot"; export PATH="$JAVA_HOME/bin:$PATH"
 *   EMU_REUSE=1 EMU_REUSE_APP=1 npx playwright test --config=playwright.<sys>.emulator.config.ts
 */
export function makeEmulatorConfig(opts: { suite: string }): PlaywrightTestConfig {
  const { suite } = opts;
  return defineConfig({
    testDir: `./${suite}`,
    testMatch: '**/*.spec.ts',
    globalSetup: require.resolve(`../${suite}/support/emulator-global-setup.ts`),
    globalTeardown: require.resolve(`../${suite}/support/emulator-global-teardown.ts`),
    timeout: 120_000,
    expect: { timeout: 20_000 },
    fullyParallel: false,        // shared seed state — serialize for determinism (same as queue/journey)
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['json', { outputFile: 'playwright-report/report.json' }], ['junit', { outputFile: 'results.xml' }]],
    use: {
      baseURL: process.env.BASE_URL || 'http://localhost:4200',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'off',
    },
    metadata: { target: 'emulator', suite, project: process.env.FIREBASE_PROJECT || 'starlabs-cicd' },
    projects: [
      { name: `${suite}-desktop`, use: { ...devices['Desktop Chrome'] } },
    ],
    // Boots the EMULATOR-wired Angular app; reuses an already-running dev server locally (EMU_REUSE_APP=1).
    //
    // APP_PATH: where the Angular app lives, RELATIVE TO THIS REPO. The default `..` is the CI layout,
    // where the hub is checked out INSIDE the app repo — unchanged for CI and for anyone using the `app`
    // symlink ./setup.sh creates. It is wrong only when the two repos are SIBLINGS, which is how they sit
    // in a plain local clone: `..` then resolves to the parent folder and npm dies with
    //   "enoent Could not read package.json: ... angular-projects/package.json"
    // which reads like a broken install rather than a path assumption. Same variable name and meaning as
    // ci/setup-emulator-config.sh, so one export configures both. (2026-09-09)
    webServer: {
      command: `npm --prefix ${process.env.APP_PATH || '..'} run start:emulator`,
      url: 'http://localhost:4200',
      reuseExistingServer: process.env.EMU_REUSE_APP === '1',
      timeout: 240_000,
    },
  });
}

/**
 * Evidence variant: screenshot + trace on EVERY test (pass AND fail) so the gate produces a browsable,
 * screenshot-per-test HTML report that record-run.cjs uploads to Storage + indexes in Firestore cicd-audit.
 * TRACE=full → a full trace per test (slower + large); default → on-first-retry (cheap receipts).
 *
 *   // playwright.<sys>.emulator.evidence.config.ts
 *   import { makeEmulatorEvidenceConfig } from './lib/emulator-playwright-config';
 *   import base from './playwright.<sys>.emulator.config';
 *   export default makeEmulatorEvidenceConfig(base);
 */
export function makeEmulatorEvidenceConfig(base: PlaywrightTestConfig): PlaywrightTestConfig {
  return defineConfig({
    ...base,
    use: {
      ...base.use,
      screenshot: 'on',
      trace: process.env.TRACE === 'full' ? 'on' : 'on-first-retry',
      video: 'retain-on-failure',
    },
    reporter: [
      ['list'],
      ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ['json', { outputFile: 'playwright-report/report.json' }],
      ['junit', { outputFile: 'results.xml' }],
    ],
  });
}

/**
 * Report variant: FAILURE-ONLY capture (operator, 2026-07-02 — in-console report plan). The gate still
 * runs in blob→merge report mode (report.json lists ALL tests with status/duration — cheap metadata),
 * but heavy artifacts (screenshot / video / trace) are captured ONLY for failed tests. This is the
 * default for console-surfaced gates; queue/journey keep the evidence variant (screenshot per pass)
 * via their suites-manifest `capture: "all"` entry.
 *
 *   // playwright.<sys>.emulator.report.config.ts
 *   import { makeEmulatorReportConfig } from './lib/emulator-playwright-config';
 *   import base from './playwright.<sys>.emulator.config';
 *   export default makeEmulatorReportConfig(base);
 */
export function makeEmulatorReportConfig(base: PlaywrightTestConfig): PlaywrightTestConfig {
  return defineConfig({
    ...base,
    use: {
      ...base.use,
      screenshot: 'only-on-failure',
      trace: 'on-first-retry',
      video: 'retain-on-failure',
    },
    reporter: [
      ['list'],
      ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ['json', { outputFile: 'playwright-report/report.json' }],
      ['junit', { outputFile: 'results.xml' }],
    ],
  });
}
