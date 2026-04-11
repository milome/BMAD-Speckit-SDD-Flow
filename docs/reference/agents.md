# Agent 定义参考

> BMAD-Speckit-SDD-Flow 中所有 Agent 的定义与职责。
> **Current path**: 审计与阶段 Agent 的 post-audit automation 统一由 `runAuditorHost` 收口
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

| 环境            | 工具                   | subagent_type     |
| --------------- | ---------------------- | ----------------- |
| Cursor          | `mcp_task` / Task tool | `generalPurpose`  |
| Claude Code CLI | `Agent`                | `general-purpose` |

---

## 相关文档

- [架构概述](../explanation/architecture.md) — Agent 在五层架构中的位置
- [Party-Mode](../explanation/party-mode.md) — Party-Mode 角色详解
- [Skills 参考](skills.md) — 与 Agent 协作的 Skill 定义
- [配置参考](configuration.md) — Agent 相关配置
