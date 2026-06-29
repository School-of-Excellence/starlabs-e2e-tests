// Offline fixtures for the facet model (plan §3, 2026-06-22).
//
// One candidate per major milestone so every screen, badge, gate and reconcile state is
// visible without a Firebase project. Enabled by environment.useMock. Facets are fully
// populated so the Overview funnel, Working Branches badges and Preview Channels gates
// all render. Includes a NEEDS_DECISION drift example where the open PR tip has moved
// past the tester sign-off (prDev.headSha ≠ devGate.sha).

import {
  ReleaseCandidate,
  ActivityLogEntry,
} from './release-candidate.model';
import { Member } from './roles';

const ORG = 'School-of-Excellence';

/** Deterministic preview URL helper mirrored from FirebaseService.previewUrlFor. */
function previewUrl(branch: string): string {
  const slug = branch
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);
  return `https://breakthroughs-test-${slug}.web.app`;
}

export const MOCK_RELEASE_CANDIDATES: ReleaseCandidate[] = [
  // 1) Fresh push, nothing done yet.
  {
    id: 'starlabs-angular__feature/voice-search',
    repo: 'starlabs-angular',
    branch: 'feature/voice-search',
    headSha: 'aaa1111',
    headCommit: { msg: 'Add voice search input', author: 'dev@soexcellence.com', at: '2026-06-22T08:00:00Z' },
    preview: { buildState: 'NONE' },
    devGate: { verdict: 'NONE' },
    prDev: { state: 'NONE' },
    prodGate: { verdict: 'NONE' },
    prProd: { state: 'NONE' },
    testSummary: { conclusion: 'success', passed: 42, failed: 0, total: 42, at: '2026-06-22T08:05:00Z' },
    derivedStatus: 'NO_ACTION',
    lastActivity: { type: 'push', sha: 'aaa1111', actor: 'dev@soexcellence.com', at: '2026-06-22T08:00:00Z' },
    reconcile: 'IN_SYNC',
    updatedAt: '2026-06-22T08:05:00Z',
  },

  // 2) Preview build in progress.
  {
    id: 'starlabs-angular__feature/onboarding-tour',
    repo: 'starlabs-angular',
    branch: 'feature/onboarding-tour',
    headSha: 'bbb2222',
    headCommit: { msg: 'Onboarding tour step 3', author: 'dev@soexcellence.com', at: '2026-06-22T09:00:00Z' },
    preview: { sha: 'bbb2222', buildState: 'BUILDING' },
    devGate: { verdict: 'NONE' },
    prDev: { state: 'NONE' },
    prodGate: { verdict: 'NONE' },
    prProd: { state: 'NONE' },
    derivedStatus: 'PREVIEW_BUILDING',
    lastActivity: { type: 'preview_dispatch', sha: 'bbb2222', actor: 'dev@soexcellence.com', at: '2026-06-22T09:10:00Z' },
    reconcile: 'IN_SYNC',
    updatedAt: '2026-06-22T09:10:00Z',
  },

  // 3) Preview live, awaiting tester sign-off for dev.
  {
    id: 'starlabs-angular__feature/booking-redesign',
    repo: 'starlabs-angular',
    branch: 'feature/booking-redesign',
    headSha: 'ccc3333',
    headCommit: { msg: 'Booking redesign polish', author: 'dev@soexcellence.com', at: '2026-06-21T17:00:00Z' },
    preview: { sha: 'ccc3333', url: previewUrl('feature/booking-redesign'), buildState: 'LIVE', builtAt: '2026-06-21T17:20:00Z' },
    devGate: { verdict: 'NONE' },
    prDev: { state: 'NONE' },
    prodGate: { verdict: 'NONE' },
    prProd: { state: 'NONE' },
    // Preview-time gate (preview-e2e.yml): the report the tester reads BEFORE "OK for dev".
    gateRun: {
      stage: 'preview',
      status: 'PASSED',
      runId: '7050',
      runUrl: `https://github.com/${ORG}/starlabs-angular/actions/runs/7050`,
      reportRunId: '7050',
      sha: 'ccc3333',
      at: '2026-06-21T17:24:00Z',
    },
    testSummary: { conclusion: 'success', passed: 51, failed: 0, total: 51, at: '2026-06-21T17:25:00Z' },
    derivedStatus: 'PREVIEW_LIVE',
    lastActivity: { type: 'preview_build', sha: 'ccc3333', actor: 'github-actions', at: '2026-06-21T17:20:00Z' },
    reconcile: 'IN_SYNC',
    updatedAt: '2026-06-21T17:25:00Z',
  },

  // 4) Preview build failed.
  {
    id: 'breakthroughs-flutter__feature/push-notifs',
    repo: 'breakthroughs-flutter',
    branch: 'feature/push-notifs',
    headSha: 'ddd4444',
    headCommit: { msg: 'Wire FCM tokens', author: 'mobile@soexcellence.com', at: '2026-06-21T12:00:00Z' },
    preview: { sha: 'ddd4444', buildState: 'FAILED', builtAt: '2026-06-21T12:15:00Z' },
    devGate: { verdict: 'NONE' },
    prDev: { state: 'NONE' },
    prodGate: { verdict: 'NONE' },
    prProd: { state: 'NONE' },
    testSummary: { conclusion: 'failure', passed: 30, failed: 4, total: 34, at: '2026-06-21T12:16:00Z' },
    derivedStatus: 'PREVIEW_FAILED',
    lastActivity: { type: 'preview_build', sha: 'ddd4444', actor: 'github-actions', at: '2026-06-21T12:15:00Z' },
    reconcile: 'IN_SYNC',
    updatedAt: '2026-06-21T12:16:00Z',
  },

  // 5) Tester signed off for dev — developer may open PR → dev.
  {
    id: 'starlabs-angular__feature/profile-cohorts',
    repo: 'starlabs-angular',
    branch: 'feature/profile-cohorts',
    headSha: 'eee5555',
    headCommit: { msg: 'Cohort filters', author: 'dev@soexcellence.com', at: '2026-06-20T10:00:00Z' },
    preview: { sha: 'eee5555', url: previewUrl('feature/profile-cohorts'), buildState: 'LIVE', builtAt: '2026-06-20T10:20:00Z' },
    devGate: {
      verdict: 'OK',
      sha: 'eee5555',
      by: 'tester@soexcellence.com',
      at: '2026-06-20T11:00:00Z',
      notes: [{ by: 'tester@soexcellence.com', at: '2026-06-20T11:00:00Z', text: 'Preview validated. OK for dev.' }],
    },
    prDev: { state: 'NONE' },
    prodGate: { verdict: 'NONE' },
    prProd: { state: 'NONE' },
    testSummary: { conclusion: 'success', passed: 48, failed: 0, total: 48, at: '2026-06-20T10:25:00Z' },
    derivedStatus: 'OK_FOR_DEV',
    lastActivity: { type: 'signoff_dev', sha: 'eee5555', actor: 'tester@soexcellence.com', at: '2026-06-20T11:00:00Z' },
    reconcile: 'IN_SYNC',
    updatedAt: '2026-06-20T11:00:00Z',
  },

  // 6) PR → dev open and mergeable.
  {
    id: 'starlabs-cloud-function__feature/cf-triggers',
    repo: 'starlabs-cloud-function',
    branch: 'feature/cf-triggers',
    headSha: 'fff6666',
    headCommit: { msg: 'Add Firestore triggers', author: 'dev@soexcellence.com', at: '2026-06-19T14:00:00Z' },
    preview: { sha: 'fff6666', url: previewUrl('feature/cf-triggers'), buildState: 'LIVE', builtAt: '2026-06-19T14:20:00Z' },
    devGate: {
      verdict: 'OK',
      sha: 'fff6666',
      by: 'tester@soexcellence.com',
      at: '2026-06-19T15:00:00Z',
      notes: [{ by: 'tester@soexcellence.com', at: '2026-06-19T15:00:00Z', text: 'OK for dev.' }],
    },
    prDev: {
      number: 142,
      url: `https://github.com/${ORG}/starlabs-cloud-function/pull/142`,
      state: 'OPEN',
      headSha: 'fff6666',
      mergeable: true,
      checksState: 'success',
    },
    prodGate: { verdict: 'NONE' },
    prProd: { state: 'NONE' },
    gateRun: {
      stage: 'dev',
      status: 'PASSED',
      runId: '7001',
      runUrl: `https://github.com/${ORG}/starlabs-cloud-function/actions/runs/7001`,
      reportRunId: '7001',
      at: '2026-06-19T15:28:00Z',
    },
    testSummary: { conclusion: 'success', passed: 60, failed: 0, total: 60, at: '2026-06-19T14:25:00Z' },
    derivedStatus: 'PR_TO_DEV',
    lastActivity: { type: 'pr_to_dev', sha: 'fff6666', actor: 'dev@soexcellence.com', at: '2026-06-19T15:30:00Z' },
    reconcile: 'IN_SYNC',
    updatedAt: '2026-06-19T15:30:00Z',
  },

  // 7) Dev merged on GitHub → starlabs-test deploy fired. Awaiting prod sign-off.
  {
    id: 'starlabs-angular__feature/search-ranking',
    repo: 'starlabs-angular',
    branch: 'feature/search-ranking',
    // AUTO NEW-ITERATION: a new commit (ggg8888) landed after this branch was merged to dev
    // (#318 @ ggg7777); the preview was redeployed and the tester RE-APPROVED at ggg8888, so the
    // branch is back at OK_FOR_DEV and "Create PR → dev" is enabled to open a NEW PR for ggg8888 —
    // even though the old PR #318 shows MERGED. The projection no longer pins DEV_MERGED because
    // prDev.headSha (ggg7777) ≠ headSha (ggg8888).
    headSha: 'ggg8888',
    headCommit: { msg: 'Hotfix: tie-breaker for equal scores', author: 'dev@soexcellence.com', at: '2026-06-19T08:00:00Z' },
    preview: { sha: 'ggg8888', url: previewUrl('feature/search-ranking'), buildState: 'LIVE', builtAt: '2026-06-19T08:20:00Z' },
    devGate: {
      verdict: 'OK',
      sha: 'ggg8888',
      by: 'tester@soexcellence.com',
      at: '2026-06-19T09:00:00Z',
    },
    prDev: {
      number: 318,
      url: `https://github.com/${ORG}/starlabs-angular/pull/318`,
      state: 'MERGED',
      headSha: 'ggg7777',
      mergeable: false,
      checksState: 'success',
    },
    prodGate: { verdict: 'NONE' },
    prProd: { state: 'NONE' },
    testSummary: { conclusion: 'success', passed: 55, failed: 0, total: 55, at: '2026-06-19T08:25:00Z' },
    derivedStatus: 'OK_FOR_DEV',
    lastActivity: { type: 'signoff_dev', sha: 'ggg8888', actor: 'tester@soexcellence.com', at: '2026-06-19T09:00:00Z' },
    reconcile: 'IN_SYNC',
    updatedAt: '2026-06-19T09:00:00Z',
  },

  // 8) Merged into development (terminal for a feature; promoted to prod via development).
  {
    id: 'starlabs-angular__feature/billing-portal',
    repo: 'starlabs-angular',
    branch: 'feature/billing-portal',
    headSha: 'hhh8888',
    headCommit: { msg: 'Billing portal GA', author: 'dev@soexcellence.com', at: '2026-06-17T09:00:00Z' },
    preview: { sha: 'hhh8888', url: previewUrl('feature/billing-portal'), buildState: 'LIVE', builtAt: '2026-06-17T09:20:00Z' },
    devGate: { verdict: 'OK', sha: 'hhh8888', by: 'tester@soexcellence.com', at: '2026-06-17T10:00:00Z' },
    prDev: {
      number: 320,
      url: `https://github.com/${ORG}/starlabs-angular/pull/320`,
      state: 'MERGED',
      headSha: 'hhh8888',
      checksState: 'success',
    },
    prodGate: { verdict: 'NONE' },
    prProd: { state: 'NONE' },
    testSummary: { conclusion: 'success', passed: 58, failed: 0, total: 58, at: '2026-06-17T09:25:00Z' },
    unreleased: true,
    derivedStatus: 'DEV_MERGED',
    lastActivity: { type: 'dev_merged', sha: 'hhh8888', actor: 'dev@soexcellence.com', at: '2026-06-17T12:00:00Z' },
    reconcile: 'IN_SYNC',
    updatedAt: '2026-06-17T16:00:00Z',
  },

  // 9) Merged into development (Flutter feature; terminal).
  {
    id: 'breakthroughs-flutter__feature/flutter-onboarding',
    repo: 'breakthroughs-flutter',
    branch: 'feature/flutter-onboarding',
    headSha: 'iii9999',
    headCommit: { msg: 'Onboarding GA', author: 'mobile@soexcellence.com', at: '2026-06-16T09:00:00Z' },
    preview: { sha: 'iii9999', url: previewUrl('feature/flutter-onboarding'), buildState: 'LIVE', builtAt: '2026-06-16T09:20:00Z' },
    devGate: { verdict: 'OK', sha: 'iii9999', by: 'tester@soexcellence.com', at: '2026-06-16T10:00:00Z' },
    prDev: {
      number: 77,
      url: `https://github.com/${ORG}/breakthroughs-flutter/pull/77`,
      state: 'MERGED',
      headSha: 'iii9999',
      checksState: 'success',
    },
    prodGate: { verdict: 'NONE' },
    prProd: { state: 'NONE' },
    testSummary: { conclusion: 'success', passed: 40, failed: 0, total: 40, at: '2026-06-16T09:25:00Z' },
    derivedStatus: 'DEV_MERGED',
    lastActivity: { type: 'dev_merged', sha: 'iii9999', actor: 'mobile@soexcellence.com', at: '2026-06-16T12:00:00Z' },
    reconcile: 'IN_SYNC',
    updatedAt: '2026-06-16T15:30:00Z',
  },

  // 10) Merged into development (terminal); shipped to prod earlier via a promotion.
  {
    id: 'starlabs-angular__feature/checkout-v2',
    repo: 'starlabs-angular',
    branch: 'feature/checkout-v2',
    headSha: 'jjj0000',
    headCommit: { msg: 'Checkout v2 GA', author: 'dev@soexcellence.com', at: '2026-06-10T09:00:00Z' },
    preview: { sha: 'jjj0000', url: previewUrl('feature/checkout-v2'), buildState: 'LIVE', builtAt: '2026-06-10T09:20:00Z' },
    devGate: { verdict: 'OK', sha: 'jjj0000', by: 'tester@soexcellence.com', at: '2026-06-10T10:00:00Z' },
    prDev: {
      number: 301,
      url: `https://github.com/${ORG}/starlabs-angular/pull/301`,
      state: 'MERGED',
      headSha: 'jjj0000',
      checksState: 'success',
    },
    prodGate: { verdict: 'NONE' },
    prProd: { state: 'NONE' },
    testSummary: { conclusion: 'success', passed: 62, failed: 0, total: 62, at: '2026-06-10T09:25:00Z' },
    unreleased: true,
    derivedStatus: 'DEV_MERGED',
    lastActivity: { type: 'dev_merged', sha: 'jjj0000', actor: 'dev@soexcellence.com', at: '2026-06-10T12:00:00Z' },
    reconcile: 'IN_SYNC',
    updatedAt: '2026-06-10T20:10:00Z',
  },

  // 11) DRIFT / NEEDS_DECISION — new commit landed after sign-off; the open PR → dev tip
  //     (kkk2222) has moved PAST the dev-gate sign-off sha (kkk1111): ships unreviewed code.
  {
    id: 'starlabs-cloud-function__feature/rate-limiter',
    repo: 'starlabs-cloud-function',
    branch: 'feature/rate-limiter',
    headSha: 'kkk2222',
    headCommit: { msg: 'Hotfix: off-by-one in window', author: 'dev@soexcellence.com', at: '2026-06-15T18:00:00Z' },
    preview: { sha: 'kkk1111', url: previewUrl('feature/rate-limiter'), buildState: 'LIVE', builtAt: '2026-06-15T14:20:00Z' },
    devGate: {
      verdict: 'OK',
      sha: 'kkk1111',
      by: 'tester@soexcellence.com',
      at: '2026-06-15T15:00:00Z',
      notes: [{ by: 'tester@soexcellence.com', at: '2026-06-15T15:00:00Z', text: 'OK for dev at kkk1111.' }],
    },
    prDev: {
      number: 150,
      url: `https://github.com/${ORG}/starlabs-cloud-function/pull/150`,
      state: 'OPEN',
      headSha: 'kkk2222', // ≠ devGate.sha → prHasUnreviewed true
      mergeable: true,
      checksState: 'pending',
    },
    prodGate: { verdict: 'NONE' },
    prProd: { state: 'NONE' },
    gateRun: {
      stage: 'dev',
      status: 'RUNNING',
      runId: '7050',
      runUrl: `https://github.com/${ORG}/starlabs-cloud-function/actions/runs/7050`,
      reportRunId: '7050',
      at: '2026-06-15T18:30:00Z',
    },
    testSummary: { conclusion: 'failure', passed: 57, failed: 1, total: 58, at: '2026-06-15T18:10:00Z' },
    derivedStatus: 'PR_TO_DEV',
    lastActivity: { type: 'push', sha: 'kkk2222', actor: 'dev@soexcellence.com', at: '2026-06-15T18:00:00Z' },
    reconcile: 'NEEDS_DECISION',
    updatedAt: '2026-06-15T18:10:00Z',
  },

  // 12) DEVELOPMENT — promotion hub. Integrated dev branch, ready to promote → production.
  {
    id: 'starlabs-angular__development',
    repo: 'starlabs-angular',
    branch: 'development',
    headSha: 'devtip7',
    headCommit: { msg: 'Merge billing-portal, search-ranking, checkout-v2', author: 'dev@soexcellence.com', at: '2026-06-18T12:00:00Z' },
    preview: { buildState: 'NONE' },
    devGate: { verdict: 'NONE' },
    prDev: { state: 'NONE' },
    prodGate: { verdict: 'NONE' },
    prProd: { state: 'NONE' },
    lastDeploymentState: 'success',
    hasUnreleased: true,
    promotable: false, // deployed, but awaiting the tester's "OK to promote" (Preview Channels)
    // Batch gate on the integrated development branch (preview-e2e on `development`) — shown on the
    // Release Channel so the admin sees the suite result before promoting development → production.
    gateRun: {
      stage: 'preview',
      status: 'PASSED',
      runId: '7800',
      runUrl: `https://github.com/${ORG}/starlabs-angular/actions/runs/7800`,
      reportRunId: '7800',
      sha: 'devtip7',
      at: '2026-06-18T12:21:00Z',
    },
    testSummary: { conclusion: 'success', passed: 64, failed: 0, total: 64, at: '2026-06-18T12:20:00Z' },
    derivedStatus: 'DEV_MERGED',
    lastActivity: { type: 'dev_merged', sha: 'devtip7', actor: 'dev@soexcellence.com', at: '2026-06-18T12:00:00Z' },
    reconcile: 'IN_SYNC',
    updatedAt: '2026-06-18T12:20:00Z',
  },

  // 13) PRODUCTION — receives the development → production promotion. Last release accepted (#480).
  {
    id: 'starlabs-angular__production',
    repo: 'starlabs-angular',
    branch: 'production',
    headSha: 'prodcur6',
    headCommit: { msg: 'Release 2026-06-10', author: 'dev@soexcellence.com', at: '2026-06-10T20:10:00Z' },
    preview: { buildState: 'NONE' },
    devGate: { verdict: 'NONE' },
    prDev: { state: 'NONE' },
    prodGate: { verdict: 'NONE' },
    prProd: {
      number: 480,
      url: `https://github.com/${ORG}/starlabs-angular/pull/480`,
      state: 'MERGED',
      headSha: 'prodcur6',
      checksState: 'success',
    },
    lastDeploymentState: 'success',
    gateRun: {
      stage: 'prod',
      status: 'PASSED',
      runId: '7900',
      runUrl: `https://github.com/${ORG}/starlabs-angular/actions/runs/7900`,
      reportRunId: '7900',
      at: '2026-06-10T19:30:00Z',
    },
    derivedStatus: 'PROD_MERGED',
    lastActivity: { type: 'prod_merged', sha: 'prodcur6', actor: 'dev@soexcellence.com', at: '2026-06-10T20:10:00Z' },
    reconcile: 'IN_SYNC',
    updatedAt: '2026-06-10T20:10:00Z',
  },
];

