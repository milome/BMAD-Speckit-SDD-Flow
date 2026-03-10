# TASKS：全流程脚本迁移至 _bmad（最终任务列表）

**依据文档**：`docs/BMAD/ANALYSIS_全流程脚本迁移至_bmad_100轮总结.md`  
**产出日期**：2026-03-03  
**要求**：每项任务必须明确**修改路径**与**具体修改内容**，禁止模糊描述。

---

## 阶段 0：前置条件

- 项目根目录：当前仓库根（如 `D:\Dev\micang-trader-015-indicator-system-refactor`）。
- 以下所有路径均相对于项目根，除非注明为绝对路径。

---

## 阶段 1：创建目录

| 任务ID | 修改路径 | 具体修改内容 | 验收 |
|--------|----------|--------------|------|
| 1.1 | （新建目录） | 创建目录 `_bmad/scripts/bmad-speckit/python/`，确保父级 `_bmad/scripts/bmad-speckit/` 存在。 | 目录存在 |
| 1.2 | （新建目录） | 创建目录 `_bmad/scripts/bmad-speckit/powershell/`。 | 目录存在 |
| 1.3 | （新建目录） | 创建目录 `_bmad/scripts/bmad-speckit/templates/`。 | 目录存在 |

---

## 阶段 2：迁移 Python 脚本

| 任务ID | 修改路径 | 具体修改内容 | 验收 |
|--------|----------|--------------|------|
| 2.1 | `_bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py` | **复制**：将 `tools/check_speckit_prerequisites.py` 的完整内容复制到目标路径。不删除源文件。 | 目标文件存在且内容与源一致 |
| 2.2 | `_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py` | **复制**：将 `_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py` 的完整内容复制到目标路径。不删除源文件。 | 目标文件存在且内容与源一致 |
| 2.3 | `_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py` | **复制**：将 `_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py` 的完整内容复制到目标路径。不删除源文件。 | 目标文件存在且内容与源一致 |
| 2.4 | （验证） | 在项目根执行：`python _bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py --epic 4 --story 1 --project-root .`，确认支持 `--project-root` 且退出码为 0 或 1（非异常）。 | 命令可执行 |

---

## 阶段 3：迁移 PowerShell 脚本

| 任务ID | 修改路径 | 具体修改内容 | 验收 |
|--------|----------|--------------|------|
| 3.1 | `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` | **复制**：将 `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` 复制到目标路径。 | 目标文件存在 |
| 3.2 | `_bmad/scripts/bmad-speckit/powershell/setup_worktree.ps1` | **复制**：将 `_bmad/scripts/bmad-speckit/powershell/setup_worktree.ps1` 复制到目标路径。 | 目标文件存在 |
| 3.3 | `_bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1` | **复制**：将 `_bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1` 复制到目标路径。 | 目标文件存在 |
| 3.4 | `_bmad/scripts/bmad-speckit/powershell/update-agent-context.ps1` | **复制**：将 `_bmad/scripts/bmad-speckit/powershell/update-agent-context.ps1` 复制到目标路径。 | 目标文件存在 |
| 3.5 | `_bmad/scripts/bmad-speckit/powershell/setup-plan.ps1` | **复制**：将 `_bmad/scripts/bmad-speckit/powershell/setup-plan.ps1` 复制到目标路径。 | 目标文件存在 |
| 3.6 | `_bmad/scripts/bmad-speckit/powershell/find-related-docs.ps1` | **复制**：将 `_bmad/scripts/bmad-speckit/powershell/find-related-docs.ps1` 复制到目标路径。 | 目标文件存在 |
| 3.7 | `_bmad/scripts/bmad-speckit/powershell/common.ps1` | **复制**：将 `_bmad/scripts/bmad-speckit/powershell/common.ps1` 复制到目标路径。 | 目标文件存在 |

---

## 阶段 4：迁移模板

| 任务ID | 修改路径 | 具体修改内容 | 验收 |
|--------|----------|--------------|------|
| 4.1 | `_bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template` | **复制**：将 `docs/speckit/.speckit-state.yaml.template` 的完整内容复制到目标路径。不删除源文件。 | 目标文件存在且内容与源一致 |

---

## 阶段 5：更新文档与引用（逐文件明确）

