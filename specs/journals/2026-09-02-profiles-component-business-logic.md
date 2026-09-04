# Profiles — component inventory, coverage map, and the business logic the missing suites must pin
Date: 2026-09-02
Type: findings
Scope: **profiles suite only** (`src/app/Participants Profile Management/**` + `src/app/ProfilePicture/**`).

Companion to `2026-09-02-profiles-coverage-audit-validation.md`. That document established *how much*
surface is uncovered. This one names *every component*, says what each one's code actually does, and
writes down the rules a test would have to assert. Read alongside it, not instead of it.

Method: filesystem enumeration + reading the source. Handler and dialog counts here are
**comment-stripped** (see §0). Nothing executed against a browser.

---

## 0. Corrections to my own earlier numbers

Reading the code turned up four places where my previous pass was wrong. All four are corrections
*downward* in severity or *sideways* in target — none makes the gap bigger.

### C-01 — 22 of the 373 "click handlers" were in commented-out markup
Counting `(click)="..."` with a plain grep counts handlers inside `<!-- ... -->`. Stripping comments:

```
distinct click handlers ...... 351 live   (was reported 373)
dialog.open targets .......... 38 live    (was reported 41)
```

Worst offenders: `participants-analytics` 57→52, `ah-notification` 13→10, `participant-product` 10→7,
`profilelist` 9→7, `export-with-filters` 10→8. Corrected coverage: **17 interaction call sites / 351
live handlers = 4.8%**; in the gate, **14 / 351 = 4.0%**.

### C-02 — `profile-summary`'s two fulfilment dialogs are dead code
`addfullfillmentissue` and `updatefullfillmentissue` compute an issue number and build a payload, then
**do nothing** — the `dialog.open(DialogAddFullfillmentComponent…)` and `DialogEditFullfillment…` calls
are commented out (profile-summary.component.ts:360-366, 377-383). Both the original audit and my
validation listed these as untested write paths. They are untested *no-ops*. profile-summary has 3 live
dialogs, not 5.

### C-03 — `addConsumedProduct` / `removeConsumedProduct` do not write anything
Both audits proposed a case asserting "the participant metadata array" after clicking Add Consumed
Product. Reading `participants-analytics.component.ts:346-375`: these are `FormArray` operations —
`this.consumedProducts.push(this.createConsumedProductGroup())` and `.removeAt(index)`. They add a row
to the **filter builder**. There is no Firestore write. **PA-30 as specified is void.** §4.5 gives the
correct analytics write case instead.

Same class: `patchCustomerStatus` (2487) and `clearCustomerStatus` (2497) are selection operations, not
writes. `engagementLevelClick` (new-profile:887) is filter state only — so PA-25's "assert the write" half
is void; its "assert the recomputed view against a Firestore count" half survives.

### C-04 — PA-28 does not exist: view-participants-form has no default-database write
I proposed "saveNotes on the default DB — runs in CI" as G-02's cheapest fix. It isn't. The component
declares `firestoreDefault = getFirestore()` at line 167 and **never writes to it**. All seven write
sites (lines 806, 809, 823, 826, 840, 843, 877) target `firestoreForms`. There is no CI-safe write path
on that screen. What *is* CI-safe there is client-only state — `persistMyForms` (localStorage), the chip
filters, the export builders. §4.7 restates the case honestly.

---

## 1. The 38 components

13 routed screens, 25 non-routed (24 dialogs + 1 embedded). LOC = `.ts` + `.html`.
Writes are live calls only. "Cases" counts profiles-suite Playwright cases that reach the component.

### Routed screens (13)

