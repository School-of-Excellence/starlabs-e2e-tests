// Report variant of the ATC emulator gate (failure-only artifacts). See lib/emulator-playwright-config.ts.
import { makeEmulatorReportConfig } from './lib/emulator-playwright-config';
import base from './playwright.atc.emulator.config';

export default makeEmulatorReportConfig(base);
