# 2026-10-13 — ATC suite: Prescribe / Edit / View (+ bulk Change Agent) and the offline-ATC rollout

Status: **LOCKED + IMPLEMENTED 2026-10-13** (operator: "Implement, run the test and provide the result").
Result: 25 cases, **24 pass / 1 fail** (EATC-07 — a real app bug, see journal), stable across two full runs.
Implementation notes + deviations: `specs/journals/2026-10-13-atc-suite.md`.

## 0. Hard rule (operator, 2026-10-13)

**NEVER test ATC against the development or production databases. Always seed into the emulator and
never query the real databases** — default DB *or* `firestore-atc`, for seeding, assertions, or
"just checking". Every step below is designed so that a mis-wired run FAILS rather than touching a
real database (see §3, guard G1–G3).

## 1. Rollout scope (what ships to production)

`offline-ATC` is 7 commits ahead of `development`, 0 behind; `development` is fully contained in
`production`. The offline-draft system is already live. The branch adds **one feature — bulk-assign
Change Agent** — to three components:

| Component | Change | Writes |
|---|---|---|
| `src/app/ATC/prescribe-atc` | one box per `assigned_to` activity above adjustments; "Apply to all procedures" overwrites `assignedMap[act]` on every procedure (after `confirm()`) | via existing `autoSave()` draft; submit unchanged |
| `src/app/ATC/edit-atc` | same box under NEW ADJUSTMENTS (only when ≥1 new adjustment); touches new-adjustment procedures only | draft + existing submit |
| `src/app/ATC/view-prescribed-atc` | inside an opened ATC, one row per activity with its own Submit; waits for all procedures; skips deleted + completed | **direct `writeBatch` to the live ATC**: `bigactivity` + `assigned_to` |

No CF, rules, index, or migration change. Operator has manually verified all three (2026-10-13).

Operator decisions:
- **`package-lock.json` (+271/−282, no `package.json` change) — KEEP.** Note: `package.json`
  is crossCutting but the lockfile is `neutral`, so it does not fan out suites.
- **Order: suite first, then ship.** Readiness reports `SUITES_MISSING` for `src/app/ATC/**`
  until the `atc` suite exists and is green against `offline-ATC`. Then `offline-ATC → development
  → production`.

## 2. App changes (starlabs-angular, ON `offline-ATC`)

| # | Change |
|---|---|
| A1 | `src/main.ts` emulator branch: `connectFirestoreEmulator(getFirestore(app, 'firestore-atc'), e.firestore.host, e.firestore.port)` — before bootstrap, next to the default-DB connect. Without it every ATC handle points at the REAL cloud DB (violates §0). |
| A2 | `data-testid` hooks — prefixes `patc-` (prescribe), `eatc-` (edit), `vatc-` (view), `atco-` (atc-option draft picker), `aael-` (atc-ael-confirm), `pabs-` (preview-atc-before-submission), `selv-` (select-validator), `dcfl-` (draft-conflict-dialog). Covers every interactive element the cases in §5 drive, **including the new bulk selects/buttons**, plus status text (draft status, "Loading procedures…/Applies to N"). Additive only. |
| A3 | `starlabs-angular/CLAUDE.md:31` — reword the absolute "never seed ATC" to the §0 rule (emulator only). |

## 3. Hub changes (this repo)

| # | Change |
|---|---|
| H1 | `_support/excluded-routes.ts` — remove `/prescribeATC`, `/editATC`, `/viewprescribedATC` only. All other ATC routes stay excluded. |
| H2 | `ci/overlay/environment.emulator.ts` + `firebase.emulator.json` — add the **Storage emulator** (main.ts already calls `connectStorageEmulator` when the key exists). Update the "`firestore-atc` intentionally never touched" note to "emulator only". |
| H3 | `suites-manifest.json` — new `atc` suite, `ciReady:false` until green. `appPaths`: `src/app/ATC/prescribe-atc/**`, `edit-atc/**`, `view-prescribed-atc/**`, `ATC/shared/**`, `ATC/atc-option/**`, `ATC/atc-ael-confirm/**`, `ATC/preview-atc-before-submission/**`, `ATC/select-validator/**`, `src/app/shared/atc-draft.*`, `src/app/shared/media-cache.service.ts`. Regenerate `SUITES.md`. |
| H4 | Playwright configs `playwright.atc.emulator(.evidence/.report).config.ts`, mirroring workshops. |
| H5 | `atc/seed-atc.js` — Admin SDK, **both** DBs (`getFirestore(app)` + `getFirestore(app,'firestore-atc')`), emulator only. |
| H6 | Fresh browser context per test (IndexedDB `atc_draft_cache` / `atc_media_cache` leak drafts); `page.route` stubs for `jsonplaceholder.typicode.com/posts` and `gstatic.com/generate_204`; `page.on('dialog')` for `alert`/`confirm`. |

**Emulator-only guards (enforce §0):**
- **G1** seed script refuses to run unless `FIRESTORE_EMULATOR_HOST` (and `FIREBASE_STORAGE_EMULATOR_HOST`) are set.
- **G2** every ATC spec's context aborts requests to `firestore.googleapis.com` and `firebasestorage.googleapis.com` and FAILS the test if any is attempted — catches a missing A1 instead of silently hitting a real DB.
- **G3** first spec asserts a seeded `firestore-atc` doc renders — proves the handle reads the emulator.

