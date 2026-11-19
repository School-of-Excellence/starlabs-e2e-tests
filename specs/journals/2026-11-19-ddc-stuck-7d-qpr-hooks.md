# 2026-11-19 — Delivery Stuck at 7 days from last booked; queue planner review hooks

App: starlabs-angular charan-release `62563788` (queue planner review, Dharshan c97417aa) and `70e89bd4` (delivery
dashboard: Delivered / Total / Stuck / Weekly / "Why not here?").

## Why the DDC seed changed
The Stuck rule now counts from the last BOOKED appointment (started, not cancelled, attended or not) at > 7 days.
- **STALE** (attended 18d + unattended booking 2d) is now the negative control for "a newer booking resets the clock"
  — it is no longer stuck, so it left the All tab.
- **MID** (new: attended 10d ago) is the threshold control — stuck only at > 7 (not at the old > 15). It inherits STALE's
  old All-tab duties: `regular` finance status, the parallel product row, and the subscription start / end.
- **UNATT** now reads 30 days on the appointment basis ("Not attended"); NOAPPT still falls back to the ongoing date.
- MID makes six ongoing PPs on the DDC product: DDC-FN-01 oracle and DDC-FN-02's stage-mix label follow.

## Hooks
- `queue/slot-deletion.spec.ts`: `qpr-revert-appointment` → `qpr-planner-revert-appointment`; QSD-ADDR1 registers the
  planner's new filters, appointment tab, notes, Book, Revert and side-panel hooks.
- DDC-ADDR5 registers the "Why not here?" dialog hooks.

Local emulator lane: delivery-dashboard-stuck 10/10, onboarding-controls/dashboards 11/11, queue planner specs 10/10.
