#!/usr/bin/env python3
"""Backward-compatible launcher for the Node/js-yaml TRACE prompt generator."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    script = Path(__file__).with_suffix(".js")
    result = subprocess.run(["node", str(script), *sys.argv[1:]], check=False)
    return int(result.returncode)


if __name__ == "__main__":
    raise SystemExit(main())
