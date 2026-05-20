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

## Main-Agent Control Boundary

interactive 模式下，普通消费用户只能通过 `$bmad-speckit`、`/bmad-speckit` 或 `bmad-speckit` 在当前 AI 宿主会话中激活主控。`main-agent-orchestration inspect / dispatch-plan` 是主控内部动作；npm / npx 入口只允许用于安装验证、CI、debug 或 no-skill fallback。

handoff 字段本身不是控制事实源。主 Agent 在决定下一步前，必须重新读取受控记录，并只从以下事实推导全局分支：

- `requirement-record.json`
- `currentMentalModel`
- 六个心智模型链路：需求确认、架构确认、实施准备、执行闭合、审计复核、交付确认
- controlled ingest 写入的 gate / audit / closeout / evidence 记录

`orchestrationState`、`pendingPacket`、`continueDecision`、`mainAgentNextAction` 和 `mainAgentReady` 只能作为 projection、compatibility hint 或 evidence。即使 handoff 中显示 ready，也不得绕过 RequirementRecord、当前 hash、当前 attempt 和六个心智模型状态。

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
- handoff 里的 `mainAgentNextAction` / `mainAgentReady` 只作为 compatibility summary
- interactive 模式下必须通过受控 RequirementRecord、`currentMentalModel` 和六个心智模型链路决定全局分支
- 不存在从 handoff 字段回退取得控制权的路径；handoff 缺失或不一致时，应重新 inspect 受控记录或阻断
