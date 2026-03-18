#!/usr/bin/env python3
"""
Apply a BMAD customization backup to current worktree's _bmad.
Usage:
  python apply_bmad_backup.py --backup-path PATH --project-root PATH [--dry-run]
  --backup-path   Directory that contains _bmad/ (e.g. .../2026-02-27_14-30-00_bmad).
  --project-root  Current project root (where _bmad will be overwritten).
  --dry-run       Only list what would be copied, do not write.
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply BMAD backup to current _bmad.")
    parser.add_argument("--backup-path", type=Path, required=True, help="Backup directory containing _bmad/")
    parser.add_argument("--project-root", type=Path, required=True, help="Project root (target _bmad)")
    parser.add_argument("--dry-run", action="store_true", help="Only list actions, do not copy")
    args = parser.parse_args()

    backup_root = args.backup_path.resolve()
    project_root = args.project_root.resolve()
    source_bmad = backup_root / "_bmad"
    target_bmad = project_root / "_bmad"

    if not source_bmad.is_dir():
        print(f"Error: backup _bmad not found at {source_bmad}", file=sys.stderr)
        return 1
    if not args.dry_run and not target_bmad.is_dir():
        target_bmad.mkdir(parents=True, exist_ok=True)
        print(f"Created target _bmad at {target_bmad}")

    files = list(source_bmad.rglob("*"))
    file_list = [p for p in files if p.is_file()]
    if args.dry_run:
        print(f"Dry-run: would copy {len(file_list)} files from {source_bmad} to {target_bmad}")
        for p in sorted(file_list)[:20]:
            rel = p.relative_to(source_bmad)
            print(f"  {rel}")
        if len(file_list) > 20:
            print(f"  ... and {len(file_list) - 20} more")
        return 0

    for src in sorted(file_list):
        rel = src.relative_to(source_bmad)
        dest = target_bmad / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
    print(f"Applied {len(file_list)} files to {target_bmad}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
