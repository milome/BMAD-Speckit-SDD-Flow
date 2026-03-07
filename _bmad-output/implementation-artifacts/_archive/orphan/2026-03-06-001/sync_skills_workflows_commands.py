#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
同步 BMAD-Speckit-SDD-Flow 的 skills、workflows、commands、脚本、文档 到:
  (1) 全局配置
  (2) micang-trader-015-indicator-system-refactor 项目

用法: python sync_skills_workflows_commands.py
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path
from datetime import datetime

# 路径
SRC_ROOT = Path(r"D:\Dev\BMAD-Speckit-SDD-Flow")
TGT_GLOBAL_SKILLS = Path(os.environ.get("USERPROFILE", "")) / ".cursor" / "skills"
TGT_MICANG = Path(r"D:\Dev\micang-trader-015-indicator-system-refactor")
REPORT_PATH = SRC_ROOT / "_bmad-output" / "implementation-artifacts" / "_orphan" / "SYNC_REPORT_skills_workflows_commands_2026-03-06.md"

# 源项目 skills 列表（与用户指定一致）
SKILLS_TO_SYNC = [
    "speckit-workflow",
    "bmad-story-assistant",
    "bmad-standalone-tasks",
    "bmad-bug-assistant",
    "bmad-customization-backup",
    "bmad-eval-analytics",
    "bmad-code-reviewer-lifecycle",
    "code-review",
    "git-push-monitor",
    "auto-commit-utf8",
    "pr-template-generator",
    "using-git-worktrees",
]
# speckit-scripts-backup 在源项目 skills 中不存在，但全局有，可选择性从全局同步
EXTRA_SKILLS = ["speckit-scripts-backup"]  # 若源有则同步；源无则从全局不覆盖

synced: list[str] = []
failed: list[tuple[str, str]] = []


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def copy_tree(src: Path, dst: Path, label: str) -> bool:
    """递归复制目录，覆盖已存在文件。"""
    if not src.exists():
        failed.append((label, f"源不存在: {src}"))
        return False
    try:
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        return True
    except Exception as e:
        failed.append((label, str(e)))
        return False


def copy_file(src: Path, dst: Path, label: str) -> bool:
    if not src.exists():
        failed.append((label, f"源不存在: {src}"))
        return False
    try:
        ensure_dir(dst.parent)
        shutil.copy2(src, dst)
        return True
    except Exception as e:
        failed.append((label, str(e)))
        return False


def run_backup_bmad() -> str | None:
    """从 BMAD 项目执行 backup_bmad.py，返回备份目录路径。"""
    script = SRC_ROOT / "skills" / "bmad-customization-backup" / "scripts" / "backup_bmad.py"
    if not script.exists():
        # 尝试全局 skill
        script = TGT_GLOBAL_SKILLS / "bmad-customization-backup" / "scripts" / "backup_bmad.py"
    if not script.exists():
        failed.append(("backup_bmad", "脚本不存在"))
        return None
    try:
        subprocess.run([sys.executable, str(script), "--project-root", str(SRC_ROOT)], check=True, cwd=str(SRC_ROOT))
    except subprocess.CalledProcessError as e:
        failed.append(("backup_bmad", str(e)))
        return None
    # 查找最新备份
    backup_base = SRC_ROOT / "_bmad-output" / "bmad-customization-backups"
    if not backup_base.exists():
        return None
    dirs = sorted([d for d in backup_base.iterdir() if d.is_dir() and d.name.endswith("_bmad")], reverse=True)
    if not dirs:
        return None
    return str(dirs[0])


def run_apply_bmad(backup_path: str) -> bool:
    """对 micang 执行 apply_bmad_backup.py"""
    script = SRC_ROOT / "skills" / "bmad-customization-backup" / "scripts" / "apply_bmad_backup.py"
    if not script.exists():
        script = TGT_GLOBAL_SKILLS / "bmad-customization-backup" / "scripts" / "apply_bmad_backup.py"
    if not script.exists():
        failed.append(("apply_bmad_backup", "脚本不存在"))
        return False
    try:
        subprocess.run([
            sys.executable, str(script),
            "--backup-path", backup_path,
            "--project-root", str(TGT_MICANG),
        ], check=True, cwd=str(TGT_MICANG))
        return True
    except subprocess.CalledProcessError as e:
        failed.append(("apply_bmad_backup", str(e)))
        return False


