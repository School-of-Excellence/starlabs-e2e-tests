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

## Increment 3 — classification hygiene (2026-09-09)

Three operator-approved wins. NONE touches a suite's `appPaths` — the operator's instruction was
"keep A as it is, don't change any suits", so suite ownership is untouched throughout.

Measured on the `Starlabs - VideoConference` checkout, 1,892 source files:
**uncovered 233 → 149 (-84, -36%); distinct uncovered areas 24 → 10.**

1. **`*.spec.ts` + `**/*.spec.ts` → neutral.** Karma/Jasmine UNIT tests: not shipped, and no e2e
   suite can ever drive one. 74 of the app's 425 were being counted as uncovered app code. Both glob
   forms, per the `*.md` precedent. (`profiles` keeps its narrower `!**/*.component.spec.ts`, which
   only applies inside its own matching; this is the global rule.)
2. **`openvidu-loading-game` + `authloading` → `retired.appPaths`.** A SECOND kind of dead, with no
   `routes` counterpart: not in app.routes.ts at all AND referenced by nothing outside their own
   folder (0 external class refs, 0 uses of `<app-openvidu-loading-game>` / `<app-authloading>`).
   Unroutable and unreferenced is deader than a dead route, so the evidence lives in `_appPathsWhy`.
   **Checked and deliberately NOT retired:** `route-configuration-duplicate` (3 external refs, but
   its class names collide with the live `src/app/route-configuration` — needs a human look),
   `Test Component`/DevTestMic, `slackwebhookurls`, `arena-design-insights` (all routed), and
   `updatesnackbar` (used by app.component.ts). A first pass using `grep -c` on app.routes.ts had
   reported several of these as 0-reference; that method was wrong (trailing-space patterns) and the
   proper class/selector reference scan corrected it before anything was retired.
3. **Root-level sweep completed → crossCutting:** `src/main.ts`, `src/index.html`,
   `src/firebase-messaging-sw.js`, both `app.*.server.ts`, `network-status.service.ts`. No root-level
   file now reports as an uncovered feature.

Verified: 75/75 unit tests · `authloading` → NOT_APPLICABLE · `arena-board.component.spec.ts` →
NOT_APPLICABLE · `src/main.ts` → all 12 suites · `quiz` → MATCHED[business] · `README.md` unchanged.

### Stale-read incident (worth remembering)

An earlier analysis this session reported `support` as an unregistered orphan suite and claimed
LiveKit/OpenVidu/Product Designer had no owner. All of that was WRONG: `suites-manifest.json` changed
on disk mid-session (operator commits `e74295c` / `f066657`) and the analysis had been run against
the older copy. The current manifest has **13** suites including `support`
(`ciReady: false`, wired 2026-09-08 for exactly the reason the stale analysis "discovered"), and
`queue` claims `OpenVidu/**` + `LiveKit/**` while `journey` claims `Product Designer/**`.
LESSON: re-read the manifest before every analysis pass in a session where the operator is also
committing — do not trust a value read earlier in the same session.

### Branch state, unchanged by this increment (as expected)

`Starlabs - VideoConference` is still `SUITES_MISSING` with the same 7 files + 1 drift:
`AppEngagement/{email-record,notification-record,wati-record}` (6, need a suite claim — `comms`
already drives `/notificationrecord` but suite paths are frozen by operator instruction),
`Customer Support/customer-support-dashboard` (1 — `support` claims it but `ciReady:false`, so
classifyChanges skips it; needs `playwright.support.emulator.config.ts`), and the `bp-event-select`
drift (one-line app fix at `big-planner.component.html:17`).

## Increment 4 — Recheck button, option A (operator decision 2026-09-09)

**Problem it solves:** the check runs on APP pushes but clones the hub at `main` at run time. After a
HUB-side fix — a corrected selector, a widened appPaths — nothing re-triggers, and the only recourse
was `git commit --allow-empty` on the app branch.

**Option A chosen over B/C:** dispatch `branch-channels.yml` with a new `skip_channels` input rather
than re-running it whole. B (dispatch as-is) would cost two full AOT builds per click AND republish
the PROD channel against the live project for another 7 days — an unacceptable price for a
~1-minute check, and a button that silently redeploys production is the wrong button.

- `branch-channels.yml` — new `skip_channels` dispatch input (default `'false'`); the `channels` job
  carries `if: ${{ inputs.skip_channels != 'true' }}`. `inputs.skip_channels` is EMPTY on a push
  event, so every normal run is unchanged.
