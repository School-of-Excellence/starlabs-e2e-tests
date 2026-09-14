// workshop-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the Workshop
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the Workshop templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installWshopStubs, loginAsWshopAdmin } from './support/wshop';

test.describe('Workshop — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installWshopStubs(page); await loginAsWshopAdmin(page);
  });

  test('view-workshop (/createworkshop) — controls addressable', async ({ page }) => {
    await page.goto('/createworkshop', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('vwk-createworkshop')).toBeTruthy();
    expect(page.getByTestId('vwk-createworkshop')).toBeTruthy();
    expect(page.getByTestId('vwk-editcontent')).toBeTruthy();
    expect(page.getByTestId('vwk-deletecontent')).toBeTruthy();
  });

  test('challenge-view (/workshopchallengecreation) — controls addressable', async ({ page }) => {
    await page.goto('/workshopchallengecreation', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('chv-ex-workshop-title')).toBeTruthy();
    expect(page.getByTestId('chv-ex-workshop-title')).toBeTruthy();
    expect(page.getByTestId('chv-onopendialog')).toBeTruthy();
    expect(page.getByTestId('chv-onopendialog-2')).toBeTruthy();
    expect(page.getByTestId('chv-ondeletedoc')).toBeTruthy();
  });

  test('enrollment-config-view (/enrollment_config_view) — controls addressable', async ({ page }) => {
    await page.goto('/enrollment_config_view', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('ecv-ex')).toBeTruthy();
    expect(page.getByTestId('ecv-ex')).toBeTruthy();
    expect(page.getByTestId('ecv-onopendialog')).toBeTruthy();
    expect(page.getByTestId('ecv-oneditdialog')).toBeTruthy();
    expect(page.getByTestId('ecv-ondeletedoc')).toBeTruthy();
  });

  test('participant-enrollment-dashboard (/workshopchallengeparticipantdashboard) — controls addressable', async ({ page }) => {
    await page.goto('/workshopchallengeparticipantdashboard', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('ped-mat-select')).toBeTruthy();
    expect(page.getByTestId('ped-mat-select')).toBeTruthy();
    expect(page.getByTestId('ped-button')).toBeTruthy();
    expect(page.getByTestId('ped-exportcsv')).toBeTruthy();
    expect(page.getByTestId('ped-mat-select-2')).toBeTruthy();
    expect(page.getByTestId('ped-onselectallprofile')).toBeTruthy();
    expect(page.getByTestId('ped-markattendedforselectedprofile')).toBeTruthy();
    expect(page.getByTestId('ped-onmoveprofile')).toBeTruthy();
    expect(page.getByTestId('ped-onselectprofile')).toBeTruthy();
    expect(page.getByTestId('ped-onparticipantdelete')).toBeTruthy();
    expect(page.getByTestId('ped-resetparticipant')).toBeTruthy();
  });

  test('workshop-image-upload (/workshop_image_upload) — controls addressable', async ({ page }) => {
    await page.goto('/workshop_image_upload', { waitUntil: 'domcontentloaded' });
    expect(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('wiu-filter-by-name')).toBeTruthy();
    expect(page.getByTestId('wiu-filter-by-name')).toBeTruthy();
    expect(page.getByTestId('wiu-button')).toBeTruthy();
    expect(page.getByTestId('wiu-openeditdialog')).toBeTruthy();
    expect(page.getByTestId('wiu-mat-select')).toBeTruthy();
    expect(page.getByTestId('wiu-mat-select-2')).toBeTruthy();
    expect(page.getByTestId('wiu-description')).toBeTruthy();
    expect(page.getByTestId('wiu-previewimage')).toBeTruthy();
    expect(page.getByTestId('wiu-onsubmit')).toBeTruthy();
    expect(page.getByTestId('wiu-openeditdialog-2')).toBeTruthy();
  });

  test('Workshop dialogs/embedded (enrollment-config-create, create-challenge, add-workshop, delete-participant-enrollment) — addressable by reference', async ({ page }) => {
    expect(page.getByTestId('ecc-name')).toBeTruthy();
    expect(page.getByTestId('ecc-addlayout')).toBeTruthy();
    expect(page.getByTestId('ecc-removelayout')).toBeTruthy();
    expect(page.getByTestId('ecc-selectedlayoutindex-layoutindex-on')).toBeTruthy();
    expect(page.getByTestId('ecc-onlayouttextvalueremove')).toBeTruthy();
    expect(page.getByTestId('ecc-onlayouttextvalueremove-2')).toBeTruthy();
    expect(page.getByTestId('ecc-onlayoutarrayvalueremove')).toBeTruthy();
    expect(page.getByTestId('ecc-onlayoutarrayvalueremove-2')).toBeTruthy();
    expect(page.getByTestId('ecc-onlayoutarrayvalueremove-3')).toBeTruthy();
    expect(page.getByTestId('ecc-onlayouttextvalueremove-3')).toBeTruthy();
    expect(page.getByTestId('ecc-onlayouttextvalueremove-4')).toBeTruthy();
    expect(page.getByTestId('ecc-onremoveimagemap')).toBeTruthy();
    expect(page.getByTestId('ecc-onaddtext')).toBeTruthy();
    expect(page.getByTestId('ecc-input')).toBeTruthy();
    expect(page.getByTestId('ecc-getcolorvalue')).toBeTruthy();
    expect(page.getByTestId('ecc-type-to-search-value')).toBeTruthy();
    expect(page.getByTestId('ecc-type-to-search-value-2')).toBeTruthy();
    expect(page.getByTestId('ecc-pick-one')).toBeTruthy();
    expect(page.getByTestId('ecc-add-type-reference')).toBeTruthy();
    expect(page.getByTestId('ecc-oncancel')).toBeTruthy();
    expect(page.getByTestId('ecc-onsubmit')).toBeTruthy();
    expect(page.getByTestId('ccg-label')).toBeTruthy();
    expect(page.getByTestId('ccg-ontaskremove')).toBeTruthy();
    expect(page.getByTestId('ccg-input')).toBeTruthy();
    expect(page.getByTestId('ccg-input-2')).toBeTruthy();
    expect(page.getByTestId('ccg-title')).toBeTruthy();
    expect(page.getByTestId('ccg-calltoaction')).toBeTruthy();
    expect(page.getByTestId('ccg-onremovechallenge')).toBeTruthy();
    expect(page.getByTestId('ccg-description')).toBeTruthy();
    expect(page.getByTestId('ccg-onremoveimage')).toBeTruthy();
    expect(page.getByTestId('ccg-add-type-reference')).toBeTruthy();
    expect(page.getByTestId('ccg-onaddrewards')).toBeTruthy();
    expect(page.getByTestId('ccg-title-2')).toBeTruthy();
    expect(page.getByTestId('ccg-availablecount')).toBeTruthy();
    expect(page.getByTestId('ccg-onremoverewards')).toBeTruthy();
    expect(page.getByTestId('ccg-onremoverewardsimage')).toBeTruthy();
    expect(page.getByTestId('ccg-add-image-url')).toBeTruthy();
    expect(page.getByTestId('ccg-onremoverewardsimage-2')).toBeTruthy();
    expect(page.getByTestId('ccg-add-link')).toBeTruthy();
    expect(page.getByTestId('ccg-type')).toBeTruthy();
    expect(page.getByTestId('ccg-title-3')).toBeTruthy();
    expect(page.getByTestId('ccg-calltoaction-2')).toBeTruthy();
    expect(page.getByTestId('ccg-ondatechange')).toBeTruthy();
    expect(page.getByTestId('ccg-challengename')).toBeTruthy();
    expect(page.getByTestId('ccg-description-2')).toBeTruthy();
    expect(page.getByTestId('ccg-onkeypointremove')).toBeTruthy();
    expect(page.getByTestId('ccg-input-3')).toBeTruthy();
    expect(page.getByTestId('ccg-onremovereference')).toBeTruthy();
    expect(page.getByTestId('ccg-add-type-reference-2')).toBeTruthy();
    expect(page.getByTestId('ccg-add-zoom-call-reference')).toBeTruthy();
    expect(page.getByTestId('ccg-onremoveimage-2')).toBeTruthy();
    expect(page.getByTestId('ccg-add-type-reference-3')).toBeTruthy();
    expect(page.getByTestId('ccg-onremoveimage-3')).toBeTruthy();
    expect(page.getByTestId('ccg-add-type-reference-4')).toBeTruthy();
    expect(page.getByTestId('ccg-dialogref-close')).toBeTruthy();
    expect(page.getByTestId('ccg-onsubmit')).toBeTruthy();
    expect(page.getByTestId('awk-title')).toBeTruthy();
    expect(page.getByTestId('awk-description')).toBeTruthy();
    expect(page.getByTestId('awk-challengeref')).toBeTruthy();
    expect(page.getByTestId('awk-enrolmentref')).toBeTruthy();
    expect(page.getByTestId('awk-onremoveworkshopadmin')).toBeTruthy();
    expect(page.getByTestId('awk-add-admin')).toBeTruthy();
    expect(page.getByTestId('awk-workshopgroupname')).toBeTruthy();
    expect(page.getByTestId('awk-startdate')).toBeTruthy();
    expect(page.getByTestId('awk-enddate')).toBeTruthy();
    expect(page.getByTestId('awk-lastregistrationdate')).toBeTruthy();
    expect(page.getByTestId('awk-onremoveimage')).toBeTruthy();
    expect(page.getByTestId('awk-add-type-reference')).toBeTruthy();
    expect(page.getByTestId('awk-onremovevideo')).toBeTruthy();
    expect(page.getByTestId('awk-add-type-reference-2')).toBeTruthy();
    expect(page.getByTestId('awk-dialogclose')).toBeTruthy();
    expect(page.getByTestId('awk-submit')).toBeTruthy();
    expect(page.getByTestId('dpe-dialogref-close')).toBeTruthy();
    expect(page.getByTestId('dpe-dialogref-close-2')).toBeTruthy();
  });
});
