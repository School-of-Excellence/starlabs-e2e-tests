// participant-videoask.spec.ts — /participantvideoask (REAL-UI).
//
// Recon: e2e/recon-allcomp/profiles-analytics.md (PA-47 — route assigned to this suite 2026-09-08).
//
// The module was unclaimed by any suite until this pass: a change to src/app/participant-videoask/**
// routed ZERO gates. It now belongs to profiles.
//
// SCOPE: a mount + empty-state case, labelled as one. The screen reads `arenavideoask`,
// `event collection`, `participant tags` and `participant tag logs`; this suite seeds none of them, so it
// renders its empty state. That is worth pinning because it proves the screen does not THROW on absent
// data — the failure mode that took /bigProfile and /bigchatscreen down elsewhere in this branch, both
// found only once someone finally opened the route.
import { test, expect } from '@playwright/test';
import { installProfileStubs, loginAsProfileAdmin } from './support/profiles';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

let guard: ConsoleGuard;

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  await installProfileStubs(page);
});
test.afterEach(() => assertNoFatal(guard, 'participant-videoask: no fatal console errors / pageerrors'));

test.describe('Profiles — participant videoask (real UI)', () => {
  // ===========================================================================================
  // PA-47 — /participantvideoask mounts over its four unseeded reads
  // ===========================================================================================
  test('PA-47 participantvideoask mounts without throwing on empty collections', async ({ page }) => {
    await loginAsProfileAdmin(page);
    await page.goto('/participantvideoask', { waitUntil: 'domcontentloaded' });

    await expect(
      page.locator('app-participant-videoask'),
      'PA-47: the screen must mount — if this fails on a correct URL, check the /participantvideoask ' +
      'grant in profiles/seed-profiles.js ROUTES (authGuard denies unlisted screens)',
    ).toBeAttached({ timeout: 30_000 });

    // The afterEach console guard is what gives this case its teeth: mounting proves the route resolves,
    // and a clean console proves none of the four reads threw on an absent collection.
    await expect(
      page.locator('app-participant-videoask'),
      'PA-47: the screen must still be attached once its reads settle',
    ).toBeAttached({ timeout: 30_000 });
  });
});
