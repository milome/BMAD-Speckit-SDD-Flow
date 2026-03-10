#!/usr/bin/env bash
# setup_worktree.sh - Git Worktree 快速设置 (WSL/Linux/macOS)
# 与 powershell/setup_worktree.ps1 功能对等
#
# Usage: ./setup_worktree.sh <create|list|remove|sync> [branch-name] [worktree-path]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve repo root
REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null)" || true
if [[ -z "$REPO_DIR" ]]; then
    current="$SCRIPT_DIR"
    while [[ -n "$current" ]]; do
        [[ -d "$current/.git" ]] && REPO_DIR="$current" && break
        parent="$(dirname "$current")"
        [[ "$parent" == "$current" ]] && break
        current="$parent"
    done
fi
[[ -z "$REPO_DIR" ]] && { echo "[ERROR] Could not determine repository root"; exit 1; }

REPO_DIR="${REPO_DIR%/}"
REPO_DIR="${REPO_DIR%\\}"
WORKTREE_BASE="$(dirname "$REPO_DIR")"

# Repo name
REPO_NAME="${REPO_NAME:-$(basename "$REPO_DIR")}"
[[ -z "$REPO_NAME" || "$REPO_NAME" == "." || "$REPO_NAME" == ".." ]] && REPO_NAME="repo" && echo "[WARN] Using fallback repo name: repo" >&2

BASE_BRANCH="dev"

cmd="${1:-}"
branch="${2:-}"
wt_path="${3:-}"

branch_exists() {
    git branch -a 2>/dev/null | grep -qE "remotes/origin/$1|^\s+$1"
}

worktree_exists() {
    git worktree list 2>/dev/null | grep -q "$1"
}

new_worktree() {
    local br="$1"
    local path="$WORKTREE_BASE/$REPO_NAME-$br"
    echo "[INFO] Creating worktree for branch: $br"
    if worktree_exists "$br"; then
        echo "[WARN] Worktree for branch '$br' already exists" >&2
        read -r -p "Remove existing worktree and create new one? (y/N) " response
        if [[ "$response" == "y" || "$response" == "Y" ]]; then
            git worktree remove "$path" --force 2>/dev/null || true
        else
            echo "[INFO] Using existing worktree at: $path"
            echo "$path"
            return 0
        fi
    fi
    (cd "$REPO_DIR" && {
        if ! branch_exists "$br"; then
            echo "[INFO] Branch '$br' does not exist, creating from $BASE_BRANCH"
            git checkout "$BASE_BRANCH"
            git pull origin "$BASE_BRANCH" 2>/dev/null || true
            git checkout -b "$br"
        else
            echo "[INFO] Branch '$br' exists, checking it out"
            git fetch origin
            if git branch | grep -qE "^\s+$br"; then
                git checkout "$br"
            else
                git checkout -b "$br" "origin/$br"
            fi
        fi
        git worktree add "$path" "$br"
    })
    echo "[INFO] Worktree created at: $path"
    echo "$path"
}

get_worktrees() {
    echo "[INFO] Current worktrees:"
    git worktree list
}

remove_worktree() {
    local br="$1"
    local path="$WORKTREE_BASE/$REPO_NAME-$br"
    [[ -d "$path" ]] || { echo "[ERROR] Worktree path does not exist: $path"; exit 1; }
    echo "[INFO] Removing worktree: $path"
    git worktree remove "$path"
    echo "[INFO] Worktree removed"
}

sync_dev() {
    local path="$1"
    [[ -d "$path" ]] || { echo "[ERROR] Worktree path does not exist: $path"; exit 1; }
    echo "[INFO] Syncing with $BASE_BRANCH branch..."
    (cd "$path" && git fetch origin && git merge "origin/$BASE_BRANCH" || echo "[WARN] Merge conflicts detected. Please resolve manually." >&2)
    echo "[INFO] Sync completed"
}

show_help() {
    echo "Git Worktree Management Script (shell)"
    echo ""
    echo "Usage: ./setup_worktree.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  create <branch-name>  Create a new worktree for the branch"
    echo "  list                  List all existing worktrees"
    echo "  remove <branch-name>  Remove a worktree"
    echo "  sync <worktree-path>  Sync worktree with dev branch"
    echo ""
    echo "Examples:"
    echo "  ./setup_worktree.sh create 005-multi-timeframe-overlay"
    echo "  ./setup_worktree.sh list"
    echo "  ./setup_worktree.sh remove 005-multi-timeframe-overlay"
    echo "  ./setup_worktree.sh sync ../my-project-005-multi-timeframe-overlay"
    echo ""
    echo "Note: Worktrees are created in the parent directory of the repository"
    echo "      Path format: {parent-dir}/{repo-name}-{branch-name}"
    echo "      Repo name = directory name of repo root (override with REPO_NAME env var)"
}

case "$cmd" in
    create)
        [[ -z "$branch" ]] && { echo "[ERROR] Branch name required"; echo "Usage: ./setup_worktree.sh create <branch-name>"; exit 1; }
        result="$(new_worktree "$branch")"
        echo ""
        echo "[INFO] Worktree setup complete!"
        echo "[INFO] To switch to worktree, run:"
        echo "  cd $result"
        ;;
    list) get_worktrees ;;
    remove)
        [[ -z "$branch" ]] && { echo "[ERROR] Branch name required"; echo "Usage: ./setup_worktree.sh remove <branch-name>"; exit 1; }
        remove_worktree "$branch"
        ;;
    sync)
        [[ -z "$wt_path" ]] && { echo "[ERROR] Worktree path required"; echo "Usage: ./setup_worktree.sh sync <worktree-path>"; exit 1; }
        sync_dev "$wt_path"
        ;;
    *) show_help ;;
esac
