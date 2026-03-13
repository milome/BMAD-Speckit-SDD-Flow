# Layer: Code Reviewer Lifecycle

代码审查生命周期管理。

## Use Cases

- 实施后的代码审查
- PR 前的最终检查
- 代码质量门控

## Execution Flow

1. Read `.claude/protocols/audit-result-schema.md`
2. Read `.claude/state/bmad-progress.yaml`
3. 读取实现产物
4. 执行审查检查清单
5. 发现问题 → 记录 findings
6. 无问题 → PASS
7. 调用 `auditor-implement` 确认
8. 更新 reviewer 状态

## State Updates

```yaml
layer: review
stage: review_passed
review_round: number
review_verdict: pass | fail
artifacts:
  review: reviews/.../review.md
```

## Constraints

- **禁止自行 commit**
- 必须通过 auditor-implement
