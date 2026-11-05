# 2026-11-05 — Events: register hooks from Surya's event-participation-confirmation rewrite

## What
starlabs-angular charan-release took Surya's `surya-development` rewrite of
`src/app/Events/event-participation-confirmations/` (main screen + product funnel) and
`src/app/Events/event-list/update-event-detail/`. Four hooks on those screens had no spec reference, so the
readiness gate would block. Registered them literally in `events/events-controls-addressable.spec.ts`:

| Hook | Screen | Added to case |
|---|---|---|
| `epc-tab-start-date`, `epc-tab-end-date` | event-participation-confirmation tab date range | event-participation-confirmation + product-funnel |
| `pf-potsplit-sales` | product funnel potential split chip | same |
| `ued-cancel` | update-event-detail dialog Cancel | create_event list + event editor dialog |

## Why ADDRESSABLE only
The file's contract is reachability (literal `getByTestId`), not behaviour. No seed change: these
controls render from the world the case already seeds. Behavioural coverage of the rewrite (date-range
filter, sales split) is deferred — the rewrite also writes e-tickets / checklists / queue tokens, which
deserves its own seeded spec with negative controls, not a bolt-on here.

## The other direction
Surya's rewrite had dropped `pf-bar-finance`, `pf-bar-customer-status`, `pf-table-clear-filter` (the
controls themselves). The operator chose to re-add the controls in the app rather than delete the refs
here, so this spec keeps asserting them.

## Verification
`hook-diff.py` aligned (0/0) for both app folders; `playwright --list` = 47 tests in 13 files. Cases not
executed locally — the gate is the first real run.

## Landing order
App change (charan-release) first, then this branch.

## Seed + spec update to Surya's design (same day)
First local emulator run: 41 passed, 4 failed. Three were the rewrite:
- The funnel now queries EPRs with `orderBy('doccreateddate')`; Firestore drops docs missing an orderBy
  field, and the seeded EPRs had none → funnel Requested/Approved/Addon all 0 while the overview (no orderBy)
  counted them. Every real writer (web funnel, Flutter eventPlanning / viewupcomingopportunities /
  mastercalendar) sets `doccreateddate`, so the seed was the outlier: added `doccreateddate: T.now()` to all
  four seeded EPR writes. Risk for prod: any real EPR without the field silently vanishes from the funnel.
- The funnel tab is per EVENT now (label = event name + date range) → EPC-01/EPC-02 locate it by event name.
The fourth (EVT-08 QR duplicate scan) passed on the rerun with no change — flaky, qr-scanner untouched.
Rerun: 45 passed, 2 skipped, 0 failed (emulator lane, local; Firestore on 8085 because a simulator app held 8080).

## 73 more hooks registered (after the first push)
The console's rollout gate also flagged 73 interactive elements in Surya's markup with no `data-testid`
(update-event-detail 8, event-participation-confirmations 4, product-funnel 61). The app now hooks all of
them (starlabs-angular `36b62f1c`); this branch registers them literally in events-controls-addressable —
`ued-req-*` in the create_event/editor case, the `epc-*`/`pf-*` ones in the event-participation-confirmation
case. Addressable only (popups/dialogs are not opened). Local emulator run: 45 passed, 2 skipped, 0 failed.
