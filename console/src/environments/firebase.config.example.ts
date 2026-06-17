// Copy to firebase.config.ts (gitignored) and fill with the starlabs-cicd Firebase WEB app config.
// Firebase Console → Project settings → General → Your apps → Web app → SDK setup → Config.
//
// Note: the board can render WITHOUT this file via mock-data mode — see environment.ts
// (set `useMock: true`), which is the default for offline review.
export const firebaseConfig = {
  apiKey: '…',
  authDomain: 'starlabs-cicd.firebaseapp.com',
  projectId: 'starlabs-cicd',
  storageBucket: 'starlabs-cicd.appspot.com',
  messagingSenderId: '…',
  appId: '…',
};
