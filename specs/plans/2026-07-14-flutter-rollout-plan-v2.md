# Flutter rollout plan v2 (breakthroughs-flutter)

> Status: **LOCKED** (decided interactively with the operator, 2026-07-14).
> **Supersedes:** `specs/plans/2026-07-02-flutter-rollout-plan.md` (parked v1).
> WHY over WHAT: rationale is inline on every changed decision. Flutter is an **independent**
> rollout track — not interconnected with the CF or Angular chains.
> Not yet implemented; this doc is the authoritative spec to build from.

---

## 1. Context & what changed from v1

v1 was parked with the production path undefined and modeled Flutter as a near-mirror of Angular
(web-preview spine, App Distribution for both stages, a production branch implied). Interactive
design on 2026-07-14 replaced several of those defaults. The net topology:

```
FEATURE BRANCH ──Deploy──► App Distribution (starlabs-CICD)   [dev-env + prod-env flavors, both OSes]
   developer            tester per-platform OK
      │
   Create PR→dev ──► allow-list merger merges on GitHub ──► DEV_MERGED  ◄── CONSOLE STOPS HERE
      │
      ▼ (auto CI, prod-env, both OSes)
   iOS → TestFlight            Android → Play INTERNAL testing (instant)
      │                            │
   tester per-platform OK      tester per-platform OK
      │                            │
   ADMIN publishes MANUALLY in the stores (no console button, no prod git branch):
   iOS  = App Store Connect: Submit → Apple review → MANUAL Release
   Android = Play Console: promote Internal → Production @ 100%
```

