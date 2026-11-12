# 2026-11-12 — queue-creation-v3 form dropdowns (QCFD-01..03)

App change: starlabs-angular `07d55dca` on `charan-release` (pushed). App-side journal:
starlabs-angular `specs/journals/2026-11-12-queue-creation-form-dropdown.md`.

## What the app changed
- `delivery forms` filter in queue-creation-v3 went from "keep if `delete` is null/undefined" to
  "hide only `delete === true`". Prod had 9 live forms with `delete:false` that never appeared,
  e.g. "CTD – Impact Valuation Activity".
- ngx-mat-select-search added to "Select Form Template" (`qcv3-sel-35-i` / search `qcv3-inp-35s-i`) and
  "Forms To Display" (`qcv3-sel-47-i` / search `qcv3-inp-47s-i`).

## Why the seed looks like this
Four DEFAULT-db `delivery forms` in `seedReferenceData` (queue-creation-v3 reads the default db,
not `firestore-forms`):

| doc | `delete` | role |
|---|---|---|
| `<run>_qcv3form_livefalse` | `false` | the shape the bug hid. buildDoc's default, and what prod stores |
| `<run>_qcv3form_liveabsent` | missing | unchanged behaviour; must still show |
| `<run>_qcv3form_deleted` | `true` | negative control for the filter |
| `<run>_qcv3form_other` | `false`, `QCV3XO` token | negative control for the search: shown unfiltered, dropped by a `QCV3FD` search |

The run-unique name tokens let the search narrow shared-project data to these four. No neighbour
counts `delivery forms`. big-core reads its own form by id.

## Things that surprised us
- **A select click is swallowed:** the floating `<mat-label>` intercepts it. Use `_shared/mat-select`
  `openMatSelect` (keyboard first).
- **The search host has two inputs:** ngx-mat-select-search renders a hidden placeholder
  `input.mat-select-search-hidden` first. The typeable one is under `.mat-select-search-inner`.
- **`fill()` refuses the search box ("not enabled"):** its wrapping `mat-option` is aria-disabled and
  Playwright inherits that. Focus it and use `page.keyboard.type`.
- **The search hooks are per-stage `[attr.data-testid]` bindings:** the readiness scanner doesn't see
  them, so the spec reaches them with attribute locators (`[data-testid="qcv3-sel-35-0"]`), like the
  other queue `*-addressable` specs.

## Evidence
- Local emulator lane (Firestore 8085, app 4201, TESTRUNID run1): QCFD-01..03 all passed (24.5s).
- Mutation check: with the old `[null, undefined].includes(delete)` filter put back, QCFD-02 fails on
  "delete:false form must be offered". Fix restored afterwards.
- Not in the queue gate's `only` list, so CI's queue-e2e gate does not run it. It runs in the full
  queue directory.
