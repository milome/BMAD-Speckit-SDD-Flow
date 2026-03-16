#!/usr/bin/env bash
# setup-plan.sh - Setup implementation plan for a feature
# 与 powershell/setup-plan.ps1 功能对等

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

JSON=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -Json) JSON=true; shift ;;
        -Help|-h) echo "Usage: ./setup-plan.sh [-Json] [-Help]"; exit 0 ;;
        *) shift ;;
    esac
done

eval "$(get_feature_paths_env | sed 's/^/export /')"

# Validate branch
test_feature_branch "$CURRENT_BRANCH" "$HAS_GIT" || exit 1

# Ensure feature dir exists
mkdir -p "$FEATURE_DIR"

# Copy plan template if exists
TEMPLATE="$REPO_ROOT/.specify/templates/plan-template.md"
if [[ -f "$TEMPLATE" ]]; then
    cp -f "$TEMPLATE" "$IMPL_PLAN"
    echo "Copied plan template to $IMPL_PLAN"
else
    echo "Plan template not found at $TEMPLATE" >&2
    touch "$IMPL_PLAN"
fi

if $JSON; then
    echo "{\"FEATURE_SPEC\":\"$FEATURE_SPEC\",\"IMPL_PLAN\":\"$IMPL_PLAN\",\"SPECS_DIR\":\"$FEATURE_DIR\",\"BRANCH\":\"$CURRENT_BRANCH\",\"HAS_GIT\":\"$HAS_GIT\"}"
else
    echo "FEATURE_SPEC: $FEATURE_SPEC"
    echo "IMPL_PLAN: $IMPL_PLAN"
    echo "SPECS_DIR: $FEATURE_DIR"
    echo "BRANCH: $CURRENT_BRANCH"
    echo "HAS_GIT: $HAS_GIT"
fi
