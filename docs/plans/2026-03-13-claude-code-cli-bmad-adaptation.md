# Claude Code CLI 适配 BMAD-Speckit 五层架构：需求分析与解决方案

## 读者 30 秒上手摘要

- **这份文档解决什么问题**：解决 Claude Code CLI 下子 Agent 不继承 skill 约束，导致审计闭环丢失、TDD 失效、评分漏写与未经审计 commit 的问题。
- **核心方案是什么**：用 `bmad-master` 做强门控，用执行 Agent 负责产出，用 auditor 模板负责审计，用 hooks + worker 做恢复、追溯和运行时增强。
- **最小落地范围是什么**：先跑通 Layer 4（`specify` / `plan` / `tasks`）+ commit 门控 + minimal hooks。
- **实现时最重要的边界**：`bmad-progress.yaml` 是唯一业务真相；hooks 只能做观测、checkpoint 和恢复，不能替代 master 做阶段放行或 commit 放行。
- **如果只看一个行动建议**：先立住控制骨架，再用一个真实 Story 跑通最小闭环，最后再扩展到 standalone tasks、bugfix 和其他 Layers。

## 建议阅读顺序

- **架构师 / 方案负责人**：先读第 1、4、6、7、8、9 部分，再看附录 A / B。
- **实现者 / Agent 编写者**：先读第 6、8、9 部分，再重点看 6.10 hooks 规格、附录 A / B。
- **Reviewer / 审计负责人**：先读第 3、4、5、7、9 部分，再重点看 auditor 相关段落与验收闭环。
- **时间有限的读者**：先读本摘要 + 第 8、9 部分；如需落地，再补读第 6 部分。

## 第一部分：执行摘要

### 文档概览

本文档针对 BMAD-Speckit-SDD-Flow 在 Claude Code CLI 环境下的适配问题，提出完整的五层架构迁移方案。

核心问题：Claude Code 的 Agent 工具直接启动子代理，绕过了 Cursor 原有的 MCP task 系统的约束传递机制，导致：
- speckit-workflow 的强制审计闭环丢失
- TDD 红绿灯模式约束失效
- 需求映射表格和评分写入流程被跳过
- 代码完成后可能未经审计自行 commit

解决方案：采用“三层防护机制”（Agent 约束嵌入 + Master 协调器 + 标准化审计 Agent），确保五层架构（Product → Epic/Story → Story → Speckit → Implement）的完整性和审计闭环在 Claude Code 环境下依然严格执行。

关键成果：定义一组专用 Agent，覆盖从 PRD 生成到代码实施的全流程，每个 Agent 内置对应 skill 的约束加载、审计调用协议和状态回传规范。

范围：本文档涵盖 Layer 1-5 的主流程适配，并补充覆盖 `bmad-standalone-tasks`、`bmad-bug-assistant`、`bmad-code-reviewer-lifecycle`、`bmad-standalone-tasks-doc-review` 等关键扩展技能。

目标读者：使用 Claude Code CLI 的 BMAD-Speckit 开发团队，以及需要维护流程约束和审计闭环的框架作者。

---

## 第二部分：当前状态分析（As-Is）

### 2.1 现有架构概览

BMAD-Speckit-SDD-Flow 当前基于 Cursor Agent 构建，采用五层架构：

- **Layer 1**：Product Brief → 复杂度评估 → PRD → Architecture
  对应入口：`.cursor/commands/bmad-bmm-create-prd.md`

- **Layer 2**：Epic/Story 规划
  对应入口：`.cursor/commands/bmad-bmm-create-epics-and-stories.md`

- **Layer 3**：Create Story → Party-Mode → Story 文档
  对应入口：`.cursor/commands/bmad-bmm-create-story.md`

- **Layer 4**：speckit-workflow（specify → plan → GAPS → tasks → TDD）
  对应入口：`.cursor/commands/speckit.*.md`

- **Layer 5**：Dev Story → PR → 人工审核 → 发布
  对应入口：`.cursor/commands/bmad-bmm-dev-story.md`

### 2.2 Cursor 的约束传递机制

Cursor 通过以下方式确保 skill 约束被执行：

1. **命令文件内嵌**：`.cursor/commands/*.md` 文件直接包含完整的执行流程
2. **Workflow XML 引擎**：`_bmad/core/tasks/workflow.xml` 解析并执行 workflow.yaml
3. **MCP Task 调度**：通过任务系统调用子代理，可以传递 skill 上下文
4. **Code-Reviewer 调度**：专用审计 Agent 可被任务系统显式调用

关键优势在于：Cursor 的 command 文件可以承载数百行详细指令，直接指导 AI 执行审计闭环、评分写入和阶段门控。

### 2.3 Claude Code 的架构差异

Claude Code 使用不同的扩展模型：

| 维度 | Cursor | Claude Code |
|------|--------|-------------|
| 配置位置 | `.cursor/commands/`, `.cursor/agents/` | `.claude/agents/`, `.claude/skills/` |
| 命令触发 | `/command-name` | `/skill-name` 或 Agent tool |
| 子代理调用 | MCP Task | Agent tool |
| 上下文传递 | Task 参数传递 | Agent prompt 传递 |
| Skill 绑定 | 自动绑定（同目录） | 需显式读取 |

核心差异点如下：

1. **Agent Tool 不继承 Skill**：当主 Agent 使用 Agent tool 启动子代理时，子代理默认是“裸启动”的，不会自动继承主 Agent 已加载的 skill
2. **Prompt 长度受限**：Claude Code Agent 的 prompt 不宜过长，而 Cursor command 可以直接承载完整流程文档
3. **技能显式加载**：子 Agent 必须在自己的执行步骤中显式读取 skill 文件和审计提示词

---

## 第三部分：问题深度分析（Gap Analysis）

### 3.1 问题现象矩阵

| 使用场景 | 预期行为（Cursor） | 实际行为（Claude Code） | 严重程度 |
|----------|--------------------|--------------------------|----------|
| 调用 `/speckit.specify` | 生成 spec.md → 自动审计 → 迭代直至通过 | 生成 spec.md → 无审计 → 直接宣布完成 | P0 - 阻断 |
| 调用 code-reviewer | 加载 skill 约束 → 按 audit-prompts 审计 | 裸审计 → 标准不一 → 可能遗漏检查项 | P0 - 阻断 |
| 执行 tasks | TDD 红绿灯 → 每任务 RED→GREEN→REFACTOR | 直接实现 → 跳过测试 → 伪实现风险 | P0 - 阻断 |
| Party-Mode 讨论 | 充分辩论 → 达成共识 → 生成 Story | 无约束讨论 → 快速收敛 → 方案未经充分论证 | P1 - 高风险 |
| 评分写入 | 审计通过后自动写入评分 | 审计通过但无评分 → 数据丢失 | P1 - 高风险 |
| 代码实施完成 | 实施后审计 → 通过后请求提交 | 完成后直接 commit | P0 - 阻断 |

### 3.2 根本原因分析（5 Whys）

问题：为什么子 Agent 不执行审计闭环？

1. 子 Agent 没有加载对应 skill
2. Agent tool 不会自动传递父 Agent 的 skill 上下文
3. Claude Code 的 skill 绑定机制与 Cursor 不同
4. Cursor 的任务调度可传递技能语义，Agent tool 仅传递 prompt
5. 两者底层模型不同：Cursor 更接近“任务调度”，Claude Code 更接近“Agent 协作”

根因总结：Claude Code 的 Agent tool 本质上是一个干净的上下文切换，子 Agent 不会自动继承任何父 Agent 的状态、技能或流程约束。

### 3.3 技术约束映射

| 约束来源 | Cursor 实现方式 | Claude Code 适配挑战 |
|----------|-----------------|----------------------|
| `speckit-workflow/SKILL.md` | Command 文件内嵌完整内容 | Agent prompt 不宜内嵌全文 |
| `audit-prompts.md` | Task 参数传递 | Agent 需显式 Read |
| `code-reviewer` | 任务系统调度 | Agent 调用 Agent，需显式传递审计协议 |
| `workflow.xml` | MCP task 执行 workflow | 无等效机制，需重构为 Agent 链 |
| scoring 触发 | 任务回调 | Agent 完成后需显式调用脚本 |
| Git 提交约束 | 流程阶段控制 | 必须新增 Master 门控机制 |

### 3.4 风险影响评估