### 5.1 docs 下 Markdown

| 任务ID | 修改路径 | 具体修改内容 | 验收 |
|--------|----------|--------------|------|
| 5.1.1 | `docs/BMAD/IMPROVED_WORKFLOW_GUIDE.md` | ① 将所有出现的 `tools/check_speckit_prerequisites.py` 替换为 `_bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py`。② 将所有出现的 `docs/speckit/.speckit-state.yaml.template` 替换为 `_bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template`。③ 确保所有示例命令中的上述路径已同步替换（含 bash 代码块）。 | 全文无旧路径 |
| 5.1.2 | `docs/BMAD/TASKS_产出路径与worktree约定_2026-03-02.md` | 将文件中所有 `_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`、`_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py`、`tools/migrate_*.py` 替换为 `_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`、`_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py` 或对应新路径。 | 全文无 `tools/migrate_` |
| 5.1.3 | `docs/BMAD/TASKS_bmad-output子目录结构_2026-03-02.md` | 同上：`tools/migrate_*.py` → `_bmad/scripts/bmad-speckit/python/migrate_*.py`。 | 同上 |
| 5.1.4 | `docs/BMAD/DEBATE_bmad-output子目录结构_100轮总结_2026-03-02.md` | 同上。 | 同上 |
| 5.1.5 | `docs/BMAD/DEBATE_bmad-output子目录结构_100轮辩论产出_2026-03-02.md` | 同上。 | 同上 |
| 5.1.6 | `docs/BMAD/DEBATE_pre-speckit产出覆盖问题_100轮总结_2026-03-02.md` | 将 `_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py` 替换为 `_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py`。 | 无旧路径 |
| 5.1.7 | `docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md` | 将 `_bmad/scripts/bmad-speckit/powershell/` 或 `.specify/scripts/powershell/` 的引用替换为 `_bmad/scripts/bmad-speckit/powershell/`；若为表格或列表，逐项替换为 `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` 等具体脚本新路径。 | 无旧 .specify 路径 |
| 5.1.8 | `docs/BMAD/SIMULATION_BMAD_SPECKIT_完整交互流程记录.md` | 将 create-new-feature.ps1、setup_worktree.ps1 的路径改为 `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`、`_bmad/scripts/bmad-speckit/powershell/setup_worktree.ps1`（或文中出现的等价旧路径一律替换为新路径）。 | 无旧路径 |
| 5.1.9 | `docs/BMAD/DEBATE_solo开发worktree-branch选择_100轮总结_2026-03-03.md` | create-new-feature.ps1、setup_worktree.ps1 路径 → `_bmad/scripts/bmad-speckit/powershell/` 下对应文件名。 | 无旧路径 |
| 5.1.10 | `docs/BMAD/TASKS_solo开发worktree-branch选择_2026-03-03.md` | 同上。 | 无旧路径 |
| 5.1.11 | `docs/speckit/speckit多模块开发最佳实践.md` | 将所有 `.specify/scripts/powershell/`、`_bmad/scripts/bmad-speckit/powershell/` 替换为 `_bmad/scripts/bmad-speckit/powershell/`。 | 无旧路径 |
| 5.1.12 | `docs/speckit/speckit-specs目录使用指南.md` | 同上；若存在完整路径表，逐行更新为 `_bmad/scripts/bmad-speckit/powershell/*.ps1`。 | 无旧路径 |
| 5.1.13 | `docs/BMAD/SKILL_PROCESS_IMPROVEMENT_ANALYSIS.md` | ① 将 `tools/check_speckit_prerequisites.py` 替换为 `_bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py`。② 将 `docs/speckit/.speckit-state.yaml.template`、`.speckit-state.yaml.template` 模板路径替换为 `_bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template`。 | 无旧路径 |

### 5.2 specs 下 JSON / TXT

| 任务ID | 修改路径 | 具体修改内容 | 验收 |
|--------|----------|--------------|------|
| 5.2.1 | `specs/015-indicator-system-refactor/合约订阅支持/prd.SKILL_PROCESS_IMPROVEMENT.json` | 在任务描述（title/description/notes 等）中，将「创建docs/speckit/.speckit-state.yaml模板」或等价表述替换为「创建 _bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template」或等价表述。 | 无旧模板路径 |
| 5.2.2 | `specs/015-indicator-system-refactor/合约订阅支持/progress.SKILL_PROCESS_IMPROVEMENT.txt` | 将 `.speckit-state.yaml.template` 相关路径改为 `_bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template`；若为历史进度可仅在文首或文末注明「迁移后模板路径见 _bmad/scripts/bmad-speckit/templates/」。 | 按约定更新或注明 |

