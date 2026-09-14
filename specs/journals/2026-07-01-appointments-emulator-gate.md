# appointments emulator gate — session journal (2026-07-01)

System #8 **appointments** ported behind the hermetic emulator CI gate and **promoted to cicd-dev**
(active, `@main`). Config-only via the shared lib + two honest, root-caused fixes. Done verified, not
autonomously.

## Headline: the "3 blocking composite indexes" were a non-blocker
appointments was on HOLD for "3 BLOCKING composite indexes." They turned out to be **already present** in
`ci/overlay/firestore.indexes.json` (staged to the emulator at boot): `availability`(profileref+appointments
+starttime), `appointments`(hosts+starttime), `appointments`(hosts+endtime), plus (cancelled+attended+
starttime). Every index-dependent test passed. No CF, no named DB. So it was a plain config-only port.
**Lesson:** re-verify a documented "blocker" against the current tree before deferring — infra may have
landed since the note was written (same story as evomap's fixmes).

## The port
- `seed-appointments.js`: `initAdminAuto` (3 sites: seed/teardown/resetBookingSubject).
- `playwright.appointments.emulator(.evidence).config.ts` (1-line factory calls).
- `appointments/support/emulator-global-setup.ts` (APPT_RUNID) + `-teardown.ts`.

## Two honest fixes (both CI-only; root-caused, not hacked)
1. **route-mount smoke** (`scheduling.spec.ts`): looped `page.goto` + `waitForLoadState('networkidle')`.
   networkidle NEVER settles against the emulator-wired app (persistent Firestore onSnapshot + EISzoom/studio
   stream routes) → blocked to the 120s test timeout → page closed → next goto threw. Replaced with the
   bounded `waitForTimeout(800)` the already-green `evomap/routes.spec.ts` uses. (`b208e19`)
2. **CI-only studio crash** (`seed-appointments.js`, `b2ae06d`) — the interesting one. Analyzed as
   **SETUP (seed), not app code or test**:
   - `appointment-studio.component.ts:173/280` enriches EVERY appointment via
     `mapProfileMeta[bookedby.id].activejourney` — **un-guarded**. `mapProfileMeta` = the `participant
     metadata` collection (`getParticipantMetaMap()`, `orderBy('name')`).
   - In prod those docs are auto-created by a **Cloud Function** (`queuesystem.js`); the emulator doesn't run
     it, so **every sibling suite's seed creates them**. appointments' seed was the lone one that omitted the
     write (kept only a comment "p0 has a participant metadata doc").
   - Passed locally ONLY because the long-lived emulator had 77 accumulated `participant metadata` docs from
     other suites. CI's fresh hermetic emulator had none → `undefined['activejourney']` → TypeError →
     APPT-12/13 fail (studio card never renders — a REAL crash, correctly NOT allowlist-able).
   - **Reproduced** locally: deleted p0/p1's meta docs → identical 2 failures. **Fixed** by seeding
     `participant metadata/{p0,p1}` with `name` (required for the orderBy) + tag, and adding the collection to
     the `SEEDED` teardown. Setup fix only — no app-code, no test-logic change.

## Verification (the honest, hermetic path)
- Local 2x green (18p/1skip APPT-03 fixme).
- CI gate: run #1 FAILED (the studio crash), re-run #2 GREEN @systems-emulator (5m40s), re-validate #2 GREEN
  @main (4m39s).

## Promotion (clean, `@main`, like content/comms/workshops/evomap)
Hub **PR #4** `systems-emulator → main` (appointments-only, 3 commits) → caller flipped `@systems-emulator →
@main` (`78ae9f6`) → re-validated green @main → **PR #29 merged into cicd-dev**. `cicd-dev` now runs 8 gates.

## Surprises / notes
- Local emulator "dirtiness" (accumulated cross-suite docs) MASKS missing-seed bugs. The studio crash is a
  poster child: hermetic CI caught what a shared long-lived local emulator hid. When a suite passes locally
  but red in CI, suspect **seed self-containedness** (does the fresh emulator have every doc the app reads?).
- Shared trees: hub + app repos are shared with the operator's parallel events/modes session. Built the
  appointments caller in an isolated `git worktree` (removed after). Left `systems-emulator` intact.
- The GitHub `origin/<branch>:path` show syntax intermittently returns empty under concurrent ref churn; the
  `git ls-remote … | awk` SHA form is reliable — use it.

## Pending (rollout tail)
- **#9 events** — in progress (operator session).
- **#10 profiles** — last system. Blockers likely soft: `firestore-forms` named DB is served on-demand by the
  emulator (no per-db block needed; seed already uses `getFirestore(app,'firestore-forms')`); `PA-CF-*` tests
  self-skip if profiles' CFs aren't in `deploy-cf-emulator.sh`. Assess like appointments before deferring.
- **#7 modes** — green ×2 @main; PROMOTE PR #25 → cicd-dev (operator's call; CF fixes on
  `cicd-modes-emulator-fix` not yet on `development`).
- **journey** — held (2 product-code fixes on `journey-caller` need vignesh/app-team review).
- **branch-guard governance** — meena-as cicd-dev merges keep tripping the vignesh-allowlisted tripwire
  (alert-only). Add meena-as to the hub allowlist or route merges via vignesh.