高风险场景包括：

1. **审计逃逸**：子 Agent 自行宣布“通过”而不经过正式审计，导致质量门控失效
2. **TDD bypass**：直接写生产代码后补测试，违反 RED→GREEN→REFACTOR 顺序
3. **伪实现累积**：标记完成但未真实验证的模块进入代码库
4. **评分数据缺失**：审计通过但未写入评分，SFT 数据链路不完整
5. **流程碎片化**：各 Layer 之间无连贯状态追踪，用户需手动协调
6. **未经审计自动 commit**：代码完成后直接进入仓库，破坏实施后审计的核心要求

业务影响：
- 代码质量下降
- 需求追溯丢失
- 流程不可复现
- 团队规范不统一
- Bug 责任追踪困难

### 3.5 补充：未经审计的自动 Commit 问题

现象：
- 子 Agent 完成代码编写后，可能直接执行 `git add && git commit`
- 完全跳过 speckit-workflow §5.2 规定的实施后审计闭环
- 导致未经审计的代码直接进入代码库

根因：
- Claude Code 的某些运行模式允许 Agent 自主执行 git 操作
- 子 Agent 没有加载“实施后必须审计”的约束
- 缺乏 Master 级别的门控机制阻止不合规提交

影响：
- 质量风险：未经验证的代码进入仓库
- 追溯困难：事后难以定位跳过了哪个流程环节
- 规范破坏：破坏 BMAD“强制审计闭环”的核心原则

---

## 第四部分：解决方案设计（To-Be）

### 4.1 总体架构：三层防护机制

本方案采用三层防护机制：

1. **防护层 1：Agent 约束嵌入（强制执行层）**
   每个 Agent 的 prompt 中嵌入该 Layer 的执行规则、显式技能加载步骤以及禁止自行 commit 的硬性规则。

2. **防护层 2：Master 协调器（流程控制层）**
   按 Layer 顺序调度子 Agent，检查审计结果、管理共享状态，并作为唯一提交放行者。

3. **防护层 3：标准化审计 Agent（质量保证层）**
   为每类文档和实施阶段建立专用 auditor，统一审计标准、输出格式和评分写入协议。

### 4.2 防护层 1：Agent 约束嵌入

设计原则：每个执行 Agent 的 prompt 必须包含以下强制块：

- 启动时必须读取对应 skill 文件和审计提示词文件
- 提取相关章节作为本轮执行的不可违反规则
- 显式列出必须完成的步骤
- 显式列出禁止行为
- 定义统一的输出与回传格式

示意模板如下：

```markdown
---
name: bmad-layer4-speckit-specify
description: Layer 4 speckit specify phase with mandatory audit loops
model: sonnet
---

## 启动强制步骤
1. 读取 `skills/speckit-workflow/SKILL.md`
2. 提取 §1 的全部约束
3. 读取 `skills/speckit-workflow/references/audit-prompts.md`
4. 读取 `.claude/state/bmad-progress.yaml`

## 绝对禁止事项
- 禁止自行 commit
- 禁止跳过审计
- 禁止自审通过
- 禁止裸审计

## 强制执行步骤
1. 生成 spec.md
2. 添加需求映射表格
3. 触发 spec 阶段审计子任务（以 `audit-prompts.md` §1 为 Cursor Canonical Base，并显式分离 Claude/OMC Runtime Adapter 与 Repo Add-ons）
4. 未通过则修改并重审
5. 通过后写入评分并返回完成信号
```

### 4.3 防护层 2：Master 协调器

`bmad-master` 是五层架构的统一总入口，其职责包括：

1. **Layer 门控**：只有当前 Layer 审计通过后，才允许进入下一 Layer
2. **Commit 拦截**：所有 git 提交相关动作只能由 Master 放行
3. **状态追踪**：维护 `.claude/state/bmad-progress.yaml`
4. **异常处理**：对审计失败、中断恢复、状态漂移等情况进行协调

典型流程如下：

用户输入 Epic/Story 编号
→ 检查 `bmad-progress.yaml`
→ 确定当前 Layer 与阶段
→ 调用对应 Layer Agent
→ 等待执行返回
→ 验证审计报告与状态
→ 通过则更新状态并放行下一阶段，未通过则要求继续迭代

### 4.4 防护层 3：标准化审计 Agent

建议建立如下 auditor 映射：

| 被审计对象 | 审计 Agent | 审计依据 |
|------------|------------|----------|
| PRD | `auditor-prd` | PRD 审计提示词 |
| Architecture | `auditor-architecture` | Architecture 审计提示词 |
| Story 文档 | `auditor-story` | 对应审计规则 |
| `spec.md` | `auditor-spec` | `audit-prompts.md` §1 |
| `plan.md` | `auditor-plan` | `audit-prompts.md` §2 |
| `GAPS.md` | `auditor-gaps` | `audit-prompts.md` §3 |
| `tasks.md` | `auditor-tasks` | `audit-prompts.md` §4 |
| 实施后代码 | `auditor-implement` | `audit-prompts.md` §5 |
| 独立 TASKS 文档 | `auditor-tasks-doc` | TASKS 文档审计规则 |
| BUGFIX 文档 | `auditor-bugfix` | Bugfix 审计规则 |

统一要求：
- 启动时显式读取审计提示词和被审计文件
- 输出结构化报告
- 结论必须是“完全覆盖、验证通过”或“未通过，列出具体问题”
- 不允许使用“基本通过”“大致可行”等模糊表述

---

## 第五部分：详细实施计划

### 5.1 实施阶段划分

| 阶段 | 目标 | 产出 |
|------|------|------|
| Phase 0 | 基础架构搭建 | Master Agent + 状态系统 |
| Phase 1 | Layer 4 核心适配 | speckit Agents + auditors |
| Phase 2 | Commit 门控实现 | Git 拦截协议 + 审计通过后提交 |
| Phase 3 | Layer 3/5 适配 | Story + Implement Agents |
| Phase 4 | Layer 1/2 适配 | Product + Planning Agents |
| Phase 5 | 集成测试 | 完整端到端流程验证 |

建议优先完成 Phase 0-2，以验证核心模式有效后再扩展到全量 Layers。

### 5.2 Phase 0：基础架构搭建

#### 5.2.1 文件清单

```text
.claude/
├── agents/
│   └── bmad-master.md
├── state/
│   └── bmad-progress.yaml
└── skills/
    └── bmad-master/
        └── SKILL.md
```

#### 5.2.2 bmad-master 核心逻辑

- 读取与写入 `.claude/state/bmad-progress.yaml`
- 根据 Layer 路由表决定下一步调用哪个 Agent
- 校验前置条件是否满足
- 校验审计报告是否存在、是否通过
- 接收并验证提交请求，作为唯一放行者执行 commit

### 5.3 Phase 1：Layer 4 核心适配

#### 5.3.1 Agent 清单

| Agent | 职责 | 依赖 Skill |
|-------|------|-----------|
| `bmad-layer4-speckit-constitution` | 生成 constitution | speckit-workflow §0.5 |
| `bmad-layer4-speckit-specify` | 生成 spec.md + 审计 | speckit-workflow §1 |
| `bmad-layer4-speckit-plan` | 生成 plan.md + 审计 | speckit-workflow §2 |
| `bmad-layer4-speckit-gaps` | 生成 GAPS.md + 审计 | speckit-workflow §3 |
| `bmad-layer4-speckit-tasks` | 生成 tasks.md + 审计 | speckit-workflow §4 |
| `auditor-spec` | 审计 spec.md | `audit-prompts.md` §1 |
| `auditor-plan` | 审计 plan.md | `audit-prompts.md` §2 |
| `auditor-gaps` | 审计 GAPS.md | `audit-prompts.md` §3 |
| `auditor-tasks` | 审计 tasks.md | `audit-prompts.md` §4 |
| `auditor-implement` | 实施后审计 | `audit-prompts.md` §5 |

#### 5.3.2 调用链示例（specify 阶段）

用户触发 Layer 4 specify
→ Master 检查 constitution 是否存在
→ 调用 `bmad-layer4-speckit-specify`
→ 读取 skill 与状态
→ 生成 `spec-E{epic}-S{story}.md`
→ 添加需求映射表
→ 调用 `auditor-spec`
→ 未通过则修改并重审
→ 通过后写入评分并返回 Master
→ Master 更新状态并提示是否进入 plan 阶段

