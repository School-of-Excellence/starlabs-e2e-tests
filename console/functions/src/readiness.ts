/**
 * readiness — ingest endpoints for the NEW branch-channels flow (2026-08-19).
 *
 * `branch-channels.yml` (starlabs-angular) runs on every feature push: it publishes a dev and a prod
 * hosting channel, and checks whether the hub's suites actually cover the diff. Those two reports
 * land here and are written to TWO NEW FIELDS on the existing candidate doc:
 *
 *     release-candidates/{repo}__{branch}.previewStatus     ← recordBranchChannel
 *     release-candidates/{repo}__{branch}.testSuiteStatus   ← recordSuiteStatus
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *   • never writes `preview.*` — that facet belongs to the OLD flow (console Deploy → preview.yml →
 *     recordPreviewUrl). Two flows must never fight over one field.
 *   • never calls mutateCandidate — that would re-project and stamp `updatedAt`. Neither new field
 *     is read by deriveStatus()/reconcileVerdict(), so nothing here can move a status or change a
 *     button, and card ordering in the console is left exactly as it is.
 *
 * Lives in the `console` codebase (one codebase per Firebase project — operator directive
 * 2026-08-19) and is surfaced by a single `export * from './readiness'` in index.ts.
 *
 * AUTH: the same low-privilege shared bearer as the other ingest endpoints (CONSOLE_INGEST_TOKEN).
 * A leak can at most write these two informational fields on an allow-listed repo's candidate.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import type { Request, Response } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { PATHS, candidateId } from './model';

const region = 'us-central1';
const CONSOLE_INGEST_TOKEN = defineSecret('CONSOLE_INGEST_TOKEN');
const GITHUB_APP_PRIVATE_KEY = defineSecret('GITHUB_APP_PRIVATE_KEY');

// Duplicated from index.ts rather than imported — index.ts does `export * from './readiness'`, so
// importing back would be a cycle. Same values, same env vars.
const GITHUB_ORG = process.env.GITHUB_ORG ?? 'School-of-Excellence';
const GITHUB_APP_ID = process.env.GITHUB_APP_ID ?? 'TODO_APP_ID';
const GITHUB_APP_INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID ?? 'TODO_INSTALLATION_ID';

/**
 * The NEW flow's test lane. A separate file from preview-e2e.yml ON PURPOSE: handleWorkflowRun
 * matches tracked lanes by workflow FILE, falling back to display NAME containing
 * preview / deploy / e2e. `branch-suites.yml`, displayed as "branch suites", matches none of those,
 * so its runs are logged "not a tracked lane" and cannot touch gateRun / testSummary / preview.*
 * — the old flow's fields.
 *
 * ⚠️ Do NOT rename this workflow to anything containing preview, deploy or e2e.
 */
const BRANCH_SUITES_WORKFLOW = 'branch-suites.yml';

/** Mirrors INGEST_REPO_ALLOWLIST in index.ts — kept local so this module has no import cycle. */
const REPO_ALLOWLIST = new Set(['starlabs-angular', 'starlabs-cloud-function', 'starlabs-e2e-tests']);

/**
 * A channel URL must be a real Firebase Hosting preview channel on one of OUR sites:
 *   dev  → breakthroughs-test--<channel>-<hash>.web.app
 *   prod → star-labs--<channel>-<hash>.web.app
 * Note the DOUBLE dash — that is what a genuine channel URL looks like. index.ts's older
 * PREVIEW_URL_RE only knows the dev form, which is why these endpoints validate their own.
 */
const CHANNEL_URL_RE = /^https:\/\/(breakthroughs-test|star-labs)--[a-z0-9-]+\.web\.app\/?$/;

const RUN_STATES = new Set(['RUNNING', 'PASSED', 'FAILED']);

const ENVS = new Set(['dev', 'prod']);
const CHANNEL_STATUSES = new Set(['BUILDING', 'SUCCESS', 'FAILED']);
const SUITE_STATES = new Set([
  'CHECKING',
  'MATCHED',
  'SUITES_MISSING',
  'NEEDS_UPDATE',
  'MISSING_TEST_CASES',
  'NO_COVERAGE_POSSIBLE',
  'NOT_APPLICABLE',
  'RUNNING',
  'PASSED',
  'FAILED',
]);

