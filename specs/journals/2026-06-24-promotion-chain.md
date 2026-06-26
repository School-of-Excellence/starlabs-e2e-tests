# Journal — Promotion-chain architecture: design + frontend implementation

**Date:** 2026-06-24
**Repo:** starlabs-e2e-tests (console)
**Plan:** specs/plans/2026-06-24-promotion-chain-architecture.md
**Earlier same-day work:** specs/journals/2026-06-24-console-tsconfig-and-component-split.md

## What was decided (the WHY)

A long design conversation reworked how releases reach production. Root cause of the
prior pain: **both PRs were cut from the feature branch** (`head: branch` for `→development`
*and* `→production`). Because a GitHub PR tracks its head ref (not a snapshot), a push to the
feature branch advanced the head of every open PR cut from it → contamination, test≠ship
divergence, and no same-branch parallelism. This surfaced as `⚠ NEEDS_DECISION` churn.

Locked decisions (interactive, all confirmed by the operator):
- **Batch promotion chain.** `feature → development` (per-feature dev lane) then a single
  `development → production` promotion. Feature branches never touch prod (terminal `DEV_MERGED`).
- The promotion's head is **`development`**, fully decoupling it from feature pushes — this is the
  one-line root-cause fix and the source of the parallelism the operator wanted.
- **Console never merges (D3 preserved).** Accept/Deny happens on GitHub/CLI; the webhook mirrors
  the result. "Accept/Deny" in the UI is a status mirror, not an action.
- **Promotion drift = "latest development wins"** — no re-validation gate.
- **Auto new-iteration** for features: a post-merge push re-enters the preview lane (history kept
  in the activity log).
- Dev QA sign-off gate **kept**; only **Create PR → prod** appears on the Development entry.

Rejected: keep feature→prod (root cause); Method B frozen release ref (releases are batched, not
per-feature); Method C branch-freeze (no same-branch parallelism); console-performs-merge (breaks D3).

## What was done (this session — frontend, mock-verifiable)

- `working-branches.component.{ts,html,css}` — restructured into **three sections**: Feature
  branches (dev lane only), Development (incoming `feature→development` PR list + each PR's test
  report + the single Create-PR-to-prod button), Production (the `development→production` PR + report,
  no actions). Removed the reconcile-decision UI from feature cards (replaced by auto-reiterate).
- `mock-data.ts` — capped the three prod-reaching fixtures at `DEV_MERGED`; added a `development`
  candidate (ready to promote, `OK_FOR_PROD`) and a `production` candidate (last promotion `#480`
  accepted).
- No change needed to `firebase.service.createPrToProd` or `action-gating.ts`: firing the promotion
  on the **development candidate** already sends `head: rc.branch === 'development'`, and the existing
  freshness helpers return "fresh" when there is no prod gate. The whole fix was *where the button
  lives*, not new gating code.

## Verification

