# 2026-10-17 — ATC live screens: liveness evidence, /atctrajectory usage, /viewUpgradedATC root cause, bug list

> WHY-journal. Companion to `specs/plans/2026-10-17-atc-live-screens.md`. Recon only — nothing built.

## How "live" was decided (no real database was queried)

Operator rule: never query the real database for ATC work. Evidence used instead:
1. `app/specs/evidence/traces.json` — a SAVED 2026-06-02 snapshot of the `dashboard` (side-menu) config
   (route, showInSidenav, roles) — reading a repo file is not a DB query. Best liveness signal available.
2. In-code links between screens (routerLink / navigate / window.open / embedded selectors).
3. Feature commits since April (the 2026-05-11/12 "firestore ATC and Forms" commits are a bulk migration of
   every ATC screen onto `firestore-atc` — they say nothing about use).
4. Cloud Functions still producing a screen's data (AI-ATC pipeline: onQueueAtcGenerationCreate,
   se_atc_usage, atcJobWatchdog / atcPodLifecycle schedules — live).

Operator confirmed 14 live; left ATC Generation Ops, ATC Usage Dashboard (both created 2026-07-05, after the
snapshot) and Scope Enhancement Rubrics Scoring (not in menu, linked from nowhere) as-is — "if anyone works on
them they add the tests, else they stay as dead".

## /atctrajectory ("ATC Education")

Menu-only (2 roles); no in-app, Flutter or Cloud Function caller. Lists ATCs per queue; the "ongoing queue"
check (`getOngoingQueue`) is never called — the queue select lists every `queue generation` doc.

## /viewUpgradedATC root cause

`view-upgraded-atc.component.ts:54-58` reads the version (`?atcpath=`), its corrections and procedures through
the DEFAULT handle; versions live in `firestore-atc`. Doc → null → `atcelement['atcref']` TypeError at :56 → the
LoadingProgress dialog never closes. Template additionally renders only for `mentor`.
(`mapProfile` is id→name — names render fine; checked `authguard.service.ts getProfileMap`.)

## Bugs found while mapping (report only unless the operator approves a fix)

Cross-cutting: the Firestore SDK rejects writing a DocumentReference from one database into a doc in the other
— several writes below throw and their errors are swallowed.

**Preview ATC** — Rework always fails (ATC-db ref into default doc) · infinite spinner with 0 corrections ·
crash without a `bigactivity` author · participant name blank unless in users_roles · activitylog points at
`bigformassignment` · no double-click guard.
**View Assigned ATC** — crash if the ATC lacks `atcid` == doc id · prefilled time uses 12-hour `hh` ·
completing with empty selects writes `assigned_to:[]` (procedure vanishes from the CA view) · undo
Auto-Generalized leaves `status:completed`.
**View Participant ATC** — no authGuard · validated docs still in `atc_to_validate` never shown.
**Review/Flag** — Close on the validator dialog still validates (consistent with VATC-05b — intended) ·
mentor id list grows on every snapshot · nested listeners pile up · deleted adjustments never shrink the list ·
pagination not reset on filter.
**Add Review Notes** — empty Confirm silently does nothing.
**Pick for Mentoring** — `atc.mentoring` vs `mentoringid` → never shows Picked, re-click duplicates ·
single @ViewChild clears the wrong textarea · two non-atomic batches.
**Live Prescription** — Add Triple's link can never resolve (`temporary_tripleatc` vs `temporary_ATC`) · draft
without `transcript` throws · duplicated `authors` collectionGroup listener · no ngOnDestroy · "Summay" typo.
**ATC Education** — Edit passes `atc_alpha` (edit-atc maps only `alpha`) → wrong collection · Validate with a
selected validator throws (cross-db) while Close validates · validated ATCs vanish · duplicate rows on every
snapshot · crashes on missing names · stale trajectory cache · ongoing-queue logic dead.
**Add Triple ATC** — `profileid` query param overwritten by the logged-in user · `queueList[-1]` TypeError ·
BIG `activityref` in the wrong DB · unawaited/uncaught commits leave the spinner up.
**View Triple ATC** — preview link passes `atcid`, preview reads `atcdocid` · "ALL" participant crashes ·
null `author` / missing `perceptualposition` crash · listener leaks.
**Preview Triple ATC** — procedures duplicate on re-emit · "PRESCRIBED DATE" label on authors, hard-coded 10
years · validate without `participantassignmentid` throws silently · nothing stops re-validating.
**Edit Triple ATC** — hangs with 0 corrections · validation uses the wrong index · BIG fields never persisted ·
Final ATC numbered from "adjustment 00" + in-place mutation · restored draft not applied · invalid `:atc`
crashes · old doc can stay un-upgraded · edit draft never cleared · editing an already-upgraded ATC allowed.
**EI AI** — row without `output` crashes · "Edit ATC" button is a no-op stub · empty-state colspan.

## Locked + D2 built (2026-10-17)

Operator locked: fix bugs #1–#5 (the "Live Prescription link from Add Triple" item was dropped — that
`copyToClipboard()` is never called from the template), D2 = rule fix, D3 = remove the mentor-only check,
D4 = fix the Education Edit type. Bug #6 (Edit Triple validation index/field) stays a known gap.

### WHY D2 has TWO halves (found while building it, re-confirmed with the operator)