### 5.3 docs/BMAD 下 JSON / TXT

| 任务ID | 修改路径 | 具体修改内容 | 验收 |
|--------|----------|--------------|------|
| 5.3.1 | `docs/BMAD/prd.TASKS_产出路径与worktree约定_2026-03-02.json` | 在任务描述与路径字段中，将 `_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`、`_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py` 替换为 `_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`、`_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py`。若作历史保留，需在验收时明确。 | 与新路径一致或已注明历史 |
| 5.3.2 | `docs/BMAD/progress.TASKS_产出路径与worktree约定_2026-03-02.txt` | 将 TDD 步骤与命令中的 `_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`、`_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py` 替换为 `_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`、`_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py`；或注明为历史进度、迁移后仅作参考。 | 同上 |

### 5.4 specs/000-Overview 与 所有引用 .specify/scripts/powershell 的命令文件

| 任务ID | 修改路径 | 具体修改内容 | 验收 |
|--------|----------|--------------|------|
| 5.4.1 | `specs/000-Overview/.cursor/commands/speckit.specify.md` | 将脚本调用路径由 `.specify/scripts/powershell/create-new-feature.ps1`、`.specify/scripts/powershell/find-related-docs.ps1` 等改为 `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`、`_bmad/scripts/bmad-speckit/powershell/find-related-docs.ps1` 等（以项目根为基准）；若命令中使用相对路径，改为基于项目根的 `_bmad/scripts/bmad-speckit/powershell/` 或等价表述。 | 无 `.specify/scripts/powershell` |
| 5.4.2～5.4.N | **以下列出的每个文件**（见下方文件清单） | **查找**：文件中出现的 `_bmad/scripts/bmad-speckit/powershell`、`.specify/scripts/powershell`、或 `$PSScriptRoot` 指向的该目录。**替换为**：`_bmad/scripts/bmad-speckit/powershell`（以项目根为基准）。若为 PowerShell 调用，示例：`& "$(git rev-parse --show-toplevel)/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1"`。 | 每个文件内无旧路径 |

**需执行 5.4.2～5.4.N 替换的文件清单**（由 `grep -rl "\.specify/scripts/powershell" specs/ .iflow/commands/ multi-timeframe-webapp/` 所得，排除 _bmad-output、.merge-backup 等非交付路径）：

