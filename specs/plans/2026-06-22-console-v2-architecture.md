# Plan — Release Console v2 (architecture lock)

> **Status:** LOCKED (2026-06-22). This plan SUPERSEDES the original Phase 1A
> scaffold design and the Angular repo's `Journal/2026-06-18-phase-1A-console-plan.md`.
> A future session must read THIS before proposing alternatives.
>
> WHAT changed vs the scaffold: the console no longer merges; status is no longer a
> single linear enum; roles replace flat allowlists; an activity log + reconciliation
> engine replaces "the board can't drift" optimism. WHY each landed is in the
> Decision Ledger below.

---

## 0. Context

The console is the team's single pane over the School-of-Excellence release pipeline
(repos: `starlabs-angular`, `starlabs-cloud-function`, `breakthroughs-flutter`,
hub `starlabs-e2e-tests`). It mirrors GitHub and layers the human workflow on top.

The original scaffold (`console/`, `console/functions/`) modelled a candidate as a
single linear `status` enum and made the console the **merge authority** (an
`approveAndMerge` callable that merged AS the GitHub App, to "stay on Free"). Across
the 2026-06-22 architecture sessions the operator redesigned the product. This plan
records the locked result.

---

## 1. Decision Ledger (the WHY)

| # | Decision | Why it landed |
|---|---|---|
| D1 | **Roles**: developer / tester / admin, **additive** (a user = union of their roles). | One person is often dev+tester on a small team; exclusive roles would block real work. |
| D2 | **Login gate**: `soexcellence.com` domain **AND** active member **AND** role load — enforced in UI, callables, **and Firestore Rules**. | The scaffold let any Google user in; only the merge button was gated. "Only approved users can log in" was not actually true. Rules are the real fence; UI is decoration. |
| D3 | **Console NEVER merges.** Developers merge on GitHub. `approveAndMerge` + `approvers` allowlist **removed**. | A blind app-merge cannot resolve conflicts or review the final diff. The human who owns the code must own the merge. |
| D4 | **Two tester gates**: preview→dev (`OK_FOR_DEV`) and dev→prod (`OK_FOR_PROD`). | The operator's flow needs a sign-off before dev AND before prod. The scaffold had only one manual gate; nothing guarded the prod PR. |
| D5 | **Preview deploy is a MANUAL button** → GitHub `workflow_dispatch`. `preview.yml` push trigger DISABLED. | Operator wants explicit control of when a preview burns a channel; auto-on-push contradicts that and wastes channels. |
| D6 | **Candidate = parallel FACETS** (`preview`, `devGate`, `prDev`, `prodGate`, `prProd`) + `headSha`, not one linear status. | A branch can be "PR open" AND "new preview pending re-test" at the same time. One enum cannot express two simultaneous truths. |
| D7 | **Activity log = single FLAT collection**, queried by `branchId`. Not a subcollection. | Operator preference; simpler queries, one place to read/filter the whole timeline. |
| D8 | **Status is DERIVED from the log.** Two clocks on the doc: `derivedStatus` + `lastActivity` + `reconcile`. On mismatch a human decides; the decision is itself logged. | Once merge moved to GitHub (D3), the console no longer controls the whole world. The honest way to track a world you don't fully control is: log events, derive state, surface unreconcilable drift to a human. |
| D9 | **Reliability primitives required**: order by event-time, dedupe by delivery-id, reconcile poll to heal missed webhooks. | GitHub webhooks are at-least-once, unordered, and droppable. Without these the log lies after any hiccup (false ANOMALIES, double counts, stuck status). |
| D10 | Deploy/preview signals via **`workflow_run`** (automatic on the App subscription) + **deterministic preview URL**. No `deployment_status` change to `deploy_19.yml`. | `workflow_run` + computed URL already give PREVIEW_LIVE/FAILED and dev/prod deploy health. Cheapest path; zero Angular deploy-workflow change. |
| D11 | **Branch protection PAUSED** (free plan). Interim guard = reconciliation + loud warnings + written team policy. Add strict protection on upgrade to paid. | Branch protection on PRIVATE repos needs a paid GitHub plan — the very cost the old console-merge design avoided. Deferred until upgrade; the console makes violations visible meanwhile. |
| D12 | **Angular changes** = `preview.yml` (disable push trigger) + `queue-e2e.yml` (cutover `cicd-*` → `development`/`production` at go-live). **No app source changes.** | The Angular repo only needs to expose the right CI hooks; the product logic lives in the console. |

---

## 2. Access model — roles → capabilities → gates

Gate **capabilities** on roles; gate **actions** on capability AND workflow-state AND
freshness. Four checks, all must pass, else the button is disabled WITH a reason.

