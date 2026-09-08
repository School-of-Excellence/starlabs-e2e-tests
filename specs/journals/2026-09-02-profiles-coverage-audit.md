# 2026-09-02 — Repo walkthrough + profiles coverage audit (READ-ONLY session)

**Status:** No code changed. Analysis + four published reference documents. **Author:** session
(operator: appexperience@soexcellence.com). Trigger: a new team member asked for a ground-up
explanation of the hub, then for a code-vs-spec gap analysis on the `profiles` suite.

> **Nothing in this repo or in `starlabs-angular` was modified.** Every finding below is an
> observation; the fixes are proposed, not applied. Two of them are one-line config edits and are
> listed under *Pending* so the next session can land them.

---

## What was done

1. **Full read of the hub** — docs, the 4 workflows, `run-isolated.sh`, `deploy-cf-emulator.sh`,
   `cf-predeploy.sh`, `setup-emulator-config.sh`, the seed layer, `lib/`, the console frontend +
   backend, and the suite catalogue.
2. **Full spec-file inventory** — all 80 `*.spec.ts`, reconciled against `test-cases.csv` and
   `suites-manifest.json`.
3. **Profiles coverage audit** — `starlabs-angular@development` (06e435c3)
   `src/app/Participants Profile Management/**` + `ProfilePicture/**` compared, screen by screen,
   against `profiles/*.spec.ts`.

Deliverables (published as Artifacts, links in the session transcript): a repo field guide, a
commit→merge pipeline walkthrough, a searchable catalogue of all 18 test systems, and the profiles
gap report.

---

## What was found

### A. Docs that no longer describe the code

| Document | Claims | Reality |
|---|---|---|
| `README.md` | the app repo's CI clones this repo | inverted — the hub owns `web-e2e.yml`, app repos carry thin callers |
| `SUITES.md` | appointments / events / profiles are `local-only` | manifest says `ciReady: true` (commit `d9a2eb3`); generator never re-run |
| `docs/GOAL.md`, `CLAUDE.md`, `console/README.md` | console has **Approve & Merge** + approver allowlist | **removed (D3)** — `approveAndMerge` does not exist; humans merge on GitHub |
| `docs/GOAL.md` | 6-status lifecycle ending `OK_TO_RELEASE → …` | 10 statuses; `OK_TO_RELEASE` split into `PREVIEW_*` / `OK_FOR_DEV` / `OK_FOR_PROD` |
| `CLAUDE.md` | callables `markOkToRelease` / `createPrToDev` / `createPrToProd` | actual: `deployPreview`, `signoff`, `createPullRequest`, `planTestRun`, `runTests` |
| `CLAUDE.md` | `console/src/app/screens/report/` exists | **absent, never committed** — see B |

Fix for row 2 is `node scripts/gen-suites-doc.mjs`.

### B. `console/` does not build

`console/src/app/app.routes.ts:88` lazy-loads `./screens/report/report.component` for the
`report/:githubRunId` route. That directory **does not exist, is not gitignored, and
`git log --all` shows it was never committed.** `ng build` in `console/` therefore fails with
TS2307. The backend, `report.json` generation in `run-isolated.sh`, and `cicd-audit` are all intact —
only the screen is missing.

### C. Two different lists of twelve

This cost a wrong answer mid-session and will cost the next person one too.

- **`suites-manifest.json`** — 12 suites: `queue` + 11 groups. **Excludes `support`.** Governs CI
  routing and the console dialog.
- **`TEST-MAP.md`** — a different 12: the "component groups". **Excludes `queue`, includes `support`.**

Union = 13. When someone says "the 12 systems", ask which. The manifest is the one that runs.

### D. Suite/spec accounting

80 spec files exist; the manifest reaches 70.

| Bucket | Files | Cases | Note |
|---|---:|---:|---|
| manifest 12 | 61 top-level / **70 globbed** | 325 | `queue`'s `specDir` recurses into `variations/` (+9) |
| `support` | 3 | 18 | **not in the manifest** — CI can never route it |
| `queue/mobile` | 1 | 9 | excluded by `testIgnore` |
| `cf-guards` | 1 | 1 | `cfPredeploy` block, not the gate; **absent from `test-cases.csv`** |
| root legacy | 5 | 8 | D-002 bridge smokes, self-skip without `BASE_URL`, no CI lane |
| `flutter-suite` | — | 11 buckets | not Playwright |

### E. Profiles coverage — the audit proper

13 routed screens, 20,083 LOC, 157 click handlers, 36 dialogs, 23 declared cases.
**20 cases run in the gate** (1 `fixme`, 2 emulator-skipped) and **one write path is asserted in CI.**

