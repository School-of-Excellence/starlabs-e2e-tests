# 2026-10-17 — Flutter v3: the push gate, the manifest, and what the evidence actually showed

> WHY-journal per the CLAUDE.md rule. Plan: `specs/plans/2026-10-13-flutter-rollout-plan-v3.md`
> (written this session, supersedes v2). Read both before changing anything in the Flutter lane.
>
> Long session, mostly spent discovering that several things we believed were true were not. The
> decisions are cheap to re-derive; the **findings** are not. Those are the point of this file.

---

## 1. The flow, as locked

```
push (any OS, nothing runs locally)
  ├─ branch-apks.yml   path-filtered · per-ref concurrency · matrix dev|prod
  │    flutterfire configure → flutter build apk --release
  │    → apks/<branch>/{dev,prod}.apk in Storage   (fixed path: the upload IS the delete)
  │    → recordBranchChannel  BUILDING → SUCCESS|FAILED
  └─ flutter-e2e.yml   NO path filter · ~2 min
       flutter analyze (errors only) + flutter test  → recordSuiteRun

tester installs the APK from the card → Approve (run PASSED && run.sha === headSha)
  → PR to development → allow-list merger merges

push to development
  ├─ 2 APKs → Storage
  └─ 1 prod-env iOS build → TestFlight        build number AUTO, build name MANUAL

STOP. development is terminal. Production rollout is manual and its design is DEFERRED.
```

## 2. Decisions, with the reasoning that is expensive to recover

| # | Decision | Why |
|---|---|---|
| D1 | Feature-stage artifacts go to **Firebase Storage**, not App Distribution | Storage is already in production use here for archived Playwright reports, with an org-email read gate proven in `console/storage.rules`. "Keep only the latest" costs nothing to build: uploading to a fixed path *is* the delete. App Distribution keeps history forever and needs two service accounts plus a tester-group alias that 404s when wrong. |
| D2 | `previewStatus.<env>.url` carries the Storage **object path**, not a URL | A V4 signed URL expires at 7 days. A pinned download token is a public capability URL — unacceptable for a signed binary built from unreviewed code against `fir-sample-aae4a` (live customer data). The console mints a link at click time behind the org-email rule. Costs one template change; `isApkRef()` tells the shapes apart. |
| D3 | iOS = **prod-env only, on merge to `development`** (option A) | One bundle id means one TestFlight build list. Feature-branch builds would make it unreadable — build number and "what to test" notes are the only discriminator. Plus Xcode Cloud's free tier is 25 h/month and an iOS archive is 15–25 min. |
| D4 | **Play Internal upload REMOVED**; `android-firebase-distribution.yml` deleted | Operator: "after dev-merge, nothing happens". Deleted rather than disabled — a workflow left in place still fires, still burns a runner, and still reads as the intended path to the next person. **Known consequence: there is now no automated route to anything Play can promote.** Accepted; tied to the deferred rollout design. |
| D5 | Gate = `flutter analyze` + `flutter test`. **`flutter build web` dropped** | It existed as a whole-app compile check from when web was the intended integration host. Web cannot host these tests (§3). Compilation is proven instead by `branch-apks.yml` building two real APKs every push. |
| D6 | analyze is a **hard gate on `error` severity only** | Default `flutter analyze` fails on any finding; the project reports 1,848, nearly all `info` lints. `--no-fatal-infos --no-fatal-warnings` narrows it to "this does not compile" — 0 today, and worth blocking on. |
| D7 | `flutter-e2e.yml` is push-triggered with **no `paths:` filter** | `approveRollout` requires `run.sha === headSha`. Path-filter this and a README-only commit moves the head, skips the gate, and strands the branch — approval becomes impossible with nothing able to unstick it. The *expensive* lane keeps its filter. |
| D8 | Build **number** automatic (`github.run_number`), build **name** manual | TestFlight rejects a reused build number for a version string, so the second dev-merge would fail. The marketing version is a judgement call and stays in `pubspec.yaml`. |
| D9 | Manifest classifies **active vs retired by reachability**, not by filename | Name patterns are wrong in both directions — `mastercalendar-clone.dart` looks retired and is live (`events_test` imports it); plenty of current-looking files are unreachable. Retired means one thing only: *a change there never blocks*. |
| D10 | Suite→bucket mapping **deferred** to the simulator work | Nothing consumes it until the native suite runs in CI. |
| D11 | Tests run **serially**, never in parallel | Operator: they share one database and the data flow between them matters. This rules out the fan-out-across-runners option that would otherwise turn hours into ~30 min. |
| D12 | No test may require a developer's own machine | Developers are on Windows, Ubuntu and Mac. (Note: a *self-hosted runner* is one shared machine CI dispatches to — it does not violate this, and stays on the table.) |

## 3. Findings — the expensive part

**The Flutter suite does not run on the emulator.** `e2e_firebase.dart:35` defaults `QUEUE_E2E_TARGET` to `cloud`; all 11 green buckets ran against `slabs-queue-e2e-exdcz`, a real disposable project. Safety comes from a hard project allowlist (`kForbiddenProjectIds` includes production), not from the emulator. Several hours of this session assumed otherwise.

**Playwright cannot drive Flutter web, ever.** Flutter web renders the whole UI into one `<canvas>` — no DOM, nothing for a selector to match. Separately, the app has 7+ plugins with no web implementation (`flutter_callkit_incoming`, `qr_code_scanner_plus`, `record`, `better_player_plus`, …). Web is a compile target, not a test host. The opt-in web-integration leg should stay off.