#### 5.3.3 审计循环模式

审计闭环应具备以下行为：
- 每轮审计独立保存报告
- 未通过时保留失败报告路径用于追溯
- 通过后统一触发 `parse-and-write-score`
- 达到最大迭代次数仍未通过时抛出明确错误并停止推进

### 5.4 Phase 2：Commit 门控实现

#### 5.4.1 问题场景

危险路径：Layer 5 Implement Agent 在完成代码后直接执行 `git commit`，完全绕过实施后审计。

#### 5.4.2 解决方案

双层保护：

1. **Agent 层禁止**：所有执行 Agent 的 prompt 中明确禁止 `git commit`、`git push`、`git merge`、`gh pr create`
2. **Master 层门控**：所有提交请求必须先经过 Master 校验当前 Layer 审计状态、报告存在性、变更文件覆盖范围

#### 5.4.3 实施文件

```text
.claude/
├── agents/
│   └── bmad-master.md
└── protocols/
    └── commit-protocol.md
```

### 5.5 扩展 Skills 覆盖矩阵

| Skill | 用途 | 当前覆盖状态 | 适配方案 |
|-------|------|--------------|----------|
| `speckit-workflow` | Layer 4 核心流程 | ✅ | 5 个 speckit Agent + auditors |
| `bmad-story-assistant` | Layer 3 Story 开发 | ✅ | `bmad-layer3-story` |
| `bmad-standalone-tasks` | 独立 TASKS.md 执行 | ❌ 待补齐 | `bmad-standalone-tasks` |
| `bmad-bug-assistant` | Bug 修复流程 | ❌ 待补齐 | `bmad-bug-agent` + `auditor-bugfix` |
| `bmad-code-reviewer-lifecycle` | 审计生命周期管理 | ❌ 待补齐 | 集成到所有 auditor 模板 |
| `bmad-standalone-tasks-doc-review` | TASKS 文档严格审计 | ❌ 待补齐 | `auditor-tasks-doc` |

### 5.6 独立 Tasks 与 Bug 修复扩展

#### 5.6.1 bmad-standalone-tasks 适配

使用场景：用户直接提供 TASKS.md 文件，希望不经过完整五层架构而执行其中任务。

关键要求：
- 执行前必须由 `auditor-tasks-doc` 先审计 TASKS 文档
- 实施过程必须遵循 TDD 红绿灯流程
- 每批任务完成后进行实施审计
- 最终提交仍经过 Master 门控

#### 5.6.2 bmad-bug-assistant 适配

使用场景：Bug 描述 → 根因分析 → BUGFIX 文档 → 修复实施。

关键流程：
- 先做根因分析与 BUGFIX 文档
- 对 BUGFIX 文档进行单独审计
- 修复时先写复现测试，再写修复实现
- 修复完成后执行实施后审计与提交门控

#### 5.6.3 code-reviewer 生命周期集成

每个 auditor Agent 统一执行以下生命周期阶段：
1. Pre-Audit
2. Audit Execution
3. Report Generation
4. Scoring Trigger
5. Iteration Tracking
6. Convergence Check

这样可将 `bmad-code-reviewer-lifecycle` 下沉为一套可复用的审计执行模板。

---

## 第六部分：技术实现细节

### 6.1 实现原则与设计约束

技术实现必须同时满足“Claude Code 原生工作方式”与“BMAD-Speckit 强约束流程”两类要求，因此本方案不采用简单的 prompt 搬运，而采用“轻量 Agent 定义 + 显式技能加载 + 状态门控 + 审计代理标准化”的组合实现。

核心设计约束如下：

1. **子 Agent 默认不继承父上下文**：任何流程约束、技能依赖、审计规则，都不能假设会被自动传递，必须在子 Agent 启动逻辑中显式加载。
2. **禁止把流程控制寄托于模型自觉**：不能依赖“模型应该知道要先审计再提交”，而必须通过 prompt 协议、状态文件、审计结论文件和 Master 门控共同约束。
3. **审计与实施必须解耦**：负责产出的 Agent 不负责最终放行，负责审计的 Agent 不负责实施修改，避免“自写自审自通过”。
4. **Git 提交必须外收口**：所有 commit/push/merge/gh pr create 等高风险动作统一由 Master Agent 或明确授权的提交阶段代理执行。
5. **流程状态必须可恢复**：任一阶段中断后，应能通过状态文件恢复，不要求用户重新口头描述当前进度。

因此，技术实现层面实际上由四类构件组成：流程协调器、阶段执行 Agent、审计 Agent、共享状态与协议文件。它们共同形成 Claude Code 下可执行、可追溯、可审计的 BMAD 运行时。

### 6.2 目录结构与文件布局

建议在 `.claude/` 下采用分层目录组织，避免后续 Agent 数量增加后难以维护。

```text
.claude/
├── agents/
│   ├── bmad-master.md
│   ├── layers/
│   │   ├── bmad-layer1-product.md
│   │   ├── bmad-layer2-planning.md
│   │   ├── bmad-layer3-story.md
│   │   ├── bmad-layer4-speckit-constitution.md
│   │   ├── bmad-layer4-speckit-specify.md
│   │   ├── bmad-layer4-speckit-plan.md
│   │   ├── bmad-layer4-speckit-gaps.md
│   │   ├── bmad-layer4-speckit-tasks.md
│   │   ├── bmad-layer5-implement.md
│   │   ├── bmad-standalone-tasks.md
│   │   └── bmad-bug-agent.md
│   └── auditors/
│       ├── auditor-prd.md
│       ├── auditor-architecture.md
│       ├── auditor-story.md
│       ├── auditor-spec.md
│       ├── auditor-plan.md
│       ├── auditor-gaps.md
│       ├── auditor-tasks.md
│       ├── auditor-implement.md
│       ├── auditor-tasks-doc.md
│       └── auditor-bugfix.md
├── commands/
│   ├── bmad-init.md
│   ├── bmad-layer1.md
│   ├── bmad-layer2.md
│   ├── bmad-layer3.md
│   ├── bmad-layer4.md
│   ├── bmad-layer5.md
│   ├── bmad-bug.md
│   └── bmad-tasks.md
├── protocols/
│   ├── commit-protocol.md
│   ├── audit-result-schema.md
│   └── handoff-schema.md
├── state/
│   ├── bmad-progress.yaml
│   └── bmad-lock.yaml
└── skills/
    └── bmad-master/
        └── SKILL.md
```

重点在于：
- `layers/` 只放产出类 Agent
- `auditors/` 只放审计类 Agent
- `protocols/` 放跨 Agent 通信协议
- `state/` 存放运行态数据而非业务产物
- `commands/` 仅作为用户入口，不承载复杂业务逻辑

### 6.3 Agent 定义模型

每个 Agent 定义文件建议采用统一模板，至少包含：
1. 身份与职责
2. 启动强制步骤
3. 必须执行流程
4. 禁止行为
5. 输出与返回格式

这样可以保证所有 Agent 都具备可预期入口行为和可被 Master 解析的输出。

### 6.4 启动阶段的显式技能加载机制

Claude Code 中最大的适配点，不在于“如何写 Agent”，而在于“如何保证 Agent 启动后先拿到正确约束”。

因此每个关键 Agent 都必须内置显式技能加载机制：
- 启动后先读取对应 skill 文件
- 根据自身职责抽取所需章节
- 将该章节内容转化为本轮执行不可违反的规则
- 再读取上下文文档与状态文件开始工作

这样做的好处是：
- 避免 Agent prompt 过长
- skill 更新后无需大规模同步修改 Agent 文件
- 保留“技能是规则源头、Agent 是执行外壳”的单一事实来源

### 6.5 共享状态模型

推荐主状态文件为 `.claude/state/bmad-progress.yaml`，记录：
- 当前 Layer / Stage
- 当前模式（标准、standalone_tasks、bugfix）
- 审计状态
- 产物文件路径
- 审计轮次与失败报告路径
- Git 控制状态
- 更新时间戳

关键设计原则：
1. 状态与产物分开
2. 审计态可追溯
3. Git 控制显式化

此外建议增加 `bmad-lock.yaml` 用于避免并发修改状态。

### 6.6 审计闭环实现机制

统一闭环流程如下：
1. 执行 Agent 生成或修改目标文档/代码
2. 调用对应 auditor Agent
3. auditor 输出结构化审计报告
4. 若未通过则根据报告修改并重审
5. 若通过则写入评分并更新状态
6. Master 校验报告与状态后放行下一阶段

