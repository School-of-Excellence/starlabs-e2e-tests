# 2026-08-19 — Branch channels + suite alignment: change inventory & test cases

**What shipped:** a NEW flow that, on every push, publishes two hosting channels (dev + prod) and
reports whether the hub's suites actually cover the diff — running entirely beside the existing
console flow, which is untouched.

**Prime directive for testing:** the old flow must behave *exactly* as it did. Section 5 is not
optional — it is the point.

---

## 1. Change inventory

### `starlabs-angular`
| File | State | What |
|---|---|---|
| `.github/workflows/branch-channels.yml` | **NEW** | The whole new flow. Push-triggered (feature branches only) + manual. Two jobs: `suite-status` and `channels` (matrix dev/prod). |
| `.github/workflows/preview.yml` | **must be reverted** | Working-tree edits from an earlier iteration. `git restore` it — the old flow owns this file. |

### `starlabs-e2e-tests` (hub)
| File | State | What |
|---|---|---|
| `scripts/readiness/lib.cjs` | **NEW** | Pure checks: coverage classification, selector drift, element-level coverage, verdict. Glob semantics deliberately identical to `console/functions/src/suites.ts`. |
| `scripts/readiness/readiness.cjs` | **NEW** | CLI + CI entry. Emits human output, `$GITHUB_STEP_SUMMARY`, and a `payload` output for the ingest. |
| `scripts/readiness/readiness.test.cjs` | **NEW** | 57 unit tests, no deps/network/emulator. |
| `suites-manifest.json` | modified | Added `neutral` (docs never read as untested) and `fenced` (ATC — never automatable). Nothing existing changed. |
| `console/firebase.json` | modified | Added a second functions entry: `codebase: readiness`, `source: functions-readiness`. |
| `console/functions-readiness/**` | **NEW** | `recordBranchChannel` + `recordSuiteStatus`. Own codebase so a deploy here cannot touch the live receiver. |
| `console/src/app/core/release-candidate.model.ts` | modified | `PreviewStatusFacet`, `TestSuiteStatusFacet` + the two optional fields. |
| `console/src/app/core/mock-data.ts` | modified | Three fixtures: channels-live-but-suites-missing, prod-leg-failed, all-green. |
| `console/src/app/screens/working-branches/*` | modified | Badge row + display helpers. `@if`-guarded — invisible until the new flow reports. |

### Data model — two new fields, same collection, same doc
```
release-candidates/{repo}__{branch}
├── preview {…}          ← OLD FLOW ONLY, never written by the new flow
├── previewStatus        ← NEW: dev{status,url,project,site,deployedAt,expiresAt}, prod{…},
│                               sha, commitMsg, author, runId, runUrl, updatedAt
└── testSuiteStatus      ← NEW: state, canProceed, sha, checkedAt, runId, runUrl, suites[],
                                crossCutting, details{…}, run{…}, recheck{…}
```
Neither is read by `deriveStatus()` / `reconcileVerdict()`, so no status can move.

---

## 2. Run now — local, nothing deployed

**TC-1 · unit suite**
`node scripts/readiness/readiness.test.cjs` → **57 passed · 0 failed**, exit 0.

**TC-2 · every verdict, forced against the real app**
```bash
cd ~/Documents/starlabs-e2e-tests
node scripts/readiness/readiness.cjs --app app --base HEAD --files "src/app/queue system/x.component.ts"     # MATCHED, suite: queue
node scripts/readiness/readiness.cjs --app app --base HEAD --files "src/app/quiz/quiz.component.ts"           # CANNOT PROCEED — SUITES MISSING
node scripts/readiness/readiness.cjs --app app --base HEAD --files "src/app/ATC/atc.component.ts"             # NO AUTOMATED COVERAGE POSSIBLE
node scripts/readiness/readiness.cjs --app app --base HEAD --files "README.md"                                # NO APP CODE CHANGED
node scripts/readiness/readiness.cjs --app app --base HEAD --files "package.json"                             # cross-cutting → all 12 suites
```
Pass: each prints the stated verdict, and every blocked one names the offending file.

**TC-3 · regression — folder names with spaces**
`node scripts/readiness/readiness.cjs --app app --base HEAD~8 --head HEAD`
Pass: uncovered files print full paths (`src/app/Diagnostics Tool/…`), **7** uncovered — not 19.
*(This was a real bug: `--name-status` is tab-separated and whitespace-splitting shredded every
folder containing a space.)*

**TC-4 · drift detection**
Rename one `data-testid` in `src/app/queue system/dynamic-queue-manager-clone/*.html`, re-run TC-2's
first command. Pass: `TEST SUITES NEED UPDATE`, the selector named, the spec that uses it named.
**Revert the rename afterwards.**

**TC-5 · missing test cases**
Add `<button (click)="x()">Go</button>` and a `data-testid="brand-new-thing"` to a queue component.
Pass: `MISSING TEST CASES`, the new hook named, the hookless button counted. **Revert.**

**TC-6 · console builds**
```bash
cd ~/Documents/starlabs-e2e-tests/console && npx tsc --noEmit -p tsconfig.app.json && npx ng build --configuration production
cd functions-readiness && npx tsc --noEmit
```
Pass: all three exit 0. *(AOT build is the real template check — `tsc` alone does not catch template errors.)*

