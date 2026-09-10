// @ts-nocheck
/**
 * smoke-global-setup.ts — globalSetup for the refactor smoke check.
 *
 * Runs the JOURNEY emulator setup verbatim (emulator + the journey world, which is the seed that carries a
 * working admin actor), then layers on the extra `dashboard` route grants the smoke screens need. See
 * smoke/seed-smoke-routes.js for why those grants are separate from the journey seed.
 */
import { execSync } from 'child_process';
import journeyEmulatorGlobalSetup from '../../journey/support/emulator-global-setup';
import { PROJECT, FIRESTORE_HOST, AUTH_HOST, E2E_DIR } from '../../queue/support/emulator-setup';

export default async function smokeGlobalSetup() {
  await journeyEmulatorGlobalSetup();

  if (process.env.SKIP_SEED !== '1') {
    execSync('node smoke/seed-smoke-routes.js', {
      cwd: E2E_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        FIREBASE_PROJECT: PROJECT,
        FIRESTORE_EMULATOR_HOST: FIRESTORE_HOST,
        FIREBASE_AUTH_EMULATOR_HOST: AUTH_HOST,
        JNY_RUNID: process.env.JNY_RUNID || 'jny',
      },
    });
  }
}
