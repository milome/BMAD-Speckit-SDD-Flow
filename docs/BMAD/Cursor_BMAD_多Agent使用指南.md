---
title: Cursor 中 BMAD 多 Agent 使用指南
description: 如何在 Cursor 中充分利用 BMAD 角色 Agent 与 mcp_task 子任务 Agent
date: 2026-02-26
---

# Cursor 中 BMAD 多 Agent 使用指南

本文档说明如何在 Cursor 中充分利用 BMAD 的 20+ Agent，包括角色型 Agent 的加载方式、提示词示例，以及主 Agent 委托子任务的三种典型用法。

---

## 一、两种 Agent 体系概览

### 如何加载 BMAD 角色 Agent

1. 在 Cursor Chat 中输入 `/`，从命令列表中选择 `bmad-agent-xxx`，或直接输入命令名（如 `bmad-agent-bmm-tech-writer`）。
2. Agent 加载后显示欢迎语与菜单，此时在对话中描述任务或选择菜单项。
3. 命令与 Agent 对应关系参见下表。

| Agent 展示名 | 命令名 | 模块 |
|--------------|--------|------|
| BMad Master | `bmad-agent-bmad-master` | core |
| Mary 分析师 | `bmad-agent-bmm-analyst` | bmm |
| John 产品经理 | `bmad-agent-bmm-pm` | bmm |
| Winston 架构师 | `bmad-agent-bmm-architect` | bmm |
| Amelia 开发 | `bmad-agent-bmm-dev` | bmm |
| Bob Scrum Master | `bmad-agent-bmm-sm` | bmm |
| Quinn 测试 | `bmad-agent-bmm-qa` | bmm |
| Paige 技术写作 | `bmad-agent-bmm-tech-writer` | bmm |
| Sally UX | `bmad-agent-bmm-ux-designer` | bmm |
| Barry Quick Flow | `bmad-agent-bmm-quick-flow-solo-dev` | bmm |
| Bond Agent 构建 | `bmad-agent-bmb-agent-builder` | bmb |
| Morgan Module 构建 | `bmad-agent-bmb-module-builder` | bmb |
| Wendy Workflow 构建 | `bmad-agent-bmb-workflow-builder` | bmb |
| Victor 创新策略 | `bmad-agent-cis-innovation-strategist` | cis |
| Dr. Quinn 问题解决 | `bmad-agent-cis-creative-problem-solver` | cis |
| Maya 设计思维 | `bmad-agent-cis-design-thinking-coach` | cis |
| Carson 头脑风暴 | `bmad-agent-cis-brainstorming-coach` | cis |
| Sophia 故事讲述 | `bmad-agent-cis-storyteller` | cis |
| Caravaggio 演示 | `bmad-agent-cis-presentation-master` | cis |
| Murat 测试架构 | `bmad-agent-tea-tea` | tea |
| 批判性审计员 | （仅 party-mode 内使用，无独立命令） | core |
| AI Coach | （不在常规 `/bmad ask` 可见/自动调度列表） | scoring |

**说明**：批判性审计员为 party-mode 专用角色，在决策/根因讨论中担任挑战者，主动质疑假设、发现 gaps。无 `bmad-agent-xxx` 命令，仅通过 `/bmad-party-mode` 参与讨论时由 Facilitator 选中。

**AI Coach 边界**：AI Coach 为 `scoring` 模块受限角色，仅用于读取既有评分数据并输出短板诊断/改进建议。默认不进入常规 `/bmad ask` 列表，也不参与自动调度；仅在显式指定或 `coachDiagnose` 专属链路中调用。

---

### 1.1 BMAD 角色型 Agent（需通过命令加载）

通过 Cursor 命令面板或 Chat 中输入 `/bmad-agent-xxx` 加载对应角色，然后在对话中描述任务。每个 Agent 有专属人设与能力边界。

### 1.2 Cursor mcp_task 子任务 Agent（主 Agent 调度）

