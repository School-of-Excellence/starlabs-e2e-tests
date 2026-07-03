// @ts-nocheck
/**
 * emulator-global-setup.ts (WORKSHOPS) — 2-line shim over the SHARED lib/emulator-global factory.
 * Attaches to/boots the emulator, points the Admin SDK at it, then teardown+reseeds workshops via
 * WSHOP_RUNID. Used by playwright.workshops.emulator.config.ts.
 */
import { makeEmulatorGlobalSetup } from '../../lib/emulator-global';

export default makeEmulatorGlobalSetup({
  seedScript: 'workshops/seed-workshops.js',
  runidEnv: 'WSHOP_RUNID',
  runidDefault: 'wshop',
});
