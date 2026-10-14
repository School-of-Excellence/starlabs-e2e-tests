# 2026-10-14 — Participant Intelligence v5: refit the PI spec, seed a world it can actually count

> WHY-journal per the CLAUDE.md rule. Screen: starlabs-angular
> `src/app/Participant Intelligence/participant-intelligence/` (rounds 1–5, staged on `charan-release`;
> intent in that repo's `specs/plans/2026-09-25-participant-intelligence-*.md`, `…-round4.md`,
> `…-round5.md` and `specs/journals/2026-09-25-participant-intelligence-enhancements.md`).
> Files here: `profiles/participant-intelligence.spec.ts`, `profiles/seed-profiles.js` (PI block), `TEST-MAP.md`.
> **Not executed yet** (another process owned the emulator ports). Verified: `--list` (18 PI entries, 113 in
> the suite), `node -e "require('./profiles/seed-profiles.js')"`, strict `tsc --noEmit` of the spec, and
> hook alignment 98/98 both ways. The readiness gate's run is the first real run.

## The screen is no longer mock-by-default

The old note ("partial prototype, mock-by-default") is stale. `ParticipantDataService` reads Firestore only:
`participant metadata` (orderBy `name`, so a doc without `name` is invisible and not in the total),
`journey`, `products`, `modes`, `tier`, `participant tags`, `event collection`, `queue generation`,
`segmentboardconfig` / `segmentboardlist`, `arena events` (type == queue), `queue_token`, `searchquery`,
`participant list`, `segments`, and `event participation request` on demand. There is no mock path left
in the component, so every case below counts seeded data.

## What each retired id became

| old id | now | case |
|---|---|---|
| `pi-toggle-rail` | removed. The rail closes from inside (`pi-filter-close`) and reopens from a strip (`pi-filter-open`, carries the active-filter pill) | PI-01, PI-05 |
| `pi-toggle-insights` | removed. The panel minimises itself (`pi-insights-minimize`) to a bar (`pi-insights-expand`) | PI-01 |
| `pi-search-clear` | same control, hook dropped in v5 → located by `aria-label="Clear search"` | PI-02 |
| `pi-checklists` | same control, hook dropped → `getByRole('button', {name: /Checklists/})` | PI-03 |
| `pi-checklist-item` | split: the new Watson R1–R5 group has `pi-watson-checklist-item`; the reconciliation items lost their hook (located by role/name) | PI-03 |
| `pi-refresh` | same control, hook dropped → the `refresh` icon button in `header.topbar` | PI-04 |
| (`pi-comms`, kept) | no longer a comms-analytics menu: opens `/notificationrecord` in a new tab | PI-04 |

Four controls (search clear, Checklists, Refresh, reconciliation items) still exist but lost their hooks.
Located by role/aria rather than adding hooks back (the brief: no app change unless a hook is missing for
something the gate needs — the gate only counts declared hooks, and these are no longer declared).
Re-adding them is a one-line app change each if a later case wants them.

## Why the seed looks like this

Six people exist **only** as `participant metadata` (no Auth user, no `profile_data`), so
`profiledata_to_participantmetadata` never fires on them and no login roster changes. All names start
`PIV5-<run>-`; typing that in the top search narrows the shared-project table to exactly six rows, so other
suites' data cannot move a count. Only the shown half of "X of Y participants" is ever asserted.

Every rule asserted has a member it must drop:

