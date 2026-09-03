# 2026-09-03 — Closing the 4 uncovered Events routes (branch `manoja` / app `manoja-development`)

**Scope:** `starlabs-e2e-tests` only (hub repo, branch `manoja`). No app-repo changes — the Angular
app (`manoja-development`) was read-only research for this session; nothing there needed a fix.

**What shipped:** 4 new spec files covering the routes the coverage map (2026-09-03 artifact) flagged
as never opened by any test — `events-stage-data`, `event-participation-confirmation`, `locationlog`,
`live_event_dashboard_v3` — plus the seed data, support helpers, and recon-doc entries they depend on.
Followed the same recon-first / seed / helpers / read-then-write ordering the comms channel-templates
work established, applied to a harder case (a genuinely read-only screen, an accidental missing guard,
and a route that partially — not wholly — touches the ATC database).

---

## 1. The decisions, and why

| # | Decision | Why |
|---|---|---|
| D1 | Recon doc (`recon-allcomp/events-arena.md`) updated BEFORE the specs shipped, not after | Every existing events spec cites `// Recon: e2e/recon-allcomp/events-arena.md (EVT-xx)` at its header — the doc is the thing a reviewer reads, not 2600 lines of `live-event-dashboard-v3.component.ts`. The new specs cite it too (`ESD-01`, `EPC-01/02`, `LOC-01/03`, `LED3-01/02`). |
| D2 | `live_event_dashboard_v3` is a **partial** ATC exclusion, not a route exclusion | First pass added the whole route to `_support/excluded-routes.ts`. Operator correction: identify the exact function(s) touching `firestore-atc` and cancel only those, not the screen. Traced it to 3 functions (`subscribeToAtcAlpha`/`AtcToValidate`/`DraftAtc`), both called only from `subscribeToArenaOverview()`, itself called only from `selectEvent()` and `toggleQueue()`. The route was un-excluded; the 3 functions stay permanently untested. |
| D3 | A runtime guard (`assertNoProjectWideOngoingQueue()`), not a code comment, keeps LED3 off `firestore-atc` | `selectEvent()`'s queue auto-selection falls back to `ongoingQueues[0]` — the first "ongoing" queue **project-wide**, an unfiltered scan of the whole shared test project. Whether opening our own seeded (always-"ongoing") EVENT1 reaches `firestore-atc` depends on ambient state this file cannot see in advance. The guard reproduces the app's own "is this queue ongoing" predicate against the live project and **throws** — fails loudly — if any exists, before ever navigating. A skip would have hidden the risk; a throw makes it visible every run. |
| D4 | EPR2 — one "prove the filter" doc, shared by 3 screens | Mirrors comms' `delete:true` channeltemplates row. ESD-01/EPC-01/LED3-01 each assert an "Approved"/"registered" COUNT computed client-side from a status filter. Without a same-arena/same-event doc that *fails* that filter, a test asserting "== 2" can't tell "the app filtered correctly" from "the app returns everything it streamed." One `status:'requested'` EPR, reused across all three assertions, does the job. |
| D5 | EPR7's `arenaeventid` is deliberately `null`, not `ARENAEVT1` | LED3-02 needed a dedicated registered+ticketed participant (p7) distinct from p0 (whose `ETICKET_P0` belongs to the QR-scan deep-suite cases). `mkEpr()` hardcodes `arenaeventid:ARENAEVT1` — left as-is, EPR7 (status:'approved') would have silently bumped ESD-01/EPC-01's `arenaeventid`-scoped oracles from 2 to 3. Nulled it out; LED3's own oracle filters by `eventref` only, so it's still counted where it needs to be. |
| D6 | Read-path and write-path specs live in separate `test.describe` blocks per file, read first | Same ordering comms used: read-path (no dialog handling, fastest to a first green run, proves seed+login+emulator wiring) before write-path (needs a verified dialog strategy). `events-stage-data.spec.ts` documents explicitly that it has NO write-path tier — the component makes zero Firestore writes, confirmed by reading the whole file, not assumed. |
| D7 | Every write-path test states, in a comment, whether its confirm is native or Material | The trap: `page.on('dialog')` is required for a native `window.confirm()`/`prompt()` — Playwright auto-dismisses an unhandled one, the write silently no-ops, and a test that only checks "no thrown error" passes anyway (false green). Grepped every one of the 4 target components for `window.confirm`/`window.prompt` before writing each write-path case, not from memory of an earlier summary. Result: EPC's Approve/Revoke/Finalize and LOC's delete are all Material dialogs (no handler needed); LED3's "Mark attendance" is the one **native** `window.confirm(...)` across all four screens, and `LED3-02` arms `page.once('dialog', d => d.accept())` before the click. |

## 2. What shipped, file by file

