#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-.}"
SERVER_NAME="${SERVER_NAME:-bmad-runtime}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TARGET_ROOT="$(cd "$TARGET_DIR" && pwd)"
SERVER_ROOT="$TARGET_ROOT/.codex/mcp/$SERVER_NAME/server"
DIST_ROOT="$SERVER_ROOT/dist"
CONFIG_ROOT="$SERVER_ROOT/config"
LOGS_ROOT="$SERVER_ROOT/logs"
TMP_ROOT="$SERVER_ROOT/tmp"
TEMPLATES_ROOT="$TARGET_ROOT/.codex/mcp/templates"
GENERATED_ROOT="$TARGET_ROOT/.codex/generated"
TEMPLATES_SRC_ROOT="$REPO_ROOT/templates/consumer-mcp"
RUNTIME_EMIT_DIST_ROOT="$REPO_ROOT/packages/runtime-emit/dist"

mkdir -p "$DIST_ROOT" "$CONFIG_ROOT" "$LOGS_ROOT" "$TMP_ROOT" "$TEMPLATES_ROOT" "$GENERATED_ROOT" "$TARGET_ROOT/.codex/install"

cp "$TEMPLATES_SRC_ROOT/codex.mcp.json.template" "$TEMPLATES_ROOT/codex.mcp.json.template"
cp "$TEMPLATES_SRC_ROOT/server.config.json.template" "$TEMPLATES_ROOT/server.config.json.template"
cp "$RUNTIME_EMIT_DIST_ROOT/consumer-mcp-server.cjs" "$DIST_ROOT/index.js"
chmod +x "$DIST_ROOT/index.js"

sed "s/{{SERVER_NAME}}/$SERVER_NAME/g" "$TEMPLATES_ROOT/server.config.json.template" > "$CONFIG_ROOT/server.config.json"
sed "s/{{SERVER_NAME}}/$SERVER_NAME/g" "$TEMPLATES_ROOT/codex.mcp.json.template" > "$GENERATED_ROOT/mcp.json"
cp "$GENERATED_ROOT/mcp.json" "$TARGET_ROOT/.mcp.json"

cat > "$SERVER_ROOT/README.md" <<EOF
# $SERVER_NAME MCP Server

This directory is generated for a consumer project.

- Entry: \\`dist/index.js\\`
- Config: \\`config/server.config.json\\`
- Logs: \\`logs/\\`
- Temp: \\`tmp/\\`

Smoke test:

\\`node .codex/mcp/$SERVER_NAME/server/dist/index.js --smoke\\`
EOF

echo "Consumer MCP layout generated at: $TARGET_ROOT"
echo "Project MCP config: $TARGET_ROOT/.mcp.json"
echo "Server entry: $DIST_ROOT/index.js"

