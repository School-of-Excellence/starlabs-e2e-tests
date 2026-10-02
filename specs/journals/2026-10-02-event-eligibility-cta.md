# 2026-10-02 — UED-ELIG-01 + ECTA-01..03: event editor eligibility and the Configure CTA dialog

App: surya-development merged (--no-ff) onto charan-release — 0e8f5685 (per-product eligibility on the event
editor) + 7b5b6c14 (Configure CTA dialog). App-side for the gate: the dialog had 0 hooks → 15 `ecta-*` added;
the Configure CTA button reused `evl-create-event` → renamed `evl-configure-cta`.

## Why the seed looks like this (seed-events.js 9d / 9e)
- **Journey with a `journey` field** — the eligibility select labels options by `journey`, not `name` (the
  existing JOURNEY1 only has `name`, so it renders blank).
- **Two marathons, LIVE + completed, one cohort each** — the cohort list is `big cohorts` where marathonref is
  in the LIVE marathons. The completed marathon's cohort is the negative control; without it a green run
  can't tell the status filter from "everything is listed".
- **classify/eventcta + classify/eventstatusmessage** — singleton docs, seeded with run-unique strings so the
  prefill is provably read from Firestore. The dialog's Submit setDoc()s them WITHOUT the run tag, so the
  spec's afterAll (`restoreCtaConfig`) re-seeds them tagged and teardown can sweep them.

## Not covered
Saving an event with eligibility (full editor Save path); the confirmations eligibility buckets (573e1f59 —
unwired, only compiles because charan-release declares `participantMetadata`); the queued-email
validated→send change (logic-only, its CF is firewalled under test).

## EVT-02 refit (events-deep.spec.ts)
The merge broke EVT-02 (create event) twice over: the restyle renamed "Add New Arena Events" → "Add New Arena
Event" (now driven by `ued-add-arena-event`), and **Eligible Journey is a required field on every arena product**
(`eligibility.journeyid` has Validators.required), so an event cannot be created without picking one. EVT-02 now
picks the seeded EVL journey. Behaviour change worth knowing for ops: every arena product must name ≥1 journey.

## Run (local emulator WITH functions, app charan-release edd89d75 on :4320)
event-eligibility-cta 4/4. events 42 pass + EVT-02 fixed (re-run green) / 2 skip. workshops 100 pass / 31 skip;
WS-35 is its `test.fail()`; WS-29 failed once in-suite and passes alone (flaky, screen untouched by this merge).
Spec fixes on first run: selects opened from the keyboard (sticky dialog header intercepts the click) and the
ngx-mat-select-search box typed into (it sits in a mat-option that reports disabled, so fill() refuses).
profiles 87 pass / 11 skip (PA-34 its `test.fail()`); PA-08 failed only because the LOCAL reused emulator still held
events' `evt_journey_1` + workshops' `wshop_jrn_big` (journey docs with no `journey` field) — participants-analytics'
journey typeahead does `e.journey.trim()` and throws on them. CI spawns one emulator per suite, so they never meet;
with the two leftovers removed PA-08 passes. modes 79 pass / 4 skip.
