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
