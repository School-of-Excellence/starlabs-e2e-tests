# 2026-09-24 — team-evolution (FTO) dashboard spec: why the seed looks like this

App side: starlabs-angular `charan-release`, journal `specs/journals/2026-09-24-fto-dashboard-pull-mahalakshmi.md`.

## Why `journey`
`suites-manifest.json` → `journey.appPaths` already owns `src/app/Journey Onboarding/**`. No new suite/config.

## Why its own run tag (`<run>_fto`)
- `catalog.spec` JP-03 asserts EXACTLY 2 `products` with `testrunid == <run>`; the FTO world needs 2 more.
- `coach-health` derives its oracle from `participant metadata` with the suite tag.
A second tag keeps both untouched; `teardownJourney` runs a second `teardownCollections` pass for it.

## Why each doc exists (negative controls)
| Doc | Must be excluded from | Proves |
|---|---|---|
| NOTAH (no users_roles) + a diagnostics-ready sequence | list, Not started | AH scope comes from users_roles |
| ROLEOFF (users_roles, `ahmember:false`) | list | the flag decides, not the doc |
| OTHER (active on NDFU only) | FTO list (still an A&H card) | product scope |
| NDFU product / suite's untyped P1 | DFU picker | `type == 'DFU'` filter |
| DIAGDONE (diagnostic completed, session ready) | Not started | the rule needs a READY *diagnostic* |
| ONG's 2nd participantsproduct, status `completed` | product rows | `status in [ongoing, initiated]` |
| NOSTEPS (no delivery-sequence doc) | stepper | the "No delivery steps yet." branch |

`deliverables.deliveryref` points at `appointmenttype` / `delivery forms`, which is the real shape
(participant-delivery-sequence writes it). That is why **Needs attention** is `fixme` (JTED-07): the app reads
`appointmentend`/`endtime` off that ref, and real `appointmenttype` docs don't carry those fields. Seeding them
would make the case pass on data that can't exist in production.

## Found by the first run
JTED-02..06 read 0: the dropdown filled before the AH metadata loaded, and the app cached the empty list →
app fix (`metadataReady`), not a spec wait.

## Run
Local emulator (firestore+auth only, JDK 21, `EMU_REUSE=1 EMU_REUSE_APP=1 BASE_URL=:4320`): JTED 8 pass / 2 fixme;
full journey 81 pass / 27 fixme / 0 fail.