审计报告建议使用统一结构，至少包含：
- 审计对象
- 审计类型
- 审计轮次
- 结论
- 摘要
- findings 列表
- 必改项

### 6.7 Commit 门控的实现方式

“未经审计自行 commit”必须被技术手段阻断，因此 commit 门控不能只写在文档里，而应通过协议与状态双重实现。

三段式门控：

1. **Agent 级禁令**
   所有执行类 Agent prompt 中明确禁止 `git commit` / `git push` / `git merge` / `gh pr create`

2. **提交请求协议**
   执行 Agent 只能返回标准化 `commit_request`，列出文件、阶段、消息和所需审计

3. **Master 验证放行**
   Master 校验：
   - 当前阶段是否已审计通过
   - 审计报告是否存在
   - 待提交文件是否在审计覆盖范围内
   - 是否存在额外未审计变更

### 6.8 Standalone Tasks 与 Bug Assistant 的专项实现

#### 6.8.1 `bmad-standalone-tasks`

该模式不依赖完整 Layer 1-5，但仍需要：
- 先审计 TASKS 文档本身
- 再进入逐任务 TDD 实施
- 批次实施后进行实施审计
- 所有提交仍经 Master 门控

#### 6.8.2 `bmad-bug-agent`

Bug 流程建议单独建模，包含：
- 根因分析
- BUGFIX 文档
- 文档审计
- 复现测试
- 修复实现
- 实施后审计
- 提交门控

原因在于 bugfix 的阶段序列与 Story/Spec 流程并不完全同构。

### 6.9 Code Reviewer Lifecycle 的落地方式

`bmad-code-reviewer-lifecycle` 不应继续作为一个平行的口头概念存在，而应内嵌为所有 auditor 的共同生命周期框架：
- Pre-Audit
- Rule Load
- Audit Execution
- Structured Report
- Score Trigger
- Iteration Bookkeeping
- Return Gate Result

这可以让后续新增 auditor 时自动继承统一行为。

### 6.10 Hook-Based Runtime Augmentation

除了 Agent、状态文件与审计闭环之外，还可以借鉴 Claude Mem 的 hooks architecture，为 BMAD-Speckit 在 Claude Code CLI 下增加一层“运行时增强层”。其核心思想不是把 hooks 当作新的主流程引擎，而是把 hooks 作为围绕 Claude Code 生命周期事件的轻量观测、上下文注入与异步处理入口，从而在不侵入 Claude Code 本体的前提下增强流程稳定性、追溯能力和恢复能力。

建议重点使用以下生命周期事件：

- **SessionStart**：读取最近一次 BMAD checkpoint、当前 `bmad-progress.yaml` 状态、最近未解决审计项，并以紧凑摘要形式注入 additionalContext。
- **UserPromptSubmit**：识别用户当前请求属于哪种 BMAD 模式（Layer 流程、standalone tasks、bugfix、review 等），初始化或更新本轮 run 记录。
- **PostToolUse**：捕获高价值执行事件，例如文档生成、文件修改、测试运行、审计报告写入、git 操作尝试、Agent 调用返回结果。
- **Stop**：在会话暂停或一次工作段结束时生成 checkpoint，总结当前目标、已完成阶段、未解决阻塞项和推荐下一步。
- **SessionEnd**：将本轮 run 标记为完成，并允许后台 worker 异步收尾，不阻塞主会话结束。

这里最值得借鉴 Claude Mem 的地方，是“**hook 做快路径，worker 做重处理**”的分层方式。对于 BMAD，hook 不应承担最终审计判定、阶段放行或 commit 放行职责，这些仍由 `bmad-master` 同步控制；hook 更适合做以下增强工作：

1. 捕获事件并快速写入本地队列或事件日志；
2. 让后台 worker 异步生成压缩摘要、失败轮次聚合、审计轨迹索引；
3. 为下一次 SessionStart 准备可注入的 compact context；
4. 在不影响主交互性能的前提下，提高流程可追溯性和中断恢复体验。

推荐的实现模式为：

```text
Hook Event
  → 轻量采集
  → 本地队列 / 事件日志
  → 后台 worker 异步处理
  → 生成 checkpoint / 摘要 / 检索索引
  → 下次 SessionStart 注入紧凑上下文
```

在这一模式下，应明确职责边界：

- **Master 负责强门控**：是否允许进入下一阶段、是否允许 commit、是否满足前置条件；
- **Hooks 负责观测与增强**：记录事实、生成摘要、注入恢复上下文、辅助检测流程逃逸迹象；
- **Worker 负责异步加工**：压缩事件、归档报告、构建时间线、准备下次启动所需的记忆材料。

需要特别强调的是，hooks 的失败不应轻易阻断 Claude Code 的主工作流。Claude Mem 非常值得借鉴的一点就是“增强能力失败时应优雅降级，而不是拖垮主系统”。对 BMAD 来说，这意味着：checkpoint 生成失败、事件归档失败、摘要生成失败，不应阻断当前任务继续；但若 hook 参与的是明确的强门控校验，则必须由主控逻辑而非异步 worker 来执行。

因此，Hook-Based Runtime Augmentation 最适合作为本方案在第六部分技术实现中的“外围增强层”：它不替代 Agent/状态/审计主骨架，但能显著提高系统的可恢复性、可追溯性和运行时可观测性，使 BMAD-Speckit 在 Claude Code CLI 下不仅“能运行”，而且“能持续稳定地运行”。

#### 6.10.7 事件 Schema（可实现规格）

为便于 hooks adapter、queue 和 worker 之间稳定协作，建议把运行时事件的 JSON 结构固定为如下 schema。这里不要求第一版就做成 JSON Schema 文件，但字段语义应从一开始就稳定下来。

```json
{
  "event_id": "evt_20260313_001",
  "event_type": "audit_requested",
  "session_id": "sess_abc123",
  "run_id": "run_epic11_story1_specify",
  "timestamp": "2026-03-13T10:45:12.000Z",
  "mode": "layer-flow",
  "layer": 4,
  "stage": "specify",
  "actor": "hook",
  "source": {
    "hook": "PostToolUse",
    "tool_name": "Write"
  },
  "payload": {},
  "idempotency_key": "sess_abc123:PostToolUse:Write:2026-03-13T10:45",
  "status": "pending",
  "created_at": "2026-03-13T10:45:12.150Z"
}
```

字段约束建议如下：

- `event_id`：全局唯一字符串，建议使用时间前缀 + 随机后缀；
- `event_type`：必须属于预定义枚举；
- `session_id`：Claude Code 会话标识；
- `run_id`：BMAD 当前工作单元标识，建议与 story、bugfix 或 tasks 文档绑定；
- `mode`：固定枚举，避免自由文本；
- `layer`：仅在五层主流程下必填；
- `stage`：阶段名，如 `specify`、`plan`、`tasks`、`implement`；
- `actor`：标记是 hook、master、agent 还是 auditor 发出的事件；
- `source`：标记本事件来自哪个 hook、哪个 tool；
- `payload`：允许按事件类型扩展；
- `idempotency_key`：用于去重；
- `status`：仅用于队列处理状态，不代表业务状态。

建议按 `event_type` 定义 payload 子结构。例如：

- `document_generated.payload`：`file_path`, `document_type`, `artifact_scope`
- `audit_requested.payload`：`audit_target`, `auditor_name`, `report_path_expected`
- `audit_completed.payload`：`audit_target`, `report_path`, `result`, `round`
- `commit_requested.payload`：`files`, `message`, `requested_by_stage`
- `policy_violation_detected.payload`：`violation_type`, `details`, `severity`

#### 6.10.8 JSON 事件样例

下面给出三类建议优先支持的 JSON 事件样例。

**样例 1：SessionStart 恢复上下文事件**

```json
{
  "event_id": "evt_20260313_start_001",
  "event_type": "session_started",
  "session_id": "sess_cc_20260313_a1",
  "run_id": "run_epic11_story1",
  "timestamp": "2026-03-13T08:00:00.000Z",
  "mode": "layer-flow",
  "layer": 4,
  "stage": "specify",
  "actor": "hook",
  "source": {
    "hook": "SessionStart",
    "tool_name": null
  },
  "payload": {
    "repo_root": "D:\\dev\\BMAD-Speckit-SDD-Flow",
    "resume_from_checkpoint": true,
    "checkpoint_path": ".claude/state/runtime/checkpoints/latest.md"
  },
  "idempotency_key": "sess_cc_20260313_a1:SessionStart:init",
  "status": "pending",
  "created_at": "2026-03-13T08:00:00.100Z"
}
```

