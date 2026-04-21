# Upstream Dependencies & Sync Strategy

> **Current path**: upstream sync preserves runtime governance、scoped context 与 `runAuditorHost` wiring customizations
> **Legacy path**: sync 覆盖 host-runner / governance wiring，或把旧 post-audit 命令链视为 canonical

本文档说明 BMAD-Speckit-SDD-Flow 对上游的依赖、定制范围与同步策略。可参考 [BMAD-METHOD v6 Gaps 与同步建议](BMAD/BMAD-METHOD-v6-Gaps与同步建议.md)。

---

## 1. Upstream 依赖表

| 名称 | 版本/范围 | 用途 | 许可 |
|------|-----------|------|------|
| **BMAD-METHOD** | main@45d125f（2026-03-16 同步） | 工作流、party-mode、bmm/core/utility 模块、V6 core skills | MIT |
| **spec-kit** | 模板来源见 bmad-speckit init | 规范驱动开发（specify→plan→tasks） | MIT |

- **BMAD-METHOD 源码**: [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
- **spec-kit 来源**: `bmad-speckit init` 从 GitHub tarball 拉取，未直接依赖 npm 包

---

## 2. 定制范围

| 定制项 | 路径/说明 |
|--------|------------|
| **_bmad-overlay** | `_bmad/scoring/`、批判审计员、adversarial-reviewer、ai-coach |
| **speckit-workflow** | `.cursor/skills/speckit-workflow/`、`.cursor/commands/speckit.*` |
| **bmad-speckit CLI** | `_bmad/speckit/scripts/`、`packages/bmad-speckit/` |
| **agent-manifest** | `_bmad/_config/agent-manifest.csv` 中 adversarial-reviewer、ai-coach 条目 |
| **party-mode 定制（旧路径）** | `_bmad/core/workflows/party-mode/`（批判审计员角色注入、收敛条件定制；本地定制原始版本，已加入排除清单） |
| **party-mode 定制（新路径）** | `_bmad/skills/bmad-party-mode/`（V6 skill 格式 + 定制合并版；路径使用 `{project-root}` 绝对引用） |
| **V6 core skills canonical** | `_bmad/skills/`（Phase 2 同步时从 upstream `_bmad/core/skills/` 复制到此，然后删除 core/skills/ 避免冗余） |

---

## 3. 同步策略

- **BMAD**：按需同步（约 2–3 个大版本一次，或需要新功能时）。**无定期同步**。
- **spec-kit**：一般不定期同步；有明确需求时手工 cherry-pick 或评估后合并。

---

## 4. BMAD 同步排除清单

从 BMAD-METHOD 同步时**不得覆盖**以下路径（以 `scripts/bmad-sync-from-v6.ps1` 及文档为准）：

### 4.1 路径排除（永不覆盖）

| 类别 | 路径 |
|------|------|
| 整体排除 | `_bmad/_config/`、`_bmad/_memory/`、`_bmad/bmb/`（脚本额外排除，与 §4.1 具体项互补） |
| scoring | `_bmad/scoring/` |
| adversarial-reviewer | `_bmad/core/agents/adversarial-reviewer.md` |
| critical-auditor | `_bmad/core/agents/critical-auditor-guide.md`、`_bmad/core/agents/README-critical-auditor.md`、`_bmad/core/agents/bmad-master.md` |
| bmad-speckit | `_bmad/speckit/scripts/` |
| agent-manifest | `_bmad/_config/agent-manifest.csv` 中 adversarial-reviewer、ai-coach 条目 |
| party-mode workflow | `_bmad/core/workflows/party-mode/`（本地定制版，含批判审计员角色注入） |
| speckit-workflow | `.cursor/skills/speckit-workflow/`（项目根下，脚本不同步此路径；若扩展同步范围需加入排除） |
| speckit commands | `_bmad/cursor/commands/speckit.*` 或 `.cursor/commands/speckit.*`（同上） |
| Story 路径规则 | `_bmad/_config/eval-lifecycle-report-paths.yaml`、`_bmad/cursor/skills/bmad-story-assistant/`（epic-{epic}-{slug}/story-{story}-{slug}） |
| _config 定制 | `_bmad/_config/bmad-help.csv`、`_bmad/_config/skill-command-mapping.yaml` |
| bmm 定制 | `_bmad/bmm/module-help.csv`、`_bmad/bmm/workflows/4-implementation/bmad-code-review/`、`_bmad/bmm/workflows/4-implementation/create-story/`、`_bmad/bmm/workflows/bmad-quick-flow/bmad-quick-dev-new-preview/` |
| core/skills/commands | `_bmad/core/tasks/help.md`、`_bmad/skills/bmad-help/`、`_bmad/commands/bmad-agent-bmm-tech-writer.md`、`_bmad/commands/bmad-bmm-create-story.md`、`_bmad/commands/bmad-sft-extract.md` |
| bmad-help OFFICIAL vs legacy commands | `_bmad/commands/bmad-bmm-dev-story.md`、`_bmad/commands/bmad-bmm-quick-dev.md`、`_bmad/commands/bmad-bmm-quick-spec.md`、`_bmad/commands/bmad-agent-bmm-quick-flow-solo-dev.md`（Speckit-SDD-Flow 头部注记指向 **bmad-story-assistant** / **bmad-standalone-tasks**；同步时不覆盖） |
| Runtime Governance（E15） | `bmad-speckit sync-runtime-context-from-sprint` / `ensure-run-runtime-context` 接线涉及的 workflow、step、agent、SKILL：**完整路径见 §4.4**；`scripts/bmad-sync-from-v6.ps1` 中 `$EXCLUDE_PATTERNS` 与 `$BACKUP_ITEMS` 与本节对齐 |

### 4.2 需定期 Merge 的排除项（持续跟进上游）

以下路径在 `EXCLUDE_PATTERNS` 中，**建议定期与上游对比并手工 merge**，以便吸纳上游改进的同时保留项目定制：

| 路径 | 定制内容 | 建议检查时机 |
|------|----------|--------------|
| `_bmad/bmm/workflows/4-implementation/create-story/` | Story 路径规则（epic/story 含 slug） | 上游 create-story 有大版本更新时 |
| `_bmad/bmm/workflows/4-implementation/bmad-code-review/` | Code Review 流程定制 | 上游 code-review 有大版本更新时 |
| `_bmad/_config/bmad-help.csv`、`_bmad/_config/skill-command-mapping.yaml` | 帮助与命令映射 | 上游新增/调整命令时 |
| `_bmad/skills/bmad-help/` | bmad-help 技能定制 | 上游 bmad-help 有大版本更新时 |
| `_bmad/commands/bmad-bmm-dev-story.md` 等（见 §6.3） | Speckit-SDD-Flow 头部注记与 OFFICIAL skill 指向 | 上游 BMM quick / dev-story 命令有大版本更新时 |
| `_bmad/cursor/skills/bmad-story-assistant/` | Story 助手路径规则 | 上游 story 相关 workflow 更新时 |

**Merge 步骤**（需要吸纳上游更新时）：

1. **备份**：运行 `pwsh scripts/bmad-sync-from-v6.ps1 -Phase 1`（会备份 `BACKUP_ITEMS`）
2. **临时移除排除**：从 `$EXCLUDE_PATTERNS` 中注释或移除目标路径
3. **获取上游**：`pwsh scripts/bmad-sync-from-v6.ps1 -Phase 2 -DryRun` 查看将覆盖的文件；或单独 `git show upstream:path/to/file` 获取上游版本
4. **3-way merge**：用 `git diff`、`git merge-file` 或 IDE 合并工具，将上游改动与本地定制合并
5. **恢复排除**：合并完成后，将路径加回 `$EXCLUDE_PATTERNS`

### 4.3 同步脚本引用

BMAD 同步可选用 **`scripts/bmad-sync-from-v6.ps1`**：

```powershell
# 用法
pwsh scripts/bmad-sync-from-v6.ps1 -Phase 1 -DryRun   # 列出操作，不执行
pwsh scripts/bmad-sync-from-v6.ps1 -Phase 1            # Phase 1：path 标准化等
pwsh scripts/bmad-sync-from-v6.ps1 -Phase 2            # Phase 2：可选功能
pwsh scripts/bmad-sync-from-v6.ps1 -Phase all          # 全阶段
```

- **Phase 1**：Path 标准化、step-04 修正等  
- **Phase 2**：core/bmm/utility 模块同步（含 V6 core skills）；Phase 2 完成后将 upstream `_bmad/core/skills/` 复制到 `_bmad/skills/`（canonical），然后删除 `core/skills/` 避免冗余  
- **禁止覆盖项**：以本文档 §4.1 为准；脚本内置 `$EXCLUDE_PATTERNS` 与其一致（见脚本注释）
- **需定期 Merge 项**：见 §4.2，建议在重大上游更新时对比合并
- **默认 V6Ref**：脚本默认 `-V6Ref 21c2a48`（SHA）；同步最新内容时请显式传入 `-V6Ref main`
- **Runtime Governance 保护项**：见 §4.4；Phase 2 复制前 `$BACKUP_ITEMS` 含这些路径；同步结束后若需撤销，使用控制台输出的 **Rollback commands** 将备份拷回 `$ProjectRoot`

### 4.4 Runtime Governance（E15）— instructions / workflows 定制（同步时不覆盖）

以下路径由本项目写入 `bmad-speckit sync-runtime-context-from-sprint`、`ensure-run-runtime-context` 等接线；从 BMAD-METHOD 执行 Phase 2 时**不得被上游文件覆盖**。`scripts/bmad-sync-from-v6.ps1` 已将对应片段列入 `$EXCLUDE_PATTERNS`，并在每次运行开始时按 `$BACKUP_ITEMS` 备份，便于对比与回滚。

| 路径 | 说明 |
|------|------|
| `_bmad/bmm/workflows/4-implementation/sprint-planning/` | sprint-planning `instructions.md` 内 sync |
| `_bmad/bmm/workflows/4-implementation/sprint-status/` | sprint-status `instructions.md` 内 sync |
| `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md` | create-epics Step 4 内 sync 与前置说明 |
| `_bmad/bmm/workflows/4-implementation/create-story/` | create-story 内 `--story-key` sync（与 §4.1「create-story」排除项同一目录） |
| `_bmad/bmm/workflows/4-implementation/dev-story/` | dev-story `instructions.xml` 内 ensure-run |
| `_bmad/claude/agents/bmad-story-audit.md` | story audit agent 内 S10 sync |
| `_bmad/cursor/skills/bmad-story-assistant/` | Story 助手 SKILL 内 S10、S11（与 §4.1「bmad-story-assistant」排除项同一目录） |
| `_bmad/claude/skills/bmad-story-assistant/` | Claude 侧 Story 助手 SKILL 内 S11 post-audit |

**恢复步骤**：同步完成后若发现定制丢失，在当次运行输出的 **Rollback commands** 中查找对应 `Copy-Item`；备份根目录为运行开始时打印的 `$BackupDir`（默认 `_bmad-output/bmad-sync-backups/<timestamp>-<rand>`）。

---

## 5. 当前上游版本记录

| 上游 | 版本 | 同步日期 |
|------|------|----------|
| BMAD-METHOD | main@45d125f | 2026-03-16 |
| spec-kit | 模板来源见 bmad-speckit，无直接依赖版本号 | — |

同步时对照上述版本，确认 merge 基准。

### 同步历史

| 日期 | 来源 | 范围 | 备注 |
|------|------|------|------|
| 2026-03-16 | main@45d125f | core/bmm/utility | V6 content sync：新增 11 个 core skills、utility 模块、party-mode skill（canonical 路径 `_bmad/skills/bmad-party-mode/`） |
| 2026-02-22 | v6.0.1 | core/bmm | 初始 BMAD-METHOD v6 安装 |

---

## 6. 补充说明

### 6.1 新旧 Party-Mode 路径共存

项目中存在两个 party-mode 实现，功能内容已一致（定制均已合并）：

| 路径 | 类型 | 说明 |
|------|------|------|
| `_bmad/core/workflows/party-mode/` | 旧 workflow 格式 | 本地定制原始版本；已加入排除清单，同步时不被覆盖。当前多数 rule/skill 文件仍引用此路径。 |
| `_bmad/skills/bmad-party-mode/` | V6 skill 格式 | upstream V6 新结构 + 定制合并版本；所有引用路径使用 `{project-root}` 绝对引用。同步时 upstream `core/skills/` 复制到此，然后删除 `core/skills/` 避免冗余。 |

两个版本均可正常工作。未来如需统一路径引用，可将 rule/skill 文件中的 `workflows/party-mode` 迁移为 `skills/bmad-party-mode`。

### 6.2 config.yaml 版本号

`_bmad/bmm/config.yaml` 和 `_bmad/core/config.yaml` 中的 `Version: 6.0.1` 由初始 BMAD-METHOD 安装生成，属于项目级配置，不随 upstream 同步更新。实际同步基准以本文档 §5 的版本记录（`main@45d125f`）为准。

### 6.3 bmad-help：正式执行路径（Speckit-SDD-Flow）与上游命令

本项目在 **`bmad-help`** 工作流指引中将下列 **Cursor/Claude 技能** 作为正式入口；上游 BMAD **命令** 仍保留以便兼容，但**不推荐**作为首选（技能整合了 speckit-workflow、ralph-method、TDD 红绿灯与审计闭环）。

| 场景 | 正式路径（推荐） | 旧路径（不推荐单独使用） |
|------|------------------|---------------------------|
| Story / Dev Story | 技能 **`bmad-story-assistant`** | 命令 `bmad-bmm-dev-story`（`_bmad/commands/bmad-bmm-dev-story.md`） |
| 快速任务 / TASKS 列表 | 技能 **`bmad-standalone-tasks`** | `bmad-bmm-quick-dev`、`bmad-bmm-quick-spec`、`bmad-agent-bmm-quick-flow-solo-dev`（对应 `_bmad/commands/*.md`） |
| BUG 修复 / BUGFIX | 技能 **`bmad-bug-assistant`** | —（沿用既有 bug 流程时请走技能） |

**English:** **OFFICIAL** execution uses project skills (`bmad-story-assistant`, `bmad-standalone-tasks`, `bmad-bug-assistant`) that bundle speckit-workflow, audit loops, ralph-method, and TDD. Legacy BMAD command files stay in-repo for upstream parity; **Speckit-SDD-Flow** adds header notes on those commands—sync scripts exclude them from overwrite (see §4.1).