- `ng build` ✓ and `functions` tsc ✓ (both green).
- Ran the dev server in mock mode and inspected the rendered DOM: 3 sections present; 11 feature
  cards (dev-lane actions only, **no** prod button); Development entry lists the merged batch
  (#318/#320/#301) with a single enabled **Create PR → prod**; Production entry shows
  `development #480 · accepted · tests passed`, no actions. **Zero console errors.**

## Surprised / notes

- A pre-existing manual `ng serve` held port 4200; stopped it so the preview harness could own the
  port. The repo convention `environment.useMock = false` was flipped to `true` for the demo and
  reverted back to `false` (committed state preserved).
- The whole frontend change turned out small precisely because the per-branch candidate model
  already treats `development`/`production` as branches — surfacing them + relocating one button was
  most of it.

## Follow-up fix — Deploy Preview gating (auto-reiterate, frontend)

Operator reported Deploy Preview stayed **disabled** after pushing a new commit to an advanced
branch. Root cause: `action-gating.ts` still used the old `ACTION_ALLOWED_FROM.deployPreview =
[NO_ACTION, PREVIEW_*]` — once a branch reached `OK_FOR_DEV`/`PR_TO_DEV`/`DEV_MERGED` (or any prod
status the not-yet-migrated live backend still emits on features), the status gate blocked deploy
regardless of new commits. Fix: `deployPreview` now allowed from **ALL_STATUSES**; the **freshness**
gate (`isFresh` → `previewStale`) is the real decider — enabled only when there's a new commit to
preview. Verified in mock: `feature/rate-limiter` (PR_TO_DEV + stale preview) → **enabled**;
`checkout-v2`/`profile-cohorts` (preview current) → disabled with "live and up to date." `ng build` ✓.

## Follow-up fixes — Preview Channels + feature-card clarity (frontend)

1. **Preview Channels reset to the new model.** Operator reported the preview screen still showed a
   **PROD gate (OK)** on features and, after a new preview was deployed, **no flow to re-approve** it
   (dev gate stuck at stale OK). Fixes: removed the PROD-gate section entirely (prod sign-off is gone
   from features — promotion is on the development entry); dev sign-off now allowed from ALL_STATUSES
   gated by "current live preview" (`isFresh signoffDev = buildState LIVE && !previewStale`), so a
   redeployed preview re-opens the OK-for-dev / Has-issues buttons even on an advanced branch. Added
   `devSignedCurrent` → shows "Signed off for the current preview" only when the gate covers the
   current head. Backend `signoff` already has no status precondition, so this works live once
   deployed. Verified in mock: no PROD gate anywhere; `search-ranking` (fresh preview + stale dev
   gate) re-shows approve buttons; `profile-cohorts` (signed & current) shows no buttons.
2. **Feature-card status trail.** Each feature card now shows the last 3 lifecycle stages as a
   breadcrumb (e.g. "OK for dev › PR → dev › _Dev merged_"), current stage highlighted, with the
   status chip still at top-right. Helper `recentStatuses` derives the trail from `FEATURE_ORDER`.

## Follow-up fix — "Create PR → dev" disabled after re-approval (auto new-iteration, BACKEND)

Operator hit: a feature already merged to development got a new push → preview redeployed → tester
re-approved (`dev=OK`), yet **Create PR → dev stayed disabled even for admin**. Root cause: the
projection's high-water-mark — `deriveStatus` returned `DEV_MERGED` whenever `prDev.state === 'MERGED'`
([projection.ts:54]), regardless of whether that merge covered the current head. So a post-merge
push pinned `DEV_MERGED` forever; `createPrToDev` (allowed only from `OK_FOR_DEV`) never re-enabled
(and the backend `createPullRequest` precondition would reject for the same reason).

**Fix (projection.ts) — HEAD-AWARE projection (generalized to the whole lifecycle):**
`derivedStatus` now reflects the milestone the **current head** commit reached, not the highest ever.
Every completed/in-flight facet (prProd/prodGate/prDev/devGate) only pins its milestone while it
**covers HEAD** — requiring POSITIVE proof: `!!facet.sha && facet.sha === headSha`. (First attempt
used `!facet.sha || facet.sha === headSha`, i.e. missing-sha ⇒ covers — but legacy `feature→prod`
merges have NO recorded `prProd.headSha`, so that fallback kept pinning `PROD_MERGED` even after a
new push. Strict proof fixes it: no sha ⇒ can't prove it covers head ⇒ don't pin.) A live screenshot showed `feature/cicd-rollout`
stuck at **PROD_MERGED** (legacy `feature→prod` topology) even after a fresh dev sign-off at the new
head — the first dev-lane-only fix didn't help because the **prod** lane pinned it. Generalizing to
all lanes makes a once-prod/dev-merged branch fall through to the fresh dev gate → `OK_FOR_DEV` →
Create-PR-to-dev enables. The old merged PR stays as facet/activity-log history (the card shows e.g.
`PR→dev #10: MERGED` alongside `OK_FOR_DEV`). No frontend gating change needed.

`reconcileVerdict` made head-aware too: a stale sign-off on a lane that already **MERGED** is a
completed old cycle (history), not pending drift — so it no longer spuriously flags `NEEDS_DECISION`.

Unit-verified against the real compiled projection (`lib/projection.js`): cicd-rollout shape →
`OK_FOR_DEV`/`IN_SYNC`; fresh dev-merge → `DEV_MERGED`; open dev PR → `PR_TO_DEV`; open-PR-head-moved
→ `NEEDS_DECISION` (real drift still caught). Side benefit: the `development` promotion candidate also
un-pins `PROD_MERGED` once new features merge in ("latest development wins").

**Confirmed against live logs** (`firebase functions:log`): `feature/cicd-rollout` showed
`deployPreview` → `signoff dev=REJECTED` → `signoff dev=OK` (vignesh.s@…), with the branch previously
at `DEV_MERGED` — the exact trap. Verified in mock: `search-ranking` (merged #318 @ ggg7777, new
commit ggg8888, re-approved) now reads `OK_FOR_DEV` with **Create PR → dev enabled**; `ng build` +
`functions` tsc green; zero console errors.

**Deploy note:** this is a Cloud Functions change → needs `firebase deploy --only functions
--project starlabs-cicd`. Existing stuck candidates re-project on their next webhook/sign-off
(mutateCandidate recomputes derivedStatus).

## Follow-up fix — activity log entries were indistinguishable (drawer display)

Operator flagged the activity log looked "wrong": look-alike rows. Root cause: the drawer labeled
entries by `type` only and dropped `detail`, so a `dev=REJECTED` and a `dev=OK` sign-off both read
"Signed off · dev", and one preview build (which emits queued→in_progress→completed `workflow_run`
events) showed as several identical "Preview build" rows. Not bad data — a display gap.

Fix (`activity-drawer.component.*`): added `detailFor(e)` + `detailTone(e)` rendering a small tag —
sign-offs show **OK/Rejected**, preview/deploy show **building/live/failed**, reconcile shows the
**decision**, PRs show **#number**. Verified in mock: "Signed off · dev → OK" (green), "PR →
development → #150". `ng build` green.

## Follow-up — reconcilePoll now re-projects all candidates (auto-heal)

Each projection-logic change only took effect on a candidate's NEXT event, so stored docs stayed
stale (operator had to push/sign-off to un-stick a branch — hit this repeatedly). Fixed the
scheduled `reconcilePoll` (was a no-op stub) to recompute `derivedStatus`/`reconcile` for EVERY
candidate from its stored facets each tick (every 30 min). Now a functions deploy self-heals all
stuck docs on the next poll — no manual nudging. Also the foundation for the GitHub-backfill TODO.
`functions` tsc green.

## GAP FOUND (2026-06-25) — Lane 2 backend was documented, NOT built

Operator merged a `feature→development` PR; the Development entry stayed `NO_ACTION` with
Create-PR-to-prod disabled, and no dev-deploy status shown. Honest accounting: Lane 2's **frontend**
(the Development/Production entries) was built, but its **backend** was only ever marked "pending" —
which in practice meant *not working live*. Root cause is leftover OLD-model handling in
`functions/src/index.ts`:
- `handleDeploymentStatus`: `if (!branch || isProtected(branch)) return false;` → **deploy status for
  `development`/`production` is discarded.** No "deploying/deployed" can ever show on those entries.
- `handlePush`: early-returns for protected branches (no candidate maintained).
- Nothing marks the `development` candidate "ready to promote" → status stays `NO_ACTION` →
  Create-PR-to-prod (gated to `OK_FOR_PROD`) never enables. The "Development has changes ready"
  line is heuristic frontend text → contradicts the disabled button (visible bug).

### ✅ BUILT (2026-06-25) — Lane 2 backend + frontend wired
- `model.ts` / `release-candidate.model.ts`: added `hasUnreleased` + `promotable` (and surfaced
  `lastDeploymentState` to the frontend).
- `handlePullRequest`: on a `feature→development` MERGE → `development` candidate `hasUnreleased=true`;
  on a `development→production` PR → mirror it onto the `production` candidate, and on its MERGE clear
  `hasUnreleased`/`promotable`.
- `handleWorkflowRun` (isDeploy): on a successful `development` deploy with `hasUnreleased` → set
  `promotable=true`. (Protected-branch deploys were already allowed through — now they mean something.)
- `createPullRequest` (→production): precondition is now `cand.promotable` on the development candidate.
- Frontend: Development entry shows `dev deploy (starlabs-test): deploying/deployed/failed`, gates
  Create-PR-to-prod on `promotable`; Production entry shows `prod deploy (fir-sample): …`.
- Verified in mock (no console errors): Development → "deployed · ready to promote" + Create-PR-to-prod
  ENABLED; Production → "prod deploy: deployed". Both builds (`ng build` + functions `tsc`) green.
- **Live confirmation still pending a real merge+deploy** (webhook handlers can't be exercised without
  the Firebase emulator + GitHub events). Needs: `firebase deploy --only functions` + `--only hosting`.

### Build plan (Lane 2 backend, locked with operator's "deploy-then-promote" rule)
1. `handleDeploymentStatus`: stop skipping protected branches; record deploy state (`deploying`/
   `success`/`failure`) onto the `development`/`production` candidates → entries show deploy status.
2. On a `feature→development` **merge**: maintain the `development` candidate — mark `hasUnreleased`
   + record the dev tip.
3. **Ready-to-promote = `hasUnreleased && dev deploy succeeded`** (operator: show deploy happening/
   done, THEN enable Create-PR-to-prod). Represent via an explicit `promotable` flag (don't overload
   the feature projection); frontend gates the Development-entry button on it.
4. `createPullRequest` (base=production) precondition keyed off the development candidate's
   `promotable`, not a feature's `OK_FOR_PROD`.
5. On `development→production` **merge**: update the `production` candidate + clear `hasUnreleased`.
6. Frontend: show deploy status on both entries; gate Create-PR-to-prod on `promotable`.

## Revision (2026-06-25) — TESTER gate on environment deploys (reverses "no prod gate")

Operator: "We need approval from a tester. After every deploy, the tester says OK for development
and production; only then can a developer create the PR." This re-introduces a QA gate on the
ENVIRONMENT deploys (we'd earlier dropped the prod gate). Locked: tester approves on **Preview
Channels** (environments added there); the **production** OK is a validation record only.

Built:
- `promotable` is now **derived** (`computePromotable` in candidate.ts, used by mutateCandidate AND
  reconcilePoll): `hasUnreleased && lastDeploymentState==='success' && prodGate.verdict==='OK'`. This
  also kills the earlier event-order fragility (self-heals every write + poll).
- `handleWorkflowRun` (dev deploy success) now **resets prodGate→NONE** so the tester must re-validate
  the new deploy ("after every deploy"). Removed the ad-hoc promotable set.
- Preview Channels: new **"Environment deploys"** section listing development/production with deploy
  status + a tester sign-off ("OK to promote" for dev / "Validated" for prod) → calls `signoffProd`.
- Working Branches development entry: Create-PR-to-prod gated on derived `promotable`; new message
  "Deployed to dev — awaiting tester validation".
- Verified in mock (no errors): PreviewChannels shows the env section with enabled sign-offs;
  Working Branches dev entry shows "awaiting tester validation" + Create-PR-to-prod DISABLED. Both
  builds green. **Live confirmation still needs deploy + a real merge/deploy/sign-off cycle.**

## Debug fix (2026-06-25) — tester approved but Create-PR-to-prod stayed disabled

Symptom: tester clicked "OK to promote" (dev deploy validated, prodGate OK) but the button stayed
disabled. Root cause: `computePromotable` still ANDed in `hasUnreleased`, a one-shot flag set only by
the merge webhook — never written for the operator's already-merged PR → vetoed an otherwise-valid
promotion. Fix: `promotable = lastDeploymentState==='success' && prodGate.verdict==='OK'` (dropped
`hasUnreleased`). The tester's approval of a green deploy IS the promote signal; only the
`development` candidate ever gets a prodGate OK, so features stay non-promotable. Unit-verified:
deploy+OK→true, deploy-no-OK→false, OK-no-deploy→false, feature→false. Also removed **production**
from the Preview Channels env section (operator: prod is already shipped, nothing to approve) — only
`development` is listed for validation now. `ng build` + functions `tsc` green; mock confirms env
section shows development only.

NOTE for live: redeploy functions; `reconcilePoll` then recomputes `promotable` for the existing
tester-approved development candidate → Create-PR-to-prod enables without any re-merge.

## Debug fix (2026-06-25) — preview stuck at "Preview building"

Operator: deployed a preview on `feature/cicd-rollout`, the app deployed, but the console stayed at
`PREVIEW_BUILDING` (both Working Branches + Preview Channels). `buildState` only flips to LIVE/FAILED
via the preview.yml `workflow_run: completed` webhook; the optimistic `BUILDING` (set on dispatch)
is never corrected if that event is dropped/unmatched. Two fixes (deployed to starlabs-cicd):
1. **Robust workflow matching** — `handleWorkflowRun` matched preview/deploy runs ONLY by
   `workflow_run.path` (the file). Some webhook payloads omit `path` → `file=''` → the preview run
   was dropped as "not tracked." Now: match by file when present, else fall back to the workflow
   display **name** (`name.includes('preview')` / `'deploy'`). Fixes the real-time path.
2. **reconcilePoll GitHub backfill** — for any candidate stuck at `BUILDING`, poll the latest
   preview.yml run via `octokit.actions.listWorkflowRuns(branch)`; if completed, set LIVE/FAILED.
   Self-heals missed webhooks every 30 min (the stuck branch heals on the next tick).

To verify root cause live: GitHub App → Advanced → check the `workflow_run` (completed) delivery for
the preview run, and whether the payload carried `workflow_run.path`.

## Pending (backend live-wiring — NOT done; tsc-only environment can't exercise it)

1. `functions/src/index.ts` `createPullRequest`: for `base==='production'` the precondition should
   key off the `development` candidate's ready state, not a feature's `prDev MERGED`.
2. `functions/src/projection.ts`: feature projection should top at `DEV_MERGED`; the prod lane
   (`prodGate`/`prProd`) projects on the `development` candidate; the promotion **skips** the
   stale-sign-off drift rule ("latest development wins").
3. Decide whether the `development` candidate needs a real "ready to promote" status vs reusing
   `OK_FOR_PROD` (mock currently reuses `OK_FOR_PROD`).
4. Webhook: ensure `development`/`production` candidates are created/updated from PR events so the
   incoming-PR mirror is live (mock fabricates them today).