| File | Cases | Notes |
|---|---|---|
| `events/events-stage-data.spec.ts` | ESD-01 (+ mount smoke) | Read-only screen (config → `localStorage`, zero Firestore writes) — no write-path tier by design. |
| `events/event-participation-confirmation.spec.ts` | EPC-01 (read), EPC-02 (write) + mount smoke | EPC-02 approves the sole "Eligible" owner (p6); Material dialog. |
| `events/locationlog.spec.ts` | LOC-01 (read), LOC-03 (write) + mount smoke | `/locationlog` has NO `canActivate` guard — flagged as a likely-accidental app bug, not "fixed" by seeding a grant that would imply one exists. Only the "All logs" tab is exercised; the Live-tracking picker's Nominatim/Leaflet dependency has no stub in this repo yet and is explicitly out of scope. |
| `events/live-event-dashboard-v3.spec.ts` | LED3-01 (read), LED3-02 (write) + the ATC guard | See D2/D3. LED3-02 is the native-dialog case (D7). |
| `events/seed-events.js` | — | +2 routes granted (`events-stage-data`, `event-participation-confirmation`; `locationlog` deliberately not granted), +participant metadata (p0/p1/p6/p7), +`journey` doc, +`participantsproduct` (PP_EPC), +`productToDeliverySequence` (PTDS_EPC), +EPR2/EPR7, +`arena e-ticket` (ETICKET_P7), +`locationlogs` (LOCLOG1). |
| `events/support/events.ts` | — | New ids/actors for the above + `resetPpEpc()`, `resetLed3MarkForP7()`, `ensureLocationLog()` (from the prior session) — each a precondition-only reset, asserting nothing itself. |
| `_support/excluded-routes.ts` | — | Net change: unchanged from before this session (added then reverted for `live_event_dashboard_v3` — see D2). |
| `recon-allcomp/events-arena.md` | — | Routes/collections/flows/seed-requirements/candidate-cases/ATC-exclusions/risks sections all extended with a `2026-09-03` addendum, additive only — the original 11-route recon is untouched. |

## 3. Step 6 — ran green (2026-09-03, same session, native Windows: firebase-tools + Java, no WSL2)

All 10 cases across the 4 new files pass together, repeatably, against a real Firestore+Auth emulator
and a real `ng serve --configuration emulator` build:

```
events/events-stage-data.spec.ts               ESD-01 + mount smoke .............. ok
events/event-participation-confirmation.spec.ts EPC-01, EPC-02 + mount smoke ...... ok
events/locationlog.spec.ts                      LOC-01, LOC-03 + mount smoke ...... ok
events/live-event-dashboard-v3.spec.ts          LED3-01, LED3-02 .................. ok
10 passed (1.5m)
```

It did **not** go green on the first, second, or third attempt. Six real bugs surfaced, each fixed and
re-verified against the live emulator (never guessed from re-reading source — every one was confirmed
either from the Playwright failure's own accessibility-tree dump or by driving the app directly with a
browser tool against the same running emulator):

| # | Bug | Root cause | Fix |
|---|---|---|---|
| B1 | `/live_event_dashboard_v3` → "Contact Admin" dialog, both LED3 tests blocked | Forgot to add the route to `ROUTES` in `seed-events.js` — it has `canActivate:[authGuard]` (unlike `/locationlog`), so it needs a `dashboard` grant like every other guarded route. | Added the route entry. |
| B2 | EPC-02: p6's row never rendered | Wrong segment assumption — p6 (owns P1, no request) lands in **"Not requested"** (count 1), not "Eligible" (count 0). Both segments enable `selectionMode:'approve'` in the component; I'd picked the empty one. | Clicked "Not requested" instead, verified live. |
| B3 | EPC-02: clicking the "Delivery sequence" `mat-select` timed out | The mat-form-field's floating `<mat-label>` sits over the trigger and intercepts the click (a CDK-overlay quirk) — same class of issue the pre-existing EVT-09 case already works around. | `click({force:true})`, matching the established EVT-09 pattern. |
| B4 | LED3-01/02: hero showed the wrong participant's data ("0" / wrong event) | `init()` auto-selects `ongoingEvents[0]` — **not necessarily EVENT1**. EVENT2 ("TEST Initiate Event evt", the EVT-10/11 deep-suite's own event) is *also* "ongoing" today and has a *later* `end_date`, so it sorts first in the app's own `orderBy('end_date','desc')` query and wins. A real, previously-unknown fact about this seeded world, not a flaky selector. | Explicitly click EVENT1's chip every time; never rely on auto-select. |
| B5 | Same fix, still flaky: clicking EVENT1's chip appeared to succeed, then silently reverted to EVENT2 | A race: the chip's `.active` class binds to `selectedEvent` (set synchronously early in `selectEvent()`), but `init()`'s own `await selectEvent(ongoingEvents[0])` call was still in flight when the test's click fired its own `selectEvent(EVENT1)` — whichever resolved last won. | Wait for the *initial* `.chip.active` to appear (proving init()'s own call already landed) before clicking EVENT1's chip. |
| B6 | LED3-02: the "Unattended · Today" drill-down opened but always listed **0 participants**, even though the underlying data was provably correct seconds later | `openAttAbsent(day)` takes a plain-array **snapshot** of `day.absentProfileIds` at click time (`openPanelRows`) — an already-open panel never reactively refreshes. But `absentProfileIds` is only corrected by `subscribeToAttendance()`'s own async `arena e-ticket log` Firestore snapshot, a **separate, later** round-trip than the one the hero-number wait (B5's fix) already covered. Re-clicking the stat and retrying (`toPass`) for 45s still failed — waiting on the wrong signal for that long doesn't help. | Polled the component's own live state directly (`window.ng.getOwningComponent(...).data.dayWiseAttendance`, available on this dev build) for "today's `absentProfileIds` includes p7" *before* ever clicking "Unattended". Confirmed live via the same introspection that the data was genuinely correct once the wait passed. |
| — | (not a bug, a real interaction) `EPC-01`/`ESD-01`/`LED3-01`'s hardcoded "approved == 2/3" precondition asserts started failing once `EPC-02` had run for real in the same seeded world | `EPC-02` writes a real, permanent 4th approved EPR for p6 with a fresh auto-id and **no `testrunid`** — reseeding can't sweep it, so it persists across runs and files. Not a bug in either test; a genuine cross-spec interaction inside one shared seed. | Changed the exact-equality precondition checks to floors (`toBeGreaterThanOrEqual`), and re-derived the "prove the filter" assertion (`totalEprForArena === approvedOracle + 1`) to stay exact against *whatever* the approved count is at run time — the UI-vs-oracle comparison itself was always exact and never needed to change. |

