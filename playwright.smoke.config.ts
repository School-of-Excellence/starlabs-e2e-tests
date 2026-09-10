import { defineConfig, devices } from '@playwright/test';

/**
 * Config for the ONE-OFF refactor smoke check (smoke/refactor-smoke.spec.ts).
 *
 * Deliberately separate from every gated suite: its own testDir means no existing config picks these tests
 * up, and this config is not referenced by any workflow. It reuses the JOURNEY emulator world purely for a
 * working login — the journey seed is the one that carries an admin actor.
 *
 * Run locally with the emulator and the app already up:
 *   export JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.11.10-hotspot"
 *   export PATH="$JAVA_HOME/bin:$PATH"
 *   EMU_REUSE=1 EMU_REUSE_APP=1 npx playwright test --config=playwright.smoke.config.ts
 *
 * NOTE on the app URL: Angular's dev server binds IPv6 loopback only, so `localhost` works and a literal
 * 127.0.0.1 does not. Do not "helpfully" change this to an IPv4 address.
 */
export default defineConfig({
  testDir: './smoke',
  testMatch: '**/*.spec.ts',
  globalSetup: require.resolve('./smoke/support/smoke-global-setup.ts'),
  globalTeardown: require.resolve('./journey/support/emulator-global-teardown.ts'),
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  metadata: { target: 'emulator', suite: 'refactor-smoke', project: process.env.FIREBASE_PROJECT || 'starlabs-cicd' },
  projects: [{ name: 'smoke-desktop', use: { ...devices['Desktop Chrome'] } }],
  // No webServer block on purpose: this is run against an app the operator already has up. The journey
  // config's `npm --prefix ..` webServer command resolves relative to the hub's parent and is wrong on a
  // flat local checkout, which is a trap worth not inheriting.
});
