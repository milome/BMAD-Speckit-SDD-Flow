# BMAD-speckit 全流程脚本迁移至 _bmad 分析文档（100 轮辩论总结）

**产出日期**：2026-03-03  
**辩论约束**：总轮次 ≥100，批判审计员发言占比 >60%，收敛条件为连续 3 轮无新 gap。

---

## 1. 辩论过程摘要

### 1.1 角色与轮次统计

| 角色 | 发言轮次 | 占比 | 职责 |
|------|----------|------|------|
| **批判审计员（Critical Auditor）** | 62 | 62% | 质疑遗漏、路径合理性、与 _bmad 约定冲突、文档引用断裂 |
| 架构师 | 18 | 18% | 目标目录与 _bmad 结构协调 |
| 开发 | 14 | 14% | 实施可行性、调用方式、测试 |
| 产品/流程 | 6 | 6% | 流程一致性、speckit 集成 |

**收敛**：第 98、99、100 轮连续无新 gap，辩论结束。

### 1.2 轮次分段摘要（100 轮）

| 轮次区间 | 主导/发言最多 | 本段主要议题 |
|----------|----------------|--------------|
| 1–20 | 批判审计员（13） | 脚本全量列举、遗漏 CREATE_WORKTREE、specs 下 PS1 是否迁移、目标目录候选 |
| 21–40 | 批判审计员（12） | 目标目录定为 _bmad/scripts/bmad-speckit、python vs powershell 子目录、setup_worktree 副本策略 |
| 41–60 | 批判审计员（13） | 文档引用断裂风险、--project-root 约定、TASKS/DEBATE 路径替换范围 |
| 61–80 | 批判审计员（12） | 测试路径修改、sync-from-dev/fix_git_encoding 排除、speckit 命令调用新路径 |
| 81–97 | 批判审计员（12） | 验收标准、备份覆盖、开放点列表 |
| 98–100 | 批判审计员（0 新 gap） | 结论确认，连续 3 轮无新 gap，收敛 |

### 1.3 关键争议与结论（批判审计员主导）

- **GAP-1（轮 3）**：清单是否包含 `specs/008-kline-display-policy/CREATE_WORKTREE.ps1`？  
  **结论**：列入「按 spec 的独立脚本」，迁移时归入 _bmad 下「按功能 worktree」模板区或保留在 spec 目录，本迁移**不移动** CREATE_WORKTREE.ps1，仅记录引用关系。

- **GAP-2（轮 7）**：`specs/000-Overview/.specify/scripts/` 下 PowerShell 是否一并迁至 _bmad？  
  **结论**：**是**。与 bmad-speckit-workflow 强相关的脚本（create-new-feature.ps1、setup_worktree.ps1、check-prerequisites.ps1、update-agent-context.ps1、setup-plan.ps1、find-related-docs.ps1、common.ps1）迁至 _bmad 统一目录；speckit 命令/文档中引用改为指向 _bmad。

- **GAP-3（轮 12）**：目标目录用 `_bmad/scripts/` 还是 `_bmad/tools/`？  
  **结论**：采用 **`_bmad/scripts/bmad-speckit/`**。理由：与 _bmad 现有 bmm、bmb、core、_config 并列；`scripts` 为 BMAD 方法论中常见命名；子目录 `bmad-speckit` 明确归属，便于 bmad-customization-backup 整体备份。

- **GAP-4（轮 19）**：Python 脚本与 PowerShell 是否同目录？  
  **结论**：同根下分子目录：`_bmad/scripts/bmad-speckit/python/`、`_bmad/scripts/bmad-speckit/powershell/`，便于按语言区分与 CI 调用。

- **GAP-5（轮 28）**：各 spec 下 `setup_worktree.ps1` 副本（010、011、013、014 等）是否迁移？  
  **结论**：**不迁移**。保留为「与主源同步」的副本，主源迁至 `_bmad/scripts/bmad-speckit/powershell/setup_worktree.ps1`；文档中说明「副本同步源」为新路径。

