#!/usr/bin/env bash
# PR Template Generator - 与 generate-pr-template.ps1 完整功能对等
# 调用 generate-pr-template.py 实现：commit 分类、文件统计、AutoDetectLastPR、UTF-8 强制
# Usage: ./generate-pr-template.sh [-BaseBranch dev] [-CurrentBranch ""] [-OutputDir docs/PR] [-LastPRCommit ""] [-AutoDetectLastPR]

set -e

# Force UTF-8 for console and file output
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY_SCRIPT="$SCRIPT_DIR/generate-pr-template.py"

BASE_BRANCH="dev"
CURRENT_BRANCH=""
OUTPUT_DIR="docs/PR"
LAST_PR_COMMIT=""
AUTO_DETECT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -BaseBranch) BASE_BRANCH="$2"; shift 2 ;;
        -CurrentBranch) CURRENT_BRANCH="$2"; shift 2 ;;
        -OutputDir) OUTPUT_DIR="$2"; shift 2 ;;
        -LastPRCommit) LAST_PR_COMMIT="$2"; shift 2 ;;
        -AutoDetectLastPR) AUTO_DETECT=true; shift ;;
        *) shift ;;
    esac
done

# When AutoDetectLastPR, ignore LastPRCommit (Python auto-detects via merge-base)
$AUTO_DETECT && LAST_PR_COMMIT=""

[[ -f "$PY_SCRIPT" ]] || { echo "ERROR: Python script not found: $PY_SCRIPT"; exit 1; }

ARGS=("--base-branch" "$BASE_BRANCH" "--output-dir" "$OUTPUT_DIR")
[[ -n "$CURRENT_BRANCH" ]] && ARGS+=("--current-branch" "$CURRENT_BRANCH")
[[ -n "$LAST_PR_COMMIT" ]] && ! $AUTO_DETECT && ARGS+=("--last-pr-commit" "$LAST_PR_COMMIT")

exec python3 "$PY_SCRIPT" "${ARGS[@]}"
