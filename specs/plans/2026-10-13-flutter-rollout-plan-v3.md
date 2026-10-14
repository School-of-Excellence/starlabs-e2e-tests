# Flutter rollout plan v3 (breakthroughs-flutter)

> Status: **LOCKED** (decided interactively with the operator, 2026-10-13).
> **Supersedes:** `specs/plans/2026-07-14-flutter-rollout-plan-v2.md` on every point below.
> v2 remains the reference for anything v3 does not restate (no production branch, manual store
> release, per-platform delivery facet).
> WHY over WHAT: rationale is inline on every changed decision.
> Not yet implemented. This doc is the authoritative spec to build from.

---

## 1. What changed from v2, and why

v2 modelled Flutter on the OLD console flow: a console **Deploy button** dispatching a build, both
platforms at the feature stage, artifacts to **Firebase App Distribution**, and per-platform
sign-off gating the stage. Since then the console cut over to the **new flow** (2026-09-09): the
Working Branches card is a four-stage pipeline — Preview, Suite check, Test run, Rollout — driven by
**push**, and the old flow's buttons were removed from that screen. v3 aligns Flutter to the new
flow and simplifies the delivery topology.

```
FEATURE BRANCH ──push──► 2 APK (dev-env + prod-env) ──► Firebase Storage, keep-latest
   developer           ║  parallel: suite check + test run
                       ▼
             tester installs, signs off
                       │
          Approve rollout ──► PR → development ──► allow-list merger merges
                       │
                       ▼
   development ──► 2 APK (dev-env + prod-env) ──► Firebase Storage
               └─► 1 prod-env iOS build ──────► TestFlight
                       │
                       ▼
                    STOP.  Nothing automated past this point.
                    Production rollout is MANUAL and DEFERRED (§8).
```

| # | Decision | v2 | v3 (LOCKED) | WHY |
|---|---|---|---|---|
| L1 | Feature-stage Android destination | App Distribution | **Firebase Storage**, keep-latest | Storage is already in production use on `starlabs-cicd` for archived Playwright reports, with an org-email read gate proven in `console/storage.rules`. "Keep only the latest" costs nothing to build: uploading to a fixed path IS the delete. App Distribution keeps release history forever and needs two service accounts plus a tester-group alias that 404s when wrong. |
| L2 | Artifacts per branch | 4 (2 platforms × 2 envs) | **2** (Android dev-env + prod-env) | Halves feature-stage builds. The reduction comes entirely from dropping iOS (L5), not from the Storage change. |
| L3 | Trigger | console **Deploy** button (`workflow_dispatch`) | **push** | Matches the new flow. The console card has no Deploy affordance any more. |
| L4 | Suite check + test run | not in v2 | **parallel with the builds** | Stage 2 and stage 3 of the new-flow card. Stage 3 is MANDATORY, not advisory — see §4. |
| L5 | iOS | both envs, both stages, ad-hoc + TestFlight | **prod-env only, on merge to `development` only** → TestFlight | Three reasons. (a) Xcode Cloud's free tier is 25 h/month and a Flutter iOS archive runs ~15–25 min; per-push iOS would exhaust it. (b) One bundle id means one App Store Connect app record and ONE TestFlight build list — four developers pushing feature branches would make that list unreadable, since build number and "what to test" notes are the only discriminator. Restricting TestFlight to `development` gives the lane exactly one meaning. (c) No second signing set, no second app record, no ad-hoc UDID tax. ACCEPTED COST: iOS is never exercised before merge, and never against `starlabs-test` at all — see §9. |
| L6 | Dev-merge delivery | prod AAB → Play Internal; iOS → TestFlight | **2 APK → Storage** + **1 prod iOS → TestFlight** | The `development` branch gets the same two-APK treatment as a feature branch, so testers can validate the merged state on either backend. |
| L7 | After dev-merge | Play Internal track, then manual promote | **NOTHING automated.** `development` is terminal; the Play Internal upload is **REMOVED** (2026-10-14) | Operator directive 2026-10-13: "development is the ultimate final boss branch". Production rollout is manual, on the operator's own schedule, and its design is DEFERRED to a later session. See §8 — this leaves a known, deliberate gap. |
| L8 | Artifact URL lifetime | n/a | **valid as long as the APK exists** | Operator directive 2026-10-13. This rules out V4 signed URLs (7-day maximum). See §5. |