/** Constant-time bearer check (hashed so the compared length is fixed). */
function bearerOk(header: string | undefined, token: string): boolean {
  if (!header || !token) return false;
  const m = /^Bearer\s+(.+)$/.exec(header.trim());
  if (!m) return false;
  const a = createHash('sha256').update(m[1]).digest();
  const b = createHash('sha256').update(token).digest();
  return timingSafeEqual(a, b);
}

const str = (v: unknown, max = 500): string | undefined =>
  typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : undefined;

/** ms since epoch from the CLI's ISO expireTime, or undefined. */
function toMillis(iso: unknown): number | undefined {
  const s = str(iso);
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : undefined;
}

/**
 * Merge `patch` into the candidate doc.
 *
 * set(merge:true) so a report arriving BEFORE the push webhook created the doc still lands; in that
 * case we seed the same blank facets emptyCandidate() uses, so the console's readers never meet a
 * half-built document. An existing doc keeps every field it has — `updatedAt` included.
 */
async function mergeIntoCandidate(
  repo: string,
  branch: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const db = getFirestore();
  const ref = db.collection(PATHS.releaseCandidates).doc(candidateId(repo, branch));
  const snap = await ref.get();
  if (snap.exists) {
    await ref.set(patch, { merge: true });
    return;
  }
  await ref.set(
    {
      repo,
      branch,
      preview: { buildState: 'NONE' },
      devGate: { verdict: 'NONE' },
      prDev: { state: 'NONE' },
      prodGate: { verdict: 'NONE' },
      prProd: { state: 'NONE' },
      derivedStatus: 'NO_ACTION',
      reconcile: 'IN_SYNC',
      updatedAt: Date.now(),
      ...patch,
    },
    { merge: true },
  );
}

function guard(req: Request, res: Response): { repo: string; branch: string } | null {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return null;
  }
  if (!bearerOk(req.header('authorization'), CONSOLE_INGEST_TOKEN.value())) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return null;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const repo = str(body.repo, 100) ?? '';
  const branch = str(body.branch, 200) ?? '';
  if (!REPO_ALLOWLIST.has(repo)) {
    res.status(400).json({ ok: false, error: 'repo not allowed' });
    return null;
  }
  if (!branch) {
    res.status(400).json({ ok: false, error: 'invalid branch' });
    return null;
  }
  return { repo, branch };
}

// ===========================================================================
// recordBranchChannel — one call per environment, per run
// ===========================================================================
//
// Writes previewStatus.<env> plus the git/run context both legs share. Called with FAILED (and no
// url) when a channel could not be published, so the console shows a red channel rather than a
// stale green one from an older commit.

export const recordBranchChannel = onRequest(
  { region, secrets: [CONSOLE_INGEST_TOKEN], cors: false },
  async (req: Request, res: Response) => {
    const who = guard(req, res);
    if (!who) return;
    const { repo, branch } = who;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const env = str(body.env, 10);
    const status = str(body.status, 20);
    if (!env || !ENVS.has(env)) {
      res.status(400).json({ ok: false, error: "env must be 'dev' or 'prod'" });
      return;
    }
    if (!status || !CHANNEL_STATUSES.has(status)) {
      res.status(400).json({ ok: false, error: 'invalid status' });
      return;
    }

    const url = str(body.url, 300);
    if (url && !CHANNEL_URL_RE.test(url)) {
      res.status(400).json({ ok: false, error: 'invalid channel url' });
      return;
    }
    if (status === 'SUCCESS' && !url) {
      res.status(400).json({ ok: false, error: 'SUCCESS requires a url' });
      return;
    }

    const sha =
      typeof body.sha === 'string' && /^[0-9a-f]{40}$/i.test(body.sha) ? body.sha : undefined;
    const now = Date.now();

    const channel: Record<string, unknown> = {
      status,
      project: str(body.project, 100) ?? null,
      site: str(body.site, 100) ?? null,
      deployedAt: now,
      // A failed rebuild must not leave the previous run's link showing. Explicit null rather than
      // FieldValue.delete(): delete has awkward semantics inside a set(merge) that may also create
      // the doc, and null reads as falsy everywhere the UI tests for a URL.
      url: url ?? null,
    };
    const expiresAt = toMillis(body.expiresAt);
    if (expiresAt) channel.expiresAt = expiresAt;

    const patch: Record<string, unknown> = {
      previewStatus: {
        [env]: channel,
        sha: sha ?? null,
        commitMsg: str(body.commitMsg, 500) ?? null,
        author: str(body.author, 200) ?? null,
        runId: str(body.runId, 50) ?? null,
        runUrl: str(body.runUrl, 300) ?? null,
        updatedAt: now,
      },
    };

    try {
      await mergeIntoCandidate(repo, branch, patch);
      logger.info(`recordBranchChannel ${repo}/${branch} ${env}=${status}${url ? ` ${url}` : ''}`);
      res.status(200).json({ ok: true });
    } catch (err) {
      logger.error('recordBranchChannel failed', err);
      res.status(500).json({ ok: false, error: 'internal' });
    }
  },
);

