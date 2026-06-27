# Journal — ATC offline draft: local-first cache replaces Firestore persistence

**Date:** 2026-06-26
**Repo:** Starlabs 19 (Angular app — ATC; not the console repo)
**Plan/ADR:** `Starlabs 19/specs/plans/2026-06-26-atc-draft-local-first-cache.md` (ADR-001, ACCEPTED) + `…-TESTPLAN.md`
**Outcome:** Implemented in the Angular app. Reconciliation logic proven by a throwaway non-ATC Node harness
(43/43, since removed); 3 new shared files type-check clean against the app tsconfig. NOT run as the real ATC app
(project rule: Claude never builds/runs/tests ATC) — manual matrix + Playwright suites are the operator's.

## What was done

- **Removed Firestore's persistence cache** (`persistentLocalCache` + `persistentMultipleTabManager`) from
  `src/main.ts`. It was the root cause of the fatal SDK assertion `b815` (which bricked the client for the page
  session when multiple ATC tabs were open) and the prime suspect for the app-wide slow-reads + media-needs-hot-reload
  regression. Firestore now runs with its default in-memory cache; the default DB was already memory-cache, so blast
  radius is ATC-only.
- **New `ATCDraftService`** (`src/app/shared/atc-draft.service.ts`) — explicit local-first draft cache (IndexedDB
  `atc_draft_cache`), modeled on the existing `MediaCacheService`. Every change writes the full draft to IndexedDB
  first (durable across refresh/crash/offline), then pushes to the Firestore draft doc inside a `runTransaction`.
- **Pure logic extracted** to `src/app/shared/atc-draft.logic.ts` (no Angular/Firebase) so the decisions are unit-
  testable in isolation: `decideSync`, `decideOpen`, `computeDirty`, `pickWinner`, `nextRev`, `canonical`.
- **Conflict handling** — a server-authoritative `rev` counter (bumped in-transaction) detects a genuine two-device
  divergence (`remote.rev > baseRev && dirty`). On open, a picker dialog (`ATC/shared/draft-conflict-dialog`) lets
  the user keep one whole version; the rejected one is archived to `…/{docId}/conflicts/{rev}` — never deleted.
  Autosave that detects divergence returns `'conflict'` and refuses to clobber, surfacing it on next open.
- **Wired both flows** (`prescribe-atc`, `edit-atc`): swapped `recovery.*` → `draft.*`; offline draft list/load now
  served from the local cache (replacing the removed `getDocsFromCache`); submit soft-deletes + purges locally with
  a `pendingDelete` self-heal.
- **Deleted `FirestoreRecoveryService`** and its REST-fallback + global window assertion watcher (dead weight once
  the b815 trigger is gone). `LocalDraftService` kept — it's used by a non-ATC Product Designer form.
- Removed the dev-only verification harness (`tools/atc-draft-sim/`) — its checks are to be recreated here as
  Playwright suites (case list below).

## What was found / surprised

- **The harness caught a real `ng build` blocker before any build.** `sync()` set `outcome` inside the transaction
  closure; TypeScript literal-narrowed it to `'unchanged'`, so the post-transaction `=== 'created'` comparisons
  failed to compile (TS2367 — fires even under `strict:false`). Fixed by holding state in an object the compiler
  won't narrow. Strong argument for keeping equivalent logic tests in Playwright.
- **Clocks can't order two offline devices** — `lastupdated` is device-local and unsynced. Ordering is therefore by
  the server `rev`, not time; `lastupdated` is advisory only (shown as a hint on the picker) and excluded from the
  dirty/conflict comparison via `VOLATILE_FIELDS`.
- **`lastupdated` stayed a JS `Date`** (local cache stores it; `serverTimestamp()` isn't structured-cloneable);
  hydration normalises via a `toJsDate` helper since a draft can arrive as a Firestore Timestamp (server) or a Date
  (cache). `rev` + a server-only `serverUpdatedAt` carry the authoritative ordering.
- **`LocalDraftService` is not ATC** — grep showed it's only used by Product Designer's `formtemplate.component.ts`;
  deleting it would have broken an unrelated form.

## Verification

- Dev harness (now removed): **43/43** — decision tables (decideSync/decideOpen), dirty lifecycle, rev
  create/update, took-remote, two-device conflict (both branches) + loser archived, submit soft-delete + crash
  self-heal, two-offline-devices, and a competing-write-mid-transaction race (no clobber).
- `tsc --noEmit` clean for the 3 new Angular-facing files against the app's real tsconfig.
- Not built/run as the ATC app (per project rule). Operator + Playwright own live verification.

## Pending (operator / next session)

- **Recreate the 43 reconciliation cases as Playwright suites in this repo** (logic is deterministic and DB-fakeable;
  no real ATC collections needed).
- Manual matrix (`Starlabs 19/specs/plans/…-TESTPLAN.md`): two-tab b815 check, two-device conflict + archive,
  crash/refresh durability, offline list/load, submit self-heal, media path, migration off the old
  `atc_draft_outbox`, and the app-wide perf/media-regression re-check.
- No in-app read UI for the `conflicts/{rev}` archive yet (Firestore console only).
- Media-URL patch after upload still bypasses the rev transaction (additive fields only; converges next autosave).
