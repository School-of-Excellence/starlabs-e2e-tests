// upload-studio.spec.ts — /videodashboard/upload (content/episodes-dashboard/upload-studio).
//
// Recon: e2e/recon-allcomp/content.md "Addendum — 2026-09-07" (CN-34 / CN-35 / CN-36).
//
// New on manoja-development (absent from the branch the coverage map measured). `?edit=<id>` loads ONE
// job from `getDoc(episodes/<id>)` (upload-studio.component.ts:145-169). With no new files attached the
// job has nothing to upload, so "Save change (1)" goes straight to saveEpisode() — a `setDoc(..., {merge:
// true})` where every media field falls back to the source doc (ts:372-378, 424-463). That is the ONE
// deterministic write path on this screen that needs no Storage, and CN-35 proves the "no Storage" part
// with a request counter rather than trusting the code comment.
//
// The route's canDeactivate (pendingUploadsGuard) blocks only while a job is queued/uploading/paused/
// finalizing (pending-uploads.guard.ts:9; ts:79,180). CN-36 asserts the pass-through case; the blocking
// case would need an in-flight resumable upload, which installStorageStub does not emulate — see Risk 16.
import { test, expect } from '@playwright/test';
import {
  contentIds, contentText, countStorageRequests, installContentStubs, loginAsContentAdmin, resetEpisodeEdit,
} from './support/content';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';
import { getDoc, pollUntil } from '../queue/support/firestore-admin';

const RUN = process.env.CONT_RUNID || 'cont';
const millis = (v: any): number | undefined => (typeof v?.toMillis === 'function' ? v.toMillis() : undefined);

test.describe('Content — /videodashboard/upload upload studio (real UI, anti-circular)', () => {
  let guard: ConsoleGuard;
  let storageRequests: () => number;
  test.beforeEach(async ({ page }) => {
    guard = attachConsoleGuard(page);
    storageRequests = countStorageRequests(page);
    await installContentStubs(page);
    await resetEpisodeEdit(); // EP3 back to its seed-time shape (CN-35 mutates it)
    await loginAsContentAdmin(page);
  });
  test.afterEach(() => assertNoFatal(guard, 'upload-studio: no fatal console errors / pageerrors'));

  // ===========================================================================================
  // CN-34 — ?edit=<id> loads the seeded episode into the job card
  // ===========================================================================================
  test('CN-34 ?edit=<id> loads the seeded episode fields into the job card', async ({ page }) => {
    await page.goto(`/videodashboard/upload?edit=${contentIds.EP3}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/videodashboard\/upload/, { timeout: 30_000 });
    await expect(page.locator('h1.pg'), 'CN-34: edit mode heading').toHaveText(/Edit Episode/, { timeout: 30_000 });

    // [ASSERT] the values the app read via getDoc and bound into the job's inputs (ts:145-169).
    await expect(page.locator('input[placeholder="Episode title *"]'), 'CN-34: title loaded from the doc')
      .toHaveValue(contentText.episode3Title, { timeout: 30_000 });
    await expect(page.locator('input[placeholder="Reference title"]'), 'CN-34: reference title loaded from the doc')
      .toHaveValue(contentText.episode3Ref);
    // one job card, in the `ready` state (nothing pending → the lockbar is absent)
    await expect(page.locator('div.card'), 'CN-34: exactly one job card').toHaveCount(1);
    await expect(page.locator('.lockbar'), 'CN-34: no upload in flight → screen not locked').toHaveCount(0);
  });

  // ===========================================================================================
  // CN-35 — title-only "Save change (1)" → setDoc(merge): title new, every media field unchanged,
  //          id == doc id, ZERO Storage requests
  // ===========================================================================================
  test('CN-35 a title-only save writes setDoc(merge) with media fields unchanged and no Storage call', async ({ page }) => {
    const NEW_TITLE = `EDITED_EPISODE_${RUN}_${Date.now()}`;
    const before = (await getDoc('episodes', contentIds.EP3))!;

    await page.goto(`/videodashboard/upload?edit=${contentIds.EP3}`, { waitUntil: 'domcontentloaded' });
    const title = page.locator('input[placeholder="Episode title *"]');
    await expect(title).toHaveValue(contentText.episode3Title, { timeout: 30_000 });
    await title.fill(NEW_TITLE);

    // With no files attached the job has nothing pending → startJob() goes straight to saveEpisode()
    // (ts:372-378). No confirm() on this path; the only dialog on the screen is the cancel confirm.
    const save = page.locator('button.btn.btn-primary', { hasText: /Save change/ });
    await expect(save, 'CN-35: edit mode labels the action "Save change (1)"').toBeVisible({ timeout: 10_000 });
    await save.click();

    const after = await pollUntil(
      () => getDoc('episodes', contentIds.EP3),
      (d) => d?.title === NEW_TITLE,
      { label: 'CN-35: EP3.title updated by the app', timeoutMs: 30_000 },
    );
    // [ASSERT] the merge kept every media field as the source doc had it (ts:430-445 fallbacks).
    for (const f of ['videoUrl', 'imageUrl', 'screenshot', 'srt', 'videoSizeBytes', 'imagesize', 'reftitle'] as const) {
      expect(after![f], `CN-35: ${f} unchanged by a metadata-only save`).toEqual(before[f]);
    }
    expect(millis(after!.date), 'CN-35: date is carried from the loaded job, not reset (ts:162/442)').toBe(millis(before.date));
    expect(after!.id, 'CN-35: id field == doc id (ts:431/447)').toBe(contentIds.EP3);
    expect(storageRequests(), 'CN-35: zero requests to Firebase Storage').toBe(0);
    await expect(page.locator('.t-note.ok'), 'CN-35: the card reports the save').toContainText(/saved/i, { timeout: 30_000 });
  });

  // ===========================================================================================
  // CN-36 — canDeactivate passes through when nothing is pending
  // ===========================================================================================
  test('CN-36 leaving with no pending upload navigates back without the "Uploads in progress" dialog', async ({ page }) => {
    await page.goto(`/videodashboard/upload?edit=${contentIds.EP3}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[placeholder="Episode title *"]')).toHaveValue(contentText.episode3Title, { timeout: 30_000 });

    await page.locator('button.backbtn[title="Back to Episodes"]').click();
    await expect(page, 'CN-36: the guard let the navigation through (guard:9 → true)').toHaveURL(/\/videodashboard$/, { timeout: 30_000 });
    await expect(page.locator('h2[mat-dialog-title]', { hasText: 'Uploads in progress' }), 'CN-36: no ConfirmComponent was opened')
      .toHaveCount(0);
  });
});
