# 2026-11-01 — /bigcohorts Randomize (CRND-01..04)

App: starlabs-angular `specs/journals/2026-11-01-bigcohorts-randomize.md`. Saving is off in the app (Confirm is
commented out), so the cases stop at the preview and prove nothing was written.

## Why the seed looks like this (`seedBigRandomizeWorld`)
- **Its own world, called only by this spec.** The base `seedBigWorld` cohorts are `studio`, which are not eligible, so they stay as the category negative control (CRND-01). They are not changed, so BIG-07/08/12/13 are unaffected.
- **SRC has six people, and groups of 2 are asked for.** 2 × 2 leaves 2 extras, so the spread is visible (3 and 3). Asking for 2 × 4 is the "too few people" control.
- **T2 holds OLD, who is not in SRC.** Without someone to lose, the removal warning could never fire. T1 is empty, the control with no removals.
- **SPEC is S0, S1 and P0.** P0 overlaps the participants. With two groups, the two non-participants must be picked first, so all six stay in the shuffle. A third group forces P0 in, and participants drop to 5.
- **Check-ins for P0, P1 and S0.** The day shows 3, but only 2 of the 6 attended, because S0 is not in the source. The other 4 are the unmarked and absent lists.

## How to run it
`queue-e2e.yml` with `only: queue/big-cohorts-randomize.spec.ts`. The branch-suites queue leg runs only
`operator.spec` + the self-tests (`_onlyWhy`, operator decision 2026-09-15), so **it does NOT run any B!G spec**.
The spec is also added to the `big` area's `only` list.

## Not covered
`applyRandomizePlan()` (the write, logs and chat changes). It needs a case when saving is turned on.
