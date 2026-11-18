# 2026-11-18 — JC Health tabs / Ev. Prep / delivery v4 coverage (journey suite)

App: starlabs-angular charan-release `dbe3bd62` (Joshua's JC Health + delivery v4 pull) and `4226b172` (fixes the
merge dropped). App journal: `specs/journals/2026-11-18-pull-joshua-jc-health-delivery-v4.md`.

## Why the seed looks like this
- **Follow-ups on the JCH base, suite tag.** One per bucket (A overdue, B today, C next 7 days) plus one negative
  control per rule: E beyond the 7-day horizon, F closed by a `schedule_done`, X off-base. Doc id = the app's
  scheduleId, so JCH-16's Mark done is read back by `scheduleId`. `healthtracker_activity` joined `SEEDED`; the
  app-written `schedule_done` (no testrunid) is swept by the JCH profileids in teardown.
- **Ev. Prep world under its own tag `<run>_evp`.** coach-health counts `participant metadata` by the suite tag
  and catalog / JE specs count PJPs by it, so a separate tag keeps their numbers still. Every exclusion rule has a
  card that must be absent: OLD (before EVPREP_LIVE_FROM), RET (journeytype returning), REJ (rejected sale), NOB
  (not onboarded); CAN proves a cancelled prep returns the card to yet-to-start. The prep EVP-02 writes is deleted
  before and after the case, and swept by profileid in teardown.

## What the first run found
The full journey run failed 9 coach-health cases. They were app regressions, not test drift: taking Joshua's ts
whole dropped five charan-release fixes (coach-scope schedule, 180-day A&H window, A&H card scope, case-insensitive
finance filter, onboarding exclusion from JC done). Restored in the app; JCH-04 / JCH-10 changed only for Joshua's
deliberate rule (finance out of Needs attention, 3ccd560d), JCH-01/02 for his finance chip markup.

## Run status
Local emulator lane (Firestore 8080, app on 4201): full journey 106 passed / 10 failed; after the fixes
coach-health 17/17, jc-evprep-board 2/2, delivery-dashboard-stuck 8/8 (fixmes skipped).