The readiness rule alone ("drift only if the BASE had the selector") stops blocking innocent branches at
readiness — but readiness then starts the suite RUN, which executes the not-landed feature's specs against
an app that cannot have them, and they fail there instead (exactly JCD-05/06). So:
1. **Readiness** (`lib.splitByBase`, `readiness.cjs baseDeclares`): one `git grep -o -F -f <ids> BASE -- src`;
   ids the base never had → `notLanded` (reported, non-blocking). Base unreadable → conservative (blocking).
   A substring hit counts as "base has it" — also the conservative side.
2. **Run** (`landed-specs.cjs` + new web-e2e step): drop spec files whose literal hooks the app under test does
   not declare; list them in the job summary; `LANDED_NONE=1` when nothing is left (gate skipped, history
   records `unknown` — run-isolated would otherwise fall back to the WHOLE directory).
Payload to the console is unchanged (drift only) — no console change needed.

LIMITS, stated so nobody over-trusts it:
- Detects not-landed HOOKS only. A test for a BEHAVIOUR change behind existing hooks (JCD-05: the jorm-* hooks
  existed, the upload behaviour did not) still fails on branches without it → process rule still applies.
- Bound/indexed hooks can't be matched against app source, so a spec driven ONLY by bound hooks is never
  skipped. Verified on real data: with the pre-phase-1 app, edit/prescribe/view specs were skipped but
  emulator-wiring.spec.ts (only `vatc-row-${id}`) was kept → plan rule: every spec references ≥1 static hook.
- `readiness.cjs baseDeclares` could not be exercised locally (git is blocked in this session); covered by
  unit tests (splitByBase) and verified on the first CI readiness run.

Tests: readiness.test.cjs 85 passed · 0 failed (75 existing + 10 new).

## Part 3 built (2026-10-17) — NOT yet run

Branch: the operator kept `offline-ATC` and merged development into it (local `fbf45833`, not pushed) instead
of a new `atc-phase2` branch — verified: all 63 files development changed since 9dab25c5 are byte-identical.

**App (offline-ATC, uncommitted):**
- Fixes: /viewUpgradedATC (firestore-atc handle, not-found state, loading dialog always closes, mentor-only
  check removed — config decides) · #1 Preview Rework (`activityref` = default-db ref with the ATC path, the
  convention prescribe/edit/add-triple/edit-triple already use) · #2 Education Edit type `alpha`/`validation` ·
  #3 Education Validate re-creates the validator path on the ATC db (as View Prescribed does) · #4 View Triple
  preview link `atcdocid` · #5 Pick-for-Mentoring Yet-to-Validate tab `mentoringid`.
- Hooks on 14 components (prefixes vua vpa pva vaa rfa arn pfm ate lrx tra trv trp tre eia + `vatc-version-btn`).
  Only hooks a test uses were added. Lists use a STATIC hook + a `data-atc`/`data-proc`/`data-pid` attribute for
  identity — the static id stays literal for the readiness check, the attribute picks the row.

**Hub:** 13 routes re-allowed (ATC route group fully re-allowed; /viewrubrics_scoring_atc stays excluded) ·
atc appPaths 11 → 22 · seed: developer user + 16 participants (one per screen) + phase-2 data dated 30+ days
ago (outside every phase-1 filter window) · 10 new spec files, 41 cases · `installAtcGuards` now ALSO guards
at CONTEXT level so window.open POPUPS are covered by G2 (page routes still win for the main page — the
prod firewall's page-level catch-all would otherwise let real-DB requests through on it).

Readiness simulated with the hub lib against development's base: elements all clear (15 components), drift [].

**Found, not changed (needs the operator):** the emulator build does not connect the `firestore-forms` named
database either (main.ts wires default + firestore-atc only), so any screen reading it in a test would reach
the REAL forms database (G2 blocks + fails it). EI AI's "View" reads forms only when a summary has
`formdocids`, so EIA-03 uses a summary with none. Wiring firestore-forms would affect other suites (queue SS-07
reads it; profiles PA-13/14 skip because of it) — operator decision.

### firestore-forms wired to the emulator (operator: "do it as we did it for atc", 2026-10-17)

WHY it was never tested: the same root cause as firestore-atc — `src/main.ts` connected only (default) to the
emulator, so `getFirestore('firestore-forms')` (19 app files) escaped to the REAL project in every emulator run
(refused there with the dummy key). The hub had recorded a WRONG reason in five places — "the emulator does not
support named DBs → client reads DENY" — and skipped the tests on the emulator instead of fixing the wiring.
Disproved on 2026-10-13 (probe: client read+write to a named DB works). The queue author had it RIGHT
(cross-db-lowerbound.spec.ts: "main.ts connects only the (default) Firestore … then flip this back").

Changes: `main.ts` + one connectFirestoreEmulator line · emulator skips REMOVED from profiles PA-13, PA-14,
VPF-F02, workshops WS-27, queue Forms-widget lower bound (its assertion left exactly as written) · VPF-F03
depended on the broken wiring (it tested the "read failed" notice via the denied read) → it now FORCES the failure
by aborting the browser's requests to the firestore-forms database only, on both lanes · corrected the overlay
`//firestore` + `//databases` notes. The seeds already wrote forms data into the emulator (profiles, queue).
Not run yet (port 8080 — below). Risk to watch: these suites now assert real forms data on the emulator.

**Blocked:** port 8080 is held by a Flutter `Runner.app` in the iOS Simulator (since 2026-10-15) — the
Firestore emulator cannot start. Not killed (the operator's process).

## Pending

- Operator: free port 8080 → run the full atc suite (28 phase-1 + 41 phase-2), fix what fails.
- Operator: push the D2 rule fix (hub) and the phase-2 hub + app changes.
