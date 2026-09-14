# evomap emulator gate — session journal (2026-06-30)

System #6 **evomap** ported behind the hermetic emulator CI gate (config-only via the shared lib), like
authroles/business/content/comms/workshops. Done sequentially + verified, not autonomously.

## What landed (hub `systems-emulator`)
- `ci(evomap): emulator gate (config-only via shared lib)` — `6d92be3`
- `fix(evomap): EM-07 + EM-03 wait for the app's async second hop (CI-only races)` — `ecefdc9`
- Both pushed to `origin/systems-emulator` (now under the operator's comms commit `287274b`).
- App caller: branch `evomap-caller` (off `cicd-dev`) with `.github/workflows/evomap-e2e.yml` — `c2cdfa5`,
  pushed to `origin/evomap-caller`. **PR to `cicd-dev` NOT yet opened** (browser pick unanswered; report-only
  when opened). One-click: https://github.com/School-of-Excellence/starlabs-angular/pull/new/evomap-caller

## The port (mechanical, per the recipe)
- `seed-evomap.js`: added `initAdminAuto` to the `seed-common` destructure; both `seed.initAdmin()` →
  `initAdminAuto()` (seed + teardown).
- `playwright.evomap.emulator.config.ts` + `.evidence.config.ts`: 1-line factory calls.
- `evomap/support/emulator-global-setup.ts` (seedScript `evomap/seed-evomap.js`, `EVOM_RUNID`) + `-teardown.ts`
  shim.

## Two honest, root-caused test fixes (NOT hacks — both are cold-emulator races; passed warm in run 1)
Verified by browser console + Playwright trace + live component-state capture (throwaway diag specs, deleted).

- **EM-07** (`evolution-mapping.spec.ts`): the app's `deleteVideo()` does TWO sequential writes — step 1
  `arrayRemove` from `liveevolutionmapping.videolist`, then step 2 (`getDocs`+`updateDoc`) flips the removed
  catalogue row `urllive:false` ~1s later. The test polled only step 1, then **read step 2 once** — and
  ending there tore the page down mid-write, so step 2 never committed (post-run admin probe still saw
  `true`; a 15s page-open diag showed it flip at t+1s). **Fix:** `pollUntil` the `urllive:false` flip (same
  discipline the test already uses for step 1).
- **EM-03** (`evomap-deep.spec.ts`): the edit dialog's `ngOnInit` runs `onSelect()` (async
  `getDocs('participant videos')`) and only its `.then()` does `selectedVideos.add(matched)`. Until that
  resolves `selectedVideos` is empty, and `addEvolution()` guards on `size===0` with an `alert()` that returns
  WITHOUT writing — so the title never persisted (diag captured the native alert + `selectedVideosSize:0→1`
  AFTER the click). **Fix:** wait for the matched source-video card to become `.selected` (the `selectedVideos`
  guard going truthy) before clicking Update Mapping.

Neither is a product defect — real users act after the async settles; the page stays open. Same class as the
business filter-open / workshops WS-02 work.

## Verification
Fresh emulator (rebooted mid-session — old one had degraded: intermittent empty catalogue + Listen-stream
transport errors after ~10 heavy runs; matches the handoff's "reboot per session" warning). **2 consecutive
full runs GREEN: 13 passed / 1 skipped (EM-02 fixme) / 0 failed.** EM-02 stays a fixme (add-evolution
4-step dialog); the aux composite index for the Last-Video column is flagged-not-asserted (not needed).

## Surprises / notes for next session
- The hub repo AND the app repo are a **SHARED working tree** with the operator's parallel comms session —
  it committed `2c20108`/`287274b` (CN-14 v3) onto `systems-emulator` and switched the app checkout
  `comms-caller`→`workshops-caller` mid-session. Built the evomap caller in an **isolated `git worktree`**
  (`/c/Users/meena/angular-projects/_wt-evomap-caller`) to avoid colliding. **Left comms/templates.spec.ts
  untouched** as instructed (their CN-14 v3 finding: `/onewaytemplates` exists only on app `cicd`, not
  `cicd-dev` — an app-branch divergence, not a flake).
- The evomap worktree at `_wt-evomap-caller` is still attached — `git worktree remove` it once the PR is open.

## Done after the journal was first written
- Report-only **PR #24** opened (evomap-caller `c2cdfa5` → cicd-dev, meena-as via Chrome MCP). **evomap-e2e
  gate GREEN run #1** (Success, 4m34s; job `gate / web-e2e` 4m30s; only a benign Node-20 runner-deprecation
  warning; playwright-report artifact uploaded). CI's fresh-emulator + per-file isolation confirms the EM-07
  + EM-03 fixes hold. evomap is fully done.

## Pending
1. Then system #7 **modes** + the bundled CF-in-emulator task (add content/comms/modes CFs to
   `scripts/deploy-cf-emulator.sh`; verify queue/journey CF tests don't regress).
3. HOLD #8 appointments / #9 events / #10 profiles until infra decided.
4. Periodically merge `systems-emulator → main` (operator hub PR) + flip content/comms/workshops/**evomap**
   callers `@systems-emulator` → `@main`.
