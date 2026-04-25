# Agent 定义参考

> BMAD-Speckit-SDD-Flow 中所有 Agent 的定义与职责。
> **Current path**: 审计与阶段 Agent 的 post-audit automation 统一由 `runAuditorHost` 收口；reviewer 由 shared core 投影到 Cursor / Claude 双宿主 carrier
> **Legacy path**: 各 Agent / 宿主各自手工串联 score / audit-index 后置动作

---

## 概述

Agent 是 BMAD 工作流中的执行体，每个 Agent 负责特定阶段或功能。Agent 定义文件存放在 `.cursor/agents/`（Cursor）或 `.claude/agents/`（Claude Code）目录下。

---

## 核心 Agent

### bmad-master

**总控 / 路由 / 门控执行机制**。负责 Story 工作流的状态机管理，包括：

- 阶段路由：根据当前状态决定进入哪个阶段
- 门控执行：审计未通过时阻止推进
- 恢复续跑：从中断点恢复已有 Story

### bmad-story-create

负责 **Stage 1: Create Story**，从 Epic 中生成标准 Story 文档。

### bmad-story-audit

负责 **Stage 2: Story Audit**，验证 Story 文档的完整性和可执行性。

### bmad-epic-audit

负责 **Epic 级审计**，在 `epic` 审计粒度模式下，替代 Story 级中间阶段审计。

---

## Layer 4 Agent（Speckit 阶段）

| Agent                         | 文件                                      | 阶段       |
| ----------------------------- | ----------------------------------------- | ---------- |
| bmad-layer4-speckit-specify   | `layers/bmad-layer4-speckit-specify.md`   | Spec 生成  |
| bmad-layer4-speckit-plan      | `layers/bmad-layer4-speckit-plan.md`      | Plan 生成  |
| bmad-layer4-speckit-gaps      | `layers/bmad-layer4-speckit-gaps.md`      | GAPS 分析  |
| bmad-layer4-speckit-tasks     | `layers/bmad-layer4-speckit-tasks.md`     | Tasks 生成 |
| bmad-layer4-speckit-implement | `layers/bmad-layer4-speckit-implement.md` | 任务执行   |

---

## 审计 Agent

| Agent             | 文件                            | 审计对象        |
| ----------------- | ------------------------------- | --------------- |
| auditor-spec      | `auditors/auditor-spec.md`      | spec.md         |
| auditor-plan      | `auditors/auditor-plan.md`      | plan.md         |
| auditor-tasks     | `auditors/auditor-tasks.md`     | tasks.md        |
| auditor-implement | `auditors/auditor-implement.md` | 实施代码        |
| auditor-tasks-doc | `auditors/auditor-tasks-doc.md` | 独立 TASKS 文档 |
| auditor-bugfix    | `auditors/auditor-bugfix.md`    | BUGFIX 文档     |

---

## Party-Mode 角色

Party-Mode 中的虚拟角色（定义在 `_bmad/_config/agent-manifest.csv`）：

| Icon | 展示名         | 职责                   |
| ---- | -------------- | ---------------------- |
| ⚔️   | 批判性审计员   | 质疑可操作性、边界情况 |
| 🏗️   | Winston 架构师 | 架构设计、技术选型     |
| 💻   | Amelia 开发    | 实现细节、可行性       |
| 📋   | John 产品经理  | 需求对齐、优先级       |
| 🧪   | Quinn 测试     | 测试策略、质量保证     |

---

## Agent 调用方式

| 环境            | 通用实现通道                 | reviewer 首选路由            | reviewer fallback            |
| --------------- | ---------------------------- | ---------------------------- | ---------------------------- |
| Cursor          | `mcp_task -> generalPurpose` | `Task tool -> code-reviewer` | `mcp_task -> generalPurpose` |
| Claude Code CLI | `Agent -> general-purpose`   | `Agent -> code-reviewer`     | `Agent -> general-purpose`   |

> reviewer runtime carrier 当前分别落在 `.cursor/agents/code-reviewer.md` 与 `.claude/agents/code-reviewer.md`，两者都只投影 shared reviewer core，不再各自承载 stage 语义真相源。

### 主控约束

- **Main Agent 是唯一交互式编排者**：是否继续、重试、修复、reroute、closeout 都必须由主 Agent 决策。
- **子代理只负责 bounded execution**：实现、审计、文档、修复都属于子代理范围；全局流程推进不属于子代理范围。
- **治理脚本 / hook 只负责把关与暴露问题**：它们可以写 state、gate verdict、packet 和 evidence，但不能在 interactive flow 中偷偷推进执行。
- **后台 worker / runner 已禁用为 legacy path**：保留静态兼容包装与证据链文件，但不再承担 autonomous fallback 执行。
- **正式主控消费面**：主 Agent 在决定下一步前，必须优先读取 [main-agent-orchestration.md](./main-agent-orchestration.md) 定义的 repo-native orchestration surface，而不是只读取 handoff 中的 `mainAgentNextAction / mainAgentReady`。

---

## 相关文档

- [架构概述](../explanation/architecture.md) — Agent 在五层架构中的位置
- [Party-Mode](../explanation/party-mode.md) — Party-Mode 角色详解
- [Skills 参考](skills.md) — 与 Agent 协作的 Skill 定义
- [配置参考](configuration.md) — Agent 相关配置
