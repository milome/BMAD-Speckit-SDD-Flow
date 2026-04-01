#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BLOCKER_PATTERNS = [
    r"\bTODO\b",
    r"\bTBD\b",
    r"\bFIXME\b",
    r"\?\?\?",
    r"后续补齐",
    r"后续考虑",
    r"默认如此",
    r"默认即可",
    r"暂不处理",
    r"稍后补齐",
    r"later wire in",
    r"to be decided"
]

PLACEHOLDER_PATTERNS = [
    r"<[^>]+>",
    r"changeme",
    r"your[_\- ]?(api|token|url|value|env)"
]

CLOSURE_NOTE_REQUIRED_MARKERS = [
    "Journey ID",
    "Covered Task IDs",
    "Smoke Test IDs",
    "Full E2E IDs",
    "Definition Gaps Still Open",
    "Implementation Gaps Still Open",
    "Verification Commands",
    "Summary"
]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def append_issue(
    bucket: list[dict[str, str]],
    *,
    code: str,
    path: str,
    message: str,
    journey_id: str | None = None,
) -> None:
    item = {"code": code, "path": path, "message": message}
    if journey_id:
        item["journeyId"] = journey_id
    bucket.append(item)


def scan_text(
    text: str,
    *,
    path: str,
    blockers: list[dict[str, str]],
    warnings: list[dict[str, str]],
) -> None:
    for pattern in BLOCKER_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE):
            append_issue(
                blockers,
                code="BLOCKER_MARKER_FOUND",
                path=path,
                message=f"Found unresolved marker matching /{pattern}/"
            )
    for pattern in PLACEHOLDER_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE):
            append_issue(
                warnings,
                code="PLACEHOLDER_PATTERN_FOUND",
                path=path,
                message=f"Found placeholder-like marker matching /{pattern}/"
            )


