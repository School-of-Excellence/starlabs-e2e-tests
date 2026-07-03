# Journal — 2026-06-29: Gates green via public hub + Playwright reports (with screenshots) → Firebase Storage/Firestore

> Session goal evolved across two parts: (1) get the queue + journey reusable gates actually running/green in CI, then (2) persist the Playwright HTML report **with per-test screenshots** to Firebase Storage and index each run in Firestore. Both achieved and verified on the **validation** path (`journey-reusable` engine, PRs #8/#9). Not yet promoted to the live `cicd-dev`/`cicd-prod`/`development` gates.

---

## Part 1 — Why the reusable gates were failing, and the fix

**Symptom:** both reusable-caller gates died in 1–4s with
`error parsing called workflow … web-e2e.yml@journey-reusable : workflow was not found`.

**Investigation (what we ruled out):**
- The caller files, the `journey-reusable` branch, and `web-e2e.yml` (with `workflow_call` + `config`/`suite` inputs) all exist and are valid — confirmed in git and on GitHub.
- Billing was NOT the cause anymore: the old Jun-22 queue run #17 failed with the *spending-limit* error, but a fresh run got past that — so the Free-plan Actions cap was already resolved.
- The **same `@main` caller had run the full suite for 4–6 min in mid-June** (queue runs #13/#15), then regressed to "workflow not found" (#18/#19). A clean regression — so it wasn't "never set up."

**Root cause:** the hub repo `starlabs-e2e-tests` was **Private**, while the caller `starlabs-angular` is **Public**. A reusable workflow in a *private* repo isn't resolvable the way it was, and the public→private mismatch broke every caller (`@main` and `@journey-reusable` alike — access isn't per-ref). Org-level Actions settings were 404 to this account (not an org owner); the hub repo's `/settings/actions` was also 404 (account is below Admin on the repo).

**Fix:** the operator made the hub repo **Public**. After that, reopening PRs #8/#9 ran the suites end-to-end:
- **queue gate** → green (3m 21s)
- **journey gate** → green (4m 18s)

This validated the reusable-caller pattern for **both** systems for the first time.

---

## Part 2 — Reports with screenshots → Firebase Storage + Firestore

**Goal:** capture the Playwright report (with a screenshot per test) and persist it to Firebase Storage, indexed in Firestore.

### 2a. Make the gate produce a screenshot report
- `run-isolated.sh` only emits a browsable merged HTML report (with screenshots) when **`EVIDENCE=1`**; with `EVIDENCE=0` (the gate default) there's `--reporter=line` only → **no report, no screenshots**. That's why early journey runs logged `No files were found with the provided path: e2e/playwright-report` — not a path bug.
- Added **`playwright.journey.emulator.evidence.config.ts`** (mirrors the queue evidence config: `screenshot: 'on'`, `trace: on-first-retry`). Hub commit **`1aa7eff`**.
- Flipped the callers to capture evidence: journey-caller passes the evidence config + `evidence: '1'` (**`1d60f46`**); queue-recheck defaults `evidence: '1'` (**`19c0956`**).

### 2b. The upload was failing — diagnosing the exact error
- `record-run.cjs` uploads the report to Cloud Storage + writes a `cicd-audit/<runId>` Firestore doc. With the SA secret (`STARLABS_CICD_SA`) now set, it stopped skipping and **attempted** the upload — but failed with `ERR_STREAM_PREMATURE_CLOSE` fetching the Google OAuth token.
- Added temporary diagnostics (**`535867d`**) to dump the full stack + SA sanity. Findings:
  - SA is **valid** (`project_id: starlabs-cicd`, key well-formed) — not a bad-paste.
  - The failure is isolated to **`@google-cloud/storage`'s** auth (`gaxios@6` → `gtoken@7.1.0` → legacy `www.googleapis.com/oauth2/v4/token`). **Firestore (gRPC) succeeded with the same SA.**
  - **Surprise:** Firestore and Storage use *byte-identical* auth libs (`google-auth-library@9.15.1` / `gtoken@7.1.0` / `gaxios@6.7.1`) — so it was never a version problem; it's a transport flake on Storage's *separate* token fetch.

### 2c. Why the "dependency override" fix (#1) was abandoned
- Tried a scoped npm override forcing `@google-cloud/storage` → `google-auth-library@^10.7.0`. **npm rejected it as `invalid`** — `@google-cloud/storage@7.19.0` declares `google-auth-library: ^9.6.3`, so `^10.7.0` is out of range and won't install.
- Even if forced, an invalid lockfile risks failing **`npm ci`** (which runs *before* the suite) → would red the gate, outside the recorder's best-effort safety net.
- A `firebase-admin` bump wouldn't help either: `firebase-admin@13.x` still ships `@google-cloud/storage@7` on `gaxios@6`.
- Conclusion: **no valid + safe dependency override exists.** Reverted, restored clean `package.json`/lockfile.

### 2d. The fix that worked — Option C (bypass the broken SDK auth)
Rewrote `record-run.cjs` (**`41a7b25`**) to:
- **Mint a token via firebase-admin's own credential** (`getAccessToken()` — a different, working auth path than `@google-cloud/storage`'s `gaxios@6`) and **upload each file via the raw GCS JSON upload API** (no `@google-cloud/storage` SDK auth).
- **Decouple Firestore from Storage**: the upload is now best-effort (try/catch, non-fatal) and the **Firestore doc is always written** — previously a Storage failure threw *before* the doc was set, so nothing landed in Firestore either. Added a `runUrl` field (link back to the GitHub run) and removed the temporary diagnostics.

