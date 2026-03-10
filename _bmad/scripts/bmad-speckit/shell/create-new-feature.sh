#!/usr/bin/env bash
# Create new feature - 与 create-new-feature.ps1 完整功能对等
# 支持 -CreateBranch, -CreateWorktree, BMAD 模式完整逻辑
# Usage: ./create-new-feature.sh [-ModeBmad] [-Epic N] [-Story N] [-Slug xxx] [-CreateBranch] [-CreateWorktree] ...

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT=""
MODE_BMAD=false
EPIC=0
STORY=0
SLUG=""
SHORT_NAME=""
NUMBER=0
JSON=false
CREATE_BRANCH=""
CREATE_WORKTREE=""
FEATURE_DESC=""

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        -ModeBmad) MODE_BMAD=true; shift ;;
        -Epic) EPIC="$2"; shift 2 ;;
        -Story) STORY="$2"; shift 2 ;;
        -Slug) SLUG="$2"; shift 2 ;;
        -ShortName) SHORT_NAME="$2"; shift 2 ;;
        -Number) NUMBER="$2"; shift 2 ;;
        -Json) JSON=true; shift ;;
        -CreateBranch) CREATE_BRANCH=true; shift ;;
        -CreateWorktree) CREATE_WORKTREE=true; shift ;;
        -Help|-h)
            echo "Usage: create-new-feature.sh [-ModeBmad] [-Epic N] [-Story N] [-Slug name] [-CreateBranch] [-CreateWorktree] [-ShortName name] [-Number N] [description]"
            echo "  -CreateBranch    Create git branch (BMAD: default off; standalone: default on)"
            echo "  -CreateWorktree Create worktree via setup_worktree.sh (BMAD: default off)"
            exit 0 ;;
        *) FEATURE_DESC="$FEATURE_DESC $1"; shift ;;
    esac
done
FEATURE_DESC="$(echo "$FEATURE_DESC" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

# Find repo root
find_repo_root() {
    local root
    root="$(git rev-parse --show-toplevel 2>/dev/null)" && echo "$root" && return 0
    local cur="$SCRIPT_DIR"
    while [[ -n "$cur" ]]; do
        [[ -d "$cur/.git" ]] && echo "$cur" && return 0
        [[ -d "$cur/.specify" ]] && echo "$cur" && return 0
        cur="$(dirname "$cur")"
        [[ "$cur" == "/" ]] && break
    done
    return 1
}

REPO_ROOT="$(find_repo_root)" || { echo "Error: Could not determine repository root."; exit 1; }
cd "$REPO_ROOT"

HAS_GIT=false
git rev-parse --show-toplevel &>/dev/null && HAS_GIT=true || true

# Default CreateBranch/CreateWorktree
if ! $HAS_GIT; then
    CREATE_BRANCH=false
    CREATE_WORKTREE=false
elif $MODE_BMAD; then
    [[ -z "$CREATE_BRANCH" ]] && CREATE_BRANCH=false
    [[ -z "$CREATE_WORKTREE" ]] && CREATE_WORKTREE=false
else
    [[ -z "$CREATE_BRANCH" ]] && CREATE_BRANCH=true
fi

to_kebab() {
    echo "$1" | sed -E 's/[^a-zA-Z0-9]+/-/g' | sed -E 's/^-|-$//g' | tr '[:upper:]' '[:lower:]'
}

# Get epic slug from config or epics.md
get_epic_slug() {
    local root="$1" epic="$2" has_git="$3" slug="" line
    local config="$root/_bmad-output/config/epic-$epic.json"
    if [[ -f "$config" ]]; then
        slug="$(python3 -c "
import json,sys
p=sys.argv[1]
try:
    with open(p) as f:
        j = json.load(f)
        print(j.get('slug') or j.get('name') or '')
except: pass
" "$config" 2>/dev/null)" || true
        [[ -n "$slug" ]] && echo "$(to_kebab "$slug")" && return
    fi
    if $has_git; then
        local branch; branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" || branch="dev"
        branch="${branch//\//-}"
        [[ -z "$branch" || "$branch" == "HEAD" ]] && branch="dev"
        for b in "$branch" "dev"; do
            local ep="$root/_bmad-output/planning-artifacts/$b/epics.md"
            [[ -f "$ep" ]] || continue
            line="$(grep -E "^\s*#{2,3}\s+Epic\s+$epic\s*[:\uff1a]\s*.+" "$ep" 2>/dev/null | head -1)"
            [[ -n "$line" ]] && line="$(echo "$line" | sed -E 's/.*[:\uff1a]\s*(.+)$/\1/' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
            [[ -n "$line" ]] && echo "$(to_kebab "$line")" && return
        done
    fi
}