| rule | kept | dropped (the negative control) |
|---|---|---|
| status Non active (include / exclude) | Charlie, Foxtrot / the other four | — the two sets are complements |
| age ≥ 40 / ≤ 35 | Charlie / Bravo | Alpha (no DOB), Foxtrot (`'not-a-date'` — unreadable is not 0) |
| min > max | — | the range is flagged and NOT applied (count back to 6) |
| insight "Onboarding status not updated" | Alpha, Charlie (field missing) | Bravo (`false` counts as set), Delta / Echo (status gate) |
| insight "Age not updated" | Alpha, Foxtrot | Delta / Echo (no DOB but out by status) |
| insight "…no finance status" | Foxtrot | Echo (no Watson status, but discontinued) |
| Watson R1 | Delta (regular, no customer status) | Echo (discontinued, no Watson status) and the four live ones |
| merged event, Attended | Alpha (old id) + Bravo (new id) — one option "(2)" | Charlie (a different-name event) |
| merged event, Confirmed | Delta (approved request on the OLD id) | Echo (PENDING request on the new id), Alpha/Bravo (attended only) |
| journey segment | Bravo, Delta (live segment's saved list) | Alpha — only in an INACTIVE segment's stale list, which must not even be an option |
| consumed P1 ≥1 / ≥2 / =1 / between 1–2 | Bravo+Charlie / Bravo / Charlie / both | the rest; "between 1 and …" is incomplete and ignored |
| unconsumed P1 | Echo | — and it must not land in the consumed block |
| list / segment | Alpha+Charlie / ∪ Echo | Bravo, Delta, Foxtrot |
| remove tag from all | Alpha, Bravo lose HELD | Charlie keeps KEEP; the tag doc survives until Delete |
| bulk remark | Charlie (selected + visible) | Alpha (selected but hidden by the filter) |

Shapes that matter:
- **Events** have no `end_date`, so `/ahcrm`'s "upcoming events" query (`end_date >= now`) never picks
  them up. Requests carry no `productref` and never status `attended`, so `eventparticipationdata_to_pmd`
  has nothing to project, and the modes suite's attended-count is untouched.
- **The saved filter** is analytics-shaped (top-level keys, no `pifilter`) — the shape both screens read.
  PI-13 asserts the screen adds `pifilter` and that `mergeFields` keeps `testrunid`.
- **Tags** carry `created`, like real ones; neighbours locate tags by name, never by position.
- `resetPiMutables()` re-sets the mutable docs (tags, `profiletags`, `remarks`, the saved filter) before
  every case — preconditions only. New collections are in `SEEDED` for teardown.

## Deliberately NOT seeded

- **`queue_token` / `queue generation`.** The queue suite's data, and `onQueueStageChange` fires on ANY
  `queue_token` write (touchpoints, participant metadata, notifications). PI-09 covers the queue section's
  Completed/Live switch and its search; queue narrowing stays uncovered. Same engine (`nameGroups`) as the
  events, which PI-08 covers.
- **`atccount`** stays null (ATC is off-limits; a number lights ATC branches elsewhere). uP!/CPM counts
  derive from production product ids. → PI-ADDR1 parks `pi-filter-atc-count`, `-up-status`, `-up-count`,
  `-cpm-count`. The shared count-condition component is driven through the product rules (PI-11).
- **Subscription dates.** A Material range picker whose typed format follows the browser locale; the
  legacy-range notice needs a saved filter with both analytics ranges. → PI-ADDR1 (`pi-filter-sub-*`).
- **Clicks that write untagged docs.** `pi-tag-create` (`tg-<ms>`), Make as List / Save filter
  (`aud-<ms>`) have no `testrunid`, so teardown could never sweep them. PI-16 drives create's gating up to
  enabled and stops; PI-05 opens both Save-filter prompts and cancels. The bulk composers (email,
  WhatsApp, notify, broadcast, Wati, interim, wishlist, playlist, subscription, add product) are only
  opened as menus (PI-17) — they send or write elsewhere, and the analytics suites own those dialogs.

## App findings (reported, not fixed)

1. **Manage audiences: Delete / Set default / Toggle live never persist.** `deleteAudience`,
   `setDefaultAudience`, `toggleListLive` only update the in-memory signal. A "deleted" saved filter or list
   comes back on Refresh.
2. **Refresh loses Confirmed-event data.** `init()` resets `confirmedByEvent` to `{}`, but the effect that
   loads it re-runs only when the filter changes. After Refresh with Confirmed events ticked, the filter
   matches nobody until the user touches the filter.
3. Hooks dropped from four live controls in v5 (search clear, Checklists, Refresh, reconciliation items).
   Testability only.
4. Ids `tg-${Date.now()}` / `aud-${Date.now()}` can collide within a millisecond and carry no run tag.
5. The total in "X of Y participants" leaves out metadata docs without `name` (the orderBy), while the tag
   holder count (a separate query) includes them. The comment in `tagHolderDocIds` already knows.

## Pending

- First real run (emulator lane). Most likely to need tuning: PI-04's popup (the guard may redirect
  `/notificationrecord`; the case waits on the navigation request, not the final URL) and PI-03's R1 list
  (the first 250 violators of the whole base).
- Land the app first (the hooks are staged on `charan-release`), then this branch
  (`test/participant-intelligence-v5`).
