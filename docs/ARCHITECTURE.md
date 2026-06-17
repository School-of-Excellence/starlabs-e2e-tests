# StarLabs CI/CD — Architecture

> How the four projects are built, how they integrate, and how code flows from a developer's branch to
> production. Companion docs: [`GOAL.md`](GOAL.md) (objectives + enforcement) and
> [`CICD-ROLLOUT.md`](CICD-ROLLOUT.md) (milestone tracker + runbook).

---

## 1. Overview

One shared **Playwright test engine + reusable GitHub Actions pipelines** that every product repo plugs into.
Code travels `feature branch → preview → development → production`. Robots do the build/test/deploy; humans do
the review/approve. Every test run is archived immutably. A **release console** (a web app) gives the team a
single board to review previews, mark "OK to Release", open/approve PRs, and watch deploys — with **GitHub as
the source of truth**.

---

## 2. The four repositories

| Repo | Role | Builds into | Pipeline files it carries |
|---|---|---|---|
| **starlabs-angular** ("Starlabs 19") | Web app (Angular 19 + Firebase) | a website on Firebase Hosting | `preview.yml`, `queue-e2e.yml`, `deploy_19.yml`, `branch-guard.yml` |
| **starlabs-cloud-function** | Backend (Firestore triggers) | Firebase Functions | `cf-e2e.yml`, `branch-guard.yml` |
| **breakthroughs-flutter** | Mobile app (Flutter) | APK / IPA / web build | `flutter-e2e.yml`, `branch-guard.yml` |
| **starlabs-e2e-tests** (**the HUB**) | Shared test engine + reusable pipelines + history + the release console | — (tooling/platform) | `web-e2e.yml`, `cf-e2e.yml`, `flutter-e2e.yml`, `branch-guard.yml`, `scripts/`, `console/` |

The three product repos each carry only a **thin caller** that delegates to the hub's reusable workflow, so the
pipeline logic is defined once and inherited everywhere.

---

## 3. Integration model

```
        ┌──────────────────────── THE HUB · starlabs-e2e-tests ───────────────────────────┐
        │ reusable pipelines:  web-e2e.yml · cf-e2e.yml · flutter-e2e.yml · branch-guard   │
        │ test engine:         scripts/run-isolated.sh + Firebase emulator + seed fixtures │
        │ history:             scripts/history/record-run.cjs → Firestore cicd-audit       │
        │ release console:     console/  (Angular UI + Functions backend) → starlabs-cicd  │
        └──────▲──────────────────────▲───────────────────────▲──────────────────────▲─────┘
               │ uses:@main            │ uses:@main            │ uses:@main            │ writes history
   ┌───────────┴──────┐   ┌────────────┴───────┐   ┌───────────┴────────┐             │
   │ starlabs-angular │   │ starlabs-cloud-fn  │   │ breakthroughs-     │   every gate run, local + CI,
   │  queue-e2e.yml   │   │  cf-e2e.yml        │   │ flutter-e2e.yml    │   → cicd-audit (never overwritten)
   │  preview.yml     │   └────────────────────┘   └────────────────────┘
   │  deploy_19.yml   │
   └──────────────────┘
```

When the gate runs, the hub assembles **one test workspace from three repos** — the app under test, the hub
engine, and the real cloud-functions — inside a **Firebase emulator**, so the app is tested against the *real*
backend triggers, hermetically (nothing touches the cloud).

---

## 4. Environments (Firebase projects)

| Environment | Firebase project | Purpose |
|---|---|---|
| **Emulator** | ephemeral, in CI (booted as `starlabs-cicd`) | runs the test gate; fresh seed per run; never touches the cloud |
| **Preview + History + Console** | **`starlabs-cicd`** (Blaze) | per-branch preview channels · `cicd-audit` history · the release-console app |
| **Development / Test** | **`starlabs-test`** | merge into `development` deploys here |
| **Production / Live** | **`fir-sample-aae4a`** | merge into `production` deploys here |

**Hard constraints:** ATC collections are OFF-LIMITS (never read/write/seed). Production is read-only for test
infra. `--legacy-peer-deps` is required for Angular installs. The emulator partitions data by project id, so
the emulator, seed, app, and functions must all use the same id.

---

## 5. The three lanes (as files)

| Lane | File | Triggered by | Does |
|---|---|---|---|
| **Preview (fast)** | `starlabs-angular/preview.yml` | **push to any branch except development/production/main** | install → env → lint+tsc (advisory) → `ng build` (hard) → publish a per-branch **preview channel** on `starlabs-test` |
| **Gate (full e2e)** | `queue-e2e.yml` → hub `web-e2e.yml` | **PR into development** | hermetic Playwright suite vs real CF triggers in the emulator; report on the PR; archived to history |
| **Deploy** | `deploy_19.yml` | **merge (push) into development / production** | builds prod config and **auto-deploys** (development→`starlabs-test`, production→`fir-sample-aae4a`) |

Backend (`cf-e2e.yml`) and mobile (`flutter-e2e.yml`) follow the same gate pattern. The backend has no preview
URL — its gate report *is* the preview. A cloud-function merge re-runs the web gate against the new backend.