**The evidence behind `RESULTS.md` is gone.** `mobile-evidence/` is empty: it is gitignored (lines 36, 117) and `run-flutter-test.cjs:90` wipes prior frames each run. The 171 screenshots existed only on the machine that produced them. RESULTS.md is credible — it names specific bugs found — but the claim is not reproducible without re-running.

**`appointments_test.dart` had not compiled since a redesign.** It asserted `find.byType(CalendarMonthCard)`, but the live `lib/mastercalendar.dart` no longer declares it — the class survives only in the retired `mastercalendar_old.dart` and the Delivery Event clone. `flutter analyze` caught it within 15 seconds of becoming a gate, a month after RESULTS.md recorded that bucket green. **This is the argument against ever scoping analyze to `lib/` only.** Assertion removed on the operator's call (the month grid is gone for good).

**95% of analyze noise was one vendored package.** 39,993 findings → 1,848 after excluding `packages/flutter_icons_null_safety/**`. The first attempt excluded `packages/**` and silently dropped `packages/sim_stubs/` — **first-party** no-op stubs for ML Kit and ffmpeg, which exist because those pods ship no arm64-simulator slice and are wired in via a gitignored `pubspec_overrides.yaml`. Narrowed. Including them costs 2 info findings and 0 errors. Verified afterwards: **259/259 `lib` files analyzed, 0 excluded.**

**The iOS CI path cannot compile.** `ios/ci_scripts/ci_post_clone.sh` installs `flutterfire_cli` (line 34) but never runs `flutterfire configure`, while `lib/main.dart:20` imports the gitignored `firebase_options.dart`. A fresh Xcode Cloud clone fails on a missing import. Broken since the 2026-07-15 gitignore change; the Android workflows were fixed then, this script never was.

**`maybeDispatchSuites` already existed and would have blocked Flutter** — it requires `state === 'MATCHED'` *and* a non-empty suites list, both operator decisions, and Flutter's `NOT_APPLICABLE` with zero suites fails both. This turned out not to matter: that mechanism exists to *trigger* a separate test workflow, and the gate now runs analyze and test in one push-triggered workflow that reports its own result. Recorded because the next person to add a Flutter dispatch will hit it.

**`approveRollout` reads only the run** (`index.ts:1294-1312`) — `run.state === 'PASSED'` and `run.sha === headSha`. It never reads `previewStatus` or `canProceed`. So a branch is approvable with **no successful APK at all**. Operator accepted: "if APK build failed, that's okay, we can build manually."

**The suite is not iOS-bound.** The 16 Dart test files contain zero `Platform.` / `dart:io` / `TargetPlatform` references. All iOS coupling is five spots in one 130-line file (`run-flutter-test.cjs`: `simctl` device discovery, the `idb` prompt tap, bundle id, terminate, screenshot). Android equivalents are one-liners each. **This makes an Android emulator on a Linux runner the realistic path to native tests in CI** — Linux pricing, no Mac, and it matches what Phase 1 actually ships.

**Codebase shape**, measured: 259 `lib` files · 180 reachable from `main.dart` · 79 unreachable · 85 referenced by a test (33%). Of the 79: 9 are superseded twins, 47 have no reference anywhere, 23 needed judgement. Operator reviewed and approved.

## 4. Built this session

- **Gate**, verified locally — `analyze` + `test`, **19s**, exit 0 both. Hub `flutter-e2e.yml` (analyze promoted to hard gate, `build web` removed, artifact upload now conditional on `run_integration`); app `analysis_options.yaml` (narrowed exclude) and `flutter-e2e.yml` caller (push, no path filter, dead `if:` removed).
- **`branch-apks.yml`** — new, YAML-valid, not yet run.
- **Console backend** — `readiness.ts`: `breakthroughs-flutter` added to `REPO_ALLOWLIST` (NOT to index.ts's `INGEST_REPO_ALLOWLIST`, which gates the *web preview URL* ingest and excludes flutter on purpose); `channelRefOk()` accepts `apks/**` object paths with explicit traversal rejection. `console/storage.rules`: `apks/**` org-email read, server-only write. tsc clean.
- **Console frontend** — stage 1 renders a download button for a path, anchor for a URL; resolution reuses `artifactUrl()`. Mock fixture `breakthroughs-flutter__feature/offline-cache`. tsc + production AOT build clean.
- **Manifest review** — `specs/flutter-manifest-review.md`, three confidence tiers, operator-approved.

## 5. Pending

1. `recordSuiteRun` + `recordSuiteStatus` posted from the gate — without the former, every Flutter approval needs an admin bypass.
2. Dev-merge workflow: 2 APKs + App Store Connect, with `--build-number=${{ github.run_number }}`.
3. Land the manifest as a file and move the reachability script into `scripts/readiness/` — it is still in a scratchpad.
4. Fix `ci_post_clone.sh` before any iOS CI work.
5. Native tests in CI: port the five functions in `run-flutter-test.cjs` to Android, then re-prove one bucket.
6. Re-establish evidence — the last known green run was a month ago and one bucket was broken.

## 6. Open

- **No Android store path** (D4).
- **Nothing in CI tests behaviour** — the gate proves compilation plus 6 unit tests about a text-controller pattern.
- A push that revokes an approval leaves the **PR open** on GitHub; a merger reading only GitHub could merge it.
- ATC is now testable on the Angular side (emulator-only, three guards, 2026-10-13). The Flutter harness has the same gap Angular's `main.ts` had: `e2e_firebase.dart` redirects the default DB, `formsDb()` and Auth to the emulator, but **not** `firestore-atc`.
