# 2026-07-02 — Session journal: test orchestration + CF rollout planning (locked)

**Status:** Planning session — NO code written. Produced the locked master plan:
[../plans/2026-07-02-test-orchestration-cf-rollout-architecture.md](../plans/2026-07-02-test-orchestration-cf-rollout-architecture.md)
and the parked Flutter plan:
[../plans/2026-07-02-flutter-rollout-plan.md](../plans/2026-07-02-flutter-rollout-plan.md).
**Author:** session (operator: appexperience@soexcellence.com).

## What this session did

Started from "integrate CF and Flutter into the console like Angular" and converged, over many
operator iterations, on a locked architecture for (a) Angular test orchestration (deploy with/without
tests, suite selection, CF-branch choice), (b) the CF rollout model (manual deploys + local gate +
CF Board), (c) the suites manifest + one-way Firestore mirror, and (d) multi-suite extensions to the
already-locked in-console report plan. Flutter was planned and parked for a parallel session.

## WHY each big decision landed (read before proposing alternatives)

- **CF has NO console deploy button and NO PR-time CI gate.** The operator described the real CF
  workflow: devs change Angular+CF together, deploy CF to `starlabs-test` FIRST, test locally, THEN
  push. Forcing CI-driven deploys or PR gates would fight that. The only CF quality gate is the
  **local predeploy Playwright guard** (replacing `predeploy-check.js`) — it runs at the exact moment
  that matters (before code reaches a shared project) and the Firebase CLI enforces it (`--force`
  cannot skip predeploy).
  > Process note: an earlier draft of the flow added a `cf-e2e.yml` gate on the CF PR. The operator
  > caught it as an unrequested improvisation ("stick with what we discussed") — removed. Same
  > lesson as `confirm-before-improvising` (memory).
- **CF predeploy v1 = one generic no-retrigger-loop guard** (operator: "only one for now"). Seeds
  each Firestore-trigger path (from `functions-manifest.json`), asserts bounded invocations.
  Threshold-based, NOT zero-tolerance: one legitimate self-write (set-flag-then-guard) is a valid
  pattern; the disaster is unbounded growth (quota/billing burn). Manifest-driven ⇒ zero per-function
  test authoring.
- **CF deploy visibility via postdeploy hook (primary) + CF-Admin-API poll (healer).** The operator's
  key constraint: "sometimes the CF is deployed but the code is not pushed." Any git-anchored signal
  (webhooks, workflow_run) misses a manual laptop deploy entirely. The `firebase.json` postdeploy
  hook fires on EVERY deploy, manual or CI. `reconcilePoll` reading the deployed functions from both
  projects self-heals anything that skips the hook. GitHub `workflow_run` kept only as a free bonus.
- **Per-function matrix (CF Board), not per-repo flags.** The operator's requirement is literally
  "at any given moment I need to know all the CF — are they deployed in both or only one." Rows =
  functions, columns = Dev (`starlabs-test`) / Prod (`fir-sample-aae4a`), plus DRIFT (dev sha ≠ prod
  sha) and ORPHANED (deployed but deleted from code) honesty badges. CF Board has **no report links**
  — its gate runs on the laptop, never in CI, so there is no cicd-audit record to show.
- **Δfunctions is an approximation (`~N`).** GitHub diffs files, not functions. File-diff mapped via
  a committed `functions-manifest.json` (name/type/file, regenerated inside predeploy + a freshness
  CI check). Clicking `~N` expands names + trigger types + New/Updated — honest, not audit-grade.
- **`createPullRequest` precondition is repo-type-aware.** The existing server fence requires
  `OK_FOR_DEV` + fresh sign-off — correct for Angular, wrong for CF (no tester-gate stage exists in
  the CF flow). CF-type repos: pushed + not merged, nothing else. Explicitly operator-approved (this
  relaxes an agreed server fence, so it was surfaced, not slipped in).
