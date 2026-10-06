# 2026-10-01 — Delivery dashboard Stuck Cases spec (DDC-STK-01/02)

App change: starlabs-angular bb5bca74 (mahalakshmi-development) pulled onto charan-release — Stuck Cases
is now "initiated|ongoing PP whose last ATTENDED appointment ended >= 15 days ago" (was: 15 days since
statusdate), plus Subscription Start / End columns on the four Participants tables.

## Why the seed looks like this (seed-journey.js step 8, `seedDdcStuck`)
- **Own run tag `<run>_ddc` + own DFU product** — catalog JP-03 counts exactly 2 `products` under the suite
  tag, and the FTO world's JTED counts are product-scoped; neither may move.
- **Every PP has a 20-day-old statusdate** — under the OLD rule all four active PPs would be stuck, so a
  green run can only be the new rule.
- **Controls:** RECENT (attended 3d), NOAPPT (none — the new rule drops a never-met participant; behaviour
  flagged to the operator, pinned as-is), UNATT (only unattended, 30d), DONE (completed status, 40d).
- **STALE's attended appt is 18d, not 20d** — the same row shows DAYS STUCK (statusdate, 20) and DAYS
  (appointment, 18) with the same badge class; equal numbers would make the DAYS assertion vacuous.
  STALE also has a newer UNattended appt (2d) that must not reset the clock.
- Subscription dates are UTC noon so 'MMM dd, yyyy' renders the same day in any runner timezone.
- CF-consistent (sequenceorder + statusdate on every PP) like seedFto.

## Index risk (not testable on the emulator)
The new read is `appointments where participantproductid in […] and attended == true orderBy endtime desc` —
a composite index no firestore.indexes.json in either repo declares. The emulator does not enforce indexes,
so CI is green regardless; on a real project without that index the query throws, the app catches it, and
Stuck Cases silently reads 0 (the console guard would flag the console.error on the cloud lane).

## Run (local emulator WITH functions, app charan-release 1a9be8ed on :4320)
DDC-STK-01/02 pass; full journey 83 pass (JP-20/JP-22 are their usual `test.fail()` expected failures) / 27 skip / 0 fail.
Spec fixes found on the first run: the outer tab strip is custom buttons (`ddc-btn-017`), not mat-tabs; and the
three inner tab panels each keep an identical table in the DOM, so every locator is scoped to the Stuck Cases tabpanel.
