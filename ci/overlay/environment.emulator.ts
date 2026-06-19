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
    // projectId = starlabs-cicd (the sanctioned CICD test project) so Angular reads the SAME emulator
    // partition the seed + the Flutter app use (the Firestore emulator partitions data by project id).
    // apiKey/appId are dummy: main.ts calls connect*Emulator before any network use, so they're never
    // validated against the real project. Comment header note: emulator is forced via environment.useEmulators.
    apiKey: 'demo-emulator',
    authDomain: 'starlabs-cicd.firebaseapp.com',
    projectId: 'starlabs-cicd',
    storageBucket: 'starlabs-cicd.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000',
    vapidKey: '', // FCM web-push key — unused in the emulator env (comms/FCM sends disabled/stubbed); present so authguard.service.ts:1268 type-checks
  },
  // null (NOT {}): the journey purchase/saleslead screens call initializeApp(environment.watson|salescrm)
  // ONLY when the key is truthy. An empty {} -> initializeApp({}) -> "projectId not provided" FATAL console
  // error that trips the suite's console guard. null is falsy -> the app skips the secondary Watson/SalesCRM
  // app init entirely (matches the cloud TEST env, which omits these keys). We never drive a Watson/SalesCRM action.
  watson: null,
  salescrm: null,
  df3CdnUrl: '',
  picovoiceAccessKey: 'demo',
};
