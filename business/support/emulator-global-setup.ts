// @ts-nocheck
/**
 * emulator-global-setup.ts (BUSINESS) — 2-line shim over the SHARED lib/emulator-global factory.
 * Attaches to/boots the emulator, points the Admin SDK at it, then teardown+reseeds business via
 * BIZ_RUNID. Used by playwright.business.emulator.config.ts.
 */
import { makeEmulatorGlobalSetup } from '../../lib/emulator-global';

export default makeEmulatorGlobalSetup({
  seedScript: 'business/seed-business.js',
  runidEnv: 'BIZ_RUNID',
  runidDefault: 'biz',
});
