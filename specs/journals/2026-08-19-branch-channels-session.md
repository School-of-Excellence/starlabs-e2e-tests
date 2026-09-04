# 2026-08-19 — Branch channels + suite alignment (the NEW flow, phase 1)

**Scope:** two repos only — `starlabs-angular` (the app) and `starlabs-e2e-tests` (the hub).
CF and Flutter untouched. `/Users/m1/Documents/CICD` is a session folder, not a project — the
`starlabs-cicd` repo inside it is the frozen golden Angular snapshot and was not touched.

**What shipped:** on every feature push, publish TWO hosting channels (dev + prod) and report
whether the hub's suites actually cover the diff — running entirely beside the existing console
flow, which is byte-for-byte unchanged.

---

## 1. The decisions, and why

| # | Decision | Why |
|---|---|---|
| D1 | The new flow lives in its OWN workflow file, `branch-channels.yml` | The console tracks workflows by file name (`preview.yml`, `deploy_19.yml`) and by display names containing `e2e`. A differently-named workflow is logged "not a tracked lane" and ignored — so it **cannot** touch `preview.buildState` or any status. This is what makes push-triggering safe, and it removed the blocker that had stalled the design. |
| D2 | Display name must never contain `preview` / `deploy` / `e2e` | `handleWorkflowRun` falls back to matching by NAME when the webhook payload omits `path`. One such word would hand this workflow control of the old flow's status fields. |
| D3 | Two NEW fields on the existing doc: `previewStatus`, `testSuiteStatus` | Operator directive: keep the DB structure, add fields, no new collections. `preview.*` stays owned solely by the old flow so the two can never fight over one field. |
| D4 | Neither new field is read by the projection | `deriveStatus()` reads only prProd/prodGate/prDev/devGate/preview.buildState/mobileDelivery. So nothing the new flow writes can move a status or enable a button. |
| D5 | The prod channel uses the REAL production project | Operator decision, trade-off stated explicitly: the Firebase config compiled into the bundle — not the hosting site — decides the backend, so this publishes unreviewed branch code on a public URL against live customer data (and the project that holds ATC) for the channel's 7-day life. The rejected alternative was `starlabs-cicd` (production build shape, prod-structured sample data, no live data). |
| D6 | Channel URLs are always captured, never reconstructed | Channel URLs carry a random hash. The console's `previewUrlFor()` helper builds `breakthroughs-test-<branch>.web.app` — single dash, no hash — a link that **cannot resolve**. Each leg reads its own site's URL out of the CLI's `--json` and fails loudly if it can't. |
| D7 | One functions codebase per Firebase project | The readiness endpoints were briefly built as a separate `readiness` codebase for blast-radius isolation; the operator overrode that on 2026-08-19. They now live in `console/functions/src/readiness.ts`, surfaced by a single `export * from './readiness'` in index.ts. Trade-off accepted: a bad deploy now redeploys the live receiver too. |
| D8 | The verdict reports; it does not yet gate or run anything | Phase 1 is evidence only. Approve/PR gating and auto-dispatching the suites come later. |

## 2. What the checker is

`scripts/readiness/` — three files, plain Node, no dependencies, no network, no emulator.

| File | Role |
|---|---|
| `lib.cjs` | Every pure check. Glob semantics are a deliberate copy of `console/functions/src/suites.ts` (`globToRegex`, `firstMatch`) so CI, the console dialog and this script can never disagree. |
| `readiness.cjs` | CLI + CI entry. Resolves the diff, runs the checks, renders human output, writes `$GITHUB_STEP_SUMMARY` and the ingest `payload`. Always exits 0 — it reports, it does not gate. |
| `readiness.test.cjs` | 57 unit tests over fixture diffs and a real temp tree. |

Three questions, in order:

