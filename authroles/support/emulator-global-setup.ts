// @ts-nocheck
/**
 * emulator-global-setup.ts (AUTHROLES) — Playwright globalSetup for the hermetic emulator run.
 *
 * Mirrors journey/support/emulator-global-setup.ts. It:
 *   1. attaches to (or boots) the Firebase emulator via the SHARED helper (queue/support/emulator-setup.ts),
 *   2. points the test workers' Admin SDK at the emulator (so reads/writes hit the local emulator, not cloud),
 *   3. seeds the AUTHROLES world into the emulator by running authroles/seed-authroles.js with the emulator
 *      env set (FIRESTORE_EMULATOR_HOST + FIREBASE_PROJECT=starlabs-cicd → seed-authroles.js inits an
 *      emulator-pinned admin instead of the cloud-allowlisted initAdmin()).
 *
 * Used by playwright.authroles.emulator.config.ts. The cloud run keeps using authroles/support/global-setup.ts.
 */
import { execSync } from 'child_process';
import { ensureEmulator, PROJECT, FIRESTORE_HOST, AUTH_HOST, E2E_DIR } from '../../queue/support/emulator-setup';

export default async function authrolesEmulatorGlobalSetup() {
  const handle = await ensureEmulator();             // EMU_REUSE=1 -> attaches to your running emulator
  (globalThis as any).__QUEUE_EMU_HANDLE__ = handle; // shared handle key; teardown stops a SPAWNED emulator only

  // CRITICAL (same as queue/journey): point this process + the forked workers' Admin SDK at the emulator, so
  // every firebase-admin query in the specs talks to the emulator partition (starlabs-cicd), never the cloud.
  process.env.TEST_PROJECT = PROJECT;                   // starlabs-cicd
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST; // localhost:8080
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;  // localhost:9099

  if (process.env.SKIP_SEED !== '1') {
    const env = {
      ...process.env,
      FIREBASE_PROJECT: PROJECT,
      FIRESTORE_EMULATOR_HOST: FIRESTORE_HOST,
      FIREBASE_AUTH_EMULATOR_HOST: AUTH_HOST,
      AUTH_RUNID: process.env.AUTH_RUNID || 'auth',   // authroles run id (emails: <role>+auth@example.com)
    };
    // Clean any prior authroles run, then re-seed. Teardown is a no-op on a fresh emulator; on a reused one
    // it keeps counts deterministic (same discipline as the queue/journey emulator setup).
    try { execSync('node authroles/seed-authroles.js --teardown', { cwd: E2E_DIR, stdio: 'inherit', env }); } catch { /* first run — nothing to remove */ }
    execSync('node authroles/seed-authroles.js --seed', { cwd: E2E_DIR, stdio: 'inherit', env });
  }
}
