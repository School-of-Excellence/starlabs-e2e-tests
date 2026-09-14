# Bucket 4 — un-skip "CF/index not deployed" cases by wiring CFs into the emulator (2026-07-02)

> Companion to the whole-suite skip audit. Bucket 4 = tests that self-skip because their Cloud Function (or
> a composite index) isn't available to the hermetic gate. This journal tracks the one-by-one fix.

## Mechanism (how these resolve)
The hermetic gate runs a CURATED CF set re-exported from `starlabs-cloud-function/functions/index.emulator.js`
(16 CFs: queue×11, big×1, participant-mode×1, participant-metadata×3). Bucket-4 CFs are simply ABSENT from
that set, so their tests self-skip via runtime probes (e.g. `isWishlistCfDeployed()` writes a doc and polls for
the CF's output). **Fix = add the CF's export to `index.emulator.js`** → the probe passes → the test runs.
Usually **no hub spec change is needed** (the probe auto-detects).

## Constraints / gotchas
- `index.emulator.js` lives in the **CF repo** (`starlabs-cloud-function`); the branch CI uses is
  **`cicd-modes-emulator-fix`**, which matches the protected `cicd-*` pattern → each fix is a **CF-repo PR**
  (I prepare on a feature branch + open the PR; **CF team / vignesh-027 approves + merges**), then a
  **modes-gate re-trigger** validates.
- Do NOT wire any CF whose component `require`s ATC at module load (ATC.js binds `firestore-atc` — off-limits).
- Emulator gotchas ([[cf-emulator-fieldvalue-stripping]]): `admin.firestore.FieldValue` undefined; uncaught
  create/delete deref; external HTTP (axios/postmark/WATI) hangs ~60s → guard with
  `IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === "true"` (as participantmetadata.js does).

## Backlog (cleanest first)
1. **modes PM-09** — `evolutionFamilyWishlistOnWrite` (wishlist.js). ← IN REVIEW (below)
2. **support (2)** — `ticketCreated` / `ticketMsgNotification` (clientissue.js). ⏭️ SKIPPED — external secret: ticketMsgNotification sends a Slack IncomingWebhook (clientissue.js:214) + `defineSecret`; the send is in the tested notification flow (can't dodge by seed). Same class as #6. (operator directive 2026-07-02: skip external-secret items.)
3. **modes interim-report** — composite index (HUB overlay). ✅ DONE (below)
4. **authroles AR-14** — `createProfile_registeredUser` (user_registration.js).
5. **comms CN-05/07/13** — communication.js triggers + relax the `FIRESTORE_EMULATOR_HOST` guards.
6. **content CN-06/07/16, CN-15** — Publitio/HLS CFs (need external secrets; may stay cloud-only).
7. **authroles AR-15, support CS-14** — onCall / scheduled (need a trigger harness).
8. **comms CN-LIKE/COMMENT** — CFs are commented out in index.js; un-comment first (app/CF decision).

## Item #1 — modes PM-09 (wishlist) — STATUS: CF PR open for review
- **Change:** one-line wiring in `index.emulator.js` (require + export `evolutionFamilyWishlistOnWrite`).
  `wishlist.js` business logic UNCHANGED.
- **Why safe (no wishlist.js guard needed):** the modes suite is designed to NEVER write status `'sent'`
  (seed-modes.js:236 / modes.ts:226 / wishlist-form.spec.ts:16), so the CF's Postmark/WATI **send** branch is
  never entered — no external network / 60s hang. Only the `'sended'→'completed'` branch runs (plain
  `.update`, no FieldValue). No ATC at module load; postmark client is construct-only.
- **No hub change:** PM-09's `isWishlistCfDeployed()` probe auto-detects the now-running CF.
- **CF PR:** `starlabs-cloud-function#1` (`wishlist-emulator-wire → cicd-modes-emulator-fix`), commit
  `9d0f57e`, reviewer vignesh-027. **NOT self-merged** (protected `cicd-*`, CF-team domain).
- **PENDING:** CF team merges PR #1 → re-trigger modes gate (PR #25) → confirm PM-09 runs GREEN
  (expected: modes suite gains 1 test, PM-09 no longer skipped).

## Item #3 — modes PM-15 (interimreport-log index) — STATUS: DONE ✅
- **Root of the skip:** PM-15's `fetchInterimLog()` query (`orderBy(lastupdate DESC) + range(createdon)`) needs a
  composite index `interimreport log [lastupdate DESC, createdon DESC]` that was absent from the overlay (the
  two existing ones are `[profileid,status,lastupdate]` / `[profileid,lastupdate]`). The emulator enforces
  composite indexes → `isInterimLogIndexReady()`'s `.get()` threw failed-precondition → skip.
- **Fix:** added the exact index to `ci/overlay/firestore.indexes.json` (hub, my lane). Commit `5bfa22e` on
  systems-emulator → hub **PR #7** merged to main (`a3ae150`) [modes gate reads `e2e_ref: main`].
- **Validation:** re-triggered modes gate (PR #25, `281ed8d`) → **GREEN with 1 skipped** (was 2). PM-15
  un-skipped + passing; the remaining skip is PM-09 (item #1, pending CF PR #1). No regression → no revert.
- Merge-then-validate path chosen (operator: "do B, revert if failed"); revert not needed.

## Bucket-4 progress
- #1 wishlist CF — CF PR #1 open (awaiting CF-team merge) → will un-skip PM-09.
- #3 interimreport index — DONE (PM-15 green).
- #2 support ticket CFs — NEXT. #4–#8 pending.

## Related this session
Profiles (#10) + events (#9) promoted to cicd-dev (see the profiles/events emulator-gate journals). EVT-15/16
root-caused as app-branch divergence ([[evt15-16-app-branch-divergence]]).