**样例 2：审计请求事件**

```json
{
  "event_id": "evt_20260313_auditreq_014",
  "event_type": "audit_requested",
  "session_id": "sess_cc_20260313_a1",
  "run_id": "run_epic11_story1",
  "timestamp": "2026-03-13T08:23:41.000Z",
  "mode": "layer-flow",
  "layer": 4,
  "stage": "specify",
  "actor": "agent",
  "source": {
    "hook": "PostToolUse",
    "tool_name": "Agent"
  },
  "payload": {
    "audit_target": "specs/epic-11/story-1/spec-E11-S1.md",
    "auditor_name": "auditor-spec",
    "expected_report_path": "_bmad-output/reviews/AUDIT_spec-E11-S1_round1.md",
    "round": 1
  },
  "idempotency_key": "sess_cc_20260313_a1:specify:audit_requested:round1",
  "status": "pending",
  "created_at": "2026-03-13T08:23:41.120Z"
}
```

**样例 3：提交被阻断事件**

```json
{
  "event_id": "evt_20260313_commitblock_003",
  "event_type": "commit_blocked",
  "session_id": "sess_cc_20260313_a1",
  "run_id": "run_epic11_story1",
  "timestamp": "2026-03-13T09:02:10.000Z",
  "mode": "layer-flow",
  "layer": 5,
  "stage": "implement",
  "actor": "master",
  "source": {
    "hook": "PostToolUse",
    "tool_name": "Bash"
  },
  "payload": {
    "reason": "audit_not_passed",
    "attempted_command": "git commit -m \"feat: implement story 11.1\"",
    "required_audit": "auditor-implement",
    "current_audit_status": "PENDING"
  },
  "idempotency_key": "sess_cc_20260313_a1:implement:commit_blocked:1",
  "status": "pending",
  "created_at": "2026-03-13T09:02:10.150Z"
}
```

#### 6.10.9 Worker 伪代码

为了让实现者清楚 worker 的职责边界，建议文档中直接给出伪代码。下面是一版足够接近实现的单 worker 版本：

```ts
async function processRuntimeQueue() {
  while (true) {
    const nextEvent = await dequeuePendingEvent();

    if (!nextEvent) {
      await sleep(1000);
      continue;
    }

    try {
      await markProcessing(nextEvent.event_id);

      if (await isDuplicate(nextEvent.idempotency_key)) {
        await markDone(nextEvent.event_id, { deduplicated: true });
        continue;
      }

      await appendEventProjection(nextEvent);

      switch (nextEvent.event_type) {
        case "session_started":
          await prepareStartupContext(nextEvent.run_id);
          break;

        case "document_generated":
        case "file_modified":
        case "audit_requested":
        case "audit_completed":
        case "test_executed":
        case "commit_requested":
        case "commit_blocked":
          await updateCurrentRunProjection(nextEvent);
          await updateAuditTimeline(nextEvent);
          await detectRiskSignals(nextEvent);
          break;

        case "session_stopped":
          await generateCheckpoint(nextEvent.run_id);
          await prepareStartupContext(nextEvent.run_id);
          break;

        case "session_ended":
          await finalizeRun(nextEvent.run_id);
          break;
      }

      await markDone(nextEvent.event_id, { processed_at: new Date().toISOString() });
    } catch (error) {
      await markFailed(nextEvent.event_id, {
        error_message: String(error),
        failed_at: new Date().toISOString()
      });
    }
  }
}
```

建议把 worker 再拆成四个明确函数族：

1. **队列函数**：`dequeuePendingEvent`, `markProcessing`, `markDone`, `markFailed`
2. **投影函数**：`updateCurrentRunProjection`, `updateAuditTimeline`, `appendEventProjection`
3. **检测函数**：`detectRiskSignals`, `isDuplicate`
4. **摘要函数**：`generateCheckpoint`, `prepareStartupContext`, `finalizeRun`

这样做的好处是职责清晰，也更方便未来从“文件队列 + 单 worker”平滑升级为“数据库 + 多 worker”。

#### 6.10.10 SessionStart additionalContext 模板

为了保证恢复上下文稳定且不过载，建议把 SessionStart 注入内容固定成一个紧凑模板。该模板不应注入原始长日志，而应只注入高价值索引信息。

建议模板如下：

```text
[BMAD Runtime Checkpoint]
Current run: {{run_id}}
Mode: {{mode}}
Layer/Stage: {{layer}} / {{stage}}
Last checkpoint: {{checkpoint_time}}

Latest audit status:
- Target: {{latest_audit_target}}
- Result: {{latest_audit_result}}
- Round: {{latest_audit_round}}
- Report: {{latest_audit_report_path}}

Open blockers:
- {{blocker_1}}
- {{blocker_2}}

Guardrails:
- {{guardrail_1}}
- {{guardrail_2}}

Recommended next step:
- {{next_step}}
```

以一个真实例子表示，大致会长这样：

```text
[BMAD Runtime Checkpoint]
Current run: run_epic11_story1
Mode: layer-flow
Layer/Stage: 4 / specify
Last checkpoint: 2026-03-13T08:55:00Z

Latest audit status:
- Target: specs/epic-11/story-1/spec-E11-S1.md
- Result: FAILED
- Round: 2
- Report: _bmad-output/reviews/AUDIT_spec-E11-S1_round2.md

Open blockers:
- mapping table 未覆盖 acceptance criteria 3
- 缺少异常路径说明

Guardrails:
- 未通过 auditor-spec 前禁止进入 plan 阶段
- 未通过实施后审计前禁止 commit

Recommended next step:
- 修订 spec 后重新发起 auditor-spec round 3
```

该模板的设计原则是：
- **只注入恢复所需最小信息**；
- **显式提醒当前 guardrails**；
- **把下一步建议写清楚**；
- **避免长段原始历史进入上下文**。

这样既能提高恢复效率，也不会把 SessionStart 变成新的上下文污染源。

### 6.11 命令入口与调用链实现

对用户而言，推荐保留轻量命令入口，由命令入口负责把参数交给 Master，再由 Master 做路由。

典型调用链：

用户输入 `/bmad-layer4 specify epic-11 story-1`
→ `commands/bmad-layer4.md`
→ 调用 `bmad-master` 并传入参数
→ Master 校验状态与前置条件
→ 调用 `bmad-layer4-speckit-specify`
→ 调用 `auditor-spec`
→ 审计通过后回到 Master
→ 更新状态并提示是否进入下一阶段

### 6.12 容错、恢复与幂等策略

建议恢复策略如下：
1. 阶段开始即写状态为 `IN_PROGRESS`
2. 审计结果落盘后再改状态为 `PASSED`
3. 重复执行时优先检查是否已通过
4. 失败不覆盖历史报告
5. Master 作为唯一状态终审写入者

### 6.13 与现有仓库脚本和评分系统的集成点

关键集成点包括：
1. `parse-and-write-score`
2. 现有审计提示词和 mapping table 规范

所有 auditor 的通过后动作都应复用已有评分写入脚本，而不是另起一套评分实现。

### 6.14 技术实现小结

本方案不是简单“把 Cursor command 翻译成 Claude Code agent”，而是将原本依赖命令内嵌和任务上下文传递的约束，重构为四个稳定技术支点：
- Agent 定义中的显式约束
- Master 负责的阶段门控与提交门控
- 标准化 auditor 的审计生命周期
- 共享状态文件驱动的可恢复执行

只有这四个支点同时成立，Claude Code CLI 下的 BMAD-Speckit 五层架构及其扩展流程，才能真正达到“可执行、可审计、可追溯、不可绕过”的目标。

---

## 第七部分：风险、边界与未决问题

### 7.1 实施风险

尽管本方案通过 Agent 约束嵌入、Master 门控、标准化 auditor 和共享状态文件建立了较完整的防护体系，但在 Claude Code CLI 环境下，仍然存在若干不可忽视的实施风险。这些风险主要不来自“方案缺失”，而来自运行环境本身的开放性、模型执行的不确定性，以及多 Agent 协作时的一致性问题。

