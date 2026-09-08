# 2026-09-07 — content suite: seeds + specs for the ten uncovered routes (CN-19…CN-46)

Type: build. **STATUS: NOT GREEN — 28 passed / 12 failed / 7 skipped of 47.** The 12 failures are
selector bugs in the new specs, not app defects. Details and the fix list are at the bottom; do not read
this file as a completed hand-off.

Companion: `2026-09-07-content-coverage-audit.md` (the audit that produced the route list).
Recon: `recon-allcomp/content.md` → "Addendum — 2026-09-07".

## What this session did

Followed the seven-step order the operator used for the comms system: recon doc → seed → support
helpers → read-path specs → write-path specs → green run → journal. Steps 1-5 are done; step 6 is
partial (this file); step 7 is this file.

### 1. Recon doc (`recon-allcomp/content.md`, +97 lines)

Addendum documenting all ten never-opened routes with the finding that shapes each test, the guard gap,
27 numbered cases (CN-19…CN-46), the seed requirements, and 7 new risks. Written first because the specs
cite it in their headers, which is this repo's convention.

Three corrections to the ORIGINAL recon landed here:

- **Risk #1 / CN-18 were wrong.** The original says `ClickAdsComponent`'s class is "fully commented out"
  and that `/ads` renders an empty shell. It does not. `click-ads.component.ts:1-82` is an old commented
  copy; the live class is at `:118` and the route renders a working table plus a create/edit dialog.
- **`/contentanalytics` is not `/content-analytics-dashboard`.** Different components, different
  collections, different windows. CN-08 covers the second; nothing covered the first.
- **CN-04's route never worked.** See below.

### 2-3. Seed + support helpers

`content/seed-content.js`: a participant-only actor (for the guard cases), six new route grants, and the
data for the new cases. Doc factories (`addendumDocs`) are exported so the spec-side reset helpers write
the *same bytes the seed wrote* rather than a second, drifting definition.

`content/support/content.ts`: ids, run-unique text, the participant login, five reset helpers, three
delete-what-the-app-created helpers, and `countStorageRequests()`.
`content/support/ui.ts` (new): `openSelect`, `showAllRows`, `openTab`, `landingPathFor`, `ROW`.

Negative controls the seed carries so a client-side filter can be **falsified**:

| Seeded doc | Proves |
|---|---|
| `category` CAT2 `sequence` = [ref SER1, ref to a **missing** series, `'not-a-ref'`] | the DocumentReference-and-exists filter runs (categoryassign.ts:86-89) — 3 entries in, 1 chip out |
| `series` SER3 `tier` = [TIER1, TIER2, ref to a **missing** tier] | the per-ref `getDoc` really happens — the third chip reads `Unknown` (access-screen.ts:126) |
| `ads` ADSB `delete:true` | `/ads` has **no** filter — the row must still render, only the badge changes |
| `content_urls` CU2 `available:false` | same for `/contentupload` |
| `content analytics` pair with an identical `logdate.seconds`/`videoid`/`totaltimespend`/`profileid` | the duplicate key function (ts:831-842) — exactly ONE of the two gets flagged |
| `content analytics` doc 30 days old | the strict `>` / `<` date window really excludes |
| `arenavideoask` VA4 on a **different** event | the sibling-deactivation batch is partitioned by `eventref.path`, not global |

Every seeded date is a Firestore `Timestamp`: `/ads` and `/contentupload` call `.toDate()` in their row
templates, so a string date throws and takes the whole table down.

### 4-5. Specs — 11 new files

`content-upload-v2` · `series-child-routes` · `assign-category` · `click-ads` · `access-screen` ·
`content-upload` · `upload-studio` · `playlist-edit` · `content-analytics` · `arena-video-ask` ·
`route-guards`. Plus CN-04 rewritten in `deep.spec.ts` and 7 grants added to the mount smoke.

## Why CN-04 was `test.fixme`, and what replaced it

CN-04 sat under `test.fixme` since the **initial commit** with no reason recorded at the call site. The
reason turns out to be structural: it drove `/seriesdashboard/addseries`, and
`series-dashboard.component.html` has **no `<router-outlet>`** (zero hits across the whole
`series-dashboard/` tree). The route is declared as a child at `app.routes.ts:120-123`, the guard admits
it, the URL holds — and the parent dashboard is what renders. The form CN-04 filled cannot mount.

So the case was un-fixme'd onto the path that actually exists: `/seriesdashboard` → "Create Series" →
`ConfigureseriesdialogComponent`, whose `onSubmit` does the same `writeBatch.set(series)` +
`arrayUnion` on each picked episode (configureseriesdialog.ts:318-341). The dead route is now pinned
separately as CN-22, so nobody re-discovers this in six months.

**The general lesson: a `fixme` with no recorded reason is a bug report nobody filed.** Three of the
remaining `fixme`s (CN-11/12/14) are still unexplained and were out of scope this session.

## Four defects pinned with `test.fail()` — all four confirmed failing today

