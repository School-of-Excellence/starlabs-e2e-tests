// Evidence variant of the ATC emulator gate (screenshot per test). See lib/emulator-playwright-config.ts.
import { makeEmulatorEvidenceConfig } from './lib/emulator-playwright-config';
import base from './playwright.atc.emulator.config';

export default makeEmulatorEvidenceConfig(base);
