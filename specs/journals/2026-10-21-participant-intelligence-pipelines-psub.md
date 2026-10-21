# 2026-10-21 — Participant Intelligence: pills, confirm-before-update, match all/any, pipelines, product subscription, soft delete

App change: starlabs-angular `specs/journals/2026-10-21-participant-intelligence-audiences-columns-anyall.md`
(rounds 1–5). The gate flagged 50 new `pi-*` hooks with no case.

## Existing cases that had to move
- **Option rows are no longer one button.** Round 3 replaced the click-to-cycle checkbox with a row `div`:
  the label includes, and Include / Exclude pills carry `aria-checked`. PI-05 asserted `aria-checked` on the
  row and relied on a second click to exclude. It now drives the pills: the label includes, Exclude switches
  over, and clicking the active pill clears. Every other case includes through the Include pill
  (`include()`). Clicking the centre of a flex row could land on a pill or on padding.
- **PI-13** clicked "Update" and expected a write. Update now asks first, so the case asserts the before /
  after diff, cancels (no write), then confirms.

## Why the seed looks like this
- **SQ2** (`PIPE-<run>-Regular`, Watson = regular) is the second pipeline. With SQ (non active):
  every = {Charlie}; not every = {Alpha, Bravo, Delta, Foxtrot}; Echo is in neither and must never appear.
  The name does not start with PI_SEARCH, because PI-13 asserts the rail's saved-filter search finds exactly one.
- **SQ_DEL** (`PIDEL-<run>-Throwaway`) is what PI-22 soft-deletes. `resetPiMutables` re-sets it with a
  full `set()`, so `isdeleted` is gone before every case.
- **Product subscription has its own four people (PSUB-<run>-…)**, never the six PI people. A
  `participantsproduct` write fires `productsdata_to_pmd`, which recomputes the holder's activeproduct /
  consumedproducts. That would overwrite Bravo's seeded `consumedproducts [P1, P1]`, which PI-11 and PI-18
  count on. The rows:
  A starts −10 (in); B starts −10 but `Cancelled` (mixed case, dropped); C starts −40 (out of range);
  D has two docs, −8 and −12 (in, one row). The range is [−15, −5], relation "Start between", product P1.
  B and C are the negative controls, one per rule.
- The emulator needs no composite index, so the "index not deployed" error state cannot be produced.
  It is registered in PI-ADDR3, together with the transient loading hint.

## Not covered
- Column layout memory (localStorage).
- Creator names in Manage audiences.
- The soft-delete readers on other screens (queue planning, analytics, dialogs). Their suites run, but no
  case seeds a soft-deleted list for them.

## Status
Authored and listed (25 PI cases), gate green. Not executed locally; the first run is CI.