| Screen | Route | LOC | Clk | Dlg | Writes | Cases | Verdict |
|---|---|---|---|---|---|---|---|
| participants-analytics | `/participants-analytics` | 4,877 | 52 | 21 | set upd del batch | PA-07 PA-08 PA-18 | reads only |
| new-profile | `/ProfileScreen` | 2,831 | 12 | 0 | set | PA-PS-01 | reads only |
| userprofile | `/userprofile/:id` | 2,594 | 10 | 3 | set upd | PA-01 PA-02 PA-03 | 1 write |
| view-participants-form | `/view-participants-form` | 1,866 | 26 | 1 | upd | PA-13 PA-14 (both skip) | 0 in gate |
| journey-product-purchase | `/participantpurchase/:pid` | 1,804 | 12 | 2 | set del | journey JP-05/06/08 | journey-owned |
| userprofile_old | `/userprofile_old` | 1,573 | 11 | 0 | upd batch | — | **dead — delete** |
| profile-summary | `/profilesummary/:profileid` | 903 | 8 | 3 | upd | PA-10 | reads only |
| participant-form-tracker | `/participant-form-tracker` | 803 | 6 | 0 | read-only | PA-11 PA-12 PA-FT-LL (+1 fixme) | good |
| participant-product | `/participantproduct` | 774 | 7 | 1 | set | journey smoke | journey-owned |
| participant-delivery-sequence | `/participantdeliverysequence/:pid` | 744 | 9 | 0 | set upd del | journey smoke | journey-owned |
| profilelist | `/profilelist` | 561 | 7 | 3 | upd del | route-mount (new) | **untested** |
| app-flow-breaks | `/app-flow-breaks` | 459 | 6 | 0 | read-only | PA-15 PA-AFB-FILT | good |
| participants-evolution-summary | `/participant-evolution-summary` | 242 | 1 | 0 | read-only | PA-EVO-01 | export untested |

### Non-routed components (25)

| Component | LOC | Clk | Writes | Reached from | Cases |
|---|---|---|---|---|---|
| manage-participantlist-dialog | 2,802 | 28 | set upd del | analytics `managelist` | **none** |
| email-input | 1,986 | 23 | read-only | analytics `sendEmailToSelectedParicipant` | **none** |
| create-segments-dialog | 1,711 | 17 | set upd del batch | analytics `addSegments` | **none** |
| wati-input | 1,453 | 29 | set upd | analytics `sendWatiMessage` | **none** |
| ah-notification | 1,440 | 10 | set upd add del | analytics `sendNotificationinBreakthrough` | **none** |
| bulk-add-products | 805 | 2 | set | analytics `bulkAddProducts` | **none** |
| export-with-filters | 800 | 8 | read-only | analytics `exportWithFilters` | **none** |
| tag-participants | 792 | 10 | set upd batch | analytics `tagParticipants` | **none** |
| updateprofile | 723 | 6 | set batch | profilelist `updateProfile` | **none** |
| add-queue-tag | 660 | 10 | set upd batch | analytics (queue tag) | **none** |
| map-recommendedplaylist-toparticipant | 505 | 2 | read-only | analytics `onViewRecommendedPlaylist` | **none** |
| wati-config-dialog | 409 | 8 | set | analytics `openWatiConfig` | **none** |
| ael-edit-dialog | 330 | 2 | upd | userprofile `editRow` | **none** |
| reports-dialog | 329 | 2 | read-only | userprofile `reportView` | **none** |
| subscription-dialog | 320 | 4 | read-only | analytics `addSubscription` | **none** |
| add-purchase | 280 | 1 | set | profilelist `addCustomer` | **none** |
| form-overlay-view | 224 | 2 | read-only | view-participants-form | **none** |
| profile-picture | 210 | 1 | read-only | embedded | incidental |
| broadcast | 181 | 5 | read-only | analytics `sendChatBroadcast` | **none** |
| participants-checklists | 155 | 2 | read-only | analytics `navigateTochecklists` | **none** |
| send-interim-report | 132 | 1 | batch | analytics `sendInterimReport` | **none** |
| evolution-wishlist-log | 112 | 2 | batch | analytics `sendEvolutionWishList` | **none** |
| remark-dialog | 61 | 2 | read-only | analytics `editremarks` | **none** |
| add-remarks | 53 | 2 | read-only | analytics `addremarks` | **none** |
| create-participantlist-dialog | 209 | 5 | set upd | manage-participantlist | **none** |

**25 of 38 components have no test that reaches them.** Of those 25, **14 write to Firestore.**

