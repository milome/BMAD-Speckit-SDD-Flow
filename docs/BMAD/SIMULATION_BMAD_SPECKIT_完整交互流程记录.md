# BMAD + Speckit 整合流程：模拟开发完整交互记录

## 文档信息

| 项目 | 详情 |
|------|------|
| **版本** | 1.0 |
| **日期** | 2026-03-03 |
| **用途** | 模拟 BMAD 与 speckit-workflow 整合后的完整开发流程，记录所有交互过程 |
| **参考** | bmad-speckit-integration-FINAL-COMPLETE.md、speckit-workflow SKILL.md |

---

## ⚠️ 重要说明：模拟 vs 实际

| 项目 | 说明 |
|------|------|
| **产出路径** | 本文档中的产出路径为**执行 BMAD 流程后的预期路径**，与项目实际约定一致 |
| **`_bmad-output/product-artifacts`** | **不存在**。项目实际使用 `_bmad-output/planning-artifacts/` 存放 PRD、epics、architecture 等 |
| **`prd-backtest-export-csv.md`** | **不存在**。这是模拟文档中假设的产出，需通过执行 `/bmad-bmm-create-prd` 等命令实际生成 |
| **当前 `_bmad-output` 子目录** | `planning-artifacts`、`implementation-artifacts`、`bmad-customization-backups`、`bmb-creations`、`speckit-scripts-backups`、`test-artifacts` |
| **Worktree 路径** | worktree 与项目根**平级**（`{父目录}/{repo名}-{branch}`），由 setup_worktree.ps1 实现 |

本文档为**流程模拟**，记录各阶段命令、预期产出与审计检查点；实际文件需按文档中的命令顺序执行后才会生成。

---

## 1. 模拟需求定义

为便于演示，选用一个**小范围、可验证**的需求作为模拟对象：

| 项目 | 内容 |
|------|------|
| **需求名称** | 回测结果导出为 CSV |
| **一句话描述** | 用户完成 CTA 回测后，可将回测结果（交易记录、资金曲线等）导出为 CSV 文件，便于外部分析 |
| **复杂度预估** | 业务 2 分、技术 2 分、影响 2 分 → 总分 6 分（≤6 分，可简化流程） |

---

## 2. 完整交互流程记录

以下按 **五层架构** 顺序记录每一步的：触发命令、Agent 行为、产出、审计检查点、手递手（handoff）。

---

### Layer 1：产品定义层

#### 1.1 Product Brief（可选，本模拟跳过）

**触发**：用户提供或已有 Product Brief 文档

**产出**：`_bmad-output/planning-artifacts/{branch}/product-brief-xxx.md`（或项目约定的 Brief 路径）

**本模拟**：总分 ≤6 分，直接进入 PRD 生成，跳过 Party-Mode。

---

#### 1.2 复杂度评估

**触发**：执行 Layer 1 时自动执行

**交互记录**：

```
[系统] 执行复杂度评估问卷
业务复杂度: 2分（领域熟悉、利益相关方少、无严格合规）
技术复杂度: 2分（现有技术栈、无架构挑战、独立功能）
影响范围: 2分（单个模块）
总分: 6分

[决策] 总分 ≤6 分 → PRD 直接生成，不触发 Party-Mode
```

---

#### 1.3 PRD 生成

**触发**：`/bmad-bmm-create-prd` 或 create-prd 等价命令

**Agent 行为**：
- 基于 Product Brief 或需求描述生成 PRD
- 本模拟：直接基于「回测结果导出 CSV」生成 PRD

**产出**：`_bmad-output/planning-artifacts/{branch}/prd.md` 或 `prd.{ref}.json`（本模拟示例：`prd-backtest-export-csv.md`，执行后才会生成）

**审计**：code-review（prd 模式），使用 PRD 专用审计提示词

**交互记录**：

```
[用户] 创建 PRD：回测结果导出为 CSV。

[Agent] 生成 PRD 文档，包含：
- 用户需求
- 功能范围（导出交易记录、资金曲线）
- 验收标准
- 非功能需求（性能、格式）

[审计] code-review 审计 PRD
结论: A级，完全覆盖
```

---

#### 1.4 Architecture（可选）

**触发**：`/bmad-bmm-create-architecture`（当需求涉及架构时）

**本模拟**：总分 ≤6 分，技术简单，可跳过 Architecture 或生成轻量架构说明。

---

