// @ts-nocheck
/**
 * emulator-global-setup.ts (MODES) — 2-line shim over the SHARED lib/emulator-global factory.
 * Attaches to/boots the emulator, points the Admin SDK at it, then teardown+reseeds modes via
 * MODE_RUNID. Used by playwright.modes.emulator.config.ts.
 */
import { makeEmulatorGlobalSetup } from '../../lib/emulator-global';

export default makeEmulatorGlobalSetup({
  seedScript: 'modes/seed-modes.js',
  runidEnv: 'MODE_RUNID',
  runidDefault: 'mode',
});