Same device as the workshops WS-35 case. While the defect stands the assertion fails, Playwright reports
it as an expected failure, and CI stays green. The day someone fixes the app, Playwright reports
"Expected to fail, but passed" — the signal to delete the `test.fail()` line and keep the test as a
permanent regression guard. Written the other way round (pinning today's broken behaviour as correct),
the alarm would fire when the app was **fixed**, which is backwards.

| Case | Defect | Where |
|---|---|---|
| CN-46 | `/assigncategory` has **no `canActivate`** — any authenticated user reaches an operator screen | `app.routes.ts:125` |
| CN-22 | `/seriesdashboard/addseries` never mounts — parent has no `<router-outlet>` | `series-dashboard.component.html` |
| CN-20 | `/content-upload-v2/playlistdashboard/add-playlist` throws `NullInjectorError` — the component injects `MatDialogRef`/`MAT_DIALOG_DATA` non-optionally but is also declared as a route | `playlist-configuration.component.ts:89-90` |
| CN-39 | `/playlistdashboard/edit-playlist` Update **drops `imageurl`** — a full `setDoc` whose payload omits the field | `edit.component.ts:198-207` |

CN-45 is the positive control that gives CN-46 its meaning: the same participant IS denied `/ads`,
`/accessscreen`, `/contentanalytics` and `/createarenavideoasktemplate`. Without it, a CN-46 failure
would be indistinguishable from a broken actor.

## The dialog trap, again

CN-42 (`/contentanalytics` delete-duplicate) gates on a bare `window.confirm` (ts:979). With no
`page.on('dialog')` handler Playwright **auto-dismisses** it: `confirm()` returns false, `deleteDoc`
never runs, and a test that only asserted "no error" passes on a no-op. The handler is registered before
the click and the assertion is on the Firestore post-state (2 docs → 1), never on the UI alone. Same
note as the workshops WS-17 header; it keeps recurring because the failure is silent and green.

## Test state — 28 / 12 / 7 of 47

Run: hub emulator (Firestore+Auth, permissive rules) + app on `:4300` via
`ng serve --configuration emulator`. See "Environment trap" below.

**7 skipped** — CN-11/12/14 (`fixme`, pre-existing) and CN-06/07/15/16 (runtime skips: the content Cloud
Functions are not deployed to the emulator).

**12 failed — all selector/driver bugs in the NEW specs, no app defect implicated.** The read-path
assertions that DID run passed, including every negative control above, so the seed design is sound.
Outstanding fixes:

| # | Case(s) | Cause | Fix |
|---|---|---|---|
| 1 | CN-28/29/30 | scoped rows to `mat-tab-body` filtered by paginator id; that wrapper/tree is not what the DOM has | inspect the real tab markup, scope by the table instead |
| 2 | CN-31 | `input[name="tiereligibilitymessage"]` not in the Add Tier dialog | read the dialog's real control names |
| 3 | CN-43 | `showAllRows` parsed the page-size options to `-Infinity` (no numeric text found) | make the helper fall back when options are not bare numbers |
| 4 | CN-24/25 | `button.btn-primary` `/^Save/` and the text `This category already exists` not found | read the real dialog buttons/hint text |
| 5 | CN-27 | `Create Ad` button not found by that text | read the real footer button |
| 6 | CN-04 | strict-mode violation: `mat-select.cat-select` matches BOTH the type select and the episode select | use `:not([name])` for the episode select |
| 7 | CN-37 | `getByPlaceholder('Search')` never editable on edit-playlist | read the real filter placeholder |
| 8 | CN-33/35 | **counter design flaw** — `countStorageRequests` is armed at `beforeEach` and counted 3 requests from login//page render, not from the action | snapshot the count immediately before the click and diff, instead of counting from page open |

Item 8 is the only one worth calling a design mistake rather than a typo: "zero Storage requests during
the test" and "zero Storage requests caused by this click" are different claims, and I asserted the
first while meaning the second.

## Environment trap that cost most of the session

Ports 8080/9099 answered, so the harness attached — but they belonged to the operator's **other**
project (`antanoharini-web`), whose emulator was started from that repo with its own `firestore.rules`.
Those rules match only its collections, so every starlabs client read was denied and login bounced to
`/login?returnUrl=/EISDashboard` with no obvious error. Port 4200 was that project's `ng serve` too.
The Admin-SDK seed still "succeeded" (rules bypassed), which hid it.

Check before any local run: `netstat -ano | grep -E ":(8080|9099|4200) "` and the Firestore emulator's
java command line (`--project_id`, `--rules`). The recipe that worked is recorded in the operator's
memory notes; the short form is a scratch `firebase.emulator.json` with only firestore/auth blocks (the
repo's own config has a `functions` block pointing at the absent `starlabs-cloud-function` checkout),
`JAVA_HOME` set to the Adoptium JDK 17, the app on `:4300`, and `BASE_URL` + `EMU_REUSE=1`
`EMU_REUSE_APP=1` on the Playwright command.

## Coverage effect (once the 12 are fixed)

12/23 top-level content routes opened by a running test → 23/23, with all ten previously-untested routes
carrying a functional assertion rather than a mount smoke. The two dead routes and the dialog-only shell
child are covered by pinned-defect cases rather than counted as passing.

## Pending

1. Fix the 12 selector bugs and re-run to green. **Nothing here should be trusted as coverage until then.**
2. `scripts/check-route-coverage.mjs` still does not exist — the coverage artifact remains
   non-reproducible. A nesting-aware parser was written this session but not committed.
3. CN-11/12/14 remain `fixme` with no recorded reason.
4. `/videodashboard/upload`'s `canDeactivate` blocking path is untested — it needs an in-flight
   resumable upload, which the existing `installStorageStub` does not emulate.
