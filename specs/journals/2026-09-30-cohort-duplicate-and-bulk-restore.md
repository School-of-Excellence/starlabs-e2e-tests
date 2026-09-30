# 2026-09-30 — BIG cohort duplicate spec + bulk-add-products coverage restored

App side: starlabs-angular `charan-release` d8243ca7, journal
`specs/journals/2026-09-30-release-pull-cohort-duplicate-and-bulk-products.md`.

## queue/big-cohorts-duplicate.spec.ts (BIG-12, BIG-13)
- **No new seed.** `seedBigWorld` already gives one marathon, a source cohort with participants and an EMPTY
  target cohort — the unselected target cohort is the negative control for "Duplicate 1 cohort(s)".
- **Why no Save case:** the create writes a `big cohorts` doc (needs event/mentor picks the seed lacks) and
  would move the counts BIG-07/BIG-08 read. The cases assert the two dismiss paths write nothing, via an
  Admin-SDK count before/after.
- **Login:** `loginAs`, not `loginAsBigAdmin` — that helper lands on the ATC-fenced `/big-dashboard`.
- **Manifest:** added to the `big` area's `only` list; the queue gate runs curated subsets, so a spec that is
  not listed never runs in CI.

## profiles/bulk-add-products.spec.ts + bulkProductJobs seed
Restored verbatim from 89160fb (removed in ed8a070 when bulk products left the release on 09-25). The dialog
is back on charan-release with its 30 `bap-*` hooks; its Cloud Function is on CF `development` now.

## Run (local emulator WITH functions)
big-cohorts-duplicate + big-analytics: 11 pass / 1 fixme (BIG-08). profiles: 88 pass / 11 skip / 0 fail.
Readiness: MATCHED.
