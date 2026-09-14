# profiles emulator gate — session journal (2026-07-01)

System #10 **profiles** ported behind the hermetic emulator CI gate — the **last of the 10 systems**.
Config-only via the shared lib + two honest handling decisions for real emulator limitations (analyzed as
setup/env, not app-code or test bugs). 20 passed / 3 skipped (2× consecutive), 0 failed.

## Both documented "blockers" dissolved on inspection
The handoff HELD profiles for **CF-in-emulator** + the **`firestore-forms` named DB**. On assessment (like
appointments):
- **CF-in-emulator — RESOLVED (rode in on the modes work).** The participant-metadata CFs
  (`profiledata_to_pmd` / `journey_to_pmd` / `productsdata_to_pmd`) already run in the emulator, so
  **PA-CF-01..05 PASS for real** (assert CF output — not skipped). The modes CF work even fixed
  `productsdata_to_pmd` null-safety, which is PA-CF-03's CF.
- **`firestore-forms` named DB — served on-demand.** The seed writes it via `getFirestore(app,'firestore-forms')`
  (Admin SDK). No provisioning needed for the WRITE side.

So the port itself was config-only (seeder `initAdminAuto` + 4 factory files). But two suites failed on real
env limits:

## Fix 1 — WATSON (PA-07/08/18): allowlist, mirroring journey
`participants-analytics.component.ts:303` lazily `getApp("watson")` for a legacy cross-project analytics
widget the test env intentionally never wires (`environment.emulator.ts` nulls watson) → `app/no-app` throw.
The screen still renders its participant-metadata table; only the widget can't init. **This is the exact
scenario journey documents** (`journey/support/journey.ts` `JOURNEY_IGNORABLE`). Fix: add the watson pattern
(`/No Firebase App '?watson'?/i`, `/app\/no-app/i`) to the profiles specs' existing `TOLERATE` allowlists
(profiles-deep.spec.ts, analytics.spec.ts). By-design tolerance, not masking.

## Fix 2 — FORMS-DB named DB (PA-13/14): documented emulator-limitation skip
The interesting one. PA-13 (client READ) / PA-14 (client WRITE) of `formsByClient` in the `firestore-forms`
**named DB** failed with **"Missing or insufficient permissions."**

**Analysis (setup / code / test?):** SETUP/env — the emulator config gives the permissive `firestore.rules`
to the **default DB only**; the named DB defaults to DENY for the client (Admin seeds bypass rules, so the
seed worked). App code is correct (in prod the named DB has real rules); the test is correct (caught a real
denial).

**Attempted the setup fix — and it's IMPOSSIBLE here.** Converting `firebase.emulator.json`'s `firestore`
to the multi-DB **array form** made the emulator log:
`"Cloud Firestore Emulator does not support multiple databases yet"` → then `"Did not find a rules file"` →
`"default to allowing all reads and writes"`. So firebase-tools (15.22.4) **cannot** give a named DB rules;
the array form is rejected and drops the rules file entirely. There is no config that fixes it.

**Honest handling:** REVERTED the array change (single-object, + a doc comment warning against the array
form), and `test.skip(!!FIRESTORE_EMULATOR_HOST, ...)` PA-13/14 on the emulator with a documented reason —
the forms-DB read/write is validated against the **cloud** test project (`playwright.profiles.config.ts`,
which has the real named DB). Same class as comms' "EMULATOR LIMITATION: functions emulator doesn't deliver
X trigger" skips and content's CF-gated skips: real coverage lives on the cloud config; the hermetic gate
skips what the emulator genuinely can't do. NOT masking an app bug.

## Verification
2× consecutive local green: **20 passed / 3 skipped** (PA-13, PA-14 emulator-limitation; PA-FT-FILT
pre-existing fixme) / 0 failed. On `systems-emulator`: `24c507d` (port) + `85603bb` (fixes).

## Surprises / notes
- The Firestore **emulator does not support named databases / per-named-db rules** (firebase-tools 15.22.4).
  Any suite needing client access to a named DB in the emulator must skip it and validate on cloud. Don't
  re-attempt the `firestore` array form — it's rejected and worse (drops all rules). Comment left in
  `firebase.emulator.json` to that effect.
