# 2026-09-22 — JC Health behavioural spec (journey/coach-health.spec.ts, JCH-01..07)

## Why this exists
`/journey-coach-health` had a mount smoke (JP-26) and an addressable block whose
`expect(locator).toBeTruthy()` cannot fail. The app branch `dynamic-studio-update` just merged Joshua's
JC-health features (A&H tags, a single Needs-attention rule, Defaulted/Missed tiles, a JC-vs-Onboarding
Schedule, a theme toggle, slide-over Love Letter / Ask A&H), so the screen's numbers changed meaning with
nothing checking them. App side: starlabs-angular `specs/journals/2026-09-22-jc-health-pull-joshua-sep22.md`.

## Why the seed looks like this
- **Logged in as the journeycoach, not admin.** A specific coach opens in *full mode* over their own base;
  admin opens the shared All view, where any doc in the emulator could move a number. Scoping by the
  seeded coach makes every count come from seed step 6 alone.
- **One negative control per rule** — otherwise a green run can't tell "the rule ran" from "nothing to drop":
  - D is `defaulted` but **discontinued** → proves the Defaulted tile honours the Active lifecycle default.
  - X is `defaulted` with a critical letter but on **admin's** base → proves the coach scope.
  - A is `'Defaulted'` (capital D) → proves the finance filter's case-insensitive fix; the tile filters `defaulted`.
  - C's critical letter is **resolved**, E's is **200 days old** (outside the 180-day window) plus a **liked**
    one → prove the A&H chip rules.
  - F is `late` and nothing else → proves late alone is **not** Needs-attention (B is late too, but reaches
    Needs-attention only through its tagged Ask A&H — so B also proves A&H feeds the rule).
  - A **cancelled** and an **attended** appointment → must not reach the Schedule.
- Subscriptions end +200d so lapsed / renewal-window never contribute; `customersupporttickets: 0` so tickets don't.
- New collections (`love letter`, `ask AH`, `appointments`) added to `SEEDED`; no other journey spec reads them.

## JCH-07 is `test.fail()` — a real defect
In a coach's own scope the dashboard never calls `loadContactEvents()` (only the All/Unassigned background
load and the Coaches tab do). The Schedule and JC-pipeline cards stay on "loading…" with zeros for every
coach. The oracle is written in full; when the load is fixed this reports "expected to fail, but passed".

## Not covered
Emulator Firestore rules are fully permissive, so a coach denied `love letter` / `ask AH` (A&H signals then
dropped silently) can't be reproduced in this lane.

## Execution status
`--list` registers all 8 cases; hook-diff aligned (113 hooks, 0/0). **Not executed locally** — the emulator
lane needs the CI-synthesized `environment.emulator.ts`. The gate is the first real run.