主 Agent 通过 `mcp_task` 将子任务分发给不同 `subagent_type`，子 Agent 在独立上下文中执行，结果汇总回主 Agent。

---

## 二、在 Cursor 中的三种使用方式

### 方式 A：让主 Agent 委托子任务

**原理**：直接向主 Agent 说明目标与约束，主 Agent 会自动选择并调度合适的 subagent，执行后汇总结果，主 Agent 不直接修改生产代码。

#### 典型提示词模板

```text
按 BUGFIX 文档 [文档路径] 修复/实施 [具体任务]。
约束：
1. 必须通过 mcp_task 调用 subagent 实施，主 Agent 禁止直接修改生产代码
2. 实施完成后用 code-reviewer 审计至「完全覆盖、验证通过」
3. 遵循 ralph-method：创建 prd/progress，按 US 顺序执行
```

**示例 1：BUGFIX 实施 + 审计闭环**

```text
按 specs/015-indicator-system-refactor/多周期指标多级缓存与回放/BUGFIX_引擎LOWER_HIGHER_TREND硬编码_改为supports_incremental判断_2026-02-26.md 实施修复。

强制约束：
1. 实施阶段必须通过 mcp_task 调用 generalPurpose subagent
2. 审计阶段必须通过 mcp_task 调用 code-reviewer subagent，使用**全局 speckit-workflow 技能**内的 `references/audit-prompts.md` §5（路径如 `{SKILLS_ROOT}/speckit-workflow/references/audit-prompts.md`，SKILLS_ROOT 为 Cursor 技能目录，如 `~/.cursor/skills`）
3. 主 Agent 禁止直接修改 vnpy/datafeed/*.py 等生产代码
4. 遵循 ralph-method、TDD 红绿灯、speckit-workflow
```

**主 Agent 行为**：

- 发起 `generalPurpose` 做实施（传入 BUGFIX 路径、TASKS、约束）
- 实施完成后发起 `code-reviewer` 做审计
- 汇总输出，不直接改代码

**示例 2：测试修复委托**

```text
对 docs/TASKS_4_PREEXISTING_TEST_FAILURES.md 中的 4 个失败用例实施修复。
必须用 mcp_task generalPurpose 执行，完成后 code-reviewer 审计。
主 Agent 仅负责发起任务、传入文档路径、收集输出。
```

---

### 方式 B：BMAD 工作流 + /bmad-help

**原理**：`/bmad-help` 根据当前阶段和已有产出，推荐下一步流程及对应 Agent。

#### 使用步骤

1. 在 Chat 中输入 `/bmad-help` 或从命令面板选择 `bmad-help`。
2. （可选）说明刚完成的流程或当前困惑，例如：「刚完成 Create PRD，下一步做什么？」
3. 主 Agent 会结合 `_bmad/_config/bmad-help.csv` 和项目配置，给出推荐的工作流与 Agent。

#### 配置依赖

- `_bmad/core/config.yaml`：`communication_language`、`output_folder` 等
- `_bmad/_config/bmad-help.csv`：工作流与 Agent 映射
- 各模块的 `config.yaml`：用于解析 `output-location` 与产出路径

#### 提示词示例

```text
/bmad-help
```

或带上下文：

```text
/bmad-help
我刚完成 Create Architecture，Epics and Stories 也写好了。接下来应该做什么？
```

---

### 方式 C：多角色一起讨论（Party Mode）

**原理**：`/bmad-party-mode` 加载 Party Mode 流程，从 `agent-manifest.csv` 读取所有 BMAD 角色，由 Facilitator 选择 2–3 位相关 Agent 参与讨论，模拟多角色协作。

#### 前置配置

**1. agent-manifest.csv**

路径：`_bmad/_config/agent-manifest.csv`。

项目已包含完整 manifest，典型列：

