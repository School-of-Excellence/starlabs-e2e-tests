// @ts-nocheck
/**
 * emulator-global-setup.ts (EVENTS) — 2-line shim over the SHARED lib/emulator-global factory.
 * Attaches to/boots the emulator, points the Admin SDK at it, then teardown+reseeds events via
 * EVT_RUNID. Used by playwright.events.emulator.config.ts.
 */
import { makeEmulatorGlobalSetup } from '../../lib/emulator-global';

export default makeEmulatorGlobalSetup({
  seedScript: 'events/seed-events.js',
  runidEnv: 'EVT_RUNID',
  runidDefault: 'evt',
});
