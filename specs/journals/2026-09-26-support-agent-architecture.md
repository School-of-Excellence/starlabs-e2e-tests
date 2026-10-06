# 2026-09-26 — Support agent architecture: why the constraints landed where they did

> Companion journal to the support-agent work. Plans say WHAT; this says WHY.
> Read this before proposing an alternative to anything below — most of these
> were argued and settled, several against my own initial recommendation.

## What this session was

A design review, not a build. The operator brought two reference files produced in a
prior session with a colleague:

- `specs/reference/support-agent-session-transcript.md` — an architecture verified
  line-by-line against the real codebase (`participant360`, `clientissue.js`, Watson),
  then revised twelve times based on what was actually found
- `specs/reference/ai-support-console.standalone.html` — a supervision console prototype

Both were copied into `specs/reference/` by the operator as reference material, not as
project sources of truth — they should be gitignored if they are not already (not
verified this session). Nothing was built this session. Two artifacts were produced for the operator: a blueprint and a
set of eight traced scenarios.

## The finding that reframed everything

**The reference architecture is more mature than what this session's discussion had
independently reached, and where the two conflict, the reference is usually right.**
It was grounded in the actual codebase; my advice was grounded in general practice.

The decisive example: I recommended letting the model choose its own tools (standard
agentic-loop advice). The reference rejects that as the decision layer, and its reason
is specific to this data:

> When the Watson service account is missing, the `finance` tool returns `ok:true`
> with an empty envelope.

A model reading that concludes *"no outstanding balance — you're paid up."* That is a
catastrophic answer in a support context. A playbook encodes the trap once, in code,
with a test. A tool-choosing model hits it fresh every conversation. Add the cost
ratio — ~20,000 tokens per exploratory turn against ~660 for a playbook turn, measured
at 220× — and the deterministic design wins on both correctness and money.

**Constraint: the LLM reads language and writes language; code makes every decision in
between.** Everything else in the architecture follows from that sentence.

## Why each load-bearing constraint exists

### Rules and playbooks are code, not prompt text
Zero tokens, deterministic, unit-testable. The alternative — handing a model the
eligibility policy as text — pays for it on every call *and* applies it inconsistently.
This is what makes the whole system cheap: the rule library could be 100k lines and the
token bill would not move.

### The rule engine must be the same code that gates the product
If the agent gets its own copy of the v1 rules (journeystatus, customerstatus, mode
tables, tier access), the two drift within weeks and the agent confidently explains
rules the product does not enforce. **Migrate by replacement, one conditional at a
time — never write a parallel engine beside the original `if` statements.** This is the
single most likely way to quietly ruin the project.

### Three verdicts, not two
`allow` / `not_allowed` / `check_with_consultant`. The third is a real answer and is
*different* from "no rule found", which is always a handoff. Collapsing them loses the
distinction between "a human must decide this" and "nobody has written the policy down."

### The snapshot declares what it omits
`sources[].available: false` plus `payment: null` rather than a number. The coverage
map is what converts a hallucination into a tool call. Operator's own refinement,
adopted: maintain a flat `participant_profile` doc continuously (a materialised read
model) and make the snapshot a cheap projection of it — this deletes the 150-read cold
build, the slowest and riskiest path in the design. Cost of that pattern is drift, so
it carries `schemaVersion` + `lastEventId` and keeps a rebuild path as a repair tool.

### The instant acknowledgement is the client's job
The server cannot beat Firestore trigger delivery (300–2000 ms, not ours to optimise).
So the Flutter app composes an ack from its own cached snapshot copy, in the same frame
as the tap — 0 ms, no network. **It must be gated on mode:** in Shadow no agent reply is
coming, and an ack that promises one is worse than silence. That means `/prefetch` has
to return the current mode.

### The verifier runs after the stream, never before
A blocking verifier throws away every millisecond streaming bought. It can correct or
retract; it cannot prevent. The way a dangerous claim is prevented is structural — no
write tools, no commitment authority — not by checking afterwards. In this architecture
the check is even stronger: code fact-checks that every locked string survived the tone
rephrase, and discards the rephrase if not. A string comparison, not a judgement.

### Shadow mode is a CI stage, not just a runtime mode
You cannot unit-test "was this a good reply", but you can replay real tickets and have
a human label the drafts. M1 runs entirely in Shadow — 30 days, nothing sent to any
participant. `draft_reviews` then doubles as the confidence-calibration dataset: a
model's self-reported `0.94` is a plausible-looking number until measured against
human verdicts.

### Temporal remembers; the worker executes
Correcting a persistent misconception from this session: the worker keeps tab on
nothing. It polls a queue, does one step, reports back, forgets. During a 24-hour
`sleep` no worker holds anything — the state lives only in Temporal. Hence: worker
restarts are harmless, workers are interchangeable, and different steps of one case run
on different workers.

Cloud Run trap that follows: a worker polls between requests, and Cloud Run throttles
CPU to near-zero when no request is in flight. Without `--no-cpu-throttling` the worker
looks deployed and silently does nothing. It also needs a dummy HTTP listener purely to
satisfy the startup probe.

