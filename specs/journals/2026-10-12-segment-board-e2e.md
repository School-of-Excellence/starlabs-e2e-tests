# 2026-10-12 · Segment Board e2e (profiles suite, SGB-*)

App: starlabs-angular `src/app/Participants Profile Management/segment-board/` (route `/segmentboard`), hook prefix **`sgb`**
(57 literal hooks). App WHY: starlabs-angular `specs/journals/2026-09-25-segment-board-component.md`; rules pinned here come from
its testing-feedback round 1 (`specs/plans/2026-10-12-segment-board-feedback.md`).

## Where it lives
`suites-manifest.json` already gives `src/app/Participants Profile Management/**` to **profiles** (and modes); profiles also owns
Participant Intelligence, the closest relative — so `profiles/segment-board.spec.ts` + `profiles/seed-segment-board.js`, wired into
`seed-profiles.js` like `seed-lists-segments-tags.js`. No new config, script or manifest entry.

## Why the seed looks like this
- **The board reads unfiltered collections** (`participant metadata` orderBy name, `segmentboardconfig`, `segmentboardlist`,
  `journey`, `products`, `modes`). Other runs' data is visible, so every assertion is on run-named entities: participants `SB … <run>`,
  the run's own journey `SB_J`, segments `SB Active/Manual <run>`. Stats tiles show global counts → registered (ADDR), not asserted.
- **Negative controls, one per rule:** Charlie (non active — customer-status condition), Delta (active but on the profiles seed's
  J1 — journey setting), and a participant with **no `name` field** (the board loads with orderBy('name') to match Participants
  Analytics, so it must never appear — SGB-01 searches its email and expects nothing). Without them "the list holds Alpha + Bravo"
  could not tell a rule that ran from a world with only two people.
- **The seed never writes a list.** Every `profilelist` asserted is the app's output (anti-circularity). The automated segment is
  created through the dialog because "the list builds on save" is itself under test.
- **App-written docs carry no testrunid**, so `cleanupSpecSegments()` deletes them by their run-unique names at seed start (a failed
  earlier run) and at teardown; seeded docs go through the usual testrunid sweep (`segmentboardconfig`, `segmentboardlist` added to SEEDED).
- The suite is serial; SGB-02 creates the segment the later cases use, so the describe is `.serial` to make that explicit.

## Executed?
**No — the cases have not run against a real backend.** No ADC for the cloud test project on this machine, and the emulator lane
needs Java 21 (machine has 17). Verified instead: `--list` registers all 8 (6 + 2 fixme); `hook-diff.py` aligned (0 missing,
0 unreferenced); app `tsc` 0 + `ng build` ok; and the spec's click paths were walked through the app's own engine in a static
harness (create → list built, View all without ids, move/add/remove, archive/unarchive/delete) — all green. **The readiness gate /
CI is the first real run.**