- **Suites manifest in hub git, mirrored ONE-WAY to Firestore, console read-only.** The operator
  asked to compare "file in hub" vs "store in starlabs-cicd + HTTP trigger for CI." Decisive point:
  most manifest data is CODE-COUPLED (spec dirs, config filenames, path globs) — putting it in a DB
  detaches it from the tree it describes (the exact drift class this console exists to kill), and a
  hub feature branch couldn't carry its own routing. But Firestore IS the right read surface for the
  console. Synthesis = the same pattern the console already lives by: git is truth, Firestore
  mirrors. Mirror is push-on-merge (hub workflow → `recordSuitesManifest` ingest, token-auth), not
  CI-pull-per-run — fewer moving parts on the hot path.
- **The per-run suite list is TRANSPORT, not state.** It travels as a JSON-array `workflow_dispatch`
  input (`fromJson` → matrix) and is audited in `activity-log`. Nothing to store; the operator's
  "where is the CSV stored" dissolved once this was explicit (and CSV → JSON array).
- **Dialog shows locked suites WITH the reason** (which glob matched). `planTestRun` computes the
  mandatory set server-side from `compare(development...branch)` + the manifest — the same data CI
  uses, so dialog and CI can never disagree. That answers "how does the user know upfront."
- **`preview-e2e.yml` EVOLVES, is not replaced.** Grounding in the 2026-06-29 journal showed it
  already does dispatch-on-deploy + dorny path-routing + area subsets + always-run baseline. The
  embedded area→spec map (flagged there as a keep-in-sync liability) moves INTO the manifest
  (`areas`, `alwaysRun`); explicit `suites` input takes precedence; dorny routing stays as the
  fallback for non-console triggers.
- **Angular ref is never selectable** — always the card's own branch (operator correction to an
  earlier draft that implied choosing it). Only the CF source (repo + branch, default `development`)
  is chosen, which also satisfies "tests take CF from development by default."
- **Report plan extensions (D1–D3, approved this session).** The parallel-session report journal
  locked fold-in + failure-only evidence but assumed one record per run. Our matrix makes it N:
  D1 — keys become `<runId>__<suite>` (Firestore doc AND Storage prefix; otherwise matrix jobs
  overwrite each other) + suite tabs on `/report/:githubRunId` (query by `githubRunId`).
  D2 — cards keep the single overall `gateRun` badge (the `workflow_run` webhook fires once per run,
  not per job); per-suite chips come from a `cicd-audit` query — allowed now that the console reads
  the ledger directly. This SIMPLIFIED the earlier idea of a `gateRuns` map on the candidate — no
  model surgery needed.
  D3 — per-suite `capture: 'failure-only'|'all'` in the manifest resolves the report-plan's open
  queue/journey question (they can keep `'all'`) without forking configs.
- **No evidence toggle in the dialog.** Failure-only report mode is ALWAYS on for console-dispatched
  runs (operator-locked in the report journal). `report.json` (all tests, cheap) always exists ⇒ the
  Report screen is never empty; heavy artifacts exist only for failures.
- **Flutter: parked.** Option B (iOS ad-hoc via Firebase App Distribution, UDID-managed) was locked
  BECAUSE multiple concurrent preview branches need independently installable feature builds —
  TestFlight's single build-train fights that. Slack dropped. Details + open items in the parked plan.

## What surprised us

- The hub already had `cf-e2e.yml` (a CF emulator gate) — and the locked CF flow does NOT use it on
  PRs. It remains available for future use, but the predeploy-local gate is the CF rollout gate.
- One GitHub run id ↔ N suite reports (matrix) quietly breaks single-key assumptions in THREE places
  (audit doc id, Storage prefix, report route). Caught at planning time by cross-reading the report
  journal against the matrix decision.
- The console had restructured (`board/` → `screens/` + `shared/`) in parallel sessions; `CLAUDE.md`
  still documents the old layout (refresh scheduled in the plan). Always re-ground before planning.

## Pending / next steps

1. Implement per the master plan's phase order — Phases 1–3 are hub-local and startable immediately.
2. Blockers for Phases 4–5: `starlabs-angular` + `starlabs-cloud-function` access in the workspace.
3. Operator checklist in the plan §7 (token distribution, rules/functions deploy, glob sanity pass,
   GCP read creds for the reconcile healer).
4. Flutter resumes in its parallel session from the parked plan.