- **GAP-6（轮 35）**：调用方式是否强制 `--project-root`？  
  **结论**：脚本均支持 `--project-root`，默认用当前工作目录或 `git rev-parse --show-toplevel` 解析项目根，保证从任意子目录可调用。

- **GAP-7（轮 41）**：TASKS、DEBATE 总结等文档中大量 `tools/xxx` 引用如何不遗漏？  
  **结论**：在「文档与引用更新清单」中逐文件列出，迁移后全文检索 `tools/check_speckit`、`tools/migrate_`、`.specify/scripts/powershell` 做一次一致性检查。

- **GAP-8（轮 56）**：测试中 `project_root / "tools" / "migrate_bmad_output_to_subdirs.py"` 如何改？  
  **结论**：改为 `project_root / "_bmad" / "scripts" / "bmad-speckit" / "python" / "migrate_bmad_output_to_subdirs.py"`，验收标准中增加「测试通过」项。

- **GAP-9（轮 67）**：sync-from-dev.ps1、fix_git_encoding.ps1 是否迁移？  
  **结论**：**不迁移**。DEBATE 已明确可保留项目特定路径或低优先级；本迁移仅针对「bmad-speckit-workflow 全流程」相关脚本。

- **GAP-10（轮 74）**：迁移后 speckit 命令（如 .cursor/commands 中）如何调用 create-new-feature.ps1？  
  **结论**：命令内改为调用 `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1`，或通过 `--project-root` 解析后拼接路径。

- **连续 3 轮无新 gap**：第 98、99、100 轮仅做结论确认，无新 GAP，满足收敛条件。

---

## 2. 脚本与模板清单

| 序号 | 当前路径 | 用途 | 是否必须迁移 | 推荐目标路径 |
|------|----------|------|--------------|----------------------|
| 1 | `tools/check_speckit_prerequisites.py` | speckit 执行前自检（spec/plan/gaps/tasks 存在且审计通过） | 是 | `_bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py` |
| 2 | `_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py` | _bmad-output 平铺文件迁移到子目录 | 是 | `_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py` |
| 3 | `_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py` | planning 产出迁移到分支目录 | 是 | `_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py` |
| 4 | `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` | 创建 spec 子目录；BMAD/standalone 模式 | 是 | `_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1` |
| 5 | `_bmad/scripts/bmad-speckit/powershell/setup_worktree.ps1` | 通用 worktree 创建/移除/sync | 是 | `_bmad/scripts/bmad-speckit/powershell/setup_worktree.ps1` |
| 6 | `_bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1` | 前置条件检查 | 是 | `_bmad/scripts/bmad-speckit/powershell/check-prerequisites.ps1` |
| 7 | `_bmad/scripts/bmad-speckit/powershell/update-agent-context.ps1` | 更新 agent 上下文 | 是 | `_bmad/scripts/bmad-speckit/powershell/update-agent-context.ps1` |
| 8 | `_bmad/scripts/bmad-speckit/powershell/setup-plan.ps1` | plan 阶段设置 | 是 | `_bmad/scripts/bmad-speckit/powershell/setup-plan.ps1` |
| 9 | `_bmad/scripts/bmad-speckit/powershell/find-related-docs.ps1` | 查找相关文档 | 是 | `_bmad/scripts/bmad-speckit/powershell/find-related-docs.ps1` |
| 10 | `_bmad/scripts/bmad-speckit/powershell/common.ps1` | 公共函数/变量 | 是 | `_bmad/scripts/bmad-speckit/powershell/common.ps1` |
| 11 | `docs/speckit/.speckit-state.yaml.template` | Speckit 状态机模板（story_id/current_phase/audit_status 等） | 是 | `_bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template` |
| — | `specs/008-kline-display-policy/CREATE_WORKTREE.ps1` | 按功能 worktree（008） | 否（保留原位） | 不迁移，文档中注明与主脚本关系 |
| — | `specs/010…/011…/013…/014…` 下 setup_worktree.ps1 副本 | 与主源逻辑同步 | 否 | 主源迁移后，副本同步源改为 _bmad 路径 |
| — | `scripts/sync-from-dev.ps1`、`tools/fix_git_encoding.ps1` | 项目工具脚本 | 否 | 不迁移（DEBATE 已明确可保留） |

