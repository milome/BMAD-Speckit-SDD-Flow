#!/usr/bin/env bash
# Sync BMAD-METHOD to _bmad (WSL/Linux/macOS)
# 与 scripts/bmad-sync-from-v6.ps1 功能对等
#
# Usage: ./scripts/bmad-sync-from-v6.sh [-Phase 1|2|3|all] [-DryRun] [-BackupDir <path>] [-ProjectRoot <path>] [-V6Ref 21c2a48]
# Default V6Ref=21c2a48: pre-#2050 layout (src/core, src/bmm, src/utility). Use 'main' for current v6 (requires layout migration).

set -e

# 排除项清单见 docs/explanation/upstream-relationship.md §4.1
# 需定期与上游 merge 的项见 §4.2（临时移除排除→合并→恢复排除）
BMAD_METHOD_REPO="https://github.com/bmad-code-org/BMAD-METHOD.git"
V6_REF="${V6_REF:-21c2a48}"

EXCLUDE_PATTERNS=(
    "_bmad/_config/eval-lifecycle-report-paths.yaml"
    "_bmad/_config/bmad-help.csv"
    "_bmad/_config/skill-command-mapping.yaml"
    "_bmad/cursor/skills/bmad-story-assistant"
    "_bmad/bmm/module-help.csv"
    "_bmad/bmm/workflows/4-implementation/bmad-code-review"
    "_bmad/bmm/workflows/4-implementation/create-story"
    "_bmad/bmm/workflows/bmad-quick-flow/bmad-quick-dev-new-preview"
    "_bmad/core/tasks/help.md"
    "_bmad/skills/bmad-help"
    "_bmad/commands/bmad-agent-bmm-tech-writer.md"
    "_bmad/commands/bmad-bmm-create-story.md"
    "_bmad/commands/bmad-sft-extract.md"
    "_bmad/scoring"
    "_bmad/core/agents/adversarial-reviewer.md"
    "_bmad/core/agents/critical-auditor-guide.md"
    "_bmad/core/agents/README-critical-auditor.md"
    "_bmad/speckit"
    "_bmad/_config/agent-manifest.csv"
    "_bmad/core/workflows/party-mode"
    "adversarial-reviewer.md"
    "critical-auditor-guide.md"
    "README-critical-auditor.md"
    "bmad-speckit"
    "agent-manifest.csv"
)

BACKUP_ITEMS=(
    "_bmad/_config/eval-lifecycle-report-paths.yaml:eval-lifecycle-report-paths.yaml"
    "_bmad/_config/bmad-help.csv:bmad-help.csv"
    "_bmad/_config/skill-command-mapping.yaml:skill-command-mapping.yaml"
    "_bmad/cursor/skills/bmad-story-assistant:bmad-story-assistant-skill"
    "_bmad/bmm/module-help.csv:bmm-module-help.csv"
    "_bmad/bmm/workflows/4-implementation/bmad-code-review:bmad-code-review-workflow"
    "_bmad/bmm/workflows/4-implementation/create-story:create-story-workflow"
    "_bmad/bmm/workflows/bmad-quick-flow/bmad-quick-dev-new-preview:bmad-quick-dev-new-preview"
    "_bmad/core/tasks/help.md:core-tasks-help.md"
    "_bmad/skills/bmad-help:bmad-help-skill"
    "_bmad/commands/bmad-agent-bmm-tech-writer.md:bmad-agent-bmm-tech-writer.md"
    "_bmad/commands/bmad-bmm-create-story.md:bmad-bmm-create-story.md"
    "_bmad/commands/bmad-sft-extract.md:bmad-sft-extract.md"
    "_bmad/scoring:_bmad_scoring"
    "_bmad/core/agents/adversarial-reviewer.md:adversarial-reviewer.md"
    "_bmad/core/agents/critical-auditor-guide.md:critical-auditor-guide.md"
    "_bmad/core/agents/README-critical-auditor.md:README-critical-auditor.md"
    "_bmad/speckit:bmad_speckit"
    "_bmad/_config/agent-manifest.csv:agent-manifest.csv"
    "_bmad/core/workflows/party-mode:party-mode-workflow"
)

PHASE="1"
DRY_RUN=false
BACKUP_DIR=""
PROJECT_ROOT=""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [[ $# -gt 0 ]]; do
    case $1 in
        -Phase) PHASE="$2"; shift 2 ;;
        -DryRun) DRY_RUN=true; shift ;;
        -BackupDir) BACKUP_DIR="$2"; shift 2 ;;
        -ProjectRoot) PROJECT_ROOT="$2"; shift 2 ;;
        -V6Ref) V6_REF="$2"; shift 2 ;;
        *) shift ;;
    esac
done

# Resolve PROJECT_ROOT
[[ -z "$PROJECT_ROOT" ]] && PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || true
[[ -z "$PROJECT_ROOT" ]] && PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"

# Resolve BACKUP_DIR
if [[ -z "$BACKUP_DIR" ]]; then
    TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
    RAND="$(openssl rand -hex 2 2>/dev/null || printf '%04x' $RANDOM)"
    BACKUP_DIR="$PROJECT_ROOT/_bmad-output/bmad-sync-backups/$TIMESTAMP-$RAND"
