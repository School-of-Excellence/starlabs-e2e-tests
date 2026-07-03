// @ts-nocheck
/**
 * emulator-global-setup.ts (EVOMAP) — 2-line shim over the SHARED lib/emulator-global factory.
 * Attaches to/boots the emulator, points the Admin SDK at it, then teardown+reseeds evomap via
 * EVOM_RUNID. Used by playwright.evomap.emulator.config.ts.
 */
import { makeEmulatorGlobalSetup } from '../../lib/emulator-global';

export default makeEmulatorGlobalSetup({
  seedScript: 'evomap/seed-evomap.js',
  runidEnv: 'EVOM_RUNID',
  runidDefault: 'evom',
});
