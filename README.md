# starlabs-e2e-tests

End-to-end test suite for [starlabs-angular](https://github.com/School-of-Excellence/starlabs-angular).
Kept in a **separate repo** so the app branches stay clean; the app's CI clones this repo at test time.

> Full test landscape & per-suite run details: see [`TEST-MAP.md`](TEST-MAP.md).

## How it's used (CI)

The app repo's `.github/workflows/queue-e2e.yml` runs on every PR → `development`:

1. Checks out the app (PR code)
2. Clones **this repo** into `./e2e`
3. Clones `starlabs-cloud-function` into `./starlabs-cloud-function` (real triggers for the emulator)
4. Runs `ci/setup-emulator-config.sh` to **overlay** the emulator build config onto the app
   (the app repo deliberately carries none of it)
5. Boots the Firebase emulator + the emulator-wired app
6. Runs the isolated queue suite (`scripts/run-isolated.sh`) — pass/fail **gates the merge**

## CI integration layout (added for the separate-repo setup)

```
ci/
  setup-emulator-config.sh   # CI overlay: injects emulator config into the checked-out app
  overlay/                   # the files it copies in (the app repo no longer carries these)
    environment.emulator.ts  #   app env → connects to the local emulator
    firebase.emulator.json   #   emulator config (auth 9099 / firestore 8080 / functions 5001)
    firestore.rules          #   emulator rules
    firestore.indexes.json   #   composite indexes the specs rely on
```

The harness itself (`scripts/`, `queue/`, `_shared/`, `_support/`, `lib/`, `fixtures/`, `playwright.*.config.ts`)
is documented in [`TEST-MAP.md`](TEST-MAP.md).

## Run locally

```bash
npm ci
npm run test:emu          # boots emulator + app, seeds, runs (see scripts/)
```

## ⚠️ Drift

These tests drive the app's UI. When queue/studio/BIG screens change in the app, **update this repo to match** —
the two repos are not auto-synced.

## Scope

Currently **queue/studio/BIG only** is wired into the CI gate. Other suites (appointments, events, modes, …)
live here too but aren't in the gate yet — they'll be added once the queue gate is proven.
