# Profiles (#10) — Resume Point (2026-07-01)

> Self-contained handoff for the next session. Companion to `docs/SYSTEMS-ROLLOUT-STATUS.md`.
> **All 10 systems are ported.** This doc is about finishing **profiles** (one CI failure left) + the promotion tail.

## 👉 START HERE — root-cause profiles PA-09, then promote

Profiles is ported + committed on hub `systems-emulator` (`24c507d` port, `85603bb` fixes). Local: **20 passed / 3 skipped / 0 failed** (2×). Report-only caller **PR #31** (`profiles-caller` → cicd-dev, `@systems-emulator`).

**CI status (PR #31):**
- Run #1 (`cf_branch: development`): 4 failed (3 CF tests + PA-09).
- **Run #2 (`cf_branch: cicd-modes-emulator-fix`, caller commit `0896a67`): CF tests FIXED → 19 passed, 3 skipped, `1 failed` = PA-09 only.**

### The ONE remaining failure: PA-09 (CI-only)
- **Where:** `profiles/profiles-deep.spec.ts` — the **PA-07** test's PA-09 assertion (~line 104):
  `await expect(firstLink, 'PA-09: ...').toHaveAttribute('href', /\/profilesummary\/.+/)`.
- **App builds:** `participants-analytics.component.html:691` →
  `<a class="profilename" [routerLink]="'/profilesummary/' + element['profileid']">`.
- **Symptom:** green locally, red in CI. So the first `<a class="profilename">`'s href does NOT match `/profilesummary/.+` in CI.
- **Hypotheses to check (in order):**
  1. **First-row `profileid` empty/missing in CI's fresh emulator.** Locally the long-lived emulator has ~77 accumulated `participant metadata` docs (all with `profileid`); CI has only profiles' seed + CF-created docs. If the alphabetically-first row (analytics orders by `name`) is a doc whose `profileid` FIELD is empty → href = `/profilesummary/` → fails `.+`. **Check:** does `seed-profiles.js` write `participant metadata` with a `profileid` field? Does the CF (`profiledata_to_pmd`) set `profileid`? (I was mid-check when the session ended: `grep -nE "participant metadata|profileid" profiles/seed-profiles.js`.)
  2. **App-branch divergence (cicd vs cicd-dev)** — like comms CN-14. Compare the analytics HTML line on `cicd` (served locally) vs `cicd-dev` (CI builds this):
     `git -C ../starlabs-development show "$(git ls-remote --heads origin cicd-dev|awk '{print $1}'):src/app/Participants Profile Management/participants-analytics/participants-analytics.component.html" | grep -n profilesummary`
  3. **Get the trace:** the run #2 report artifact (`playwright-report`, ~9.8MB) has the exact first-row href + which participant. Run #2 job: `actions/runs/28520781797/job/84544083147`.
- **Fix honestly** (setup/seed vs app-branch vs test) per the established framework — do NOT hack. If it's a seed gap (first row lacks profileid), seed it; if app-branch divergence, self-skip with a documented reason (like CN-14); if a test race, wait for a real signal.

### After PA-09 is green → PROMOTE profiles (mirror appointments exactly)
1. Hub **PR: `systems-emulator → main`** (operator-approved; check it's profiles-only or bundle events/modes if desired). Merge.
2. **Flip `profiles-caller` `@systems-emulator → @main`** via plumbing (see snippet below). Also keep `cf_branch: cicd-modes-emulator-fix` (do NOT flip cf_branch to development until the CF team merges that branch there).
3. Re-validate PR #31 green `@main`.
4. **Merge PR #31 → cicd-dev.** (Trips `branch-guard` tripwire — alert-only, meena-as ∉ vignesh allowlist — and fires a dev deploy. Expected.)

## Rollout status (the whole board)
| # | System | cicd-dev? | Notes |
|---|---|---|---|
| queue,1 authroles,2 business,3 content,4 comms,5 workshops,6 evomap,8 appointments | **ACTIVE on cicd-dev (8)** | ✅ | all `@main` |
| 7 modes | ported, green `@main`, **PR #25 report-only, NOT promoted** | ⏳ | `cf_branch: cicd-modes-emulator-fix`; operator's; promote when they're ready |
| 9 events | ported (`3bfc712`), **PR #30 CI RED** | ⏳ | operator's session; their domain |
| 10 profiles | ported (`85603bb`), **PR #31, CI red on PA-09 only** | ⏳ | THIS session's work — finish PA-09 then promote |
| journey | held | — | 2 product-code fixes on `journey-caller` (product-delivery, delivery-sequence) need vignesh/app-team review; PRs #8/#9 are DO-NOT-MERGE |

**Also pending:** branch-guard governance — every meena-as cicd-dev merge trips the vignesh-allowlisted tripwire (alert-only, nothing reverted). Decide: add meena-as to the hub allowlist, or route merges via vignesh.

## Key mechanics / gotchas (learned this session)
- **Repos:** hub = `C:\Users\meena\angular-projects\starlabs-e2e-tests` (branch **`systems-emulator`** — new ports land here). App = `C:\Users\meena\angular-projects\starlabs-development` (origin `School-of-Excellence/starlabs-angular`; callers on `<sys>-caller` branches). App served locally = `C:\Users\meena\angular-projects\CI\CD` on branch **`cicd`** — which **DIVERGES from `cicd-dev`** (CI builds cicd-dev). This divergence causes CI-only failures (comms CN-14; suspect it for PA-09).
- **Run a suite locally:** emulator up (`bash ~/boot.sh` → "All emulators ready") + app up (`cd /c/Users/meena/angular-projects/CI/CD && npm run start:emulator` → `Local: http://localhost:4200/`), then
  `export JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.11.10-hotspot"; export PATH="$JAVA_HOME/bin:$PATH"; cd <hub>; EMU_REUSE=1 EMU_REUSE_APP=1 npx playwright test --config=playwright.profiles.emulator.config.ts`
- **Emulator limitation (documented):** the Firestore emulator (firebase-tools 15.22.4, latest) does **NOT** support named-DB rules → profiles **PA-13/14** (`firestore-forms` client read/write) `test.skip` on the emulator (validated on the cloud config). Do NOT re-attempt the `firestore` multi-db array form in `firebase.emulator.json` — it's rejected and drops ALL rules.
- **CF-branch dependency:** PA-CF-* (and modes' CF cases) need the participant-metadata CF fixes on **`cicd-modes-emulator-fix`**, NOT yet on `development`. So `cf_branch: cicd-modes-emulator-fix` for profiles + modes until the CF team merges it → then flip both to `development`.
- **Shared working trees + browser:** the operator runs events/modes in the SAME hub + app trees, and shares the Chrome MCP browser (Browser 2, Windows local, deviceId `84a12a90`) — it gets redirected mid-check. Stage ONLY your files explicitly (never `git add -A`). Build callers in an isolated `git worktree` off `origin/cicd-dev`, push, then `git worktree remove`. Use PR/run **URLs directly** rather than clicking through lists.
- **Branch SHAs:** `git show origin/<branch>:path` intermittently returns empty under concurrent ref churn — use `SHA=$(git ls-remote --heads origin <branch>|awk '{print $1}'); git show $SHA:path`.
- **Caller flip (plumbing, no checkout):**
  ```bash
  cd /c/Users/meena/angular-projects/starlabs-development
  BR=profiles-caller; FILE=.github/workflows/profiles-e2e.yml; SHA=$(git ls-remote --heads origin $BR|awk '{print $1}')
  git show "$SHA:$FILE" | sed -e 's|web-e2e.yml@systems-emulator|web-e2e.yml@main|' -e 's|e2e_ref: systems-emulator|e2e_ref: main|' > /tmp/f.yml
  BLOB=$(git hash-object -w /tmp/f.yml); export GIT_INDEX_FILE=/tmp/idx; rm -f $GIT_INDEX_FILE
  git read-tree "$SHA"; git update-index --add --cacheinfo 100644 $BLOB "$FILE"; TREE=$(git write-tree); unset GIT_INDEX_FILE
  NEW=$(printf 'ci(profiles): flip caller to @main\n' | git commit-tree $TREE -p "$SHA"); git push origin "$NEW:refs/heads/$BR"
  ```
- **Hard rules:** never break/push protected branches (`main`/`development`/`production`/`cicd-*`) except via **approved PR merges**; no force pushes; ATC off-limits; project id `starlabs-cicd` everywhere; `gh` CLI not installed → GitHub web UI via Chrome MCP (meena-as).

## Journals (read for WHY)
`specs/journals/2026-07-01-profiles-emulator-gate.md`, `...-appointments-emulator-gate.md`, `...-events-emulator-gate.md`, `...-modes-cf-emulator-gate.md`, `2026-06-30-evomap-emulator-gate.md`.
