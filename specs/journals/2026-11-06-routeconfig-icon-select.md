# 2026-11-06 — Route Configuration icon dropdowns (authroles RCI-01..04)

**App change:** starlabs-angular `68331c52` (pushed on charan-release), `IconOptionsPipe` in
`src/app/route-configuration-duplicate/createroutedialog/option-pipes.ts`. The app's WHY is in its
journal `specs/journals/2026-10-15-routeconfig-dialog-perf.md` (2026-11-06 follow-up).

## What broke
The pipe rendered zero `mat-option`s while the select was closed when the route had no icon or an icon
outside `iconList`. `MatSelect._canOpen()` needs `options.length > 0`, so the panel never opened and the
full icon list never loaded.

## Why the seed looks like this
- **Driven through Edit, not Create.** Create Route and Add Sub Component are `*ngIf` on the `developer`
  role, which no authroles actor has. Adding a developer actor would change the AR nav matrix (the
  `NAV developer` child is asserted DENIED for both actors). Editing a route with icon `''` puts the
  component in the same state as Create Route, so four dashboard docs cover it instead.
- **One doc per state + a control.** `none` (''), `unknown` (not in iconList), `known` ('home') and a
  parent with a no-icon child. `known` passes on both builds. It is there so a green RCI-01/03/04 can't
  be explained by "every select opens anyway", and it catches a duplicate 'home' from the prepend logic.
- **Invisible to the neighbours.** Every doc is `showInSidenav:false` with empty roles/profileid, and so
  is the child, so `filterNavItems()` keeps nothing new and the AR-05/06/07 assertions don't move. Routes
  are run-namespaced paths nothing navigates to.
- No new collection (`dashboard` is already in `SEEDED`), and no new hooks (24/24 aligned by hook-diff).

## Executed
On a local emulator lane (Firestore 8085, Auth 9099, app on :4201 with the emulator config):
- Fixed build, full suite: 30 passed, 2 skipped (AR-14/15: CF not deployed), 1 failed: **AR-13** timed
  out at 120 s with the page correctly on /login. Re-run alone it passes, so it's an order-dependent
  flake in login-gate, unrelated to this change.
- Pre-fix pipe swapped back temporarily: RCI-01/03/04 **fail** (panel never opens; unknown-icon trigger
  blank) and RCI-02 passes. The spec catches the regression.

## Pending
- AR-13 flake: login-gate.spec.ts took 8.2 min in the full run. Worth a look on its own.