---

## 2. Storage layout

One fixed path per branch per env. The overwrite is the delete — there is no cleanup code.

```
apks/<branch>/dev.apk     ← dev-env  build (Firebase project starlabs-test)
apks/<branch>/prod.apk    ← prod-env build (Firebase project fir-sample-aae4a)
```

`<branch>` keeps its slashes (`apks/feat/ios-testflight/dev.apk`); GCS object names treat them as
plain characters, so no sanitising is needed for storage — only for display.

Environment identity is unchanged from the 2026-07-15 implementation: the environment IS the
Firebase project the build is wired to, generated in CI with `flutterfire configure --project=<env>`.
`google-services.json`, `firebase_options.dart` and `GoogleService-Info.plist` are gitignored and
NEVER committed (public repo, operator directive 2026-07-15).

**Known gap — orphans.** Hosting channels auto-expired after 7 days; Storage objects do not. A
deleted branch leaves 2 APKs behind forever. Cost is trivial (~$0.026/GB/month) but it accumulates.
Needs either a bucket lifecycle rule or a `delete` webhook handler. NOT in the v3 build order —
logged here so it is not rediscovered as a surprise.

---

## 3. Stage 1 — Preview: build and store (on push)

A NEW workflow in `breakthroughs-flutter`. **Its filename AND display name must not contain
`preview`, `deploy` or `e2e`.**

WHY this is load-bearing: `handleWorkflowRun` matches tracked lanes by exact filename when the
webhook carries `workflow_run.path`, but falls back to the display NAME when it does not —
`isPreview = file ? file === 'preview.yml' : name.includes('preview')` (`index.ts:655`). A display
name containing one of those words would hand this workflow control of the OLD flow's
`preview.buildState`. This is also a latent hazard in the existing `mobile-preview.yml`, whose
display name is "Mobile Preview — build & distribute (feature stage)".

- Matrix, one runner per env (a single ubuntu runner has ~14 GB free; two Flutter release builds
  exhausted it on 2026-07-16). `fail-fast: false` so a dev-env failure does not hide a prod-env result.
- `concurrency: cancel-in-progress` per branch, and path filters `lib/**`, `pubspec.*`,
  `android/**`, `ios/**`.
- `flutter build apk --release` per env → upload to the fixed path (§2).
- POST `recordBranchChannel` per env, SUCCESS or FAILED, always.

---

## 4. Stages 2 and 3 — suite check and test run (parallel)

**Stage 2 — suite check.** `scripts/readiness` is Angular-specific: it resolves suite coverage from
`suites-manifest.json` `appPaths` globs and scans for `data-testid` literals. Flutter posts
`state: 'NOT_APPLICABLE'`, `canProceed: true`. `NOT_APPLICABLE` is already in the backend's
`SUITE_STATES` allowlist (`readiness.ts:72-82`), so no backend change is needed.

WHY not a fake `MATCHED`: Playwright covers web only; native UI is covered by `integration_test`.
Claiming coverage that does not exist would make the stage carry no information. A real Flutter
verdict (a `lib/**` ↔ `integration_test/**` manifest section) is PHASE 2, not now.

**Stage 3 — test run. THIS IS MANDATORY.** `approveRollout` enforces, server-side
(`index.ts:1294-1312`):

- `testSuiteStatus.run.state === 'PASSED'`
- `run.sha === candidate.headSha` (the run must cover the current head)

It does NOT read `testSuiteStatus.state` or `canProceed`. So stage 2 is advisory for the gate and
stage 3 is what actually gates. If `flutter-e2e.yml` does not POST `recordSuiteRun` with `PASSED`
and a matching sha, **every** Flutter approval requires an admin bypass with a recorded reason of at
least 10 characters.

