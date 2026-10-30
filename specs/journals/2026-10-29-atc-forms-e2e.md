# 2026-10-29 — ATC forms e2e (atc + journey suites), harness findings

App journal: `starlabs-angular/specs/journals/2026-10-29-atc-forms.md` · App plan: `specs/plans/2026-10-29-atc-forms-step1.md`.
EMULATOR ONLY throughout (the ATC rule): nothing touched a real database.

## What was added
**`atc/view-prescribed-atc-forms.spec.ts`** (hook prefix `vatc`, 15 cases):

| Case | Covers |
|---|---|
| 01 | collapsed count; unvalidated / no-forms negatives |
| 02 | the row matrix — status + buttons from `formsubmitted` + requests incl. an earlier-version request and another ATC's request (negative control); gone doc hidden; soft-deleted rules |
| 03 | unvalidated opened |
| 04 | freeze — card within 15 s, the same row node 3 s later (trackBy), no long task > 2 s |
| 05 | View overlay |
| 06 | Send / Revoke / Resend docs |
| 07 | live listener |
| 08 | Fill → record → tab close → View |
| 09 | ATC edited while the Fill tab is open → recorded on the new version |
| 10 | ATC deleted → nothing saved |
| 11 | form screen without `atcid` unchanged |
| 12 / 13 | **every widget type** (label, video, audio, Text, number, email, time, date, DropDown, MultiSelect, Paragraph, Checkbox, slider, multicheckbox + flipping sliders, radio, repeating group with all sub-types) — draft saves + submit saves each value, via View ATC and without an ATC |
| 14 | specialist resubmit (Edit → prefilled → Preview & Update → same doc updated, old copy in `formsByClient log`) |
| 15 | no extra access check — an `ah` user may act |

**`atc/edit-atc-templates.spec.ts`:**
- **EATT-09:** WiSH newly picked procedures mandatory → Changework brief required; the saved version has exactly those
  two mandatory; a plain model stays optional.
- **EATT-06:** now expects a NOT-involved user can add a review (the role check was removed).

**`atc/prescribe-atc-templates.spec.ts` — PTPL-06:** adds the Changework brief recording (WiSH procedures are mandatory
in Prescribe since `d358aa58`) and checks the saved procedures are mandatory.

**`atc/view-atc-templates.spec.ts`:** dropped the `vatc-review-readonly` check (that note was removed from the app).

**`journey/atcmodel-forms.spec.ts`** (prefixes `va`, `ca`, 4 cases):
- the table names;
- the dialog's active-only picker + "Form not found";
- the filled-by requirement + saved name order;
- remove.

**`journey/delivery-form-delete.spec.ts`** (prefixes `ds1`, `ud`, DFD-01): save writes `delete:false`; Delete → true +
"(Deleted)"; Restore shown instead of Delete and saving keeps it deleted; Restore → false.

**Added after the Flutter session (2026-10-29, late):**
- the Flutter session added `formstatus: 'sent'` to the seeded requests, to VATCF-06 / 07, and **VATCF-16** (a request the
  app marked `'submitted'` is kept and the row is no longer waiting);
- **VATCF-17:** on an edited ATC (RV0 → RV1), Resend rewrites RV0's request (same doc, `atcid` stays RV0, no RV1 doc);
  a soft-deleted form still waiting keeps Revoke, and after Revoke shows "no longer required" with Send off.
- With these: atc suite 115/115 (before VATCF-17); forms spec 17/17; **final full atc run on the aligned code: 116/116**.

**Forms card redesign (2026-10-29, late):** assertions moved to the new labels and statuses (To fill / Waiting for
participant / Waiting for update / Not required; View answer / Edit answer / Send to participant / Ask to update /
Withdraw), plus the summary line, group headings, explanation notes and the Withdraw confirm dialog. The status hook
`vatc-form-status` sits on the label (the pill's Material icon ligature would otherwise be part of its text). Forms spec
17/17.

## Seeds
- **`atc/seed-atc.js` phase 6:**
  - participants `tfa`…`tfe`;
  - the forms model (8 forms incl. soft-deleted `old` / `oldSub` and a missing `gone`);
  - answers in **firestore-forms** `formsByClient`;
  - requests;
  - ATCs V0 / V1 (version chain) / OTHER / UNV / ACT / FILL / UP1 / DEL / ALL / EDIT / WEDIT / PEDIT;
  - the all-widgets form + its model (media = local `/assets/Back_Arrow.png` — a real Storage URL would trip the G2
    guard);
  - staff user `ah`;
  - `/formtemplate` route grant;
  - `atc_form_requests` in the ATC teardown;
  - teardown of app-written `formsByClient` / `temporary_forms` by `atcid` and by our form ids (otherwise
    VATCF-11 / 13 would read a previous run's answer).
- **`journey/seed-journey.js`:** route grants `/atcmodel` (was missing — "Contact Admin" dialog) and `/deliveryactivities`.

## Harness findings (why the specs look the way they do)
- **Two tabs starve the form tab.** The emulator speaks HTTP/1.1, and Chrome allows 6 connections per host. View ATC's
  live listeners + the `window.open` form tab's own channels left the form tab's **Write** stream without a connection:
  the POST went out, the ack never came, and the screen sat on "Submitting Please Wait…".
  - Proven by submitting the same URL in a single tab (works) vs a popup (hangs).
  - Production Firestore is HTTP/2 (multiplexed), so users aren't affected.
  - The specs call `releaseViewAtc(page)` (goto `about:blank`) right after the popup opens. The tab stays
    script-closable; View ATC is reopened afterwards with `openFor(…, login=false)` (a second login on a signed-in page
    lands on the dashboard and times out).
- **`:4200` reuse.** The hub's webServer only reuses an app on :4200. The operator's own `ng s` (real DB) sat there, so
  the runs used `BASE_URL=http://localhost:4300` (the emulator app) with `EMU_REUSE_APP=1`. When :4200 was free, a tiny
  scratch pass-through :4200 → :4300 was used and stopped after.
- **Emulator slowdown.** After a few hours the seed hits `DEADLINE_EXCEEDED`. Restart the emulator (3 times this
  session).
- **Material gotchas:**
  - clicking the centre of `mat-radio-button` misses its label → `input[type=radio][value=…]`.check();
  - the delivery list's filter input isn't the first `input[matInput]` on the page → `getByLabel('Filter')`.
- **Number inputs save text (`"42"`).** The spec asserts the existing behaviour (see the app journal §3).
- **Proving a test catches the bug:** the old video code was temporarily restored and VATCF-13 failed exactly as the
  operator saw (src = "SafeValue must use…", draft never "Saved").

## Results (2026-10-29)
- Full atc suite: 112–114 / 113–114 across the day's runs. The only failures were PTPL-06 (fixed) and one ATE-03 Firestore
  `INTERNAL ASSERTION FAILED (c050)` flake that passed 6/6 on rerun.
- journey atcmodel-forms + delivery-form-delete: 5/5.
- **Final full atc run on the last code (after the review-log access removal): 114 / 114 green.**
- **Not run:** the queue suite (owns formtemplate) and the workshops suite (owns update-delivery) — before push.

## How to run locally
```
# emulators (hub)
JAVA_TOOL_OPTIONS=-Xmx4g npx firebase emulators:start --only firestore,auth,storage --project starlabs-cicd --config firebase.emulator.json
# app (starlabs-angular)
npx ng serve --configuration emulator --port 4300
# specs (hub)
EMU_REUSE=1 EMU_REUSE_APP=1 BASE_URL=http://localhost:4300 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx playwright test --config=playwright.atc.emulator.config.ts --workers=1
```