### Delta vs v1 (parked)
| Area | v1 (parked) | v2 (LOCKED) | WHY |
|---|---|---|---|
| Feature-stage build | 1 test build → App Dist | **2 flavors (dev-env + prod-env)**, both OSes → App Dist in **starlabs-CICD** | Testers validate against both backend envs and can hold both apps side-by-side (distinct appIds). |
| Android on dev-merge | App Distribution prod group | **Play Internal testing** | Wanted TestFlight-style **instant** delivery; Internal testing (≤100 testers, no review wait) is the true analog. Closed testing carries a Google review delay. |
| iOS on dev-merge | TestFlight | TestFlight (unchanged) | — |
| Production | undefined / prod branch implied | **No production branch**; store-level release only | Prod state belongs in the stores, not a git branch (mirrors CF's "no production branch" precedent). |
| Store release | undefined | **Manual**, admin, in App Store Connect / Play Console | Operator prefers the console to stop at DEV_MERGED; the irreducible manual parts (Apple review, final iOS Release, Play production review) can't be automated away, so a console button adds tracking complexity for little gain. |
| Sign-off | single gate (implied) | **Per-platform** (iOS + Android independent) | The delivery facet is per-platform; a build can pass on one OS and fail on the other. |
| Env identity / force-newest | not addressed | **Flutter flavors** + App Distribution **in-app-update SDK** | Flavors label test vs prod and allow side-by-side install; the SDK forces testers onto the newest build so no one reviews a stale version. |
| Web preview | flutter still in preview spine | **Removed** (see §9 drift) | Flutter has no web preview URL; the scaffold wrongly bucketed it as `web`. |

---

## 2. Environment identity — Flutter flavors (load-bearing)

Two build flavors, distinct application identity so test and prod installs **coexist** and are
**visibly labeled**:

- **dev-env** — appId `com.<app>.dev`, app name "… Dev", distinct icon badge.
- **prod-env** — appId `com.<app>` (the id that ships to the stores).

WHY it's load-bearing: any build carrying the **production appId** collides with any other build of
the same id (a device holds one at a time). Only the **dev-env** flavor (different id) can sit next
to a store/prod-env build. This is what makes "install the test version AND the production version
for feedback" possible — it happens at the **flavor** layer, not the store-track layer.

Per-env signing is required on both platforms (dev + prod signing configs).

---

## 3. Feature stage — developer builds & sends for testing

1. Developer cuts a **feature branch** off `development` and pushes. (Direct push to
   `development`/`production` is rejected by branch protection.)
2. Console → **Working Branches** → Flutter card → **Deploy ▾** (4 entries: *with tests* /
   *without tests*, plus the admin-only *"… & create PR → Dev"* shortcuts).
   - Reuses the existing `deployPreview` seam → `workflow_dispatch` into the Flutter
     **build+distribute** workflow (§10, not built).
   - CI builds **both flavors** (dev-env + prod-env) for **both platforms**:
     - Android → **test APK** per flavor.
     - iOS → **ad-hoc** build per flavor (UDID-managed; see §7 cost).
   - All four artifacts → **Firebase App Distribution** in project **starlabs-CICD**.
   - App Distribution **emails testers** on every new release. The **in-app-update SDK**
     (`firebase-appdistribution`) in the tester variant forces the newest build on launch —
     WHY: nobody should review a stale version.
   - CI POSTs per-platform status + install links → **`recordMobileRelease`** (§10) → writes the
     **`mobileDelivery`** facet → the card renders native-delivery badges (no preview URL).

---

## 4. Tester validation — per-platform sign-off

- Tester installs from App Distribution and tests **both platforms** (and, where relevant, both env
  flavors).
- **Per-platform sign-off:** iOS-OK and Android-OK are recorded **independently**; the stage
  advances only when **both** are OK.
- A **new push** to the feature branch re-validates (freshness logic clears the prior sign-off — the
  tester re-approves).
- Applies identically at the **feature stage** ("OK for dev") and the **dev-merge stage**
  ("OK to promote").

---

## 5. PR → development → merge

1. Developer → **Create PR → dev**: `createPullRequest { repo, head: branch, base: 'development' }`.
   Console opens the PR — it **never merges**.
2. A **GitHub allow-list merger** (`vignesh-027` · `CharanReddy-AH` · `GokulHavinashM` ·
   `Nandakumar23`; org admins = break-glass) reviews + merges on GitHub. Conflicts are resolved on
   the **feature** branch, never on the protected branch.
3. Webhook mirrors → card → **DEV_MERGED** (terminal for the feature in the console).

---

## 6. Dev-merge stage — prod-env delivery (auto CI)

On merge to `development`, CI builds the **prod-env** flavor, both platforms:

- **iOS → TestFlight** (production project).
- **Android → Play Internal testing** (instant, ≤100 testers) — **NOT** Closed testing.
  WHY: Internal testing has no review wait; Closed testing is Google-reviewed (hours–days).

Tester validates both (per-platform, §4). CI POSTs status → `recordMobileRelease`
(`ios.testflightBuild`, `android.internalTrackVersion`).

**Fallback (issue found, not releasing):** production is a *separate track/store*, untouched until
promoted, so testers can return to the live production build anytime:
- iOS: delete the TestFlight build → install from the App Store.
- Android: leave the internal-test program → uninstall the test build → reinstall from Play (prod).
Gotcha (both OSes): same appId ⇒ no side-by-side, no auto-downgrade ⇒ uninstall-then-reinstall.

---

## 7. Console boundary — the console STOPS at DEV_MERGED

- The console tracks **build/upload/distribution** state only and shows the **TestFlight** and
  **Play-internal** links. It does **not** track store-release state, has **no** Release buttons,
  **no** `releaseToStore` callables, and Flutter **skips the promotion-chain screens entirely**
  (no "Create PR → prod", no Release-Channel prod entry).
- WHY: the store release's irreducible steps (Apple review, the final manual iOS Release, Play's
  production review) can't be automated. A console trigger would add tracking surface for a step the
  admin still can't complete from the console — so we keep it out.

**iOS ad-hoc cost (feature stage):** every tester **device UDID** must be in the Ad Hoc provisioning
profile (max 100/yr); a new device ⇒ operator adds the UDID + a CI **rebuild** round-trip before that
tester can install. Android APKs install anywhere (no UDID tax).

---

## 8. Store release — MANUAL, admin, per-platform (decoupled)

No console involvement. Two **independent** per-platform actions (timelines differ).

**Android — promote Internal → Production (same App Bundle, no rebuild):**
1. Play Console → app → **Test and release → Testing → Internal testing → Releases**.
2. **Promote release → Production** (Internal → Production directly is allowed).
3. Confirm release notes → **rollout 100%** → Review → **Start rollout to Production**.
- Caveats: production is **Google-reviewed** (hours–days; longest on first submission); first
  production release is **blocked** until the store listing is complete (listing, content rating,
  data safety, target audience, pricing). **Managed publishing** (optional) holds go-live until the
  admin presses Publish — the Android analog of iOS manual release.

