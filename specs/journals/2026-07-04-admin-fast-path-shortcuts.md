# 2026-07-04 — Admin fast-path shortcuts (self-sign-off + PR, one click)

**Status:** Implemented; production `ng build` green. **Author:** session (operator:
appexperience@soexcellence.com). **Scope was locked with the operator before coding** (plan →
validate → lock → execute); the questions below were answered explicitly.

## Motivation
The admin, when driving a change end-to-end, had to hop developer → tester → admin steps across
screens (deploy → wait for tester dev sign-off → PR to dev; then wait for tester "OK to promote"
before the prod PR). Two one-click shortcuts collapse those waits.

## Why it's non-breaking (the load-bearing insight)
The **admin role already holds every capability** (`roles.ts`): DEPLOY_PREVIEW, SIGNOFF_PREVIEW_DEV,
SIGNOFF_DEV_PROD, CREATE_PR_DEV, CREATE_PR_PROD. The `signoff` callable only checks the capability and
records the gate bound to the current head — **no preview-live / status precondition**. So each
shortcut is just the admin doing a **self-sign-off + PR** by CHAINING EXISTING CALLABLES. No backend,
roles, capability, `action-gating`, or model changes. Existing developer/tester buttons and flows are
untouched. Every self-sign-off is written to the activity log → fully auditable, not a silent bypass.

## Shortcut 1 — "Deploy & create PR → Dev" (Working Branches, Deploy ▾ menu, admin-only)
`fb.deployAndPrToDev(rc, opts)` chains, in this ORDER: `signoffDev(OK)` → `createPrToDev` →
`deployPreview(opts)`. Order is deliberate: sign-off + PR FIRST so the build's `PREVIEW_BUILDING`
status can't race the PR's backend `OK_FOR_DEV` precondition.

**Two menu variants (operator, 2026-07-04):** the shortcut is split so it's never stuck on the
"no suite forced" case (the with-tests picker requires ≥1 suite):
- **"Deploy (with tests) & create PR → Dev"** — confirm → suite picker → `deployAndPrToDev(rc,
  {runTests:true, ...choice})`.
- **"Deploy (without tests) & create PR → Dev"** — confirm only, NO picker →
  `deployAndPrToDev(rc, {runTests:false})`.
The shared test-run dialog was deliberately NOT changed (keeps its ≥1-suite guard for every other
caller); the without-tests variant sidesteps it. Tests, when run, do NOT block the PR.

## Shortcut 2 — "Promote & Create PR → prod" (Release Channel, admin-only)
`fb.promoteAndPrToProd(devRc)` chains `signoffProd(OK)` → `createPrToProd`. The button REPLACES the
disabled "Create PR → prod" exactly when the only blocker is the tester's validation —
`canPromoteAndPr` = admin && hasUnreleased && prProd!=OPEN && lastDeploymentState==='success' &&
!promotable. When the tester HAS validated (`promotable`), the existing "Create PR → prod" shows
unchanged; when the dev deploy is still running, the existing disabled button + tooltip shows.

## Locked decisions (operator, this session)
- Deploy shortcut runs the build WITH tests; PR opens immediately (tests don't block). 
- ONE confirmation dialog before either shortcut fires.
- **Stop-on-error frontend chain** (no atomic backend callable): if a step fails we halt + toast and
  leave completed steps in place — always a valid state the existing buttons can finish. Failure map:
  - Deploy shortcut: signoff fail → nothing changed; PR fail → `OK_FOR_DEV`, finish via "Create PR →
    Dev"; deploy fail → PR already open, retry via Deploy menu.
  - Promote shortcut: signoff fail → nothing changed; PR fail → `promotable`, finish via "Create PR →
    prod".

## Files (frontend only, 5)
- `core/firebase.service.ts` — `promoteAndPrToProd`, `deployAndPrToDev` (chain existing callables).
- `screens/working-branches/working-branches.component.{ts,html,css}` — `isAdmin()`, `deployAndPr()`,
  admin menu item, `.menu button.shortcut` accent.
- `screens/release-channel/release-channel.component.{ts,html,css}` — `canPromoteAndPr()`,
  `promoteAndPr()`, conditional button, `button.primary.shortcut` (warn tone).

## Gotcha for future sessions
`canPromoteAndPr` returns `!!(…)` — the `&&` chain over optional model fields (`hasUnreleased`,
`promotable`) is `boolean | undefined`; strict templates reject that for a `: boolean` method. Coerce.

## Ship
Hosting-only: `cd console && npm run build && firebase deploy --only hosting --project starlabs-cicd`.
No functions deploy. Verify with an admin account on a branch awaiting the two respective steps.
