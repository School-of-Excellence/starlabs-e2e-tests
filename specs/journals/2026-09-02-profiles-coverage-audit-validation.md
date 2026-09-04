# Profiles coverage audit — validation pass
Date: 2026-09-02
Type: findings (validation of `2026-09-02-profiles-coverage-audit.md`)
Scope: **profiles suite only.** No cross-suite claims except where the profiles glob leaks.

App:   organization-starlabs-angular/starlabs-angular @ development 06e435c3
Specs: starlabs-e2e-tests @ main — `profiles/` (8 spec files)
Method: deterministic filesystem enumeration + grep. Nothing executed (no node_modules; the bash
harness needs WSL2). Every number below is `[GROUND]` unless marked otherwise.

---

## 1. What the prior audit got right — validated

| Claim | Verdict | Evidence |
|---|---|---|
| 13 routed screens under the glob | OK | `app.routes.ts` — 13 `loadComponent` entries resolve under the glob |
| 23 declared cases | OK | 23 `test(` / `test.fixme(` across 8 spec files |
| 20 of 23 execute in the gate | OK | 23 − PA-13(skip) − PA-14(skip) − PA-FT-FILT(fixme) |
| PA-13 / PA-14 skip on the emulator | OK | `analytics.spec.ts:98`, `view-form-deep.spec.ts:33` — named-DB limitation |
| PA-FT-FILT is parked | OK | `form-tracker-deep.spec.ts:51` `test.fixme` |
| `/profilelist` absent from seeder ROUTES | OK | `seed-profiles.js:101-113` — 8 routes, profilelist not among them |
| `journey.appPaths` excludes the 3 PPM screens | OK | manifest: `Journey Onboarding/**`, `journey-onboarding-detail/**` only |
| analytics opens 21 dialogs | OK | 21 distinct `dialog.open(` targets |
| prod firewall is installed for profiles | OK | `profiles/support/profiles.ts:13,59` |
| Per-screen LOC figures | OK | within ±0.3% (the audit appears to have added the `.scss`; direction unaffected) |

---

## 2. Where the prior audit is wrong or understated

### V-01 — Surface area undercounted by ~45%
The audit counted **18 components** (13 routed + 5 dialogs) and **20,083 LOC**.

```
GROUND (find + wc over the glob):
  components under the glob ......... 38       (audit: 18)
  total LOC (ts+html) ............... 36,713   (audit: 20,083)
  distinct (click) handlers ......... 373      (audit: 157)
  dialog.open targets ............... 41       (audit: 36)
```

The audit's routed-13 subtotal is sound (20,031 LOC / 182 handlers — it undercounted handlers by
25 there too). What it never enumerated is the **20 nested components under
`participants-analytics/`**, holding 16,682 LOC and 191 handlers. See §3.

### V-02 — The 5 Cloud-Function cases are missing from the matrix
`metadata-cf.spec.ts` (PA-CF-01/02/03) and `metadata-cf-deep.spec.ts` (PA-CF-04/05) are counted in
the "23 declared cases" total but appear in **no row of the coverage matrix**, and the suite's
declared `cfPaths: functions/components/participantmetadata.js` is never assessed.

Consequence: the headline **"Writes asserted: 1 in CI" is wrong.** Neither CF spec carries a skip
guard, and `makeEmulatorConfig` uses `testMatch: '**/*.spec.ts'`, so all five are collected.

```
Write-path assertions COLLECTED for the emulator gate:
  PA-03      UI  -> participant metadata.customerstatus        1
  PA-CF-01   CF  -> participant metadata.name                  1
  PA-CF-02   CF  -> participant metadata.customerstatus        1
  PA-CF-03   CF  -> participant metadata.activeproduct[]       1
  PA-CF-04   CF  -> activeproduct[] -> consumedproducts[]      1
  PA-CF-05   CF  -> productcount map                           1
                                                    TOTAL  =   6   (audit said 1)
```

The accurate statement is: **one UI-driven write** and **five CF-output writes** — subject to §6's
open question about whether the CFs are in the emulator deploy set.

### V-03 — G-01's proposed fix does not work
The audit's "one line unblocks four cases" is false for the two delete/role cases.

`profilelist.component.ts:352-386` — `deleteProfile` runs **ten pre-flight guard queries across
three databases** before it will delete anything:

```
getFirestore()                 -> appointments, Roles-To-EIS, journeyproductpurchase,
                                  participantsproduct, EISzoomcontact, aggregate_EITParticipant,
                                  aggregate_ReviewParticipant, availability, events_profiles
getFirestore("firestore-atc")  -> atc_alpha        <- named DB
getFirestore("firestore-forms")-> formsByClient    <- named DB
```

