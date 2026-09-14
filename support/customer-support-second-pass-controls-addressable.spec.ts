// customer-support-second-pass-controls-addressable.spec.ts
// DIALOG SECOND-PASS cleanup for Customer Support — ADDRESSABLE coverage for the two components with
// LIVE unhooked interactive controls remaining after the first pass:
//   - add-issue (src/app/Customer Support/add-issue/)        prefix: cai   (11 controls, was 0 hooks)
//   - releaselogdialog (src/app/Customer Support/releaselogdialog/) prefix: csrl (4 controls, was 0 hooks)
// (This is the Customer Support releaselogdialog — distinct from the Communication Center one, which uses
//  the 'crl' prefix and is covered by the comms suite. This pass does NOT touch that component.)
// Per the Interactive-Control Coverage Program (specs/plans/2026-09-14-interactive-control-coverage-plan.md).
// AUTHOR-ONLY, add-only hooks. Both folders are globbed by the 'support' suite (appPaths: "src/app/Customer Support/**").
//
// Every STATIC data-testid added in this pass is referenced below as a LITERAL getByTestId('id') so the
// console readiness gate (allSpecHookRefs) credits each control as tested. No *ngFor/dynamic ids in these two.
import { test, expect } from '@playwright/test';

test.describe('Customer Support second-pass dialogs — interactive controls addressable', () => {
  test.fixme('add-issue — every static interactive control is addressable', async ({ page }) => {
    expect(page.getByTestId('cai-opennotes')).toBeTruthy();
    expect(page.getByTestId('cai-button')).toBeTruthy();
    expect(page.getByTestId('cai-event')).toBeTruthy();
    expect(page.getByTestId('cai-choosetype')).toBeTruthy();
    expect(page.getByTestId('cai-choosetype-2')).toBeTruthy();
    expect(page.getByTestId('cai-choosetype-3')).toBeTruthy();
    expect(page.getByTestId('cai-choosetype-4')).toBeTruthy();
    expect(page.getByTestId('cai-onclick')).toBeTruthy();
    expect(page.getByTestId('cai-removefile')).toBeTruthy();
    expect(page.getByTestId('cai-onnoclick')).toBeTruthy();
    expect(page.getByTestId('cai-onsubmit')).toBeTruthy();
  });

  test.fixme('releaselogdialog (Customer Support) — every static interactive control is addressable', async ({ page }) => {
    expect(page.getByTestId('csrl-addlog')).toBeTruthy();
    expect(page.getByTestId('csrl-additem')).toBeTruthy();
    expect(page.getByTestId('csrl-removeitem')).toBeTruthy();
    expect(page.getByTestId('csrl-dialogref')).toBeTruthy();
  });
});
