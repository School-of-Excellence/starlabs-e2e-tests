# 2026-09-08 — Suite-status validation (Tier A, local) + three findings

**Scope:** validate `scripts/readiness` against the REAL `starlabs-angular` working tree, locally.
No CI, no deploy, no cost. Step 1 (the two preview channels) is untested — it cannot be exercised
without an Actions run.

**Result: 11/11 pass.** Every verdict the checker can emit was reached with real app paths, and
verdict precedence was verified. Nothing in the app repo was modified; two temporary probe specs
were created in the hub and removed.

---

## 1. Decision locked this session

| # | Decision | Why |
|---|---|---|
| D1 | The readiness diff base stays **`development`** for ALL branches | Operator considered `production` and rejected it. Under a production base the three-dot diff resolves to the last promotion point, so every feature branch's verdict would include the entire unpromoted batch. With 28 of 54 `src/app` folders uncovered, any unpromoted change touching one of them would pin EVERY branch at `SUITES_MISSING` permanently — the check would stop carrying information, and developers would be blocked by code they did not write. A production-based check is still the right thing for the **dev→prod promotion lane** (a different question: "is the whole release batch tested?"), and belongs there when that lane is built. |

## 2. What was validated

Base `origin/development`, three-dot (merge-base) diff — so every run describes the whole branch,
never a single commit.

| Case | Input | Verdict | canProceed | suites |
|---|---|---|---|---|
| A1 | `readiness.test.cjs` | 57 passed · 0 failed | — | — |
| A2 | `queue system/cohorts-filter.ts` | MATCHED | true | 1 |
| A2b | `queue system/segment name.pipe.ts` (**path with a space**) | MATCHED | true | 1 |
| A3 | `quiz/quiz.component.ts` | SUITES_MISSING | false | 0 |
| A4 | `ATC/atc.component.ts` | NO_COVERAGE_POSSIBLE | false | 0 |
| A5 | `README.md` | NOT_APPLICABLE | true | **0** |
| A6 | `package.json` | MATCHED | true | **12** |
| A7 | temp hub spec driving a missing hook | NEEDS_UPDATE | false | 1 |
| A8 | probe removed | MATCHED | true | 1 |
| A9 | `accept-other-studio.component.html` | MISSING_TEST_CASES | false | 1 |

Precedence: fenced+uncovered → NO_COVERAGE_POSSIBLE · uncovered+covered → SUITES_MISSING ·
neutral+covered → MATCHED. All correct.

A2b is a deliberate regression guard: that is the exact shape of the TAB-parsing bug that once
reported 19 uncovered files where the truth was 7.

A7→A8 proves the **fail → fix the hub → pass** loop at the logic level. Scenario 2 is validated
locally; only its CI wiring remains.

**Calibration confirmed on real data:** `profilelist.component.html` has 18 interactive elements and
zero `data-testid`, yet reports MATCHED — because `newUnhooked` counts only the DELTA introduced by
the diff. Pre-existing gaps are backlog, never blockers. Without this, nothing would ever go green.

## 3. Three findings

### F1 — `profiles` is permanently shadowed by `modes` (silent under-selection)

`modes` and `profiles` BOTH claim `src/app/Participants Profile Management/**`. `classifyChanges`
`break`s on the **first** ciReady suite that matches, in manifest key order, and `modes` precedes
`profiles`. So a change anywhere under that folder selects `modes` ONLY — `profiles` can never be
selected for it, and is reachable solely via `src/app/ProfilePicture/**`.

This is silent: nothing warns that a second suite also claimed the path. If `profiles` holds tests
for that folder, the readiness check will never schedule them.

Fix would be to collect ALL matching suites rather than breaking on the first — a behaviour change
(it widens what runs), so it needs sign-off before anyone implements it. NOT changed here.

### F2 — the alignment check is effectively queue-only

Selector literals per suite spec dir:

| Suite | literals |
|---|---|
| `queue` | **90** (74 valid after the lowercase-kebab `VALID_ID` filter) |
| the other **11** suites | **0 each** |

