#!/usr/bin/env bash
# update-agent-context.sh - Update agent context files from plan.md (WSL/Linux/macOS)
# 与 powershell/update-agent-context.ps1 完整功能对等（16 种 agent）
#
# Usage: ./update-agent-context.sh [claude|gemini|copilot|cursor-agent|qwen|opencode|codex|windsurf|kilocode|auggie|roo|codebuddy|amp|shai|q|bob]
#   Omit AgentType to update all existing agent files

set -e

VALID_AGENTS="claude|gemini|copilot|cursor-agent|qwen|opencode|codex|windsurf|kilocode|auggie|roo|codebuddy|amp|shai|q|bob"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

AGENT_TYPE="${1:-}"

# Validate agent type if provided
if [[ -n "$AGENT_TYPE" ]] && ! echo "$AGENT_TYPE" | grep -qE "^($VALID_AGENTS)$"; then
    echo "ERROR: Unknown agent type '$AGENT_TYPE'"
    echo "Expected: $VALID_AGENTS"
    exit 1
fi

eval "$(get_feature_paths_env | sed 's/^/export /')"
test_feature_branch "$CURRENT_BRANCH" "$HAS_GIT" || exit 1

# Paths (16 agents, same as update-agent-context.ps1)
TEMPLATE="$REPO_ROOT/.specify/templates/agent-file-template.md"
CLAUDE_FILE="$REPO_ROOT/CLAUDE.md"
GEMINI_FILE="$REPO_ROOT/GEMINI.md"
COPILOT_FILE="$REPO_ROOT/.github/agents/copilot-instructions.md"
CURSOR_FILE="$REPO_ROOT/.cursor/rules/specify-rules.mdc"
QWEN_FILE="$REPO_ROOT/QWEN.md"
AGENTS_FILE="$REPO_ROOT/AGENTS.md"
WINDSURF_FILE="$REPO_ROOT/.windsurf/rules/specify-rules.md"
KILOCODE_FILE="$REPO_ROOT/.kilocode/rules/specify-rules.md"
AUGGIE_FILE="$REPO_ROOT/.augment/rules/specify-rules.md"
ROO_FILE="$REPO_ROOT/.roo/rules/specify-rules.md"
CODEBUDDY_FILE="$REPO_ROOT/CODEBUDDY.md"
SHAI_FILE="$REPO_ROOT/SHAI.md"

[[ -n "$CURRENT_BRANCH" ]] || { echo "ERROR: Unable to determine current feature"; exit 1; }
[[ -f "$IMPL_PLAN" ]] || { echo "ERROR: No plan.md found at $IMPL_PLAN"; exit 1; }
[[ -f "$TEMPLATE" ]] || { echo "ERROR: Template not found at $TEMPLATE. Run specify init."; exit 1; }

# Parse plan.md
extract_field() {
    grep -E "^\*\*$1\*\*:" "$IMPL_PLAN" 2>/dev/null | sed -E 's/^[^:]+:[[:space:]]*//' | head -1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

NEW_LANG="$(extract_field 'Language/Version')"
NEW_FRAMEWORK="$(extract_field 'Primary Dependencies')"
NEW_DB="$(extract_field 'Storage')"
NEW_PROJECT_TYPE="$(extract_field 'Project Type')"

# Filter invalid values
[[ "$NEW_LANG" == "NEEDS CLARIFICATION" || "$NEW_LANG" == "N/A" ]] && NEW_LANG=""
[[ "$NEW_FRAMEWORK" == "NEEDS CLARIFICATION" || "$NEW_FRAMEWORK" == "N/A" ]] && NEW_FRAMEWORK=""
[[ "$NEW_DB" == "N/A" || "$NEW_DB" == "NEEDS CLARIFICATION" ]] && NEW_DB=""

PROJECT_NAME="$(basename "$REPO_ROOT")"
DATE="$(date +%Y-%m-%d)"

# Tech stack string
TECH_STACK=""
[[ -n "$NEW_LANG" && -n "$NEW_FRAMEWORK" ]] && TECH_STACK="$NEW_LANG + $NEW_FRAMEWORK ($CURRENT_BRANCH)"
[[ -z "$TECH_STACK" ]] && [[ -n "$NEW_LANG" ]] && TECH_STACK="$NEW_LANG ($CURRENT_BRANCH)"
[[ -z "$TECH_STACK" ]] && [[ -n "$NEW_FRAMEWORK" ]] && TECH_STACK="$NEW_FRAMEWORK ($CURRENT_BRANCH)"

# Project structure (use $'...' for newlines in sed)
[[ "$NEW_PROJECT_TYPE" == *"web"* ]] && PROJECT_STRUCTURE=$'backend/\nfrontend/\ntests/' || PROJECT_STRUCTURE=$'src/\ntests/'

# Commands by language
case "$NEW_LANG" in
    *Python*) COMMANDS="cd src; pytest; ruff check ." ;;
    *Rust*) COMMANDS="cargo test; cargo clippy" ;;
    *JavaScript*|*TypeScript*) COMMANDS="npm test; npm run lint" ;;
    *) COMMANDS="# Add commands for $NEW_LANG" ;;
esac

# Recent changes
RECENT="- ${CURRENT_BRANCH}: Added ${TECH_STACK:-$NEW_LANG$NEW_FRAMEWORK$NEW_DB}"

