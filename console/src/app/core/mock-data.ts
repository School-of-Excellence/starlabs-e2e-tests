import { ReleaseCandidate } from './release-candidate.model';

/**
 * Offline fixtures so the board renders for review without a Firebase project.
 * One candidate per status so the chips and button-gating are all visible at a glance.
 * Enabled by environment.useMock (src/environments/environment.ts).
 */
export const MOCK_RELEASE_CANDIDATES: ReleaseCandidate[] = [
  {
    id: 'feature/voice-search',
    repo: 'starlabs-angular',
    branch: 'feature/voice-search',
    status: 'NO_ACTION',
    previewUrl: 'https://starlabs-test--feature-voice-search.web.app',
    reportRunId: 'web-20260617-a1b2c3d',
    notes: [{ by: 'qa@soexcellence.com', at: '2026-06-17T09:12:00Z', text: 'Preview up, e2e green. Awaiting visual QA.' }],
    updatedAt: '2026-06-17T09:12:00Z',
  },
  {
    id: 'feature/booking-redesign',
    repo: 'starlabs-angular',
    branch: 'feature/booking-redesign',
    status: 'OK_TO_RELEASE',
    previewUrl: 'https://starlabs-test--feature-booking-redesign.web.app',
    reportRunId: 'web-20260617-e4f5a6b',
    okToReleaseBy: 'reviewer@soexcellence.com',
    notes: [{ by: 'reviewer@soexcellence.com', at: '2026-06-16T18:40:00Z', text: 'Looks good — signed off. Dev may open PR → dev.' }],
    updatedAt: '2026-06-16T18:40:00Z',
  },
  {
    id: 'feature/cf-triggers',
    repo: 'starlabs-cloud-function',
    branch: 'feature/cf-triggers',
    status: 'PR_TO_DEV',
    reportRunId: 'cf-20260615-c7d8e9f',
    prDevUrl: 'https://github.com/soexcellence/starlabs-cloud-function/pull/142',
    notes: [{ by: 'dev@soexcellence.com', at: '2026-06-15T14:05:00Z', text: 'PR → dev open, gate re-run pending review.' }],
    updatedAt: '2026-06-15T14:05:00Z',
  },
  {
    id: 'feature/profile-cohorts',
    repo: 'starlabs-angular',
    branch: 'feature/profile-cohorts',
    status: 'DEV_MERGED',
    previewUrl: 'https://starlabs-test--feature-profile-cohorts.web.app',
    reportRunId: 'web-20260614-1a2b3c4',
    prDevUrl: 'https://github.com/soexcellence/starlabs-angular/pull/318',
    updatedAt: '2026-06-14T11:20:00Z',
  },
  {
    id: 'feature/flutter-onboarding',
    repo: 'breakthroughs-flutter',
    branch: 'feature/flutter-onboarding',
    status: 'PR_TO_PROD',
    reportRunId: 'flutter-20260612-9z8y7x6',
    prDevUrl: 'https://github.com/soexcellence/breakthroughs-flutter/pull/77',
    prProdUrl: 'https://github.com/soexcellence/breakthroughs-flutter/pull/79',
    updatedAt: '2026-06-12T16:00:00Z',
  },
  {
    id: 'feature/checkout-v2',
    repo: 'starlabs-angular',
    branch: 'feature/checkout-v2',
    status: 'PROD_MERGED',
    previewUrl: 'https://starlabs-test--feature-checkout-v2.web.app',
    reportRunId: 'web-20260610-deadbee',
    prDevUrl: 'https://github.com/soexcellence/starlabs-angular/pull/301',
    prProdUrl: 'https://github.com/soexcellence/starlabs-angular/pull/305',
    notes: [{ by: 'reviewer@soexcellence.com', at: '2026-06-10T20:10:00Z', text: 'Shipped to production. ✅' }],
    updatedAt: '2026-06-10T20:10:00Z',
  },
];
