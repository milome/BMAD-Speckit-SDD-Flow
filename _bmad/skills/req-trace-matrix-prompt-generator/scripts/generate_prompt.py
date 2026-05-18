#!/usr/bin/env python3
"""Generate a strict TRACE execution prompt from a confirmed source document."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover - consumer environments may omit PyYAML.
    yaml = None


SKILL_LINE = "$executing-plans $verification-before-completion"
LEGACY_SKILL_LINE = "$executing-plans $requirements-contract-authoring $verification-before-completion"
COMMAND_PREFIXES = (
    "npm ",
    "npx ",
    "node ",
    "python ",
    "py ",
    "pnpm ",
    "yarn ",
    "rg ",
    "Get-ChildItem ",
    "pwsh ",
    "powershell ",
)


class BlockedInput(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-document", help="Path to PRD/BUGFIX/TASKS source document")
    parser.add_argument("--contract", help="Deprecated alias for --source-document")
    parser.add_argument("--source-file", help="Deprecated blocked input for unconfirmed plans")
    parser.add_argument("--requirement-record", help="Path to requirement-record.json with latest confirmationHistory[]")
    parser.add_argument("--source-label", help="Source label to display in the generated prompt")
    parser.add_argument("--final-gate", action="append", default=[], help="Append a final gate command")
    parser.add_argument("--extra-rule", action="append", default=[], help="Append a hard priority rule")
    parser.add_argument("--no-auto-commit", action="store_true", help="Disable auto-commit wording")
    args = parser.parse_args()

    provided = [value for value in (args.source_document, args.contract, args.source_file) if value]
    if len(provided) != 1:
        parser.error("Provide exactly one of --source-document, --contract, or --source-file")
    return args


def read_text(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def read_json(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def display_path(path: str) -> str:
    return Path(path).as_posix()


def unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        normalized = value.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


def commandish(value: str) -> bool:
    return value.strip().startswith(COMMAND_PREFIXES)


def block(code: str, message: str) -> str:
    return f"{code}\n{message}"


BOOKKEEPING_FIELDS = {
    "status",
    "confirmedAt",
    "confirmedBy",
    "sourceDocumentHash",
    "implementationConfirmationHash",
    "reconfirmationRequest",
    "confirmationRender",
}


def stable_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256(content: str) -> str:
    return "sha256:" + hashlib.sha256(content.encode("utf-8")).hexdigest()


def semantic_confirmation_for_hash(confirmation: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in confirmation.items() if key not in BOOKKEEPING_FIELDS}


def source_document_hash_for(source_text: str, block_text: str, confirmation: dict[str, Any]) -> str:
    normalized_block = "implementationConfirmation:" + stable_json(semantic_confirmation_for_hash(confirmation))
    return sha256(source_text.replace(block_text, normalized_block))


def implementation_confirmation_hash_for(confirmation: dict[str, Any]) -> str:
    return sha256(stable_json(semantic_confirmation_for_hash(confirmation)))


def extract_confirmation_block(text: str) -> str:
    lines = text.replace("\r\n", "\n").split("\n")
    start = next(
        (index for index, line in enumerate(lines) if re.match(r"^implementationConfirmation:\s*$", line)),
        -1,
    )
    if start < 0:
        raise BlockedInput(
            "BLOCK: SOURCE_DOCUMENT_REQUIRED",
            "Need a PRD / BUGFIX / TASKS implementation source document with inline implementationConfirmation.",
        )

    end = len(lines)
    for index in range(start + 1, len(lines)):
        line = lines[index]
        if line.strip() == "":
            continue
        if re.match(r"^\S", line):
            end = index
            break
    return "\n".join(lines[start:end])


def strip_quotes(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def indent_of(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def parse_scalar(value: str) -> Any:
    value = strip_quotes(value.strip())
    if value == "null":
        return None
    if value == "true":
        return True
    if value == "false":
        return False
    if value == "[]":
        return []
    inline_list = re.fullmatch(r"\[(.*)\]", value)
    if inline_list:
        body = inline_list.group(1).strip()
        if not body:
            return []
        return [strip_quotes(part.strip()) for part in body.split(",")]
    return value


def parse_items(lines: list[str], start: int, section_indent: int) -> tuple[list[dict[str, Any]], int]:
    items: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    index = start
    item_indent = section_indent + 2
    field_indent = section_indent + 4

    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue
        current_indent = indent_of(line)
        stripped = line.strip()
        if current_indent <= section_indent:
            break
        if current_indent == item_indent and stripped.startswith("- "):
            current = {}
            items.append(current)
            body = stripped[2:].strip()
            if body and ":" in body:
                key, value = body.split(":", 1)
                current[key.strip()] = parse_scalar(value.strip())
            index += 1
            continue
        if current is not None and current_indent >= field_indent and ":" in stripped:
            key, value = stripped.split(":", 1)
            current[key.strip()] = parse_scalar(value.strip())
        index += 1
    return items, index


def parse_confirmation(block_text: str) -> dict[str, Any]:
    if yaml is not None:
        parsed = yaml.safe_load(block_text)
        if not isinstance(parsed, dict):
            return {"implementationConfirmation": {}}
        return parsed

    lines = block_text.splitlines()
    result: dict[str, Any] = {"implementationConfirmation": {}}
    root = result["implementationConfirmation"]
    index = 1

    while index < len(lines):
        line = lines[index]
        stripped = line.strip()
        if not stripped:
            index += 1
            continue
        if indent_of(line) != 2 or ":" not in stripped:
            index += 1
            continue
        key, value = stripped.split(":", 1)
        key = key.strip()
        value = value.strip()
        if value == "":
            items, next_index = parse_items(lines, index + 1, 2)
            root[key] = items
            index = next_index
        else:
            root[key] = parse_scalar(value)
            index += 1
    return result


def latest_confirmation_event(record: dict[str, Any]) -> dict[str, Any]:
    history = record.get("confirmationHistory")
    if not isinstance(history, list) or not history:
        raise BlockedInput(
            "BLOCK: CONFIRMATION_RECORD_REQUIRED",
            "requirement-record.json must contain confirmationHistory[] before generating an implementation prompt.",
        )
    confirmations = [
        item
        for item in history
        if isinstance(item, dict) and item.get("eventType") == "confirmation_recorded"
    ]
    if not confirmations:
        raise BlockedInput(
            "BLOCK: CONFIRMATION_RECORD_REQUIRED",
            "requirement-record.json confirmationHistory[] has no confirmation_recorded event.",
        )
    return confirmations[-1]


def validate_requirement_record(
    args: argparse.Namespace,
    source_text: str,
    block_text: str,
    confirmation: dict[str, Any],
) -> None:
    if not args.requirement_record:
        raise BlockedInput(
            "BLOCK: CONFIRMATION_RECORD_REQUIRED",
            "--requirement-record is required; source status alone is not sufficient authority.",
        )

    record = read_json(args.requirement_record)
    event = latest_confirmation_event(record)
    source_hash = source_document_hash_for(source_text, block_text, confirmation)
    confirmation_hash = implementation_confirmation_hash_for(confirmation)
    mismatches: list[str] = []

    if event.get("sourceDocumentHash") != source_hash:
        mismatches.append("sourceDocumentHash")
    if event.get("implementationConfirmationHash") != confirmation_hash:
        mismatches.append("implementationConfirmationHash")
    if record.get("sourceDocumentHash") and record.get("sourceDocumentHash") != source_hash:
        mismatches.append("record.sourceDocumentHash")
    if record.get("implementationConfirmationHash") and record.get("implementationConfirmationHash") != confirmation_hash:
        mismatches.append("record.implementationConfirmationHash")

    if mismatches:
        raise BlockedInput(
            "BLOCK: CONFIRMATION_RECORD_HASH_MISMATCH",
            "Latest confirmationHistory[] hash does not match current source document: " + ", ".join(mismatches),
        )


def ids(items: list[dict[str, Any]]) -> set[str]:
    return {str(item.get("id")) for item in items if item.get("id")}


def validate_confirmation(parsed: dict[str, Any]) -> dict[str, Any]:
    confirmation = parsed.get("implementationConfirmation")
    if not isinstance(confirmation, dict):
        raise BlockedInput(
            "BLOCK: SOURCE_DOCUMENT_REQUIRED",
            "Need a PRD / BUGFIX / TASKS implementation source document with inline implementationConfirmation.",
        )

    if confirmation.get("status") != "user_confirmed":
        raise BlockedInput("BLOCK: CONFIRMATION_REQUIRED", "implementationConfirmation.status is not user_confirmed.")

    open_questions = confirmation.get("openQuestions") or []
    if any(item.get("blocksImplementation") is True for item in open_questions):
        raise BlockedInput(
            "BLOCK: BLOCKING_QUESTIONS",
            "implementationConfirmation.openQuestions contains blocksImplementation=true.",
        )

    must_ids = ids(confirmation.get("must") or [])
    not_done_ids = ids(confirmation.get("notDone") or [])
    evidence_ids = ids(confirmation.get("evidence") or [])
    must_not_ids = ids(confirmation.get("mustNot") or [])
    allowed_cover_ids = must_ids | not_done_ids | must_not_ids
    trace_rows = confirmation.get("traceRows") or []
    if not trace_rows:
        raise BlockedInput("BLOCK: TRACE_REFERENCE_INVALID", "implementationConfirmation.traceRows is missing or empty.")

    invalid: list[str] = []
    semantic_keys = {"text", "scenario", "expected", "expectedBehavior", "requirement", "description"}
    semantic_rows: list[str] = []

    for row in trace_rows:
        row_id = str(row.get("id", "TRACE-UNKNOWN"))
        covers = row.get("covers") or []
        evidence_refs = row.get("evidenceRefs") or []
        for cover_id in covers:
            if cover_id not in allowed_cover_ids:
                invalid.append(f"{row_id}.covers:{cover_id}")
        for evidence_ref in evidence_refs:
            if evidence_ref not in evidence_ids:
                invalid.append(f"{row_id}.evidenceRefs:{evidence_ref}")
        if semantic_keys.intersection(row):
            semantic_rows.append(row_id)

    if invalid:
        raise BlockedInput(
            "BLOCK: TRACE_REFERENCE_INVALID",
            "traceRows reference missing must/notDone/evidence IDs: " + ", ".join(invalid),
        )

    if semantic_rows:
        raise BlockedInput(
            "BLOCK: TRACE_RESTATES_REQUIREMENTS",
            "traceRows contain new requirement semantics instead of references only: " + ", ".join(semantic_rows),
        )

    return confirmation


def parse_commands(confirmation: dict[str, Any], extra_gates: list[str]) -> list[str]:
    commands: list[str] = []
    for evidence in confirmation.get("evidence") or []:
        gate = str(evidence.get("gate") or "").strip()
        if gate and commandish(gate):
            commands.append(gate)
    commands.extend(extra_gates)
    return unique(commands)


def render_final_gates(commands: list[str]) -> str:
    if not commands:
        return "    - MISSING_INPUT: final gate commands must be derived from implementationConfirmation.evidence before PASS"
    return "\n".join(f"    - {command}" for command in commands)


def render_extra_rules(rules: list[str]) -> str:
    if not rules:
        return ""
    return "".join(f"\n{index}. {rule}" for index, rule in enumerate(rules, start=4))


def audit_prompt(prompt: str) -> list[str]:
    required_fragments = [
        SKILL_LINE,
        "continue nonstop",
        "#implementationConfirmation",
        "Only ",
        "Do not implement prose, diagrams, or conversation content",
        "traceRows",
        "PASS requires evidence for covered must, notDone, and evidence IDs",
        "MISSING_EVIDENCE",
        "reconfirm_required",
        "Completion Evidence Packet",
    ]
    return [fragment for fragment in required_fragments if fragment not in prompt]


def build_prompt(args: argparse.Namespace) -> str:
    if args.source_file:
        raise BlockedInput(
            "BLOCK: SESSION_INPUT_NEEDS_SOURCE_DOCUMENT",
            "Conversation-only requirements must first be written into an implementation source document with implementationConfirmation.status=draft and then explicitly confirmed by the user.",
        )

    source_path = args.source_document or args.contract
    assert source_path is not None
    source_text = read_text(source_path)
    block_text = extract_confirmation_block(source_text)
    confirmation = validate_confirmation(parse_confirmation(block_text))
    validate_requirement_record(args, source_text, block_text, confirmation)
    source_label = args.source_label or display_path(source_path)
    source_authority = f"{source_label}#implementationConfirmation"

    trace_rows = confirmation.get("traceRows") or []
    trace_ids = [str(row["id"]) for row in trace_rows if row.get("id")]
    trace_text = " -> ".join(trace_ids)
    gates = parse_commands(confirmation, args.final_gate)

    commit_rule = (
        "改为 PASS 后立即本地提交一次，禁止 push。若源文档或用户指定 commit message 格式，严格使用该格式；否则使用仓库提交规范。"
        if not args.no_auto_commit
        else "不要自动提交；只有用户明确要求提交时才提交，并且禁止 push。"
    )

    prompt = f"""{SKILL_LINE}

