# Flutter rollout plan (breakthroughs-flutter)

> Status: **SUPERSEDED (2026-07-14)** by `specs/plans/2026-07-14-flutter-rollout-plan-v2.md`.
> Kept for history only — do NOT build from this doc. Several decisions here were changed on
> 2026-07-14 (Android dev-merge → Play Internal testing not App Dist prod group; no production
> branch; manual store release; per-platform sign-off; dual dev/prod flavors at feature stage).
> See the v2 delta table for what changed and why.
>
> ~~Status: PARKED for a parallel session (2026-07-02). Decisions locked in this session; not yet
> implemented. CF and Flutter are independent rollout tracks — this doc covers Flutter only.
> WHY over WHAT: see the decision rationale inline.~~

---

## Context

Flutter (`breakthroughs-flutter`) gets its **own** rollout pipeline, analogous to Angular's — but
native delivery replaces the web preview channel. It is **not** interconnected with the CF rollout.

The console already models Flutter as a `ReleaseCandidate` (see `console/src/app/core/mock-data.ts`).
This plan adds native-delivery to that spine.

## Locked decisions (this session)

**Trigger model — mirrors Angular (dev clicks Deploy on a working branch):**
- On a **working/feature branch push**, the developer clicks **Deploy** in the console. This reuses
  the existing `deployPreview` seam (a `workflow_dispatch` → a Flutter build+distribute workflow; CI
  does the build). There is a console Deploy button for Flutter (unlike CF, which has none).

**Working-branch deploy → Firebase App Distribution (BOTH platforms):**
- Android **test APK** → Firebase App Distribution.
- iOS **ad-hoc build** → Firebase App Distribution (**Option B**, UDID-managed).
- WHY Option B (not TestFlight for previews): there are **multiple concurrent preview branches**, and a
  tester must be able to install a **specific feature build** and approve it independently. App
  Distribution models many parallel ad-hoc builds cleanly; TestFlight stacks all builds under one app
  record and fits a single release train, not N parallel feature previews.
- COST accepted: iOS ad-hoc requires an Ad Hoc provisioning profile with every tester **device UDID**
  registered (max 100/yr), CI re-signing (fastlane match), and a **rebuild round-trip** whenever a new
  tester device appears. Android APKs install anywhere (no UDID tax).

**On merge to `development`:**
- iOS → **TestFlight** (production project).
- Android → **Firebase App Distribution** (prod group) — chosen over Play Internal testing to avoid
  Play Console + service-account setup for now. (Play **Internal testing track** is the TestFlight
  analog if we later want symmetry; **Internal App Sharing** ≈ App Distribution for quick links.)

**Slack:** dropped. Firebase App Distribution's own tester notifications are sufficient — no Slack post.

**No web preview URL** for Flutter — App Distribution / TestFlight links replace it on the card.

## Console model additions

- New **`mobileDelivery`** facet on `ReleaseCandidate`:
  ```ts
  mobileDelivery?: {
    android?: { status: 'NONE'|'BUILDING'|'SENT'|'FAILED'; apkUrl?: string; at?: number };
    ios?:     { status: 'NONE'|'BUILDING'|'UPLOADED'|'FAILED'; adHocUrl?: string; testflightBuild?: string; at?: number };
  };
  ```
- `repos.ts` type map marks `breakthroughs-flutter` as `flutter` → card shows native-delivery badges
  instead of a preview URL; keeps the Deploy button.
- New `ActivityType`: `mobile_release`.
- New ingest fn **`recordMobileRelease`** (mirror of `recordPreviewUrl`, `CONSOLE_INGEST_TOKEN` bearer):
  Flutter CI POSTs per-platform status + links → writes the `mobileDelivery` facet via `mutateCandidate`.

## Workflow (breakthroughs-flutter)

Build+distribute workflow (hub-reusable or repo-local, TBD):
- Working branch (via console `workflow_dispatch`): build Android + iOS → **App Distribution**.
- On merge to `development`: iOS → **TestFlight**, Android → **App Distribution** (prod group).
- After each step, POST status/links to `recordMobileRelease`.

## Operator items (cannot be automated)
- Apple Developer membership; **Ad Hoc provisioning profile** + tester **UDID** list; distribution
  cert in CI (fastlane match).
- TestFlight / App Store Connect credentials.
- Firebase App Distribution groups (test + prod) on the target project(s).

## Open / deferred
- **Production path** (merge to `production`): store submission vs prod App Distribution — undefined.
- Firebase project mapping for App Distribution (which project holds the test vs prod groups) — to
  confirm in the parallel session.
- Whether to later mirror Android to Play Internal testing for dev/prod symmetry.
