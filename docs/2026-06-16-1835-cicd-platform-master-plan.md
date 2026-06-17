# CI/CD Platform — Master Plan & Parallel-Session Handoff

> **Created:** 2026-06-16 18:35:42 IST
> **Author:** planning session (Claude) with operator
> **Purpose:** single source of truth so multiple parallel sessions/agents can start implementation without re-deriving anything. Read this top-to-bottom before touching code.
> **Status:** PLAN LOCKED. Implementation NOT yet started. Operator is creating the 4 repos.

---

## 0. TL;DR (read this first)

We are building a **multi-repo CI/CD platform** for the StarLabs / "Breakthroughs" product family. One shared **Playwright** test engine + reusable GitHub Actions workflows that every repo plugs into. Code travels **feature → preview → development → production** behind a hermetic test gate and human approvals. We are on **GitHub Free + private repos**, so enforcement is done by **gating the deploy, not the branch**. History of every run (report + the exact test data + approvals) is kept **append-only** in Firebase. First system to get full CI/CD = the **queue system**.

---

## 1. Repositories (4) — ⚠️ NAMING UNCONFIRMED

Operator is creating 4 repos. Their names vs. canonical roles — **the cloud-function mapping is still unconfirmed** (blocking question, see §10):

| Operator's name | Canonical role | Source folder today |
|---|---|---|
| **CICD** | `playwright-e2e` — shared test engine + reusable workflows + history + (later) dev CLI & E2E Studio | `starlabs-cicd/e2e/` (extract from here) |
| **Starlabs** | `starlabs-angular` — Angular 19 + Firebase web app (the Breakthroughs web platform) | `starlabs-cicd/` |
| **Breakthroughs** | ❓ likely `starlabs-cloud-function` — Firebase Cloud Functions backend (UNCONFIRMED) | `starlabs-cloud-function/` |
| **Flutter** | `breakthroughs-flutter` — Flutter mobile app | `breakthroughs-flutter/` |

Each app repo (Starlabs / Breakthroughs / Flutter): branches **`development`** (default) + **`production`**; devs work on **`feature/*`**. CICD repo starts **empty** (we populate it). Need a **`CF_REPO_TOKEN`** (read PAT for the cloud-function repo — the gate clones it) and a **maintainer allowlist** (1–2 GitHub usernames for production dispatch).

---

## 2. Locked decisions

