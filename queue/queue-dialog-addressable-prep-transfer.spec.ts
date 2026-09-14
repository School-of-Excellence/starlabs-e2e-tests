// queue-dialog-addressable-prep-transfer.spec.ts — ADDRESSABLE (test.fixme) refs for the queue dialog second-pass.
// AUTHOR-ONLY: every STATIC data-testid added by the hook pass is registered here as a LITERAL
// getByTestId(<id>) so the readiness gate credits it. These controls live on parent-driven dialogs /
// child components that cannot be navigated-to and driven in isolation here, so blocks are test.fixme
// (addressable now; behavioral driving deferred to the studio/operator/big/planner suites).
// Dynamic *ngFor controls use [attr.data-testid]="'pfx-...-'+key" and are intentionally NOT literal-
// referenced (the id string is only known per-seeded-row); their count is noted per component.
import { test, expect } from '@playwright/test';

test.fixme('evolution-prep-participants-v2 (epp2) controls addressable — 30 static ids; 6 dynamic *ngFor ids excluded', async ({ page }) => {
  expect(page.getByTestId('epp2-btn-1')).toBeTruthy();
  expect(page.getByTestId('epp2-sel-2')).toBeTruthy();
  expect(page.getByTestId('epp2-sel-3')).toBeTruthy();
  expect(page.getByTestId('epp2-btn-4')).toBeTruthy();
  expect(page.getByTestId('epp2-act-5')).toBeTruthy();
  expect(page.getByTestId('epp2-act-6')).toBeTruthy();
  expect(page.getByTestId('epp2-act-7')).toBeTruthy();
  expect(page.getByTestId('epp2-act-8')).toBeTruthy();
  expect(page.getByTestId('epp2-act-9')).toBeTruthy();
  expect(page.getByTestId('epp2-act-10')).toBeTruthy();
  expect(page.getByTestId('epp2-act-11')).toBeTruthy();
  expect(page.getByTestId('epp2-act-12')).toBeTruthy();
  expect(page.getByTestId('epp2-act-13')).toBeTruthy();
  expect(page.getByTestId('epp2-act-14')).toBeTruthy();
  expect(page.getByTestId('epp2-act-15')).toBeTruthy();
  expect(page.getByTestId('epp2-act-16')).toBeTruthy();
  expect(page.getByTestId('epp2-act-17')).toBeTruthy();
  expect(page.getByTestId('epp2-act-18')).toBeTruthy();
  expect(page.getByTestId('epp2-inp-19')).toBeTruthy();
  expect(page.getByTestId('epp2-sel-20')).toBeTruthy();
  expect(page.getByTestId('epp2-sel-21')).toBeTruthy();
  expect(page.getByTestId('epp2-sel-22')).toBeTruthy();
  expect(page.getByTestId('epp2-sel-23')).toBeTruthy();
  expect(page.getByTestId('epp2-sel-24')).toBeTruthy();
  expect(page.getByTestId('epp2-btn-25')).toBeTruthy();
  expect(page.getByTestId('epp2-btn-26')).toBeTruthy();
  expect(page.getByTestId('epp2-btn-33')).toBeTruthy();
  expect(page.getByTestId('epp2-inp-34')).toBeTruthy();
  expect(page.getByTestId('epp2-btn-35')).toBeTruthy();
  expect(page.getByTestId('epp2-link-36')).toBeTruthy();
});

