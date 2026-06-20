#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-.}"
SERVER_NAME="${SERVER_NAME:-bmad-runtime}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TARGET_ROOT="$(cd "$TARGET_DIR" && pwd)"
RUNTIME_MCP_ROOT="$TARGET_ROOT/.runtime-mcp"
SERVER_ROOT="$RUNTIME_MCP_ROOT/server"
DIST_ROOT="$SERVER_ROOT/dist"
CONFIG_ROOT="$SERVER_ROOT/config"
LOGS_ROOT="$RUNTIME_MCP_ROOT/logs"
TMP_ROOT="$RUNTIME_MCP_ROOT/tmp"
TEMPLATES_SRC_ROOT="$REPO_ROOT/templates/consumer-mcp"
RUNTIME_EMIT_DIST_ROOT="$REPO_ROOT/packages/runtime-emit/dist"

mkdir -p "$RUNTIME_MCP_ROOT" "$SERVER_ROOT" "$DIST_ROOT" "$CONFIG_ROOT" "$LOGS_ROOT" "$TMP_ROOT"

cp "$RUNTIME_EMIT_DIST_ROOT/consumer-mcp-server.cjs" "$DIST_ROOT/index.cjs"
chmod +x "$DIST_ROOT/index.cjs"

sed "s/{{SERVER_NAME}}/$SERVER_NAME/g" "$TEMPLATES_SRC_ROOT/server.config.json.template" > "$CONFIG_ROOT/server.config.json"
sed "s/{{SERVER_NAME}}/$SERVER_NAME/g" "$TEMPLATES_SRC_ROOT/runtime.mcp.json.template" > "$TARGET_ROOT/.mcp.json"

cat > "$SERVER_ROOT/README.md" <<EOF
# $SERVER_NAME MCP Server

This directory is generated for a consumer project.

- Entry: \`dist/index.cjs\`
- Config: \`config/server.config.json\`
- Logs: \`.runtime-mcp/logs/\`
- Temp: \`.runtime-mcp/tmp/\`

Smoke test:

\`node .runtime-mcp/server/dist/index.cjs --smoke\`
EOF

echo "Consumer MCP layout generated at: $TARGET_ROOT"
echo "Project MCP config: $TARGET_ROOT/.mcp.json"
echo "Server entry: $DIST_ROOT/index.cjs"