`firestore-atc` and `firestore-forms` are **named databases** — the identical limitation that
already skips PA-13 and PA-14. On the emulator those queries deny, the promise rejects, and
`deleteProfile` never reaches its `confirm()`. It also gates on a native `confirm()` and an
`alert()`, so any test needs a `page.on('dialog')` handler.

**PA-19 as specified would not pass on the gate.** Adding the route grant is still correct — it
unblocks *rendering* profilelist and the `updateRole` path (default DB only) — but the delete case
is blocked by the same named-DB wall as G-02, and the audit did not connect the two findings.

### V-04 — "Three hardcoded production CF URLs" -> 28 URLs, 8 endpoints, 3 files

```
participants-analytics.component.ts        12 URLs  sendBatchEmail, sendWhatsAppBroadcast,
                                                    workshopprogressmessage (x3 project variants)
wati-input/wati-input.component.ts          2 URLs  sendwhatsappbroadcast (Cloud Run)  <- see N-01
updateprofile/updateprofile.component.ts   12 URLs  updateprofilebio (salescrm/watson,
                                                    test + production)
```

### V-05 — G-10 overstates the route-grant drift
`seed-profiles.js:100` documents this on purpose: *"The authGuard matches by FIRST path segment
only."* The grants for `/userprofile` and `/profilesummary` are correct **by design**, not drifted.
`route-mount.spec.ts:16-18` restates it. This is a note, not a finding.

### V-06 — route-mount.spec.ts walks 7 routes; the seeder grants 8
`/participant-evolution-summary` is granted at `seed-profiles.js:111` but is **not** in the smoke's
ROUTES array (`route-mount.spec.ts:15-23`). PA-EVO-01 reaches that screen via a localStorage
payload, so nothing in the suite proves that grant actually admits. A silent drift between seeder
and smoke that will grow with every added route.

---

## 3. Gaps the prior audit missed entirely

### N-01 · P0 · The prod firewall does not cover Cloud Run hosts — a live safety hole

`wati-input.component.ts:161-162`:

```
https://sendwhatsappbroadcast-rhdwzw46ya-uc.a.run.app
https://sendwhatsappbroadcast-kakybqnyrq-uc.a.run.app
```

Every pattern in `_shared/prod-firewall.ts:19-27` is anchored on `cloudfunctions.net`, including
the catch-all `/https?:\/\/[a-z0-9-]*-(?!slabs-queue-e2e-exdcz)[a-z0-9-]+\.cloudfunctions\.net/i`.
A `*.a.run.app` host matches **nothing** -> `route.continue()` -> the request leaves the harness.

These are 2nd-gen Cloud Functions. Driving `wati-input.onSubmit` would **send a real WhatsApp
broadcast to production recipients**. Latent today only because no test opens that dialog — and the
prior audit's own recommendation PA-29 ("drive a broadcast / email action") is precisely what would
trip it.

This is a harness safety defect, not a coverage gap. Fix it before any analytics broadcast test.

**Fix (fence, not filter).** Add to `PROD_PATTERNS`:

```ts
/https?:\/\/[a-z0-9-]+-[a-z0-9]{10}-[a-z]{2}\.a\.run\.app/i,   // 2nd-gen CF / Cloud Run
/https?:\/\/[a-z0-9-]+\.run\.app/i,
```

and flip the default to **deny-unknown-host**: allow the test project + localhost, block the rest.
Today's allowlist-of-known-bad-hosts fails open on every host nobody thought of.

### N-02 · P0 · manage-participantlist-dialog — profile MERGE / DE-MERGE, 2,802 LOC, zero tests

The **second-largest artifact in the entire glob**, never named in the audit.

```
1,739 ts + 1,063 html = 2,802 LOC   29 handlers
writes: 7 setDoc · 7 updateDoc · 1 deleteDoc
collections: participant list, participant_list_log, profile_data,
             queue generation, queue planning
handlers include: mergeProfiles · deMergeProfiles · confirmMergeWithSelection ·
                  confirmDeMerge · removeConflictingProfile · deleteList ·
                  addProfileToList · removeProfileFromList · exportLiveLists
```

Profile merge is identity-destructive and writes `profile_data`. A defect here corrupts participant
identity across every other system. Reached from analytics via `managelist`.

### N-03 · P0 · create-segments-dialog — 1,711 LOC, 24 writes, zero tests

