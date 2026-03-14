# Guide 文档索引

本目录用于存放面向使用者的操作指南、流程说明和入门文档。

## 推荐入口说明

对于 Story 级 BMAD 工作流，**`bmad-story-assistant` 是推荐入口**。

需要注意：

- 本目录当前的 `bmad-story-assistant` 文档，介绍的是 **Claude Code CLI / OMC 适配版**
- 文档当前位置已调整为：`docs/guide/claudecode/bmad-story-assistant.md`
- Cursor 中的同名 skill 仍需要单独的使用说明文档，不应与本指南混为一体

理解方式建议如下：

- `bmad-story-assistant`：Story 流程入口语义
- `bmad-master`：其背后的总控、状态机、路由与门控执行机制

如果你是第一次接触这个流程，优先阅读 `claudecode` 目录下的 `bmad-story-assistant` 使用说明；如果你在维护或使用 Cursor 运行时，则阅读 `cursor` 目录下的对应文档。

## 文档列表

### Claude Code / OMC

- [`claudecode/bmad-story-assistant.md`](./claudecode/bmad-story-assistant.md)

适合以下场景：

- 想了解 `bmad-story-assistant` 的完整工作流
- 想知道 Story 从创建到审计、实现、Post Audit 的阶段关系
- 想理解 `handoff`、`state`、`score`、`commit gate` 的协作方式
- 想使用 `--continue` / `BMAD_AUTO_CONTINUE` / `auto_continue.enabled`
- 想查看 `--audit-granularity=full|story|epic` 的详细输入示例（同时包含 `bmad-story-assistant` 与 `@bmad-master` 写法）

### Cursor

- [`cursor/bmad-story-assistant.md`](./cursor/bmad-story-assistant.md)

适合以下场景：

- 想了解 Cursor 版 `bmad-story-assistant` 的运行方式
- 想查看 `mcp_task` 与 `generalPurpose` 的调用约束
- 想查看 `--audit-granularity=full|story|epic` 在 Cursor 中的输入示例
- 想理解 Cursor 与 Claude Code / OMC 两个运行时的差异


## 推荐阅读顺序

如果你是第一次接触本仓的 BMAD Story 流程，建议按以下顺序阅读：

1. [`claudecode/bmad-story-assistant.md`](./claudecode/bmad-story-assistant.md)
2. [`cursor/bmad-story-assistant.md`](./cursor/bmad-story-assistant.md)
3. [`../MULTI-STORY.md`](../MULTI-STORY.md)

## 维护建议

新增 guide 文档时，建议同步更新本索引，保持：

- 文档标题清晰
- 使用场景明确
- 相关文档之间可互相跳转