`NEEDS_UPDATE` can therefore only fire for queue-routed changes. The checker states this honestly
("These suites drive no `data-testid` selectors, so there is nothing to drift"), but the guarantee
is far narrower than a 12-suite manifest implies. Drift protection exists for one suite.

### F3 — six components inside the COVERED queue folder are exercised by no spec

`accept-other-studio` · `create-bulk-invitation` · `enter-studio-assign` · `invite-other-studio` ·
`preassign-studio` · `queue-invitation-approval`

They declare `data-testid` hooks that no spec references. Coverage ≠ tested — which is precisely
what the element-level check exists to catch, and it caught it on real data. Practical consequence:
any diff touching one of these six returns `MISSING_TEST_CASES` and blocks.

## 4. Unfixed, known

- **Merge-base inconsistency** (found 2026-09-07, still open): the file list uses
  `git diff BASE...HEAD` (merge-base) but `readBase` uses `git show BASE:file` (the **tip** of
  development). When development moves after a branch diverges, "new in this diff" is computed
  against the wrong version — a teammate's hook added on development can make YOUR new untested hook
  read as pre-existing, producing a **false MATCHED**. Dormant only while the branch sits at the
  development tip. Fix is one resolved `git merge-base` used for both. Not done — needs sign-off.
- `testSuiteStatus.run` / `.recheck` are typed but never written; no endpoint fills them.
- The console's Recheck button is not wired, so re-checking after a hub fix needs an app-side push.

## 5. Environment note

These runs used `origin/development` as it exists in the local app checkout; `git fetch` could not be
run from the session (permission denied). If that ref was stale, the verdicts shift and the run
should be repeated.

## 6. Pending

1. Operator: `git diff --name-status origin/development...origin/feature/cicd-rollout` — its result
   sets the BASELINE verdict every CI run will report. If it contains uncovered `src/app` files, CI
   reports `SUITES_MISSING` regardless of the test edit.
2. Redeploy the two ingest functions ONLY:
   `firebase deploy --only functions:console:recordSuiteStatus,functions:console:recordBranchChannel`
   — the codebase is named (`"codebase": "console"` in `console/firebase.json`), which is why the
   unqualified `--only functions:recordSuiteStatus` filter matched nothing.
3. Tier B (CI wiring) and Tier C (old-flow regression) — both untested.
4. Step 1 (dev + prod channels, URL capture, `previewStatus`) — untested; CI-only.

---

## 7. Addendum — `.css` made neutral (operator decision, 2026-09-08)

`*.css` + `**/*.css` added to `neutral.appPaths`. BOTH forms, per the `*.md` precedent already
documented in that block: `**/` compiles to `.*/ ` and therefore requires a directory, so the bare
form is what catches root-level files.

**Trigger:** `src/app/app.component.css` blocked a branch as `uncovered`. Root cause is not the file
type — the checker never looks at extensions — but the LOCATION: the app shell sits at the root of
`src/app`, where every suite's `src/app/<Folder>/**` glob fails to reach. 17 root-level files share
that fate (`main.ts`, `styles.css`, `index.html`, both root guards, seven services).

**Trade-off, stated and accepted by the operator:** this exempts ALL stylesheets, not just the shell.
A global stylesheet change can break layout on any screen and now reports `NOT_APPLICABLE`,
dispatching nothing. Measured behaviour change: `arena-board.component.css` alone went from
`MATCHED · suites=[queue]` to `NOT_APPLICABLE · suites=[]`. A `.css` + `.ts` commit still routes
normally (`MATCHED · suites=[queue]`), so only CSS-ONLY commits change.

Narrower alternatives were available and NOT chosen: fence only `src/app/app.component.*`, or add the
app shell to `crossCutting` alongside `app.routes.ts` / `app.config.ts`.

**Still open from §3/§4 — none of these were touched:** the `modes`/`profiles` shadowing (F1), the
root-level `*.guard.ts` crossCutting miss, and the merge-base inconsistency.

Verified: JSON valid · 66/66 unit tests pass (the count rose from 57 because the pulled branch added
9 tests, not because of this change) · fenced/uncovered/cross-cutting paths unaffected.

