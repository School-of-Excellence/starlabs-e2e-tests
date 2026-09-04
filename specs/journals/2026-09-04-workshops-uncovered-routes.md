# 2026-09-04 — workshops suite: covering the nine routes with no functional test (WS-16…WS-35)

## What this covers

Same methodology as the 2026-09-03 events audit and the 2026-09-04 modes audit, applied to the
`workshops` suite. Coverage was re-derived from the filesystem rather than from any document: parse
`app.routes.ts` into (route → component-import) pairs, keep the ones resolving under the suite's
manifest globs, then intersect against the routes that a spec actually **navigates to**.

**Scheduling was excluded by operator instruction this session** and is untouched.

## The counting correction that started this

The existing "StarLabs E2E Coverage Map" artifact reports workshops at **26/33 (79%)**. Re-derived from
`page.goto` targets, the real figure was **20/36 (56%)**. Two independent causes, both verified:

1. **Dashboard route grants were being counted as coverage.** Six routes the map calls covered
   (`/appointmentcalendar`, `/mycalendar`, `/appointmentrole`, `/eisappointmentrole`,
   `/mapappointmentrole`, `/formtemplateworkshop`) appear *only* inside the `{ route, label }`
   permission arrays in `appointments/seed-appointments.js:113` and `workshops/seed-workshops.js:89`.
   A grant says a role *may* open a screen; it is not a test that opens it. 26 − 6 = 20, exactly.
2. **The map measured a different checkout.** It records app branch `meena-development` at
   `../starlabs-development`; this machine has `manoja-development` at
   `organization-starlabs-angular/starlabs-angular`. Three routes here (`/eiflixoperationsdashboard`,
   `/campaigndashboard`, `/wccalendar`, added 18–21 Aug 2026) are absent from the map's 33 and had zero
   mentions anywhere in this repo.

Also: `scripts/check-route-coverage.mjs` and `scripts/check-suite-coverage.mjs`, which the map tells you
to re-run, **do not exist** in `scripts/`. The map's numbers are not reproducible from this repo. Worth
building for real — a checker that counts navigations rather than string occurrences — but out of scope
here.

Of the 16 uncovered routes, 7 are under `Scheduling/**` (excluded this session) and **9 were in scope**.

## New files

- `workshops/legacy-eiflix-workshop.spec.ts` — WS-16 (read), WS-17 (delete write)
- `workshops/eiflix-home-config.spec.ts` — WS-18, WS-19 (read), WS-20 (delete write)
- `workshops/new-users-profile.spec.ts` — WS-21, WS-22 (read), WS-23 (writeBatch tag assign)
- `workshops/eiflix-discover-page.spec.ts` — WS-24 (read), WS-25 (merge-safety write)
- `workshops/form-template-workshop.spec.ts` — WS-26 (read), WS-27 (emulator-skipped)
- `workshops/big-event-mentor.spec.ts` — WS-28 (read), WS-29 (bucket-move write)
- `workshops/eiflix-ops-dashboard.spec.ts` — WS-30 (oracle read)
- `workshops/campaign-dashboard.spec.ts` — WS-31 (derived-value read)
- `workshops/route-guards.spec.ts` — WS-34 (positive control), WS-35 (open defect, `test.fail()`)
- `workshops/wc-calendar.spec.ts` — WS-32, WS-33 (read)