fi
[[ "${BACKUP_DIR:0:1}" != "/" ]] && BACKUP_DIR="$PROJECT_ROOT/$BACKUP_DIR"

test_excluded() {
    local rel="$1"
    rel="${rel//\\//}"
    for p in "${EXCLUDE_PATTERNS[@]}"; do
        if [[ "$rel" == *"$p"* ]] || [[ "$rel" == "$p"* ]]; then
            return 0
        fi
    done
    return 1
}

fetch_v6() {
    local tmp
    tmp="$(mktemp -d)"
    if [[ "$V6_REF" =~ ^[0-9a-f]{7,40}$ ]]; then
        # Commit SHA: clone main with depth, then checkout
        ( cd "$tmp" && git clone --depth 300 --branch main "$BMAD_METHOD_REPO" . && git checkout "$V6_REF" ) || {
            echo "git clone/checkout failed for V6Ref=$V6_REF"; rm -rf "$tmp"; exit 1;
        }
    else
        ( cd "$tmp" && git clone --depth 1 --branch "$V6_REF" "$BMAD_METHOD_REPO" . ) || {
            echo "git clone failed for V6Ref=$V6_REF"; rm -rf "$tmp"; exit 1;
        }
    fi
    [[ -d "$tmp/src" ]] || { echo "v6 source layout changed: src/ not found."; rm -rf "$tmp"; exit 1; }
    echo "$tmp"
}

do_backup() {
    mkdir -p "$BACKUP_DIR"
    for item in "${BACKUP_ITEMS[@]}"; do
        local from="${item%%:*}" to="${item#*:}"
        local src="$PROJECT_ROOT/$from" dst="$BACKUP_DIR/$to"
        if [[ -e "$src" ]]; then
            mkdir -p "$(dirname "$dst")"
            cp -Rf "$src" "$dst"
            echo "  Backed up: $from -> $dst"
        fi
    done
}

phase1_ops() {
    local step04="$PROJECT_ROOT/_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md"
    if [[ -f "$step04" ]] && grep -q '_bmad/core/tasks/help\.md' "$step04" 2>/dev/null; then
        sed -i.bak 's|`_bmad/core/tasks/help\.md`|`{project-root}/_bmad/core/tasks/help.md`|g' "$step04"
        rm -f "${step04}.bak"
        echo "  Modified: $step04"
    fi
}

phase2_ops() {
    local v6_root
    v6_root="$(fetch_v6)"
    trap "rm -rf '$v6_root'" EXIT
    local v6_src="$v6_root/src"

    for dir in core bmm utility; do
        local src_dir="$v6_src/$dir"
        [[ -d "$src_dir" ]] || continue
        while IFS= read -r -d '' f; do
            rel="${f#$src_dir/}"
            rel="${rel//\\//}"
            dest_rel="_bmad/$dir/$rel"
            if ! test_excluded "$dest_rel"; then
                dest="$PROJECT_ROOT/$dest_rel"
                mkdir -p "$(dirname "$dest")"
                cp -f "$f" "$dest"
                echo "  Copied: $dest_rel"
            fi
        done < <(find "$src_dir" -type f -print0 2>/dev/null)
    done

    # Auto-sync _bmad/core/skills/ -> _bmad/skills/ (universal skill distribution); _bmad/skills/ is canonical
    local core_skills="$PROJECT_ROOT/_bmad/core/skills"
    local dist_skills="$PROJECT_ROOT/_bmad/skills"
    if [[ -d "$core_skills" ]]; then
        mkdir -p "$dist_skills"
        cp -Rf "$core_skills"/* "$dist_skills/"
        echo "  Skill sync: _bmad/core/skills/ -> _bmad/skills/"
        rm -rf "$core_skills"
        echo "  Removed redundant: _bmad/core/skills/ (_bmad/skills/ is canonical)"
    fi
}

echo "BMAD-METHOD v6 Sync | Phase=$PHASE | DryRun=$DRY_RUN | ProjectRoot=$PROJECT_ROOT"

# Backup
if $DRY_RUN; then
    echo "[DryRun] Backups to perform:"
    for item in "${BACKUP_ITEMS[@]}"; do
        from="${item%%:*}"
        [[ -e "$PROJECT_ROOT/$from" ]] && echo "  Backup: $from"
    done
else
    do_backup
fi

# Phase ops
if $DRY_RUN; then
    echo "[DryRun] Phase operations (summary)"
    [[ "$PHASE" == "1" || "$PHASE" == "all" ]] && echo "  Phase 1: step-04 path fix"
    [[ "$PHASE" == "2" || "$PHASE" == "all" ]] && echo "  Phase 2: copy core,bmm,utility from v6 (excluding protected)"
    echo "[DryRun] Done. No files modified."
else
    [[ "$PHASE" == "1" || "$PHASE" == "all" ]] && phase1_ops
    [[ "$PHASE" == "2" || "$PHASE" == "all" ]] && phase2_ops
fi

echo ""
echo "--- Rollback: restore from $BACKUP_DIR ---"
echo "  cp -Rf $BACKUP_DIR/* $PROJECT_ROOT/"
echo "---"
