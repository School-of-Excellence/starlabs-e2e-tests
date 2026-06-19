# CI/CD Rollout — Runbook & Milestone Tracker

> Companion to [`2026-06-16-1835-cicd-platform-master-plan.md`](2026-06-16-1835-cicd-platform-master-plan.md) (locked design)
> and [`../SETUP.md`](../SETUP.md) (hub/dev setup). This file tracks **what is shipped**, **what each repo now
> contains**, and **the manual operator steps** (GitHub settings/secrets/branches) that automation cannot do.
>
> Targets are resolved from [`../targets.json`](../targets.json):
> - `starlabs-angular` → github.com/School-of-Excellence/starlabs-angular
> - `starlabs-cloud-function` → github.com/School-of-Excellence/starlabs-cloud-function
> - `breakthroughs-flutter` → github.com/School-of-Excellence/breakthroughs-flutter
> - hub: `starlabs-e2e-tests` → github.com/School-of-Excellence/starlabs-e2e-tests

## Milestone status

| # | Milestone | Status | Artifacts |
|---|-----------|--------|-----------|
| M0 | Branches + secrets baseline | 🟡 doc done — operator actions pending | this file |
| M1 | Reusable web gate + Angular caller | ✅ authored; engine **verified green locally** | hub `web-e2e.yml`, angular `queue-e2e.yml` |
| M2 | Angular deploy-gate harden + preview | ✅ authored | angular `deploy_19.yml`, `preview.yml` |
| M3 | branch-guard | ❌ **DROPPED** — enforcement deferred; removed from canonical branches | — |
| M4 | Cloud-fn gate + deploy-reconcile | 🟡 gate ✅; deploy ⛔ needs operator input | hub `cf-e2e.yml` + CF caller; hub `scripts/deploy/cf-reconcile.sh` |
| M5 | Flutter gate + delivery | 🟡 gate ✅; delivery ⬜ deferred (creds) | hub `flutter-e2e.yml` + flutter caller |
| M6 | Append-only history | ✅ authored & smoke-tested | hub `scripts/history/record-run.cjs`, `record-local.sh`; wired into `web-e2e.yml` + `cf-e2e.yml` + `flutter-e2e.yml` |
| M7 | History Dashboard + Allure | ✅ dashboard authored; Allure noted | hub `dashboard/` (login-gated SPA over `cicd-audit`) |
| M8 | Release console (Phase 1A) | ▶ **ACTIVE NEXT** — design locked, scaffold exists | hub `console/` + `console/functions/` |

> **CURRENT STATE (2026-06-18):** Foundation **proven** — full cycle (preview → PR → gate → merge → deploy →
> promote) green on the `cicd-*` sudo branches; `operator.spec` **13/0 in CI**. Canonical Angular branch =
> **`feature/cicd-rollout`**. Real `development`/`production` untouched. See [`CICD-JOURNAL.md`](CICD-JOURNAL.md)
> for the start-here handoff (timeline, gotchas, next steps).

### Decisions & fixes (2026-06-17)
- **Test-data strategy (LOCKED):** two data planes, isolation lives in the GATE not the preview.
  - **E2E gate → locked, isolated data.** Each gate run is a hermetic **emulator** sandbox (Firestore + the real
    CF triggers loaded in) with a **fresh seed per spec file**; multiple PRs/branches = separate CI runs = zero
    collision. The exact **seed snapshot is archived in `cicd-audit`** (add an optional post-run Firestore export
    for the *final* state) → revisitable forever. This is where "per-test isolated, locked-for-reference" lives.
  - **Preview channel → shared `starlabs-cicd`, seeded sample data** (structure-replica of prod, NOT a dev/prod
    copy), reset nightly + on-demand. All 3 apps' previews point at the SAME starlabs-cicd default DB so CF
    triggers work normally. (Switch `preview.yml` off `starlabs-test` → `starlabs-cicd`; needs a `FIREBASE_CICD_CONFIG`.)
  - **Rejected:** per-branch named Firestore DBs — breaks because CF triggers bind to one database and 3 repos ×
    N PRs can't coordinate which DB each uses. Isolation belongs in the emulator gate, not the hosted preview.
  - **Expiry:** preview channel 7d · reports + logs + seed/export snapshots **never** expire (`cicd-audit`/GCS) ·
    (no per-branch live DB to expire).
- **Enforcement (UPDATED 2026-06-18): DROPPED for now.** `branch-guard` has been **removed** — no push/merge
  restriction during rollout; **PR-only is team policy**. A hard wall (GitHub Team branch protection + CODEOWNERS,
  or the console as merge-authority) is the **optional final layer (Phase 3)**, added later — zero rework.
  (Superseded the earlier auto-revert stopgap.)
- **First-run fixes:** (1) reusable workflows had `timeout-minutes: ${{ inputs.timeout_minutes }}` — an expression
  in a numeric field, which fails workflow compile (caller dies at 0s as "workflow file issue"); replaced with a
  static value in `web-e2e.yml`/`cf-e2e.yml`/`flutter-e2e.yml`. (2) `preview.yml` used `firebase
  hosting:channel:deploy --site …` — invalid in fb-tools 14 (site comes from `firebase.json`); flag removed and
  env-gen moved before the typecheck.

