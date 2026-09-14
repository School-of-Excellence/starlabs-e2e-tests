# 2026-06-30 — authroles emulator gate (system #1 of the 10-system rollout)

> Resumed from `docs/SYSTEMS-ROLLOUT-HANDOFF.md`. Goal: wire authroles (rank 1) behind the hermetic
> emulator CI gate, the same way queue/journey already are. Sequential + verified, not autonomous.

## What was done
1. **Engine files (additive, mirror journey):**
   - `playwright.authroles.emulator.config.ts` + `playwright.authroles.emulator.evidence.config.ts`
   - `authroles/support/emulator-global-setup.ts` + `emulator-global-teardown.ts`
   - `authroles/seed-authroles.js`: added `initAdminAuto()` (emulator-pinned admin when
     `FIRESTORE_EMULATOR_HOST` is set; cloud `seed.initAdmin()` otherwise) and switched
     `seedAuthRoles()`/`teardownAuthRoles()` to use it.
2. **Local green on the emulator** (boot.sh emulator + `ng serve --configuration emulator` on :4200):
   `playwright.authroles.emulator.config.ts` → **18 passed, 0 failed, 3 skipped**.
3. **CI caller:** `starlabs-angular/.github/workflows/authroles-e2e.yml` (mirror `journey-e2e.yml`),
   report-only, pinned to hub branch `systems-emulator`. PR #19 (`authroles-caller` → `cicd-dev`).
4. **CI green:** run `28416828322`, `gate / web-e2e` Success in 4m11s (exit 0 = 0 failing spec files).

## Why the 3 skips are legitimate (not masks)
- **AR-02b** — `test.fixme(...)` baked into the committed spec (Jun 12, untouched by me); author-deferred,
  not CF-related.
- **AR-14 / AR-15** — runtime CF-presence probe (`createProfileCfDeployed`) → `test.skip(!deployed, …)`.
  The functions emulator loaded with one CF failing ("Failed to load function"); the profile-bootstrap +
  emailOTP CFs aren't in the deployed set, so these self-skip with a precise reason. Same discipline as
  queue/journey. No test was edited to pass.

## Branch strategy (decided with operator — avoid 20 branches for 10 systems)
- **Hub:** ONE shared rollout branch `systems-emulator` carries all 10 systems' additive engine files;
  merge to `main` in operator-gated batches as systems prove green. Caps the hub at 1 long-lived branch.
- **App:** short-lived per-system caller branches (`authroles-caller`, …), deleted after merge; each gets
  its own report-only PR so gates stay independently promotable. Later systems' callers can batch 2–3/PR.
- No protected-branch pushes (only `systems-emulator` + `authroles-caller`); no force pushes.

## Pending / next (operator-gated)
1. **Flip caller to `@main`** AFTER merging hub `systems-emulator` → `main` (PR, operator-approved). Until
   then `uses:`/`e2e_ref:` stay pinned at `systems-emulator`. (recipe step 7)
2. **Extract the shared lib BEFORE porting suite #3** (`initAdminAuto` + setup/teardown + config/yaml
   template) so ranks 3–10 become config-only. Next system by rank = #2 business.
3. Hold ranks 8–10 until their infra blockers clear (composite indexes / CF-in-emulator / `firestore-forms`).

## Gotchas observed
- `~/.bashrc` has a UTF-16 BOM → every Bash call prints `line 1: $'\377\376export': command not found`.
  Harmless (noise only); git/node unaffected.
- `lsof`/`pkill` are MISSING on this Windows box, so `scripts/run-isolated.sh` can't be run locally (it
  would misdetect the emulator as down and try an unsafe restart). Local proof = the full-suite playwright
  run; CI runs run-isolated.sh on Linux where the tools exist.
