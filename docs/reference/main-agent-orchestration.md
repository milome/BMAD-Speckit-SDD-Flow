# Main-Agent Orchestration

> **Current path**：interactive 模式下，主 Agent 必须优先读取 repo-native `main-agent-orchestration` surface，再决定下一步全局分支。

---

## Purpose

`main-agent-orchestration` 是当前仓库的正式主控消费面。

它负责把以下事实统一暴露给主 Agent：

- `orchestrationState`
- `pendingPacketStatus`
- `pendingPacket`
- `continueDecision`
- `mainAgentNextAction`
- `mainAgentReady`
- `gatesLoop`
- `fourSignal`
- `closeout`
- `drift`

其中：

- `mainAgentNextAction / mainAgentReady` 只是 compatibility summary
- 真正权威状态始终是 `orchestrationState + pendingPacket + continueDecision`

---

## Commands

### Inspect

```bash
npm run main-agent-orchestration -- --cwd {project-root} --action inspect
```

用途：

- 读取当前 authoritative surface
- 让主 Agent 决定是否继续、rerun、blocked、dispatch、closeout

### Dispatch Plan

```bash
npm run main-agent-orchestration -- --cwd {project-root} --action dispatch-plan
```

用途：

- 当下一分支可派发但尚未 materialize packet 时，生成正式派发计划
- 返回 bounded packet / route / host / expectedDelta

### Packet Lifecycle

```bash
npm run main-agent-orchestration -- --cwd {project-root} --action claim
npm run main-agent-orchestration -- --cwd {project-root} --action dispatch
npm run main-agent-orchestration -- --cwd {project-root} --action complete
npm run main-agent-orchestration -- --cwd {project-root} --action invalidate
```

用途：

- 由主 Agent 驱动 packet 生命周期
- 子代理只执行 bounded packet，不负责决定下一条全局执行链

---

## Main-Agent Rule

主 Agent 在以下时机必须重新读取 `inspect`：

1. 任何 child result 返回后
2. 任何 `runAuditorHost` close-out 完成后
3. 任何 gate / readiness / drift 状态变化后

禁止：

- 仅根据审计 prose、reviewer prose、`PASS` 文本直接续跑
- 在 interactive 模式下依赖 autonomous fallback / background worker 抢控制权
- 让子代理决定下一条全局分支
