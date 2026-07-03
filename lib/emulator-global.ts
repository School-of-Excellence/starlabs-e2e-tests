// @ts-nocheck
/**
 * emulator-global.ts — SHARED Playwright globalSetup/globalTeardown for the hermetic emulator runs.
 *
 * Every emulator-gated suite (authroles, business, content, …) needs the same globalSetup: attach to (or
 * boot) the Firebase emulator via the shared queue helper, point the test workers' Admin SDK at the
 * emulator, then teardown+reseed that suite's world. The only per-suite differences are the seed script
 * path and the suite's RUNID env var — so they are parameters here, not copy-pasted files.
 *
 * Usage (a suite's support/emulator-global-setup.ts becomes a 2-line shim):
 *   import { makeEmulatorGlobalSetup } from '../../lib/emulator-global';
 *   export default makeEmulatorGlobalSetup({ seedScript: 'authroles/seed-authroles.js',
 *                                            runidEnv: 'AUTH_RUNID', runidDefault: 'auth' });
 * and support/emulator-global-teardown.ts:
 *   export { emulatorGlobalTeardown as default } from '../../lib/emulator-global';
 *
 * Mirrors the journey/queue inline copies; uses the same shared queue/support/emulator-setup helper and the
 * same `__QUEUE_EMU_HANDLE__` handle key so teardown stops only a SPAWNED emulator (no-op on EMU_REUSE=1).
 */
import { execSync } from 'child_process';
import { ensureEmulator, PROJECT, FIRESTORE_HOST, AUTH_HOST, E2E_DIR } from '../queue/support/emulator-setup';

export interface EmulatorGlobalSetupOpts {
  /** Node seed script path relative to E2E_DIR, e.g. 'authroles/seed-authroles.js'. Must accept --seed/--teardown. */
  seedScript: string;
  /** The suite's RUNID env var name, e.g. 'AUTH_RUNID' (emails: <role>+<run>@example.com). */
  runidEnv: string;
  /** Default run id when the env var is unset, e.g. 'auth'. */
  runidDefault: string;
}

export function makeEmulatorGlobalSetup(opts: EmulatorGlobalSetupOpts) {
  const { seedScript, runidEnv, runidDefault } = opts;
  return async function emulatorGlobalSetup() {
    const handle = await ensureEmulator();             // EMU_REUSE=1 -> attaches to your running emulator
    (globalThis as any).__QUEUE_EMU_HANDLE__ = handle; // shared handle key; teardown stops a SPAWNED emulator only

    // CRITICAL (same as queue/journey): point this process + the forked workers' Admin SDK at the emulator,
    // so every firebase-admin query in the specs talks to the emulator partition (starlabs-cicd), not cloud.
    process.env.TEST_PROJECT = PROJECT;                   // starlabs-cicd
    process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST; // localhost:8080
    process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;  // localhost:9099

    if (process.env.SKIP_SEED !== '1') {
      const env = {
        ...process.env,
        FIREBASE_PROJECT: PROJECT,
        FIRESTORE_EMULATOR_HOST: FIRESTORE_HOST,
        FIREBASE_AUTH_EMULATOR_HOST: AUTH_HOST,
        [runidEnv]: process.env[runidEnv] || runidDefault,
      };
      // Clean any prior run, then re-seed. Teardown is a no-op on a fresh emulator; on a reused one it keeps
      // counts deterministic (same discipline as the queue/journey emulator setup).
      try { execSync(`node ${seedScript} --teardown`, { cwd: E2E_DIR, stdio: 'inherit', env }); } catch { /* first run — nothing to remove */ }
      execSync(`node ${seedScript} --seed`, { cwd: E2E_DIR, stdio: 'inherit', env });
    }
  };
}

/**
 * Stops the emulator that makeEmulatorGlobalSetup SPAWNED (if any). No-op when attached to an externally-
 * running emulator (EMU_REUSE=1 / pre-existing ports) — i.e. your local boot.sh emulator is left running.
 */
export async function emulatorGlobalTeardown() {
  const handle = (globalThis as any).__QUEUE_EMU_HANDLE__;
  if (handle && typeof handle.stop === 'function') {
    await handle.stop();
  }
}
