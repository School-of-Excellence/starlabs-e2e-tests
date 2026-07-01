// Hermetic emulator config for the APPOINTMENTS suite (CI-gateable) — the emulator twin of
// playwright.appointments.config.ts. Built from the SHARED factory (lib/emulator-playwright-config); the only
// per-suite input is the suite name. See the factory for the run-locally recipe + what it assembles.
// Requires the availability/appointments composite indexes (already in ci/overlay/firestore.indexes.json).
import { makeEmulatorConfig } from './lib/emulator-playwright-config';

export default makeEmulatorConfig({ suite: 'appointments' });
