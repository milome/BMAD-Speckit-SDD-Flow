#!/usr/bin/env bash
# find-related-docs.sh - Find related design documents for a feature
# 与 powershell/find-related-docs.ps1 功能对等
#
# Usage: ./find-related-docs.sh -FeatureDescription "desc" -ShortName name [-Json] [-RepoRoot path]

set -e

FEATURE_DESC=""
SHORT_NAME=""
JSON=false
REPO_ROOT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -FeatureDescription) FEATURE_DESC="$2"; shift 2 ;;
        -ShortName) SHORT_NAME="$2"; shift 2 ;;
        -Json) JSON=true; shift ;;
        -RepoRoot) REPO_ROOT="$2"; shift 2 ;;
        *) shift ;;
    esac
done

[[ -z "$FEATURE_DESC" ]] && { echo "ERROR: -FeatureDescription required"; exit 1; }
[[ -z "$SHORT_NAME" ]] && { echo "ERROR: -ShortName required"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -z "$REPO_ROOT" ]] && REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || true
if [[ -z "$REPO_ROOT" ]]; then
    current="$SCRIPT_DIR"
    while [[ -n "$current" ]]; do
        if [[ -d "$current/.git" ]] || [[ -d "$current/.specify" ]]; then
            REPO_ROOT="$current"
            break
        fi
        parent="$(dirname "$current")"
        [[ "$parent" == "$current" ]] && break
        current="$parent"
    done
fi
[[ -z "$REPO_ROOT" ]] && { echo "Could not determine repository root"; exit 1; }

# Extract keywords: lowercase, split, filter length>=2, filter stop words
STOP=" the a an and or but in on at to for of with by from is are was were be been have has had do does did will would should could can may might must 的 了 在 是 我 有 和 就 不 人 都 一 上 也 很 到 说 要 去 你 会 着 没有 看 好 自己 这 "
KEYWORDS=""
while IFS= read -r w; do
    [[ ${#w} -lt 2 ]] && continue
    echo "$STOP" | grep -q " $w " && continue
    KEYWORDS="$KEYWORDS $w"
done < <(echo "$FEATURE_DESC" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-zA-Z0-9\u4e00-\u9fa5]+/ /g' | tr ' ' '\n' | grep .)

# Calculate relevance for a file
score_file() {
    local f="$1"
    local name; name="$(basename "$f" | sed 's/\.[^.]*$//' | tr '[:upper:]' '[:lower:]')"
    local content; content="$(head -100 "$f" 2>/dev/null | tr '[:upper:]' '[:lower:]')" || true
    local s=0
    for kw in $KEYWORDS; do
        [[ -z "$kw" ]] && continue
        echo "$name" | grep -q "$kw" 2>/dev/null && s=$((s + 10))
        echo "$content" | grep -q "$kw" 2>/dev/null && s=$((s + 5))
    done
    echo "$name" | grep -qi "$SHORT_NAME" 2>/dev/null && s=$((s + 20))
    for ind in 设计 design 分析 analysis 方案 solution 架构 architecture poc proposal; do
        echo "$name" | grep -qi "$ind" 2>/dev/null && s=$((s + 15)) && break
    done
    echo "$s"
}

# Collect results
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

for pattern in "$REPO_ROOT/specs/000-Overview/"*.md "$REPO_ROOT/specs/TBD - "*/*.md "$REPO_ROOT/poc/"*/*.md "$REPO_ROOT/docs/"*.md; do
    for f in $pattern; do
        [[ -f "$f" ]] || continue
        s="$(score_file "$f")"
        [[ "$s" -gt 0 ]] && echo "$s|$f" >> "$TMP"
    done
done 2>/dev/null || true

# Sort and take top 10
SORTED="$(sort -t'|' -k1 -nr "$TMP" 2>/dev/null | head -10 || true)"

if $JSON; then
    echo -n '{"Documents":['
    first=true
    echo "$SORTED" | while IFS='|' read -r rel path; do
        [[ -z "$path" ]] && continue
        rp="${path#$REPO_ROOT/}"; rp="${rp#/}"
        bn="$(basename "$path")"
        [[ "$first" == "true" ]] && first=false || echo -n ","
        printf '{"Path":"%s","Name":"%s","Relevance":%s,"RelativePath":"%s"}' "$path" "$bn" "$rel" "$rp"
    done
    echo '],"Keywords":[]}'
else
    count="$(echo "$SORTED" | grep -c . 2>/dev/null || echo 0)"
    echo "Found $count related documents:"
    echo "$SORTED" | while IFS='|' read -r rel path; do
        [[ -z "$path" ]] && continue
        rp="${path#$REPO_ROOT/}"; rp="${rp#/}"
        echo "  [$rel] $rp"
    done
fi