## 8. Addendum — `profiles/profilelist.spec.ts` exists but cannot be selected

The pulled branch added 45 updated specs, including `profiles/profilelist.spec.ts` (85 LOC, PA-20,
the Update Role write path). Its header confirms §3's F3-style gap: *"profilelist (561 LOC, 7 live
handlers, updateDoc + deleteDoc, 3 dialogs) had ZERO coverage."*

F1 is therefore no longer theoretical. A sweep of all 54 top-level app folders against the manifest
found EXACTLY ONE overlap in the repo — and it is this folder:

| Folder | Wins | Shadowed |
|---|---|---|
| `Participants Profile Management` | `modes` | `profiles` |

So a profilelist change resolves to `suites=[modes]`, whose ten specs are all `PM-*` participant-mode
cases and contain nothing for profilelist. The one spec that does test it sits in the suite the
router can never reach. `profiles` remains reachable only via `src/app/ProfilePicture/**`.

The spec also locates by `locator('tr')`, `locator('input[type="checkbox"]')` and
`getByRole('button', { name: /Update Role/i })` — no `data-testid` — so the alignment check indexes
zero selectors for it and `NEEDS_UPDATE` can never fire for this suite.

## 9. Addendum — ATC un-fenced (operator decision, 2026-09-08)

`fenced.appPaths` emptied. Removed: `src/app/ATC/**`, `src/app/ATC-Ops/**`,
`src/app/view-ai-generated-atc/**`.

**Operator's reasoning, stated explicitly:** the ATC restriction applies to the REAL database only;
seeding into the emulator is allowed, so ATC components are not un-automatable.

This REVERSES the 2026-09-03/04 fencing decisions and NARROWS a rule that two other records still
state as absolute. The concern was raised before the change and the operator reaffirmed with the
clarification above. Both records now contradict the manifest and should be updated, or a future
session will re-fence these paths:

- `starlabs-angular/CLAUDE.md:31` — *"Never read, write, or **seed** ATC Firestore collections… Exclude
  all `src/app/ATC/**` components and ATC readers from the test pipeline."*
- `profiles/profilelist.spec.ts` — cancels its Delete Profile case citing *"a standing rule, not an
  emulator limitation."*

**Consequences, all verified:**

1. No suite claims `src/app/ATC/**`, so ATC now reports **SUITES_MISSING** — still blocked; only the
   label and the reason change. Operator acknowledged this explicitly.
2. `NO_COVERAGE_POSSIBLE` now has **no members** and is unreachable. The verdict is retained for
   future use; `retired`/deprecated does NOT belong there (see §10).
3. The second layer is untouched: `_support/excluded-routes.ts` (D-001) still blocks any spec from
   NAVIGATING to ~30 ATC routes. Removing the fence does NOT by itself permit ATC testing — four
   changes are needed for that (un-fence, map ATC paths to a suite, lift the route denylist, write
   the specs). Only the first is done.
4. `scripts/check-route-coverage.mjs:197` and `scripts/check-atc-coupling.mjs:75` read the same key to
   drop paths from the coverage denominator. With it empty, ATC screens re-enter the denominator and
   reported coverage will DROP. Safe by construction (`?? []`), but the numbers move.

Verified: JSON valid · 66/66 unit tests pass (their fixtures declare their own `fenced`, so they are
independent of the real manifest) · ATC paths → SUITES_MISSING · controls unchanged
(quiz → SUITES_MISSING, queue → MATCHED, README → NOT_APPLICABLE).

## 10. Verdict-condition redesign — decisions taken, not yet implemented

- **Exercised-check scope: components only** (option (a), locked). `MATCHED` will additionally require
  that a changed `.component.*` has ≥1 `data-testid` referenced by a spec in the SELECTED suite.
  Services, pipes, guards, models and resolvers pass on path coverage alone. Rejected: proving a
  service via its consuming components — measured 0 of 26 services could pass under "all consumers
  exercised" (`authguard.service.ts` alone has 237 consumers, 14 exercised), and 2 of 26 under "any",
  which is a green that means nothing.
