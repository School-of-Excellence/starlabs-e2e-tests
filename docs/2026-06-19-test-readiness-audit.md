# Test-Readiness Audit — 2026-06-19

**Session goal:** Validate all 4 projects are wired and ready for a test-rollout push to `cicd-dev` / `cicd-prod` without disturbing the regular `development` / `production` branches.

---

## Audit Findings by Repo

### 1. Hub — starlabs-e2e-tests (this repo)

**Reusable workflows:** All three are present and correct.
- `.github/workflows/web-e2e.yml` ✅ — clones hub + CF, wires symlinks, boots emulator, runs isolated suite
- `.github/workflows/cf-e2e.yml` ✅ — inverted layout: clones angular as harness, CF PR head as triggers
- `.github/workflows/flutter-e2e.yml` ✅ — analyze/test/build-web hard gates + opt-in emulator smoke

**Console frontend:** All seams already fixed — no action needed.
- `firebase.service.ts`: callable names (`setOkToRelease`, `createPullRequest`, `approveAndMerge`) and payloads match backend exactly ✅
- `release-candidate.model.ts`: `id = ${repo}__${branch}`, `prDevNumber`, `prProdNumber` present ✅
- `app.config.ts`: Firebase providers wired, no TODO blocks ✅
- `auth.service.ts`: Google sign-in popup + approver allowlist load ✅
- `mock-data.ts`: All 6 fixture entries have `repo` field, cover all 6 statuses ✅
- `environment.ts`: `useMock: false` (live mode), imports from `firebase.config` ✅
- `firebase.config.ts`: EXISTS with real `starlabs-cicd` keys (gitignored, not a placeholder) ✅

**GIT STATE — needs a commit before push:**
- `D .github/workflows/branch-guard.yml` — staged deletion (was the direct-push guard). See §Why below.
- All `console/*` changes are UNSTAGED (working tree only). Must stage + commit before push.
- Untracked: `CLAUDE.md`, `.claude/`, `console/.claude/`, lock files.

**Why branch-guard was removed:** The branch-guard workflow alerted on direct pushes to protected branches. It is being retired in favour of the console-gated merge model (all merges go via `approveAndMerge` Cloud Function as the GitHub App). The App's merge authority makes the branch-guard redundant. Deletion is intentional.

---

### 2. Angular — starlabs-angular (starlabs-cicd local)

**FIXED THIS SESSION:** Created `web-e2e.yml` thin caller.
- Path: `/Users/m1/Documents/CICD/starlabs-cicd/.github/workflows/web-e2e.yml`
- Triggers on PR to `cicd-dev` / `cicd-prod` for `src/**`, `angular.json`, `package.json`
- Calls hub: `School-of-Excellence/starlabs-e2e-tests/.github/workflows/web-e2e.yml@main`
- `cf_branch: development` (uses stable CF at cutover point) ✅

**Existing deploy_19.yml is unaffected:** Only triggers on pushes to `development` / `production` — completely separate from `cicd-dev` / `cicd-prod`. Regular deployment flow is untouched. ✅

**Old queue-e2e.yml kept as-is:** The self-contained embedded gate remains for queue-specific PRs (any branch, queue paths). It runs in parallel with the new hub-based caller and uses `CF_REPO_TOKEN` (different secret name than `REPO_PAT`). No conflict.

---

### 3. Cloud Functions — starlabs-cloud-function

**Caller workflow: ALREADY CORRECT.** `cf-e2e.yml` targets `cicd-dev`/`cicd-prod`, calls hub. ✅
- `app_branch: feature/cicd-rollout` — temporary; change to `development` at Phase 1B cutover.

---

### 4. Flutter — breakthroughs-flutter

**Caller workflow: ALREADY CORRECT.** `flutter-e2e.yml` targets `cicd-dev`/`cicd-prod`, calls hub. ✅
- Flutter version: `3.44.3` (matches project SDK). `run_integration: false` until seed fix lands.

---

## What's Needed Before First Real Gate Run

### Operator steps (cannot be automated):

| # | Item | Repo | Details |
|---|---|---|---|
| 1 | **Create `cicd-dev` and `cicd-prod` branches** | All 4 repos | PRs must target a branch that exists. Push these from `development` or `main`. |
| 2 | **Set `REPO_PAT` secret** | starlabs-angular, starlabs-cloud-function, breakthroughs-flutter | GitHub PAT with READ access to `starlabs-e2e-tests`. CF gate also needs READ to `starlabs-angular`. Set as a single PAT on each repo. |
| 3 | **Hub: commit + push current changes** | starlabs-e2e-tests | Stage all `console/*` files + the staged `branch-guard.yml` deletion, commit, push `main`. |
| 4 | **Angular: commit + push new caller** | starlabs-angular | Commit the new `web-e2e.yml` and push to `main`. |
| 5 | **Hub Actions access setting** | starlabs-e2e-tests | Settings → Actions → General → Access → "Allow this repository's workflows to be used by other repositories in the School-of-Excellence org." |

### For console deployment:

| # | Item | Details |
|---|---|---|
| 6 | **Build + deploy console** | `cd console && npm run deploy` (runs `ng build` + `firebase deploy --only hosting --project starlabs-cicd`) |
| 7 | **Create Firestore allowlists doc** | `console-config/allowlists` in starlabs-cicd Firestore (see CLAUDE.md §Step 3) |
| 8 | **GitHub App registration** | Required before action buttons (Mark OK, Create PR, Approve & Merge) can hit GitHub. The console board will render from Firestore without it; actions will fail with "GitHub App credentials not configured". |

---

## Test Flow Verification (once above is done)

```
1. Push a feature branch to starlabs-angular
   → Gate fires (web-e2e caller on next PR)

2. Open PR feature/* → cicd-dev
   → web-e2e gate triggers, runs emulator suite
   → Report uploaded as artifact

3. Same for CF: open PR → cicd-dev on starlabs-cloud-function
   → cf-e2e gate triggers

4. Same for Flutter: open PR → cicd-dev on breakthroughs-flutter
   → flutter-e2e gate triggers (analyze + test + build-web)

5. Console: sign in, see the candidate (once webhooks + GitHub App are live)
   → Mark OK → Create PR → Approve & Merge
```

---

## Isolation Guarantee (development/production safety)

| Workflow | Trigger | Protected? |
|---|---|---|
| `deploy_19.yml` (Angular) | push to `development` / `production` | These branches are NOT touched by test rollout ✅ |
| `web-e2e.yml` caller (Angular) | PR to `cicd-dev` / `cicd-prod` | Completely separate namespace ✅ |
| `cf-e2e.yml` caller (CF) | PR to `cicd-dev` / `cicd-prod` | Same ✅ |
| `flutter-e2e.yml` caller (Flutter) | PR to `cicd-dev` / `cicd-prod` | Same ✅ |

No workflow touches `development` or `production` unless a human merges. Regular dev work is fully unaffected.
