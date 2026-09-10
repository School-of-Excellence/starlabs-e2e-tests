// @ts-nocheck
/**
 * emulator-global-setup.ts (CUSTOMER SUPPORT) — 2-line shim over the SHARED lib/emulator-global factory.
 * Attaches to/boots the emulator, points the Admin SDK at it, then teardown+reseeds support via SUP_RUNID.
 * Used by playwright.support.emulator.config.ts.
 *
 * Added 2026-09-09 alongside the emulator config. Note the seeder had to switch from seed.initAdmin() to
 * initAdminAuto() for this to work at all: seed.initAdmin() hard-aborts off the cloud test project and
 * cannot see the emulator partition, which is why support could not join the hermetic gate before now.
 */
import { makeEmulatorGlobalSetup } from '../../lib/emulator-global';

export default makeEmulatorGlobalSetup({
  seedScript: 'support/seed-support.js',
  runidEnv: 'SUP_RUNID',
  runidDefault: 'sup',
});