---

## 6. Append-only history

Every gate run (local or CI) is saved as an **immutable record** keyed by `run-id + commit + branch + author +
timestamp`: the HTML report + traces + seed inputs go to Cloud Storage, and an index doc to Firestore
`cicd-audit`, both in `starlabs-cicd`. Nothing is ever overwritten (a duplicate run-id is refused). Written by
`scripts/history/record-run.cjs` (CI) and `record-local.sh` (local). This is the fix for "each test overwrites
the previous report."

---

## 7. The release console (lives in the hub, hosted on starlabs-cicd)

A web app — the grown-up version of the hub's `dashboard/` — that VIEWS and orchestrates releases, with
**GitHub as the source of truth**. It does NOT reimplement PR/merge/deploy tracking; it mirrors GitHub via
webhooks and adds the human workflow on top.

```
   GitHub (source of truth)                    starlabs-cicd (console backend + data)
   ───────────────────────                     ──────────────────────────────────────
   webhooks: push, pull_request,  ───────────► Cloud Function: webhookReceiver
             deployment_status,                  → updates Firestore release-candidates/{branch}
             workflow_run                                     │
                                                              ▼
   GitHub REST (writes) ◄── Cloud Function ──┐   Angular console app (Firebase Hosting)
     create PR, merge PR     actions          │     board of cards + status + preview URL
     (only if caller is allowlisted)          │     + linked e2e report + QA notes
                                              └──── + [Mark OK to Release] [Create PR] [Approve & Merge]
```

**Data model** — `release-candidates/{branch}`: `repo, branch, previewUrl, status, reportRunId→cicd-audit,
prDevUrl, prProdUrl, notes[], okToReleaseBy, updatedAt`.

**Status lifecycle:**
```
 NO_ACTION → OK_TO_RELEASE → PR_TO_DEV → DEV_MERGED → PR_TO_PROD → PROD_MERGED
  (auto on    (team sets      (dev opens   (after        (dev opens   (after
   preview)    after review)   the PR)      approve+merge) the PR)      approve+merge)
```
`OK_TO_RELEASE` is the only **manually-set** status (the team's sign-off that the preview is good and the dev
may open a PR). Every other status is **derived** from GitHub webhook events, so the board can't drift.

**Backend home:** the console's Cloud Functions live in the hub and deploy to the `starlabs-cicd` project
(isolated from the product `starlabs-cloud-function`, so it never mixes with product code or ATC). Auth =
Firebase Auth, restricted to the team. GitHub writes go through a **GitHub App** (preferred) or a fine-grained
PAT.

---

## 8. Branch enforcement (push + approval restriction)

Two access requirements, both **branch-level** — which on GitHub require the **Team** plan + branch protection:

| Requirement | Mechanism |
|---|---|
| **Only allowlist can push** to development/production | branch protection: "Require a pull request before merging" + "Restrict who can push to matching branches" (allowlist). Merging is a push, so this also restricts merging. |
| **Only allowlist can approve** PRs to development/production | branch protection: "Require approvals" + "Require review from Code Owners" + `.github/CODEOWNERS`. CODEOWNERS is read from the PR's **base branch**, so development and production can have **different** approver lists. |

**Chosen enforcement today — console-gated, stay on Free.** We are not upgrading the plan yet. Instead the
**release console is the merge authority**:
- The console's **GitHub-App bot** is the only identity that calls the merge API, and it merges **only** when the
  caller is on the console's **per-branch approver allowlist** (a development list and a stricter production list,
  mirroring the [`.github/CODEOWNERS`](../.github/CODEOWNERS) model).
- Developers are asked **by policy** to release through the console rather than merging directly.
- The `branch-guard` tripwire is **alert-only** (no auto-revert — too disruptive): it surfaces drift, it does not
  block it.

**Honest limitation on Free:** this is a *policy + tooling* gate, not a hard wall. GitHub Free cannot restrict who
pushes or merges, so a determined developer can still merge via the **GitHub UI**. CODEOWNERS + the console gate
make that a deliberate, visible bypass — not an enforced barrier.

**The hard wall = GitHub Team + branch protection** ("Require a PR", "Restrict who can push", "Require review
from Code Owners"). That converts both requirements into enforced rules. Everything here is **forward-compatible —
zero rework**; when Team is enabled the console gate becomes redundant defence-in-depth instead of the only gate.

---

## 9. Secrets (per repo / org)

`CICD_PAT` (gate clones private repos) · `FIREBASE_TEST_CONFIG` / `FIREBASE_PROD_CONFIG` · `WATSON_*` /
`SALESCRM_*` · `PICOVOICE_ACCESS_KEY` · `GOOGLE_SERVICE_TEST` / `GOOGLE_SERVICE_PROD` (deploys) ·
`STARLABS_CICD_SA` (history writes) · `POSTHOG_APIKEY` (flutter) · later a GitHub App key + webhook secret
(console). Full table in [`CICD-ROLLOUT.md`](CICD-ROLLOUT.md).
