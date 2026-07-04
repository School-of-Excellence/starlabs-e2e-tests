# 2026-07-05 — CF predeploy: Option B (auto-managed hub cache) + identity-based deploy recording

**Status:** Implemented (hub `tsc` clean; CF scripts `node --check` clean). **Not yet deployed** —
`recordCfDeploy` change needs `firebase deploy --only functions --project starlabs-cicd` to go live.
**Author:** session (operator: appexperience@soexcellence.com).
**Protocol:** operator planned → Claude validated → operator locked → Claude executed (as aligned).

## Goal
Let CF developers deploy **without maintaining a local hub checkout** (`E2E_HUB_PATH`) or a
per-developer secret file (`.env.cicd` / `setscript.sh`), while STILL running the predeploy
no-retrigger loop-guard against the **exact local code** about to deploy.

## The load-bearing discovery (why the obvious plan failed)
The first plan was "predeploy fetches the guard spec (2 self-contained files) and runs it locally."
The spec (`cf-guards/no-retrigger-loop.spec.ts`) IS self-contained at the import level — but the
**runner is not**. Tracing `predeploy.js → cf-predeploy.sh → deploy-cf-emulator.sh`, running the guard
needs: `firebase.emulator.json` (**generated** by `ci/setup-emulator-config.sh`, not in git), the hub's
installed `node_modules` (playwright + firebase-tools), `functions/index.emulator.js` + a materialized
`.secret.local` in the CF repo, and Java. So "fetch a couple files" understated it by a lot — the guard
harness is a hub subsystem. This killed the lean-fetch design.

## Decision — Option B (locked)
`predeploy.js` **auto-manages the public hub as a gitignored cache** (`.cicd-hub/`) and reuses the hub's
`cf-predeploy.sh` **verbatim** from that cache. WHY:
- **Zero drift** — the guard machinery stays the hub's single source of truth; the CF repo never forks it
  (the rejected Option A would have ported the emulator boot into the CF repo → two copies to keep in sync).
- **Exact-local testing kept** — the cached hub boots the emulator with THIS repo's code via `CF_DIR`,
  so uncommitted changes are guarded before upload (unlike a CI-only gate, the rejected Option C).
- **Trade-off accepted:** a one-time hidden hub clone + `npm ci` per machine (minutes, first deploy only;
  subsequent deploys reuse the cache). Devs already have git/Node 22/Java 21/firebase-tools to deploy CF.
- **Versioning:** "check latest, else cache" = `git ls-remote …/main` sha vs `.cicd-hub/.hubversion`;
  re-clone/`npm ci` only when the hub `main` sha moved. Offline + warm cache → reuse (warn). Offline +
  no cache + Firestore triggers deploying → **fail closed** (can't guarantee the guard; matches L14).

## Decision — identity-based deploy recording (replaces the shared token on disk)
`postdeploy.js` no longer reads `CONSOLE_INGEST_TOKEN` from `.env.cicd`. It sends the developer's OWN
GitHub token (`gh auth token`) as the bearer. WHY this path (ruled others out):
- GitHub Actions **secrets are write-only** — a local script literally cannot read `CONSOLE_INGEST_TOKEN`
  back from the CF/Hub repo secrets; that door doesn't exist.
- A repo **variable** is plaintext + readable/visible → too weak for a token.
- Google Secret Manager works but needs `gcloud` + a per-dev IAM grant → not "easy."
- So: **no shared secret on the dev machine at all.** The dev authenticates as themselves.

`recordCfDeploy` (hub, `console/functions/src/index.ts`) is now **dual-auth**:
1. the shared `CONSOLE_INGEST_TOKEN` (CI / `recordPreviewUrl` parity — unchanged); OR
2. a GitHub token → `GET /user` (validates + identity) + `GET /repos/<org>/<repo>` requires
   `permissions.push` (rule ①: push access to the CF repo) → allow, and **stamp `by` from the verified
   login** (more trustworthy than the self-reported `git config user.email`). Token used only to verify,
   never stored. Added `bearerValue()` helper.

## gh-auth gate (operator ask)
`predeploy.js` step 0 runs `gh auth status` and **exits 1** if not logged in — fail fast, so a dev never
deploys and then silently fails to record (postdeploy needs the token). `gh auth login` is the whole setup.

## Files changed
**Hub (`starlabs-e2e-tests`):**
- `console/functions/src/index.ts` — `recordCfDeploy` dual-auth (+ `bearerValue`). Moved body/repo
  validation ahead of auth (the GitHub path needs `repo`). `by` is now `let` (identity override).
- Guard machinery (`scripts/cf-predeploy.sh`, `deploy-cf-emulator.sh`, `cf-guards/*`,
  `playwright.cf-guards.config.ts`, `ci/setup-emulator-config.sh`) — **unchanged** (reused from cache).

**CF (`starlabs-cloud-function` @ `cicd-rollout`):**
- `scripts/cicd/predeploy.js` — REWRITE: gh-auth gate + `ensureHubCache()` (clone/fetch/`npm ci`/stage
  config) + run `.cicd-hub/scripts/cf-predeploy.sh`. Removed `E2E_HUB_PATH`/`.env.cicd`/token gates.
  Kept verbatim: `deployCommand`/`deployingFunctions` scope detection, Firestore-trigger fast-skip,
  `askRunTests` prompt, manifest regeneration.
- `scripts/cicd/postdeploy.js` — auth swapped to `gh auth token` (CI-injected shared token still honored
  first); `.env.cicd` dependency removed; still best-effort, always `exit 0`.
- `.gitignore` — add `.cicd-hub/`.
- **Deleted:** `.env.cicd`, `.env.cicd.example`, `scripts/cicd/setscript.sh`.
- `firebase.json` — unchanged (hooks already point at the two scripts).
- Untouched: `scripts/cicd/generate-manifest.js`, `functions/index.emulator.js`, `functions/package.json`
  (no `@playwright/test` devDep needed — playwright lives in the cached hub, an edge over Option A).

## Pending / next
- **Deploy** the hub functions so `recordCfDeploy` dual-auth is live: `firebase deploy --only functions
  --project starlabs-cicd` (will also prompt to delete `reconcilePoll` — answer yes, per the lane-3 lock).
- **End-to-end verify** on a dev machine: `gh auth login` → `firebase deploy --only functions` → first
  run clones `.cicd-hub` + runs the guard on local code → postdeploy records under the GitHub identity →
  CF matrix updates with the correct `by`.
- CF branch protection (same as Angular) still pending for `starlabs-cloud-function` `development`.
- This session also: resolved CF matrix "same version" (issue #1 — not a bug: undeployed commit) and CF
  branch header count (issue #2 — `cf-board.component.html` now says "View changes"); confirmed CF PR-status
  flow is webhook-driven and healthy (issue #3, no change).