### Layer 2：Epic/Story 规划层

#### 2.1 create-epics-and-stories

**触发**：`/bmad-bmm-create-epics-and-stories`

**Agent 行为**：
- 基于 PRD 拆解 Epic 和 Story
- 产出 Epic 列表、Story 列表、依赖图

**产出**：
- `_bmad-output/planning-artifacts/{branch}/epics.md`（Epic/Story 列表）

**交互记录**：

```
[用户] 执行 create-epics-and-stories

[Agent] 分析 PRD，产出：
Epic 1: 回测模块增强
  - Story 1.1: 实现回测结果导出 CSV 功能

[产出] `_bmad-output/planning-artifacts/{branch}/epics.md`、依赖图（本需求无跨 Story 依赖）
```

---

### Layer 3：Story 开发层

#### 3.1 Create Story（细化）

**触发**：`/bmad-bmm-create-story epic=1 story=1`

**Agent 行为**：
- 基于 PRD 和 Epic 细化 Story 文档
- 涉及方案选择时：进入 Party-Mode（本模拟总分低，可简化或标准流程）

**产出**：`_bmad-output/implementation-artifacts/1-1-backtest-export-csv/` 下 Story 文档（执行 Create Story 后才会生成）

**Worktree/Branch**：本阶段**不创建** worktree 或 branch；若需创建，在后续「spec 目录创建」或「Dev Story 实施」时通过参数或自动策略决定（见上文「Worktree / Branch 创建与切换时机」）。

**审计**：Story 文档审计（禁止词检查、范围清晰）

**交互记录**：

```
[用户] 创建 Story 1.1：回测结果导出 CSV

[Agent] 生成 Story 文档，包含：
- Scope：用户故事、验收标准
- 技术约束：PRD 约束、Architecture 约束（若有）
- 依赖：无

[审计] Story 文档审计
结论: 通过，无禁止词
```

---

### Worktree / Branch 创建与切换时机

| 时机 | 询问/决策点 | 切换动作 |
|------|-------------|----------|
| **Create Story 之后、spec 目录创建时** | 用户可通过 `create-new-feature.ps1 -CreateBranch`、`-CreateWorktree` 选择是否创建 branch/worktree | - |
| **BMAD 默认（Solo 快速迭代）** | 不询问；`-CreateBranch` 否、`-CreateWorktree` 否 | 不切换，Dev Story 在当前目录、当前分支执行 |
| **Dev Story 实施开始时** | 若 Epic Story 数≥3，自动采用 Epic 级 worktree；若用户此前传 `-CreateWorktree`，则创建并切换 | 创建 worktree 后：`cd {父目录}/{repo名}-{branch}`（见下方路径约定）；创建 Story 分支后：`git checkout story-{N}-{M}` |
| **Epic 级 worktree 内切换 Story** | 完成 Story 4.1、开始 Story 4.2 时 | 在同一 worktree 内：`git checkout story-4-2`（需先 commit/stash 未提交变更） |

**standalone speckit.specify**：会创建 branch（`git checkout -b {index}-{name}`），**不创建** worktree；worktree 需手动创建。

**BMAD 模式 create-new-feature.ps1**：默认**不创建** branch、**不创建** worktree；仅创建 spec 目录。若需完整隔离，用户显式传 `-CreateBranch -CreateWorktree`。

---

### Worktree 路径约定（与项目根平级）

worktree 与项目根**平级**：`{父目录}/{repo名}-{branch}`。例：主 repo `D:\Dev\my-project`，worktree `D:\Dev\my-project-story-4-1`。由 `setup_worktree.ps1` 实现，`$WorktreeBaseDir = Split-Path -Parent $RepoDir`，worktree = `$WorktreeBaseDir/$RepoName-$Branch`。切换时：`cd {父目录}/{repo名}-{branch}`。

---

### Layer 4：技术实现层（嵌套 speckit-workflow）

Layer 4 由 BMAD 的 Dev Story 阶段触发，嵌套执行 speckit 完整流程。

#### 4.0 Constitution（可选，前置）

**触发**：`/speckit.constitution` 或 `.speckit.constitution`

**执行时机**：在 specify 之前

**产出**：`.specify/memory/constitution.md`（**相对路径**，取决于执行目录）

| 执行目录 | 产出路径 |
|----------|----------|
| 项目根 | `{project}/.specify/memory/constitution.md` |
| spec 目录（如 specs/015-indicator-system-refactor/） | `specs/015-indicator-system-refactor/.specify/memory/constitution.md` |

