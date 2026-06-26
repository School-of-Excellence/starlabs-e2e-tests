# Test Report — Promotion-chain console (mock environment)

**Date:** 2026-06-25
**Scope:** Verify the full feature→development→production workflow, role separation, the tester
promotion gate, and head-aware auto-iterate work AS PLANNED. Find bugs/loopholes, fix, re-test.
**Method:** Driven through the running mock dev server (real UI clicks via the browser) for the
console-controlled flow + role impersonation; backend-derivation logic (which the mock UI can't
drive — projection, promotable) unit-tested against the compiled `functions/lib`.
**Result:** ✅ All 19 checks pass (10 UI + 9 backend). 2 bugs + 1 gap found and fixed. Zero console errors.

---

## Bugs / loopholes found & fixed during testing

| # | Finding | Fix |
|---|---|---|
| B1 | **Mock couldn't exercise the promotion gate** — `applyGate('prod')` never set `promotable`, and previews never left `BUILDING`. The mock was un-faithful to the backend, so the key flow was untestable. | Mock now simulates CI (BUILDING→LIVE) and derives `promotable` on prod sign-off, mirroring backend `computePromotable`. |
| B2 | **Misleading disabled reason** — Create PR → prod, when blocked awaiting the tester, showed *"Waiting for the development deploy to finish"* even though the deploy was already **deployed** (text keyed off the dropped `hasUnreleased` flag). | Reason now: *"Awaiting tester validation of the dev deploy (Preview Channels)."* |
| G1 | **"View log" button missing** on the Development/Production entries (operator-flagged earlier). | Added the activity-log button to both env entries; drawer opens for the `development` branch. |

---

## UI tests (mock, real browser clicks)

| # | Test | Evidence | Result |
|---|---|---|---|
| T1 | Deploy preview: `NO_ACTION → BUILDING → LIVE` | voice-search: No action → Preview building → Preview live | ✅ |
| T2 | Tester signs off live preview → `OK_FOR_DEV` | dev gate NONE → click "OK for dev" → OK; status OK for dev | ✅ |
| T3 | Developer opens PR → dev → `PR_TO_DEV` | PR opened; trail "Preview live › OK for dev › PR → dev" | ✅ |
| T4 | Create PR → prod **disabled before tester validation** | disabled, reason "Awaiting tester validation…" | ✅ |
| T5 | Tester "OK to promote" → **Create PR → prod ENABLES** | promotable→true; button enabled; "ready to promote" | ✅ |
| T6 | Developer opens PR → prod → `PR_TO_PROD` | prProd #… OPEN; status PR → prod | ✅ |
| T7 | Role separation — tester blocked from deploy & promote; developer/admin allowed | tester: "Your role does not grant this action" on both | ✅ |
| T8 | Preview Channels sign-off gating — developer blocked, tester/admin allowed | developer: "Your role does not grant dev sign-off"; tester/admin enabled | ✅ |
| T9 | **Loophole:** rejected validation ("Hold") must NOT unlock promotion | prodGate REJECTED → Create PR → prod stays disabled | ✅ |
| T10 | Production removed from Preview Channels (operator request) | env section lists `development` only | ✅ |
| (L) | **Loophole:** Create PR → dev blocked without a tester sign-off | PREVIEW_LIVE (unsigned) → disabled, "after a tester signs off for dev" | ✅ |

## Backend logic unit tests (compiled `functions/lib`)

| # | Test | Result |
|---|---|---|
| B1 | push @ DEV_MERGED → status drops to PREVIEW_LIVE (auto-iterate) | ✅ |
| B2 | push @ PROD_MERGED (legacy, no facet shas) → drops to PREVIEW_LIVE | ✅ |
| B3 | fresh DEV_MERGED (covers head) stays DEV_MERGED (no false drop) | ✅ |
| B4 | fresh PROD_MERGED (covers head) stays PROD_MERGED | ✅ |
| B5 | promotable: deploy success + tester OK → true | ✅ |
| B6 | promotable: deploy success, no tester OK → false | ✅ |
| B7 | promotable: tester REJECTED → false | ✅ |
| B8 | promotable: tester OK but not deployed → false | ✅ |
| B9 | promotable: feature candidate (no deploy/gate) → false | ✅ |

---

## What the mock CANNOT exercise (covered by unit tests instead)
- GitHub-side events: PR **merges** (PR_TO_DEV→DEV_MERGED, PR_TO_PROD→PROD_MERGED) and the
  **dev/prod deploys** — these are webhook-driven; the console never merges. Their effect on facets
  + the resulting projection/promotable is unit-tested (B1–B9) against the compiled functions.
- True multi-user concurrency on the SAME branch (one browser session). Different-branch parallelism
  is isolated by design; same-branch write-race remains the one open hardening item (Firestore
  transaction on `mutateCandidate`).

## Round 2 (2026-06-25) — broader scenarios, incl. DIRECT PUSH to development

Operator reported: pushed directly to `development` (no feature PR), dev deploy succeeded, but the
tester had **no "OK to promote" button**. Re-ran with all-paths coverage.

**Bug B3 (root cause):** `handleDeploymentStatus` skipped protected branches
(`isProtected(branch) → return false`). So a development deploy signalled via `deployment_status`
(rather than a tracked `workflow_run`) was discarded → the dev candidate had no
`lastDeploymentState: 'success'` → the env card showed "Waiting for the deploy" → no promote button.
**Fix:** record deploy state for ALL branches incl. development/production, and reset the prior
tester validation on a new successful dev deploy. Now the dev deploy surfaces regardless of which
signal GitHub emits, and regardless of whether code arrived via a feature PR or a direct push.

**Env-deploy gating matrix (Preview Channels, live component logic):**
| Dev candidate state | Promote sign-off |
|---|---|
| no deploy / in_progress / failed | hidden ("Waiting for the deploy…") ✅ |
| **deployed, not validated (direct push)** | **BUTTON SHOWN** ✅ |
| deployed + already OK | hidden ("Validated for the current deploy") ✅ |
| deployed + REJECTED | shown (re-validate) ✅ |

**Promote-button matrix (Working Branches, live component logic):**
| Dev candidate state | Create PR → prod |
|---|---|
| direct-push deployed, NOT validated | disabled ("Awaiting tester validation") ✅ |
| **deployed + tester OK (direct push)** | **ENABLED** ✅ (no feature PR / hasUnreleased needed) |
| deployed + OK but prod PR already open | disabled ("already open") ✅ |
| tester REJECTED | disabled ("Awaiting tester validation") ✅ |
| not deployed yet | disabled ("Waiting for the development deploy") ✅ |

All pass; no console errors. functions `tsc` + `ng build` green.

## Verdict
The promotion-chain is implemented as planned and behaves correctly under test: feature dev-lane,
the tester-gated promotion (deploy → tester OK → Create PR → prod), role separation, auto-iterate,
and the negative/loophole cases all hold. `ng build` + functions `tsc` green; no console errors.
Live confirmation still requires deploying functions+hosting and running one real merge/deploy cycle.
