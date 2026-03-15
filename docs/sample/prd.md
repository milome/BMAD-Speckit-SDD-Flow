---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
inputDocuments:
  - docs/plans/技能目录分类整理分析与任务列表.md
workflowType: 'prd'
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 1
classification:
  projectType: developer_tool
  domain: AI Agent Workflow Orchestration & Cross-Platform Skill Management
  complexity: medium
  projectContext: brownfield
---

# Product Requirements Document - BMAD-Speckit-SDD-Flow

**Author:** User
**Date:** 2026-03-15

## Executive Summary

BMAD-Speckit-SDD-Flow 是一个审计驱动的 AI Agent 工作流框架，当前已在 Cursor 平台上实现了完整的 Story 创建、代码审计、scoring 写入和实施后验证闭环。然而，框架的 15 个技能中有 8 个强依赖 Cursor 专用调度机制（Cursor Task），导致 Claude Code CLI 用户只能通过降级回退（`mcp_task`）运行部分工作流，无法获得与 Cursor 对等的审计体验。

本项目的目标是：**建立清晰的三目录技能架构，消除目录冗余和错位，并为 Claude Code CLI 创建 7 个原生适配版技能**——使两个平台在功能等价和操作习惯上完全对等。

### What Makes This Special

核心差异化在于「Canonical Base + Runtime Adapter」三层适配架构：

- **业务语义层**（审计标准、收敛规则、提示词模板）跨平台完全统一，确保审计质量不因平台切换而降级
- **执行体映射层**仅替换调度机制（Cursor Task → `.claude/agents/auditor-*`），保持 1:1 功能对等
- **提示词模板完整性铁律**保障适配质量——所有模板逐字复制，禁止摘要/概括/缩略

已验证的参考实现：`.claude/skills/bmad-story-assistant/SKILL.md`（1700+ 行）证明了这条适配路径的可行性和质量标准。

## Project Classification

| 维度 | 值 |
|------|-----|
| 项目类型 | Developer Tool（AI Agent 基础设施工具链） |
| 领域 | AI Agent 工作流编排与跨平台技能管理 |
| 复杂度 | 中等 |
| 项目背景 | Brownfield（在现有 BMAD 框架上重组与扩展） |

## Success Criteria

### User Success

- **审计闭环对等**：Claude Code CLI 用户触发任意技能（speckit-workflow、bmad-story-assistant、bmad-bug-assistant 等）时，`auditor-*` 系列执行体能被自动调度，审计报告格式和评分写入与 Cursor 完全一致
- **零降级运行**：8 个原 Cursor 专用技能在 Claude Code CLI 中全部走 `.claude/agents/auditor-*` 原生路径，不再依赖 `mcp_task` 降级回退作为主路径
- **目录一目了然**：`skills/`（7 个公共）、`.cursor/skills/`（8 个 Cursor 专用）、`.claude/skills/`（8 个 Claude 适配）三目录职责清晰，零冗余、零错位

### Business Success

- **完整交付**：全部 10 个任务（T1-T9 含 T2a）完成，无遗留
- **引用完整性**：全仓库 52+ 个文件中 137+ 处跨文件引用全部更新到位，`rg` 验证零残留
- **可维护性**：建立「Cursor 版更新 → Claude 适配版同步」的清晰维护路径，后续新增技能可按既有模式快速适配

### Technical Success

- **提示词模板完整性**：每个 Claude 适配版的模板行数 ≥ Cursor 版的 90%（差异仅来自执行体映射替换，不来自内容删减）
- **模板 ID 一致**：Claude 适配版包含的模板 ID 数量与 Cursor 版完全一致
- **Fallback 链可用**：每个适配版的 Fallback 链（auditor-* → OMC reviewer → code-review skill → 主 Agent）各层均可正确触发
- **引用回迁完成**：`.claude/agents/` 中所有引用从 `.cursor/skills/X/` 更新为 `.claude/skills/X/`
- **验证命令全绿**：每个任务的 `bash` 验证脚本执行后全部输出 `PASS`，零 `FAIL`

