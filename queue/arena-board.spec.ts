// arena-board.spec.ts — /arena/:queueid/:stage render (REAL-UI, anti-circular).
//
// Recon: e2e/queue/recon/ (OP-21 — the last uncovered `queue system` route besides /openmeeting).
//
// WHY THIS ROUTE WAS NEVER DRIVEN: it is the only queue-system screen with TWO path params, and it had no
// `dashboard` grant. Note the grant is the bare '/arena' — authGuard resolves allowed roles by the FIRST
// path segment only (auth.guard.ts:35), so granting '/arena/:queueid/:stage' would not have worked.
//
// The component only bootstraps when BOTH params are present:
//   this.queueid = params.get('queueid'); this.stage = params.get('stage');
//   if (this.queueid && this.stage) this.bootstrap();          (arena-board.component.ts:161-165)
// so a partial URL renders an empty shell rather than failing loudly.
//
// Anti-circularity: the assertion is the queue NAME in `.arena__brand-title` ({{ queueName || 'Arena' }},
// html:8). The URL carries the queue's DOC ID and a stage string — never the name. The component has to
// read the queue document to render it, and the fallback literal 'Arena' means a failed read would show
// something visibly different rather than an empty string that a loose assertion might tolerate.
//
// IDS ARE RESOLVED AT RUNTIME, not hardcoded: the queue doc id is looked up by queuename, and the stage is
// taken from that document's own `stages` array. A hardcoded `${testrunid}_${QUEUE_ID}` would couple this
// spec to a seed-internal id convention, and a hardcoded stage string would break the moment
// sample-queue-config.json is edited.
import { test, expect } from '@playwright/test';
import { QUEUE_NAME, actors, loginAs } from './support/actors';
import { attachConsoleGuard, assertNoFatal, ConsoleGuard } from './support/console-guard';
import { installAllExternalStubs, ExternalStubs } from './stubs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fa = require('./support/firestore-admin');

let guard: ConsoleGuard;
let stubs: ExternalStubs;
let queueId: string;
let stage: string;

test.beforeAll(async () => {
  const queues = await fa.queryWhere('queue generation', [['queuename', '==', QUEUE_NAME]]);
  expect(queues.length, `precondition: a "queue generation" doc named "${QUEUE_NAME}" must be seeded`)
    .toBeGreaterThan(0);
  queueId = String(queues[0].id);

  const stages = (queues[0].stages ?? []) as string[];
  expect(stages.length, 'precondition: the seeded queue must carry a stages array').toBeGreaterThan(0);
  stage = stages[0];
});

test.beforeEach(async ({ page }) => {
  guard = attachConsoleGuard(page);
  stubs = installAllExternalStubs(page);
});

test.afterEach(() => assertNoFatal(guard, 'arena-board: no fatal console errors / pageerrors'));

test.describe('Queue — arena board (real UI, anti-circular)', () => {
  // ===========================================================================================
  // OP-21 — /arena/:queueid/:stage resolves the queue NAME from the id in its URL
  // ===========================================================================================
  test('OP-21 arena board renders the queue name it resolved from the id in the URL', async ({ page }) => {
    await loginAs(page, actors.operatorAdmin);

    // Stage names contain spaces ("Evolution Prep Orientation") — encode, or the router sees extra segments.
    await page.goto(`/arena/${encodeURIComponent(queueId)}/${encodeURIComponent(stage)}`, {
      waitUntil: 'domcontentloaded',
    });

    const host = page.locator('app-arena-board');
    // ATTACHED, not VISIBLE. The board lays its children out with their own positioning, so the
    // `app-arena-board` host element itself has a zero-size box and toBeVisible() reports "hidden" even
    // though the screen is fully rendered. The real visibility check is the brand title below.
    await expect(
      host,
      'OP-21: the arena board must mount — if this fails on a correct URL, check the bare "/arena" ' +
      'dashboard grant in fixtures/seed-test-project.js DRIVEN_ROUTES (authGuard matches first segment only)',
    ).toBeAttached({ timeout: 30_000 });

    // [ASSERT] bootstrap() ran and resolved the queue document behind the id in the URL. `queueName` is not
    // in the URL; the literal fallback is 'Arena', so a failed read renders that instead.
    await expect(
      host.locator('.arena__brand-title'),
      `OP-21: the board must render the queue name "${QUEUE_NAME}" resolved from the queue doc — the URL ` +
      'carried only its id (a failed read would show the fallback "Arena")',
    ).toHaveText(new RegExp(QUEUE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 30_000 });
  });
});
