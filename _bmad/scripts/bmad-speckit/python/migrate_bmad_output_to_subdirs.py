#!/usr/bin/env python3
"""
US-018 (T-BMAD-7): 迁移 _bmad-output/implementation-artifacts 平铺文件到两级层级子目录

按文件名解析 {epic}-{story}-{slug}，将平铺文件移动到对应两级子目录
epic-{N}-{epic-slug}/story-{N}-{slug}/；若无法解析，移动到 _orphan/。
支持 --dry-run。epic-slug 从 _bmad-output/planning-artifacts/{branch}/epics.md 自动提取。

用法:
  python migrate_bmad_output_to_subdirs.py [--project-root PATH] [--dry-run]

不移动:
  - _bmad-output/planning-artifacts/ 下文件
  - current_session_pids_*.txt、bmad-customization-backups/、speckit-scripts-backups/
  - 已在子目录内的文件
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

# 解析 epic-story-slug 的正则：{epic}-{story}-{slug}，如 4-1-implement-base-cache
EPIC_STORY_SLUG_RE = re.compile(r"^(\d+)-(\d+)-([a-zA-Z0-9_-]+)$")


def get_epic_slug_from_epics_md(epic_num: str, project_root: Path) -> str | None:
    """从 _bmad-output/planning-artifacts/{branch}/epics.md 提取 epic slug。"""
    try:
        branch = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, cwd=project_root
        ).stdout.strip() or "dev"
    except Exception:
        branch = "dev"
    for b in [branch, "dev"]:
        epics_md = project_root / "_bmad-output" / "planning-artifacts" / b / "epics.md"
        if epics_md.exists():
            text = epics_md.read_text(encoding="utf-8")
            m = re.search(
                rf"^#{{2,3}}\s+Epic\s+{re.escape(str(epic_num))}\s*[：:]\s*(.+)",
                text, re.MULTILINE
            )
            if m:
                title = m.group(1).strip()
                return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return None


def parse_epic_story_slug_from_filename(filename: str) -> str | None:
    """
    从文件名解析 {epic}-{story}-{slug}，返回子目录名或 None。

    支持的模式:
    - {epic}-{story}-{slug}.md -> 4-1-implement-base-cache
    - TASKS_{epic}-{story}-{slug}.md -> 4-1-implement-base-cache
    - prd.{ref}.json: ref 含 {epic}-{story}-{slug}，如 TASKS_4-1-implement-base-cache
    - progress.{ref}.txt: 同上
    """
    stem = Path(filename).stem
    if not stem:
        return None

    # 模式 1: {epic}-{story}-{slug}.md
    m = EPIC_STORY_SLUG_RE.match(stem)
    if m:
        return stem

    # 模式 2: TASKS_{epic}-{story}-{slug}.md
    if stem.startswith("TASKS_"):
        suffix = stem[6:]
        if EPIC_STORY_SLUG_RE.match(suffix):
            return suffix

    # 模式 3: prd.{ref}.json 或 progress.{ref}.txt
    if stem.startswith("prd.") or stem.startswith("progress."):
        prefix_len = 4 if stem.startswith("prd.") else 9  # "prd." = 4, "progress." = 9
        ref = stem[prefix_len:]
        # ref 中可能包含 epic-story-slug，如 TASKS_4-1-implement-base-cache
        if "TASKS_" in ref:
            suffix = ref.split("TASKS_", 1)[1]
            if EPIC_STORY_SLUG_RE.match(suffix):
                return suffix
        # 直接匹配 ref 本身
        if EPIC_STORY_SLUG_RE.match(ref):
            return ref
        # ref 中可能包含 BUGFIX_{slug}，无 epic-story 时返回 None
        return None

    return None


def should_skip_file(path: Path, impl_artifacts: Path) -> bool:
    """判断是否应跳过该文件"""
    name = path.name
    # 根目录文件
    if name.startswith("current_session_pids_") and name.endswith(".txt"):
        return True
    if path.is_dir():
        if name in ("bmad-customization-backups", "speckit-scripts-backups"):
            return True
    return False


def collect_flat_files(impl_artifacts: Path) -> list[tuple[Path, str]]:
    """
    收集 implementation-artifacts 下需要迁移的平铺文件。
    返回 [(file_path, target_subdir), ...]，target_subdir 为 _orphan 或 {epic}-{story}-{slug}
    """
    result: list[tuple[Path, str]] = []
    if not impl_artifacts.exists() or not impl_artifacts.is_dir():
        return result

    for item in impl_artifacts.iterdir():
        if item.is_file():
            if should_skip_file(item, impl_artifacts):
                continue
            subdir = parse_epic_story_slug_from_filename(item.name)
            if subdir is None:
                subdir = "_orphan"
            result.append((item, subdir))
        elif item.is_dir():
            # 跳过特殊目录
            if item.name in ("bmad-customization-backups", "speckit-scripts-backups", "_orphan"):
                continue
            # 子目录内的文件不处理（已在子目录内）
            pass

    return result


def run_migration(project_root: Path, dry_run: bool) -> int:
    """执行迁移并输出报告。返回 0 成功，非 0 失败。"""
    bmad_output = project_root / "_bmad-output"
    impl_artifacts = bmad_output / "implementation-artifacts"

    if not impl_artifacts.exists():
        print(f"[migrate] implementation-artifacts 不存在: {impl_artifacts}")
        print("无迁移计划。")
        return 0

    files_to_migrate = collect_flat_files(impl_artifacts)

    if not files_to_migrate:
        print("[migrate] 无平铺文件需要迁移。")
        return 0

    # 按目标子目录分组
    by_subdir: dict[str, list[Path]] = {}
    for fp, subdir in files_to_migrate:
        by_subdir.setdefault(subdir, []).append(fp)

    # 输出迁移计划（dry-run 段同步使用新路径逻辑）
    mode = "（dry-run，不实际移动）" if dry_run else "（将执行移动）"
    print(f"[migrate] 迁移计划 {mode}")
    print("-" * 40)
    for subdir in sorted(by_subdir.keys()):
        m2 = EPIC_STORY_SLUG_RE.match(subdir)
        if m2:
            epic_num2, story_num2, slug2 = m2.group(1), m2.group(2), m2.group(3)
            epic_slug2 = get_epic_slug_from_epics_md(epic_num2, project_root)
            epic_dir2 = f"epic-{epic_num2}-{epic_slug2}" if epic_slug2 else f"epic-{epic_num2}"
            target_dir = impl_artifacts / epic_dir2 / f"story-{story_num2}-{slug2}"
        else:
            target_dir = impl_artifacts / subdir
        files = by_subdir[subdir]
        print(f"  -> {target_dir.relative_to(impl_artifacts)}/")
        for f in sorted(files):
            print(f"      {f.name}")
        print()

    if dry_run:
        print(f"[migrate] dry-run 完成，共 {len(files_to_migrate)} 个文件待迁移。")
        return 0

    # 实际移动（目标目录构建使用两级层级逻辑）
    for subdir, files in by_subdir.items():
        m = EPIC_STORY_SLUG_RE.match(subdir)
        if m:
            epic_num, story_num, slug_part = m.group(1), m.group(2), m.group(3)
            epic_slug = get_epic_slug_from_epics_md(epic_num, project_root)
            epic_dir = f"epic-{epic_num}-{epic_slug}" if epic_slug else f"epic-{epic_num}"
            story_dir = f"story-{story_num}-{slug_part}"
            target_dir = impl_artifacts / epic_dir / story_dir
        else:
            target_dir = impl_artifacts / subdir  # fallback: 保持原行为
        target_dir.mkdir(parents=True, exist_ok=True)
        for fp in files:
            dest = target_dir / fp.name
            if dest.exists():
                print(f"[migrate] 警告: 目标已存在，跳过: {dest}")
                continue
            fp.rename(dest)
            print(f"[migrate] 已移动: {fp.name} -> {target_dir.relative_to(impl_artifacts)}/")

    print(f"[migrate] 迁移完成，共 {len(files_to_migrate)} 个文件。")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="迁移 _bmad-output/implementation-artifacts 平铺文件到 story 子目录"
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
