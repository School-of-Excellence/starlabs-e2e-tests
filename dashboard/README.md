# CI/CD History Dashboard (M7)

A login-gated single-page viewer for the append-only run history (`cicd-audit` in `starlabs-cicd`) written by
[`../scripts/history/record-run.cjs`](../scripts/history/record-run.cjs). Run list → run detail (with a link to
the archived Playwright report) → compare any two runs.

## Configure
1. `cp config.example.js config.js` and fill in the **starlabs-cicd** Firebase **web** config (gitignored).
2. Enable **Google** sign-in (Firebase Console → Authentication → Sign-in method).

## Firestore + Storage rules (read for signed-in maintainers; writes are server-only via the admin SDK)
```
// firestore.rules — add this match block
match /cicd-audit/{runId} {
  allow read: if request.auth != null;   // tighten to an allowlist/domain as needed
  allow write: if false;                 // only the service account (admin SDK) writes; it bypasses rules
}
```
```
// storage.rules — allow signed-in read of the archived reports
match /cicd-audit/{allPaths=**} {
  allow read: if request.auth != null;
  allow write: if false;
}
```

## Run / deploy
- Local: serve this folder, e.g. `npx serve dashboard` (or any static server) and open it.
- Hosted: deploy as a Firebase Hosting site/channel on `starlabs-cicd`
  (`firebase hosting:channel:deploy history --public dashboard --project starlabs-cicd`).
  The dashboard ships first/independently and can later merge with the E2E Studio console.

## Allure (cross-run trends — optional)
The dashboard covers per-run detail + compare. For trend charts across many runs, generate an Allure report
from the per-run Playwright results and accumulate `allure-report/history` between runs (e.g.
`allure generate --clean` over the merged blob reports). Wire it as a follow-up if trend lines are wanted on
top of the per-run history here.
