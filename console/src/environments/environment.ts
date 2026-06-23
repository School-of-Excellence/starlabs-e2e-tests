// Requires firebase.config.ts (gitignored). Copy firebase.config.example.ts and fill in keys.
import { firebaseConfig } from './firebase.config';

export const environment = {
  production: false,
  useMock: false,
  functionsRegion: 'us-central1',
  firebase: firebaseConfig,
  // Deployed cicd-audit history dashboard base URL. When set, the gate "View report"
  // link deep-links here by githubRunId; when empty, it falls back to the GitHub run page.
  historyDashboardUrl: '',
};
