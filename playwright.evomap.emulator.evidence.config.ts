// Evidence variant of the EVOMAP emulator config — screenshot + trace per test for the browsable
// report that record-run.cjs ships to Storage + Firestore cicd-audit. Built from the SHARED factory.
import { makeEmulatorEvidenceConfig } from './lib/emulator-playwright-config';
import base from './playwright.evomap.emulator.config';

export default makeEmulatorEvidenceConfig(base);
