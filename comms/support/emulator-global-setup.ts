// @ts-nocheck
/**
 * emulator-global-setup.ts (COMMS) — 2-line shim over the SHARED lib/emulator-global factory.
 * Attaches to/boots the emulator, points the Admin SDK at it, then teardown+reseeds comms via
 * COMM_RUNID. Used by playwright.comms.emulator.config.ts.
 */
import { makeEmulatorGlobalSetup } from '../../lib/emulator-global';

export default makeEmulatorGlobalSetup({
  seedScript: 'comms/seed-comms.js',
  runidEnv: 'COMM_RUNID',
  runidDefault: 'comm',
});
