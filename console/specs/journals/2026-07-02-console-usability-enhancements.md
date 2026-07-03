# 2026-07-02 — Console usability enhancements

> Plans tell WHAT; journals tell WHY. Read before proposing alternatives.

## Context

The console worked but had usability gaps a real team hit: no role separation between
developer and tester workspaces, no way to focus attention on a branch (pin) or dismiss
noise (mute), the promote gate didn't tell the tester what they were shipping, feature cards
froze at "Dev merged", and mutating actions fired on a single click with no confirmation.

This session implemented the enhancements agreed with the operator over several rounds. Every
decision below was explicitly signed off — nothing was improvised.

## Decisions & WHY

### Role split (locked with operator)
- **Working Branches → developer/admin**, **Preview Channels → tester/admin**. Overview stays
  for everyone; Release Channel stays admin-only.
- The operator initially said "Preview Channels = developer/admin," but the *entire tester
  workflow* (OK for dev, OK to promote) lives there. We surfaced the contradiction; the operator
  chose **tester + admin**. Developers therefore lose Preview Channels — their preview state and
  Deploy Preview action already live on Working Branches, so nothing is lost.
- Enforced with **real `canActivate` route guards** (`devOrAdminGuard`, `testerOrAdminGuard`),
  not just nav hiding — nav hiding doesn't stop a deep-link. Guards mirror the existing
  `adminGuard`.

### Pin (per-developer) vs Mute (global) — deliberately different
- **Pin** is PRIVATE per developer, stored in `user-prefs/{email}` (`pinnedBranchIds`), a new
  top-level collection with an owner-only rule. Direct client write (low-risk, user-owned). Sorts
  pinned branches to the top of Working Branches. No confirmation (private, instantly reversible).
  - NOTE: the original plan wrote `console-config/user-prefs/{email}`, which is an INVALID doc path
    (collection/doc/collection). Switched to top-level `user-prefs/{email}` (collection/doc).
- **Mute** is GLOBAL (shared) — stored as fields ON the release-candidate doc
  (`mutedSha`/`mutedBy`/`mutedAt`), per the operator's "fields on the RC doc is simple" choice.
  - **Unmute logic is pure/frontend** (operator: "keep it simple"): `isMuted()` returns true only
    while `mutedSha === headSha`. A push advances `headSha`, the match breaks, the branch reappears.
    No backend job, no webhook change, all other activity ignored. This is the whole mechanism.
  - **`mutedAt` is a Firestore `Timestamp`** (via `serverTimestamp()`) on live writes, NEVER an ISO
    string — standing operator convention for all time fields.
  - **Security:** `release-candidates` writes are otherwise server-only. Rather than open that up,
    we added a NARROW field-level rule: an active developer/admin may `update` ONLY when
    `affectedKeys().hasOnly(['mutedSha','mutedBy','mutedAt'])`. A client cannot smuggle a
    workflow-state change through it. `create`/`delete` stay denied.

### Status gap → UI-derived shipping badge (NOT a backend change)
- Why features froze at "Dev merged": in the promotion-chain design (2026-06-24 / ADR-001) a
  feature's own lifecycle is terminal at `DEV_MERGED`. The prod lane lives on the aggregate
  `development` entry — features ship in a BATCH, not individually. So a feature never gets
  `OK_FOR_PROD`/`PR_TO_PROD`/`PROD_MERGED` of its own; it only carries an `unreleased` flag.
- Fix: `shippingBadge(feature, developmentEntry)` DERIVES a prod-lane badge from the development
  entry's state + the feature's `unreleased` flag. Reuses `RcStatus` + `STATUS_META` so the badge
  is just a second status chip. **No backend/model projection change** — preserves "development owns
  the prod lane." Shown on feature cards in both Working Branches and Preview Channels.
  - `unreleased === false` (explicitly shipped) → Prod merged; `unreleased` + dev entry
    `prProd.OPEN` → PR → prod; `unreleased` + dev entry `promotable` → OK for prod; else no badge.
    An `undefined` flag is legacy/unknown and gets no badge (avoids false "Prod merged").

### Preview Channels
- **Environment Deploys moved to the TOP** so testers never miss the promote gate.
- **Promote gate lists the batch** (unreleased branches for the repo + each one's OK-for-dev note),
  so the tester sees exactly what "OK to promote" ships — both inline and in the confirm dialog.
- **Ready-to-test first:** cards awaiting OK-for-dev (live+fresh preview, not yet signed off) sort
  above the rest, with a highlight; a "N pending OK-for-dev" chip sits in the filter bar.

### Confirmations on all mutating actions
- One shared `ConfirmService` + `ConfirmHostComponent` (mirrors ToastService/ToastHostComponent),
  `ask()` → `Promise<boolean>`. Two tiers: `default`, and `prod`/`danger` for production-facing and
  access-changing actions. Rich confirms restate the batch (promote) or the role grant (Settings).
- Confirmed: deploy/redeploy preview, create PR → dev, create PR → prod (both screens), mute, OK for
  dev, **Has issues**, OK to promote, **Hold**, member/role changes. NOT confirmed (operator choice):
  pin/unpin, unmute — frictionless because private and/or instantly reversible.

## Verified
- `ng build` clean (no type errors). Ran the app in mock mode and confirmed: muted-branch chip +
  panel, pinned-first sort + kebab (Pin/Unpin + Mute), the confirm dialog, env-deploys-on-top, the
  batch listing, the pending chip, ready-first highlight, and the "Prod merged" shipping badge. Flag
  was flipped to `useMock:true` only for local verification and **reverted to `false`** after.

## Pending / operator follow-ups
1. **Deploy `firestore.rules`** — the new `user-prefs/{email}` rule and the narrow mute field-level
   rule must be deployed for pin/mute to work in LIVE mode.
2. **Backend parity for mute (live):** the webhook receiver must MERGE (not replace) release-candidate
   docs, or a webhook event will wipe `mutedSha/mutedBy/mutedAt`. Not exercised in mock mode; verify
   before relying on mute in production. The frontend + rules are done.
3. Consider mirroring the mute fields into `functions/src/model.ts` for type parity if the backend
   ever reads them.
