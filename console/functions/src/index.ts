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
import { onSchedule } from 'firebase-functions/v2/scheduler';
import type { Response } from 'express';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
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
} from './model';
import { mutateCandidate, computePromotable, previewUrl } from './candidate';
import { projectCandidate } from './projection';
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

const GITHUB_ORG = process.env.GITHUB_ORG ?? 'School-of-Excellence';
const GITHUB_APP_ID = process.env.GITHUB_APP_ID ?? 'TODO_APP_ID';
const GITHUB_APP_INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID ?? 'TODO_INSTALLATION_ID';

const region = 'us-central1';

/** Workflow file names (plan §7, D5/D10). */
const PREVIEW_WORKFLOW = 'preview.yml';
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
  { region, secrets: [GITHUB_WEBHOOK_SECRET], cors: false },
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

  // Protected-branch deploy/gate runs have no feature candidate; record health
  // only when there is a candidate to host it (feature branches).
  if (isProtected(branch) && !isDeploy) return true;

  await mutateCandidate(repo, branch, lastActivityFrom(entry), (c) => {
    if (isPreview) {
      if (status === 'in_progress' || status === 'queued') {
        c.preview.buildState = 'BUILDING';
      } else if (status === 'completed') {
        c.preview.buildState = conclusion === 'success' ? 'LIVE' : 'FAILED';
        c.preview.builtAt = eventTime;
        // Record the deterministic preview-channel URL (breakthroughs-test-<branchid>) on success
        // so the console shows the right link without waiting on a preview.yml write-back.
        if (conclusion === 'success') c.preview.url = previewUrl(branch);
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
      // Stage = which open PR this gate run validates, when derivable.
      const stage = c.prProd.state === 'OPEN' ? 'prod' : c.prDev.state === 'OPEN' ? 'dev' : undefined;
      c.gateRun = {
        stage,
        status: gateStatus,
        runId: run.id !== undefined ? String(run.id) : undefined,
        runUrl: run.html_url ?? undefined,
        // The cicd-audit recorder stores this github run id, so the dashboard can
        // resolve the rich report by it (see scripts/history/record-run.cjs).
        reportRunId: run.id !== undefined ? String(run.id) : undefined,
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

// ===========================================================================
// 2. deployPreview (callable) — MANUAL preview build via workflow_dispatch (D5)
// ===========================================================================

interface DeployPreviewData {
  repo: string;
  branch: string;
}

export const deployPreview = onCall<DeployPreviewData>(
  { region, secrets: [GITHUB_APP_PRIVATE_KEY] },
  async (req: CallableRequest<DeployPreviewData>) => {
    const caller = requireAuth(req);
    const { repo, branch } = req.data ?? ({} as DeployPreviewData);
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

    // Optimistic intent (confirmed:false until the workflow_run webhook confirms).
    const entry = activityEntry({
      repo,
      branch,
      type: 'preview_dispatch',
      source: 'console',
      confirmed: false,
      eventTime: Date.now(),
      actor: callerLabel(caller),
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
    const snap = await db
      .collection(PATHS.releaseCandidates)
      .doc(candidateId(repo, head))
      .get();
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', `No candidate for ${repo}/${head}.`);
    }
    const cand = snap.data() as ReleaseCandidate;

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
      sha: cand.headSha,
      actor: callerLabel(caller),
      detail: { base, number: pr.number },
    });
    await appendActivity(entry);
    await mutateCandidate(repo, head, lastActivityFrom(entry), (c) => {
      const facet = isDev ? c.prDev : c.prProd;
      facet.number = pr.number;
      facet.url = pr.html_url;
      facet.state = 'OPEN';
      facet.headSha = cand.headSha;
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
// 8. reconcilePoll (scheduled) — STUB: backfill missed webhooks (D9 / risk #3)
// ===========================================================================

/**
 * Heal the log after dropped/out-of-order webhooks. Webhooks are at-least-once,
 * unordered and droppable; without a poll the derived state silently lies after
 * any hiccup. This is a documented STUB wired on a schedule — the real query
 * logic is a follow-up.
 *
 * TODO(reconcile): for each tracked repo:
 *   1. octokit.pulls.list({state:'open'}) → reconcile prDev/prProd facets +
 *      mergeability against what we have (detect missed `synchronize`).
 *   2. octokit.actions.listWorkflowRunsForRepo (preview.yml/deploy/e2e) since the
 *      last poll → backfill missed workflow_run events (preview state, testSummary).
 *   3. For any candidate whose facets imply a milestone with no matching
 *      confirmed activity entry → mark reconcile=ANOMALY for a human.
 *   4. Write a heartbeat doc so the UI can show "last reconciled at".
 * Each backfilled fact is appended with source:'reconcile', confirmed:true and a
 * synthetic delivery id (`reconcile:<repo>:<branch>:<sha>`) so dedupe still holds.
 */
export const reconcilePoll = onSchedule(
  { region, schedule: 'every 30 minutes', secrets: [GITHUB_APP_PRIVATE_KEY] },
  async () => {
    // RE-PROJECTION pass: recompute derivedStatus/reconcile for every candidate from its stored
    // facets. This self-heals docs whose cached projection is stale after a projection-logic change
    // (so an operator no longer has to push/sign-off to un-stick a branch), and is the foundation
    // for the GitHub-backfill TODO below.
    const snap = await db.collection(PATHS.releaseCandidates).get();
    let updated = 0;
    for (const doc of snap.docs) {
      const c = doc.data() as ReleaseCandidate;
      const { derivedStatus, reconcile } = projectCandidate(c);
      const promotable = computePromotable(c);
      if (
        c.derivedStatus !== derivedStatus ||
        c.reconcile !== reconcile ||
        (c.promotable ?? false) !== promotable
      ) {
        await doc.ref.set({ derivedStatus, reconcile, promotable, updatedAt: Date.now() }, { merge: true });
        updated++;
      }
    }
    logger.info(`reconcilePoll: re-projected ${snap.size} candidates, ${updated} updated`);

    // GITHUB BACKFILL: heal preview builds STUCK at BUILDING. buildState only flips to LIVE/FAILED
    // via the preview.yml `workflow_run: completed` webhook; if that delivery is dropped/unmatched,
    // the optimistic BUILDING (set on dispatch) never gets corrected. Poll GitHub Actions directly
    // for the latest preview run per stuck candidate and reconcile the facet. (promotion-chain /
    // reconcile backfill, 2026-06-25)
    const all = snap.docs.map((d) => d.data() as ReleaseCandidate);
    let octokit: Octokit | undefined;
    try {
      octokit = appOctokit();
    } catch (e) {
      logger.error('reconcilePoll: octokit init failed; skipping GitHub backfills', e);
    }

    // (a) Heal preview builds STUCK at BUILDING (dropped/unmatched workflow_run: completed).
    const stuck = all.filter((c) => c.preview?.buildState === 'BUILDING' && !isProtected(c.branch));
    let healed = 0;
    for (const c of octokit ? stuck : []) {
      try {
        const runs = await octokit!.actions.listWorkflowRuns({
          owner: GITHUB_ORG,
          repo: c.repo,
          workflow_id: PREVIEW_WORKFLOW,
          branch: c.branch,
          per_page: 1,
        });
        const latest = runs.data.workflow_runs?.[0];
        if (latest && latest.status === 'completed') {
          const buildState = latest.conclusion === 'success' ? 'LIVE' : 'FAILED';
          await mutateCandidate(
            c.repo,
            c.branch,
            { type: 'preview_build', sha: latest.head_sha ?? undefined, actor: 'reconcile', at: Date.now() },
            (cc) => {
              cc.preview.buildState = buildState;
              cc.preview.builtAt = Date.now();
              if (latest.conclusion === 'success') cc.preview.url = previewUrl(c.branch);
              cc.preview.sha = latest.head_sha ?? cc.preview.sha;
            },
          );
          healed++;
        }
      } catch (e) {
        logger.error(`reconcilePoll: preview backfill failed for ${c.repo}/${c.branch}`, e);
      }
    }

    // (b) Recompute `hasUnreleased` on each development candidate from the real GitHub diff
    // (production…development). This is the authoritative "is there anything to promote" signal —
    // it self-heals after a release (ahead_by → 0 ⇒ no more "Create PR → prod") and after any
    // missed merge event, so `promotable` can never go stale. (2026-06-26)
    const devs = all.filter((c) => c.branch === 'development');
    let synced = 0;
    for (const c of octokit ? devs : []) {
      try {
        const cmp = await octokit!.repos.compareCommitsWithBasehead({
          owner: GITHUB_ORG,
          repo: c.repo,
          basehead: 'production...development',
        });
        const ahead = (cmp.data.ahead_by ?? 0) > 0;
        if ((c.hasUnreleased ?? false) !== ahead) {
          await mutateCandidate(c.repo, 'development', c.lastActivity ?? { type: 'reconcile', at: Date.now() }, (cc) => {
            cc.hasUnreleased = ahead;
          });
          synced++;
        }
      } catch (e) {
        logger.error(`reconcilePoll: hasUnreleased backfill failed for ${c.repo}`, e);
      }
    }
    logger.info(`reconcilePoll: backfilled ${healed}/${stuck.length} previews, synced ${synced} dev hasUnreleased`);
  },
);