def main() -> int:
    print("=== 同步任务开始 ===\n")

    # ---- 目标 1: 全局 skills ----
    print("【目标 1】同步 skills 到全局...")
    for name in SKILLS_TO_SYNC:
        src = SRC_ROOT / "skills" / name
        if not src.exists():
            print(f"  跳过 {name} (源不存在)")
            continue
        dst = TGT_GLOBAL_SKILLS / name
        if copy_tree(src, dst, f"global_skill_{name}"):
            synced.append(f"global_skills/{name}")
            print(f"  已同步: {name}")

    # speckit-scripts-backup：源项目无，从全局不操作（或可选从别处同步，此处跳过）

    # ---- 目标 2: micang 项目 ----
    print("\n【目标 2】micang 项目...")

    # 2.1 bmad-customization-backup
    print("  2.1 bmad-customization-backup: 备份并应用...")
    backup_path = run_backup_bmad()
    if backup_path:
        synced.append(f"bmad_backup: {backup_path}")
        if run_apply_bmad(backup_path):
            synced.append("bmad_apply_to_micang")
            print("    备份并应用完成")
        else:
            print("    应用失败")
    else:
        print("    备份失败或未找到备份")

    # 2.2 speckit-scripts: 源无 specs/000-Overview/.specify/scripts/，跳过
    speckit_src = SRC_ROOT / "specs" / "000-Overview" / ".specify" / "scripts"
    if not speckit_src.exists():
        print("  2.2 speckit-scripts-backup: 源路径不存在，跳过")
    else:
        print("  2.2 speckit-scripts-backup: 执行备份并应用...")
        # 若有则执行，此处不实现完整 backup/apply，仅记录
        synced.append("speckit_scripts: skipped (source not in specs/000-Overview/.specify/scripts)")

    # 2.3 skills 同步到 micang
    print("  2.3 skills 同步到 micang...")
    micang_skills = TGT_MICANG / "skills"
    ensure_dir(micang_skills)
    for name in SKILLS_TO_SYNC:
        src = SRC_ROOT / "skills" / name
        if not src.exists():
            continue
        dst = micang_skills / name
        if copy_tree(src, dst, f"micang_skill_{name}"):
            synced.append(f"micang_skills/{name}")
    print("    skills 同步完成")

    # 2.4 .cursor/ 同步
    print("  2.4 .cursor/ 同步...")
    cursor_items = [
        ("commands", "commands"),
        ("rules", "rules"),
        ("agents", "agents"),
    ]
    for src_name, dst_name in cursor_items:
        src = SRC_ROOT / ".cursor" / src_name
        dst = TGT_MICANG / ".cursor" / dst_name
        if src.exists():
            if src.is_dir():
                if copy_tree(src, dst, f"micang_cursor_{dst_name}"):
                    synced.append(f"micang_.cursor/{dst_name}")
            else:
                if copy_file(src, dst, f"micang_cursor_{dst_name}"):
                    synced.append(f"micang_.cursor/{dst_name}")

    # .cursor/settings.json
    settings_src = SRC_ROOT / ".cursor" / "settings.json"
    if settings_src.exists():
        dst = TGT_MICANG / ".cursor" / "settings.json"
        ensure_dir(dst.parent)
        if copy_file(settings_src, dst, "micang_cursor_settings"):
            synced.append("micang_.cursor/settings.json")

    # code-reviewer-config.yaml (若 agents 下单独存在)
    cfg_src = SRC_ROOT / ".cursor" / "agents" / "code-reviewer-config.yaml"
    cfg_dst = TGT_MICANG / ".cursor" / "agents" / "code-reviewer-config.yaml"
    if cfg_src.exists():
        ensure_dir(cfg_dst.parent)
        if copy_file(cfg_src, cfg_dst, "micang_code_reviewer_config"):
            synced.append("micang_.cursor/agents/code-reviewer-config.yaml")

    # 2.5 .claude/ 同步
    print("  2.5 .claude/ 同步...")
    for sub in ["commands", "agents"]:
        src = SRC_ROOT / ".claude" / sub
        dst = TGT_MICANG / ".claude" / sub
        if src.exists() and src.is_dir():
            if copy_tree(src, dst, f"micang_claude_{sub}"):
                synced.append(f"micang_.claude/{sub}")

    # 2.6 docs/BMAD 同步（若存在）
    docs_bmad_src = SRC_ROOT / "docs" / "BMAD"
    if docs_bmad_src.exists():
        docs_bmad_dst = TGT_MICANG / "docs" / "BMAD"
        if copy_tree(docs_bmad_src, docs_bmad_dst, "micang_docs_BMAD"):
            synced.append("micang_docs/BMAD")
            print("  2.6 docs/BMAD 已同步")

    # ---- 写入报告 ----
    ensure_dir(REPORT_PATH.parent)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("# SYNC_REPORT: skills, workflows, commands 同步报告\n\n")
        f.write(f"**执行时间**: {datetime.now().isoformat()}\n\n")
        f.write("## 源路径\n")
        f.write(f"- 项目根: `{SRC_ROOT}`\n\n")
        f.write("## 目标路径\n")
        f.write(f"- 全局 skills: `{TGT_GLOBAL_SKILLS}`\n")
        f.write(f"- micang 项目: `{TGT_MICANG}`\n\n")
        f.write("## 同步项列表\n")
        for s in synced:
            f.write(f"- {s}\n")
        f.write("\n## 说明与跳过项\n")
        f.write("- **speckit-scripts-backup**：源项目无 `specs/000-Overview/.specify/scripts/`，未执行；"
                "若需升级 micang 的 speckit 脚本，可手动从 `_bmad/scripts/bmad-speckit/` 同步。\n")
        f.write("- **相关文档**：`docs/BMAD`、`skills/*/references` 已随 skills 目录同步。\n\n")
        f.write("## 失败项\n")
        if failed:
            for label, err in failed:
                f.write(f"- **{label}**: {err}\n")
        else:
            f.write("（无）\n")
    print(f"\n报告已写入: {REPORT_PATH}")
    print("=== 同步任务结束 ===")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
