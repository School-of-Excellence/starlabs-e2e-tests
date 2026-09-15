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