- `name`：Agent 标识
- `displayName`：展示名（如 Mary、Winston）
- `title`：职位
- `icon`：图标
- `capabilities`：能力关键词
- `role`：能力摘要
- `identity`：背景与专长
- `communicationStyle`：沟通风格
- `principles`：决策原则
- `module`：所属模块
- `path`：Agent 文件路径

**2. 核心配置**

| 配置项 | 路径 | 说明 |
|--------|------|------|
| Agent Manifest | `_bmad/_config/agent-manifest.csv` | 所有可参与 Party Mode 的 Agent |
| Party Mode 流程 | `_bmad/core/workflows/party-mode/workflow.md` | 流程定义 |
| 核心配置 | `_bmad/core/config.yaml` | `communication_language` 等 |

#### 使用步骤

1. 输入 `/bmad-party-mode` 或选择对应命令。
2. Facilitator 展示欢迎语并介绍部分 Agent。
3. 提出讨论主题，例如：「多周期图表的指标计算架构，如何平衡性能与可维护性？」
4. Facilitator 根据主题选择 2–3 位 Agent（如 Architect、Dev、Analyst）参与。
5. 多轮对话中，Facilitator 轮流切换 Agent 发言，模拟协作讨论。

#### 提示词示例

```text
/bmad-party-mode
```

进入后：

```text
我想讨论：指标计算引擎的增量路径与全量路径如何统一接口设计。
请让 Winston（架构师）和 Amelia（开发）参与，从架构和实现两个角度分析。
```

---

## 三、BMAD 角色型 Agent 详解与提示词示例

### 3.1 BMM 模块：产品与实施

#### Mary 分析师（`/bmad-agent-bmm-analyst`）

**能力**：市场/领域/技术调研、需求 elicitation、产品简报。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 市场调研 | `/bmad-agent-bmm-analyst` | 「对 [目标行业/产品] 做竞争格局分析，输出竞品对比与差异化机会」 |
| 领域调研 | `/bmad-agent-bmm-analyst` | 「深入分析 HKFE 期货交易时段与 K 线周期规则，整理成领域知识文档」 |
| 技术调研 | `/bmad-agent-bmm-analyst` | 「评估 NumPy 与 Numba 在指标计算场景的性能差异，给出选型建议」 |
| 产品简报 | `/bmad-agent-bmm-analyst` | 「基于 [需求描述] 创建产品简报，聚焦用户价值与核心功能」 |

#### John 产品经理（`/bmad-agent-bmm-pm`）

**能力**：PRD 创建与验证、Epic/Story 拆分、用户访谈引导。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 创建 PRD | `/bmad-agent-bmm-pm` | 「引导我完成 [产品名称] 的 PRD，从用户画像和问题陈述开始」 |
| 验证 PRD | `/bmad-agent-bmm-pm` | 「验证 docs/xxx/PRD.md 是否完整、可执行、无冲突」 |
| 编辑 PRD | `/bmad-agent-bmm-pm` | 「根据 [变更点] 更新 PRD，保持结构一致」 |
| Epic/Story | `/bmad-agent-bmm-pm` | 「基于 PRD 和架构文档，创建 Epics 和 Stories 列表」 |

#### Winston 架构师（`/bmad-agent-bmm-architect`）

**能力**：技术架构、分布式设计、API 设计、实施就绪检查。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 创建架构 | `/bmad-agent-bmm-architect` | 「为多周期指标计算系统设计架构文档，包括 L1/L2/L3 缓存分层与数据流」 |
| 实施就绪 | `/bmad-agent-bmm-architect` | 「检查 PRD、UX、架构、Epics/Stories 是否对齐，输出就绪报告」 |

#### Amelia 开发（`/bmad-agent-bmm-dev`）

**能力**：Story 实现、TDD、代码审查。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 实现 Story | `/bmad-agent-bmm-dev` | 「实现 sprint plan 中下一个 Story [US-xxx]，严格按 AC 和 TDD 执行」 |
| 代码审查 | `/bmad-agent-bmm-dev` | 「对 [文件/模块] 做代码审查，检查架构一致性、测试覆盖、可维护性」 |