**项目内实际存在**：`.specify/memory/constitution.md`（根目录）、`specs/000-Overview/.specify/memory/constitution.md`（全局参考）、各 spec 下的 `.specify/memory/constitution.md` 或 `.speckit.specify/memory/constitution.md`。speckit.constitution 命令写入的是**当前工作目录下的** `.specify/memory/constitution.md`。

**本模拟**：若项目已有 constitution，可跳过。

---

#### 4.1 speckit.specify

**触发**：`/speckit.specify` 或 `.speckit.specify`

**等价命令**：在 `specs/epic-1/story-1-backtest-export-csv/` 或项目根执行

**Agent 行为**：
1. 解析需求描述
2. 提取关键概念（用户、动作、数据、约束）
3. 调用 `create-new-feature.ps1` 创建 spec 目录（**standalone 模式会创建 branch**；**BMAD 模式不创建 branch/worktree**）
4. 生成 spec.md，包含功能需求、验收场景、成功标准
5. 创建 `checklists/requirements.md`
6. 质量校验

**产出**：
- `specs/epic-1/story-1-backtest-export-csv/spec-E1-S1.md`
- `specs/epic-1/story-1-backtest-export-csv/checklists/requirements.md`

**Worktree/Branch**：standalone 的 speckit.specify 会创建 branch；**不创建** worktree。BMAD 模式下 create-new-feature.ps1 -ModeBmad 默认不创建 branch/worktree；用户可传 `-CreateBranch -CreateWorktree` 选择完整隔离。**不询问**用户，由调用参数决定。

**需求映射**：spec.md 中必须包含与原始需求文档的**需求映射清单表格**

**审计**：code-review，使用 `audit-prompts.md §1`

**交互记录**：

```
[用户] /speckit.specify 回测结果导出为 CSV，支持交易记录和资金曲线

[Agent]
1. 生成 short-name: backtest-export-csv
2. 调用 create-new-feature.ps1：创建 spec 目录（BMAD 模式不创建 branch/worktree）
3. 填充 spec 模板：User Scenarios、Functional Requirements、Success Criteria
4. 生成 requirements 质量检查清单
5. 写入 spec-E1-S1.md

[审计] 调用 code-review（§1）
- 检查：spec 是否覆盖 PRD/Story 所有章节
- 结论: A级，完全覆盖

[Handoff] 可进入 /speckit.plan
```

---

#### 4.2 speckit.plan

**触发**：`/speckit.plan`

**前置**：spec.md 已通过 §1.2 审计

**Agent 行为**：
1. 运行 `setup-plan.ps1` 获取 FEATURE_SPEC、IMPL_PLAN 路径
2. 加载 spec、constitution
3. 执行 plan 工作流：Technical Context、Phase 0 Research、Phase 1 Design
4. 生成 research.md、data-model.md、contracts/

**产出**：
- `specs/epic-1/story-1-backtest-export-csv/plan-E1-S1.md`
- `research.md`、`data-model.md`、`contracts/`（若适用）

**需求映射**：plan.md 中必须包含需求映射清单

**审计**：code-review，使用 `audit-prompts.md §2`

**嵌入步骤**：若 plan 涉及多模块，执行 `/speckit.checklist`

**交互记录**：

```
[用户] /speckit.plan

[Agent]
1. 解析 Technical Context
2. Phase 0: research.md（CSV 格式、编码、大文件处理）
3. Phase 1: data-model.md（导出数据结构）、contracts（若为 API）
4. 写入 plan-E1-S1.md

[审计] 调用 code-review（§2）
- 检查：plan 是否覆盖 spec、集成测试计划是否完整
- 结论: B级，minor 修改后通过

[Handoff] 可进入 GAPS 生成
```

---

#### 4.3 IMPLEMENTATION_GAPS 生成

**触发**：无独立命令；plan 通过后**模型自动深度分析**，或用户要求「生成 IMPLEMENTATION_GAPS」

**Agent 行为**：
- 对照 plan.md、需求文档、当前实现
- 逐章节分析差异，生成 GAP 列表

**产出**：`IMPLEMENTATION_GAPS-E1-S1.md`

**审计**：code-review，使用 `audit-prompts.md §3`

**交互记录**：