`flutter-e2e.yml` in the Flutter repo is therefore retargeted from
`pull_request: branches: [cicd-dev, cicd-prod]` to **push**, and must POST `recordSuiteRun`.
Its hard gates stay `flutter test` and `flutter build web`; `flutter analyze` and the
`integration_test` smoke stay advisory/opt-in.

---

## 5. The artifact URL (L8)

L8 requires a URL that stays valid as long as the APK exists. Two mechanisms satisfy that; the
chosen one is **(a)**.

**(a) CHOSEN — store the object PATH; the console mints the download URL on demand.**
`@angular/fire` Storage `getDownloadURL()` at click time, gated by the existing org-email read rule.

- Validity: always valid while the object exists. No expiry, no token to go stale on overwrite.
- Access: fenced to signed-in `@soexcellence.com`, the same gate `console/storage.rules` already
  applies to archived reports — and the rules file's own comment anticipates exactly this
  (`@angular/fire` Storage client read).
- The APK is NOT world-readable. This matters: the **prod-env APK is built from unreviewed feature
  code against `fir-sample-aae4a` — live customer data**. A redistributable signed binary pointing
  at production should not sit behind a public capability URL.
- Cost: `ChannelFacet.url` carries a path, not an href, so the stage-1 template's
  `<a [href]="ch.url">` becomes a click handler that resolves then opens.

**(b) REJECTED — a pinned `firebaseStorageDownloadTokens` download URL.** Zero UI change, and
`ChannelFacet.url` would hold a real permanent href. Rejected because it is an unauthenticated
capability URL for a production-pointing binary. It would also require pinning the token metadata
explicitly on every upload — the default behaviour mints a new token when an object is replaced,
which would break the stored URL on exactly the overwrite this design depends on.

V4 signed URLs were ruled out by L8 (7-day maximum).

---

## 6. Stage 4 — rollout approval, PR, merge

Unchanged from the new flow, and shared with Angular:

1. Tester or admin calls `approveRollout { repo, branch }` → the console opens the PR → `development`.
   The console NEVER merges. An admin may approve despite a non-PASSED run only with
   `bypass: { reason }`, recorded on the candidate — never silent.
2. A merger from the allow-list merges on GitHub: `vignesh-027` · `CharanReddy-AH` ·
   `GokulHavinashM` · `Nandakumar23`; org admins are break-glass. Conflicts are resolved on the
   feature branch, never on the protected one.
3. Approval is pinned to a sha. A later push INVALIDATES it rather than silently stretching it to
   cover code nobody reviewed.

---

## 7. Dev-merge delivery (on push to `development`)

- Android: 2 APKs (dev-env + prod-env) → `apks/development/{dev,prod}.apk`.
  **The same workflow as §3 handles this** — `development` is just another branch name, and the
  artifact shape is identical, so its push trigger simply does not exclude `development`. ONE
  Android workflow total, which is the "easy build maintenance" the operator asked for.
- iOS: ONE prod-env archive → **TestFlight** (internal group). Option A, locked 2026-10-13.

**The iOS path is broken today and must be fixed first.** `ios/ci_scripts/ci_post_clone.sh`
installs `flutterfire_cli` (line 34) but never calls `flutterfire configure`, and
`lib/firebase_options.dart` is gitignored while `lib/main.dart:20` imports it. A fresh Xcode Cloud
clone therefore cannot compile — a hard failure on a missing import, not a silent degradation. The
script needs `flutterfire configure --project fir-sample-aae4a` added.

**WHERE THE TestFlight RESULT IS STORED — a projection defect to avoid.** `mobileDelivery` is
read by `deriveStatus` (`projection.ts:85-92`), and an ENVIRONMENT candidate has no `headSha`
(protected-branch pushes are skipped, `index.ts:359`), so its `covers()` gate returns true
unconditionally. Writing `mobileDelivery` on the `development` candidate would therefore make its
`derivedStatus` fall through to **`PREVIEW_LIVE`** — nonsense for a terminal branch. `previewStatus`
does NOT have this problem: the projection never reads it (branch-channels D4, 2026-08-19), so the
two Storage APKs are safe to POST for `development`.

