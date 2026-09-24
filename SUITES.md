# Test Suites Catalogue

> GENERATED from [`suites-manifest.json`](suites-manifest.json) by `scripts/gen-suites-doc.mjs` — do not hand-edit.
> The manifest (hub git @ main) is the single source of truth; it is mirrored one-way to Firestore
> `console-config/suites` for the console. Master plan: specs/plans/2026-07-02-test-orchestration-cf-rollout-architecture.md

| Suite | Title | CI-ready | Capture | Mandatory when (app paths) | CF paths |
|---|---|---|---|---|---|
| **queue** | Queue lifecycle | ✅ | all | `src/app/queue system/**`<br>`src/app/big/**`<br>`src/app/OpenVidu/**`<br>`src/app/LiveKit/**`<br>`src/app/Participants Profile Management/participants-analytics/wati-input/**`<br>`src/app/Participants Profile Management/participants-analytics/email-input/**`<br>`src/app/Participants Profile Management/participants-analytics/ah-notification/**`<br>`src/app/Participants Profile Management/participants-analytics/manage-participantlist-dialog/**`<br>`src/app/Participants Profile Management/participants-analytics/tag-participants/**`<br>`src/app/Participants Profile Management/participants-analytics/add-queue-tag/**`<br>`src/app/Participants Profile Management/participants-analytics/bulk-add-products/**`<br>`src/app/Participants Profile Management/participants-analytics/map-recommendedplaylist-toparticipant.component/**`<br>`src/app/AppEngagement/app-action-pending/**`<br>`src/app/Product Designer/delivery-set/form-option/**`<br>`src/app/Product Designer/delivery-set/form-template-preview/**`<br>`src/app/Product Designer/delivery-set/formtemplate/**`<br>`src/app/Channel Communication/channel-communication/**`<br>`src/app/Events/events-stage-data/**`<br>`src/app/EvolutionMapping/evolution-mapping/participant-evolution-mapping/**`<br>`src/app/video-player/**`<br>`src/app/instance-status.service.ts`<br>`src/app/web-studio-invitation/**`<br>`src/app/LiveKit-Cloud/**`<br>`src/app/openvidu-loading-game/**` | `functions/components/queuesystem.js`<br>`functions/components/big-assignment.js`<br>`functions/components/big-level-aggregate.js`<br>`functions/components/queue-required-stage-aiatc-creation/**` |
| **journey** | Journey onboarding | ✅ | all | `src/app/Journey Onboarding/**`<br>`src/app/journey-onboarding-detail/**`<br>`src/app/Participants Profile Management/journey-product-purchase/**`<br>`src/app/Participants Profile Management/participant-product/**`<br>`src/app/Participants Profile Management/participant-delivery-sequence/**`<br>`src/app/Product Designer/**`<br>`src/app/Participants Profile Management/new-profile/**`<br>`src/app/Participants Profile Management/participants-analytics/email-input/**` | `functions/components/participantmetadata.js` |
| **business** | Business dashboard | ✅ | failure-only | `src/app/Business Dashboard/**`<br>`src/app/main-dashboard/**`<br>`src/app/quiz/**`<br>`src/app/hpc/**`<br>`src/app/Zone Management/**`<br>`src/app/New-Workshop/quiz/**` | `functions/components/interimreport.js`<br>`functions/components/salescrm-updates.js` |
| **comms** | Communications | ✅ | failure-only | `src/app/Communication Center/**`<br>`src/app/Channel Communication/**`<br>`src/app/in-app-message-input/**`<br>`src/app/Customer Support/releaselogdialog/**` | `functions/components/communication.js` |
| **content** | Content | ✅ | failure-only | `src/app/content/**`<br>`src/app/content-upload-version2/**`<br>`src/app/video-player/**` | `functions/components/content.js` |
| **evomap** | Evolution mapping | ✅ | failure-only | `src/app/EvolutionMapping/**` | `functions/components/achievements.js` |
| **modes** | Participant modes | ✅ | failure-only | `src/app/participant-touchpoint/**`<br>`src/app/Participants Profile Management/**`<br>`src/app/quiz/**`<br>`src/app/New-Workshop/quiz/**`<br>`src/app/video-player/**`<br>`src/app/Customer Support/add-issue/**`<br>`src/app/AppEngagement/**` | `functions/components/participantmode.js` |
| **authroles** | Auth & roles | ✅ | failure-only | `src/app/login/**`<br>`src/app/exceptionalrouting/**`<br>`src/app/route-configuration/**`<br>`src/app/route-configuration-duplicate/**`<br>`src/app/slackwebhookurls/**`<br>`src/app/updatesnackbar/**`<br>`src/app/icon-list.ts`<br>`src/app/authloading/**` | `functions/components/user_registration.js` |
| **workshops** | Workshops | ✅ | failure-only | `src/app/Workshop/**`<br>`src/app/New-Workshop/**`<br>`src/app/tv-auth.component.ts`<br>`src/app/eiflix-telemetry/**`<br>`src/app/Participants Profile Management/participants-analytics/email-input/**`<br>`src/app/Participants Profile Management/participants-analytics/ah-notification/**`<br>`src/app/Product Designer/delivery-set/form-option/**`<br>`src/app/Product Designer/delivery-set/form-template-preview/**`<br>`src/app/Product Designer/delivery-set/update-delivery/**`<br>`src/app/content/episodes-dashboard/upload-episode-dialog/**` | `functions/components/workshop.js` |
| **appointments** | Appointments | ✅ | all | `src/app/appointment-dashboard/**`<br>`src/app/Scheduling/**`<br>`src/app/Offtime/**` | `functions/components/appointment.js`<br>`functions/components/appointmentZoomIntegraion.js` |
| **events** | Events | ✅ | all | `src/app/Events/**`<br>`src/app/Diagnostics Tool/**`<br>`src/app/Participants Profile Management/participants-analytics/wati-input/**`<br>`src/app/Participants Profile Management/participants-analytics/email-input/**`<br>`src/app/Participants Profile Management/participants-analytics/ah-notification/**`<br>`src/app/Participants Profile Management/participants-analytics/bulk-add-products/**`<br>`src/app/Participants Profile Management/participants-analytics/tag-participants/**`<br>`src/app/Channel Communication/channel-communication/**`<br>`src/app/arena-design-insights/**` | — |
| **profiles** | Profiles | ✅ | all | `src/app/Participants Profile Management/**`<br>`src/app/Participant Intelligence/**`<br>`src/app/ProfilePicture/**`<br>`!**/*.component.spec.ts`<br>`src/app/AppEngagement/app-action-pending/**`<br>`src/app/loading-progress/**`<br>`src/app/New-Workshop/workshop-dashboard/sendmessages/**`<br>`src/app/New-Workshop/whatsapp-progress-dialog.component.ts`<br>`src/app/participant-videoask/**`<br>`src/app/video-player/**`<br>`src/app/Customer Support/add-issue/**` | `functions/components/participantmetadata.js` |
| **support** | Customer Support | ✅ | failure-only | `src/app/Customer Support/**` | `functions/components/ticketsystem.js`<br>`functions/components/clientissue.js` |
| **unit** | Unit tests | ✅ | failure-only | — | — |