| Sev | ID | Finding |
|---|---|---|
| P0 | G-01 | `profilelist` (Delete Profile, Update Role, `deleteDoc`+`updateDoc`) has no test **and no route grant** — `seed-profiles.js` `ROUTES` omits `/profilelist`, so the authGuard would bounce any test written today |
| P0 | G-02 | `view-participants-form`'s only two cases (PA-13, PA-14) both `test.skip` on `FIRESTORE_EMULATOR_HOST` — the gate **is** the emulator, so a 1,870-LOC screen with an `updateDoc` path contributes nothing, and the suite still reports green |
| P0 | G-03 | `profile-summary` — 8 write actions + 5 dialogs, covered by one name-render test (PA-10) |
| P0 | G-04 | `participants-analytics` — 4,881 LOC, 54 handlers, 21 dialogs, all 4 write ops, 3 hardcoded **prod** CF URLs; 3 tests, all read-only |
| P1 | G-05 | `journey-product-purchase`, `participant-product`, `participant-delivery-sequence` live under the **profiles** glob but their tests are in **journey**, whose globs never match them → CI runs the suite without coverage and skips the one with it |
| P1 | G-06 | `new-profile` writes `filteredtimeline profile` + `participant metadata`; neither asserted |
| P1 | G-07 | `userprofile` — 3 of 4 dialogs and the `setDoc` path untested; only the Journey tab asserted |
| P1 | G-08 | `userprofile_old` — 1,577 LOC, routed, `updateDoc`+`writeBatch`, zero coverage |
| P2 | G-09 | `PA-FT-FILT` (the form-tracker **Apply** filter — the screen's primary interaction) is `test.fixme` |
| P2 | G-10 | Seeder grants `/userprofile` + `/profilesummary`; real routes are `userprofile/:id` + `profilesummary/:profileid`. `ProfilePicture/**` is in the glob but `profile-picture` is not routed |
| P2 | G-11 | 5 non-routed dialog components in the glob; 3 write; two hang off the unreachable `profilelist` |

---

## What surprised us

- **`suites-manifest.json` claims `Participants Profile Management/**` for BOTH `profiles` and `modes`.**
  Both run on a change there. Not wrong, but `modes` carries a `reviewNote: "appPaths guess"`, so it is
  probably accidental.
- **A legitimate skip reason silently erases a screen from the gate** (G-02). The emulator genuinely
  cannot apply rules to a named database — but nothing anywhere surfaces "this screen is untested in CI",
  so green means two different things depending on the file.
- **`cf-guards` is missing from `test-cases.csv`.** The one test that can block a `firebase deploy` is
  absent from the case catalogue. Anyone auditing coverage from that CSV concludes the CF gate does not exist.
- **The harness is macOS/Linux-only.** `run-isolated.sh` / `deploy-cf-emulator.sh` / `cf-predeploy.sh`
  depend on `lsof`, `pkill`, `/opt/homebrew/opt/openjdk`. On Windows Git Bash `port_up()` always returns
  false, so the runner loops restarting the emulator and exits 4. WSL2 or macOS for the full gate;
  `npx playwright test --config=…` works directly on Windows.
- **`npm run emu:seed` hardcodes `FIREBASE_PROJECT=demo-slabs-queue`** while `deploy-cf-emulator.sh`
  defaults to `starlabs-cicd`. Seeding after booting writes to a different emulator partition and
  everything silently finds no data. `SETUP.md` §3 calls this exact class of mismatch "the critical
  gotcha". Use `npm run test:emu` / `npm run report:emulator`, which seed via `globalSetup`.

---

## Pending (ordered by value per unit of effort)

1. **One line, unblocks four tests** — add `{ route: '/profilelist', label: 'Profile List' }` to
   `profiles/seed-profiles.js` `ROUTES`. Without it G-01 cannot be fixed at all.
2. **One manifest edit, makes existing coverage fire** — add the three
   `src/app/Participants Profile Management/{journey-product-purchase,participant-product,participant-delivery-sequence}/**`
   paths to `journey.appPaths` (G-05). No new test code.
3. **Regenerate `SUITES.md`** — `node scripts/gen-suites-doc.mjs`.
4. **Restore `console/src/app/screens/report/`** — the console frontend does not build without it (B).
5. **Register `support` in `suites-manifest.json`** + add `support/support/emulator-global-setup.ts`.
   18 cases go from unroutable to gated.
6. **Add `cf-guards` to `test-cases.csv`.**
7. **Profiles cases, in order:** `PA-21`/`PA-22` (profile-summary notes — ~20 lines each, APPT-09 shape) →
   `PA-19`/`PA-20` (profilelist delete + role, after #1) → `PA-28` (view-participants-form notes overlay
   on the **default** DB, so it runs in CI and partially answers G-02) → `PA-24` (new-profile timeline
   write) → `PA-29` (analytics prod-firewall assertion, WS-09/WS-14 shape) → un-park `PA-FT-FILT`.
8. **Decide on `userprofile_old`** — delete the route and folder, or cover it. A routed, writing,
   untested duplicate is the worst of the three options.
9. **Resolve the `CN-` prefix collision** — `content` and `comms` both use `CN-01…17`; comms was
   presumably meant to be `CM-`.

---

## Gotchas for future sessions

- **Do not trust the prose docs over the code.** `README.md`, `SUITES.md`, `CLAUDE.md` and
  `console/README.md` each describe a superseded design. `console/functions/src/index.ts:1-20` and
  `suites-manifest.json` are the current sources of truth for the console and for routing.
- **When enumerating anything, walk the filesystem.** `TEST-MAP.md`'s "12 component groups" is a
  narrower set than the repo contains; an inventory built from the prose misses `queue`,
  `queue/variations`, `queue/mobile`, `cf-guards`, the root legacy specs, and `flutter-suite` entirely.
- **`test-cases.csv` is curated, not generated.** Its per-suite counts are lower than raw `test(`
  declaration counts (which include `test.skip` / `test.fixme`), and it omits `cf-guards`.
- **The Angular repo is at** `C:/Users/Admin/Desktop/organization-starlabs-angular/starlabs-angular`
  (branch `development`) on the operator's machine — it is *not* a sibling of the hub, so the default
  `./app` symlink assumption in `setup.sh` does not hold there.
- `node fixtures/seed-test-project.js --plan` runs with **no credentials, no emulator, no deps** and
  prints the entire seed plan. It is the fastest way to explain the seeded world to a newcomer.
