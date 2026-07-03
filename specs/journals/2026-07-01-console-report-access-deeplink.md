# Journal — 2026-07-01: Console → cicd-audit report access (deep-link + bucket fix)

**Author:** session (operator: appexperience@soexcellence.com).
**Extends:** [2026-06-23-pr-gate-report.md](2026-06-23-pr-gate-report.md) (the report-access plan) and
[../../docs/2026-06-29-screenshot-reports-to-firestore-storage.md](../../docs/2026-06-29-screenshot-reports-to-firestore-storage.md) (where reports land).

## Question that started it
Where is the Playwright report stored besides the GitHub artifact, and how does the console reach it?

**Answer (confirmed from code):**
- **GitHub artifact** `playwright-report` (14-day retention) — `web-e2e.yml`.
- **Cloud Storage** `gs://starlabs-cicd.firebasestorage.app/cicd-reports-development/<repo>/<runId>/report/…` — the browsable HTML + per-test screenshots, uploaded by `scripts/history/record-run.cjs` (raw GCS REST, best-effort).
- **Firestore `cicd-audit/<runId>`** — the queryable index doc (`githubRunId`, `result`, `storage.report[]`, …).

The console does NOT read `cicd-audit` directly (plan 2026-06-23). It links out to the standalone
**cicd-audit dashboard** (`dashboard/index.html`) via `FirebaseService.reportUrlFor(rc)` →
`${environment.historyDashboardUrl}?githubRunId=<reportRunId>`.

## State found (the two 2026-06-23 follow-ups, both still open)
- **A. Dashboard `?githubRunId=` lookup** — MISSING. `dashboard/index.html` loaded latest 200 + text filter only; it ignored URL params, so a console deep-link landed but selected nothing.
- **B. `environment.historyDashboardUrl`** — still `''`; `reportUrlFor` therefore always fell back to the GitHub run page.
- **Latent bug** — `reportUrl()` stripped the bucket from the `gs://` URL and re-resolved against the config's default `storageBucket` (`…appspot.com` in `config.example.js`), but reports live in `…firebasestorage.app` → "report index not found".

## Done this session (item A + bug)
`dashboard/index.html`:
- Read `?githubRunId=` (and `?runId=`) on boot (`DEEPLINK` + `matchDeepLink`).
- `load()` → `ensureDeepLinkLoaded()` (direct `where('githubRunId','==',…)` fetch if the run is older than the latest 200) → `focusDeepLink()` auto-selects the run, opens its detail (resolves the archived report), scrolls it into view, and shows a header banner (or "no run for <id>").
- Added `where` to the Firestore import.
- **Bucket fix:** `reportUrl()` now parses the bucket from the `gs://` URL and resolves via a per-bucket `getStorage(fb, 'gs://<bucket>')` instance, so reports in `…firebasestorage.app` resolve regardless of the default `storageBucket`.
- Verified: `node --check` on the extracted module → SYNTAX OK. Not runtime-verified (needs `config.js` + live starlabs-cicd Google sign-in — operator-held).

## Verified current setup (does the 2026-06-23 plan still hold?)
The console→dashboard **deep-link seam is still correct** (`reportUrlFor` unchanged; console never reads cicd-audit directly). But the plan assumed the dashboard "ships independently" — since then the console became a deployed Hosting **site** (`cicdconsole` on starlabs-cicd, `console/firebase.json`), and a standalone dashboard deploy would **fail as-is** for three reasons:
1. **Firestore:** deployed `console/firestore.rules` had **no `cicd-audit` read rule** + a default-deny → reads blocked. (README's suggested rule was never added and is looser than the console fence.)
2. **Storage:** no `storage.rules`, no `storage` block in `console/firebase.json` → report `getDownloadURL` blocked. README's path (`cicd-audit/`) is **stale**; real prefix is `cicd-reports-development/`.
3. **Second auth surface:** a standalone dashboard needs its own Google sign-in + authorized domain + `config.js` — duplicating the console's sign-in setup (`console-signin-authdomain`).

**Operator decision (2026-07-01):** lock the report plan first; **defer** the hosting fork (a = keep standalone dashboard vs b = fold report-viewing into the console). Do the rules work now since it's required either way.

## Done this session — rules (required for a OR b)
- `console/firestore.rules` — added `match /cicd-audit/{runId} { allow read: if isActiveMember(); allow write: if false; }` before the default-deny (same member fence as release-candidates; `where('githubRunId','==')` is single-field, no composite index needed).
- `console/storage.rules` — NEW. `cicd-reports-development/**` readable by signed-in `@soexcellence.com` (`orgEmail()`); all writes server-only; default-deny elsewhere.
- `console/firebase.json` — added `"storage": { "rules": "storage.rules" }` (JSON validated).
- **NOT deployed** — operator runs `firebase deploy --only firestore:rules,storage --project starlabs-cicd`. Writing the files only; deploy needs operator access.

## Still pending
- **Lock the hosting fork (a vs b).** Then: if (a) deploy `dashboard/` as a 2nd site + `config.js`; if (b) build the in-console report view/route.
- **Deploy the rules** above to starlabs-cicd.
- **Item B — `environment.historyDashboardUrl`** (only relevant if a): needs the deployed dashboard URL.

## Pending — item B (needs operator input, NOT guessed)
Setting `environment.historyDashboardUrl` needs the **deployed** dashboard URL. Open decision recorded for the operator:
1. Is the dashboard already deployed (channel/site URL)? If so, paste it and we set the env value.
2. If not, deploy `dashboard/` to starlabs-cicd Hosting. README suggests a 7-day **channel** (`firebase hosting:channel:deploy history --public dashboard`) — but a channel URL EXPIRES and is hashed; a permanent **site** gives a stable URL the console can hardcode. Recommend a dedicated site (e.g. a `cicd-history` hosting target) over a channel for a link the console persists.
   - Requires `dashboard/config.js` (gitignored) with the starlabs-cicd web config, and the Firestore/Storage read rules from `dashboard/README.md`.

Left untouched pending sign-off: did not invent a URL, did not deploy, did not run firebase login.