#### Bob Scrum Master（`/bmad-agent-bmm-sm`）

**能力**：Sprint 规划、Story 准备、状态汇总、回顾、纠偏。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| Sprint 规划 | `/bmad-agent-bmm-sm` | 「基于 Epics/Stories 生成本迭代的 Sprint Plan」 |
| Sprint 状态 | `/bmad-agent-bmm-sm` | 「汇总当前 Sprint 状态，指出下一个应执行的工作流」 |
| Story 准备 | `/bmad-agent-bmm-sm` | 「准备下一个待实现 Story 的详细任务与验收标准」 |
| 回顾 | `/bmad-agent-bmm-sm` | 「对本 Epic 做回顾，提取教训与改进建议」 |
| 纠偏 | `/bmad-agent-bmm-sm` | 「需求/架构有重大变更，请评估是否需要重新规划或修正 Epics」 |

#### Quinn 测试（`/bmad-agent-bmm-qa`）

**能力**：API/E2E 测试生成、覆盖率分析。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 测试自动化 | `/bmad-agent-bmm-qa` | 「为 [模块/接口] 生成 API 和 E2E 测试，使用项目现有 pytest 框架」 |
| 覆盖率 | `/bmad-agent-bmm-qa` | 「分析 [模块] 的测试覆盖率，指出未覆盖关键路径」 |

#### Paige 技术写作（`/bmad-agent-bmm-tech-writer`）

**能力**：技术文档、Mermaid 图、概念解释、文档校验。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 写文档 | `/bmad-agent-bmm-tech-writer` | 「将 [架构/流程描述] 写成技术文档，遵循 documentation-standards.md」 |
| Mermaid 图 | `/bmad-agent-bmm-tech-writer` | 「根据 [流程描述] 绘制 Mermaid flowchart，展示 L2 缓存命中逻辑」 |
| 概念解释 | `/bmad-agent-bmm-tech-writer` | 「解释 supports_incremental 与 I3 增量路径的关系，附示例」 |
| 文档校验 | `/bmad-agent-bmm-tech-writer` | 「按 documentation-standards 审查 docs/xxx.md，输出改进建议」 |

#### Sally UX 设计师（`/bmad-agent-bmm-ux-designer`）

**能力**：用户研究、交互设计、体验策略。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| UX 设计 | `/bmad-agent-bmm-ux-designer` | 「为多周期图表指标选择界面设计交互流程，考虑专业交易员使用习惯」 |

#### Barry Quick Flow（`/bmad-agent-bmm-quick-flow-solo-dev`）

**能力**：快速规格、精简实现、低仪式开发。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| Quick Spec | `/bmad-agent-bmm-quick-flow-solo-dev` | 「为 [小功能] 写技术规格，无需完整 PRD」 |
| Quick Dev | `/bmad-agent-bmm-quick-flow-solo-dev` | 「实现 [小改动]，如工具函数、配置项，不走完整 Story 流程」 |

---

### 3.2 BMB 模块：Agent/Module/Workflow 构建

#### Bond Agent 构建（`/bmad-agent-bmb-agent-builder`）

**能力**：创建/编辑/验证 BMAD Agent。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 创建 Agent | `/bmad-agent-bmb-agent-builder` | 「创建专用于指标计算的 Agent，人设为性能优化专家」 |
| 编辑 Agent | `/bmad-agent-bmb-agent-builder` | 「更新 analyst Agent 的 principles，增加领域约束」 |
| 验证 Agent | `/bmad-agent-bmb-agent-builder` | 「验证 [Agent 路径] 是否符合 BMAD Core 规范」 |

#### Morgan Module 构建（`/bmad-agent-bmb-module-builder`）

