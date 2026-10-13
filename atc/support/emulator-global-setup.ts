// @ts-nocheck
/**
 * emulator-global-setup.ts (ATC) — shim over the SHARED lib/emulator-global factory, plus the Storage emulator
 * host. The ATC suite runs against the EMULATOR ONLY (operator rule 2026-10-13: never the development or
 * production database). seed-atc.js refuses to run unless FIRESTORE/AUTH/STORAGE emulator hosts are all set,
 * so the Storage host is exported here BEFORE the factory spawns the seeder (it inherits process.env) and
 * before the test workers fork (their Admin SDK reads it too).
 */
import { makeEmulatorGlobalSetup } from '../../lib/emulator-global';

const base = makeEmulatorGlobalSetup({
  seedScript: 'atc/seed-atc.js',
  runidEnv: 'ATC_RUNID',
  runidDefault: 'atc',
});

export default async function atcEmulatorGlobalSetup() {
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199';
  await base();
}