# Get story slug from config or epics.md
get_story_slug() {
    local root="$1" epic="$2" story="$3" has_git="$4" slug="" line
    local config="$root/_bmad-output/config/epic-$epic.json"
    if [[ -f "$config" ]]; then
        slug="$(python3 -c "
import json,sys
p=sys.argv[1]
idx=int(sys.argv[2])
try:
    with open(p) as f:
        j = json.load(f)
        stories = j.get('stories') or []
        if isinstance(stories, list) and 1 <= idx <= len(stories):
            s = stories[idx - 1]
            if isinstance(s, dict):
                print(s.get('slug') or s.get('title') or '')
except: pass
" "$config" "$story" 2>/dev/null)" || true
        [[ -n "$slug" ]] && echo "$(to_kebab "$slug")" && return
    fi
    if $has_git; then
        local branch; branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" || branch="dev"
        branch="${branch//\//-}"
        [[ -z "$branch" || "$branch" == "HEAD" ]] && branch="dev"
        for b in "$branch" "dev"; do
            local ep="$root/_bmad-output/planning-artifacts/$b/epics.md"
            [[ -f "$ep" ]] || continue
            line="$(grep -E "^\s*###\s+Story\s+$epic\.$story\s*[:\uff1a]\s*.+" "$ep" 2>/dev/null | head -1)"
            [[ -n "$line" ]] && line="$(echo "$line" | sed -E 's/.*[:\uff1a]\s*(.+)$/\1/' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
            [[ -n "$line" ]] && echo "$(to_kebab "$line")" && return
        done
    fi
    echo "E${epic}-S${story}"
}

# Get epic dir name (prefer existing)
get_epic_dir_name() {
    local specs="$1" epic="$2" derived="$3" exact="epic-$epic"
    for d in "$specs"/*/; do
        [[ -d "$d" ]] || continue
        bn="$(basename "$d")"
        [[ "$bn" == "$exact" ]] && echo "$bn" && return
        [[ "$bn" == epic-$epic-* ]] && echo "$bn" && return
    done
    [[ -n "$derived" ]] && echo "epic-$epic-$derived" && return
    echo "$exact"
}

# Get next branch number (remote + local + specs)
get_next_branch_number() {
    local short="$1" specs="$2" max=0 n suffix
    git fetch --all --prune 2>/dev/null || true
    while read -r _ ref; do
        [[ -n "$ref" ]] || continue
        suffix="${ref#refs/heads/}"
        [[ "$suffix" == [0-9]*-$short ]] && n="${suffix%%-*}" && [[ $n -gt $max ]] && max=$n
    done < <(git ls-remote --heads origin 2>/dev/null || true)
    for br in $(git branch 2>/dev/null | sed 's/^[* ]*//'); do
        [[ "$br" == [0-9]*-$short ]] && n="${br%%-*}" && [[ $n -gt $max ]] && max=$n
    done
    for d in "$specs"/*/; do
        [[ -d "$d" ]] || continue
        bn="$(basename "$d")"
        [[ "$bn" == [0-9]*-$short ]] && n="${bn%%-*}" && [[ $n -gt $max ]] && max=$n
    done
    echo $((max + 1))
}

# Get branch name from description (stop words)
get_branch_name() {
    local desc="$1" stop=" i a an the to for of in on at by with from is are was were be been being have has had do does did will would should could can may might must shall this that these those my your our their want need add get set "
    local clean; clean="$(echo "$desc" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9[:space:]]/ /g')"
    local words=() w
    for w in $clean; do
        [[ "$stop" == *" $w "* ]] && continue
        [[ ${#w} -ge 3 ]] && words+=("$w")
    done
    [[ ${#words[@]} -gt 0 ]] && echo "$(IFS=-; echo "${words[*]:0:4}")" && return
    echo "$(to_kebab "$desc" | cut -d'-' -f1-3)"
}

SPECS_DIR="$REPO_ROOT/specs"
mkdir -p "$SPECS_DIR"

# BMAD mode
if $MODE_BMAD; then
    [[ $EPIC -gt 0 ]] && [[ $STORY -gt 0 ]] || { echo "BMAD mode requires -Epic N -Story N (N>=1)"; exit 1; }
    [[ -z "$SLUG" ]] && SLUG="$(get_story_slug "$REPO_ROOT" "$EPIC" "$STORY" "$HAS_GIT")"
    EPIC_SLUG="$(get_epic_slug "$REPO_ROOT" "$EPIC" "$HAS_GIT")"
    EPIC_DIR="$(get_epic_dir_name "$SPECS_DIR" "$EPIC" "$EPIC_SLUG")"
    TARGET_DIR="$SPECS_DIR/$EPIC_DIR"
    STORY_DIR="story-$STORY-$SLUG"
    FULL_PATH="$TARGET_DIR/$STORY_DIR"
    BRANCH_NAME="story-$EPIC-$STORY"
    mkdir -p "$FULL_PATH"
    echo "# Spec E${EPIC}-S${STORY}

*Generated by create-new-feature.sh -ModeBmad*" > "$FULL_PATH/spec-E${EPIC}-S${STORY}.md"

    # _bmad-output sync
    STORY_SUBDIR="$REPO_ROOT/_bmad-output/implementation-artifacts/$EPIC_DIR/$STORY_DIR"
    mkdir -p "$STORY_SUBDIR" && echo "[create-new-feature] Created _bmad-output subdir: $STORY_SUBDIR"

    # CreateBranch / CreateWorktree
    if $HAS_GIT; then
        BASE_BRANCH="dev"
        if $CREATE_BRANCH; then
            if ! git rev-parse --verify "$BRANCH_NAME" &>/dev/null; then
                CURRENT="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" || CURRENT="$BASE_BRANCH"
                git checkout -b "$BRANCH_NAME" "$BASE_BRANCH" 2>/dev/null && git checkout "$CURRENT" 2>/dev/null || echo "[WARN] Could not create branch $BRANCH_NAME"
            fi
        fi
        if $CREATE_WORKTREE; then
            WT_BRANCH="$BRANCH_NAME"
            if ! $CREATE_BRANCH; then
                WT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" || WT_BRANCH="detached-$(git rev-parse --short HEAD)"
                WT_BRANCH="${WT_BRANCH//\//-}"
            fi
            SETUP="$SCRIPT_DIR/setup_worktree.sh"
            [[ -f "$SETUP" ]] && "$SETUP" create "$WT_BRANCH" || echo "[WARN] setup_worktree.sh not found"
        fi
    fi
    if $JSON; then
        echo "{\"BRANCH_NAME\":\"$BRANCH_NAME\",\"SPEC_FILE\":\"$FULL_PATH/spec-E${EPIC}-S${STORY}.md\",\"SPEC_DIR\":\"$FULL_PATH\"}"
    else
        echo "BRANCH_NAME: $BRANCH_NAME"
        echo "SPEC_FILE: $FULL_PATH/spec-E${EPIC}-S${STORY}.md"
        echo "SPEC_DIR: $FULL_PATH"
    fi
    exit 0
fi

# Standalone mode
[[ -z "$SHORT_NAME" ]] && [[ -z "$FEATURE_DESC" ]] && { echo "Usage: create-new-feature.sh [-ShortName name] <description>"; exit 1; }

[[ -n "$SHORT_NAME" ]] && BRANCH_SUFFIX="$(to_kebab "$SHORT_NAME")" || BRANCH_SUFFIX="$(get_branch_name "$FEATURE_DESC")"

if [[ $NUMBER -eq 0 ]]; then
    $HAS_GIT && NUMBER="$(get_next_branch_number "$BRANCH_SUFFIX" "$SPECS_DIR")" || {
        HIGHEST=0
        for d in "$SPECS_DIR"/*/; do
            [[ -d "$d" ]] || continue
            bn="$(basename "$d")"
            [[ "$bn" =~ ^([0-9]+)- ]] && n="${BASH_REMATCH[1]}" && [[ $n -gt $HIGHEST ]] && HIGHEST=$n
        done
        NUMBER=$((HIGHEST + 1))
    }
