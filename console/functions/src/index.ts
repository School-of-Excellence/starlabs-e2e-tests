/**
 * StarLabs release-console backend (Firebase project: starlabs-cicd).
 *
 * GitHub is the source of truth. This backend MIRRORS GitHub via a webhook
 * receiver and adds the human workflow (OK-to-Release sign-off + console-gated,
 * allowlisted PR create/merge). See docs/ARCHITECTURE.md §7-8 and docs/GOAL.md.
 *
 * Enforcement model ("console-gated, stay on Free"): the console's GitHub App is
 * the merge authority. Developers are asked (policy) not to merge directly. The
 * approve/merge endpoint DOUBLE-GUARDS:
 *   (a) authenticate the caller via Firebase Auth,
 *   (b) check the caller is in the per-branch approver allowlist (Firestore),
 *   (c) only then call the GitHub merge API AS THE APP.
 *
 * This is a SCAFFOLD. Every place that needs a live credential is marked TODO.
 */

import { onRequest, onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
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
  AllowlistConfig,
  TargetBranch,
  PATHS,
  candidateId,
} from './model';

initializeApp();
const db = getFirestore();

// ---------------------------------------------------------------------------
// Configuration / secrets
//
// Defined as Firebase "params" secrets (v2). Set them with:
//   firebase functions:secrets:set GITHUB_WEBHOOK_SECRET --project starlabs-cicd
//   firebase functions:secrets:set GITHUB_APP_PRIVATE_KEY --project starlabs-cicd
// and the non-secret ids via env (.env.starlabs-cicd) or process.env.
// ---------------------------------------------------------------------------

/** HMAC secret configured on the GitHub App webhook. TODO: set this secret. */
const GITHUB_WEBHOOK_SECRET = defineSecret('GITHUB_WEBHOOK_SECRET');
/** The GitHub App private key (PEM). TODO: set this secret. */
const GITHUB_APP_PRIVATE_KEY = defineSecret('GITHUB_APP_PRIVATE_KEY');

/** GitHub org that owns all four repos (see targets.json / docs). */
const GITHUB_ORG = process.env.GITHUB_ORG ?? 'School-of-Excellence';
/** Numeric GitHub App id. TODO: set GITHUB_APP_ID env after registering the App. */
const GITHUB_APP_ID = process.env.GITHUB_APP_ID ?? 'TODO_APP_ID';
/** Installation id of the App on the org. TODO: set GITHUB_APP_INSTALLATION_ID. */
const GITHUB_APP_INSTALLATION_ID = process.env.GITHUB_APP_INSTALLATION_ID ?? 'TODO_INSTALLATION_ID';

const region = 'us-central1';

// ---------------------------------------------------------------------------
// GitHub App client (acts AS THE APP — the bot is the merge authority)
// ---------------------------------------------------------------------------

/**
 * Build an Octokit authenticated as the GitHub App installation. All GitHub
 * writes (create PR, merge PR) go through this so the App — not a human — is the
 * merge author. This is what lets us "stay on Free" while still channelling
 * merges through one allowlisted authority.
 */
function appOctokit(): Octokit {
  const privateKey = GITHUB_APP_PRIVATE_KEY.value();
  if (!privateKey || GITHUB_APP_ID.startsWith('TODO')) {
    // Fail loud in the scaffold rather than make an unauthenticated call.
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
// Shared helpers
// ---------------------------------------------------------------------------

const PROTECTED_BRANCHES: TargetBranch[] = ['development', 'production'];

/** Load the allowlist config doc. Throws if missing (must be authored once). */
async function loadAllowlists(): Promise<AllowlistConfig> {
  const snap = await db.collection(PATHS.consoleConfig).doc(PATHS.allowlistDoc).get();
  if (!snap.exists) {
    throw new HttpsError(
      'failed-precondition',
      `Allowlist config missing at ${PATHS.consoleConfig}/${PATHS.allowlistDoc}. See README "Firestore allowlist config".`,
    );
  }
  return snap.data() as AllowlistConfig;
}

/** Require an authenticated Firebase Auth caller; return uid + email. */
function requireAuth(req: CallableRequest): { uid: string; email: string | null } {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'Sign in with Firebase Auth to use the console.');
  }
  return {
    uid: req.auth.uid,
    email: (req.auth.token.email as string | undefined) ?? null,
  };
}

/** True if the caller (by uid OR email) appears in the given allowlist. */
function inAllowlist(caller: { uid: string; email: string | null }, list: string[]): boolean {
  if (list.includes(caller.uid)) return true;
  if (caller.email && list.includes(caller.email)) return true;
  return false;
}