```
1,087 ts + 624 html   17 handlers
writes: 11 setDoc · 11 updateDoc · 1 deleteDoc · 1 writeBatch
collections: segments, participant list, participant tags, participant_list_log
handlers: onCreateSegment · deleteSegment · addListToSegment · removeListFromSegment ·
          addTagToSegment · removeTagFromSegment · saveSegmentName
```

### N-04 · P1 · ah-notification — 1,440 LOC, all four write ops, zero tests

```
984 ts + 456 html   13 handlers
writes: 2 addDoc · 2 setDoc · 4 updateDoc · 1 deleteDoc
        (the only component in the glob that uses every Firestore write primitive)
handlers: sendNotification · sendFromTable · scheduleFromTable · saveRowScheduleFromForm ·
          deleteTable · saveNotification · editNotification
collections: profile_data, savednotifications
```

It **sends** — the same blast-radius class as the WATI paths.

### N-05 · P1 · Seed data, not route grants, is the binding constraint

`seed-profiles.js` writes **11 collections**:
`appflowbreaks · ask AH · formsByClient · journey · love letter · package · participant metadata ·
participantjourneyproduct · participantsproduct · products · profile_data`
(plus the auth chain: `user_data`, `users_roles`, `dashboard`).

The untested surface reads **~30 more that are never seeded**:

```
profile-summary        clientissue · fullfillmentchallenges · appointments
manage-participantlist participant list · participant_list_log · queue generation · queue planning
create-segments        segments · participant tags
ah-notification        savednotifications
tag-participants       participant tags · participant tag logs
wati-input             wati templates · wati archive · workshopconfiguration · profiles
add-purchase           journey-to-product · journeyproductpurchase
profilelist            atc model · starlabs roles · Roles-To-EIS · atc_alpha · EISzoomcontact ·
                       aggregate_EITParticipant · aggregate_ReviewParticipant · availability ·
                       events_profiles
userprofile_old        clientissue · deliverables · eiflix workshop event collection ·
                       evolutionmappingvideo · interim crossover · interimreport log ·
                       post_categories · Achievements/posts/postcollection · queue generation
```

Adding a route grant makes a screen *reachable*; it does not make it *testable*. Every case beyond
render-smoke needs a seeder extension first. The audit's PA-21/PA-22 survive this test — both write
`profile_data`, which **is** seeded — a further reason to do them first.

### N-06 · P1 · Analytics reaches four components OUTSIDE the glob (the inverse of G-05)

`participants-analytics.component.ts` imports and `dialog.open`s:

```
AddPendingActionComponent        -> src/app/AppEngagement/app-action-pending/...
LoadingProgressComponent         -> src/app/loading-progress/...
SendmessagesComponent            -> src/app/New-Workshop/workshop-dashboard/sendmessages/...
WhatsappProgressDialogComponent  -> src/app/New-Workshop/whatsapp-progress-dialog.component.ts
```