### Measurable Outcomes

| 指标 | 目标值 | 验证方式 |
|------|--------|----------|
| `skills/` 技能数 | 7（仅公共） | `ls -d skills/*/SKILL.md \| wc -l` |
| `.cursor/skills/` 技能数 | 8（Cursor 专用） | `ls -d .cursor/skills/*/SKILL.md \| wc -l` |
| `.claude/skills/` 技能数 | 8（Claude 适配） | `ls -d .claude/skills/*/SKILL.md \| wc -l` |
| 裸 `skills/X/` 残留引用 | 0 | `rg` + `grep -v` 验证命令 |
| Claude 适配版数 | 8（含已有的 bmad-story-assistant） | 文件存在性检查 |

## Product Scope

### MVP - Minimum Viable Product

**本项目无 MVP / Growth / Vision 分层——全部 10 个任务是一个不可分割的整体交付。**（详细执行阶段见 [Phased Execution Plan](#phased-execution-plan)）

### Growth Features (Post-MVP)

- 新增技能时自动检测应归入公共/Cursor/Claude 哪个目录
- Claude 适配版与 Cursor 版的 diff 自动化检查（CI 级别）

### Vision (Future)

- 第三方平台适配层（Gemini、Codex 等）——基于相同的 Canonical Base，扩展新的 Runtime Adapter

## User Journeys

### Journey 1: Ming — Claude Code CLI 开发者（核心体验路径）

**Ming** 是一个全栈工程师，习惯在终端中用 Claude Code CLI 进行开发。他刚接到一个新 Story（Epic 14, Story 3），需要走完 BMAD 的完整工作流。

**Opening Scene：** Ming 在 Claude Code CLI 中输入 `/bmad story 14 3`，期望像 Cursor 同事一样进入 Create Story → 审计 → Dev Story 流程。但当前只有 `bmad-story-assistant` 有 Claude 适配版——当他需要 `speckit-workflow` 的 specify/plan 阶段审计时，系统走了 `mcp_task` 降级回退，审计报告格式与 Cursor 版不同，scoring 也没有正确写入。他感到困惑：「为什么我的审计结果和同事的不一样？」

**Rising Action：** 项目完成三目录整理后，Ming 再次触发同样的流程。这次 `.claude/skills/speckit-workflow/SKILL.md` 被加载，specify 阶段自动调度 `.claude/agents/auditor-spec`，审计报告格式与 Cursor 版一致，scoring 正确写入。他继续推进到 plan、gaps、tasks 阶段，每个阶段的 auditor 都按预期工作。

**Climax：** 实施完成后，`auditor-implement` 自动触发实施后审计，批判审计员以 >70% 占比发言，3 轮无 gap 收敛。Ming 看到审计报告输出的格式和评分标准与 Cursor 同事完全一致。

**Resolution：** Ming 提交代码，scoring 正确写入，Story 关闭。他不再需要关心自己用的是哪个平台——工作流体验完全对等。

### Journey 2: Ming — Claude Code CLI 开发者（边缘情况：审计失败回退）

**Opening Scene：** Ming 在 Claude Code CLI 中触发 `bmad-bug-assistant` 进行根因分析。`.claude/agents/auditor-bugfix` 因网络问题无法启动。

**Rising Action：** Fallback 链自动生效——系统尝试 OMC reviewer，成功加载。审计以 OMC reviewer 身份执行，仍使用完整的审计提示词模板（因为模板已逐字复制到 Claude 适配版中）。

**Climax：** 审计完成，报告格式与 primary executor 产出一致，scoring 写入正常。Ming 看到一条提示：「已通过 Fallback 执行体完成审计（OMC reviewer）」。

**Resolution：** Ming 确认 BUGFIX 文档通过审计，继续实施。Fallback 机制透明地保障了工作流不中断。

### Journey 3: Wei — Cursor 开发者（核心体验路径）

**Wei** 一直在 Cursor 中使用 BMAD。三目录整理前，她注意到 `skills/` 目录有 15 个技能，`.cursor/skills/` 也有 15 个完全一样的——她不确定哪个是「真正的」版本。

**Opening Scene：** Wei 打开 Cursor，在技能列表中看到同名技能出现两次（`skills/bmad-story-assistant` 和 `.cursor/skills/bmad-story-assistant`），不确定哪个会被加载。

**Rising Action：** 项目完成清理后，`skills/` 只剩 7 个公共技能，`.cursor/skills/` 中是 8 个 Cursor 优化版。Wei 看到目录结构清晰：公共技能她和 Claude Code CLI 的同事共享，Cursor 专用版只属于她。

**Climax：** Wei 触发 `speckit-workflow`，Cursor 从 `.cursor/skills/` 加载优化版，`Cursor Task 调度 code-reviewer` 正常工作。功能没有任何变化——但她现在明白了为什么这个技能在 `.cursor/skills/` 而不是 `skills/`。

**Resolution：** 目录结构的清晰性消除了 Wei 的困惑，她可以自信地知道每个技能为什么在那个位置。

### Journey 4: Li — 技能维护者（新增技能场景）

**Li** 需要为团队新增一个技能 `bmad-deploy-reviewer`，这个技能需要审计子代理。

**Opening Scene：** Li 参考三目录架构规则和 §1.2 的四项判定标准，判断这个新技能包含 `Cursor Task 调度 code-reviewer`——不是公共技能。

**Rising Action：** Li 先在 `.cursor/skills/bmad-deploy-reviewer/` 创建 Cursor 版，完成调试。然后参照 `bmad-story-assistant` 的三层适配架构，在 `.claude/skills/bmad-deploy-reviewer/` 创建 Claude 适配版。他按照第七节「提示词模板完整性规则」逐条执行检查清单。

**Climax：** 适配版的模板行数对比通过（≥90%），模板 ID 一致，占位符清单完整，`【必读】` 防护行保留。Li 在文件头追加 `<!-- TEMPLATE_INTEGRITY_CHECK: PASSED (2026-03-20) -->`。

**Resolution：** 新技能在两个平台都可正常使用，Li 总共用了约 2 小时完成适配——因为有清晰的模式和检查清单可循。

### Journey 5: CI — 自动化验证系统（引用完整性守护）

**Opening Scene：** CI 管道在每次 PR 合并到 `dev` 分支后自动运行验证脚本。

**Rising Action：** 验证脚本执行以下检查：
1. `skills/` 目录只有 7 个公共技能
2. `.cursor/skills/` 有 8 个技能
3. `.claude/skills/` 有 8 个技能
4. `rg` 扫描全仓库，确认无裸 `skills/X/` 残留引用（排除正确前缀）
5. 每个 Claude 适配版的模板行数 ≥ Cursor 版 90%

**Climax：** 某次 PR 中，一个开发者在 `docs/` 中新增了一个引用 `.cursor/skills/speckit-workflow/references/audit-prompts.md` 的路径——CI 立即报红：`FAIL: 裸 .cursor/skills/speckit-workflow/ 引用 at docs/new-guide.md:42`。

**Resolution：** 开发者修正路径为 `.cursor/skills/speckit-workflow/references/audit-prompts.md`，CI 通过。引用完整性得到持续守护。

### Journey Requirements Summary

| 旅程 | 揭示的能力需求 |
|------|---------------|
| Journey 1 (CLI 核心) | 所有 auditor-* 执行体映射、scoring 写入、完整工作流闭环 |
| Journey 2 (CLI 回退) | Fallback 链各层可用、模板完整性保障降级体验 |
| Journey 3 (Cursor 核心) | 目录去冗余、加载优先级正确、功能不回退 |
| Journey 4 (维护者) | 三层适配架构模式、检查清单、维护路径清晰 |
| Journey 5 (CI) | 验证脚本自动化、引用完整性持续守护、回归检测 |

## Domain-Specific Requirements

### 跨平台兼容性约束

- **执行体差异**：Cursor Task 与 `.claude/agents/` 是完全不同的调度范式，适配时必须确保语义等价而非 API 等价
- **加载优先级**：同名技能在 `skills/` 和 `.cursor/skills/`（或 `.claude/skills/`）中同时存在时，平台专用版必须优先加载
- **路径命名空间隔离**：`.cursor/` 下的引用不得出现在 `.claude/` 中，反之亦然

### 提示词模板完整性风险

- **核心风险**：AI Agent 在适配过程中倾向于「概括」和「摘要」长模板，这会导致审计质量降级。第七节铁律专门防范此风险
- **验证手段**：行数对比（≥90%）、模板 ID 一致性检查、占位符清单对比

### 集成约束

- **Scoring 系统**：`parse-and-write-score.ts` 和 `check-story-score-written.ts` 是共享基础设施，Claude 适配版必须产出与 Cursor 版格式一致的审计报告，否则 scoring 写入会失败
- **`.claude/agents/` 引用回迁**：适配完成后必须更新 `.claude/agents/` 内部引用，否则执行体找不到正确的 references 路径

## Developer Tool Specific Requirements

### Project-Type Overview

BMAD-Speckit-SDD-Flow 是一个 AI Agent 技能框架，技能以 Markdown 文件（`SKILL.md`）形式定义，由 AI IDE（Cursor）或 CLI（Claude Code）在运行时加载。它不通过包管理器分发，而是通过 git 仓库直接管理。

### Platform Integration Matrix

| 平台 | 技能加载路径 | 调度机制 | 审计执行体 |
|------|------------|----------|-----------|
| Cursor IDE | `skills/` + `.cursor/skills/`（专用优先） | Cursor Task | `.cursor/agents/code-reviewer.md` |
| Claude Code CLI | `skills/` + `.claude/skills/`（专用优先） | Agent tool + `.claude/agents/` | `.claude/agents/auditor-*` |

### Installation & Migration

- **安装方式**：`git clone` + BMAD installer（`_bmad/` 目录结构自动生成）
- **迁移路径**：本项目即是一次重大迁移——从混合 `skills/` 到三目录分离架构
- **向后兼容**：Cursor 用户在目录整理后功能无变化（Journey 3 验证），仅目录位置变更

### Skill File Architecture

每个技能的文件结构：

```
.cursor/skills/bmad-story-assistant/
├── SKILL.md              # 主技能定义（Cursor 版）
└── references/            # 审计提示词模板等引用文件
    ├── audit-prompts.md
    └── audit-post-impl-rules.md

.claude/skills/bmad-story-assistant/
├── SKILL.md              # Claude 适配版（三层架构）
└── references/            # 完整复制的引用文件
    ├── audit-prompts.md
    └── audit-post-impl-rules.md
```

### Documentation Requirements

- 每个 Claude 适配版必须在文件头包含 `<!-- TEMPLATE_INTEGRITY_CHECK: PASSED (date) -->` 标记
- `docs/PATH_CONVENTIONS.md` 需更新以反映三目录架构
- `CLAUDE.md` 的 Directory Structure 和 Skills 段需同步更新

### Implementation Considerations

- **适配顺序约束**：T3（speckit-workflow）必须先于 T4-T7，因为它定义了审计阶段的提示词体系
- **原子性**：每个任务（T1-T9）应作为独立 commit，便于回退
- **验证即文档**：每个任务自带 `bash` 验证脚本，既是验证手段也是操作说明

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP 策略：整体交付（Monolithic Delivery）**

本项目不采用传统的 MVP 分层——全部 10 个任务（T1-T9 含 T2a）构成一个完整交付单元。原因：
- T1-T2a 是目录清理的原子操作，部分完成会导致引用断裂
- T3 是 T4-T7 的基础依赖，不完成 T3 则后续适配无法开始
- 目录结构不一致的中间状态对两个平台的用户都会造成困惑

**执行分阶段，但交付不分阶段。**

### Phased Execution Plan

| 阶段 | 任务 | 风险等级 | 关键依赖 |
|------|------|---------|---------|
| Phase 1: 目录清理 | T1, T2, T2a | 中 | 无外部依赖；T2 前需 git commit |
| Phase 2: 基础适配 | T3, T4 | 高 | T3 是所有后续适配的审计体系基础 |
| Phase 3: 核心适配 | T5, T6, T7 | 中 | 依赖 T3/T4 完成 |
| Phase 4: 补全适配 | T8, T9 | 低 | 仅依赖 T2a，可与 Phase 2-3 并行 |

### Risk Mitigation Strategy

**技术风险：**

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| T2a 批量替换误伤 | 中 | T2 前 git commit；替换后 `git diff` 人工审查；使用 `perl -pi -e` 负向断言 |
| T3 speckit-workflow 适配失败 | 高 | 已定义回退方案：保留 `.claude/skills/speckit-workflow/` 供迭代，不删除 `.cursor/` 版本 |
| 提示词模板被 AI 概括/截断 | 高 | 第七节铁律 + 行数对比验证 + `【必读】` 防护行 + 检查清单 |
| Scoring 写入格式不兼容 | 中 | 先跑 T4（bmad-code-reviewer-lifecycle）的端到端测试，确认 scoring 格式一致 |

**执行风险：**

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 上下文窗口不足以完整复制长模板 | 中 | 分段复制 + 行数验证；bmad-story-assistant 的 1700+ 行已验证可行性 |
| T8/T9 与 T3-T7 并行时引用冲突 | 低 | T8/T9 仅依赖 T2a，不涉及 T3-T7 的审计体系 |

## Functional Requirements

### 目录架构管理

- FR1: 维护者可以根据四项判定标准（子代理调度、执行体引用、审计闭环、降级行为）将技能分类为公共、Cursor 专用或 Claude 适配
- FR2: 系统在技能加载时，同名技能的平台专用版优先于公共版加载
- FR3: 维护者可以从 `.cursor/skills/` 中移除与 `skills/` 重复的公共技能副本
- FR4: 维护者可以从 `skills/` 中移除 Cursor 专用技能（已有 `.cursor/skills/` 副本承载）

### 跨文件引用管理

- FR5: 维护者可以批量更新全仓库中的技能路径引用（从 `skills/X/` 到 `.cursor/skills/X/`）
- FR6: 系统提供验证命令，检测全仓库是否存在残留的裸 `skills/X/` 引用
- FR7: CI 系统可以自动运行引用完整性验证，在 PR 中发现新引入的裸引用时报错

### Claude Code CLI 技能适配

- FR8: 适配者可以基于 Cursor 版技能的 Canonical Base 创建 Claude 适配版，仅替换执行体映射
- FR9: 适配者可以将 Cursor Task 调度映射到对应的 `.claude/agents/auditor-*` 执行体
- FR10: 适配版技能的提示词模板与 Cursor 版逐字一致（仅执行体调用方式不同）
- FR11: 适配版技能的 `references/` 目录包含与 Cursor 版完全一致的审计提示词模板文件

### speckit-workflow 适配（T3）

- FR12: Claude Code CLI 用户可以触发 speckit-workflow 的 specify 阶段，自动调度 `auditor-spec`
- FR13: Claude Code CLI 用户可以触发 speckit-workflow 的 plan 阶段，自动调度 `auditor-plan`
- FR14: Claude Code CLI 用户可以触发 speckit-workflow 的 gaps/tasks 阶段，自动调度 `auditor-tasks`
- FR15: Claude Code CLI 用户可以触发 speckit-workflow 的 execute 阶段，自动调度 `auditor-implement`

### bmad-code-reviewer-lifecycle 适配（T4）

- FR16: Claude Code CLI 中各 stage 审计（spec/plan/tasks/implement/bugfix/document）可以通过 `.claude/agents/auditor-*` 系列触发
- FR17: 审计产出的报告格式可以被 `parse-and-write-score.ts` 正确解析并写入 scoring 存储

### bmad-bug-assistant 适配（T5）

- FR18: Claude Code CLI 用户可以触发完整的 BUG 修复流程（根因分析 → BUGFIX → 审计 → 实施 → 实施后审计）
- FR19: Party-Mode 100 轮讨论机制在 Claude Code CLI 中正常运行

### bmad-standalone-tasks 适配（T6）

- FR20: Claude Code CLI 用户可以从 TASKS/BUGFIX 文档提取未完成任务并通过子代理执行

### bmad-standalone-tasks-doc-review 适配（T7）

- FR21: Claude Code CLI 用户可以对 TASKS 文档发起严格审计（批判审计员 >70%，3 轮无 gap 收敛）
- FR22: 审计子代理可以在 Claude Code CLI 中直接修改被审计的文档

### bmad-rca-helper 适配（T8）

- FR23: Claude Code CLI 用户可以触发 Party-Mode 深度根因分析，审计子任务通过 `.claude/agents/auditor-document` 执行

### using-git-worktrees 适配（T9）

- FR24: Claude Code CLI 用户可以创建隔离的 git worktree 并在冲突场景中触发审计

### Fallback 与容错

- FR25: 每个 Claude 适配版技能具备 4 层 Fallback 链（auditor-* → OMC reviewer → code-review skill → 主 Agent）
- FR26: Fallback 触发时系统提示用户当前使用的是哪一层执行体
- FR27: 任何 Fallback 层都使用完整的审计提示词模板（不因降级而丢失模板内容）

### 引用回迁

- FR28: 每个适配任务完成后，`.claude/agents/` 中的引用从 `.cursor/skills/X/` 更新为 `.claude/skills/X/`

### 验证与质量守护

- FR29: 每个任务提供可执行的 `bash` 验证脚本，输出 `PASS`/`FAIL`
- FR30: 维护者可以通过 `wc -l` 对比验证 Claude 适配版的模板行数 ≥ Cursor 版 90%
- FR31: 维护者可以在适配完成后执行提示词模板完整性检查清单（8 项）

## Non-Functional Requirements

### 适配一致性

- NFR1: Claude 适配版技能的模板行数不得少于 Cursor 版对应模板的 90%
- NFR2: Claude 适配版的模板 ID 数量必须与 Cursor 版完全一致（数量偏差 = 0）
- NFR3: 适配版中不得出现 Cursor 专用关键词（`Cursor Task`、`.cursor/` 路径），反之亦然

### 集成兼容性

- NFR4: Claude 适配版产出的审计报告必须可被 `parse-and-write-score.ts` 正确解析（与 Cursor 版产出格式一致）
- NFR5: `check-story-score-written.ts` 对 Claude 适配版产出的 scoring 数据验证通过率 = 100%

### 可维护性

- NFR6: 新增一个 Claude 适配版技能（参照已有模式）所需时间 ≤ 4 小时（含检查清单验证）
- NFR7: Cursor 版技能业务语义更新后，Claude 适配版的同步更新所需变更文件数 ≤ 2（SKILL.md + 对应 references）

### 可验证性

- NFR8: 每个任务的验证脚本执行时间 ≤ 30 秒
- NFR9: 全仓库引用完整性验证（`rg` + `grep -v`）单次执行时间 ≤ 10 秒
- NFR10: 验证脚本的输出必须为明确的 `PASS`/`FAIL`，不允许模糊结果

### 向后兼容性

- NFR11: 目录整理完成后，Cursor 用户的现有工作流不受影响（功能零回退）
- NFR12: 现有的 `bmad-story-assistant` Claude 适配版在目录迁移后继续正常工作
