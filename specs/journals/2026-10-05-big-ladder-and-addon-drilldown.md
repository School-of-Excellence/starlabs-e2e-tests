# 2026-10-05 — BLD-01..03 (B!G leaderboard) + EPC-ELIG-02 (funnel Addon drill-down)

App: surya-development 7a23f823 path-pulled onto charan-release — new screen `/big-leaderboard` (big-ladder) and
the product-funnel Addon segment's Reason column + Assign product button.

## Why the seed looks like this (fixtures/big-ladder-seed.ts)
- **Own run tag `<run>_bld`, own people** — seedBigWorld's docs are counted exactly by BIG-01..13; nothing here
  hangs off them. seedBigWorld is still called for the mentor login and the new `/big-leaderboard` grant.
- **One person per inclusion path**: Active (activejourney = B!G journey), Nonactive (activejourney '' →
  lastcompletedjourney = B!G — the fallback), Other (LYL journey → must never be listed).
- **A control per metric**: duplicate attended EPR on the same event (distinct count), attended NON-B!G event,
  approved-not-attended EPR, activity on a `draft` assignment (status not in the app's query), repeat video,
  incomplete log, non-eiflix log. Each moves its metric if the rule doesn't run.
- `big assignment` (plain) is the B!G assignment collection big-seed.ts already writes — not the ATC-fenced
  `big assignment_*` family.

## EPC-ELIG-02
Reuses seed 9f (events): ADD (active, journey ok, not an owner) must appear in the funnel's Addon segment with
Assign product; ELIG (owner) must not.

## ZRD-01..04 (zoom backup verify / verify all / move to Zoom trash — operator's zoom-backup-reliability work)
Seed adds ZOOM_VERIFIED (completed + verification.ok + meetinguid listed by the stubbed /api/zoom/recordings): the
only row the trash gate may allow; ZOOM_DONE (unverified) and ZOOM_FAIL (failed) must stay blocked with their own
reasons. The zoom-to-dropbox server is stubbed with page.route (emulator build has no zoomMigrationApiUrl, so calls
are relative) — no Zoom/Dropbox call can leave the test; the oracle is the docIds the app sends and how it renders.

## Run (local emulator WITH functions, app charan-release 1b95ce14 on :4320)
big area 24 pass / 3 skip (BLD-01..03 found a real crash first: undated cohorts threw in the cohort sort — fixed in
the app); comms 28 pass / 12 skip (ZRD-01..04 first run); events 43 pass + LED3-01/02 green once the queue suite's
leftover run1 "ongoing" queue docs were cleared from the shared LOCAL emulator (the ATC guard refused them — correct;
CI spawns one emulator per suite).

## ZRD-05..07 (zoom Retry + duplicate cleanup, operator's follow-up)
Retry must appear on the Failed row only (completed / verified rows are the controls); the stub's `/api/zoom/retry`
answers `queued` or, per test, `duplicate_removed` + keptDocId=ZOOM_VERIFIED — the page notice's View backup must
open THAT record. Verify all's `duplicate_removed` result is counted apart from verified. Run (app c42241e6): comms
31 pass / 12 skip / 0 fail; ZRD-06 needed the modal's ✕ (zrd-closefilemodel-2), not an overlay click.

## ZRD-08/09 (live cost rates)
`/api/cost-rates` stubbed per test: 503 → the cost line must say "(fallback rate)" and claim no live source; a live
answer with values distinct from the app's fallback constants (₹88.25, $0.08/GB vs ₹96.4, $0.12) must replace them
and show "(live rate, Oct 5)". Run (app 2a5f282e): comms 33 pass / 12 skip / 0 fail.