- `specs/000-Overview/.cursor/commands/speckit.specify.md`（已单独 5.4.1）
- `specs/000-Overview/.cursor/commands/speckit.clarify.md`
- `specs/000-Overview/.cursor/commands/speckit.analyze.md`
- `specs/000-Overview/.cursor/commands/speckit.checklist.md`
- `specs/000-Overview/.cursor/commands/speckit.implement.md`
- `specs/000-Overview/.cursor/commands/speckit.plan.md`
- `specs/000-Overview/.cursor/commands/speckit.tasks.md`
- `specs/000-Overview/.cursor/commands/speckit.taskstoissues.md`
- `specs/002-PyQt画线交易支持/.cursor/commands/speckit.specify.md`
- `specs/002-PyQt画线交易支持/.cursor/commands/speckit.clarify.md`
- `specs/002-PyQt画线交易支持/.cursor/commands/speckit.analyze.md`
- `specs/002-PyQt画线交易支持/.cursor/commands/speckit.checklist.md`
- `specs/002-PyQt画线交易支持/.cursor/commands/speckit.implement.md`
- `specs/002-PyQt画线交易支持/.cursor/commands/speckit.plan.md`
- `specs/002-PyQt画线交易支持/.cursor/commands/speckit.tasks.md`
- `specs/002-PyQt画线交易支持/.cursor/commands/speckit.taskstoissues.md`
- `specs/003-vnpy_chart_widget_refactor/.cursor/commands/speckit.specify.md`
- `specs/003-vnpy_chart_widget_refactor/.cursor/commands/speckit.clarify.md`
- `specs/003-vnpy_chart_widget_refactor/.cursor/commands/speckit.analyze.md`
- `specs/003-vnpy_chart_widget_refactor/.cursor/commands/speckit.checklist.md`
- `specs/003-vnpy_chart_widget_refactor/.cursor/commands/speckit.implement.md`
- `specs/003-vnpy_chart_widget_refactor/.cursor/commands/speckit.plan.md`
- `specs/003-vnpy_chart_widget_refactor/.cursor/commands/speckit.tasks.md`
- `specs/003-vnpy_chart_widget_refactor/.cursor/commands/speckit.taskstoissues.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/commands/speckit.specify.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/commands/speckit.clarify.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/commands/speckit.analyze.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/commands/speckit.checklist.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/commands/speckit.implement.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/commands/speckit.plan.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/commands/speckit.tasks.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/commands/speckit.taskstoissues.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/.cursor/commands/speckit.specify.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/.cursor/commands/speckit.clarify.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/.cursor/commands/speckit.checklist.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/.cursor/commands/speckit.analyze.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/.cursor/commands/speckit.implement.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/.cursor/commands/speckit.plan.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/.cursor/commands/speckit.tasks.md`
- `specs/010-daily-kline-multi-timeframe/.cursor/.cursor/commands/speckit.taskstoissues.md`
- `specs/011-cta-kline-style-activation/.cursor/commands/speckit.specify.md`
- `specs/011-cta-kline-style-activation/.cursor/commands/speckit.clarify.md`
- `specs/011-cta-kline-style-activation/.cursor/commands/speckit.analyze.md`
- `specs/011-cta-kline-style-activation/.cursor/commands/speckit.checklist.md`
- `specs/011-cta-kline-style-activation/.cursor/commands/speckit.implement.md`
- `specs/011-cta-kline-style-activation/.cursor/commands/speckit.plan.md`
- `specs/011-cta-kline-style-activation/.cursor/commands/speckit.tasks.md`
- `specs/011-cta-kline-style-activation/.cursor/commands/speckit.taskstoissues.md`
- `specs/013-hkfe-period-refactor/DEVELOPMENT_CONSTITUTION.md`（仅当**文件内容**含 `.specify/scripts/powershell` 或 `_bmad/scripts/bmad-speckit/powershell` 时替换，否则跳过）
- `specs/014-chart-performance-optimization/.speckit.specify/memory/constitution.md`（同上：仅当文件内容含上述旧路径时替换，否则跳过）
- `specs/015-indicator-system-refactor/.cursor/commands/speckit.specify.md`
- `specs/015-indicator-system-refactor/.cursor/commands/speckit.clarify.md`
- `specs/015-indicator-system-refactor/.cursor/commands/speckit.analyze.md`
- `specs/015-indicator-system-refactor/.cursor/commands/speckit.checklist.md`
- `specs/015-indicator-system-refactor/.cursor/commands/speckit.implement.md`
- `specs/015-indicator-system-refactor/.cursor/commands/speckit.plan.md`
- `specs/015-indicator-system-refactor/.cursor/commands/speckit.tasks.md`
- `specs/015-indicator-system-refactor/.cursor/commands/speckit.taskstoissues.md`
- `multi-timeframe-webapp/.cursor/commands/speckit.specify.md`
- `multi-timeframe-webapp/.cursor/commands/speckit.plan.md`
- `multi-timeframe-webapp/.cursor/commands/speckit.tasks.md`
- `multi-timeframe-webapp/.cursor/commands/speckit.implement.md`
- `multi-timeframe-webapp/.cursor/commands/speckit.analyze.md`
- `multi-timeframe-webapp/.cursor/commands/speckit.clarify.md`
- `multi-timeframe-webapp/.cursor/commands/speckit.checklist.md`
- `multi-timeframe-webapp/.cursor/commands/speckit.taskstoissues.md`

**说明**：实施前可再次执行 `grep -rl "\.specify/scripts/powershell" specs/ .iflow/commands/ multi-timeframe-webapp/` 确认清单完整；若存在 `.iflow/commands/` 下文件，同样逐文件替换。

### 5.5 其他 DEBATE/AUDIT/IMPROVEMENT 文档

