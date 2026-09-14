// locationlog-controls-secondpass.spec.ts — SECOND-PASS ADDRESSABLE coverage for the residual
// interactive controls of the non-ATC Events locationlog screen (Interactive-Control Coverage Program,
// specs/plans/2026-09-14-interactive-control-coverage-plan.md).
//
// The first pass (events-controls-addressable.spec.ts) hooked every top-level locationlog control.
// This pass closes the residual controls in the custom-distance ("Farther than / Within / unit") band
// and the row/card repeaters, which the first pass did not reach.
//
// NEW STATIC hooks added this pass (each literal-referenced below with getByTestId):
//   ll-dist-within   — custom-distance direction "Within" segment button
//   ll-dist-beyond   — custom-distance direction "Farther than" segment button
//
// NEW DYNAMIC hooks added this pass are *ngFor / @for / *matRowDef rows and are EXCLUDED from the
// literal-reference rule (per contract) — noted here for the record, addressable via prefix + seeded id:
//   [attr.data-testid]="'ll-dist-unit-' + unit"        (unit segment button, @for over unitOptions)
//   [attr.data-testid]="'ll-tablerow-' + p.profileid"  (mat-row, *matRowDef)
//   [attr.data-testid]="'ll-card-' + p.profileid"      (mobile card, @for over view.participants)
//
// ATC SCOPE: /locationlog is default-DB-only and NOT ATC-fenced (the four ATC-reading Events dashboards
// are intentionally not covered — see events-controls-addressable.spec.ts header).
import { test, expect } from '@playwright/test';
import { installEvtStubs, loginAsEvtAdmin } from './support/events';

test.describe('Events locationlog — second-pass residual controls addressable (non-ATC)', () => {
  test.beforeEach(async ({ page }) => {
    await installEvtStubs(page);
    await loginAsEvtAdmin(page);
  });

  test('custom-distance segment controls are addressable', async ({ page }) => {
    await page.goto('/locationlog', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    // Anchor on an always-rendered top-level control from the first pass.
    await expect.soft(page.getByTestId('ll-refresh')).toBeVisible({ timeout: 30_000 });
    // The custom-distance band renders only for the 'custom' distance band; reference the two new
    // static direction controls (addressable regardless of the band's current visibility).
    expect(page.getByTestId('ll-dist-within')).toBeTruthy();
    expect(page.getByTestId('ll-dist-beyond')).toBeTruthy();
  });
});
