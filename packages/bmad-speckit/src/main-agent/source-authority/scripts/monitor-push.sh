#!/usr/bin/env bash
# Git Push Monitor - 与 monitor-push.ps1 完整功能对等
# 供 Linux/macOS 使用（无 PowerShell 时）；等价于 git-push-monitor skill 的 monitor-push.ps1
# Usage: ./scripts/monitor-push.sh [-OutputFile path] [-BranchName branch] [-RemoteName origin] [-MaxWaitSeconds 600] [-CheckInterval 5]

set -e
OUTPUT_FILE=""
BRANCH=""
REMOTE="origin"
MAX_WAIT=600
INTERVAL=5

while [[ $# -gt 0 ]]; do
    case $1 in
        -OutputFile|-o) OUTPUT_FILE="$2"; shift 2 ;;
        -BranchName|-b) BRANCH="$2"; shift 2 ;;
        -RemoteName|-r) REMOTE="$2"; shift 2 ;;
        -MaxWaitSeconds|-m) MAX_WAIT="$2"; shift 2 ;;
        -CheckInterval|-i) INTERVAL="$2"; shift 2 ;;
        *) shift ;;
    esac
done

[[ -z "$BRANCH" ]] && BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" || true
[[ -z "$BRANCH" ]] && { echo "ERROR: Could not detect current branch. Please specify -BranchName"; exit 1; }
echo "Auto-detected branch: $BRANCH"

# Auto-detect output file: $HOME/.cursor/projects (WSL/Linux) or $USERPROFILE/.cursor/projects (when set)
if [[ -z "$OUTPUT_FILE" ]]; then
    CURSOR_BASE="${HOME}/.cursor/projects"
    [[ -n "$USERPROFILE" ]] && [[ -d "$USERPROFILE/.cursor/projects" ]] && CURSOR_BASE="$USERPROFILE/.cursor/projects"
    if [[ -d "$CURSOR_BASE" ]]; then
        RECENT="$(find "$CURSOR_BASE" -name "*.txt" -mmin -10 2>/dev/null | head -1)"
        [[ -n "$RECENT" ]] && OUTPUT_FILE="$RECENT" && echo "Auto-detected output file: $OUTPUT_FILE"
    fi
fi

echo "=== Git Push Status Monitor ==="
echo "Branch: $BRANCH"
[[ -n "$OUTPUT_FILE" ]] && echo "Output File: $OUTPUT_FILE"
echo "Max Wait: $MAX_WAIT seconds"
echo "Check Interval: $INTERVAL seconds"
echo ""

REMOTE_BR="$REMOTE/$BRANCH"
INITIAL_REMOTE="$(git rev-parse "$REMOTE_BR" 2>/dev/null)" || true
LOCAL="$(git rev-parse HEAD)"

echo "Initial State:"
echo "  Remote: $INITIAL_REMOTE"
echo "  Local:  $LOCAL"

if [[ -n "$INITIAL_REMOTE" ]] && [[ "$INITIAL_REMOTE" == "$LOCAL" ]]; then
    echo ""
    echo "Local and remote are already in sync!"
    echo "No push needed. Latest commits:"
    git log "$REMOTE_BR" --oneline -3
    exit 0
fi

echo ""
echo "Starting monitor..."
echo ""

ELAPSED=0
LAST_OUTPUT_TIME=0

while [[ $ELAPSED -lt $MAX_WAIT ]]; do
    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))

    CURR="$(git rev-parse "$REMOTE_BR" 2>/dev/null)" || true

    if [[ -n "$CURR" ]] && [[ "$CURR" != "$INITIAL_REMOTE" ]]; then
        echo ""
        echo "*** PUSH SUCCESS! Remote branch updated ***"
        echo "  Initial: $INITIAL_REMOTE"
        echo "  Current: $CURR"
        echo ""
        echo "Latest 3 commits:"
        git log "$REMOTE_BR" --oneline -3
        echo ""
        echo "Monitor complete!"
        exit 0
    fi

    # Check output file if provided (Linux: stat -c %Y; macOS: stat -f %m)
    if [[ -n "$OUTPUT_FILE" ]] && [[ -f "$OUTPUT_FILE" ]]; then
        MTIME=$(stat -c %Y "$OUTPUT_FILE" 2>/dev/null || stat -f %m "$OUTPUT_FILE" 2>/dev/null) || MTIME=0
        NOW=$(date +%s)
        DIFF=$((NOW - MTIME))
        if [[ $DIFF -lt 30 ]] || [[ $((ELAPSED - LAST_OUTPUT_TIME)) -ge 30 ]]; then
            LINES=$(tail -10 "$OUTPUT_FILE" 2>/dev/null)
            if [[ -n "$LINES" ]]; then
                echo ""
                echo "[${ELAPSED} sec] Latest output:"
                echo "$LINES" | while read -r line; do echo "  $line"; done
                LAST_OUTPUT_TIME=$ELAPSED
            fi
        fi
    fi

    # Status every 30 seconds
    if [[ $((ELAPSED % 30)) -eq 0 ]]; then
        echo "[${ELAPSED} sec] Checking... Remote: $CURR"
    fi
done

echo ""
echo "WARNING: Monitor timeout ($MAX_WAIT seconds)"
echo "Please check push status manually:"
echo "  git log $REMOTE_BR --oneline -5"
echo "  git log HEAD --oneline -5"

# Final check
FINAL="$(git rev-parse "$REMOTE_BR" 2>/dev/null)" || true
if [[ -n "$FINAL" ]] && [[ "$FINAL" != "$INITIAL_REMOTE" ]]; then
    echo ""
    echo "SUCCESS: Push actually completed!"
    git log "$REMOTE_BR" --oneline -3
    exit 0
else
    echo ""
    echo "ERROR: Push may not have completed, please check"
    exit 1
fi