/** A stable label for audit fields (prefer email, fall back to uid). */
function callerLabel(caller: { uid: string; email: string | null }): string {
  return caller.email ?? caller.uid;
}

/**
 * Merge a partial update into release-candidates/{repo__branch}.
 * NEVER writes OK_TO_RELEASE here — that status is manual-only (setOkToRelease).
 */
async function upsertCandidate(
  repo: string,
  branch: string,
  patch: Partial<ReleaseCandidate>,
): Promise<void> {
  if (patch.status === ReleaseStatus.OK_TO_RELEASE) {
    throw new Error('OK_TO_RELEASE is manual-only and must not be derived from webhooks.');
  }
  const ref = db.collection(PATHS.releaseCandidates).doc(candidateId(repo, branch));
  await ref.set(
    {
      repo,
      branch,
      ...patch,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

// ===========================================================================
// 1. webhookReceiver (HTTPS) — mirror GitHub into Firestore
// ===========================================================================

/**
 * Verify the GitHub webhook HMAC-SHA256 signature (X-Hub-Signature-256).
 * Uses the raw request body — onRequest exposes it as `req.rawBody`.
 */
function verifyGithubSignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  // Constant-time compare; lengths must match for timingSafeEqual.
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Short repo name from a full GitHub repo object (`owner/name`). */
function shortRepo(payload: any): string {
  return payload?.repository?.name ?? 'unknown-repo';
}

export const webhookReceiver = onRequest(
  { region, secrets: [GITHUB_WEBHOOK_SECRET], cors: false },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // (1) Verify HMAC. rawBody is required for a correct signature check.
    const secret = GITHUB_WEBHOOK_SECRET.value(); // TODO: secret set via functions:secrets:set
    const signature = req.header('x-hub-signature-256') ?? undefined;
    const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body) ?? '');
    if (!verifyGithubSignature(rawBody, signature, secret)) {
      logger.warn('Webhook signature verification failed');
      res.status(401).send('Invalid signature');
      return;
    }

    const event = req.header('x-github-event') ?? 'unknown';
    const payload = req.body ?? {};

    try {
      switch (event) {
        case 'push':
          await handlePush(payload);
          break;
        case 'pull_request':
          await handlePullRequest(payload);
          break;
        case 'deployment_status':
          await handleDeploymentStatus(payload);
          break;
        case 'workflow_run':
          await handleWorkflowRun(payload);
          break;
        case 'ping':
          // GitHub sends `ping` once on registration.
          break;
        default:
          logger.info(`Ignoring unhandled event: ${event}`);
      }
      res.status(200).json({ ok: true, event });
    } catch (err) {
      logger.error(`Error handling ${event}`, err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  },
);

/**
 * push: a branch advanced. Two jobs:
 *  - A push to a feature branch ensures a candidate exists (status NO_ACTION).
 *    OK_TO_RELEASE is never set here — that is a manual sign-off.
 *  - A push to a protected branch is a MERGE landing → derive DEV_MERGED /
 *    PROD_MERGED. We attribute the merge to the source candidate via the head
 *    branch when discoverable; otherwise we mark the protected branch's own card.
 */
async function handlePush(payload: any): Promise<void> {
  const repo = shortRepo(payload);
  const ref: string = payload.ref ?? ''; // e.g. refs/heads/development
  const branch = ref.replace(/^refs\/heads\//, '');

  if (branch === 'development' || branch === 'production') {
    const status = branch === 'development' ? ReleaseStatus.DEV_MERGED : ReleaseStatus.PROD_MERGED;
    // We cannot always recover the source feature branch from a push payload,
    // so we record the merge landing on the protected-branch card. The PR-close
    // event (handlePullRequest) carries the head branch and is the primary
    // signal for the lifecycle on the feature card.
    await upsertCandidate(repo, branch, { status });
    logger.info(`push → ${branch} on ${repo}: ${status}`);
  } else {
    // Feature branch push: ensure a candidate row exists. Do NOT regress an
    // already-advanced status back to NO_ACTION.
    const id = candidateId(repo, branch);
    const existing = await db.collection(PATHS.releaseCandidates).doc(id).get();
    if (!existing.exists) {
      await upsertCandidate(repo, branch, { status: ReleaseStatus.NO_ACTION, notes: [] });
      logger.info(`push → new feature candidate ${repo}/${branch}: NO_ACTION`);
    }
  }
}

/**
 * pull_request: derive PR_TO_DEV / PR_TO_PROD on open, and DEV_MERGED /
 * PROD_MERGED on a merged close. Keyed on the HEAD (source) branch's card.
 */
async function handlePullRequest(payload: any): Promise<void> {
  const repo = shortRepo(payload);
  const action: string = payload.action ?? '';
  const pr = payload.pull_request ?? {};
  const base: string = pr.base?.ref ?? '';
  const head: string = pr.head?.ref ?? '';
  const prUrl: string = pr.html_url ?? '';
  const prNumber: number = pr.number ?? 0;

  if (base !== 'development' && base !== 'production') {
    logger.info(`PR base ${base} not tracked; ignoring`);
    return;
  }

  const patch: Partial<ReleaseCandidate> = {};

  if (action === 'opened' || action === 'reopened' || action === 'ready_for_review') {
    if (base === 'development') {
      patch.status = ReleaseStatus.PR_TO_DEV;
      patch.prDevUrl = prUrl;
      patch.prDevNumber = prNumber;
    } else {
      patch.status = ReleaseStatus.PR_TO_PROD;
      patch.prProdUrl = prUrl;
      patch.prProdNumber = prNumber;
    }
  } else if (action === 'closed' && pr.merged === true) {
    if (base === 'development') {
      patch.status = ReleaseStatus.DEV_MERGED;
      patch.prDevUrl = prUrl;
      patch.prDevNumber = prNumber;
    } else {
      patch.status = ReleaseStatus.PROD_MERGED;
      patch.prProdUrl = prUrl;
      patch.prProdNumber = prNumber;
    }
  } else {
    logger.info(`PR action ${action} (merged=${pr.merged}) — no status change`);
    return;
  }

  await upsertCandidate(repo, head, patch);
  logger.info(`PR ${action} ${repo} ${head}→${base}: ${patch.status}`);
}

/**
 * deployment_status: GitHub reports the deploy result of a merge. We record the
 * latest state for the board; the merge itself already moved the lifecycle.
 * A successful deployment_status can also carry the live/preview environment URL.
 */
async function handleDeploymentStatus(payload: any): Promise<void> {
  const repo = shortRepo(payload);
  const state: string = payload.deployment_status?.state ?? '';
  const envUrl: string | undefined =
    payload.deployment_status?.environment_url || payload.deployment_status?.target_url || undefined;
  // The deployment ref is usually the branch that was deployed.
  const branch: string = payload.deployment?.ref ?? '';
  if (!branch) {
    logger.info('deployment_status without a ref; ignoring');
    return;
  }
  const patch: Partial<ReleaseCandidate> = { lastDeploymentState: state };
  if (envUrl) patch.previewUrl = envUrl;
  await upsertCandidate(repo, branch, patch);
  logger.info(`deployment_status ${repo}/${branch}: ${state}`);
}

/**
 * workflow_run: links the e2e gate run to the candidate (reportRunId →
 * cicd-audit) and, for the preview lane, the preview URL when surfaced. We do
 * NOT set OK_TO_RELEASE from a green gate — sign-off stays manual.
 */
async function handleWorkflowRun(payload: any): Promise<void> {
  const repo = shortRepo(payload);
  const run = payload.workflow_run ?? {};
  const branch: string = run.head_branch ?? '';
  if (!branch || branch === 'development' || branch === 'production') {
    // Gate/preview runs are on feature branches; deploy runs we capture via
    // deployment_status. Skip protected-branch runs here.
    return;
  }
  // Convention: the history recorder keys runId as repo-branch-sha-timestamp.
  // We store the GitHub run id; the UI resolves it against cicd-audit.
  const patch: Partial<ReleaseCandidate> = {
    reportRunId: String(run.id ?? ''),
  };
  await upsertCandidate(repo, branch, patch);
  logger.info(`workflow_run ${repo}/${branch} (${run.name}) conclusion=${run.conclusion}`);
}

// ===========================================================================
// 2. setOkToRelease (callable) — the one MANUAL status
// ===========================================================================

interface SetOkToReleaseData {
  repo: string;
  branch: string;
}

export const setOkToRelease = onCall<SetOkToReleaseData>(
  { region },
  async (req) => {
    const caller = requireAuth(req);
    const { repo, branch } = req.data ?? ({} as SetOkToReleaseData);
    if (!repo || !branch) {
      throw new HttpsError('invalid-argument', 'repo and branch are required.');
    }

    const allow = await loadAllowlists();
    if (!inAllowlist(caller, allow.okToRelease)) {
      throw new HttpsError('permission-denied', 'You are not allowed to set OK to Release.');
    }

    const ref = db.collection(PATHS.releaseCandidates).doc(candidateId(repo, branch));
    await ref.set(
      {
        repo,
        branch,
        status: ReleaseStatus.OK_TO_RELEASE,
        okToReleaseBy: callerLabel(caller),
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    logger.info(`OK_TO_RELEASE set on ${repo}/${branch} by ${callerLabel(caller)}`);
    return { ok: true, status: ReleaseStatus.OK_TO_RELEASE };
  },
);

// ===========================================================================
// 3. createPullRequest (callable) — open a PR AS THE APP (allowlisted caller)
// ===========================================================================

interface CreatePullRequestData {
  repo: string;
  /** Source branch (feature branch, or `development` when promoting to prod). */
  head: string;
  /** Target branch: `development` (from a feature) or `production` (from development). */
  base: TargetBranch;
  title?: string;
  body?: string;
}

export const createPullRequest = onCall<CreatePullRequestData>(
  { region, secrets: [GITHUB_APP_PRIVATE_KEY] },
  async (req) => {
    const caller = requireAuth(req);
    const { repo, head, base, title, body } = req.data ?? ({} as CreatePullRequestData);
    if (!repo || !head || !base) {
      throw new HttpsError('invalid-argument', 'repo, head and base are required.');
    }
    if (!PROTECTED_BRANCHES.includes(base)) {
      throw new HttpsError('invalid-argument', `base must be one of ${PROTECTED_BRANCHES.join(', ')}.`);
    }

    // Allowlist: opening a PR is a release action, gated by the okToRelease list.
    const allow = await loadAllowlists();
    if (!inAllowlist(caller, allow.okToRelease)) {
      throw new HttpsError('permission-denied', 'You are not allowed to open release PRs.');
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
        body: body ?? `Opened via the StarLabs release console by ${callerLabel(caller)}.`,
      });
      pr = resp.data;
    } catch (err: any) {
      logger.error('GitHub PR create failed', err);
      throw new HttpsError('internal', `GitHub PR create failed: ${err?.message ?? err}`);
    }

    // Optimistically reflect the PR; the webhook will also confirm it.
    const patch: Partial<ReleaseCandidate> =
      base === 'development'
        ? { status: ReleaseStatus.PR_TO_DEV, prDevUrl: pr.html_url, prDevNumber: pr.number }
        : { status: ReleaseStatus.PR_TO_PROD, prProdUrl: pr.html_url, prProdNumber: pr.number };
    await upsertCandidate(repo, head, patch);

    logger.info(`PR created ${repo} ${head}→${base} #${pr.number} by ${callerLabel(caller)}`);
    return { ok: true, prNumber: pr.number, prUrl: pr.html_url };
  },
);

// ===========================================================================
// 4. approveAndMerge (callable) — the double-guarded merge authority
// ===========================================================================

interface ApproveAndMergeData {
  repo: string;
  /** Base branch of the PR being merged — selects the approver allowlist. */
  base: TargetBranch;
  prNumber: number;
  /** Optional: merge method. Default 'merge' to preserve history. */
  mergeMethod?: 'merge' | 'squash' | 'rebase';
}

export const approveAndMerge = onCall<ApproveAndMergeData>(
  { region, secrets: [GITHUB_APP_PRIVATE_KEY] },
  async (req) => {
    // GUARD (a): authenticate via Firebase Auth.
    const caller = requireAuth(req);
    const { repo, base, prNumber, mergeMethod } = req.data ?? ({} as ApproveAndMergeData);
    if (!repo || !base || !prNumber) {
      throw new HttpsError('invalid-argument', 'repo, base and prNumber are required.');
    }
    if (!PROTECTED_BRANCHES.includes(base)) {
      throw new HttpsError('invalid-argument', `base must be one of ${PROTECTED_BRANCHES.join(', ')}.`);
    }

    // GUARD (b): per-branch approver allowlist (production may be stricter).
    const allow = await loadAllowlists();
    const approvers = allow.approvers?.[base] ?? [];
    if (!inAllowlist(caller, approvers)) {
      throw new HttpsError(
        'permission-denied',
        `You are not an approver for ${base}.`,
      );
    }

    // GUARD (c): only now call the GitHub merge API AS THE APP.
    const octokit = appOctokit();
    let merged;
    try {
      const resp = await octokit.pulls.merge({
        owner: GITHUB_ORG,
        repo,
        pull_number: prNumber,
        merge_method: mergeMethod ?? 'merge',
      });
      merged = resp.data;
    } catch (err: any) {
      logger.error('GitHub merge failed', err);
      throw new HttpsError('internal', `GitHub merge failed: ${err?.message ?? err}`);
    }

    logger.info(
      `approveAndMerge ${repo} PR#${prNumber}→${base} by ${callerLabel(caller)} (merged=${merged.merged})`,
    );
    // NOTE: we deliberately do NOT write DEV_MERGED/PROD_MERGED here. The
    // pull_request `closed`+merged webhook is the source of truth and will
    // reflect the merged status, keeping GitHub authoritative.
    return { ok: true, merged: merged.merged, sha: merged.sha };
  },
);
