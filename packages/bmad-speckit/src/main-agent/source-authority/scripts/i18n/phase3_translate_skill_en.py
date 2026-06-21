#!/usr/bin/env python3
"""
Translate SKILL.en.md prose outside ``` fences (zh-CN -> en) using deep-translator.
Preserves fenced blocks verbatim. Prepends <!-- BLOCK_LABEL_POLICY=B --> if missing.
"""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

from deep_translator import GoogleTranslator


def has_han(s: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", s))


def translate_chunk(translator: GoogleTranslator, text: str) -> str:
    if not has_han(text):
        return text
    lines = text.split("\n")
    parts_out: list[str] = []
    buf_lines: list[str] = []
    size = 0
    for line in lines:
        llen = len(line.encode("utf-8")) + 1
        if buf_lines and size + llen > 4500:
            chunk = "\n".join(buf_lines)
            parts_out.append(translator.translate(chunk))
            time.sleep(0.35)
            buf_lines = [line]
            size = len(line.encode("utf-8")) + 1
        else:
            buf_lines.append(line)
            size += llen
    if buf_lines:
        chunk = "\n".join(buf_lines)
        parts_out.append(translator.translate(chunk))
        time.sleep(0.35)
    return "\n".join(parts_out)


def transform(text: str) -> str:
    if not text.startswith("<!-- BLOCK_LABEL_POLICY=B -->"):
        text = "<!-- BLOCK_LABEL_POLICY=B -->\n" + text

    translator = GoogleTranslator(source="zh-CN", target="en")
    lines = text.splitlines()
    out: list[str] = []
    in_code = False
    buf: list[str] = []

    def flush() -> None:
        nonlocal buf
        if not buf:
            return
        chunk = "\n".join(buf)
        buf = []
        try:
            merged = translate_chunk(translator, chunk)
        except Exception as exc:  # noqa: BLE001
            print(f"[phase3_translate_skill_en] translate failed, keeping source chunk: {exc}", file=sys.stderr)
            merged = chunk
        out.extend(merged.split("\n"))

    for line in lines:
        if line.lstrip().startswith("```"):
            flush()
            in_code = not in_code
            out.append(line)
            continue
        if in_code:
            out.append(line)
        else:
            buf.append(line)
    flush()

    trailing_nl = text.endswith("\n")
    body = "\n".join(out)
    return body + ("\n" if trailing_nl else "")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python phase3_translate_skill_en.py <SKILL.en.md>", file=sys.stderr)
        raise SystemExit(2)
    path = Path(sys.argv[1]).resolve()
    raw = path.read_text(encoding="utf-8")
    path.write_text(transform(raw), encoding="utf-8")
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
