# 2026-09-04 — ATC scope enforcement, the page-object counting fix, and queue coverage

> WHY-journal per the CLAUDE.md rule. Companion to `2026-09-03-coverage-checkers-and-comms-cn18-23.md`,
> which introduced the two coverage checkers. Read both before changing anything here — several of the
> constraints below were arrived at by getting them wrong first.

Branch: `feat/e2e-coverage-gaps` (renamed from `feat/comms-cn16-21-channel-templates` — one branch now
carries the coverage work for ALL systems, per operator direction).

## THE MOST IMPORTANT THING IN THIS FILE

**A passing spec was deleted today because the screen it tested turned out to be an ATC reader.**

`/evolution-prep-participants` presents itself as "Diagnostics Queue — Participant Flow". Its route name
says nothing about ATC. Its collection reads through the default Firestore handle — `queue_token`,
`queue stage log`, `live assignment` — look like ordinary queue data. OP-16 was written against it, ran
green, and was about to be committed.

It also reads `queue_atc_generation` and `queue_atc_generation_backup` **through a separate ATC database
handle**, which is ATC generation data and squarely inside the app CLAUDE.md prohibition ("ATC data is
OFF-LIMITS ... Exclude all `src/app/ATC/**` components AND ATC readers from the test pipeline").

The spec was deleted, not kept. A green test against a forbidden screen is worse than no test: it is
coverage credit for doing the thing the constraint exists to prevent. Do not resurrect it.

## WHY three routes were excluded, not one

The operator's instruction was to exclude the ATC scoping route. Opening the neighbouring screens showed
the same problem twice more, so all three went to the denylist together:

| Route | What it actually is |
|---|---|
| `/viewrubrics_scoring_atc` | loads `queue system/atc-generated-from-queue-stage` — the ATC generated from a queue stage |
| `/evolution-prep-participants` | reads `queue_atc_generation(_backup)` from a SEPARATE ATC db handle |
| `/evolution-prep-participants-v2` | renders as **"ATC Transcript Ops"**; filters by `atcrequiredstages` / ATC stage |

Enforced at TWO layers, matching the existing D-001 pattern:
1. `_support/excluded-routes.ts` — tests must never navigate there. The coverage checker parses this file,
   so these routes leave the DENOMINATOR instead of sitting in the report as gaps someone keeps trying to
   close.
2. NO `dashboard` grant in `fixtures/seed-test-project.js` DRIVEN_ROUTES — so `authGuard` denies them to
   test actors even if a spec tried. The grants added for the evolution-prep screens were REVERTED for
   exactly this reason: granting access would defeat the exclusion.

## WHY `scripts/check-atc-coupling.mjs` exists

Because the above was found by a human opening screens, and that does not scale or repeat. The third
checker completes the trio:

```
check-suite-coverage.mjs   would a change here route a suite?        (routing)
check-route-coverage.mjs   does any spec actually open this screen?  (execution)
check-atc-coupling.mjs     is this screen allowed to be tested?      (scope)
```

Two tiers, deliberately:

- **STRONG** — reads an off-limits ATC collection, or takes a handle named for ATC
  (`collection(atcDb, ...)`, `getFirestore(app,'...atc...')`). Exit 1 if such a route is not excluded.
  This is the tier that would have caught the deleted spec.
- **WEAK** — the screen presents as ATC in its own headings. Reported for review, NEVER as a verdict.
  This is what made "ATC Transcript Ops" obvious to a human while its collection reads looked innocuous.

CLAUDE.md's reference-only config (`atc taxonomy`, `atc model`, `atcmodel level config`) is explicitly
allowlisted. **Do not remove that allowlist** — without it the checker fires on `/modellevelconfig`, which
is legitimately covered by BIG-09b, and a checker that cries wolf gets ignored.

Two false-positive classes fixed while writing it, both easy to reintroduce:
- `chatCollection` contains "atc" (ch-**atC**-ollection). Identifier matching needs an ATC token boundary,
  not a substring, or every support-chat screen is flagged.
- An unbounded `[^)]*` in the handle regex runs across newlines and reports a page of source as the
  "handle name". It is line-anchored now.

Current state: **0 ATC-coupled routes inside the test scope**; all 36 detected are already excluded.

## WHY the queue numbers changed twice (and the earlier ones were wrong)

`check-route-coverage.mjs` could not see through page objects that navigate by NAME.
`queue/pages/big-misc.page.ts` holds a route union and calls ``goto(`/${route}${qs}`)``, so specs open a
screen as `.open('biglevel')`. Six `big` routes were already covered and were being reported as gaps.

The checker now also harvests `.open('<token>')` where the token matches a declared route path — narrow
enough to keep false positives near zero, unlike accepting every bare quoted word. That single fix moved
in-scope coverage 121 → 127 and queue from 12/32 to 18/32.

**Lesson worth generalising:** a coverage checker that only understands one navigation idiom will
systematically understate suites that use page objects — i.e. the best-engineered ones. Before trusting a
low number, check HOW that suite navigates.

## `/openmeeting` — reviewed and kept IN scope

The WEAK tier flagged it ("Prescribe ATC is ready"). It reads no ATC collection; it is the Zoom client
view. Its host-only "Prescribe ATC" bubble does `window.open('/dynamicstudio?step=prescribe-atc')`
(`zoom-clientview.component.ts:1204`) — a denylisted route, opened in a SECOND WINDOW where
`assertNotExcluded()` cannot see it.

So: **the screen is testable, the button is not.** Any future spec must leave the prescribe bubble alone.
Recorded in `_support/excluded-routes.ts` under ADJACENT-BUT-IN-SCOPE so the review is not repeated —
along with `/atcmodel`, `/modellevelconfig` and `/eiflixdiscoverpage`, all reviewed and kept.

## Queue cases added (8/13 → 10/13)

| Case | Route | Assertion basis |
|---|---|---|
| BIG-12 | `/bigactivity` | seeded activity renders in the table built from the component's own `collectionData('bigactivity')` |
| BIG-13 | `/bigactivitylog` | **mount + app-computed tally smoke — deliberately weaker, see below** |
| OP-14 | `/queuevenue` | seeded queue name rendered from the app's own `getDocs('queue generation')` |
| OP-15 | `/zoomaccount` | seeded account rendered from `orderBy('lastname')`; row must also show the seeded email |
| OP-18 | `/queue-planner` | seeded queue name in the picker built from `queue generation` |
| OP-19 | `/queue-planner-review` | same, plus the "Merged View" heading so it cannot pass against the sibling |

### WHY BIG-13 is a smoke and stays labelled as one

The stronger case — asserting the ordered stream populates the activity `mat-select` — was attempted and
abandoned after FOUR emulator runs:
- `.first()` on `mat-select` picks "Filter Queue" (the screen has six selects);
- the `<mat-label>` is a SIBLING of the select inside `<mat-form-field>`, so text-filtering the select
  matches nothing — the form field must be filtered instead;
- a pointer click on the correct select then stalls in Playwright's actionability wait until the test
  times out, with nothing visibly overlapping it;
- `focus()` + Enter focuses the field (verified in the failure screenshot) but does not open the panel.

A flaky interaction is worse than an honest smoke. Recorded in-file as `TODO(BIG-13b)`; the clean fix is a
`data-testid` on that select, which the test-hooks step never added for this screen.

### WHY the planner cases assert only the queue picker

`/queue-planner` and `/queue-planner-review` read ~20 collections between them and the shared queue seed
writes only some. The QUEUE PICKER comes from `queue generation` (seeded); the downstream panels
(`cohorts queue planner`, `participant list`, `segments`, `email archive`, `wati archive`, ...) render
empty and are fine that way.

Seeding twenty collections to assert a fuller planner is a far larger change than closing a route gap
requires. Asserting the picker keeps the case honest about what is actually seeded rather than pretending
the planner has a populated world. If someone later wants deep planner coverage, that is a fixture
project, not an edit to these specs.

### WHY OP-15 seeds in-spec

`zoomaccount` is seeded nowhere and is read by exactly one screen. The doc is written in `beforeAll` and
deleted in `afterAll` (the in-spec precondition pattern `big-analytics.spec.ts` uses via `seedBigWorld`)
rather than growing the shared fixture for a single route. NOTE: the shared emulator teardown does not know
this collection, so that `afterAll` is the ONLY cleanup — do not drop it.

## The dashboard-grant tax — now confirmed systemic

Every new-route spec this week needed a `dashboard` route-config grant first, in FOUR different suites:
`comms/seed-comms.js`, `content/seed-content.js`, `journey/seed-journey.js`,
`fixtures/seed-test-project.js` (queue). Without it `authGuard` denies with "No roles or profiles
configured for screen: X" and the component never mounts **on a URL that looks correct** — indistinguishable
at a glance from the branch-divergence skip case.

**Rule for the next person: adding a spec for a not-yet-tested route starts with that suite's route-grant
list, not with the spec file.**

## Pending

- `queue system` 10/13. Remaining: `/queuetransfer` (flat — likely falls out like the planners did),
  `/arena/:queueid/:stage` (params, heaviest screen in the suite), `/openmeeting/:id/:collectiontype`
  (params + Zoom SDK stub + the prescribe-bubble constraint above).
- Suite-level gaps after today: content 18/28, workshops 26/33, journey 7/13, events 8/12.
- 20 routes sit in modules NO suite claims (`OpenVidu` 4, `Diagnostics Tool`, `LiveKit`, and 11
  single-route modules). Claiming them is a manifest decision, not a spec one.
- Still unanswered by the operator: the D-001 denylist names `/dynamicstudio` and `/dynamicqueuemanager`,
  but queue specs navigate to both today (`studio-session.spec.ts`, `actors-health.spec.ts`). Either the
  denylist grew after those specs or those tests violate it. Policy call, not a code one.
- The `CN-` case-ID prefix is shared by comms AND content (`CN-01..CN-18` collide across the two suites).
  IDs are only unique within a suite, so "CN-19 failed" is ambiguous without naming the suite.
- `SUITES.md` is still stale (shows appointments/events/profiles as local-only); regenerate with
  `node scripts/gen-suites-doc.mjs`.
