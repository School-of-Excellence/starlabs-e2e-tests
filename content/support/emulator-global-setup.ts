// @ts-nocheck
/**
 * emulator-global-setup.ts (CONTENT) — 2-line shim over the SHARED lib/emulator-global factory.
 * Attaches to/boots the emulator, points the Admin SDK at it, then teardown+reseeds content via
 * CONT_RUNID. Used by playwright.content.emulator.config.ts.
 */
import { makeEmulatorGlobalSetup } from '../../lib/emulator-global';

export default makeEmulatorGlobalSetup({
  seedScript: 'content/seed-content.js',
  runidEnv: 'CONT_RUNID',
  runidDefault: 'cont',
});
