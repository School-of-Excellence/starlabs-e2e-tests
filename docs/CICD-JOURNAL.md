# StarLabs CI/CD — Working Journal & Handoff (self-contained)

> **START HERE.** This file is **self-contained** — a developer *or any LLM* can continue from it in any session,
> in either repo, without opening anything else. The same journal is kept in both repos:
> `starlabs-e2e-tests/docs/CICD-JOURNAL.md` (hub) and `starlabs-angular/Journal/2026-06-18-CICD-JOURNAL.md`.
> Deeper design detail (optional) is in the hub's `docs/GOAL.md`, `docs/ARCHITECTURE.md`, `docs/CICD-ROLLOUT.md`.
> Times are **UTC**. Last updated **2026-08-19**.

---

## 0. TL;DR — current state
- **What:** a CI/CD pipeline where code goes `feature branch → preview → PR → tests → merge → auto-deploy`,
  driven from the **release console** rather than the CLI.
- **Live since July:** the console owns the flow — developer deploys a preview, tester signs off for dev,
  developer opens the PR, an allow-list member merges on GitHub, `development` auto-deploys, tester signs off
  for prod, an admin promotes. Roles + onboarding:
  [`specs/journals/2026-07-04-console-rollout-roles-and-workflow.md`](../specs/journals/2026-07-04-console-rollout-roles-and-workflow.md).
- **Everything runs on deliberate intent:** every e2e workflow is `workflow_dispatch`-only (2026-06-29) —
  the console fires them, bare pushes never do.
- **In flight (2026-08-19):** a **second, parallel flow**. On every feature push, publish TWO hosting channels
  (dev + prod) and report whether the hub's suites actually cover the diff. It writes only new fields and
  cannot move any status — see
  [`specs/journals/2026-08-19-branch-channels-session.md`](../specs/journals/2026-08-19-branch-channels-session.md).
- **Enforcement:** real GitHub branch protection with a merge allow-list on `starlabs-angular`; `branch-guard`
  was dropped. CF + Flutter gates are still on the `cicd-*` stand-in branches.

## 1. The system (everything you need — no other doc required)

**Four repositories (GitHub org `School-of-Excellence`):**
| Repo | Role |
|---|---|
| `starlabs-angular` ("Starlabs 19") | the web app (Angular 19 + Firebase) — the **lead** repo |
| `starlabs-cloud-function` | the backend (Firebase Functions / Firestore triggers) |
| `breakthroughs-flutter` | the mobile app (Flutter) |
| `starlabs-e2e-tests` (**the HUB**) | shared Playwright test engine + **reusable GitHub Actions workflows** + history + the console |

The pipeline logic is defined **once in the hub** and each app repo calls it with a tiny "caller" workflow
(`uses: School-of-Excellence/starlabs-e2e-tests/.github/workflows/web-e2e.yml@main`).

**Firebase projects (environments):**
| Env | Project | Purpose |
|---|---|---|
| Emulator (in CI) | booted as `starlabs-cicd` | runs the hermetic test gate; fresh seed per run |
| Preview + History | `starlabs-cicd` (Blaze) | per-branch preview channels + `cicd-audit` history |
| Development / Test | `starlabs-test` | merge → `development` deploys here |
| Production / Live | `fir-sample-aae4a` | merge → `production` deploys here |

**The lanes (Angular files) — CORRECTED 2026-08-19:**
| Lane | File | Trigger | Does |
|---|---|---|---|
| Preview | `preview.yml` | **workflow_dispatch** (console Deploy) — push trigger disabled 2026-06-23 | build + publish ONE Firebase Hosting preview channel on `starlabs-test` |
| Gate | `preview-e2e.yml` / `<suite>-e2e.yml` → hub `web-e2e.yml` | **workflow_dispatch** (console) | Playwright suites vs real CF triggers in the **emulator**; report archived to `cicd-audit` |
| Deploy | `deploy_19.yml` | **merge** (push) to `development` / `production` | `firebase deploy --only hosting` to the env |
| Channels *(new, parallel)* | `branch-channels.yml` | **push** to a feature branch | TWO channels (dev + prod) + suite-alignment verdict → `previewStatus` / `testSuiteStatus`. Invisible to the console's workflow tracking, so it moves no status. |

