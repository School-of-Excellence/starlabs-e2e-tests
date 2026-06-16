// EMULATOR build environment — used by `ng build/serve --configuration emulator`.
//
// Connects the app to the LOCAL Firebase emulator (see src/main.ts "HERMETIC EMULATOR WIRING": it reads
// environment.useEmulators + environment.emulators and calls connect*Emulator before bootstrap).
//
// This file is intentionally NOT kept in the app repo (the app's src/environments/* is gitignored). It is
// supplied as a CI OVERLAY from the e2e test repo: queue-e2e.yml → e2e/ci/setup-emulator-config.sh copies
// it to src/environments/environment.emulator.ts before the emulator build.
//
// Demo project id + fake key ONLY (singleProjectMode emulator). Contains NO real secrets. Ports come from
// firebase.emulator.json (auth 9099, firestore 8080, functions 5001).
export const environment = {
  production: false,
  useEmulators: true,
  emulators: {
    firestore: { host: 'localhost', port: 8080 },
    auth: { url: 'http://localhost:9099' },
  },
  firebase: {
    apiKey: 'demo-emulator',
    authDomain: 'demo-slabs-queue.firebaseapp.com',
    projectId: 'demo-slabs-queue',
    storageBucket: 'demo-slabs-queue.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
  },
  watson: {},
  salescrm: {},
  df3CdnUrl: '',
  picovoiceAccessKey: 'demo',
};
