// @ts-nocheck
/**
 * emulator-global-setup.ts (AUTHROLES) — 2-line shim over the SHARED lib/emulator-global factory.
 * Attaches to/boots the emulator, points the Admin SDK at it, then teardown+reseeds authroles via
 * AUTH_RUNID. Used by playwright.authroles.emulator.config.ts.
 */
import { makeEmulatorGlobalSetup } from '../../lib/emulator-global';

export default makeEmulatorGlobalSetup({
  seedScript: 'authroles/seed-authroles.js',
  runidEnv: 'AUTH_RUNID',
  runidDefault: 'auth',
});
