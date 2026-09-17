// dialogs.spec.ts — Journey Onboarding dialog/child/legacy components with no standalone route.
// They render inside a MatDialog opened from a parent flow (or are legacy, superseded by a *-clone).
// Controls are hooked ADD-ONLY; ids are registered here for the readiness gate. Behavioral drive is via
// the parent flow and is deferred (test.fixme) — a dialog child cannot be reached by page.goto.
import { test, expect } from '@playwright/test';

test.describe('Journey Onboarding — dialog / non-routable components (addressability registered)', () => {
  // sales-dashboard (prefix: jsd, 91 controls). Legacy component — no active route (superseded by sales-dashboard-clone at /sales-report).
  test.fixme('jsd — sales-dashboard controls (dialog/child, driven via parent)', async ({ page }) => {
    const controls = [
      page.getByTestId('jsd-btn-001'),
      page.getByTestId('jsd-btn-002'),
      page.getByTestId('jsd-btn-003'),
      page.getByTestId('jsd-inp-004'),
      page.getByTestId('jsd-inp-005'),
      page.getByTestId('jsd-btn-006'),
      page.getByTestId('jsd-btn-007'),
      page.getByTestId('jsd-btn-008'),
      page.getByTestId('jsd-btn-009'),
      page.getByTestId('jsd-btn-010'),
      page.getByTestId('jsd-div-011'),
      page.getByTestId('jsd-div-012'),
      page.getByTestId('jsd-div-013'),
      page.getByTestId('jsd-div-014'),
      page.getByTestId('jsd-div-015'),
      page.getByTestId('jsd-div-016'),
      page.getByTestId('jsd-div-017'),
      page.getByTestId('jsd-div-018'),
      page.getByTestId('jsd-div-019'),
      page.getByTestId('jsd-div-020'),
      page.getByTestId('jsd-div-021'),
      page.getByTestId('jsd-div-022'),
      page.getByTestId('jsd-div-023'),
      page.getByTestId('jsd-div-024'),
      page.getByTestId('jsd-inp-025'),
      page.getByTestId('jsd-inp-026'),
      page.getByTestId('jsd-inp-027'),
      page.getByTestId('jsd-msel-028'),
      page.getByTestId('jsd-msel-029'),
      page.getByTestId('jsd-msel-030'),
      page.getByTestId('jsd-msel-031'),
      page.getByTestId('jsd-msel-032'),
      page.getByTestId('jsd-msel-033'),
      page.getByTestId('jsd-btn-034'),
      page.getByTestId('jsd-btn-035'),
      page.getByTestId('jsd-btn-036'),
      page.getByTestId('jsd-th-037'),
      page.getByTestId('jsd-span-038'),
      page.getByTestId('jsd-div-039'),
      page.getByTestId('jsd-div-040'),
      page.getByTestId('jsd-span-041'),
      page.getByTestId('jsd-span-042'),
      page.getByTestId('jsd-span-043'),
      page.getByTestId('jsd-btn-044'),
      page.getByTestId('jsd-btn-045'),
      page.getByTestId('jsd-btn-046'),
      page.getByTestId('jsd-btn-047'),
      page.getByTestId('jsd-btn-048'),
      page.getByTestId('jsd-sel-049'),
      page.getByTestId('jsd-msel-050'),
      page.getByTestId('jsd-msel-051'),
      page.getByTestId('jsd-msel-052'),
      page.getByTestId('jsd-msel-053'),
      page.getByTestId('jsd-td-054'),
      page.getByTestId('jsd-td-055'),
      page.getByTestId('jsd-td-056'),
      page.getByTestId('jsd-td-057'),
      page.getByTestId('jsd-td-058'),
      page.getByTestId('jsd-td-059'),
      page.getByTestId('jsd-td-060'),
      page.getByTestId('jsd-td-061'),
      page.getByTestId('jsd-btn-062'),
      page.getByTestId('jsd-btn-063'),
      page.getByTestId('jsd-td-064'),
      page.getByTestId('jsd-td-065'),
      page.getByTestId('jsd-td-066'),
      page.getByTestId('jsd-td-067'),
      page.getByTestId('jsd-td-068'),
      page.getByTestId('jsd-td-069'),
      page.getByTestId('jsd-td-070'),
      page.getByTestId('jsd-td-071'),
      page.getByTestId('jsd-btn-072'),
      page.getByTestId('jsd-btn-073'),
      page.getByTestId('jsd-td-074'),
      page.getByTestId('jsd-td-075'),
      page.getByTestId('jsd-btn-076'),
      page.getByTestId('jsd-btn-077'),
      page.getByTestId('jsd-td-078'),
      page.getByTestId('jsd-td-079'),
      page.getByTestId('jsd-btn-080'),
      page.getByTestId('jsd-btn-081'),
      page.getByTestId('jsd-td-082'),
      page.getByTestId('jsd-td-083'),
      page.getByTestId('jsd-btn-084'),
      page.getByTestId('jsd-btn-085'),
      page.getByTestId('jsd-td-086'),
      page.getByTestId('jsd-td-087'),
      page.getByTestId('jsd-btn-088'),
      page.getByTestId('jsd-btn-089'),
      page.getByTestId('jsd-btn-090'),
      page.getByTestId('jsd-btn-091'),
    ];
    for (const c of controls) await expect(c.first()).toBeVisible();
  });

  // delivery-dashboard (prefix: jdd, 46 controls). Legacy component — no active route (superseded by delivery-dashboard-clone at /delivery-dashboard).
  test.fixme('jdd — delivery-dashboard controls (dialog/child, driven via parent)', async ({ page }) => {
    const controls = [
      page.getByTestId('jdd-btn-001'),
      page.getByTestId('jdd-btn-002'),
      page.getByTestId('jdd-btn-003'),
      page.getByTestId('jdd-btn-004'),
      page.getByTestId('jdd-btn-005'),
      page.getByTestId('jdd-btn-006'),
      page.getByTestId('jdd-btn-007'),
      page.getByTestId('jdd-btn-008'),
      page.getByTestId('jdd-btn-009'),
      page.getByTestId('jdd-btn-010'),
      page.getByTestId('jdd-sel-011'),
      page.getByTestId('jdd-btn-012'),
      page.getByTestId('jdd-btn-013'),
      page.getByTestId('jdd-div-014'),
      page.getByTestId('jdd-div-015'),
      page.getByTestId('jdd-div-016'),
      page.getByTestId('jdd-div-017'),
      page.getByTestId('jdd-div-018'),
      page.getByTestId('jdd-div-019'),
      page.getByTestId('jdd-div-020'),
      page.getByTestId('jdd-div-021'),
      page.getByTestId('jdd-div-022'),
      page.getByTestId('jdd-div-023'),
      page.getByTestId('jdd-btn-024'),
      page.getByTestId('jdd-btn-025'),
      page.getByTestId('jdd-inp-026'),
      page.getByTestId('jdd-btn-027'),
      page.getByTestId('jdd-msel-028'),
      page.getByTestId('jdd-msel-029'),
      page.getByTestId('jdd-btn-030'),
      page.getByTestId('jdd-btn-031'),
      page.getByTestId('jdd-inp-032'),
      page.getByTestId('jdd-btn-033'),
      page.getByTestId('jdd-inp-034'),
      page.getByTestId('jdd-btn-035'),
      page.getByTestId('jdd-inp-036'),
      page.getByTestId('jdd-inp-037'),
      page.getByTestId('jdd-div-038'),
      page.getByTestId('jdd-span-039'),
      page.getByTestId('jdd-btn-040'),
      page.getByTestId('jdd-btn-041'),
      page.getByTestId('jdd-btn-042'),
      page.getByTestId('jdd-btn-043'),
      page.getByTestId('jdd-btn-044'),
      page.getByTestId('jdd-btn-045'),
      page.getByTestId('jdd-sel-046'),
    ];
    for (const c of controls) await expect(c.first()).toBeVisible();
  });

  // create-watson-profile (prefix: cwp, 19 controls). MatDialog child, opened from a parent flow.
  test.fixme('cwp — create-watson-profile controls (dialog/child, driven via parent)', async ({ page }) => {
    const controls = [
      page.getByTestId('cwp-btn-001'),
      page.getByTestId('cwp-maticon-002'),
      page.getByTestId('cwp-inp-003'),
      page.getByTestId('cwp-maticon-004'),
      page.getByTestId('cwp-maticon-005'),
      page.getByTestId('cwp-div-006'),
      page.getByTestId('cwp-div-007'),
      page.getByTestId('cwp-div-008'),
      page.getByTestId('cwp-div-009'),
      page.getByTestId('cwp-inp-010'),
      page.getByTestId('cwp-inp-011'),
      page.getByTestId('cwp-inp-012'),
      page.getByTestId('cwp-inp-013'),
      page.getByTestId('cwp-inp-014'),
      page.getByTestId('cwp-msel-015'),
      page.getByTestId('cwp-btn-016'),
      page.getByTestId('cwp-btn-017'),
      page.getByTestId('cwp-btn-018'),
      page.getByTestId('cwp-btn-019'),
      // 2026-09-17: the GST Company picker (multi-company billing — the dialog re-resolves the payment
      // against this selection before committing the batch, starlabs-angular 0f55208d).
      page.getByTestId('cwp-sel-020'),
    ];
    for (const c of controls) await expect(c.first()).toBeVisible();
  });

  // schedule-dialog (prefix: jschd, 13 controls). MatDialog child.
  test.fixme('jschd — schedule-dialog controls (dialog/child, driven via parent)', async ({ page }) => {
    const controls = [
      page.getByTestId('jschd-span-001'),
      page.getByTestId('jschd-span-002'),
      page.getByTestId('jschd-inp-003'),
      page.getByTestId('jschd-btn-004'),
      page.getByTestId('jschd-div-005'),
      page.getByTestId('jschd-div-006'),
      page.getByTestId('jschd-btn-007'),
      page.getByTestId('jschd-btn-008'),
      page.getByTestId('jschd-txt-009'),
      page.getByTestId('jschd-btn-010'),
      page.getByTestId('jschd-matchip-011'),
      page.getByTestId('jschd-btn-012'),
      page.getByTestId('jschd-btn-013'),
    ];
    for (const c of controls) await expect(c.first()).toBeVisible();
  });

  // specialist-appointment-slot (prefix: jsas, 8 controls). Embedded child component — no standalone route.
  test.fixme('jsas — specialist-appointment-slot controls (dialog/child, driven via parent)', async ({ page }) => {
    const controls = [
      page.getByTestId('jsas-sel-001'),
      page.getByTestId('jsas-inp-002'),
      page.getByTestId('jsas-btn-003'),
      page.getByTestId('jsas-btn-004'),
      page.getByTestId('jsas-btn-005'),
      page.getByTestId('jsas-inp-006'),
      page.getByTestId('jsas-btn-007'),
      page.getByTestId('jsas-btn-008'),
    ];
    for (const c of controls) await expect(c.first()).toBeVisible();
  });

  // eco-system-dialog (prefix: esd, 7 controls). MatDialog child of the ecosystem screen.
  test.fixme('esd — eco-system-dialog controls (dialog/child, driven via parent)', async ({ page }) => {
    const controls = [
      page.getByTestId('esd-btn-001'),
      page.getByTestId('esd-inp-002'),
      page.getByTestId('esd-tr-003'),
      page.getByTestId('esd-btn-004'),
      page.getByTestId('esd-inp-005'),
      page.getByTestId('esd-div-006'),
      page.getByTestId('esd-div-007'),
    ];
    for (const c of controls) await expect(c.first()).toBeVisible();
  });

  // cross-over-metrics-dialog (prefix: jcomd, 5 controls). MatDialog child.
  test.fixme('jcomd — cross-over-metrics-dialog controls (dialog/child, driven via parent)', async ({ page }) => {
    const controls = [
      page.getByTestId('jcomd-btn-001'),
      page.getByTestId('jcomd-inp-002'),
      page.getByTestId('jcomd-tr-003'),
      page.getByTestId('jcomd-btn-004'),
      page.getByTestId('jcomd-div-005'),
    ];
    for (const c of controls) await expect(c.first()).toBeVisible();
  });

  // eco-system-new-dialog (prefix: esnd, 5 controls). MatDialog child of the ecosystem screen.
  test.fixme('esnd — eco-system-new-dialog controls (dialog/child, driven via parent)', async ({ page }) => {
    const controls = [
      page.getByTestId('esnd-btn-001'),
      page.getByTestId('esnd-inp-002'),
      page.getByTestId('esnd-div-003'),
      page.getByTestId('esnd-div-004'),
      page.getByTestId('esnd-div-005'),
    ];
    for (const c of controls) await expect(c.first()).toBeVisible();
  });

  // journeycoach-completed (prefix: jcc, 7 controls). MatDialog child.
  test.fixme('jcc — journeycoach-completed controls (dialog/child, driven via parent)', async ({ page }) => {
    const controls = [
      page.getByTestId('jcc-btn-001'),
      page.getByTestId('jcc-inp-002'),
      page.getByTestId('jcc-msel-003'),
      page.getByTestId('jcc-inp-004'),
      page.getByTestId('jcc-inp-005'),
      page.getByTestId('jcc-btn-006'),
      page.getByTestId('jcc-div-007'),
    ];
    for (const c of controls) await expect(c.first()).toBeVisible();
  });

  // reschedule-dialog (prefix: jrsd, 9 controls). MatDialog child.
  test.fixme('jrsd — reschedule-dialog controls (dialog/child, driven via parent)', async ({ page }) => {
    const controls = [
      page.getByTestId('jrsd-btn-001'),
      page.getByTestId('jrsd-inp-002'),
      page.getByTestId('jrsd-msel-003'),
      page.getByTestId('jrsd-inp-004'),
      page.getByTestId('jrsd-inp-005'),
      page.getByTestId('jrsd-inp-006'),
      page.getByTestId('jrsd-inp-007'),
      page.getByTestId('jrsd-btn-008'),
      page.getByTestId('jrsd-btn-009'),
    ];
    for (const c of controls) await expect(c.first()).toBeVisible();
  });

  // journeyplan-dialog (prefix: jpld, 2 controls). MatDialog child of the journeyplan screen.
  test.fixme('jpld — journeyplan-dialog controls (dialog/child, driven via parent)', async ({ page }) => {
    const controls = [
      page.getByTestId('jpld-btn-001'),
      page.getByTestId('jpld-btn-002'),
    ];
    for (const c of controls) await expect(c.first()).toBeVisible();
  });

  // product-dialog (prefix: jpd, 2 controls). MatDialog child.
  test.fixme('jpd — product-dialog controls (dialog/child, driven via parent)', async ({ page }) => {
    const controls = [
      page.getByTestId('jpd-btn-001'),
      page.getByTestId('jpd-div-002'),
    ];
    for (const c of controls) await expect(c.first()).toBeVisible();
  });

});
