# 2026-11-12 — DDC Stuck Cases: seed + spec follow the new Stuck rule

**Why:** starlabs-angular `charan-release` switched the delivery dashboard's Stuck rule to the one in
mahalakshmi-development's `delivery-dashboard-new` (operator: "for stuck, take mahalakshmi code"; app journal
`specs/journals/2026-11-12-pull-joshua-delivery-dashboard-fixes.md`):

| | Old (bb5bca74) | New |
|---|---|---|
| Candidates | status initiated or ongoing | status **ongoing** AND `participantsproduct.mode` = **priority mode** |
| Days | since last attended appointment; none → row dropped | since last attended appointment, **else since statusdate.ongoing** |
| Kept when | ≥ 15 | **> 15** AND **no future appointment booked** |
| Order | — | longest first |

The old seed had no `mode` on any PP, so under the new rule nothing would be stuck and DDC-STK/DDC-FLT go red.

## Seed (`seed-journey.js` → `seedDdcStuck`)
- Every DDC PP gets `mode: 'Priority Mode'`, except the new NONPRIO.
- Two new negative controls, each isolating one clause:
  - **FUTURE** — ongoing, priority, attended 25 d ago (stale by days alone) + an appointment booked 3 d ahead → excluded.
  - **NONPRIO** — STALE's exact shape (ongoing, attended 18 d) with `Journey Mode` → excluded.
- NOAPPT and UNATT flip from "excluded" to **stuck**: with no attended appointment the rule counts from
  `statusdate.ongoing` (20 d). They are now the positive cases for that fallback.

## Spec (`delivery-dashboard-stuck.spec.ts`)
- DDC-STK-01: exactly STALE, NOAPPT, UNATT stuck; RECENT (status), DONE (status), FUTURE (booking), NONPRIO (mode)
  absent. STALE's DAYS = 18 (attended), not 2 (unattended) nor 20; NOAPPT's two badges both read 20 (fallback);
  STALE (18) sorts last.
- DDC-FLT: the All tab now has 4 run rows; NOAPPT/UNATT listed as Stuck; "No Parallel Product" keeps RECENT,
  NOAPPT, UNATT and drops STALE. Other filters unchanged (NOAPPT/UNATT are active with no finance status).