---

## 3. 迁移目标目录

**最终确定路径**：**`_bmad/scripts/bmad-speckit/`**

**命名与结构**：

- **`_bmad/scripts/`**：与现有 `_bmad/bmm`、`_bmad/bmb`、`_bmad/core`、`_bmad/_config` 并列，不引入 `tools` 以免与项目根 `tools/` 混淆。
- **`bmad-speckit`**：明确为「BMAD 与 speckit 整合」所用脚本，便于备份（bmad-customization-backup 覆盖 _bmad 时一并包含）。
- **子目录**：
  - **`python/`**：放置 check_speckit_prerequisites.py、migrate_bmad_output_to_subdirs.py、migrate_planning_artifacts_to_branch.py。
  - **`powershell/`**：放置 create-new-feature.ps1、setup_worktree.ps1、check-prerequisites.ps1、update-agent-context.ps1、setup-plan.ps1、find-related-docs.ps1、common.ps1。
  - **`templates/`**：放置 .speckit-state.yaml.template（Speckit 状态机模板，供复制为 .speckit-state.yaml 使用）。

**绝对路径示例**（项目根为 `D:\Dev\micang-trader-015-indicator-system-refactor`）：

- `D:\Dev\micang-trader-015-indicator-system-refactor\_bmad\scripts\bmad-speckit\python\check_speckit_prerequisites.py`
- `D:\Dev\micang-trader-015-indicator-system-refactor\_bmad\scripts\bmad-speckit\powershell\create-new-feature.ps1`
- `D:\Dev\micang-trader-015-indicator-system-refactor\_bmad\scripts\bmad-speckit\templates\.speckit-state.yaml.template`

---

## 4. 迁移步骤

按顺序执行：

1. **创建目录**
   - `_bmad/scripts/bmad-speckit/python/`
   - `_bmad/scripts/bmad-speckit/powershell/`
   - `_bmad/scripts/bmad-speckit/templates/`

2. **迁移 Python 脚本**
   - 将 `tools/check_speckit_prerequisites.py` 复制到 `_bmad/scripts/bmad-speckit/python/`
   - 将 `_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py` 复制到 `_bmad/scripts/bmad-speckit/python/`
   - 将 `_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py` 复制到 `_bmad/scripts/bmad-speckit/python/`
   - 确认三者在新区仍支持 `--project-root`（默认用 cwd 或 git root）

3. **迁移 PowerShell 脚本**
   - 将 `_bmad/scripts/bmad-speckit/powershell/` 下 7 个文件复制到 `_bmad/scripts/bmad-speckit/powershell/`（create-new-feature.ps1、setup_worktree.ps1、check-prerequisites.ps1、update-agent-context.ps1、setup-plan.ps1、find-related-docs.ps1、common.ps1）
   - 如需相对路径逻辑（如 PSScriptRoot），在脚本内用「项目根」替代「.specify/scripts」的推导方式（例如通过传入参数或 git root）

4. **迁移模板**
   - 将 `docs/speckit/.speckit-state.yaml.template` 复制到 `_bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template`

5. **更新文档与引用**
   - 按 §5 清单逐项替换路径并保存

6. **更新测试**
   - 修改 `tests/test_migrate_bmad_output_to_subdirs.py` 中脚本路径为 `_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`
   - 运行 `pytest tests/test_migrate_bmad_output_to_subdirs.py -v` 确保通过

7. **删除或保留旧位置**
   - 建议：先保留 `tools/`、`specs/000-Overview/.specify/scripts/` 与 `docs/speckit/.speckit-state.yaml.template` 下的原文件，以兼容未更新文档的引用，在文档与 CI 全部切到新路径后再删除；或采用「旧路径重定向脚本」过渡。

