#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


RULES = [
    ("UNRESOLVED_MARKER", r"\bTODO\b"),
    ("UNRESOLVED_MARKER", r"\bTBD\b"),
    ("UNRESOLVED_MARKER", r"\bFIXME\b"),
    ("UNRESOLVED_MARKER", r"\?\?\?"),
    ("SILENT_ASSUMPTION", r"后续补齐"),
    ("SILENT_ASSUMPTION", r"后续考虑"),
    ("SILENT_ASSUMPTION", r"默认如此"),
    ("SILENT_ASSUMPTION", r"默认即可"),
    ("SILENT_ASSUMPTION", r"暂不处理"),
    ("SILENT_ASSUMPTION", r"稍后补齐"),
    ("SILENT_ASSUMPTION", r"later wire in"),
    ("SILENT_ASSUMPTION", r"to be decided"),
    ("ROLE_PLACEHOLDER", r"<role>"),
    ("ROLE_PLACEHOLDER", r"<user>"),
    ("ROLE_PLACEHOLDER", r"<actor>"),
    ("COMPLETION_PLACEHOLDER", r"完成态待补"),
    ("COMPLETION_PLACEHOLDER", r"完成状态待补"),
    ("COMPLETION_PLACEHOLDER", r"成功标准待补")
]


def lint_file(path: Path) -> list[dict[str, str | int]]:
    findings: list[dict[str, str | int]] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        for code, pattern in RULES:
            if re.search(pattern, line, flags=re.IGNORECASE):
                findings.append(
                    {
                        "code": code,
                        "path": str(path),
                        "line": line_no,
                        "pattern": pattern,
                        "text": line.strip()
                    }
                )
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan docs for unresolved ambiguity and silent-assumption markers.")
    parser.add_argument("paths", nargs="+", help="One or more files to lint.")
    parser.add_argument(
        "--pattern-library",
        default="_bmad/cursor/skills/speckit-workflow/references/omissions-pattern-library.md",
        help="Reference document that explains omission / ambiguity categories."
    )
    parser.add_argument("--output-json", help="Optional path to write JSON findings.")
    args = parser.parse_args()

    findings: list[dict[str, str | int]] = []
    for raw_path in args.paths:
        path = Path(raw_path).resolve()
        if not path.is_file():
            findings.append(
                {
                    "code": "PATH_NOT_FOUND",
                    "path": str(path),
                    "line": 0,
                    "pattern": "",
                    "text": "Input path does not exist."
                }
            )
            continue
        findings.extend(lint_file(path))

    result = {
        "ok": not findings,
        "patternLibrary": str(Path(args.pattern_library).resolve()),
        "findingCount": len(findings),
        "findings": findings
    }

    if args.output_json:
        Path(args.output_json).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
