#!/usr/bin/env bash
# cf-reconcile.sh — SAFE, ATC-scoped Cloud-Functions deploy reconcile.
#
# ⚠️ THE FOOTGUN THIS PREVENTS: `firebase deploy --only functions --force` deletes EVERY function not in the
# deployed entrypoint — INCLUDING ATC functions. This repo's real entrypoint (functions/index.js) and the
# emulator entrypoint (functions/index.emulator.js) differ, and ATC must NEVER be touched. So this script:
#   • deploys ONLY an explicit allowlist of CICD-MANAGED functions  (firebase deploy --only functions:a,b,c)
#   • NEVER passes --force on deploy (so an unexpected diff can never mass-delete)
#   • for deletions, removes ONLY managed functions that disappeared vs the last manifest — one explicit
#     `functions:delete` per name — and REFUSES if any name even looks like ATC
#   • is DRY-RUN by default (DRY_RUN=1). Set DRY_RUN=0 to actually deploy.
#
# This is intentionally NOT wired into an auto-running workflow yet — it needs the operator to define the
# managed-function allowlist (which functions are CICD-managed vs ATC/other). See docs/CICD-ROLLOUT.md (M4).
#
# Required env:
#   MANAGED_FUNCTIONS  space/comma-separated function names this pipeline manages (NEVER includes ATC)
#   PROJECT            target Firebase project id (e.g. starlabs-test or fir-sample-aae4a)
# Optional env:
#   CF_DIR=.           cloud-function repo root (must contain firebase.json)
#   LAST_MANIFEST      path to the previously-deployed managed list (for deletion diff); written on success
#   DRY_RUN=1          1 = print only (default), 0 = execute
set -uo pipefail

CF_DIR="${CF_DIR:-.}"
DRY_RUN="${DRY_RUN:-1}"
: "${PROJECT:?set PROJECT (target firebase project id)}"
: "${MANAGED_FUNCTIONS:?set MANAGED_FUNCTIONS (space/comma list of CICD-managed function names)}"

# Normalize to a newline list.
norm() { printf '%s' "$1" | tr ', ' '\n\n' | sed '/^$/d'; }
MANAGED="$(norm "$MANAGED_FUNCTIONS" | sort -u)"

# ── ATC guard: refuse if ANY managed name looks like ATC (case-insensitive 'atc'). Conservative by design.
if printf '%s\n' "$MANAGED" | grep -iq 'atc'; then
  echo "🛑 REFUSING: MANAGED_FUNCTIONS contains a name matching /atc/i. ATC functions must never be managed/deployed/deleted here." >&2
  printf '%s\n' "$MANAGED" | grep -i 'atc' | sed 's/^/   offending: /' >&2
  exit 2
fi

run() { echo "+ $*"; [ "$DRY_RUN" = "0" ] && "$@"; }

echo "── cf-reconcile ── project=$PROJECT  dry_run=$DRY_RUN  cf_dir=$CF_DIR"
echo "managed functions:"; printf '   %s\n' $MANAGED

cd "$CF_DIR" || { echo "::error::CF_DIR not found: $CF_DIR" >&2; exit 1; }
[ -f firebase.json ] || { echo "::error::no firebase.json in $CF_DIR" >&2; exit 1; }

# ── Deploy ONLY the managed functions. NEVER --force.
ONLY="$(printf '%s' "$MANAGED" | paste -sd, -)"
run firebase deploy --only "functions:$ONLY" --project "$PROJECT" --non-interactive

# ── Deletions: only managed functions present last time but gone now. One explicit delete each.
if [ -n "${LAST_MANIFEST:-}" ] && [ -f "$LAST_MANIFEST" ]; then
  PREV="$(norm "$(cat "$LAST_MANIFEST")" | sort -u)"
  TO_DELETE="$(comm -23 <(printf '%s\n' "$PREV") <(printf '%s\n' "$MANAGED"))"
  for fn in $TO_DELETE; do
    # Re-assert the ATC guard per-name before any delete.
    if printf '%s' "$fn" | grep -iq 'atc'; then echo "🛑 skip delete (ATC-like): $fn" >&2; continue; fi
    echo "delete (managed, removed since last deploy): $fn"
    run firebase functions:delete "$fn" --project "$PROJECT" --force
  done
else
  echo "(no LAST_MANIFEST — skipping deletion reconcile this run)"
fi

# ── Record the new manifest on a real (non-dry) deploy.
if [ "$DRY_RUN" = "0" ] && [ -n "${LAST_MANIFEST:-}" ]; then
  printf '%s\n' "$MANAGED" > "$LAST_MANIFEST"
  echo "wrote manifest → $LAST_MANIFEST"
fi
echo "── cf-reconcile done ──"