// ===========================================================================
// recordSuiteStatus — the suite-alignment verdict for this commit
// ===========================================================================
//
// One call per run. `canProceed` is computed by scripts/readiness and stored as-is, so the UI —
// and later the Approve button — never re-implements the rules.

export const recordSuiteStatus = onRequest(
  { region, secrets: [CONSOLE_INGEST_TOKEN, GITHUB_APP_PRIVATE_KEY], cors: false },
  async (req: Request, res: Response) => {
    const who = guard(req, res);
    if (!who) return;
    const { repo, branch } = who;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const state = str(body.state, 40);
    if (!state || !SUITE_STATES.has(state)) {
      res.status(400).json({ ok: false, error: `invalid state: ${state ?? '(missing)'}` });
      return;
    }

    const sha =
      typeof body.sha === 'string' && /^[0-9a-f]{40}$/i.test(body.sha) ? body.sha : undefined;
    const rawDetails = (body.details ?? {}) as Record<string, unknown>;
    const list = (v: unknown, cap = 100): unknown[] => (Array.isArray(v) ? v.slice(0, cap) : []);

    const patch = {
      testSuiteStatus: {
        state,
        canProceed: body.canProceed === true,
        sha: sha ?? null,
        checkedAt: typeof body.checkedAt === 'number' ? body.checkedAt : Date.now(),
        runId: str(body.runId, 50) ?? null,
        runUrl: str(body.runUrl, 300) ?? null,
        suites: list(body.suites, 50),
        crossCutting: str(body.crossCutting, 300) ?? null,
        details: {
          uncovered: list(rawDetails.uncovered),
          fenced: list(rawDetails.fenced),
          // Dead code (manifest `retired.appPaths`). Never blocks — carried so the console can say
          // WHY a commit passed: "deprecated screen" must not read the same as "docs only".
          deprecated: list(rawDetails.deprecated),
          drift: list(rawDetails.drift),
          missingTestCases: list(rawDetails.missingTestCases),
          unhookedElements: list(rawDetails.unhookedElements),
          untestedComponents: list(rawDetails.untestedComponents),
          newComponents: list(rawDetails.newComponents),
        },
        // `run` and `recheck` are owned by later steps (the gate, and the console's Recheck button).
        // A fresh check must not erase them, so they are simply not written here.
      },
    };

    try {
      // Read the CURRENT run before overwriting the check, so the dispatcher can tell "already ran
      // for this sha" from "never ran". recordSuiteStatus never writes `run`, so this survives.
      const db = getFirestore();
      const snap = await db
        .collection(PATHS.releaseCandidates)
        .doc(candidateId(repo, branch))
        .get();
      const existingRunSha = (
        snap.data()?.testSuiteStatus as { run?: { sha?: string } } | undefined
      )?.run?.sha;

      await mergeIntoCandidate(repo, branch, patch);
      logger.info(
        `recordSuiteStatus ${repo}/${branch} → ${state} (canProceed=${body.canProceed === true})`,
      );

      // Green → run the suites. Never throws; a dispatch failure must not lose the verdict.
      const dispatched = await maybeDispatchSuites(
        repo,
        branch,
        state,
        patch.testSuiteStatus.suites as string[],
        sha,
        existingRunSha,
      );
      res.status(200).json({ ok: true, dispatched });
    } catch (err) {
      logger.error('recordSuiteStatus failed', err);
      res.status(500).json({ ok: false, error: 'internal' });
    }
  },
);

// ===========================================================================
// Dispatch the suites when the check goes green
// ===========================================================================
//
// WHY HERE and not in the workflow: `GITHUB_TOKEN` cannot start another workflow run — GitHub
// deliberately suppresses runs triggered by it, to stop recursion. The GitHub App can. This
// function already runs on every check, so it is the natural trigger, and the console's future
// Recheck button re-enters through the same path — one code path, not two.

/** Local Octokit — see the GITHUB_ORG note above for why this is not imported from index.ts. */
function appOctokit(): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: GITHUB_APP_ID,
      privateKey: GITHUB_APP_PRIVATE_KEY.value(),
      installationId: GITHUB_APP_INSTALLATION_ID,
    },
  });
}

