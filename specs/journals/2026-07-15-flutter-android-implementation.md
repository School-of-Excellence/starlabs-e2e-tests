# 2026-07-15 — Flutter Android delivery: console wiring + CI (Phase 1)

Implements `specs/plans/2026-07-14-flutter-rollout-plan-v2.md`. Android-first; iOS deferred.
This journal records the WHY behind the load-bearing choices made while building.

## Decisions locked this session (refine v2 plan)
- **Single bundle id** `com.soe.launchyourlegacy` (android) / `com.app.launchyourlegacy` (ios). One
  install at a time; NO side-by-side dev/prod. (Operator chose simplicity over side-by-side.)
- **Environment = Firebase project**, selected by **generating the Firebase config in CI per build**
  (`flutterfire configure --project=<env>`), NOT a `--dart-define` in-app flag. WHY: the app has **no
  env abstraction** — backend URLs are hardcoded inline across many files and `firebase_options.dart`
  is hardwired to `fir-sample-aae4a`. A real dev/prod split with no app refactor is achievable by
  wiring each build to the target project's Firebase config:
  - `test` → `starlabs-test`, `prod` → `fir-sample-aae4a`
  Firestore/Auth/Functions/FCM then resolve to the target project. RESIDUAL: the hardcoded non-Firebase
  OTP `cloudfunctions.net` URLs are NOT switched — accepted for now.
- **Firebase config files are gitignored, NEVER committed** (public repo — operator directive
  2026-07-15). `.gitignore` broadened to `google-services*.json` / `firebase_options*.dart` /
  `GoogleService-Info*.plist`. Both workflows run `flutterfire configure` per env at build time
  (auth via `FIREBASE_TOKEN` secret). The earlier committed-`-test`-config + swap approach was
  REPLACED by this (files deleted). Prod config that was tracked pre-ignore must be `git rm --cached`.
- **Feature stage** (console Deploy → `mobile-preview.yml`, `workflow_dispatch`): build BOTH envs →
  each project's **App Distribution** (`testers` group). **Dev-merge** (push→`development` →
  repointed `android-firebase-distribution.yml`): build prod-env AAB → **Play Internal testing**
  (instant TestFlight analog; Closed testing carries a review delay). Store publish (Internal→Prod)
  is MANUAL in Play Console — console stops at DEV_MERGED (Option A).
- **flutterfire configure** was run for `starlabs-test` (android only) to generate the test config;
  prod config backed up + restored so net repo change = two NEW files only.

## Console model / projection design (WHY)
- `mobileDelivery` facet = **per-platform → per-env delivery** (`android.test`, `android.prod`, …)
  + **per-platform sign-offs** (`devSignoff`/`prodSignoff`). Sign-off is per-platform (locked), NOT
  per-env: a tester OKs `android` once having tested it.
- **Reused the PREVIEW lane in `projection.ts`** rather than adding a new milestone: `mobileBuildState`
  derives BUILDING/LIVE/FAILED from `mobileDelivery`, and `deriveStatus` uses the web preview facet OR
  (flutter) that mobile state. So flutter advances NO_ACTION→PREVIEW_LIVE→OK_FOR_DEV with **zero new
  status ranks** and no churn to the promotion chain. A flutter candidate has `preview.buildState:
  'NONE'` and carries `mobileDelivery` instead.
- **Per-platform gate → aggregate**: `mobileAggregateVerdict` collapses per-platform sign-offs into the
  existing `devGate`/`prodGate.verdict` that the projection already reads. OK iff EVERY *delivered*
  platform has a fresh (sha===head) OK. WHY "delivered": during android-only phase, iOS is absent, so
  android-OK alone advances — and when iOS lands, both are required automatically, no code change.
- `signoff` callable + `firebase.service` gained an optional `platform`; web/CF path unchanged.
- `deployPreview` flutter branch dispatches `mobile-preview.yml` (new `MOBILE_PREVIEW_WORKFLOW`),
  writes `mobileDelivery` BUILDING, and SKIPS the web `preview-e2e.yml` gate.
- New ingest `recordMobileRelease` (bearer `CONSOLE_INGEST_TOKEN`) — mirror of `recordPreviewUrl`;
  flutter removed from the preview-URL allowlist (drift undo).

## State
- ✅ Backend (`index.ts`/`model.ts`/`projection.ts`/`candidate` untouched) + frontend
  (`release-candidate.model.ts`/`firebase.service.ts`/`action-gating.ts`/`mock-data.ts`/activity label)
  BOTH `tsc` green.
- ✅ Flutter: `mobile-preview.yml` (feature) + repointed `android-firebase-distribution.yml`
  (dev-merge → Play Internal) + `google-services-test.json` + `firebase_options_test.dart`.
- ⏳ PENDING: console **UI rendering** — native-delivery badges + per-platform sign-off buttons in
  `working-branches`/`preview-channels` (logic + service done; the templates still render the web
  preview affordances). iOS follow-up (fastlane + TestFlight + ad-hoc). Operator secrets (below).

## Pending — operator secrets
- `breakthroughs-flutter` Actions secrets: `FIREBASE_SA_TEST`, `PLAY_SERVICE_ACCOUNT_JSON`,
  `CONSOLE_INGEST_URL`, `CONSOLE_INGEST_TOKEN` (env `android-release`). Confirm `testers` group in
  starlabs-test; confirm prod `google-services.json`/`firebase_options.dart` are git-tracked; `git add`
  the two new `-test` files. GitHub App must allow `workflow_dispatch` on the repo.
- Firebase Functions secret: `CONSOLE_INGEST_TOKEN` (`firebase functions:secrets:set`).
