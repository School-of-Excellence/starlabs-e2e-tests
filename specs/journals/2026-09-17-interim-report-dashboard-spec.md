# 2026-09-17 — modes: Interim Report Dashboard spec (IRD-01..IRD-11)

Covers tab 3 of `/interimreportlog` — the embedded `<app-interim-report-dashboard>` — which had only
ADDRESSABLE coverage (`interim-report-tabs.spec.ts` IRT-DASH) until now. New file:
`modes/interim-report-dashboard.spec.ts`, plus the world it needs in `modes/seed-modes.js` §12b and
`resetLoveLetterIrd()` in `modes/support/modes.ts`.

## Why it landed in `modes`, not a new suite
`suites-manifest.json` already routes `src/app/AppEngagement/**` to **modes** (last glob of its
`appPaths`), and the screen's other three tabs are covered by `interim-report.spec.ts` (PM-13/14/15)
and `interim-report-tabs.spec.ts`. So: no manifest edit, no new Playwright config, no new CI caller —
and the branch-diff routing already makes this suite mandatory when the dashboard changes.

## Why the seed grew the way it did
The dashboard reads one `interimreport log` per row and joins four step collections by `interimlogid`,
then filters by journey (`participant metadata`) and attendance (`event participation request`). The
seeded world is shaped so that **every assertion has something that must be excluded**, because a green
test over a one-sided world cannot tell "the rule ran" from "there was nothing to drop":

| Seeded | Why |
|---|---|
| p1 · `IRL_ONGOING` with an `ask AH` but **no crossover** | IRD-02: the Crossover Meter must count only participants who have a crossover record — p1 is on screen (2 reports) yet every cell reads 0 |
| p1 · `IRL_NOTSTARTED`, `reports[]` empty | IRD-01: separates Ongoing (steps saved) from Not started |
| Crossover with 9 / 5 / 2 / 0 / unfilled across the five areas | IRD-02/03: one known occupant per band column, and `jumpedfrom` for the level-jump assertion |
| 4 adjustments — 1 No Change, 1 Somewhat, 2 Changed | IRD-04: 2 of 4 = 50% must land in the 26–50% column, and the drill-down states "2 of 4 adjustments" |
| journey A on p0 `activejourney`; journey B on p1 **only** `lastcompletedjourney` | IRD-05: proves the activejourney → lastcompletedjourney → lastsubscribedjourney fall-through actually runs, not just the first field |
| p0 `attended` + p1 `registered`, same event | IRD-06: proves the event filter keeps `status == 'attended'` only |
| love letter with every tag false, `notes: []` | IRD-07/08/09: the asserted tag / resolution / note is the one the APP wrote, never a seeded value |

The dashboard's ask A&H doc hangs off **p1**, not p0, because `PM-13` asserts participant0 has exactly
two `ask AH` rows — a third would have turned that green test red.

Each case first narrows the screen with the PARTICIPANT filter to a run-unique actor email, so nothing
else on the shared test project can move the numbers.

## App-side hooks (starlabs-angular)
The dashboard's UI is rendered by a ported design script into a ShadowRoot, so it had no hooks below the
filter bar. 98 `ird-*` `data-testid`s were added there (strip cards, both views, all 20 crossover cells,
all 20 evolution cells, letter/ask counts, dropdown options, participant rows and names, tag buttons,
the resolve confirmation, the notes box, both exports). Playwright's selectors pierce open shadow roots,
so `getByTestId` reaches them unchanged.

**One rename matters:** the Journey/Event filters became searchable dropdowns (they were `<select>`s), and
their hooks are deliberately kept as `ird-filter-journey` / `ird-filter-event` so `IRT-DASH` and the
`IRD-ADDR` registration block keep resolving.

## Not yet run
`--list` registers all 11 cases (modes: 74 tests / 24 files). They have **not** been executed: this Mac has
no ADC/service account for the cloud test project, and the emulator lane needs `src/environments/
environment.emulator.ts`, which is gitignored and only synthesized from `ci/overlay` in CI. First real run
is the gate. The flows themselves were driven by hand against a live dev server (starlabs-test) while the
feature was built — filters, tagging, the resolve confirmation, notes, export and the new-tab name link —
so the selectors and the interaction order are known good; the seeded numbers are what CI will prove.

## Addendum — the two data rules the operator raised (2026-09-17)

**Areas are per-ATC-model, not a fixed five.** `crossover.dart` builds `participant AEL.crossovermetric`
(and this doc's `metric`) from the participant's ATC model `category` list, so the KEYS differ per model.
The dashboard had hard-coded Business / Career / Family / Health / Personal Genius, so a participant on a
different model rendered "Left blank" for every unmatched area and showed a metric only where the names
happened to line up — the reported "0 filled for all five, only 2 of 5 shown". The component now reads
the keys the document carries and the script derives the matrix rows from the loaded pool (`syncAreas`),
which is why every area-derived table became a function. IRD-02 keeps asserting the seeded five by name;
cells outside that set fall back to `ird-cross-other-b*` so they stay addressable.

**"Not progressed" is a rated 0.** The band was `v === null || v === 0`, so an area the participant never
rated sat in the same column as one they deliberately scored 0. It is now `v === 0`, and the seed's
`Personal Genius: {metric: null}` is the negative control: IRD-02 asserts Health (rated 0) = 1 and
Personal Genius (never rated) = 0. Participants with no `interim crossover` doc at all were already out
(crossPool, 2026-09-16).

**Journey filter is multi-select** (IRD-12): `JOURNEY` is a Set, picking adds rather than replaces, the
panel stays open, the pill reads "2 journeys", and the × clears everything. Verified against starlabs-test:
B!G = 6, uP! = 11, both selected = 17 — an exact union, since a participant resolves to one journey.

## IRD-13 / IRD-14 — Resolved-any-tag and picking participants for a send

**IRD-13** needs a letter the old rule would have hidden: `LL_RESOLVED` hangs off p1's ongoing log,
is `resolved: true` and carries neither `tagged` nor `critical`. So the Resolved card must count it (1)
while "Sent to Journey Coaching" stays 0 — one document proving both halves of the operator's rule.
It lives on p1 for the same reason the ask does: p0's counts are asserted elsewhere.

**IRD-14** drives the new picking path end to end: the send bar is hidden until something is picked,
the Business 8–10 cell (where p0's 9 lands) picks exactly that participant, all three channels are
offered, and Email opens the Log tab's composer — which the case then **dismisses**, so nothing is ever
sent. A dismissed composer returns no payload, the same firewall/stub posture the workshops suite uses
for its composer hand-offs. Clear then empties the selection and hides the bar.

The grid path is driven here; the list path (`ird-pick-row`, `ird-pick-all`) is registered in IRD-ADDR2.
