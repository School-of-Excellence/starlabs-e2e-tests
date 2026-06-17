# SETUP — StarLabs CI/CD testing hub (start here)

> This repo (`starlabs-e2e-tests`) is the **testing HUB** and the **workspace root**. You drive the Angular,
> Cloud-Function, and Flutter targets from here. All testing uses the **`starlabs-cicd`** Firebase project,
> **intercepted by the local Firebase emulator** (hermetic — nothing hits the cloud). New dev? Do §2.

---

## 1. The 4 repos + how they relate

| Repo | Role | Wired into the hub as |
|---|---|---|
| **starlabs-e2e-tests** (this) | Playwright framework + emulator gate + dev CLI | — (the root) |
| **starlabs-angular** ("Starlabs 19") | Angular web app under test | gitignored symlink `./app` |
| **starlabs-cloud-function** | Firebase Functions (real triggers) | gitignored symlink `./starlabs-cloud-function` |
| **breakthroughs-flutter** | Flutter mobile app | symlink `../breakthroughs-flutter` (mobile bridge) |

The hub resolves the app + CF via `$APP_PATH` / `$CF_PATH` (default: the symlinks above). The emulator runs the
real CF triggers via the ATC-excluded `functions/index.emulator.js`. The app repos carry **no** emulator wiring
— it is injected at test time (`ci/setup-emulator-config.sh`).

## 2. Fast setup (a new developer, start to green, ~10 min)

Prereqs: **Node 22**, **Java 21** (Firestore/Auth emulator JRE), **firebase-tools** (`npm i -g firebase-tools`),
and for mobile: the **Flutter SDK** + **FlutterFire CLI** (`dart pub global activate flutterfire_cli`).

```bash
# a) clone the 4 repos (anywhere — siblings are fine)
# b) get the SA from the Playwright repo's GitHub secret STARLABS_CICD_SA → save it locally
# c) register your local checkouts in the TARGET REGISTRY (keyed by repo name):
cp targets.example.json targets.json     # then edit the paths to your local clones (gitignored)
export STARLABS_CICD_SA="/abs/path/to/starlabs-cicd-sa.json"   # optional (cloud path / some seeders)

# d) ONE command wires the workspace (resolves targets from the registry → symlinks + SA + emulator overlay):
./setup.sh

# e) install deps (offline: copy a known-good node_modules cache instead)
npm ci

# f) run the hermetic queue gate (boots emulator as starlabs-cicd, seeds, runs, opens HTML report):
npm run report:emulator
#   subset:        ONLY='queue/operator.spec.ts queue/studio-core.spec.ts' bash scripts/run-isolated.sh
#   reuse your own app on :4200:  npm run start:emulator (in the app) then EMU_REUSE_APP=1 bash scripts/run-isolated.sh
```

### Target registry (`targets.json`) — keyed by repo name
The hub resolves which app / cloud-function / flutter app a run uses from **`targets.json`** (copy of
`targets.example.json`, gitignored), keyed by **repo name** — the stable, unique id:
```jsonc
{
  "starlabs-angular":        { "type": "angular",        "path": "…", "port": 4200 },
  "starlabs-cloud-function": { "type": "cloud-function", "path": "…", "codebase": "default" },
  "breakthroughs-flutter":   { "type": "flutter",        "path": "…" }
}
```
- `setup.sh` resolves the sole target of each type automatically and symlinks every entry to `./targets/<repo-name>`.
- **Adding a project (a 2nd Angular app, another flutter, etc.) = one registry line** — addressed by name, no var collisions. Give each Angular app its own `port` so several can serve at once in a cross-project run.
- Inspect/resolve: `node bin/targets.cjs list` · `node bin/targets.cjs path --name <repo>` · `… path --type angular`.
- Per-run override still works: `APP_PATH=… CF_PATH=… bash scripts/run-isolated.sh` (env wins over the registry).
- **Multi-target run (future):** a suite needing e.g. `starlabs-admin` + `breakthroughs-flutter` + `coach` resolves each by name from the registry (`./targets/<name>`); one shared emulator on `starlabs-cicd` serves them all the same seeded data.

## 3. Firebase config per project (test project = `starlabs-cicd`, emulator-intercepted)