Extended: `recon-allcomp/workshops.md` (+132 lines: 8 route rows, 12 collections, the guard finding,
WS-16…WS-33, seed requirements, Risks #11–15), `workshops/seed-workshops.js`, `workshops/support/wshop.ts`.

## Why the seed carries five negative controls

The recurring failure mode in coverage work is a test that passes because the thing it is looking for
was never there. Five seeded docs exist purely so an app-side filter can be *falsified*:

| Doc | Proves |
|---|---|
| `eiflixhomewidgets` widgettype:`ads` | the comingsoon/ads partition actually runs (one collection, two tabs) |
| `eiflixhomewidgets` with **no** `order` field | `orderOf()`'s MAX_SAFE_INTEGER fallback — a branch invisible unless a doc omits the field |
| `new_user_data` NU_C with **no** tags | the segment filter excludes something |
| `event collection` with `atcmodel:'NOT-BIG'` | the `where('atcmodel','==','B!G')` clause runs |
| `workshopcampaigncalendar` with `deleted:true` | the soft-delete filter runs (the doc stays in Firestore; it must never render) |

Remove any one of them and its case still goes green with the corresponding app filter deleted.

WS-25 is the same idea applied to a write: `classify/eiflixdiscoverpage` carries a `wsSentinel` field
that is **not** an `allFields` key and therefore never appears in the save payload. The case requires it
to survive the save. That, not "the typed value landed", is what pins `setDoc(..., {merge:true})` — a
destructive `setDoc` would pass a naive version of this test while silently wiping every unmanaged field
on the document.

## Guard finding — six of the nine routes have no `canActivate`

**Correction to an earlier version of this journal.** The first pass of this session found the missing
guards, wrote them into the recon doc and into this journal — and then wrote no test for them. All 18
cases logged in as the super-role admin; not one exercised a non-admin actor or asserted any denial.

The reasoning slip is worth recording because it is subtle and easy to repeat: I argued that a mount
smoke is "vacuous on an unguarded route", which is true of the **positive** direction (an admin can
reach it — passes with the guard deleted), and then silently substituted "assert data instead" for
"assert access control". Those are different properties. The **negative** direction — an authenticated
user *without* the grant must not reach an operator screen — is exactly the falsifiable test, and it was
the one thing the finding actually demanded. Now covered by WS-34 / WS-35 in
`workshops/route-guards.spec.ts`.

Measured, not assumed (participant actor, granted none of these routes):

| Routes | `canActivate` | Participant result |
|---|---|---|
| `/createworkshop`, `/bigeventmentor`, `/eiflixoperationsdashboard` | yes | all three **bounced** to `/` |
| the six below | **no** | all six **reached** |

The three guarded routes are the positive control (WS-34): they prove the actor is genuinely
unprivileged and that this assertion style detects a working guard. WS-35 asserts the DESIRED behaviour
for the six and is marked `test.fail()` — so the run stays green while the defect is open, and the
moment guards are added Playwright reports "Expected to fail, but passed", which is the cue to delete
the `test.fail()` and keep it as a regression test. I verified that alarm actually fires by temporarily
pointing the unguarded list at guarded routes: the run failed with `Expected to fail, but passed.`
Pinning the *current* behaviour instead would have gone green today and red when the app is FIXED —
the wrong direction for the alarm to point.

**Scope limit.** WS-34/WS-35 test ROUTE-level access only. The emulator runs permissive rules
(`allow read, write: if true`), so anything a participant can see there proves only that the route let
them in. Whether production Firestore rules give defence-in-depth for `new_user_data` /
`participant metadata` is **unverified** and needs someone with production ruleset access.

`/eiflixhomeconfig` (286), `/newusersprofile` (287), `/eiflixdiscoverpage` (288),
`/formtemplateworkshop` (290), `/campaigndashboard` (296), `/wccalendar` (297) are declared with no
guard at all. Two of them expose bulk participant data and a write path. **Reported, not fixed** — no
file under `organization-starlabs-angular` was modified this session.

Only `/createworkshop` (186), `/bigeventmentor` (294) and `/eiflixoperationsdashboard` (295) carry
`authGuard`, and there the seeded dashboard grant is load-bearing.

## Four things the source told us that guessing would have got wrong

1. **`bigeventmentor` documents are keyed BY THE EVENT ID.** `onEventChange()` does a direct
   `getDoc(doc(db,'bigeventmentor', eventId))` (ts:201) and `createBigEventMentor()` writes under the
   event's own id (ts:289). The first seed used a separate `<run>_bem` id; the screen simply never found
   it and rendered the "create" button instead of the status board — a silent miss with no error.
2. **`where('activejourney','in', this.bigjourney)`** (ts:167) throws on an empty array, so a B!G
   `journey` doc is mandatory or the screen errors before rendering — a seed gap that presents as a UI bug.
3. **`/formtemplateworkshop` is entirely query-param driven.** Bare, it renders nothing and
   `ngAfterViewInit:260` throws dereferencing `participantformtemplateid.formid`. Only `?id=<delivery
   forms docid>` (no `patchdata`) stays in the default DB — that is WS-26.
4. **`/createworkshop` template calls `row.startdate.toDate()` with no null guard**
   (view-workshop.component.html:22/27/32). A doc missing any of the three Timestamps throws on render.

## Two selector/timing traps fixed while running

1. **Material select: click the COMBOBOX role, not the `<mat-select>` host.** Clicking
   `mat-form-field.event-select mat-select` does not open the overlay. Worse, `/bigeventmentor` runs
   `initializeData()` in its *constructor* asynchronously, so a click landing before it resolves opens a
   panel that never fills. Fixed with a `toPass` retry around the whole open (Escape → click → expect an
   option); waiting longer inside an already-open empty panel does not help.
2. **`exact: true` on the B!G option lookups.** Role-name matching is substring by default and
   `"NonBIG Event <run>"` **contains** `"BIG Event <run>"` — without exact matching the negative control
   could have been satisfied by the positive option and WS-28 would have quietly stopped testing the
   where-clause.

## WS-30 was flaky and the first fix was the wrong one

`/eiflixoperationsdashboard`'s cards swap their skeleton for `.eod-count` as soon as `cardLoading()`
goes false (html:44-48), but the aggregation that fills the number resolves later — there is a real
window where the card renders a literal `0`. Reading once passed in isolation and failed at `0` in a
full-suite run (the dashboard settles more slowly with more data in the emulator). Replaced the single
read with `expect.poll(...).toBeGreaterThanOrEqual(seeded)`. This is not circular: if the app never
aggregates, the value stays 0 and the case fails at its timeout.

## Emulator limitation, honoured rather than worked around

`/formtemplateworkshop`'s draft/submit paths use `getFirestore('firestore-forms')`. The Firestore
emulator supports neither multiple databases nor per-named-db rules, so client reads/writes there
hard-DENY (Admin-SDK seeds still land, rules-bypassed) — `firebase.emulator.json` records this. WS-27
therefore `test.skip`s on `FIRESTORE_EMULATOR_HOST`, matching the existing handling of the same database
in `profiles/analytics.spec.ts:98` and `profiles/view-form-deep.spec.ts:33`. Making it "pass" on the
emulator would have been a false green. WS-26 is deliberately scoped to the default-DB read so it runs
everywhere.

## Environment note (same class as the 2026-09-04 modes blocker)

The emulator config's webServer runs `npm --prefix .. run start:emulator`, which assumes the hub layout
where the Angular app is a sibling of `starlabs-e2e-tests`. On this machine the app lives at
`C:\Users\Admin\Desktop\organization-starlabs-angular\starlabs-angular` and there is no `package.json`
at `starlabs_e2e/`, so that command cannot work here. Runs used an app server started by hand from the
Angular repo plus `EMU_REUSE=1 EMU_REUSE_APP=1`. Nothing to fix in the harness — it is a local checkout
shape, already recorded — but it is why no run in this session used the stock invocation.

## Result

Two consecutive full-suite runs, identical both times:

```
32 passed · 1 failed · 5 skipped   (~5 min, local starlabs-cicd Firestore+Auth emulator)
(the 32 includes WS-35 reporting as an expected-failure)
```

All 20 new cases behave as intended: 18 green, WS-27 skipped on the emulator by design, WS-35 an
intentional expected-failure pinning the guard defect. Workshops
`New-Workshop/**` + `Workshop/**` route coverage goes **11/22 → 20/22** (the two still uncovered are
`/workshopchallengecreation`-adjacent legacy screens already carried by the deep suite's mount smoke).

## Pre-existing failure — NOT caused by this work, NOT fixed

`workshops-deep.spec.ts:323` (WS-09/WS-14, the dashboard Send-Email comms-safety case) fails on
`textarea[formcontrolname="subject"]` never becoming visible. **Verified pre-existing**: reverting
`workshops/seed-workshops.js` and `workshops/support/wshop.ts` to HEAD and re-running the case alone
reproduces the identical failure, so no seed or helper change in this session is responsible.

Diagnosis so far: the spec gets past the envelope click, so the `SendmessagesComponent` dialog *does*
open — but `sendmessages.component.html` contains two `formControlName="subject"` textareas (lines 29
and 363, i.e. two tabs), and the spec assumes the Email tab is the active one. Most likely the dialog
now opens on a different tab. Left unfixed because it is outside this session's scope; whoever owns
`workshop-dashboard/sendmessages` should confirm which tab is intended to be active on open.

## What's still open

- Not committed or pushed — awaiting explicit instruction, per this repo's established precedent.
- WS-09/WS-14 above.
- The six unguarded routes (reported, not fixed).
- `scripts/check-route-coverage.mjs` still does not exist; until it does, the coverage map is
  hand-maintained and its "grants count as coverage" error can silently recur.
- Manifest ownership mismatch (recon Risk #13): `suites.workshops.appPaths` claims
  `src/app/Scheduling/**`, but every covered Scheduling screen is driven by the `appointments` suite. A
  change under `Scheduling/` routes CI to a suite that never opens those screens. Out of scope by
  operator instruction, recorded for a future session.