Also in the glob, untested and not components: `participants-analytics/data-transfer.service.ts`,
`app-flow-breaks/filterpipe.ts`, and 37 scaffolded karma specs (now excluded from `profiles.appPaths`).

---

## 2. Databases and collections in play

Four Firestore instances are reachable from profiles code:

```
getFirestore()                    default — the test project
getFirestore("firestore-forms")   formsByClient          named DB, emulator denies (PA-13/14 skip)
getFirestore("firestore-atc")     atc_alpha              named DB — OUT OF BOUNDS by standing rule
getFirestore(getApp("watson"))    ParticipantPurchases   a SEPARATE Firebase app (analytics:305)
```

The fourth is new information and deserves a decision of its own: `openFirstPurchaseCheckList`
(analytics:2503+) reads `ParticipantPurchases` from a Watson app instance. That is a cross-project read
the prod-firewall does not intercept — Firestore SDK traffic goes over `googleapis.com`, which is on the
allow side. If Watson is production data, this is the same class of concern as `firestore-atc`, and the
checklist handlers should be treated as unreachable for tests until someone confirms which project that
app points at. **Flagging, not asserting — I have not read the Watson app config.**

Seeded by `seed-profiles.js` (11 + auth chain): `appflowbreaks · ask AH · formsByClient · journey ·
love letter · package · participant metadata · participantjourneyproduct · participantsproduct ·
products · profile_data` (+ `user_data · users_roles · dashboard`).

Read or written by untested code and **not seeded** (~35):
`participant list · participant_list_log · segments · participant tags · participant tag logs ·
queue generation · queue planning · savednotifications · wati templates · wati archive ·
workshopconfiguration · clientissue · fullfillmentchallenges · interim crossover · interimreport log ·
journey-to-product · journeyproductpurchase · searchquery · buffermix archive · email validators ·
email archive · broadcast_analytics · subscription extend log · salesleads · atc model ·
starlabs roles · Roles-To-EIS · EISzoomcontact · aggregate_EITParticipant · aggregate_ReviewParticipant ·
availability · events_profiles · deliverables · evolutionmappingvideo · post_categories`

---

## 3. Missing specs — the file plan

Six new spec files, plus additions to two existing ones. Each is scoped to one seeder extension.

| Spec file | Cases | Seeder needs | Gate-safe |
|---|---|---|---|
| `profiles/profile-summary-deep.spec.ts` (new) | PA-21, PA-22, PA-23 | nothing / `clientissue` | yes |
| `profiles/profilelist.spec.ts` (new) | PA-19r, PA-20 | nothing | yes |
| `profiles/analytics-writes.spec.ts` (new) | PA-30r, PA-31, PA-32 | nothing / `participantjourneyproduct` | yes |
| `profiles/lists-segments.spec.ts` (new) | PA-33 … PA-38 | `participant list`, `segments`, `queue generation`, `queue planning` | yes |
| `profiles/tags.spec.ts` (new) | PA-39 … PA-43 | `participant tags` | yes |
| `profiles/userprofile-deep.spec.ts` (new) | PA-26, PA-27 | `interim crossover` | yes |
| extend `profiles-deep.spec.ts` | PA-24, PA-25r | nothing | yes |
| extend `view-form-deep.spec.ts` | PA-44 | nothing | yes (client-only) |
| **cannot be written** | PA-19 (delete profile) | — | **no — ATC rule** |

---

## 4. The business logic each missing suite must pin

This is the part that was missing: not "handler X is untested" but "here is the rule, here is the
assertion". Line numbers are `development @ 06e435c3`.

### 4.1 profile-summary — notes (PA-21, PA-22)

`addgeneralnotes` (441) / `addprivatenotes` (479). Identical shape:

```
1. open UpdateDialogComponent (disableClose, maxHeight 90vh)
2. on afterClosed(result): if result == null -> no write at all
3. lazily create profileData.notes.{generalnotes|privatenotes} as [] if null
4. push { givenby: <profileId>, generalnotes|privatenotes: result, date: new Date() }
5. updateDoc('profile_data/'+profileId, { notes: <the WHOLE notes map> })
```