Recommended fix, NEEDS OPERATOR SIGN-OFF because it touches shared projection code: guard the
preview/mobile lane in `deriveStatus` so environment candidates (`development`/`production`) skip
it. The guard is a no-op for Angular and CF candidates, which never carry `mobileDelivery`.

**Build number must be injected.** `pubspec.yaml:18` is `version: 1.0.110+121`, hardcoded, and no
workflow passes `--build-number`. TestFlight rejects a reused build number for a version string.
The same fix retires the stale-versionCode warning at `android-firebase-distribution.yml:106`.

---

## 8. Production rollout — DEFERRED (L7)

Nothing automated happens after dev-merge. `development` is terminal. The operator rolls out to the
stores manually, on their own schedule, and **the design of that step is deferred to a later
session**.

**Deliberate gap, recorded so it is not mistaken for an oversight:** v2 had the dev-merge step
upload a prod AAB to the Play **Internal testing** track, which is what the manual
"promote Internal → Production @ 100%" in Play Console promotes. Under L7 that automated upload is
out of scope, so there is currently **no automated path that puts an Android artifact anywhere the
Play Store can promote from**. An APK in Firebase Storage cannot be promoted, and the Play Store
wants an App Bundle. When the rollout step is designed, it will need either the AAB upload restored
or a manual AAB build.

**LOCKED 2026-10-14 — the Play Internal upload is REMOVED.** `android-firebase-distribution.yml`
exists only to build the prod AAB and push it to `track: internal`; with that removed the file has
no remaining job and is **deleted**. Consequence, accepted knowingly: until the rollout step is
designed, the only way to get an Android build into Play is to build an AAB by hand.

WHY delete rather than disable: a workflow left in place but unused is a trap — it still fires on
every push to `development`, still consumes a runner, and still reads as the intended path to the
next person who opens the repo.

iOS is unaffected: a TestFlight build is already the thing App Store Connect submits from, so the
manual iOS path (attach build → submit → Apple review → manual release) stays available.

---

## 9. Accepted costs

Stated plainly so no future session re-litigates them as discoveries.

1. **iOS is never verified before merge, and never against `starlabs-test`.** iOS-only defects —
   safe area, Cupertino widgets, keyboard and scroll behaviour, permission prompts, platform
   channels, file and date pickers, push handling — reach `development` unreviewed. Discovery moves
   after the merge, and `development` is what feeds TestFlight, so a broken iOS build sits there
   while the fix travels a fresh feature branch through the full cycle. There is no revert lane.
   The operator accepted this twice (2026-10-13).
2. **The Android feature-stage sign-off certifies half the product** while stage 4 reads as approval
   of the change as a whole.
3. **An unreviewed prod-env APK exists for every branch**, built against live customer data. The
   org-email read gate (§5a) is the only thing standing in front of it. Same class of trade-off the
   operator accepted for the Angular prod hosting channel on 2026-08-19.
4. **No tester notification, no tester list, no install receipts, no feedback channel** — all things
   App Distribution provided. The console card becomes the notification surface.
5. **Sideload friction:** testers must allow "install unknown apps" once per device.
6. The App Distribution **in-app-update force-newest SDK** cannot work. Verified NOT a regression:
   `firebase_app_distribution` was never added to `pubspec.yaml`, so it was planned and never built.
   Freshness is already enforced correctly, by sha-pinned sign-off that a push clears.

---

## 10. Code changes

**Hub — `console/functions/src/readiness.ts`**
1. `REPO_ALLOWLIST` (line 57) — add `breakthroughs-flutter`. Mirror `INGEST_REPO_ALLOWLIST` in `index.ts`.
2. `CHANNEL_URL_RE` (line 66) is hardcoded to `^https://(breakthroughs-test|star-labs)--[a-z0-9-]+\.web\.app/?$`.
   **This is the single most blocking fact in the plan**: `status: 'SUCCESS'` requires a url, so every
   Flutter POST would 400 today. Must accept the Storage object-path form chosen in §5a.
3. The `url` length cap of 300 — confirm it fits the path form (it does; raise only if §5b is ever revisited).