create_agent_file() {
    local target="$1"
    local name="$2"
    mkdir -p "$(dirname "$target")"
    if [[ ! -f "$target" ]]; then
        content="$(sed -e "s/\[PROJECT NAME\]/$PROJECT_NAME/g" \
            -e "s/\[DATE\]/$DATE/g" \
            -e "s/\[EXTRACTED FROM ALL PLAN.MD FILES\]/${TECH_STACK:-$CURRENT_BRANCH}/g" \
            -e "s|\[ACTUAL STRUCTURE FROM PLANS\]|$PROJECT_STRUCTURE|g" \
            -e "s|\[ONLY COMMANDS FOR ACTIVE TECHNOLOGIES\]|$COMMANDS|g" \
            -e "s/\[LAST 3 FEATURES AND WHAT THEY ADDED\]/$RECENT/g" \
            "$TEMPLATE" 2>/dev/null)" || content="$(cat "$TEMPLATE")"
        echo "$content" > "$target"
        echo "Created new $name context file"
    else
        grep -q "($CURRENT_BRANCH)" "$target" 2>/dev/null || {
            [[ -n "$TECH_STACK" ]] && sed -i.bak "/## Active Technologies/a - $TECH_STACK" "$target" && rm -f "${target}.bak"
            sed -i.bak "/## Recent Changes/a $RECENT" "$target" && rm -f "${target}.bak"
        }
        sed -i.bak "s/\*\*Last updated\*\*:.*/\*\*Last updated\*\*: $DATE/" "$target" && rm -f "${target}.bak"
        echo "Updated existing $name context file"
    fi
}

update_specific() {
    case "$AGENT_TYPE" in
        claude) create_agent_file "$CLAUDE_FILE" "Claude Code" ;;
        gemini) create_agent_file "$GEMINI_FILE" "Gemini CLI" ;;
        copilot) create_agent_file "$COPILOT_FILE" "GitHub Copilot" ;;
        cursor-agent) create_agent_file "$CURSOR_FILE" "Cursor IDE" ;;
        qwen) create_agent_file "$QWEN_FILE" "Qwen Code" ;;
        opencode) create_agent_file "$AGENTS_FILE" "opencode" ;;
        codex) create_agent_file "$AGENTS_FILE" "Codex CLI" ;;
        windsurf) create_agent_file "$WINDSURF_FILE" "Windsurf" ;;
        kilocode) create_agent_file "$KILOCODE_FILE" "Kilo Code" ;;
        auggie) create_agent_file "$AUGGIE_FILE" "Auggie CLI" ;;
        roo) create_agent_file "$ROO_FILE" "Roo Code" ;;
        codebuddy) create_agent_file "$CODEBUDDY_FILE" "CodeBuddy CLI" ;;
        amp) create_agent_file "$AGENTS_FILE" "Amp" ;;
        shai) create_agent_file "$SHAI_FILE" "SHAI" ;;
        q) create_agent_file "$AGENTS_FILE" "Amazon Q Developer CLI" ;;
        bob) create_agent_file "$AGENTS_FILE" "IBM Bob" ;;
        *) echo "ERROR: Unknown agent type '$AGENT_TYPE'"; exit 1 ;;
    esac
}

update_all() {
    local found=false
    [[ -f "$CLAUDE_FILE" ]] && { create_agent_file "$CLAUDE_FILE" "Claude Code"; found=true; }
    [[ -f "$GEMINI_FILE" ]] && { create_agent_file "$GEMINI_FILE" "Gemini CLI"; found=true; }
    [[ -f "$COPILOT_FILE" ]] && { create_agent_file "$COPILOT_FILE" "GitHub Copilot"; found=true; }
    [[ -f "$CURSOR_FILE" ]] && { create_agent_file "$CURSOR_FILE" "Cursor IDE"; found=true; }
    [[ -f "$QWEN_FILE" ]] && { create_agent_file "$QWEN_FILE" "Qwen Code"; found=true; }
    [[ -f "$AGENTS_FILE" ]] && { create_agent_file "$AGENTS_FILE" "Codex/opencode"; found=true; }
    [[ -f "$WINDSURF_FILE" ]] && { create_agent_file "$WINDSURF_FILE" "Windsurf"; found=true; }
    [[ -f "$KILOCODE_FILE" ]] && { create_agent_file "$KILOCODE_FILE" "Kilo Code"; found=true; }
    [[ -f "$AUGGIE_FILE" ]] && { create_agent_file "$AUGGIE_FILE" "Auggie CLI"; found=true; }
    [[ -f "$ROO_FILE" ]] && { create_agent_file "$ROO_FILE" "Roo Code"; found=true; }
    [[ -f "$CODEBUDDY_FILE" ]] && { create_agent_file "$CODEBUDDY_FILE" "CodeBuddy CLI"; found=true; }
    [[ -f "$SHAI_FILE" ]] && { create_agent_file "$SHAI_FILE" "SHAI"; found=true; }
    if ! $found; then
        echo "No existing agent files found, creating default Claude file..."
        create_agent_file "$CLAUDE_FILE" "Claude Code"
    fi
}

echo "INFO: === Updating agent context files for feature $CURRENT_BRANCH ==="
[[ -n "$NEW_LANG" ]] && echo "INFO: Found language: $NEW_LANG"
[[ -n "$NEW_FRAMEWORK" ]] && echo "INFO: Found framework: $NEW_FRAMEWORK"

if [[ -n "$AGENT_TYPE" ]]; then
    update_specific
else
    update_all
fi

echo ""
echo "INFO: Summary: - Added language: $NEW_LANG - Added framework: $NEW_FRAMEWORK"
echo "INFO: Usage: ./update-agent-context.sh [claude|gemini|copilot|cursor-agent|qwen|...]"