- Rebooting the shared emulator to test the (failed) named-db config left it on a transient allow-all state;
  the reverted overlay restores the single-object permissive rules on the next boot. Functionally equivalent
  meanwhile.
- Shared tree still hosts the operator's events work; staged only profiles files.

## Fix 3 — PA-09 (CI-only): app-branch divergence cicd↔cicd-dev (the CN-14 class)
CI run #2 (caller `0896a67`, `cf_branch: cicd-modes-emulator-fix`) landed **19 passed / 3 skipped / 1 failed** —
the ONLY failure PA-09 (the `/profilesummary/<profileid>` routerLink assertion in the PA-07 test), green
locally, red in CI.

**Root cause (setup vs app-branch vs test → app-branch).** Ruled out the seed hypothesis first: every
candidate first-row doc carries a non-empty `profileid` — seeded p0–p3/PRODPF set the field, and the CF
`profiledata_to_participantmetadata` create-path sets `profileid` (participantmetadata.js:47), so even the
alphabetically-first CF-created "CF Origin Name" row (analytics orders by `name`; uppercase sorts before the
lowercase staff-email names) has one. Then diffed the analytics HTML across app branches:
- `cicd` (served locally): name cell `routerLink = '/profilesummary/' + element['profileid']` → passes.
- `cicd-dev` (CI builds it): name cell `routerLink = '/userprofile/' + element['profileid']`, cell wrapped in
  `<app-profile-picture [profileId]=…>`. Renamed by cicd-dev commit **`3a40282`** "Integrate profile-picture
  component and its caller screens from mahalakshmi-development" (not on `cicd`). → old regex fails.

This is the **same class as comms CN-14**: mahalakshmi-development merges land on `cicd-dev` first, so the
branch CI builds diverges from the branch served locally.

**Honest handling — broaden, don't skip.** PA-09's intent is anti-circular: the href is built from the app's
OWN `profileid` (not a test-set value). Both `/profilesummary/<id>` and `/userprofile/<id>` are app-built
profile-detail routes keyed by profileid, so both satisfy that intent identically. Broadened the regex to
`/\/(profilesummary|userprofile)\/.+/` — the `.+` tail stays load-bearing (a bare `/userprofile/` from an
empty profileid still fails). Unlike CN-14 (feature absent on one branch → skip), the asserted behavior exists
on BOTH branches here, so broadening keeps coverage live on both rather than forfeiting it. Committed
`systems-emulator` **`49ed922`** (test file only).

**Validation — GREEN.** Re-triggered PR #31 via caller synchronize `14c8b94` (path-matched workflow-comment
bump; `e2e_ref: systems-emulator` resolves the branch tip at run time → picked up `49ed922`). Run reported
**20 passed / 3 skipped / 0 failed** (operator-confirmed green). PA-09 resolved; profiles ready to promote.

## Promotion — DONE (profiles active on cicd-dev @main)
Mirrored appointments exactly:
1. Hub **PR #5** `systems-emulator → main` merged (5 commits: profiles 24c507d/85603bb/49ed922 + events
   3bfc712/6323c45 rode along — events caller stays pinned @systems-emulator so it does NOT run @main).
2. Flipped `profiles-caller` `@systems-emulator → @main` via plumbing (`ee7de36`); kept
   `cf_branch: cicd-modes-emulator-fix` (do NOT flip to development until the CF team merges it there).
3. Re-validated PR #31 `@main` — **All checks passed**, emulator gate Successful in 5m.
4. Merged **PR #31 → cicd-dev**. Tripped branch-guard (alert-only, meena-as ∉ vignesh allowlist) + fired a
   dev deploy — both expected, nothing reverted.

**Profiles = 9th active system on cicd-dev.** All @main.

## Pending (rollout tail)
- **events** (`3bfc712`, PR #30 was CI RED) + **modes** (PR #25 report-only) — operator's domain; promote
  when they're ready. NOTE: events ENGINE files are already on hub `main` (rode in on PR #5), so events only
  needs its caller flipped `@main` + a green gate before merging PR #30 — no separate hub merge required.
- **journey** — held (2 product-code fixes need vignesh/app-team review; PRs #8/#9 DO-NOT-MERGE).
- **branch-guard governance** — meena-as cicd-dev merges trip the vignesh-allowlisted tripwire (alert-only).
  Decide: add meena-as to the hub allowlist, or route merges via vignesh.