- **Plan:** GitHub **Free + private** repos. No upgrade for now. (GitHub Team ~$4/user/mo would unlock real branch protection + env approval gates later, with zero rework — workflows are written forward-compatible.)
- **Enforcement = deploy-gate, not branch-lock** (the only viable Free+private option): shared repos, `feature/*` by policy + CODEOWNERS (auto-requests review, can't *require* on Free). **Production deploy = manual `workflow_dispatch` restricted to a maintainer allowlist (checked via `github.actor`, refuse others).** A **branch-guard** workflow alerts/auto-reverts stray direct pushes to protected branches. Do NOT use forks (breaks preview links — fork PRs get no secrets).
- **Test placement (staged, cost-aware — Free = 2,000 Actions min/mo):**
  - **Stage 1** (every `feature/*` push): FAST — lint, `tsc --noEmit`, unit, build → deploy preview surface. Cheap.
  - **Stage 2** (PR → development, runs AUTOMATICALLY on "ready"/label, **pre-merge**): the FULL path-filtered hermetic Playwright gate. Report posted on the PR. Manual QA happens in parallel. **Human merges** only when gate green + QA approved (NO auto-merge).
  - **Stage 3** (merge → development): deploy to test env.
  - **Stage 4** (PR development → production): re-run gate, then **manual maintainer dispatch** → live deploy (PROD config).
- **Mobile build infra:** Android → **GitHub Actions + fastlane** → Firebase App Distribution → Google Play. iOS → **Codemagic** (free tier; native TestFlight/App Store; better Flutter fit than Xcode Cloud). Apple Developer Program $99/yr required.
- **Graph store = HYBRID:** raw graphify JSON + wiki in Cloud Storage (by SHA); queryable index in Firestore (route→collections/cfs/specs); vector embeddings for semantic lookup. Powers the (deferred) E2E Studio.

---

## 3. Environment / Firebase project model

| Env | Firebase project | Data | Notes |
|---|---|---|---|
| **Emulator** (in the gate) | ephemeral, in CI | fresh fixtures per run | automated correctness; isolated per-run; ATC fenced; prod-firewall on |
| **Preview** + **history/audit** | **`starlabs-cicd`** (Blaze) | pre-populated SAMPLE data **replicating prod STRUCTURE** (collections/indexes/rules/Storage), NOT a prod copy | nightly teardown+reseed from `e2e/fixtures/` + on-demand reseed button; also hosts the preview Hosting site and `cicd-audit` |
| **Development** | **`starlabs-test`** | accumulating realistic test data | the live test environment |
| **Production** | **`fir-sample-aae4a`** | live | only the `production` branch builds PROD config |

**Hard constraints (never violate):** ATC collections are OFF-LIMITS — never read/write/seed (`atc_alpha`, `atc_to_validate`, `triple atc`, `ai_generated_atc_summary*`, `temporary_*atc*`, `assignment_*atc*`, `big *atc*`, `0 atcinvolved issue`, etc.). Production is read-only for test infra. `--legacy-peer-deps` required for Angular installs.

---

## 4. The four cases (per-repo flows)

### Universal spine (every repo)
`feature/* push → Stage1 fast + preview → PR to development → Stage2 full gate (auto, pre-merge) + manual QA in parallel → human merges → deploy to test → PR development→production → Stage4 gate re-run → maintainer approves → manual dispatch → deploy LIVE.` History written at every gate/QA/approve/deploy. Both PRs exist (feature→dev AND dev→prod).

### Case 1 — CICD / `playwright-e2e` (two personas)
- **Persona A — Developer CLI** (`run e2e`): prompts → (1) suites? all/specific → (2) target? **per project** local path OR repo+branch (resolves BOTH app + cloud-function) → (3) cases? full/specific → run on emulator + real triggers → persist report+logs+seed-snapshot to Firebase **append-only** → if local-project mode & green, push test code to the CICD repo.
- **Persona B — Non-developer interface (E2E Studio)** — describe a test case/suite → generated/developed/tested. **DEFERRED** (its own workflow later).

### Case 2 — Starlabs / `starlabs-angular`
Push → ONE step creates BOTH a **preview channel** (`firebase hosting:channel:deploy <branch> --site <SITE> --expires 7d`, channel = branch name, auto-populated sample data for manual QA + notes/logs) AND a **PR to development with the Playwright report attached**. Dev reads report + manual QA notes → merge. Both artifacts stored + referenced at merge. Then development→production same flow.

### Case 3 — Breakthroughs / `starlabs-cloud-function`
Same spine **minus the preview channel** (backend has no URL). **Preview = the emulator gate** running the real modified triggers; reviewers read the gate report. On merge → **deploy reconcile (new/changed/DELETED, ATC-scoped)** to test, then prod by manual dispatch. **Cross-repo:** when CF lands on development, the Starlabs gate re-runs against the new CF behavior.
- ⚠️ **CF deploy footgun:** never `firebase deploy --only functions --force` with the filtered `index.cicd.js` entry — it would delete ALL functions not in the filter, **including ATC**. Instead: deploy `--only functions:<managed list from index.cicd.js>`; for deletions, diff vs the last-deployed manifest (stored in history) and explicitly `firebase functions:delete` only managed functions. ATC can never appear in that diff.

### Case 4 — Flutter / `breakthroughs-flutter`
Same spine + native delivery. Preview surfaces: Flutter **web** → Hosting channel; **Android APK** → Firebase App Distribution; **iOS IPA** → TestFlight (Codemagic). Gate = `flutter test integration_test` (native UI) **+** Playwright smoke (web build). Promote → Google Play (GH Actions+fastlane) + App Store (Codemagic). Honest split: Playwright covers web only; native UI covered by integration_test.

### Untested systems (no specs yet) — Option 1, refined
Same flow; **manual QA on the preview IS the gate**. But: (1) PR labeled `⚠️ no automated coverage — manual QA required`; (2) still run build + crash-smoke on changed routes + any existing path-filtered tests; (3) log the gap to history (graphify `specsCovering: []` = the backlog); (4) backfill via CLI/Studio over time. Reject manual push/pull bypass.

---

## 5. Append-only history (what's stored per run)

Keyed by **run-id + commit SHA + branch + author + timestamp**, never overwritten:
1. **Automated** — Playwright HTML report + traces + the exact **seed-data snapshot**.
2. **Manual** — tester's channel QA notes/logs.
3. **Decision** — approver, merger, result, deploy target.

Storage = **Cloud Storage** (artifacts) + **Firestore `cicd-audit`** (index), both in `starlabs-cicd`. Local CLI runs and CI runs write to the SAME history (`source: local | ci`). Viewer = a login-gated **History Dashboard** (run list + run-detail timeline + viewable/downloadable seed snapshot + compare-runs) + **Allure** for cross-run trends. Dashboard ships first/independently; can later merge with E2E Studio into one console.

---

## 6. Existing assets to build ON (don't rebuild)

In `starlabs-cicd/e2e/` today:
- `scripts/deploy-cf-emulator.sh` — boots Firebase emulator + the REAL Cloud Functions (heap-capped, sequential workers).
- `scripts/run-isolated.sh` — runs each spec FILE as its own Playwright invocation (fresh reseed per file, self-heals emulator crash, exit code = #failing files = the gate). This IS the gate engine.
- `_shared/prod-firewall.ts` — blocks all production endpoints (safety + stub).
- `lib/assertions.ts`, `lib/*.js` — invariant helpers + oracle libs.
- `fixtures/seed-emulator.js`, `fixtures/seed-test-project.js` — seeders.
- 18 `playwright.<suite>.config.ts` configs (queue, comms, events, big, authroles, …).
- `PLAN.md` — the queue master test plan + coverage matrix (§2 is ground truth; suite is "compiling, not yet observed-green").
Existing workflows in `starlabs-cicd/.github/workflows/`: `queue-e2e.yml` (the hermetic gate to generalize), `deploy_19.yml` (deploy-only, the config-branching reference), `setupFirebase.yml`.

---

## 7. Phased implementation plan (for parallel sessions)

**Critical path = Phase 1 (queue suite observed-green).** Put the most agents there.

### PHASE 0 — Engine foundations · no repo needed · START NOW · 4 parallel agents
- **P0.1** Organize `playwright-e2e` repo tree (pages, fixtures, lib, scripts, configs) from `e2e/`.
- **P0.2** Reusable workflows: `web-e2e.yml`, `deploy.yml` (deploy-gated), `branch-guard.yml` + caller templates.
- **P0.3** CICD-project plumbing: nightly re-seed job + **audit-write helper** (→ `starlabs-cicd`).
- **P0.4** CF **deploy-reconcile** script (new/changed/deleted, ATC-scoped).

### PHASE 1 — Queue suite GREEN baseline · ⭐ CRITICAL PATH · parallel by spec group
- **P1.1** `queue/operator.spec.ts` + `studio-*` → observed-green.
- **P1.2** `big-*` + `queue/variations/*` → observed-green.
- **P1.3** `cf-sideeffects` + `authroles` + `comms` → observed-green.
- **P1.4** Emulator/seed reliability (self-heal, `webServer` fix → `node_modules/.bin/serve`, per-file reseed).
- Run target: emulator (default) via `EMU_REUSE=1 EMU_REUSE_APP=1 bash scripts/run-isolated.sh`. Set `TEST_PROJECT=starlabs-cicd` + `GOOGLE_APPLICATION_CREDENTIALS=<SA json>` for the cloud path.

### PHASE 2 — Starlabs/angular CICD · after P0 + P1
P2.1 caller (Stage1 fast + preview channel) · P2.2 PR gate (Stage2 path-filtered queue suite) · P2.3 deploy-gate (Stage3 dev + Stage4 prod manual dispatch + allowlist + branch-guard).

### PHASE 3 — cloud-function CICD · after P0 + P1 · ∥ Phase 2
P3.1 `cf-ci.yml` caller + gate (real triggers + queue suite) · P3.2 deploy-reconcile wiring (P0.4) · P3.3 cross-repo re-gate trigger.

### PHASE 4 — flutter CICD · after P0 · ∥ Phases 2–3
P4.1 caller (fast + builds + web channel) · P4.2 gate (`integration_test` + web smoke) · P4.3 delivery (APK→App Distribution, IPA→TestFlight/Codemagic) + deploy-gate.

### PHASE 5 — Observability & tooling · after P0.3 · ∥
P5.1 History Dashboard (reads `cicd-audit`) + Allure · P5.2 Dev CLI (Persona A) · P5.3 E2E Studio (Persona B) — **DEFERRED**.

### Dependency map
```
 P0.1 P0.2 P0.3 P0.4  (all parallel, now)
        |
        v
 P1.1 P1.2 P1.3 P1.4  (parallel) ──► QUEUE GREEN ⭐
        |
        +──────────┬──────────┬──────────┐
        v          v          v          v
     PHASE 2    PHASE 3    PHASE 4    PHASE 5   (parallel once green + repos exist)
    (angular)  (cloud-fn) (flutter)  (history/CLI)
```
**Repo completion order ("one by one"):** Queue via Starlabs/angular (full ladder) → cloud-function → flutter.

### Two execution waves for "tonight"
- **Wave A (startable now, no repos needed):** all Phase 0 (staged into a local `staging/` folder) + kick off Phase 1 queue-green (3–4 agents by spec group) on the local emulator.
- **Wave B (once repos exist + P0/P1 land):** Phases 2/3/4/5.1/5.2 in parallel.
- **Honest scoping:** Phase 0 + the workflow wiring in 2/3/4 are mechanical and can land tonight. **P1 (observed-green) is the long pole** (flakiness, emulator crashes, runtime-gated specs) — gate stays **report-only** until green, then flips to "required".

---

## 8. How to start a parallel session (bootstrap checklist)

Each session/agent should:
1. **Read this journal fully** + `starlabs-cicd/CLAUDE.md` (constraints) + `starlabs-cicd/e2e/PLAN.md` (queue coverage) + `starlabs-cicd/specs/ORIENTATION.md`.
2. Pick ONE phase task ID (P0.x / P1.x / …) and own it end-to-end.
3. Respect the hard constraints (§3): ATC off-limits, prod read-only, prod-firewall, `--legacy-peer-deps`.
4. Write results/decisions back as a dated journal entry in `Journal/` (this folder) so other sessions stay in sync.
5. Never push to `development`/`production`; never deploy without the manual-dispatch path.

---

## 9. Tools / stack

Playwright (TS) · Firebase Emulator (Firestore/Auth/Functions) · firebase-admin · GitHub Actions (reusable workflows) · Firebase Hosting channels · fastlane + Firebase App Distribution (Android) · Codemagic + TestFlight (iOS) · Allure (history) · graphify (knowledge graph) · Claude/Agent SDK (authoring) · Cloud Storage + Firestore `cicd-audit` (history) · GitHub repo/org secrets.

---

## 10. OPEN ITEMS / blocking questions

1. ⚠️ **CONFIRM REPO NAMING** (blocking): where do the **Cloud Functions** live — is **"Breakthroughs"** the cloud-function repo, or is it a **5th** repo? (See §1.) Everything in Phase 3 depends on this.
2. Maintainer allowlist (GitHub usernames) for production dispatch.
3. Secrets to load: Firebase web configs (cicd/test/prod), service-account JSONs (cicd seed+audit, test, prod), `CF_REPO_TOKEN`, Slack token (Flutter), Picovoice; later Apple/Codemagic/Google Play creds.
4. Pending design decisions (non-blocking): D2 graph store (hybrid recommended) · D3 E2E Studio stack (Angular vs Next/Vite) · D4 framework sharing (git-checkout now → npm later) · D5 audit store (Firestore vs BigQuery).
5. Deliverables already produced (presentation): `cicd-platform-presentation/` — `cicd-movie.html` (narrated animated explainer), `cicd-deck.html`, `cicd-platform-manual.pdf` (20 slides).

---

## 11. Next action

Operator is creating the 4 repos + confirming the cloud-function mapping (§10.1). On return: **launch Wave A** — stage all Phase 0 engine files, then dispatch Phase 1 queue-green agents. Then roll into Wave B as repos come online.

*End of master plan. Keep this file as the canonical reference; append dated entries for each session's progress.*
