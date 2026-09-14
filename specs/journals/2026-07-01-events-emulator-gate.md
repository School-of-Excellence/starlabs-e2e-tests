# Events #9 — ported to the hermetic emulator gate (config-only) + EVT-03/04 root-cause

> Session 2026-07-01. Outcome: **Events suite 2× local GREEN on the emulator (15/15)**. Committed on hub
> `systems-emulator` (`3bfc712`). Caller PR not yet opened.

## What was done (config-only recipe, mirrors authroles/evomap/modes)
- `events/seed-events.js` — destructure + use `initAdminAuto()` from `lib/seed-common` (emulator-pinned admin
  when `FIRESTORE_EMULATOR_HOST` set, else cloud `seed.initAdmin()`); 2 call sites swapped.
- `events/support/emulator-global-setup.ts` + `-teardown.ts` — 2-line shims over `lib/emulator-global`
  (`seedScript: events/seed-events.js`, `EVT_RUNID` / `evt`).
- `playwright.events.emulator.config.ts` + `.evidence.config.ts` — 1-line factory calls.

## The one real failure — EVT-03/04 — classified by LAYER (setup → test → code), root-caused live
First emulator run: **14/15**, only EVT-03/04 failed with a 120s `locator.click` timeout waiting for
`getByRole('option',{name:'TEST Event evt'})` after opening the "Select an Event" mat-select on
`/event_participation_approve`. Fresh-emulator re-run reproduced it deterministically (so NOT emulator
degradation, NOT test-ordering — fails in isolation too).

**Layer classification:**
- **Layer 1 (setup/infra) — RULED OUT.** Admin probe: both events seeded with `name` + `end_date`
  (Timestamp); `orderBy('end_date','desc')` returns both. Rules OK (EVT-01 reads the same `event collection`
  client-side and renders). No index issue (overlay has no explicit index for `event collection` on either
  `start_date` or `end_date`; EVT-01's `start_date` order works, so the emulator isn't enforcing single-field
  indexes). No permission/index error in `firestore-debug.log`.
- **Layer 3 (code) — RULED OUT.** Drove the LIVE app in Chrome (logged in as `admin+evt`, opened the page):
  console showed the component's `console.log(this.eventList)` = **`Array(2)`** and a NORMAL click on the
  combobox opened the panel with the **`option "TEST Event evt"` present**. App/query/render are correct.
- **Layer 2 (WRONG TEST CASE) — ROOT CAUSE.** The event list streams in async
  (`event-participation-approve.component.ts:120`, `collectionData(event collection)`), so the mat-select can
  OPEN BEFORE `eventList` populates (empty panel), and `click({force:true})` can focus the trigger WITHOUT
  toggling the CDK overlay. The ARIA snapshot at failure confirmed it: combobox `[active]` with **zero option
  children** (focused, panel never opened / opened empty). EVT-09/12 use a *different* combobox
  ("Select Event") where force-click happened to open — so the technique is layout/timing-fragile.

**Fix (test-only, no app/seed/config change):** replace `click({force:true})` + immediate option-click with
a `toPass` retry that opens the select and picks the streamed option until it's clickable — robust to both
the async-empty-panel and the open-flakiness. EVT-03/04 → pass (22s, was 120s timeout). Full suite 2× 15/15.

## Note for the record
- EVT-09/12 use the same open pattern (`click({force:true})` + option-click) and passed, but share the same
  latent async-panel race — if they flake later, apply the same `toPass` open.
- General lesson (again): when a UI test fails only on the emulator, drive the LIVE app to see whether the
  data/query are fine (Layer 1/3) before touching it — here the console + a manual click proved Layer 2 in
  minutes and avoided "fixing" a non-existent data/index problem.

## EVT-15/16 — the REAL CI-red root cause: app-branch divergence (CN-14 class), 2026-07-02
Caller PR #30 stayed CI-red on EVT-15/16 through two fixes (`6323c45` poll-only, `674deab` force-click). Both
mis-diagnosed it as mat-option *instability* on the EOD-v2 queue picker. **The real cause is that the
`/eventopportunitydashboard` route loads a DIFFERENT component per branch:**
- `cicd` (served locally, where EVT-15/16 were authored): `EventOpportunityDashboardV2Component`, host
  `<app-event-opportunity-dashboard-v2>` (folder `…/event-opportunity-dashboard-v2/`).
- `cicd-dev` (CI builds this): legacy `EventOpportunityDashboardComponent`, host
  `<app-event-opportunity-dashboard>`. **The `-v2` component/folder is ABSENT from cicd-dev** (app.routes.ts:32
  differs — verified via `git ls-tree cicd-dev` + the route import). The v1 component has a NEAR-IDENTICAL
  "Select queue" mat-select (selectedQueueList/updateSelectedQueues), which is why the operator saw a real
  picker + instability and chased it.

EVT-15/16 assert **v2-only** internals: `pickQueueOption`'s `alreadySelected()` reads
`document.querySelector('app-event-opportunity-dashboard-v2')` (null on cicd-dev → poll never lands → timeout);
EVT-16 calls the v2 host's `getStageParticipants` (v1 lacks it). So they CANNOT pass on v1 — force-click could
never help, because the failing step is the assertion reading an absent host, not the click.

**Honest fix (CN-14 class — self-skip, `d635ea1`):** added `skipUnlessEodV2(page)` — after navigation, wait
for either EOD host, then `test.skip(!isV2, …)` when the v2 host isn't served. Runs fully on `cicd` and
automatically once v2 merges to `cicd-dev`. Left `674deab`'s force-click intact (harmless on cicd). Re-triggered
PR #30 via caller `cce4908`. Expect green: 13 passed / 2 skipped (EVT-15/16 on cicd-dev) / 0 failed.

**Lesson (again):** local-green/CI-red ⇒ check app-branch divergence (cicd vs cicd-dev) BEFORE test-stability
band-aids. mahalakshmi-development merges land on cicd-dev first; whole components (not just routes) can differ.

## Promotion — DONE (events active on cicd-dev @main), 2026-07-02
1. Hub **PR #6** `systems-emulator → main` merged (`35eb2a0`) — carried the 2 events commits `674deab`+`d635ea1`
   (the profiles hub PR #5 had already put the events ENGINE on main; PR #6 just carried these later fixes).
2. Flipped `events-caller` `@systems-emulator → @main` via plumbing (`86a9b18`); kept `cf_branch: development`
   (events has no CF-side-effect cases).
3. Re-validated PR #30 `@main` — **All checks passed**, events-e2e emulator gate Successful in 4m (EVT-15/16
   skip on cicd-dev, 13p/2skip/0fail).
4. Merged **PR #30 → cicd-dev** (`d2c6917`). Tripped branch-guard (alert-only) + dev deploy — expected.

**Events = 10th active system on cicd-dev.** All @main.

## Rollout tail (remaining)
- **modes** (#7, PR #25 report-only) — operator's; promote when ready.
- **journey** — held for vignesh/app-team (PRs #8/#9 DO-NOT-MERGE).
- **branch-guard governance** — meena-as cicd-dev merges trip the vignesh-allowlisted tripwire (alert-only);
  decide add-to-allowlist vs route-via-vignesh.