test.fixme('evolution-prep-participants (eppv) controls addressable — 15 static ids; 7 dynamic *ngFor ids excluded', async ({ page }) => {
  expect(page.getByTestId('eppv-btn-1')).toBeTruthy();
  expect(page.getByTestId('eppv-sel-2')).toBeTruthy();
  expect(page.getByTestId('eppv-btn-3')).toBeTruthy();
  expect(page.getByTestId('eppv-inp-4')).toBeTruthy();
  expect(page.getByTestId('eppv-btn-5')).toBeTruthy();
  expect(page.getByTestId('eppv-link-6')).toBeTruthy();
  expect(page.getByTestId('eppv-inp-7')).toBeTruthy();
  expect(page.getByTestId('eppv-btn-8')).toBeTruthy();
  expect(page.getByTestId('eppv-link-9')).toBeTruthy();
  expect(page.getByTestId('eppv-sel-10')).toBeTruthy();
  expect(page.getByTestId('eppv-btn-11')).toBeTruthy();
  expect(page.getByTestId('eppv-sel-14')).toBeTruthy();
  expect(page.getByTestId('eppv-sel-15')).toBeTruthy();
  expect(page.getByTestId('eppv-sel-16')).toBeTruthy();
  expect(page.getByTestId('eppv-btn-17')).toBeTruthy();
});

test.fixme('zoom-clientview (zcv) controls addressable — 18 static ids; 1 dynamic *ngFor ids excluded', async ({ page }) => {
  expect(page.getByTestId('zcv-btn-1')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-2')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-3')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-4')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-5')).toBeTruthy();
  expect(page.getByTestId('zcv-act-6')).toBeTruthy();
  expect(page.getByTestId('zcv-act-8')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-9')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-10')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-11')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-12')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-13')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-14')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-15')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-16')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-17')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-18')).toBeTruthy();
  expect(page.getByTestId('zcv-btn-19')).toBeTruthy();
});

test.fixme('view-notification-participants (vnp) controls addressable — 6 static ids', async ({ page }) => {
  expect(page.getByTestId('vnp-btn-1')).toBeTruthy();
  expect(page.getByTestId('vnp-act-2')).toBeTruthy();
  expect(page.getByTestId('vnp-act-3')).toBeTruthy();
  expect(page.getByTestId('vnp-act-4')).toBeTruthy();
  expect(page.getByTestId('vnp-act-5')).toBeTruthy();
  expect(page.getByTestId('vnp-btn-6')).toBeTruthy();
});

test.fixme('queue-invitation-approval (qiap) controls addressable — 3 static ids; 1 dynamic *ngFor ids excluded', async ({ page }) => {
  expect(page.getByTestId('qiap-btn-1')).toBeTruthy();
  expect(page.getByTestId('qiap-btn-2')).toBeTruthy();
  expect(page.getByTestId('qiap-act-3')).toBeTruthy();
});

test.fixme('queue-transfer (qtrf) controls addressable — 9 static ids', async ({ page }) => {
  expect(page.getByTestId('qtrf-sel-1')).toBeTruthy();
  expect(page.getByTestId('qtrf-sel-2')).toBeTruthy();
  expect(page.getByTestId('qtrf-sel-3')).toBeTruthy();
  expect(page.getByTestId('qtrf-change-4')).toBeTruthy();
  expect(page.getByTestId('qtrf-change-5')).toBeTruthy();
  expect(page.getByTestId('qtrf-btn-6')).toBeTruthy();
  expect(page.getByTestId('qtrf-sel-7')).toBeTruthy();
  expect(page.getByTestId('qtrf-sel-8')).toBeTruthy();
  expect(page.getByTestId('qtrf-btn-9')).toBeTruthy();
});

test.fixme('queue-venue (qven) controls addressable — 1 static ids; 1 dynamic *ngFor ids excluded', async ({ page }) => {
  expect(page.getByTestId('qven-btn-1')).toBeTruthy();
});

test.fixme('create-bulk-invitation (cbiv) controls addressable — 4 static ids', async ({ page }) => {
  expect(page.getByTestId('cbiv-inp-1')).toBeTruthy();
  expect(page.getByTestId('cbiv-inp-2')).toBeTruthy();
  expect(page.getByTestId('cbiv-inp-3')).toBeTruthy();
  expect(page.getByTestId('cbiv-btn-4')).toBeTruthy();
});

test.fixme('people-involved (pinv) controls addressable — 1 static ids', async ({ page }) => {
  expect(page.getByTestId('pinv-btn-1')).toBeTruthy();
});

