#!/usr/bin/env bash
# Validate sync-manifest (calls Python script - cross-platform)
# Usage: ./validate-sync-manifest.sh --manifest sync-manifest.yaml --repo-a /path/a --repo-b /path/b

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY_SCRIPT="$SCRIPT_DIR/../python/validate_sync_manifest.py"
[[ -f "$PY_SCRIPT" ]] || { echo "Python script not found: $PY_SCRIPT"; exit 1; }
exec python3 "$PY_SCRIPT" "$@"
