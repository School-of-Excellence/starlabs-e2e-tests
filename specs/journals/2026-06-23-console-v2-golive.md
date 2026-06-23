# Journal — Console v2 go-live + live-wiring debug (starlabs-cicd)

**Date:** 2026-06-23
**Repo:** starlabs-e2e-tests (hub / console)
**Plan:** specs/plans/2026-06-22-console-v2-architecture.md

Took Console v2 from "builds in mock" to a **live, working pipeline** on `starlabs-cicd`,
debugging the whole `NO_ACTION → … → PROD_MERGED` flow against the real `starlabs-angular`
repo. `feature/cicd-rollout` reached **PREVIEW_LIVE → OK_FOR_DEV → DEV_MERGED → OK_FOR_PROD**
end-to-end. Below: what landed, what bit us, what's pending.

## What was done
- **Deployed** all Cloud Functions to `starlabs-cicd`; deployed `firestore.rules`; deployed a
  new composite index `activity-log (branchId ASC, eventTime ASC)`.
- **Members model finalized:** top-level **`CICD-Users/{email}`** (one doc per member) —
  replaced the invalid `console-config/members/{email}` path. Seeded the first admin
  (`vignesh.s@soexcellence.com`) by hand via the SA (chicken-and-egg bootstrap).
- **Login:** switched `signInWithRedirect` → **`signInWithPopup`** (redirect silently looped
  on localhost due to third-party-cookie blocking) + friendly auth-error messages.
- **GitHub App wired:** App ID + Installation ID in `functions/.env.starlabs-cicd` (committed,
  non-secret); private key + webhook secret in Secret Manager. App needs **Actions RW +
  Contents RW + Pull requests RW** and events **push · pull_request · workflow_run**.
- **New UI:** Working-Branches last-activity line + right-side **activity-log drawer** +
  per-state messages ("already in dev — no PR needed", etc.); **PR gate report** (running/
  passed/failed + report link); deploy-preview button gating (disabled when live & fresh,
  re-enabled on a new commit, relabels "Redeploy preview").
- **Environments:** `development`/`production` are now treated as deploy environments —
  filtered out of Working Branches & Preview Channels; their deploy status shows on Overview.

## Bugs found & fixed (live)
| Symptom | Cause | Fix |
|---|---|---|
| webhook 401 "signature verification failed" | I overwrote the existing `GITHUB_WEBHOOK_SECRET` with a placeholder | restored original via Secret Manager version |
| key "Invalid keyData / Failed to read private key" | `GITHUB_APP_PRIVATE_KEY` mangled / placeholder | promoted a valid version to latest + redeploy |
| `handlePush` crash "documentPath … odd components" | branch `feature/cicd-rollout` has a `/` (illegal in Firestore doc id) | `candidateId` sanitizes `/`→`-` |
| Deploy-preview button 422 "required input not provided" | `deployPreview` dispatched without the `inputs.ref` (preview.yml requires it) | pass `inputs:{ref}` |
| signoff "OK for dev" crash | write rejected `undefined` `lastActivity.sha` | `db.settings({ignoreUndefinedProperties:true})` |
| preview URL 404 | Firebase channel URLs are **non-deterministic** (`site--channel-HASH`), we computed `channel---site` | stop computing; record the real URL (see Pending) |
| Working Branches `localeCompare is not a function` | backend stores `updatedAt`/`eventTime` as **numbers**, 5 sorts used the string method | `toMillis()` helper in all 5 sorts |
| Create PR → prod rejected after prod sign-off | server required `derivedStatus===DEV_MERGED` but it advances to `OK_FOR_PROD` | require `OK_FOR_PROD` (+ prDev MERGED + fresh) |
| activity-log drawer empty | live query needs a composite index that wasn't deployed | deployed the index |

## What surprised us (lessons)
- **Never overwrite an existing secret with a placeholder.** I did this twice (webhook
  secret, private key) without checking they existed → broke verification. See memory
  `ask-before-deciding-without-access`. Secret Manager keeps versions, but `destroy`-ing the
  *latest* puts it in an illegal state and blocks deploy — restore by promoting a good version.
- **Firebase preview-channel URLs have a random hash** — not predictable. The console must be
  *told* the URL by the deploy, not compute it.
- **Firestore doc ids can't contain `/`** (branch names) and `console-config/members/{email}`
  is an invalid (odd-segment) path.
- **GitHub Actions on private repos was billing-blocked.** Operator made the repo **public** →
  free unlimited Actions **and** free branch protection (this un-blocks D11).

## Pending
- **Durable preview-URL recording:** the `preview.yml` step that writes the real channel URL
  to the candidate must be **committed + pushed** in the Angular repo (see its journal). Until
  then each new preview needs a one-off URL patch.
- **Branch protection (D11 unblocked):** now free on the public repo — enable on
  `development`/`production` (require the e2e gate + dismiss stale approvals).
- **Gate cutover:** `queue-e2e.yml` still targets `cicd-dev/cicd-prod`; switch to
  `development/production` so the PR gate report runs on real PRs.
- **Optional:** dedicated "Environments" panel on Overview (per-env deploy status + time);
  `deployment_status` mechanism as a decoupled alternative to the workflow-writes-URL approach.
