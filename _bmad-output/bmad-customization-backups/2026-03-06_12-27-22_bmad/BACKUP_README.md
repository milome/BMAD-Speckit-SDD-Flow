# BMAD 定制备份 2026-03-06_12-27-22

本目录为当时 worktree 下 `_bmad` 的完整拷贝，用于在新 worktree 重新安装 BMAD 后迁移定制。

## 迁移步骤

1. 在新 worktree 中安装 BMAD（得到全新 `_bmad`）。
2. 运行应用脚本（建议先 --dry-run）：
   ```
   python "D:\Dev\BMAD-Speckit-SDD-Flow\skills\bmad-customization-backup\scripts\apply_bmad_backup.py" --backup-path "D:\Dev\BMAD-Speckit-SDD-Flow\_bmad-output\bmad-customization-backups\2026-03-06_12-27-22_bmad" --project-root "<当前项目根>"
   ```
3. 或手动：将本目录下 `_bmad/` 内所有内容按相对路径复制到新 worktree 的 `_bmad/`，覆盖同名文件。

## 文件数

672 个文件（见 manifest.txt）。
