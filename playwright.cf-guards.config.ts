// cf-guards — config for the CF PREDEPLOY gate (plan L13/L14, 2026-07-02).
//
// Runs the loop-guard spec(s) against the LOCAL Firebase emulator only — no Angular app, no webServer,
// no seed. cf-predeploy.sh boots the emulator with the deploying CF repo's code and passes:
//   EMU_LOG  — the emulator log file (invocation counting)
//   CF_DIR   — the CF repo being deployed (functions-manifest.json is read from there)
// Exit code non-zero ⇒ the Firebase CLI aborts the deploy (predeploy hook contract).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './cf-guards',
  testMatch: '**/*.spec.ts',
  timeout: 300_000,           // one test seeds ALL triggers + waits the settle windows
  fullyParallel: false,
  workers: 1,
  retries: 0,                 // a loop signal must never be "retried away"
  reporter: [['list']],
  metadata: { target: 'cf-predeploy-guard' },
});
