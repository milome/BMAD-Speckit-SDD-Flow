#!/usr/bin/env python3
"""
US-025 (T-PRE-7): 迁移 _bmad-output/planning-artifacts 平铺文件到 branch 子目录

将 planning-artifacts/ 下平铺的 epics.md、prd.*.json、implementation-readiness-report-*.md、
architecture*.md、ARCH_*.md 移动到 planning-artifacts/{current-branch}/。
支持 --dry-run。

用法:
  python migrate_planning_artifacts_to_branch.py [--project-root PATH] [--dry-run]

不移动:
  - 已在 {branch}/ 子目录内的文件
  - _archive/ 目录
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

# 需要迁移的平铺文件模式（根目录下的文件名）
def _should_migrate(name: str) -> bool:
    """判断文件名是否应迁移到 branch 子目录。"""
    return (
        name == "epics.md"
        or name.startswith("prd.")
        or name.startswith("implementation-readiness-report-")
        or name.startswith("architecture")
        or name.startswith("ARCH_")
    )


def get_current_branch(project_root: Path) -> str:
    """
    获取当前 branch，规范化：HEAD -> detached-{short-sha}；/ 替换为 -。
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=project_root,
            capture_output=True,
            text=True,
            check=True,
        )
        branch_raw = result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "main"  # fallback

    if branch_raw == "HEAD":
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=project_root,
                capture_output=True,
                text=True,
                check=True,
            )
            short_sha = result.stdout.strip()
            return f"detached-{short_sha}"
        except (subprocess.CalledProcessError, FileNotFoundError):
            return "detached-unknown"
    return branch_raw.replace("/", "-")


def collect_flat_files(planning_artifacts: Path) -> list[Path]:
    """
    收集 planning-artifacts 根目录下需要迁移的平铺文件。
    不包含已在子目录内的文件，不包含 _archive/。
    """
    result: list[Path] = []
    if not planning_artifacts.exists() or not planning_artifacts.is_dir():
        return result

    for item in planning_artifacts.iterdir():
        if item.is_file():
            if _should_migrate(item.name):
                result.append(item)
        # 跳过子目录（包括 _archive、已有 branch 子目录等）
    return result


def run_migration(project_root: Path, dry_run: bool) -> int:
    """执行迁移并输出报告。返回 0 成功，非 0 失败。"""
    bmad_output = project_root / "_bmad-output"
    planning_artifacts = bmad_output / "planning-artifacts"

    if not planning_artifacts.exists():
        print(f"[migrate] planning-artifacts 不存在: {planning_artifacts}")
        print("无迁移计划。")
        return 0

    branch = get_current_branch(project_root)
    target_dir = planning_artifacts / branch

    # 若目标目录已存在且包含文件，可能已迁移过
    flat_files = collect_flat_files(planning_artifacts)

    if not flat_files:
        print("[migrate] 无平铺文件需要迁移。")
        return 0

    mode = "（dry-run，不实际移动）" if dry_run else "（将执行移动）"
    print(f"[migrate] 迁移计划 {mode}")
    print(f"[migrate] 当前 branch: {branch}")
    print(f"[migrate] 目标目录: {target_dir}")
    print("-" * 40)
    for fp in sorted(flat_files):
        print(f"  {fp.name} -> {branch}/")
    print()

    if dry_run:
        print(f"[migrate] dry-run 完成，共 {len(flat_files)} 个文件待迁移。")
        return 0

    target_dir.mkdir(parents=True, exist_ok=True)
    for fp in flat_files:
        dest = target_dir / fp.name
        if dest.exists():
            print(f"[migrate] 警告: 目标已存在，跳过: {dest}")
            continue
        fp.rename(dest)
        print(f"[migrate] 已移动: {fp.name} -> {branch}/")

    print(f"[migrate] 迁移完成，共 {len(flat_files)} 个文件。")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="迁移 _bmad-output/planning-artifacts 平铺文件到 branch 子目录"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path.cwd(),
        help="项目根目录（默认当前目录）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="仅输出迁移计划，不实际移动文件",
    )
    args = parser.parse_args()

    project_root = args.project_root.resolve()
    if not project_root.exists():
        print(f"[migrate] 错误: 项目根目录不存在: {project_root}", file=sys.stderr)
        return 1

    return run_migration(project_root, dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