- `recheckSuites` callable (index.ts, beside approveRollout — readiness.ts cannot import the auth
  helpers without a cycle). Dispatches via the GitHub App, then writes `testSuiteStatus.recheck`
  {requestedBy, requestedAt, count}. Written with a direct `set(merge)` rather than mutateCandidate:
  re-projecting would stamp `updatedAt` and reorder the board for what is only a request.
  60-second anti-double-click guard — the workflow is idempotent but racing writes make confusing UI.
- **WHO — decided, flag if wrong:** any signed-in ACTIVE member, gated on membership not capability.
  Rechecking only re-evaluates a diff, and it is usually the DEVELOPER who just fixed the mismatch —
  who under the new flow holds no other capability. Deliberately NOT gated on APPROVE_ROLLOUT.
- Console: quiet link-weight `↻ recheck` on Stage 2 (the emphasised control on the card stays
  Approve, stage 4), plus a `N×` counter. Hidden while state is CHECKING.

Also removed a duplicate `// 5. setMember` section header left behind by the approveRollout insert.

⚠️ DEPLOY/PROPAGATION: `createWorkflowDispatch` resolves `workflow_id` against the repo's DEFAULT
branch, and the RUN uses the workflow file from the dispatched `ref`. So the `skip_channels` input
must exist on BOTH `starlabs-angular`'s default branch and the feature branch, or the dispatch 404s
or silently ignores the input and rebuilds the channels anyway. Edited in the
`Starlabs - VideoConference` checkout only — `Starlabs 19` still has the old file.

Verified: 75/75 unit tests · functions tsc clean · full AOT production build clean · both workflow
YAMLs parse (`branch-channels.yml` inputs = ref, skip_channels).

## Increment 5 — first real branch-suites run, and why it failed (2026-09-09)

`feature/cicd-rollout` (Starlabs 19) reached the test lane: two channels SUCCESS, check MATCHED
(4 files — 3 neutral, `profilelist.component.ts` → `modes`), auto-dispatch fired, suites RAN. Then
the run failed — **for a reason entirely outside this project**.

```
Run cd e2e && npx playwright install --with-deps chromium
Err: https://dl.google.com/linux/chrome-stable/deb stable/main amd64 Packages — Hash Sum mismatch
E: Failed to fetch .../Packages.gz   Failed to install browsers   exit code 100
```

Google's Chrome apt repo served a `Packages.gz` whose hash did not match its `Release` file — the
log's own timestamps show the lag (Release created 17:16 UTC, Packages last modified 09:41). A CDN
propagation inconsistency on Google's side. The job died before a single test ran, so nothing about
the branch, the `modes` suite or the app was involved.

**Fix — `.github/workflows/web-e2e.yml:142`, dropped `--with-deps`.** That flag runs
`apt-get update && apt-get install` for browser system libraries. GitHub's ubuntu runner images
already ship all of them, so on this runner the flag buys nothing and costs an apt round-trip against
every source on the image — including a Google Chrome repo we never use (we run Playwright's BUNDLED
chromium). Removing it takes apt off the critical path entirely. If a future image ever lacks a
library the failure surfaces at browser LAUNCH with a named missing library, and the fix is to
install that one library rather than re-enable a full apt update.

⚠️ **SHARED FILE — 12 callers.** `web-e2e.yml` is the engine for `preview-e2e.yml` (the OLD flow),
the ten per-suite `*-e2e.yml` workflows, and `branch-suites.yml`. This change makes the install step
do strictly LESS, so the blast radius is a reduction in what runs, but every lane is affected and it
should be watched on the next old-flow run too.

**Also fixed in this increment (found while diagnosing):** `branch-suites.yml`'s `report` job took
`needs: [suite]` only, so a `resolve` failure skipped the matrix and `needs.suite.result == 'skipped'`
was reported as FAILED — a lane that NEVER RAN looked identical to genuinely failing tests. It now
takes `needs: [resolve, suite]`, distinguishes failure / cancelled / skipped-after-resolve-failure /
empty-matrix, and sends a plain-English `note` through `recordSuiteRun` to Firestore. Stage ③ shows
that note inline in red on failure and in the tooltip otherwise. `note` added to both model copies
and accepted (capped at 300 chars) by the endpoint.

Verified: 75/75 unit tests · functions tsc clean · full AOT build clean · both workflow YAMLs parse.

