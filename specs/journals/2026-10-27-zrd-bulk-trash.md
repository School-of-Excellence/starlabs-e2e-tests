# 2026-10-27 — ZRD-15: bulk move to Zoom trash

App: starlabs-angular `specs/journals/2026-10-27-zoom-dashboard-bulk-trash.md`.

There is no seed change. The three existing rows already cover the rule: only **Verified** is trashable
(completed, verification ok, its uuid in the stubbed Zoom listing). **Completed** (never verified) and
**Failed** are the negative controls, and their checkboxes must stay disabled. Select all must take exactly
the trashable rows within the run-narrowed filter.

The confirm is dismissed first (no `/api/zoom/trash` call), then accepted: exactly one call, for the
Verified record, through the stubbed per-record endpoint. Nothing reaches Zoom.
