#!/usr/bin/env bash
# Start Git Push in Background and Monitor Progress (shell)
# 与 start-push-with-monitor.ps1 功能对等
# Usage: ./start-push-with-monitor.sh [-b branch] [-r remote] [-m max_seconds] [-i interval]

set -e
BRANCH=""
REMOTE="origin"
MAX_WAIT=600
INTERVAL=5

while [[ $# -gt 0 ]]; do
    case $1 in
        -b|-BranchName) BRANCH="$2"; shift 2 ;;
        -r|-RemoteName) REMOTE="$2"; shift 2 ;;
        -m|-MaxWaitSeconds) MAX_WAIT="$2"; shift 2 ;;
        -i|-CheckInterval) INTERVAL="$2"; shift 2 ;;
        *) shift ;;
    esac
done

[[ -z "$BRANCH" ]] && BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" || true
[[ -z "$BRANCH" ]] && { echo "ERROR: Could not detect current branch. Please specify -BranchName"; exit 1; }

echo "=== Starting Git Push with Monitor ==="
echo "Branch: $BRANCH"
echo "Remote: $REMOTE"
echo ""

REMOTE_BR="$REMOTE/$BRANCH"
INITIAL_REMOTE="$(git rev-parse "$REMOTE_BR" 2>/dev/null)" || true
LOCAL="$(git rev-parse HEAD)"

if [[ -n "$INITIAL_REMOTE" ]] && [[ "$INITIAL_REMOTE" == "$LOCAL" ]]; then
    echo "INFO: Local and remote are already in sync. Nothing to push."
    exit 0
fi

echo "Starting git push in background..."
git push --set-upstream "$REMOTE" "$BRANCH" &
PUSH_PID=$!
echo "Push started (PID: $PUSH_PID)"
echo "Starting monitor..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITOR_SCRIPT="$SCRIPT_DIR/monitor-push.sh"
"$MONITOR_SCRIPT" -b "$BRANCH" -r "$REMOTE" -m "$MAX_WAIT" -i "$INTERVAL"
EXIT=$?

wait "$PUSH_PID" 2>/dev/null || true
exit "$EXIT"
