// @ts-nocheck
/**
 * emulator-global-teardown.ts (CUSTOMER SUPPORT) — re-export the SHARED teardown (stops a SPAWNED emulator
 * only; no-op on EMU_REUSE=1). Used by playwright.support.emulator.config.ts.
 */
export { emulatorGlobalTeardown as default } from '../../lib/emulator-global';