**能力**：创建/编辑/验证 BMAD 模块。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 创建 Module Brief | `/bmad-agent-bmb-module-builder` | 「为指标计算模块创建 product brief」 |
| 创建 Module | `/bmad-agent-bmb-module-builder` | 「基于 brief 创建完整 BMAD 模块，含 Agent、工作流和基础设施」 |

#### Wendy Workflow 构建（`/bmad-agent-bmb-workflow-builder`）

**能力**：创建/编辑/验证 BMAD 工作流。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 创建 Workflow | `/bmad-agent-bmb-workflow-builder` | 「创建 BUGFIX 实施工作流，包含 TASKS 解析、实施、审计闭环」 |
| 验证 Workflow | `/bmad-agent-bmb-workflow-builder` | 「验证 [workflow 路径] 的步骤完整性与产出定义」 |

---

### 3.3 核心模块

#### BMad Master（`/bmad-agent-bmad-master`）

**能力**：BMAD 工作流编排、任务执行、知识管理。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 流程引导 | `/bmad-agent-bmad-master` | 「我想从零开始一个新功能，请引导我按 BMAD 流程推进」 |
| 任务执行 | `/bmad-agent-bmad-master` | 「执行 Create PRD 工作流，引导我完成 PRD 撰写」 |

---

### 3.4 CIS 模块：创新与创意

#### Victor 创新策略（`/bmad-agent-cis-innovation-strategist`）

**能力**：颠覆机会识别、商业模式创新。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 创新策略 | `/bmad-agent-cis-innovation-strategist` | 「分析 [产品/市场]，识别可颠覆的机会与商业模式创新点」 |

#### Dr. Quinn 问题解决（`/bmad-agent-cis-creative-problem-solver`）

**能力**：结构化问题分析、根因挖掘、方案设计。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 问题分析 | `/bmad-agent-cis-creative-problem-solver` | 「对 [复杂问题描述] 做五 Whys 与根因分析，给出可行方案」 |

#### Maya 设计思维（`/bmad-agent-cis-design-thinking-coach`）

**能力**：用户中心设计、同理心地图、原型与验证。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 设计思维 | `/bmad-agent-cis-design-thinking-coach` | 「引导我完成 [功能] 的用户同理心地图与原型验证」 |

#### Carson 头脑风暴（`/bmad-agent-cis-brainstorming-coach`）

**能力**：头脑风暴引导、创意激发。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 头脑风暴 | `/bmad-agent-cis-brainstorming-coach` | 「对 [主题] 做头脑风暴，使用 YES AND 等技术产生创意」 |

#### Sophia 故事讲述（`/bmad-agent-cis-storyteller`）

**能力**：叙事框架、说服性沟通。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 故事创作 | `/bmad-agent-cis-storyteller` | 「为 [产品/功能] 创作用户故事，用于对外沟通或路演」 |

#### Caravaggio 演示设计（`/bmad-agent-cis-presentation-master`）

**能力**：视觉叙事、演示结构、信息层次、Excalidraw 演示。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 演示设计 | `/bmad-agent-cis-presentation-master` | 「为 [主题/产品] 设计演示结构，包含 hook、张力、结论」 |
| 视觉层次 | `/bmad-agent-cis-presentation-master` | 「优化 [现有演示] 的视觉层次与三秒法则」 |

---

### 3.5 TEA 模块：测试架构

#### Murat 测试架构（`/bmad-agent-tea-tea`）

**能力**：风险驱动测试设计、ATDD、CI/CD、可追溯性。

| 场景 | 加载命令 | 提示词示例 |
|------|----------|------------|
| 测试设计 | `/bmad-agent-tea-tea` | 「为指标计算引擎设计风险驱动测试策略，包含单元/集成/E2E 分层」 |
| ATDD | `/bmad-agent-tea-tea` | 「为 [Story] 生成失败用例（TDD 红灯阶段）」 |
| 测试框架 | `/bmad-agent-tea-tea` | 「基于 pytest 搭建生产级测试框架，支持 fixture 与覆盖」 |
| 可追溯性 | `/bmad-agent-tea-tea` | 「建立需求到测试用例的可追溯矩阵与质量门禁」 |

