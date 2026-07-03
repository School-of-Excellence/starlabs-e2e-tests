// Evidence variant of the EVENTS emulator config — screenshot + trace per test for the browsable
// report that record-run.cjs ships to Storage + Firestore cicd-audit. Built from the SHARED factory.
import { makeEmulatorEvidenceConfig } from './lib/emulator-playwright-config';
import base from './playwright.events.emulator.config';

export default makeEmulatorEvidenceConfig(base);
