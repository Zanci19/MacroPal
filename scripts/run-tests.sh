#!/usr/bin/env bash
# =============================================================================
# MacroPal — Test Runner
# =============================================================================
# Runs both the unit test suite (Vitest) and the end-to-end test suite
# (Cypress) and writes a timestamped log to logs/test-run-<timestamp>.log.
#
# Usage:
#   ./scripts/run-tests.sh [--unit-only] [--e2e-only]
#
# Prerequisites:
#   npm install must have been run.
#   For E2E tests the dev server must be available (this script starts it
#   automatically and shuts it down when done).
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS_DIR="$REPO_ROOT/logs"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$LOGS_DIR/test-run-$TIMESTAMP.log"
DEV_SERVER_PORT=5173
DEV_SERVER_PID=""
UNIT_TIMEOUT_SECONDS="${UNIT_TIMEOUT_SECONDS:-300}"

# ── Flags ─────────────────────────────────────────────────────────────────────
RUN_UNIT=true
RUN_E2E=true

for arg in "$@"; do
  case "$arg" in
    --unit-only) RUN_E2E=false ;;
    --e2e-only)  RUN_UNIT=false ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

section() {
  local sep="════════════════════════════════════════════════════════════"
  log "$sep"
  log "  $*"
  log "$sep"
}

# Tee command output to both stdout and the log file
run_logged() {
  "$@" 2>&1 | tee -a "$LOG_FILE"
  return "${PIPESTATUS[0]}"
}

run_logged_with_timeout() {
  local timeout_seconds="$1"
  shift

  if command -v timeout >/dev/null 2>&1; then
    timeout --kill-after=10s "$timeout_seconds" "$@" 2>&1 | tee -a "$LOG_FILE"
    return "${PIPESTATUS[0]}"
  fi

  log "⚠️  'timeout' command not available; running without timeout guard."
  run_logged "$@"
}

cleanup() {
  if [[ -n "$DEV_SERVER_PID" ]]; then
    log "Stopping dev server (PID $DEV_SERVER_PID)…"
    kill "$DEV_SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── Setup ─────────────────────────────────────────────────────────────────────
mkdir -p "$LOGS_DIR"
cd "$REPO_ROOT"

section "MacroPal Test Run — $TIMESTAMP"
log "Log file: $LOG_FILE"
log "Working directory: $REPO_ROOT"
log "Unit tests: $RUN_UNIT | E2E tests: $RUN_E2E"

UNIT_RESULT=0
E2E_RESULT=0

# ── Unit tests (Vitest) ───────────────────────────────────────────────────────
if [[ "$RUN_UNIT" == "true" ]]; then
  section "Unit Tests (Vitest)"
  log "Running unit tests with timeout guard (${UNIT_TIMEOUT_SECONDS}s)…"
  run_logged_with_timeout "$UNIT_TIMEOUT_SECONDS" npx vitest run --reporter=verbose || UNIT_RESULT=$?

  if [[ "$UNIT_RESULT" -eq 124 ]]; then
    log "❌  Unit tests timed out after ${UNIT_TIMEOUT_SECONDS}s (possible hanging worker)."
  fi

  if [[ "$UNIT_RESULT" -eq 0 ]]; then
    log "✅  Unit tests PASSED"
  else
    log "❌  Unit tests FAILED (exit code $UNIT_RESULT)"
  fi
fi

# ── E2E tests (Cypress) ───────────────────────────────────────────────────────
if [[ "$RUN_E2E" == "true" ]]; then
  section "E2E Tests (Cypress)"

  # Start the Vite dev server in the background
  log "Starting dev server on port $DEV_SERVER_PORT…"
  npx vite --port "$DEV_SERVER_PORT" &
  DEV_SERVER_PID=$!

  # Wait until the server is accepting connections (max 30 s)
  log "Waiting for dev server to be ready…"
  for i in $(seq 1 30); do
    if curl -s -o /dev/null "http://localhost:$DEV_SERVER_PORT"; then
      log "Dev server is ready (attempt $i)."
      break
    fi
    sleep 1
    if [[ $i -eq 30 ]]; then
      log "⚠️  Dev server did not start within 30 seconds. Skipping E2E tests."
      E2E_RESULT=1
    fi
  done

  if [[ "$E2E_RESULT" -eq 0 ]]; then
    run_logged npx cypress run --spec "cypress/e2e/app.cy.ts" || E2E_RESULT=$?
  fi

  if [[ "$E2E_RESULT" -eq 0 ]]; then
    log "✅  E2E tests PASSED"
  else
    log "❌  E2E tests FAILED (exit code $E2E_RESULT)"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
section "Summary"

if [[ "$RUN_UNIT" == "true" ]]; then
  [[ "$UNIT_RESULT" -eq 0 ]] && log "  Unit tests  : ✅ PASS" || log "  Unit tests  : ❌ FAIL"
fi
if [[ "$RUN_E2E" == "true" ]]; then
  [[ "$E2E_RESULT" -eq 0 ]] && log "  E2E tests   : ✅ PASS" || log "  E2E tests   : ❌ FAIL"
fi
log "Full log saved to: $LOG_FILE"

# Exit with failure if any suite failed
OVERALL=$((UNIT_RESULT + E2E_RESULT))
exit "$OVERALL"
