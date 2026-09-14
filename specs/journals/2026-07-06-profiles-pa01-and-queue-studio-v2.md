# 2026-07-06 — Root-cause + fix: profiles PA-01 and queue's 4 red specs (manual-run informational reds)

**Context.** Gates are manual-only on development + production (PR #58; see memory `gates-manual-only-2026-07-06`).
Last manual runs vs development: 10 systems GREEN; 2 informational reds — **profiles** (1 residual: PA-01) and
**queue** (4 failing spec files, unrooted). Goal: root-cause + fix both so a manual re-run goes green.
Reports read via the Release Console viewer (`/report/<id>`): profiles run #10 = `28776106418`,
queue run #9 = `28748558212` (meena-development, sha 00387bb).

Both reds turned out to be **Layer-2 test issues from cicd→development app divergence** — NOT app/CF bugs and NOT
seed gaps. The app renders correctly on both branches; the specs were written against the `cicd` (local) DOM/route
and broke on the `development` (CI) app. Same family as PA-09 (`pa09-app-branch-divergence`) and EVT-15/16
(`evt15-16-app-branch-divergence`).

---

## profiles PA-01 — selector strict-mode violation (V shell divergence)

**Symptom.** `PA-01 userprofile renders name & email…` fails CI-only (~13s). PA-02/03/10 (same screen) pass.

**Report error (the ground truth):**
```
expect(locator).toHaveText failed
Locator: locator('.profile-name')  → strict mode violation: resolved to 2 elements:
  1) <span class="profile-name">admin+prof@example.com</span>   (app shell toolbar)
  2) <h3 class="profile-name">Profile Test User Zero prof</h3>  (the userprofile heading — CORRECT)
```

**Root cause.** The app rendered the participant name correctly in `<h3 class="profile-name">`. But on
`development`, `app.component.html:32` (the shared shell toolbar — the mahalakshmi **profile-picture integration**,
same commit family as PA-09) now renders the signed-in user's name in a *second* `<span class="profile-name">`.
The admin's `profile_data.name` is seeded as their email, so the toolbar shows `admin+prof@example.com`. Two
`.profile-name` on every screen → `toHaveText('.profile-name')` trips Playwright strict mode. On `cicd` the toolbar
shows that name only in a `matTooltip` (no `.profile-name` element) → one match → green locally. PA-03 only checks
`.profile-name` *visible* (races the async toolbar span) so it slipped through; PA-01 asserts text so it always fails.

**Fix (test-side, hub).** Scope the selector to the unique heading `h3.profile-name` (only
`userprofile.component.html:8` uses it, on BOTH branches). Keeps coverage live on cicd + development. Same
"broaden/scope, don't skip" philosophy as PA-09. → commit `a0929d7`.

---

## queue — 4 failing spec files

### 1) mobile/mobile-walk.spec.ts — Flutter, wrong harness (0s fail)
Drives a **real Flutter app** (`flutter drive walk_test.dart` + `ensureSimBuildPrereqs()` boots an iOS sim in
`beforeAll`). It cannot run in the headless Chromium web-e2e CI — `beforeAll` throws at 0s and the whole file errors
(the other 8 cases show ⊘). It was collected only because the queue emulator config's `testMatch '**/*.spec.ts'` has
no `testIgnore`. **Fix:** `testIgnore: '**/mobile/**'` in `playwright.queue.emulator.config.ts` (the evidence config
inherits it). Flutter coverage belongs to `flutter-suite/`.

### 2-4) up/lyl/big-next-cycle — studio V1→V2 swap (all fail identically at `load()`)
**Report error (identical for all three):**
```
expect(locator).toBeVisible failed
Locator: [data-testid="studio-arena-title"].or([data-testid="studio-no-studio-alert"]).first()
Timeout: 30000ms — element(s) not found
```
Failure screenshot: the app is in V2's **live "Directive-based Assignment" arena** (logged-in specialist), NOT the
lobby. (A stray "You need to log in…" auth-guard toast appears in the shot but is a red herring — studio-core (9✔)
and studio-session (11✔) navigate `/dynamicstudio` fine in the *same* run, so the guard admits it.)

**Root cause (EVT-15/16 class — whole component swapped by branch).**
- `cicd` (served locally, green): `/dynamicstudio` → `DynamicStudioComponent` (v1). `studio-arena-title` is on an
  `<h5>My Arena` that **always** renders when the component mounts.
- `development` (CI, red): `app.routes.ts:104` routes `/dynamicstudio` → **`DynamicStudioV2Component`**; the v1 route
  is commented out (`app.routes.ts:565`). In V2, `studio-arena-title` lives **only inside the lobby container**
  (`*ngIf="liveAssignment == null && !selectedStudio['docid']"`, html:4-6). V2 **auto-enters** the live panel for a
  member who already has an active live session (studio-session's `selectStudioWithLivePanel` documents this). The 3
  walk specs seed the specialist's live assignment **before** `StudioPage.load()`, so V2 boots straight into the live
  arena (`liveAssignment != null`, html:268) → the lobby title never mounts → `load()`'s 30s wait times out **before**
  the walk ever reaches its real work.

**Why studio-core/studio-session already pass on V2:** their acting member is not auto-entered at `load()` time (lobby
renders), and they use `selectStudioWithLivePanel` (which tolerates both the v1 picker and V2's auto-enter).
**The tell:** lyl/big-next-cycle *already* migrated their select calls to `selectStudioWithLivePanel` — but the shared
`load()` was missed, so they still died on `arena-title`. A prior V2 migration was left incomplete.

**Fix (test-side, hub).**
- Broaden `StudioPage.load()` to accept the V2 live-arena as a valid "mounted" state:
  `arenaTitle.or(noStudioAlert).or(liveParticipantName)`. Keeps v1/lobby coverage; adds V2 auto-enter tolerance.
  `liveParticipantName` = `[data-testid="studio-live-participant-name"]` which V2's live arena renders (html:284) — the
  exact element the walks ultimately assert.
- Migrate `up-next-cycle`'s remaining bare `selectStudio({studioId})` → `selectStudioWithLivePanel(SE_PAIRING_ID)`
  (lyl/big already did). → commit `5e5ef4b`.

---

## What surprised us / notes for the next session
- The console Report viewer for run #9 renders per-spec **error text + failure screenshots** (Storage CORS fix holds).
  To read them: open `/report/<id>`, click the suite tab, click a failing case; error is a `<pre>`, screenshot is
  `img[alt="failure screenshot"]` (signed Storage URL — navigate the tab to `img.src` to view full-size).
- The queue report's summary counts are **per selected tab** — click the tab first, then read.
- Not yet verified end-to-end: the console re-run pulls specs from **hub `@main`** (`web-e2e.yml@main`), so these
  fixes must be **merged to hub main first**, THEN re-run profiles + queue from the console. Could not verify locally
  (dev V2 app + emulator; queue is ~48 min) and could not push (Windows credential GUI hang — operator pushes).
- Residual risk: BIGNC-04 ("specialist close") is genuinely about the V2 studio close flow; it never got past `load()`
  so anything downstream is unproven. It uses the studio-session `linkTokenIntoLiveSession` pattern (which passes on
  V2), so confidence is moderate. If it re-fails after merge, the next break will be in the V2 close/moveNext path.

## Handoff — to land these
1. Operator: push branch `fix/profiles-pa01-and-queue-studio-v2` (2 commits) and open a hub PR → merge to `main`.
2. From the Release Console → development card → "Run tests" → **profiles** and **queue**.
3. Expect: profiles 0 red (PA-01 green); queue drops mobile-walk from collection and the 3 studio walks green.
   Re-confirm BIGNC-04 specifically.