None match `profiles.appPaths`. Editing any of them can break analytics **without CI running the
profiles suite**. G-05 found the outbound leak (profiles code owned by journey's tests); this is the
inbound one (analytics behaviour owned by other suites' paths).
`LoadingProgressComponent` is opened by 5 of the 13 routed screens.

### N-07 · P2 · 37 Angular karma specs live in the glob — all scaffolds

```
find ... -name '*.component.spec.ts'  -> 37 files
files with more than one it()          ->  0
```

Every one is the CLI default (`it('should create', ...)`). They match the profiles glob, so they
inflate the file count and read as coverage in any file-based summary. Either write them or exclude
`**/*.component.spec.ts` from `profiles.appPaths` so the count means something.

### N-08 · P2 · Two non-component files in the glob with logic and no test

```
participants-analytics/data-transfer.service.ts   (cross-dialog state carrier)
app-flow-breaks/filterpipe.ts                     (the pipe PA-15 / PA-AFB-FILT render through)
```

### N-09 · P2 · The honest interaction number

The whole suite performs **17 user-interaction call sites** (`click` / `press` / `fill` / `check` /
`selectOption`), of which **14 execute in the gate** (2 in PA-FT-FILT are fixme, 1 in PA-14 skips).

```
17 call sites  /  373 distinct handlers in the glob  =  4.6% of the interactive surface
14 executing   /  373                                =  3.8% in the CI gate
```

PA-07, PA-10, PA-11, PA-13, PA-EVO-01, PA-PS-01 and route-mount perform **zero** interactions — they
navigate and assert a render. A legitimate shape, but it means 7 of 23 cases cannot catch a broken
handler.

### N-10 · P2 · Firewall coverage of updateprofile is by hostname, not by rule

`updateprofile.component.ts` hits `salesleadcrm` and `watsonproduction-becde` — both **are** caught,
but only because someone listed those exact strings in `PROD_PATTERNS`. Same fragility as N-01,
currently benign. The deny-by-default fence in N-01 fixes both.

---

## 4. Corrected priority order

| # | Action | Type | Why here |
|---|---|---|---|
| 1 | Extend `PROD_PATTERNS` for `*.a.run.app` / `*.run.app`; move to deny-unknown-host | **safety** | N-01 — a real WhatsApp send is one test away |
| 2 | Exclude `**/*.component.spec.ts` from `profiles.appPaths` | config | N-07 — makes every count honest |
| 3 | Add the 3 PPM paths to `journey.appPaths` | config | G-05 — existing coverage starts firing |
| 4 | Add the 4 out-of-glob analytics dialogs to `profiles.appPaths` | config | N-06 — closes the inbound leak |
| 5 | Add `/profilelist` to `seed-profiles.js` ROUTES | config | G-01, **for render + updateRole only** |
| 6 | Add `/participant-evolution-summary` to `route-mount.spec.ts` | 1 line | V-06 |
| 7 | PA-21 / PA-22 — profile-summary general + private notes | test | writes `profile_data` (seeded); ~20 lines each |
| 8 | PA-28 — view-participants-form `saveNotes` on the default DB | test | G-02's cheapest CI-safe fix |
| 9 | PA-20 — profilelist `updateRole` -> `users_roles` | test | default DB only, so it can actually pass |
| 10 | Record the PA-13/14 CI blind spot in `suites-manifest.json` | config | G-02 — green must mean one thing |

**Deferred, and why:** PA-19 (profilelist delete) until the named-DB story is resolved — see V-03.
Every analytics dialog case until the seeder covers its collections — see N-05.

---

## 5. What was wrong in the prior pass

- Enumerated from routes, not from the filesystem — the exact failure
  `[[enumerate-from-filesystem-not-docs]]` records. Missed 20 components, 16,682 LOC, 191 handlers.
- Reported "1 write asserted in CI" without reading `metadata-cf*.spec.ts`. The real figure is 6.
- Proposed PA-19 without checking that `deleteProfile` queries two named databases — it would not
  have passed, and the audit had documented that exact limitation two findings earlier.
- Said "three hardcoded prod CF URLs" from one file's grep. There are 28 across three files, and the
  two that matter most are not `cloudfunctions.net` at all.

## 6. Open questions for the next session

- Does the emulator deploy set actually include `functions/components/participantmetadata.js`?
  `scripts/deploy-cf-emulator.sh` does not name it. If not, PA-CF-01…05 fail (or hang to the 60s
  `CF_TIMEOUT`) in the gate and the six-write figure collapses back toward one. **[UNKNOWN]**
- Is `userprofile_old` live or dead? It is routed, writes (`updateDoc` + `writeBatch`), reads 15+
  collections, and has no test. G-08's "decide, then act" still stands. **[UNKNOWN]**
- Does the `firestore-atc` named DB exist in the emulator at all, or does it deny like
  `firestore-forms`? This decides whether profilelist is ever gate-testable. **[UNKNOWN]**

## 7. Artifacts

- This journal.
- No code changed in either repo.

---

# Addendum — edits applied, same session

Operator answered the three open questions and approved items 1-6. What landed:

## Locked decisions

**D-A · `firestore-atc` is out of bounds, permanently.**
Operator: *"dont touch that db firestore-atc skip this we never touch that db."*
Consequence: **PA-19 (profilelist Delete Profile) is cancelled, not deferred.** `deleteProfile`
pre-flight-queries `atc_alpha` on the `firestore-atc` named DB, so it can never be driven by a test
under this constraint — independent of the emulator's multi-db limitation. profilelist is a
render + `updateRole` target only.
Verified safe: `getFirestore("firestore-atc")` occurs ONLY inside `deleteProfile`
(profilelist.component.ts:352, enclosing fn line 324). The mount path reads a collection named
`atc model` on the **default** database (line 152) — unrelated to the named DB. Adding
`/profilelist` to the route-mount smoke does not open it.

**D-B · `userprofile_old` is not live.**
Operator: *"that one is not live now."* G-08 resolves: it is dead code that is still routed at
`/userprofile_old` behind authGuard and still calls `updateDoc` + `writeBatch`. Recommended follow-up
(NOT applied — app-repo deletion needs its own approval): remove the route at `app.routes.ts:32` and
the `userprofile_old/` folder. That drops 1,573 LOC from the profiles glob and closes the finding.

**Still [UNKNOWN]:** whether `functions/components/participantmetadata.js` is in the emulator deploy
set. `scripts/deploy-cf-emulator.sh` still does not name it. V-02's six-write figure depends on it.

## Changes applied (all in starlabs-e2e-tests; no app-repo code touched)

| # | File | Change |
|---|---|---|
| 1 | `_shared/prod-firewall.ts` | +2 `PROD_PATTERNS` for `*.a.run.app` / `*.run.app`; new opt-in `denyUnknownHosts` fence + `ALLOWED_HOST_PATTERNS` |
| 2 | `console/functions/src/suites.ts` | new `partitionGlobs`; `firstMatch` honours `!`-prefixed exclusions |
| 2 | `scripts/readiness/lib.cjs` | mirrored `partitionGlobs`; `matchesAny` / `whichGlob` honour exclusions |
| 2 | `scripts/readiness/readiness.test.cjs` | +9 tests for exclusion semantics |
| 2 | `suites-manifest.json` | `profiles.appPaths` += `!**/*.component.spec.ts` |
| 3 | `suites-manifest.json` | `journey.appPaths` += the 3 Participants-Profile-Management screens |
| 4 | `suites-manifest.json` | `profiles.appPaths` += the 4 out-of-glob dialogs analytics opens |
| 5 | `profiles/seed-profiles.js` | ROUTES += `/profilelist` (render + updateRole only; D-A noted inline) |
| 6 | `profiles/route-mount.spec.ts` | ROUTES += `/participant-evolution-summary`, `/profilelist` |

## Verification actually run

- `node scripts/readiness/readiness.test.cjs` — **66 passed · 0 failed** (57 baseline + 9 new).
  Baseline was captured green BEFORE the matcher change, so the 57 prove no regression.
- Firewall patterns exercised against 10 URLs — 5 production endpoints blocked (both `.a.run.app`
  broadcast hosts included), 5 legitimate hosts (localhost, emulator, googleapis, gstatic,
  identitytoolkit) still pass. **10/10 correct.**
- Manifest routing exercised end-to-end through the real `lib.cjs` matcher against the edited
  manifest — **13/13 correct**: real profiles components route, both karma scaffolds no longer do,
  the 4 newly-claimed dialogs route, the 3 PPM screens now route to journey, and `userprofile` still
  does not.

Nothing else was executed — still no `node_modules`, and the Playwright harness still needs WSL2.
**No Playwright spec has been run.** Items 5 and 6 change seed + spec data and are unverified at
runtime.

## Deliberate deviations from the approved plan

1. **Item 1 was scaled back on the fence half.** The approved wording was "invert to
   deny-unknown-host". Flipping the default changes request handling for **all 12 suites**, and I
   cannot run a single Playwright spec here to confirm `ALLOWED_HOST_PATTERNS` is complete — an
   over-broad block would fail suites silently rather than loudly. Shipped as opt-in
   (`denyUnknownHosts`, default off) so the leak is closed for everyone immediately and the fence
   can be switched on per-suite once a suite has been run green with it. **The inversion is not
   done; it is available.**
2. **Item 2 was not a config edit.** `globToRegex`/`firstMatch` are positive-only and OR-shaped, so
   a `!` entry would have been treated as a literal and subtracted nothing. Implemented exclusion in
   both matcher copies. Strictly additive: a glob list with no `!` entry takes the identical code
   path as before, which the 57 baseline tests confirm.
3. **`modes` still routes the karma scaffolds.** `modes.appPaths` independently claims
   `src/app/Participants Profile Management/**` (suites-manifest.json:177, carrying
   `reviewNote: "appPaths guess — review"`). Editing a profiles karma scaffold no longer makes
   *profiles* mandatory but still makes *modes* mandatory. Left alone deliberately — out of the
   profiles-only scope for this session. Worth a decision of its own: `modes` claiming the whole
   profiles tree looks like the same guess the reviewNote flags.

## Follow-ups this opens

- `console/functions/src/suites.ts` changed — the console backend needs a rebuild + redeploy for CI
  routing to pick up exclusion support. Until then the manifest's `!` entry is inert in CI (harmless:
  it degrades to today's behaviour) but live in `scripts/readiness`.
- Decide on `modes.appPaths` (deviation 3).
- Delete the `userprofile_old` route + folder (D-B).
- PA-21 / PA-22 remain the next tests to write.
