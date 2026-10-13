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

## 2026-10-12 · SGB-06: segment history instead of hard delete

The app no longer hard-deletes segments: archiving is the only delete. Every config change now writes a history doc to
`segmentboardconfig/{id}/segmenthistory`, in the same batch as the change itself.

**What SGB-06 proves now:**
- archive → unarchive → archive keeps the config and the stored list;
- the Archived view has no Delete button;
- the app's own history docs exist: `create` (from SGB-02), `archive` ×2 and `unarchive`. The `archive` entry carries `changes.archived {from:false, to:true}`, `by.email` and `at`;
- the side panel History tab (`sgb-drawer-tab-history`) lists at least 3 `sgb-history-item` rows.

**Why this isn't circular:** the test only clicks, and every history doc it reads was written by the app.

**Teardown:** `cleanupSpecSegments` now `recursiveDelete`s the config docs, so the history subcollection goes with them. Firestore doesn't delete subcollections with their parent.

**Hooks:**
- `sgb-arch-delete` is gone from the app and the spec.
- Added `sgb-drawer-tab-history` and `sgb-history-item`.
- hook-diff: aligned, 57 hooks.

**Needs (console):**
- read/create rules for `segmentboardconfig/{id}/segmenthistory` on starlabs-test;
- the collection-group index on `segmenthistory.at` (descending), used only by the board-wide Change history, which no case drives.

## 2026-10-13 · Random segment ids; who = profile id; migration hooks

**What changed in the app:**
- New segments get Firestore auto ids, so the spec can no longer derive the id from the name. `autoId()` finds the live config doc by its run-unique name, skipping docs with `migratedto`.
- SGB-02 now also asserts:
  - the id is an auto id, and the `id` field equals the doc id;
  - `createdBy` holds a profile id, not an email;
  - the list doc's `segmentid` equals the config id.
- SGB-06 checks `by.profileid` instead of `by.email`.

**Seed:** `sbSegId` is removed, and cleanup still goes by name. The seeded manual segment keeps its fixed test id, so the board shows the migration banner during runs; it's harmless and nothing clicks it.

**Migration hooks:** `sgb-mig-open`, `-dlg`, `-row`, `-run` and `-done` are registered in SGB-ADDR3 (`test.fixme`) and never driven. The migration rewrites every text-id segment on the project, which on the shared test project would include other runs' and real segments.

**Needs:** the test admin user must have a `profile_data` doc linked by `user_ref`. Otherwise every save is refused ("No profile found…"), and SGB-02..06 fail on their first write.
