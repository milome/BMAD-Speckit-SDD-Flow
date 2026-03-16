# How-To 文档索引

本目录用于存放面向使用者的操作指南、流程说明。

## 推荐入口说明

对于 Story 级 BMAD 工作流，**`bmad-story-assistant` 是推荐入口**。

- `bmad-story-assistant`：Story 流程入口语义（统一文档，Cursor + Claude Code）
- `bmad-master`：其背后的总控、状态机、路由与门控执行机制

## 文档列表

### Story 工作流

- [`bmad-story-assistant.md`](./bmad-story-assistant.md) — Story 助手统一使用说明（Cursor + Claude Code 差异分节）

适合以下场景：
- 想了解 `bmad-story-assistant` 的完整工作流
- 想知道 Story 从创建到审计、实现、Post Audit 的阶段关系
- 想理解 Cursor 与 Claude Code 两个运行时的差异
- 想使用 `--continue` / `--audit-granularity=full|story|epic`

### 其他指南

- [`multi-story.md`](./multi-story.md) — 多 Story 并行管理
- [`cursor-setup.md`](./cursor-setup.md) — Cursor IDE 配置
- [`claude-code-setup.md`](./claude-code-setup.md) — Claude Code 配置
- [`migration.md`](./migration.md) — 现有项目迁移
- [`wsl-shell-scripts.md`](./wsl-shell-scripts.md) — WSL 下使用 Shell 脚本

## 推荐阅读顺序

1. [入门教程](../tutorials/getting-started.md) — 安装与第一次使用
2. [`bmad-story-assistant.md`](./bmad-story-assistant.md) — Story 工作流
3. [`multi-story.md`](./multi-story.md) — 多 Story 管理

## 维护建议

新增 how-to 文档时，请同步更新本索引。