## Increment 6 — second failure: @zoom/meetingsdk peers dropped by --legacy-peer-deps

The `--with-deps` fix worked; the run got past browser install and died at the app-serve step:

```
Run nohup npm run start:emulator > /tmp/app.log 2>&1 &
Error: app failed to serve on :4200
✘ [ERROR] Could not resolve "react"        node_modules/@zoom/meetingsdk/dist/zoomus-websdk.umd.min.js
✘ [ERROR] Could not resolve "redux"
✘ [ERROR] Could not resolve "redux-thunk"
```

**Root cause, verified against the app's lockfile:**

- `@zoom/meetingsdk ^6.1.0` is a real dependency; its peers are `react@18.2.0 react-dom@18.2.0
  react-redux@8.1.2 redux@4.2.1 redux-thunk@2.4.2 lodash@^4.18.1`.
- Those peers ARE in `package-lock.json` (lockfileVersion 3) — each marked **`"peer": true`**.
- `web-e2e.yml` installed the app with `npm ci --legacy-peer-deps`. That flag restores npm 6
  behaviour: peer dependencies are NOT installed. So `npm ci` reproduced the lock MINUS every
  peer-marked entry, and react/redux/redux-thunk were simply absent from node_modules.
- `zoomus-websdk.umd.min.js` `require()`s them at BUILD time, so `ng serve --configuration emulator`
  failed to bundle, the app never reached :4200, and every suite failed without running a test.

**Why it never showed up before:** `branch-channels.yml`'s channels job uses plain `npm install`
(npm 7+ DOES install peers) and its production build succeeded on the same commit — which is exactly
why both channels went green while the test lane died. The asymmetry between the two install
commands is the whole bug.

**Fix — `.github/workflows/web-e2e.yml`,** after `npm ci --legacy-peer-deps`, reinstall the SDK's
peers explicitly with `npm i --no-save --legacy-peer-deps`. Versions are READ FROM THE INSTALLED SDK
(`require('@zoom/meetingsdk/package.json').peerDependencies`) rather than hardcoded, so a Zoom bump
cannot silently reintroduce the failure; `--no-save` leaves package.json and the lock untouched.
Verified the extraction against the real node_modules — it emits exactly the versions the lock pins.

Rejected alternatives: dropping `--legacy-peer-deps` (one word, but it is presumably there for a
peer conflict elsewhere, and this is a file shared by 12 workflows — too broad a change to make
blind); declaring the five peers as devDependencies in the app (correct and durable, but it modifies
the app repo's package.json + lock, which is the operator's call, not a CI fix).

⚠️ SHARED FILE — the same 12 callers as increment 5. This change is purely additive.

## Increment 7 — screen cutover (operator decisions, 2026-09-10)

First fully green run of the new flow landed on `feature/cicd-rollout` (Starlabs 19): two channels
SUCCESS → check MATCHED (suites `["modes"]`) → auto-dispatch → **suites PASSED**. End to end.

**Route guard — a live bug, fixed.** `/branches` was `devOrAdminGuard`. Working Branches is now the
ONLY screen carrying the TESTER's single action (Approve for rollout), so a pure tester was bounced
to Overview and could not do their job at all. Now `anyMemberGuard` (developer | tester | admin).
Widening the ROUTE grants no ACTION — every button is still capability-gated and each callable
re-checks server-side.

**Preview Channels — off the nav, code kept.** Fully superseded by the card's stages ① and ④, and
actively harmful: `rc.preview.url ?? previewUrlFor(...)` always fell through to the reconstruction
(the new flow never writes `preview.url`), which builds `breakthroughs-test-<branch>.web.app` —
single dash, no hash, a link that CANNOT resolve. Route and component untouched and reachable by URL.

**Release Channel — kept, opened to everyone, actions stripped.** Operator: it exists so admin,
tester and developer can see the dev/prod links and which branches actually merged. Guard
adminGuard → anyMemberGuard; `promoteAndPr()` / `promote()` / `runTestsFor()` buttons removed from
the template (methods left in the component, unused, nothing deleted); the `canPromoteAndPr` branch
replaced by a plain statement that the prod PR opens automatically. Only `openLog` remains. It stays
essential because Working Branches filters protected branches out (`!isProtectedBranch`), so this is
the ONLY view of the development/production lanes and the release batch.