Rules to assert:
- **Cancel writes nothing.** `result == null` short-circuits before the updateDoc.
- **Append, never replace.** A second note leaves the first in place, index 0 unchanged.
- **The two lists are independent.** Adding a private note must not touch `notes.generalnotes`.
- **Whole-map write.** The payload is `{ notes: <entire map> }`, read from client state — so a general
  note added after a private note in the same session carries both. This is a read-modify-write with no
  transaction: two staff adding notes concurrently lose one. Worth a case only if you want the defect
  recorded; it will need two browser contexts.

**Defect to pin — B-01.** `givenby` is set to `this.profileId`, the **participant** whose summary is
open, not the logged-in staff member. Every note is attributed to its subject. Contrast
`participants-analytics` `addremarks` (1373), which correctly uses `this.loggedInProfileId`. Assert
`givenby !== <participant profileid>` once fixed; until then assert the current value and link the bug.

### 4.2 profile-summary — customer-support issue (PA-23)

`addcustomersupportissue` (386):

```
issueno = (max existing issueno in 'clientissue' via orderBy desc limit 1) + 1
          ... but 1001 when the collection is EMPTY
guard:    only opens AddIssueComponent when productlist, clientList and ahMember are ALL non-empty
payload:  { metadata: { issueno, profileid, profilesummary: true },
            journeys, products, clients, members }
```

Rules to assert:
- **First issue is 1001**, not 1. Empty collection → `issuenumber = 1001`.
- **Monotonic +1** thereafter, from the highest existing `issueno`.
- **The three-list guard.** With any of products / clients / A&H members empty, the button is inert —
  no dialog, no write, no error. This is a silent no-op and worth its own negative case.
- `profilesummary: true` marks the origin; an issue raised from elsewhere should not carry it.
- **No transaction on `issueno`.** Two concurrent adds collide. Same note as above.

`addfullfillmentissue` (337) computes the same number against `fullfillmentchallenges` and then discards
it — see C-02. Do not write a case for it; write a deletion ticket.

### 4.3 profilelist — role update (PA-20)

`updateRole(profileid, rolepath)` (300):

```
updateDoc(<rolepath>, this.profilerole[profileid])   // rolepath is profile.role_ref (a users_roles doc)
```

Rules to assert:
- The write lands on the doc named by `profile.role_ref.path`, **not** on `users_roles/{profileid}` —
  the two are usually equal but the seeder must not assume it.
- The payload is the *whole* role map for that profile, so unrelated role flags on the doc are
  overwritten, not merged. Assert a sibling flag survives only if it was in the client's map.
- **No confirmation, no audit log, no validation.** Role escalation to `superadmin` is one click with no
  record. That is the finding; the test pins the current behaviour so a future guard is a visible diff.

`updateMyOperator` (251) is the sibling case: `updateDoc(profile_data/{profileid},
{ myoperatoruid, myoperatornumber })` — two fields, merge semantics, no audit.

`updateProfile` (275) re-reads the profile with `getDoc` before opening `UpdateprofileComponent`, to
avoid handing the dialog stale data. Assert the dialog receives the *fresh* `user_ref`.

**PA-19 (Delete Profile) cannot be written** — `deleteProfile` (324) pre-flight-queries `atc_alpha` on
`firestore-atc`, which this project never touches. Cancelled, not deferred. The business logic is
recorded here so nobody re-proposes it: ten guard queries across three databases must ALL come back
empty, else it `alert()`s the status map and refuses; only then does `confirm()` gate two `deleteDoc`
calls (`role_ref` then `profile_data`), non-atomically.

### 4.4 userprofile — AEL edit and the tab strip (PA-26, PA-27)

`ael-edit-dialog.save()`:

```
updateDoc('interim crossover'/{data.element.docid}, {
  metric: this.selectedPoints,
  edited: serverTimestamp()
})
```

Rules to assert:
- `metric` is replaced wholesale by the selected points, not merged.
- `edited` is a **server** timestamp — assert it is present and later than the seeded `createddate`,
  never assert an exact value.
