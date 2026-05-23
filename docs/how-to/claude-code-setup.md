# Claude Code / OMC Guide 索引

本目录存放面向 **Claude Code CLI / OMC** 运行时的专项使用说明。

## 文档列表

### BMAD Story Assistant

- [`bmad-story-assistant.md`](./bmad-story-assistant.md)

适合以下场景：

- 想从 Claude 版 `bmad-story-assistant` 作为入口理解 Story 工作流
- 想查看 `bmad-story-assistant` 与 `@bmad-master` 的关系
- 想使用 `--continue` / `BMAD_AUTO_CONTINUE` / `auto_continue.enabled`
- 想查看 `--audit-granularity=full|story|epic` 的详细输入示例

## 说明

该目录下的文档默认描述的是：

- Claude Code CLI
- OMC 运行时
- `.claude/skills/*`
- `.claude/agents/*`

不等同于 Cursor 中的同名 skill 文档。

## 当前 accepted runtime path

Claude 侧当前 accepted runtime path 已经收敛为：

1. `.claude/hooks/runtime-policy-inject.cjs`
2. `.claude/hooks/pre-continue-check.cjs`
3. 用户在 Claude Code / OMC 会话中通过 `/bmad-speckit`、`$bmad-speckit`、`bmad-speckit` 或等价 skill 入口激活主控
4. 主 Agent 内部执行或等价消费 `main-agent-orchestration inspect|dispatch-plan`
5. 主 Agent 只从 `requirement-record.json`、`currentMentalModel`、六个心智模型链路和 controlled ingest 记录决定是否 claim / dispatch / complete / invalidate

旧 worker 相关 start/skip 日志只应视为 legacy compatibility 提示，不再是当前成功标准。

## Hook 提示开关

如果你希望 Claude Code 项目里的 hooks 在执行时把更多提示信息直接打印出来，可在项目级 `settings.json` 中开启：

```json
{
  "env": {
    "BMAD_HOOKS_VERBOSE": "1"
  }
}
```

推荐写入：

- `<project>/.claude/settings.json`

当前效果：

- `BMAD_HOOKS_VERBOSE=0`
  - 默认安静模式
- `BMAD_HOOKS_VERBOSE=1`
  - Claude hooks 会额外打印：
    - `pre-continue-check passed`
    - `pre-continue-check failed`
    - `pre-continue-check skipped: artifact self write`
    - `runtime-policy-inject` blocked-flow / handoff 提示

这对于排查 `PreToolUse` / `PostToolUse` / `Stop` 是否真的触发，以及主 Agent 是否还能回读 authoritative surface，非常有用。