fi

FEATURE_NUM="$(printf "%03d" "$NUMBER")"
BRANCH_NAME="$FEATURE_NUM-$BRANCH_SUFFIX"

# GitHub 244-byte limit
if [[ ${#BRANCH_NAME} -gt 244 ]]; then
    MAX_SUFFIX=240
    TRUNCATED="${BRANCH_SUFFIX:0:$MAX_SUFFIX}"
    TRUNCATED="${TRUNCATED%-}"
    BRANCH_NAME="$FEATURE_NUM-$TRUNCATED"
    echo "[WARN] Branch name truncated to 244 bytes: $BRANCH_NAME" >&2
fi

if $HAS_GIT && $CREATE_BRANCH; then
    git checkout -b "$BRANCH_NAME" 2>/dev/null || echo "[WARN] Failed to create branch $BRANCH_NAME"
elif $HAS_GIT && ! $CREATE_BRANCH; then
    echo "[create-new-feature] Skipped branch creation (use -CreateBranch). Branch name would be: $BRANCH_NAME"
fi

FEATURE_DIR="$SPECS_DIR/$BRANCH_NAME"
mkdir -p "$FEATURE_DIR"
TEMPLATE="$REPO_ROOT/.specify/templates/spec-template.md"
SPEC_FILE="$FEATURE_DIR/spec.md"
[[ -f "$TEMPLATE" ]] && cp "$TEMPLATE" "$SPEC_FILE" || touch "$SPEC_FILE"

export SPECIFY_FEATURE="$BRANCH_NAME"

if $JSON; then
    HG="false"; $HAS_GIT && HG="true"
    echo "{\"BRANCH_NAME\":\"$BRANCH_NAME\",\"SPEC_FILE\":\"$SPEC_FILE\",\"FEATURE_NUM\":\"$FEATURE_NUM\",\"HAS_GIT\":$HG}"
else
    echo "BRANCH_NAME: $BRANCH_NAME"
    echo "SPEC_FILE: $SPEC_FILE"
    echo "FEATURE_NUM: $FEATURE_NUM"
    echo "HAS_GIT: $HAS_GIT"
    echo "SPECIFY_FEATURE environment variable set to: $BRANCH_NAME"
fi
