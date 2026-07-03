// @ts-nocheck
/**
 * emulator-global-teardown.ts (MODES) — re-export the SHARED teardown (stops a SPAWNED emulator only;
 * no-op on EMU_REUSE=1). Used by playwright.modes.emulator.config.ts.
 */
export { emulatorGlobalTeardown as default } from '../../lib/emulator-global';