First verification run: **auth worked** (no more premature-close) — clean `404 "bucket does not exist"` instead, because the default `starlabs-cicd.appspot.com` bucket doesn't exist.

### 2e. Bucket/prefix correction
- Operator clarified: the bucket is **`starlabs-cicd.firebasestorage.app`**, and reports should go in a **`cicd-reports-development/`** *folder* (object prefix), not a separate bucket.
- First set `HISTORY_BUCKET=cicd-reports-development` (**`aa9b7c0`**) — wrong (treated the folder as a bucket).
- Corrected to `HISTORY_BUCKET=starlabs-cicd.firebasestorage.app` + a new configurable `HISTORY_PREFIX=cicd-reports-development` (**`6ed87bd`**).

### 2f. Verified end-to-end
- **Queue gate** (smoke self-tests, no UI): `✓ cicd-audit/…queue-recheck-19c0956-… (1 report file, 2 attachments) → gs://starlabs-cicd.firebasestorage.app/cicd-reports-development/…`
- **Journey gate** (16 UI tests, `screenshot:'on'`): `✓ cicd-audit/…journey-caller-1d60f46-… (17 report files, 2 attachments) → gs://…/cicd-reports-development/…` — the 17 files include the per-test PNG screenshots (report artifact 861 KB).
- Operator confirmed the **Firestore `cicd-audit` document** on screen (in the `(default)` database).
- Both gates stayed **green** throughout (recorder is best-effort → can never red the gate).

---

## What surprised us / lessons
- "Workflow not found" for a reusable workflow that clearly exists ⇒ check **repo visibility** (public caller can't use a private hub's reusable workflow), not just the file/ref.
- `EVIDENCE=0` produces **no** report at all — the "missing report path" was a mode issue, not a path bug.
- The premature-close was **not** a version/endpoint problem (Firestore used the identical stack and worked) — it's a transport flake specific to `@google-cloud/storage`'s separate auth instance. The robust fix was to **not depend on that SDK's auth** (firebase-admin token + raw REST), not to bump a dependency.
- **Decoupling matters:** the Firestore record must be written independently of the (flaky) Storage upload, or a Storage failure silently loses the whole record.

## Part 3 — Promoted to `main` (engine live)

Rather than wait on a separate PR, we **merged `journey-reusable` → hub `main`** directly (operator-approved) so the engine + report-to-Storage is live for every caller.

- **Merge `b27a874`** (`ad28af6..b27a874`). Hub `main` had diverged into the **Release Console** line, which had *also* edited `web-e2e.yml` (`stage` input) and `record-run.cjs` (`githubRunId`) — so the merge overlapped there.
  - `record-run.cjs` **auto-merged cleanly** — git combined main's `githubRunId` with journey's REST upload + `HISTORY_PREFIX` (syntax-verified).
  - `web-e2e.yml` had **one conflict, 2 additive hunks**, resolved by hand:
    - inputs block: kept **all three** — `stage` (console) + `config` + `suite` (journey).
    - record step: kept journey's `SUITE="${{ inputs.suite }}"` **+** main's `STAGE="${STAGE:-gate}"` (parameterized suite + stage-aware history).
- **Breakage check before pushing (all clear):** hub workflows are `workflow_call`-only → **push to main triggers nothing**; queue gate stays backward-compatible (`config`/`suite` default to queue, proven via queue-recheck); recorder is best-effort → can't red a gate; console code untouched.
- **Flipped the journey caller to `@main`** — `journey-e2e.yml` `uses:`/`e2e_ref` `journey-reusable → main` (app commit `c9010a8`). The live queue gate already calls `@main`, so it now also captures reports to `cicd-reports-development/` (best-effort).

## Still pending
- **Close/revert `queue-recheck` PR #9** — its job (prove queue green vs the modified engine) is done now that the engine is on `main`.
- **Land the two app fixes** `e53657b` (product-delivery) + `16b578a` (delivery-sequence) into **`development`** — still missing; JP-PD/JP-EDIT need them.
- **Full journey cutover:** add `journey-e2e.yml` to `development`, switch triggers `[cicd-dev, cicd-prod] → [development]`, make it a **required** check (jointly with queue).
- **Roll the 10 remaining systems incrementally** (modes, profiles, comms, evomap, appointments, authroles, business, content, events, workshops) — each needs its own emulator config + emulator-aware seeder + thin caller; the engine on `main` is now the shared foundation, so each is a small PR.
- Minor: per-suite `ATTACH` (currently queue fixtures, best-effort); bump `actions/*` to clear the Node-20 deprecation warning.

## Commits
**Hub `starlabs-e2e-tests` (`journey-reusable`):** `1aa7eff` (journey evidence config) · `535867d` (temp diagnostics) · `41a7b25` (REST upload + decoupled Firestore) · `aa9b7c0` (bucket pointer) · `6ed87bd` (bucket+prefix correction)
**Hub `starlabs-e2e-tests` (`main`):** `b27a874` (merge `journey-reusable` → main — engine + report-to-Storage live)
**App `starlabs-angular`:** `1d60f46` (journey-caller evidence) · `19c0956` (queue-recheck evidence=1) · `c9010a8` (journey-caller flip to `@main`)
