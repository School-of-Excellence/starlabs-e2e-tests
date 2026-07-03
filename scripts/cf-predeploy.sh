#!/usr/bin/env bash
#
# cf-predeploy.sh — the CF PREDEPLOY quality gate (plan L13/L14, locked 2026-07-02).
#
# Called by the CF repo's firebase.json predeploy hook (via scripts/cicd/predeploy.js there) on EVERY
# `firebase deploy` — manual laptop deploys included. Boots a FRESH local emulator with the deploying
# repo's triggers and runs the Playwright loop-guard (cf-guards/no-retrigger-loop.spec.ts).
# Non-zero exit ⇒ the Firebase CLI ABORTS the deploy. `--force` cannot skip predeploy hooks.
#
#   CF_DIR=/abs/path/to/cf-repo bash scripts/cf-predeploy.sh
#
# Env:
#   CF_DIR              the CF repo being deployed [required]
#   FIREBASE_PROJECT    emulator project id (default starlabs-cicd — NEVER the deploy target;
#                       deploy-cf-emulator.sh hard-denies starlabs-test/fir-sample anyway)
#   GUARD_*             thresholds forwarded to the spec (see cf-guards/no-retrigger-loop.spec.ts)
#
# NOTE: this RESTARTS any emulator already running on this machine (the gate must load the CURRENT
# code from disk — a warm emulator may hold stale triggers). It tears the emulator down afterwards.
#
# COVERAGE HONESTY: the emulator boots the FILTERED entry (functions/index.emulator.js), so only the
# triggers exported there execute. The guard covers exactly that set; the spec logs functions it
# could not exercise. Widen index.emulator.js to widen the guard.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
HUB_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"
cd "$HUB_ROOT"

CF_DIR="${CF_DIR:?CF_DIR (the CF repo being deployed) is required}"
FIREBASE_PROJECT="${FIREBASE_PROJECT:-starlabs-cicd}"   # emulator-only project (denylist enforced downstream)
LOG="$HUB_ROOT/.cf-guard-emu.log"
OPENJDK_BIN="/opt/homebrew/opt/openjdk/bin"
READY_TIMEOUT="${EMU_READY_TIMEOUT:-200}"

[ -f "$CF_DIR/functions-manifest.json" ] || {
  echo "🛑 cf-predeploy: $CF_DIR/functions-manifest.json missing — run the manifest generator first" >&2
  echo "   (the CF repo's predeploy hook does this automatically: node scripts/cicd/generate-manifest.js)" >&2
  exit 1
}
[ -f "$HUB_ROOT/firebase.emulator.json" ] || {
  echo "🛑 cf-predeploy: $HUB_ROOT/firebase.emulator.json missing — run the hub's ./setup.sh once (stages emulator config)" >&2
  exit 1
}

port_up() { lsof -ti tcp:"$1" >/dev/null 2>&1; }

kill_emulator() {
  pkill -f functionsEmulatorRuntime   2>/dev/null || true
  pkill -f "deploy-cf-emulator.sh"    2>/dev/null || true
  pkill -f "emulators:start"          2>/dev/null || true
  pkill -f "cloud-firestore-emulator" 2>/dev/null || true
  local p pids
  for p in 5001 8080 9099 4001 4400 4500 9150; do
    pids="$(lsof -ti tcp:"$p" 2>/dev/null || true)"; [ -n "$pids" ] && kill $pids 2>/dev/null || true
  done
  sleep 1
  pkill -9 -f functionsEmulatorRuntime 2>/dev/null || true
  for p in 5001 8080 9099; do
    pids="$(lsof -ti tcp:"$p" 2>/dev/null || true)"; [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
  done
}

echo "── CF predeploy gate ─────────────────────────────────────────────"
echo "   repo: $CF_DIR"
echo "   guard: cf-guards/no-retrigger-loop.spec.ts (emulator project $FIREBASE_PROJECT)"

if port_up 8080 || port_up 5001; then
  echo "   ⚠ an emulator is already running — restarting it so the gate tests the CURRENT code"
fi
kill_emulator
: > "$LOG"

# Boot the emulator with THIS repo's triggers (CF_PATH override — no symlink involved).
PATH="$OPENJDK_BIN:$PATH" CF_PATH="$CF_DIR" FIREBASE_PROJECT="$FIREBASE_PROJECT" \
  SKIP_NODE_CHECK="${SKIP_NODE_CHECK:-0}" CF_BRANCH="${CF_BRANCH:-cicd-rollout}" \
  nohup bash scripts/deploy-cf-emulator.sh >>"$LOG" 2>&1 &
EMU_PID=$!

deadline=$(( SECONDS + READY_TIMEOUT ))
until grep -q "All emulators ready" "$LOG" 2>/dev/null && port_up 8080 && port_up 5001; do
  if ! kill -0 "$EMU_PID" 2>/dev/null; then
    echo "🛑 cf-predeploy: emulator exited early — last lines of $LOG:" >&2
    tail -n 20 "$LOG" >&2 || true
    exit 1
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "🛑 cf-predeploy: emulator not ready within ${READY_TIMEOUT}s — last lines of $LOG:" >&2
    tail -n 20 "$LOG" >&2 || true
    kill_emulator
    exit 1
  fi
  sleep 2
done
sleep 3   # grace: let trigger discovery finish before seeding

echo "   ✓ emulator ready — running the loop guard"
CF_DIR="$CF_DIR" EMU_LOG="$LOG" \
  FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
  FIREBASE_PROJECT="$FIREBASE_PROJECT" \
  npx playwright test --config=playwright.cf-guards.config.ts
RC=$?

kill_emulator
if [ "$RC" -eq 0 ]; then
  echo "── ✅ loop guard passed — deploy may proceed ──────────────────────"
else
  echo "── ✋ LOOP GUARD FAILED — deploy blocked (see failures above) ──────" >&2
fi
exit "$RC"