**How the gate runs:** it clones 3 repos (app + hub engine + cloud-functions) into a Firebase **emulator** and runs
the suite against the **real** Cloud-Function triggers — hermetic, nothing touches the cloud.

## 2. Branch map (READ before any git)
| Repo | Branch | Role |
|---|---|---|
| angular | `development` / `production` | **LIVE** — the pipeline runs here since the July cutover; branch protection + merge allow-list |
| angular | `cicd-dev` / `cicd-prod` | sudo **TEST** stand-ins (both deploy to `starlabs-test`) — still used to rehearse changes; CF + Flutter gates still target them |
| angular | `feature/cicd-rollout` | the original rollout branch — historical, superseded by the cutover |
| hub | **`main`** | reusable workflows, `scripts/`, `console/` scaffold, `docs/` |
> A duplicate `cicd-rollout` angular branch was created then **removed** — single flow on `feature/cicd-rollout`.

## 3. Timeline
| When (UTC) | Event |
|---|---|
| 2026-06-17 | Plan locked; reusable pipelines + thin caller authored; local smoke green (operator 13/0). |
| 2026-06-17 14:05–15:31 | CI gate brought to life: `timeout-minutes` expr → static · org-reuse Access enabled · secret unified to `REPO_PAT` · CI symlinks · `environment.development.ts` overlay. |
| 2026-06-18 06:35 | Full-suite CI run hit 75-min timeout → surfaced **project-id mismatch** (the root cause of CI login failures). |
| 2026-06-18 08:54 | Smoke gate **green on a PR** — pipeline proven end-to-end in CI. |
| 2026-06-18 10:55–11:13 | **Phase B** on sudo branches: PR#3→cicd-dev gate 8/0 → deploy; deploy **403 → `--only hosting`**; PR#4→cicd-prod → deploy. Full cycle green. |
| 2026-06-18 12:36 | **`operator.spec` green in CI 13/0** — project-id fix confirmed; gate widened to run operator on PRs. |
| 2026-06-18 (later) | branch-guard dropped; consolidated to single branch `feature/cicd-rollout`; journals written. |
| 2026-06-19 → 07-04 | Release console v2 built and live on `starlabs-cicd`; preview-time gate; suites manifest becomes the routing truth; roles + merge allow-list rolled out to the team. |
| 2026-07-05 → 07-20 | CF board + local predeploy loop-guard; Flutter Android delivery wired to the console. |
| 2026-08-19 | **NEW parallel flow**: `branch-channels.yml` — two hosting channels per push (dev + prod) + a suite-alignment checker. Writes only `previewStatus` / `testSuiteStatus`; the old flow is untouched. |

## 4. Planned / Implemented / Next
**Implemented ✅** — preview lane, gate (caller → hub `web-e2e`), deploy (auto-on-merge, `--only hosting`),
append-only history (`cicd-audit`); full cycle proven on sudo branches; `operator` 13/0 in CI; gate runs
operator + self-tests on PRs.

**Also implemented ✅** — release console v2 (board, report screen, CF board, roles/Settings); the suites
manifest as single routing truth; Angular cut over to real `development`/`production` with branch protection.

**Implemented 2026-08-19 ✅ (parallel flow, reports only)** — `branch-channels.yml` in the app repo:
two hosting channels per push (dev → `starlabs-test`, prod → `fir-sample-aae4a`) + the suite-alignment
checker (`scripts/readiness/`). Ingest = `recordBranchChannel` / `recordSuiteStatus` in
`console/functions/src/readiness.ts`. New fields `previewStatus` + `testSuiteStatus`; nothing gated yet.