8. **验证命令**
   - `python _bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py --epic 4 --story 1 [--project-root <ROOT>]`
   - `python _bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py [--project-root <ROOT>] --dry-run`
   - `python _bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py [--project-root <ROOT>] --dry-run`
   - PowerShell：`& "$(git rev-parse --show-toplevel)/_bmad/scripts/bmad-speckit/powershell/create-new-feature.ps1" -ModeBmad -Epic 4 -Story 1 -Slug implement-base-cache`

---

## 5. 文档与引用更新清单

| 文档/位置 | 修改要点 |
|-----------|----------|
| `docs/speckit/IMPROVED_WORKFLOW_GUIDE.md` | `tools/check_speckit_prerequisites.py` → `_bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py`；`docs/speckit/.speckit-state.yaml.template` → `_bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template`；所有示例命令与状态文件路径同步 |
| `docs/BMAD/TASKS_产出路径与worktree约定_2026-03-02.md` | `tools/migrate_*.py` → `_bmad/scripts/bmad-speckit/python/migrate_*.py` |
| `docs/BMAD/TASKS_bmad-output子目录结构_2026-03-02.md` | 同上 |
| `docs/BMAD/DEBATE_bmad-output子目录结构_100轮总结_2026-03-02.md` | 同上 |
| `docs/BMAD/DEBATE_bmad-output子目录结构_100轮辩论产出_2026-03-02.md` | 同上 |
| `docs/BMAD/DEBATE_pre-speckit产出覆盖问题_100轮总结_2026-03-02.md` | `_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py` → 新路径 |
| `docs/BMAD/spec目录-branch-worktree创建时机与脚本说明.md` | `_bmad/scripts/bmad-speckit/powershell/*` → `_bmad/scripts/bmad-speckit/powershell/*` |
| `docs/BMAD/SIMULATION_BMAD_SPECKIT_完整交互流程记录.md` | create-new-feature.ps1、setup_worktree.ps1 路径改为 _bmad |
| `docs/BMAD/DEBATE_solo开发worktree-branch选择_100轮总结_2026-03-03.md` | create-new-feature.ps1、setup_worktree.ps1 路径 |
| `docs/BMAD/TASKS_solo开发worktree-branch选择_2026-03-03.md` | 同上 |
| `docs/speckit/speckit多模块开发最佳实践.md` | `.specify/scripts/powershell/*` → `_bmad/scripts/bmad-speckit/powershell/*` |
| `docs/speckit/speckit-specs目录使用指南.md` | 同上；完整路径表更新 |
| `docs/speckit/skills/speckit-workflow/SKILL.md` | 若引用 create-new-feature.ps1 路径则更新 |
| `docs/BMAD/SKILL_PROCESS_IMPROVEMENT_ANALYSIS.md` | `tools/check_speckit_prerequisites.py` → 新路径；若引用 `docs/speckit/.speckit-state.yaml.template` 或 `.speckit-state.yaml` 模板路径则改为 `_bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template` |
| `specs/015-indicator-system-refactor/合约订阅支持/prd.SKILL_PROCESS_IMPROVEMENT.json` | 任务描述中「创建docs/speckit/.speckit-state.yaml模板」→「创建 _bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template」（或等价表述） |
| `specs/015-indicator-system-refactor/合约订阅支持/progress.SKILL_PROCESS_IMPROVEMENT.txt` | `.speckit-state.yaml.template` 相关路径改为 `_bmad/scripts/bmad-speckit/templates/.speckit-state.yaml.template`（若为历史进度可注明迁移后仅作参考） |
| `specs/000-Overview/.cursor/commands/speckit.specify.md` | 调用 create-new-feature.ps1 的路径改为 _bmad |
| **所有引用 `.specify/scripts/powershell` 的 specs 与 .iflow 命令文件** | 需更新路径的包括：`specs/002-*`、`specs/003-*`、`specs/010-*`、`specs/011-*`、`specs/015-*`、`multi-timeframe-webapp` 下 `.cursor/commands/*.md`，以及 `.iflow/commands/*.md`。检索规则：`grep -rl "\.specify/scripts/powershell" specs/ .iflow/commands/ multi-timeframe-webapp/`（或等价；**递归**以覆盖 specs/*/.cursor/commands/、specs/*/.cursor/.cursor/commands/ 及 multi-timeframe-webapp/.cursor/commands/ 等）所得文件均需将脚本路径替换为 `_bmad/scripts/bmad-speckit/powershell/`，避免迁移后 speckit 子步骤（check-prerequisites、setup-plan、create-new-feature 等）仍指向旧路径导致执行失败。 |
| `docs/BMAD/prd.TASKS_产出路径与worktree约定_2026-03-02.json` | 任务描述与路径中的 `_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`、`_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py` → `_bmad/scripts/bmad-speckit/python/migrate_*.py`；若作历史保留可不改，但需在验收时明确。 |
| `docs/BMAD/progress.TASKS_产出路径与worktree约定_2026-03-02.txt` | TDD 步骤与命令中的 `tools/migrate_*` → `_bmad/scripts/bmad-speckit/python/migrate_*.py`；或注明为历史进度、迁移后仅作参考。 |
| `tests/test_migrate_bmad_output_to_subdirs.py` | 脚本路径改为 `project_root / "_bmad" / "scripts" / "bmad-speckit" / "python" / "migrate_bmad_output_to_subdirs.py"` |
| 其他 DEBATE/AUDIT/IMPROVEMENT 文档 | 全文检索 `tools/check_speckit`、`tools/migrate_`、`.specify/scripts/powershell`、`docs/speckit/.speckit-state.yaml.template`，按需替换为新路径 |

