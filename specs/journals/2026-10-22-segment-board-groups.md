# 2026-10-22 — Segment Board groups (SGB-07) and the history field rename (SGB-06)

App: starlabs-angular plan `specs/plans/2026-10-22-segment-groups.md`, journal
`specs/journals/2026-09-25-segment-board-component.md` (2026-10-22 sections).

- **SGB-06** asserted the old history shape (`at`, `by.profileid`). New entries write `updatedat` and
  `updatedby` (a profile id). The case now asserts those, and that `at` is absent. The gate could not
  see this break, because no selector changed.
- **SGB-07** runs serially after SGB-06, so it uses the seeded MANUAL segment; AUTO is archived by
  then. Both groups are created **through the app**: one inline from the segment dialog's
  "+ New group…", one from Manage groups. Both write paths are therefore the app's.
  - Assign, then move: each side's `grouphistory` gets segment-added / segment-removed, and the
    segment history records `groupid` from → to.
  - Rename: the segment doc must be deep-equal before and after (a rename is one write to the group).
  - Delete: `deleted: true`, the doc is kept, the segment's `groupid` is gone, and the delete entry
    names the segment.
  - Nav: per-group counts, a group click filters the cards, Not grouped / All, and Select → send bar.
- **No seed docs.** The groups are written by the app and carry no testrunid, so
  `cleanupSpecSegments()` removes them by their run-unique names (recursiveDelete, for `grouphistory`)
  at seed start and at teardown.
- **Routing:** the gate sends `Participants Profile Management/**` to `modes` (first match), so the
  `profiles` suite has to be dispatched explicitly for SGB-* to run.
