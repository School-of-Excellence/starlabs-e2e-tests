# Journey gate — landing plan (queue-parity) — hand-off for vignesh-027

> **This package is DRAFTS ONLY. Producing it changed no live workflow, branch, or deploy** — it's a few
> untracked files in `starlabs-e2e-tests/docs/journey-caller-drafts/`. Nothing here runs until someone
> deliberately pushes it through the flow below.

## TL;DR — the ask
- Journey's e2e suite is **green (16/16 in CI**, run `27844449961`) but its gate is the **old standalone** shape.
- This converts it to a **thin caller of the hub `web-e2e.yml`** — identical in shape to `queue-e2e.yml` — and lands it through the **sudo-branch flow**, exactly like queue.
- The **only shared change** is **+2 optional inputs on `web-e2e.yml`** (`config`, `suite`), proven backward-compatible — **queue is untouched**.
- **From vignesh:** (1) review the `web-e2e.yml` engine change (his file, shared with queue); (2) confirm the staging branch; (3) confirm validation target + cutover timing.

## Where journey is today
- Suite **16/16 green in CI** via the standalone `journey-e2e.yml` on app `journey-gate`.
- During Phase-3 validation we fixed 2 config bugs (PR base `main→development`; secret `CICD_PAT→REPO_PAT`) and the gate **caught a real regression**: `development` is missing two 2026-06-10 app fixes — product-delivery `e53657b` + delivery-sequence `16b578a`. Ported onto `journey-gate`; **`development` still needs them** (tracked as a separate task).
- The journey **engine** (emulator config + seed + support) is on hub `journey-gate`, **not yet on hub `main`**.

## Target = parity with queue
`queue` today: thin `queue-e2e.yml` → `web-e2e.yml@main` → `run-isolated.sh`; triggers on `[cicd-dev, cicd-prod]`; **enforcement OFF**; cutover to real `development`/`production` **pending (Phase 1B)**.
`journey` goal: same shape, same flow, **cut over together with queue.** ("Land like queue" = reach this parity; full cutover is the joint Phase-1B step.)

## Approval gates — execute Gates 1→3 (parity); HOLD Gate 4 for the joint cutover
> **Operator directive:** execute **up to where queue is today** (validated + on the branches, **pre-cutover**).
> **Once vignesh moves QUEUE to `development`/`production`, journey follows** (Gate 4, jointly). Do not cut journey over alone.

| Gate | Approved when | Who executes | Risk |
|---|---|---|---|
| **1 — validate** | engine change is optional/backward-compat by design + journey green → OK to run on a hub feature branch + `cicd-dev` | vignesh approves; operator can initiate the run | ~0 (nothing merged) |
| **2 — engine → hub `main`** ⭐ | validation shows **journey 16/16 reusable-path** AND **queue still green** on the modified engine + env overlay; per-file harness confirmed | **vignesh** (his engine, shared w/ queue) | the real gate |
| **3 — caller → `development`** | caller flipped to `@main` and green; lives beside `queue-e2e.yml`; enforcement OFF | **vignesh / team** (protected branch) | low (report-only) |
| **4 — cutover (DEFERRED)** | **after queue is cut over by vignesh**: both stable, prod-deploy perms fixed, delivery fixes in `development`; flip triggers → `[development]`, make required | **vignesh / team, jointly** | the big one |

**Execution boundary:** Gates 2 & 3 are *merges to protected branches vignesh owns* — **not solo steps.** The only solo-executable progress is producing the **Gate-2 evidence** (the validation run), which writes only to feature branches + a no-merge PR. Everything past that waits on vignesh.

