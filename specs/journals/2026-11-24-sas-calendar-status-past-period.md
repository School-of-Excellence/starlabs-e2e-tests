# 2026-11-24 — Specialist Studio: summary partition, calendar status filter, Past by period (appointments suite)

App: starlabs-angular charan-release `2a2c31b6`. App journal: `specs/journals/2026-11-23-sas-calendar-status-filter.md`.

## Why the spec changed the way it did
- **SAS-03 re-derived, not patched.** The summary cards now partition the total (Total = Booked + Not booked +
  Delivered + Cancelled), and Booked is now session time not yet completed, not the old slot union. So last week
  reads 6h = 45 min + 2h 15m + 1h + 2h (17%). The Unutilised card is gone.
  The calendar's each-once rule hides WL1, which is past and held sessions, so its three sessions stand alone.
  Only WL2 (Unused) keeps a window card.
  The status filter, its counts, Show all, and the Not booked card (which switches on Open + Unused) are driven in
  the same case.
- **New negative control `A_CANC2`** is a plain cancellation (client6, Tuesday, no window, reason "Specialist
  unavailable"). Without it, a green run cannot tell "no-show named" from "every cancel named". It proves the card
  label ("Cancelled" vs "Cancelled · no-show") and the Past note (stored reason vs "No-show: …").
  It ends BEFORE A_PEND on purpose: the add-availability gate reads the newest-ended session, cancelled included,
  and SAS-07 needs that session to stay A_PEND.
- **SAS-04 moved to last week.** Past sessions follow the top period now (default this week, status All), so the
  case checks the empty current week first, then last week's counts (4 = 1 + 2 + 1). It covers the
  pending → Update status path, Delivered → Completed, and Cancelled with both notes.
- **SAS-05 / SAS-06:** the pending row is now in last week's Past (SAS-05 steps back a week), and the default
  is All (SAS-06 picks Completion pending).
- **ADDR changes.** Removed hooks dropped: `sas-filter-booked-*`, `sas-home-past-more`, `sas-home-stat-unutilised`,
  `sas-home-past-filter`. Registered without a case: `sas-home-month-count` (a month cell's lines depend on
  where the month boundary falls) and `sas-home-past-product` (the studio product is not on the filter bar's list).

## Run status
Local emulator lane: specialist-appointment-studio + scheduling 13 passed, 5 fixme skipped. Gate (base
origin/development): MATCHED, 320 selectors present.