第一类风险是**规则失配风险**。即使 Agent prompt 已明确要求先读取 skill、再执行审计闭环，模型仍可能在复杂上下文中遗漏某一步骤，尤其是在长链路执行、频繁文件切换或并行子任务较多时。这意味着方案可以显著降低流程逃逸概率，但不能仅依赖 prompt 文本本身实现 100% 强制，仍需借助状态校验、报告存在性检查和提交门控进行补强。

第二类风险是**状态漂移风险**。共享状态文件虽然能提供恢复与门控能力，但如果多个 Agent 在近似同时写入状态，或者某个 Agent 异常退出后未正确回写最终状态，就可能造成“文档已产出但状态仍为进行中”或“状态显示通过但报告文件不存在”等漂移现象。该风险在并行执行和中断恢复场景下尤为明显。

第三类风险是**审计成本膨胀风险**。本方案强调每个关键阶段都必须经过 auditor 代理审计，并在未通过时循环迭代。这能提升质量，但也会带来 token 消耗、执行轮次增加、交互时长上升等成本。若缺乏合理的阶段优先级和收敛规则，可能导致用户体感上“流程过重”。

第四类风险是**Git 门控绕过风险**。虽然设计上要求子 Agent 禁止直接 commit，但 Claude Code 本身具备直接执行工具动作的能力，如果某些入口命令、运行模式或后续新增 Agent 未正确继承禁令模板，仍可能出现个别路径绕过 Master 的情况。因此，commit 风险不能只通过“规范提醒”解决，必须辅以统一模板、审计前置检查和人工确认策略。

### 7.2 技术边界

本方案必须明确其技术边界，以避免将 Claude Code CLI 适配问题扩大为“全面重构 BMAD 平台”的问题。

首先，本方案的边界是**适配现有 BMAD-Speckit 工作流到 Claude Code CLI**，而不是重写 BMAD 全部流程引擎。重点解决的是“约束如何传递”“审计如何闭环”“提交如何门控”“状态如何追踪”，而不是重新设计 PRD、Story、Spec、Tasks 或 Bugfix 方法论本身。

其次，本方案不试图在 Claude Code 中复制 Cursor 的 MCP task 运行机制。目标是达到同样的流程纪律和审计效果，而不是逐项模拟原运行时。

第三，本方案不承诺消除所有模型自由度。Claude Code 本质上仍是基于大模型的 agent 系统，不是严格意义上的 deterministic workflow engine。因此，该方案的定位应是“高约束的 agent 编排框架”，而不是“强确定性的流程引擎”。

第四，本方案不覆盖所有未来可能新增的 skill。当前重点覆盖五层主流程和若干关键扩展技能；未来若新增新的专项 skill，仍需按相同原则补充对应执行 Agent、auditor、状态字段与协议模板。

### 7.3 运行边界与使用边界

从使用方式上看，该方案更适合中高复杂度、强调审计和追溯的工作流，例如 Story 驱动开发、独立 TASKS 执行、Bugfix 文档闭环、正式方案产出等。对于一次性的小改动、单文件修复、非关键性文档润色，如果全部启用这套机制，可能显得过重，反而降低效率。

因此后续实现中应考虑定义“严格模式”和“轻量模式”，在不破坏主流程原则的前提下，为低风险任务保留简化路径。

此外，该方案依赖若干前提条件：仓库内 skill 文件路径稳定、评分脚本可用、审计模板已存在、目录约定清晰。如果这些基础资产本身不稳定，那么适配层会承担过多补丁性逻辑，导致系统复杂度快速上升。

### 7.4 未决问题

当前方案已经形成清晰骨架，但仍有若干关键问题需要在正式实施前进一步确认。

#### 7.4.1 Master Agent 的落地形式

存在两种方向：
- **方案 A：纯 Agent 协调**：实现快、接近 Claude Code 原生，但更依赖模型稳定性
- **方案 B：Agent + 辅助脚本**：关键门控更确定，但实现成本更高

#### 7.4.2 Commit 门控是软门控还是硬门控

需要明确是否仅通过 prompt 和流程约束禁止提交，还是进一步通过 hook、wrapper script 或统一入口实现更硬性的技术拦截。

#### 7.4.3 审计收敛条件如何统一

仍需明确：
- 是否所有严格模式都要求连续多轮无 gap
- 文档类、代码类、修复类是否采用不同阈值
- 轻量模式是否允许单轮通过

#### 7.4.4 并行执行的边界

需要明确：
- 哪些任务可以并行
- 哪些任务必须串行
- 并行状态如何避免冲突
- 并行实施后如何统一进入审计阶段

#### 7.4.5 现有 skill 与新 Agent 的职责边界

需要进一步确认：
- 哪些规则必须保留在 skill 中
- 哪些执行细节应固化在 Agent 模板里
- 哪些跨流程协议应独立成 `protocols/*.md`

### 7.5 建议的风险应对策略

建议采用“小范围验证、逐步扩展”的策略：

1. 优先选择 **Layer 4 + commit 门控 + standalone tasks** 作为验证闭环
2. 在 P0/P1 阶段先形成统一模板，而不是一次性覆盖所有 skills
3. 对所有高风险动作保留人工确认口
4. 在集成测试阶段优先验证四类逃逸路径：
   - 跳过审计直接完成
   - 直接 commit
   - 审计未通过但状态误标为通过
   - 中断后恢复执行是否正确续跑

### 7.6 本部分小结

该方案在方向上可行，在结构上完整，但必须通过分阶段实现、模板化落地和高风险路径优先验证，才能从文档级方案转化为可持续运行的工程能力。

---

## 第八部分：推荐实施路径与决策建议

### 8.1 推荐实施路径

结合前文的风险分析、实现复杂度和当前最迫切的问题，建议采用“先控风险、再扩范围、最后做优化”的三阶段推进路径，而不是一开始就全量覆盖所有 Layer 与所有 skill。

#### 第一阶段：先建立最小可运行闭环

首要目标不是“把全部 BMAD 流程一次性迁移完”，而是尽快在 Claude Code CLI 中建立一个能够稳定运行、可防逃逸、可恢复的最小闭环。这个最小闭环建议由以下三部分组成：

1. **`bmad-master` 总协调器**
2. **Layer 4 核心流程**
   - `bmad-layer4-speckit-specify`
   - `bmad-layer4-speckit-plan`
   - `bmad-layer4-speckit-tasks`
   - 对应 auditor
3. **commit 门控机制**

之所以优先选择这一组，是因为它们同时覆盖了：
- 文档产出；
- 审计闭环；
- 评分写入；
- 提交拦截。

也就是说，只要这一阶段成功，就已经验证了本方案最核心的四个技术支点：显式技能加载、阶段门控、标准化审计、提交放行控制。

#### 第二阶段：补齐旁路高风险流程

在最小闭环验证通过后，第二阶段建议优先补齐那些即使不走五层主流程、也同样容易造成流程逃逸的旁路能力：

1. **`bmad-standalone-tasks`**
2. **`auditor-tasks-doc`**
3. **`bmad-bug-agent`**
4. **`auditor-bugfix`**
5. **`auditor-implement` 的统一实施后审计模板**

这一步的核心价值在于：把“最容易被直接执行、最容易绕过主流程”的任务类型也纳入同一治理体系，避免主流程很严格、旁路流程却继续裸奔。

#### 第三阶段：扩展到完整五层架构与体验优化

当核心闭环和旁路高风险流程都跑稳后，再推进以下内容：

- Layer 1 / Layer 2 / Layer 3 / Layer 5 全量适配
- 命令入口统一化
- 状态恢复体验优化
- 审计报告模板优化
- 更细粒度的并行边界控制
- 轻量模式 / 严格模式切换

这一阶段的目标不再是“能不能跑”，而是“是否好维护、是否好扩展、是否好用”。

### 8.2 推荐优先级

从实际收益与实现成本比来看，建议按以下优先级推进：

#### P0：必须先做

这些能力如果不先落地，整个适配方案即使开始写 Agent，也很容易继续出现绕过审计或直接提交的问题。

- `bmad-master`
- `.claude/state/bmad-progress.yaml`
- commit 请求协议
- commit 门控逻辑
- `auditor-spec`
- `auditor-plan`
- `auditor-tasks`

#### P1：尽快做

这些能力构成 Layer 4 的实际可用闭环，是验证方案是否成立的关键。

