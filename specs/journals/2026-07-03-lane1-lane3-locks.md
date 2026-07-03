# 2026-07-03 — Lane 1 + Lane 3 locks (suites mirror v2, CF eventing, reconcilePoll removed)

**Status:** Implemented (builds green). **Author:** session (operator: appexperience@soexcellence.com).
**Protocol note:** this session formalized the universal working protocol — *operator plans →
Claude validates → operator locks → Claude executes as aligned* (saved to memory).

## Lane 1 — suites mapping (locked + implemented)
- **One doc per suite:** `test-suites/{suiteKey}` (full-replace on sync; stale suites deleted) +
  SLIM meta doc `console-config/suites` (version, crossCutting, cfPredeploy, mirroredAt, source).
  WHY: operator found the single-doc structure complex; per-doc streams/queries are simpler.
- **Test cases dropped** from scope (suites-level view is enough — operator).
- Workflow renamed `mirror-suites.yml` → **`suites-deploy.yml`** (operator naming).
- New read-only **Test Suites screen** (`/suites`, all members): suite cards with "locks on
  Angular/CF changes" glob columns, capture/CI tags, cross-cutting + CF-predeploy cards, draft-glob
  highlights. Editing stays git-only (hub PR → merge → auto-sync).
- `planTestRun` loader recomposes manifest from collection+meta; CI still reads the git file.

## Lane 3 — CF rollout eventing (locked + implemented)
- **`reconcilePoll` DELETED entirely** (operator lock — accepted trade-off: stuck-preview /
  stale-promotable self-healing is gone; webhooks are the only Angular-lane state source now).
- **NEW `cfDeployEvent`** (HTTP, starlabs-cicd): ONE receiver for BOTH env projects. Admin Activity
  audit logs (always on) routed per project via log sink → Pub/Sub → OIDC-signed push. Updates ONLY
  `dev/prod.deployed` (+ recomputed state/drift, `via:'audit-log'`); branch/sha/by stay owned by the
  postdeploy hook. Catches web-console deletes + hookless deploys in seconds. NO cross-project SA
  read grants (projects push OUT). gcloud setup block: chat 2026-07-03 (topic, sink, publisher
  binding, tokenCreator for the Pub/Sub agent, push sub with audience `cf-deploy-event`).
- **Option A locked:** `cf-functions` docs carry server-derived `state` (both/dev-only/prod-only/
  none) + `drift`; both writers derive via `computeCfMatrixState`; clients read stored-first.
- **`cf-branches/{repo__branch}`** (operator flow): push/PR-webhook-mirrored branch records —
  Branches tab now STREAMS; `listCfBranches` demoted to ↻ heal/backfill (writes back + prunes).
  **Commit LOG added:** per push, each commit (sha·msg·author·at) + the CF names it touched
  (from payload.commits × functions-manifest), newest-first, cap 20.
- webhookReceiver now holds GITHUB_APP_PRIVATE_KEY (compare + manifest fetch per CF push).

## CF repo hardening (locked + implemented)
- **gitignore BUG fixed:** `/scripts` (directory exclude) made `!/scripts/cicd/**` dead — git can't
  re-include beneath an excluded DIRECTORY. Fix: `/scripts/*` + `!/scripts/cicd/`. Until this fix
  the four cicd scripts were uncommittable (fresh clones would have failed predeploy entirely).
- **predeploy contract tightened:** no complete `.env.cicd` (hub path AND ingest token) → deploy
  blocked, message points to `bash scripts/cicd/setscript.sh`.
- `setscript.sh` MOVED to the CF repo (devs have no hub membership; hub is public → script offers
  read-only clone). Token fetch: gh Actions VARIABLE (CF repo) → Secret Manager → paste.

## Known pending / gotchas at time of writing
- `cfDeployEvent` returns 404 in prod → functions NOT redeployed since lane-3 landed (deploy will
  also prompt to DELETE reconcilePoll — answer yes).
- CF repo likely lacks a `production` branch (local refs: cicd-rollout/development/main/…) — the
  Branches tab compares `production...branch`; create the branch or rows carry errors.
- Verify the GitHub App installation includes starlabs-cloud-function (listCfBranches needs
  listBranches/compare on that repo; an uncovered repo → top-level "internal" error).
- google-auth-library added to console/functions deps (OIDC verify).
