# StarLabs CI/CD — Goal

> What we are building and why. The system design is in [`ARCHITECTURE.md`](ARCHITECTURE.md); progress and
> the operator runbook are in [`CICD-ROLLOUT.md`](CICD-ROLLOUT.md).

---

## 1. The goal (plain)

Developers stop pushing code straight into the important branches. Every change rides a pipeline:
**make a preview → the team reviews it → an authorized person approves a Pull Request → merging auto-deploys.**
Robots build, test, and deploy; humans review and approve. Every test run and deploy is recorded forever, and a
single **release console** lets the team drive and watch it all.

---

## 2. Principles (the rules the system enforces)

1. **PR-only.** The only way code reaches `development` or `production` is an approved Pull Request — never a
   direct push.
2. **Approved merge = auto-deploy.** Merging a PR into `development` deploys to test; into `production` deploys
   to live. No manual step, no "merged-but-not-deployed" gap.
3. **Named gatekeepers.** Only an allowlisted person may **push/merge**, and only an allowlisted person may
   **approve** — and the prod allowlist can be stricter than the dev allowlist.
4. **Preview before PR.** Every feature branch gets a preview website; the team marks it **"OK to Release"**
   before a PR is opened.
5. **History is immutable.** Every test run (report + data + who/when) is archived and never overwritten.
6. **One engine.** Test/pipeline logic is defined once in the hub; every repo inherits it via a thin caller.
7. **Safety constraints are absolute.** ATC is off-limits; production is read-only for test infra.

---

## 3. The two access requirements (and how we meet them)

Both are **branch-level access control**, which GitHub enforces only on the **Team** plan via branch protection.

### Requirement 1 — Only an allowlist can push to development/production
- Branch protection: **Require a pull request before merging** → blocks all direct pushes.
- Branch protection: **Restrict who can push to matching branches** → the allowlist (also restricts merging).

### Requirement 2 — Only an allowlist can approve PRs to development/production
- Branch protection: **Require approvals** + **Require review from Code Owners**.
- `.github/CODEOWNERS` lists the approvers. It is read from the PR's **base branch**, so:
  - `development` CODEOWNERS → the development approvers,
  - `production` CODEOWNERS → the (stricter) production approvers.

### The console adds what GitHub can't express
- The **"OK to Release"** human gate (review the preview before a PR exists).
- A **second identity check** before it calls the GitHub merge API (defence in depth).
- The board, QA notes, one-click PR creation, and the link to each PR's archived e2e report.

### Chosen enforcement (now): console-gated, stay on Free
We are **staying on GitHub Free** for now and making the **release console the merge authority**:
- The console's **GitHub-App bot** is the only identity that performs the merge, and it merges **only** when the
  caller is on the console's **per-branch approver allowlist** (development list vs production list, mirrored
  from the model in [`.github/CODEOWNERS`](../.github/CODEOWNERS)).
- Developers are asked, **by policy**, not to merge directly — they drive releases through the console.
- An **alert-only** `branch-guard` tripwire flags any non-PR push so the team sees drift (no auto-revert).

**Honest limitation:** on the Free plan this is a *policy + tooling* gate, not a hard wall. A determined developer
can still merge through the **GitHub UI** (or push directly) because GitHub Free cannot restrict who pushes/merges.
The console gate and CODEOWNERS reduce that to a deliberate, visible act — they do not block it.

> **The hard wall is GitHub Team** (~$4/user/mo on School-of-Excellence) + branch protection
> ("Require a pull request", "Restrict who can push", "Require review from Code Owners"). That upgrade turns
> Requirements 1 & 2 into enforced rules. Everything we build now is **forward-compatible — zero rework** when
> Team is switched on; the console gate simply becomes redundant defence-in-depth rather than the only gate.

---

## 4. The release status lifecycle

```
 NO_ACTION ─► OK_TO_RELEASE ─► PR_TO_DEV ─► DEV_MERGED ─► PR_TO_PROD ─► PROD_MERGED
  preview      team reviews     developer    approved      developer     approved
  built        + signs off      opens PR      + merged      opens PR       + merged
  (auto)       (MANUAL)         (webhook)     (webhook)     (webhook)      (webhook)
```
Only `OK_TO_RELEASE` is set by a human in the console. Everything else is derived from GitHub events, so the
board always reflects reality.

---

## 5. Rollout order

Turn the pipeline on **one repo at a time**, because the web app is the lead and the others reuse the engine.

```
 1. WEB APP (starlabs-angular)      ← in progress: preview green; gate one setting away
 2. BACKEND (starlabs-cloud-function) ← same pipeline + finalize ATC-safe deploy
 3. MOBILE (breakthroughs-flutter)  ← same pipeline + fix web build + app-store delivery (needs creds)
 4. RELEASE CONSOLE                  ← board + OK-to-Release + approve/merge + webhooks (in the hub)
 5. ENFORCEMENT HARDENING            ← GitHub Team + branch protection + CODEOWNERS (Requirements 1 & 2)
```

A repo is "done" when one full cycle works end-to-end:
`feature → preview → OK to Release → PR → gate green → approve → merge → auto-deploy`, on both development and
production, with the run archived in history.

---

## 6. Current state

- **Enforcement chosen:** **console-gated, stay on Free** — the console's GitHub-App bot is the merge authority
  with a per-branch approver allowlist; direct merge is a policy "don't", not a hard block (honest gap until Team).
- **Built & authored:** all reusable pipelines, deploy (auto-deploy on merge, both branches), preview lane,
  alert-only branch-guard, append-only history, history dashboard. Console lives in `console/` (frontend) +
  `console/functions/` (backend).
- **Verified locally:** the gate engine runs green (operator suite 13/0); history helper + ATC guard verified.
- **Live (web app):** preview channel green; the gate is one setting away (hub repo Actions "Access: org").
- **Next:** prove the full web-app cycle, then roll out backend + mobile, then build the console, then (future)
  enable GitHub Team for the hard wall on Requirements 1 & 2 — zero rework.