### M8 — Release console (locked design; thin projection over GitHub)
A new Angular app on `starlabs-cicd` that VIEWS and orchestrates, with **GitHub as the source of truth**:
- A Cloud Function **webhook receiver** consumes `push` / `pull_request` / `deployment_status` / `workflow_run`
  → updates Firestore `release-candidates/{branch}` (status DERIVED, never hand-set).
- Lifecycle: `NO_ACTION → OK_TO_RELEASE → PR_TO_DEV → DEV_MERGED → PR_TO_PROD → PROD_MERGED` (only `OK_TO_RELEASE` is manual; the rest are derived from GitHub webhooks).
- UI: channel list + status chip + preview URL + linked e2e report (from `cicd-audit`) + writeable QA notes +
  one-click "Create PR → dev/prod" (GitHub API via a Function). Firebase Auth, team-restricted.
- **Build thin** — do NOT reimplement PR/merge/deployment tracking; reuse M6 history + M7 dashboard.
- Backend home: a dedicated functions codebase in `starlabs-cicd` (isolated from the product CF / ATC).
  Credential (GitHub App vs PAT) + webhook home: decided when the build starts.

### Local verification (2026-06-17)
- Gate engine smoke (`ONLY='queue/operator.spec.ts' bash scripts/run-isolated.sh`): emulator booted healthy
  (firestore/auth/functions all up), **operator.spec.ts → 13 passed / 0 failed / 2 runtime-gated skips, exit 0.**
  Confirms the engine that M1/M4 reusable workflows wrap runs end-to-end locally.
- History helper: syntax-clean, graceful no-op without an SA, ATC guard in `cf-reconcile.sh` refuses `*atc*` names.

## M0 — Operator action checklist (do these once; automation cannot)

### A. Branches
- [ ] `starlabs-cloud-function`: create a `production` branch off `development`.
- [ ] `breakthroughs-flutter`: create a `production` branch off `development`.
- [ ] `starlabs-angular`: already has `production` ✅.

### B. Hub org-reuse setting (REQUIRED for M1 callers to work)
- [ ] In **starlabs-e2e-tests** → Settings → Actions → General → **Access** →
      "Accessible from repositories in the **School-of-Excellence** organization".
      Without this, `uses: …/starlabs-e2e-tests/.github/workflows/web-e2e.yml@main` fails for callers.

