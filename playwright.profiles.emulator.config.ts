// Hermetic emulator config for the PROFILES suite (CI-gateable) — the emulator twin of
// playwright.profiles.config.ts. Built from the SHARED factory (lib/emulator-playwright-config); the only
// per-suite input is the suite name. See the factory for the run-locally recipe + what it assembles.
// Notes: PA-CF-* assert participant-metadata Cloud Function output (need the CFs in the emulator deploy set);
// PA-13/14 use the `firestore-forms` named DB (served on-demand by the emulator).
import { makeEmulatorConfig } from './lib/emulator-playwright-config';

export default makeEmulatorConfig({ suite: 'profiles' });