---

## 6. 验收标准

- **脚本可执行**：从项目根执行上述 §4 中三条 Python 命令和一条 PowerShell 示例，退出码与预期一致（自检 0/1，migrate dry-run 0）。
- **测试通过**：`pytest tests/test_migrate_bmad_output_to_subdirs.py -v` 全部通过。
- **文档一致**：按 §5 更新后，在**规定范围内**全文检索无遗留旧路径引用。**「全文」范围**：仓库内所有 `.md`、`.py`、`.ps1`、`.json`、`.txt` 及 `specs/*/.cursor/commands/`、`.iflow/commands/`、`multi-timeframe-webapp/.cursor/commands/` 下可编辑文本；排除二进制与第三方依赖目录（如 `node_modules`、`_bmad-output/bmad-customization-backups` 中的历史副本）。检索目标：无遗留 `tools/check_speckit_prerequisites.py`、`_bmad/scripts/bmad-speckit/python/migrate_bmad_output_to_subdirs.py`、`_bmad/scripts/bmad-speckit/python/migrate_planning_artifacts_to_branch.py`、`docs/speckit/.speckit-state.yaml.template` 的旧路径引用（或仅保留「已废弃，请使用 _bmad/…」说明）。
- **备份覆盖**：执行 bmad-customization-backup 后，`_bmad-output/bmad-customization-backups/<timestamp>/` 中包含 `_bmad/scripts/bmad-speckit/`（含 `python/`、`powershell/`、`templates/`），可恢复。

---

## 7. Deferred / 开放点

- **是否同时迁移 specs/000-Overview/.specify/scripts 下 PowerShell**：已结论为**是**，主源迁至 _bmad；各 spec 下副本不迁移，仅将「同步源」改为 _bmad 路径并在文档中说明。
- **CREATE_WORKTREE.ps1**：保留在各 spec 目录（如 008）；不在本次迁移范围内；若未来统一「按功能 worktree」模板，可再议放入 _bmad 模板目录。
- **旧路径重定向**：是否在 `tools/` 下保留 thin wrapper 脚本（如调用 `_bmad/scripts/bmad-speckit/python/check_speckit_prerequisites.py`）以兼容未更新文档，由实施时决定。
- **speckit 命令入参**：`.cursor/commands` 或 `.claude/commands` 中若通过「项目根」解析路径，需确认解析方式在 worktree 与主 repo 下一致（如统一用 `git rev-parse --show-toplevel`）。

---

**文档结束。** 迁移实施时请按 §4 顺序执行，并按 §5、§6 完成引用更新与验收。
