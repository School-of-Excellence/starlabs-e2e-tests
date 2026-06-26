# Plan — Promotion-chain architecture (feature → development → production)

**Date:** 2026-06-24
**Repo:** starlabs-e2e-tests (console)
**Status:** LOCKED (decided interactively 2026-06-24). Supersedes the feature→prod topology.
**Companion journal:** specs/journals/2026-06-24-promotion-chain.md

---

## Why this exists (the problem)

The original console cut **both** PRs from the feature branch:
`feature → development` AND `feature → production` (see [firebase.service.ts] `createPrToProd`,
and the v2 build). Because a GitHub PR is a **living pointer to its head ref** (not a snapshot),
a push to the feature branch advances the head of *every* open PR cut from it. Consequences:

1. **Contamination** — a push during an open prod PR silently adds unreviewed code to what merges.
2. **Test ≠ ship** — prod sign-off validated the *development* deploy, but the prod PR shipped the
   *feature* in isolation → production could receive never-integrated combinations.
3. **No parallelism** — you could not "continue a prod release AND keep working/previewing" on the
   same branch, because both share one moving head.

These surfaced as the `⚠ NEEDS_DECISION` reconcile churn on feature cards.

## The decision

Adopt a **batch promotion chain**, with two decoupled lanes:

```
feature/* ──(PR → development)──► development ──(PR → production)──► production
   per-feature dev lane               deploys                  deploys
   (preview → QA → PR → merge)       starlabs-test             fir-sample
```

- **Feature branches never touch production.** Their flow ends at `DEV_MERGED`.
- **Production is fed only from `development`** via a `development → production` PR. Its head is
  `development`, so feature pushes can never contaminate an in-flight promotion. This is the
  one-line root-cause fix (`head: 'development'`, not `head: branch`).
- **Console never merges** (decision D3 preserved). It issues PR-create *intents*; humans
  accept/deny on GitHub/CLI; the **webhook mirrors** the result back. Accept/Deny in the UI is a
  *status mirror*, not an action.
- **Promotion drift = "latest development wins"** — no re-validation gate; the promotion PR ships
  whatever `development` holds at merge time (chosen trade-off for speed).

### Rejected alternatives
- **Keep feature→prod** — root cause of contamination + test≠ship. Rejected.
- **Method B (per-feature frozen release ref)** — preserves per-feature prod but needs release-ref
  automation; rejected because releases here are periodic batches.
- **Method C (freeze feature branch during prod PR)** — gives no same-branch parallelism. Rejected.
- **Console performs the merge** — considered (single control surface) but rejected to preserve D3;
  humans still merge on GitHub, console mirrors via webhook.

---

## Target model

### Three entry types in Working Branches

| Entry | Source | Shows | Action |
|---|---|---|---|
| **Feature** (`feature/*`) | per-branch candidate, prod facets unused | preview / dev-gate / PR→dev badges, test report, dev-lane guidance | Deploy Preview · Create PR → dev |
| **Development** | the `development` candidate (un-hidden) | every incoming `feature→development` PR + each PR's test report + accept/deny status (webhook-mirrored) | **Create PR → prod** only |
| **Production** | the `production` candidate (un-hidden) | the incoming `development→production` PR + its report + status | none (terminal) |

### Feature lifecycle (unchanged dev lane; prod lane removed)
`NO_ACTION → PREVIEW_* → OK_FOR_DEV → PR_TO_DEV → DEV_MERGED` (terminal).
QA sign-off gate before Create-PR-to-dev is **kept**. New commits re-validate (existing freshness
logic = "reiterate"). The peer who reviews/merges the PR does so on GitHub; the result mirrors back.

### Promotion lifecycle (on the `development` candidate)
`development has unreleased commits → Create PR → production → PR_TO_PROD → (merged on GitHub) → PROD_MERGED`.
Initiated from the Development entry with `head='development'`, `base='production'`. No prod QA gate
button (only Create-PR-to-prod, per the locked UI); gated by the `CREATE_PR_PROD` capability.

---

## Change set

**Frontend (mock-verifiable now):**
1. `action-gating.ts` — feature cards expose only `deployPreview` + `createPrToDev`. `createPrToProd`
   becomes the Development-entry promotion action (allowed from the dev candidate's ready state).
2. `mock-data.ts` — cap feature fixtures at `DEV_MERGED`; add a `development` candidate (holds the
   open `development→production` promotion PR) and a `production` candidate (mirrors it).
3. `working-branches.component.*` — split rendering into Feature / Development / Production sections.
4. `firebase.service.ts` — `createPrToProd` sends `{ repo, head: 'development', base: 'production' }`.

**Backend (live-wiring follow-up, tsc-verified):**
5. `createPullRequest` precondition for `base==='production'` keys off the `development` candidate
   (status ready) instead of the feature's `prDev MERGED`.
6. `projection.ts` — feature projection tops at `DEV_MERGED`; the prod lane projects on the
   `development` candidate. Promotion skips the stale-sign-off drift rule ("latest wins").

**Preserved:** auth/roles, QA dev sign-off, preview flow, webhook mirroring, no-merge stance.

## Verification
- `ng build` + `functions` tsc green.
- Mock-mode dev server: Feature cards (dev-lane only), a Development entry listing incoming PRs +
  reports + a Create-PR-to-prod button, a Production entry showing the promotion PR.
