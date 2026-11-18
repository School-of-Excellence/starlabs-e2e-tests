// atc-audio-player.spec.ts — the shared COMPACT brief player on a viewer screen, EMULATOR ONLY.
// Added 2026-11-18 (signed-URL migration: compact player on every ATC screen + keep-warm ping).
//
// Uses /previewATC (PV_A) as the representative viewer: every ATC viewer renders the same
// <app-atc-audio compact>, so one screen pins the component's contract:
//   AAP-01  a stored brief PATH renders the compact player — play / seek / time / speed, no native
//           <audio controls>, no download menu (controlslist=nodownload)
//   AAP-02  the player keeps getMediaUrls warm ({warm:true} once on mount) and, on Play, sends the stored
//           ATC_Audio_Notes/ PATH (never a URL); the callable's fence accepts it
//   AAP-03  a speed tap cycles 1x → 1.25x (local state; no network)
// The brief is a real WAV uploaded to the STORAGE EMULATOR and attached to the seeded PV_A note for this
// file only (restored to [] afterwards — PVA specs assert the note text, not its media).
// Real audio cannot play here — no signing credentials in the emulator — so AAP-02 accepts a URL OR
// `sign-failed`, and fails only on a fence rejection.
import { test, expect, Page } from '@playwright/test';
import { ATC2, PA, RUN, installAtcGuards, assertNoRealDb, loginAsAtc, atcDb, storageBucket, wavBuffer, AtcGuard } from './support/atc';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from '../queue/support/console-guard';

const NOTE = `${RUN}_N_PVA`;
const BRIEF = `ATC_Audio_Notes/${RUN}/e2e-brief-${RUN}.wav`;

async function open(page: Page) {
  await loginAsAtc(page, 'admin');
  await page.goto(`/previewATC?type=alpha&atcdocid=${ATC2.PV_A}&participantassignmentid=${PA.activity}`);
  await expect(page.getByTestId('pva-participant')).toBeVisible({ timeout: 45_000 });
}

test.describe('ATC — compact brief player (real UI, emulator only)', () => {
  let guard: AtcGuard;
  let cguard: ConsoleGuard;

  test.beforeAll(async () => {
    await storageBucket().file(BRIEF).save(wavBuffer(), { contentType: 'audio/wav' });
    await atcDb().collection('atc_notes').doc(NOTE).update({ changeworkbrief: [BRIEF] });
  });
  test.afterAll(async () => {
    await atcDb().collection('atc_notes').doc(NOTE).update({ changeworkbrief: [] });
    await storageBucket().file(BRIEF).delete({ ignoreNotFound: true });
  });
  test.beforeEach(async ({ page }) => {
    cguard = attachConsoleGuard(page);
    guard = await installAtcGuards(page);
  });
  test.afterEach(() => {
    assertNoRealDb(guard);
    assertNoFatal(cguard, 'atc audio player: no fatal console errors');
  });

  test('AAP-01 a stored brief renders the compact player — no native controls, no download', async ({ page }) => {
    await open(page);
    const player = page.locator('app-atc-audio[compact]');
    await expect(player).toHaveCount(1, { timeout: 30_000 });
    await expect(player.getByTestId('aa-play')).toBeVisible();
    await expect(player.getByTestId('aa-seek'), 'seek disabled until the clip loads').toBeDisabled();
    await expect(player.getByTestId('aa-rate')).toHaveText('1x');
    await expect(player.locator('audio')).not.toHaveAttribute('controls', /.*/);
    await expect(player.locator('audio')).toHaveAttribute('controlslist', /nodownload/);
  });

  test('AAP-02 warm ping on mount; Play sends the PATH and the fence accepts it', async ({ page }) => {
    const bodies: any[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/getMediaUrls') && r.method() === 'POST') {
        try { bodies.push(JSON.parse(r.postData() || 'null')); } catch { /* ignore */ }
      }
    });
    await open(page);
    await expect.poll(() => bodies.filter((b) => b?.data?.warm === true).length,
      { message: 'one {warm:true} ping when the player mounts', timeout: 15_000 }).toBe(1);

    const resp = page.waitForResponse((res) => res.url().includes('/getMediaUrls')
      && /"refs"/.test(res.request().postData() || ''), { timeout: 45_000 });
    await page.locator('app-atc-audio[compact]').getByTestId('aa-play').click();
    const res = await resp;
    expect(JSON.parse(res.request().postData() || '{}').data.refs).toEqual([BRIEF]);
    const result = (await res.json())?.result?.results?.[0] ?? {};
    expect(result.error ?? '').not.toMatch(/path-not-allowed|unparseable|bucket-not-allowed/);
    expect(Boolean(result.url) || /^sign-failed/.test(result.error ?? '')).toBe(true);
  });

  test('AAP-03 speed cycles 1x → 1.25x once the clip is ready, or stays disabled if it cannot load', async ({ page }) => {
    await open(page);
    const player = page.locator('app-atc-audio[compact]');
    await player.getByTestId('aa-play').click();
    const rate = player.getByTestId('aa-rate');
    // Emulator: no signing credentials → the clip may not load; then speed stays disabled (correct).
    await expect.poll(async () => (await rate.isEnabled()) || (await player.getByTestId('aa-error').isVisible()),
      { timeout: 30_000 }).toBe(true);
    if (await rate.isEnabled()) {
      await rate.click();
      await expect(rate).toHaveText('1.25x');
    }
  });
});