```
[Agent] 自动执行（plan 审计通过后）
- 对照 plan、PRD、当前 vnpy_ctastrategy 回测模块实现
- 识别 GAP：缺少导出入口、缺少 CSV 格式化、缺少文件写入

[产出] IMPLEMENTATION_GAPS-E1-S1.md

[审计] 调用 code-review（§3）
结论: A级，完全覆盖
```

---

#### 4.4 speckit.tasks

**触发**：`/speckit.tasks` 或 用户要求「生成 tasks」

**前置**：IMPLEMENTATION_GAPS 已通过审计

**Agent 行为**：
1. 对照 plan、GAPS、需求生成 tasks.md
2. 使用项目 tasks 模板
3. 添加需求映射清单、验收标准

**产出**：`tasks-E1-S1.md`

**审计**：code-review，使用 `audit-prompts.md §4`

**嵌入步骤**：若 tasks≥10 或跨多 artifact，执行 `/speckit.analyze`

**交互记录**：

```
[用户] /speckit.tasks

[Agent]
1. 加载 tasks 模板
2. 将 GAP 转为可执行任务
3. 每任务：描述、验收标准、需求追溯
4. 写入 tasks-E1-S1.md

[审计] 调用 code-review（§4）
- 检查：tasks 是否覆盖 GAPS、集成测试任务是否存在
- 结论: A级，完全覆盖

[Handoff] 可进入 /speckit.implement
```

---

#### 4.5 speckit.implement（TDD 执行）

**触发**：`/speckit.implement` 或 用户要求「执行 tasks」「完成 tasks 中的任务」

**前置**：tasks.md 已通过审计

**Agent 行为**（TDD 红绿灯模式）：
1. 读取 tasks.md，识别未完成任务 `[ ]`
2. 使用 TodoWrite 追踪
3. 逐任务：红灯（写测试、确认失败）→ 绿灯（最少代码通过）→ 重构
4. 更新 tasks 复选框、ralph-method 进度

**产出**：可运行代码、测试、TDD 记录

**审计**：code-review，使用 `audit-prompts.md §5`

**交互记录**：

```
[用户] /speckit.implement

[Agent]
Task 1: 实现 CSV 导出接口
  [TDD-RED] pytest tests/test_backtest_export.py -v => 1 failed
  [TDD-GREEN] 实现 export_to_csv() => 1 passed
  [TDD-REFACTOR] 提取格式化逻辑
  更新 prd.md: US-001 passes=true

Task 2: 集成到回测 UI
  [TDD-RED] ...
  [TDD-GREEN] ...
  [TDD-REFACTOR] ...

[完成] 所有任务 [x]，更新 progress.md

[审计] 调用 code-review（§5）
- 检查：任务是否真正实现、生产代码是否在关键路径
- 结论: 完全覆盖、验证通过
```

---

### Layer 5：收尾层

#### 5.1 实施后审计（第二遍）

**触发**：Dev Story 完成后自动执行

**前置检查**：speckit 各阶段 code-review 已通过

**审计**：综合 audit-prompts §5，验证全部产出

**交互记录**：

```
[Agent] 实施后审计
- 前置：§1–§5 审计均已通过 ✓
- 综合验证：需求→spec→plan→tasks→代码 追溯链完整
- 结论: 通过
```

---

#### 5.2 完成选项

**交互记录**：

```
[系统] Story 1.1 已完成。如何继续？
[1] 开始 Story 1.2（若在同一 Epic）
[2] 创建 PR 并等待 review
[3] 批量 Push 所有 Story 分支
[4] 保留分支稍后处理

[用户] 选择 [2]

[系统] 调用 pr-template-generator 分析 commits
      PR #xxx 已创建
      ⚠️ 强制人工审核：不能自动 merge，请等待审核
```

---

## 3. 命令索引与检查点汇总