- **Deprecated → NOT_APPLICABLE**, `canProceed: true`. NOT `NO_COVERAGE_POSSIBLE`: deprecated code
  COULD be tested and simply should not exist. Needs `retired` re-keyed from ROUTES to FILE-PATH globs
  and read by `classifyChanges` — it is read only by check-route-coverage today.
- **Blast radius measured, gating deferred:** of 439 components, only 18 (4%) satisfy the new MATCHED
  rule, all in `queue` — the only suite whose specs use testids. Recommendation on the table:
  ship the rule as a REPORT field first, gate once the number climbs.

---

# 2026-09-09 — Workflow rollout, increment 1

Operator: "implement it now and lets test". Built steps 2b and 3 of the agreed flow.

## D2 — no tester gate on production (operator decision, 2026-09-09)

The dev→prod PR is created automatically at merge and approved by a GitHub admin. There is NO
console tester sign-off on it. The concern was put to the operator explicitly — today every
successful dev deploy resets `prodGate` to NONE, forcing a tester to re-validate the MERGED
development state — and the operator chose "accept it, git admin only". Consequence, accepted: the
only test evidence for a production release comes from each feature branch BEFORE merge. Two
features that break each other after merging are caught by nothing. Rejected alternatives: a tester
sign-off on the prod PR, and re-running the suites against `development` after the dev deploy.

## Step 2b — deprecated files (SHIPPED)

`retired.appPaths` is the FILE-PATH twin of `retired.routes` (which is route-keyed and read only by
check-route-coverage). `classifyChanges` now matches it BEFORE `fenced` and before any suite, into
its own bucket. A deprecated file is neither a coverage gap nor manual-only — it does not
participate. Deprecated-only commit → NOT_APPLICABLE, proceeds. Seeded with the one known dead
screen, `userprofile_old`.

Verified on the real app: deprecated-only → NOT_APPLICABLE · deprecated+covered → MATCHED ·
deprecated+uncovered → SUITES_MISSING (the gap is NOT masked) · controls unchanged.
Carried through `readiness.cjs` → payload → `recordSuiteStatus` ingest → frontend
`SuiteStatusDetails.deprecated`, so the console can say "deprecated screen" rather than "docs only".

## Step 3 — dispatch + run result (BUILT, not yet run)

- **`maybeDispatchSuites()`** in `readiness.ts`, fired from `recordSuiteStatus`. Guards, each a
  decision already taken: state MUST be `MATCHED` (NOT_APPLICABLE is also canProceed:true but
  carries ZERO suites, so dispatching it would start a run with nothing to run); suites MUST be
  non-empty; the sha MUST differ from `run.sha` (ten pushes an hour must not launch ten matrices).
  NEVER throws — the alignment verdict must land even if GitHub is down.
  WHY in the backend: `GITHUB_TOKEN` cannot start a workflow run (GitHub suppresses runs it
  triggers), and the console's future Recheck button re-enters the same path — one code path.
- **`recordSuiteRun`** — new ingest endpoint, writes ONLY `testSuiteStatus.run`. `recordSuiteStatus`
  never writes that key, so a re-check cannot erase a run result, and the two interleave safely.
  The flip side: a stale run can outlive its check, so the UI must compare `run.sha` with
  `testSuiteStatus.sha` before trusting it.
- **`branch-suites.yml`** (app repo, NEW) — display name `branch suites`, containing none of
  preview/deploy/e2e, so `handleWorkflowRun` logs it "not a tracked lane" and it cannot touch
  `gateRun`/`testSummary`/`preview.*`. Four jobs: `start` (RUNNING) → `resolve` (suite names →
  configs from the hub manifest, the SAME mapping preview-e2e.yml uses so the lanes cannot
  disagree) → `suite` (matrix on the hub's `web-e2e.yml`, `stage: branch-suite` to keep these out
  of the old flow's cicd-audit ledger) → `report` (collapses the legs; PASSED iff
  `needs.suite.result == 'success'`).

Verified: 75/75 unit tests · both tsc configs clean · both workflow YAMLs parse · workflow display
name contains none of the three tracked words.

