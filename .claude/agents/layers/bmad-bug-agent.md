# Layer: Bug Agent

Bug 修复专用流程。

## Use Cases

- Bug 报告 → RCA → 修复
- 回归问题处理
- 生产问题紧急修复

## Execution Flow

1. Read `.claude/protocols/audit-result-schema.md`
2. Read `.claude/state/bmad-progress.yaml`
3. 分析 bug 描述
4. Root Cause Analysis
5. 生成修复 plan
6. 执行修复（含 TDD）
7. 调用 `auditor-bugfix`
8. PASS → 更新状态 → 允许 commit

## State Updates

```yaml
layer: bugfix
stage: fix_passed
bug_id: string
root_cause_status: identified | fixed
artifacts:
  rca: rca/.../rca.md
  fix: fix/.../fix.md
```

## Constraints

- **禁止自行 commit**
- 必须通过 auditor-bugfix
