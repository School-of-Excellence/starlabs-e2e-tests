# Interactive-Control Coverage Program — plan & contract (2026-09-14)

Goal: every **interactive control** in the app is (1) addressable via `data-testid` and (2) referenced by
a hub e2e spec, so the console readiness gate reports `MATCHED` for any branch that touches it. Unit-test
backfill for pure logic follows per system (separate track). ATC / ATC-Ops stay fenced (policy).

Backlog measured 2026-09-14 (merged `meena-development`): **7,390** unhooked interactive controls across
**420** actionable components (21 ATC components / 220 controls fenced, excluded). Full per-component list:
`interactive-inventory.csv` (regenerate: `node <scratch>/interactive-inventory.cjs`).

## What "covered" means (the gate's own rule — do not reinterpret)
The readiness checker (`scripts/readiness/lib.cjs`) enforces two things on **changed** components:
- `newUnhooked` — an **interactive control** with no `data-testid`. Interactive = tag `<button>`/`<a>`,
  OR any tag carrying `(click)` / `(change)` / `(submit)` / `routerLink`. Nothing else counts (plain
  divs, static inputs, text are ignored).
- element is "tested" only if some **hub e2e spec** references its `data-testid` (`allSpecHookRefs` scans
  the hub spec dirs). **App-repo Karma unit tests do NOT satisfy this** — `**/*.spec.ts` is manifest-neutral.

So: interactive control ⇒ needs `data-testid` + a hub e2e spec reference. Logic ⇒ unit test (separate track).

## Coverage depth (decided): ADDRESSABLE + SMOKE
Per control: a `data-testid` + a **screen-level** spec that loads the route and asserts the control is
present/enabled (and, for a handful of high-risk controls per screen — moves, deletes, approvals,
rollout/money — drives the real action + asserts the CF/app side-effect). One screen spec references MANY
controls, so 7,390 controls ≈ **~420 component/screen specs**, NOT 7,390 tests.

## `data-testid` naming convention (MANDATORY — keeps 15 parallel sessions from colliding)
`<component-prefix>-<area>-<control>` — kebab-case, globally unique, stable.
- `component-prefix`: a short slug per component (existing example: `qm` = dynamic-queue-manager). Pick a
  2–5 char prefix per component and record it at the top of the component's spec.
- Examples already in the tree: `qm-comms-send`, `qm-filters-clearall`, `qm-queue-select`, `qm-tag-option`.
- Bindings: static `data-testid="qm-foo"`; for `*ngFor` rows use `[attr.data-testid]="'qm-row-' + item.id"`
  and the spec targets by prefix + a known seeded id.
- NEVER rename an existing hook — specs and drift-checks key on it.

## Screen-spec skeleton (addressable + smoke)
```ts
// <system>/<screen>.spec.ts — ADDRESSABLE+SMOKE for <route>. Prefix: <pfx>.
import { test, expect } from '@playwright/test';
import { loginAs } from '../_support/auth';           // reuse existing auth helpers
test.describe('<Screen> — controls addressable', () => {
  test('renders and every interactive control is present', async ({ page }) => {
    await loginAs(page, /* role the route needs */);
    await page.goto('<route>', { waitUntil: 'domcontentloaded' });
    for (const id of ['<pfx>-a', '<pfx>-b', /* …every control's testid… */]) {
      await expect(page.getByTestId(id)).toBeVisible();   // addressable
    }
  });
  // + a small number of high-risk BEHAVIORAL cases per screen (drive action → assert CF/app effect).
});
```

## Manifest wiring (so the gate credits the new specs)
For each system, ensure `suites-manifest.json` has a suite whose `appPaths` glob covers the component
folder(s) and whose `specDir` holds the new specs. If a system has no suite yet (e.g. Product Designer,
OpenVidu, slackwebhookurls), add one (`ciReady:false` until the emulator config exists, then flip). Edit
the manifest in the HUB via PR — never in Firestore. Regenerate docs: `node scripts/gen-suites-doc.mjs`
and unit routing: `node scripts/gen-unit-routing.mjs`.

## Waves (parallel authoring; validate via CI, not the shared local emulator)
Authoring is parallel-safe (each system = disjoint folders). VALIDATION must NOT fan out on one local
emulator (it degrades under contention) — validate each system's suite in CI via `web-e2e.yml` (its own
runner) or serialize locally.

| Wave | Systems | ~comps | ~controls |
|---|---|--:|--:|
| **0** | interim-report-dashboard + interim-report-log + communication-grid-planner (the current blocker) | 4 | ~99 |
| **A** | New-Workshop (1052), Journey Onboarding (895), queue system (828), Events (823), big (695) | ~172 | ~4,300 |
| **B** | Participants Profile Mgmt (659), AppEngagement (535), content (395), Communication Center (250), Customer Support (247) | ~135 | ~2,100 |
| **C** | EvolutionMapping, Product Designer, Scheduling, Channel Communication, Workshop, Diagnostics Tool, Business Dashboard, OpenVidu, + ~25 small dirs | ~113 | ~1,000 |

Fenced (excluded, do NOT touch): ATC, ATC-Ops, atc-generated-from-queue-stage (21 comps / 220 controls).

## Per-system subagent work packet (what each session does)
1. From `interactive-inventory.csv`, take this system's components (unhooked > 0).
2. Add `data-testid` to every interactive control (convention above); no logic/markup changes beyond the attr.
3. Write screen-level addressable+smoke spec(s) referencing every hook; add high-risk behavioral cases.
4. Extend `suites-manifest.json` appPaths/specDir to cover the folders + specs.
5. Validate the system's suite in CI (or locally, serialized) → green.
6. Report: components touched, controls hooked, specs added, CI run link.
Deliverables land as: app-repo hook edits (on `meena-development`) + hub specs/manifest (on hub `main`).

## Validation & merge
As each system goes green through the console gate / CI, merge that system's app hooks + hub specs into
`development` independently (no big-bang). Each merge is already gate-verified — no bypass.

## Unit backfill (after e2e, per system)
Separate track, after a system's e2e control coverage lands: convert that system's stub `*.unit.spec.ts`
to real tests for its services/pipes/guards/computations (the audit's 410-stub backlog). Routed by
`.github/unit-routing.json` (regenerated from the manifest). NOTE: unit tests are NOT auto-dispatched today
— wiring `unit-tests.yml` into the console's `maybeDispatchSuites` is a prerequisite for them to gate.

## Sequence
Phase 0 (this doc + Wave 0 new features, worked example) → Wave A → B → C, each: author → CI-validate →
merge to development. Unit backfill trails each system.
