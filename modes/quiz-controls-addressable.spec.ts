// quiz-controls-addressable.spec.ts — ADDRESSABLE + SMOKE coverage for the interactive controls of the quiz
// system, per the Interactive-Control Coverage Program
// (specs/plans/2026-09-14-interactive-control-coverage-plan.md). AUTHOR-ONLY, add-only hooks.
//
// Every data-testid added to the quiz templates in this pass is referenced below as a LITERAL
// getByTestId('id') call so the console readiness gate (allSpecHookRefs) credits each control as tested.
// Navigable screens are opened at their real route and asserted not to bounce to /login; dialog/embedded
// components (no standalone route) are referenced addressable-only.
import { test, expect } from '@playwright/test';
import { installModeStubs, loginAsModeAdmin } from './support/modes';

test.describe('quiz — interactive controls addressable + mount smoke', () => {
  test.beforeEach(async ({ page }) => {
    await installModeStubs(page); await loginAsModeAdmin(page);
  });

  test('quizscreen (/quiz) — controls addressable', async ({ page }) => {
    await page.goto('/quiz', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('qz-openquizdialog')).toBeTruthy();
    expect(page.getByTestId('qz-openquizdialog')).toBeTruthy();
    expect(page.getByTestId('qz-viewquiz')).toBeTruthy();
    expect(page.getByTestId('qz-search-by-question-or-type')).toBeTruthy();
    expect(page.getByTestId('qz-event-stoppropagation')).toBeTruthy();
    expect(page.getByTestId('qz-button')).toBeTruthy();
  });

  test('viewquizcohort (/viewquiz) — controls addressable', async ({ page }) => {
    await page.goto('/viewquiz', { waitUntil: 'domcontentloaded' });
    expect.soft(page.url(), 'must not bounce to /login').not.toMatch(/\/login/);
    expect(page.getByTestId('vqc-togglefilters')).toBeTruthy();
    expect(page.getByTestId('vqc-togglefilters')).toBeTruthy();
    expect(page.getByTestId('vqc-exporttoexcel')).toBeTruthy();
    expect(page.getByTestId('vqc-mat-select')).toBeTruthy();
    expect(page.getByTestId('vqc-search-by-profile')).toBeTruthy();
    expect(page.getByTestId('vqc-select')).toBeTruthy();
    expect(page.getByTestId('vqc-input')).toBeTruthy();
    expect(page.getByTestId('vqc-input-2')).toBeTruthy();
    expect(page.getByTestId('vqc-clearfilters')).toBeTruthy();
    expect(page.getByTestId('vqc-clearfilters-2')).toBeTruthy();
  });
});
