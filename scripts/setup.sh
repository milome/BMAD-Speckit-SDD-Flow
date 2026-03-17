#!/usr/bin/env bash
# BMAD-Speckit-SDD-Flow 一键安装脚本 (WSL/Linux/macOS)
# 与 scripts/setup.ps1 功能对等
#
# Usage: bash scripts/setup.sh -Target <path> [options]
#   -Target <path>  目标项目根目录（必须）
#   -Full           完整模式
#   -SkipSkills     跳过全局 Skills 安装
#   -DryRun         仅输出计划
#   -Help           显示帮助

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

REQUIRED_SKILLS=(speckit-workflow bmad-story-assistant bmad-bug-assistant bmad-code-reviewer-lifecycle code-review)
OPTIONAL_SKILLS=(bmad-standalone-tasks bmad-customization-backup bmad-orchestrator using-git-worktrees pr-template-generator auto-commit-utf8 git-push-monitor)

show_help() {
    echo "BMAD-Speckit-SDD-Flow setup script (shell)"
    echo "Usage: bash scripts/setup.sh -Target <path> [options]"
    echo "  -Target <path>    Target project root (required)"
    echo "  -Full             Full install mode"
    echo "  -SkipSkills       Skip global Skills install"
    echo "  -DryRun           Plan only, no execution"
    echo "  -Help             Show help"
    exit 0
}

TARGET=""
SKIP_SKILLS=false
DRY_RUN=false
FULL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -Target) TARGET="$2"; shift 2 ;;
        -SkipSkills) SKIP_SKILLS=true; shift ;;
        -DryRun) DRY_RUN=true; shift ;;
        -Full) FULL=true; shift ;;
        -Help|-h) show_help ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

[[ -z "$TARGET" ]] && { echo "Must specify -Target <path>"; exit 1; }

# Resolve target (support both abs and rel)
TARGET_RESOLVED="$TARGET"
if [[ -d "$TARGET" ]]; then
    TARGET_RESOLVED="$(cd "$TARGET" && pwd)"
fi

# Prerequisites (skip pwsh on Unix - we use shell)
if [[ "$DRY_RUN" != "true" ]]; then
    for cmd in node python3 git; do
        if ! command -v "$cmd" &>/dev/null; then
            echo "Missing prerequisite: $cmd"
            exit 1
        fi
    done
    if ! node -e "if(parseInt(process.versions.node.split('.')[0])<18)process.exit(1)" 2>/dev/null; then
        echo "Node.js >= 18 required"
        exit 1
    fi
fi

echo "=== BMAD-Speckit-SDD-Flow Setup (shell) ==="
echo "PKG_ROOT: $PKG_ROOT"
echo "Target:   $TARGET_RESOLVED"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DryRun] Plan:"
    echo "  1. node scripts/init-to-root.js --full $TARGET_RESOLVED"
    echo "  2. .cursor/ sync (via init-to-root)"
    if [[ "$SKIP_SKILLS" != "true" ]]; then
        echo "  3. Copy REQUIRED_SKILLS + OPTIONAL_SKILLS"
    else
        echo "  3. Skip Skills install"
    fi
    echo "  5. Run validation"
    exit 0
fi

# Step 1-2: init-to-root --full
echo "[1] Deploying core+extended dirs..."
node "$PKG_ROOT/scripts/init-to-root.js" --full "$TARGET_RESOLVED"
[[ $? -eq 0 ]] || { echo "init-to-root.js failed"; exit 1; }

# Step 3-4: Skills copy
SKILLS_ROOT="${HOME}/.cursor/skills"
if [[ "$SKIP_SKILLS" != "true" ]]; then
    mkdir -p "$SKILLS_ROOT"
    for skill in "${REQUIRED_SKILLS[@]}" "${OPTIONAL_SKILLS[@]}"; do
        SRC="$PKG_ROOT/skills/$skill"
        DEST="$SKILLS_ROOT/$skill"
        if [[ -d "$SRC" ]]; then
            echo "[2] Copy skill: $skill"
            cp -Rf "$SRC" "$DEST"
            [[ -f "$DEST/SKILL.md" ]] || echo "  Warning: $skill - SKILL.md not found after copy"
        else
            echo "  Skip (source missing): $skill"
        fi
    done
else
    echo "[2] Skip Skills install"
fi

# Step 5: Verification
echo ""
echo "=== Install Verification ==="

CHECKS=(
    "_bmad/core/workflows/party-mode/workflow.md:Party-Mode workflow"
    "_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml:Create Story workflow"
    "_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml:Dev Story workflow"
    "_bmad/_config/agent-manifest.csv:Agent manifest"
    "_bmad-output/config:_bmad-output/config dir"
    "commands/speckit.specify.md:speckit command"
    "commands/bmad-bmm-create-story.md:BMAD command"
    "rules/bmad-bug-auto-party-mode.mdc:rules"
    ".cursor/rules/bmad-bug-auto-party-mode.mdc:Cursor rules"
    ".cursor/commands/speckit.specify.md:Cursor speckit command"
    ".cursor/commands/bmad-bmm-create-story.md:Cursor BMAD command"
    ".cursor/agents/code-reviewer-config.yaml:Cursor Code Reviewer"
    "_bmad/_config/code-reviewer-config.yaml:Code Reviewer config"
    "templates/spec-template.md:Spec template"
    "workflows/specify.md:Specify workflow"
)

OK=0
MISSING=0
for item in "${CHECKS[@]}"; do
    path="${item%%:*}"
    desc="${item#*:}"
    full="$TARGET_RESOLVED/$path"
    if [[ -e "$full" ]]; then
        echo "  [OK] $desc"
        ((OK++)) || true
    else
        echo "  [MISSING] $desc ($path)"
        ((MISSING++)) || true
    fi
done

# Skills verification
for skill in speckit-workflow bmad-story-assistant bmad-bug-assistant bmad-code-reviewer-lifecycle code-review; do
    p="$SKILLS_ROOT/$skill/SKILL.md"
    if [[ -f "$p" ]]; then
        echo "  [OK] $skill"
        ((OK++)) || true
    elif [[ "$SKIP_SKILLS" == "true" ]]; then
        echo "  [SKIP] $skill (Skills skipped)"
    else
        echo "  [MISSING] $skill"
        ((MISSING++)) || true
    fi
done

echo ""
echo "OK: $OK | Missing: $MISSING"
[[ $MISSING -eq 0 ]] || { echo "Some items missing, check installation"; exit 1; }
echo "Install complete, all checks passed."