| Project | Configured for testing | Automatic? |
|---|---|---|
| **Angular** | `ci/setup-emulator-config.sh` injects `environment.emulator.ts` (projectId `starlabs-cicd`) + the `emulator` angular.json build/serve config | ✅ auto (via `setup.sh`) |
| **Cloud Functions** | `deploy-cf-emulator.sh` swaps `package.json main → index.emulator.js` for the run; CF runs *inside* the emulator (no client config) | ✅ auto |
| **Flutter** | the app must target `starlabs-cicd` (`firebase_options.dart` + `ios/Runner/GoogleService-Info.plist` + `android/app/google-services.json`). **Run once:** `cd <flutter> && flutterfire configure --project=starlabs-cicd --platforms=ios,android` | ⚠️ one-time per dev (these files are gitignored, NOT committed/secret) |

**⚠️ Critical gotcha — the Firestore emulator PARTITIONS data by project id.** The emulator, the seed, the
Angular app, the Flutter app, and the functions emulator **must all use `starlabs-cicd`**. A mismatch (e.g. the
emulator booted as `demo-slabs-queue` while the app is `starlabs-cicd`) silently breaks auth, reads, and CF
triggers. All defaults are already standardized to `starlabs-cicd`; don't override `FIREBASE_PROJECT` to a
different id.

**Safety:** the gate is the **emulator** (`FIRESTORE_EMULATOR_HOST` forces it; `seed-emulator.js` and
`advance-to-form.cjs` refuse to run without it, since `starlabs-cicd` is a real Blaze project). The prod
denylist hard-blocks `fir-sample-aae4a` et al.

## 4. Running specific suites

- Queue gate (hermetic emulator): `scripts/run-isolated.sh` — per-spec teardown+reseed of `run1`. Exit code =
  # of spec files with ≥1 failure (0 = green). `ONLY='…'` for a subset. `EVIDENCE=1` → screenshot+trace HTML report.
- Flutter (mobile): boot emulator + seed under `starlabs-cicd`, park the token (`queue/mobile/advance-to-form.cjs`),
  then `run-flutter-test.cjs` (`flutter drive` on a booted iOS sim). See §6 known-gap.
- The other ~18 `playwright.*.config.ts` are **cloud-integration** suites (seed `slabs-queue-e2e-exdcz`, serve a
  prebuilt `dist/` over the network) — not part of the hermetic local gate.

## 5. Secrets / git hygiene

- **`STARLABS_CICD_SA`** (service-account JSON) → GitHub secret; `setup.sh` materializes it to `./starlabs-cicd-sa.json` (gitignored `*-sa.json`). NEVER commit it.
- Gitignored (never commit): hub `app`, `starlabs-cloud-function`, staged `firebase.emulator.json`/rules/indexes; Angular `e2e`/`starlabs-cloud-function`; Flutter `firebase_options.dart`/plist/json.

## 6. Known reds (test-quality work, post-rollout — NOT setup bugs)

Keep the gate **advisory (report-only)**, or scope "required" to the green specs, until these are closed:
1. **3 variation-scoped specialist studio move-next tests** (`big-next-cycle`, `lyl-next-cycle`, `up-next-cycle`,
   1 each) — were "never observed green" even in golden (PLAN §2.4); a v2 `dynamic-studio-v2` move-button nuance.
2. **Flutter smoke** — wiring is PROVEN (build→launch→auth→Firestore read all work); the last gap is a seed:
   the participant profile the app loads for `participant0+run1@example.com` needs a `role_ref` (+ role doc).
3. **CI gate is still app-centric** — `starlabs-angular/.github/workflows/queue-e2e.yml` clones e2e+CF into the
   app checkout. Follow-up: invert to a reusable `web-e2e.yml` in this hub (each repo a thin caller).

## 7. For future Claude / maintainers

- Full migration-verification run report: `~/Documents/CICD/Journal/2026-06-17-goal-verify-migrated-setup.md`.
- Locked design + history: memory `cicd-platform-plan.md` (read it before changing architecture).
- Golden reference (FROZEN, read-only, never modify): `~/Documents/CICD/starlabs-cicd`.
- Queue suite status snapshot (post-fix): ~180 pass / 3 fail (the §6 variation tests) / ~7 runtime-gated skips
  across the 23 non-mobile spec files; operator/studio/BIG/CF-side-effects/self-tests + 6/9 variation walks green.
