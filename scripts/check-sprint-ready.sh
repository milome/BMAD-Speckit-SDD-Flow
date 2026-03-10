#!/usr/bin/env bash
# Check sprint-status.yaml (WSL/Linux/macOS)
# 与 scripts/check-sprint-ready.ps1 功能对等
#
# Usage: ./scripts/check-sprint-ready.sh [-Json] [-RepoRoot <path>]
# Output: SPRINT_READY, SPRINT_STATUS_PATH, MESSAGE

set -e

JSON=false
REPO_ROOT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -Json) JSON=true; shift ;;
        -RepoRoot) REPO_ROOT="$2"; shift 2 ;;
        *) break ;;
    esac
done

# Resolve repo root
if [[ -z "$REPO_ROOT" ]]; then
    REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || true
    [[ -z "$REPO_ROOT" ]] && REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

IMPL_ARTIFACTS="$REPO_ROOT/_bmad-output/implementation-artifacts"
SPRINT_STATUS_PATH="$IMPL_ARTIFACTS/sprint-status.yaml"

SPRINT_READY=false
MESSAGE=""

if [[ ! -f "$SPRINT_STATUS_PATH" ]]; then
    MESSAGE="sprint-status.yaml not found. Run sprint-planning to initialize."
else
    if grep -qE 'development_status\s*:' "$SPRINT_STATUS_PATH" 2>/dev/null || \
       grep -qE 'epics\s*:' "$SPRINT_STATUS_PATH" 2>/dev/null; then
        SPRINT_READY=true
        MESSAGE="Sprint status valid."
    else
        MESSAGE="sprint-status.yaml exists but lacks development_status or epics. Run sprint-planning."
    fi
fi

if [[ "$JSON" == "true" ]]; then
    # jq-like escape for JSON string
    path_esc="$(echo "$SPRINT_STATUS_PATH" | sed 's/\\/\\\\/g;s/"/\\"/g')"
    msg_esc="$(echo "$MESSAGE" | sed 's/\\/\\\\/g;s/"/\\"/g')"
    printf '{"SPRINT_READY":%s,"SPRINT_STATUS_PATH":"%s","MESSAGE":"%s"}\n' \
        "$( [[ "$SPRINT_READY" == "true" ]] && echo true || echo false )" \
        "$path_esc" \
        "$msg_esc"
else
    echo "SPRINT_READY: $SPRINT_READY"
    echo "SPRINT_STATUS_PATH: $SPRINT_STATUS_PATH"
    echo "MESSAGE: $MESSAGE"
fi

[[ "$SPRINT_READY" == "true" ]] && exit 0 || exit 1