### No PII in workflow inputs
Neither Temporal Cloud nor Trigger.dev cloud runs inside the GCP project, so workflow
inputs cross the region boundary the rest of the architecture is pinned to. Pass
`profileId` and `ticketId` only; activities fetch what they need from Firestore inside
the region. Applies whichever engine is chosen.

### Every handoff writes a work item
Low confidence → intent taxonomy backlog. No playbook → playbook backlog (with the
exploratory tool trace, which *is* the spec for the next playbook). No rule → rule
authoring backlog. A handoff that vanishes into a human queue teaches nothing.

## What surprised us

**Firestore is free at this volume.** ~120k reads and ~13k writes a month sits inside
the free tier — and it is free *because* of the snapshot cache. Nobody expected the
database to be the zero line item.

**~85% of the bill is keeping instances warm.** At 3,000 turns/month the models cost
about $51 and three pinned instances cost $150. If someone asks whether an AI agent is
affordable, the AI is the cheap part. At 10× volume fixed costs barely move and the
exploratory path becomes dominant — which gives playbooks an economic argument, not
only a quality one: each one written converts expensive exploratory turns into cheap
deterministic ones, permanently.

**Temporal Cloud's subscription floor may exceed everything else combined.** At ~200
workflows/month the usage-based portion is trivial and you are paying almost entirely
for the floor. That is a legitimate reason to look at Cloud Workflows — GCP-native, no
worker, no floor, callbacks cover the signal pattern — which neither the reference nor
I had considered. Resolve with a two-day timeboxed spike, not an argument. What Cloud
Workflows lacks is Temporal's replay debugging, worth real money when a participant
disputes an outcome months later.

**The current spend caps are too loose to catch a bug.** $1.50/ticket and $25/day
against ~$0.96/day expected. They catch a catastrophe, not a defect. Proposed: $0.50
per ticket, $5/day, and a **per-participant-per-day cap that does not exist today** —
one person in a retry loop can drain the daily budget while the per-ticket cap never
trips.

## Misconceptions retired this session

Recording these because they were held confidently and will otherwise be re-derived:

| Believed | Actual |
|---|---|
| Pushes to angular/CF/flutter generate or update playbooks | Playbooks are hand-written JS. Product pushes should run the agent's *contract and golden tests*, nothing more |
| The classifier decides which LLM handles the message | It decides the intent. Provider is config. The only switch is a code rule on low confidence |
| The classifier sees the prefetched profile | It gets message text + category + last 3 turns. No snapshot, no PII, deliberately |
| The LLM decides whether a tool is needed | The playbook decides, by checking whether the snapshot has the field |
| The LLM judges whether the response is good | Code fact-checks locked strings. Discards the rephrase on mismatch |
| Every chat is stored as a separate snapshot | One snapshot per participant. Chats produce *summaries* that feed it |
| The worker keeps tab on an open ticket | Temporal keeps tab. The worker executes one step and forgets |
| Rebuild the snapshot on every profile update | Invalidate on update; project on demand — or, per the operator's better design, maintain the flat profile doc and project from it |

## What is pending

Six decisions, the first gating everything:

1. **Rule engine location** — shared package / service in the CF repo / own copy
2. `allSettled` + per-tool timeouts instead of `Promise.all` in the snapshot builder
3. `/prefetch` returns current mode (so the client can gate the ack)
4. The answer-diff CI gate — replay frozen tickets, diff drafts against the current
   revision, make the reviewer read the diff rather than a green tick
5. Durable engine — approve the two-day Cloud Workflows spike before committing
6. One Cloud Run service or two for M1/M2

Items 2 and the `lastVerifiedAt` addition are changes to the agreed architecture rather
than gaps in it, so they need explicit sign-off rather than being folded in quietly.

Three blockers that are facts, not decisions:

- **Firestore region** — one `gcloud` command; everything must be pinned to it
- **Trigger delivery p50/p90** — ~100 samples. If p90 > 1.5 s, direct HTTP transport
  becomes mandatory and that is a Flutter change on the critical path
- **v2 authored rules are empty** — confirmed by the codebase verification: none of the
  SLM prerequisites, progression policy or per-person exceptions exist in code, config
  or specs

## The highest project risk is not technical

Writing down the v2 rules, and the 100-ticket analysis that decides which playbooks to
build, are both non-engineering work on the critical path. Neither has started. The
engineering can finish perfectly and the rule engine will have nothing to evaluate.
Both need named owners from week one; neither competes for engineering time.

## Artifacts produced

- Blueprint — setup, data model, runtime, tracks, pipeline, governance, cost
- Eight traced scenarios — every fetch/return/update, filterable by technology

The scenarios artifact was what finally made the architecture legible to the operator
after several failed prose attempts. Worth remembering: the thing that clicked was
tracing *data* through concrete scenarios, not describing structure. Scenarios 00–04
and scenario 07 are effectively two different systems that share a database, and
conflating them is what made it hard to picture.
