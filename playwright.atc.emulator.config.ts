// Hermetic emulator config for the ATC suite (Prescribe / Edit / View Prescribed ATC) — EMULATOR ONLY.
// Operator rule 2026-10-13: ATC is never tested against the development or production database; the seed,
// the app (main.ts connects firestore-atc to the emulator) and the specs' Admin SDK all point at the emulator.
// Built from the SHARED factory; the only per-suite input is the suite name.
import { makeEmulatorConfig } from './lib/emulator-playwright-config';

export default makeEmulatorConfig({ suite: 'atc' });
