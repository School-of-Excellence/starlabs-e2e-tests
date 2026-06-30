// @ts-nocheck
/**
 * emulator-global-teardown.ts (COMMS) — re-export the SHARED teardown (stops a SPAWNED emulator only;
 * no-op on EMU_REUSE=1). Used by playwright.comms.emulator.config.ts.
 */
export { emulatorGlobalTeardown as default } from '../../lib/emulator-global';
