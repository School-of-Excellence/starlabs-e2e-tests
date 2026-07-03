// @ts-nocheck
/**
 * emulator-global-teardown.ts (CONTENT) — re-export the SHARED teardown (stops a SPAWNED emulator only;
 * no-op on EMU_REUSE=1). Used by playwright.content.emulator.config.ts.
 */
export { emulatorGlobalTeardown as default } from '../../lib/emulator-global';