def validate_closure_note(
    note_path: Path,
    *,
    blockers: list[dict[str, str]],
    journey_id: str,
) -> None:
    if not note_path.is_file():
        append_issue(
            blockers,
            code="CLOSURE_NOTE_MISSING",
            path=str(note_path),
            journey_id=journey_id,
            message="Closure note file does not exist."
        )
        return
    text = note_path.read_text(encoding="utf-8")
    missing = [marker for marker in CLOSURE_NOTE_REQUIRED_MARKERS if marker not in text]
    if missing:
        append_issue(
            blockers,
            code="CLOSURE_NOTE_FIELDS_MISSING",
            path=str(note_path),
            journey_id=journey_id,
            message=f"Closure note is missing required markers: {', '.join(missing)}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Rule-based readiness gate for journey-ledger / trace-map / closure-note contracts."
    )
    parser.add_argument("--journey-ledger", required=True, help="Path to journey-ledger JSON file.")
    parser.add_argument("--trace-map", required=True, help="Path to trace-map JSON file.")
    parser.add_argument(
        "--artifact-root",
        default=".",
        help="Root used to resolve closure note paths from the trace map and ledger."
    )
    parser.add_argument(
        "--docs",
        nargs="*",
        default=[],
        help="Optional extra docs to scan for blocker words and ambiguity markers."
    )
    parser.add_argument("--output-json", help="Optional path to write machine-readable JSON output.")
    args = parser.parse_args()

    journey_ledger_path = Path(args.journey_ledger).resolve()
    trace_map_path = Path(args.trace_map).resolve()
    artifact_root = Path(args.artifact_root).resolve()
    extra_docs = [Path(doc).resolve() for doc in args.docs]

    blockers: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    for required_file in [journey_ledger_path, trace_map_path]:
        if not required_file.is_file():
            append_issue(
                blockers,
                code="INPUT_FILE_MISSING",
                path=str(required_file),
                message="Required input file does not exist."
            )

    if blockers:
        result = {"ok": False, "checkedAt": now_iso(), "blockers": blockers, "warnings": warnings}
        if args.output_json:
            Path(args.output_json).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 2

    journey_ledger = load_json(journey_ledger_path)
    trace_map = load_json(trace_map_path)

    scan_text(journey_ledger_path.read_text(encoding="utf-8"), path=str(journey_ledger_path), blockers=blockers, warnings=warnings)
    scan_text(trace_map_path.read_text(encoding="utf-8"), path=str(trace_map_path), blockers=blockers, warnings=warnings)

    trace_journeys = {
        item.get("journeyId"): item for item in trace_map.get("journeys", []) if isinstance(item, dict)
    }

    for journey in journey_ledger.get("journeys", []):
        if not isinstance(journey, dict):
            continue
        journey_id = str(journey.get("journeyId", "")).strip()
        path_label = str(journey_ledger_path)

        for field in [
            "journeyId",
            "storyId",
            "title",
            "userVisibleGoal",
            "taskIds",
            "smokeTests",
            "smokeCommands",
            "fullE2E",
            "closureNote",
            "fixtureRequirements",
            "environmentRequirements",
            "deferredGaps"
        ]:
            value = journey.get(field)
            if value is None or value == "":
                append_issue(
                    blockers,
                    code="LEDGER_REQUIRED_FIELD_MISSING",
                    path=path_label,
                    journey_id=journey_id or None,
                    message=f"Journey is missing required field: {field}"
                )

        smoke_tests = journey.get("smokeTests") or []
        smoke_commands = journey.get("smokeCommands") or []
        task_ids = journey.get("taskIds") or []
        if not smoke_tests and not smoke_commands:
            append_issue(
                blockers,
                code="SMOKE_GENERATABILITY_MISSING",
                path=path_label,
                journey_id=journey_id or None,
                message="Journey has no smokeTests or smokeCommands, so smoke generation is not possible."
            )
        if not task_ids:
            append_issue(
                blockers,
                code="TASK_TRACE_MISSING",
                path=path_label,
                journey_id=journey_id or None,
                message="Journey has no taskIds, so traceability is incomplete."
            )

        for list_field in ["fixtureRequirements", "environmentRequirements"]:
            values = journey.get(list_field) or []
            if not isinstance(values, list):
                append_issue(
                    blockers,
                    code="LEDGER_FIELD_TYPE_INVALID",
                    path=path_label,
                    journey_id=journey_id or None,
                    message=f"{list_field} must be an array."
                )
                continue
            joined = " ".join(str(value) for value in values)
            if not values:
                append_issue(
                    warnings,
                    code="READINESS_DECLARATION_EMPTY",
                    path=path_label,
                    journey_id=journey_id or None,
                    message=f"{list_field} is empty. Explicitly confirm this is intentional."
                )
            scan_text(joined, path=path_label, blockers=blockers, warnings=warnings)

        trace_entry = trace_journeys.get(journey_id)
        if not trace_entry:
            append_issue(
                blockers,
                code="TRACE_JOURNEY_MISSING",
                path=str(trace_map_path),
                journey_id=journey_id or None,
                message="Trace map has no matching journey entry."
            )
        else:
            if set(trace_entry.get("taskIds") or []) != set(task_ids):
                append_issue(
                    blockers,
                    code="TRACE_TASK_MISMATCH",
                    path=str(trace_map_path),
                    journey_id=journey_id or None,
                    message="Trace map taskIds do not match journey ledger taskIds."
                )
            if set(trace_entry.get("smokeTests") or []) != set(smoke_tests):
                append_issue(
                    blockers,
                    code="TRACE_SMOKE_MISMATCH",
                    path=str(trace_map_path),
                    journey_id=journey_id or None,
                    message="Trace map smokeTests do not match journey ledger smokeTests."
                )
            if str(trace_entry.get("closureNote", "")).strip() != str(journey.get("closureNote", "")).strip():
                append_issue(
                    blockers,
                    code="TRACE_CLOSURE_MISMATCH",
                    path=str(trace_map_path),
                    journey_id=journey_id or None,
                    message="Trace map closureNote does not match journey ledger closureNote."
                )

        closure_note_rel = str(journey.get("closureNote", "")).strip()
        if closure_note_rel:
            validate_closure_note(
                artifact_root / closure_note_rel,
                blockers=blockers,
                journey_id=journey_id or "UNKNOWN"
            )

    for doc_path in extra_docs:
        if not doc_path.is_file():
            append_issue(
                warnings,
                code="DOC_NOT_FOUND",
                path=str(doc_path),
                message="Optional doc path does not exist and was skipped."
            )
            continue
        scan_text(doc_path.read_text(encoding="utf-8"), path=str(doc_path), blockers=blockers, warnings=warnings)

    result = {
        "ok": not blockers,
        "checkedAt": now_iso(),
        "journeyLedger": str(journey_ledger_path),
        "traceMap": str(trace_map_path),
        "artifactRoot": str(artifact_root),
        "blockers": blockers,
        "warnings": warnings,
        "summary": {
            "journeyCount": len(journey_ledger.get("journeys", [])),
            "blockerCount": len(blockers),
            "warningCount": len(warnings)
        }
    }

    if args.output_json:
        Path(args.output_json).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Readiness Gate: journeys={result['summary']['journeyCount']} blockers={len(blockers)} warnings={len(warnings)}")
    for issue in blockers:
        print(f"[BLOCKER] {issue['code']} {issue['path']} :: {issue['message']}")
    for issue in warnings:
        print(f"[WARN] {issue['code']} {issue['path']} :: {issue['message']}")
    return 1 if blockers else 0


if __name__ == "__main__":
    sys.exit(main())
