# Journey gate → reusable-caller conversion — DRAFTS (review only, nothing committed)

> **Start with [`LANDING-PLAN.md`](./LANDING-PLAN.md)** — the full hand-off: the plan, the "won't affect any current flow" guarantees, the exact branches/base-commits, the land sequence, rollback, and the end-state acceptance checklist. This README is the file-level placement detail.

These are **proposals**, not live files. They convert the journey gate from the old **standalone** shape
(123-line `journey-e2e.yml` that we validated 16/16 in CI on `journey-gate`) to the team's **current** shape:
a thin caller of the hub's reusable `web-e2e.yml`, exactly like `queue-e2e.yml`.

> The journey *test logic* does not change — it is already green. This is purely re-plumbing the green suite
> into the reusable shape, plus one small backward-compatible capability added to the shared hub engine.

## The 3 layers (recap)
```
journey-e2e.yml   (app · WHEN to run + WHICH suite)  ──uses──▶  web-e2e.yml@main  (hub · assemble/boot/serve/run)  ──run──▶  run-isolated.sh  (hub · per-file test loop)
```

## What each draft is, and where it goes

| Draft file (here) | Goes to | Action |
|---|---|---|
| `journey-e2e.yml` | `starlabs-angular/.github/workflows/journey-e2e.yml` | **Replace** the standalone version on `journey-gate` |
| `web-e2e.proposed.yml` | `starlabs-e2e-tests/.github/workflows/web-e2e.yml` (hub `main`) | **Replace** — adds `config`+`suite` inputs (4 marked changes, backward-compatible) |
| `run-isolated.sh` one-liner | `starlabs-e2e-tests/scripts/run-isolated.sh` (hub `main`) | **One-line edit** (below) |

## The only `run-isolated.sh` change (one line)
Generalise the default spec-root so an empty `only` discovers the caller's suite instead of always `queue`:

```diff
- SPECS="${ONLY:-$(find queue -name '*.spec.ts' | sort)}"
+ SPECS="${ONLY:-$(find "${SUITE_DIR:-queue}" -name '*.spec.ts' | sort)}"
```
`SUITE_DIR` is exported by `web-e2e.proposed.yml` from the `suite` input. Queue is unaffected (`SUITE_DIR`
defaults to `queue`). The `CONFIG` override hook already exists in run-isolated.sh
(`CONFIG="${CONFIG:-playwright.queue.emulator.config.ts}"`) — `web-e2e.proposed.yml` just feeds it.
*(If the team prefers not to touch run-isolated.sh, instead give `journey-e2e.yml` an explicit `only:` list of
the journey spec files — then SUITE_DIR only affects the history audit tag.)*

## Hub prerequisite the caller depends on (separate from the files above)
The reusable workflow clones `e2e_ref: main`, so the **journey engine must be on hub `main`** before the
caller can be green on `@main`. That is the Phase-4 hub PR (`journey-gate → main`), bringing:
`playwright.journey.emulator.config.ts`, `journey/support/emulator-global-setup.ts` + `-teardown.ts`,
`seed-journey.js` (initAdminAuto), the JP-09 spec fix, and the shared `ci/overlay/environment.emulator.ts`
null fix. (Confirmed earlier: hub `main` never touched that shared file → no conflict.)

## Validate-before-cutover (same TEMP→flip pattern as Phase 3)
1. Land `web-e2e.proposed.yml` + the run-isolated.sh line + the journey engine on a hub feature branch.
2. In `journey-e2e.yml`, set `e2e_ref:` **and** the `uses:` ref to that hub branch (not `@main`); open a PR.
3. Confirm the gate is green under the **reusable** path, then flip both refs back to `@main` once the hub PR merges.

## Re-validate the execution-model change
Our 16/16 ran as **one** Playwright invocation; `run-isolated.sh` runs **per spec file** with a teardown+reseed
each. Journey's `globalSetup` already teardown+reseeds (a deliberate mirror of queue), so it should hold — but it
is a different harness, so treat the first reusable-path run as the real confirmation.

## Known caveats (non-blocking)
- **Evidence mode:** journey has no `playwright.journey.emulator.evidence.config.ts`. With `evidence=1` the gate
  still runs (blob+merge report) but using the standard journey config (screenshot on-failure, trace on-first-retry),
  not a screenshot-per-test. Add a journey evidence config later if per-test artifacts are wanted.
- **History `ATTACH`:** still points at queue fixtures (best-effort, only when `STARLABS_CICD_SA` is set). `SUITE`
  is now correct (`journey`); parameterise `ATTACH` later if needed.

## Trigger / cutover note
`journey-e2e.yml` triggers on `[cicd-dev, cicd-prod]` to **match queue** (the team's sudo stand-in branches),
switching to `[development]` at cutover **together with queue**. This also corrects the Phase-3 drift where our
standalone gate triggered on real `[development]` (a one-off validation convenience, not the team convention).
