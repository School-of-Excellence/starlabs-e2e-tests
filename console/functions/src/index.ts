/**
 * StarLabs release-console backend v2 (Firebase project: starlabs-cicd).
 *
 * GitHub is the source of truth. This backend MIRRORS GitHub via a webhook
 * receiver into a FACET model + flat ACTIVITY LOG, then DERIVES status by
 * projection (plan §3-5, D6/D7/D8). See
 * specs/plans/2026-06-22-console-v2-architecture.md.
 *
 * KEY DECISIONS honored here:
 *  - The console NEVER merges (D3). `approveAndMerge` + approver allowlist removed.
 *    Developers merge on GitHub; the `pull_request` closed+merged webhook detects it.
 *  - Preview deploy is MANUAL (D5): `deployPreview` → actions.createWorkflowDispatch.
 *  - Roles not flat allowlists (D1): gate callables via members/{email}.roles +
 *    hasCapability(). A legacy `allowlists` doc is recomputed by an onWrite trigger
 *    for back-compat only.
 *
 * Every place that needs a live credential is marked TODO (GitHub App secrets/ids).
 */

import {
  onRequest,
  onCall,
  HttpsError,
  CallableRequest,
  Request,
} from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import type { Response } from 'express';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
// OIDC verification of Pub/Sub push tokens (cfDeployEvent — lane-3 lock, 2026-07-03).
import { OAuth2Client } from 'google-auth-library';
import { getFirestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

import {
  ReleaseStatus,
  ReleaseCandidate,
  ActivityLogEntry,
  ActivityType,
  LastActivity,
  AllowlistConfig,
  Member,
  Role,
  Capability,
  TargetBranch,
  GateVerdict,
  ReleaseNote,
  PATHS,
  candidateId,
  hasCapability,
  isAllowedDomain,
  repoTypeOf,
  CF_ENV_BY_PROJECT,
  CfFunctionDoc,
  CfBranchDoc,
  computeCfMatrixState,
} from './model';
import { loadSuitesManifest, planSuites } from './suites';
import { mutateCandidate } from './candidate';
import { appendWebhookActivity, appendActivity } from './activity';

initializeApp();
const db = getFirestore();
// Optional facet fields (e.g. a sign-off has no commit SHA → lastActivity.sha is
// undefined) must not crash writes. Drop undefined values instead of throwing.
db.settings({ ignoreUndefinedProperties: true });

// ---------------------------------------------------------------------------
// Configuration / secrets
//   firebase functions:secrets:set GITHUB_WEBHOOK_SECRET --project starlabs-cicd
//   firebase functions:secrets:set GITHUB_APP_PRIVATE_KEY --project starlabs-cicd
// non-secret ids via .env.starlabs-cicd / process.env.
// ---------------------------------------------------------------------------

const GITHUB_WEBHOOK_SECRET = defineSecret('GITHUB_WEBHOOK_SECRET');
const GITHUB_APP_PRIVATE_KEY = defineSecret('GITHUB_APP_PRIVATE_KEY');
// Shared bearer token authenticating CI's preview-URL push (recordPreviewUrl). LOW-PRIVILEGE
// (only this endpoint, only writes preview.url) — NOT a service account. Rotate freely.
//   firebase functions:secrets:set CONSOLE_INGEST_TOKEN --project starlabs-cicd
const CONSOLE_INGEST_TOKEN = defineSecret('CONSOLE_INGEST_TOKEN');

const GITHUB_ORG = process.env.GITHUB_ORG ?? 'School-of-Excellence';
const GITHUB_APP_ID = process.env.GITHUB_APP_ID ?? 'TODO_APP_ID';
const GITHUB_APP_INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID ?? 'TODO_INSTALLATION_ID';

const region = 'us-central1';

/** Workflow file names (plan §7, D5/D10). */
const PREVIEW_WORKFLOW = 'preview.yml';
/** The preview-time test gate, dispatched alongside preview.yml on deploy (2026-06-29). */
const PREVIEW_E2E_WORKFLOW = 'preview-e2e.yml';
const DEPLOY_WORKFLOW = 'deploy_19.yml';
/** Workflow_run "name" substring that identifies the e2e gate run. */
const E2E_GATE_HINT = 'e2e';

// ---------------------------------------------------------------------------
// GitHub App client (acts AS THE APP — used ONLY for create-PR + dispatch, NOT merge)
// ---------------------------------------------------------------------------

function appOctokit(): Octokit {
  const privateKey = GITHUB_APP_PRIVATE_KEY.value();
  if (!privateKey || GITHUB_APP_ID.startsWith('TODO')) {
    throw new HttpsError(
      'failed-precondition',
      'GitHub App credentials not configured (GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY / GITHUB_APP_INSTALLATION_ID).',
    );
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: GITHUB_APP_ID,
      privateKey,
      installationId: GITHUB_APP_INSTALLATION_ID,
    },
  });
}

// ---------------------------------------------------------------------------
// Auth + role helpers (D1, D2)
// ---------------------------------------------------------------------------

interface Caller {
  uid: string;
  email: string | null;
}

/** Require an authenticated, allowed-domain Firebase caller. */
function requireAuth(req: CallableRequest): Caller {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'Sign in with Firebase Auth to use the console.');
  }
  const email = (req.auth.token.email as string | undefined) ?? null;
  if (!isAllowedDomain(email)) {
    throw new HttpsError('permission-denied', `Only @soexcellence.com accounts may use the console.`);
  }
  return { uid: req.auth.uid, email };
}

function callerLabel(caller: Caller): string {
  return caller.email ?? caller.uid;
}

/**
 * Canonical members doc reference: a top-level `CICD-Users` collection with one
 * document per member (id = lowercased email). The legacy single
 * `console-config/allowlists` doc is kept in sync via onMembersWrite. The frontend
 * reads the same `CICD-Users/{email}` path.
 */
function memberRef(emailLower: string) {
  return db.collection(PATHS.usersCol).doc(emailLower);
}

/** Gate a caller by capability; returns the loaded member on success. */
async function requireCapability(caller: Caller, cap: Capability): Promise<Member> {
  const member = await loadMemberCanonical(caller);
  if (!member.active) {
    throw new HttpsError('permission-denied', 'Your member record is inactive.');
  }
  if (!hasCapability(member.roles as Role[], cap)) {
    throw new HttpsError('permission-denied', `Your roles lack the ${cap} capability.`);
  }
  return member;
}

/** Load member from the canonical path; throws if absent. */
async function loadMemberCanonical(caller: Caller): Promise<Member> {
  const email = caller.email?.toLowerCase();
  if (!email) throw new HttpsError('permission-denied', 'No email on the auth token.');
  const snap = await memberRef(email).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', `No member record for ${email}. Ask an admin to add you.`);
  }
  return snap.data() as Member;
}

// ---------------------------------------------------------------------------
// Activity-log entry builder
// ---------------------------------------------------------------------------

function activityEntry(opts: {
  repo: string;
  branch: string;
  type: ActivityType;
  source: ActivityLogEntry['source'];
  confirmed: boolean;
  eventTime: number;
  sha?: string;
  actor?: string;
  detail?: Record<string, unknown>;
}): ActivityLogEntry {
  return {
    branchId: candidateId(opts.repo, opts.branch),
    type: opts.type,
    sha: opts.sha,
    actor: opts.actor,
    source: opts.source,
    confirmed: opts.confirmed,
    eventTime: opts.eventTime,
    receivedTime: Date.now(),
    detail: opts.detail,
  };
}

// ===========================================================================
// 1. webhookReceiver (HTTPS) — mirror GitHub into facets + activity log
// ===========================================================================

function verifyGithubSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function shortRepo(payload: any): string {
  return payload?.repository?.name ?? 'unknown-repo';
}

/** Parse an ISO/epoch timestamp to epoch millis, falling back to now. */
function toMillis(value: unknown): number {
  if (typeof value === 'number') return value > 1e12 ? value : value * 1000;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    if (!Number.isNaN(t)) return t;
  }
  return Date.now();
}

const PROTECTED: TargetBranch[] = ['development', 'production'];
function isProtected(branch: string): branch is TargetBranch {
  return branch === 'development' || branch === 'production';
}

export const webhookReceiver = onRequest(
  // GITHUB_APP_PRIVATE_KEY: CF-repo pushes mirror a cf-branches record (compare + branch manifest
  // via the GitHub API) — operator flow decision 2026-07-03.
  { region, secrets: [GITHUB_WEBHOOK_SECRET, GITHUB_APP_PRIVATE_KEY], cors: false },
  async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // (1) Verify HMAC over the RAW body.
    const secret = GITHUB_WEBHOOK_SECRET.value();
    const signature = req.header('x-hub-signature-256') ?? undefined;
    const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body) ?? '');
    if (!verifyGithubSignature(rawBody, signature, secret)) {
      logger.warn('Webhook signature verification failed');
      res.status(401).send('Invalid signature');
      return;
    }

    const event = req.header('x-github-event') ?? 'unknown';
    const deliveryId = req.header('x-github-delivery') ?? '';
    const payload = req.body ?? {};

    if (event === 'ping') {
      res.status(200).json({ ok: true, event });
      return;
    }
    if (!deliveryId) {
      logger.warn('Webhook missing X-GitHub-Delivery; cannot dedupe — rejecting');
      res.status(400).json({ ok: false, error: 'missing delivery id' });
      return;
    }

    try {
      const handled = await routeWebhook(event, deliveryId, payload);
      res.status(200).json({ ok: true, event, handled });
    } catch (err) {
      logger.error(`Error handling ${event}`, err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  },
);