**Hub — `console/storage.rules`**
4. Add `match /apks/{allPaths=**} { allow read: if orgEmail(); allow write: if false; }`.
   The default-deny block at the bottom of the file makes `apks/**` unreadable otherwise. Writes stay
   server-only — CI uploads with a bearer token against the GCS JSON API, which bypasses rules, the
   same way `scripts/history/record-run.cjs` already does.

**Hub — console frontend**
5. Stage 1 of the Working Branches card: resolve the stored path to a download URL on click (§5a).
6. Mock fixtures for a Flutter candidate carrying `previewStatus` with Storage paths.

**`breakthroughs-flutter`**
7. NEW push-triggered build+store workflow (§3), filename and display name free of
   `preview`/`deploy`/`e2e`.
8. `flutter-e2e.yml` — retarget to push, POST `recordSuiteRun` (§4).
9. `ios/ci_scripts/ci_post_clone.sh` — add `flutterfire configure --project fir-sample-aae4a`;
   inject `--build-number` (§7).
10. Dev-merge Android: 2 APKs → Storage + `recordBranchChannel` POSTs (§7).
11. `mobile-preview.yml` — retire, or rename to drop `preview` from its display name (§3).
    `deployPreview`'s flutter branch (`index.ts:947`) dispatches it; with push-triggering it becomes a
    second writer of the same fields.
12. **DELETE `android-firebase-distribution.yml`** (§8) — its only job was the removed Play upload.

**Hub — `console/functions/src/projection.ts`**
13. Guard the preview/mobile lane so environment candidates skip it (§7). Needs sign-off: shared code.

---

## 11. Operator prerequisites

- Firebase Storage enabled on `starlabs-cicd` (the bucket exists; the console already provides
  Storage at `app.config.ts:21`, bucket `starlabs-cicd.firebasestorage.app`).
- `breakthroughs-flutter` Actions secrets: `BASE64JKS`, `KEYALIAS`, `STOREPASSWORD`, `KEYPASSWORD`,
  `POSTHOG_APIKEY` (release signing) · `FIREBASE_TOKEN` (flutterfire configure) ·
  a Storage-upload service account · `CONSOLE_INGEST_URL`, `CONSOLE_INGEST_TOKEN`.
- Firebase Functions secret `CONSOLE_INGEST_TOKEN`.
- App Store Connect: TestFlight **internal** tester group on `com.app.launchyourlegacy`.
- Xcode Cloud: a workflow on `development` only, with `FIREBASE_TOKEN` available to
  `ci_post_clone.sh`.
- GitHub branch protection on `development` with the allow-list mergers. No `production` branch.
- **DECISION NEEDED (the only one left):** where the dev-merge delivery renders, and with it the
  `deriveStatus` guard of §7. The `development` row in Working Branches has no pipeline — only PR
  markup. The Preview Channels screen WOULD show it unchanged (its `withPreview` filter has no
  protected-branch exclusion, `preview-channels.component.ts:86-93`), but "Preview channels" showing
  `development` reads oddly.

---

## 12. Build order

1. Hub backend: allowlist + `CHANNEL_URL_RE` + storage rules (§10.1-4). tsc-verifiable.
2. Hub frontend: stage-1 path resolution + mock fixture (§10.5-6). Mock-verifiable, AOT build.
3. Flutter: the push build+store workflow (§10.7). Needs the operator secrets.
4. Flutter: `flutter-e2e.yml` retarget + `recordSuiteRun` (§10.8). Unblocks `approveRollout`.
5. Flutter: iOS `ci_post_clone.sh` fix + build-number injection (§10.9) — blocks ALL iOS work.
6. Flutter: let the §3 workflow cover `development`; DELETE `android-firebase-distribution.yml` (§10.10, §10.12).
7. Resolve the two §11 decisions, then prove end to end: push → 2 APKs + suite check + test run →
   sign off → approve → PR → merge → 2 APKs for `development` + TestFlight → stop.

## 13. Open items

ONE: where the dev-merge delivery renders, and the `deriveStatus` guard that goes with it (§7, §11).
Play Internal was resolved 2026-10-14 — removed. Everything else was locked 2026-10-13.
