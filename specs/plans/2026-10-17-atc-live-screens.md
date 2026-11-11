# 2026-10-17 — ATC suite, phase 2: the 14 live ATC screens + /viewUpgradedATC fix

Status: **LOCKED 2026-10-17** (operator). Decisions:
- **D1:** fix bugs **#1–#5** on the app branch (#1 Preview ATC Rework cross-db ref · #2 ATC Education Edit type
  `atc_alpha`→`alpha` · #3 ATC Education Validate cross-db ref · #4 View Triple preview link `atcid`→`atcdocid` ·
  #5 Pick-for-Mentoring `mentoring`→`mentoringid`). #6 (Edit Triple validation index) stays a known gap. The
  "Live Prescription link from Add Triple" item was DROPPED — `copyToClipboard()` is never called from the
  Add Triple template (dead code, not user-facing).
- **D2:** (a) readiness rule fix — prepared FIRST, for review, before any app/hub test work.
- **D3:** remove the hard-coded mentor check on /viewUpgradedATC — the dashboard configuration alone decides
  (verified: auth.guard.ts:36-44 grants access only from the route config's roles/profileid).
- **D4:** = D1 #2.
Phase 1 (prescribe / edit / view prescribed, 28 cases) shipped via offline-ATC → development (2026-10-15).

## 0. Rules carried over (unchanged)

- **ATC is tested against the EMULATOR ONLY** — never the development or production database (operator,
  2026-10-13). G1 (seed refuses without emulator hosts), G2 (abort + fail on real Firestore/Storage),
  G3 (emulator wiring proof) apply to every new case.
- Hooks: STATIC hooks → literal `getByTestId('…')`; BOUND/indexed hooks → `.locator(tid(…))` (readiness rule,
  journal 2026-10-13). Every new hook must be referenced by a spec.
- **Every spec file references at least one STATIC hook of its screen** (e.g. the screen's root/heading hook).
  The run-time half of the hub-ahead rule (D2) can only detect a not-landed feature through literal static
  hooks; a spec driven purely by bound hooks would still run — and fail — on branches without the feature.

## 1. Scope (operator, 2026-10-17)

IN — build tests for the 14 live screens:

| # | Screen | Route | Prefix |
|---|---|---|---|
| 1 | Preview ATC | /previewATC | `pva-` |
| 2 | Upgraded ATC (**fix first**, §3) | /viewUpgradedATC | `vua-` |
| 3 | View Participant ATC (no authGuard) | /view-participant-atc | `vpa-` |
| 4 | View Assigned ATC (Mark Changework Status) | /viewassignedATC | `vaa-` |
| 5 | ATC – Review/Flag | /reviewflagATC | `rfa-` |
| 6 | Add Review Notes (dialog, via #5) | — | `arn-` |
| 7 | Pick ATC for Mentoring | /pickformentoring | `pfm-` |
| 8 | ATC Education (trajectory) | /atctrajectory | `ate-` |
| 9 | Live Prescription | /liveprescription/:draft | `lrx-` |
| 10–13 | Triple ATC add / view / preview / edit | /addtripleATC /viewtripleATC /previewtripleATC /edittripleATC/:atc | `tra- trv- trp- tre-` |
| 14 | EI AI (AI generated ATC) | /viewaigeneratedatc | `eia-` |

OUT — leave as is (operator): ATC Generation Ops, ATC Usage Dashboard, Scope Enhancement Rubrics Scoring.
They stay excluded/uncovered; whoever next works on them adds their tests.

## 2. Findings that shape the plan

**/atctrajectory (ATC Education) — where it is used:** reached ONLY from the side menu ("ATC Education", 2 roles,
2026-06-02 menu snapshot). No in-app link, no Flutter or Cloud Function reference. It lists ATCs per QUEUE
(the queue mat-select lists ALL `queue generation` docs — the "ongoing queue" logic is dead code) and lets the
user Edit / Cancel / Validate / Unvalidate.

**Bugs found while mapping (≈45, full list in the journal).** Main-action breakers — a test of the main path
is RED until fixed:

| Screen | Bug |
|---|---|
| Preview ATC | "Mark for Rework" ALWAYS fails — writes an ATC-database reference into a default-database doc (SDK rejects cross-database refs); error swallowed |
| ATC Education | Edit opens the wrong collection (`atc_alpha` → maps to `atc_to_validate`); Validate with a selected validator throws (cross-database refs) |
| View Triple ATC | the Perceptual Position → preview link is broken (`atcid` vs `atcdocid`); the "ALL" participant filter crashes |
| Live Prescription | the link from Add Triple ATC can never resolve (points at `temporary_tripleatc`, screen reads `temporary_ATC`) |
| Pick for Mentoring | "Pick" never turns into "Picked" (`mentoring` vs `mentoringid`) → re-click creates a duplicate pick |
| Edit Triple ATC | existing-adjustment validation checks the wrong index |

Same "Close still validates" behaviour as VATC-05b exists on Review/Flag and ATC Education (validator optional).

## 3. Fix: /viewUpgradedATC (operator-approved)

Root cause (view-upgraded-atc.component.ts:54-58): the version doc, its `corrections` and `procedures` are read
through the DEFAULT Firestore handle, but versions live in `firestore-atc` → doc null → `null['atcref']` TypeError
→ the loading dialog never closes. Fix:
1. read `atcpath` + `corrections` + `procedures` via `getFirestore('firestore-atc')` (procedure NAMES stay on default);
2. null-guard: a missing version shows "ATC version not found" and closes the loading dialog;
3. close the loading dialog on any error.
Open question (§7 D3): the template shows content to **mentors only** (`profileRoles['mentor'] ? mentor||developer : false`),
while 6 roles can open the route and View Prescribed shows the version buttons to everyone.

## 4. Test cases (≈46)

Each case asserts what the APP wrote to / read from the emulator against an independent Admin-SDK read.

- **PVA** 01 renders ATC + adjustments/procedures/notes from `atc_to_validate` (type=validation) and `atc_alpha` (type=alpha) ·
  02 Activity Completed → `big participants assignments` status completed + summary · 03 ATC Validated → also ATC `status:validated` ·
  04 Mark for Rework → assignment `status:rework` + activitylog entry (**red until fixed**) · 05 empty notes blocks Completed/Validated.
- **VUA** 01 version button from View Prescribed opens the version (adjustments, procedures, authors) · 02 missing atcpath →
  "not found", no hang · 03 role visibility per D3.
- **VPA** 01 participant history grouped by product, alpha + "atc given" (Pending pill) · 02 View Full ATC expands adjustments/
  procedures · 03 no profileid → empty state · 04 embedded in Dynamic Studio v2 excludes the ongoing queue (if feasible on emulator).
- **VAA** 01 change agent sees only own assigned procedures; CA filter disabled · 02 super role filters by CA / participant ·
  03 Mark as Completed (agent + date) → `status:completed, last_activity` · 04 Mark as Auto-Generalized → `autogeneralized:true` ·
  05 Undo restores (`yet to start`, `last_activity:null`).
- **RFA/ARN** 01 tabs: Yet to Validate / Validated / Mandatory / Enhanced / Final with live counts · 02 Mark ATC as Validated
  (with validator; Close also validates — intended) · 03 each flag → `flagtype` + `flagcomment` arrayUnion; row moves tab ·
  04 ARN Close / empty Confirm writes nothing · 05 Edit ATC opens /editATC/<id>/alpha|validation.
- **PFM** 01 lists alpha + to-validate · 02 Pick For Mentoring → `pick_for_mentoring` doc + ATC `mentoringid` ·
  03 button shows Picked; no duplicate on re-click (**red until fixed**) · 04 Add Note → note + revision snapshot ·
  05 Validate ATC → `status:validated` + self as validator.
- **ATE** 01 select queue → participants of that queue · 02 participant → trajectory (editedfrom chain) + Consolidate View ·
  03 Cancel → `isdelete, status:cancelled` · 04 Unvalidate (alpha) · 05 Validate (to-validate) (**red until fixed** with a
  selected validator) · 06 Edit opens the correct collection (**red until fixed**).
- **LRX** 01 Prescribe's "Copy Link For Collaborators" link renders the draft live (participant, product, authors,
  adjustments, procedures, notes) · 02 updates live as Prescribe autosaves · 03 unknown draft → "deleted or yet to start".
- **TRA** 01 add 3 perceptual positions → `triple atc` (status atc given, positions, corrections numbered, procedures) ·
  02 required fields block (alerts) · 03 draft picker restores a `temporary_tripleatc` draft.
- **TRV** 01 list + Event/Participant filters (non-super forced to own) · 02 Edit ATC opens /edittripleATC/<id> ·
  03 Perceptual Position opens preview (**red until fixed**).
- **TRP** 01 renders the triple ATC · 02 ATC Validated → assignment completed + `triple atc status:validated` ·
  03 Mark for Rework → assignment rework + activitylog.
- **TRE** 01 edit adjustment text / delete / add procedure → new version (`editedfrom`), old `upgraded` ·
  02 directive edit · 03 mentor: Pick for Final ATC → `atc_alpha` created (`tripleatcfrom`), triple `validated`.
- **EIA** 01 latest version per participant listed; Validated / Unvalidated badge from `atcalpharef` ·
  02 New ATC opens /prescribeATC?docid&aigenerated=true and Prescribe pre-fills adjustments from the AI output ·
  03 developer View (forms from `firestore-forms`) + Edit → Save writes `output`.

## 5. Changes required

**App (new branch off development — operator creates it):** `data-testid` hooks on the 13 components (additive),
the §3 fix, and any bug fixes the operator approves in D1.
**Hub:** `_support/excluded-routes.ts` re-allow the 13 routes (keep `/viewrubrics_scoring_atc`); `atc` manifest
appPaths += the 13 folders + `view-ai-generated-atc/**`; seed additions (BIG assignments, triple atc + drafts,
pick_for_mentoring, ai_generated_atc_summary, firestore-forms formsByClient, queue for ATE); specs per screen.

## 6. Branch / readiness strategy — the "hub ahead of development" deadlock

Phase 1 hit it twice: hub-main tests for hooks that exist only on one app branch block every OTHER branch whose
diff brings that suite into scope (drift), and pulling the tests back blocks the app branch (SUITES_MISSING).
D2 decides how phase 2 avoids it.

## 7. Decisions for the operator (lock these)

- **D1 — bugs on main paths:** (a) fix the 6 main-action breakers in §2 on the same app branch so the suite can go
  green [recommended]; (b) tests assert correct behaviour and stay red until someone fixes them; (c) test only the
  paths that work today and list the rest as known gaps.
- **D2 — deadlock:** (a) **readiness rule fix** [recommended]: a selector counts as "gone from the app" only if the
  BASE (development) declares it and this diff removed it; a selector development never had is "not landed yet" —
  reported, not blocking. Fixes both directions permanently (hub lib + its unit tests). (b) Repeat phase 1: short
  window, coordinate with the team, merge fast.
- **D3 — /viewUpgradedATC visibility:** keep mentor-only, or show to the same roles that can open View Prescribed?
- **D4 — ATC Education Edit link:** fix the one-word type bug (`atc_alpha` → `alpha`) as part of D1?
