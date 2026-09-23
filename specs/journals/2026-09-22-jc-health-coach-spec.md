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

## Second pass — Joshua's follow-ups (JCH-08..10), same day
App side pulled 16 more JC-health commits (the A&H analytics card + drill-down dialog, NA reason chips,
Schedule filter buttons, Going-quiet exclusion). 23 new controls had no hooks; all now carry one.

- **New prefix `afl`** for `AhFlagListDialogComponent` (its own component → its own prefix).
- **Seed:** one extra love letter with NO flags (`LL_F_PLAIN`, on F). Without it the Unflagged tile reads 0
  whether or not the app's `!liked && !tagged && !opportunity && !critical` rule ran. E's 200-day-old
  critical letter is the window control: it must NOT appear in any A&H analytics count.
- **JCH-08** counts by flag × source against an independent read of the same docs.
- **JCH-09** drills: the dialog lists ONE ROW PER SOURCE DOCUMENT, so its length reconciles the clicked
  cell (C's resolved letter and X's letter both appear); a row opens that participant's slide-over; a 0
  cell opens nothing.
  NOTE, recorded deliberately: the card is **base-wide, not coach-scoped** (`loadAHSummary` reads both
  collections org-wide, once). X is on the ADMIN's base and still shows in a coach's drill-down. JCH-09
  asserts 3 rows, which is today's behaviour — if the card is later scoped to the viewing coach, this
  case goes red and should be re-expected at 2, not deleted.
- **JCH-10** asserts the reason chips per row, and that a late-only participant (F) carries none.
- JCH-07 stays `test.fail()`: the coach-scope Schedule load is still unfixed, so the Schedule bucket
  filter buttons cannot be driven either; their hooks ride along in JCH-07's oracle.
Not executed locally (no `environment.emulator.ts`): the gate/emulator run is the first real run.

## Third pass — Joshua's 3 fixes + the JC-pipeline fix (JCH-11, JCH-12), 2026-09-23
App pulled joshua-development 7023d94f + bbe2e3bd (coach-dropdown re-scope, authoritative onboarding
discriminator, A&H drill as a NATIVE in-component overlay — AhFlagListDialogComponent DELETED), and the
JC-pipeline fix ("JC done" now excludes attended onboarding calls) was made on our side.

- **`afl` prefix retired.** The drill-down is no longer its own component, so JCH-09 now drives
  `jchd-ahd-overlay` / `-row` / `-count` / `-close`. Joshua's own ids (`viewing-coach-select`,
  `ahd-overlay`, `sched-jc-col`, …) were mapped onto the `jchd` prefix the gate enforces, and his
  `qa/checks/jc-health-contract.mjs` greps the merged names.
- **JCH-11** (Fix 1): switching the Viewing scope must REBUILD the table. Two-way `[(ngModel)]` pre-wrote
  `selectedCoachId`, so `onCoachChange`'s same-coach guard no-op'd and the table never re-scoped. The
  case asserts the off-base participant (X) is absent in the coach's scope and present in All, and that
  All is a strict superset — a count assertion alone would pass on a table that never rebuilt.
- **JCH-12** (JC pipeline): seeded a SECOND attended appointment, `APT_OB_DONE`, an ONBOARDING call.
  Without it "JC done" reads the same whether or not the exclusion ran. Runs as ADMIN, not the coach:
  the pipeline card only fills in the All view (the coach-scope appointments read is still missing —
  JCH-07's defect), so this is the only scope where the count exists.
- JCH-07 unchanged and still `test.fail()`; its row assertions are now scoped to the two Schedule
  columns, which also puts the new column hooks to work.
Not executed locally (no `environment.emulator.ts`): the gate/emulator run is the first real run.