/** A small activity timeline for one branch (eventTime ascending). */
export const MOCK_ACTIVITY: ActivityLogEntry[] = [
  {
    branchId: 'starlabs-cloud-function__feature/rate-limiter',
    type: 'push',
    sha: 'kkk1111',
    actor: 'dev@soexcellence.com',
    source: 'webhook',
    confirmed: true,
    eventTime: '2026-06-15T13:00:00Z',
    receivedTime: '2026-06-15T13:00:05Z',
    detail: { msg: 'Initial rate limiter' },
  },
  {
    branchId: 'starlabs-cloud-function__feature/rate-limiter',
    type: 'preview_build',
    sha: 'kkk1111',
    actor: 'github-actions',
    source: 'webhook',
    confirmed: true,
    eventTime: '2026-06-15T14:20:00Z',
    receivedTime: '2026-06-15T14:20:10Z',
    detail: { buildState: 'LIVE' },
  },
  {
    branchId: 'starlabs-cloud-function__feature/rate-limiter',
    type: 'signoff_dev',
    sha: 'kkk1111',
    actor: 'tester@soexcellence.com',
    source: 'console',
    confirmed: true,
    eventTime: '2026-06-15T15:00:00Z',
    receivedTime: '2026-06-15T15:00:01Z',
    detail: { verdict: 'OK', note: 'OK for dev at kkk1111.' },
  },
  {
    branchId: 'starlabs-cloud-function__feature/rate-limiter',
    type: 'pr_to_dev',
    sha: 'kkk1111',
    actor: 'dev@soexcellence.com',
    source: 'console',
    confirmed: true,
    eventTime: '2026-06-15T15:30:00Z',
    receivedTime: '2026-06-15T15:30:02Z',
    detail: { number: 150, base: 'development' },
  },
  {
    branchId: 'starlabs-cloud-function__feature/rate-limiter',
    type: 'push',
    sha: 'kkk2222',
    actor: 'dev@soexcellence.com',
    source: 'webhook',
    confirmed: true,
    eventTime: '2026-06-15T18:00:00Z',
    receivedTime: '2026-06-15T18:00:04Z',
    detail: { msg: 'Hotfix: off-by-one in window' },
  },
];

/** Member roster for Settings. Covers each role + an inactive example. */
export const MOCK_MEMBERS: Member[] = [
  {
    email: 'dev@soexcellence.com',
    displayName: 'Dana Developer',
    roles: ['developer'],
    active: true,
    addedBy: 'admin@soexcellence.com',
    addedAt: Date.parse('2026-06-01T00:00:00Z'),
  },
  {
    email: 'tester@soexcellence.com',
    displayName: 'Tess Tester',
    roles: ['tester'],
    active: true,
    addedBy: 'admin@soexcellence.com',
    addedAt: Date.parse('2026-06-01T00:00:00Z'),
  },
  {
    email: 'admin@soexcellence.com',
    displayName: 'Avery Admin',
    roles: ['developer', 'tester', 'admin'],
    active: true,
    addedBy: 'admin@soexcellence.com',
    addedAt: Date.parse('2026-06-01T00:00:00Z'),
  },
  {
    email: 'former@soexcellence.com',
    displayName: 'Pat Former',
    roles: ['developer'],
    active: false,
    addedBy: 'admin@soexcellence.com',
    addedAt: Date.parse('2026-05-01T00:00:00Z'),
  },
];