## 4. Seed (`atc/seed-atc.js`)

**Default DB:** admin spec user + eis-only spec user (`user_data`, `profile_data` with `user_ref`/`role_ref`,
role docs with `profile_ref`); a validator user (ah/mentor); `dashboard` grants for the 3 routes;
participant `profile_data` + `users_roles` (all with `name`); `atc model` `TestModel` (+`directive`; not
up!/big/lyl → skips the AEL query); `products`; `bigactivity` — author, observer, mentoring, and **two**
`assigned_to` activities (`docid` field = id); `procedures`; `procedure_recommend`;
`classify/adjustment_awareness`.

**`firestore-atc`:** `atc_alpha/A1` and `atc_to_validate/V1` (`status:'atc given'`), `type:'online'`,
`isdelete:false`, author refs; corrections with all three awareness fields; procedures (`name` =
DocumentReference) in **four states** — open, completed, deleted, legacy `assigned_to`-only; `atc_notes`.
No `temporary_ATC`/`temporary_edit_ATC` unless a case needs one.

## 5. Test cases

**Prescribe (`/prescribeATC`)**
- PATC-01 mount; non-admin/eis/transcriber/developer → redirected to `/`.
- PATC-02 happy path → DB: `atc_alpha` doc (`type:'online'`, `profileid`), `corrections/adjustment 01/procedures/adjustment 01 - 1`, `atc_notes`, `temporary_ATC.delete==true`.
- PATC-03 each required field blocks submit (nothing written).
- PATC-04 validation required → `atc_to_validate`, `status:'atc given'`.
- PATC-05 draft resume: "Draft saved." → reopen → picker → fields restored.
- PATC-06 **bulk apply**: disabled when empty; Cancel = no change; OK fills that activity on every procedure, other activity untouched; later-added procedure empty; after submit every procedure's `bigactivity[act]` == selection.
- PATC-07 media: audio file input + note image + ATC image → files in Storage emulator, URLs on `atc_notes`/ATC.
- PATC-08 conflict dialog: bump draft `rev` in emulator → local edit → dialog; "keep this" wins, loser in `temporary_ATC/{id}/conflicts/{rev}`.

**Edit (`/editATC/:atc/:type`, direct goto)**
- EATC-01 mount, seeded ATC loads.
- EATC-02 edit existing awareness/years → old doc `upgraded`/`isdelete`/`upgradedto`; new doc `editedfrom`; `temporary_edit_ATC.delete==true`.
- EATC-03 add adjustment + procedure → `newlyadded:true`.
- EATC-04 `/validation` reads/writes `atc_to_validate`.
- EATC-05 incomplete adjustment blocks save.
- EATC-06 **bulk apply**: box hidden until a new adjustment exists; Apply changes new-adjustment procedures only; after save, saved procedures + new procedures under existing adjustments unchanged.
- EATC-07 media (audio / images) → Storage emulator.
- EATC-08 conflict dialog on `temporary_edit_ATC`.

**View (`/viewprescribedATC`)**
- VATC-01 list renders seeded alpha + to-validate rows; summary counts == DB.
- VATC-02 participant / model / date filters narrow the list.
- VATC-03 View Full ATC shows adjustments + procedures.
- VATC-04 Edit ATC opens `/editATC/<id>/alpha` in a new tab.
- VATC-05 Mark as Validated: (a) pick validator → Submit → `status:'validated'`, `validator` set, row leaves list; (b) **Close without a validator also validates** — validator is optional (operator, 2026-10-13: intended behaviour, not a bug).
- VATC-06 eis-only user sees only own-authored ATCs; Author filter disabled.
- VATC-07 **bulk Change Agent**: "Loading procedures…" → "Applies to N" (N excludes deleted + completed); Submit → eligible procedures have that activity replaced and `assigned_to` == union; other activity, completed, deleted untouched; legacy `assigned_to`-only mapped under first activity; selection clears.

## 6. Known app bugs found while mapping (report only — NOT in scope)

1. `/viewUpgradedATC` reads ATC paths from the default DB → crashes (version history broken).
2. Edit spinner never clears when the ATC has 0 corrections.
3. Edit final batch `update`s `temporary_edit_ATC` → whole save fails if autosave never created the draft.
4. `eit-education-atc` passes type `atc_alpha` → falls through to `atc_to_validate`.
5. Edit big-mode assignment fields added after `batch.set` → never written.
6. Prescribe reads `ah` from `roleData['eis']`.

## 7. Order of work

1. A1 + H2 + G1–G3 (emulator wiring and guards) → prove G3 green before anything else.
2. H5 seed, H1, H3, H4.
3. A2 hooks (offline-ATC), A3.
4. Specs: View → Prescribe → Edit (View first: read-mostly, proves the seed).
5. Suite green against offline-ATC → `ciReady:true` → PR offline-ATC → development → production.
6. Journal `specs/journals/2026-10-13-atc-suite.md`.
