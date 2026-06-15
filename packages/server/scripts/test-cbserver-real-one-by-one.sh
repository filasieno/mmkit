#!/usr/bin/env bash
# Run each real-cbserver mocha test in isolation with a hard per-test wall-clock limit.
# Each test must finish within MMKIT_REAL_PER_TEST_MS (default 5000ms).
set -uo pipefail
cd "$(dirname "$0")/.."

PER_TEST_MS="${MMKIT_REAL_PER_TEST_MS:-5000}"
HARD_KILL_MS=$((PER_TEST_MS + 2000))
export MMKIT_REAL_FAST=1
export MMKIT_REAL_PER_TEST_MS="$PER_TEST_MS"
export MMKIT_TEST_HANG_LOG="${MMKIT_TEST_HANG_LOG:-0}"
export MMKIT_IHSM_TRACE="${MMKIT_IHSM_TRACE:-0}"
export MMKIT_CBSERVER_TRACE="${MMKIT_CBSERVER_TRACE:-0}"

BIN="$PWD/../../node_modules/.bin"
export PATH="$BIN:$PATH"

if ! command -v cbserver >/dev/null 2>&1 && [[ -z "${MMKIT_REAL_CBSERVER_BIN:-}" ]]; then
  echo "cbserver not found — run inside: nix develop .#mmkit" >&2
  exit 2
fi

echo "=== compiling test project ==="
rm -rf out-test
"$BIN/tsc" -p test/cbserver/tsconfig.json || { echo "tsc failed" >&2; exit 1; }

mapfile -t CASES < <(node scripts/list-real-cbserver-tests.mjs)

passed=0
failed=0
declare -a FAILURES=()

echo "Running ${#CASES[@]} real tests — ${PER_TEST_MS}ms max each"
echo

# Convert ms → seconds (float) for the timeout(1) coreutil.
hard_kill_s=$(awk "BEGIN { printf \"%.3f\", ${HARD_KILL_MS} / 1000 }")

for spec in "${CASES[@]}"; do
  IFS='|' read -r file pattern <<< "$spec"
  bash scripts/kill-cbserver-orphans.sh >/dev/null 2>&1 || true

  printf '=== %s ===\n' "$pattern"
  start_ms=$(date +%s%3N)
  # --exit: force mocha to exit after the test even if the dual-channel
  # notification socket leaves a lingering timer/handle on the event loop
  # (the socket idle timeout can fire during teardown). Without --exit the
  # process would linger and the watchdog below would kill a passing test.
  timeout --kill-after=2 "$hard_kill_s" \
    mocha "$file" --grep "$pattern" --timeout "$PER_TEST_MS" --reporter min --exit
  code=$?
  elapsed_ms=$(( $(date +%s%3N) - start_ms ))

  if [[ $code -eq 0 ]]; then
    passed=$((passed + 1))
    printf -- '--- PASS %s (%sms)\n\n' "$pattern" "$elapsed_ms"
  else
    failed=$((failed + 1))
    FAILURES+=("$pattern (exit=$code, ${elapsed_ms}ms)")
    printf -- '--- FAIL %s (%sms, exit=%s)\n\n' "$pattern" "$elapsed_ms" "$code"
  fi
done

bash scripts/kill-cbserver-orphans.sh >/dev/null 2>&1 || true

echo "Summary: ${passed} passed, ${failed} failed (limit ${PER_TEST_MS}ms per test)"
if [[ ${#FAILURES[@]} -gt 0 ]]; then
  echo "Failures:"
  for name in "${FAILURES[@]}"; do
    echo "  - $name"
  done
  exit 1
fi
