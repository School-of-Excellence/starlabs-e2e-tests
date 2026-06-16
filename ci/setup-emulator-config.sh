#!/usr/bin/env bash
#
# setup-emulator-config.sh — OVERLAY the emulator build config onto the app at CI time.
#
# The app repo (development) deliberately carries NONE of the emulator wiring — only the workflow file.
# This script injects everything the emulator-wired build needs, sourced from this test repo, so that
# `ng serve --configuration emulator` and deploy-cf-emulator.sh work against the checked-out app.
#
# It is called by .github/workflows/queue-e2e.yml in the app repo, from the APP ROOT (the dir that
# contains src/, angular.json, and the cloned e2e/). All edits are idempotent.
#
# Overlay sources live next to this script in ci/overlay/ (i.e. e2e/ci/overlay/ once cloned).
set -euo pipefail

APP_ROOT="$(pwd)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"   # .../e2e/ci
OVERLAY="$HERE/overlay"

echo "→ emulator overlay: app root = $APP_ROOT"
for f in firebase.emulator.json firestore.rules firestore.indexes.json environment.emulator.ts; do
  [ -f "$OVERLAY/$f" ] || { echo "::error::overlay file missing: $OVERLAY/$f"; exit 1; }
done

# 1) firebase emulator config + rules + indexes at the app root
#    (deploy-cf-emulator.sh reads REPO_ROOT/firebase.emulator.json; rules + indexes are referenced from it)
cp "$OVERLAY/firebase.emulator.json"  "$APP_ROOT/firebase.emulator.json"
cp "$OVERLAY/firestore.rules"         "$APP_ROOT/firestore.rules"
cp "$OVERLAY/firestore.indexes.json"  "$APP_ROOT/firestore.indexes.json"
echo "✓ firebase.emulator.json + firestore.rules + firestore.indexes.json → app root"

# 2) emulator environment file (angular.json's emulator fileReplacement swaps environment.ts for this)
mkdir -p "$APP_ROOT/src/environments"
cp "$OVERLAY/environment.emulator.ts" "$APP_ROOT/src/environments/environment.emulator.ts"
echo "✓ environment.emulator.ts → src/environments/"

# 2b) ensure the BASE environment.ts exists. The app's src/environments/* is gitignored, so a fresh CI
#     checkout has neither file. main.ts imports './environments/environment'; the emulator build's
#     fileReplacement swaps it for environment.emulator.ts, but the import must still resolve. Copy if absent.
if [ ! -f "$APP_ROOT/src/environments/environment.ts" ]; then
  cp "$OVERLAY/environment.emulator.ts" "$APP_ROOT/src/environments/environment.ts"
  echo "✓ environment.ts created (base import fallback — replaced by environment.emulator.ts at build)"
fi

# 3) add the 'emulator' build + serve configurations to angular.json (node, not jq — robust to spaces)
node -e '
  const fs = require("fs"), p = process.argv[1];
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  const arch = j.projects.atctranscription.architect;
  arch.build.configurations = arch.build.configurations || {};
  arch.build.configurations.emulator = {
    optimization: false,
    extractLicenses: false,
    sourceMap: true,
    fileReplacements: [
      { replace: "src/environments/environment.ts", with: "src/environments/environment.emulator.ts" }
    ]
  };
  arch.serve.configurations = arch.serve.configurations || {};
  arch.serve.configurations.emulator = { buildTarget: "atctranscription:build:emulator" };
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
  console.log("✓ angular.json: emulator build + serve configurations added");
' "$APP_ROOT/angular.json"

# 4) ensure the npm scripts the workflow + harness call exist
node -e '
  const fs = require("fs"), p = process.argv[1];
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.scripts = j.scripts || {};
  j.scripts["start:emulator"] = j.scripts["start:emulator"] || "ng serve --configuration emulator";
  j.scripts["build:emulator"] = j.scripts["build:emulator"] || "ng build --configuration emulator";
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
  console.log("✓ package.json: start:emulator / build:emulator ensured");
' "$APP_ROOT/package.json"

echo "✅ emulator overlay complete"
