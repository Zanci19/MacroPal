#!/usr/bin/env bash
# MacroPal Compatibility wrapper around the cross-platform test runner.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

node scripts/bug-check.mjs --tests-only "$@"
