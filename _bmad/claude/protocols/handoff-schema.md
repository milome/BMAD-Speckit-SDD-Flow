# Handoff Schema

阶段间交接数据格式。

## Required Fields

- `layer`: number — 当前层 (1-5)
- `stage`: string — 当前阶段 (specify | plan | tasks | implement | assure)
- `artifactDocPath`: string — 产物文档路径
- `auditReportPath`: string — 审计报告路径
- `next_action`: string — 推荐下一步动作
- `ready`: boolean — 是否准备好自动继续 (可选，默认 false)
- `mainAgentNextAction`: string — 主 Agent 兼容摘要字段，供旧 handoff consumer 读取
- `mainAgentReady`: boolean — 主 Agent 兼容摘要字段，供旧 handoff consumer 读取

## Preferred Main-Agent Surface

interactive 模式下，主 Agent 的权威编排面不是 handoff 字段本身，而是 repo-native `main-agent-orchestration` surface。

主 Agent 在决定下一步前，必须优先执行：

```bash
npm run main-agent-orchestration -- --cwd {project-root} --action inspect
```

必要时再执行：

```bash
npm run main-agent-orchestration -- --cwd {project-root} --action dispatch-plan
```

主 Agent 应优先消费以下字段：

- `orchestrationState`
- `pendingPacketStatus`
- `pendingPacket`
- `continueDecision`
- `mainAgentNextAction`
- `mainAgentReady`

其中 `mainAgentNextAction` / `mainAgentReady` 在 handoff 中仅作为 compatibility summary；真正权威状态始终是 `orchestrationState + pendingPacket + continueDecision`。

## Example

```yaml
layer: 4
stage: specify
artifactDocPath: specs/epic-1/story-1/spec.md
auditReportPath: reports/spec-audit.md
next_action: proceed_to_plan
ready: true
mainAgentNextAction: dispatch_implement
mainAgentReady: true
```

## Transition Rules

- specify → plan: 需 spec 审计 PASS
- plan → tasks: 需 plan 审计 PASS
- tasks → implement: 需 tasks 审计 PASS
- implement → assure: 需 implement 审计 PASS

## Main Agent Rule

- `next_action` / `ready` 仍可保留为阶段产出语义
- interactive 模式下必须先读取 `main-agent-orchestration` surface，再决定全局分支
- handoff 里的 `mainAgentNextAction` / `mainAgentReady` 只作为 compatibility summary
- 若 repo-native orchestration surface 可用，则以该 surface 为准
- 仅当 repo-native orchestration surface 不可用时，才回退到 handoff 中的 `mainAgentNextAction` / `mainAgentReady`
