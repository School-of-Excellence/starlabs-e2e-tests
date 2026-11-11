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

## 2026-10-22 · SGB-07 segment groups; SGB-06 on updatedat / updatedby

**What changed in the app:** segment history now writes `updatedat` and `updatedby` (a profile id). SGB-06 asserts those fields, and that `updatedby` has no `@`.

**SGB-07** runs on the seeded manual segment, because SGB-06 has already archived the automated one. Steps:
1. Create groups A and B in Manage groups. A gets a `create` grouphistory entry.
2. Assign A in the segment dialog. Check that config `groupid` = A and the card label shows A.
3. Move the segment to B. A gets `segment-removed`; B gets `segment-added` for the segment, with a profile-id `updatedby` and an `updatedat`.
4. Rename B to B2. The group doc's name changes, the segment's `groupid` is unchanged, a `rename` entry is written, and the group History view lists items.
5. Delete B2. The group doc stays, set to `deleted: true`. The segment's `groupid` is removed, a `delete` entry is written, the segment history has `groupid {from: B, to: null}`, and the card label is gone.

**Isolation and cleanup:**
- The group names are run-unique.
- Teardown `recursiveDelete`s those group docs, including their grouphistory subcollection. The app itself only ever soft-deletes groups; removing them for real is right for test data.

**ADDR3:** now also registers the dialog's inline "New group…" (`sgb-dlg-group-new` / `-add`). SGB-07 creates its groups from Manage groups instead.

**Needs (console):**
- rules for `segmentboardgroups` and `grouphistory` on starlabs-test;
- the test admin's `profile_data` linked by `user_ref`.

## 2026-11-11 · SGB-08 Import & move (list → manual segment, review first)

**App change:** a board-level **Import & move** dialog. It reads a CSV/Excel file or a pasted list (a Name/Email template can be downloaded), matches each value to participant metadata and shows a review list before anything moves. People in an automated segment are ticked by default. People in another manual segment, or in no segment, are unticked. Rows already in the target, not found, repeated, or a name shared by several people can't be ticked. The move writes the lists and the `members-added` / `members-removed` history in one batch.

**Seed:** a second empty manual segment, **SB Import** (`${run}_SB_IMPORT`), is the target. The target can't be SB Manual, because Charlie already sits there: Charlie is the "in another manual segment" case.

**Why SGB-08 un-archives SB Active first:** SGB-06 leaves it archived. Without it, Alpha would be "Not in a segment", and the default-tick rule (ticked only when in an automated segment) would go untested.

**The file (5 rows, the template's Name, Email headers), and why each row is there:**
| Row | Proves |
|---|---|
| Alpha | ticked by default, moved; leaves the automated list |
| Charlie | unticked by default (in SB Manual); ticked by the case, so it leaves SB Manual → `members-removed` |
| the nameless doc's email | never loaded (rule #2) → Not found |
| an email nobody has | Not found |
| Alpha in upper case | Repeated, counted once |
| (Bravo, absent) | must stay in the automated list: negative control for the resync |

**Oracles:**
- `segmentboardlist` for SB Import = [Alpha, Charlie]; SB Manual = []; SB Active = [Bravo].
- SB Import history `members-added`: `changes.members.to` = [Alpha, Charlie], `source.source` = the file name, and `updatedby` is a profile id.
- SB Manual history `members-removed`: `from` = [Charlie].
- A re-import shows both as Already there (0/0/2/3), and Move is disabled.

**ADDR4:** registers paste, search, tick-all, the template download and export. SGB-08 drives the file path instead.

**Never run here:** the cases were listed (`--list`, 12 tests), not executed. The gate is the first real run.

**Cleanup:** the seed and teardown `recursiveDelete` the SB Import config, including its history, and delete its list doc.

**First real run (local emulator lane, 2026-11-11):** 8 passed, 4 ADDR skipped. Fixes it needed:
- **SGB-06 / SGB-07:** the card's edit pencil is hidden until hover (design pass 2026-10-12), so clicking it timed out on "not visible". The new `editCard()` helper hovers the card first. These cases had not run since that design pass.
- **SGB-07:** after the rename, the row was still looked up by the old name (`input[value=GB]`), which no longer exists once the dialog re-renders. It is now found again by GB2.
- **SGB-08** found an app bug: a ticked row jumped out of the "Not ticked" view. Fixed in the app (tab rows are fixed while the tab is open).
