#!/usr/bin/env python3
"""
Backup _bmad directory to _bmad-output/bmad-customization-backups/<timestamp>_bmad.
Creates manifest.txt and BACKUP_README.md in the backup directory.
Usage:
  python backup_bmad.py [--project-root PATH]
  --project-root  Project root (default: current working directory).
"""
from __future__ import annotations

import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Backup _bmad to timestamped directory.")
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path.cwd(),
        help="Project root directory (default: cwd)",
    )
    args = parser.parse_args()
    project_root = args.project_root.resolve()
    _bmad = project_root / "_bmad"
    out_base = project_root / "_bmad-output" / "bmad-customization-backups"

    if not _bmad.is_dir():
        print(f"Error: _bmad not found at {_bmad}", file=sys.stderr)
        return 1

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_dir = out_base / f"{timestamp}_bmad"
    backup_dir.mkdir(parents=True, exist_ok=True)

    # Copy tree (same as shutil.copytree with dirs_exist_ok for Py3.8+)
    dest_bmad = backup_dir / "_bmad"
    if dest_bmad.exists():
        shutil.rmtree(dest_bmad)
    shutil.copytree(_bmad, dest_bmad)

    # Manifest: relative paths under _bmad
    manifest_path = backup_dir / "manifest.txt"
    paths: list[str] = []
    for p in sorted(dest_bmad.rglob("*")):
        if p.is_file():
            paths.append(str(p.relative_to(dest_bmad).as_posix()))
    manifest_path.write_text("\n".join(paths) + "\n", encoding="utf-8")

    # Apply script path: use script's actual location (works for global skill)
    script_dir = Path(__file__).resolve().parent
    apply_script = script_dir / "apply_bmad_backup.py"

    # README for migration
    readme = f"""# BMAD 定制备份 {timestamp}

本目录为当时 worktree 下 `_bmad` 的完整拷贝，用于在新 worktree 重新安装 BMAD 后迁移定制。

## 迁移步骤

1. 在新 worktree 中安装 BMAD（得到全新 `_bmad`）。
2. 运行应用脚本（建议先 --dry-run）：
   ```
   python "{apply_script}" --backup-path "{backup_dir}" --project-root "<当前项目根>"
   ```
3. 或手动：将本目录下 `_bmad/` 内所有内容按相对路径复制到新 worktree 的 `_bmad/`，覆盖同名文件。

## 文件数

{len(paths)} 个文件（见 manifest.txt）。
"""
    (backup_dir / "BACKUP_README.md").write_text(readme, encoding="utf-8")

    print(f"Backup written to: {backup_dir}")
    print(f"  _bmad/ ({len(paths)} files), manifest.txt, BACKUP_README.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
