# 2026-09-27 — interim-report dashboard: cancelled reports, kept filters, list ergonomics

App: starlabs-angular `charan-release` f0075d1b (and a4af84cf before it). Spec: `modes/interim-report-dashboard.spec.ts`
IRD-15..18. Screen journal (the WHY for each app change): starlabs-angular
`specs/journals/2026-09-11-interim-report-dashboard-tab.md`, entries 2026-09-18 and 2026-09-27.

## Why the seed grew a third log for participant1

`IRL_CANCELLED` is p1's third `interimreport log`: **in range, `reports` non-empty, createdon = now** — every
field an Ongoing log has — differing only by `status: 'cancelled'`. That shape is the whole point. A green
IRD-18 must be able to tell "the dashboard applied the rule" from "there was nothing to drop", and a doc
that was out of range, or empty, would be excluded by some other rule and prove nothing. It would land in
the Ongoing card if the rule ever regressed, which is what IRD-18 asserts against (Ongoing stays 1).

It hangs off **p1, not p0**, for the usual neighbour reason: PM-13 counts p0's ask-AH rows exactly, and
IRD-01/02 assert p0's single submitted log. p1 already owns two logs, so a third only changes what IRD-01
already pins ("p1 has two reports on the dashboard") — and that pin is now a second guard on the same rule,
for free. The Log tab (tab 2) still streams the cancelled log; only the dashboard drops it, and PM-15's
counters are `>= 1` assertions, so they are unaffected.

## Why the exclusion is not in the Firestore query

The operator asked for it "in the query only". It cannot be: Firestore's `!=` / `not-in` match only
documents whose field EXISTS and is NOT NULL, and an interim report carries `status` only once it is
completed or cancelled. Measured on production `interimreport log`: 2461 docs — 1850 completed, 139
cancelled, 441 null, 31 with no `status` field. A query-side filter would have dropped 472 live logs (every
Ongoing / Not started one) and would also have placed a second inequality field beside the `createdon`
range, needing a composite index that is not deployed. The app therefore drops cancelled logs one step
after the read, and the calendar dots subtract a once-per-mount equality-only read of the cancelled logs
(an aggregation cannot filter without that same index).

## What is NOT covered, and why

- **`ird-retry` / `ird-retry-event`** — drawn only when a server read fails. The fix they belong to
  (`getDocsFromServer`, so a dropped connection can never render cached, partial numbers) was verified by
  hand with `disableNetwork` on the app's own Firestore instance; reproducing that in the emulator lane is
  not deterministic, so they are ADDR-registered in IRD-ADDR2.
- **`ird-modal-show-all` / `ird-people-show-all`** — drawn only past the cap (60 in a drill-down, 40 in By
  participant). The seeded world is three reports; seeding 60+ logs to drive the button would slow every
  case in the file. Verified by hand instead (caps temporarily set to 2, then restored), and at production
  scale: "Show all 559" rendered in ~1.1 s.

## Status

IRD-15..18 compile and register (modes: 83 registered across 24 files) and the hook diff is clean in both
directions. None of the four has executed yet — the first real run is CI's `modes` suite against a build
containing f0075d1b.