## ⚠️ Blocker for testing step 3

`createWorkflowDispatch` resolves `workflow_id` against the repo's DEFAULT branch. `branch-suites.yml`
currently exists only where it is pushed — it MUST be on `starlabs-angular`'s default branch (`main`)
before the dispatcher can fire, or the API returns 404. Pushing it to `feature/cicd-rollout` alone is
not enough. (`main` is in branch-channels.yml's `branches-ignore`, so landing it there triggers
nothing.)

Also: `recordSuiteStatus` now binds `GITHUB_APP_PRIVATE_KEY`, so the redeploy must include it, and
`recordSuiteRun` is new.

## Not yet built

Steps 4–7: `approveRollout` callable (tester/admin, requires `run.state === PASSED`), the
`BYPASS_SUITE_STATUS` capability + audit fields, the auto PR→development on approval, the
find-or-create PR development→production on the merge webhook, and the console UI.

Role tightening (developer → read-only) is deliberately NOT done: `ROLE_CAPABILITIES` is shared with
the OLD flow, and removing `DEPLOY_PREVIEW`/`CREATE_PR_DEV` today would break the live path. It
belongs at cutover, with the old-flow buttons.

## Increment 2 — steps 4–7 (BUILT, hub side complete)

- **Capabilities `APPROVE_ROLLOUT` (tester+admin) and `BYPASS_SUITE_STATUS` (admin only)** added to
  BOTH copies (`functions/src/model.ts`, `src/app/core/roles.ts`). Added ALONGSIDE the old ones —
  `developer` keeps `DEPLOY_PREVIEW`/`CREATE_PR_DEV` for now. Stripping them today would break the
  OLD flow, which is still the live path; role tightening belongs at cutover.
- **`RolloutFacet`** on the candidate (`rollout`), and the backend `ReleaseCandidate` finally gained
  typed `previewStatus`/`testSuiteStatus` (they existed only on the frontend, written as untyped
  patches). NONE are read by `deriveStatus()` — the new flow still cannot move a status.
- **`approveRollout` callable** (in index.ts, where requireAuth/requireCapability/appOctokit live —
  readiness.ts cannot import index.ts without a cycle). Enforces server-side: APPROVE_ROLLOUT,
  `run.state === 'PASSED'`, AND `run.sha === headSha`. That last test matters because a re-check
  overwrites state/details but deliberately leaves `run` alone, so a stale PASS can outlive the
  check that produced it. Admin override needs BYPASS_SUITE_STATUS plus a reason of ≥10 chars,
  recorded permanently in `rollout.bypass`. Opens the PR FIRST and only then records the approval —
  an approval with no PR is a lie the console would keep showing.
  NOTE: opening this PR advances the OLD flow's `derivedStatus` to PR_TO_DEV via the pull_request
  webhook. Unavoidable while both flows share one document; harmless because the old flow is going.
- **`ensureDevToProdPr()`** — find-or-create, called on every feature→development merge. Idempotent
  because a release batch is several merges: an open PR short-circuits, "no commits between" means
  nothing to ship, anything else is logged and swallowed (a webhook must never 500 over this).
- **Console UI** — run badge (with pass/fail counts and a report link), "run stale" warning,
  approve button, admin "bypass & approve" (mandatory reason via prompt), and the approved state
  with its PR link, bypass warning and "approval stale" flag.
- **Mock fixture** — the all-green candidate's `run.sha` now matches its `headSha`, so mock mode
  actually exercises the approve path.

Verified: 75/75 unit tests · functions tsc clean · frontend tsc clean · **full AOT production build
clean**.

## Still to do before the old flow can be removed

1. `branch-suites.yml` must reach `starlabs-angular`'s DEFAULT branch or the dispatch 404s.
2. Nothing has RUN yet — steps 3–7 are built and typechecked, never executed.
3. Old-flow removal: `deployPreview`/`signoff`/`createPullRequest` + their buttons, `preview.yml`,
   `preview-e2e.yml`, and the projection's dependence on the old facets. Deliberately NOT started —
   removing the live path before the replacement has run once would leave no working flow at all.
