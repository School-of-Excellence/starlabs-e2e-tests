# 2026-10-01 — JCD-04: Assured Sales Journey cell falls back to the product (app d86af3ea)

App: sashong-development d86af3ea applied as a patch onto charan-release (only that commit — taking the whole
jcd file would revert the 09-29 operator fixes). `formatCellValue` now treats an empty `journey` like an empty
`journeyref`: the cell shows the row's product name(s) from the dashboard's own `products` map.

## Why the seed looks like this (seed-journey.js, SLP / SLJ)
- **Assured** = `paymentplan` set + purchasedate in the current month (loadCurrentSalesLeads); both leads are
  dated now − 60s so the default month window always contains them.
- **SLP**: journey '' + productref → P1 → the cell must read `Test Product <run>`.
- **SLJ** (negative control): journey J1 AND productref → P1 → must still read `Test Journey <run>`; without it a
  green run can't tell "fallback on empty" from "product always wins".
- **status 'approved'** keeps both out of the /salesleads pending queue that JP-10 / JP-27..32 drive.
- Run-tagged ids, `salesleads` is already in SEEDED teardown.

Not covered: the same fallback on Gross Sales / upgrade tables (same formatCellValue path), and d86af3ea's
`saleProductRefs` map + `_sid` id field — written, never read.

## Run (local emulator WITH functions, app charan-release f87040e7 on :4320)
JCD-04 pass; full journey 84 pass (JP-20/JP-22 their usual `test.fail()`) / 27 skip / 0 fail. First-run fix: the
header cell is "Journey" + the sort icon (⇅), so the column is matched on its leading word, not exact text.