### C. Maintainer allowlist (production deploys)
- [ ] Current allowlist (hardcoded in each deploy workflow's `guard` job): **`vignesh-027`**.
      To add maintainers, edit the `ALLOWLIST:` env (space-separated) in each repo's deploy workflow.

### D. Secrets (set as repo or org secrets)

| Secret | Used by | Repos |
|---|---|---|
| `CICD_PAT` | gate clones private e2e + CF repos | angular, (later) CF, flutter callers — or org-level |
| `FIREBASE_TEST_CONFIG` / `FIREBASE_PROD_CONFIG` | Angular env files | angular |
| `WATSON_TEST_CONFIG` / `WATSON_PROD_CONFIG` | Angular env files | angular |
| `SALESCRM_TEST_CONFIG` / `SALESCRM_PROD_CONFIG` | Angular env files | angular |
| `PICOVOICE_ACCESS_KEY` | Angular env files | angular |
| `GOOGLE_SERVICE_TEST` | deploy/preview to `starlabs-test` | angular |
| `GOOGLE_SERVICE_PROD` | deploy to `fir-sample-aae4a` | angular |
| `STARLABS_CICD_SA` | append-only history writes (M6) + cloud seeders | hub / CI (later) |

> ⚠️ `CICD_PAT` must be a fine-grained PAT with **read** access to the private `starlabs-e2e-tests`
> **and** `starlabs-cloud-function` repos. The default `GITHUB_TOKEN` cannot read other private repos.

## What shipped per repo (M1 + M2)

### hub `starlabs-e2e-tests`
- `.github/workflows/web-e2e.yml` — **reusable** (`workflow_call`) hermetic emulator gate. Inputs:
  `cf_branch` (default `development`), `e2e_ref` (default `main`), `only` (spec subset), `firebase_project`,
  `timeout_minutes`. Secret: `CICD_PAT`. This is the single source of gate logic; app repos call it.

### `starlabs-angular`
- `.github/workflows/queue-e2e.yml` — now a **thin caller** of the hub `web-e2e.yml` (was the full app-centric gate).
- `.github/workflows/deploy_19.yml` — **hardened**: push→`development` auto-deploys to TEST; **production deploy is
  manual `workflow_dispatch` only**, gated by a `guard` job (allowlist + must run from `production`). The old
  `push: production` trigger (unguarded prod deploy) was **removed**.
- `.github/workflows/preview.yml` — **new** Stage-1 fast lane (lint/tsc advisory, build hard gate) + Firebase
  Hosting **preview channel** per feature branch (TEST project, 7-day expiry).

## How a change flows now (Angular, today)

```
 feature/* push ──► preview.yml: fast checks + hosting channel (TEST, 7d)   [Stage 1]
       │ open PR → development
       ▼
 queue-e2e.yml (thin caller) ──► hub web-e2e.yml: hermetic emulator gate    [Stage 2]
       │ human merges (gate green + manual QA)
       ▼
 push to development ──► deploy_19.yml: auto-deploy to starlabs-test         [Stage 3]
       │ open PR development → production, merge
       ▼
 maintainer dispatches deploy_19.yml from `production` (allowlist enforced)  [Stage 4]
       └──► deploy to fir-sample-aae4a (LIVE)
```

## M6 — append-only history: how to use

- **CI:** automatic. The reusable gates (`web-e2e.yml`, `cf-e2e.yml`) call `record-run.cjs` after every run
  (best-effort; no-ops if `STARLABS_CICD_SA` secret is unset, never fails the gate). Records the HTML report +
  the seed inputs (`sample-queue-config.json`, `firestore-seed.json`) to Cloud Storage and an index doc to
  Firestore `cicd-audit` in `starlabs-cicd`, keyed by `runId` (repo-branch-sha-timestamp). Duplicate runId is refused.
- **Local:** after a local gate, run `RESULT=pass bash scripts/history/record-local.sh` (uses the SA that
  `setup.sh` placed at `./starlabs-cicd-sa.json`). `source: local` distinguishes it from CI runs.
- **v1 seed snapshot = the seed INPUTS** (deterministic fixtures), not a post-run Firestore export. A full
  emulator export is a v2 enhancement (the `ATTACH` env knob already accepts extra paths/dirs).

## M4 — cloud-function deploy: ⛔ BLOCKING QUESTIONS before wiring auto-deploy

The CF **gate** is done and safe. The CF **deploy** is deliberately NOT auto-wired because a wrong filter can
mass-delete ATC functions. Confirm these before M4 deploy is wired:
1. **Managed-function allowlist** — exactly which functions does CICD manage/deploy? (`cf-reconcile.sh` deploys
   only this list and refuses any name containing `atc`.) The repo deploys via `functions/index.js` today.
2. **Entrypoint state** — `functions/package.json` `main` currently = `index.emulator.js` (an emulator artifact;
   `deploy-cf-emulator.sh` swaps it). A real deploy must use `index.js`. Confirm the committed `main` is correct,
   or have the deploy workflow set it explicitly before `firebase deploy`.
3. **Targets + secrets** — CF test project (`starlabs-test`?) and prod (`fir-sample-aae4a`) + which SA secrets
   (`GOOGLE_SERVICE_TEST`/`PROD`) the CF repo uses.
4. **Cross-repo re-gate** — on CF merge→development, trigger the Angular gate (via `repository_dispatch`/`gh
   workflow run`). Needs a token with `actions:write` on the angular repo.

Once answered: wire `deploy-cf.yml` (push→dev = `cf-reconcile.sh` to test, no `--force`; prod = manual dispatch
+ `vignesh-027` allowlist) + the re-gate dispatch.

## Next: M5 (flutter gate + delivery), M7 (dashboard). See milestone tracker above.

## Enforcement decision — console-gated, stay on Free (2026-06-17)

Supersedes the earlier "branch-guard `auto_revert: true`" stopgap in *Decisions & fixes (2026-06-17)* above.

**(a) Decision: "console-gated, stay on Free."** We do not upgrade to GitHub Team yet. The **release console
becomes the merge authority** — its **GitHub-App bot** is the only identity that performs merges, and only when
the caller is on the console's **per-branch approver allowlist** (development list + stricter production list,
mirroring [`../.github/CODEOWNERS`](../.github/CODEOWNERS)). Developers are asked **by policy** to release through
the console. *Honest gap:* on Free this is policy + tooling, not a hard wall — a determined dev can still merge via
the GitHub UI until **GitHub Team branch protection** is enabled. Team remains the documented future hard wall;
all current wiring is forward-compatible (zero rework). See GOAL.md §3 and ARCHITECTURE.md §8.

**(b) `deploy_19.yml` reverted to auto-deploy on merge (both branches).** The earlier prod hardening
(production = manual `workflow_dispatch` + allowlist guard) is **reverted**: merge→`development` auto-deploys to
`starlabs-test`, and merge→`production` auto-deploys to `fir-sample-aae4a`. Merge authority now sits at the
console gate, so the deploy workflow trusts an approved merge and deploys automatically on both branches.

**(c) `branch-guard` set to alert-only.** `auto_revert` is **off** on all repos/branches. The guard now only
**alerts** on a non-PR push (visible drift signal); it does not revert. Auto-revert returns for free if/when Team
branch protection lands and makes it moot.

**(d) Console now lives in the hub.** The release console is no longer "a new app to scaffold later" — it lives
in this repo: **frontend → [`../console/`](../console/)**, **backend (Cloud Functions) →
[`../console/functions/`](../console/functions/)**, deploying to the `starlabs-cicd` project (isolated from the
product cloud-function / ATC).
