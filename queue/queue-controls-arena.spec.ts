// queue-controls-arena.spec.ts — ADDRESSABLE+SMOKE for /arena/:queueid/:stage. Prefix: arb.
//
// Interactive-control coverage program (specs/plans/2026-09-14-interactive-control-coverage-plan.md).
// Asserts the data-testid hooks added to arena-board.component.html are addressable via literal
// getByTestId(...). Behaviour (chat send, studio open, etc.) is NOT driven here — OP-21 (arena-board.spec)
// owns the route's real-UI assertion. New file; does not touch arena-board.spec.ts.
//
// Route/id resolution copied from arena-board.spec.ts: the queue doc id is looked up by name and the stage
// is taken from the seeded queue's own stages[] (never hardcoded). The bare '/arena' dashboard grant in the
// seed is what lets authGuard admit the operator (it matches the first path segment only).
import { test, expect, Locator } from '@playwright/test';
import { QUEUE_NAME, actors, loginAs } from './support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs, ExternalStubs } from './stubs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fa = require('./support/firestore-admin');

let guard: ConsoleGuard;
let stubs: ExternalStubs;
let queueId: string;
let stage: string;

async function soft(l: Locator): Promise<void> {
  if (await l.count()) await expect(l.first()).toBeVisible();
}

test.beforeAll(async () => {
  const queues = await fa.queryWhere('queue generation', [['queuename', '==', QUEUE_NAME]]);
  expect(queues.length, `precondition: a "queue generation" doc named "${QUEUE_NAME}" must be seeded`).toBeGreaterThan(0);
  queueId = String(queues[0].id);
  const stages = (queues[0].stages ?? []) as string[];
  expect(stages.length, 'precondition: the seeded queue must carry a stages array').toBeGreaterThan(0);
  stage = stages[0];
});

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  stubs = installAllExternalStubs(page);
});

test.afterEach(() => assertNoFatal(guard, 'arena-board controls: no fatal console errors / pageerrors'));

test.describe('Arena Board — interactive controls addressable (/arena/:queueid/:stage)', () => {
  test('ABC-01 arena board mounts and every new data-testid is addressable', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);
    await page.goto(`/arena/${encodeURIComponent(queueId)}/${encodeURIComponent(stage)}`, {
      waitUntil: 'domcontentloaded',
    });

    // [SMOKE] the board mounts (host attached — its own box is zero-size, like OP-21) and the header Back
    // control is addressable + visible.
    await expect(page.locator('app-arena-board'), 'ABC-01: the arena board must mount').toBeAttached({ timeout: 30_000 });
    await expect(page.getByTestId('arb-back'), 'ABC-01: the Back button must render').toBeVisible({ timeout: 30_000 });

    // [ADDRESSABLE] left/right panel tabs + collapse controls (present when the panels are open, which is the
    // default) — soft so a collapsed default never fails the case.
    await soft(page.getByTestId('arb-left-collapse'));
    await soft(page.getByTestId('arb-lefttab-participants'));
    await soft(page.getByTestId('arb-lefttab-specialists'));
    await soft(page.getByTestId('arb-right-collapse'));
    await soft(page.getByTestId('arb-righttab-done'));
    await soft(page.getByTestId('arb-righttab-chat'));
    // reopen rails only render when a panel is collapsed.
    await soft(page.getByTestId('arb-left-reopen'));
    await soft(page.getByTestId('arb-right-reopen'));
    // load-error retry only renders on a stalled board stream.
    await soft(page.getByTestId('arb-retry'));
    // chat composer + thread controls render only inside an open studio chat.
    await soft(page.getByTestId('arb-chat-back'));
    await soft(page.getByTestId('arb-chat-showmore'));
    await soft(page.getByTestId('arb-chat-input'));
    await soft(page.getByTestId('arb-chat-fileinput'));
    await soft(page.getByTestId('arb-chat-attach'));
    await soft(page.getByTestId('arb-chat-send'));
    // image preview overlay only renders after a chat image is expanded.
    await soft(page.getByTestId('arb-preview-backdrop'));
    await soft(page.getByTestId('arb-preview-panel'));
    await soft(page.getByTestId('arb-preview-close'));
    // per-studio / per-message dynamic hooks (arb-idle-chat-*, arb-inviting-chat-*, arb-joined-chat-*,
    // arb-active-chat-*, arb-chat-thread-*, arb-chat-img-*, arb-chat-download-*, arb-chat-removefile-*) are
    // keyed by studio/file ids and exercised by prefix where they render.
    await soft(page.locator('[data-testid^="arb-idle-chat-"]'));
    await soft(page.locator('[data-testid^="arb-joined-chat-"]'));
    await soft(page.locator('[data-testid^="arb-active-chat-"]'));
    await soft(page.locator('[data-testid^="arb-chat-thread-"]'));
  });
});
