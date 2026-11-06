# 2026-11-06 — Spec refs for Mahalakshmi's Weekly Report tab + update-delivery appointment checkboxes

**Why:** starlabs-angular `charan-release` pulled Mahalakshmi's delivery-dashboard / group-appointment work
(app journal `specs/journals/2026-11-06-pull-mahalakshmi-development.md`). The readiness gate then reported
11 new hooks no spec referenced: `ddc-btn-130 … ddc-btn-138` (new outer "Weekly Report" tab) and
`ud-appt-changework` / `ud-appt-group` (two update-delivery checkboxes that gained `(change)` handlers and
were hooked on the app side for that reason).

## What landed
| Spec | Change |
|---|---|
| `journey/delivery-dashboard-stuck.spec.ts` | `DDC-WR-01` (live) + `DDC-ADDR2` (fixme, addressable) |
| `journey/product-designer-addressable-dialogs.spec.ts` | soft-addressable lines for `ud-appt-changework`, `ud-appt-group` |

## Why the case looks like that
- The Weekly Report filters, Clear and Export sit behind `*ngIf="weeklyReportCardId"`. DDC-WR-01 opens the tab
  and proves ONLY the product picker renders — the filters / Clear / Export are the negative control (count 0).
  Choosing a product was deliberately NOT driven: the picker lists `visibleCardIds` (grouped card names that
  depend on journey grouping), so a seeded product's label is not stable enough to select without a dedicated
  weekly-report seed. That seed — initiated + appointment dates, booked vs completed — is the deferred
  behavioral case (DDC-ADDR2).
- update-delivery is a dialog opened from a parent screen; it already uses the soft-addressable pattern
  (attached-only-if-rendered), so the two new refs follow it.
