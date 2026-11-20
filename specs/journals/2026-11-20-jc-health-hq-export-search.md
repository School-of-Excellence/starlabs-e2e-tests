# 2026-11-20 — JC Health: note-first Mark done, Not-assessed drill + search/Export, Happiness quotient (journey suite)

App: starlabs-angular charan-release `bdf30c7f` (screen) + `7be9e74f` (hooks). App journal:
`specs/journals/2026-11-20-jc-health-filters-hq-followup-done.md`.

## Why the cases look like this
- **JCH-16 rewritten, not extended.** Mark done no longer closes on click: it opens the Log composer locked to Note.
  The old assertion (click → empty) would now fail for the right reason. The case proves Cancel writes nothing
  (no `schedule_done`), and that Save writes BOTH the Note log on B and the `schedule_done`, read back by the Admin SDK.
  Saving a log also POSTs to SalesCRM. The emulator has no `slack webhookurls` token, so the app stops before
  `fetch`; a `**/crmApi/**` abort route makes sure nothing leaves the lane anyway.
- **JCH-18 uses Not assessed, not a seeded health state.** No `healthtracker_healthstate` is seeded, so Not assessed is
  the whole Active base: A/B/C/E/F must be listed, while D (discontinued) and X (off-base) must not. The search, the
  "x of y" count, the no-match state, Export (download filename) and the clear-on-reopen are driven in the same overlay.
  The overlay is shared with every drill on the screen.
- **HQ seed uses `timestamp`.** The HQ card range-queries `healthtracker_activity.timestamp` (what logActivity stamps).
  The follow-up seed docs carry `createdAt`, so they stay invisible to the card and leave the JCH-15/16 numbers alone.
  This week has A HAPPY, C HAPPY and B UNHAPPY (2/3), each at Monday 00:05, so they always fall inside the week. Every
  rule has a log it must drop: X (off-base), D (discontinued, Active scope) and F (NEUTRAL, last week). Last week
  therefore reads 0/1, and a custom two-week range sums to 2/4. The expected numbers are re-derived in the test from
  the seeded docs.
- Only coach-health reads `healthtracker_activity`, so no other spec's counts move.

## Run status
Local emulator lane (app on 4201): coach-health 19 passed / 3 fixme, coach-dashboards 9 passed / 1 fixme. Gate MATCHED.
