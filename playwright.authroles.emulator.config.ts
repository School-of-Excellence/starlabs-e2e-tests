import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the HERMETIC emulator run of the AUTHROLES suite (CI-gateable).
 *
 * This is the emulator twin of playwright.authroles.config.ts (which targets the cloud test project).
 * It mirrors playwright.journey.emulator.config.ts, just pointed at ./authroles:
 *   - globalSetup attaches to (or boots) the Firebase emulator and seeds the authroles world
 *     (authroles/support/emulator-global-setup.ts -> authroles/seed-authroles.js, emulator-targeted).
 *   - webServer serves the EMULATOR-wired Angular build (npm run start:emulator); reused locally
 *     when EMU_REUSE_APP=1 (you already have it served).
 *   - project id is starlabs-cicd everywhere (matches environment.emulator.ts + the booted emulator),
 *     so the seed, the app and the Admin SDK all read the SAME emulator partition.
 *
 * Run locally (emulator + app already up):
 *   export JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.11.10-hotspot"
 *   export PATH="$JAVA_HOME/bin:$PATH"
 *   cd /c/Users/meena/angular-projects/starlabs-e2e-tests
 *   EMU_REUSE=1 EMU_REUSE_APP=1 \
 *     npx playwright test --config=playwright.authroles.emulator.config.ts --headed
 *   (add --grep "AR-01" to run a single case)
 */
export default defineConfig({
  testDir: './authroles',
  testMatch: '**/*.spec.ts',
  globalSetup: require.resolve('./authroles/support/emulator-global-setup.ts'),
  globalTeardown: require.resolve('./authroles/support/emulator-global-teardown.ts'),
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,        // shared seed state — serialize for determinism (same as queue/journey)
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['junit', { outputFile: 'results.xml' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  metadata: { target: 'emulator', suite: 'authroles', project: process.env.FIREBASE_PROJECT || 'starlabs-cicd' },
  projects: [
    { name: 'authroles-desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  // Boots the EMULATOR-wired Angular app; reuses an already-running dev server locally (EMU_REUSE_APP=1).
  webServer: {
    command: 'npm --prefix .. run start:emulator',
    url: 'http://localhost:4200',
    reuseExistingServer: process.env.EMU_REUSE_APP === '1',
    timeout: 240_000,
  },
});
