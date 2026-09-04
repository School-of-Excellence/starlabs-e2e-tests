# 2026-09-03 — Coverage checkers, the ATC exclusion, and comms CN-18..20

> WHY-journal per the CLAUDE.md rule. Plans say WHAT; this says why each constraint landed, so a future
> session does not "simplify" one of them back into the bug it was written to prevent.

## What prompted this

The question was simply "do our suites cover everything?" — which the repo could not answer. The manifest
routes suites by glob; nothing checked those globs against reality. Two checkers now exist:

- `scripts/check-suite-coverage.mjs` — PATH coverage. Does any manifest glob match this file? Catches
  routing gaps (a change routes no suite) and stale globs (code moved; the glob silently stopped matching).
- `scripts/check-route-coverage.mjs` — EXECUTION coverage. Does any spec actually OPEN this screen?
  Parses `app.routes.ts` → module, joins against routes found in the specs.

Baseline at the end of the day: **226 routed screens, 33 out of scope, 119 opened = 62% in-scope.**

## WHY two checkers and not one

Because path coverage alone reports FALSE GREEN, and we hit a live example. `workshops` claimed
`src/app/Workshop/**`, so a change there made the workshops gate mandatory — but its specs only ever
opened `New-Workshop/` and `Scheduling/` screens. Path coverage called that folder "covered". It was not.
The same shape held for `Channel Communication` (this session's fix), `journey-onboarding-detail` and
`content-upload-version2`.

A gate that runs green while testing none of the changed code is worse than an obvious hole, because it
buys confidence it has not earned. Any future "one checker is enough" simplification re-opens exactly this.

## WHY the checkers must not read `_support/excluded-routes.ts` as coverage

The first version of the route checker scored `src/app/ATC` at 15/15 — perfect coverage of a module no
test may touch. `_support/excluded-routes.ts` is a DENYLIST (`assertNotExcluded()` throws; reason:
sensitive ATC data, D-001), and its route literals were being read as visits. Its meaning is the exact
inverse of a spec's.

The checker now excludes that file as a source AND parses it as the authoritative out-of-scope list, so
denylisted routes leave the denominator — counting gaps nobody is permitted to close measures against an
unreachable target. Correcting this moved the headline number 71% → 61%; the 71% was fiction.

Note the denylist reaches beyond `src/app/ATC/**`: `/big-dashboard`, `/profilelist`, `/dynamicstudio`,
`/dynamicqueuemanager`, `/overall_event_dashboard` and others carry ATC data and are blocked too. That is
why several suites cannot reach 100%, and it is correct that they do not.

**OPEN QUESTION for the D-001 owner:** the denylist names `/dynamicstudio` and `/dynamicqueuemanager`, but
queue specs navigate to both today (`studio-session.spec.ts`, `actors-health.spec.ts`). Either the denylist
grew after those specs, or those tests violate it. Not resolved here — it is a policy call, not a code one.

## WHY `suites-manifest.json` gained an `excluded` block

Operator decision this session: `src/app/ATC/**` and `src/app/ATC-Ops/**` (17 routes) stay out of e2e
scope. The denylist already stopped tests NAVIGATING there; the manifest block is a different layer — it
stops a suite being ROUTED when that code changes. Both are needed, and each entry carries a reason string
so the decision is auditable. Adding a path there means changes ship ungated, on purpose.

## WHY extracting only `page.goto('/literal')` is wrong

The first extractor caught only direct literal gotos. Specs also pass routes to helpers
(`openAsActor(page, actor, '/big-dashboard', …)`) and loop over route arrays
(`for (const route of ROUTES) page.goto(route)`).

That bug made me report 43% coverage and call `src/app/Workshop` dead legacy code. Both wrong: it is 4/5,
covered deliberately by the legacy-route mount smoke at `workshops/workshops-deep.spec.ts:486`. The fix is
to also accept any quoted `/...` literal that intersects the routes declared in `app.routes.ts` — the
intersection keeps false positives near zero. **Do not narrow this back to goto-only.**

## Manifest fixes applied

1. **queue cfPaths were stale.** They named `functions/components/ATC.js`, `atc_alerts.js`,
   `atc_helpers.js`, `queue_atc_generation.js` — all four had moved into
   `functions/components/queue-required-stage-aiatc-creation/`. Editing ATC generation logic routed NO
   suite. Repointed at the subfolder (`/**`) rather than re-listing filenames, so a future move inside it
   cannot silently break the gate again.
2. **`src/app/big/**` was tested but unclaimed** — queue specs open `/big-dashboard`, `/bigcohorts`,
   `/manualassignment`, yet no glob named the folder. Added to queue's `appPaths` and to its `big` AREA, so
   a `big/` change routes the big subset rather than the whole queue suite.

Stale globs are now zero.

## comms CN-18..CN-20 — /channel-templates

The comms glob already claimed `src/app/Channel Communication/**` while no spec opened its only route.
CN-18 (list renders) / CN-19 (soft-deleted hidden) / CN-20 (app-computed status pills) make that claim
true. Green locally; `Channel Communication` 0/1 → 1/1, comms 3/4 → 4/4.

### WHY CN-19 asserts the seed doc EXISTS before asserting the row is absent

Deletion is SOFT (`channeltemplates.component.ts:461` sets `delete:true`). Asserting only "row absent"
cannot distinguish "the app's `.filter(t => !t.delete)` ran" from "the doc was never seeded" — the latter
passes for the wrong reason. The case admin-reads the doc and asserts `delete === true` FIRST, and waits
for the list to have rendered before asserting the absence, so an unloaded table cannot pass it either.

### WHY CN-20 counts project-wide rather than by testrunid

`statusCounts` is computed over the component's OWN unfiltered query (ts:305-309). A run-scoped expectation
would assert a number the app never computed. The tradeoff is sensitivity to other docs in a shared
project; if it proves flaky under contention the honest fix is to assert self-consistency with the rendered
rows, NOT to quietly scope it to testrunid and call it passing.

### WHY `resetChannelTemplates()` hard-deletes the ' (Copy)' docs

`duplicateTemplate()` spreads the source doc (`...t`, ts:472), so the copy INHERITS `testrunid`/`_testdata`.
Nothing else prunes it, so CN-23's before/after count would drift upward on every run and a
`testrunid==RUN` count is not stable after CN-23 runs. Scope that assertion to the ' (Copy)' name.

### The case-ID trap

CN-16 and CN-17 were already in use (`comms-deep.spec.ts:246`, `chat.spec.ts:95`) but had never been
back-filled into the recon table, which stopped at CN-15. I numbered from the doc, collided, and renumbered
to CN-18..23. Both missing rows are now back-filled — the recon table is the thing people number from, so
it lagging the specs is a live hazard.

## What actually cost the time (environment, not tests)

1. **`ng serve --configuration emulator` fails on a bare app checkout.** The app repo deliberately carries
   NONE of the emulator wiring; the hub injects it via `ci/setup-emulator-config.sh` (CI does this too).
   Locally: `APP_PATH=<app> bash ci/setup-emulator-config.sh`. It modifies the app's `angular.json` and
   `package.json` (idempotent, by design).
2. **`node_modules` was stale** — `leaflet` + `@types/leaflet` declared but not installed, and
   `@zoom/meetingsdk` needs `react`/`redux`/`redux-thunk`, which are NOT declared anywhere. Vite only trips
   over the latter when it re-optimizes. Installed with `--no-save` so no tracked file changed.
3. **Angular binds `localhost` to IPv6 (`[::1]`) only**; Playwright resolves to IPv4 → `ERR_CONNECTION_REFUSED`.
   Serve with `--host 127.0.0.1` and point `BASE_URL` at the same.

## THE ONE THAT MATTERS — recon risk #1 bites through the seed, not the component

All three cases failed with `app-channeltemplates` never mounting, at a URL that looked correct. The
screenshot showed the real cause: **"No roles or profiles configured for screen: /channel-templates"**.
`authGuard` resolves allowed roles from the `dashboard` collection, and `seed-comms.js` carries an explicit
`ROUTES` grant list — every route a spec navigates to needs an entry or the guard denies it. That list is
at `comms/seed-comms.js:109`, and its own comment names this failure mode as recon risk #1.

I had recon'd the COMPONENT (Firestore collections, selectors, dialogs) and not the SEED's route-grant
list. **Any new spec for a not-yet-tested route must add its route to that suite's `ROUTES` array first.**
The symptom — a component that never mounts on a correct URL — looks identical to the branch-divergence
skip case, which is the trap: one is fixed in the seed, the other cannot be fixed test-side at all.

## CN-21/22/23 (write path) — and WHY A SINGLE GREEN RUN PROVES NOTHING HERE

All six went green on the first run. Running the suite a SECOND time immediately after found two real
defects that the first run could not have caught. **Any state-mutating case must be run twice
back-to-back before it is believed.**

1. **`channeltemplates` was missing from the `SEEDED` teardown list** (`seed-comms.js`). The seeded docs —
   and the ' (Copy)' doc CN-23 makes the APP create, which inherits our `testrunid` via the `...t` spread —
   survived between runs. Nothing else prunes that copy.
2. **`hasText` is a SUBSTRING match.** With a copy present, `hasText: 'Pending Channel comm'` resolved to
   BOTH the original and 'Pending Channel comm (Copy)' → strict-mode violation in CN-18. Fixed with an
   anchored-regex `nameCell()` helper. Do not revert it to a plain string: the seeded names are prefixes of
   the app-generated copy names, so substring matching is permanently unsafe on this screen.

After both fixes: two consecutive runs, 6 passed / 6 passed.

The dialog handling worked as designed. `approveTemplate()` raises a native `confirm()` and
`reworkTemplate()` a `prompt()`; each case registers `page.once('dialog', …)` and ALSO asserts a
`sawDialog` flag — because Playwright auto-dismisses when no handler is registered, which would make the
action a silent no-op while the test still passed. The flag is what makes the dialog path non-vacuous;
keep it.

## Pending
- `/channel-templates` is absent on `origin/cicd` (present on `development` + `cicd-dev`) — recon risk #11.
  The specs carry the CN-14-style self-skip guard, so this self-heals; it did NOT trigger locally.
- Biggest remaining gaps: queue 12/32, journey 3/13 (2 of journey's 10 are blocked by external SalesCRM /
  Watson dependencies), content 16/28.
- `SUITES.md` is stale (still shows appointments/events/profiles as local-only). Regenerate with
  `node scripts/gen-suites-doc.mjs`.