```
 CAPABILITY              │ developer │ tester │ admin │ notes
 ────────────────────────┼───────────┼────────┼───────┤
 view everything         │     ✓     │   ✓    │   ✓   │ Overview = all roles
 DEPLOY_PREVIEW (button) │     ✓     │   ·    │   ✓   │ → workflow_dispatch
 SIGNOFF_PREVIEW→DEV     │     ·     │   ✓    │   ✓   │ tester "OK for dev"
 SIGNOFF_DEV→PROD        │     ·     │   ✓    │   ✓   │ tester "safe for prod"
 CREATE_PR_DEV           │     ✓     │   ·    │   ✓   │ after OK_FOR_DEV + fresh
 CREATE_PR_PROD          │     ✓     │   ·    │   ✓   │ after DEV_MERGED + OK_FOR_PROD
 MANAGE_MEMBERS          │     ·     │   ·    │   ✓   │ Settings
 merge                   │  on GitHub, not a console capability (D3)
```

Login gate (D2):
```
 Google popup (hd=soexcellence.com)
   → [1] email domain == soexcellence.com   else reject
   → [2] members/{email}.active == true      else reject
   → [3] load roles → render nav for the union of capabilities
 Firestore Rules enforce [1]+[2] on every read/write independently.
```

---

## 3. Data model (Firestore on `starlabs-cicd`)

### 3.1 `release-candidates/{repo__branch}` — facet model (D6)
```
 repo, branch, headSha, headCommit{ msg, author, at }
 preview:  { sha, url, buildState: NONE|BUILDING|LIVE|FAILED, builtAt }
 devGate:  { verdict: NONE|OK|REJECTED, sha, by, at, notes }
 prDev:    { number, url, state: NONE|OPEN|MERGED|CLOSED, headSha, mergeable, checksState }
 prodGate: { verdict: NONE|OK|REJECTED, sha, by, at, notes }
 prProd:   { number, url, state, headSha, mergeable, checksState }
 testSummary: { conclusion, passed, failed, total, at }   // for Overview (D10)
 derivedStatus: <milestone>          // derived from the log (D8)
 lastActivity:  { type, sha, actor, at }
 reconcile:     IN_SYNC | DRIFT_BENIGN | NEEDS_DECISION | ANOMALY
 updatedAt
 // computed in UI, NOT stored: previewStale, signoffStale, prHasUnreviewed
```

