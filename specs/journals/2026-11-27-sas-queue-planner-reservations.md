# 2026-11-27 — Specialist Studio: Queue Planner reservations block delete (appointments suite, SAS-03 / SAS-08)

App: starlabs-angular charan-release `38f0c350`. App journal: `specs/journals/2026-11-23-sas-calendar-status-filter.md`
(row 7 + "Queue Planner reservations (option A)").

## Why the seed looks like this
The planner reserves a slot by writing a `queue availability` doc (`slottype: 'appointment'`, `availabilityid`)
and never marks the availability slot. So "the window is free" and "the window is reserved" can only be told
apart by that doc. Every rule has its control, all in `seedStudioNextWeek` (re-run by SAS-08's reset):
- **QH_OPEN on WN3:** next Friday, slots free, reservation unbooked and in the future. The card and the
  Availability row must say "Reserved for queue: SAS Queue <run> · 1 slot", the row can't be selected, the
  dialog lists it, and Delete alerts before any confirm. WN3 survives.
- **QH_BOOKED on WN2:** `appointmentref` set. It must NOT block, and SAS-08 still deletes WN2 through the confirm
  path. Without it, a rule that blocked on any reservation would pass.
- **QH_ENDED on last week's WL2:** unbooked but ended. SAS-03 asserts no note on last week's calendar.
- **`queue generation` Q:** the queue name the studio resolves (never asserted from the seed; the regex is
  built from the run tag). `queue availability` and `queue generation` were added to `SAS_SEEDED` teardown.

## Run status
Local emulator lane: specialist-appointment-studio 9 passed, 5 fixme skipped. Gate (base origin/development):
MATCHED, 323 selectors.
