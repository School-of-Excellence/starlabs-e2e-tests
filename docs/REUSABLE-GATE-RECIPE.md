# Reusable e2e gate — recipe for the NEXT system (journey-proven)

> How any feature "system" (queue, journey, → next) gets its own hermetic Playwright gate via the hub's
> **reusable `web-e2e.yml`**. Distilled from landing **journey** (system #2). Self-contained — a fresh session
> can add system #3 from this file alone. Companion: `CICD-JOURNAL.md` (platform master), `JOURNEY-PIPELINE-HANDOFF.md`.
> Last updated 2026-06-21.

## The architecture (3 layers)
```
<sys>-e2e.yml        (app · per-system · ~30 lines · WHEN to run + WHICH suite)
   │  uses:
   ▼
web-e2e.yml@main     (hub · REUSABLE · assemble 3 repos → boot emulator+CF → serve app → run)   ← now parameterized
   │  run: run-isolated.sh   (reads CONFIG + SUITE_DIR from env)
   ▼
run-isolated.sh      (hub · runs each spec FILE as its own Playwright invocation, reseeding per file)
```
The hub `web-e2e.yml` is **parameterized by `config` + `suite`** (added when landing journey), so ONE engine runs any suite. The caller passes: `cf_branch`, `e2e_ref`, `firebase_project: starlabs-cicd`, `config: playwright.<sys>.emulator.config.ts`, `suite: <sys>`, `only`, `evidence`; and `secrets: inherit` (REPO_PAT).

## Recipe — add system `X`
1. **Build X's emulator engine in the hub** (mirror queue/journey): `playwright.X.emulator.config.ts` (`testDir: ./X`, `workers:1`, `globalSetup` that **teardown+reseeds run1 per file** — required by run-isolated.sh), `X/support/emulator-global-setup.ts` + `-teardown.ts`, and make X's seeder **emulator-aware** (`initAdminAuto` pattern: emulator admin when `FIRESTORE_EMULATOR_HOST` set). Get it **green locally** first.
2. **Land X's engine on hub `main`** via PR — additive (new `X/**` files). If it touches the **shared** `ci/overlay/environment.emulator.ts`, flag it (queue + every suite clone it).
3. **App thin caller** `.github/workflows/X-e2e.yml` (copy `queue-e2e.yml`): triggers `[cicd-dev, cicd-prod]` (→ `[development]` at cutover); `paths` = X's app folders + the workflow file; `uses: …/web-e2e.yml@main`; `config: playwright.X.emulator.config.ts`; `suite: X`; `secrets: inherit`.
4. **Validate on the sudo branches.** Branch `X-caller` **off `cicd-dev`** (NOT `feature/cicd-rollout` — see gotcha), add the caller, open a **no-merge** PR into `cicd-dev`. Pin `uses:`/`e2e_ref` to the hub *feature branch* until the engine PR merges, then flip to `@main`.
5. **Prove backward-compat**: open a companion queue PR (`queue-recheck`) pinned to the **same** hub feature branch → queue must stay green.
6. **Cutover (jointly with queue, Phase 1B)**: flip triggers → `[development]`, make required.

## Hard-won gotchas (don't re-learn these)
- **project-id = `starlabs-cicd` EVERYWHERE** (emulator boot + app overlay + seed) or auth silently fails. #1 gotcha.
- **Secret = `REPO_PAT`** (read on the private e2e + cloud-function repos), via `secrets: inherit`. **NOT `CICD_PAT`** — that was a stale name; the standalone journey gate referenced it and failed at the CF-clone until fixed.
- **`web-e2e.yml` `config` default MUST be empty** (`''`), never a config *name* — empty lets run-isolated.sh keep its **evidence-aware** queue default. A name there breaks queue's `evidence=1` mode. (Caught during journey.)
- **`run-isolated.sh` runs PER spec FILE with a reseed each** — X's `globalSetup` MUST teardown+reseed. This differs from a single `playwright test` invocation; **re-validate** X under it (our journey 16/16 was first proven as one invocation).
- **`cicd-dev`/`cicd-prod` are STALE** vs `feature/cicd-rollout`/`development`. A branch off `feature/cicd-rollout` **conflicts with `cicd-dev`** → the conflicted PR breaks the gate's `actions/checkout` (no merge ref). **Branch validation branches OFF `cicd-dev` itself.** (For journey the journey/delivery app files were identical across the two, so a clean rebase onto cicd-dev worked.)
- **force-push ONLY on *our* test branches** (`X-caller`, `queue-recheck`, the hub feature branch) — **NEVER** on others'/shared (`cicd-*`, `feature/cicd-rollout`, `main`, `development`, `production`, `journey-gate`). Touch those **only as PR targets**.
- **Land the app code X depends on FIRST.** Journey's gate caught that `development` was missing two **real** product-delivery bug fixes (`e53657b`, `16b578a`) — the gate is correctly RED on `development` until they land. Fix in **code**, not by weakening the test.
- **GitHub Actions billing can hard-block ALL runs** — a job that dies in ~3s with *"recent account payments have failed or your spending limit needs to be increased"* is an org **billing** block, not a code problem. Resolve in org Settings → Billing & plans, then **Re-run jobs**.
- **Private reusable-workflow ACCESS** — `uses: <hub>/web-e2e.yml@<ref>` failing with *"workflow not found"* (when billing is fine and the file/branch exist) is a cross-repo **access** issue, not a missing file: the HUB's *Settings → Actions → Access* must allow org repos to call its reusable workflows, and any org allowed-actions policy must permit the ref. It's **hub-admin's setting**, required for EVERY thin caller (journey + future systems). To prove green WITHOUT it, run the gate **inline** (clone the hub via `REPO_PAT` + `bash scripts/run-isolated.sh` with `CONFIG`/`SUITE_DIR`) instead of `uses:`. (Hit while landing journey, 2026-06-26 — `web-e2e.yml@journey-reusable` not found.)

## Journey (system #2) — current state (2026-06-21)
- **Hub PR** `starlabs-e2e-tests#1` (`journey-reusable → main`) — the `config`/`suite` engine change + the journey engine. For vignesh. Backward-compat + acceptance checklist in the PR body. Shared-file flag: `environment.emulator.ts` `watson/salescrm: null`.
- **Journey validation** `starlabs-angular#8` (`journey-caller → cicd-dev`), pinned `@journey-reusable`.
- **Queue backward-compat** `starlabs-angular#9` (`queue-recheck → cicd-dev`), pinned `@journey-reusable`.
- ⚠️ **BLOCKED — Actions billing.** Both gate runs failed in ~3s on *"recent account payments have failed / spending limit"* — the job never started. **Not a code issue.** Resolve org billing → **Re-run jobs** on #8 + #9 to get green (expect journey 16/16, queue green).
- **Pending:** the two delivery fixes still need to land in `development` (real bug). Then journey is green on a real development PR. Cutover is joint with queue (Phase 1B).

## Where things live
- **Hub:** `web-e2e.yml` (+`config`/`suite`), `scripts/run-isolated.sh` (`find "${SUITE_DIR:-queue}"`), journey engine (`playwright.journey.emulator.config.ts`, `journey/support/*`, `journey/seed-journey.js`, `ci/overlay/environment.emulator.ts`).
- **Drafts + plan:** `docs/journey-caller-drafts/` — the caller, the proposed engine, `LANDING-PLAN.md` (gates 1→4 + sequence + acceptance + rollback).
