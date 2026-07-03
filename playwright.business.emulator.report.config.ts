// Report variant of the BUSINESS emulator config — FAILURE-ONLY capture (report.json lists all tests;
// screenshots/video/trace only for failures). Used by the console-dispatched gate (suites-manifest).
import { makeEmulatorReportConfig } from './lib/emulator-playwright-config';
import base from './playwright.business.emulator.config';

export default makeEmulatorReportConfig(base);