`#panelList` (cited in the component's own source comment, `@ViewChild('panelList')`) turned out to be
an **Angular template-ref variable, not an HTML `id`** — confirmed by querying the live DOM
(`document.getElementById('panelList')` → `null`; the real container is `.panel.open`). Folded into B6's fix.

**Regression check** — reran the pre-existing `events.spec.ts` + `eticket.spec.ts` against the same
modified seed to make sure nothing here broke them: 2 of 6 pre-existing cases fail
(`EVT-05`, `EVT-03/04`), **traced to causes unrelated to this session's changes**:
- `EVT-05`'s "Approve" button is gated by `arena-e-ticket-approve.component.ts`'s `canApprove()`,
  which reads a per-EPR `e-ticket eligibility` collection ("mirrored from Watson," per the component's
  own comment) — `seed-events.js` has never seeded that collection, before or after this session's
  edits. Confirmed by reading the component source directly; nothing this session touched is on that
  code path.
- `EVT-03/04`'s "Mark as Attended" button is gated purely by a client-side `SelectionModel`
  (`*ngIf="attendanceselection.selected.length != 0"`), with zero dependency on participant metadata,
  eligibility, or any collection this session added to.
Both are flagged as **pre-existing gaps**, not regressions — out of scope for this session, not fixed.
`events-deep.spec.ts` was not rerun (long-running, exercises deep-suite flows this session never touched).

## 4. What's still open

- **`live_event_dashboard_v3`'s ATC-adjacent card, Customer Support, Arena Calling send, Zones view,
  and CSV exports remain unopened.** LED3-01/02 cover the hero count and the one native-dialog write;
  the rest of this 2600-line component is still untested. Tracked, not started.
- **`locationlog`'s missing route guard is an app bug, not a test gap** — worth a ticket against
  `app.routes.ts` line ~146, not a test-suite fix.
- **`EVT-05` / `EVT-03/04` (pre-existing, see §3) need their own follow-up** — likely a missing
  `e-ticket eligibility` seed (Watson-mirrored: `venue_fee_paid`, `zohostatus`, `exempted`, keyed by
  `eventparticipationid`) for EVT-05, and closer investigation of the checkbox-selection path for
  EVT-03/04. Not attempted here — flagged, not fixed, to avoid silently expanding this session's scope.
- Re-run `scripts/check-route-coverage.mjs` (or the manual filesystem cross-check this session's
  earlier turns used, since that script doesn't currently exist in this checkout) to confirm `events`
  moves from 8/12 to 11/12 (12/12 is not reachable — `live_event_dashboard_v3`'s ATC-adjacent surface is
  permanently out of scope by operator rule, not a gap).
- Local environment notes for whoever runs this next: `firebase.emulator.json` + the Angular
  `environment.emulator.ts`/`angular.json` emulator config were staged via
  `APP_PATH=<angular repo> bash ci/setup-emulator-config.sh` (idempotent, safe to rerun). The hub's
  `node_modules` was empty on this machine and needed `npm install` first. Port 4200 was occupied by an
  unrelated pre-existing `ng serve` (left untouched) — the emulator-wired app ran on 4201 instead
  (`BASE_URL=http://localhost:4201`, `EMU_REUSE_APP=1` so Playwright's own webServer step doesn't try
  to also bind 4200).

Related: [[never-touch-firestore-atc]] (operator memory), the coverage-map artifact this session
started from (2026-09-03, StarLabs E2E Coverage Map).
