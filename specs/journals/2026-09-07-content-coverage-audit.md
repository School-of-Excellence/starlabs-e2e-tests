# 2026-09-07 — content suite: route-coverage audit vs the "StarLabs E2E Coverage Map" artifact

Type: findings / verification (no spec changes in this session)

## What this covers

Same methodology as the 2026-09-03 events, 2026-09-04 modes and 2026-09-04 workshops audits, applied to
the `content` suite: parse the LIVE `app.routes.ts` (comments stripped, `children:` nesting resolved)
into (full-path → component-import) pairs, keep the ones resolving under the suite's manifest globs
(`src/app/content/**`, `src/app/content-upload-version2/**`, `src/app/video-player/**`), then intersect
against what a spec in `content/` actually **navigates to** (`page.goto`), and whether that navigation
is inside a test that runs.

Sources (all `[GROUND]`, deterministic):
- app: `organization-starlabs-angular/starlabs-angular` @ `manoja-development` (06e435c3, 31 Aug 2026)
- app (artifact's branch): `origin/meena-development` (1016be08, 27 Jul 2026)
- hub: `starlabs-e2e-tests` @ `manoja` (b5531f0, 4 Sep 2026)
- suite files: `content/dashboards.spec.ts`, `content/deep.spec.ts`, `content/mutations.spec.ts`,
  `content/seed-content.js` (config `playwright.content.config.ts` → `testDir: './content'`;
  the root `content.spec.ts` is legacy, skip-guarded, and NOT in the suite)

## Verdict on the artifact's `content` row — **16 / 28, 10 "never opened"**

The row does not survive verification. Four independent problems:

1. **It is arithmetically inconsistent.** 16 opened + 10 never-opened = 26, not 28. Every other suite
   row in the artifact adds up (queue 12+20=32, journey 3+10=13, workshops 26+7=33 …); `content` is the
   only one that does not. The 28 could not be reproduced from either branch (live content-glob paths:
   34 on `meena-development`, 36 on `manoja-development`; top-level only: 21 / 23).
2. **Two "never opened" claims are false.** `/add-playlist` and `/addseries` are nested routes
   (`/playlistdashboard/add-playlist`, `/seriesdashboard/addseries`) and the specs open them with the
   full path. A leaf-segment string match missed them.
3. **One "opened" claim is a grant, not a navigation.** `/contentupload` appears only in the
   `{ route, label }` dashboard-grant array at `content/seed-content.js:92`. No spec navigates to it.
   Same counting flaw already recorded for workshops on 2026-09-04.
4. **It does not distinguish tests that run from tests that don't.** Four of the "deep" cases are
   `test.fixme` — CN-04 (`deep.spec.ts:61`), CN-11 (`:182`), CN-12 (`:231`), CN-14 (`:297`). They never
   execute. `/seriesdashboard/addseries` is opened *only* by CN-04, so at runtime nobody opens it.

Also unchanged from the earlier audits: `scripts/check-route-coverage.mjs` and
`scripts/check-suite-coverage.mjs` still do not exist in `scripts/`; the map is not re-runnable.

## Ground-truth coverage — `manoja-development`, 23 top-level content routes

### Opened by a running test — 12

| Route | Depth | Cases |
|---|---|---|
| `/audiodashboard` | functional (row count vs admin count) | CN-01, CN-02, smoke |
| `/seriesdashboard` | functional (tier filter) | CN-05, smoke |
| `/content-analytics-dashboard` | functional (app-computed bucket) | CN-08, smoke |
| `/healthstories` | functional (render + edit write) | CN-13a, CN-13b, smoke |
| `/category-dashboard` | functional (add write, saveOrder swap) | CN-09, CN-10, smoke |
| `/playlistdashboard/add-playlist` | functional (create write) | CN-03 |
| `/viewparticipantstieraccess` | functional (tier bucketing) | CN-17 |
| `/playlistdashboard` | **mount smoke only** (no `/login` bounce) | smoke |
| `/videodashboard` | **mount smoke only** | smoke |
| `/playlistads` | **mount smoke only** (CN-14 is fixme) | smoke |
| `/tieraccessconfig` | **mount smoke only** (CN-11 is fixme) | smoke |
| `/learningmaterial` | **mount smoke only** (CN-12 is fixme) | smoke |

"smoke" = `dashboards.spec.ts:161` "every seeded content route mounts", which asserts only that the URL
does not end up on `/login`. 7 routes have a functional assertion; 5 are mount-only.

### Opened only by a `test.fixme` (never runs) — 1

| Route | Case |
|---|---|
| `/seriesdashboard/addseries` | CN-04 (`deep.spec.ts:61`) |

### Never opened by any spec in the repo — 10

| Route | Component | Note |
|---|---|---|
| `/content-upload-v2` | `content-upload-version2` | the v2 shell itself |
| `/videodashboard/upload` | `episodes-dashboard/upload-studio` | **new on `manoja-development`** (absent from `meena-development`), has `canDeactivate: pendingUploadsGuard` — no test anywhere |
| `/playlistdashboard/edit-playlist` | `playlist-dashboard/edit` | |
| `/seriesdashboard/editseries` | `series-dashboard/edit-series` | |
| `/assigncategory` | `series-dashboard/categoryassign` | |
| `/ads` | `click-ads` | |
| `/contentanalytics` | `content-analytics` | not the same screen as `/content-analytics-dashboard` |
| `/accessscreen` | `access-screen` | |
| `/contentupload` | `content-upload` | seed **grant only** (`seed-content.js:92`) — the artifact counted this as opened |
| `/createarenavideoasktemplate` | `arena-video-ask-input` | |

None of the 23 is on `_support/excluded-routes.ts`; there is no out-of-scope deduction for this suite.
`src/app/video-player/**` is in the manifest glob but has no route — nothing to count.

### The `content-upload-v2` shell aliases — 13 more paths, all never opened

`app.routes.ts:41-101` declares a second copy of the content screens as `children` of
`/content-upload-v2` (rendered through that component's `<router-outlet>`):
`/content-upload-v2/{audiodashboard, videodashboard, videodashboard/upload, ads, healthstories,
contentupload, learningmaterial, category-dashboard, seriesdashboard, viewparticipantstieraccess,
playlistdashboard, playlistdashboard/edit-playlist, playlistdashboard/add-playlist}`.

Note the two trees are **not** pure aliases: `/playlistdashboard/edit-playlist` loads
`playlist-dashboard/edit`, while `/content-upload-v2/playlistdashboard/edit-playlist` loads
`playlist-dashboard/playlist-configuration` (a different component). Same for `add-playlist`
(`solar-playlist` vs `playlist-configuration`). So the v2 tree carries at least one component
(`playlist-configuration`) that is reachable **only** through the shell and is untested.

## The numbers, stated with their denominators

| Denominator | Opened by a running test | % |
|---|---|---|
| 23 top-level content routes | 12 | 52% |
| 23, counting the fixme'd `/seriesdashboard/addseries` | 13 | 57% |
| 36 all content-glob paths (incl. 13 shell children) | 12 | 33% |
| 23, functional assertions only (mount smokes excluded) | 7 | 30% |

The artifact's 57% is closest to the second row — but it reaches it by a different (wrong) path:
counting a grant, missing two nested routes, and not noticing the fixmes.

## Branch drift, `meena-development` (27 Jul) → `manoja-development` (31 Aug)

- added: `/videodashboard/upload` and `/content-upload-v2/videodashboard/upload` (upload studio)
- removed from the v2 shell: `/content-upload-v2/assigncategory`
- top-level `/assigncategory` unchanged

## What was wrong (corrections to prior beliefs)

- Memory note said hub branch is `main`; the checkout is on `manoja` (b5531f0). Updated.
- The artifact's `content` row was assumed inflated in the same way as workshops (grants). It is —
  but the bigger error for this suite is the fixme cases and the nested-path miss, not the grant.

## Open questions

- Should the `content-upload-v2` shell tree be in scope for the suite? If yes, the `playlist-configuration`
  component (shell-only) needs a case; if no, record the exclusion in the manifest so the readiness
  check stops reporting it.
- Why are CN-04 / CN-11 / CN-12 / CN-14 fixme? No reason is recorded at the call sites. Each one
  is the only functional case for its route.
- `/videodashboard/upload` carries a `canDeactivate` guard (`pendingUploadsGuard`) that nothing tests.

## Artifacts

- `scratchpad/routes3.mjs` (session temp) — the string-aware, nesting-aware route parser used above.
  Worth promoting into `scripts/check-route-coverage.mjs` so the map becomes re-runnable; not done here.
