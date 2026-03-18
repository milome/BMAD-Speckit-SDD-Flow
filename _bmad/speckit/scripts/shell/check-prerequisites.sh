#!/usr/bin/env bash
# Consolidated prerequisite checking (shell/WSL/Linux/macOS)
# 与 powershell/check-prerequisites.ps1 功能对等
#
# Usage: ./check-prerequisites.sh [OPTIONS]
#   -Json               Output in JSON
#   -RequireTasks       Require tasks.md
#   -IncludeTasks       Include tasks.md in AVAILABLE_DOCS
#   -RequireSprintStatus Require sprint-status.yaml in BMAD mode
#   -PathsOnly          Only output path variables

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

JSON=false
REQUIRE_TASKS=false
INCLUDE_TASKS=false
REQUIRE_SPRINT_STATUS=false
PATHS_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -Json) JSON=true; shift ;;
        -RequireTasks) REQUIRE_TASKS=true; shift ;;
        -IncludeTasks) INCLUDE_TASKS=true; shift ;;
        -RequireSprintStatus) REQUIRE_SPRINT_STATUS=true; shift ;;
        -PathsOnly) PATHS_ONLY=true; shift ;;
        -Help|-h)
            echo "Usage: check-prerequisites.sh [OPTIONS]"
            echo "  -Json               Output in JSON format"
            echo "  -RequireTasks       Require tasks.md to exist"
            echo "  -IncludeTasks       Include tasks.md in AVAILABLE_DOCS list"
            echo "  -RequireSprintStatus Require sprint-status.yaml when project has BMAD structure"
            echo "  -PathsOnly          Only output path variables"
            echo "  -Help, -h            Show this help"
            exit 0 ;;
        *) shift ;;
    esac
done

# Eval paths
eval "$(get_feature_paths_env | sed 's/^/export /')"

# Validate branch
if ! test_feature_branch "$CURRENT_BRANCH" "$HAS_GIT"; then
    exit 1
fi

if [[ "$PATHS_ONLY" == "true" ]]; then
    if [[ "$JSON" == "true" ]]; then
        echo "{\"REPO_ROOT\":\"$REPO_ROOT\",\"BRANCH\":\"$CURRENT_BRANCH\",\"FEATURE_DIR\":\"$FEATURE_DIR\",\"FEATURE_SPEC\":\"$FEATURE_SPEC\",\"IMPL_PLAN\":\"$IMPL_PLAN\",\"TASKS\":\"$TASKS\"}"
    else
        echo "REPO_ROOT: $REPO_ROOT"
        echo "BRANCH: $CURRENT_BRANCH"
        echo "FEATURE_DIR: $FEATURE_DIR"
        echo "FEATURE_SPEC: $FEATURE_SPEC"
        echo "IMPL_PLAN: $IMPL_PLAN"
        echo "TASKS: $TASKS"
    fi
    exit 0
fi

# Validate required dirs/files
if [[ ! -d "$FEATURE_DIR" ]]; then
    echo "ERROR: Feature directory not found: $FEATURE_DIR"
    echo "Run /speckit.specify first to create the feature structure."
    exit 1
fi

if [[ ! -f "$IMPL_PLAN" ]]; then
    echo "ERROR: plan.md not found in $FEATURE_DIR"
    echo "Run /speckit.plan first to create the implementation plan."
    exit 1
fi

if [[ "$REQUIRE_TASKS" == "true" ]] && [[ ! -f "$TASKS" ]]; then
    echo "ERROR: tasks.md not found in $FEATURE_DIR"
    echo "Run /speckit.tasks first to create the task list."
    exit 1
fi

# Require sprint-status when in BMAD mode
if [[ "$REQUIRE_SPRINT_STATUS" == "true" ]]; then
    IMPL_ARTIFACTS="$REPO_ROOT/_bmad-output/implementation-artifacts"
    if [[ -d "$IMPL_ARTIFACTS" ]]; then
        SPRINT_PATH="$IMPL_ARTIFACTS/sprint-status.yaml"
        if [[ ! -f "$SPRINT_PATH" ]]; then
            echo "ERROR: sprint-status.yaml not found in $IMPL_ARTIFACTS"
            echo "Run /bmad-bmm-sprint-planning first to generate sprint-status.yaml."
            exit 1
        fi
    fi
fi

# Build AVAILABLE_DOCS
DOCS=()
[[ -f "$RESEARCH" ]] && DOCS+=(research.md)
[[ -f "$DATA_MODEL" ]] && DOCS+=(data-model.md)
if [[ -d "$CONTRACTS_DIR" ]] && [[ -n "$(ls -A "$CONTRACTS_DIR" 2>/dev/null)" ]]; then
    DOCS+=(contracts/)
fi
[[ -f "$QUICKSTART" ]] && DOCS+=(quickstart.md)
[[ "$INCLUDE_TASKS" == "true" ]] && [[ -f "$TASKS" ]] && DOCS+=(tasks.md)

# Output
if [[ "$JSON" == "true" ]]; then
    # Build JSON array for AVAILABLE_DOCS
    doc_json="["
    first=true
    for d in "${DOCS[@]}"; do
        [[ "$first" == "true" ]] && first=false || doc_json+=","
        doc_json+="\"$d\""
    done
    doc_json+="]"
    echo "{\"FEATURE_DIR\":\"$FEATURE_DIR\",\"AVAILABLE_DOCS\":$doc_json}"
else
    echo "FEATURE_DIR:$FEATURE_DIR"
    echo "AVAILABLE_DOCS:"
    for p in "$RESEARCH" "$DATA_MODEL" "$CONTRACTS_DIR" "$QUICKSTART"; do
        [[ -n "$p" ]] || continue
        if [[ -d "$p" ]]; then
            [[ -n "$(ls -A "$p" 2>/dev/null)" ]] && echo "  ✓" || echo "  ✗"
        else
            [[ -f "$p" ]] && echo "  ✓" || echo "  ✗"
        fi
    done
    [[ "$INCLUDE_TASKS" == "true" ]] && { [[ -f "$TASKS" ]] && echo "  ✓ tasks.md" || echo "  ✗ tasks.md"; }
fi
