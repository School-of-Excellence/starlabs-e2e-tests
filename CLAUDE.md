# CLAUDE.md — starlabs-e2e-tests (hub repo)

> New-session bootstrap for Claude Code. Read this first, then start building.
> Last updated: 2026-06-19.

---

## What this repo is

The **hub** for the School of Excellence CI/CD pipeline:
- **Playwright test engine** (`e2e/`, `*.spec.ts`, `_shared/`, `_support/`) — runs against `starlabs-cicd` Firebase emulator in CI
- **Reusable GitHub Actions workflows** (`.github/workflows/web-e2e.yml` etc.) — called by each app repo
- **Release console** (`console/`) — the web app this session is building (Phase 1A)

The four repos in the GitHub org `School-of-Excellence`:
| Repo | Role |
|---|---|
| `starlabs-angular` | Angular 19 web app (the main product) |
| `starlabs-cloud-function` | Firebase Cloud Functions backend |
| `breakthroughs-flutter` | Flutter mobile app |
| `starlabs-e2e-tests` | **this repo** — shared test engine + console |

---

## What to build this session — Phase 1A: Release Console

### Goal
A small web app on `starlabs-cicd` Firebase Hosting where the team:
- sees every preview channel + its status + test report
- clicks **Mark OK to Release → Create PR → Approve & Merge**

No one touches `gh` CLI or GitHub UI. GitHub is the source of truth; the console mirrors it.

### Where the code lives
```
console/                         ← Angular 19 SPA (standalone components)
  src/app/
    core/
      release-candidate.model.ts   ← frontend model (⚠ seam — fix first)
      firebase.service.ts          ← service layer (⚠ seam — fix first)
      auth.service.ts              ← Google sign-in stub (wire up)
      mock-data.ts                 ← offline fixtures (touch only to add repo field)
    board/
      board.component.ts           ← board + filter + toast (mostly done)
      release-card.component.ts    ← one card per candidate (may need repo display)
      status.ts                    ← status chip colors + action gating
    app.component.ts               ← header + auth gate
    app.config.ts                  ← Firebase providers (TODO blocks to uncomment)
  environments/
    environment.ts                 ← useMock flag (flip to false for live)
    firebase.config.example.ts     ← copy → firebase.config.ts and fill in keys

console/functions/src/
  model.ts                         ← backend model (CORRECT — do not change)
  index.ts                         ← all 4 Cloud Functions (CORRECT — do not change)
```

---

## Fix these 2 seams FIRST (before any other wiring)

The scaffold was written in two passes; the backend and frontend drifted. Fix the frontend — the backend is authoritative.

### Seam 1 — callable name mismatch

`firebase.service.ts` calls the wrong function names. Correct mapping:

| Frontend calls (wrong) | Backend exports (correct) |
|---|---|
| `markOkToRelease` | `setOkToRelease` |
| `createPrToDev` | `createPullRequest` |
| `createPrToProd` | `createPullRequest` |
| `approveAndMerge` | `approveAndMerge` ✅ |

Files to fix: `firebase.service.ts` (method names + the `invoke()` call string) and `release-candidate.model.ts` (the `RcAction` type).

### Seam 2 — payload mismatch (missing `repo`, wrong fields)

The backend requires `repo` in every payload and `prNumber` for the merge. The frontend currently omits both. Correct payloads:

| Action | Current (wrong) payload | Correct payload |
|---|---|---|
| `setOkToRelease` | `{ branch, by }` | `{ repo, branch }` (backend derives caller from Firebase Auth token — no `by` field) |
| `createPullRequest` (→ dev) | `{ branch }` | `{ repo, head: branch, base: 'development' }` |
| `createPullRequest` (→ prod) | `{ branch }` | `{ repo, head: branch, base: 'production' }` |
| `approveAndMerge` | `{ branch, stage }` | `{ repo, base: 'development' \| 'production', prNumber }` |

Files to fix: `firebase.service.ts` (payload objects in each method) and `release-candidate.model.ts` (add `prDevNumber?: number` and `prProdNumber?: number` to `ReleaseCandidate`; fix `id` — it is `${repo}__${branch}`, not just branch).

---

## Build order (after seam fixes)

**Step 1 — GitHub App (OPERATOR only; cannot be automated)**
Register a GitHub App on org `School-of-Excellence`:
- Permissions: Contents RW · Pull requests RW · Deployments RO · Actions RO
- Webhook events: `push · pull_request · deployment_status · workflow_run`
- Webhook URL = the deployed `webhookReceiver` Cloud Function URL (known after Step 2)
- Install on all 4 repos. Capture: App ID · Installation ID · private key PEM.