## The changes (by owner)
**HUB (`starlabs-e2e-tests`, vignesh's repo + review):**
1. `web-e2e.yml` → add 2 optional inputs `config` (default **EMPTY**) + `suite` (default `queue`); forward `CONFIG`/`SUITE_DIR` env; tag history by `suite`. **4 marked changes, backward-compatible.** → `web-e2e.proposed.yml`
2. `run-isolated.sh` → **one line**: `SPECS="${ONLY:-$(find "${SUITE_DIR:-queue}" -name '*.spec.ts' | sort)}"`
3. Land the journey **engine** on hub `main` (PR `journey-gate → main`): `playwright.journey.emulator.config.ts`, `journey/support/emulator-global-setup.ts` + `-teardown.ts`, `seed-journey.js` (initAdminAuto), the JP-09 fix, and the `ci/overlay/environment.emulator.ts` null fix (**no conflict** — main never touched that file).

**APP (`starlabs-angular`):**
4. Replace the standalone `journey-e2e.yml` with the thin caller → `journey-e2e.yml`. Stage on a branch off `feature/cicd-rollout`.

## "Won't affect any current working flow" — the guarantees
- **Optional inputs can't change existing callers.** The queue caller doesn't pass `config`/`suite` → it gets the defaults → byte-identical behaviour.
- **`config` defaults to EMPTY on purpose** → `run-isolated.sh` keeps its existing **evidence-aware** queue defaults, so **queue's evidence mode (`workflow_dispatch evidence=1`) is preserved.** (A config *name* as the default would be used unconditionally and break that — caught and corrected in the draft.)
- **`suite` defaults to `queue`** → history tag and `find queue` are unchanged.
- **`run-isolated.sh` `find "${SUITE_DIR:-queue}"`** → SUITE_DIR=`queue` (or unset, for local runs) → `find queue`. Unchanged.
- **Ref-pinning during validation:** queue uses `web-e2e.yml@main`; journey validates against a hub **feature branch** (`uses: @<branch>`, `e2e_ref: <branch>`). GitHub resolves each caller independently → **queue cannot be affected** until the change is deliberately merged to hub `main`.
- **Sudo branches `cicd-dev`/`cicd-prod` deploy only to the test project** → validation never touches real `development`/`production` or the live project.
- **Enforcement stays OFF** until the joint cutover — nothing becomes a required check unilaterally.

## Exact branches + base commits (verified 2026-06-20)
- **App caller base:** branch off **`feature/cicd-rollout @ 4db3b6f`** (canonical CI staging line). For journey it is equivalent to `development @ e71c706`: journey/product-delivery code is **identical** on both, gate workflows are **identical**; the only delta is a deploy-lane env line (`zoomMigrationApiUrl`) the caller never touches. `feature/cicd-rollout` is a clean **ancestor** of `development` (12 commits behind, fast-forwardable) — vignesh can re-sync it with a no-op merge if he wants the base current.
- **Do NOT use `cicd-rollout`** — stale predecessor (~3,200 lines of features behind; divergent older workflow files).
- **Validate:** PR into **`cicd-dev`** (or `cicd-prod`).
- **Hub:** feature branch carrying changes 1–3; caller pins to it until it merges to hub `main`, then flips to `@main`.

## Land sequence (validate → flip → cut over)
> **⛔ PREREQUISITE — a REAL bug, not a test accommodation.** Land the two delivery fixes (`e53657b`
> product-delivery list, `16b578a` delivery-sequence) into `development` **first**. These are genuine app
> defects — unguarded `['deliverysequence'].length` / `['product']['path']`, and an in-place mutation of the
> live `collectionSnapshots` stream that blanks the `/productdelivery` table on re-emit. Without them the
> journey gate is **correctly RED** on any `development`-based branch (JP-PD + JP-EDIT). So: green validation
> requires these fixes on the app-under-test, and `development` needs them **regardless of journey**.
> **Fix in code; do NOT weaken the seed/test.** (They are already on `journey-gate` as `25e40d8` + `4d53507`.)

0. **(no-op safety)** Tag restore points: app `journey-gate` (16/16 standalone) + hub `journey-gate` (engine).
1. **Hub feature branch:** apply `web-e2e.proposed.yml` + the `run-isolated.sh` line + the journey engine; push.
2. **App branch off `feature/cicd-rollout`:** add the thin caller, pinned to the hub feature branch; push.
3. **No-merge PR into `cicd-dev`** → confirm the journey gate runs the **reusable** path green (16/16). *First real proof of the per-file harness* (our 16/16 was one invocation; `run-isolated.sh` runs per file + reseeds — journey's globalSetup supports it).
4. **Hub merge** (vignesh review): changes 1–3 → hub `main`. **Confirm a queue PR still runs the queue gate green** (backward-compat proof).
5. **App:** flip the caller's `uses:`/`e2e_ref` to `@main`; merge the caller into `development` (beside `queue-e2e.yml`). Enforcement still OFF.
6. **CUTOVER (Phase 1B, with queue):** flip triggers `[cicd-dev, cicd-prod] → [development]`; make required; fix prod-deploy perms (per the master journal).
7. *(Delivery fixes — MOVED UP to the Prerequisite above; they're a real bug fix that must land before validation, not a final clean-up.)*

## Rollback (every stage is clean)
- Validation issue → **delete the feature branches / close the PR** → back to today (standalone `journey-gate` untouched).
- Bad hub change → it's on a feature branch (or `git revert` the main merge); queue pins `@main` and is unaffected pre-merge.
- **No deploys to real envs occur before cutover** → nothing protected to unwind.

## Decisions needed from vignesh
1. OK to add `config`/`suite` to `web-e2e.yml`? (backward-compat shown above.)
2. Staging branch for the caller — `feature/cicd-rollout` (recommended), or `development`?
3. Validate against `cicd-dev` or `cicd-prod`?
4. Timing of the joint cutover (Phase 1B) and the `development` delivery-fix PR.

## ✅ Acceptance checklist — "all done well at the end"
- [ ] `web-e2e.yml` (config/suite) merged to hub `main`, and **a queue PR still runs the queue gate green** (backward-compat proven).
- [ ] Queue's evidence mode (`workflow_dispatch evidence=1`) still uses the evidence config (spot-check).
- [ ] Journey engine on hub `main`; journey caller (reusable path) **green on `cicd-dev` — 16/16**.
- [ ] `journey-e2e.yml` merged into `development` beside `queue-e2e.yml`; both still report-only (enforcement off).
- [ ] No unexpected deploys to real `development`/`production`/live during validation.
- [ ] The two delivery fixes (`e53657b`, `16b578a`) landed in `development` → journey green on a **real development PR**.
- [ ] At cutover: journey **and** queue both trigger on `[development]` and are required checks — **together**.

## File index (this folder)
| File | Purpose |
|---|---|
| `LANDING-PLAN.md` | **This file** — the hand-off entry point. |
| `journey-e2e.yml` | The new app caller → `starlabs-angular/.github/workflows/journey-e2e.yml`. |
| `web-e2e.proposed.yml` | Proposed hub engine → replaces `starlabs-e2e-tests/.github/workflows/web-e2e.yml` (4 marked, backward-compatible changes). |
| `README.md` | File-level placement detail + the `run-isolated.sh` one-liner + caveats. |
