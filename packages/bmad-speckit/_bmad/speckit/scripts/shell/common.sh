#!/usr/bin/env bash
# Common shell functions (analogous to common.ps1)
# Sourced by check-prerequisites.sh and other shell scripts

get_repo_root() {
    local root
    root="$(git rev-parse --show-toplevel 2>/dev/null)" && echo "$root" && return 0
    # Fallback: script is in _bmad/speckit/scripts/shell/
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$script_dir/../../.." && pwd
}

get_current_branch() {
    [[ -n "$SPECIFY_FEATURE" ]] && echo "$SPECIFY_FEATURE" && return 0
    local branch
    branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" && [[ -n "$branch" ]] && echo "$branch" && return 0
    # For non-git: find latest feature in specs/
    local repo_root repo_root_val
    repo_root_val="$(get_repo_root)"
    repo_root="$repo_root_val"
    local specs_dir="$repo_root/specs"
    if [[ -d "$specs_dir" ]]; then
        local latest="" highest=0
        for d in "$specs_dir"/*/; do
            [[ -d "$d" ]] || continue
            local name; name="$(basename "$d")"
            if [[ "$name" =~ ^([0-9]{3})- ]]; then
                local num=${BASH_REMATCH[1]}
                [[ $num -gt $highest ]] && { highest=$num; latest="$name"; }
            fi
        done
        [[ -n "$latest" ]] && echo "$latest" && return 0
    fi
    echo "main"
}

test_has_git() {
    git rev-parse --show-toplevel &>/dev/null
}

test_feature_branch() {
    local branch="$1"
    local has_git="${2:-true}"
    [[ "$has_git" != "true" ]] && { echo "[specify] Warning: Git repository not detected; skipped branch validation" >&2; return 0; }
    if [[ ! "$branch" =~ ^[0-9]{3}- ]]; then
        echo "ERROR: Not on a feature branch. Current branch: $branch"
        echo "Feature branches should be named like: 001-feature-name"
        return 1
    fi
    return 0
}

get_feature_dir() {
    local repo_root="$1"
    local branch="$2"
    echo "$repo_root/specs/$branch"
}

has_jq() {
    command -v jq >/dev/null 2>&1
}

json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\t'/\\t}"
    s="${s//$'\r'/\\r}"
    printf '%s' "$s"
}

get_feature_paths_env() {
    local repo_root current_branch has_git feature_dir
    repo_root="$(get_repo_root)"
    current_branch="$(get_current_branch)"
    test_has_git && has_git=true || has_git=false
    feature_dir="$(get_feature_dir "$repo_root" "$current_branch")"
    # Use printf '%q' to safely quote values, preventing shell injection
    # via crafted branch names or paths containing special characters
    printf 'REPO_ROOT=%q\n' "$repo_root"
    printf 'CURRENT_BRANCH=%q\n' "$current_branch"
    printf 'HAS_GIT=%q\n' "$has_git"
    printf 'FEATURE_DIR=%q\n' "$feature_dir"
    printf 'FEATURE_SPEC=%q\n' "$feature_dir/spec.md"
    printf 'IMPL_PLAN=%q\n' "$feature_dir/plan.md"
    printf 'TASKS=%q\n' "$feature_dir/tasks.md"
    printf 'RESEARCH=%q\n' "$feature_dir/research.md"
    printf 'DATA_MODEL=%q\n' "$feature_dir/data-model.md"
    printf 'QUICKSTART=%q\n' "$feature_dir/quickstart.md"
    printf 'CONTRACTS_DIR=%q\n' "$feature_dir/contracts"
}
