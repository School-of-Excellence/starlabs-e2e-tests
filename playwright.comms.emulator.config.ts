// Hermetic emulator config for the COMMS suite (CI-gateable) — the emulator twin of
// playwright.comms.config.ts. Built from the SHARED factory (lib/emulator-playwright-config); the only
// per-suite input is the suite name. See the factory for the run-locally recipe + what it assembles.
import { makeEmulatorConfig } from './lib/emulator-playwright-config';

export default makeEmulatorConfig({ suite: 'comms' });
