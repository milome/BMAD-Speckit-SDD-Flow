# Handoff Schema

阶段间交接数据格式。

## Required Fields

- `layer`: number — 当前层 (1-5)
- `stage`: string — 当前阶段 (specify | plan | tasks | implement | assure)
- `artifactDocPath`: string — 产物文档路径
- `auditReportPath`: string — 审计报告路径
- `next_action`: string — 推荐下一步动作
- `ready`: boolean — 是否准备好自动继续 (可选，默认 false)

## Example

```yaml
layer: 4
stage: specify
artifactDocPath: specs/epic-1/story-1/spec.md
auditReportPath: reports/spec-audit.md
next_action: proceed_to_plan
ready: true
```

## Transition Rules

- specify → plan: 需 spec 审计 PASS
- plan → tasks: 需 plan 审计 PASS
- tasks → implement: 需 tasks 审计 PASS
- implement → assure: 需 implement 审计 PASS
