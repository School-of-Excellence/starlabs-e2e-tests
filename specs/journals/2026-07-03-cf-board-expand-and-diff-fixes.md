# 2026-07-03 — CF Board: expand-all bug + changedFunctions explosion

**Status:** Implemented (console typecheck + functions build both green). **Author:** session
(operator: appexperience@soexcellence.com). Two independent bugs on the CF Board **Branches** tab.

## Bug 1 — expand one branch expands ALL branches

**Symptom (operator):** clicking a branch's "~N functions changed" toggle expanded *every* row.

**Root cause — a `branch` vs `name` field seam, NOT the expand code.** The expand logic was already
correct (per-branch `Set<string>` keyed by `b.name`). But the Firestore `cf-branches` doc stores the
branch name under **`branch`** (`CfBranchDoc.branch`; both writers — the webhook mirror and the
`listCfBranches` heal — write `branch:`). The frontend model `CfBranchInfo` and the whole template
read **`name`**, and `cfBranches()` cast the raw doc straight to `CfBranchInfo[]` with **no remap**.
Result: every streamed row had `name === undefined` →
- `toggleExpand(undefined)` added `undefined` to the set, and `expanded().has(undefined)` was **true
  for every row** → click one, all expand.
- `{{ b.name }}` (branch label) rendered blank, and `track b.name` collided across rows.

The `listCfBranches` **callable** returns a proper `name`, which masked the seam — but the tab renders
from the **stream** (`toSignal(fb.cfBranches())`), so the stream is what broke.

**Fix (frontend only, no deploy):** `cfBranches()` now maps `{ ...d, name: d.name ?? d.branch }`.
Fixes existing docs immediately — no functions redeploy, no re-push.

**Why not also write `name` into the doc backend-side:** redundant field, needs a deploy, and doesn't
heal existing docs until the next push. The frontend remap is strictly better. Deliberately skipped.

## Bug 2 — one changed line → 20 "changed functions"

**Symptom (operator):** edited one line in one function, pushed, Branches tab showed ~20 functions.

**Root cause.** `changedFunctions` = file-level git diff (`development...branch`) mapped through
`functions-manifest.json` by `m.file`. Cloud Functions are exported from a shared file (e.g.
`src/index.ts`), so the manifest records that same `file` for many functions. The old rule pushed
**every** manifest hit for a changed file → one edit to a shared file exploded into all N functions.
Git diffs files, not functions; we genuinely can't tell which function inside a shared file changed.

**Fix (backend, needs functions redeploy) — 1:1-else-file rule** applied to all three sites that share
the mapping (`computeCfBranchRecord`, `listCfBranches`, and the commit-log `namesForFiles` helper):
- file maps to **exactly one** function → show that function (name + type)
- file maps to **many** → show the **FILE** (`type: 'file'`) — can't pin which
- file maps to **none** → show the file (unchanged)

Takes effect on the next push / ↻ Refresh after `firebase deploy --only functions`.

## Bug 3 — CF drift false-positives on the Functions matrix

**Symptom (operator):** functions showed DRIFT even when dev and prod ran identical code. Common when
a CF is developed straight on `development` and deployed to both projects at different HEADs.

**Root cause.** `drift = both deployed AND dev.sha ≠ prod.sha`, and `sha` is the **branch HEAD commit**
at deploy time (recordCfDeploy stamps one commit sha on every function in the batch). The CF repo has
**no production branch** — both envs deploy off `development` — so deploying dev@A then prod@B (B
touching a *different* function) made every unchanged function show `A ≠ B` → false drift. The branch
commit is the wrong identity; the question is "same *function source*, not same *branch commit*."

**Decision (operator-locked 2026-07-03):** drift = per-function **source-file content identity**,
computed **hub-side from GitHub** (no CF-repo change). WHY these two:
- *Content, not commit:* git already content-addresses files — the blob sha of a function's file is
  identical across commits when the bytes are identical. So `dev.fileSha ≠ prod.fileSha` is true
  version drift, branch-commit-independent. Chosen over presence-only (doesn't answer "same version?")
  and over a full transitive bundle hash (heavy new deploy step).
- *Hub-side:* recordCfDeploy fetches the git tree at the deployed `sha` ONCE (`git.getTree recursive`),
  maps path→blobSha, resolves each function's file (tries `f.file`, `functions/${f.file}`, and the
  stripped form because the manifest path prefix is ambiguous). One extra GitHub call per deploy, no
  change to the separate starlabs-cloud-function repo.

**Implementation.** `CfEnvDeploy.fileSha` (backend + frontend models). `recordCfDeploy` gains the
`GITHUB_APP_PRIVATE_KEY` secret + best-effort tree fetch (any failure → fileSha undefined, never fails
the deploy record). `computeCfMatrixState` + frontend `cfDrift`: fileSha-first, **fall back to branch
sha only until both envs carry fileSha** — never compare fileSha vs sha (different kinds). UI: drift
note reworded to "different source versions"; NEW positive `✓ same version` note when both deployed and
not drifting (operator wanted to *see* parity, not just infer it from an absent badge).

**Caveat (accepted):** file-level — a changed *imported helper* whose own file is untouched won't flip
drift. Same `~` approximation as the board's changedFunctions (plan L19).

## Pending / follow-ups
- **Deploy required for Bug 2:** `cd console/functions && firebase deploy --only functions
  --project starlabs-cicd`. Existing `cf-branches` docs refresh on next push or ↻ Refresh.
- Bug 1 needs only a console rebuild + `firebase deploy --only hosting` (or ships with the next build).
- The `branch`/`name` seam exists only on the streamed docs — if any *other* screen streams
  `cf-branches` raw, it needs the same remap. (Currently only the CF Board Branches tab does.)
- **Bug 3 takes full effect only after each function is redeployed to BOTH envs** (fileSha captured at
  deploy). Until then, legacy branch-sha drift persists for that function. OPTIONAL backfill (not built):
  a one-shot admin pass fetching blob shas at the already-stored dev.sha/prod.sha to populate fileSha
  retroactively — offered, awaiting operator go.
