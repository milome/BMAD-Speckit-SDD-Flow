#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY_SCRIPT="$SCRIPT_DIR/../python/readiness_gate.py"
[[ -f "$PY_SCRIPT" ]] || { echo "Python script not found: $PY_SCRIPT"; exit 1; }

if command -v python3 >/dev/null 2>&1; then
  exec python3 "$PY_SCRIPT" "$@"
fi

exec python "$PY_SCRIPT" "$@"
