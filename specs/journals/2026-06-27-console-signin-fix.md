# 2026-06-27 — Console Google sign-in fails ("Sign-in was cancelled")

## Symptom (reported)
On `localhost:4200` (and the deployed console), clicking **Sign in with Google**,
selecting the `@soexcellence.com` account, the page returns and the user is **still on
the login gate** — not signed in. User sees **"Sign-in was cancelled"** even though they
did not cancel.

## Reproduction (verified in a real browser via Chrome MCP, signed in as vignesh.s@soexcellence.com)
Added step-by-step `[auth]` instrumentation to `auth.service.ts`, then drove the flow:

1. Popup opens Google chooser → select account → Google redirects the popup to
   `https://starlabs-cicd.firebaseapp.com/__/auth/handler?...&code=...`. **The OAuth itself
   succeeds** (Google issues a valid auth code).
2. The popup then closes **without delivering the credential back to the app window**, and
   Firebase throws `auth/popup-closed-by-user`. `authState` stays `null` → stuck on the gate.
3. Switched to `signInWithRedirect` to test: the full-page redirect to Google and back to
   `localhost` works, but `getRedirectResult()` **never resolves a user** (hangs / returns
   null). authState stays null.

Both popup and redirect fail for the **same** reason.

## Root cause
The OAuth handler lives on `authDomain = starlabs-cicd.firebaseapp.com`, which is a
**different origin** than the app:
- dev: `http://localhost:4200`
- prod: `https://cicdconsole.web.app` (hosting site `cicdconsole`)

Modern browsers (Chrome 115+ third-party-cookie phase-out / storage partitioning, Safari ITP)
**isolate third-party storage**, so the cross-origin `firebaseapp.com` handler cannot relay
the credential back to the app window. Popup → `popup-closed-by-user`; redirect →
`getRedirectResult` can't read the relayed result. This is environmental, not a logic bug —
the 3-check login gate (`gate()`) is never even reached.

## The fix — make the OAuth handler SAME-ORIGIN as the app
Set `authDomain` to the app's own Firebase Hosting domain so `/__/auth/handler` is served
first-party. Firebase Hosting serves the handler on every hosting site (verified:
`https://cicdconsole.web.app/__/auth/handler` → HTTP 200).

`console/src/environments/firebase.config.ts`:
```
authDomain: 'cicdconsole.web.app'   // was 'starlabs-cicd.firebaseapp.com'
```

### ⚠ REQUIRED OPERATOR STEP (cannot be automated — needs Firebase Console)
`cicdconsole.web.app` is a **secondary** hosting site, so it is **not** auto-registered as an
OAuth redirect URI. Verified: with `authDomain = cicdconsole.web.app`, Google returns
**`redirect_uri_mismatch`** for `https://cicdconsole.web.app/__/auth/handler`.

To activate the fix, an operator must:
> Firebase Console → project **starlabs-cicd** → Authentication → Settings →
> **Authorized domains** → Add `cicdconsole.web.app`.

That auto-registers `https://cicdconsole.web.app/__/auth/handler` in the managed OAuth client.
Until this is done, sign-in shows Google's `redirect_uri_mismatch` page. (To roll back, revert
`authDomain` to `starlabs-cicd.firebaseapp.com` — but that returns to the broken
cross-origin behavior above.)

After the domain is authorized:
- **Production** (`cicdconsole.web.app`): app and handler are same-origin → popup works. ✅
- **Localhost**: still cross-origin (`localhost` ≠ `cicdconsole.web.app`), so it still needs
  third-party storage. See below.

## Localhost dev
There is **no** `authDomain` value that makes `localhost` same-origin with a `*.web.app`
handler, so localhost auth is inherently cross-origin. To develop locally, either:
1. **Allow third-party cookies for `localhost`** in the browser (Chrome → Site settings →
   Third-party cookies → allow), then popup/redirect complete; or
2. Use the **Firebase Auth emulator** for local sign-in (needs Firestore emulator + seeded
   `CICD-Users` doc, since the gate reads Firestore); or
3. Test auth against the deployed console.

## Code changes (this session)
- `auth.service.ts`: popup-first, with redirect fallback now also triggered on
  `auth/popup-closed-by-user` (previously only `popup-blocked`/`cancelled`). Added `[auth]`
  step logging (init / getRedirectResult / authState / each gate check / sign-in branch) —
  this class of bug is invisible without it. Corrected the stale comment claiming "popup is
  reliable on localhost / redirect breaks with 3p cookies" — both break cross-origin.
- `firebase.config.ts`: `authDomain` → `cicdconsole.web.app` (staged; needs operator step).

## Outcome — RESOLVED (confirmed working on localhost AND production)
Two changes, one per environment:
- **Production**: `environment.ts` now sets `authDomain` per host → deployed console
  (`cicdconsole.web.app`) uses a SAME-ORIGIN handler. Operator added `cicdconsole.web.app`
  to Firebase Auth → Authorized domains (clears the `redirect_uri_mismatch`). Same-origin →
  no third-party storage → sign-in completes.
- **Localhost**: `auth.service.ts` now falls back to `signInWithRedirect` on
  `auth/popup-closed-by-user` (previously only on `popup-blocked`/`cancelled`). The popup
  completes OAuth but can't post the credential back cross-origin; the redirect retry keeps
  every hop top-level/first-party and completes. localhost keeps the authorized
  `starlabs-cicd.firebaseapp.com` authDomain (can't be same-origin with a *.web.app domain).

Net: the 3-check gate / Firestore / member logic was never at fault — it was purely the
cross-origin OAuth handshake.

## Follow-ups (optional)
- [ ] Document the per-host authDomain + the required Authorized-domains step in CLAUDE.md.
- [ ] Consider trimming the verbose `[auth]` step logs (kept for now — cheap, and invaluable
      for this class of bug).
