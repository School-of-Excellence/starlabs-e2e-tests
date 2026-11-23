# 2026-11-23 — queue-creation-v3: Map Live Event to Queue (queue suite, AUTH-01)

App: starlabs-angular charan-release `611622cf` (Dharshan `a07e5ce9`). App journal:
`specs/journals/2026-11-23-pull-dharshan-working-live-event-queue.md`.

## Why AUTH-01 was extended instead of adding a new case
The mapping is written only by `onsubmit()`, in the same `writeBatch` as the queue doc. AUTH-01 already drives the
only reliable path through that save (step-0 gate, products FormArray clear, required event). A second case would
repeat ~150 lines of stepper setup to add three assertions.

## What is proved
- The live-event select (`qcv3-sel-20b`) is picked by the seeded event's NAME. The test asserts the `liveeventid`
  the app wrote, which is the docid the app bound to the option.
- The picked event's `mappedqueue` equals exactly `[queue generation/<the queue's docid>]`. That docid is the
  client-generated id, read back from the queue doc.
- **Negative control:** a second seeded event (`<run>_event_1`) is never picked, and must not gain `mappedqueue`.
  Without it, a write to the wrong event would still pass. It is torn down with event_0.

Not covered: re-mapping (arrayRemove on the previous event). That needs an edit-queue path this spec does not open.

## Run status
Local emulator lane: queue/authoring.spec.ts 1/1 (AUTH-01). Gate (base origin/development): MATCHED.
