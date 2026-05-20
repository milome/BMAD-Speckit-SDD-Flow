# Main-Agent Orchestration

> **Current path**：普通消费用户通过 `$bmad-speckit`、`/bmad-speckit` 或 `bmad-speckit` 在当前 AI 宿主会话中激活主控。`main-agent-orchestration inspect / dispatch-plan` 是主控内部动作；npm / npx 入口只用于安装验证、CI、debug 或 no-skill fallback。

---

## Purpose

`main-agent-orchestration` 是 Main Agent control plane 的内部执行动作，不是普通消费用户的默认入口。

它只能把以下投影统一暴露给主 Agent：

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
- `orchestrationState / pendingPacket / continueDecision` 也是 projection / evidence
- 真正权威状态只能来自 `requirement-record.json`、`currentMentalModel`、六个心智模型链路和 controlled ingest 写入的 gate / audit / closeout / evidence 记录

---

## Commands

以下命令只用于内部 control-plane action、安装验证、CI、debug 或 no-skill fallback。不要把它们写成普通消费用户要手动执行的激活步骤。

### Inspect

```bash
npm run main-agent-orchestration -- --cwd {project-root} --action inspect
```

用途：

- 读取当前 control projection
- 让主 Agent 决定是否继续、rerun、blocked、dispatch、closeout
- 该决定仍必须回到 `requirement-record.json`、`currentMentalModel` 和六个心智模型链路校验

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
- 仅根据 `mainAgentNextAction`、`mainAgentReady`、`orchestrationState`、`pendingPacket` 或旧 runtime context 直接续跑
- 在 interactive 模式下依赖 autonomous fallback / background worker 抢控制权
- 让子代理决定下一条全局分支
