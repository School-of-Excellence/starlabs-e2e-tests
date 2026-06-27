// Requires firebase.config.ts (gitignored). Copy firebase.config.example.ts and fill in keys.
import { firebaseConfig } from './firebase.config';

// Google sign-in only completes when the OAuth handler (authDomain) is SAME-ORIGIN as the
// app, or third-party storage is allowed (see specs/journals/2026-06-27-console-signin-fix.md).
// A single authDomain can't serve both environments, so pick it by host at runtime:
//   • deployed console (cicdconsole.web.app)  → same-origin handler, no third-party storage.
//   • localhost dev                           → the always-authorized default domain. It is
//     cross-origin to localhost, so local sign-in additionally needs third-party cookies
//     allowed for localhost (Chrome → Site settings), or the Firebase Auth emulator.
// NOTE: cicdconsole.web.app must be added to Firebase Auth → Authorized domains for prod,
// otherwise Google returns redirect_uri_mismatch.
const host = typeof window !== 'undefined' ? window.location.hostname : '';
const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '';
const authDomain = isLocalhost ? 'starlabs-cicd.firebaseapp.com' : 'cicdconsole.web.app';

export const environment = {
  production: false,
  useMock: false,
  functionsRegion: 'us-central1',
  firebase: { ...firebaseConfig, authDomain },
  // Deployed cicd-audit history dashboard base URL. When set, the gate "View report"
  // link deep-links here by githubRunId; when empty, it falls back to the GitHub run page.
  historyDashboardUrl: '',
  // Fixed deploy URLs per environment branch (operator-provided, D3 2026-06-26).
  environmentUrls: {
    development: 'https://breakthroughs-test.web.app/',
    production: 'https://breakthroughs.app/',
  } as Record<string, string>,
};
