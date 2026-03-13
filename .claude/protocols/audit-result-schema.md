# Audit Result Schema

结构化审计报告格式，所有 auditor 必须输出符合此 schema 的结果。

## Required Fields

- `status`: `PASS` | `FAIL` — 审计结论，只允许这两种值
- `summary`: string — 审计摘要
- `findings`: array — 发现的问题列表
- `required_fixes`: array — 必须修复的项目
- `reportPath`: string — 完整审计报告路径
- `score_trigger`: boolean — 是否触发评分写入
- `iteration_count`: number — 当前迭代轮次

## Example

```yaml
status: PASS
summary: 规范文档符合要求
findings: []
required_fixes: []
reportPath: reports/spec-audit.md
score_trigger: true
iteration_count: 2
```

## Rules

1. 不允许模糊表述，结论必须是 PASS 或 FAIL
2. FAIL 时必须列出所有 required_fixes
3. PASS 时必须触发评分写入