**Next ▶**
- Wire a green verdict to actually dispatch `preview-e2e.yml` (must use the GitHub App —
  `GITHUB_TOKEN`-triggered dispatches are suppressed by GitHub).
- Populate `testSuiteStatus.run` from the gate's `workflow_run`; wire the Recheck button.
- Then let `canProceed` gate the tester's Approve.
- Burn down the coverage backlog: **28 of 54** app folders have no suite (2 fenced, 24 covered).
- CF + Flutter: cut their gates over from the `cicd-*` stand-ins to real `development`.

**Dropped** — `branch-guard` (enforcement deferred to the optional final layer).

## 5. Hard-won gotchas (don't re-learn these)
- **project-id must be `starlabs-cicd` everywhere** (emulator + app + seed) or **auth silently fails** → the
  Angular gate caller passes `firebase_project: starlabs-cicd`.
- **Deploy = `firebase deploy --only hosting`** — the deploy service account can't deploy Firestore rules (a full
  `firebase deploy` → 403).
- **Secrets per app repo:** one fine-grained **`REPO_PAT`** (read on the 3 private repos) + **`STARLABS_CICD_SA`**
  (history, optional).
- **Hub Settings → Actions → Access = organization** so callers can resolve the `@main` reusable workflows.
- CI must recreate `e2e/app` + `e2e/starlabs-cloud-function` **symlinks** (the hub scripts are hub-rooted); the
  overlay (`ci/setup-emulator-config.sh`) creates the **gitignored** `environment.development.ts`.
- Reusable-workflow numeric fields can't use `${{ }}` expressions (keep `timeout-minutes` static).
- **The console tracks workflows BY NAME**: `preview.yml`, `deploy_19.yml`, and any display name containing
  `e2e`. Everything else is ignored ("not a tracked lane"). That is exactly why the new flow lives in
  `branch-channels.yml` with no such word in its name — and why renaming it would silently hand it control of
  the old flow's status fields.
- **Channel URLs must never be reconstructed.** They carry a random hash; `previewUrlFor()` produces
  `breakthroughs-test-<branch>.web.app` (single dash, no hash) which cannot resolve. Always read the URL back
  from `firebase hosting:channel:deploy --json`, selecting YOUR site — not "the first web.app string".
- **`git diff --name-status` is TAB-separated.** Splitting on whitespace shreds every folder name containing a
  space, and this codebase is full of them ("queue system", "Business Dashboard", "Diagnostics Tool").
- **`**/*.md` requires a directory** under the shared `globToRegex`, so root-level docs need a bare `*.md` too.
  That glob function is copied in `scripts/readiness/lib.cjs` and must never diverge from `suites.ts`.
- Tooling notes: when the auto-approval safety classifier model is down, `Bash`/`Write`/`Edit` are blocked
  (read-only still works). In this setup Claude can't run `git` directly → **edit files locally, the human commits/pushes**.

## 6. How to operate (developer commands)
```bash
gh pr list   -R School-of-Excellence/starlabs-angular            # open PRs
gh pr view  <n> -R School-of-Excellence/starlabs-angular --web   # details in browser
gh pr checks <n> -R School-of-Excellence/starlabs-angular        # gate / preview results
gh pr merge <n> -R School-of-Excellence/starlabs-angular --squash# merge → deploy
gh pr close <n> -R School-of-Excellence/starlabs-angular         # close without merge
# debug a specific spec with traces:
gh workflow run queue-e2e.yml -R School-of-Excellence/starlabs-angular --ref cicd-dev -f only='queue/operator.spec.ts' -f evidence=1
```
**One PR per branch** (a head→base pair has a single open PR; new commits update it & re-run the gate). Different
branches = one PR each. A PR closes when **merged** (→ deploy), **closed** (discarded), or its head branch is deleted.

## 7. Next session: start here
1. Read this file (it's self-contained).
2. Confirm branches: angular = `feature/cicd-rollout`, hub = `main`.
3. Continue **Phase 1A (release console)** — the console scaffold lives in the hub at `console/` + `console/functions/`.
