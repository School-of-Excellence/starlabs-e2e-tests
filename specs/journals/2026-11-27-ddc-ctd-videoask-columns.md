# 2026-11-27 — Delivery dashboard CTD board: Pre / Post Video Ask columns (journey suite, DDC-CTD-01)

App: starlabs-angular charan-release `9d190a72` (CTD Pre / Post Video Ask stages) + `50ad8dfb`
(skip the VideoAsk load without a plain CTD product id). App journal: `specs/journals/2026-11-19-delivery-dashboard-ctd-stage-tab.md`.

## Why
The CTD board's columns are a fixed list in the app (`ctdColumns()`), so DDC-CTD-01's column assertion had to
gain "Pre Video Ask" (after Impact Valuation) and "Post Video Ask" (after Review). The total is 12, in both cycles.

The first local run also failed DDC-CTD-01 / DDC-CTD-02 on the console guard: "CTD VideoAsk load failed … reading
'indexOf'". The journey seed has no CTD product card, so the app called `doc('products', undefined)`. That was an
app bug (any environment without the card), fixed in the app with an early return, not hidden in the test.

No seed change: VideoAsk answers (`participantvideoask`) are not seeded, so the Pre / Post columns are only
asserted as columns. A behavioural case (one answered Pre VideoAsk moves an enrolment) is future work and needs a
CTD product + productToDeliverySequence with arenavideoask steps in the seed.

## Run status
Local emulator lane: delivery-dashboard-stuck 10 passed, 5 fixme skipped (after the app guard). Gate: MATCHED.
