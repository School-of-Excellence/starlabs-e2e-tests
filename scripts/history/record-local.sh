#!/usr/bin/env bash
# record-local.sh — record a LOCAL gate run into the same append-only history as CI (source: local).
# Run it right after a local gate (e.g. `npm run report:emulator`) so the HTML report + seed inputs are
# archived immutably in starlabs-cicd instead of being overwritten by your next run.
#
#   RESULT=pass bash scripts/history/record-local.sh      # or RESULT=fail
#
# Uses the SA that setup.sh materialized to ./starlabs-cicd-sa.json (override with STARLABS_CICD_SA).
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1   # -> e2e hub root

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo local)"
SHA="$(git rev-parse HEAD 2>/dev/null || echo nosha)"
ACTOR="$(git config user.name 2>/dev/null || echo "${USER:-unknown}")"

STARLABS_CICD_SA="${STARLABS_CICD_SA:-$PWD/starlabs-cicd-sa.json}" \
REPO="${HISTORY_REPO:-starlabs-e2e-tests}" \
BRANCH="$BRANCH" SHA="$SHA" ACTOR="$ACTOR" \
SOURCE=local SUITE="${SUITE:-queue}" STAGE="${STAGE:-gate}" RESULT="${RESULT:-unknown}" \
REPORT_DIR="${REPORT_DIR:-playwright-report}" \
ATTACH="${ATTACH:-fixtures/sample-queue-config.json,fixtures/firestore-seed.json}" \
node scripts/history/record-run.cjs
