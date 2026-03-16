#!/usr/bin/env bash
# validate-audit-config.sh - GAP-CONV-10: 校验 audit_convergence 配置
# 与 powershell/validate-audit-config.ps1 功能对等
#
# 用法: 从项目根执行 ./validate-audit-config.sh [project-root]
# 若 config/speckit.yaml 含 audit_convergence: simple，exit 1

set -e

PROJECT_ROOT="${1:-$(pwd)}"
CONFIG_PATH="$PROJECT_ROOT/config/speckit.yaml"

[[ -f "$CONFIG_PATH" ]] || exit 0

content=""
content="$(cat "$CONFIG_PATH" 2>/dev/null)" || exit 0
[[ -n "$content" ]] || exit 0

if echo "$content" | grep -qE 'audit_convergence[[:space:]]*:[[:space:]]*simple'; then
    echo "AUDIT_CONVERGENCE_SIMPLE_FORBIDDEN: project-level audit_convergence: simple is forbidden. Use CLI --audit-mode simple for single-run only." >&2
    exit 1
fi

exit 0
