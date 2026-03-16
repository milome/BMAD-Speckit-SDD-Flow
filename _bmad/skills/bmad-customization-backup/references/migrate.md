# BMAD 定制迁移说明

## 何时备份

- 对 `_bmad` 做了任意修改后（如 party-mode 轮次与收敛、展示名、workflow 步骤等），在切换 worktree 或重装 BMAD 前执行一次备份。
- 多分支/多机器希望共用同一套 _bmad 定制时，在一处改完并备份，再将备份目录拷贝到它处用于迁移。

## 在新 worktree 中迁移

1. **安装 BMAD**：在新 worktree 中按 bmad-method 或项目文档执行安装，得到全新的 `_bmad`。
2. **准备备份**：将之前生成的备份目录（如 `_bmad-output/bmad-customization-backups/YYYY-MM-DD_HH-MM-SS_bmad`）拷贝到当前项目的 `_bmad-output/bmad-customization-backups/` 下；若备份已在当前项目（例如从另一分支拉取），可跳过。
3. **应用备份**：运行 `apply_bmad_backup.py`（建议先 `--dry-run`），再正式执行，将备份内容覆盖到当前 `_bmad`。脚本位于全局 skill 目录：`~/.cursor/skills/bmad-customization-backup/scripts/`（Windows 上为 `%USERPROFILE%\.cursor\skills\bmad-customization-backup\scripts\`）。
4. **验证**：检查关键文件（如 `_bmad/core/workflows/party-mode/workflow.md`、`steps/step-02-discussion-orchestration.md`）是否与预期定制一致。

## 注意事项

- 迁移为覆盖操作，会改写当前 `_bmad`；若当前 _bmad 有未备份的修改，会丢失。首次迁移前可先对当前 _bmad 做一次备份。
- 备份目录内除 `_bmad/`、`manifest.txt`、`BACKUP_README.md` 外如有其它文件，应用脚本仅处理 `_bmad/` 下的内容。
- 若仅需恢复部分路径，可手动从备份的 `_bmad/` 下拷贝对应文件到当前 `_bmad/`。