- `bmad-layer4-speckit-specify`
- `bmad-layer4-speckit-plan`
- `bmad-layer4-speckit-tasks`
- scoring 写入集成
- 审计报告统一格式

#### P2：高价值扩展

这些能力用于覆盖主流程之外的高风险路径。

- `bmad-standalone-tasks`
- `auditor-tasks-doc`
- `bmad-bug-agent`
- `auditor-bugfix`
- `auditor-implement`

#### P3：完整覆盖与产品化

这些能力用于完善生态一致性和用户体验。

- Layer 1 / 2 / 3 / 5 全部 Agent
- 统一命令入口
- 轻量模式 / 严格模式
- 更细粒度并行控制
- 自动恢复与提示优化

### 8.3 推荐决策

基于前文所有分析，建议对以下几个关键问题作出明确决策。

#### 决策一：采用“Agent + 状态 + 审计 + 门控”的组合架构

不建议选择单一方案，例如只靠长 prompt、只靠 skill、或只靠人工纪律。原因很简单：任何单点方案都不足以防止流程逃逸。必须同时具备：

- Agent 显式加载规则；
- Master 门控流程；
- auditor 独立审计；
- 状态文件承载恢复与校验。

这是本方案最核心的架构决策，建议直接确定，不再反复摇摆。

#### 决策二：Master 采用“Agent + 轻量辅助脚本”而非纯 prompt 协调

如果完全依赖 Master Agent 自己在 prompt 中判断状态、文件、审计报告和提交资格，理论上可以实现，但稳定性上限有限。更实际的建议是：

- **策略、编排、交互** 由 Master Agent 负责；
- **状态校验、报告存在性检查、提交资格校验** 由轻量脚本或协议化检查负责。

这是一种折中方案：既保留 Claude Code 的原生交互能力，也避免关键门控完全依赖模型判断。

#### 决策三：commit 门控必须优先于全量流程迁移

不要先忙着把所有 Layer Agent 都写完，再回来补 commit 门控。因为只要 commit 门控没立住，任何阶段的适配都存在“看起来流程完善，但最后一键绕过”的漏洞。

因此，建议把 commit 门控提升到与 Layer 4 同级的核心优先级，而不是视为后续优化项。

#### 决策四：将 `bmad-code-reviewer-lifecycle` 下沉为 auditor 模板能力

不建议把它继续作为一个“额外要记得调用”的横向 skill。最佳做法是把它固化进 auditor 模板，让所有审计 Agent 天然具备：
- 前置检查；
- 规则加载；
- 报告结构化；
- 评分触发；
- 迭代追踪；
- 收敛检查。

这样后续扩展时，不需要再额外思考“有没有套 lifecycle”。

#### 决策五：先支持严格模式，再考虑轻量模式

当前问题的本质是 Claude Code CLI 在 BMAD 场景下“过于自由”，所以第一版应优先保证严格性而不是便利性。也就是说：
- 第一版先把“不可绕过”做好；
- 第二版再考虑“哪些低风险场景可以简化”。

否则很容易在一开始就为了使用体验过早让步，重新引入流程逃逸。

### 8.4 推荐落地顺序

如果要转为真正的工程实施任务，建议按如下顺序落地：

1. 建立 `.claude/state/` 与状态模型
2. 定义 `bmad-master`
3. 定义 `commit-protocol.md`
4. 先实现 `auditor-spec` / `auditor-plan` / `auditor-tasks`
5. 再实现 `bmad-layer4-speckit-specify` / `plan` / `tasks`
6. 接入评分写入
7. 用一个真实 Story 跑通 Layer 4 闭环
8. 验证跳过审计、直接 commit、中断恢复等异常路径
9. 再扩展到 standalone tasks 与 bug assistant
10. 最后扩展至 Layer 1/2/3/5 与体验优化

这个顺序的好处是：每一步都能产生可验证成果，而不是先堆出大量 Agent 文件，再发现底层控制模型不稳。

### 8.5 附录 A：文件路径约定与命名规范

为避免后续实现时出现路径漂移、命名不一致和跨 Agent 协议失配，建议在正式实现前先固定一组路径与命名约定。该约定的目标不是追求形式统一，而是让 hooks、worker、master、auditor 和人工排查都能以同一套路径语义理解系统状态。

#### A.1 目录约定

```text
.claude/
├── agents/
├── commands/
├── protocols/
├── skills/
└── state/
    ├── bmad-progress.yaml
    ├── bmad-lock.yaml
    └── runtime/
        ├── events/
        ├── queue/
        ├── checkpoints/
        ├── projections/
        └── startup-context/
```

建议约定如下：

- `.claude/agents/`：所有执行 Agent 与 auditor 定义文件；
- `.claude/commands/`：用户入口命令；
- `.claude/protocols/`：跨 Agent 共享协议，如 commit request、handoff schema；
- `.claude/state/bmad-progress.yaml`：业务流程真相文件；
- `.claude/state/bmad-lock.yaml`：并发写保护；
- `.claude/state/runtime/events/`：append-only 原始事件日志；
- `.claude/state/runtime/queue/`：待处理、处理中、失败、完成队列；
- `.claude/state/runtime/checkpoints/`：Stop 生成的恢复摘要；
- `.claude/state/runtime/projections/`：worker 生成的可读取聚合视图；
- `.claude/state/runtime/startup-context/`：SessionStart 注入上下文缓存。

#### A.2 文件命名约定

建议采用“语义前缀 + 稳定标识”的命名方式：

- Agent：`bmad-layer{N}-{purpose}.md`
- Auditor：`auditor-{target}.md`
- 协议：`{domain}-protocol.md` 或 `{domain}-schema.md`
- Checkpoint：`session-{session_id}.md`
- Projection：`current-run.json`、`audit-timeline.json`、`risk-signals.json`
- Event log：按日期滚动，如 `2026-03-13.jsonl`
- Queue item：`{timestamp}_{event_id}.json`

#### A.3 run_id 与 artifact 命名约定

建议统一采用以下模式：

- Story 流程：`run_epic{epic}_story{story}`
- Bug 流程：`run_bug_{bug_id}`
- Standalone tasks：`run_tasks_{slug}`

文档产物建议保留现有业务命名，同时在事件里引用绝对或仓库相对路径。例如：

- `specs/epic-11/story-1/spec-E11-S1.md`
- `_bmad-output/reviews/AUDIT_spec-E11-S1_round2.md`
- `_bmad-output/implementation-artifacts/BUGFIX-BUG-123.md`

#### A.4 命名约束原则

- 尽量避免空格；
- 尽量避免过长路径，尤其在 Windows 环境下；
- 阶段标识保持稳定，统一使用 `specify`、`plan`、`gaps`、`tasks`、`implement`；
- 文件名里优先放稳定 ID，再放语义后缀；
- 同一概念不要同时出现多个命名变体，例如不要混用 `task-doc-review`、`tasks-doc-review`、`tasksDocReview`。

这些约定一旦固定，应同时反映到 Agent prompt、hooks payload、runtime events 和 worker projection 中，避免形成多套命名体系。

### 8.6 附录 B：Hook 配置映射草案

为了将 hooks 架构真正落地，需要把 Claude Code 生命周期事件与本地脚本职责映射清楚。推荐采用“一个 hook 一个主脚本入口”的方式，每个入口再调用共享库完成标准化处理。

#### B.1 Hook 到脚本的映射

| Hook | 建议脚本 | 主要职责 |
|------|----------|----------|
| `SessionStart` | `scripts/hooks/session-start.ts` | 读取 checkpoint、构建 startup context、注入 additionalContext |
| `UserPromptSubmit` | `scripts/hooks/user-prompt-submit.ts` | 创建/恢复 run、识别模式、记录 prompt 级事件 |
| `PostToolUse` | `scripts/hooks/post-tool-use.ts` | 捕获高价值 tool 事件、写入 event log 和 queue |
| `Stop` | `scripts/hooks/stop.ts` | 触发 checkpoint 生成、记录阶段性摘要事件 |
| `SessionEnd` | `scripts/hooks/session-end.ts` | 标记 run 结束、触发 worker drain、写入结束事件 |

#### B.2 脚本职责约定

**`session-start.ts`**
- 读取 `current-run.json` 与 `checkpoints/latest.md`；
- 如果存在可恢复 run，则生成 compact additionalContext；
- 记录 `session_started` 与 `session_context_injected` 事件；
- 失败时降级为空注入，不阻断会话启动。

