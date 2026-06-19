// Requires firebase.config.ts (gitignored). Copy firebase.config.example.ts and fill in keys.
import { firebaseConfig } from './firebase.config';

export const environment = {
  production: false,
  useMock: false,
  functionsRegion: 'us-central1',
  firebase: firebaseConfig,
};