- The dialog closes only after the write resolves (`.then(() => dialogRef.close())`); on error it clears
  `updating` and stays open. A failure case is assertable by denying the rule.

PA-27 walks `selectTab` / `seteventTab`. userprofile renders from 22 distinct collections; PA-02 asserts
only the Journey tab. Assert each tab renders its seeded row — the same shape as PA-02, repeated.

### 4.5 participants-analytics — the real write cases (PA-30r, PA-31, PA-32)

Replacing the void PA-30. The live write sites are lines 903, 917, 921, 1182, 1254, 1281, 1316, 1342,
1378, 1418, 1490, 1491, 1573, 1586.

**PA-30r — bulk remarks.** `addremarks` → `RemarkDialogComponent` → on result (1370):

```
remarks = { date: new Date(), note: <value>, givenby: this.loggedInProfileId }
for each selected profile:
    element.remarks = element.remarks ?? []
    element.remarks.push(remarks)
    updateDoc('participant metadata'/{profileid}, { remarks: element.remarks })
```

Assert: the remark lands on **every** selected row and on **no** unselected row; `givenby` is the staff
profile id (the correct behaviour, and the contrast that proves B-01 is a bug); the array appends.
This is the best analytics case available — default DB, seeded collection, bulk semantics, no dialog
stepper. Write it first.

**PA-31 — saved search filter.** `saveSearchedFilter` (1261):

```
normalise: numberElement -> toObject(); dateElement -> {start,end} as 'yyyy-MM-dd';
           drop null/undefined; drop ranges missing start or end; drop empty arrays
guard:     Object.keys(data).length >= 2      // fewer than 2 surviving keys -> no write
confirm(): "are you sure you want to submit"
write:     setDoc('searchquery'/{docid}, {...data, docid, createdby: loggedInProfileId}, {merge:true})
```

Assert: a one-criterion filter writes nothing (the `>= 2` guard); a two-criterion filter writes with
dates normalised to `yyyy-MM-dd` strings; `createdby` is the staff id; re-saving the same `docid` merges
rather than replaces. `searchValidation()` (1244) is a separate rule — more than one of
`unconsumedproducts` / `consumedproducts` / `activeproduct` non-empty alongside `productcount`.

**PA-32 — subscription extension.** Line 1490-1491, paired writes:

```
setDoc('subscription extend log'/{id}, element)
updateDoc('participantjourneyproduct'/{element.docid}, { ...new end date... })
```

Assert both docs, and assert the log id and the product doc agree. The pair is not batched — a failure
between them leaves a log with no extension.

**PA-29 (prod-firewall receipt)** still stands and is now cheap: `installProdFirewall` already returns
the blocked-URL array. Drive a broadcast or email action, assert the array recorded a block and that no
`broadcast_analytics` doc was written. With the Cloud Run patterns now in `PROD_PATTERNS`, this case
also regression-guards N-01.

### 4.6 Lists and segments — the largest untested behaviour (PA-33 … PA-38)

`manage-participantlist-dialog` (2,802 LOC) and `create-segments-dialog` (1,711 LOC). This is where the
suite's real risk sits, and the logic is genuinely intricate.

**The live-segment exclusivity rule.** `getMergeConflicts` (1548) derives "live" through a three-hop
chain, then treats membership in any live list as a conflict:

```
1. queue generation   -> docs where queuestartdate <= now <= queueenddate     => liveQueueIds
2. queue planning     -> where queueid in liveQueueIds
                         planning[].segments[].segmentid                      => liveSegmentIds
3. segments/{id}      -> segmentname + participantlistid[]                    => liveListMeta
4. plus: any participantList with live === true (and != target)
5. conflict = a profile to merge that is already in one of those lists
```

**PA-33 — merge with no conflict.** Seed a list and a profile not in any live list.
Assert: `participant list/{docid}.profilelist` gains the id via `arrayUnion`; `updateddate` is set; a
`participant_list_log` doc is created with `action_type:'edit'`, `type:'list'`, `referals` = a
DocumentReference to the list, `metadata.current.added_profiles` = the merged ids, and
`metadata.description` = `Merged N profile(s) into list "<name>".`
Note the guard chain first: no `externalProfileIds` → snackbar, no write; every id already in the list →
snackbar "All profile IDs are already in this list", no write; then a native `confirm()`.

