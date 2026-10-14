# 2026-10-14 — Specialist Appointment Studio e2e (SAS-01..09) — why the seed looks like this

> WHY-journal. Screen: starlabs-angular `src/app/Scheduling/specialist-appointment-studio/` (route
> `/specialistappointmentstudio`, one component, hook prefix `sas`, 181 literal hooks). App-side intent:
> `specs/plans/2026-09-29-centralised-appointments.md` + journals 2026-09-29 / 2026-10-01 / 2026-10-05 (app repo).
> Spec: `appointments/specialist-appointment-studio.spec.ts`. Seed: `appointments/seed-appointments.js` → `seedStudio`.

## Status
Written, compiled, listed (`--list` on both appointments configs: 9 behavioral + 5 `SAS-ADDR` fixme),
hook-diff `aligned` (0 missing / 0 unreferenced). **Never executed** — the emulator ports were owned by another
process, so the first real run is the gate. The seed was dry-run against an in-memory Firestore mock only.

## Why the studio world has its own tag (`${APPT_RUNID}sas`)
- The studio's numbers are SUMS over a specialist's windows and sessions, and its tables LIST a specialist's
  sessions. Hanging everything off new actors (ah / cw / cw2, clients 0–5) means no number another appointment
  spec reads can move. Their row filters key on `eis0+appt@…` / `participant0+appt@…`; none of the new emails
  contains those as a substring (`client0+apptsas@…`, not `participant0…`), so strict-mode row locators stay single.
- A separate tag lets `teardownStudio()` sweep the world independently; `teardownAppointments()` calls it.

## Why the auth chain is hand-written, not `seed.seedAuthChain`
`seedAuthChain` also writes the queue `DRIVEN_ROUTES` dashboard grants under the run tag, and
`authguard.routeConfig()` keeps the LAST matching `dashboard` doc in doc-id order. `apptsas_dash_*` sorts after
`appt_dash_*`, so those grants would have replaced the main seed's for every queue route with an `ah`/`eis`-only
role list (scheduler+appt would lose them). The studio seed grants only `/specialistappointmentstudio`.

## Why the dates are week-relative (last week / next week, nothing this week)
Home opens on the CURRENT week, and "pending" needs an ended session. Hours-ago timestamps would land in the
previous week on a Monday morning, so every doc is placed relative to this week's Monday 00:00 (the app's
`mondayOf`): last Wed/Thu for the hours + past tables, 2 weeks ago for a period control, next Wed/Thu for the
upcoming session and the delete rule. The current week is empty for cw, so SAS-02 can assert zeros. The one
remaining hazard: a run that straddles Monday 00:00 between seeding and the cases.

## Why each negative control exists
| Control | Rule it guards | What breaks if the rule breaks |
|---|---|---|
| A_CANC cancelled (no-show reason) inside WL1 | Delivered = attended && !cancelled | Delivered 2h / 33% |
| A_PEND ended + unmarked | Delivered excludes pending; Pending filter | Delivered 1h 45m / 29%; pending list |
| cw2's 8h window + attended + pending session | host scope (self / picked specialist) | Available 14h; client5 in cw's pending list |
| A_OLD attended, 2 weeks ago, no window | period scope; Completed list is NOT period-bound | Delivered 2h 30m; Completed shows 2, not 1 |
| WL2 with nothing booked | Available = window hours, not booked hours | Available 4h; label "Unused" |
| WN1 (booked slot) next to WN2 (free) | delete only with no booked slot | WN1 deleted / WN2 refused |
| A_PEND is a *Review*, the rest *Coaching* | gate reads the newest-ended session | message names Coaching |

Expected last-week numbers (cw, and A&H with cw picked): Available **6h**, Booked **1h 45m** (union of the booked
slots 09–10 + 11:00–11:45; the cancelled 10–11 slot is seeded free, as a cancel leaves it), Delivered **1h**
(1 completed), Unutilised **5h** (1h cancelled), Utilisation **17%**.

## Shapes the seed had to match (read from the component, not guessed)
- Views come from `users_roles` flags: `{ah}` → A&H, `{eis}` → CW (sas-logic AH_KEYS / CW_KEYS).
- Windows: `availability {profileref, starttime, endtime, appointments:[typeRefs], [typeDocId]: slot[]}` —
  `parseWindow` reads slots by the type DOC id. `computeSlot` is NOT in the emulator CF entry
  (`index.emulator.js`), so seeded slot arrays stand there. On the cloud test project, if computeSlot is
  deployed, it would re-cut the slots on create (the existing AV1 window has the same exposure).
- Appointments: `hosts` + `hostRole` keyed by ROLE PATH (buildMeta → "SAS Specialist: <host>"), `created`
  (AppointmentDetailComponent's template calls `created.toDate()` unguarded), `cancelledon` when cancelled
  (same template), `productid`/`slotdata` for the roster stream, `participant metadata` per client for
  `/appointmentstudio`'s unguarded `activejourney` lookup.

## Found / surprised us
- **Cancel on a pending row is impossible by design.** `AppointmentDetailComponent` enables Cancel only while
  `now < starttime`, for everyone. A pending session has started, so A&H never sees Cancel there either. The
  disableCancel rule is therefore proved on the FUTURE session (A&H sees `ad-cancel-1`, CW does not); the pending
  row proves Update Status for both.
- Index note for the cloud lane: `windows()` / `futureIntervals()` query `availability` by `profileref (in|==)`
  + `starttime` range. The only composite on file is `profileref, appointments CONTAINS, starttime`, in both the
  app's `firestore.indexes.json` and `ci/overlay`. The emulator does not enforce indexes; the cloud project may
  need `availability: profileref ASC, starttime ASC`. Not added here.
- After closing the detail dialog the screen reloads Home on a 800 ms timer. The spec waits for the stats block
  to detach and re-render (`closeDetailAndAwaitReload`) before touching rows again.

## Deferred (SAS-ADDR1..5, fixme)
Mentor view + My Team / team table (needs a mentor actor whose `productowner` matches a product `atcmodel`),
A&H Mentors / Utilisation, Book Session calendar + book-slot dialog (a write through AppointmentBookingService),
Add availability save (auto/static), the window-details dialog, filter bar, participant lookup, Day/Month views.