**TC-7 · UI in mock mode**
Set `useMock: true` in `src/environments/environment.ts`, `npx ng serve`, open Working Branches.
Pass: three cards show the new badge row — one with both channels green + `test suites: missing`,
one with a red prod channel, one all green with `test suites: passed · queue, appointments`.
Tooltips name the actual files. Cards without the fields look exactly as before. **Revert the flag.**

---

## 3. After deploying the readiness codebase

```bash
cd ~/Documents/starlabs-e2e-tests/console && firebase deploy --only functions:readiness --project starlabs-cicd
```

**TC-8 · happy path, both legs** — POST a dev channel then a prod channel for the same branch.
Pass: one doc, `previewStatus.dev` **and** `previewStatus.prod` both present (proves `set(merge)`
does not clobber the sibling leg), `preview.*` untouched, `updatedAt` unchanged.

**TC-9 · failed channel clears the stale link** — POST `status: FAILED` with no url for a leg that
previously succeeded. Pass: that leg's `url` becomes null; the other leg is unaffected.

**TC-10 · negative cases** — each must be rejected, nothing written:
| Input | Expect |
|---|---|
| wrong/absent bearer | `401 unauthorized` |
| `repo: "not-ours"` | `400 repo not allowed` |
| `url: "https://evil.example.com"` | `400 invalid channel url` |
| `url: "https://star-labs-feature-x.web.app"` (single dash — a *guessed* URL) | `400 invalid channel url` |
| `status: SUCCESS` with no url | `400 SUCCESS requires a url` |
| `state: "BANANA"` | `400 invalid state` |

**TC-11 · report before the push webhook** — POST for a branch with no candidate doc.
Pass: doc created with blank facets (`preview.buildState: NONE`, `derivedStatus: NO_ACTION`) plus the
new field; the console renders it without errors.

---

## 4. In CI

**TC-12 · dispatch on a scratch branch**
`gh workflow run branch-channels.yml -R School-of-Excellence/starlabs-angular -f ref=<branch>`
Pass: `suite-status` finishes in ~1 min with the verdict in the job summary; both channel jobs
publish; each summary shows its project/site and a real hashed URL.

**TC-13 · the prod channel really is production** — open the prod URL, devtools → Network.
Pass: Firestore traffic goes to `fir-sample-aae4a`. ⚠️ **Read-only visit — do not create data.**

**TC-14 · URL capture is never guessed** — compare the URL in the job summary against Firebase
console. Pass: identical, including the hash. A failed extraction fails the step loudly rather than
reporting a guess.

**TC-15 · prod leg failure is contained** — dispatch with `GOOGLE_SERVICE_PROD` temporarily unset.
Pass: prod job fails, **dev channel still publishes**, workflow conclusion stays `success`
(job-level `continue-on-error`), `previewStatus.prod.status: FAILED` with the dev leg green.

---

## 5. Regression — the old flow must be untouched ⚠️

**TC-16 · push does not move any status**
Push to a feature branch. Pass, on that card:
- `derivedStatus` still `NO_ACTION` · `preview.buildState` still `NONE`
- tester's **Approve for development** still disabled
- developer's **Deploy** still enabled
- new badge row present with both channel links

**TC-17 · the console ignores the new workflow**
Check the `webhookReceiver` logs after TC-16.
Pass: `workflow_run branch-channels.yml … — not a tracked lane`. This is the mechanism the whole
separation rests on: the console matches `preview.yml` / `deploy_19.yml` / names containing `e2e`,
and nothing else. **If this line is missing, stop — the flows are not isolated.**

**TC-18 · old flow end to end, unchanged**
Console → **Deploy** on the same branch. Pass: `preview.yml` runs, `preview.url` + `buildState: LIVE`
set as always, card advances to `PREVIEW_LIVE`, tester Approve enables, sign-off → PR → merge on
`cicd-dev` behaves exactly as before.

**TC-19 · both flows on one branch, no interference**
After TC-16 and TC-18: `preview.url` (old) and `previewStatus.dev.url` (new) both present and
**different channels**; neither overwrote the other.

**TC-20 · staleness badge**
Push twice quickly so `headSha` moves past the channels' commit.
Pass: `channels stale` badge appears with the built-from SHA in its tooltip.

---

## 6. Known gaps (not defects)

- A green verdict does **not** yet dispatch `preview-e2e.yml`. The verdict is reported; the run is
  not started. That hop belongs in `recordSuiteStatus`, which has the GitHub App available —
  `GITHUB_TOKEN` cannot do it, as GitHub suppresses workflow runs it triggers.
- `testSuiteStatus.run` and `.recheck` are modelled but not yet written by anything.
- Coverage is path- and selector-based: it proves *a suite exists and still matches*, not that your
  specific change is asserted on. The element-level checks narrow this; they do not close it.
- Current reality: **24 of 54** app folders covered, 2 fenced, **28 uncovered** — expect
  `SUITES_MISSING` often until that backlog shrinks.
