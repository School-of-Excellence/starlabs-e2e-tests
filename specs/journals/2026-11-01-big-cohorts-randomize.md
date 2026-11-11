# 2026-11-01 — /bigcohorts Randomize (CRND-01..04)

App: starlabs-angular `specs/journals/2026-11-01-bigcohorts-randomize.md`. Saving went on the same day, and creating
a new cohort from the dialog was removed. CRND-01..04 stop at the preview; CRND-05 really saves, on the emulator.

## Why the seed looks like this (`seedBigRandomizeWorld`)
- **Its own world, called only by this spec.** The base `seedBigWorld` cohorts are `studio`, which are not eligible, so they stay as the category negative control (CRND-01). They are not changed, so BIG-07/08/12/13 are unaffected.
- **SRC has six people, and groups of 2 are asked for.** 2 × 2 leaves 2 extras, so the spread is visible (3 and 3). Asking for 2 × 4 is the "too few people" control.
- **T2 holds OLD, who is not in SRC.** Without someone to lose, the removal warning could never fire. T1 is empty, the control with no removals.
- **SPEC is S0, S1 and P0.** P0 overlaps the participants. With two groups, the two non-participants must be picked first, so all six stay in the shuffle. A third group forces P0 in, and participants drop to 5.
- **Check-ins for P0, P1 and S0.** The day shows 3, but only 2 of the 6 attended, because S0 is not in the source. The other 4 are the unmarked and absent lists.

- **T3 (empty) replaced the new-cohort step.** A third group is what forces P0 in as a specialist; the app can no longer create one.
- **T2 has a group chat holding OLD; people carry a `uid`.** `applyRandomizePlan()` updates the chat from `profile_data`, so CRND-05 can prove the placed people join and OLD leaves.
- **`resetBigRandomizeWorld` runs before every case**, because CRND-05 overwrites T1 and T2 and writes logs. It also deletes those logs, which carry no testrunid, so a retry reads only its own rows.

## How to run it
`queue-e2e.yml` with `only: queue/big-cohorts-randomize.spec.ts`. The branch-suites queue leg runs only
`operator.spec` + the self-tests (`_onlyWhy`, operator decision 2026-09-15), so **it does NOT run any B!G spec**.
The spec is also added to the `big` area's `only` list.

## Not covered
`getUidsFromProfileIds` through `user_ref` (the seed uses the `uid` field path), and a log write failing after the
cohort save. CRND-05 is emulator only: a first save on real data is still pending in the app journal.
