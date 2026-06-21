#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CANONICAL="$SCRIPT_DIR/../_bmad/speckit/scripts/shell/check-sprint-ready.sh"

if [[ ! -f "$CANONICAL" ]]; then
    echo "Canonical sprint gate script not found: $CANONICAL" >&2
    exit 1
fi

exec bash "$CANONICAL" "$@"