**`user-prompt-submit.ts`**
- 读取当前 prompt；
- 判断是新 run、恢复 run 还是已有 run 的继续；
- 根据 prompt 和 `bmad-progress.yaml` 识别当前模式；
- 记录 `run_opened`、`run_resumed`、`run_classified` 等事件。

**`post-tool-use.ts`**
- 只处理高价值工具事件；
- 将 tool 输出标准化为事件 payload；
- 对 git 提交尝试、审计报告生成、文件修改、测试执行等做分类；
- 写入 JSONL event log，并把对应队列文件放入 `queue/pending/`。

**`stop.ts`**
- 记录 `session_stopped` 事件；
- 通知 worker 优先生成 checkpoint；
- 刷新 `checkpoints/latest.md` 与 `startup-context/latest.txt`；
- 若失败则仅记录失败，不阻断会话停止。

**`session-end.ts`**
- 记录 `session_ended`；
- 将当前 run 标记为 `completed` 或 `interrupted`；
- 通知 worker 尽量完成剩余 drain；
- 不应因异步处理未完成而阻塞会话退出。

#### B.3 共享库建议

为避免每个 hook 脚本重复实现同一逻辑，建议抽出以下共享模块：

- `runtime/event-schema.ts`：事件类型与 payload 定义；
- `runtime/event-log.ts`：append-only 写入；
- `runtime/queue.ts`：pending/processing/done/failed 队列操作；
- `runtime/projections.ts`：current-run、audit-timeline、risk-signals 更新；
- `runtime/context.ts`：SessionStart additionalContext 生成；
- `runtime/guards.ts`：高价值事件过滤与幂等校验。

#### B.4 配置原则

在 hook 配置层面，建议坚持以下原则：

1. 每个 hook 入口脚本都必须是幂等的；
2. 所有脚本都必须容忍缺失文件与首次运行场景；
3. 所有脚本都必须把失败视为“增强层失败”，除非显式参与强门控；
4. 所有脚本输出都应避免污染 Claude Code 正常上下文；
5. 所有路径都应优先使用仓库相对路径或经过规范化的绝对路径。

#### B.5 Hook 注册说明（职责映射层面）

上述脚本职责映射仅定义“每个 hook 应负责什么”，并不展开 Claude Code `settings.json` 的具体配置语法。实施阶段应再补一份独立的 hook 注册示例，例如 `hooks-settings-example.json` 或 `.claude/settings.local.json` 样例，用来说明：

- `SessionStart` 如何绑定到 `scripts/hooks/session-start.ts`
- `UserPromptSubmit` 如何绑定到 `scripts/hooks/user-prompt-submit.ts`
- `PostToolUse` 如何绑定到 `scripts/hooks/post-tool-use.ts`
- `Stop` 如何绑定到 `scripts/hooks/stop.ts`
- `SessionEnd` 如何绑定到 `scripts/hooks/session-end.ts`

换言之，本附录 B 负责定义职责边界与脚本分工；具体的 hook 注册格式应作为实现阶段的单独配置产物管理。

### 8.7 最终建议结论

如果只给出一个最终建议，那么结论是：

**应采用“以 Layer 4 + commit 门控 为核心试点、以 bmad-master 为统一控制中心、以 auditor 模板为标准化审计骨架、以 hooks 作为运行时增强层”的渐进式适配路线。**

原因有三：

1. **它直接命中当前最严重的问题**：审计缺失、TDD 失效、自动 commit；
2. **它能最早验证架构是否成立**：不需要全量迁移就能证明方向对不对；
3. **它为后续扩展提供稳定模板**：一旦跑通，其他 Layer、扩展 skill 和 hooks 能力的接入都将转化为模板化扩展，而不是重新设计。

因此，本项目下一步最合理的工程动作，不是“先把所有 Agent 都写出来”，而是：

- 先把控制骨架立住；
- 再用一个最关键闭环跑通；
- 同时用最小 hooks 能力补上恢复与追溯；
- 最后按优先级扩展覆盖面。

---

## 第九部分：结论与下一步行动清单

### 9.1 结论

综合前文分析，可以得出三个明确结论。

第一，Claude Code CLI 适配 BMAD-Speckit 五层架构的关键难点，不在于“是否能创建足够多的 Agent”，而在于“如何在 Agent 协作模式下重新建立约束传递、审计闭环、状态追踪和提交门控”。如果这四项基础能力没有被重建，那么即使形式上迁移了命令、skill 和 agent 文件，实际运行时仍会出现流程逃逸、审计缺失和未经验证直接提交的问题。

第二，最合适的适配架构不是单一技术点方案，而是由四个核心支点组成的组合式治理结构：以 `bmad-master` 负责同步强门控，以阶段执行 Agent 负责产出，以 auditor 模板负责标准化审计，以 hooks + worker 负责运行时增强、追溯与恢复。只有这四个层次同时成立，Claude Code CLI 下的 BMAD 运行时才具备稳定性、可恢复性和可持续扩展能力。

第三，本方案不应以“一次性全量迁移”为目标，而应以“最小闭环验证”为优先原则。先在 Layer 4、commit 门控和最小 hooks 能力上跑通，再逐步扩展到 standalone tasks、bugfix、Layer 1/2/3/5 和更强的运行时能力，是风险最低、反馈最快、工程可控性最强的推进方式。

### 9.2 下一步行动清单

建议将下一步工作拆成以下可执行清单：

1. **冻结核心命名与路径约定**
   - 确认 `.claude/agents/`、`.claude/protocols/`、`.claude/state/`、`.claude/state/runtime/` 的目录结构
   - 确认 `run_id`、checkpoint、event log、queue item 的命名规则

2. **实现业务状态骨架**
   - 建立 `.claude/state/bmad-progress.yaml`
   - 建立 `.claude/state/bmad-lock.yaml`
   - 明确 Layer / Stage / 审计状态字段

3. **实现 `bmad-master` 最小版本**
   - 支持状态读取与更新
   - 支持 Layer 路由
   - 支持提交请求拦截
   - 支持审计结果校验

4. **优先实现三个 auditor**
   - `auditor-spec`
   - `auditor-plan`
   - `auditor-tasks`
   - 统一输出格式与通过/未通过结论

5. **优先实现三个 Layer 4 执行 Agent**
   - `bmad-layer4-speckit-specify`
   - `bmad-layer4-speckit-plan`
   - `bmad-layer4-speckit-tasks`
   - 强制显式读取 skill 与审计提示词

6. **接入评分写入**
   - 把 `parse-and-write-score` 接入 auditor 通过后的标准动作
   - 保证失败轮次与最终报告路径都可追溯

7. **实现最小 hooks 能力**
   - SessionStart 注入 checkpoint
   - PostToolUse 捕获高价值事件
   - Stop 生成 checkpoint
   - 单 worker 维护 `current-run.json` 与 `checkpoints/latest.md`
   - 高价值事件白名单建议如下：

     | Tool / 事件来源 | 默认是否捕获 | 捕获条件 |
     |---|---|---|
     | `Write` / `Edit` | 是 | 目标为文档、代码、审计报告、状态文件 |
     | `Read` | 条件性 | 仅在读取审计报告、状态文件、关键规范文件时捕获 |
     | `Agent` | 是 | 仅捕获执行 Agent 与 auditor 调用 |
     | `Bash` | 条件性 | 测试命令、git 相关命令、评分脚本 |
     | `Grep` / `Glob` | 否 | 默认不捕获，避免噪音过高 |

   - 该白名单的目的，是让事件捕获聚焦于会影响流程状态、审计链路或恢复质量的事实

8. **验证高风险路径**
   - 验证未审计时是否能被阻止提交
   - 验证审计失败时是否阻止进入下一阶段
   - 验证会话中断后是否能从 checkpoint 恢复
   - 验证重复执行是否不会破坏状态一致性

9. **用一个真实 Story 做端到端试点**
   - 从 Layer 4 specify 开始
   - 跑完 plan、tasks
   - 检查审计、评分、checkpoint、commit 门控是否协同工作

10. **根据试点结果扩展范围**
    - 接入 standalone tasks
    - 接入 bug assistant
    - 扩展 Layer 1/2/3/5
    - 视情况增加严格模式 / 轻量模式
