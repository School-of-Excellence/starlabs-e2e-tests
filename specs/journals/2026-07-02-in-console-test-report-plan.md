# 2026-07-02 — In-console Test Report screen (fold report-viewing into the console)

**Status:** Planned (not built). **Author:** session (operator: appexperience@soexcellence.com).
**Supersedes the hosting choice in** [2026-06-23-pr-gate-report.md](2026-06-23-pr-gate-report.md) (standalone dashboard)
and continues [2026-07-01-console-report-access-deeplink.md](2026-07-01-console-report-access-deeplink.md).

## Decision (locked this session)
- **Fold report-viewing INTO the console** (was: link out to a standalone `dashboard/` SPA). Same origin, same
  `@angular/fire` auth + `@soexcellence.com` member fence, same `starlabs-cicd` project. Nothing new to deploy
  or sign into. The standalone `dashboard/` is superseded.
- **Same project confirmed:** reports already live in `starlabs-cicd` — Cloud Storage
  `cicd-reports-development/<repo>/<runId>/…` + Firestore `cicd-audit/<runId>`. The console is on `starlabs-cicd`
  too. No cross-project work.
- **Button change:** the card's "Show report" stops opening the GitHub run page and opens an **in-app screen**
  `/report/:githubRunId`. `FirebaseService.reportUrlFor` returns the internal route, not `historyDashboardUrl`.
- **Report screen shows the FULL report natively:** every spec file (suite) → its test cases with pass/fail +
  duration; a failed case opens a detail drawer with the error, screenshot(s), recording, and a trace link.
- **Evidence is FAILURE-ONLY (operator, 2026-07-02):** screenshots + video + trace are captured **only for
  failed tests**. Passing tests get **no** heavy artifacts. `report.json` still lists **all** tests (pass and
  fail) with status/duration — that's cheap metadata, always present.

## Why this needs producer-side work first (validation findings)
1. **No machine-readable per-test data is persisted today.** We store the *opaque* Playwright HTML bundle + a
   pass/fail summary only. "All suites + all test cases" needs a **`report.json`** — produced by a second
   `merge-reports --reporter=json` over the per-file blobs, uploaded alongside the HTML.
2. **`EVIDENCE=0` produces no report at all** (line reporter only). A report exists only on the blob→merge path.
   So the surfaced gates must run in the report-producing mode.
3. **Failure-only capture** = `screenshot:'only-on-failure'`, `video:'retain-on-failure'`,
   `trace:'on-first-retry'`. NOTE: the current *evidence* config uses `screenshot:'on'` (every test) — chosen for
   queue/journey per [../../docs/2026-06-29-screenshot-reports-to-firestore-storage.md]. Moving to failure-only
   changes that shared behavior → **needs sign-off from queue/journey owners** (they lose per-pass screenshots).
4. **The raw Playwright HTML report can't be opened straight from a Storage download URL** — its CSS/JS/data load
   via *relative* paths, and a tokenized Storage URL isn't a directory, so assets 404. Therefore: build the
   console screen from `report.json` + per-artifact Storage URLs (robust); treat "Open full Playwright HTML" as an
   OPTIONAL later phase that requires publishing each run's report folder to Firebase **Hosting** (directory-served).
5. Individual **screenshots/videos each get their own Storage download URL** and render fine as `<img>`/`<video>`
   cross-origin — no CORS/iframe issue. Only the folder-relative HTML bundle is the awkward one.

## Screens (ASCII captured in chat 2026-07-02)
- **Board card** — only the "Show report ▸" target changes (GitHub → `/report/:runId`).
- **Test Report screen** — header (repo/branch/sha/suite/stage/result/run#/time), pass/fail summary bar, filter +
  search, list of spec files (suites) expandable to test cases with status + duration, "Open full Playwright HTML ↗"
  (optional/Phase 4), "GitHub run ↗".
- **Test-case detail drawer** — error text, failure screenshot(s) (click-to-enlarge), recording (`<video>`),
  "Open Playwright trace ↗".

## Plan (phases)
- **Phase 0 — Producer (hub):** add `report.json` (blob→JSON merge + upload); set surfaced gates to run in
  report mode with **failure-only** capture; turn the mode on for `preview-e2e.yml` gates. Files:
  `scripts/run-isolated.sh`, `scripts/history/record-run.cjs`, the emulator report/evidence config(s),
  `.github/workflows/web-e2e.yml`, `starlabs-angular/.github/workflows/preview-e2e.yml`.
- **Phase 1 — Access rules (already drafted 2026-07-01, not deployed):** `console/firestore.rules` (`cicd-audit`
  read), `console/storage.rules` (`cicd-reports-development/**` read), `console/firebase.json` (storage block).
- **Phase 2 — Console data layer:** wire `@angular/fire/storage` in `app.config.ts`; `FirebaseService.auditRun(githubRunId)`
  (reads `cicd-audit`), `reportJson(run)` (fetch `report.json` via Storage), `artifactUrl(gsPath)` (per-file
  download URL, bucket taken from the `gs://` URL); add a `CicdAuditRun` + parsed report model.
- **Phase 3 — Screens:** `ng g c screens/report` (folder-per-component, no spec) + route `/report/:githubRunId`;
  suite/case tree, case-detail drawer with screenshot/video/trace; repoint `reportUrlFor` to the route; mock fixture.
- **Phase 4 — OPTIONAL:** publish each run's report folder to Firebase Hosting so "Open full Playwright HTML"
  opens the literal report; only if the native screen isn't enough.

## Open decisions
- **Sign-off needed:** flipping the shared capture to failure-only affects queue/journey (they currently keep
  per-pass screenshots). Confirm they're OK, or give preview-gate its own failure-only report config.
- **Phase 4 (raw HTML) in v1 or later?** Recommend later; native screens first.

## Not done / guardrails
- No code written; planning only. Phase-1 rule files exist from 2026-07-01 but are **not deployed**.
- Do not invent a hosting URL; `historyDashboardUrl` becomes unused under the fold-in design.