**PA-34 — merge with a conflict, conflict accepted.** Seed a live queue (start ≤ now ≤ end), a
`queue planning` doc referencing a segment, a `segments` doc pointing at list B, and put the profile in
list B. Merge into list A.
Assert: the conflict popup appears with the profile pre-checked (`selectedMergeConflictIds` is seeded
from all conflicts); confirming removes the profile from **list B** (`profilelist: arrayRemove`) *and*
adds it to list A. Exclusivity holds afterwards.

**PA-35 — merge with a conflict, conflict declined.** Uncheck the conflict, confirm.
Assert the **counter-intuitive rule**: unchecking does **not** mean "merge anyway, leave B alone" — it
means the profile is dropped from the merge entirely (`confirmMergeWithSelection` filters
`profileIdsToActuallyMerge` by the *unchecked* set). List A is unchanged and list B is unchanged. This
rule is invisible from the UI and is exactly what a test should lock down.

**Defect to pin — B-02.** In `executeMerge`, when `conflictsToRemove.length > 0`, a
`participant_list_log` entry is written **inside** the conflict-removal branch (line ~1267) with
`description: "Merged N profile(s) into list …"` — before the merge has happened — and then the normal
post-merge log is written again at ~1306. A conflict-path merge produces **two identical audit
entries**, the first describing an event that has not yet occurred. PA-34 should assert exactly one log
doc; expect it to fail until fixed.

**Defect to pin — B-03.** De-merge writes **no** `participant_list_log` entry at all
(`executeDeMerge`, ~1700). Removals are unaudited while additions are audited. PA-36 asserts the
asymmetry.

**PA-36 — de-merge.** `deMergeProfiles` (1640) partitions the selection into found / not-found against
`list.profileids`:
- none found → informational popup, **no write**
- some found, some not → popup; `confirmDeMerge` then removes **only the found ones**
- all found → removes immediately, **no confirm at all**
Assert the third branch especially: it is the only destructive path in this dialog with no confirmation.

**PA-37 — segment creation invariants.** `onCreateSegment`:
- **Name uniqueness is case-insensitive** and checked against in-memory `this.segments`, not a query —
  so it is a client-side check, defeatable by a concurrent create. Assert the rejection message and
  that no `segments` doc was written.
- **A participant list may belong to only one segment** — `checkDuplicateParticipants` rejects with the
  offending segment names. Assert no write.
- On success: a `writeBatch` sets `segments/{id}` with `{docid, segmentname (trimmed),
  participantlistid, tagids, createddate}` and `arrayUnion`s the segment id into each
  `participant list/{id}.segmentid`. Assert the **bidirectional link** on both sides.

**PA-38 — segment deletion unlinks both sides.** `deleteSegment`:
```
confirm()
for each listId in segment.participantlistid: updateDoc('participant list'/{id}, {segmentid: arrayRemove})
for each tagId  in segment.tagids:            updateDoc('participant tags'/{id}, {segmentid: arrayRemove})
deleteDoc('segments'/{docid})
setDoc('participant_list_log'/{id}, { action_type:'delete', type:'segment',
        metadata.previous = {segmentname, participantlistid, tagids}, ... })
```
Assert no dangling `segmentid` survives on any list or tag. Note two properties worth recording:
these are **sequential un-batched writes** (unlike creation, which batches) so a mid-way failure leaves
dangling links; and the audit doc's `referals` points at the `segments` doc that was just deleted — a
permanently dangling reference.

### 4.7 Tags (PA-39 … PA-43)

`tag-participants` and `add-queue-tag` share an identical handler set — treat them as one suite with a
parameter. Collections: `participant tags`, `participant tag logs`.

**PA-39 — `deleteTag` is a soft delete.** Sets `isActive = false` and writes the whole tag object back.
The confirm text says it: *"participant tagged with this tag will not be removed"*. Assert the tag doc
flips `isActive`, and that every `participant metadata` tag array is **byte-identical** afterwards.