**iOS — TestFlight → App Store:**
1. App Store Connect → the app version → attach the TestFlight build.
2. **Submit for Review** → Apple approves.
3. **Manual Release** (operator's locked choice) — the admin presses Release to go live.

---

## 9. Console model & code changes

**Additive:**
- **`mobileDelivery` facet** on `ReleaseCandidate` (per-platform, build/upload/distribution ONLY —
  **no** store-release states, per §7):
  ```ts
  mobileDelivery?: {
    android?: { status: 'NONE'|'BUILDING'|'SENT'|'FAILED'; apkUrl?: string;
                internalTrackVersion?: string; at?: number };
    ios?:     { status: 'NONE'|'BUILDING'|'UPLOADED'|'FAILED'; adHocUrl?: string;
                testflightBuild?: string; at?: number };
  };
  ```
  Mirror in `console/functions/src/model.ts` and `console/src/app/core/release-candidate.model.ts`.
- **Per-platform gate verdicts** (iOS/Android) at feature + dev-merge stages — extend the gate model
  and `action-gating.ts` so a stage advances only when both platforms are OK.
- **`recordMobileRelease`** ingest fn (mirror of `recordPreviewUrl`, `CONSOLE_INGEST_TOKEN` bearer):
  writes `mobileDelivery` via `mutateCandidate`.
- **`mobile_release`** `ActivityType` in `activity.ts`.
- `repos.ts` flutter type → native-delivery badges, no preview URL, keeps the Deploy button.

**Drift to UNDO (Flutter was scaffolded as a web-preview repo):**
- `mock-data.ts` — remove the flutter cards' `preview.url` web-preview links.
- `index.ts` — drop `breakthroughs-flutter` from `recordPreviewUrl`'s `INGEST_REPO_ALLOWLIST`.
- UI gating — flutter currently falls into the default **`web`** bucket (only `cloud-function` is
  special-cased in `working-branches` / `preview-channels` / `release-channel`); add flutter handling
  (native badges + Deploy, excluded from preview-URL and promotion-chain views).

---

## 10. CI (breakthroughs-flutter) — build+distribute workflow (not built)

- **Working branch** (via console `workflow_dispatch`): build dev-env + prod-env, both platforms →
  **App Distribution** (starlabs-CICD). POST status/links → `recordMobileRelease`.
- **On merge to `development`**: build prod-env → iOS **TestFlight**, Android **Play Internal
  testing**. POST status/links → `recordMobileRelease`.
- Signing via **fastlane match**; Android upload to Play via the CI **service account**.

---

## 11. Operator prerequisites (cannot be automated)

- Apple Developer membership; **Ad Hoc provisioning profile** + tester **UDID** list; distribution
  cert in CI (fastlane match); TestFlight / App Store Connect credentials.
- **Google Play Console** account; the app registered; a **Google Cloud service account** wired into
  CI for Internal-testing uploads; a **complete store listing** (required before first production
  rollout).
- Firebase **App Distribution test group** on **starlabs-CICD**; App Distribution **in-app-update
  SDK** added to the tester variant.
- Flutter **flavors + per-env signing** (both platforms).
- **GitHub branch protection** on `breakthroughs-flutter` `development` (allow-list mergers). **No
  production branch.**

---

## 12. Build order (proposed; execute only on the operator's go)

1. Model: `mobileDelivery` facet + per-platform gate verdicts (both model files) — mock-verifiable.
2. Undo the web-preview drift (§9) + flutter UI handling — mock-verifiable.
3. Backend: `recordMobileRelease` + `mobile_release` activity (tsc-verified).
4. CI: build+distribute workflow in `breakthroughs-flutter` (needs operator prereqs §11).
5. Operator prereqs (§11) — parallel, blocks live proof.
6. Prove: feature Deploy → App Dist (both flavors) → per-platform OK → PR→dev → merge → DEV_MERGED →
   TestFlight + Play internal → manual store release.

## 13. Open items

None. All decisions locked 2026-07-14.
