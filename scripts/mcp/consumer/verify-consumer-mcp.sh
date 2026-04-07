#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-.}"
SERVER_NAME="${SERVER_NAME:-bmad-runtime}"
TARGET_ROOT="$(cd "$TARGET_DIR" && pwd)"

ENTRY_PATH="$TARGET_ROOT/.runtime-mcp/server/dist/index.cjs"
CONFIG_PATH="$TARGET_ROOT/.mcp.json"

[[ -f "$ENTRY_PATH" ]] || { echo "Missing server entry: $ENTRY_PATH"; exit 1; }
[[ -f "$CONFIG_PATH" ]] || { echo "Missing MCP config: $CONFIG_PATH"; exit 1; }

(cd "$TARGET_ROOT" && node "$ENTRY_PATH" --smoke)
