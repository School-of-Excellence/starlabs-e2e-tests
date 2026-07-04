# 2026-07-04 — Console router / deep-link hardening (report new-tab blank + guarded deep links)

**Status:** Implemented; production `ng build` green; deep-link renders verified in the local preview
(mock for the guard path, live/login for the base-href path). **Author:** session (operator:
appexperience@soexcellence.com). Trigger: Task 1 made the in-console report links open in a new tab
(`target=_blank`), which turned client-side navigation into HARD LOADS and exposed three latent bugs.

## Symptoms
1. New report tab opened **blank**.
2. Hard-loading `http://localhost:4200/release-channel` **redirected to `/`** (and post-sign-in too).

## Root causes (three, one shared theme: nothing survived a hard page load)

### A. Missing `<base href="/">` → nested deep-link blank (THE report-tab bug)
`index.html` had no `<base href>`. Angular's default `PathLocationStrategy` resolves lazy-chunk
imports against the document base. Without it, the base is the current path's directory:
- `/release-channel` (one segment) → base `/` → chunk at `/chunk.js` → **works**.
- `/report/7050` (**two** segments) → base `/report/` → chunk requested at `/report/chunk.js` → **404**
  → the lazy component never loads → **blank rc-root** (app bootstraps, then renders nothing).
That exact split — shallow deep-links fine, nested ones blank — is the fingerprint. Fix: add
`<base href="/" />`. Verified: hard-loading `/report/7050` went from `rootHtmlLen:0` (blank) to a
rendered page. Also protects prod (Firebase Hosting rewrites `**`→index.html; same base applies).

### B. Guards decided on not-yet-loaded auth → guarded deep-links bounced to `/`
Auth resolves ASYNC (`authState` → member fetch), but guards ran synchronously at hard load, saw
empty roles, and `createUrlTree([''])`. Fix: `AuthService.authReady` signal (+ `authReady$`), set
true once auth definitively resolves (mock immediately; live on `authState(null)` or `gate()` finally).
Guards now `authReady$.pipe(filter(Boolean), take(1), map(decide))` — a signed-in admin hard-loading
`/release-channel` waits, then passes. Verified in mock: deep link stays + renders.

### C. Shell flashed login/blank before auth resolved
Shell rendered `@if (auth.user())` else login on first paint (user null pre-resolution). Fix: a
leading `@if (!auth.authReady()) { Loading… }` branch, then `@else { @if user → app @else login }`.
(Angular note: `as` is only allowed on a PRIMARY `@if` — nest the user check, don't use `@else if
(auth.user(); as u)`; that was a compile error caught only by `ng build`, NOT `tsc`.)

### Deep-link-through-sign-in (operator-locked scope)
When an UNauthenticated visitor is turned away, the guard stashes `?returnUrl=<state.url>`. AppComponent
has an `effect` that, once `auth.user()` becomes set, reads `returnUrl` and `navigateByUrl`s to it —
so signing in from a deep link lands you back on the target (guard re-runs with roles loaded).

## Files
- `console/src/index.html` — `<base href="/">`.
- `console/src/app/core/auth.service.ts` — `authReady` signal + `authReady$`; set at mock / signed-out
  / gate-finally.
- `console/src/app/app.routes.ts` — `roleGuard()` factory: async, waits `authReady$`, returnUrl on
  signed-out reject.
- `console/src/app/app.component.{ts,html}` — Router inject + returnUrl `effect`; authReady loading branch.

## Gotchas for future sessions
- `tsc --noEmit` does NOT validate Angular templates. For any `.html` change run `ng build` (or serve)
  — the `@else if (... ; as u)` error and template typos only surface there.
- Mock mode auto-authorizes synchronously, so it does NOT exercise the async-auth race (bug B/C). It
  DOES exercise the guard rewrite wiring and the base-href fix. Real async behavior needs live auth.
- The local preview harness was flaky on full-page (`location.href`) navigations to deep routes —
  chrome-error frames + duplicate contexts; retries + a server restart were needed to get clean reads.

## Not done
- Task 2 from the prior turn (report shows 0 passed/0 failed — missing JSON reporter) remains open by
  request; diagnosis in `specs/journals/2026-07-03-cf-board-expand-and-diff-fixes.md`'s sibling thread.