### 3.2 `activity-log/{deliveryId}` — flat collection (D7)
```
 branchId (= repo__branch)   // query key
 type      // push | preview_build | signoff_dev | signoff_prod | pr_to_dev |
           // pr_to_prod | dev_merged | prod_merged | reconcile_decision | ...
 sha, actor
 source    // webhook | console | reconcile
 confirmed // false for optimistic console intents until webhook confirms (risk #5)
 eventTime // GitHub's timestamp — ORDER BY THIS, not arrival (D9)
 receivedTime
 raw       // original payload (trimmed)
```
- Doc id = GitHub `X-GitHub-Delivery` (idempotent — dedupe, D9 / risk #2).

### 3.3 `console-config/members/{email}` — role source (D1)
```
 email, displayName, roles: string[], active: bool, addedBy, addedAt
```
- A Firestore `onWrite(members)` trigger recomputes the legacy `console-config/allowlists`
  doc so any retained allowlist-shaped reads keep working during migration.

---

## 4. Lifecycle (derived milestones)

```
 push → NO_ACTION
   dev [Deploy preview] → PREVIEW_BUILDING → PREVIEW_LIVE  (FAILED↺)
   tester OK for dev    → OK_FOR_DEV
   dev [Create PR→dev]  → PR_TO_DEV    → (dev merges on GitHub) → DEV_MERGED  → deploy starlabs-test
   tester safe for prod → OK_FOR_PROD
   dev [Create PR→prod] → PR_TO_PROD   → (dev merges on GitHub) → PROD_MERGED → deploy fir-sample-aae4a
 any new commit at any stage → raise STALE (sha compare); never silently regress
```

Milestone ranks (for the projection): NO_ACTION 0, PREVIEW_LIVE 1, OK_FOR_DEV 2,
PR_TO_DEV 3, DEV_MERGED 4, OK_FOR_PROD 5, PR_TO_PROD 6, PROD_MERGED 7.
Projection rule: legal transition → advance + IN_SYNC; same-stage content change →
keep status + DRIFT_BENIGN/NEEDS_DECISION; illegal/skip-ahead event → DO NOT advance,
set ANOMALY, ask a human.

---

## 5. Reconciliation taxonomy (D8) — the heart of "let the user decide"

```
 reconcile        │ meaning                                  │ console does
 ─────────────────┼──────────────────────────────────────────┼──────────────
 IN_SYNC          │ lastActivity = expected next of status    │ nothing (green)
 DRIFT_BENIGN     │ new content, gates intact (e.g. push      │ info banner
                  │ before any sign-off)                      │
 NEEDS_DECISION   │ content moved PAST a sign-off/PR (open    │ ⚠ + decision UI
                  │ PR now contains unreviewed code)          │
 ANOMALY          │ event SKIPS required milestones (e.g.     │ 🔴 + decision UI
                  │ deploy_to_dev with no tracked PR/merge —  │ + audit flag
                  │ out-of-band GitHub merge, expected w/ D3) │
```
Developer decisions: Re-request QA (re-open tester gate) · Close PR & restart ·
Accept/override (records reason) · Investigate. Each decision is appended to the
activity log as `reconcile_decision`.

### Risk register (must build mitigations, D9)
1. 🔴 Webhook ordering — order by `eventTime`, not arrival.
2. 🔴 Duplicate delivery — dedupe by delivery-id (= doc id).
3. 🔴 Missed events — reconcile poll against GitHub API to backfill; heartbeat.
4. 🟠 Log size — flat collection (D7), not array-in-doc.
5. 🟠 Intent vs fact — `source` + `confirmed:false` until webhook confirms.
6. 🟠 SoT contention — GitHub-confirmed events WIN over console intents.
7. 🟡 Projection determinism — pure replay ordered by eventTime + explicit ranks.
8. 🟡 Decision races — optimistic concurrency (decision carries baseline log length).
9. 🟡 Alert fatigue — only NEEDS_DECISION/ANOMALY prompt; benign = silent.

---

## 6. Screens

1. **Overview** (all roles, read-only) — NASA mission-control: counts (branches,
   previews live, PRs open, stale, tests pass/fail 24h), pipeline funnel, live
   activity feed, deploy health. Widgets deep-link to filtered screens.
2. **Working Branches** (view all; act = dev/admin) — list sorted by last commit;
   facet badges; mergeability/checks for open PRs; Deploy preview / Create PR / Redeploy
   buttons gated by capability+state+freshness; reconciliation prompts.
3. **Preview Channels** (dev + tester) — two gates on one screen: DEV gate (validate
   preview channel) and PROD gate (validate development deploy). Tester OK/Has-issues
   + notes; re-opens automatically on new commit.
4. **Settings** (admin) — manage members + roles (→ `setMember` callable).

Shared filter bar on all list screens: repo · status · environment · staleness · mine-only · search.

---

## 7. Backend (Cloud Functions on `starlabs-cicd`)

- `webhookReceiver` — verify HMAC; dedupe by delivery-id; append to `activity-log`;
  recompute facets + projection on the candidate. Handle: push (update headSha),
  pull_request incl **synchronize** (update prDev/prProd headSha + mergeability),
  workflow_run (preview build state, deploy health, testSummary). NEW vs scaffold:
  handle `synchronize`; stop no-op'ing feature pushes.
- `deployPreview` (NEW) — guard (DEPLOY_PREVIEW) → `actions.createWorkflowDispatch`
  on `preview.yml`.
- `signoff` (replaces setOkToRelease) — guard (SIGNOFF_* by stage) → write devGate/prodGate.
- `createPullRequest` — guard (capability) **+ server-side state check** (D-flow): only
  `OK_FOR_DEV`→dev, only `DEV_MERGED`+`OK_FOR_PROD`→prod. Creates PR as the App; dev merges later on GitHub.
- `setMember` (NEW) — admin guard → write members; trigger recomputes allowlists.
- **REMOVED**: `approveAndMerge` (D3).
- `reconcilePoll` (NEW, scheduled) — backfill missed events (D9 / risk #3).

---

## 8. Build sequence (when implementation starts)

1. **Login gate + Firestore Rules + members model** (D1, D2) — nothing is safe without it.
2. **Activity-log collection + reliability primitives** (D7, D9) — order/dedupe/poll.
3. **Facet model + projection + reconciliation taxonomy** (D6, D8).
4. **Backend callables**: deployPreview, signoff(stage), createPullRequest(+state check),
   setMember; remove approveAndMerge; webhookReceiver rewrite (synchronize, no-op fix).
5. **Screens**: Overview, Working Branches, Preview Channels, Settings + shared filters.
6. **Angular repo changes** (see companion plan) — preview.yml dispatch, queue-e2e cutover.
7. **Operator items** (below).

---

## 9. Operator-only / deferred items

- GitHub App: subscribe to push, pull_request (incl synchronize), workflow_run
  (deployment_status optional/skipped per D10). Install on all 4 repos.
- Firestore on `starlabs-cicd`: seed `console-config/members`, deploy security rules,
  deploy composite indexes for the board + activity-log queries.
- **Branch protection: PAUSED (D11)** — enable strict rules on `development`/`production`
  (require gate + dismiss stale approvals) AFTER upgrade to a paid GitHub plan.
- `cicd-audit` read access for the console (testSummary / report links).

---

## 10. Open follow-ups (not blocking)

- Notifications (Slack/email) on gate transitions — currently pull-only.
- Self-sign-off policy: a tester who is also the pushing dev — allow but flag, or block?
  (Leaning: allow, flag in the activity log.)
- Preview channel 7-day expiry surfacing in the UI.