**PA-40 — `addTag` resurrects rather than duplicates.** If a tag exists with `isActive == false` and the
same name (trimmed, lower-cased), it is reactivated — `isActive = true`, `tagsfor` overwritten with the
new value — instead of a new doc being created. Assert the doc count is unchanged and the id is the old
one. Separately assert the active-duplicate path rejects.

**PA-41/42/43 — the three bulk operations.** All are `confirm()`-gated and chunked:
```
bulkAssignTag   BATCH_SIZE 500   requires a tag AND >=1 participant, else alert() and return
bulkRemoveTag   BATCH_SIZE 500   confirm names the tag and the participant count
bulkReplaceTag  BATCH_SIZE 250   requires BOTH old and new tag, else silent return (no alert)
```
Assert: the empty-selection guards write nothing; the tag lands on every selected participant and no
other; replace removes the old and adds the new **atomically per participant** (no participant ends
holding both or neither). The 500/250 chunk boundary is the interesting case if you can seed enough
rows — a 501-row assign must still complete.

### 4.8 new-profile — timeline (PA-24) and engagement (PA-25r)

`navigatetoTimeline(doc, engagementCategory, option)` (1739):
```
docData = { profileid: loggedInProfileId,
            listofprofileid: [...],
            engagement: engagementCategory,
            absolutedate: <now minus 5 months>,
            timelinetype: option }        // 'Absolute' | 'Relative'
guard:  new Blob([JSON.stringify(docData)]).size > 1_048_576  -> refuse
write:  setDoc('filteredtimeline profile'/{docid}, docData)    (line 1380)
```
Assert: `timelinetype` matches the button clicked; `absolutedate` is exactly five months before now
(assert the month, not the millisecond); `profileid` is the **staff** id, not a participant. The 1 MB
guard is a genuine boundary case — a selection large enough to exceed it must produce no write.

PA-25r drops the write half (C-03) and keeps the view half: click an engagement bucket, assert the
rendered set equals a Firestore count of profiles in that band. `engagementLevelClick` resets
`selectedSortOption`, `checkedValues`, `selectedFinancialStatuses`, `selectedCard` and
`selectedMonthForSubscription` — assert those clear too, since silent filter carry-over is the likely bug.

### 4.9 view-participants-form (PA-44) — honestly scoped

Three parallel flag toggles share one shape (`toggleLike` 799, `toggleFlag` 816, `toggleOpportunity` 833):
```
on:  updateDoc(formsByClient/{docid}, { <flag>: true,  <flag>details: {user: loggedInProfileId,
                                                                       time: serverTimestamp()} })
off: updateDoc(formsByClient/{docid}, { <flag>: false, <flag>details: null })
```
`saveNotes` (863) requires non-empty trimmed text and `arrayUnion`s
`{notes, user: loggedInProfileId, time: Timestamp.now()}`.

**All four are forms-DB writes and cannot run in the gate.** They belong in `view-form-deep.spec.ts`
alongside PA-14, on the cloud config.

PA-44 is the CI-safe remainder: `addSelectedFormsToMyForms` (434) — de-duplicates against existing
`myForms` by `formname`, sorts with `localeCompare`, persists to **localStorage**, then clears the
filter control and re-filters. No Firestore at all. Assert the dedupe, the sort order, and that the
list survives a reload. Modest, but real, and it runs in the emulator.

### 4.10 The remaining writers — logic recorded, cases deferred

Each needs a seeder extension before it can be written; the rules are captured so the next session does
not have to re-read the code.

- **`updateprofile`** (723 LOC) — `createProfile` mints ids via `doc(collection).id` for `profile_data`
  and `users_roles`, then a `writeBatch` writes `profile_data`, `users_roles` and
  `participant metadata` together (446-450), with `role_ref` / `user_ref` as DocumentReferences. It also
  posts to four `updateprofilebio` endpoints (salescrm/watson × test/prod) — all four are firewalled by
  hostname. The batch is the assertion: three docs or none.
