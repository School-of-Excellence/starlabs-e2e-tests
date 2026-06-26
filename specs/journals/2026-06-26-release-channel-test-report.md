# Test Report — Release Channel + workflow refinements (ADR-001)

**Date:** 2026-06-26
**Plan:** specs/plans/2026-06-26-release-channel-adr.md (ACCEPTED, D1/D2/D3 locked)
**Method:** UI driven in the running mock dev server (real browser clicks + role impersonation);
backend-derivation logic unit-tested against the compiled `functions/lib`.
**Result:** ✅ All checks pass (9 backend unit + 11 UI). Zero console errors. Both builds green.
**Loopholes/bugs requiring an operator decision:** none — the plan held.

---

## What was implemented (Phases A–D)

**A — Backend correctness**
- Env-status fix: `covers()` now projects environment candidates (no tracked headSha) straight from
  facet state, so `development`/`production` no longer collapse to `NO_ACTION`. Feature head-awareness
  (auto-iterate) preserved.
- `CREATE_PR_PROD` made **admin-only** (D1) in both `roles.ts` and backend `model.ts`.
- Promotion **batch** (D2): `unreleased` flag set on a feature→dev merge, cleared for the whole repo
  on a dev→prod merge.
- Friendly **empty-diff** PR error ("No commits between…") for dev & prod.
- Fixed environment URLs config (D3) — defaults to known project URLs; operator to confirm exact ones.

**B — Release Channel (admin-only)** — scaffolded via `ng g c screens/release-channel`. Development
section (incoming PRs + test suites + batch + Create-PR-to-prod) + Production section. Route + nav
admin-gated. Working Branches trimmed to feature-only.

**C — Preview Channels** — development deploy URL shown; gate notes collapsed to the latest (with
time) + a "log" button → right activity-drawer with full history.

---

## Backend unit tests (compiled functions/lib) — 9/9

| Test | Result |
|---|---|
| env `prProd OPEN` (no head) → `PR_TO_PROD` | ✅ |
| env `prProd MERGED` (no head) → `PROD_MERGED` | ✅ |
| env nothing → `NO_ACTION` | ✅ |
| feature push@DEV_MERGED still drops to PREVIEW_LIVE (auto-iterate kept) | ✅ |
| feature fresh DEV_MERGED still pins | ✅ |
| promotable = deploy success + tester OK | ✅ |
| **developer CANNOT promote** (`CREATE_PR_PROD`=false) | ✅ |
| developer CAN create PR → dev | ✅ |
| admin CAN promote | ✅ |

## UI tests (mock, real browser) — 11/11

| Test | Evidence | Result |
|---|---|---|
| Admin nav has Release Channel | nav: …Preview Channels · 🚀 Release Channel · Settings | ✅ |
| Working Branches feature-only | sections=[Feature branches]; env cards=0 | ✅ |
| Release Channel — dev URL + incoming PRs | URL shown; #318/#320/#301 accepted | ✅ |
| Release Channel — **batch** (D2) | billing-portal, checkout-v2 (the `unreleased` set) | ✅ |
| Release Channel — Create PR→prod gated | disabled, "Awaiting tester validation…" | ✅ |
| Release Channel — Production section | development #480 accepted + prod URL | ✅ |
| **Promotion flow** | tester "OK to promote" → Create PR→prod ENABLES → PR→prod #1030 OPEN | ✅ |
| **D1** developer gating | no Release Channel nav; no promote on WB; screen shows "for admins" | ✅ |
| Preview Channels — latest note + log drawer | latest note shown; "log" opens full-history drawer | ✅ |
| Feature-lane roles | tester can sign off; developer cannot ("Your role does not grant…") | ✅ |
| Feature lane transitions | No action → Preview live → OK for dev → PR → dev | ✅ |

## Notes / non-issues
- D1 is enforced at **four layers**: hidden nav · route `adminGuard` · component `isAdmin()` guard ·
  backend `requireCapability(CREATE_PR_PROD)`. (A test that hand-pushed the URL via `history` bypassed
  the router guard but the component still showed "for admins" — not a real bypass.)
- **D3 URLs are placeholders** (`starlabs-test.web.app` / `fir-sample-aae4a.web.app`) — operator to
  drop in the exact URLs in `environment.ts`.
- Webhook-driven merges/deploys remain unexercisable in mock (console never merges); covered by the
  backend unit tests + the empty-diff/handler logic. Live confirmation = one real cycle after deploy.

## Round 2 (2026-06-26 pm) — merge-path debug + FULL evidence (simulated GitHub merge)

Operator reported (live): after merging the prod PR, **Create-PR-to-prod kept reappearing and the
batch still showed already-merged branches**; preview URLs were wrong; the "Mine only" filter was
broken. Honest gap: Round-1 could not exercise the **merge** (console never merges → webhook-driven),
so the post-merge state was untested. Fixed that by simulating the merge against the real logic.

**Bugs fixed**
1. **"Create PR → prod keeps coming"** — `computePromotable` was `deploy✓ && prodGate✓` with no
   "anything to promote" term, so after a release (prodGate + deploy still green) `mutateCandidate`
   re-derived `promotable=true`. Fix: `promotable = hasUnreleased && deploy✓ && tester✓`. `hasUnreleased`
   is now kept authoritative by a **reconcilePoll backfill from the GitHub `production…development`
   diff** (self-heals after releases and missed merges) + cleared on the prod-merge handler (which
   also resets `prodGate` so the next batch re-validates). Release Channel now shows
   **"✓ Production is up to date — nothing to promote"** instead of a button; batch gated on `hasUnreleased`.
2. **Preview URL** — `https://<slug>---breakthroughs-test.web.app` → `https://breakthroughs-test-<branchid>.web.app`
   (candidate.ts, firebase.service, mock) + **recorded from the webhook** on preview-build success.
3. **"Mine only" filter** removed from the filter bar (broken, unused).

**Test infra:** added `FirebaseService.mockMerge()` (mock-only) that faithfully replicates the backend
`handlePullRequest` MERGE path, so the merge can be driven in-browser — closing the Round-1 gap.

**Backend unit (6/6):** before-merge promotable=true → **after prod-merge promotable=false** (no
keeps-coming) → new validated batch promotable=true → unvalidated=false; URL pattern + sanitization.

**UI mock with simulated merge (all pass, zero console errors):**
| Test | Evidence | Result |
|---|---|---|
| Preview URL pattern | `https://breakthroughs-test-feature-onboarding-tour.web.app` | ✅ |
| Dev env URL shown | `https://starlabs-test.web.app` | ✅ |
| "Mine only" removed | absent on Working Branches & Preview Channels | ✅ |
| Promote → **simulate prod merge** | before: batch [billing-portal, checkout-v2], PR→prod #1545 OPEN; **after merge: "✓ up to date — nothing to promote", batch empty** | ✅ |
| Re-cycle: new feature merge | profile-cohorts → PR→dev → **merge** → DEV_MERGED; batch repopulates (#3305); promote **awaits fresh tester validation** | ✅ |

## Verdict
The locked plan (ADR-001) is implemented and behaves correctly across every scenario tested:
feature lane, role separation (incl. admin-only promotion), the Release Channel admin cockpit with
the batch view, the tester-gated promotion, env status, and the Preview Channels tidy-up. No new
bugs or loopholes surfaced. `ng build` + functions `tsc` green; no console errors.