| 任务ID | 修改路径 | 具体修改内容 | 验收 |
|--------|----------|--------------|------|
| 5.5.1 | （全文检索） | 在仓库范围内（排除 node_modules、_bmad-output/bmad-customization-backups、.merge-backup）对 `.md`、`.py`、`.ps1`、`.json`、`.txt` 执行检索：`tools/check_speckit`、`tools/migrate_`、`.specify/scripts/powershell`、`docs/speckit/.speckit-state.yaml.template`。对命中文件逐文件将旧路径替换为新路径（见 §2、§5.1～5.4）。 | 检索目标范围内无遗留旧路径（或仅保留「已废弃，请使用 _bmad/…」说明） |

---

## 阶段 6：更新测试

| 任务ID | 修改路径 | 具体修改内容 | 验收 |
|--------|----------|--------------|------|
| 6.1 | `tests/test_migrate_bmad_output_to_subdirs.py` | ① 将第 18 行（或定义 `script` 的语句）：`script = project_root / "tools" / "migrate_bmad_output_to_subdirs.py"` 替换为 `script = project_root / "_bmad" / "scripts" / "bmad-speckit" / "python" / "migrate_bmad_output_to_subdirs.py"`。② 将第 38 行（或 `test_migrate_script_exists` 中的同类路径）：`script = project_root / "tools" / "migrate_bmad_output_to_subdirs.py"` 替换为 `script = project_root / "_bmad" / "scripts" / "bmad-speckit" / "python" / "migrate_bmad_output_to_subdirs.py"`。若文件中尚有其他 `project_root / "tools"` 引用，一律改为 `project_root / "_bmad" / "scripts" / "bmad-speckit" / "python"`。 | 测试通过 |
| 6.2 | （执行） | 在项目根执行：`pytest tests/test_migrate_bmad_output_to_subdirs.py -v`，全部用例通过。 | 退出码 0，全部 passed |

---

## 阶段 7：验证与验收

| 任务ID | 修改路径 | 具体修改内容 | 验收 |
|--------|----------|--------------|------|
| 7.1 | （验证命令） | 在项目根执行：`python _bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py --epic 4 --story 1`，退出码 0 或 1（非异常）。 | 命令可执行 |
| 7.2 | （验证命令） | 在项目根执行：`python _bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py --dry-run`，退出码 0。 | 命令可执行 |
| 7.3 | （验证命令） | 在项目根执行：`python _bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py --dry-run`，退出码 0。 | 命令可执行 |
| 7.4 | （验证命令） | PowerShell：`& "$(git rev-parse --show-toplevel)/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1" -ModeBmad -Epic 4 -Story 1 -Slug implement-base-cache`（或等价），确认脚本可被调用。 | 无路径错误 |
| 7.5 | （验收） | 全文检索：在 §6「全文」范围内（.md、.py、.ps1、.json、.txt 及 specs/*/.cursor/commands/、.iflow/commands/、multi-timeframe-webapp/.cursor/commands/）无遗留 `tools/check_speckit_prerequisites.py`、`_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`、`_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py`、`docs/speckit/.speckit-state.yaml.template` 的旧路径引用（或仅保留「已废弃，请使用 _bmad/…」说明）。 | 无遗漏 |
| 7.6 | （验收） | 执行 bmad-customization-backup 后，检查 `_bmad-output/bmad-customization-backups/<timestamp>/` 中包含 `_bmad/scripts/bmad-speckit/`（含 `python/`、`powershell/`、`templates/`）。 | 备份可恢复 |

---

## 阶段 8：旧文件处理（可选）

| 任务ID | 修改路径 | 具体修改内容 | 验收 |
|--------|----------|--------------|------|
| 8.1 | （决策） | 是否删除或保留：`tools/check_speckit_prerequisites.py`、`_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`、`_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py`；`_bmad/scripts/bmad-speckit/powershell/*.ps1`；`docs/speckit/.speckit-state.yaml.template`。建议先保留，待文档与 CI 全部切到新路径后再删；或采用旧路径重定向脚本。 | 按决策执行 |

---

**文档结束。** 实施时按阶段 1～7 顺序执行；阶段 5.4 与 5.5 需覆盖全部所列文件及检索结果。
