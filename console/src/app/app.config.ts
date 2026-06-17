import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';

// --- Firebase providers (TODO: wire once firebase.config.ts is filled in) -----------------
//
// When useMock=false (see src/environments/environment.ts) the console talks to the
// starlabs-cicd Firebase project. Uncomment and install @angular/fire + firebase, then add
// the providers below to `appConfig.providers`.
//
// import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
// import { provideAuth, getAuth } from '@angular/fire/auth';
// import { provideFirestore, getFirestore } from '@angular/fire/firestore';
// import { provideFunctions, getFunctions } from '@angular/fire/functions';
// import { firebaseConfig } from '../environments/firebase.config';
// import { environment } from '../environments/environment';
//
// const firebaseProviders = [
//   provideFirebaseApp(() => initializeApp(firebaseConfig)),
//   provideAuth(() => getAuth()),
//   provideFirestore(() => getFirestore()),
//   provideFunctions(() => getFunctions(undefined, environment.functionsRegion)),
// ];
// ------------------------------------------------------------------------------------------

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // TODO: ...firebaseProviders   (see block above) — needed only when useMock=false
  ],
};