| 阶段 | 命令 | 产出 | 审计依据 | 通过标准 |
|------|------|------|----------|----------|
| L1 PRD | `/bmad-bmm-create-prd` | prd-xxx.md | code-review (prd) | 完全覆盖 |
| L1 Arch | `/bmad-bmm-create-architecture` | arch-xxx.md | code-review (arch) | 完全覆盖 |
| L2 规划 | `/bmad-bmm-create-epics-and-stories` | Epic/Story 列表 | - | - |
| L3 Story | `/bmad-bmm-create-story` | Story 文档 | 禁止词、范围 | 通过 |
| L4 constitution | `/speckit.constitution` | `{cwd}/.specify/memory/constitution.md` | 可选 | - |
| L4 specify | `/speckit.specify` | spec-E{epic}-S{story}.md | audit-prompts §1 | A/B 级 |
| L4 plan | `/speckit.plan` | plan-E{epic}-S{story}.md | audit-prompts §2 | A/B 级 |
| L4 GAPS | 自动 / 用户要求 | IMPLEMENTATION_GAPS-xxx.md | audit-prompts §3 | A/B 级 |
| L4 tasks | `/speckit.tasks` | tasks-E{epic}-S{story}.md | audit-prompts §4 | A/B 级 |
| L4 implement | `/speckit.implement` | 代码 + 测试 | audit-prompts §5 | 完全覆盖 |
| L5 实施后 | 自动 | - | audit-prompts §5 综合 | 通过 |

---

## 4. 增强命令嵌入规则

| 命令 | 嵌入环节 | 触发条件 |
|------|----------|----------|
| `/speckit.clarify` | §1.2 spec 审计闭环内 | 审计报告指出「spec 存在模糊表述」 |
| `/speckit.checklist` | §2.2 plan 审计闭环内 | plan 涉及多模块或复杂架构 |
| `/speckit.analyze` | §4.2 tasks 审计闭环内 | tasks≥10 或跨多 artifact |

---

## 5. 模拟执行检查清单

使用本文档进行模拟时，可逐项勾选：

- [ ] Layer 1：复杂度评估完成，PRD 产出并审计通过
- [ ] Layer 2：Epic/Story 列表产出
- [ ] Layer 3：Story 文档产出并审计通过
- [ ] Layer 4.0：constitution 已存在或已产出
- [ ] Layer 4.1：specify → spec-E1-S1.md → §1 审计通过
- [ ] Layer 4.2：plan → plan-E1-S1.md → §2 审计通过
- [ ] Layer 4.3：GAPS → IMPLEMENTATION_GAPS-E1-S1.md → §3 审计通过
- [ ] Layer 4.4：tasks → tasks-E1-S1.md → §4 审计通过
- [ ] Layer 4.5：implement → TDD 红绿灯 → §5 审计通过
- [ ] Layer 5：实施后审计通过，PR 创建（人工审核）

---

## 6. 附录：Code-Review 调用约定

**优先策略**：
1. 检查 `.cursor/agents/code-reviewer.md` 或 `.claude/agents/code-reviewer.md`
2. 使用 Cursor Task 调度 code-reviewer
3. 使用 audit-prompts.md 对应章节

**回退策略**：
1. 使用 `mcp_task` + `subagent_type: generalPurpose`
2. 将 audit-prompts.md 对应章节作为 prompt 传入

**禁止**：未调用 code-review 即自行宣布通过。

---

## 7. 实际操作示例（可直接复制执行）

以下为模拟时可直接使用的命令序列，按顺序执行即可走通完整流程。

### 7.1 快速模拟（仅 speckit 层，假设 PRD/Story 已存在）

若已有 Story 文档，可仅执行 Layer 4：

```bash
# 1. 进入 spec 目录
cd specs/epic-1/story-1-backtest-export-csv

# 2. 执行 speckit 流程
# 在 Cursor 中输入：
/speckit.specify 回测结果导出为 CSV，支持交易记录和资金曲线

# 审计通过后：
/speckit.plan

# GAPS 自动生成后：
/speckit.tasks

# tasks 审计通过后：
/speckit.implement
```

### 7.2 完整 BMAD 流程（从零开始）

```bash
# Layer 1
/bmad-bmm-create-prd  # 或通过 create-product-brief 先产出 Brief

# Layer 2
/bmad-bmm-create-epics-and-stories

# Layer 3
/bmad-bmm-create-story epic=1 story=1

# Layer 4（在 Story 审计通过后）
/bmad-bmm-dev-story epic=1 story=1
# ↑ 内部会嵌套执行 speckit.specify → plan → GAPS → tasks → implement
```

### 7.3 审计触发示例

当某阶段审计未通过时，迭代流程：

```
[审计] spec.md 审计结果：B级，需补充 REQ-003 需求映射

[用户] 选择：立即修改 spec.md

[Agent] 补充 REQ-003 映射 → 重新提交 code-review → 通过
```

---

*本文档用于记录 BMAD + speckit-workflow 整合流程的完整交互过程，可作为新需求开发的参考 playbook。*
