#!/usr/bin/env bash
# Run real-cbserver mocha tests. Re-enters `nix develop .#mmkit` when cbserver is not on PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SERVER_DIR="$ROOT/packages/server"

if [[ -z "${MMKIT_REAL_CBSERVER_BIN:-}" ]] && ! command -v cbserver >/dev/null 2>&1; then
  exec nix develop "$ROOT" -c "$0" "$@"
fi

cd "$SERVER_DIR"
bash scripts/kill-cbserver-orphans.sh
export MMKIT_REAL_CBSERVER_BIN="${MMKIT_REAL_CBSERVER_BIN:-$(command -v cbserver)}"
npm run test:cbserver:real
