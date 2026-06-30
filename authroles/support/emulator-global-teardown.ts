// @ts-nocheck
/**
 * emulator-global-teardown.ts (AUTHROLES) — stops the emulator that emulator-global-setup SPAWNED (if any).
 * No-op when attached to an externally-running emulator (EMU_REUSE=1 / pre-existing ports) — i.e. your
 * local `boot.sh` emulator is left running. Mirrors journey/support/emulator-global-teardown.ts.
 */
export default async function authrolesEmulatorGlobalTeardown() {
  const handle = (globalThis as any).__QUEUE_EMU_HANDLE__;
  if (handle && typeof handle.stop === 'function') {
    await handle.stop();
  }
}