## Cross-cutting paths (any match ⇒ ALL CI-ready suites run)

- app: `src/app/loading-progress/**`
- app: `src/app/ProfilePicture/**`
- app: `src/app/authguard.service.ts`
- app: `src/app/custompipe.pipe.ts`
- app: `src/app/wati.service.ts`
- app: `src/app/DialogBox/**`
- app: `src/app/form-element/**`
- app: `src/app/Service/**`
- app: `src/environments/**`
- app: `src/app/**/*.guard.ts`
- app: `src/app/*.guard.ts`
- app: `src/app/shared/**`
- app: `src/app/app.routes.ts`
- app: `src/app/app.config.ts`
- app: `src/app/app.component.*`
- app: `src/app/authguard.service.ts`
- app: `src/app/instance-status.service.ts`
- app: `src/app/nav-drawer.service.ts`
- app: `src/app/network-status.service.ts`
- app: `src/app/app.config.server.ts`
- app: `src/app/app.routes.server.ts`
- app: `src/main.ts`
- app: `src/index.html`
- app: `src/firebase-messaging-sw.js`
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
- **support** — WIRED 2026-09-08; CI-READY 2026-09-15. The emulator twin now exists (playwright.support.emulator.config.ts via makeEmulatorConfig({suite:'support'}) + support/support/emulator-global-setup|teardown.ts), so the suite joins the emulator gate. config switched to the emulator twin and ciReady flipped true so the suite runs on the emulator gate via branch-suites and the console mirror (suites-deploy) credits src/app/Customer Support/**.
- **unit** — ADDED 2026-09-15. Runs in web-e2e.yml's UNIT LANE (suite=='unit' → `ng test --ts-config=tsconfig.unit.json --include='src/**/*.unit.spec.ts' --browsers=ChromeHeadless`), NOT Playwright. Fields are deliberately non-Playwright: `config` empty (web-e2e ignores it for unit), `specDir` points at a dir that does NOT exist in the hub so scripts/readiness skips it (existsSync guard, lib.cjs:186/259/380), and empty `appPaths` means a diff never auto-routes it MANDATORY — dispatch it explicitly (branch-suites suites=["unit"]). 1,895 unit specs pass locally as of this date. Auto-routing (appPaths) can be added later once the lane is proven in CI.