**Step 2 — Deploy backend functions**
```bash
cd console/functions
npm install
# Set secrets (requires Firebase project starlabs-cicd on Blaze plan):
firebase functions:secrets:set GITHUB_WEBHOOK_SECRET --project starlabs-cicd
firebase functions:secrets:set GITHUB_APP_PRIVATE_KEY --project starlabs-cicd
# Fill console/functions/.env.starlabs-cicd (copy from .env.example):
#   GITHUB_ORG=School-of-Excellence
#   GITHUB_APP_ID=<from Step 1>
#   GITHUB_APP_INSTALLATION_ID=<from Step 1>
npm run build
firebase deploy --only functions --project starlabs-cicd
# → grab the webhookReceiver URL → paste into the GitHub App (Step 1)
```

**Step 3 — Create Firestore allowlists doc (OPERATOR)**
In `starlabs-cicd` Firestore, create `console-config/allowlists`:
```json
{
  "okToRelease": ["user@soexcellence.com"],
  "approvers": {
    "development": ["dev@soexcellence.com"],
    "production":  ["cto@soexcellence.com"]
  }
}
```

**Step 4 — Wire and deploy the frontend**
```bash
cd console
cp src/environments/firebase.config.example.ts src/environments/firebase.config.ts
# fill apiKey / messagingSenderId / appId from starlabs-cicd Firebase Console
npm install --legacy-peer-deps
```
Then:
1. Uncomment the `firebaseProviders` block in `app.config.ts`
2. Implement Google sign-in popup in `auth.service.ts` (see `dashboard/index.html` for the pattern)
3. Uncomment the live Firestore read in `firebase.service.ts` (`releaseCandidates()`)
4. Uncomment the live callable invocation in `firebase.service.ts` (`invoke()`)
5. Wire `AuthService` to read the approver allowlist from `console-config/allowlists`
6. Set `useMock: false` in `environment.ts`
7. Add the `repo` field to each entry in `mock-data.ts` (e.g. `'starlabs-angular'`)

Deploy:
```bash
npm run build
firebase hosting:sites:create starlabs-cicd-console --project starlabs-cicd   # first time only
firebase target:apply hosting console starlabs-cicd-console --project starlabs-cicd  # first time only
firebase deploy --only hosting --project starlabs-cicd
```

**Step 5 — Prove it**
Push a branch → card appears (NO_ACTION) → mark OK → create PR → gate runs → report links → Approve & Merge → card advances → DEV_MERGED → deploy fires.

---

## Run locally (mock mode — no backend needed)

```bash
cd console
npm install --legacy-peer-deps
npm start   # http://localhost:4200
```
`environment.useMock = true` by default. The board renders from `mock-data.ts`, action buttons log and optimistically advance cards — full lifecycle clickable with zero Firebase setup.

---

## Firebase projects
| Project | Use |
|---|---|
| `starlabs-cicd` (Blaze) | console home: Hosting + Functions + Firestore + preview channels |
| `starlabs-test` | dev deploys (merge → development branch) |
| `fir-sample-aae4a` | production deploys (merge → production branch) |

## Console component convention (MUST FOLLOW)
- **Never hand-write a component.** Always scaffold with the CLI: `cd console && npx ng generate component <path>/<name>` (e.g. `ng g c shared/foo` → `src/app/shared/foo/foo.component.{ts,html,css}`), then migrate logic/markup/styles into the generated files.
- Structure is **folder-per-component**: each component lives in its own folder with separate `.ts` + `.html` + `.css` (`templateUrl`/`styleUrl`, never inline `template`/`styles`).
- `angular.json > projects.console.schematics` enforces this: `style: css`, `skipTests: true`. **No `.spec.ts` files** — the project uses Playwright E2E, not Angular unit tests.
- `app.component.*` stays at `src/app/` root; `core/` holds services & models (not foldered); `shared/toast.service.ts` is a service, not a component.

## Git
- This repo: **`main`** branch
- Do not commit `console/src/environments/firebase.config.ts` (gitignored)
- Do not commit `console/functions/.env.starlabs-cicd` (gitignored)

---

## Context in the angular repo
The full pipeline journal is at:
`starlabs-angular/Journal/2026-06-18-CICD-JOURNAL.md`
The Phase 1A plan is at:
`starlabs-angular/Journal/2026-06-18-phase-1A-console-plan.md`

## Journal Rule — MUST FOLLOW

When you make an architectural decision or land a load-bearing change, write a companion journal in `specs/journals/YYYY-MM-DD-topic.md` explaining **WHY** each constraint landed. Plans tell WHAT; journals tell WHY. Future sessions read BOTH before proposing alternatives.

**Journal after every session (operator directive, 2026-06-02):** at the end of *every* session — not only architectural ones — write or append a journal entry capturing what was done, what was found, what surprised us, and what's pending. A session without a journal is invisible to future sessions.

---
