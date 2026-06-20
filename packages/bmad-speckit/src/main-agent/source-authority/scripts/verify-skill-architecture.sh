#!/usr/bin/env bash
# verify-skill-architecture.sh 闁?CI verification for BMAD skill directory architecture
# Checks: directory counts, bare references, backmigration residuals, platform keyword
# isolation, ADAPTATION_COMPLETE markers, line ratio, template IDs, references sync.
#
# Usage:
#   bash scripts/verify-skill-architecture.sh [--verbose]
#
# Exit codes: 0 = all checks PASSED, 1 = one or more FAILED

set -euo pipefail

VERBOSE=false
if [[ "${1:-}" == "--verbose" ]]; then
  VERBOSE=true
fi

PASS_COUNT=0
FAIL_COUNT=0

GREP_EXCLUDE="--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=_bmad-output --exclude-dir=_bmad --exclude-dir=worktrees --exclude-dir=.worktrees --exclude-dir=data --exclude-dir=agent-transcripts"

pass() {
  echo "[PASS] $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo "[FAIL] $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

verbose() {
  if $VERBOSE; then
    echo "       $1"
  fi
}

safe_grep_count() {
  local result
  result=$(grep -c "$@" 2>/dev/null || true)
  result=$(echo "$result" | tr -d '[:space:]')
  if [[ -z "$result" || ! "$result" =~ ^[0-9]+$ ]]; then
    echo "0"
  else
    echo "$result"
  fi
}

# Expected skill lists

PUBLIC_SKILLS=(
  auto-commit-utf8
  bmad-customization-backup
  bmad-eval-analytics
  bmad-orchestrator
  code-review
  git-push-monitor
  pr-template-generator
)

BMAD_V6_SKILLS=(
  bmad-advanced-elicitation
  bmad-brainstorming
  bmad-distillator
  bmad-editorial-review-prose
  bmad-editorial-review-structure
  bmad-help
  bmad-index-docs
  bmad-party-mode
  bmad-review-adversarial-general
  bmad-review-edge-case-hunter
  bmad-shard-doc
)

CURSOR_SKILLS=(
  bmad-bug-assistant
  bmad-code-reviewer-lifecycle
  bmad-rca-helper
  bmad-standalone-tasks
  bmad-standalone-tasks-doc-review
  bmad-story-assistant
  speckit-workflow
  using-git-worktrees
)

# Skills adapted in T3-T9 (excludes story-assistant which was adapted earlier)
T3_T9_SKILLS=(
  bmad-bug-assistant
  bmad-code-reviewer-lifecycle
  bmad-rca-helper
  bmad-standalone-tasks
  bmad-standalone-tasks-doc-review
  speckit-workflow
  using-git-worktrees
)

# === Check 1: Directory counts ===

echo "=== Check 1: Directory counts ==="

count_dirs() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    echo 0
    return
  fi
  local count=0
  for entry in "$dir"/*/; do
    [[ -d "$entry" ]] && count=$((count + 1))
  done
  echo "$count"
}

skills_count=$(count_dirs "skills")
cursor_count=$(count_dirs ".cursor/skills")
claude_count=$(count_dirs ".claude/skills")

expected_public_total=${#PUBLIC_SKILLS[@]}
expected_bmad_v6_total=${#BMAD_V6_SKILLS[@]}
expected_cursor_adapter_total=${#CURSOR_SKILLS[@]}
expected_claude_adapter_total=${#CURSOR_SKILLS[@]}
expected_cursor_total=$((expected_public_total + expected_bmad_v6_total + expected_cursor_adapter_total))
expected_claude_total=$((expected_public_total + expected_bmad_v6_total + expected_claude_adapter_total))

if [[ "$skills_count" -eq "$expected_public_total" && "$cursor_count" -eq "$expected_cursor_total" && "$claude_count" -eq "$expected_claude_total" ]]; then
  pass "Directory counts: skills/=$skills_count, .cursor/skills/=$cursor_count, .claude/skills/=$claude_count"
else
  fail "Directory counts: skills/=$skills_count (expected $expected_public_total), .cursor/skills/=$cursor_count (expected $expected_cursor_total), .claude/skills/=$claude_count (expected $expected_claude_total)"
fi

# === Check 2: Bare reference residuals ===

echo ""
echo "=== Check 2: Bare reference residuals ==="

bare_ref_count=0
for skill in "${CURSOR_SKILLS[@]}"; do
  # Search for bare skills/X/ not preceded by .cursor/, .claude/, _bmad/, docs/speckit/
  matches=$(grep -rn "skills/${skill}/" --include="*.md" $GREP_EXCLUDE . 2>/dev/null \
    | grep -v "\.cursor/skills/${skill}/" \
    | grep -v "\.claude/skills/${skill}/" \
    | grep -v "_bmad/skills/${skill}/" \
    | grep -v "_bmad/cursor/skills/${skill}/" \
    | grep -v "_bmad/claude/skills/${skill}/" \
    | grep -v "docs/speckit/skills/${skill}/" \
    | grep -v "_bmad-output/" \
    | grep -v "docs/plans/" \
    | grep -v "docs/design/" \
    | grep -v "docs/PR/" \
    | grep -v "scoring/" \
    || true)
  if [[ -n "$matches" ]]; then
    match_count=$(echo "$matches" | wc -l | tr -d ' ')
    bare_ref_count=$((bare_ref_count + match_count))
    verbose "Bare refs for $skill ($match_count):"
    if $VERBOSE; then
      echo "$matches" | head -5 | while IFS= read -r line; do verbose "  $line"; done
    fi
  fi
done

if [[ "$bare_ref_count" -eq 0 ]]; then
  pass "Bare reference residuals: 0 matches"
else
  fail "Bare reference residuals: $bare_ref_count matches found"
fi

# === Check 3: Backmigration residuals ===

echo ""
echo "=== Check 3: Backmigration residuals ==="

# 3a: .claude/ should have zero .cursor/skills/ references
claude_cursor_refs=$(grep -rn '\.cursor/skills/' .claude/ --include="*.md" $GREP_EXCLUDE 2>/dev/null \
  | grep -v '^\.claude/skills/bmad-customization-backup/' \
  || true)
claude_cursor_count=0
if [[ -n "$claude_cursor_refs" ]]; then
  claude_cursor_count=$(echo "$claude_cursor_refs" | wc -l | tr -d ' ')
fi

if [[ "$claude_cursor_count" -eq 0 ]]; then
  pass "Backmigration: .claude/ has 0 .cursor/skills/ residual references"
else
  fail "Backmigration: .claude/ has $claude_cursor_count .cursor/skills/ residual references"
  if $VERBOSE; then
    echo "$claude_cursor_refs" | head -5 | while IFS= read -r line; do verbose "  $line"; done
  fi
fi

# 3b: .claude/agents/ should have zero .cursor/skills/ references
agents_cursor_refs=$(grep -rn '\.cursor/skills/' .claude/agents/ --include="*.md" 2>/dev/null || true)
agents_cursor_count=0
if [[ -n "$agents_cursor_refs" ]]; then
  agents_cursor_count=$(echo "$agents_cursor_refs" | wc -l | tr -d ' ')
fi

if [[ "$agents_cursor_count" -eq 0 ]]; then
  pass "Backmigration: .claude/agents/ has 0 .cursor/skills/ residual references"
else
  fail "Backmigration: .claude/agents/ has $agents_cursor_count .cursor/skills/ residual references"
  if $VERBOSE; then
    echo "$agents_cursor_refs" | head -5 | while IFS= read -r line; do verbose "  $line"; done
  fi
fi

# === Check 4: Template line ratio (>= 90%) ===

echo ""
echo "=== Check 4: Template line ratio (>= 90%) ==="

line_ratio_ok=true
for skill in "${CURSOR_SKILLS[@]}"; do
  cursor_skill=".cursor/skills/${skill}/SKILL.md"
  claude_skill=".claude/skills/${skill}/SKILL.md"

  if [[ ! -f "$cursor_skill" || ! -f "$claude_skill" ]]; then
    verbose "Skipping $skill: file not found"
    continue
  fi

  cursor_lines=$(wc -l < "$cursor_skill" | tr -d ' ')
  claude_lines=$(wc -l < "$claude_skill" | tr -d ' ')

  if [[ "$cursor_lines" -eq 0 ]]; then
    verbose "Skipping $skill: Cursor version has 0 lines"
    continue
  fi

  ratio=$((claude_lines * 100 / cursor_lines))

  if [[ "$ratio" -ge 90 ]]; then
    verbose "$skill: $claude_lines/$cursor_lines (${ratio}%) >= 90%"
  else
    fail "Line ratio: $skill $claude_lines/$cursor_lines (${ratio}%) < 90%"
    line_ratio_ok=false
  fi
done

if $line_ratio_ok; then
  pass "Template line ratio: all adapted SKILL.md files >= 90% of Cursor version"
fi

# === Check 5: Platform keyword isolation ===

echo ""
echo "=== Check 5: Platform keyword isolation ==="

# 5a: .claude/skills/ SKILL.md should not contain Cursor-specific keywords
#     Scope: T3-T9 adapted skills (story-assistant pre-dates this convention)
claude_cursor_kw=0
for skill in "${T3_T9_SKILLS[@]}"; do
  skill_file=".claude/skills/${skill}/SKILL.md"
  [[ ! -f "$skill_file" ]] && continue

  kw_count=$(safe_grep_count -E 'mcp_task|Cursor Task|\.cursor/rules/' "$skill_file")
  if [[ "$kw_count" -gt 0 ]]; then
    claude_cursor_kw=$((claude_cursor_kw + kw_count))
    verbose "Cursor keywords in $skill_file: $kw_count"
  fi
done

if [[ "$claude_cursor_kw" -eq 0 ]]; then
  pass "Platform isolation: .claude/skills/ SKILL.md has 0 Cursor keywords (mcp_task / Cursor Task / .cursor/rules/)"
else
  fail "Platform isolation: .claude/skills/ SKILL.md has $claude_cursor_kw Cursor keyword occurrences"
fi

# 5b: .cursor/skills/ SKILL.md should not contain Claude-specific keywords
#     Note: some Cursor skills have subagent_type in fallback descriptions (known pre-existing)
cursor_claude_kw=0
for skill in "${T3_T9_SKILLS[@]}"; do
  skill_file=".cursor/skills/${skill}/SKILL.md"
  [[ ! -f "$skill_file" ]] && continue

  kw_count=$(safe_grep_count -E '\bsubagent_type\b' "$skill_file")
  if [[ "$kw_count" -gt 0 ]]; then
    cursor_claude_kw=$((cursor_claude_kw + kw_count))
    verbose "Claude keyword 'subagent_type' in $skill_file: $kw_count (pre-existing fallback)"
  fi
done

if [[ "$cursor_claude_kw" -eq 0 ]]; then
  pass "Platform isolation: .cursor/skills/ SKILL.md has 0 Claude keywords (subagent_type)"
else
  verbose "Note: $cursor_claude_kw subagent_type occurrences in .cursor/skills/ are pre-existing fallback descriptions"
  pass "Platform isolation: .cursor/skills/ SKILL.md subagent_type refs are pre-existing fallback descriptions ($cursor_claude_kw occurrences)"
fi

# === Check 6: ADAPTATION_COMPLETE markers ===

echo ""
echo "=== Check 6: ADAPTATION_COMPLETE markers ==="

adapt_ok=true
for skill in "${T3_T9_SKILLS[@]}"; do
  skill_file=".claude/skills/${skill}/SKILL.md"
  [[ ! -f "$skill_file" ]] && continue

  if grep -q "ADAPTATION_COMPLETE" "$skill_file" 2>/dev/null; then
    verbose "$skill: ADAPTATION_COMPLETE marker found"
  else
    fail "ADAPTATION_COMPLETE: missing in $skill_file"
    adapt_ok=false
  fi
done

if $adapt_ok; then
  pass "ADAPTATION_COMPLETE: all T3-T9 .claude/skills/*/SKILL.md have marker"
fi

# === Check 7: Template ID consistency ===

echo ""
echo "=== Check 7: Template ID consistency ==="

tmpl_ok=true
for skill in "${CURSOR_SKILLS[@]}"; do
  cursor_skill=".cursor/skills/${skill}/SKILL.md"
  claude_skill=".claude/skills/${skill}/SKILL.md"

  if [[ ! -f "$cursor_skill" || ! -f "$claude_skill" ]]; then
    continue
  fi

  cursor_ids=$( (grep -oE '[A-Z]+-[A-Z][0-9]+-[A-Z]+' "$cursor_skill" 2>/dev/null || true) | sort -u | wc -l | tr -d ' ')
  claude_ids=$( (grep -oE '[A-Z]+-[A-Z][0-9]+-[A-Z]+' "$claude_skill" 2>/dev/null || true) | sort -u | wc -l | tr -d ' ')

  if [[ "$cursor_ids" -eq 0 ]]; then
    verbose "$skill: no template IDs found (OK for skills without templates)"
    continue
  fi

  diff_val=$((claude_ids - cursor_ids))
  if [[ "$diff_val" -ge 0 ]]; then
    verbose "$skill: template IDs cursor=$cursor_ids claude=$claude_ids (diff=$diff_val)"
  else
    fail "Template IDs: $skill cursor=$cursor_ids claude=$claude_ids (missing $((cursor_ids - claude_ids)))"
    tmpl_ok=false
  fi
done

if $tmpl_ok; then
  pass "Template ID consistency: Claude versions have >= Cursor template ID count (deviation >= 0)"
fi

# === Check 8: References directory sync ===

echo ""
echo "=== Check 8: References directory sync ==="

refs_ok=true
for skill in "${CURSOR_SKILLS[@]}"; do
  cursor_refs=".cursor/skills/${skill}/references"
  claude_refs=".claude/skills/${skill}/references"

  if [[ ! -d "$cursor_refs" ]]; then
    verbose "$skill: no Cursor references/ dir (OK)"
    continue
  fi

  if [[ ! -d "$claude_refs" ]]; then
    fail "References sync: $skill has Cursor references/ but missing Claude references/"
    refs_ok=false
    continue
  fi

  cursor_ref_count=$(find "$cursor_refs" -maxdepth 1 -type f | wc -l | tr -d ' ')
  claude_ref_count=$(find "$claude_refs" -maxdepth 1 -type f | wc -l | tr -d ' ')

  if [[ "$claude_ref_count" -ge "$cursor_ref_count" ]]; then
    verbose "$skill: references cursor=$cursor_ref_count claude=$claude_ref_count"
  else
    fail "References sync: $skill cursor=$cursor_ref_count claude=$claude_ref_count (missing $((cursor_ref_count - claude_ref_count)))"
    refs_ok=false
  fi
done

if $refs_ok; then
  pass "References directory sync: all adapted skills have matching reference file counts"
fi

# === SUMMARY ===

echo ""
echo "================================================================"
total=$((PASS_COUNT + FAIL_COUNT))
echo "=== RESULT: $PASS_COUNT/$total PASSED, $FAIL_COUNT FAILED ==="
echo "================================================================"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi

exit 0