continue nonstop

任务：严格执行 {source_authority} 的 confirmed traceRows，直到闭环验收完成。

Source of authority:
Only {source_authority} is authoritative.
Do not implement prose, diagrams, or conversation content unless it is referenced by implementationConfirmation IDs.

范围与意图锁定：
1. 只能实施 implementationConfirmation 中的 must/notDone/evidence/traceRows IDs，禁止实现未被确认块引用的 prose、diagram 或会话内容。
2. 禁止缩减范围、替换范围、改变原始需求、禁止把原始需求解释成更小交付。
3. 禁止 MVP downgrade、stub、mock-only、happy-path-only、representative-only coverage、later-batch coverage、seed-only coverage 或局部样例冒充完整交付。{render_extra_rules(args.extra_rule)}

强制执行规则：
1. 以 traceRows 为唯一主执行切片，按 {trace_text} 顺序推进。
2. 每个 TRACE 切片只能关闭其 covers/evidenceRefs 引用的 confirmed IDs。
3. taskRefs 完成不等于 requirement PASS。
4. PASS requires evidence for covered must, notDone, and evidence IDs.
5. 每完成一个 TRACE 切片，必须同步更新源文档中相关 traceRows 状态和证据引用；没有证据时必须保持 PENDING 或改为 MISSING_EVIDENCE。
6. {commit_rule}
7. 严禁虚构验证结果、证据路径或 PASS 状态。
8. 如果需要改变 must/notDone/mustNot/evidence/traceRows 语义，必须把源文档状态改为 reconfirm_required 并停止。
9. 遇到测试失败、构建失败、审计失败、E2E 失败或 gate 失败时，自动使用 systematic-debugging 思路定位并修复；不要立刻停止询问。
10. 仅在真实阻塞时停止：缺少用户决策、需要语义变更、需要改 shared contract/schema/根配置且超出确认块、依赖无法安装或运行、外部约束与确认块冲突、或连续系统化修复后仍无法定位根因。
11. 每个 TRACE 切片结束必须运行该切片对应 gate。
12. 最终必须运行并记录结果：
{render_final_gates(gates)}
13. 全部完成后输出 Completion Evidence Packet，至少包含关闭 IDs、开放 IDs、命令结果、E2E 证据、审计证据、残留风险和 scope changes。

现在开始执行，不要等待中途确认，直到最终验收闭环或触发真实阻塞条件。"""

    missing = audit_prompt(prompt)
    if missing:
        print("Prompt audit failed. Missing fragments: " + ", ".join(missing), file=sys.stderr)
        sys.exit(2)
    return prompt


def main() -> None:
    try:
        print(build_prompt(parse_args()))
    except BlockedInput as error:
        print(block(error.code, error.message))
        sys.exit(3)


if __name__ == "__main__":
    main()
