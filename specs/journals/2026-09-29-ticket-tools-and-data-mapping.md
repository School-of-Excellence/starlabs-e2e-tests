# 2026-09-29 — Mapping 100 real support tickets to tools + data

Companion to `2026-09-26-support-agent-architecture.md`.

## What was done
The operator's ticket export (100 real tickets) got two new columns, `tools_required` and
`data_to_pull`. For each ticket they list which participant360 tools/rules/playbook answer it,
the ordered data chain, and the outcome (ANSWER / COMMIT / HANDOFF / ASK). Output:
`specs/reference/Ticket documentation - tools & data.xlsx` (plus a Legend sheet).
**The file contains participant PII. Do not commit it.**

## What was found (the 100-ticket analysis the architecture journal said was unstarted)
- Outcomes: ANSWER 38 · COMMIT 31 · HANDOFF 28 · ASK 3. Under half are pure lookups.
- 44/100 tickets need a **v2 authored rule** that doesn't exist (finance defer/pause/refund,
  access-extension, recording-sharing, event eligibility, escalation ladder). This confirms
  the architecture journal's point that the biggest risk isn't technical.
- The biggest tool gap is **EiFlix, not journey**: `eiflixAccess` (20 tickets), `eiflixProgress` (15),
  `contentPlayback` (14; no playback telemetry captured at all). None of these is in the plan.
- `eventCatalogue` (10): event dates/venue/online option live nowhere queryable.
- `ticketHistory` (6): repeat/duplicate tickets can't be detected; participant360 has no clientissue tool.
- Email change must sync to Watson because `finance` looks up by email.
- About 9 tickets are medical/mental-health/third-party health, so they hit hard_stop and go to a human.

## Caveats
- Tool names come from the 2026-09-22 transcript. Fetching the live participant360 catalogue was
  blocked (production read). Verify the 16 names before building on this.
- Desktop is TCC-blocked for the agent; the operator copied the file into `specs/reference/`.

## Pending
- Operator review of the per-row mappings.
- Decide whether EiFlix tools (access/progress/playback) enter M1 scope. By ticket volume they outrank journey.
