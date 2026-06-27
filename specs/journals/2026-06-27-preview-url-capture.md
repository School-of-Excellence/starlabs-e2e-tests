# 2026-06-27 — Preview channel URL not captured (console showed wrong link)

## Symptom
Deploying a preview from the console updated the **status** (BUILDING→LIVE) correctly, but the
**preview URL** was wrong/never the real one. The card linked to a hash-less URL that doesn't
resolve.

## Root cause
The real Firebase preview-channel URL has a random hash (`breakthroughs-test--<id>-<hash>.web.app`)
and is **not** reconstructable from the branch name. Two things conspired:

1. **CI's real-URL write was silently skipped.** `preview.yml` (in `starlabs-angular`, on the
   feature/`development` branches) already has a "Record preview URL" step that writes the REAL
   `firebase hosting:channel:deploy --json` URL straight into
   `release-candidates/${repo}__${branch-with-dashes}` (field `preview.url`) via the Admin SDK.
   But it's guarded by `STARLABS_CICD_SA` — which was **not set** on the app repo (verified at
   repo + org level), so it exited before writing. (Same missing secret also silently skipped the
   append-only history recorder.)

2. **The Cloud Function overwrote it with a deterministic guess.** `webhookReceiver`
   (`handleWorkflowRun`) and `reconcilePoll` both did `preview.url = previewUrl(branch)` — the
   hash-less reconstruction. The `workflow_run: completed` webhook lands AFTER CI's in-job write,
   so even once the secret was set it would clobber the real URL.

The login gate / Firestore / candidate logic were never involved.

## Why option "read the URL from the webhook" doesn't work
The `workflow_run` webhook payload carries run metadata only — **no step/job outputs**, so the
hashed URL is never in it. The only webhook that can carry a URL is `deployment_status`
(`environment_url`), and only if the workflow creates a GitHub Deployment (it doesn't). So the URL
must be pushed by the one place that knows it: CI. (= the approach already coded in preview.yml.)

## Fix (architecture: CI owns the URL, function owns status, UI owns the fallback)
1. **Secret** — `STARLABS_CICD_SA` added to `starlabs-angular` (operator, done 2026-06-27). CI's
   record step now actually writes the real URL.
2. **Cloud Functions** — removed the deterministic `preview.url` writes so nothing clobbers CI:
   - `webhookReceiver` / `handleWorkflowRun` ([index.ts ~531]) — dropped `c.preview.url = previewUrl(branch)`.
   - `reconcilePoll` preview backfill ([index.ts ~1110]) — dropped `cc.preview.url = previewUrl(...)`.
   - Removed the now-unused `previewUrl` import. Functions still set `buildState`/`builtAt`/`sha`.
   - Deployed: `firebase deploy --only functions:console:webhookReceiver,functions:console:reconcilePoll --project starlabs-cicd` ✔ (endpoint URL unchanged).
3. **UI** — unchanged; already falls back to `previewUrlFor()` when `preview.url` is empty
   ([preview-channels.component.ts:103]).

## Branch/dispatch facts (load-bearing)
- `preview.yml` is **`workflow_dispatch`-only** (push trigger disabled 2026-06-23); the console's
  `deployPreview` callable dispatches it with `ref = feature branch`.
- GitHub runs **that branch's own copy** of `preview.yml` (confirmed via runs on `offline-ATC`,
  `feature/cicd-rollout`). The file lives on `development`, **NOT on `main`** (the default branch).
  → edits to `preview.yml` only take effect on branches that contain them.

## Verify
Deploy a preview from the console → card should show the REAL hashed URL
(`breakthroughs-test--<id>-<hash>.web.app`) and it should resolve. The function no longer writes a
URL; if CI hasn't written yet, the UI shows the deterministic fallback (expected, transient).

## Not done / considered
- `reconcileDecision` CF is plumbed (backend computes DRIFT/ANOMALY; service method exists) but **no
  UI calls it** — idle, left in place. `reconcilePoll` kept (webhook-drop resilience + re-projection);
  only its URL line was removed.
