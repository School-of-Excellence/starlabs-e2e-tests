// Hermetic emulator config for the CUSTOMER SUPPORT suite (CI-gateable) — the emulator twin of
// playwright.support.config.ts. Built from the SHARED factory (lib/emulator-playwright-config); the only
// per-suite input is the suite name. See the factory for the run-locally recipe + what it assembles.
//
// Added 2026-09-09. Support's 18 specs (CS-01..CS-18) existed since the initial commit but had no emulator
// twin, so the suite was manifest-claimed yet ciReady:false — written, but unrunnable by CI or the console.
// This file plus support/support/emulator-global-setup|teardown.ts is what that flag was waiting on.
import { makeEmulatorConfig } from './lib/emulator-playwright-config';

export default makeEmulatorConfig({ suite: 'support' });
