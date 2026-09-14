# Journal — 2026-07-05: dev system-test (all 12 suites), report-viewer fix, rollout plan

> Goal: test the preview→suite flow **directly against `development`**, confirm all system suites,
> then plan the required-gate rollout to development/production. Along the way, fixed why the console
> report viewer showed 0/0, and surfaced which suites are actually green against `development`.

## What was done
- **Verified the preview-time flow end-to-end against `development`** (Release Channel / Working
  Branches "Run tests" → `runTests` → `preview-e2e.yml` `resolve`→matrix → `web-e2e.yml@main`).
  Test-only: no commit/merge/deploy; production untouched.
- **Created `meena-development`** (off `development` `00387bb`) as a reusable personal branch + a
  console card to run suites from.
- **Ran all 12 suites** on `meena-development` (preview-e2e run #9, `28748558212`).

## Fixes landed on hub `main` (`d9a2eb3`, operator-pushed)
1. **`suites-manifest.json`**: flipped `appointments`/`events`/`profiles` `ciReady:false → true` +
   pointed `config` at their emulator evidence configs (which were already on `main`). They'd been
   hidden from the Test Run dialog / rejected by `runTests`. Now **all 12 suites** appear (verified in
   the dialog). Pushing to `main` re-mirrored the manifest to Firestore via `suites-deploy.yml`.
2. **`lib/emulator-playwright-config.ts`**: added a `['json', …report.json]` reporter to all 3
   factories. Mostly inert (run-isolated.sh already emits report.json in evidence mode) — kept as belt-and-suspenders.

## The real "report doesn't render" bug — bucket CORS (NOT code)
The console Report screen showed **0 passed / 0 failed · "no machine-readable report"**. Root cause:
the Storage bucket `gs://starlabs-cicd.firebasestorage.app` had **no CORS config**, so the report.json
download (`firebasestorage.googleapis.com/…?alt=media`) came back without `Access-Control-Allow-Origin`
→ the browser fetched the bytes but wouldn't expose them to `cicdconsole.web.app` (network tab showed
**503**; `curl` always got 200 because it ignores CORS; the CORS **preflight** returned 200 with
`Allow-Origin:*`, which was a red herring — the missing header was on the actual GET).
**Fix (operator, Cloud Shell):** `gcloud storage buckets update gs://starlabs-cicd.firebasestorage.app
--cors-file=cors.json` (GET from cicdconsole.web.app + localhost:4200). After that the report renders
full per-spec counts. Memory: `cicd-report-viewer-cors-503`. **Lesson:** browser-503 + curl-200 = missing
bucket CORS; it's a GCS bucket setting, not a Firebase Console option.

## System-test result — 8 GREEN, 4 RED (all red = development-branch dependency gaps, not regressions)
Verified per-spec in the (now-working) console Report viewer.
- **GREEN (8):** appointments, authroles, business, comms, content, events, evomap, workshops.
- **RED (4):**
  - **journey** — only JP-PD + JP-EDIT fail; need app fixes `e53657b` (product-delivery) + `16b578a`
    (delivery-sequence) merged into `development` (pending since the 2026-06-29 journal).
  - **modes** — all 8 fails are CF-driven mode calcs (PM-*), ~120s timeouts = modes CF hanging;
    need `cicd-modes-emulator-fix` merged into `development`.
  - **profiles** — only participant-metadata CF tests fail (PA-CF-01/04/05, ~120s) + PA-01;
    same CF family / same `cicd-modes-emulator-fix` → development dependency.
  - **queue** — exit code 4 (4 failing specs); NOT yet root-caused. Note queue's caller was never
    actually live on `development` (`on.pull_request.branches: []`), so its green history was on
    `cicd-dev`/local. Investigate before rollout.

## Rollout plan (development → production) — scoped by the result
Making a suite REQUIRED while red vs `development` would block ALL PRs into `development`. So:

**Cut over + require the 8 GREEN now.** Per-caller edit (identical), landed on `development` **and**
`production` (a `pull_request` gate uses the base branch's workflow copy), then add each as a required
status check in branch protection after N green runs:
```diff
 on:
   pull_request:
-    branches: [cicd-dev, cicd-prod]   # sudo branches …
+    branches: [development, production]
```
Green callers to flip: `authroles-e2e.yml`, `business-e2e.yml`, `comms-e2e.yml`, `content-e2e.yml`,
`events-e2e.yml`, `evomap-e2e.yml`, `workshops-e2e.yml`, `appointments-e2e.yml`.

**HOLD (leave on `[cicd-dev, cicd-prod]`):** `queue-e2e.yml` (currently `[]`), `journey-e2e.yml`,
`modes-e2e.yml`, `profiles-e2e.yml` — until their deps land in `development`:
- journey → merge `e53657b` + `16b578a`
- modes + profiles → merge `cicd-modes-emulator-fix` (participant-mode/metadata CF; CF-team, operator PR)
- queue → root-cause the 4 failing specs
then re-run on `meena-development` (or a dev PR) → green → cut over + require those too.

**Operator-gated (not executed here):** the caller edits land on protected `development`/`production`
via operator-approved PRs; required checks are set in GitHub branch-protection settings; `gh` not
installed (GitHub web UI via Chrome MCP).

## Pending / next
- Root-cause queue's 4 failing specs against `development`.
- Stage the 8-green cutover branch for an operator PR (dev first, then prod), keep green N runs, promote to required.
- Track the dependency merges for journey/modes/profiles, then roll those out.
- Workstream-A "Gate Runs" console view is still stashed on `systems-emulator` (`stash@{0}`) — main's
  console already has a richer Report viewer, so reconcile/likely drop it.