/**
 * Route a verified webhook. Returns true if it produced an activity entry, false
 * if it was a duplicate delivery or an ignored event.
 *
 * Pattern for every handler: build the ActivityLogEntry, write it idempotently
 * keyed by deliveryId (dedupe gate). Only if the write WON do we mutate facets —
 * a duplicate delivery is a complete no-op.
 */
async function routeWebhook(event: string, deliveryId: string, payload: any): Promise<boolean> {
  switch (event) {
    case 'push':
      return handlePush(deliveryId, payload);
    case 'pull_request':
      return handlePullRequest(deliveryId, payload);
    case 'workflow_run':
      return handleWorkflowRun(deliveryId, payload);
    case 'deployment_status':
      return handleDeploymentStatus(deliveryId, payload);
    default:
      logger.info(`Ignoring unhandled event: ${event}`);
      return false;
  }
}

/**
 * push — a branch advanced. ALWAYS update headSha + headCommit and recompute
 * (the old scaffold no-op'd existing feature pushes; that hid PR drift — fixed).
 * Protected-branch pushes are merge landings; they are recorded via the
 * pull_request closed+merged event, so here we only refresh feature branches.
 */
async function handlePush(deliveryId: string, payload: any): Promise<boolean> {
  const repo = shortRepo(payload);
  const ref: string = payload.ref ?? '';
  const branch = ref.replace(/^refs\/heads\//, '');
  if (!branch) return false;

  const headSha: string | undefined = payload.after ?? payload.head_commit?.id ?? undefined;
  const headCommit = payload.head_commit ?? {};
  const author: string | undefined =
    headCommit.author?.username ?? headCommit.author?.name ?? payload.pusher?.name ?? undefined;
  const eventTime = toMillis(headCommit.timestamp);

  const entry = activityEntry({
    repo,
    branch,
    type: 'push',
    source: 'webhook',
    confirmed: true,
    eventTime,
    sha: headSha,
    actor: author,
    detail: { msg: headCommit.message, protected: isProtected(branch) },
  });
  const won = await appendWebhookActivity(deliveryId, entry);
  if (!won) return false;

  // Protected-branch pushes are handled by the PR merge event; do not synthesize
  // a feature candidate for them.
  if (isProtected(branch)) return true;

  await mutateCandidate(repo, branch, lastActivityFrom(entry), (c) => {
    c.headSha = headSha ?? c.headSha;
    c.headCommit = {
      msg: headCommit.message,
      author,
      at: eventTime,
    };
  });

  // CF repo: keep the Branches-tab record current on every push (operator flow, 2026-07-03).
  if (repoTypeOf(repo) === 'cloud-function') {
    if (payload.deleted === true) {
      await db.collection(PATHS.cfBranches).doc(candidateId(repo, branch)).delete().catch(() => undefined);
    } else {
      await upsertCfBranchRecord(repo, branch, Array.isArray(payload.commits) ? payload.commits : undefined);
    }
  }
  return true;
}

/**
 * pull_request — drive the prDev/prProd facets.
 *  opened/reopened/ready_for_review → facet OPEN {number,url,headSha,mergeable}
 *  synchronize (NEW)                 → update headSha + mergeable = PR DRIFT signal
 *  closed + merged                   → facet MERGED + dev_merged/prod_merged milestone
 */
async function handlePullRequest(deliveryId: string, payload: any): Promise<boolean> {
  const repo = shortRepo(payload);
  const action: string = payload.action ?? '';
  const pr = payload.pull_request ?? {};
  const base: string = pr.base?.ref ?? '';
  const head: string = pr.head?.ref ?? '';

  if (!isProtected(base)) {
    logger.info(`PR base ${base} not tracked; ignoring`);
    return false;
  }

  const isDev = base === 'development';
  const number: number | undefined = pr.number ?? undefined;
  const url: string | undefined = pr.html_url ?? undefined;
  const prHeadSha: string | undefined = pr.head?.sha ?? undefined;
  const mergeable: boolean | undefined = typeof pr.mergeable === 'boolean' ? pr.mergeable : undefined;
  const actor: string | undefined = pr.user?.login ?? payload.sender?.login ?? undefined;

  const OPEN_ACTIONS = ['opened', 'reopened', 'ready_for_review'];
  const isOpen = OPEN_ACTIONS.includes(action);
  const isSync = action === 'synchronize';
  const isMerged = action === 'closed' && pr.merged === true;
  const isClosedUnmerged = action === 'closed' && pr.merged !== true;

  if (!isOpen && !isSync && !isMerged && !isClosedUnmerged) {
    logger.info(`PR action ${action} — no facet change`);
    return false;
  }

  let type: ActivityType;
  if (isMerged) type = isDev ? 'dev_merged' : 'prod_merged';
  else type = isDev ? 'pr_to_dev' : 'pr_to_prod';

  const eventTime = toMillis(
    isMerged ? pr.merged_at : action === 'opened' ? pr.created_at : pr.updated_at,
  );

  const entry = activityEntry({
    repo,
    branch: head,
    type,
    source: 'webhook',
    confirmed: true,
    eventTime,
    sha: prHeadSha,
    actor,
    detail: { action, base, number, mergeable },
  });
  const won = await appendWebhookActivity(deliveryId, entry);
  if (!won) return false;

  await mutateCandidate(repo, head, lastActivityFrom(entry), (c) => {
    const facet = isDev ? c.prDev : c.prProd;
    if (isOpen) {
      facet.number = number;
      facet.url = url;
      facet.state = 'OPEN';
      facet.headSha = prHeadSha;
      facet.mergeable = mergeable;
    } else if (isSync) {
      // PR DRIFT: head advanced while the PR is open. Update head + mergeability;
      // the projection compares this against the gate sha → NEEDS_DECISION.
      facet.headSha = prHeadSha ?? facet.headSha;
      if (mergeable !== undefined) facet.mergeable = mergeable;
      if (facet.state === 'NONE') facet.state = 'OPEN';
    } else if (isMerged) {
      facet.number = number ?? facet.number;
      facet.url = url ?? facet.url;
      facet.state = 'MERGED';
      facet.headSha = prHeadSha ?? facet.headSha;
      // A feature merged into development joins the current promotion BATCH (D2) until the next
      // development→production release clears it.
      if (isDev) c.unreleased = true;
    } else if (isClosedUnmerged) {
      facet.state = 'CLOSED';
    }
  });

  // CF repo: reflect PR state on the Branches-tab record (operator flow, 2026-07-03).
  if (repoTypeOf(repo) === 'cloud-function' && isDev) {
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (isOpen && number && url) patch['pr'] = { number, url };
    if (isClosedUnmerged) patch['pr'] = null;
    if (isMerged) {
      patch['pr'] = null;
      patch['mergedToDev'] = true;
    }
    await db
      .collection(PATHS.cfBranches)
      .doc(candidateId(repo, head))
      .set(patch, { merge: true })
      .catch((e) => logger.error('cf-branches PR patch failed (non-fatal)', e));
  }

  // --- Promotion lane maintenance (promotion-chain plan 2026-06-24) ---
  // A feature merged INTO development → development now has unreleased changes. Create-PR-to-prod
  // still waits for the dev deploy to succeed (promotable is set in the deploy handler).
  if (isDev && isMerged) {
    await mutateCandidate(repo, 'development', lastActivityFrom(entry), (c) => {
      c.hasUnreleased = true;
    });
  }
  // A development → production PR: mirror it onto the production candidate (so the Production entry
  // shows it) and, once merged, clear development's unreleased/promotable flags (batch released).
  if (!isDev && head === 'development') {
    await mutateCandidate(repo, 'production', lastActivityFrom(entry), (c) => {
      c.prProd.number = number ?? c.prProd.number;
      c.prProd.url = url ?? c.prProd.url;
      c.prProd.headSha = prHeadSha ?? c.prProd.headSha;
      c.prProd.state = isMerged ? 'MERGED' : isOpen ? 'OPEN' : isClosedUnmerged ? 'CLOSED' : c.prProd.state;
    });
    if (isMerged) {
      await mutateCandidate(repo, 'development', lastActivityFrom(entry), (c) => {
        c.hasUnreleased = false;
        c.promotable = false;
        c.prodGate = { verdict: 'NONE' }; // released — the next batch needs a fresh tester validation
      });
      // The whole batch shipped to production: clear `unreleased` on every feature candidate for
      // this repo (D2 — "merged since last prod release" resets at each release).
      const feats = await db.collection(PATHS.releaseCandidates).where('repo', '==', repo).get();
      for (const d of feats.docs) {
        const fc = d.data() as ReleaseCandidate;
        if (!isProtected(fc.branch) && fc.unreleased) {
          await d.ref.set({ unreleased: false, updatedAt: Date.now() }, { merge: true });
        }
      }
    }
  }

  return true;
}

/**
 * workflow_run — three lanes keyed by workflow file / name (D10):
 *  preview.yml  → preview.buildState + builtAt + deterministic preview.url
 *  deploy_19.yml→ record deploy health on the candidate
 *  e2e gate     → testSummary { conclusion } from the run conclusion
 */
async function handleWorkflowRun(deliveryId: string, payload: any): Promise<boolean> {
  const repo = shortRepo(payload);
  const run = payload.workflow_run ?? {};
  const branch: string = run.head_branch ?? '';
  if (!branch) return false;

  const path: string = run.path ?? ''; // e.g. .github/workflows/preview.yml
  const file = path.split('/').pop() ?? '';
  const name: string = (run.name ?? '').toLowerCase();
  const status: string = run.status ?? ''; // queued | in_progress | completed
  const conclusion: string | undefined = run.conclusion ?? undefined; // success | failure | ...
  const headSha: string | undefined = run.head_sha ?? undefined;
  const eventTime = toMillis(run.updated_at ?? run.run_started_at ?? run.created_at);

  // Match by workflow FILE when the payload carries `workflow_run.path`; fall back to the workflow
  // display NAME when it doesn't. Some webhook payloads omit `path` → `file` is '' → a preview run
  // would otherwise be dropped as "not tracked" and preview.buildState stays stuck at BUILDING.
  const isPreview = file ? file === PREVIEW_WORKFLOW : name.includes('preview');
  const isDeploy = file ? file === DEPLOY_WORKFLOW : name.includes('deploy');
  const isGate = !isPreview && !isDeploy && name.includes(E2E_GATE_HINT);

  if (!isPreview && !isDeploy && !isGate) {
    logger.info(`workflow_run ${file || name} on ${repo}/${branch} — not a tracked lane`);
    return false;
  }

  let type: ActivityType = 'gate_run';
  if (isPreview) type = 'preview_build';
  else if (isDeploy) type = 'deploy_status';

  const entry = activityEntry({
    repo,
    branch,
    type,
    source: 'webhook',
    confirmed: true,
    eventTime,
    sha: headSha,
    actor: run.actor?.login,
    detail: { file, name, status, conclusion },
  });
  const won = await appendWebhookActivity(deliveryId, entry);
  if (!won) return false;

  // Protected-branch PREVIEW runs have no feature candidate; skip them. Deploy + gate runs DO get
  // recorded on the protected candidate: deploy → lastDeploymentState; gate → the dev→prod batch
  // gate shown on the Release Channel (2026-06-29).
  if (isProtected(branch) && !isDeploy && !isGate) return true;

  await mutateCandidate(repo, branch, lastActivityFrom(entry), (c) => {
    if (isPreview) {
      if (status === 'in_progress' || status === 'queued') {
        c.preview.buildState = 'BUILDING';
      } else if (status === 'completed') {
        c.preview.buildState = conclusion === 'success' ? 'LIVE' : 'FAILED';
        c.preview.builtAt = eventTime;
        // NOTE: preview.url is OWNED BY CI (preview.yml's record step writes the REAL hashed
        // channel URL directly to this doc). The function must NOT write a URL here — the old
        // deterministic reconstruction (breakthroughs-test-<branchid>) is hash-less and wrong,
        // and the completed-webhook lands AFTER CI's write, so it would clobber the real URL.
        // The UI falls back to previewUrlFor() when preview.url is empty. (2026-06-27)
      }
      c.preview.sha = headSha ?? c.preview.sha;
    } else if (isDeploy) {
      c.lastDeploymentState = status === 'completed' ? conclusion ?? 'unknown' : status;
      // A NEW successful development deploy invalidates any prior tester validation — the tester
      // must re-approve THIS deploy before it can be promoted ("after every deploy, tester says
      // okay"). `promotable` itself is DERIVED in mutateCandidate from (hasUnreleased + deploy
      // success + tester prodGate OK).
      if (branch === 'development' && status === 'completed' && conclusion === 'success') {
        c.prodGate = { verdict: 'NONE' };
      }
    } else if (isGate) {
      // Lifecycle status for the Working-Branches gate report.
      const gateStatus =
        status === 'queued'
          ? 'QUEUED'
          : status === 'in_progress'
            ? 'RUNNING'
            : conclusion === 'success'
              ? 'PASSED'
              : 'FAILED';
      // Stage = which lane this gate run validates. An OPEN PR → that PR's gate; otherwise this is the
      // PREVIEW-time gate (preview-e2e.yml, before any PR) — the report the tester reads at sign-off.
      const stage = c.prProd.state === 'OPEN' ? 'prod' : c.prDev.state === 'OPEN' ? 'dev' : 'preview';
      c.gateRun = {
        stage,
        status: gateStatus,
        runId: run.id !== undefined ? String(run.id) : undefined,
        runUrl: run.html_url ?? undefined,
        // The cicd-audit recorder stores this github run id, so the dashboard can
        // resolve the rich report by it (see scripts/history/record-run.cjs).
        reportRunId: run.id !== undefined ? String(run.id) : undefined,
        // Tie the report to the build it ran against (the preview SHA), so the UI can flag a report
        // as stale once a newer build is pushed.
        sha: headSha ?? c.preview.sha,
        at: eventTime,
      };
      if (status === 'completed') {
        c.testSummary = { conclusion: conclusion ?? 'unknown', at: eventTime };
      }
    }
  });
  return true;
}

/**
 * deployment_status — record the latest deploy state for ANY branch, INCLUDING the protected
 * environments (development → starlabs-test, production → fir-sample). This is essential for the
 * promotion lane: the Development entry's deploy badge + the tester's "OK to promote" gate key off
 * `lastDeploymentState`, and a dev deploy reached directly (a push straight to `development`, no
 * feature PR) may only ever surface here. Previously protected branches were skipped, so such
 * deploys were invisible and the promote button never appeared. (promotion-chain, 2026-06-25)
 */
async function handleDeploymentStatus(deliveryId: string, payload: any): Promise<boolean> {
  const repo = shortRepo(payload);
  const state: string = payload.deployment_status?.state ?? '';
  const branch: string = payload.deployment?.ref ?? payload.deployment?.environment ?? '';
  if (!branch) return false;

  const eventTime = toMillis(payload.deployment_status?.updated_at ?? payload.deployment_status?.created_at);
  const entry = activityEntry({
    repo,
    branch,
    type: 'deploy_status',
    source: 'webhook',
    confirmed: true,
    eventTime,
    detail: { state },
  });
  const won = await appendWebhookActivity(deliveryId, entry);
  if (!won) return false;

  await mutateCandidate(repo, branch, lastActivityFrom(entry), (c) => {
    c.lastDeploymentState = state;
    // A new SUCCESSFUL development deploy invalidates any prior tester validation — re-validate
    // before promoting ("after every deploy, tester says okay"). Mirrors the workflow_run path.
    if (branch === 'development' && state === 'success') {
      c.prodGate = { verdict: 'NONE' };
    }
  });
  return true;
}

/** Collapse an activity entry to the candidate's `lastActivity` shape. */
function lastActivityFrom(entry: ActivityLogEntry): LastActivity {
  return { type: entry.type, sha: entry.sha, actor: entry.actor, at: entry.eventTime };
}

// ---------------------------------------------------------------------------
// CF branch records (operator flow, 2026-07-03): `cf-branches/{repo__branch}` is the CF Board's
// Branches tab, MIRRORED on every CF push / PR webhook so the screen streams instantly. GitHub
// stays the truth — records are recomputed FROM it; listCfBranches is the ↻ heal/backfill.
// ---------------------------------------------------------------------------

async function computeCfBranchRecord(
  repo: string,
  branch: string,
): Promise<{ rec: CfBranchDoc; manifestFns: { name: string; type?: string; file?: string }[] }> {
  const octokit = appOctokit();
  // BASELINE = development (operator, 2026-07-03): the CF repo has NO production branch by design —
  // branches merge into development; "what's in production" is the Functions matrix's job (the
  // deployed flags), not a git compare. One compare serves both Δfunctions and merged state.
  const [cmpDev, br] = await Promise.all([
    octokit.repos.compareCommitsWithBasehead({ owner: GITHUB_ORG, repo, basehead: `development...${branch}` }),
    octokit.repos.getBranch({ owner: GITHUB_ORG, repo, branch }),
  ]);

  // The branch's committed functions-manifest.json → function names + trigger types (L19).
  let manifestFns: { name: string; type?: string; file?: string }[] = [];
  try {
    const content = await octokit.repos.getContent({ owner: GITHUB_ORG, repo, path: 'functions-manifest.json', ref: branch });
    if (!Array.isArray(content.data) && content.data.type === 'file' && 'content' in content.data) {
      manifestFns = JSON.parse(Buffer.from(content.data.content, 'base64').toString('utf8'))?.functions ?? [];
    }
  } catch {
    /* branch predates the manifest — file-level fallback below */
  }

  const changedFunctions: { name: string; type: string; change: string }[] = [];
  const seen = new Set<string>();
  for (const f of cmpDev.data.files ?? []) {
    if (!f.filename.startsWith('functions/')) continue;
    const rel = f.filename.replace(/^functions\//, '');
    const change = f.status === 'added' ? 'NEW' : f.status === 'removed' ? 'DELETED' : 'UPDATED';
    const hits = manifestFns.filter((m) => m.file === rel || m.file === f.filename);
    if (hits.length === 0) {
      const label = rel.split('/').pop() ?? rel;
      if (!seen.has(label)) { seen.add(label); changedFunctions.push({ name: label, type: 'file', change }); }
    } else {
      for (const m of hits) {
        if (!seen.has(m.name)) { seen.add(m.name); changedFunctions.push({ name: m.name, type: m.type ?? 'unknown', change }); }
      }
    }
  }

  const commit = br.data.commit;
  const rec: CfBranchDoc = {
    repo,
    branch,
    headSha: commit?.sha,
    lastCommit: {
      sha: commit?.sha,
      msg: commit?.commit?.message?.split('\n')[0],
      author: commit?.commit?.author?.email ?? commit?.commit?.author?.name ?? undefined,
      at: commit?.commit?.author?.date ? Date.parse(commit.commit.author.date) : undefined,
    },
    aheadOfDev: cmpDev.data.ahead_by ?? 0,
    changedFunctions,
    mergedToDev: (cmpDev.data.ahead_by ?? 0) === 0,
    updatedAt: Date.now(),
  };
  return { rec, manifestFns };
}

/** Raw commit shape from the GitHub push-webhook payload. */
interface PushCommit {
  id?: string;
  message?: string;
  timestamp?: string;
  author?: { email?: string; name?: string };
  added?: string[];
  modified?: string[];
  removed?: string[];
}

/**
 * Best-effort mirror write — a GitHub hiccup must never fail the webhook. Preserves `pr` (merge).
 * When the push payload's commits are supplied, appends them to the branch's COMMIT LOG with the
 * CF names each commit touched (newest first, capped 20 — lane-3 scenario lock, 2026-07-03).
 */
async function upsertCfBranchRecord(repo: string, branch: string, pushCommits?: PushCommit[]): Promise<void> {
  try {
    const { rec, manifestFns } = await computeCfBranchRecord(repo, branch);
    const ref = db.collection(PATHS.cfBranches).doc(candidateId(repo, branch));

    if (pushCommits?.length) {
      const namesForFiles = (files: string[]): string[] => {
        const names = new Set<string>();
        for (const f of files) {
          if (!f.startsWith('functions/')) continue;
          const rel = f.replace(/^functions\//, '');
          const hits = manifestFns.filter((m) => m.file === rel || m.file === f);
          if (hits.length) hits.forEach((h) => names.add(h.name));
          else names.add(rel.split('/').pop() ?? rel);
        }
        return [...names];
      };
      const fresh = pushCommits
        .filter((c) => c.id)
        .map((c) => ({
          sha: c.id!,
          msg: (c.message ?? '').split('\n')[0],
          author: c.author?.email ?? c.author?.name,
          at: c.timestamp ? Date.parse(c.timestamp) : undefined,
          changedFunctions: namesForFiles([...(c.added ?? []), ...(c.modified ?? []), ...(c.removed ?? [])]),
        }))
        .reverse(); // payload is oldest→newest; the log is newest first
      const prev = ((await ref.get()).data() as CfBranchDoc | undefined)?.commits ?? [];
      const seen = new Set(fresh.map((c) => c.sha));
      rec.commits = [...fresh, ...prev.filter((c) => !seen.has(c.sha))].slice(0, 20);
    }

    await ref.set(rec, { merge: true });
  } catch (e) {
    logger.error(`cf-branches mirror failed for ${repo}/${branch} (non-fatal)`, e);
  }
}

// ===========================================================================
// 2. deployPreview (callable) — MANUAL preview build via workflow_dispatch (D5)
// ===========================================================================

interface DeployPreviewData {
  repo: string;
  branch: string;
  /**
   * Test orchestration (plan L5, 2026-07-02). runTests=false → "Deploy without tests" (preview only).
   * runTests=true (or omitted — backward compatible) → also dispatch the gate; `suites` (validated
   * against the manifest by the DIALOG's planTestRun call) + the CF source ride along as inputs.
   */
  runTests?: boolean;
  suites?: string[];
  cfRepo?: string;
  cfBranch?: string;
}

export const deployPreview = onCall<DeployPreviewData>(
  { region, secrets: [GITHUB_APP_PRIVATE_KEY] },
  async (req: CallableRequest<DeployPreviewData>) => {
    const caller = requireAuth(req);
    const { repo, branch, runTests, suites, cfRepo, cfBranch } = req.data ?? ({} as DeployPreviewData);
    if (!repo || !branch) throw new HttpsError('invalid-argument', 'repo and branch are required.');

    await requireCapability(caller, 'DEPLOY_PREVIEW');

    const octokit = appOctokit();
    try {
      await octokit.actions.createWorkflowDispatch({
        owner: GITHUB_ORG,
        repo,
        workflow_id: PREVIEW_WORKFLOW,
        ref: branch,
        // preview.yml declares `inputs.ref` as REQUIRED — must be sent or GitHub
        // rejects the dispatch with 422 "required input not provided".
        inputs: { ref: branch },
      });
    } catch (err: any) {
      logger.error('workflow_dispatch (preview) failed', err);
      throw new HttpsError('internal', `Preview dispatch failed: ${err?.message ?? err}`);
    }

    // Fire the preview-time TEST GATE alongside the build — UNLESS the developer chose
    // "Deploy without tests" (plan L5). One deploy ⇒ two runs (preview.yml + preview-e2e.yml).
    // When the dialog supplied an explicit suite list + CF source, they ride along as dispatch
    // inputs (JSON array, plan L2) and the gate runs a matrix over them; with no inputs the gate
    // falls back to its own manifest path-routing. Best-effort — a gate-dispatch hiccup must NOT
    // fail the preview build.
    if (runTests !== false) {
      const gateInputs: Record<string, string> = {};
      if (Array.isArray(suites) && suites.length > 0) gateInputs.suites = JSON.stringify(suites);
      if (cfRepo) gateInputs.cf_repo = cfRepo;
      if (cfBranch) gateInputs.cf_branch = cfBranch;
      try {
        await octokit.actions.createWorkflowDispatch({
          owner: GITHUB_ORG,
          repo,
          workflow_id: PREVIEW_E2E_WORKFLOW,
          ref: branch,
          ...(Object.keys(gateInputs).length ? { inputs: gateInputs } : {}),
        });
      } catch (err: any) {
        // An OLD preview-e2e.yml on this ref may not declare the new inputs (422). Retry bare so
        // the fallback path-routing still runs rather than silently skipping the gate.
        if (Object.keys(gateInputs).length && /unexpected inputs/i.test(String(err?.message ?? ''))) {
          logger.warn('preview-e2e on this ref predates the suites inputs — retrying dispatch without inputs');
          try {
            await octokit.actions.createWorkflowDispatch({
              owner: GITHUB_ORG,
              repo,
              workflow_id: PREVIEW_E2E_WORKFLOW,
              ref: branch,
            });
          } catch (err2: any) {
            logger.error('workflow_dispatch (preview-e2e gate, bare retry) failed — preview build continues', err2);
          }
        } else {
          logger.error('workflow_dispatch (preview-e2e gate) failed — preview build continues', err);
        }
      }
    }

    // Optimistic intent (confirmed:false until the workflow_run webhook confirms).
    const entry = activityEntry({
      repo,
      branch,
      type: 'preview_dispatch',
      source: 'console',
      confirmed: false,
      eventTime: Date.now(),
      actor: callerLabel(caller),
      detail: {
        runTests: runTests !== false,
        ...(Array.isArray(suites) && suites.length ? { suites } : {}),
        ...(cfRepo ? { cfRepo } : {}),
        ...(cfBranch ? { cfBranch } : {}),
      },
    });
    await appendActivity(entry);
    await mutateCandidate(repo, branch, lastActivityFrom(entry), (c) => {
      c.preview.buildState = 'BUILDING';
    });

    logger.info(`deployPreview dispatched ${repo}/${branch} by ${callerLabel(caller)}`);
    return { ok: true };
  },
);

// ===========================================================================
// 3. signoff (callable) — the ONLY manual gate writer (replaces setOkToRelease)
// ===========================================================================

interface SignoffData {
  repo: string;
  branch: string;
  stage: 'dev' | 'prod';
  verdict: 'OK' | 'REJECTED';
  note?: string;
}

export const signoff = onCall<SignoffData>(
  { region },
  async (req: CallableRequest<SignoffData>) => {
    const caller = requireAuth(req);
    const { repo, branch, stage, verdict, note } = req.data ?? ({} as SignoffData);
    if (!repo || !branch || !stage || !verdict) {
      throw new HttpsError('invalid-argument', 'repo, branch, stage and verdict are required.');
    }
    if (stage !== 'dev' && stage !== 'prod') {
      throw new HttpsError('invalid-argument', "stage must be 'dev' or 'prod'.");
    }
    if (verdict !== 'OK' && verdict !== 'REJECTED') {
      throw new HttpsError('invalid-argument', "verdict must be 'OK' or 'REJECTED'.");
    }

    const cap: Capability = stage === 'dev' ? 'SIGNOFF_PREVIEW_DEV' : 'SIGNOFF_DEV_PROD';
    await requireCapability(caller, cap);

    const label = callerLabel(caller);
    const newNote: ReleaseNote | undefined = note
      ? { authorUid: caller.uid, authorLabel: label, text: note, at: Date.now() }
      : undefined;

    const entry = activityEntry({
      repo,
      branch,
      type: stage === 'dev' ? 'signoff_dev' : 'signoff_prod',
      source: 'console',
      confirmed: true,
      eventTime: Date.now(),
      actor: label,
      detail: { verdict, stage },
    });
    await appendActivity(entry);

    const written = await mutateCandidate(repo, branch, lastActivityFrom(entry), (c) => {
      const gate = stage === 'dev' ? c.devGate : c.prodGate;
      gate.verdict = verdict as GateVerdict;
      gate.sha = c.headSha; // sign-off is bound to the CURRENT head (freshness anchor)
      gate.by = label;
      gate.at = Date.now();
      if (newNote) gate.notes = [...(gate.notes ?? []), newNote];
    });

    logger.info(`signoff ${stage}=${verdict} on ${repo}/${branch} by ${label}`);
    return { ok: true, derivedStatus: written.derivedStatus, reconcile: written.reconcile };
  },
);

// ===========================================================================
// 4. createPullRequest (callable) — open a PR AS THE APP, with a state check
// ===========================================================================

interface CreatePullRequestData {
  repo: string;
  head: string;
  base: TargetBranch;
  title?: string;
  body?: string;
}

export const createPullRequest = onCall<CreatePullRequestData>(
  { region, secrets: [GITHUB_APP_PRIVATE_KEY] },
  async (req: CallableRequest<CreatePullRequestData>) => {
    const caller = requireAuth(req);
    const { repo, head, base, title, body } = req.data ?? ({} as CreatePullRequestData);
    if (!repo || !head || !base) {
      throw new HttpsError('invalid-argument', 'repo, head and base are required.');
    }
    if (!PROTECTED.includes(base)) {
      throw new HttpsError('invalid-argument', `base must be one of ${PROTECTED.join(', ')}.`);
    }

    const cap: Capability = base === 'development' ? 'CREATE_PR_DEV' : 'CREATE_PR_PROD';
    await requireCapability(caller, cap);

    // SERVER-SIDE STATE CHECK (plan §7): the UI gates too, but the server is the
    // real fence. Load the candidate and enforce the lifecycle precondition.
    //
    // CF-TYPE REPOS ARE EXEMPT (plan L18, locked 2026-07-02): the CF flow has no tester-gate
    // stage — its quality gate is the LOCAL predeploy loop-guard, which already ran before the
    // code reached starlabs-test. Precondition for CF = "branch pushed + not merged", which
    // GitHub itself enforces (unknown head / no-commits errors below). CF Board branches also
    // have no release-candidate doc, so the candidate load must not 404 them.
    let cand: ReleaseCandidate | undefined;
    if (repoTypeOf(repo) !== 'cloud-function') {
      const snap = await db
        .collection(PATHS.releaseCandidates)
        .doc(candidateId(repo, head))
        .get();
      if (!snap.exists) {
        throw new HttpsError('failed-precondition', `No candidate for ${repo}/${head}.`);
      }
      cand = snap.data() as ReleaseCandidate;

      if (base === 'development') {
        if (cand.derivedStatus !== ReleaseStatus.OK_FOR_DEV) {
          throw new HttpsError(
            'failed-precondition',
            `Dev PR requires status OK_FOR_DEV (got ${cand.derivedStatus}).`,
          );
        }
        // Freshness: the dev sign-off must cover the current head.
        if (cand.devGate.sha && cand.headSha && cand.devGate.sha !== cand.headSha) {
          throw new HttpsError(
            'failed-precondition',
            'Dev sign-off is stale (new commits since sign-off). Re-request QA.',
          );
        }
      } else {
        // Promotion (development → production): head is the `development` branch, so `cand` is the
        // development candidate. It is promotable only after a feature merged in (hasUnreleased) AND
        // its dev deploy succeeded — promotion-chain plan 2026-06-24 ("deploy then promote").
        if (!cand.promotable) {
          throw new HttpsError(
            'failed-precondition',
            'Development is not ready to promote — it needs unreleased changes with a successful dev deploy.',
          );
        }
      }
    }

    const octokit = appOctokit();
    let pr;
    try {
      const resp = await octokit.pulls.create({
        owner: GITHUB_ORG,
        repo,
        head,
        base,
        title: title ?? `Release: ${head} → ${base}`,
        body: body ?? `Opened via the StarLabs release console by ${callerLabel(caller)}. (Console does NOT merge — please review and merge on GitHub.)`,
      });
      pr = resp.data;
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      logger.error('GitHub PR create failed', err);
      // GitHub rejects a PR with no diff ("No commits between X and Y"). Rewrite to actionable text.
      if (/no commits between/i.test(msg)) {
        throw new HttpsError(
          'failed-precondition',
          base === 'production'
            ? 'Nothing to promote — development has no commits ahead of production.'
            : 'No new commits ahead of development. Sync your branch with development, commit your changes, and push before opening a PR → dev.',
        );
      }
      throw new HttpsError('internal', `GitHub PR create failed: ${msg}`);
    }

    const isDev = base === 'development';
    const entry = activityEntry({
      repo,
      branch: head,
      type: isDev ? 'pr_to_dev' : 'pr_to_prod',
      source: 'console',
      confirmed: false, // the pull_request webhook will confirm
      eventTime: Date.now(),
      sha: cand?.headSha ?? pr.head?.sha,
      actor: callerLabel(caller),
      detail: { base, number: pr.number },
    });
    await appendActivity(entry);
    await mutateCandidate(repo, head, lastActivityFrom(entry), (c) => {
      const facet = isDev ? c.prDev : c.prProd;
      facet.number = pr.number;
      facet.url = pr.html_url;
      facet.state = 'OPEN';
      facet.headSha = cand?.headSha ?? pr.head?.sha;
    });

    logger.info(`PR created ${repo} ${head}→${base} #${pr.number} by ${callerLabel(caller)}`);
    return { ok: true, prNumber: pr.number, prUrl: pr.html_url };
  },
);

// ===========================================================================
// 5. setMember (callable) — admin-only member management (D1)
// ===========================================================================

interface SetMemberData {
  email: string;
  displayName?: string;
  roles: Role[];
  active: boolean;
}

export const setMember = onCall<SetMemberData>(
  { region },
  async (req: CallableRequest<SetMemberData>) => {
    const caller = requireAuth(req);
    const { email, displayName, roles, active } = req.data ?? ({} as SetMemberData);
    if (!email || !Array.isArray(roles)) {
      throw new HttpsError('invalid-argument', 'email and roles[] are required.');
    }
    if (!isAllowedDomain(email)) {
      throw new HttpsError('invalid-argument', `Member email must be @soexcellence.com.`);
    }
    const validRoles: Role[] = ['developer', 'tester', 'admin'];
    for (const r of roles) {
      if (!validRoles.includes(r)) throw new HttpsError('invalid-argument', `Unknown role: ${r}`);
    }

    await requireCapability(caller, 'MANAGE_MEMBERS');

    const emailLower = email.toLowerCase();
    const member: Member = {
      email: emailLower,
      displayName,
      roles,
      active: active !== false,
      addedBy: callerLabel(caller),
      addedAt: Date.now(),
    };
    // Drop undefined displayName (Firestore rejects undefined).
    const toWrite: Record<string, unknown> = { ...member };
    if (toWrite.displayName === undefined) delete toWrite.displayName;
    await memberRef(emailLower).set(toWrite, { merge: true });

    await appendActivity({
      branchId: 'CICD-Users',
      type: 'member_change',
      source: 'console',
      confirmed: true,
      eventTime: Date.now(),
      receivedTime: Date.now(),
      actor: callerLabel(caller),
      detail: { email: emailLower, roles, active: member.active },
    });

    logger.info(`setMember ${emailLower} roles=${roles.join(',')} active=${member.active} by ${callerLabel(caller)}`);
    return { ok: true };
  },
);

// ===========================================================================
// 6. reconcileDecision (callable) — record + apply a human drift decision (§5)
// ===========================================================================

type ReconcileChoice = 're-request-qa' | 'accept' | 'close-restart' | 'investigate';

interface ReconcileDecisionData {
  repo: string;
  branch: string;
  decision: ReconcileChoice;
  /** Which gate the decision targets (for re-request-qa). */
  stage?: 'dev' | 'prod';
  reason?: string;
}

export const reconcileDecision = onCall<ReconcileDecisionData>(
  { region },
  async (req: CallableRequest<ReconcileDecisionData>) => {
    const caller = requireAuth(req);
    const { repo, branch, decision, stage, reason } = req.data ?? ({} as ReconcileDecisionData);
    if (!repo || !branch || !decision) {
      throw new HttpsError('invalid-argument', 'repo, branch and decision are required.');
    }
    // Any active member may record a decision; capability-specific effects could
    // be tightened later. Confirm membership.
    await loadMemberCanonical(caller);

    const label = callerLabel(caller);
    const entry = activityEntry({
      repo,
      branch,
      type: 'reconcile_decision',
      source: 'reconcile',
      confirmed: true,
      eventTime: Date.now(),
      actor: label,
      detail: { decision, stage, reason },
    });
    await appendActivity(entry);

    const written = await mutateCandidate(repo, branch, lastActivityFrom(entry), (c) => {
      switch (decision) {
        case 're-request-qa': {
          // Reset the relevant gate verdict to NONE → re-opens the tester gate.
          const gate = stage === 'prod' ? c.prodGate : c.devGate;
          gate.verdict = 'NONE';
          gate.sha = undefined;
          gate.by = undefined;
          gate.at = undefined;
          break;
        }
        case 'close-restart': {
          // Mark the open PR facet CLOSED; the dev still closes it on GitHub.
          if (c.prProd.state === 'OPEN') c.prProd.state = 'CLOSED';
          else if (c.prDev.state === 'OPEN') c.prDev.state = 'CLOSED';
          break;
        }
        case 'accept':
        case 'investigate':
        default:
          // 'accept' clears the flag by virtue of the projection re-running with
          // no offending drift; we additionally pin reconcile to IN_SYNC below.
          break;
      }
    });

    // 'accept' is an explicit override: force the flag green after the decision.
    if (decision === 'accept') {
      await db
        .collection(PATHS.releaseCandidates)
        .doc(candidateId(repo, branch))
        .set({ reconcile: 'IN_SYNC', updatedAt: Date.now() }, { merge: true });
    }

    logger.info(`reconcileDecision ${decision} on ${repo}/${branch} by ${label}`);
    return { ok: true, derivedStatus: written.derivedStatus, reconcile: written.reconcile };
  },
);

// ===========================================================================
// 6b. Test orchestration + CF rollout (master plan 2026-07-02)
// ===========================================================================

// --- planTestRun (callable) — compute the Test Run dialog's suite plan (L5) --------------------
//
// Diffs the branch against `development` (GitHub compare) and matches the changed files against
// the mirrored suites manifest: matched suites are MANDATORY (with the matching glob as the
// human-readable reason); the rest of the CI-ready catalogue is optional. Protected branches
// (development/production — the Release Channel "system test") have no diff basis: nothing is
// mandatory, the full catalogue is offered.

interface PlanTestRunData {
  repo: string;
  branch: string;
}

export const planTestRun = onCall<PlanTestRunData>(
  { region, secrets: [GITHUB_APP_PRIVATE_KEY] },
  async (req: CallableRequest<PlanTestRunData>) => {
    const caller = requireAuth(req);
    await loadMemberCanonical(caller); // any ACTIVE member may plan (read-only)
    const { repo, branch } = req.data ?? ({} as PlanTestRunData);
    if (!repo || !branch) throw new HttpsError('invalid-argument', 'repo and branch are required.');

    const manifest = await loadSuitesManifest();
    if (!manifest) {
      throw new HttpsError(
        'failed-precondition',
        'Suites manifest mirror is empty — merge suites-manifest.json to hub main (suites-deploy workflow) first.',
      );
    }

    let changed: string[] = [];
    if (!isProtected(branch)) {
      try {
        const cmp = await appOctokit().repos.compareCommitsWithBasehead({
          owner: GITHUB_ORG,
          repo,
          basehead: `development...${branch}`,
        });
        changed = (cmp.data.files ?? []).map((f) => f.filename);
      } catch (err: any) {
        logger.error(`planTestRun compare failed for ${repo}/${branch}`, err);
        throw new HttpsError('internal', `Could not diff ${branch} against development: ${err?.message ?? err}`);
      }
    }

    const plan = planSuites(manifest, changed, repoTypeOf(repo));
    logger.info(
      `planTestRun ${repo}/${branch}: ${plan.mandatory.length} mandatory, ${plan.optional.length} optional` +
        `${plan.crossCutting ? ' (cross-cutting)' : ''} from ${plan.changedFileCount} changed files`,
    );
    return { ok: true, ...plan };
  },
);

// --- runTests (callable) — test-only gate dispatch, any card, any time (L6) --------------------

interface RunTestsData {
  repo: string;
  branch: string;
  suites: string[];
  cfRepo?: string;
  cfBranch?: string;
}

export const runTests = onCall<RunTestsData>(
  { region, secrets: [GITHUB_APP_PRIVATE_KEY] },
  async (req: CallableRequest<RunTestsData>) => {
    const caller = requireAuth(req);
    // Any ACTIVE member may run tests (developer on Working Branches, tester on Preview
    // Channels, admin on the Release Channel) — the run is read-only w.r.t. workflow state.
    await loadMemberCanonical(caller);
    const { repo, branch, suites, cfRepo, cfBranch } = req.data ?? ({} as RunTestsData);
    if (!repo || !branch) throw new HttpsError('invalid-argument', 'repo and branch are required.');
    // CF repos have NO gate workflow of their own (plan L13 — their gate is the local predeploy
    // guard). A CF change is tested through the ANGULAR suites: open the Test Run dialog on an
    // Angular card and pick the CF branch as the CF source (the emulator then runs THAT CF code).
    if (repoTypeOf(repo) === 'cloud-function') {
      throw new HttpsError(
        'failed-precondition',
        `${repo} has no test workflow — test a CF branch by running the Angular suites with it: ` +
          `Test Run dialog → CF source → branch "${branch}".`,
      );
    }
    if (!Array.isArray(suites) || suites.length === 0 || suites.some((s) => typeof s !== 'string')) {
      throw new HttpsError('invalid-argument', 'suites must be a non-empty string array.');
    }

    const manifest = await loadSuitesManifest();
    if (manifest) {
      for (const s of suites) {
        const def = manifest.suites[s];
        if (!def) throw new HttpsError('invalid-argument', `Unknown suite: ${s}`);
        if (!def.ciReady) throw new HttpsError('invalid-argument', `Suite ${s} is not CI-ready (local-only).`);
      }
    }

    const octokit = appOctokit();
    try {
      await octokit.actions.createWorkflowDispatch({
        owner: GITHUB_ORG,
        repo,
        workflow_id: PREVIEW_E2E_WORKFLOW,
        ref: branch,
        inputs: {
          suites: JSON.stringify(suites),
          cf_repo: cfRepo ?? 'starlabs-cloud-function',
          cf_branch: cfBranch ?? 'development',
        },
      });
    } catch (err: any) {
      logger.error(`runTests dispatch failed for ${repo}/${branch}`, err);
      throw new HttpsError('internal', `Test dispatch failed: ${err?.message ?? err}`);
    }

    const entry = activityEntry({
      repo,
      branch,
      type: 'test_dispatch',
      source: 'console',
      confirmed: false, // the workflow_run webhook confirms
      eventTime: Date.now(),
      actor: callerLabel(caller),
      detail: { suites, cfRepo: cfRepo ?? 'starlabs-cloud-function', cfBranch: cfBranch ?? 'development', mode: 'test-only' },
    });
    await appendActivity(entry);
    await mutateCandidate(repo, branch, lastActivityFrom(entry), (c) => {
      c.gateRun = {
        ...(c.gateRun ?? {}),
        status: 'QUEUED',
        at: Date.now(),
        sha: c.headSha ?? c.gateRun?.sha,
      };
    });

    logger.info(`runTests ${repo}/${branch} suites=[${suites.join(',')}] by ${callerLabel(caller)}`);
    return { ok: true };
  },
);

// --- recordSuitesManifest (HTTPS) — the ONE-WAY manifest mirror target (L1) --------------------
//
// hub@main's mirror-suites.yml POSTs suites-manifest.json here on every merge that touches it.
// git is the truth; this endpoint OVERWRITES console-config/suites (the read-only copy the
// console dialog reads). Bearer = CONSOLE_INGEST_TOKEN (same low-privilege pattern as
// recordPreviewUrl). Clients can never write this doc (rules: write false).

export const recordSuitesManifest = onRequest(
  { region, secrets: [CONSOLE_INGEST_TOKEN], cors: false },
  async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    if (!bearerOk(req.header('authorization'), CONSOLE_INGEST_TOKEN.value())) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const suites = body.suites as Record<string, unknown> | undefined;
    if (typeof body.version !== 'number' || !suites || typeof suites !== 'object' || Object.keys(suites).length === 0) {
      res.status(400).json({ ok: false, error: 'not a suites manifest (need version + suites{})' });
      return;
    }
    try {
      const now = Date.now();
      // ONE DOC PER SUITE + slim meta doc (lane-1 lock, 2026-07-03). Full-replace set (no merge):
      // git is the truth, so removed fields/suites must disappear here too.
      const entries = Object.entries(suites);
      const existing = await db.collection(PATHS.testSuites).get();
      const batch = db.batch();
      for (const [key, def] of entries) {
        batch.set(db.collection(PATHS.testSuites).doc(key), {
          key,
          ...(def as Record<string, unknown>),
          updatedAt: now,
        });
      }
      const live = new Set(entries.map(([k]) => k));
      for (const d of existing.docs) {
        if (!live.has(d.id)) batch.delete(d.ref);
      }
      batch.set(db.collection(PATHS.consoleConfig).doc(PATHS.suitesDoc), {
        version: body.version,
        crossCutting: body.crossCutting ?? null,
        cfPredeploy: body.cfPredeploy ?? null,
        mirroredAt: now,
        source: 'hub@main',
      });
      await batch.commit();
      await appendActivity({
        branchId: 'console-config',
        type: 'suites_mirror',
        source: 'webhook',
        confirmed: true,
        eventTime: now,
        receivedTime: now,
        actor: 'hub-ci',
        detail: { version: body.version, suiteCount: Object.keys(suites).length },
      });
      logger.info(`recordSuitesManifest: mirrored ${Object.keys(suites).length} suites (v${body.version})`);
      res.status(200).json({ ok: true, suites: Object.keys(suites).length });
    } catch (err) {
      logger.error('recordSuitesManifest failed', err);
      res.status(500).json({ ok: false, error: 'internal' });
    }
  },
);

// --- recordCfDeploy (HTTPS) — the CF postdeploy hook's target (L15) ----------------------------
//
// Fires on EVERY `firebase deploy` of the CF repo — manual laptop deploys included — which is
// exactly what makes "deployed but not pushed" visible. Upserts one cf-functions/{name} doc per
// function with the env column derived from the target project (L16). The audit-log push
// receiver (cfDeployEvent, below) confirms/flips the deployed flags for anything that skips
// this hook — deletes included.

interface CfDeployBody {
  repo?: string;
  project?: string;
  branch?: string;
  sha?: string;
  by?: string;
  functions?: { name?: string; type?: string; file?: string; codebase?: string }[];
}

export const recordCfDeploy = onRequest(
  { region, secrets: [CONSOLE_INGEST_TOKEN], cors: false },
  async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    if (!bearerOk(req.header('authorization'), CONSOLE_INGEST_TOKEN.value())) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as CfDeployBody;
    const repo = typeof body.repo === 'string' ? body.repo.trim() : '';
    const project = typeof body.project === 'string' ? body.project.trim() : '';
    const branch = typeof body.branch === 'string' ? body.branch.trim() : '';
    const sha = typeof body.sha === 'string' && /^[0-9a-f]{7,40}$/i.test(body.sha) ? body.sha : undefined;
    const by = typeof body.by === 'string' ? body.by.trim().slice(0, 200) : undefined;
    const fns = Array.isArray(body.functions) ? body.functions : [];

    if (!INGEST_REPO_ALLOWLIST.has(repo) || repoTypeOf(repo) !== 'cloud-function') {
      res.status(400).json({ ok: false, error: 'repo not allowed' });
      return;
    }
    const envKey = CF_ENV_BY_PROJECT[project];
    if (!envKey) {
      res.status(400).json({ ok: false, error: `unknown project (expected one of: ${Object.keys(CF_ENV_BY_PROJECT).join(', ')})` });
      return;
    }
    if (!branch || branch.length > 200) {
      res.status(400).json({ ok: false, error: 'invalid branch' });
      return;
    }
    const valid = fns.filter((f) => typeof f?.name === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(f.name!));
    if (valid.length === 0 || valid.length > 500) {
      res.status(400).json({ ok: false, error: 'functions[] must contain 1..500 valid entries' });
      return;
    }

    try {
      const now = Date.now();
      // Chunked read-then-write (Firestore batch cap 500): the OTHER env's cell is needed to derive
      // state/drift at write time (Option A, 2026-07-03).
      for (let i = 0; i < valid.length; i += 400) {
        const chunk = valid.slice(i, i + 400);
        const refs = chunk.map((f) => db.collection(PATHS.cfFunctions).doc(f.name!));
        const snaps = await db.getAll(...refs);
        const batch = db.batch();
        chunk.forEach((f, idx) => {
          const existing = (snaps[idx].data() ?? {}) as Partial<CfFunctionDoc>;
          const cell = { deployed: true, ...(sha ? { sha } : {}), branch, at: now, ...(by ? { by } : {}) };
          const dev = envKey === 'dev' ? cell : existing.dev;
          const prod = envKey === 'prod' ? cell : existing.prod;
          const doc: Partial<CfFunctionDoc> & Record<string, unknown> = {
            repo,
            name: f.name!,
            ...(f.type ? { type: f.type } : {}),
            ...(f.file ? { file: f.file } : {}),
            ...(f.codebase ? { codebase: f.codebase } : {}),
            [envKey]: cell,
            ...computeCfMatrixState(dev, prod),
            orphaned: false,
            updatedAt: now,
          };
          batch.set(refs[idx], doc, { merge: true });
        });
        await batch.commit();
      }
      await appendActivity({
        branchId: candidateId(repo, branch),
        type: 'cf_deploy',
        source: 'webhook',
        confirmed: true,
        eventTime: now,
        receivedTime: now,
        sha,
        actor: by ?? 'cf-postdeploy',
        detail: { project, env: envKey, count: valid.length },
      });
      logger.info(`recordCfDeploy ${repo}@${branch} → ${project} (${envKey}): ${valid.length} functions`);
      res.status(200).json({ ok: true, env: envKey, functions: valid.length });
    } catch (err) {
      logger.error('recordCfDeploy failed', err);
      res.status(500).json({ ok: false, error: 'internal' });
    }
  },
);

// --- cfDeployEvent (HTTPS) — Admin-Activity audit-log push receiver (lane-3 lock, 2026-07-03) --
//
// ONE receiver for BOTH env projects. Each project routes its ALWAYS-ON Admin Activity audit log
// (CreateFunction / UpdateFunction / DeleteFunction) through a log sink → Pub/Sub → OIDC-signed
// PUSH to this endpoint. It updates ONLY the deployed flag (+ derived state/drift) — branch/sha/by
// stay owned by the postdeploy hook (recordCfDeploy). This REPLACES reconcilePoll's CF-API heal
// with real-time events and requires NO cross-project SA read grant: the env projects push OUT.
// Duplicate deliveries are harmless (idempotent flag writes).

const PUSH_AUDIENCE = 'cf-deploy-event';
const oidcVerifier = new OAuth2Client();

export const cfDeployEvent = onRequest({ region, cors: false }, async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  // (1) Verify the Pub/Sub push OIDC token (Google-signed; audience pinned on the subscription).
  try {
    const idToken = (req.header('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const ticket = await oidcVerifier.verifyIdToken({ idToken, audience: PUSH_AUDIENCE });
    const email = ticket.getPayload()?.email ?? '';
    if (!email.endsWith('.gserviceaccount.com')) throw new Error(`unexpected identity ${email}`);
  } catch (e) {
    logger.warn('cfDeployEvent: OIDC verification failed', e);
    res.status(401).json({ ok: false });
    return;
  }

  // (2) Decode the Pub/Sub envelope → the audit LogEntry.
  let entry: { protoPayload?: { methodName?: string; resourceName?: string } } = {};
  try {
    const data = req.body?.message?.data;
    if (typeof data === 'string') entry = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
  } catch {
    /* unparseable — ack below so Pub/Sub stops redelivering */
  }
  const method = entry.protoPayload?.methodName ?? '';
  const resName = entry.protoPayload?.resourceName ?? '';
  const match = /projects\/([^/]+)\/locations\/[^/]+\/functions\/([^/]+)/.exec(resName);
  const envKey = match ? CF_ENV_BY_PROJECT[match[1]] : undefined;
  if (!match || !envKey || !/(Create|Update|Delete)Function/i.test(method)) {
    res.status(204).send(''); // irrelevant entry — ACK
    return;
  }
  const name = match[2];
  const deployed = !/DeleteFunction/i.test(method);

  // (3) Flip ONLY the env flag; keep last-known branch/sha as history; re-derive state/drift.
  try {
    const ref = db.collection(PATHS.cfFunctions).doc(name);
    const snap = await ref.get();
    const existing = (snap.data() ?? {}) as Partial<CfFunctionDoc>;
    const now = Date.now();
    const cell = { ...(existing[envKey] ?? {}), deployed, at: now, via: 'audit-log' };
    const dev = envKey === 'dev' ? cell : existing.dev;
    const prod = envKey === 'prod' ? cell : existing.prod;
    await ref.set(
      {
        repo: 'starlabs-cloud-function',
        name,
        [envKey]: cell,
        ...computeCfMatrixState(dev, prod),
        updatedAt: now,
      },
      { merge: true },
    );
    logger.info(`cfDeployEvent: ${name} ${envKey}.deployed=${deployed} (${method.split('.').pop()})`);
    res.status(200).json({ ok: true });
  } catch (e) {
    logger.error('cfDeployEvent failed', e);
    res.status(500).json({ ok: false }); // non-2xx → Pub/Sub retries
  }
});

// --- listCfBranches (callable) — the CF Board "Branches" tab (L17/L19) -------------------------
//
// GitHub-derived, on-demand (↻ Refresh in the UI) — NOT a Firestore stream. Per branch:
// last commit, ~changed functions vs development (file diff mapped through the branch's
// functions-manifest.json — approximation, L19), merged-to-development state, open PR.

interface ListCfBranchesData {
  repo?: string;
}

export const listCfBranches = onCall<ListCfBranchesData>(
  { region, secrets: [GITHUB_APP_PRIVATE_KEY], timeoutSeconds: 120 },
  async (req: CallableRequest<ListCfBranchesData>) => {
    const caller = requireAuth(req);
    const member = await loadMemberCanonical(caller);
    const roles = (member.roles ?? []) as Role[];
    if (!member.active || !(roles.includes('developer') || roles.includes('admin'))) {
      throw new HttpsError('permission-denied', 'CF Board is for developers and admins.');
    }
    const repo = req.data?.repo ?? 'starlabs-cloud-function';
    if (repoTypeOf(repo) !== 'cloud-function') {
      throw new HttpsError('invalid-argument', `${repo} is not a cloud-function repo.`);
    }

    const octokit = appOctokit();
    const [branchesResp, prsResp] = await Promise.all([
      octokit.repos.listBranches({ owner: GITHUB_ORG, repo, per_page: 30 }),
      octokit.pulls.list({ owner: GITHUB_ORG, repo, state: 'open', base: 'development', per_page: 50 }),
    ]);
    const openPrByHead = new Map(prsResp.data.map((p) => [p.head.ref, { number: p.number, url: p.html_url }]));

    const skip = new Set(['development', 'production', 'main', 'master']);
    const out: Record<string, unknown>[] = [];
    for (const b of branchesResp.data.filter((x) => !skip.has(x.name))) {
      try {
        // BASELINE = development (operator, 2026-07-03) — the CF repo has no production branch.
        const [cmpDev, commitResp] = await Promise.all([
          octokit.repos.compareCommitsWithBasehead({ owner: GITHUB_ORG, repo, basehead: `development...${b.name}` }),
          octokit.repos.getCommit({ owner: GITHUB_ORG, repo, ref: b.commit.sha }),
        ]);

        // Branch functions manifest (may be absent on old branches) → name/type mapping.
        let manifestFns: { name: string; type?: string; file?: string }[] = [];
        try {
          const content = await octokit.repos.getContent({ owner: GITHUB_ORG, repo, path: 'functions-manifest.json', ref: b.name });
          if (!Array.isArray(content.data) && content.data.type === 'file' && 'content' in content.data) {
            manifestFns = JSON.parse(Buffer.from(content.data.content, 'base64').toString('utf8'))?.functions ?? [];
          }
        } catch {
          /* no manifest on this branch — file-level fallback below */
        }

        const changedFunctions: { name: string; type: string; change: string }[] = [];
        const seen = new Set<string>();
        for (const f of cmpDev.data.files ?? []) {
          if (!f.filename.startsWith('functions/')) continue;
          const rel = f.filename.replace(/^functions\//, '');
          const change = f.status === 'added' ? 'NEW' : f.status === 'removed' ? 'DELETED' : 'UPDATED';
          const hits = manifestFns.filter((m) => m.file === rel || m.file === f.filename);
          if (hits.length === 0) {
            const label = rel.split('/').pop() ?? rel;
            if (!seen.has(label)) { seen.add(label); changedFunctions.push({ name: label, type: 'file', change }); }
          } else {
            for (const m of hits) {
              if (!seen.has(m.name)) { seen.add(m.name); changedFunctions.push({ name: m.name, type: m.type ?? 'unknown', change }); }
            }
          }
        }

        const commit = commitResp.data.commit;
        out.push({
          name: b.name,
          lastCommit: {
            sha: b.commit.sha,
            msg: commit?.message?.split('\n')[0],
            author: commit?.author?.email ?? commit?.author?.name,
            at: commit?.author?.date ? Date.parse(commit.author.date) : undefined,
          },
          aheadOfDev: cmpDev.data.ahead_by ?? 0,
          changedFunctions,
          mergedToDev: (cmpDev.data.ahead_by ?? 0) === 0,
          pr: openPrByHead.get(b.name) ?? null,
        });
      } catch (err: any) {
        logger.error(`listCfBranches: ${b.name} failed`, err);
        out.push({ name: b.name, error: String(err?.message ?? err).slice(0, 200) });
      }
    }

    // HEAL/BACKFILL (operator flow, 2026-07-03): persist what we just computed into cf-branches so
    // the Branches tab streams instantly, and drop records for branches deleted on GitHub.
    try {
      const existing = await db.collection(PATHS.cfBranches).where('repo', '==', repo).get();
      const live = new Set<string>();
      const batch = db.batch();
      for (const b of out) {
        if (b['error']) continue;
        const id = candidateId(repo, b['name'] as string);
        live.add(id);
        batch.set(
          db.collection(PATHS.cfBranches).doc(id),
          {
            repo,
            branch: b['name'],
            headSha: (b['lastCommit'] as { sha?: string } | undefined)?.sha,
            lastCommit: b['lastCommit'],
            aheadOfDev: b['aheadOfDev'],
            changedFunctions: b['changedFunctions'],
            mergedToDev: b['mergedToDev'],
            pr: b['pr'] ?? null,
            updatedAt: Date.now(),
          },
          { merge: true },
        );
      }
      for (const d of existing.docs) {
        if (!live.has(d.id)) batch.delete(d.ref);
      }
      await batch.commit();
    } catch (e) {
      logger.error('listCfBranches: cf-branches heal write failed (non-fatal)', e);
    }

    return { ok: true, repo, branches: out };
  },
);

// ===========================================================================
// 7. onMembersWrite (Firestore trigger) — recompute legacy allowlists doc
// ===========================================================================

/**
 * Whenever a member doc changes, recompute the legacy
 * `console-config/allowlists` doc so any retained allowlist-shaped reads keep
 * working during migration (plan §3.3). New code reads members + roles directly.
 *
 *  okToRelease = emails of active members with the `developer` role.
 *  approvers   = kept for back-compat: testers fill both dev+prod approver lists.
 */
export const onMembersWrite = onDocumentWritten(
  { region, document: `${PATHS.usersCol}/{email}` },
  async () => {
    const snap = await memberCollection().get();
    const okToRelease: string[] = [];
    const devApprovers: string[] = [];
    const prodApprovers: string[] = [];

    snap.forEach((doc) => {
      const m = doc.data() as Member;
      if (!m.active) return;
      const roles = m.roles ?? [];
      if (roles.includes('developer') || roles.includes('admin')) okToRelease.push(m.email);
      if (roles.includes('tester') || roles.includes('admin')) {
        devApprovers.push(m.email);
        prodApprovers.push(m.email);
      }
    });

    const allow: AllowlistConfig = {
      okToRelease,
      approvers: { development: devApprovers, production: prodApprovers },
    };
    await db.collection(PATHS.consoleConfig).doc(PATHS.allowlistDoc).set(allow, { merge: true });
    logger.info(`Recomputed legacy allowlists (okToRelease=${okToRelease.length}).`);
  },
);

function memberCollection() {
  return db.collection(PATHS.usersCol);
}

// ===========================================================================
// 9. recordPreviewUrl (HTTPS) — CI pushes the REAL preview-channel URL (Option A)
// ===========================================================================
//
// A Firebase Hosting preview channel URL contains a random hash the console CANNOT
// reconstruct (e.g. breakthroughs-test--<branch>-<hash>.web.app). The deploying workflow
// (preview.yml) is the only place that knows it, so after the channel deploy it POSTs the
// real URL here. Auth is a shared bearer token (CONSOLE_INGEST_TOKEN) — a low-privilege
// secret scoped to THIS endpoint only (a leak can at most set a preview URL on the
// breakthroughs-test domain for an allowlisted repo; it is NOT a service account). The
// payload shape is strictly validated, and only the preview facet is written (via
// mutateCandidate, so derivedStatus/reconcile/promotable stay consistent).

/** Repos permitted to push a preview URL (the org's repos). */
const INGEST_REPO_ALLOWLIST = new Set([
  'starlabs-angular',
  'starlabs-cloud-function',
  'breakthroughs-flutter',
  'starlabs-e2e-tests',
]);

/** A preview URL may ONLY be a breakthroughs-test Firebase Hosting channel (no off-domain links). */
const PREVIEW_URL_RE = /^https:\/\/breakthroughs-test--[a-z0-9-]+\.web\.app\/?$/;

/** Constant-time bearer-token check. */
function bearerOk(authHeader: string | undefined, token: string): boolean {
  if (!authHeader || !token) return false;
  const m = /^Bearer\s+(.+)$/.exec(authHeader.trim());
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const recordPreviewUrl = onRequest(
  { region, secrets: [CONSOLE_INGEST_TOKEN], cors: false },
  async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    if (!bearerOk(req.header('authorization'), CONSOLE_INGEST_TOKEN.value())) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const repo = typeof body.repo === 'string' ? body.repo.trim() : '';
    const branch = typeof body.branch === 'string' ? body.branch.trim() : '';
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const sha =
      typeof body.sha === 'string' && /^[0-9a-f]{40}$/i.test(body.sha) ? body.sha : undefined;

    // Strict structure check — reject anything that isn't a known repo + a real preview URL.
    if (!INGEST_REPO_ALLOWLIST.has(repo)) {
      res.status(400).json({ ok: false, error: 'repo not allowed' });
      return;
    }
    if (!branch || branch.length > 200) {
      res.status(400).json({ ok: false, error: 'invalid branch' });
      return;
    }
    if (!PREVIEW_URL_RE.test(url)) {
      res.status(400).json({ ok: false, error: 'invalid preview url' });
      return;
    }

    try {
      const now = Date.now();
      const entry = activityEntry({
        repo,
        branch,
        type: 'preview_build',
        source: 'webhook',
        confirmed: true,
        eventTime: now,
        sha,
        actor: 'ci',
        detail: { url, via: 'recordPreviewUrl' },
      });
      await appendActivity(entry);

      // Write ONLY the preview facet; mutateCandidate re-projects the candidate.
      await mutateCandidate(repo, branch, lastActivityFrom(entry), (c) => {
        c.preview.url = url;
        c.preview.buildState = 'LIVE';
        c.preview.builtAt = now;
        if (sha) c.preview.sha = sha;
      });

      logger.info(`recordPreviewUrl ${repo}/${branch} → ${url}`);
      res.status(200).json({ ok: true });
    } catch (err) {
      logger.error('recordPreviewUrl failed', err);
      res.status(500).json({ ok: false, error: 'internal' });
    }
  },
);
