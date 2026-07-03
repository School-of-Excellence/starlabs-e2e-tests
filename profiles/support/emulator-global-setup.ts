// @ts-nocheck
/**
 * emulator-global-setup.ts (PROFILES) — 2-line shim over the SHARED lib/emulator-global factory.
 * Attaches to/boots the emulator, points the Admin SDK at it, then teardown+reseeds profiles via
 * PROF_RUNID. Used by playwright.profiles.emulator.config.ts.
 */
import { makeEmulatorGlobalSetup } from '../../lib/emulator-global';

export default makeEmulatorGlobalSetup({
  seedScript: 'profiles/seed-profiles.js',
  runidEnv: 'PROF_RUNID',
  runidDefault: 'prof',
});
