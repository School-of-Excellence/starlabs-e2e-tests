# Test Suites Catalogue

> GENERATED from [`suites-manifest.json`](suites-manifest.json) by `scripts/gen-suites-doc.mjs` — do not hand-edit.
> The manifest (hub git @ main) is the single source of truth; it is mirrored one-way to Firestore
> `console-config/suites` for the console. Master plan: specs/plans/2026-07-02-test-orchestration-cf-rollout-architecture.md

| Suite | Title | CI-ready | Capture | Mandatory when (app paths) | CF paths |
|---|---|---|---|---|---|
| **queue** | Queue lifecycle | ✅ | all | `src/app/queue system/**` | `functions/components/queuesystem.js`<br>`functions/components/queue_atc_generation.js`<br>`functions/components/big-assignment.js`<br>`functions/components/big-level-aggregate.js`<br>`functions/components/ATC.js`<br>`functions/components/atc_alerts.js`<br>`functions/components/atc_helpers.js` |
| **journey** | Journey onboarding | ✅ | all | `src/app/Journey Onboarding/**`<br>`src/app/journey-onboarding-detail/**` | `functions/components/participantmetadata.js` |
| **business** | Business dashboard | ✅ | failure-only | `src/app/Business Dashboard/**`<br>`src/app/main-dashboard/**` | `functions/components/interimreport.js`<br>`functions/components/salescrm-updates.js` |
| **comms** | Communications | ✅ | failure-only | `src/app/Communication Center/**`<br>`src/app/Channel Communication/**`<br>`src/app/in-app-message-input/**` | `functions/components/communication.js` |
| **content** | Content | ✅ | failure-only | `src/app/content/**`<br>`src/app/content-upload-version2/**`<br>`src/app/video-player/**` | `functions/components/content.js` |
| **evomap** | Evolution mapping | ✅ | failure-only | `src/app/EvolutionMapping/**` | `functions/components/achievements.js` |
| **modes** | Participant modes | ✅ | failure-only | `src/app/participant-touchpoint/**`<br>`src/app/Participants Profile Management/**` | `functions/components/participantmode.js` |
| **authroles** | Auth & roles | ✅ | failure-only | `src/app/login/**`<br>`src/app/exceptionalrouting/**`<br>`src/app/route-configuration/**` | `functions/components/user_registration.js` |
| **workshops** | Workshops | ✅ | failure-only | `src/app/Workshop/**`<br>`src/app/New-Workshop/**`<br>`src/app/Scheduling/**` | `functions/components/workshop.js` |
| **appointments** | Appointments | ❌ local-only | failure-only | `src/app/appointment-dashboard/**` | `functions/components/appointment.js`<br>`functions/components/appointmentZoomIntegraion.js` |
| **events** | Events | ❌ local-only | failure-only | `src/app/Events/**` | — |
| **profiles** | Profiles | ❌ local-only | failure-only | `src/app/Participants Profile Management/**`<br>`src/app/ProfilePicture/**` | `functions/components/participantmetadata.js` |

## Cross-cutting paths (any match ⇒ ALL CI-ready suites run)

- app: `src/app/**/*.guard.ts`
- app: `src/app/shared/**`
- app: `src/app/app.routes.ts`
- app: `src/app/app.config.ts`
- app: `angular.json`
- app: `package.json`
- cf: `functions/index.js`
- cf: `functions/package.json`

## Areas (sub-routing)

### queue
- **studio** → `queue/studio-core.spec.ts queue/studio-session.spec.ts queue/invariants-selftest.spec.ts queue/loop-bound-selftest.spec.ts queue/oracle-selftest.spec.ts`
- **operator** → `queue/operator.spec.ts queue/selfmovable-gate.spec.ts queue/watch-videos.spec.ts queue/actors-health.spec.ts queue/authoring.spec.ts queue/cf-sideeffects.spec.ts queue/invariants-selftest.spec.ts queue/loop-bound-selftest.spec.ts queue/oracle-selftest.spec.ts`
- **big** → `queue/big-analytics.spec.ts queue/cross-db-lowerbound.spec.ts queue/invariants-selftest.spec.ts queue/loop-bound-selftest.spec.ts queue/oracle-selftest.spec.ts`

## CF predeploy gate (local, before every `firebase deploy`)

Specs the CF predeploy hook runs LOCALLY (emulator) before every firebase deploy — the ONLY CF quality gate (L13/L14). Fail = deploy blocked by the Firebase CLI.

- `cf-guards/no-retrigger-loop.spec.ts` (config `playwright.cf-guards.config.ts`)

## ⚠ Pending glob review (operator checklist §7.4)

- **journey** — cfPaths guess — review
- **business** — globs draft — review
- **evomap** — cfPaths guess — review
- **modes** — appPaths guess — review
