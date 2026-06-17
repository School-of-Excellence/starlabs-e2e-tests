#!/usr/bin/env bash
#
# setup-emulator-config.sh — OVERLAY the emulator build config onto the app + stage the emulator config in the hub.
#
# Playwright-HUB-centric: the Playwright repo (starlabs-e2e-tests) is the workspace root. This script:
#   • stages firebase.emulator.json + firestore.rules + firestore.indexes.json at the HUB root
#     (deploy-cf-emulator.sh reads $HUB/firebase.emulator.json; its functions.source resolves the
#      `starlabs-cloud-function` symlink in the hub);
#   • injects the Angular-specific emulator wiring into the APP UNDER TEST ($APP_PATH): environment.emulator.ts
#     (+ base environment.ts fallback), the angular.json `emulator` build/serve config, and the
#     start:emulator / build:emulator npm scripts.
#
# $APP_PATH = the Angular app to wire (default: the gitignored `app` symlink in the hub, created by ./setup.sh).
# The app repo (development) deliberately carries NONE of this — it is injected at test time. All edits idempotent.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"   # .../starlabs-e2e-tests/ci
HUB_ROOT="$(cd "$HERE/.." >/dev/null 2>&1 && pwd)"                     # .../starlabs-e2e-tests (the hub)
OVERLAY="$HERE/overlay"
APP_PATH="${APP_PATH:-$HUB_ROOT/app}"

echo "→ emulator overlay: hub = $HUB_ROOT | app = $APP_PATH"
[ -d "$APP_PATH/src" ] || { echo "::error::APP_PATH '$APP_PATH' has no src/ — set APP_PATH or run ./setup.sh to create the app symlink"; exit 1; }
for f in firebase.emulator.json firestore.rules firestore.indexes.json environment.emulator.ts; do
  [ -f "$OVERLAY/$f" ] || { echo "::error::overlay file missing: $OVERLAY/$f"; exit 1; }
done

# 1) firebase emulator config + rules + indexes at the HUB root (deploy-cf-emulator.sh's CONFIG default;
#    firebase resolves functions.source ("starlabs-cloud-function/functions") relative to this file's dir).
cp "$OVERLAY/firebase.emulator.json"  "$HUB_ROOT/firebase.emulator.json"
cp "$OVERLAY/firestore.rules"         "$HUB_ROOT/firestore.rules"
cp "$OVERLAY/firestore.indexes.json"  "$HUB_ROOT/firestore.indexes.json"
echo "✓ firebase.emulator.json + firestore.rules + firestore.indexes.json → hub root"

# 2) emulator environment file → the app (angular.json's emulator fileReplacement swaps environment.ts for this)
mkdir -p "$APP_PATH/src/environments"
cp "$OVERLAY/environment.emulator.ts" "$APP_PATH/src/environments/environment.emulator.ts"
echo "✓ environment.emulator.ts → $APP_PATH/src/environments/"

# 2b) ensure the BASE environment.ts exists (app's src/environments/* is gitignored; a fresh checkout has neither).
#     main.ts imports './environments/environment'; the emulator build's fileReplacement swaps it, but the import
#     must still resolve. Copy if absent (does NOT clobber a real base env).
if [ ! -f "$APP_PATH/src/environments/environment.ts" ]; then
  cp "$OVERLAY/environment.emulator.ts" "$APP_PATH/src/environments/environment.ts"
  echo "✓ environment.ts created (base import fallback — replaced by environment.emulator.ts at build)"
fi

# 3) add the 'emulator' build + serve configurations to the app's angular.json (node, robust to spaces)
node -e '
  const fs = require("fs"), p = process.argv[1];
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  const arch = j.projects.atctranscription.architect;
  arch.build.configurations = arch.build.configurations || {};
  arch.build.configurations.emulator = {
    optimization: false, extractLicenses: false, sourceMap: true,
    fileReplacements: [ { replace: "src/environments/environment.ts", with: "src/environments/environment.emulator.ts" } ]
  };
  arch.serve.configurations = arch.serve.configurations || {};
  arch.serve.configurations.emulator = { buildTarget: "atctranscription:build:emulator" };
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
  console.log("✓ angular.json: emulator build + serve configurations added");
' "$APP_PATH/angular.json"

# 4) ensure the npm scripts the harness calls exist
node -e '
  const fs = require("fs"), p = process.argv[1];
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.scripts = j.scripts || {};
  j.scripts["start:emulator"] = j.scripts["start:emulator"] || "ng serve --configuration emulator";
  j.scripts["build:emulator"] = j.scripts["build:emulator"] || "ng build --configuration emulator";
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
  console.log("✓ package.json: start:emulator / build:emulator ensured");
' "$APP_PATH/package.json"

echo "✅ emulator overlay complete"