1. **Coverage** — every changed file is bucketed `neutral` (docs/workflows — never blocks) ·
   `fenced` (ATC — never automatable) · `covered` (a ciReady suite's `appPaths` matches) ·
   `uncovered` (matches nothing). A `crossCutting` hit promotes every suite.
2. **Alignment (hub → app)** — every literal `data-testid` the selected suites drive must still
   exist in the app. Two passes: a direct index, then a quoted-literal search so bound forms
   (`[attr.data-testid]="'x'"`) still resolve.
3. **Element coverage (app → hub)** — each changed component's HEAD source is compared against its
   BASE version, so "new" means new *in this diff*: new hooks no spec references, new interactive
   elements (`<button>`, `(click)`, `routerLink`) with no `data-testid` at all, and components where
   nothing is exercised by any spec.

Verdicts, most-blocking first: `NO_COVERAGE_POSSIBLE` → `SUITES_MISSING` → `NEEDS_UPDATE` (hub
stale) → `MISSING_TEST_CASES` (app ahead) → `NOT_APPLICABLE` → `MATCHED`. `canProceed` is true only
for the last two, and is stored so the UI never re-derives the rule.

**Calibration:** pre-existing untested hooks are reported as backlog but never block — only what
*this diff* adds does, or nothing would ever go green.

## 3. When it runs

```
 push to a feature branch  (development / production / main / cicd-* excluded)
        │
        ├─ job `suite-status`   ~1 min · no build, no emulator
        │    checkout app (fetch-depth 0) → clone hub@main → fetch origin/development
        │    → node e2e/scripts/readiness/readiness.cjs
        │    → job summary + POST recordSuiteStatus  → testSuiteStatus
        │
        └─ job `channels`  [matrix]
             dev  → starlabs-test    / breakthroughs-test
             prod → fir-sample-aae4a / star-labs   (soft: failure must not cost the dev channel)
             → POST recordBranchChannel (always, SUCCESS or FAILED) → previewStatus.<env>
```

Also runnable locally against the real repos, which is how the coverage picture below was measured:

```bash
node scripts/readiness/readiness.cjs --app app --base development --head HEAD
node scripts/readiness/readiness.cjs --app app --base HEAD --files "src/app/quiz/x.ts"   # force a verdict
node scripts/readiness/readiness.test.cjs                                                 # 57 tests
```

## 4. Bugs the real-data testing caught

Each had a regression test added.

1. **Paths with spaces were shredded.** `git diff --name-status` is TAB-separated; splitting on
   whitespace mangled every folder containing a space — and this codebase has a dozen
   ("queue system", "Business Dashboard", "Diagnostics Tool"). It reported **19** uncovered files
   where the truth was **7**.
2. **`**/*.md` never matched `README.md`.** The shared `globToRegex` compiles `**/` to require a
   directory, so root-level docs read as *uncovered app code*. Fixed in the manifest by carrying both
   `*.md` and `**/*.md`, documented so nobody "simplifies" it back. The glob function itself must not
   diverge from suites.ts.
3. **"First `.web.app` URL in the payload"** — proved with a two-site payload that the existing
   extraction returns the wrong URL. Each leg now looks up its own site explicitly.

## 5. Measured state of the app

**24 of 54** top-level `src/app` folders are covered by a suite · **2** fenced (ATC, ATC-Ops) ·
**28 uncovered** — including `big`, `quiz`, `Customer Support`, `Diagnostics Tool`, `LiveKit`, `hpc`.
Expect `SUITES_MISSING` often until that backlog shrinks. This is the number to react to before any
of this starts gating.

## 6. Files

**`starlabs-angular`** — `.github/workflows/branch-channels.yml` (new). `preview.yml` reverted and
untouched.

**`starlabs-e2e-tests`** — `scripts/readiness/{lib,readiness,readiness.test}.cjs` (new) ·
`console/functions/src/readiness.ts` (new) + one `export *` line in `index.ts` ·
`suites-manifest.json` (`neutral` + `fenced` added) · `console/src/app/core/release-candidate.model.ts`
(two facet types + fields) · `mock-data.ts` (3 fixtures) ·
`console/src/app/screens/working-branches/*` (badge row + helpers) ·
`specs/journals/2026-08-19-branch-channels-test-cases.md` (the test plan).

Verified: 57 unit tests green · console functions `tsc` clean (the 3 eslint errors in `suites.ts` are
pre-existing) · console frontend `tsc` + full AOT production build clean · both workflow YAMLs valid.

## 7. Next

1. Deploy `console/functions`, push both repos, run the test plan — especially the regression
   section: the console log must say `workflow_run branch-channels.yml … — not a tracked lane`.
2. Wire a green verdict to actually dispatch `preview-e2e.yml`. It belongs in `recordSuiteStatus`,
   which has the GitHub App available — `GITHUB_TOKEN` cannot do it, as GitHub suppresses workflow
   runs triggered by that token.
3. Populate `testSuiteStatus.run` from the gate's `workflow_run`, and wire the Recheck button.
4. Only then: let `canProceed` gate the tester's Approve.
