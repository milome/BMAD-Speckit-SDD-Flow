---
name: bmad-customization-backup
description: |
  Record and backup _bmad directory customizations in the current worktree so they can be migrated to a new worktree after reinstalling bmad-method. Use when: (1) Backing up _bmad optimizations before creating a new worktree or reinstalling BMAD, (2) Preparing a portable backup of _bmad changes for reuse, (3) Applying a previously saved backup to a fresh _bmad install in the current or another worktree. Requires project root and _bmad path; backups go to _bmad-output/bmad-customization-backups/. 全程中文。
---

# BMAD 定制备份与迁移

本技能用于在当前 worktree 下**记录与备份** `_bmad` 目录中的优化修改，并在新 worktree 重新安装 bmad-method 后**迁移**这些改动。

**脚本位置**：本 skill 为全局 skill，脚本位于 `{SKILLS_ROOT}/bmad-customization-backup/scripts/`（展开：Windows `%USERPROFILE%\.cursor\skills\`、macOS/Linux `~/.cursor/skills/`）。

## 前置条件

- 项目根目录存在 `_bmad`（已安装 BMAD）。
- 备份输出目录：`{project-root}/_bmad-output/bmad-customization-backups/`（若不存在会创建）。

## 一、备份（记录当前 _bmad 定制）

**目标**：将当前 `_bmad` 完整拷贝到带时间戳的备份目录，并生成文件清单（manifest），便于后续迁移。

**步骤**：

1. 确认 `{project-root}/_bmad` 存在。
2. 运行脚本备份（推荐）：
   ```bash
   # macOS/Linux
   python ~/.cursor/skills/bmad-customization-backup/scripts/backup_bmad.py --project-root "{project-root}"

   # Windows (PowerShell)
   python "$HOME\.cursor\skills\bmad-customization-backup\scripts\backup_bmad.py" --project-root "{project-root}"
   ```
   或在项目根下（脚本会以 cwd 为 project-root）：
   ```bash
   python ~/.cursor/skills/bmad-customization-backup/scripts/backup_bmad.py
   ```
3. 脚本会：
   - 在 `_bmad-output/bmad-customization-backups/` 下创建 `YYYY-MM-DD_HH-MM-SS_bmad/`；
   - 将 `_bmad` 下全部内容复制到该目录（保持相对路径）；
   - 在备份目录内生成 `manifest.txt`（相对路径列表）和 `BACKUP_README.md`（说明与迁移步骤）。
4. **手动备份**：若无法运行脚本，可手动复制 `_bmad` 到 `_bmad-output/bmad-customization-backups/<自定义名称>_bmad/`，并自行维护一份修改说明。

**验收**：`_bmad-output/bmad-customization-backups/` 下存在带时间戳的目录，其内为 `_bmad` 的完整镜像及 manifest。

## 二、迁移（在新 worktree 应用备份）

**场景**：已创建新 worktree 并重新安装 BMAD（得到全新 `_bmad`），需要把之前备份的定制覆盖回去。

**步骤**：

1. 在新 worktree 中安装 BMAD（得到未修改的 `_bmad`）。
2. 确定要使用的备份目录（例如 `_bmad-output/bmad-customization-backups/2026-02-27_14-30-00_bmad`）。若备份在其它 worktree 或机器，先将该目录拷贝到当前项目的 `_bmad-output/bmad-customization-backups/` 下。
3. 运行应用脚本（建议先 `--dry-run`）：
   ```bash
   # macOS/Linux
   python ~/.cursor/skills/bmad-customization-backup/scripts/apply_bmad_backup.py --backup-path "{path-to-backup-dir}" --project-root "{project-root}" --dry-run
   python ~/.cursor/skills/bmad-customization-backup/scripts/apply_bmad_backup.py --backup-path "{path-to-backup-dir}" --project-root "{project-root}"

   # Windows (PowerShell)
   python "$HOME\.cursor\skills\bmad-customization-backup\scripts\apply_bmad_backup.py" --backup-path "{path-to-backup-dir}" --project-root "{project-root}" --dry-run
   python "$HOME\.cursor\skills\bmad-customization-backup\scripts\apply_bmad_backup.py" --backup-path "{path-to-backup-dir}" --project-root "{project-root}"
   ```
4. 脚本会将备份目录中的文件覆盖到当前 `_bmad`，保留目录结构；若有冲突会按「覆盖」处理（见脚本说明）。
5. **手动迁移**：将备份目录中除 `manifest.txt`、`BACKUP_README.md` 外的内容，按相对路径复制到当前 worktree 的 `_bmad/`，覆盖同名文件。

**验收**：当前 worktree 的 `_bmad` 与备份内容一致（关键文件内容与备份相同）。

## 三、何时备份、何时迁移

| 时机       | 动作 |
|------------|------|
| 对 _bmad 做了 party-mode 轮次、展示名、workflow 等修改后 | 执行**备份**，便于以后在新 worktree 复用。 |
| 新建 worktree 并执行 bmad-method 安装后                 | 执行**迁移**，选择最近或指定备份覆盖 `_bmad`。 |
| 多台机器或多分支需共享同一套 _bmad 定制                 | 在一处备份，将备份目录拷贝到它处再执行迁移。 |

## 四、引用

- **迁移详细说明**：见 [references/migrate.md](references/migrate.md)（何时备份、如何在新 worktree 安装 BMAD 后应用备份、注意事项）。
- **备份脚本**：`~/.cursor/skills/bmad-customization-backup/scripts/backup_bmad.py`（参数：`--project-root`，默认当前目录）。
- **应用脚本**：`~/.cursor/skills/bmad-customization-backup/scripts/apply_bmad_backup.py`（参数：`--backup-path`、`--project-root`、`--dry-run`）。

## 五、约束与注意

- `_bmad` 通常在 `.gitignore` 中，备份目录建议放在 `_bmad-output/` 下；若希望将备份纳入版本控制，可将 `_bmad-output/bmad-customization-backups/` 从 ignore 中排除（按项目策略决定）。
- 迁移为覆盖操作，会改写当前 `_bmad`；首次迁移前建议先做一次备份或确认当前 `_bmad` 可丢弃。
- 备份为完整目录拷贝，不区分「仅修改过的文件」；若需仅备份部分路径，可在脚本中加白名单或改用手动拷贝。
