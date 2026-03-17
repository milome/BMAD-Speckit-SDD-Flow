# Skills 参考

> BMAD-Speckit-SDD-Flow 中所有 Skill 的定义与用途。

---

## 概述

Skill 是 Cursor/Claude Code 环境中的能力模块，为 AI Agent 提供特定领域的知识和行为约束。Skills 安装到全局目录 `%USERPROFILE%\.cursor\skills\`（Windows）后，IDE 自动发现并加载。

---

## 必须安装的 Skills

这些 Skill 是核心工作流的依赖，缺少任一将导致流程无法正常运行。

### speckit-workflow

核心 Speckit 开发流程：constitution → specify → plan → GAPS → tasks → implement。

- **职责**：定义每个阶段的必须步骤、需求映射、审计闭环、TDD 红绿灯模式
- **依赖**：code-review skill（审计闭环）
- **参考文件**：`references/audit-prompts.md`、`references/mapping-tables.md`、`references/task-execution-tdd.md`

### bmad-story-assistant

Epic/Story 全生命周期管理：Create Story → 审计 → Dev Story → 实施后审计。

- **职责**：五层架构的 Layer 3-5 编排，Party-Mode 触发，handoff/state 管理
- **使用命令**：`/bmad-bmm-create-story`、`/bmad-bmm-dev-story`

### bmad-bug-assistant

BUG 修复全流程：根因分析 → BUGFIX 文档 → 审计 → 任务列表 → 实施。

- **职责**：自动进入 Party-Mode（≥100 轮），产出 BUGFIX 文档，通过子代理实施修复
- **触发**：描述问题时由 `bmad-bug-auto-party-mode` 规则自动触发

### bmad-code-reviewer-lifecycle

全链路 Code Reviewer：审计产出 → 解析 → scoring 写入。

- **职责**：编排各 stage 的审计流程，触发 `bmad-speckit score`
- **依赖**：`_bmad/_config/code-reviewer-config.yaml`、`_bmad/_config/stage-mapping.yaml`

### code-review

审计执行引擎。

- **职责**：按 audit-prompts 的提示词执行逐项审计，输出结构化审计报告
- **调用方**：speckit-workflow、bmad-story-assistant、bmad-bug-assistant

---

## 推荐安装的 Skills

| Skill | 说明 |
|-------|------|
| bmad-standalone-tasks | 按独立 TASKS/BUGFIX 文档执行任务 |
| bmad-standalone-tasks-doc-review | TASKS 文档严格审计 |
| bmad-customization-backup | `_bmad` 目录定制备份与迁移 |
| bmad-orchestrator | BMAD 流程编排 |
| bmad-rca-helper | 深度根因分析（Party-Mode + 审计） |
| bmad-party-mode | 独立 Party-Mode 辩论编排 |
| using-git-worktrees | Git Worktree 管理，Epic 级工作隔离 |
| ralph-method | 任务原子化分解（prd.json + progress.txt） |
| auto-commit-utf8 | 中文 commit 防乱码 |
| git-push-monitor | 长时间 push 监控 |
| speckit-scripts-backup | Speckit 脚本备份与迁移 |

---

## Skill 安装

```powershell
$SKILLS_ROOT = "$env:USERPROFILE\.cursor\skills"
$src = "D:\Dev\BMAD-Speckit-SDD-Flow\skills\<skill-name>"
Copy-Item -Recurse -Force $src "$SKILLS_ROOT\<skill-name>"
```

项目根 `skills/` 目录是分发源（版本化），全局目录是运行时目标（IDE 实际读取）。

---

## Skill 与 Agent 的关系

- **Skill**：提供领域知识和行为约束，由 IDE 自动加载到 Agent 的上下文
- **Agent**：具体的执行体，执行特定阶段的任务
- **协作**：Agent 在执行时参考 Skill 的规则和约束

```
Skill (知识/约束) ←→ Agent (执行体) → 产出 (文档/代码)
```

---

## 相关文档

- [架构概述](../explanation/architecture.md) — Skills 在架构中的位置
- [Agent 参考](agents.md) — 与 Skills 协作的 Agent 定义
- [入门教程](../tutorials/getting-started.md) — Skills 安装指南
- [配置参考](configuration.md) — Skills 相关配置
