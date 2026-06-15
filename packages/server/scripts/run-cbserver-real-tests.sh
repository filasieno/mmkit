#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf out-test
tsc -p test/cbserver/tsconfig.json
# Trace off by default — MMKIT_CBSERVER_TRACE=1 enables verbose IPC logs.
# Hang-guard progress on by default — MMKIT_TEST_HANG_LOG=0 to silence.
TRACE="${MMKIT_CBSERVER_TRACE:-0}"
HANG_LOG="${MMKIT_TEST_HANG_LOG:-1}"
exec env MMKIT_CBSERVER_TRACE="$TRACE" MMKIT_TEST_HANG_LOG="$HANG_LOG" mocha 'out-test/test/cbserver/**/*.real.test.js' --timeout 90000 --exit