**Overview — re-pointed at the new flow.** Every old counter read `preview.buildState`, `devGate`,
`prodGate`, `testSummary` or `derivedStatus` — none of which the new flow writes. `testSummary` in
particular is only written by `handleWorkflowRun` when the workflow name contains `e2e`, and
`branch suites` deliberately does not, so the pass/fail card would have sat at ZERO forever while
suites ran and passed. New cards: Channels live (both legs SUCCESS) · Suite check blocked ·
Suites pass/fail · **Awaiting approval** (green, fresh, unapproved — the tester's actual queue) ·
PRs open · Stale vs HEAD · Bypassed (only when non-zero). The status funnel became a STAGE funnel
(Pushed → Channels live → Suite check passed → Suites passed → Approved → Merged to development),
each row counting branches that reached at least that stage so the biggest drop names the
bottleneck. Deploy health re-pointed at `prDev`/`prProd` merges and channel failures.

**Working Branches — both PRs now visible to every role.** Operator: "any user can know whether the
PR is opened or approved to the dev and prod." A new PR row under the pipeline shows
`→ development` and `→ production` pills with number, state (open/merged/closed) and a GitHub link.
The prod PR is NOT on the feature candidate: `handlePullRequest` writes `prProd` against the PR's
HEAD branch, which for a promotion is `development` — so `prodPr()` looks it up from the repo's
development entry, one shared PR the whole batch travels in. Before the webhook lands, the dev pill
falls back to `rollout.prUrl` so the link never disappears in that gap.

**Recheck narrowed** (operator rule): offered only while the check is BLOCKING — hidden on MATCHED
and NOT_APPLICABLE. On MATCHED the dispatcher would refuse anyway (a run already exists for that
sha), so the button was misleading there.

Verified: 75/75 unit tests · full AOT production build clean · nav = Overview · Working Branches ·
Release Channel · CF Board · Test Suites · Settings · Release Channel's only remaining action is
`openLog`.

## Increment 8 — stage ④ must never be green beside a red stage ③ (2026-09-10)

Operator screenshot: TEST RUN **failed** (red) sitting next to ROLLOUT **approved** with a live PR
link. Three separate defects behind one symptom.

1. **A push did not invalidate the approval.** `rollout` stayed APPROVED for a commit it never
   covered, `approveRollout` refused ("Already approved for rollout") and `canBypassRollout` required
   `state !== 'APPROVED'` — so NEITHER a tester nor an admin could act. A dead end.
   Fixed backend-side in `handlePush`: a push whose sha differs from `rollout.sha` resets the facet
   to `{ state: 'NONE' }`, mirroring the old flow's prodGate reset on every successful dev deploy.
   Nothing is lost — the activity log keeps the approval and the PR survives in `prDev`.

2. **"Approved" was defined only by staleness.** The first frontend fix treated an approval as
   superseded only when its sha ≠ headSha. That still leaves green-beside-red when the sha matches
   but the run FAILED. `rolloutSuperseded()` now means: approval predates HEAD **OR** the evidence
   behind it is not a fresh PASS. Stage ④ may say "approved" only while a fresh passing run stands
   behind it. `nfRolloutTone` and `nfNextStep` were reading the old rule and are now consistent — a
   superseded approval is amber and falls through to a message naming what has to happen
   ("Approved earlier, but the suites have since FAILED — fix them, or an admin must bypass").

3. **Three links to two PRs.** Stage ④ carried a `PR ↗` and the card footer carried
   "Open PR on GitHub ↗", both pointing at the dev PR only, while the new PR row already showed both
   PRs with their state. Operator: "only the bottom two PR button is enough." Both removed; the PR
   row is now the single place either PR is linked.

**Also this session, and my fault:** `console/node_modules` and `console/functions/node_modules` were
emptied while I was running a typecheck from the wrong directory (`npx tsc` in `console/functions`
pulled the unrelated `tsc@2.0.4` package). Restored with `npm install --legacy-peer-deps` (console,
509 packages) and `npm install` (functions); source untouched and both builds green. NOTE
`console/package-lock.json` is absent afterwards — the operator should confirm whether it was
tracked.

Verified: 75/75 unit tests · full AOT production build clean · stage ④ has no PR link · the PR row
holds exactly two links.

## Increment 9 — the production PR belongs to the BATCH, not the branch (2026-09-10)

Operator noticed every feature card showed the SAME production PR and asked whether to keep it or
move it to Release Channel. Investigating it exposed a bug in increment 7's PR row.

`prProd` lives on the DEVELOPMENT candidate — one shared development→production PR carries the whole
release batch — so every card reads the same record. That is TRUE while those branches are in the
open batch. But `handlePullRequest` clears `unreleased` on every feature candidate when a
development→production PR merges, while `prDev.state` stays MERGED for ever. Increment 7 gated on
`prDev.state === 'MERGED' || unreleased`, so a branch released three batches ago kept displaying the
CURRENT prod PR — one containing none of its code. It looked correct only because
`feature/cicd-rollout` happened to be in the batch that had just merged.

**Operator chose A: keep it on the card, but only while it is true.** New `prodStage()` returns:

| stage | condition | shown |
|---|---|---|
| `in-batch` | `unreleased === true` | the prod PR, tagged **batch**, with number/state/link |
| `shipped` | merged to dev, `unreleased` cleared | `✓ shipped to production` — deliberately NOT a link |
| `none` | not merged to development yet | nothing |

`unreleased` is the only correct key here; `prDev.state` cannot express it. The `shipped` state is
not a link on purpose: we do not record WHICH prod PR carried a given branch, so the fact of
shipping is the only honest thing to show. The `batch` tag makes the shared PR number read as
intentional rather than as a duplicate.

Rejected option B (move it to Release Channel only): correct about ownership, but it costs a round
trip for the question people ask most — "did my change reach production?" — and Release Channel
keeps the full batch view regardless.

Verified: 75/75 unit tests · full AOT production build clean · `showProdPr` fully replaced.

## Increment 10 — "shipped to production" must be EVIDENCE, not inference (2026-09-10)

Operator: "other branches also show shipped to production. Verify the accuracy." They were right —
increment 9's `shipped` state was inferred, and the inference was unsound.

`unreleased` is written in exactly two places: set `true` on a feature→development merge
(index.ts:489), cleared to `false` only where already true (index.ts:551). It is NEVER seeded on a
new candidate. So a falsy `unreleased` carries TWO meanings that cannot be told apart:

  (a) it was true and a production release cleared it  → genuinely shipped
  (b) it was never set at all                          → we know NOTHING

Increment 9 read `!unreleased && prDev.state === 'MERGED'` as (a). Every branch in case (b) — merged
before D2 existed (2026-06-26), or whose pull_request webhook was never delivered — got a green
"shipped to production" it had never earned.

**Fix: record the fact at the only moment we know it.** When the dev→prod merge clears `unreleased`,
it now also writes `released: { at, prNumber, prUrl }` — and the prod PR's number/url are already in
scope there. `prodStage()` returns `shipped` ONLY when `released.at` exists; no record means
UNKNOWN and the card shows no production pill at all.

Two things this buys beyond correctness:
- It removes increment 9's stated limitation ("we do not record WHICH prod PR carried a branch, so
  shipped cannot be a link"). It can now, and it is — the shipped pill links the actual PR.
- Absence is now meaningful. `released` missing means the console cannot tell, and it says nothing
  rather than guessing.

⚠️ MIGRATION: branches whose batch shipped BEFORE this change have no `released` record and will
show no production pill. That is the honest outcome — the data to prove they shipped does not
exist — but it is a visible change for existing cards. Backfilling would require walking merged
dev→prod PRs and matching commits, which is not worth it; new releases populate it from now on.

Verified: 75/75 unit tests · functions tsc clean · full AOT production build clean.

## Increment 11 — a bypass must not supersede itself (2026-09-10)

Operator bypassed and approved the videoconference branch; stage ④ still read "approval superseded"
with the button live. Increment 8's clause (b) was the cause and it was self-contradictory:

    superseded = approved AND ( sha != headSha OR NOT(run PASSED and fresh) )

A bypass is BY DEFINITION an approval that is not backed by a passing run — that is what it is for.
So every bypassed approval satisfied the second condition permanently: the stage never settled, the
approve/bypass button stayed live, and the branch could never reach an approved resting state.

Fixed by ordering the tests so a bypass short-circuits the evidence check but NOT the staleness one:

  (a) sha != headSha           → superseded, bypass included (new code needs a new decision)
  (b) rollout.bypass present   → NOT superseded (an admin accepted this, on the record, with a reason)
  (c) otherwise                → requires a FRESH PASSING run behind it

The operator suggested disabling the button; the button disappearing is the correct outcome, since
with (b) in place `rolloutApproved()` is true and stage ④ renders "approved" plus the amber
"⚠ bypassed" badge — which is what a bypass should look like once it has taken effect.

Verified: 75/75 unit tests · full AOT production build clean.