/**
 * Fire `branch-suites.yml` for this branch, but only when running the suites is both meaningful
 * and not already done. Every guard here is a decision taken with the operator:
 *
 *   • state MUST be MATCHED — NOT_APPLICABLE also has canProceed:true but carries ZERO suites
 *     (docs/css/deprecated-only commits), and dispatching it would start a run with nothing to run.
 *   • suites MUST be non-empty — belt and braces on the same hole.
 *   • the sha MUST be new — a developer pushing ten times an hour must not launch ten matrices.
 *
 * NEVER throws: the alignment verdict is the valuable part of this request and must land even if
 * GitHub is down or the App is not configured. A failed dispatch is logged and the run simply is
 * not started — the console shows MATCHED with no run, which is honest.
 */
async function maybeDispatchSuites(
  repo: string,
  branch: string,
  state: string,
  suites: string[],
  sha: string | undefined,
  existingRunSha: string | undefined,
): Promise<boolean> {
  if (state !== 'MATCHED') return false;
  if (!suites.length) return false;
  if (sha && existingRunSha === sha) {
    logger.info(`suites already dispatched for ${repo}/${branch} @ ${sha.slice(0, 7)} — skipping`);
    return false;
  }
  if (GITHUB_APP_ID.startsWith('TODO') || !GITHUB_APP_PRIVATE_KEY.value()) {
    logger.warn('GitHub App not configured — cannot dispatch branch-suites.yml');
    return false;
  }
  try {
    await appOctokit().actions.createWorkflowDispatch({
      owner: GITHUB_ORG,
      repo,
      workflow_id: BRANCH_SUITES_WORKFLOW,
      ref: branch,
      inputs: { suites: JSON.stringify(suites), ref: branch },
    });
    logger.info(`dispatched ${BRANCH_SUITES_WORKFLOW} ${repo}/${branch} suites=${suites.join(',')}`);
    return true;
  } catch (err: unknown) {
    // Non-fatal by design — see the doc comment.
    logger.error('branch-suites dispatch failed (non-fatal)', err);
    return false;
  }
}

// ===========================================================================
// recordSuiteRun — the OUTCOME of the suites that recordSuiteStatus dispatched
// ===========================================================================
//
// Called by branch-suites.yml: once at the start (RUNNING) and once by the aggregation job at the
// end (PASSED/FAILED). PASSED means EVERY matrix leg passed — the workflow collapses the legs, so
// this endpoint stores a verdict rather than computing one.
//
// Writes ONLY testSuiteStatus.run. A later re-check overwrites `state`/`details` but never `run`
// (recordSuiteStatus does not write that key), so the two can interleave without clobbering.

export const recordSuiteRun = onRequest(
  { region, secrets: [CONSOLE_INGEST_TOKEN], cors: false },
  async (req: Request, res: Response) => {
    const who = guard(req, res);
    if (!who) return;
    const { repo, branch } = who;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const state = str(body.state, 20);
    if (!state || !RUN_STATES.has(state)) {
      res.status(400).json({ ok: false, error: `invalid run state: ${state ?? '(missing)'}` });
      return;
    }
    const sha =
      typeof body.sha === 'string' && /^[0-9a-f]{40}$/i.test(body.sha) ? body.sha : undefined;
    const num = (v: unknown): number | undefined =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
    const now = Date.now();

    const run: Record<string, unknown> = {
      state,
      sha: sha ?? null,
      reportRunId: str(body.reportRunId, 50) ?? null,
      runUrl: str(body.runUrl, 300) ?? null,
      suites: Array.isArray(body.suites) ? body.suites.slice(0, 50) : [],
    };
    if (state === 'RUNNING') run.startedAt = now;
    else run.finishedAt = now;
    const passed = num(body.passed);
    const failed = num(body.failed);
    const skipped = num(body.skipped);
    if (passed !== undefined) run.passed = passed;
    if (failed !== undefined) run.failed = failed;
    if (skipped !== undefined) run.skipped = skipped;

    try {
      await mergeIntoCandidate(repo, branch, { testSuiteStatus: { run } });
      logger.info(`recordSuiteRun ${repo}/${branch} → ${state}`);
      res.status(200).json({ ok: true });
    } catch (err) {
      logger.error('recordSuiteRun failed', err);
      res.status(500).json({ ok: false, error: 'internal' });
    }
  },
);