---

## 四、mcp_task 子任务 Agent 类型与用法

主 Agent 通过 `mcp_task` 调度的 subagent 类型及典型用途：

| subagent_type | 用途 | 典型 prompt 要点 |
|---------------|------|------------------|
| **generalPurpose** | 多步骤实施、调研、代码修改 | 传入文档路径、TASKS、约束（ralph-method、TDD、禁止伪实现） |
| **explore** | 快速探索代码库 | 指定目标目录、搜索意图、 thoroughness 级别 |
| **code-reviewer** | 严格代码/文档审计 | 传入 audit-prompts §N、文档路径、验证命令 |
| **shell** | Git、终端等命令执行 | 明确命令序列与预期结果 |
| **feature-architect** | 新功能设计 | 需求描述、边界、可选方案 |
| **documentation-writer** | 技术文档编写 | 主题、受众、结构要求 |
| **unit-test-writer** | 单元测试编写 | 目标模块、覆盖场景、框架 |

---

## 五、实践建议

### 5.1 串行分工

1. 用 `generalPurpose` 做实施或调研。
2. 用 `code-reviewer` 做审计，形成闭环。
3. 主 Agent 汇总结果，不直接改生产代码。

### 5.2 并行分工

当存在多个独立任务时，可同时发起多个 mcp_task（建议不超过 4 个），例如同时进行代码审查与文档撰写。

### 5.3 BMAD + mcp_task 组合

- 用 BMAD Agent 做需求、架构、Story 设计。
- 用 mcp_task 的 `generalPurpose` / `code-reviewer` 做实现与审查，保证职责清晰。

### 5.4 Prompt 中明确上下文

每个 subagent 在独立上下文中运行，prompt 应包含：

- 文档路径（BUGFIX、TASKS、PRD 等）
- 验收标准与验收命令
- 流程约束（ralph-method、TDD、speckit-workflow 等）

### 5.5 子任务不完整时

使用 `resume` 参数再次发起同一任务，由 subagent 继续完成，而不是由主 Agent 直接改代码。

---

## 六、快速对照表

| 需求 | 推荐方式 |
|------|----------|
| 调研/分析 | `/bmad-agent-bmm-analyst` 或 mcp_task `generalPurpose` |
| 写 PRD/Story | `/bmad-agent-bmm-pm` |
| 架构设计 | `/bmad-agent-bmm-architect` 或 mcp_task `feature-architect` |
| 实现代码 | 主 Agent 发起 mcp_task `generalPurpose` |
| 代码/文档审计 | 主 Agent 发起 mcp_task `code-reviewer` |
| 探索代码库 | 主 Agent 发起 mcp_task `explore` |
| 多角色讨论 | `/bmad-party-mode` |
| AI Coach 评分诊断 | `npm run coach:diagnose -- --run-id=<id> --format=json|markdown`（或显式指定 `ai-coach`） |
| 下一步做什么 | `/bmad-help` |
| 技术文档/Mermaid | `/bmad-agent-bmm-tech-writer` |

---

## 七、相关文件

| 文件 | 说明 |
|------|------|
| [bmad-help.csv](../../_bmad/_config/bmad-help.csv) | 工作流与 Agent 映射 |
| [agent-manifest.csv](../../_bmad/_config/agent-manifest.csv) | Party Mode Agent 清单 |
| [config.yaml](../../_bmad/core/config.yaml) | 核心配置 |
| [documentation-standards.md](../../_bmad/_memory/tech-writer-sidecar/documentation-standards.md) | 文档规范 |
| speckit-workflow 技能内 references/audit-prompts.md（全局技能，路径如 {SKILLS_ROOT}/speckit-workflow/references/audit-prompts.md） | 审计提示词模板 |
