// Console environment flags.
//
// useMock: when true the board renders from in-memory fixtures and the action buttons
//          log instead of calling Cloud Functions — so the board renders offline for
//          review with no Firebase project wired up. Flip to false once
//          firebase.config.ts is filled in (see firebase.config.example.ts).
//
// The Cloud Functions region must match where the console's callable functions are
// deployed on starlabs-cicd.
export const environment = {
  production: false,
  useMock: true,
  functionsRegion: 'us-central1',
};
