# workshops: workshop-dashboard-communication.spec.ts — Exist Users card, Communication dialog, platform usage

**Date:** 2026-09-15 · **Suite:** workshops (auto-discovered via `specDir`) · **App branch:** `nanda-development`
(starlabs-angular `c7f57bab`, which merges `meena-development`)

## Why
The console readiness gate blocked `nanda-development` with MISSING_TEST_CASES: 55 new `wdash-*` hooks in
`workshop-dashboard.component` and the new `communication/communication-dialog.component` had no spec
reference, and the new component was "exercised by nothing". The parallel NEEDS_UPDATE (the `*-controls-
addressable` ids only on `meena-development`) is resolved on the app side by merging that branch.

## What the spec covers (10 tests, real UI, anti-circular)
- WDC-01 Exist Users Enrolled == an independent Firestore count of enrolled non-new profiles.
- WDC-02 the Exist panel's customer-status + journey filters, their chips, Clear All.
- WDC-03 the Communication dialog lists everyone: p0/p1 Enrolled (p1 is `enrollednotstarted`), p2 Not
  enrolled, NU Alpha a New user, "+91" rendered; close.
- WDC-04 audience / enrollment segments; New users hides the existing-only filters; Clear N.
- WDC-05 a tick survives search changes (the bug that motivated the dialog's rework): search → tick → × →
  search → tick keeps both; selected panel, collapse/expand, show-only, chip ×, clear selection, row
  click, select-all, empty state.
- WDC-06 status / journey / country menus and has-phone / has-email.
- WDC-07 WhatsApp / Notification / Email open the SAME composers as the side panel — in its own describe
  **without the console guard** (same stance as WS-14): the composers read config the workshops seed does
  not carry and log benign errors on open. Two composers are `disableClose:true`, so each is dismissed
  through its own close control; a dismissed composer returns no payload and every sender guards on that.
- WDC-08 each sub-challenge card shows its platform, "EiFlix Web" when the row carries none; the hero shows
  the enrolment platform.
- WDC-09 Platform Usage: one enrolment row "EiFlix Web" = every progress doc (100%); one step row with ≥1
  completed / 0 in progress — the seed stores no `platform_name` anywhere, and WS-12's move-next stays on
  the same platform whichever order the files run.
- A final "controls addressable" test references every hook literally (Interactive-Control Coverage
  Program convention).

## Conventions worth keeping
- Every mat-checkbox is toggled through its native `input` and the toggle asserted (`tick()`): the menu
  hosts are `display:block`, so a click on the host's centre lands on empty space and toggles nothing.
- `test.setTimeout(180_000)` in beforeEach — login + header + the dialog's full-collection load approach
  the 120 s default under a slow emulator.
- `DocResult` is flat (`d['profileid']`, not `d.data`).

## Not run locally
No Java runtime on the authoring Mac (Firestore emulator cannot boot) and no `STARLABS_CICD_SA`; compiled
+ listed by Playwright, and reviewed by a 4-lens / 2-skeptic pass against the app templates, the seed and
the Material/Playwright sources (findings fixed: flat DocResult, block-level checkbox hosts, the two
`disableClose` composers, composer console errors, the timeout budget). First real run = the console's
dispatch; the evidence report will name the step if anything differs.

## First CI run (branch suites, run 34954615045) — 6 failed, and why

WDC-02..07 failed on one cause: every lookup keyed on the seed's metadata NAME ("WS Alpha wshop"), but the
panel card rendered `participant0+wshop@example.com`. `participant metadata`.name/.email are **CF-owned**:
`profiledata_to_participantmetadata` fires on the auth chain's `profile_data` write (name = actor email) and
merge-sets name/email/countrycode/phonenumber seconds after `seed-workshops.js` wrote its labels. evomap hit
the identical trap (EM-13/14) and documented it in `evomap/support/evomap.ts`.

Fix (no seed change): `wsMetaNames` (= the actor emails) + `alignWorkshopMetadataNames()` in
`support/wshop.ts`, a precondition merge-write of the CF's terminal name/email onto p0/p1/p2 so both orders
converge; the spec keys every metadata person on those, called from both `beforeEach` hooks. Phone / country
code are identical on both sides, and the new_user_data people have no profile_data, so "NU Alpha <run>"
still stands. WDC-01/08/09 and the addressable case had already passed.

## Completed-only platform pill + completed date with time (app change, same day)

WDC-08 now expects one pill per completed chip and none on an untouched step. New **WDC-10** stamps a
KNOWN instant (`wsP0CompletedAt`, 15 Sept 2026 20:05 local) and a raw `platform_name: 'eiflixapp'` on p0's
completed step (`stampParticipantWorkshopP0Completed()`, precondition write) and asserts what the app
derived: "15 Sept 2026, 8:05 pm" and "EiFlix App"; the untouched step shows neither a date nor a pill.
`finally` restores the plain seed state (`resetParticipantWorkshopP0`) so WDC-09 and WS-12 are unaffected.

## WDC-11 / 11b — Users Not in Chat Group (app change, same day)

Preconditions in `wshop.ts` (`setupChatGroupPrecondition` / `giveP1LoginRef` / `teardownChatGroupPrecondition`):
an EMPTY `supportchat/${RUN}_chat`, `selectedgroup` on W_DASH, `firebaseuserref → user_data/{uid}` on p0 (and
on p1 for 11b). The seeded uids are `${RUN}_u_p0/p1` (roster). WDC-11: card "2" → panel → p0 has Add, p1
shows "No login yet" → add p0 → Firestore `members` == [p0 uid] (the app's write) → panel/card follow → Add
all disabled. WDC-11b: both addable → Add all → members has both → the card hides at zero. Everything is
removed in `finally`, so WS-07/11/12 and the rest of the suite never see a group.

## WDC-12 — All Assignments: typed answer expands its own card (2026-09-21)

`stampParticipantWorkshopP0TextAssignment()` adds a completed question/text assignment (long answer,
`END-OF-ANSWER` marker) to p0's progress document; the spec asserts the app's clamp → expand (one card
only) → collapse. `resetParticipantWorkshopP0` in `finally` restores the two-video seed.

## WDC-13 — Challenge Progress Overview rules (2026-09-21)

The app's engine rule changed: the four challenge-level buckets are now EXCLUSIVE ("Ready to Start" no
longer counted inside "Not Started"), the first real challenge has no Ready bucket, and zoom-call rows show
no chips (the Zoom Call Action button is parked). `setupOverviewShape()` gives W_DASH three challenges
(Module One, Module Two, a zoom call) with p0 done on One and p1 untouched; the spec asserts row 1 has no
Ready chip and "1 Not Started", row 2 reads "1 Ready to Start · 1 Not Started", row 3 has neither chips
nor the action button, and the "Not Started" panel on row 2 lists only the blocked person.
`teardownOverviewShape()` restores the seed.
WDC-13 also covers the sub-challenge rows (same day): 2.1 reads "1 Ready to Start · 1 Not Started · 0
Completed" (no In Progress chip on a step); 1.1 (the first step) shows no Ready chip.

## WS-31 — EiFlix Mobile App Logs on /eiflixoperationsdashboard (2026-09-21)

`seedLoginLogs()` writes six `loginlog` documents (today ×2 EiFlix + one other app; 3 days; 20 days;
40 days) with `date` as a Timestamp; `clearLoginLogs()` removes them. WS-31 asserts Today/7D/30D
membership, that the other-app row never shows, CF-owned names mapped from profileid, the name and OS
filters (options = people/OS in range), search, version sort both ways, and the pager label/buttons.

## First CI run of WDC-13 / WS-31 (branch suites 35584288173) — two spec-side fixes

- WDC-13 read "0 Not Started" on row 1: the overview counts only enrollees with status `enrolled`
  (`rebuildProgressFromMap`), and the seed's p1 is `enrollednotstarted`. `setupOverviewShape()` now
  promotes p1 to `enrolled` for the shape and the teardown restores it (WS-07's Total-Enrolled-only case
  still holds afterwards).
- WS-31 hit a strict-mode violation on the name search: `ngx-mat-select-search` renders a hidden helper
  `<input>` next to the visible one, so `locator('input')` matched two. The spec addresses the visible
  input by its placeholder.