- **`add-purchase`** (280 LOC) — reads `journey-to-product`, `journeyproductpurchase`,
  `participantjourneyproduct`, `products`, `profile_data`, `users_roles`; one `setDoc`.
- **`ah-notification`** (1,440 LOC) — the only component using all four write primitives.
  `sendNotification` / `scheduleFromTable` / `saveRowScheduleFromForm` against `savednotifications`.
  It sends; treat it as PA-29-class (assert the firewall block) before treating it as a feature.
- **`wati-input`** (1,453 LOC, 29 handlers) — `wati templates`, `wati archive`, `workshopconfiguration`;
  presets, favourites, Excel upload, scheduling. **This is the component that holds the two
  `*.a.run.app` endpoints.** Any case here must assert the firewall receipt first.
- **`bulk-add-products`** (805 LOC, 3 setDoc, 2 handlers) — near-headless; the logic is all in the TS.
- **`create-participantlist-dialog`** (209 LOC) — `set` + `upd`; the create half of §4.6.
- **`wati-config-dialog`** (409 LOC) — CRUD over WATI configs, `toggleTokenVisibility` exposes a token.
- **`send-interim-report`** / **`evolution-wishlist-log`** — one `writeBatch` each, 1-2 handlers.
- **`add-queue-tag`** — identical surface to `tag-participants`; cover both with one parameterised spec.

### 4.11 Read-only components with no coverage

Nine components never write and are still untested. They are cheap cases — no seeding beyond what
exists, no dialogs to step through:
`email-input` (23 handlers — template selection, cc/bcc, test-send, saved variables),
`export-with-filters` (8 — the filter/export builder), `subscription-dialog`, `broadcast`,
`map-recommendedplaylist-toparticipant`, `participants-checklists`, `remark-dialog`, `add-remarks`,
`reports-dialog`, `form-overlay-view`, `profile-picture`.

Also uncovered on screens that *are* tested: `participant-form-tracker` `clearFilters` / `viewMerged` /
`viewRow`; `app-flow-breaks` `nextPage` / `previousPage` / `goToPage` / `clearAllFilters`;
`participants-evolution-summary` `exportCSV` (its only handler).

---

## 5. Defects found while reading (not coverage gaps)

| id | Where | What |
|---|---|---|
| B-01 | profile-summary:441,479 | Notes are attributed to the participant (`this.profileId`), not the author. Analytics `addremarks` does it correctly — this is a bug, not a convention. |
| B-02 | manage-participantlist:~1267 | A conflict-path merge writes two identical `participant_list_log` entries, the first describing the merge before it happens. |
| B-03 | manage-participantlist:~1700 | De-merge writes no audit log; merge does. Removals are untraceable. |
| B-04 | profile-summary:337,368 | `addfullfillmentissue` / `updatefullfillmentissue` compute a payload and discard it — the dialog call is commented out. Dead handlers still bound in the template. |
| B-05 | profile-summary:386,337 | `issueno` is `max+1` from a non-transactional read. Concurrent adds collide. Seeds at 1001 on an empty collection. |
| B-06 | create-segments / manage-list | Bidirectional link maintenance is sequential and un-batched on delete (batched on create). A mid-way failure leaves dangling `segmentid` / `participantlistid`. |
| B-07 | create-segments:deleteSegment | The audit doc's `referals` points at the `segments` doc deleted moments earlier — permanently dangling. |
| B-08 | profilelist:300 | Role changes have no confirmation, no validation and no audit record. |

None of these were introduced by this session; all are assertable.

## 6. Open questions

- **Which project does `getApp("watson")` point at?** (analytics:305). If production, the
  `openFirstPurchaseCheckList` family joins `firestore-atc` as unreachable. **[UNKNOWN]**
- Is `functions/components/participantmetadata.js` in the emulator deploy set? Still unresolved from the
  prior journal — it decides whether PA-CF-01…05 actually assert anything. **[UNKNOWN]**

## 7. Artifacts

- This journal. No code changed in this pass.
- Prior: `2026-09-02-profiles-coverage-audit-validation.md` (findings + the six applied fixes).
