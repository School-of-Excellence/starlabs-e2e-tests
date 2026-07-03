// @ts-nocheck
/**
 * emulator-global-setup.ts (APPOINTMENTS) — 2-line shim over the SHARED lib/emulator-global factory.
 * Attaches to/boots the emulator, points the Admin SDK at it, then teardown+reseeds appointments via
 * APPT_RUNID. Used by playwright.appointments.emulator.config.ts.
 */
import { makeEmulatorGlobalSetup } from '../../lib/emulator-global';

export default makeEmulatorGlobalSetup({
  seedScript: 'appointments/seed-appointments.js',
  runidEnv: 'APPT_RUNID',
  runidDefault: 'appt',
});
