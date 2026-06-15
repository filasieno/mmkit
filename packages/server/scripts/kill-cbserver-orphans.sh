#!/usr/bin/env bash
# Kill orphaned cbserver subprocesses and hung mmkit server tests.
set -euo pipefail

patterns=(
  'lib/CBserver'
  'mmkit-cb-real'
  'mmkit-parent-exit-demo'
  'mocha out-test/test/cbserver'
  'npm run test:cbserver:real'
)

for pattern in "${patterns[@]}"; do
  pkill -9 -f "$pattern" 2>/dev/null || true
done

sleep 0.2
if pgrep -af 'lib/CBserver|mmkit-cb-real|mmkit-parent-exit-demo' >/dev/null 2>&1; then
  echo "remaining:" >&2
  pgrep -af 'lib/CBserver|mmkit-cb-real|mmkit-parent-exit-demo' >&2 || true
  exit 1
fi

echo "cbserver test orphans cleared"
